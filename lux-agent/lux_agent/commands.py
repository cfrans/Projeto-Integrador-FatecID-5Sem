import json
import time
import uuid
from datetime import datetime, timezone

from .backend import network_deadline, request_json
from .errors import DiagnosticError


def invalid_response():
    return DiagnosticError('Resposta incompatível com o protocolo de comandos.', 6, category='response')


def uuid_value(value):
    try:
        return isinstance(value, str) and str(uuid.UUID(value, version=4)) == value
    except ValueError:
        return False


def timestamp(value):
    if not isinstance(value, str):
        raise invalid_response()
    try:
        parsed = datetime.fromisoformat(value.replace('Z', '+00:00'))
        if parsed.utcoffset() != timezone.utc.utcoffset(parsed):
            raise ValueError
        return parsed.timestamp()
    except (ValueError, OverflowError):
        raise invalid_response() from None


def validate_command(command):
    if not isinstance(command, dict):
        raise invalid_response()
    if any(not uuid_value(command.get(key)) for key in ('id', 'associationId', 'requestId')):
        raise invalid_response()
    if command.get('type') != 'agent.ping' or type(command.get('version')) is not int or command['version'] != 1 or command.get('parameters') != {}:
        raise invalid_response()
    if command.get('status') not in ('pending', 'running', 'succeeded', 'failed', 'expired', 'cancelled', 'unknown'):
        raise invalid_response()
    for field in ('createdAt', 'expiresAt'):
        timestamp(command.get(field))
    if command.get('executionTimeoutSeconds') != 30:
        raise invalid_response()
    if command.get('claimId') is not None and not uuid_value(command['claimId']):
        raise invalid_response()
    if command.get('executionDeadlineAt') is not None:
        timestamp(command['executionDeadlineAt'])
    return command


def execute_ping():
    return {'reachable': True}


class CommandProcessor:
    def __init__(self, endpoint, credential, journal, timeout=10, ca_file=None):
        self.endpoint = endpoint
        self.credential = credential
        self.journal = journal
        self.timeout = timeout
        self.ca_file = ca_file

    def request(self, suffix='', method='GET', payload=None):
        with network_deadline(self.timeout):
            return request_json(self.endpoint + suffix, self.credential, self.timeout, self.ca_file,
                                method=method, payload=payload, max_bytes=16 * 1024)

    def envelope(self, response):
        if not isinstance(response, dict) or type(response.get('protocolVersion')) is not int or response['protocolVersion'] != 1:
            raise invalid_response()
        return timestamp(response.get('serverTime'))

    def process(self, entry):
        command_id, claim_id, state, saved_result = entry
        try:
            if state == 'claim_pending':
                started_at = time.monotonic()
                response = self.request('/' + command_id + '/claim', 'POST', {'claimId': claim_id})
                server_time = self.envelope(response)
                command = validate_command(response.get('command'))
                if command['id'] != command_id or command.get('claimId') != claim_id:
                    raise invalid_response()
                if command['status'] != 'running':
                    self.journal.record(command_id, 'abandoned')
                    return 0
                remaining = timestamp(command.get('executionDeadlineAt')) - server_time - (time.monotonic() - started_at)
                if not 0 < remaining <= 30:
                    self.journal.record(command_id, 'uncertain')
                    return 0
                deadline = time.monotonic() + remaining
                self.journal.record(command_id, 'started')
                if time.monotonic() >= deadline:
                    result = {'claimId': claim_id, 'status': 'failed', 'result': None, 'error': {'code': 'EXECUTION_TIMEOUT'}}
                else:
                    result = {'claimId': claim_id, 'status': 'succeeded', 'result': execute_ping(), 'error': None}
                self.journal.record(command_id, 'result', result)
                saved_result = json.dumps(result)
            result = json.loads(saved_result)
            response = self.request('/' + command_id + '/result', 'PUT', result)
            if not isinstance(response, dict) or response.get('id') != command_id or response.get('status') != result['status']:
                raise invalid_response()
            timestamp(response.get('completedAt'))
            self.journal.record(command_id, 'acknowledged', result)
            return 1
        except DiagnosticError as error:
            if error.http_status in (404, 410):
                self.journal.record(command_id, 'abandoned')
                return 0
            raise

    def run_once(self):
        confirmed = 0
        for entry in self.journal.pending():
            confirmed += self.process(entry)
        response = self.request()
        self.envelope(response)
        commands = response.get('commands')
        if not isinstance(commands, list) or len(commands) > 1:
            raise invalid_response()
        for command in commands:
            validate_command(command)
            if command['status'] != 'pending' or command.get('claimId') is not None or command.get('executionDeadlineAt') is not None:
                raise invalid_response()
            if self.journal.get(command['id']) is None:
                self.journal.prepare(command['id'], str(uuid.uuid4()))
                confirmed += self.process(self.journal.get(command['id']))
        return confirmed
