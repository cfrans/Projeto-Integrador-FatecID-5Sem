import contextlib
import io
import secrets
import ssl
import subprocess
import tempfile
import threading
import unittest
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path

from check_backend import DiagnosticError, fetch_associations, main as check_main
from poll_associations import main as poll_main


class HttpsTransportTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.directory = tempfile.TemporaryDirectory()
        cls.root = Path(cls.directory.name)
        try:
            commands = [
                ['req', '-x509', '-newkey', 'rsa:2048', '-nodes', '-keyout', 'ca.key', '-out', 'ca.pem', '-days', '2', '-subj', '/CN=Test CA', '-addext', 'basicConstraints=critical,CA:TRUE', '-addext', 'keyUsage=critical,keyCertSign,cRLSign'],
                ['req', '-new', '-newkey', 'rsa:2048', '-nodes', '-keyout', 'server.key', '-out', 'server.csr', '-subj', '/CN=localhost'],
                ['x509', '-req', '-in', 'server.csr', '-CA', 'ca.pem', '-CAkey', 'ca.key', '-CAcreateserial', '-out', 'server.pem', '-days', '2', '-extfile', 'server.ext'],
            ]
            (cls.root / 'server.ext').write_text('subjectAltName=DNS:localhost\nbasicConstraints=critical,CA:FALSE\nkeyUsage=critical,digitalSignature,keyEncipherment\nextendedKeyUsage=serverAuth\nsubjectKeyIdentifier=hash\nauthorityKeyIdentifier=keyid,issuer\n')
            for command in commands:
                subprocess.run(['openssl', *command], cwd=cls.root, check=True, capture_output=True, timeout=20)
            (cls.root / 'index').touch()
            (cls.root / 'serial').write_text('1000\n')
            (cls.root / 'ca.conf').write_text(
                '[ca]\ndefault_ca=local\n[local]\ndatabase=index\nserial=serial\n'
                'new_certs_dir=.\ncertificate=ca.pem\nprivate_key=ca.key\n'
                'default_md=sha256\npolicy=policy\nx509_extensions=server\n'
                '[policy]\ncommonName=supplied\n[server]\n'
                + (cls.root / 'server.ext').read_text()
            )
            subprocess.run(
                ['openssl', 'ca', '-batch', '-config', 'ca.conf', '-in', 'server.csr',
                 '-out', 'expired.pem', '-notext', '-startdate', '20200101000000Z',
                 '-enddate', '20200102000000Z'],
                cwd=cls.root, check=True, capture_output=True, timeout=20,
            )
            cls.ca_file = str(cls.root / 'ca.pem')
            cls.credential = secrets.token_urlsafe(32)
            cls.credential_file = cls.root / 'credential'
            cls.credential_file.write_text(cls.credential)
            cls.credential_file.chmod(0o600)
            owner = cls

            class Handler(BaseHTTPRequestHandler):
                def do_GET(self):
                    owner.received.append(self.headers.get('Authorization'))
                    self.send_response(owner.status)
                    if owner.status == 302:
                        self.send_header('Location', '/redirect')
                    if owner.status == 503:
                        self.send_header('Retry-After', '0')
                    self.end_headers()
                    self.wfile.write(owner.body)

                def log_message(self, *args):
                    pass

            cls.server = ThreadingHTTPServer(('127.0.0.1', 0), Handler)
            context = ssl.SSLContext(ssl.PROTOCOL_TLS_SERVER)
            context.load_cert_chain(cls.root / 'server.pem', cls.root / 'server.key')
            cls.server.socket = context.wrap_socket(cls.server.socket, server_side=True)
            cls.thread = threading.Thread(target=cls.server.serve_forever, daemon=True)
            cls.thread.start()
            cls.origin = f'https://localhost:{cls.server.server_port}'
            cls.endpoint = cls.origin + '/agent/associations'
        except BaseException:
            cls.directory.cleanup()
            raise

    @classmethod
    def tearDownClass(cls):
        cls.server.shutdown()
        cls.server.server_close()
        cls.thread.join()
        cls.directory.cleanup()

    def setUp(self):
        type(self).status = 200
        type(self).body = b'[]'
        type(self).received = []

    def test_verified_chain_hostname_and_bearer(self):
        self.assertEqual(fetch_associations(self.endpoint, self.credential, 2, self.ca_file), [])
        self.assertEqual(self.received, [f'Bearer {self.credential}'])

    def test_untrusted_certificate_and_wrong_hostname_never_send_bearer(self):
        for endpoint, ca_file in ((self.endpoint, None), (self.endpoint.replace('localhost', '127.0.0.1'), self.ca_file)):
            with self.subTest(endpoint=endpoint), self.assertRaises(DiagnosticError) as raised:
                fetch_associations(endpoint, self.credential, 2, ca_file)
            self.assertEqual(raised.exception.category, 'tls')
            self.assertEqual(raised.exception.code, 4)
            self.assertFalse(raised.exception.retryable)
        self.assertEqual(self.received, [])

    def test_expired_certificate_never_sends_bearer(self):
        context = self.server.socket.context
        context.load_cert_chain(self.root / 'expired.pem', self.root / 'server.key')
        try:
            with self.assertRaises(DiagnosticError) as raised:
                fetch_associations(self.endpoint, self.credential, 2, self.ca_file)
            self.assertEqual(raised.exception.category, 'tls')
            self.assertFalse(raised.exception.retryable)
            self.assertEqual(self.received, [])
        finally:
            context.load_cert_chain(self.root / 'server.pem', self.root / 'server.key')

    def test_invalid_or_missing_ca_is_controlled_configuration_error(self):
        invalid = self.root / 'invalid-ca'
        invalid.write_text('not a certificate')
        for path in (str(invalid), str(self.root / 'missing'), str(self.root)):
            with self.subTest(path=path), self.assertRaises(DiagnosticError) as raised:
                fetch_associations(self.endpoint, self.credential, 2, path)
            self.assertEqual(raised.exception.code, 2)
            self.assertEqual(raised.exception.category, 'configuration')
        self.assertEqual(self.received, [])

    def test_http_errors_and_redirect_over_verified_tls(self):
        for status, code in ((401, 3), (503, 5), (302, 6)):
            type(self).status = status
            self.received.clear()
            with self.subTest(status=status), self.assertRaises(DiagnosticError) as raised:
                fetch_associations(self.endpoint, self.credential, 2, self.ca_file)
            self.assertEqual(raised.exception.code, code)
            self.assertEqual(raised.exception.http_status, status)
            self.assertEqual(len(self.received), 1)

    def test_response_validation_over_verified_tls(self):
        type(self).body = b'{}'
        with self.assertRaises(DiagnosticError) as raised:
            fetch_associations(self.endpoint, self.credential, 2, self.ca_file)
        self.assertEqual(raised.exception.category, 'response')

    def test_both_clis_use_explicit_ca_and_polling_stops_on_tls(self):
        args = ['--backend-url', self.origin, '--credential-file', str(self.credential_file), '--ca-file', self.ca_file]
        stdout, stderr = io.StringIO(), io.StringIO()
        with contextlib.redirect_stdout(stdout), contextlib.redirect_stderr(stderr):
            self.assertEqual(check_main(args), 0)
            self.assertEqual(poll_main([*args, '--max-queries', '3', '--interval', '0.01', '--jitter', '0']), 0)
            self.assertEqual(poll_main([*args, '--backend-url', self.origin.replace('localhost', '127.0.0.1'), '--max-queries', '3']), 4)
        self.assertEqual(len(self.received), 4)
        self.assertEqual(stderr.getvalue().count('Consulta 1: tls'), 1)
        self.assertNotIn(self.credential, stdout.getvalue() + stderr.getvalue())


if __name__ == '__main__':
    unittest.main()
