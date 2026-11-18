import contextlib
import io
import json
import tempfile
import unittest
from pathlib import Path

from lux_agent.collector import collect_applications, collect_report, fit_applications
from lux_agent.reports import MAX_REPORT_BYTES, serialized_size, validate_report


class CollectorTests(unittest.TestCase):
    def test_collects_visible_desktop_entries_and_skips_hidden_entries(self):
        with tempfile.TemporaryDirectory() as directory:
            applications = Path(directory) / 'applications'
            applications.mkdir()
            (applications / 'browser.desktop').write_text(
                '[Desktop Entry]\nType=Application\nName=Browser\nCategories=Network;\n'
            )
            (applications / 'hidden.desktop').write_text(
                '[Desktop Entry]\nType=Application\nName=Hidden\nHidden=true\n'
            )
            (applications / 'link.desktop').write_text(
                '[Desktop Entry]\nType=Link\nName=Link\n'
            )
            (applications / 'org.piplup.Pairing.desktop').write_text(
                '[Desktop Entry]\nType=Application\nName=Piplup\n'
            )
            result = collect_applications([directory])
            self.assertEqual(result, [{
                'sourceId': 'desktop:browser.desktop',
                'name': 'Browser',
                'category': 'network',
                'allowed': True,
                'blockable': False,
                'executable': None,
            }])

    def test_reports_shared_executables_and_unblockable_launchers(self):
        with tempfile.TemporaryDirectory() as directory:
            applications = Path(directory) / 'applications'
            applications.mkdir()
            programs = Path(directory) / 'bin'
            programs.mkdir()
            for name in ('libreoffice', 'xdg-open'):
                (programs / name).write_text('')
                (programs / name).chmod(0o755)
            entries = {
                'writer': 'Exec=libreoffice --writer %U',
                'calc': 'Exec=libreoffice --calc %U',
                'guides': 'Exec=xdg-open /usr/share/doc/guide.pdf',
                'missing': 'Exec=not-installed',
                'broken': 'Exec="unterminated',
                'long': 'Exec=/' + 'x' * 191,
            }
            for name, line in entries.items():
                (applications / f'{name}.desktop').write_text(
                    f'[Desktop Entry]\nType=Application\nName={name}\n{line}\n'
                )
            result = {
                entry['name']: (entry['blockable'], entry['executable'])
                for entry in collect_applications([directory], str(programs))
            }
            office = str(programs / 'libreoffice')
            self.assertEqual(result, {
                'writer': (True, office),
                'calc': (True, office),
                'guides': (False, None),
                'missing': (False, None),
                'broken': (False, None),
                'long': (False, None),
            })

    def test_writes_valid_private_report(self):
        with tempfile.TemporaryDirectory() as directory:
            output = Path(directory) / 'state' / 'report.json'
            report = collect_report(output, [directory])
            self.assertEqual(output.stat().st_mode & 0o777, 0o600)
            self.assertEqual(json.loads(output.read_text()), report)
            self.assertEqual(report['protocolVersion'], 1)
            self.assertEqual(report['installationRequests'], [])

    def write_entries(self, directory, count, name):
        applications = Path(directory) / 'applications'
        applications.mkdir()
        for index in range(count):
            (applications / f'a{index:03}.desktop').write_text(
                f'[Desktop Entry]\nType=Application\nName={name}{index}\nCategories=X;\n'
            )

    def collect_quietly(self, directory):
        with contextlib.redirect_stderr(io.StringIO()) as stderr:
            report = collect_report(Path(directory) / 'state' / 'report.json', [directory])
        return report, stderr.getvalue()

    def test_more_than_200_applications_sends_first_200(self):
        report = {'applications': []}
        applications = [{'sourceId': f'a{index:03}'} for index in range(205)]
        with contextlib.redirect_stderr(io.StringIO()) as stderr:
            sent = fit_applications(report, applications)
        self.assertEqual(sent, applications[:200])
        self.assertIn('205', stderr.getvalue())

    def test_collected_inventory_is_cut_by_size_in_source_id_order(self):
        with tempfile.TemporaryDirectory() as directory:
            self.write_entries(directory, 205, 'A')
            report, warning = self.collect_quietly(directory)
            source_ids = [entry['sourceId'] for entry in report['applications']]
            self.assertLessEqual(serialized_size(report), MAX_REPORT_BYTES)
            self.assertEqual(source_ids, [f'desktop:a{index:03}.desktop' for index in range(len(source_ids))])
            self.assertIn('205', warning)

    def test_oversized_inventory_sends_largest_prefix_within_16_kib(self):
        with tempfile.TemporaryDirectory() as directory:
            self.write_entries(directory, 150, 'Aplicativo com nome longo ' * 5 + 'é')
            report, warning = self.collect_quietly(directory)
            count = len(report['applications'])
            self.assertTrue(0 < count < 150)
            self.assertLessEqual(serialized_size(report), MAX_REPORT_BYTES)
            entries = sorted(collect_applications([directory]), key=lambda entry: entry['sourceId'])
            self.assertEqual(report['applications'], entries[:count])
            self.assertGreater(serialized_size({**report, 'applications': entries[:count + 1]}), MAX_REPORT_BYTES)
            self.assertIn('150', warning)
            validate_report(report)

    def test_long_name_is_truncated_and_long_source_id_is_skipped(self):
        with tempfile.TemporaryDirectory() as directory:
            applications = Path(directory) / 'applications'
            applications.mkdir()
            (applications / 'long.desktop').write_text('[Desktop Entry]\nType=Application\nName=' + 'x' * 300 + '\n')
            (applications / ('y' * 200 + '.desktop')).write_text('[Desktop Entry]\nType=Application\nName=Y\n')
            result = collect_applications([directory])
            self.assertEqual([entry['sourceId'] for entry in result], ['desktop:long.desktop'])
            self.assertEqual(len(result[0]['name']), 200)


if __name__ == '__main__':
    unittest.main()
