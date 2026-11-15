import hashlib
import json
import os
import pwd
import re
import secrets
import socket
import subprocess
import sys
import tempfile
import time
from datetime import datetime
from typing import Any, Callable, TextIO

from .backend import network_deadline, request_json
from .config import backend_endpoint, load_credential
from .errors import DiagnosticError
from .polling import query_associations

CONFIG_DIR = "/etc/lux-agent"
ENV_FILE = f"{CONFIG_DIR}/agent.env"
CREDENTIAL_FILE = f"{CONFIG_DIR}/credential"
CA_FILE = f"{CONFIG_DIR}/ca.pem"
SERVICE_USER = "lux-agent"
SERVICE_UNIT = "lux-agent.service"
REQUEST_TIMEOUT = 10.0
WAIT_INTERVAL = 3.0
PAIRING_URI = re.compile(r"piplup://pair\?token=[A-Za-z0-9_-]{16,128}")


class AlreadyPaired(Exception):
    pass


def read_env(path: str) -> dict[str, str]:
    values: dict[str, str] = {}
    try:
        with open(path, encoding="utf-8") as source:
            for line in source:
                key, separator, value = line.rstrip("\n").partition("=")
                if separator and not key.startswith("#"):
                    values[key.strip()] = value
    except (OSError, UnicodeError):
        raise DiagnosticError("Não foi possível ler a configuração do Agent; reinstale-o.", 2) from None
    return values


def generate_credential() -> str:
    return secrets.token_urlsafe(32)


def credential_hash(credential: str) -> str:
    return hashlib.sha256(credential.encode("ascii")).hexdigest()


def write_credential(path: str, credential: str, uid: int, gid: int) -> None:
    directory = os.path.dirname(path)
    fd, temporary = tempfile.mkstemp(dir=directory, prefix=".credential.")
    try:
        with os.fdopen(fd, "w", encoding="ascii") as target:
            os.fchmod(target.fileno(), 0o600)
            os.fchown(target.fileno(), uid, gid)
            target.write(credential)
            target.flush()
            os.fsync(target.fileno())
        os.replace(temporary, path)
    except BaseException:
        try:
            os.unlink(temporary)
        except FileNotFoundError:
            pass
        raise
    directory_fd = os.open(directory, os.O_RDONLY)
    try:
        os.fsync(directory_fd)
    finally:
        os.close(directory_fd)


def has_active_association(associations: list[dict[str, Any]]) -> bool:
    return any(item["revokedAt"] is None for item in associations)


def validate_session(session: Any) -> dict[str, str]:
    try:
        uri = session["qrPayload"]
        expires_at = session["expiresAt"]
        if not isinstance(uri, str) or not PAIRING_URI.fullmatch(uri) or not isinstance(expires_at, str):
            raise ValueError
        if datetime.fromisoformat(expires_at).tzinfo is None:
            raise ValueError
    except (TypeError, KeyError, ValueError):
        raise DiagnosticError("Resposta incompatível com o contrato de pareamento.", 6, category="response") from None
    return {"uri": uri, "expiresAt": expires_at}


def post_session(endpoint: str, credential: str | None, ca_file: str | None,
                 payload: dict[str, str] | None = None) -> dict[str, str]:
    try:
        with network_deadline(REQUEST_TIMEOUT):
            session = request_json(
                endpoint, credential, REQUEST_TIMEOUT, ca_file, method="POST",
                payload=payload, expected_statuses=(201,),
            )
    except DiagnosticError as error:
        if error.http_status == 409:
            if credential is not None:
                raise AlreadyPaired from None
            raise DiagnosticError("Credencial gerada já registrada; tente novamente.", 1) from None
        raise
    return validate_session(session)


def start_session(origin: str, ca_file: str | None, credential_file: str, uid: int, gid: int,
                  name: str, managed_user: str) -> tuple[str, dict[str, str]]:
    credential = load_credential(credential_file, owner_uid=uid) if os.path.lexists(credential_file) else None
    if credential is not None:
        try:
            associations = query_associations(origin + "/agent/associations", credential, REQUEST_TIMEOUT, ca_file)
        except DiagnosticError as error:
            if error.code != 3:
                raise
            credential = None
        else:
            if has_active_association(associations):
                raise AlreadyPaired
            return credential, post_session(origin + "/agent/pairing-sessions", credential, ca_file)
    credential = generate_credential()
    write_credential(credential_file, credential, uid, gid)
    return credential, post_session(origin + "/agent/registrations", None, ca_file, {
        "credentialHash": credential_hash(credential), "name": name, "managedUser": managed_user,
    })


def wait_for_association(origin: str, credential: str, expires_at: str, ca_file: str | None,
                         *, sleep: Callable[[float], None] = time.sleep,
                         now: Callable[[], float] = time.time) -> bool:
    deadline = datetime.fromisoformat(expires_at).timestamp()
    while now() < deadline:
        try:
            associations = query_associations(origin + "/agent/associations", credential, REQUEST_TIMEOUT, ca_file)
            if has_active_association(associations):
                return True
        except DiagnosticError as error:
            if error.code != 3 and not error.retryable:
                raise
        sleep(max(0.0, min(WAIT_INTERVAL, deadline - now())))
    return False


def emit(output: TextIO, event: str, **fields: str) -> None:
    output.write(json.dumps({"event": event, **fields}, ensure_ascii=False) + "\n")
    output.flush()


def run_helper(output: TextIO = sys.stdout) -> int:
    try:
        if os.geteuid() != 0:
            raise DiagnosticError("O auxiliar de pareamento deve ser executado via pkexec.", 2)
        env = read_env(ENV_FILE)
        origin = backend_endpoint(env.get("LUX_AGENT_BACKEND_URL", ""), False).removesuffix("/agent/associations")
        managed_user = env.get("LUX_AGENT_MANAGED_USER", "")
        if not managed_user:
            raise DiagnosticError("Conta gerenciada ausente na configuração; reinstale o Agent.", 2)
        try:
            service = pwd.getpwnam(SERVICE_USER)
        except KeyError:
            raise DiagnosticError("Usuário lux-agent ausente; reinstale o Agent.", 2) from None
        name = socket.gethostname()[:100] or "Computador Lux"
        ca_file = CA_FILE if os.path.isfile(CA_FILE) else None
        try:
            credential, session = start_session(
                origin, ca_file, CREDENTIAL_FILE, service.pw_uid, service.pw_gid, name, managed_user,
            )
        except AlreadyPaired:
            emit(output, "already-paired")
            return 0
        emit(output, "session", uri=session["uri"], expiresAt=session["expiresAt"])
        if not wait_for_association(origin, credential, session["expiresAt"], ca_file):
            emit(output, "expired")
            return 1
        if subprocess.run(["systemctl", "restart", SERVICE_UNIT], stdout=subprocess.DEVNULL).returncode != 0:
            raise DiagnosticError("Vínculo confirmado, mas o serviço lux-agent não reiniciou.", 1)
        emit(output, "paired")
        return 0
    except DiagnosticError as error:
        emit(output, "error", message=str(error))
        return error.code
    except OSError:
        emit(output, "error", message="Falha ao gravar a credencial ou reiniciar o serviço.")
        return 1
    except KeyboardInterrupt:
        emit(output, "error", message="Pareamento interrompido.")
        return 130

