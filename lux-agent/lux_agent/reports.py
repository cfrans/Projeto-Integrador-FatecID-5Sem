import json
import sys
import uuid
from datetime import datetime, timezone
from pathlib import Path

from .backend import network_deadline, request_json, serialize_payload
from .errors import DiagnosticError

MAX_REPORT_BYTES = 16 * 1024
MAX_ENTRIES = 200
REJECTED_STATUSES = (400, 409, 413, 422)


def invalid_report():
    return DiagnosticError(
        'Relatório incompatível com o contrato.', 6, category='response'
    )


def report_uuid(value):
    try:
        return isinstance(value, str) and str(uuid.UUID(value, version=4)) == value
    except ValueError:
        return False


def report_timestamp(value):
    if not isinstance(value, str):
        raise invalid_report()
    try:
        parsed = datetime.fromisoformat(value.replace('Z', '+00:00'))
        if parsed.utcoffset() != timezone.utc.utcoffset(parsed):
            raise ValueError
    except (ValueError, OverflowError):
        raise invalid_report() from None


def source_id(value):
    return isinstance(value, str) and 0 < len(value) <= 191


def serialized_size(report):
    return len(serialize_payload(report))


def validate_report(report):
    if not isinstance(report, dict):
        raise invalid_report()
    if set(report) != {'protocolVersion', 'reportId', 'collectedAt', 'applications', 'installationRequests'}:
        raise invalid_report()
    if report.get('protocolVersion') != 1 or not report_uuid(report.get('reportId')):
        raise invalid_report()
    report_timestamp(report.get('collectedAt'))
    for key in ('applications', 'installationRequests'):
        entries = report.get(key)
        if not isinstance(entries, list) or len(entries) > MAX_ENTRIES:
            raise invalid_report()
        seen = set()
        for entry in entries:
            if not isinstance(entry, dict) or entry.get('sourceId') in seen:
                raise invalid_report()
            seen.add(entry.get('sourceId'))
            if not source_id(entry.get('sourceId')):
                raise invalid_report()
            if key == 'applications':
                if set(entry) != {'sourceId', 'name', 'category', 'allowed'}:
                    raise invalid_report()
                if not isinstance(entry.get('name'), str) or not 0 < len(entry['name']) <= 200:
                    raise invalid_report()
                if not isinstance(entry.get('category'), str) or not 0 < len(entry['category']) <= 100:
                    raise invalid_report()
                if type(entry.get('allowed')) is not bool:
                    raise invalid_report()
            else:
                if set(entry) != {'sourceId', 'applicationName', 'requesterName', 'requestedAt', 'ageRating'}:
                    raise invalid_report()
                if not isinstance(entry.get('applicationName'), str) or not 0 < len(entry['applicationName']) <= 200:
                    raise invalid_report()
                if not isinstance(entry.get('requesterName'), str) or not 0 < len(entry['requesterName']) <= 100:
                    raise invalid_report()
                if not isinstance(entry.get('ageRating'), str) or len(entry['ageRating']) > 20:
                    raise invalid_report()
                report_timestamp(entry.get('requestedAt'))
    return report


def load_report(path):
    try:
        raw = Path(path).read_bytes()
        if len(raw) > MAX_REPORT_BYTES:
            raise ValueError
        report = json.loads(raw)
    except (OSError, ValueError, UnicodeDecodeError, RecursionError):
        raise DiagnosticError('Arquivo de relatório inválido ou excessivo.', 2) from None
    return validate_report(report)


class ReportProcessor:
    def __init__(self, endpoint, credential, journal, timeout=10, ca_file=None):
        self.endpoint = endpoint
        self.credential = credential
        self.journal = journal
        self.timeout = timeout
        self.ca_file = ca_file

    def request(self, payload):
        with network_deadline(self.timeout):
            return request_json(
                self.endpoint, self.credential, self.timeout, self.ca_file,
                method='PUT', payload=payload, max_bytes=16 * 1024,
                expected_statuses=(200, 201),
            )

    def process_pending(self):
        confirmed = 0
        for report_id, raw_payload, state in self.journal.pending_reports():
            payload = json.loads(raw_payload)
            try:
                response = self.request(payload)
            except DiagnosticError as error:
                if error.http_status not in REJECTED_STATUSES:
                    raise
                self.journal.reject_report(report_id)
                print(
                    f'Aviso: relatório {report_id} rejeitado pelo backend (HTTP {error.http_status}); não será reenviado.',
                    file=sys.stderr, flush=True,
                )
                continue
            if not isinstance(response, dict) or response.get('reportId') != report_id or response.get('accepted') is not True:
                raise invalid_report()
            self.journal.acknowledge_report(report_id)
            confirmed += 1
        return confirmed

    def run_once(self, report_file=None):
        confirmed = self.process_pending()
        if report_file is None:
            return confirmed
        payload = load_report(report_file)
        report_id = payload['reportId']
        existing = self.journal.get_report(report_id)
        serialized = json.dumps(payload, sort_keys=True)
        if existing is not None:
            if existing[1] != serialized:
                raise DiagnosticError('reportId reutilizado com outro conteúdo.', 2)
            return confirmed + self.process_pending()
        self.journal.prepare_report(report_id, payload)
        return confirmed + self.process_pending()
