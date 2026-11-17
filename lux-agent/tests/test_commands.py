import contextlib
import copy
import io
import json
import os
import secrets
import socket
import tempfile
import threading
import unittest
import uuid
from datetime import datetime, timedelta, timezone
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from unittest.mock import patch

from lux_agent.errors import DiagnosticError
from lux_agent.journal import CommandJournal
from lux_agent.commands import CommandProcessor
from lux_agent.parental import ParentalFailure
from lux_agent.cli import poll_main as main
from lux_agent.polling import poll_associations


def date(offset=0):
    return (datetime.now(timezone.utc) + timedelta(seconds=offset)).isoformat().replace('+00:00', 'Z')


def command():
    return {'id': str(uuid.uuid4()), 'associationId': str(uuid.uuid4()), 'requestId': str(uuid.uuid4()),
            'type': 'agent.ping', 'version': 1, 'parameters': {}, 'status': 'pending',
            'createdAt': date(), 'expiresAt': date(300), 'executionTimeoutSeconds': 30,
            'claimId': None, 'executionDeadlineAt': None, 'result': None, 'error': None, 'completedAt': None}


class CommandTests(unittest.TestCase):
    def setUp(self):
        self.directory = tempfile.TemporaryDirectory()
        self.root = Path(self.directory.name)
        self.credential = secrets.token_urlsafe(32)
        self.command = command()
        self.requests = []
        self.statuses = {}
        self.drop_claim = False
        self.drop_result = False
        self.result = None
        self.poll_override = None
        self.claim_override = None
        owner = self

        class Handler(BaseHTTPRequestHandler):
            def handle_request(self):
                length = int(self.headers.get('Content-Length', '0'))
                body = json.loads(self.rfile.read(length)) if length else None
                owner.requests.append((self.command, self.path, body, self.headers.get('Authorization')))
                status = owner.statuses.get(self.command, 200)
                if self.path == '/agent/associations':
                    response = []
                elif self.command == 'GET':
                    response = {'protocolVersion': 1, 'serverTime': date(), 'commands': [copy.deepcopy(owner.command)] if owner.command['status'] == 'pending' else []}
                    response = owner.poll_override if owner.poll_override is not None else response
                elif self.command == 'POST':
                    if owner.command['claimId'] not in (None, body['claimId']):
                        status = 409
                    if status == 200:
                        if owner.command['claimId'] is None:
                            owner.command.update(status='running', claimId=body['claimId'], executionDeadlineAt=date(30))
                    response = {'protocolVersion': 1, 'serverTime': date(), 'command': copy.deepcopy(owner.command)}
                    response = owner.claim_override if owner.claim_override is not None else response
                    if owner.drop_claim:
                        owner.drop_claim = False
                        self.connection.shutdown(socket.SHUT_RDWR)
                        return
                else:
                    if status == 200:
                        owner.result = body
                        owner.command.update(status=body['status'], completedAt=owner.command.get('completedAt') or date())
                    response = {'id': owner.command['id'], 'status': owner.command['status'], 'completedAt': owner.command['completedAt']}
                    if owner.drop_result:
                        owner.drop_result = False
                        self.connection.shutdown(socket.SHUT_RDWR)
                        return
                self.send_response(status)
                if status == 503:
                    self.send_header('Retry-After', '0')
                self.end_headers()
                self.wfile.write(json.dumps(response).encode())

            do_GET = handle_request
            do_POST = handle_request
            do_PUT = handle_request

            def log_message(self, *args):
                pass

        self.server = ThreadingHTTPServer(('127.0.0.1', 0), Handler)
        self.thread = threading.Thread(target=self.server.serve_forever, daemon=True)
        self.thread.start()
        self.origin = f'http://127.0.0.1:{self.server.server_port}'
        self.journal = CommandJournal(str(self.root / 'state'), self.origin, self.credential)
        self.processor = CommandProcessor(self.origin + '/agent/commands', self.credential, self.journal, timeout=2)

    def tearDown(self):
        self.journal.close()
        self.server.shutdown()
        self.server.server_close()
        self.thread.join()
        self.directory.cleanup()

    def restart(self):
        self.journal.close()
        self.journal = CommandJournal(str(self.root / 'state'), self.origin, self.credential)
        self.processor = CommandProcessor(self.origin + '/agent/commands', self.credential, self.journal, timeout=2)

    def test_ping_roundtrip_and_repeated_poll_never_reexecutes(self):
        with patch('lux_agent.commands.execute_ping', return_value={'reachable': True}) as execute:
            self.assertEqual(self.processor.run_once(), 1)
            self.assertEqual(self.processor.run_once(), 0)
            self.restart()
            self.assertEqual(self.processor.run_once(), 0)
            execute.assert_called_once()
        self.assertEqual(self.result['result'], {'reachable': True})
        self.assertEqual(self.journal.get(self.command['id'])[2], 'acknowledged')
        self.assertTrue(all(item[3] == 'Bearer ' + self.credential for item in self.requests))
        self.assertEqual([item[0] for item in self.requests[:3]], ['GET', 'POST', 'PUT'])

    def test_lost_claim_response_reuses_persisted_uuid_after_restart(self):
        self.drop_claim = True
        with patch('lux_agent.commands.execute_ping', return_value={'reachable': True}) as execute:
            with self.assertRaises(DiagnosticError) as raised:
                self.processor.run_once()
            self.assertTrue(raised.exception.retryable)
            entry = self.journal.get(self.command['id'])
            self.assertEqual(entry[2], 'claim_pending')
            execute.assert_not_called()
            self.restart()
            self.assertEqual(self.processor.run_once(), 1)
            execute.assert_called_once()
        claims = [item[2]['claimId'] for item in self.requests if item[0] == 'POST']
        self.assertEqual(claims, [entry[1], entry[1]])

    def test_lost_result_ack_replays_identical_result_without_execution(self):
        self.drop_result = True
        with patch('lux_agent.commands.execute_ping', return_value={'reachable': True}) as execute:
            with self.assertRaises(DiagnosticError):
                self.processor.run_once()
            self.assertEqual(self.journal.get(self.command['id'])[2], 'result')
            self.restart()
            self.assertEqual(self.processor.run_once(), 1)
            execute.assert_called_once()
        puts = [item[2] for item in self.requests if item[0] == 'PUT']
        self.assertEqual(len(puts), 2)
        self.assertEqual(puts[0], puts[1])

    def test_started_without_result_is_not_reexecuted_after_restart(self):
        def crash():
            raise KeyboardInterrupt

        with patch('lux_agent.commands.execute_ping', side_effect=crash):
            with self.assertRaises(KeyboardInterrupt):
                self.processor.run_once()
        self.assertEqual(self.journal.get(self.command['id'])[2], 'started')
        self.restart()
        with patch('lux_agent.commands.execute_ping') as execute:
            self.assertEqual(self.processor.run_once(), 0)
            execute.assert_not_called()
        self.assertIsNone(self.result)

    def test_failed_journal_write_prevents_execution(self):
        original = self.journal.record

        def record(command_id, state, result=None):
            if state == 'started':
                raise DiagnosticError('disk unavailable', 2)
            return original(command_id, state, result)

        with patch.object(self.journal, 'record', side_effect=record), patch('lux_agent.commands.execute_ping') as execute:
            with self.assertRaises(DiagnosticError):
                self.processor.run_once()
            execute.assert_not_called()

    def test_revoked_claim_or_result_is_abandoned_without_reexecution(self):
        self.statuses['POST'] = 410
        with patch('lux_agent.commands.execute_ping') as execute:
            self.processor.run_once()
            execute.assert_not_called()
        self.assertEqual(self.journal.get(self.command['id'])[2], 'abandoned')
        self.command = command()
        self.statuses = {'PUT': 410}
        with patch('lux_agent.commands.execute_ping', return_value={'reachable': True}) as execute:
            self.processor.run_once()
            self.processor.run_once()
            execute.assert_called_once()
        self.assertEqual(self.journal.get(self.command['id'])[2], 'abandoned')

    def test_unknown_or_expired_claim_is_never_executed(self):
        for status in ('unknown', 'expired', 'cancelled'):
            self.command = command()
            saved = copy.deepcopy(self.command)
            saved.update(status=status, claimId=str(uuid.uuid4()), executionDeadlineAt=date(-5))
            self.journal.prepare(saved['id'], saved['claimId'])
            self.claim_override = {'protocolVersion': 1, 'serverTime': date(), 'command': saved}
            with patch('lux_agent.commands.execute_ping') as execute:
                self.processor.process(self.journal.get(saved['id']))
                execute.assert_not_called()

    def test_expired_running_budget_and_slow_claim_response_prevent_execution(self):
        self.command.update(status='running', claimId=str(uuid.uuid4()), executionDeadlineAt=date(-1))
        self.journal.prepare(self.command['id'], self.command['claimId'])
        with patch('lux_agent.commands.execute_ping') as execute:
            self.processor.process(self.journal.get(self.command['id']))
            execute.assert_not_called()
        self.assertEqual(self.journal.get(self.command['id'])[2], 'uncertain')
        self.command = command()
        with patch('lux_agent.commands.time.monotonic', side_effect=[0, 40]), patch('lux_agent.commands.execute_ping') as execute:
            self.processor.run_once()
            execute.assert_not_called()

    def test_malformed_commands_never_claim(self):
        for change in ({'type': 7}, {'version': True}, {'parameters': ['root']}, {'id': '../other'}, {'executionTimeoutSeconds': 100}, {'createdAt': 'invalid'}):
            self.command = command()
            self.command.update(change)
            self.requests.clear()
            with self.assertRaises(DiagnosticError), patch('lux_agent.commands.execute_ping') as execute:
                self.processor.run_once()
            self.assertEqual([item[0] for item in self.requests], ['GET'])
            execute.assert_not_called()
        self.poll_override = {'protocolVersion': 1, 'serverTime': date(), 'commands': [command(), command()]}
        with self.assertRaises(DiagnosticError):
            self.processor.run_once()

    def test_unsupported_or_invalid_commands_fail_typed_and_polling_continues(self):
        cases = (
            ({'type': 'shell.exec'}, 'UNSUPPORTED_OPERATION'),
            ({'version': 2}, 'UNSUPPORTED_OPERATION'),
            ({'parameters': {'user': 'root'}}, 'INVALID_PARAMETERS'),
            ({'type': 'parental.app_filter.set', 'parameters': {'blockedApplications': ['/bin/sh'], 'blockInstallation': True}}, 'INVALID_PARAMETERS'),
            ({'type': 'parental.app_filter.set', 'parameters': {'blockedApplications': ['desktop:a.desktop'] * 2, 'blockInstallation': True}}, 'INVALID_PARAMETERS'),
            ({'type': 'parental.app_filter.set', 'parameters': {'blockedApplications': [], 'blockInstallation': 1}}, 'INVALID_PARAMETERS'),
            ({'type': 'parental.app_filter.set', 'parameters': {'blockedApplications': [], 'blockInstallation': True, 'user': 'root'}}, 'INVALID_PARAMETERS'),
        )
        for change, code in cases:
            self.command = command()
            self.command.update(change)
            with patch('lux_agent.commands.execute_ping') as ping, patch('lux_agent.commands.apply_app_filter') as apply:
                with contextlib.redirect_stdout(io.StringIO()), contextlib.redirect_stderr(io.StringIO()):
                    exit_code = poll_associations(self.origin + '/agent/associations', self.credential, command_processor=self.processor,
                                                  interval=0.01, jitter=0, max_queries=2)
                ping.assert_not_called()
                apply.assert_not_called()
            self.assertEqual(exit_code, 0)
            self.assertEqual(self.result, {'claimId': self.command['claimId'], 'status': 'failed', 'result': None, 'error': {'code': code}})
            self.assertEqual(self.journal.get(self.command['id'])[2], 'acknowledged')

    def test_app_filter_set_applies_to_local_managed_user_and_returns_reread(self):
        self.processor.managed_user = 'crianca'
        parameters = {'blockedApplications': ['desktop:gimp.desktop'], 'blockInstallation': True}
        self.command.update(type='parental.app_filter.set', parameters=parameters, requestId=str(uuid.uuid5(uuid.NAMESPACE_URL, 'revision')))
        with patch('lux_agent.commands.apply_app_filter', return_value=parameters) as apply:
            self.assertEqual(self.processor.run_once(), 1)
        apply.assert_called_once_with('crianca', parameters)
        self.assertEqual(self.result['status'], 'succeeded')
        self.assertEqual(self.result['result'], parameters)
        self.assertIsNone(self.result['error'])

    def test_app_filter_set_failures_are_reported_with_code(self):
        for code in ('PERMISSION_DENIED', 'ACCOUNT_NOT_MANAGED', 'LOCAL_UNAVAILABLE', 'VERIFICATION_FAILED', 'POLICY_UNAVAILABLE'):
            self.command = command()
            self.command.update(type='parental.app_filter.set', parameters={'blockedApplications': [], 'blockInstallation': False})
            with patch('lux_agent.commands.apply_app_filter', side_effect=ParentalFailure(code)):
                self.assertEqual(self.processor.run_once(), 1)
            self.assertEqual(self.result['status'], 'failed')
            self.assertIsNone(self.result['result'])
            self.assertEqual(self.result['error'], {'code': code})

    def test_reemitted_set_after_crash_reapplies_same_filter(self):
        parameters = {'blockedApplications': ['desktop:gimp.desktop'], 'blockInstallation': False}
        self.command.update(type='parental.app_filter.set', parameters=parameters)
        first = self.command['id']
        with patch('lux_agent.commands.apply_app_filter', side_effect=KeyboardInterrupt):
            with self.assertRaises(KeyboardInterrupt):
                self.processor.run_once()
        self.assertEqual(self.journal.get(first)[2], 'started')
        self.command['status'] = 'unknown'
        self.restart()
        with patch('lux_agent.commands.apply_app_filter', return_value=parameters) as apply:
            self.assertEqual(self.processor.run_once(), 0)
            apply.assert_not_called()
            self.command = command()
            self.command.update(type='parental.app_filter.set', parameters=parameters)
            self.assertEqual(self.processor.run_once(), 1)
            apply.assert_called_once_with(None, parameters)
        self.assertEqual(self.journal.get(first)[2], 'started')
        self.assertEqual(self.result['status'], 'succeeded')

    def test_revoked_association_stops_sync_without_touching_policies(self):
        self.command.update(type='parental.app_filter.set', status='cancelled',
                            parameters={'blockedApplications': [], 'blockInstallation': False})
        with patch('lux_agent.commands.apply_app_filter') as apply, patch('lux_agent.parental.load_malcontent') as bindings:
            with contextlib.redirect_stdout(io.StringIO()), contextlib.redirect_stderr(io.StringIO()):
                code = poll_associations(self.origin + '/agent/associations', self.credential, command_processor=self.processor,
                                         interval=0.01, jitter=0, max_queries=2)
            apply.assert_not_called()
            bindings.assert_not_called()
        self.assertEqual(code, 0)
        self.assertEqual([item[0] for item in self.requests if item[1].startswith('/agent/commands')], ['GET', 'GET'])

    def test_authentication_and_conflicts_keep_journal_and_stop(self):
        for status in (401, 409):
            self.command = command()
            self.statuses = {'POST': status}
            with self.assertRaises(DiagnosticError) as raised, patch('lux_agent.commands.execute_ping') as execute:
                self.processor.run_once()
            self.assertFalse(raised.exception.retryable)
            execute.assert_not_called()
            self.assertEqual(self.journal.get(self.command['id'])[2], 'claim_pending')
            self.journal.record(self.command['id'], 'abandoned')

    def test_polling_recovers_after_transient_result_failure_and_preserves_retry_after(self):
        self.statuses['PUT'] = 503
        with contextlib.redirect_stdout(io.StringIO()), contextlib.redirect_stderr(io.StringIO()):
            code = poll_associations(self.origin + '/agent/associations', self.credential, command_processor=self.processor, interval=0.01, jitter=0, max_queries=1)
        self.assertEqual(code, 5)
        self.assertEqual(self.journal.get(self.command['id'])[2], 'result')
        self.statuses.clear()
        with patch('lux_agent.commands.execute_ping') as execute:
            self.assertEqual(self.processor.run_once(), 1)
            execute.assert_not_called()

    def test_cli_enables_command_processing_only_with_private_state_directory(self):
        self.journal.close()
        credential_file = self.root / 'credential'
        credential_file.write_text(self.credential)
        credential_file.chmod(0o600)
        args = ['--backend-url', self.origin, '--credential-file', str(credential_file), '--allow-local-http', '--max-queries', '1']
        stdout, stderr = io.StringIO(), io.StringIO()
        with contextlib.redirect_stdout(stdout), contextlib.redirect_stderr(stderr):
            self.assertEqual(main(args), 0)
            self.assertIsNone(self.result)
            self.assertEqual(main([*args, '--state-dir', str(self.root / 'state')]), 0)
        self.assertIsNotNone(self.result)
        self.assertNotIn(self.credential, stdout.getvalue() + stderr.getvalue())

    def test_cli_passes_local_managed_user_to_parental_commands(self):
        self.journal.close()
        credential_file = self.root / 'credential'
        credential_file.write_text(self.credential)
        credential_file.chmod(0o600)
        parameters = {'blockedApplications': [], 'blockInstallation': False}
        self.command.update(type='parental.app_filter.set', parameters=parameters)
        args = ['--backend-url', self.origin, '--credential-file', str(credential_file), '--allow-local-http', '--max-queries', '1',
                '--state-dir', str(self.root / 'state'), '--managed-user', 'crianca']
        with patch('lux_agent.commands.apply_app_filter', return_value=parameters) as apply, \
                contextlib.redirect_stdout(io.StringIO()), contextlib.redirect_stderr(io.StringIO()):
            self.assertEqual(main(args), 0)
        apply.assert_called_once_with('crianca', parameters)
        self.assertEqual(self.result['status'], 'succeeded')


class JournalSecurityTests(unittest.TestCase):
    def test_lock_permissions_and_binding(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory) / 'state'
            with CommandJournal(str(root), 'https://api.example', 'credential'):
                self.assertEqual(root.stat().st_mode & 0o777, 0o700)
                for name in ('lock', 'journal.sqlite3'):
                    self.assertEqual((root / name).stat().st_mode & 0o777, 0o600)
                with self.assertRaises(DiagnosticError):
                    CommandJournal(str(root), 'https://api.example', 'credential')
            for origin, credential in [('https://other.example', 'credential'), ('https://api.example', 'other')]:
                with self.assertRaises(DiagnosticError):
                    CommandJournal(str(root), origin, credential)
            root.chmod(0o755)
            with self.assertRaises(DiagnosticError):
                CommandJournal(str(root), 'https://api.example', 'credential')

    def test_symlinks_hardlinks_and_corrupt_database_are_refused(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory) / 'state'
            with CommandJournal(str(root), 'origin', 'credential'):
                pass
            target = root / 'journal.sqlite3'
            link = root / 'link'
            os.link(target, link)
            with self.assertRaises(DiagnosticError):
                CommandJournal(str(root), 'origin', 'credential')
            link.unlink()
            target.rename(link)
            target.symlink_to(link)
            with self.assertRaises(DiagnosticError):
                CommandJournal(str(root), 'origin', 'credential')
            target.unlink()
            target.write_bytes(b'corrupted sqlite database')
            target.chmod(0o600)
            with self.assertRaises(DiagnosticError):
                CommandJournal(str(root), 'origin', 'credential')


if __name__ == '__main__':
    unittest.main()
