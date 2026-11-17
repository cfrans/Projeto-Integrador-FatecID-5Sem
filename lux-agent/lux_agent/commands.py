import json
import re
import time
import uuid
from datetime import datetime, timezone

from .backend import network_deadline, request_json
from .errors import DiagnosticError
from .parental import ParentalFailure, apply_app_filter


def invalid_response():
    return DiagnosticError('Resposta incompatível com o protocolo de comandos.', 6, category='response')


def uuid_value(value, version=4):
    try:
        return isinstance(value, str) and str(uuid.UUID(value) if version is None else uuid.UUID(value, version=version)) == value
    except ValueError:
        return False


def timestamp(value):
    if not isinstance(value, str):
        raise invalid_response()
    try:
        parsed = datetime.fromisoformat(value.replace('Z', '+00:00'))
        if parsed.utcoffset() != timezone.utc.utcoffset(parsed):
            raise ValueError
        return parsed.timestamp()
    except (ValueError, OverflowError):
        raise invalid_response() from None


def validate_command(command):
    if not isinstance(command, dict):
        raise invalid_response()
    if any(not uuid_value(command.get(key)) for key in ('id', 'associationId')) or not uuid_value(command.get('requestId'), None):
        raise invalid_response()
    if not isinstance(command.get('type'), str) or type(command.get('version')) is not int or not isinstance(command.get('parameters'), dict):
        raise invalid_response()
    if command.get('status') not in ('pending', 'running', 'succeeded', 'failed', 'expired', 'cancelled', 'unknown'):
        raise invalid_response()
    for field in ('createdAt', 'expiresAt'):
        timestamp(command.get(field))
    if command.get('executionTimeoutSeconds') != 30:
        raise invalid_response()
    if command.get('claimId') is not None and not uuid_value(command['claimId']):
        raise invalid_response()
    if command.get('executionDeadlineAt') is not None:
        timestamp(command['executionDeadlineAt'])
    return command


def execute_ping():
    return {'reachable': True}


SOURCE_ID = re.compile(r'[A-Za-z0-9][A-Za-z0-9._+:-]{0,190}')


def app_filter_parameters(parameters):
    blocked = parameters.get('blockedApplications')
    if (
        set(parameters) != {'blockedApplications', 'blockInstallation'}
        or type(parameters['blockInstallation']) is not bool
        or not isinstance(blocked, list)
        or len(blocked) > 200
        or any(not isinstance(item, str) or not SOURCE_ID.fullmatch(item) for item in blocked)
        or len(set(blocked)) != len(blocked)
    ):
        return None
    return parameters


def execute(command, managed_user):
    kind = (command['type'], command['version'])
    if kind == ('agent.ping', 1):
        if command['parameters'] != {}:
            return None, 'INVALID_PARAMETERS'
        return execute_ping(), None
    if kind == ('parental.app_filter.set', 1):
        parameters = app_filter_parameters(command['parameters'])
        if parameters is None:
            return None, 'INVALID_PARAMETERS'
        try:
            return apply_app_filter(managed_user, parameters), None
        except ParentalFailure as failure:
            return None, failure.code
    return None, 'UNSUPPORTED_OPERATION'


class CommandProcessor:
    def __init__(self, endpoint, credential, journal, timeout=10, ca_file=None, managed_user=None):
        self.endpoint = endpoint
        self.managed_user = managed_user
        self.credential = credential
        self.journal = journal
        self.timeout = timeout
        self.ca_file = ca_file

    def request(self, suffix='', method='GET', payload=None):
        with network_deadline(self.timeout):
            return request_json(self.endpoint + suffix, self.credential, self.timeout, self.ca_file,
                                method=method, payload=payload, max_bytes=16 * 1024)

    def envelope(self, response):
        if not isinstance(response, dict) or type(response.get('protocolVersion')) is not int or response['protocolVersion'] != 1:
            raise invalid_response()
        return timestamp(response.get('serverTime'))

    def process(self, entry):
        command_id, claim_id, state, saved_result = entry
        try:
            if state == 'claim_pending':
                started_at = time.monotonic()
                response = self.request('/' + command_id + '/claim', 'POST', {'claimId': claim_id})
                server_time = self.envelope(response)
                command = validate_command(response.get('command'))
                if command['id'] != command_id or command.get('claimId') != claim_id:
                    raise invalid_response()
                if command['status'] != 'running':
                    self.journal.record(command_id, 'abandoned')
                    return 0
                remaining = timestamp(command.get('executionDeadlineAt')) - server_time - (time.monotonic() - started_at)
                if not 0 < remaining <= 30:
                    self.journal.record(command_id, 'uncertain')
                    return 0
                deadline = time.monotonic() + remaining
                self.journal.record(command_id, 'started')
                if time.monotonic() >= deadline:
                    result = {'claimId': claim_id, 'status': 'failed', 'result': None, 'error': {'code': 'EXECUTION_TIMEOUT'}}
                else:
                    value, code = execute(command, self.managed_user)
                    result = {'claimId': claim_id, 'status': 'failed' if code else 'succeeded', 'result': value,
                              'error': {'code': code} if code else None}
                self.journal.record(command_id, 'result', result)
                saved_result = json.dumps(result)
            result = json.loads(saved_result)
            response = self.request('/' + command_id + '/result', 'PUT', result)
            if not isinstance(response, dict) or response.get('id') != command_id or response.get('status') != result['status']:
                raise invalid_response()
            timestamp(response.get('completedAt'))
            self.journal.record(command_id, 'acknowledged', result)
            return 1
        except DiagnosticError as error:
            if error.http_status in (404, 410):
                self.journal.record(command_id, 'abandoned')
                return 0
            raise

    def run_once(self):
        confirmed = 0
        for entry in self.journal.pending():
            confirmed += self.process(entry)
        response = self.request()
        self.envelope(response)
        commands = response.get('commands')
        if not isinstance(commands, list) or len(commands) > 1:
            raise invalid_response()
        for command in commands:
            validate_command(command)
            if command['status'] != 'pending' or command.get('claimId') is not None or command.get('executionDeadlineAt') is not None:
                raise invalid_response()
            if self.journal.get(command['id']) is None:
                self.journal.prepare(command['id'], str(uuid.uuid4()))
                confirmed += self.process(self.journal.get(command['id']))
        return confirmed
