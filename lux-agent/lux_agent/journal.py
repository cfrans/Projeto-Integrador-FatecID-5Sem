import fcntl
import hashlib
import json
import os
import sqlite3
import stat
from pathlib import Path

from .errors import DiagnosticError


class CommandJournal:
    def __init__(self, directory: str, origin: str, credential: str):
        self.lock_fd = None
        self.db = None
        try:
            root = Path(directory)
            root.mkdir(mode=0o700, exist_ok=True)
            metadata = root.lstat()
            if not stat.S_ISDIR(metadata.st_mode) or metadata.st_uid != os.geteuid() or stat.S_IMODE(metadata.st_mode) != 0o700:
                raise ValueError
            self.lock_fd = self.private_file(root / 'lock')
            fcntl.flock(self.lock_fd, fcntl.LOCK_EX | fcntl.LOCK_NB)
            fd = self.private_file(root / 'journal.sqlite3')
            os.close(fd)
            self.db = sqlite3.connect(root / 'journal.sqlite3')
            self.db.execute('PRAGMA synchronous=FULL')
            self.db.execute('PRAGMA journal_mode=DELETE')
            self.db.execute('CREATE TABLE IF NOT EXISTS metadata (binding TEXT NOT NULL)')
            self.db.execute('CREATE TABLE IF NOT EXISTS commands (id TEXT PRIMARY KEY, claim_id TEXT NOT NULL UNIQUE, state TEXT NOT NULL, result TEXT)')
            self.db.execute('CREATE TABLE IF NOT EXISTS reports (report_id TEXT PRIMARY KEY, payload TEXT NOT NULL, state TEXT NOT NULL)')
            binding = hashlib.sha256((origin + '\n' + credential).encode()).hexdigest()
            current = self.db.execute('SELECT binding FROM metadata').fetchall()
            if current and current != [(binding,)]:
                raise ValueError
            if not current:
                self.db.execute('INSERT INTO metadata VALUES (?)', (binding,))
            self.db.commit()
            if self.db.execute('PRAGMA quick_check').fetchone() != ('ok',):
                raise ValueError
        except (OSError, ValueError, sqlite3.Error):
            self.close()
            raise DiagnosticError('Diário privado indisponível, incompatível ou já em uso.', 2) from None

    @staticmethod
    def private_file(path):
        fd = os.open(path, os.O_RDWR | os.O_CREAT | os.O_NOFOLLOW | os.O_NONBLOCK, 0o600)
        metadata = os.fstat(fd)
        if not stat.S_ISREG(metadata.st_mode) or metadata.st_uid != os.geteuid() or stat.S_IMODE(metadata.st_mode) != 0o600 or metadata.st_nlink != 1:
            os.close(fd)
            raise ValueError
        return fd

    def get(self, command_id):
        rows = self.read('SELECT id, claim_id, state, result FROM commands WHERE id=?', (command_id,))
        return rows[0] if rows else None

    def pending(self):
        return self.read("SELECT id, claim_id, state, result FROM commands WHERE state IN ('claim_pending', 'result') ORDER BY rowid")

    def read(self, sql, values=()):
        try:
            return self.db.execute(sql, values).fetchall()
        except sqlite3.Error:
            raise DiagnosticError('Falha ao ler o diário; execução interrompida.', 2) from None

    def prepare(self, command_id, claim_id):
        self.write('INSERT INTO commands VALUES (?, ?, ?, NULL)', (command_id, claim_id, 'claim_pending'))

    def record(self, command_id, state, result=None):
        self.write('UPDATE commands SET state=?, result=? WHERE id=?', (state, json.dumps(result) if result is not None else None, command_id))

    def get_report(self, report_id):
        rows = self.read('SELECT report_id, payload, state FROM reports WHERE report_id=?', (report_id,))
        return rows[0] if rows else None

    def prepare_report(self, report_id, payload):
        self.write('INSERT INTO reports VALUES (?, ?, ?)', (report_id, json.dumps(payload, sort_keys=True), 'pending'))

    def pending_reports(self):
        return self.read("SELECT report_id, payload, state FROM reports WHERE state='pending' ORDER BY rowid")

    def acknowledge_report(self, report_id):
        self.write("UPDATE reports SET state='acknowledged' WHERE report_id=?", (report_id,))

    def write(self, sql, values):
        try:
            with self.db:
                self.db.execute(sql, values)
        except sqlite3.Error:
            raise DiagnosticError('Falha ao persistir o diário; execução interrompida.', 2) from None

    def close(self):
        if self.db is not None:
            self.db.close()
            self.db = None
        if self.lock_fd is not None:
            os.close(self.lock_fd)
            self.lock_fd = None

    def __enter__(self):
        return self

    def __exit__(self, *args):
        self.close()
