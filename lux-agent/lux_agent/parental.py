import grp
import os
import pwd
import shlex
import shutil
import time
from pathlib import Path
from typing import Any

from .errors import DiagnosticError


def read_policies(manager: Any, flags: Any, user: pwd.struct_passwd) -> dict[str, Any]:
    app_filter = manager.get_app_filter(user.pw_uid, flags, None)
    session_limits = manager.get_session_limits(user.pw_uid, flags, None)
    return {
        "user": {"name": user.pw_name, "uid": user.pw_uid},
        "app_filter": {
            "enabled": app_filter.is_enabled(),
            "policy": app_filter.serialize().unpack(),
        },
        "session_limits": {
            "enabled": session_limits.is_enabled(),
            "policy": session_limits.serialize().unpack(),
        },
    }


def query_policies(user: pwd.struct_passwd) -> dict[str, Any]:
    Gio, GLib, Malcontent = load_malcontent()
    try:
        connection = Gio.bus_get_sync(Gio.BusType.SYSTEM, None)
        manager = Malcontent.Manager.new(connection)
        return read_policies(manager, Malcontent.ManagerGetValueFlags.NONE, user)
    except GLib.Error as error:
        raise DiagnosticError(f"falha ao consultar políticas: {error}", 1) from None


SESSION_PATH = "/usr/local/bin:/usr/bin:/bin:/usr/games"
GENERIC_LAUNCHERS = frozenset({
    "env", "sh", "bash", "dash", "zsh", "xdg-open", "gio", "flatpak", "snap",
    "python", "python3", "perl", "pkexec", "sudo", "nohup", "setsid",
})
ADMIN_GROUPS = ("sudo", "admin", "wheel")


def is_admin_account(user: pwd.struct_passwd) -> bool:
    if user.pw_uid == 0:
        return True
    for name in ADMIN_GROUPS:
        try:
            group = grp.getgrnam(name)
        except KeyError:
            continue
        if user.pw_gid == group.gr_gid or user.pw_name in group.gr_mem:
            return True
    return False


def desktop_executable(source_id: str, roots: list[Path] | None = None, search_path: str = SESSION_PATH) -> str:
    from .collector import data_directories

    prefix = "desktop:"
    desktop_id = source_id.removeprefix(prefix)
    if not source_id.startswith(prefix) or not desktop_id.endswith(".desktop") or "/" in desktop_id:
        raise DiagnosticError(f"identificador de aplicativo inválido: {source_id}", 2)
    for root in data_directories() if roots is None else roots:
        path = Path(root) / "applications" / desktop_id
        if path.is_file():
            break
    else:
        raise DiagnosticError(f"aplicativo não encontrado: {source_id}", 2)
    exec_line = None
    in_entry = False
    try:
        lines = path.read_text(encoding="utf-8").splitlines()
    except (OSError, UnicodeError):
        raise DiagnosticError(f"aplicativo ilegível: {source_id}", 2) from None
    for line in lines:
        line = line.strip()
        if line.startswith("["):
            in_entry = line == "[Desktop Entry]"
        elif in_entry and line.startswith("Exec="):
            exec_line = line.removeprefix("Exec=")
            break
    return exec_executable(source_id, exec_line, search_path)


def exec_executable(source_id: str, exec_line: str | None, search_path: str = SESSION_PATH) -> str:
    try:
        program = shlex.split(exec_line or "")[0]
    except (ValueError, IndexError):
        raise DiagnosticError(f"aplicativo sem Exec utilizável: {source_id}", 2) from None
    resolved = program if os.path.isabs(program) else shutil.which(program, path=search_path)
    if resolved is None:
        raise DiagnosticError(f"executável não encontrado para {source_id}: {program}", 2)
    if os.path.basename(resolved) in GENERIC_LAUNCHERS:
        raise DiagnosticError(f"{source_id} é aberto por um lançador genérico ({program}); bloqueá-lo afetaria outros apps.", 2)
    return os.path.normpath(resolved)


def observed_app_filter(app_filter: Any) -> dict[str, Any]:
    policy = app_filter.serialize().unpack()
    is_allowlist, apps = policy["AppFilter"]
    if is_allowlist:
        raise DiagnosticError("filtro observado é lista de permissão; esperado bloqueio.", 1)
    return {
        "blockedApps": sorted(set(apps)),
        "allowUserInstallation": policy["AllowUserInstallation"],
        "allowSystemInstallation": policy["AllowSystemInstallation"],
    }


def build_app_filter(malcontent: Any, desired: dict[str, Any]) -> Any:
    builder = malcontent.AppFilterBuilder.new()
    for path in desired["blockedApps"]:
        builder.blocklist_path(path)
    builder.set_allow_user_installation(desired["allowUserInstallation"])
    builder.set_allow_system_installation(desired["allowSystemInstallation"])
    return builder.end()


def write_app_filter(manager: Any, malcontent: Any, user: pwd.struct_passwd, desired: dict[str, Any]) -> dict[str, Any]:
    if is_admin_account(user):
        raise DiagnosticError("conta administrativa não pode ser gerenciada.", 3)
    manager.set_app_filter(
        user.pw_uid, build_app_filter(malcontent, desired), malcontent.ManagerSetValueFlags.NONE, None
    )
    observed = observed_app_filter(
        manager.get_app_filter(user.pw_uid, malcontent.ManagerGetValueFlags.NONE, None)
    )
    expected = {**desired, "blockedApps": sorted(set(desired["blockedApps"]))}
    return {"observed": observed, "matches": observed == expected}


def load_malcontent() -> tuple[Any, Any, Any]:
    try:
        import gi

        gi.require_version("Malcontent", "0")
        from gi.repository import Gio, GLib, Malcontent
    except (ImportError, ValueError):
        raise DiagnosticError(
            "PyGObject e bindings Malcontent 0 são necessários; execute no Lux com o Python do sistema.",
            1,
        ) from None
    return Gio, GLib, Malcontent


class ParentalFailure(Exception):
    def __init__(self, code: str):
        super().__init__(code)
        self.code = code


MANAGER_ERRORS = {"PERMISSION_DENIED": "PERMISSION_DENIED", "INVALID_USER": "ACCOUNT_NOT_MANAGED"}


def apply_app_filter(managed_user: str | None, parameters: dict[str, Any]) -> dict[str, Any]:
    try:
        user = pwd.getpwnam(managed_user or "")
    except KeyError:
        raise ParentalFailure("ACCOUNT_NOT_MANAGED") from None
    if not managed_user or is_admin_account(user):
        raise ParentalFailure("ACCOUNT_NOT_MANAGED")
    try:
        paths = {desktop_executable(source_id) for source_id in parameters["blockedApplications"]}
    except DiagnosticError:
        raise ParentalFailure("POLICY_UNAVAILABLE") from None
    allowed = not parameters["blockInstallation"]
    desired = {"blockedApps": sorted(paths), "allowUserInstallation": allowed, "allowSystemInstallation": allowed}
    try:
        Gio, GLib, Malcontent = load_malcontent()
    except DiagnosticError:
        raise ParentalFailure("LOCAL_UNAVAILABLE") from None
    try:
        manager = Malcontent.Manager.new(Gio.bus_get_sync(Gio.BusType.SYSTEM, None))
        outcome = write_app_filter(manager, Malcontent, user, desired)
    except GLib.Error as error:
        for name, code in MANAGER_ERRORS.items():
            if error.matches(Malcontent.manager_error_quark(), getattr(Malcontent.ManagerError, name)):
                raise ParentalFailure(code) from None
        raise ParentalFailure("LOCAL_UNAVAILABLE") from None
    except DiagnosticError:
        raise ParentalFailure("VERIFICATION_FAILED") from None
    if not outcome["matches"]:
        raise ParentalFailure("VERIFICATION_FAILED")
    return {
        "blockedApplications": sorted(parameters["blockedApplications"]),
        "blockInstallation": parameters["blockInstallation"],
    }


def prove_app_filter(user: pwd.struct_passwd, source_ids: list[str], hold: float = 0) -> dict[str, Any]:
    if is_admin_account(user):
        raise DiagnosticError("conta administrativa não pode ser gerenciada.", 3)
    desired = {
        "blockedApps": sorted({desktop_executable(source_id) for source_id in source_ids}),
        "allowUserInstallation": False,
        "allowSystemInstallation": False,
    }
    Gio, GLib, Malcontent = load_malcontent()
    get_flags = Malcontent.ManagerGetValueFlags.NONE
    set_flags = Malcontent.ManagerSetValueFlags.NONE
    try:
        manager = Malcontent.Manager.new(Gio.bus_get_sync(Gio.BusType.SYSTEM, None))
        original = manager.get_app_filter(user.pw_uid, get_flags, None)
        try:
            result = write_app_filter(manager, Malcontent, user, desired)
            time.sleep(hold)
        finally:
            manager.set_app_filter(user.pw_uid, original, set_flags, None)
        restored = manager.get_app_filter(user.pw_uid, get_flags, None).equal(original)
    except GLib.Error as error:
        denied = error.matches(Malcontent.manager_error_quark(), Malcontent.ManagerError.PERMISSION_DENIED)
        raise DiagnosticError(f"falha ao gravar filtro de aplicativos: {error}", 4 if denied else 1) from None
    return {
        "user": {"name": user.pw_name, "uid": user.pw_uid},
        "desired": desired,
        **result,
        "restored": restored,
    }
