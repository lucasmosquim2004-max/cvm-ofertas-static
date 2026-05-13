"""
downloader.py — Baixa arquivos da CVM com cache local.

Arquivos já presentes em data/raw/ não são baixados novamente (a menos que
--force seja passado). Downloads são feitos em streaming para evitar pico
de memória com ZIPs grandes.
"""

import zipfile
from pathlib import Path

from tqdm import tqdm

from config import (
    OFERTA_DISTRIB_URL,
    OFERTA_META_URL,
    CAD_FI_URL,
    REGISTRO_FUNDO_CLASSE_URL,
    RAW_DIR,
    CHUNK_SIZE,
)
from src.utils import http_get_with_retry, log


def _download_file(url: str, dest: Path, force: bool = False, dry_run: bool = False) -> Path:
    """Baixa url → dest; pula se dest já existe e force=False."""
    if dest.exists() and not force:
        log.info("  Cache: %s já existe, pulando.", dest.name)
        return dest

    if dry_run:
        log.info("  [DRY-RUN] Baixaria %s → %s", url, dest.name)
        return dest

    log.info("  Baixando %s ...", url)
    resp = http_get_with_retry(url, stream=True)
    total = int(resp.headers.get("content-length", 0))

    with open(dest, "wb") as fh, tqdm(
        total=total or None,
        unit="B",
        unit_scale=True,
        unit_divisor=1024,
        desc=dest.name,
        leave=False,
    ) as bar:
        for chunk in resp.iter_content(chunk_size=CHUNK_SIZE):
            fh.write(chunk)
            bar.update(len(chunk))

    log.info("  Salvo: %s (%.1f MB)", dest.name, dest.stat().st_size / 1e6)
    return dest


def _extract_zip(zip_path: Path, dest_dir: Path) -> list[Path]:
    """Extrai ZIP; pula membros já existentes no destino."""
    extracted = []
    with zipfile.ZipFile(zip_path) as zf:
        members = zf.namelist()
        missing = [m for m in members if not (dest_dir / m).exists()]
        if missing:
            log.info("  Extraindo %d arquivo(s) de %s ...", len(missing), zip_path.name)
            zf.extractall(dest_dir)
        else:
            log.info("  %s já extraído.", zip_path.name)
        extracted = [dest_dir / m for m in members]
    return extracted


def download_ofertas(force: bool = False, dry_run: bool = False) -> Path:
    """Baixa oferta_distribuicao.zip e extrai o CSV."""
    log.info("=== Download Ofertas CVM ===")
    zip_dest = RAW_DIR / "oferta_distribuicao.zip"
    # Arquivo atualizado diariamente pela CVM — sempre re-baixar
    _download_file(OFERTA_DISTRIB_URL, zip_dest, force=True, dry_run=dry_run)

    if zip_dest.exists() and not dry_run:
        extracted = _extract_zip(zip_dest, RAW_DIR)
        csvs = [p for p in extracted if p.suffix.lower() == ".csv"]
        if csvs:
            log.info("  CSV extraído: %s", csvs[0].name)
            return csvs[0]

    # fallback: procura CSV já extraído
    candidates = list(RAW_DIR.glob("oferta_distribuicao*.csv"))
    return candidates[0] if candidates else RAW_DIR / "oferta_distribuicao.csv"


def download_meta(force: bool = False, dry_run: bool = False) -> None:
    """Baixa dicionário de metadados (referência manual)."""
    log.info("=== Download Meta-dicionário ===")
    _download_file(OFERTA_META_URL, RAW_DIR / "meta_oferta_distribuicao.zip", force=force, dry_run=dry_run)


def download_cadastro(force: bool = False, dry_run: bool = False) -> dict[str, Path]:
    """Baixa cad_fi.csv e registro_fundo_classe.zip (cadastro de fundos para enriquecimento)."""
    log.info("=== Download Cadastro de Fundos ===")
    paths: dict[str, Path] = {}

    paths["cad_fi"] = _download_file(CAD_FI_URL, RAW_DIR / "cad_fi.csv", force=force, dry_run=dry_run)

    zip_path = _download_file(
        REGISTRO_FUNDO_CLASSE_URL,
        RAW_DIR / "registro_fundo_classe.zip",
        force=force,
        dry_run=dry_run,
    )
    paths["registro_fundo_classe"] = zip_path

    if zip_path.exists() and not dry_run:
        _extract_zip(zip_path, RAW_DIR)

    return paths
