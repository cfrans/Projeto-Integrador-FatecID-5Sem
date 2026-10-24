import contextlib
import io
import json
import os
from pathlib import Path
import secrets
import tempfile
import threading
import unittest
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from unittest.mock import patch
from urllib.error import URLError

from check_backend import DiagnosticError, backend_endpoint, check_backend, load_credential, main


class CredentialTests(unittest.TestCase):
    def test_private_provisioned_file_and_unsafe_files(self):
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / "credential"
            credential = secrets.token_urlsafe(32)
            path.write_text(credential)
            path.chmod(0o600)
            self.assertEqual(load_credential(str(path)), credential)
            path.chmod(0o400)
            self.assertEqual(load_credential(str(path)), credential)
            for mode in (0o644, 0o640, 0o700):
                path.chmod(mode)
                with self.assertRaises(DiagnosticError):
                    load_credential(str(path))
            path.chmod(0o600)
            link = Path(directory) / "link"
            link.symlink_to(path)
            with self.assertRaises(DiagnosticError):
                load_credential(str(link))
            link.unlink()
            os.link(path, link)
            with self.assertRaises(DiagnosticError):
                load_credential(str(path))
            link.unlink()
            with patch("check_backend.os.geteuid", return_value=os.geteuid() + 1):
                with self.assertRaises(DiagnosticError):
                    load_credential(str(path))
            for raw in ("", "a" * 42, "a" * 44, credential + "\nextra", "é" * 43):
                path.write_text(raw)
                with self.assertRaises(DiagnosticError):
                    load_credential(str(path))

    def test_url_and_timeout_validation(self):
        self.assertEqual(backend_endpoint("https://api.example/", False), "https://api.example/agent/associations")
        self.assertEqual(backend_endpoint("http://127.0.0.1:3000", True), "http://127.0.0.1:3000/agent/associations")
        for url in ("http://api.example", "https://u:p@api.example", "https://api.example/x", "https://api.example?q=x", "https://api.example/#x", "file:///tmp/x", "https://api.example:bad", "https://api.example\n", "https://api.example:0"):
            with self.subTest(url=url), self.assertRaises(DiagnosticError):
                backend_endpoint(url, True)
        with self.assertRaises(DiagnosticError):
            backend_endpoint("http://localhost", False)
        with contextlib.redirect_stderr(io.StringIO()):
            self.assertEqual(main(["--backend-url", "https://api.example", "--credential-file", "/missing", "--timeout", "nan"]), 2)


class CommunicationTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.received = []
        cls.status = 200
        cls.body = b"[]"
        cls.credential = secrets.token_urlsafe(32)
        owner = cls

        class Handler(BaseHTTPRequestHandler):
            def do_GET(self):
                owner.received.append((self.path, self.headers.get("Authorization")))
                self.send_response(owner.status)
                if owner.status == 302:
                    self.send_header("Location", "/leak")
                self.end_headers()
                self.wfile.write(owner.body)

            def log_message(self, *args):
                pass

        cls.server = ThreadingHTTPServer(("127.0.0.1", 0), Handler)
        cls.thread = threading.Thread(target=cls.server.serve_forever, daemon=True)
        cls.thread.start()
        cls.endpoint = f"http://127.0.0.1:{cls.server.server_port}/agent/associations"

    @classmethod
    def tearDownClass(cls):
        cls.server.shutdown()
        cls.server.server_close()
        cls.thread.join()

    def setUp(self):
        type(self).status = 200
        type(self).body = b"[]"
        self.received.clear()

    def test_bearer_and_empty_or_existing_history(self):
        self.assertEqual(check_backend(self.endpoint, self.credential, 2), 0)
        self.assertEqual(self.received, [("/agent/associations", f"Bearer {self.credential}")])
        type(self).body = json.dumps([{"id": "association", "createdAt": "2026-10-24T00:00:00Z", "revokedAt": None, "guardian": {"id": "guardian", "name": "Private name"}}]).encode()
        self.assertEqual(check_backend(self.endpoint, self.credential, 2), 1)

    def test_http_failures_and_no_redirect_or_secret_output(self):
        for status, code in ((401, 3), (503, 5), (500, 5), (429, 5), (403, 6), (302, 6)):
            type(self).status = status
            type(self).body = self.credential.encode()
            self.received.clear()
            with self.subTest(status=status), self.assertRaises(DiagnosticError) as raised:
                check_backend(self.endpoint, self.credential, 2)
            self.assertEqual(raised.exception.code, code)
            self.assertNotIn(self.credential, str(raised.exception))
            self.assertEqual(len(self.received), 1)

    def test_invalid_responses(self):
        for body in (b"{}", b"not json", b"[{}]", b"\xff", b" " * (1024 * 1024 + 1)):
            type(self).body = body
            with self.assertRaises(DiagnosticError) as raised:
                check_backend(self.endpoint, self.credential, 2)
            self.assertEqual(raised.exception.code, 6)

    def test_connection_and_timeout_failures(self):
        for error in (URLError("private detail"), TimeoutError("private detail")):
            with patch("check_backend.build_opener") as factory:
                factory.return_value.open.side_effect = error
                with self.assertRaises(DiagnosticError) as raised:
                    check_backend(self.endpoint, self.credential, 0.1)
                self.assertEqual(raised.exception.code, 4)
                self.assertNotIn("private detail", str(raised.exception))

    def test_cli_outputs_only_summary(self):
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / "credential"
            path.write_text(self.credential)
            path.chmod(0o600)
            args = ["--backend-url", self.endpoint.removesuffix("/agent/associations"), "--credential-file", str(path), "--allow-local-http"]
            for status, code in ((200, 0), (401, 3), (503, 5)):
                type(self).status = status
                stdout, stderr = io.StringIO(), io.StringIO()
                with contextlib.redirect_stdout(stdout), contextlib.redirect_stderr(stderr):
                    self.assertEqual(main(args), code)
                self.assertNotIn(self.credential, stdout.getvalue() + stderr.getvalue())
                if code:
                    self.assertEqual(stdout.getvalue(), "")


if __name__ == "__main__":
    unittest.main()
