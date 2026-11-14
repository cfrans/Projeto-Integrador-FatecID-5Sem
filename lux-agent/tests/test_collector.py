import contextlib
import io
import json
import tempfile
import unittest
from pathlib import Path

from lux_agent.collector import collect_applications, collect_report
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
            result = collect_applications([directory])
            self.assertEqual(result, [{
                'sourceId': 'desktop:browser.desktop',
                'name': 'Browser',
                'category': 'network',
                'allowed': True,
            }])

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

    def test_more_than_200_applications_sends_first_200_by_source_id(self):
        with tempfile.TemporaryDirectory() as directory:
            self.write_entries(directory, 205, 'A')
            report, warning = self.collect_quietly(directory)
            source_ids = [entry['sourceId'] for entry in report['applications']]
            self.assertEqual(len(source_ids), 200)
            self.assertEqual(source_ids, sorted(source_ids))
            self.assertEqual(source_ids[-1], 'desktop:a199.desktop')
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
