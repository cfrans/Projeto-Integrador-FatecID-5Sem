import argparse
import math
import random
import signal
import sys
import time
from typing import Any

from check_backend import (
    DiagnosticError,
    backend_endpoint,
    fetch_associations,
    load_credential,
)


def stop_polling(signum, frame):
    raise KeyboardInterrupt


def request_timeout(signum, frame):
    raise TimeoutError


def query_associations(
    endpoint: str, credential: str, timeout: float, ca_file: str | None = None
) -> list[dict[str, Any]]:
    previous = signal.signal(signal.SIGALRM, request_timeout)
    try:
        signal.setitimer(signal.ITIMER_REAL, timeout)
        return fetch_associations(endpoint, credential, timeout, ca_file)
    except TimeoutError:
        raise DiagnosticError(
            "Prazo total da consulta excedido.", 4,
            category="connection", retryable=True,
        ) from None
    finally:
        signal.setitimer(signal.ITIMER_REAL, 0)
        signal.signal(signal.SIGALRM, previous)


def wait_delay(delay: float) -> None:
    deadline = time.monotonic() + delay
    while True:
        remaining = deadline - time.monotonic()
        if remaining <= 0:
            return
        time.sleep(min(remaining, 60))


def poll_associations(
    endpoint: str,
    credential: str,
    *,
    ca_file: str | None = None,
    interval: float = 15,
    max_backoff: float = 300,
    jitter: float = 0.2,
    timeout: float = 10,
    max_queries: int | None = None,
    command_processor=None,
) -> int:
    queries = 0
    backoff = interval
    while True:
        queries += 1
        retry_after = 0.0
        try:
            associations = query_associations(endpoint, credential, timeout, ca_file)
            if command_processor is not None:
                confirmed = command_processor.run_once()
                print(f"Comandos: {confirmed} resultado(s) confirmado(s).", flush=True)
            print(
                f"Consulta {queries}: HTTP 200; {len(associations)} associação(ões) no histórico.",
                flush=True,
            )
            last_code = 0
            base_delay = interval
            backoff = interval
        except DiagnosticError as error:
            status = f" HTTP {error.http_status}" if error.http_status is not None else ""
            print(f"Consulta {queries}: {error.category}{status}: {error}", file=sys.stderr, flush=True)
            if not error.retryable:
                return error.code
            last_code = error.code
            base_delay = backoff
            backoff = min(max_backoff, backoff * 2)
            retry_after = error.retry_after or 0.0
        if max_queries is not None and queries >= max_queries:
            return last_code
        delay = min(max_backoff, base_delay * random.uniform(1 - jitter, 1 + jitter))
        wait_delay(max(delay, retry_after))


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(
        description="Consulta periodicamente os vínculos do próprio computador, sem alterá-los."
    )
    parser.add_argument("--backend-url", required=True)
    parser.add_argument("--state-dir", help="Ativa agent.ping com diário em diretório privado 0700")
    parser.add_argument("--ca-file", help="Arquivo PEM de CA confiável para este processo; omitido usa a confiança padrão")
    parser.add_argument("--credential-file", required=True)
    parser.add_argument("--allow-local-http", action="store_true")
    parser.add_argument("--interval", type=float, default=15, help="Intervalo base em segundos (padrão: 15)")
    parser.add_argument("--max-backoff", type=float, default=300, help="Teto do backoff com jitter (padrão: 300)")
    parser.add_argument("--jitter", type=float, default=0.2, help="Variação proporcional de 0 a menos de 1 (padrão: 0.2)")
    parser.add_argument("--timeout", type=float, default=10, help="Prazo total por consulta, até 120 segundos (padrão: 10)")
    parser.add_argument("--max-queries", type=int, help="Limita tentativas, incluindo falhas; omitido mantém o ciclo")
    args = parser.parse_args(argv)
    previous_handlers = {}
    journal = None
    try:
        if (
            not math.isfinite(args.interval) or not 0 < args.interval <= 86400
            or not math.isfinite(args.max_backoff)
            or not args.interval <= args.max_backoff <= 86400
            or not math.isfinite(args.jitter) or not 0 <= args.jitter < 1
            or not math.isfinite(args.timeout) or not 0 < args.timeout <= 120
            or (args.max_queries is not None and args.max_queries < 1)
        ):
            raise DiagnosticError(
                "Configuração inválida: intervalo positivo, intervalo ≤ backoff ≤ 86400, "
                "0 ≤ jitter < 1, 0 < timeout ≤ 120 e limite de consultas positivo.", 2,
            )
        endpoint = backend_endpoint(args.backend_url, args.allow_local_http)
        for signum in (signal.SIGINT, signal.SIGTERM):
            previous_handlers[signum] = signal.signal(signum, stop_polling)
        credential = load_credential(args.credential_file)
        processor = None
        if args.state_dir is not None:
            from command_journal import CommandJournal
            from command_processor import CommandProcessor

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


if __name__ == "__main__":
    sys.exit(main())
