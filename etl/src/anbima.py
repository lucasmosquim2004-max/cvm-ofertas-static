"""
anbima.py — Cliente para as APIs ANBIMA Feed (OAuth2 + Fundos v2).

Endpoints baseados na documentação típica do ANBIMA Feed. Caso sua
configuração use URLs diferentes, sobrescreva via .env:
  ANBIMA_OAUTH_URL
  ANBIMA_FUNDOS_BASE_URL
"""

from __future__ import annotations

import os
import time
from typing import Any

import requests
from dotenv import load_dotenv

from src.utils import log

load_dotenv()

ANBIMA_CLIENT_ID = os.getenv("ANBIMA_CLIENT_ID", "").strip()
ANBIMA_CLIENT_SECRET = os.getenv("ANBIMA_CLIENT_SECRET", "").strip()

ANBIMA_OAUTH_URL = os.getenv(
    "ANBIMA_OAUTH_URL",
    "https://api.anbima.com.br/oauth/access-token",
)
ANBIMA_FUNDOS_BASE_URL = os.getenv(
    "ANBIMA_FUNDOS_BASE_URL",
    "https://api.anbima.com.br/feed/fundos/v2",
)


class AnbimaError(RuntimeError):
    pass


class AnbimaClient:
    """Cliente HTTP autenticado para ANBIMA Feed."""

    def __init__(
        self,
        client_id: str | None = None,
        client_secret: str | None = None,
    ) -> None:
        self._cid = client_id or ANBIMA_CLIENT_ID
        self._csec = client_secret or ANBIMA_CLIENT_SECRET
        if not self._cid or not self._csec:
            raise AnbimaError(
                "Defina ANBIMA_CLIENT_ID e ANBIMA_CLIENT_SECRET no .env."
            )
        self._token: str | None = None
        self._token_exp: float = 0.0
        self._sess = requests.Session()

    # ------------------------------------------------------------------
    # OAuth2 client_credentials
    # ------------------------------------------------------------------

    def _refresh_token(self) -> str:
        log.debug("ANBIMA: solicitando novo access_token")
        r = self._sess.post(
            ANBIMA_OAUTH_URL,
            auth=(self._cid, self._csec),
            json={"grant_type": "client_credentials"},
            timeout=30,
        )
        # ANBIMA pode retornar 200 ou 201 com o token
        if r.status_code not in (200, 201):
            raise AnbimaError(
                f"OAuth2 falhou ({r.status_code}): {r.text[:200]}"
            )
        body = r.json()
        token = body.get("access_token")
        if not token:
            raise AnbimaError(f"Resposta sem access_token: {body}")
        # margem de 60s antes do expires_in
        self._token = token
        self._token_exp = time.time() + int(body.get("expires_in", 3600)) - 60
        return token

    def _token_valid(self) -> str:
        if not self._token or time.time() >= self._token_exp:
            return self._refresh_token()
        return self._token

    # ------------------------------------------------------------------
    # Fundos v2 — histórico de cotas/PL
    # ------------------------------------------------------------------

    def _auth_headers(self, token: str) -> dict[str, str]:
        # ANBIMA Feed usa headers custom: client_id + access_token,
        # não o padrão Authorization: Bearer.
        return {
            "client_id": self._cid,
            "access_token": token,
            "Accept": "application/json",
        }

    def get_fundo_historico(
        self,
        cnpj: str,
        data_inicial: str,
        data_final: str,
        max_retries: int = 3,
    ) -> list[dict[str, Any]] | None:
        """Retorna lista de pontos diários { data, valor_cota, patrimonio_liquido, num_cotistas }.

        cnpj: 14 dígitos (sem ponto/barra)
        data_inicial / data_final: formato YYYY-MM-DD

        Retorna None se a ANBIMA não tem cadastro do fundo (404).
        """
        token = self._token_valid()
        url = f"{ANBIMA_FUNDOS_BASE_URL}/fundos/{cnpj}/historico"
        params = {"data-inicial": data_inicial, "data-final": data_final}
        headers = self._auth_headers(token)

        for attempt in range(max_retries):
            try:
                r = self._sess.get(url, params=params, headers=headers, timeout=60)
            except requests.RequestException as exc:
                wait = 2 ** attempt
                log.warning("ANBIMA HTTP error (%s). Retry em %ds...", exc, wait)
                time.sleep(wait)
                continue

            if r.status_code == 401:
                # token expirado: refresh e tenta de novo
                log.info("ANBIMA 401: refresh do token")
                token = self._refresh_token()
                headers = self._auth_headers(token)
                continue

            if r.status_code == 404:
                return None

            if r.status_code == 429:
                wait = int(r.headers.get("Retry-After", 2 ** attempt))
                log.warning("ANBIMA rate limit. Aguardando %ds...", wait)
                time.sleep(wait)
                continue

            if r.status_code >= 500:
                wait = 2 ** attempt
                log.warning("ANBIMA %d. Retry em %ds", r.status_code, wait)
                time.sleep(wait)
                continue

            if r.status_code != 200:
                raise AnbimaError(
                    f"GET {url} retornou {r.status_code}: {r.text[:200]}"
                )

            return r.json()

        raise AnbimaError(f"Falha após {max_retries} tentativas: GET {url}")
