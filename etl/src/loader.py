"""
loader.py — Carrega CSVs da CVM para o DuckDB.

Tabelas criadas/substituídas:
  ofertas_raw   — oferta_distribuicao.csv completo (todos os tipos)
  cadastro_fi   — cad_fi.csv + registro_fundo_classe (união, RCVM 175 tem prioridade)
"""

import io
import zipfile
from pathlib import Path

import duckdb
import pandas as pd

from config import DB_PATH, RAW_DIR
from src.utils import log

# Colunas mínimas esperadas no CSV de ofertas (nomes CVM 2023+)
# Serão validadas em runtime; loader é tolerante a colunas extras.
_OFERTA_KEY_COLS = [
    "Codigo_CVM",
    "Data_Inicio_Oferta",
    "Tipo_Fundo_Investimento",
]


def _read_csv_tolerant(path: Path, sep: str = ";", prefer_utf8: bool = False) -> pd.DataFrame:
    """Lê CSV tentando a codificação mais provável primeiro."""
    encodings = ("utf-8", "latin-1") if prefer_utf8 else ("latin-1", "utf-8")
    for enc in encodings:
        try:
            df = pd.read_csv(path, sep=sep, dtype=str, encoding=enc, low_memory=False)
            log.info("  Lido %s (%d linhas, enc=%s)", path.name, len(df), enc)
            return df
        except UnicodeDecodeError:
            continue
    return pd.read_csv(path, sep=sep, dtype=str, encoding="utf-8", errors="replace", low_memory=False)


def _read_csv_from_zip(zip_path: Path, member: str | None = None) -> pd.DataFrame:
    """Extrai e lê CSV de dentro de um ZIP sem extrair para disco."""
    with zipfile.ZipFile(zip_path) as zf:
        names = zf.namelist()
        csv_names = [n for n in names if n.lower().endswith(".csv")]
        target = member or (csv_names[0] if csv_names else names[0])
        with zf.open(target) as f:
            raw = f.read()
    for enc in ("latin-1", "utf-8"):
        try:
            df = pd.read_csv(io.BytesIO(raw), sep=";", dtype=str, encoding=enc, low_memory=False)
            return df
        except UnicodeDecodeError:
            continue
    return pd.read_csv(io.BytesIO(raw), sep=";", dtype=str, encoding="utf-8", errors="replace", low_memory=False)


def _normalize_cnpj(series: pd.Series) -> pd.Series:
    """Remove ., -, / do CNPJ e garante string."""
    return series.astype(str).str.replace(r"[.\-/]", "", regex=True).str.strip()


def load_ofertas(con: duckdb.DuckDBPyConnection, dry_run: bool = False) -> None:
    """Carrega ambos os CSVs do ZIP de ofertas para o DuckDB.

    - oferta_distribuicao.csv  → tabela ofertas_raw   (legado, até 2022)
    - oferta_resolucao_160.csv → tabela ofertas_160   (Res 160, 2023+)
    """
    log.info("=== Load: ofertas (legado + Resolução 160) ===")
    zip_path = RAW_DIR / "oferta_distribuicao.zip"

    if not zip_path.exists():
        log.error("  oferta_distribuicao.zip não encontrado. Rode --download primeiro.")
        return

    _load_legacy(con, zip_path, dry_run)
    _load_resolucao_160(con, zip_path, dry_run)


def _load_legacy(con: duckdb.DuckDBPyConnection, zip_path: Path, dry_run: bool) -> None:
    """Carrega oferta_distribuicao.csv → ofertas_raw."""
    csv_candidates = list(RAW_DIR.glob("oferta_distribuicao.csv"))
    if csv_candidates:
        df = _read_csv_tolerant(csv_candidates[0])
    else:
        df = _read_csv_from_zip(zip_path, "oferta_distribuicao.csv")

    df.columns = [c.strip() for c in df.columns]
    cnpj_col = _first_matching_col(df, ["CNPJ_Emissor", "CNPJ_Fundo", "CNPJ"])
    df["cnpj_norm"] = _normalize_cnpj(df[cnpj_col]) if cnpj_col else pd.NA

    if dry_run:
        log.info("  [DRY-RUN] Carregaria %d linhas em ofertas_raw.", len(df))
        return

    con.execute("DROP TABLE IF EXISTS ofertas_raw")
    con.execute("CREATE TABLE ofertas_raw AS SELECT * FROM df")
    log.info("  ofertas_raw: %d linhas carregadas (legado).", len(df))


def _load_resolucao_160(con: duckdb.DuckDBPyConnection, zip_path: Path, dry_run: bool) -> None:
    """Carrega oferta_resolucao_160.csv → ofertas_160.

    Este arquivo (2023+) usa UTF-8; tentar utf-8 primeiro.
    """
    csv_candidates = list(RAW_DIR.glob("oferta_resolucao_160.csv"))
    if csv_candidates:
        df = _read_csv_tolerant(csv_candidates[0], prefer_utf8=True)
    else:
        df = _read_csv_from_zip(zip_path, "oferta_resolucao_160.csv")

    df.columns = [c.strip() for c in df.columns]
    cnpj_col = _first_matching_col(df, ["CNPJ_Emissor", "CNPJ"])
    df["cnpj_norm"] = _normalize_cnpj(df[cnpj_col]) if cnpj_col else pd.NA

    if dry_run:
        log.info("  [DRY-RUN] Carregaria %d linhas em ofertas_160.", len(df))
        return

    con.execute("DROP TABLE IF EXISTS ofertas_160")
    con.execute("CREATE TABLE ofertas_160 AS SELECT * FROM df")
    log.info("  ofertas_160: %d linhas carregadas (Resolução 160, 2023+).", len(df))


def load_cadastro(con: duckdb.DuckDBPyConnection, dry_run: bool = False) -> None:
    """Carrega cad_fi.csv + registro_fundo_classe → tabela cadastro_fi."""
    log.info("=== Load: cadastro_fi ===")

    frames = []

    # 1) Legacy: cad_fi.csv
    cad_fi_path = RAW_DIR / "cad_fi.csv"
    if cad_fi_path.exists():
        df_leg = _read_csv_tolerant(cad_fi_path)
        df_leg.columns = [c.strip() for c in df_leg.columns]
        cnpj_col = _first_matching_col(df_leg, ["CNPJ_FUNDO", "CNPJ_Fundo", "CNPJ"])
        nome_col = _first_matching_col(df_leg, ["DENOM_SOCIAL", "Denominacao_Social", "NOME_FUNDO"])
        gestor_col = _first_matching_col(df_leg, ["GESTOR", "Gestor", "NM_GESTOR"])

        df_leg["cnpj_norm"] = _normalize_cnpj(df_leg[cnpj_col]) if cnpj_col else pd.NA
        df_leg["nome_fundo"] = df_leg[nome_col] if nome_col else pd.NA
        df_leg["gestor"] = df_leg[gestor_col] if gestor_col else pd.NA
        df_leg["fonte"] = "legacy"
        frames.append(df_leg[["cnpj_norm", "nome_fundo", "gestor", "fonte"]])
        log.info("  cad_fi.csv: %d registros", len(df_leg))

    # 2) RCVM 175: registro_classe.csv (extraído do ZIP)
    rcvm_candidates = list(RAW_DIR.glob("registro_classe*.csv"))
    if not rcvm_candidates:
        rcvm_candidates = list(RAW_DIR.glob("registro_fundo_classe*.csv"))
    if rcvm_candidates:
        df_rcvm = _read_csv_tolerant(rcvm_candidates[0])
        df_rcvm.columns = [c.strip() for c in df_rcvm.columns]
        cnpj_col = _first_matching_col(df_rcvm, ["CNPJ_Classe", "CNPJ_FUNDO", "CNPJ"])
        nome_col = _first_matching_col(df_rcvm, ["Denominacao_Social", "DENOM_SOCIAL", "Nome"])
        gestor_col = _first_matching_col(df_rcvm, ["Gestor", "GESTOR", "NM_GESTOR"])

        df_rcvm["cnpj_norm"] = _normalize_cnpj(df_rcvm[cnpj_col]) if cnpj_col else pd.NA
        df_rcvm["nome_fundo"] = df_rcvm[nome_col] if nome_col else pd.NA
        df_rcvm["gestor"] = df_rcvm[gestor_col] if gestor_col else pd.NA
        df_rcvm["fonte"] = "rcvm175"
        frames.append(df_rcvm[["cnpj_norm", "nome_fundo", "gestor", "fonte"]])
        log.info("  registro_classe.csv: %d registros", len(df_rcvm))

    if not frames:
        log.warning("  Nenhum arquivo de cadastro encontrado. Enriquecimento desabilitado.")
        return

    # RCVM 175 tem prioridade; remover CNPJs duplicados mantendo rcvm175 primeiro
    df_cad = pd.concat(frames, ignore_index=True)
    df_cad = df_cad.sort_values("fonte", ascending=False)  # rcvm175 > legacy
    df_cad = df_cad.drop_duplicates(subset=["cnpj_norm"], keep="first")

    if dry_run:
        log.info("  [DRY-RUN] Carregaria %d registros em cadastro_fi.", len(df_cad))
        return

    con.execute("DROP TABLE IF EXISTS cadastro_fi")
    con.execute("CREATE TABLE cadastro_fi AS SELECT * FROM df_cad")
    log.info("  cadastro_fi: %d registros carregados.", len(df_cad))


def _first_matching_col(df: pd.DataFrame, candidates: list[str]) -> str | None:
    """Retorna o primeiro nome de coluna encontrado no DataFrame."""
    for c in candidates:
        if c in df.columns:
            return c
    return None


def get_connection(read_only: bool = False) -> duckdb.DuckDBPyConnection:
    """Abre (ou cria) a conexão com o DuckDB."""
    return duckdb.connect(str(DB_PATH), read_only=read_only)


def inspect_columns(dry_run: bool = False) -> None:
    """Imprime o esquema real do CSV de ofertas para debug."""
    log.info("=== Inspeção de Colunas ===")
    csv_candidates = list(RAW_DIR.glob("oferta_distribuicao*.csv"))
    zip_path = RAW_DIR / "oferta_distribuicao.zip"

    if csv_candidates:
        df = _read_csv_tolerant(csv_candidates[0])
    elif zip_path.exists():
        df = _read_csv_from_zip(zip_path)
    else:
        log.error("  Arquivo não encontrado. Rode --download primeiro.")
        return

    df.columns = [c.strip() for c in df.columns]
    print(f"\nTotal de linhas: {len(df)}")
    print(f"Total de colunas: {len(df.columns)}")
    print("\nColunas detectadas:")
    for i, col in enumerate(df.columns, 1):
        sample = df[col].dropna().head(3).tolist()
        print(f"  {i:3d}. {col:<45} ex: {sample}")

    # Tenta detectar coluna de tipo de fundo
    tipo_col = _first_matching_col(df, ["Tipo_Fundo_Investimento", "Tipo_Ativo", "Tipo_Valor_Mobiliario"])
    if tipo_col:
        print(f"\nValores únicos em '{tipo_col}':")
        for v in sorted(df[tipo_col].dropna().unique()):
            print(f"  {v}")
