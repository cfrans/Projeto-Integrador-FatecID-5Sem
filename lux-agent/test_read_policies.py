"""Testa a consulta de políticas com a biblioteca malcontent simulada.

Verifica argumentos, resultados e tratamento de falhas; pode rodar no WSL2 sem
PyGObject, D-Bus ou malcontent, mas não comprova aplicação de restrições no Lux.
"""

import contextlib
import io
import json
import pwd
import unittest
from types import SimpleNamespace
from unittest.mock import Mock, patch

from read_policies import main, read_policies


class ReadPoliciesTests(unittest.TestCase):
    def setUp(self):
        self.user = pwd.struct_passwd(("teste", "x", 1001, 1001, "", "/home/teste", "/bin/sh"))
        self.manager = Mock(spec=["get_app_filter", "get_session_limits"])
        self.manager.get_app_filter.return_value.is_enabled.return_value = True
        self.manager.get_app_filter.return_value.serialize.return_value.unpack.return_value = {
            "AppFilter": (False, ["/usr/bin/example"]),
            "OarsFilter": ("oars-1.1", {"violence-cartoon": 2}),
            "AllowUserInstallation": False,
            "AllowSystemInstallation": False,
        }
        self.manager.get_session_limits.return_value.is_enabled.return_value = True
        self.manager.get_session_limits.return_value.serialize.return_value.unpack.return_value = {
            "LimitType": 1,
            "DailySchedule": (3600, 7200),
        }

    def test_reads_explicit_uid_and_preserves_native_values(self):
        flags = object()
        result = read_policies(self.manager, flags, self.user)
        self.manager.get_app_filter.assert_called_once_with(1001, flags, None)
        self.manager.get_session_limits.assert_called_once_with(1001, flags, None)
        self.assertEqual(result["user"], {"name": "teste", "uid": 1001})
        self.assertTrue(result["app_filter"]["enabled"])
        self.assertFalse(result["app_filter"]["policy"]["AllowUserInstallation"])
        self.assertEqual(
            result["app_filter"]["policy"]["OarsFilter"][1], {"violence-cartoon": 2}
        )
        self.assertEqual(
            json.loads(json.dumps(result))["session_limits"]["policy"]["DailySchedule"],
            [3600, 7200],
        )

    def test_disabled_policies_are_not_errors(self):
        for getter in (self.manager.get_app_filter, self.manager.get_session_limits):
            getter.return_value.is_enabled.return_value = False
        result = read_policies(self.manager, 0, self.user)
        self.assertFalse(result["app_filter"]["enabled"])
        self.assertFalse(result["session_limits"]["enabled"])

    def test_requires_explicit_user(self):
        with (
            contextlib.redirect_stderr(io.StringIO()),
            self.assertRaises(SystemExit) as error,
        ):
            main([])
        self.assertEqual(error.exception.code, 2)

    def test_unknown_user_fails_without_loading_gi(self):
        with (
            patch("read_policies.pwd.getpwnam", side_effect=KeyError),
            patch.dict("sys.modules", {"gi": None}),
            contextlib.redirect_stderr(io.StringIO()) as stderr,
        ):
            self.assertEqual(main(["--user", "inexistente"]), 1)
        self.assertIn("usuário não encontrado", stderr.getvalue())

    def test_missing_bindings_are_actionable(self):
        with (
            patch("read_policies.pwd.getpwnam", return_value=self.user),
            patch.dict("sys.modules", {"gi": None}),
            contextlib.redirect_stderr(io.StringIO()) as stderr,
        ):
            self.assertEqual(main(["--user", "teste"]), 1)
        self.assertIn("execute no Lux", stderr.getvalue())

    def run_cli(self):
        self.gi = Mock()
        self.gio = Mock()
        self.malcontent = Mock()
        self.malcontent.Manager.new.return_value = self.manager
        self.repository = SimpleNamespace(
            Gio=self.gio,
            GLib=SimpleNamespace(Error=PermissionError),
            Malcontent=self.malcontent,
        )
        return patch.dict("sys.modules", {"gi": self.gi, "gi.repository": self.repository})

    def test_cli_uses_system_bus_and_noninteractive_flags(self):
        with (
            self.run_cli(),
            patch("read_policies.pwd.getpwnam", return_value=self.user),
            contextlib.redirect_stdout(io.StringIO()) as stdout,
        ):
            self.assertEqual(main(["--user", "teste"]), 0)
        self.gi.require_version.assert_called_once_with("Malcontent", "0")
        self.gio.bus_get_sync.assert_called_once_with(self.gio.BusType.SYSTEM, None)
        self.manager.get_session_limits.assert_called_once_with(
            1001, self.malcontent.ManagerGetValueFlags.NONE, None
        )
        self.assertEqual(json.loads(stdout.getvalue())["user"]["uid"], 1001)

    def test_read_failure_produces_no_partial_success(self):
        self.manager.get_session_limits.side_effect = PermissionError("consulta negada")
        with (
            self.run_cli(),
            patch("read_policies.pwd.getpwnam", return_value=self.user),
            contextlib.redirect_stdout(io.StringIO()) as stdout,
            contextlib.redirect_stderr(io.StringIO()) as stderr,
        ):
            self.assertEqual(main(["--user", "teste"]), 1)
        self.assertEqual(stdout.getvalue(), "")
        self.assertIn("consulta negada", stderr.getvalue())


if __name__ == "__main__":
    unittest.main()
