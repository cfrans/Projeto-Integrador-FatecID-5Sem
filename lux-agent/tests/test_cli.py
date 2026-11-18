import contextlib
import io
import json
import os
import pwd
import subprocess
import sys
import unittest
from pathlib import Path
from unittest.mock import patch

from lux_agent.cli import create_parser, main


ROOT = Path(__file__).resolve().parents[1]


class CliTests(unittest.TestCase):
    def invoke(self, *args, cwd=ROOT):
        return subprocess.run([sys.executable, '-B', *args], cwd=cwd, text=True,
                              capture_output=True, timeout=10)

    def test_module_help_and_subcommands_do_not_load_lux_bindings(self):
        source = '''import json
import sys
class RejectGi:
    def find_spec(self, fullname, path=None, target=None):
        if fullname == "gi" or fullname.startswith("gi."):
            raise AssertionError("GI must remain optional")
sys.meta_path.insert(0, RejectGi())
from lux_agent.cli import main
try:
    main(json.loads(sys.argv[1]))
except SystemExit as error:
    assert error.code == 0
else:
    raise AssertionError("Expected help")
assert "lux_agent.parental" not in sys.modules
assert "lux_agent.journal" not in sys.modules
assert "gi" not in sys.modules
'''
        for args in (['--help'], ['check-backend', '--help'], ['poll', '--help'], ['read-policies', '--help']):
            with self.subTest(args=args):
                result = self.invoke('-c', source, json.dumps(args))
                self.assertEqual(result.returncode, 0, result.stderr)
                self.assertIn('usage:', result.stdout)
        result = self.invoke('-m', 'lux_agent', '--help')
        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertIn('read-policies', result.stdout)

    def test_subcommand_is_required_and_unknown_command_is_rejected(self):
        for args in ([], ['shell']):
            with self.subTest(args=args):
                result = self.invoke('-m', 'lux_agent', *args)
                self.assertEqual(result.returncode, 2)
                self.assertNotIn('Traceback', result.stderr)

    def test_polling_defaults_preserve_existing_semantics(self):
        args = create_parser().parse_args(['poll', '--backend-url', 'https://api.example', '--credential-file', '/missing'])
        self.assertEqual((args.interval, args.max_backoff, args.jitter, args.timeout), (15, 300, 0.2, 10))
        self.assertIsNone(args.max_queries)
        self.assertIsNone(args.state_dir)
        self.assertIsNone(args.ca_file)
        self.assertFalse(args.allow_local_http)

    def test_legacy_scripts_preserve_exit_codes_and_diagnostic_output(self):
        cases = [
            ('check_backend.py', 'check-backend', ['--backend-url', 'http://remote.example', '--credential-file', '/missing'], 2),
            ('poll_associations.py', 'poll', ['--backend-url', 'https://api.example', '--credential-file', '/missing', '--max-queries', '0'], 2),
            ('read_policies.py', 'read-policies', ['--user', 'lux-agent-user-that-does-not-exist'], 1),
            ('prove_app_filter.py', 'prove-app-filter', ['--user', 'lux-agent-user-that-does-not-exist', '--block', 'desktop:x.desktop'], 1),
        ]
        for script, command, args, expected in cases:
            with self.subTest(command=command):
                legacy = self.invoke(str(ROOT / script), *args, cwd=ROOT.parent)
                module = self.invoke('-m', 'lux_agent', command, *args)
                self.assertEqual(legacy.returncode, expected, legacy.stderr)
                self.assertEqual(module.returncode, expected, module.stderr)
                self.assertEqual((legacy.stdout, legacy.stderr), (module.stdout, module.stderr))

    def test_deploy_allowlist_contains_sources_without_state_or_secrets(self):
        entries = (ROOT / 'deploy-files.txt').read_text().splitlines()
        allowed_metadata = {'.gitignore', 'README.md', 'pyproject.toml', 'deploy-files.txt', 'lux-agent.service', 'agent.env.example', 'polkit/50-lux-agent.rules', 'polkit/org.piplup.luxagent.pair.policy', 'scripts/lux-agent', 'scripts/lux-agent-pair-helper', 'scripts/piplup', 'desktop/org.piplup.Pairing.desktop', 'desktop/org.piplup.Pairing.svg', 'install.sh', 'uninstall.sh'}
        self.assertEqual(len(entries), len(set(entries)))
        for entry in entries:
            path = Path(entry)
            self.assertFalse(path.is_absolute())
            self.assertNotIn('..', path.parts)
            self.assertTrue((ROOT / path).is_file(), entry)
            self.assertTrue(entry in allowed_metadata or path.suffix == '.py', entry)
        required = {str(path.relative_to(ROOT)) for folder in ('lux_agent', 'lux_agent_gui', 'tests') for path in (ROOT / folder).glob('*.py')}
        required.update({'check_backend.py', 'poll_associations.py', 'read_policies.py', 'prove_app_filter.py', 'polkit/50-lux-agent.rules', 'polkit/org.piplup.luxagent.pair.policy', 'scripts/lux-agent', 'scripts/lux-agent-pair-helper', 'scripts/piplup', 'desktop/org.piplup.Pairing.desktop', 'desktop/org.piplup.Pairing.svg', 'install.sh', 'uninstall.sh'})
        self.assertTrue(required.issubset(entries), required.difference(entries))

    def test_install_scripts_are_valid_bash(self):
        for script in ('install.sh', 'uninstall.sh'):
            with self.subTest(script=script):
                self.assertTrue(os.access(ROOT / script, os.X_OK))
                result = subprocess.run(['bash', '-n', str(ROOT / script)], capture_output=True, text=True)
                self.assertEqual(result.returncode, 0, result.stderr)

    def test_parental_missing_bindings_keeps_exit_code_and_message(self):
        stdout, stderr = io.StringIO(), io.StringIO()
        with patch.dict('sys.modules', {'gi': None}), contextlib.redirect_stdout(stdout), contextlib.redirect_stderr(stderr):
            code = main(['read-policies', '--user', pwd.getpwuid(os.geteuid()).pw_name])
        self.assertEqual(code, 1)
        self.assertEqual(stdout.getvalue(), '')
        self.assertIn('PyGObject e bindings Malcontent 0', stderr.getvalue())
        self.assertNotIn('Traceback', stderr.getvalue())


if __name__ == '__main__':
    unittest.main()
