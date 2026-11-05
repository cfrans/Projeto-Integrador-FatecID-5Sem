import json
import tempfile
import unittest
from pathlib import Path

from lux_agent.collector import collect_applications, collect_report


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


if __name__ == '__main__':
    unittest.main()
