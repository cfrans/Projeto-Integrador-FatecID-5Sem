import contextlib
import io
import json
import os
from pathlib import Path
import select
import secrets
import signal
import subprocess
import sys
import tempfile
import threading
import time
import unittest
import ssl
from urllib.error import URLError
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from unittest.mock import patch

from check_backend import DiagnosticError
from poll_associations import main, poll_associations, query_associations


class FakeClock:
    def __init__(self):
        self.now = 0.0
        self.sleeps = []

    def sleep(self, seconds):
        self.sleeps.append(seconds)
        self.now += seconds


class PollingTests(unittest.TestCase):
    def run_cycle(self, responses, *, processing=0, factors=None, **options):
        clock = FakeClock()
        starts = []
        iterator = iter(responses)

        def query(*args):
            starts.append(clock.now)
            clock.now += processing
            response = next(iterator)
            if isinstance(response, BaseException):
                raise response
            return response

        stdout, stderr = io.StringIO(), io.StringIO()
        with (
            patch("poll_associations.query_associations", side_effect=query) as request,
            patch("poll_associations.time.monotonic", side_effect=lambda: clock.now),
            patch("poll_associations.time.sleep", side_effect=clock.sleep),
            patch("poll_associations.random.uniform", side_effect=factors, return_value=1),
            contextlib.redirect_stdout(stdout),
            contextlib.redirect_stderr(stderr),
        ):
            code = poll_associations(
                "https://api.example/agent/associations", "private-credential",
                max_queries=len(responses), **options,
            )
        return code, starts, clock.sleeps, stdout.getvalue(), stderr.getvalue(), request

    def test_intervals_start_after_previous_request_finishes(self):
        code, starts, sleeps, _, _, request = self.run_cycle([[], [], []], interval=10, processing=2)
        self.assertEqual(code, 0)
        self.assertEqual(starts, [0, 12, 24])
        self.assertEqual(sleeps, [10, 10])
        self.assertEqual(request.call_count, 3)

    def test_transient_failure_recovers_and_resets_backoff(self):
        error = DiagnosticError("Falha temporária.", 4, category="connection", retryable=True)
        code, starts, _, _, _, _ = self.run_cycle([error, error, [], error, []], interval=10)
        self.assertEqual(code, 0)
        self.assertEqual(starts, [0, 10, 30, 40, 50])

    def test_backoff_and_jitter_never_exceed_cap(self):
        error = DiagnosticError("Indisponível.", 5, category="http", retryable=True)
        code, _, sleeps, _, _, _ = self.run_cycle(
            [error] * 6, interval=10, max_backoff=25, factors=[1.2] * 5,
        )
        self.assertEqual(code, 5)
        self.assertEqual(sleeps, [12, 24, 25, 25, 25])

    def test_jitter_applies_to_normal_interval(self):
        code, _, sleeps, _, _, _ = self.run_cycle([[], [], []], interval=10, factors=[0.8, 1.2])
        self.assertEqual(code, 0)
        self.assertEqual(sleeps, [8, 12])

    def test_429_and_503_respect_retry_after_above_cap(self):
        errors = [DiagnosticError("Indisponível.", 5, category="http", retryable=True, retry_after=delay, http_status=status) for status, delay in ((429, 900), (503, 1))]
        code, starts, sleeps, _, _, _ = self.run_cycle([*errors, []], interval=10, max_backoff=25)
        self.assertEqual(code, 0)
        self.assertEqual(starts, [0, 900, 920])
        self.assertTrue(all(delay <= 60 for delay in sleeps))

    def test_permanent_errors_stop_without_waiting(self):
        for code, category in ((3, "authentication"), (4, "tls"), (6, "http"), (6, "response")):
            error = DiagnosticError("Falha permanente.", code, category=category)
            result, starts, sleeps, _, _, request = self.run_cycle([error, []])
            self.assertEqual(result, code)
            self.assertEqual(starts, [0])
            self.assertEqual(sleeps, [])
            self.assertEqual(request.call_count, 1)

    def test_one_query_limit_includes_failure_and_does_not_wait(self):
        error = DiagnosticError("Indisponível.", 5, category="http", retryable=True, retry_after=900)
        code, _, sleeps, _, _, request = self.run_cycle([error])
        self.assertEqual(code, 5)
        self.assertEqual(sleeps, [])
        self.assertEqual(request.call_count, 1)

    def test_success_does_not_log_credential_or_guardian(self):
        record = {"guardian": {"name": "private guardian"}}
        _, _, _, stdout, stderr, _ = self.run_cycle([[record], []])
        self.assertNotIn("private guardian", stdout + stderr)
        self.assertNotIn("private-credential", stdout + stderr)
        self.assertIn("1 associação", stdout)

    def test_deadline_disarms_alarm_and_restores_handler(self):
        previous = signal.getsignal(signal.SIGALRM)
        with patch("poll_associations.fetch_associations", side_effect=TimeoutError):
            with self.assertRaises(DiagnosticError) as raised:
                query_associations("https://api.example", "private", 1)
        self.assertEqual(raised.exception.category, "connection")
        self.assertTrue(raised.exception.retryable)
        self.assertEqual(signal.getitimer(signal.ITIMER_REAL), (0, 0))
        self.assertEqual(signal.getsignal(signal.SIGALRM), previous)

    def test_total_deadline_interrupts_slow_request(self):
        def slow_request(*args):
            time.sleep(2)
            return []

        with patch("poll_associations.fetch_associations", side_effect=slow_request):
            with self.assertRaises(DiagnosticError) as raised:
                query_associations("https://api.example", "private", 0.05)
        self.assertEqual(raised.exception.code, 4)
        self.assertTrue(raised.exception.retryable)
        self.assertEqual(signal.getitimer(signal.ITIMER_REAL), (0, 0))

    def test_invalid_options_stop_before_loading_credential(self):
        for option in (['--interval', '0'], ['--interval', 'nan'], ['--interval', 'inf'], ['--max-backoff', '1'], ['--jitter', '1'], ['--jitter', '-0.1'], ['--timeout', '121'], ['--max-queries', '0']):
            with self.subTest(option=option), patch("poll_associations.load_credential") as load, contextlib.redirect_stderr(io.StringIO()):
                code = main(['--backend-url', 'https://api.example', '--credential-file', '/missing', *option])
            self.assertEqual(code, 2)
            load.assert_not_called()

    def test_main_restores_handlers_on_error_and_keyboard_interrupt(self):
        before = {sig: signal.getsignal(sig) for sig in (signal.SIGINT, signal.SIGTERM)}
        for error, expected in ((KeyboardInterrupt(), 0), (DiagnosticError("Arquivo inválido.", 2), 2)):
            with patch("poll_associations.load_credential", side_effect=error), contextlib.redirect_stderr(io.StringIO()):
                self.assertEqual(main(['--backend-url', 'https://api.example', '--credential-file', '/missing']), expected)
            self.assertEqual({sig: signal.getsignal(sig) for sig in before}, before)


class PollingHTTPTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        owner = cls
        cls.status = 200
        cls.headers = {}
        cls.body = b'[]'
        cls.received = []
        cls.blocked = False
        cls.started = threading.Event()
        cls.release = threading.Event()

        class Handler(BaseHTTPRequestHandler):
            def do_GET(self):
                owner.received.append((self.path, self.headers.get('Authorization')))
                self.send_response(owner.status)
                for key, value in owner.headers.items():
                    self.send_header(key, value)
                self.end_headers()
                if owner.blocked:
                    owner.started.set()
                    owner.release.wait(5)
                    return
                self.wfile.write(owner.body)

            def log_message(self, *args):
                pass

        cls.server = ThreadingHTTPServer(('127.0.0.1', 0), Handler)
        cls.thread = threading.Thread(target=cls.server.serve_forever, daemon=True)
        cls.thread.start()
        cls.url = f'http://127.0.0.1:{cls.server.server_port}'

    @classmethod
    def tearDownClass(cls):
        cls.server.shutdown()
        cls.server.server_close()
        cls.thread.join()

    def setUp(self):
        self.directory = tempfile.TemporaryDirectory()
        self.addCleanup(self.directory.cleanup)
        self.path = Path(self.directory.name) / 'credential'
        self.credential = secrets.token_urlsafe(32)
        self.path.write_text(self.credential)
        self.path.chmod(0o600)
        type(self).status = 200
        type(self).headers = {}
        type(self).body = b'[]'
        type(self).blocked = False
        self.started.clear()
        self.release.clear()
        self.received.clear()
        self.args = ['--backend-url', self.url, '--credential-file', str(self.path), '--allow-local-http', '--max-queries', '2', '--interval', '1', '--jitter', '0']

    def test_cli_calls_only_get_associations_with_bearer(self):
        with patch('poll_associations.wait_delay') as wait, contextlib.redirect_stdout(io.StringIO()):
            self.assertEqual(main(self.args), 0)
        self.assertEqual(self.received, [('/agent/associations', f'Bearer {self.credential}')] * 2)
        wait.assert_called_once_with(1)

    def test_http_authentication_and_invalid_response_stop(self):
        for status, body, expected in ((401, self.credential.encode(), 3), (403, b'', 6), (200, self.credential.encode(), 6)):
            type(self).status, type(self).body = status, body
            self.received.clear()
            stdout, stderr = io.StringIO(), io.StringIO()
            with patch('poll_associations.wait_delay') as wait, contextlib.redirect_stdout(stdout), contextlib.redirect_stderr(stderr):
                self.assertEqual(main(self.args), expected)
            wait.assert_not_called()
            self.assertEqual(len(self.received), 1)
            self.assertNotIn(self.credential, stdout.getvalue() + stderr.getvalue())

    def test_http_retry_after_reaches_scheduler(self):
        for status in (429, 503):
            type(self).status = status
            type(self).headers = {'Retry-After': '900'}
            with patch('poll_associations.wait_delay') as wait, contextlib.redirect_stderr(io.StringIO()):
                self.assertEqual(main(self.args), 5)
            wait.assert_called_once_with(900)

    def test_tls_certificate_failure_stops_before_wait_or_fallback(self):
        stdout, stderr = io.StringIO(), io.StringIO()
        with (
            patch('check_backend.build_opener') as factory,
            patch('poll_associations.wait_delay') as wait,
            contextlib.redirect_stdout(stdout),
            contextlib.redirect_stderr(stderr),
        ):
            factory.return_value.open.side_effect = URLError(ssl.SSLCertVerificationError(self.credential))
            self.assertEqual(main(self.args), 4)
        self.assertEqual(factory.return_value.open.call_count, 1)
        wait.assert_not_called()
        self.assertIn('tls', stderr.getvalue())
        self.assertNotIn(self.credential, stdout.getvalue() + stderr.getvalue())

    def test_cli_uses_existing_configuration_and_file_security(self):
        for args, mode in ((self.args, 0o644), ([*self.args, '--backend-url', 'http://remote.example'], 0o600)):
            self.path.chmod(mode)
            with patch('poll_associations.query_associations') as request, contextlib.redirect_stderr(io.StringIO()):
                self.assertEqual(main(args), 2)
            request.assert_not_called()

    def test_successful_history_is_not_written_to_logs(self):
        type(self).body = json.dumps([{'id': 'association', 'createdAt': 'date', 'revokedAt': None, 'guardian': {'id': 'guardian', 'name': self.credential}}]).encode()
        stdout, stderr = io.StringIO(), io.StringIO()
        with patch('poll_associations.wait_delay'), contextlib.redirect_stdout(stdout), contextlib.redirect_stderr(stderr):
            self.assertEqual(main(self.args), 0)
        self.assertNotIn(self.credential, stdout.getvalue() + stderr.getvalue())

    def test_sigterm_interrupts_in_flight_http_request(self):
        type(self).blocked = True
        process = subprocess.Popen(
            [sys.executable, '-B', str(Path(__file__).with_name('poll_associations.py')), *self.args],
            stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True,
        )
        try:
            self.assertTrue(self.started.wait(5))
            os.kill(process.pid, signal.SIGTERM)
            stdout, stderr = process.communicate(timeout=5)
            self.assertEqual(process.returncode, 0)
            self.assertIn('encerrado por sinal', stderr)
            self.assertNotIn('Traceback', stderr)
            self.assertNotIn(self.credential, stdout + stderr)
            self.assertEqual(len(self.received), 1)
        finally:
            self.release.set()
            if process.poll() is None:
                process.kill()
                process.communicate(timeout=5)

    def test_sigint_and_sigterm_exit_cleanly_during_wait(self):
        for signum in (signal.SIGINT, signal.SIGTERM):
            process = subprocess.Popen(
                [sys.executable, '-B', str(Path(__file__).with_name('poll_associations.py')), *self.args, '--interval', '60'],
                stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True,
            )
            try:
                ready, _, _ = select.select([process.stdout], [], [], 5)
                self.assertTrue(ready, 'O processo não confirmou a primeira consulta.')
                first_line = process.stdout.readline()
                self.assertIn('HTTP 200', first_line)
                os.kill(process.pid, signum)
                stdout, stderr = process.communicate(timeout=5)
                self.assertEqual(process.returncode, 0)
                self.assertIn('encerrado por sinal', stderr)
                self.assertNotIn('Traceback', stderr)
                self.assertNotIn(self.credential, first_line + stdout + stderr)
            finally:
                if process.poll() is None:
                    process.kill()
                    process.communicate(timeout=5)


if __name__ == '__main__':
    unittest.main()
