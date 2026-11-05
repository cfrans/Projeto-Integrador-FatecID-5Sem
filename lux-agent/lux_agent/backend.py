import http.client
import json
import math
import re
import signal
import ssl
import time
from contextlib import contextmanager
from email.utils import parsedate_to_datetime
from typing import Any
from urllib.error import HTTPError, URLError
from urllib.request import HTTPRedirectHandler, HTTPSHandler, ProxyHandler, Request, build_opener

from .errors import DiagnosticError


class NoRedirect(HTTPRedirectHandler):
    def redirect_request(self, req, fp, code, msg, headers, newurl):
        return None


def parse_retry_after(value: str | None) -> float | None:
    if value is None:
        return None
    value = value.strip()
    if re.fullmatch(r"[0-9]+", value):
        delay = float(value)
        if not math.isfinite(delay):
            raise DiagnosticError(
                "Retry-After fora do intervalo suportado.", 6, category="response"
            )
        return delay
    try:
        date = parsedate_to_datetime(value)
        if date.tzinfo is None:
            return None
        return max(0.0, date.timestamp() - time.time())
    except (ValueError, TypeError, OverflowError):
        return None


def request_json(
    endpoint: str, credential: str, timeout: float, ca_file: str | None = None,
    *, method: str = "GET", payload: dict[str, Any] | None = None,
    max_bytes: int = 1024 * 1024, expected_statuses: tuple[int, ...] = (200,),
) -> Any:
    data = None if payload is None else json.dumps(payload, allow_nan=False).encode("utf-8")
    if data is not None and len(data) > max_bytes:
        raise DiagnosticError("Corpo da requisição excede o limite.", 6, category="configuration")
    request = Request(endpoint, data=data, method=method, headers={
        "Authorization": f"Bearer {credential}", "Accept": "application/json",
        **({"Content-Type": "application/json"} if data is not None else {}),
    })
    try:
        context = ssl.create_default_context(cafile=ca_file)
    except (OSError, ValueError):
        raise DiagnosticError("Não foi possível carregar o certificado CA configurado.", 2) from None
    opener = build_opener(ProxyHandler({}), NoRedirect(), HTTPSHandler(context=context))
    try:
        with opener.open(request, timeout=timeout) as response:
            if response.status not in expected_statuses:
                raise DiagnosticError(
                    "Resposta HTTP inesperada do backend.", 6, category="http",
                    http_status=response.status,
                )
            raw = response.read(max_bytes + 1)
    except HTTPError as error:
        try:
            status = error.code
            retry_after = (
                parse_retry_after(error.headers.get("Retry-After"))
                if status in (429, 503) else None
            )
        finally:
            error.close()
        if status == 401:
            raise DiagnosticError(
                "Autenticação recusada: identidade inválida ou revogada; procure o administrador.",
                3, category="authentication", http_status=status,
            ) from None
        if status == 429 or 500 <= status <= 599:
            raise DiagnosticError(
                "Backend incompatível com esta consulta."
                if status in (501, 505) else "Backend indisponível; tente novamente mais tarde.",
                5, category="http", retryable=status not in (501, 505), retry_after=retry_after,
                http_status=status,
            ) from None
        raise DiagnosticError(
            "Resposta HTTP inesperada; redirecionamentos não são permitidos.", 6,
            category="http", http_status=status,
        ) from None
    except (URLError, OSError, http.client.HTTPException) as error:
        reason = error.reason if isinstance(error, URLError) else error
        if isinstance(reason, ssl.SSLError):
            raise DiagnosticError(
                "Falha TLS; verifique o certificado e a configuração do backend.",
                4, category="tls",
            ) from None
        if isinstance(reason, http.client.BadStatusLine) and not isinstance(
            reason, http.client.RemoteDisconnected
        ):
            raise DiagnosticError(
                "Resposta HTTP incompatível.", 6, category="response"
            ) from None
        raise DiagnosticError(
            "Falha de conexão ou timeout; comunicação não confirmada.", 4,
            category="connection", retryable=True,
        ) from None
    try:
        if len(raw) > max_bytes:
            raise ValueError
        return json.loads(raw)
    except (ValueError, UnicodeError, RecursionError):
        raise DiagnosticError("Resposta JSON inválida ou excessiva.", 6, category="response") from None


def fetch_associations(
    endpoint: str, credential: str, timeout: float, ca_file: str | None = None
) -> list[dict[str, Any]]:
    associations = request_json(endpoint, credential, timeout, ca_file)
    try:
        if not isinstance(associations, list):
            raise ValueError
        for item in associations:
            if (
                not isinstance(item, dict)
                or not isinstance(item.get("id"), str)
                or not isinstance(item.get("createdAt"), str)
                or "revokedAt" not in item
                or not (item["revokedAt"] is None or isinstance(item["revokedAt"], str))
                or not isinstance(item.get("guardian"), dict)
                or not isinstance(item["guardian"].get("id"), str)
                or not isinstance(item["guardian"].get("name"), str)
            ):
                raise ValueError
    except (ValueError, UnicodeError, RecursionError):
        raise DiagnosticError(
            "Resposta incompatível com o contrato de associações.",
            6, category="response",
        ) from None
    return associations


def check_backend(
    endpoint: str, credential: str, timeout: float, ca_file: str | None = None
) -> int:
    return len(fetch_associations(endpoint, credential, timeout, ca_file))


def request_timeout(signum, frame):
    raise TimeoutError


@contextmanager
def network_deadline(timeout: float):
    previous = signal.signal(signal.SIGALRM, request_timeout)
    try:
        signal.setitimer(signal.ITIMER_REAL, timeout)
        yield
    except TimeoutError:
        raise DiagnosticError(
            "Prazo total da consulta excedido.", 4,
            category="connection", retryable=True,
        ) from None
    finally:
        signal.setitimer(signal.ITIMER_REAL, 0)
        signal.signal(signal.SIGALRM, previous)
