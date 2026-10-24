import argparse
import http.client
import json
import math
import os
import re
import ssl
import stat
import sys
from urllib.error import HTTPError, URLError
from urllib.parse import urlsplit
from urllib.request import HTTPRedirectHandler, ProxyHandler, Request, build_opener


class DiagnosticError(Exception):
    def __init__(self, message: str, code: int):
        super().__init__(message)
        self.code = code


class NoRedirect(HTTPRedirectHandler):
    def redirect_request(self, req, fp, code, msg, headers, newurl):
        return None


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


def check_backend(endpoint: str, credential: str, timeout: float) -> int:
    request = Request(endpoint, headers={"Authorization": f"Bearer {credential}", "Accept": "application/json"})
    opener = build_opener(ProxyHandler({}), NoRedirect())
    try:
        with opener.open(request, timeout=timeout) as response:
            if response.status != 200:
                raise DiagnosticError("Resposta HTTP inesperada do backend.", 6)
            raw = response.read(1024 * 1024 + 1)
    except HTTPError as error:
        status = error.code
        error.close()
        if status == 401:
            raise DiagnosticError("Autenticação recusada: identidade inválida ou revogada; procure o administrador.", 3) from None
        if status == 429 or 500 <= status <= 599:
            raise DiagnosticError("Backend indisponível; tente novamente mais tarde.", 5) from None
        raise DiagnosticError("Resposta HTTP inesperada; redirecionamentos não são permitidos.", 6) from None
    except (URLError, OSError, ssl.SSLError, http.client.HTTPException):
        raise DiagnosticError("Falha de conexão, TLS ou timeout; comunicação não confirmada.", 4) from None
    try:
        if len(raw) > 1024 * 1024:
            raise ValueError
        associations = json.loads(raw)
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
        raise DiagnosticError("Resposta incompatível com o contrato de associações.", 6) from None
    return len(associations)


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description="Valida uma vez a comunicação autenticada do Lux Agent.")
    parser.add_argument("--backend-url", required=True, help="Origem HTTPS do backend")
    parser.add_argument("--credential-file", required=True, help="Arquivo privado gerado pelo provisionamento")
    parser.add_argument("--timeout", type=float, default=10, help="Timeout de operações de rede em segundos (padrão: 10)")
    parser.add_argument("--allow-local-http", action="store_true", help="Permite HTTP somente em loopback para desenvolvimento")
    args = parser.parse_args(argv)
    try:
        if not math.isfinite(args.timeout) or not 0 < args.timeout <= 120:
            raise DiagnosticError("Timeout deve ser maior que zero e no máximo 120 segundos.", 2)
        endpoint = backend_endpoint(args.backend_url, args.allow_local_http)
        credential = load_credential(args.credential_file)
        count = check_backend(endpoint, credential, args.timeout)
    except DiagnosticError as error:
        print(f"Erro: {error}", file=sys.stderr)
        return error.code
    print(f"Comunicação autenticada confirmada (HTTP 200); {count} associação(ões) no histórico. Isso não confirma aplicação de políticas.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
