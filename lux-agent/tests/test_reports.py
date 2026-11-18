import contextlib
import io
import json
import secrets
import socket
import tempfile
import threading
import unittest
import uuid
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from unittest.mock import Mock, patch

from lux_agent.errors import DiagnosticError
from lux_agent.journal import CommandJournal
from lux_agent.polling import poll_associations
from lux_agent.reports import ReportProcessor, load_report, validate_report


def report():
    return {
        'protocolVersion': 1,
        'reportId': str(uuid.uuid4()),
        'collectedAt': '2026-11-04T20:00:00Z',
        'applications': [
            {'sourceId': 'org.mozilla.firefox', 'name': 'Firefox', 'category': 'browser', 'allowed': True}
        ],
        'installationRequests': [],
    }


class ReportTests(unittest.TestCase):
    def setUp(self):
        self.directory = tempfile.TemporaryDirectory()
        self.root = Path(self.directory.name)
        self.credential = secrets.token_urlsafe(32)
        self.requests = []
        self.drop_response = False
        self.reject_status = None
        owner = self

        class Handler(BaseHTTPRequestHandler):
            def do_PUT(self):
                length = int(self.headers.get('Content-Length', '0'))
                body = json.loads(self.rfile.read(length))
                owner.requests.append((self.path, body, self.headers.get('Authorization')))
                if owner.drop_response:
                    owner.drop_response = False
                    self.connection.shutdown(socket.SHUT_RDWR)
                    return
                if owner.reject_status is not None:
                    self.send_response(owner.reject_status)
                    self.end_headers()
                    return
                status = 201 if len(owner.requests) == 1 else 200
                self.send_response(status)
                self.end_headers()
                self.wfile.write(json.dumps({'reportId': body['reportId'], 'accepted': True}).encode())

            def log_message(self, *args):
                pass

        self.server = ThreadingHTTPServer(('127.0.0.1', 0), Handler)
        self.thread = threading.Thread(target=self.server.serve_forever, daemon=True)
        self.thread.start()
        self.origin = f'http://127.0.0.1:{self.server.server_port}'
        self.journal = CommandJournal(str(self.root / 'state'), self.origin, self.credential)
        self.processor = ReportProcessor(self.origin + '/agent/reports', self.credential, self.journal, timeout=2)
        self.file = self.root / 'report.json'

    def tearDown(self):
        self.journal.close()
        self.server.shutdown()
        self.server.server_close()
        self.thread.join()
        self.directory.cleanup()

    def write_report(self, payload):
        self.file.write_text(json.dumps(payload))

    def restart(self):
        self.journal.close()
        self.journal = CommandJournal(str(self.root / 'state'), self.origin, self.credential)
        self.processor = ReportProcessor(self.origin + '/agent/reports', self.credential, self.journal, timeout=2)

    def test_report_is_sent_once_and_repeated_poll_is_idempotent(self):
        payload = report()
        self.write_report(payload)
        self.assertEqual(self.processor.run_once(str(self.file)), 1)
        self.assertEqual(self.processor.run_once(str(self.file)), 0)
        self.assertEqual(len(self.requests), 1)
        self.assertEqual(self.requests[0][1], payload)
        self.assertEqual(self.requests[0][2], 'Bearer ' + self.credential)

    def test_lost_response_reuses_pending_report_after_restart(self):
        payload = report()
        self.write_report(payload)
        self.drop_response = True
        with self.assertRaises(DiagnosticError):
            self.processor.run_once(str(self.file))
        self.assertEqual(self.journal.get_report(payload['reportId'])[2], 'pending')
        self.restart()
        self.assertEqual(self.processor.run_once(str(self.file)), 1)
        self.assertEqual([body for _, body, _ in self.requests], [payload, payload])

    def test_definitive_rejection_is_recorded_and_not_resent_after_restart(self):
        for status in (400, 409, 413, 422):
            with self.subTest(status=status):
                payload = report()
                self.write_report(payload)
                self.reject_status = status
                self.requests.clear()
                with contextlib.redirect_stderr(io.StringIO()) as stderr:
                    self.assertEqual(self.processor.run_once(str(self.file)), 0)
                self.assertIn(f'HTTP {status}', stderr.getvalue())
                self.assertEqual(self.journal.get_report(payload['reportId'])[2], 'rejected')
                self.restart()
                self.assertEqual(self.processor.run_once(str(self.file)), 0)
                self.assertEqual(len(self.requests), 1)

    def test_transient_failure_keeps_report_pending(self):
        payload = report()
        self.write_report(payload)
        self.reject_status = 503
        with self.assertRaises(DiagnosticError) as raised:
            self.processor.run_once(str(self.file))
        self.assertTrue(raised.exception.retryable)
        self.assertEqual(self.journal.get_report(payload['reportId'])[2], 'pending')

    def test_invalid_report_is_rejected_before_network(self):
        payload = report()
        payload['applications'].append(payload['applications'][0].copy())
        self.write_report(payload)
        with self.assertRaises(DiagnosticError):
            load_report(self.file)
        self.assertEqual(self.requests, [])

    def test_blockability_fields_must_be_consistent(self):
        base = report()['applications'][0]
        for fields, valid in (
            ({}, True),
            ({'blockable': True, 'executable': '/usr/bin/firefox'}, True),
            ({'blockable': False, 'executable': None}, True),
            ({'blockable': True, 'executable': None}, False),
            ({'blockable': False, 'executable': '/usr/bin/xdg-open'}, False),
            ({'blockable': True, 'executable': 'firefox'}, False),
            ({'blockable': True, 'executable': '/' + 'x' * 191}, False),
            ({'blockable': True}, False),
        ):
            payload = report()
            payload['applications'] = [{**base, **fields}]
            with self.subTest(fields=fields):
                if valid:
                    validate_report(payload)
                else:
                    with self.assertRaises(DiagnosticError):
                        validate_report(payload)


if __name__ == '__main__':
    unittest.main()


class ReportPollingTests(unittest.TestCase):
    def poll(self, associations):
        processor = Mock()
        processor.run_once.return_value = 1
        stdout = io.StringIO()
        with patch('lux_agent.polling.query_associations', return_value=associations), contextlib.redirect_stdout(stdout):
            code = poll_associations('https://api.invalid/agent/associations', 'x', max_queries=1,
                                     report_processor=processor, report_file='report.json')
        self.assertEqual(code, 0)
        return processor, stdout.getvalue()

    def test_report_waits_without_active_association(self):
        for associations in ([], [{'revokedAt': '2026-11-01T00:00:00Z'}]):
            with self.subTest(associations=associations):
                processor, output = self.poll(associations)
                processor.run_once.assert_not_called()
                self.assertIn('aguardando vínculo ativo', output)

    def test_report_is_sent_with_active_association(self):
        processor, _ = self.poll([{'revokedAt': '2026-11-01T00:00:00Z'}, {'revokedAt': None}])
        processor.run_once.assert_called_once_with('report.json')
