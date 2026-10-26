"""Consulta filtros de aplicativos e limites de sessão de uma conta explícita no Lux.

Usa Python/PyGObject/libmalcontent e imprime as políticas em JSON, sem alterá-las
nem solicitar elevação de privilégios.
"""

import argparse
import json
import pwd
import sys
from typing import Any


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


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(
        description="Consulta políticas malcontent sem alterá-las ou pedir autorização interativa."
    )
    parser.add_argument("--user", required=True, help="Nome de login do usuário alvo")
    args = parser.parse_args(argv)
    try:
        user = pwd.getpwnam(args.user)
    except KeyError:
        print("Erro: usuário não encontrado.", file=sys.stderr)
        return 1

    try:
        import gi

        gi.require_version("Malcontent", "0")
        from gi.repository import Gio, GLib, Malcontent
    except (ImportError, ValueError):
        print(
            "Erro: PyGObject e bindings Malcontent 0 são necessários; execute no Lux com o Python do sistema.",
            file=sys.stderr,
        )
        return 1

    try:
        connection = Gio.bus_get_sync(Gio.BusType.SYSTEM, None)
        manager = Malcontent.Manager.new(connection)
        result = read_policies(manager, Malcontent.ManagerGetValueFlags.NONE, user)
    except GLib.Error as error:
        print(f"Erro ao consultar políticas: {error}", file=sys.stderr)
        return 1

    print(json.dumps(result, ensure_ascii=False, indent=2))
    return 0


if __name__ == "__main__":
    sys.exit(main())
