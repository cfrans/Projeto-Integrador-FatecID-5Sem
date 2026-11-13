"""Testa a escrita do filtro de aplicativos com a biblioteca malcontent simulada.

Verifica conversão de identificadores, recusa de conta administrativa, releitura
e restauração; não comprova autorização polkit nem bloqueio efetivo no Lux.
"""

import contextlib
import io
import pwd
import tempfile
import unittest
from pathlib import Path
from types import SimpleNamespace
from unittest.mock import Mock, patch

from lux_agent.cli import main
from lux_agent.errors import DiagnosticError
from lux_agent.parental import desktop_executable, is_admin_account, prove_app_filter, write_app_filter


def account(name="crianca", uid=1001, gid=1001):
    return pwd.struct_passwd((name, "x", uid, gid, "", f"/home/{name}", "/bin/sh"))


def native_filter(apps, user=False, system=False, allowlist=False):
    app_filter = Mock()
    app_filter.serialize.return_value.unpack.return_value = {
        "AppFilter": (allowlist, apps),
        "OarsFilter": ("oars-1.1", {}),
        "AllowUserInstallation": user,
        "AllowSystemInstallation": system,
    }
    return app_filter


class GLibError(Exception):
    def __init__(self, message, denied=False):
        super().__init__(message)
        self.denied = denied

    def matches(self, domain, code):
        return self.denied


DESIRED = {"blockedApps": ["/usr/bin/b", "/usr/bin/a"], "allowUserInstallation": False, "allowSystemInstallation": False}


class AdminAccountTests(unittest.TestCase):
    def test_root_and_sudo_members_are_admin(self):
        sudo = SimpleNamespace(gr_gid=27, gr_mem=["admin"])
        with patch("lux_agent.parental.grp.getgrnam", return_value=sudo):
            self.assertTrue(is_admin_account(account("root", 0, 0)))
            self.assertTrue(is_admin_account(account("admin", 1000, 1000)))
            self.assertTrue(is_admin_account(account("primario", 1002, 27)))
            self.assertFalse(is_admin_account(account()))

    def test_missing_sudo_group_is_not_admin(self):
        with patch("lux_agent.parental.grp.getgrnam", side_effect=KeyError):
            self.assertFalse(is_admin_account(account()))


class DesktopExecutableTests(unittest.TestCase):
    def setUp(self):
        self.directory = tempfile.TemporaryDirectory()
        self.addCleanup(self.directory.cleanup)
        self.root = Path(self.directory.name)
        (self.root / "applications").mkdir()
        self.bin = self.root / "bin"
        self.bin.mkdir()

    def desktop(self, name, body):
        (self.root / "applications" / name).write_text(f"[Desktop Entry]\nType=Application\nName=X\n{body}\n")

    def resolve(self, source_id):
        return desktop_executable(source_id, [self.root], str(self.bin))

    def test_absolute_exec_is_used_without_field_codes(self):
        self.desktop("browser.desktop", 'Exec="/usr/lib/browser/browser" %u')
        self.assertEqual(self.resolve("desktop:browser.desktop"), "/usr/lib/browser/browser")

    def test_relative_exec_is_resolved_in_session_path(self):
        program = self.bin / "tweaks"
        program.write_text("")
        program.chmod(0o755)
        self.desktop("tweaks.desktop", "Exec=tweaks --flag")
        self.assertEqual(self.resolve("desktop:tweaks.desktop"), str(program))

    def test_exec_outside_desktop_entry_group_is_ignored(self):
        (self.root / "applications" / "action.desktop").write_text(
            "[Desktop Action new]\nExec=/usr/bin/other\n[Desktop Entry]\nExec=/usr/bin/main\n"
        )
        self.assertEqual(self.resolve("desktop:action.desktop"), "/usr/bin/main")

    def test_invalid_or_unresolvable_ids_fail(self):
        self.desktop("noexec.desktop", "")
        self.desktop("missing.desktop", "Exec=not-installed")
        for source_id in ("flatpak:x", "desktop:../x.desktop", "desktop:x", "desktop:absent.desktop",
                          "desktop:noexec.desktop", "desktop:missing.desktop"):
            with self.subTest(source_id=source_id), self.assertRaises(DiagnosticError) as error:
                self.resolve(source_id)
            self.assertEqual(error.exception.code, 2)


class WriteAppFilterTests(unittest.TestCase):
    def setUp(self):
        self.malcontent = Mock()
        self.builder = self.malcontent.AppFilterBuilder.new.return_value
        self.manager = Mock(spec=["get_app_filter", "set_app_filter"])
        patcher = patch("lux_agent.parental.is_admin_account", return_value=False)
        patcher.start()
        self.addCleanup(patcher.stop)

    def test_writes_blocklist_and_installation_then_rereads(self):
        self.manager.get_app_filter.return_value = native_filter(["/usr/bin/a", "/usr/bin/b"])
        result = write_app_filter(self.manager, self.malcontent, account(), DESIRED)
        self.assertEqual([call.args for call in self.builder.blocklist_path.call_args_list], [("/usr/bin/b",), ("/usr/bin/a",)])
        self.builder.set_allow_user_installation.assert_called_once_with(False)
        self.builder.set_allow_system_installation.assert_called_once_with(False)
        self.manager.set_app_filter.assert_called_once_with(
            1001, self.builder.end.return_value, self.malcontent.ManagerSetValueFlags.NONE, None
        )
        self.manager.get_app_filter.assert_called_once_with(1001, self.malcontent.ManagerGetValueFlags.NONE, None)
        self.assertTrue(result["matches"])
        self.assertEqual(result["observed"]["blockedApps"], ["/usr/bin/a", "/usr/bin/b"])

    def test_divergent_reread_does_not_match(self):
        self.manager.get_app_filter.return_value = native_filter(["/usr/bin/a"], user=True)
        self.assertFalse(write_app_filter(self.manager, self.malcontent, account(), DESIRED)["matches"])

    def test_allowlist_reread_is_an_error(self):
        self.manager.get_app_filter.return_value = native_filter(["/usr/bin/a"], allowlist=True)
        with self.assertRaises(DiagnosticError):
            write_app_filter(self.manager, self.malcontent, account(), DESIRED)

    def test_admin_account_is_refused_before_writing(self):
        with patch("lux_agent.parental.is_admin_account", return_value=True), self.assertRaises(DiagnosticError) as error:
            write_app_filter(self.manager, self.malcontent, account(), DESIRED)
        self.assertEqual(error.exception.code, 3)
        self.manager.set_app_filter.assert_not_called()


class ProveAppFilterTests(unittest.TestCase):
    def setUp(self):
        self.original = native_filter([], user=True, system=True)
        self.manager = Mock(spec=["get_app_filter", "set_app_filter"])
        self.malcontent = Mock()
        self.malcontent.Manager.new.return_value = self.manager
        self.bindings = (Mock(), SimpleNamespace(Error=GLibError), self.malcontent)
        for target, value in (
            ("lux_agent.parental.load_malcontent", self.bindings),
            ("lux_agent.parental.is_admin_account", False),
            ("lux_agent.parental.desktop_executable", "/usr/bin/a"),
        ):
            patcher = patch(target, return_value=value)
            patcher.start()
            self.addCleanup(patcher.stop)

    def test_restores_original_filter_after_reread(self):
        written = native_filter(["/usr/bin/a"])
        restored = Mock()
        restored.equal.return_value = True
        self.manager.get_app_filter.side_effect = [self.original, written, restored]
        result = prove_app_filter(account(), ["desktop:a.desktop"], hold=0)
        self.assertTrue(result["matches"])
        self.assertTrue(result["restored"])
        self.assertIs(self.manager.set_app_filter.call_args_list[-1].args[1], self.original)
        restored.equal.assert_called_once_with(self.original)

    def test_restores_original_filter_when_reread_fails(self):
        self.manager.get_app_filter.side_effect = [self.original, GLibError("falha de leitura")]
        with self.assertRaises(DiagnosticError) as error:
            prove_app_filter(account(), ["desktop:a.desktop"], hold=0)
        self.assertEqual(error.exception.code, 1)
        self.assertIs(self.manager.set_app_filter.call_args_list[-1].args[1], self.original)

    def test_hold_waits_before_restoring_even_when_interrupted(self):
        self.manager.get_app_filter.side_effect = [self.original, native_filter(["/usr/bin/a"])]
        with patch("lux_agent.parental.time.sleep", side_effect=KeyboardInterrupt) as sleep, self.assertRaises(KeyboardInterrupt):
            prove_app_filter(account(), ["desktop:a.desktop"], hold=30)
        sleep.assert_called_once_with(30)
        self.assertIs(self.manager.set_app_filter.call_args_list[-1].args[1], self.original)

    def test_permission_denied_has_distinct_code(self):
        self.manager.get_app_filter.side_effect = GLibError("Not allowed", denied=True)
        with self.assertRaises(DiagnosticError) as error:
            prove_app_filter(account(), ["desktop:a.desktop"], hold=0)
        self.assertEqual(error.exception.code, 4)
        self.manager.set_app_filter.assert_not_called()


class ProveAppFilterCliTests(unittest.TestCase):
    def test_admin_account_is_refused_without_loading_bindings(self):
        with (
            patch("lux_agent.cli.pwd.getpwnam", return_value=account()),
            patch("lux_agent.parental.is_admin_account", return_value=True),
            patch.dict("sys.modules", {"gi": None}),
            contextlib.redirect_stdout(io.StringIO()) as stdout,
            contextlib.redirect_stderr(io.StringIO()) as stderr,
        ):
            self.assertEqual(main(["prove-app-filter", "--user", "crianca", "--block", "desktop:a.desktop"]), 3)
        self.assertEqual(stdout.getvalue(), "")
        self.assertIn("conta administrativa", stderr.getvalue())

    def test_mismatch_returns_failure_with_json(self):
        result = {"matches": False, "restored": True}
        with (
            patch("lux_agent.cli.pwd.getpwnam", return_value=account()),
            patch("lux_agent.parental.prove_app_filter", return_value=result),
            contextlib.redirect_stdout(io.StringIO()) as stdout,
        ):
            self.assertEqual(main(["prove-app-filter", "--user", "crianca", "--block", "desktop:a.desktop"]), 1)
        self.assertIn('"matches": false', stdout.getvalue())

    def test_hold_is_bounded(self):
        with (
            patch("lux_agent.cli.pwd.getpwnam", return_value=account()),
            patch("lux_agent.parental.prove_app_filter") as prove,
            contextlib.redirect_stderr(io.StringIO()),
        ):
            self.assertEqual(main(["prove-app-filter", "--user", "crianca", "--block", "desktop:a.desktop", "--hold", "601"]), 2)
        prove.assert_not_called()


if __name__ == "__main__":
    unittest.main()
