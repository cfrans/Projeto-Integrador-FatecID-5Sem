import os
import json
import tempfile
import uuid
from datetime import datetime, timezone
from pathlib import Path

from .errors import DiagnosticError
from .reports import MAX_REPORT_BYTES, validate_report


def data_directories():
    user_data = Path(os.environ.get('XDG_DATA_HOME', Path.home() / '.local/share'))
    system_data = [Path(item) for item in os.environ.get('XDG_DATA_DIRS', '/usr/local/share:/usr/share').split(':') if item]
    return [user_data, *system_data]


def desktop_entry(path):
    try:
        lines = path.read_text(encoding='utf-8').splitlines()
    except (OSError, UnicodeError):
        return None
    values = {}
    in_desktop_entry = False
    for line in lines:
        line = line.strip()
        if line == '[Desktop Entry]':
            in_desktop_entry = True
            continue
        if line.startswith('[') and line != '[Desktop Entry]':
            in_desktop_entry = False
        if not in_desktop_entry or not line or line.startswith('#') or '=' not in line:
            continue
        key, value = line.split('=', 1)
        values[key] = value
    if values.get('Type') != 'Application' or values.get('NoDisplay') == 'true' or values.get('Hidden') == 'true':
        return None
    name = values.get('Name', '').strip()
    if not name:
        return None
    categories = [item for item in values.get('Categories', '').split(';') if item]
    category = categories[0].lower() if categories else 'application'
    return {
        'sourceId': f'desktop:{path.name}',
        'name': name,
        'category': category[:100],
        'allowed': True,
    }


def collect_applications(paths=None):
    roots = data_directories() if paths is None else [Path(path) for path in paths]
    applications = {}
    for root in roots:
        directory = root / 'applications'
        if not directory.is_dir():
            continue
        for path in sorted(directory.glob('*.desktop')):
            entry = desktop_entry(path)
            if entry is not None:
                applications.setdefault(entry['sourceId'], entry)
    result = sorted(applications.values(), key=lambda item: (item['name'].casefold(), item['sourceId']))
    if len(result) > 200:
        raise DiagnosticError('Inventário excede o limite de 200 aplicativos.', 2)
    return result


def collect_report(output_path, paths=None):
    report = {
        'protocolVersion': 1,
        'reportId': str(uuid.uuid4()),
        'collectedAt': datetime.now(timezone.utc).isoformat(timespec='milliseconds').replace('+00:00', 'Z'),
        'applications': collect_applications(paths),
        'installationRequests': [],
    }
    validate_report(report)
    output = Path(output_path)
    try:
        output.parent.mkdir(mode=0o700, parents=True, exist_ok=True)
        with tempfile.NamedTemporaryFile('w', encoding='utf-8', dir=output.parent, delete=False) as temporary:
            temporary.write(json.dumps(report, ensure_ascii=False, separators=(',', ':')))
            temporary.flush()
            os.fchmod(temporary.fileno(), 0o600)
            temporary_path = Path(temporary.name)
        if temporary_path.stat().st_size > MAX_REPORT_BYTES:
            raise ValueError
        os.replace(temporary_path, output)
        os.chmod(output, 0o600)
    except (OSError, ValueError, UnicodeError):
        try:
            temporary_path.unlink(missing_ok=True)
        except UnboundLocalError:
            pass
        raise DiagnosticError('Não foi possível gravar o relatório coletado.', 2) from None
    return report
