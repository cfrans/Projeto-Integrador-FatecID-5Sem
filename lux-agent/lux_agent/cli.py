import argparse
import json
import pwd
import signal
import sys

from .backend import check_backend
from .config import backend_endpoint, load_credential, valid_timeout, validate_polling_options
from .errors import DiagnosticError
from .polling import poll_associations, stop_polling


def add_backend_arguments(parser: argparse.ArgumentParser, *, polling: bool = False) -> None:
    parser.add_argument("--backend-url", required=True, help="Origem HTTPS do backend")
    parser.add_argument("--ca-file", help="Arquivo PEM de CA confiável para este processo; omitido usa a confiança padrão")
    parser.add_argument("--credential-file", required=True, help="Arquivo privado gerado pelo provisionamento")
    parser.add_argument("--timeout", type=float, default=10, help=(
        "Prazo total por consulta, até 120 segundos (padrão: 10)" if polling
        else "Timeout de operações de rede em segundos (padrão: 10)"
    ))
    parser.add_argument("--allow-local-http", action="store_true", help="Permite HTTP somente em loopback para desenvolvimento")


def create_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(prog="lux-agent", description="Diagnóstico e polling do Lux Agent.")
    commands = parser.add_subparsers(dest="command", required=True)
    check = commands.add_parser("check-backend", help="Valida uma vez a comunicação autenticada", description="Valida uma vez a comunicação autenticada do Lux Agent.")
    add_backend_arguments(check)
    check.set_defaults(handler=run_check_backend)
    poll = commands.add_parser("poll", help="Consulta vínculos e processa ping com diário explícito", description="Consulta periodicamente os vínculos do próprio computador, sem alterá-los.")
    add_backend_arguments(poll, polling=True)
    poll.add_argument("--state-dir", help="Ativa agent.ping com diário em diretório privado 0700")
    poll.add_argument("--interval", type=float, default=15, help="Intervalo base em segundos (padrão: 15)")
    poll.add_argument("--max-backoff", type=float, default=300, help="Teto do backoff com jitter (padrão: 300)")
    poll.add_argument("--jitter", type=float, default=0.2, help="Variação proporcional de 0 a menos de 1 (padrão: 0.2)")
    poll.add_argument("--max-queries", type=int, help="Limita tentativas, incluindo falhas; omitido mantém o ciclo")
    poll.set_defaults(handler=run_poll)
    parental = commands.add_parser("read-policies", help="Lê políticas locais sem alterá-las", description="Consulta políticas malcontent sem alterá-las ou pedir autorização interativa.")
    parental.add_argument("--user", required=True, help="Nome de login do usuário alvo")
    parental.set_defaults(handler=run_read_policies)
    return parser


def run_check_backend(args: argparse.Namespace) -> int:
    try:
        if not valid_timeout(args.timeout):
            raise DiagnosticError("Timeout deve ser maior que zero e no máximo 120 segundos.", 2)
        endpoint = backend_endpoint(args.backend_url, args.allow_local_http)
        credential = load_credential(args.credential_file)
        count = check_backend(endpoint, credential, args.timeout, args.ca_file)
    except DiagnosticError as error:
        print(f"Erro: {error}", file=sys.stderr)
        return error.code
    print(f"Comunicação autenticada confirmada (HTTP 200); {count} associação(ões) no histórico. Isso não confirma aplicação de políticas.")
    return 0


def run_poll(args: argparse.Namespace) -> int:
    previous_handlers = {}
    journal = None
    try:
        validate_polling_options(args.interval, args.max_backoff, args.jitter, args.timeout, args.max_queries)
        endpoint = backend_endpoint(args.backend_url, args.allow_local_http)
        for signum in (signal.SIGINT, signal.SIGTERM):
            previous_handlers[signum] = signal.signal(signum, stop_polling)
        credential = load_credential(args.credential_file)
        processor = None
        if args.state_dir is not None:
            from .journal import CommandJournal
            from .commands import CommandProcessor

            origin = endpoint.removesuffix('/agent/associations')
            journal = CommandJournal(args.state_dir, origin, credential)
            processor = CommandProcessor(origin + '/agent/commands', credential, journal, args.timeout, args.ca_file)
        return poll_associations(
            endpoint, credential, ca_file=args.ca_file, interval=args.interval, max_backoff=args.max_backoff,
            jitter=args.jitter, timeout=args.timeout, max_queries=args.max_queries, command_processor=processor,
        )
    except DiagnosticError as error:
        print(f"Erro: {error.category}: {error}", file=sys.stderr)
        return error.code
    except KeyboardInterrupt:
        print("Polling encerrado por sinal.", file=sys.stderr)
        return 0
    finally:
        if journal is not None:
            journal.close()
        for signum, handler in previous_handlers.items():
            signal.signal(signum, handler)


def run_read_policies(args: argparse.Namespace) -> int:
    from .parental import query_policies

    try:
        user = pwd.getpwnam(args.user)
    except KeyError:
        print("Erro: usuário não encontrado.", file=sys.stderr)
        return 1
    try:
        result = query_policies(user)
    except DiagnosticError as error:
        print(str(error), file=sys.stderr)
        return error.code
    print(json.dumps(result, ensure_ascii=False, indent=2))
    return 0


def main(argv: list[str] | None = None) -> int:
    args = create_parser().parse_args(argv)
    return args.handler(args)


def check_backend_main(argv: list[str] | None = None) -> int:
    return main(["check-backend", *(sys.argv[1:] if argv is None else argv)])


def poll_main(argv: list[str] | None = None) -> int:
    return main(["poll", *(sys.argv[1:] if argv is None else argv)])


def read_policies_main(argv: list[str] | None = None) -> int:
    return main(["read-policies", *(sys.argv[1:] if argv is None else argv)])
