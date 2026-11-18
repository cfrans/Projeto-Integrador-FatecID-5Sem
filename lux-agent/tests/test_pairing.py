import hashlib
import io
import json
import os
import pwd
import secrets
import stat
import tempfile
import threading
import unittest
from datetime import datetime, timedelta, timezone
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from unittest.mock import patch

from lux_agent import pairing
from lux_agent.errors import DiagnosticError

TOKEN = "t" * 43
URI = f"piplup://pair?token={TOKEN}"
ACTIVE = {"id": "a1", "createdAt": "2026-11-15T10:00:00Z", "revokedAt": None, "guardian": {"id": "g1", "name": "Ana"}}
REVOKED = {**ACTIVE, "id": "a0", "revokedAt": "2026-11-14T10:00:00Z"}


def session_body(minutes: float = 5) -> dict:
    expires = datetime.now(timezone.utc) + timedelta(minutes=minutes)
    return {"token": TOKEN, "expiresAt": expires.isoformat().replace("+00:00", "Z"), "qrPayload": URI}


class FakeBackend:
    def __init__(self):
        self.routes: dict[tuple[str, str], list[tuple[int, object]]] = {}
        self.requests: list[dict] = []
        backend = self

        class Handler(BaseHTTPRequestHandler):
            def respond(self):
                length = int(self.headers.get("Content-Length") or 0)
                body = self.rfile.read(length) if length else b""
                backend.requests.append({
                    "method": self.command, "path": self.path,
                    "authorization": self.headers.get("Authorization"),
                    "body": json.loads(body) if body else None,
                })
                queue = backend.routes.get((self.command, self.path), [])
                status, payload = queue.pop(0) if len(queue) > 1 else (queue[0] if queue else (404, {}))
                raw = json.dumps(payload).encode()
                self.send_response(status)
                self.send_header("Content-Type", "application/json")
                self.send_header("Content-Length", str(len(raw)))
                self.end_headers()
                self.wfile.write(raw)

            do_GET = respond
            do_POST = respond

            def log_message(self, *args):
                pass

        self.server = ThreadingHTTPServer(("127.0.0.1", 0), Handler)
        self.origin = f"http://127.0.0.1:{self.server.server_port}"
        threading.Thread(target=self.server.serve_forever, daemon=True).start()

    def close(self):
        self.server.shutdown()
        self.server.server_close()

    def paths(self) -> list[str]:
        return [f"{item['method']} {item['path']}" for item in self.requests]


class PairingTestCase(unittest.TestCase):
    def setUp(self):
        self.backend = FakeBackend()
        self.addCleanup(self.backend.close)
        directory = tempfile.TemporaryDirectory()
        self.addCleanup(directory.cleanup)
        self.dir = Path(directory.name)
        self.credential_file = self.dir / "credential"
        self.uid, self.gid = os.getuid(), os.getgid()

    def write_existing(self) -> str:
        credential = secrets.token_urlsafe(32)
        self.credential_file.write_text(credential)
        self.credential_file.chmod(0o600)
        return credential

    def start(self):
        return pairing.start_session(
            self.backend.origin, None, str(self.credential_file), self.uid, self.gid, "lux-pc", "crianca",
        )


class CredentialFileTests(PairingTestCase):
    def test_atomic_private_write_replaces_previous(self):
        self.credential_file.write_text("old")
        self.credential_file.chmod(0o644)
        credential = pairing.generate_credential()
        self.assertRegex(credential, r"^[A-Za-z0-9_-]{43}$")
        pairing.write_credential(str(self.credential_file), credential, self.uid, self.gid)
        metadata = self.credential_file.stat()
        self.assertEqual(stat.S_IMODE(metadata.st_mode), 0o600)
        self.assertEqual((metadata.st_uid, metadata.st_gid), (self.uid, self.gid))
        self.assertEqual(self.credential_file.read_text(), credential)
        self.assertEqual([item.name for item in self.dir.iterdir()], ["credential"])

    def test_failed_write_leaves_no_temporary_file(self):
        with patch("lux_agent.pairing.os.fchown", side_effect=PermissionError):
            with self.assertRaises(PermissionError):
                pairing.write_credential(str(self.credential_file), "x" * 43, 0, 0)
        self.assertEqual(list(self.dir.iterdir()), [])

    def test_hash_matches_backend_format(self):
        self.assertEqual(pairing.credential_hash("abc"), hashlib.sha256(b"abc").hexdigest())


class StartSessionTests(PairingTestCase):
    def test_without_credential_registers_only_the_hash(self):
        self.backend.routes[("POST", "/agent/registrations")] = [(201, session_body())]
        credential, session = self.start()
        self.assertEqual(session["uri"], URI)
        self.assertEqual(self.credential_file.read_text(), credential)
        request = self.backend.requests[-1]
        self.assertIsNone(request["authorization"])
        self.assertEqual(request["body"], {
            "credentialHash": hashlib.sha256(credential.encode()).hexdigest(),
            "name": "lux-pc", "managedUser": "crianca",
        })
        self.assertNotIn(credential, json.dumps(self.backend.requests))

    def test_revoked_or_unregistered_credential_is_regenerated(self):
        old = self.write_existing()
        self.backend.routes[("GET", "/agent/associations")] = [(401, {})]
        self.backend.routes[("POST", "/agent/registrations")] = [(201, session_body())]
        credential, _ = self.start()
        self.assertNotEqual(credential, old)
        self.assertEqual(self.credential_file.read_text(), credential)
        self.assertEqual(self.backend.paths(), ["GET /agent/associations", "POST /agent/registrations"])

    def test_valid_credential_without_active_association_opens_session(self):
        old = self.write_existing()
        self.backend.routes[("GET", "/agent/associations")] = [(200, [REVOKED])]
        self.backend.routes[("POST", "/agent/pairing-sessions")] = [(201, session_body())]
        credential, session = self.start()
        self.assertEqual(credential, old)
        self.assertEqual(self.credential_file.read_text(), old)
        self.assertEqual(self.backend.requests[-1]["authorization"], f"Bearer {old}")
        self.assertIsNone(self.backend.requests[-1]["body"])
        self.assertEqual(session["uri"], URI)

    def test_already_paired(self):
        self.write_existing()
        self.backend.routes[("GET", "/agent/associations")] = [(200, [ACTIVE])]
        with self.assertRaises(pairing.AlreadyPaired):
            self.start()
        self.backend.routes[("GET", "/agent/associations")] = [(200, [])]
        self.backend.routes[("POST", "/agent/pairing-sessions")] = [(409, {})]
        with self.assertRaises(pairing.AlreadyPaired):
            self.start()

    def test_unavailable_backend_keeps_credential(self):
        old = self.write_existing()
        self.backend.routes[("GET", "/agent/associations")] = [(503, {})]
        with self.assertRaises(DiagnosticError) as raised:
            self.start()
        self.assertEqual(raised.exception.code, 5)
        self.assertEqual(self.credential_file.read_text(), old)
        self.assertEqual(self.backend.paths(), ["GET /agent/associations"])

    def test_registration_failures(self):
        for status, code in ((409, 1), (429, 5), (400, 6)):
            with self.subTest(status=status):
                self.backend.routes[("POST", "/agent/registrations")] = [(status, {})]
                with self.assertRaises(DiagnosticError) as raised:
                    self.start()
                self.assertEqual(raised.exception.code, code)
                self.credential_file.unlink()

    def test_incompatible_session_response(self):
        for body in ({}, {**session_body(), "qrPayload": "https://evil"}, {**session_body(), "expiresAt": "2026-11-15T10:00:00"}):
            with self.subTest(body=body):
                self.backend.routes[("POST", "/agent/registrations")] = [(201, body)]
                with self.assertRaises(DiagnosticError) as raised:
                    self.start()
                self.assertEqual(raised.exception.code, 6)


class WaitTests(PairingTestCase):
    def wait(self, expires_at: str, **kwargs):
        return pairing.wait_for_association(self.backend.origin, "c" * 43, expires_at, None, sleep=lambda _: None, **kwargs)

    def test_pending_registration_then_active_association(self):
        self.backend.routes[("GET", "/agent/associations")] = [(401, {}), (503, {}), (200, [REVOKED]), (200, [ACTIVE])]
        self.assertTrue(self.wait(session_body()["expiresAt"]))
        self.assertEqual(len(self.backend.requests), 4)

    def test_expiration_without_association(self):
        self.backend.routes[("GET", "/agent/associations")] = [(401, {})]
        clock = iter([0.0, 1.0, 2.0, 10.0, 10.0])
        expires = datetime.fromtimestamp(5, timezone.utc).isoformat()
        self.assertFalse(self.wait(expires, now=lambda: next(clock)))

    def test_parent_gone_stops_waiting_without_querying(self):
        self.backend.routes[("GET", "/agent/associations")] = [(401, {})]
        alive = iter([True, False])
        with self.assertRaises(pairing.ParentGone):
            self.wait(session_body()["expiresAt"], parent_alive=lambda: next(alive))
        self.assertEqual(len(self.backend.requests), 1)

    def test_incompatible_response_stops_waiting(self):
        self.backend.routes[("GET", "/agent/associations")] = [(200, {"unexpected": True})]
        with self.assertRaises(DiagnosticError):
            self.wait(session_body()["expiresAt"])


class HelperTests(PairingTestCase):
    def run_helper(self, env: str):
        env_file = self.dir / "agent.env"
        env_file.write_text(env)
        service = pwd.struct_passwd(("lux-agent", "x", self.uid, self.gid, "", "/nonexistent", "/usr/sbin/nologin"))
        output = io.StringIO()
        with patch.multiple(pairing, ENV_FILE=str(env_file), CREDENTIAL_FILE=str(self.credential_file),
                            CA_FILE=str(self.dir / "ca.pem"), WAIT_INTERVAL=0), \
                patch("lux_agent.pairing.os.geteuid", return_value=0), \
                patch("lux_agent.pairing.pwd.getpwnam", return_value=service), \
                patch("lux_agent.pairing.backend_endpoint", side_effect=lambda url, _: url + "/agent/associations"), \
                patch("lux_agent.pairing.subprocess.run") as run:
            run.return_value.returncode = 0
            code = pairing.run_helper(output)
        events = [json.loads(line) for line in output.getvalue().splitlines()]
        return code, events, run

    def env(self) -> str:
        return f"LUX_AGENT_BACKEND_URL={self.backend.origin}\nLUX_AGENT_MANAGED_USER=crianca\nLUX_AGENT_POLL_OPTIONS=\n"

    def test_full_pairing_restarts_service_and_never_prints_credential(self):
        self.backend.routes[("POST", "/agent/registrations")] = [(201, session_body())]
        self.backend.routes[("GET", "/agent/associations")] = [(401, {}), (200, [ACTIVE])]
        code, events, run = self.run_helper(self.env())
        self.assertEqual(code, 0)
        self.assertEqual([event["event"] for event in events], ["session", "paired"])
        self.assertEqual(events[0]["uri"], URI)
        self.assertEqual(set(events[0]), {"event", "uri", "expiresAt"})
        self.assertNotIn(self.credential_file.read_text(), json.dumps(events))
        run.assert_called_once_with(["systemctl", "restart", "lux-agent.service"], stdout=pairing.subprocess.DEVNULL)

    def test_expiration_does_not_touch_service(self):
        self.backend.routes[("POST", "/agent/registrations")] = [(201, session_body(minutes=0.0005))]
        self.backend.routes[("GET", "/agent/associations")] = [(401, {})]
        code, events, run = self.run_helper(self.env())
        self.assertEqual((code, events[-1]["event"]), (1, "expired"))
        run.assert_not_called()

    def test_parent_gone_exits_silently_without_touching_service(self):
        self.backend.routes[("POST", "/agent/registrations")] = [(201, session_body())]
        self.backend.routes[("GET", "/agent/associations")] = [(401, {})]
        with patch("lux_agent.pairing.os.getppid", side_effect=[100, 100, 1]):
            code, events, run = self.run_helper(self.env())
        self.assertEqual((code, [event["event"] for event in events]), (1, ["session"]))
        run.assert_not_called()

    def test_already_paired_and_configuration_errors(self):
        self.write_existing()
        self.backend.routes[("GET", "/agent/associations")] = [(200, [ACTIVE])]
        code, events, run = self.run_helper(self.env())
        self.assertEqual((code, events), (0, [{"event": "already-paired"}]))
        run.assert_not_called()
        code, events, _ = self.run_helper(f"LUX_AGENT_BACKEND_URL={self.backend.origin}\n")
        self.assertEqual((code, events[0]["event"]), (2, "error"))

    def test_requires_root(self):
        output = io.StringIO()
        with patch("lux_agent.pairing.os.geteuid", return_value=1000):
            self.assertEqual(pairing.run_helper(output), 2)
        self.assertEqual(json.loads(output.getvalue())["event"], "error")


class FakeProcess:
    def __init__(self, lines: list[str], code: int):
        self.stdout = iter(lines)
        self.code = code

    def wait(self):
        return self.code


class PairCommandTests(unittest.TestCase):
    def run_pair(self, lines: list[str], code: int):
        output, errors = io.StringIO(), io.StringIO()
        matrix = [[True, False], [False, True], [True, True]]
        with patch("lux_agent.pairing.importlib.util.find_spec", return_value=object()), \
                patch("lux_agent.pairing.qr_matrix", return_value=matrix) as qr, \
                patch("lux_agent.pairing.subprocess.Popen", return_value=FakeProcess(lines, code)) as popen:
            result = pairing.run_pair(output, errors)
        popen.assert_called_once_with(["pkexec", pairing.HELPER_PATH], stdout=pairing.subprocess.PIPE, text=True)
        return result, output.getvalue(), errors.getvalue(), qr

    def test_shows_qr_with_expiration_then_success(self):
        session = json.dumps({"event": "session", "uri": URI, "expiresAt": session_body()["expiresAt"]})
        code, output, errors, qr = self.run_pair([session + "\n", '{"event": "paired"}\n'], 0)
        self.assertEqual((code, errors), (0, ""))
        qr.assert_called_once_with(URI)
        self.assertIn("\u2580", output)
        self.assertIn("(em 5 min)", output)
        self.assertIn("pareado", output)

    def test_expired_already_paired_and_helper_error(self):
        code, output, _, _ = self.run_pair(['{"event": "expired"}\n'], 1)
        self.assertEqual(code, 1)
        self.assertIn("expirou", output)
        code, output, _, _ = self.run_pair(['{"event": "already-paired"}\n'], 0)
        self.assertEqual(code, 0)
        self.assertIn("já está pareado", output)
        code, _, errors, _ = self.run_pair(['{"event": "error", "message": "Backend indisponível."}\n'], 5)
        self.assertEqual((code, errors), (5, "Erro: Backend indisponível.\n"))

    def test_denied_authorization(self):
        for pkexec_code in (126, 127):
            code, _, errors, _ = self.run_pair([], pkexec_code)
            self.assertEqual(code, 4)
            self.assertIn("autorização", errors)

    def test_missing_qr_dependency(self):
        errors = io.StringIO()
        with patch("lux_agent.pairing.importlib.util.find_spec", return_value=None), \
                patch("lux_agent.pairing.subprocess.Popen") as popen:
            self.assertEqual(pairing.run_pair(io.StringIO(), errors), 2)
        popen.assert_not_called()
        self.assertIn("python3-qrcode", errors.getvalue())

    def test_render_uses_half_blocks_and_pads_odd_rows(self):
        rendered = pairing.render_qr([[True, False], [False, True], [True, True]])
        lines = rendered.split("\n")
        self.assertEqual(len(lines), 2)
        self.assertEqual(lines[0].count("\u2580"), 2)
        self.assertTrue(lines[0].startswith("\x1b[38;5;16m\x1b[48;5;231m"))
        self.assertIn("\x1b[38;5;16m\x1b[48;5;231m", lines[1])


if __name__ == "__main__":
    unittest.main()
