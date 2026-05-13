"""
utils.py — Logging e retry HTTP (adaptado de credit-monitor/src/utils.py).
"""

import logging
import time

import requests

from config import LOG_LEVEL, HTTP_TIMEOUT, HTTP_MAX_RETRIES, HTTP_BACKOFF_BASE


def setup_logging(level: str | None = None) -> logging.Logger:
    log_level = getattr(logging, (level or LOG_LEVEL).upper(), logging.INFO)
    logging.basicConfig(
        level=log_level,
        format="%(asctime)s [%(levelname)s] %(message)s",
        datefmt="%H:%M:%S",
    )
    return logging.getLogger("cvm_ofertas")


log = setup_logging()

_session = requests.Session()


def http_get_with_retry(url: str, stream: bool = False, **kwargs) -> requests.Response:
    """GET com retry exponencial (até HTTP_MAX_RETRIES tentativas)."""
    kwargs.setdefault("timeout", HTTP_TIMEOUT)
    last_exc: Exception | None = None

    for attempt in range(HTTP_MAX_RETRIES):
        try:
            resp = _session.get(url, stream=stream, **kwargs)
            if resp.status_code == 429:
                wait = int(resp.headers.get("Retry-After", HTTP_BACKOFF_BASE ** attempt)) + 1
                log.warning("Rate limit (429). Aguardando %ds...", wait)
                time.sleep(wait)
                continue
            resp.raise_for_status()
            return resp
        except requests.RequestException as exc:
            last_exc = exc
            wait = HTTP_BACKOFF_BASE ** attempt
            log.warning("Erro HTTP em %s: %s. Retry em %.1fs...", url, exc, wait)
            time.sleep(wait)

    raise RuntimeError(f"Falha após {HTTP_MAX_RETRIES} tentativas: GET {url}") from last_exc
