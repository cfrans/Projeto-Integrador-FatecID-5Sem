import random
import sys
import time
from typing import Any

from .backend import fetch_associations, network_deadline
from .errors import DiagnosticError


def stop_polling(signum, frame):
    raise KeyboardInterrupt


def query_associations(
    endpoint: str, credential: str, timeout: float, ca_file: str | None = None
) -> list[dict[str, Any]]:
    with network_deadline(timeout):
        return fetch_associations(endpoint, credential, timeout, ca_file)


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
