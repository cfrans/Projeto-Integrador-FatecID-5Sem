import json
import unittest
from datetime import datetime, timezone

from lux_agent_gui.session import (
    AUTHORIZING, IDLE, State, finish, format_remaining, parse_event, qr_pixels, remaining_seconds,
)

URI = "piplup://pair?token=" + "t" * 43
EXPIRES = "2026-11-18T12:05:00Z"


def line(**event) -> str:
    return json.dumps(event)


class ParseEventTests(unittest.TestCase):
    def test_session_becomes_qr_state(self):
        state = parse_event(line(event="session", uri=URI, expiresAt=EXPIRES))
        self.assertEqual(state, State("qr", uri=URI, expires_at=datetime(2026, 11, 18, 12, 5, tzinfo=timezone.utc)))

    def test_terminal_events(self):
        for kind in ("paired", "already-paired", "expired"):
            self.assertEqual(parse_event(line(event=kind)), State(kind))

    def test_error_keeps_helper_message_or_uses_default(self):
        self.assertEqual(parse_event(line(event="error", message="Backend indisponível.")).message, "Backend indisponível.")
        self.assertEqual(parse_event(line(event="error")).message, "Falha no pareamento.")

    def test_invalid_lines_are_ignored(self):
        for text in ("", "texto", "[]", line(kind="session"), line(event="unknown"),
                     line(event="session", uri=URI), line(event="session", uri=URI, expiresAt="2026-11-18T12:05:00"),
                     line(event="session", uri=5, expiresAt=EXPIRES)):
            self.assertIsNone(parse_event(text), text)


class FinishTests(unittest.TestCase):
    def test_cancelled_or_denied_authorization_without_events(self):
        for code in (126, 127):
            self.assertEqual(finish(AUTHORIZING, False, code), State("denied"))

    def test_exit_while_running_is_an_error(self):
        qr = State("qr", uri=URI, expires_at=datetime.now(timezone.utc))
        for current in (AUTHORIZING, qr):
            self.assertEqual(finish(current, True, 1).kind, "error")

    def test_final_state_from_helper_is_kept(self):
        for current in (State("paired"), State("expired"), State("error", message="x")):
            self.assertEqual(finish(current, True, 1), current)
        self.assertEqual(finish(IDLE, True, 0), IDLE)


class CountdownTests(unittest.TestCase):
    def test_remaining_time_never_negative(self):
        expires = datetime(2026, 11, 18, 12, 5, tzinfo=timezone.utc)
        self.assertEqual(remaining_seconds(expires, datetime(2026, 11, 18, 12, 0, 1, tzinfo=timezone.utc)), 299)
        self.assertEqual(remaining_seconds(expires, datetime(2026, 11, 18, 12, 6, tzinfo=timezone.utc)), 0)
        self.assertEqual([format_remaining(s) for s in (299, 60, 9, 0)], ["4:59", "1:00", "0:09", "0:00"])


class QrPixelsTests(unittest.TestCase):
    def test_scaled_rgb_rows(self):
        size, pixels = qr_pixels([[True, False], [False, True]], 2)
        black, white = b"\x00\x00\x00", b"\xff\xff\xff"
        self.assertEqual(size, 4)
        self.assertEqual(pixels, (black * 2 + white * 2) * 2 + (white * 2 + black * 2) * 2)


if __name__ == "__main__":
    unittest.main()
