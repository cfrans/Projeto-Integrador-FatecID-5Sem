import json
from dataclasses import dataclass
from datetime import datetime

HELPER_PATH = "/opt/lux-agent/lux-agent-pair-helper"
DENIED_EXIT_CODES = (126, 127)
QR_BORDER = 4


@dataclass(frozen=True)
class State:
    kind: str
    uri: str = ""
    expires_at: datetime | None = None
    message: str = ""


IDLE = State("idle")
AUTHORIZING = State("authorizing")
NOT_INSTALLED = State("not-installed")
RUNNING = ("authorizing", "qr")


def parse_event(line: str) -> State | None:
    try:
        event = json.loads(line)
        kind = event["event"]
    except (ValueError, TypeError, KeyError):
        return None
    if kind == "session":
        try:
            uri = event["uri"]
            expires_at = datetime.fromisoformat(event["expiresAt"])
        except (TypeError, KeyError, ValueError):
            return None
        if not isinstance(uri, str) or not uri or expires_at.tzinfo is None:
            return None
        return State("qr", uri=uri, expires_at=expires_at)
    if kind in ("paired", "already-paired", "expired"):
        return State(kind)
    if kind == "error":
        message = event.get("message")
        return State("error", message=message if isinstance(message, str) and message else "Falha no pareamento.")
    return None


def finish(current: State, seen_event: bool, exit_code: int) -> State:
    if not seen_event and exit_code in DENIED_EXIT_CODES:
        return State("denied")
    if current.kind in RUNNING:
        return State("error", message="O pareamento terminou sem resposta do auxiliar.")
    return current


def remaining_seconds(expires_at: datetime, now: datetime) -> int:
    return max(0, int((expires_at - now).total_seconds()))


def format_remaining(seconds: int) -> str:
    return f"{seconds // 60}:{seconds % 60:02d}"


def qr_pixels(matrix: list[list[bool]], scale: int) -> tuple[int, bytes]:
    size = len(matrix) * scale
    rows = []
    for row in matrix:
        line = b"".join((b"\x00\x00\x00" if dark else b"\xff\xff\xff") * scale for dark in row)
        rows.append(line * scale)
    return size, b"".join(rows)


def qr_matrix(uri: str) -> list[list[bool]]:
    import qrcode

    code = qrcode.QRCode(border=QR_BORDER)
    code.add_data(uri)
    code.make(fit=True)
    return code.get_matrix()
