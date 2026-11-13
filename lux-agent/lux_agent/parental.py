import pwd
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



def query_policies(user: pwd.struct_passwd) -> dict[str, Any]:
    Gio, GLib, Malcontent = load_malcontent()
    try:
        connection = Gio.bus_get_sync(Gio.BusType.SYSTEM, None)
        manager = Malcontent.Manager.new(connection)
        return read_policies(manager, Malcontent.ManagerGetValueFlags.NONE, user)
    except GLib.Error as error:
        raise DiagnosticError(f"falha ao consultar políticas: {error}", 1) from None

