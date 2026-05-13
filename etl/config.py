"""
config.py — Constantes, URLs e caminhos para o monitor de ofertas CVM 160.
"""

import os
from pathlib import Path

from dotenv import load_dotenv

load_dotenv()

# ---------------------------------------------------------------------------
# Caminhos
# ---------------------------------------------------------------------------

BASE_DIR = Path(os.getenv("DATA_DIR", Path(__file__).parent / "data"))
RAW_DIR = BASE_DIR / "raw"
DB_PATH = BASE_DIR / "ofertas.duckdb"

for _d in (RAW_DIR,):
    _d.mkdir(parents=True, exist_ok=True)

# ---------------------------------------------------------------------------
# Logging
# ---------------------------------------------------------------------------

LOG_LEVEL = os.getenv("LOG_LEVEL", "INFO")

# ---------------------------------------------------------------------------
# URLs CVM
# ---------------------------------------------------------------------------

CVM_OFERTA_BASE = "https://dados.cvm.gov.br/dados/OFERTA/DISTRIB"
CVM_FI_BASE = "https://dados.cvm.gov.br/dados/FI"

OFERTA_DISTRIB_URL = f"{CVM_OFERTA_BASE}/DADOS/oferta_distribuicao.zip"
OFERTA_META_URL = f"{CVM_OFERTA_BASE}/META/meta_oferta_distribuicao.zip"

CAD_FI_URL = f"{CVM_FI_BASE}/CAD/DADOS/cad_fi.csv"
REGISTRO_FUNDO_CLASSE_URL = f"{CVM_FI_BASE}/CAD/DADOS/registro_fundo_classe.zip"

# ---------------------------------------------------------------------------
# Filtros de tipo de fundo
# ---------------------------------------------------------------------------

# Prefixos do campo Tipo_Fundo_Investimento (ex: "FIDC - Fundo de Investimento em...")
# Usados com LIKE no SQL: WHERE Tipo_Fundo_Investimento LIKE 'FIDC%' OR ...
TIPOS_FUNDO_PREFIXOS = ("FIDC", "FII", "FIP", "FICFIDC", "FICFIP")

# ---------------------------------------------------------------------------
# HTTP
# ---------------------------------------------------------------------------

HTTP_TIMEOUT = 60
HTTP_MAX_RETRIES = 5
HTTP_BACKOFF_BASE = 2.0
CHUNK_SIZE = 1024 * 256  # 256 KB
