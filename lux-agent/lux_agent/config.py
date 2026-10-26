import math
import os
import re
import stat
from urllib.parse import urlsplit

from .errors import DiagnosticError


def backend_endpoint(url: str, allow_local_http: bool) -> str:
    try:
        parsed = urlsplit(url)
        port = parsed.port
    except ValueError:
        raise DiagnosticError("URL do backend inválida.", 2) from None
    if (
        not parsed.hostname
        or parsed.username is not None
        or parsed.password is not None
        or parsed.query
        or parsed.fragment
        or parsed.path not in ("", "/")
        or port == 0
        or any(ord(char) <= 32 or ord(char) >= 127 for char in url)
    ):
        raise DiagnosticError("Informe a origem do backend, sem credenciais, caminho ou parâmetros.", 2)
    if parsed.scheme != "https" and not (
        parsed.scheme == "http"
        and allow_local_http
        and parsed.hostname in ("127.0.0.1", "localhost", "::1")
    ):
        raise DiagnosticError("HTTPS obrigatório; HTTP local exige --allow-local-http e loopback.", 2)
    return url.rstrip("/") + "/agent/associations"


def load_credential(path: str) -> str:
    try:
        fd = os.open(path, os.O_RDONLY | os.O_NOFOLLOW | os.O_NONBLOCK)
        with os.fdopen(fd, "rb") as source:
            metadata = os.fstat(source.fileno())
            if (
                not stat.S_ISREG(metadata.st_mode)
                or metadata.st_uid != os.geteuid()
                or stat.S_IMODE(metadata.st_mode) not in (0o400, 0o600)
                or metadata.st_nlink != 1
            ):
                raise DiagnosticError("Credencial deve ser arquivo regular exclusivo do usuário atual, modo 0400 ou 0600.", 2)
            raw = source.read(45)
    except OSError:
        raise DiagnosticError("Não foi possível abrir a credencial com segurança.", 2) from None
    if not re.fullmatch(rb"[A-Za-z0-9_-]{43}\n?", raw):
        raise DiagnosticError("Formato da credencial provisionada inválido.", 2)
    return raw.decode("ascii").rstrip("\n")


def valid_timeout(timeout: float) -> bool:
    return math.isfinite(timeout) and 0 < timeout <= 120


def validate_polling_options(interval: float, max_backoff: float, jitter: float,
                             timeout: float, max_queries: int | None) -> None:
    if (
        not math.isfinite(interval) or not 0 < interval <= 86400
        or not math.isfinite(max_backoff)
        or not interval <= max_backoff <= 86400
        or not math.isfinite(jitter) or not 0 <= jitter < 1
        or not valid_timeout(timeout)
        or (max_queries is not None and max_queries < 1)
    ):
        raise DiagnosticError(
            "Configuração inválida: intervalo positivo, intervalo ≤ backoff ≤ 86400, "
            "0 ≤ jitter < 1, 0 < timeout ≤ 120 e limite de consultas positivo.", 2,
        )
