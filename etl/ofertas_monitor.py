"""
ofertas_monitor.py — CLI para o monitor de ofertas CVM 160.

Uso:
  python ofertas_monitor.py                              # pipeline completo
  python ofertas_monitor.py --download                   # apenas download
  python ofertas_monitor.py --load                       # apenas carga no DuckDB
  python ofertas_monitor.py --enrich                     # apenas cria VIEWs
  python ofertas_monitor.py --load-anbima <arquivo.xlsx> # carrega Boletim ANBIMA
  python ofertas_monitor.py --inspect                    # mostra colunas do CSV
  python ofertas_monitor.py --dry-run                    # simula sem gravar
"""

import argparse
import sys

from src.utils import log
from src.downloader import download_ofertas, download_cadastro, download_meta
from src.loader import load_ofertas, load_cadastro, get_connection, inspect_columns
from src.enricher import create_views, create_securitizacao_view, load_anbima_boletim


def cmd_inspect(args: argparse.Namespace) -> None:
    """Baixa (se necessário) e inspeciona o esquema do CSV de ofertas."""
    download_ofertas(force=False, dry_run=False)
    inspect_columns()


def cmd_download(args: argparse.Namespace) -> None:
    download_ofertas(force=args.force, dry_run=args.dry_run)
    download_cadastro(force=args.force, dry_run=args.dry_run)
    if args.meta:
        download_meta(force=args.force, dry_run=args.dry_run)


def cmd_load(args: argparse.Namespace) -> None:
    if args.dry_run:
        log.info("=== DRY-RUN: simulando carga ===")
    con = get_connection()
    load_ofertas(con, dry_run=args.dry_run)
    load_cadastro(con, dry_run=args.dry_run)
    con.close()


def cmd_enrich(args: argparse.Namespace) -> None:
    con = get_connection()
    create_views(con)
    create_securitizacao_view(con)
    con.close()


def cmd_load_anbima(args: argparse.Namespace) -> None:
    con = get_connection()
    load_anbima_boletim(con, args.load_anbima)
    con.close()


def cmd_full(args: argparse.Namespace) -> None:
    cmd_download(args)
    cmd_load(args)
    cmd_enrich(args)
    log.info("=== Pipeline concluído. DuckDB pronto em data/ofertas.duckdb ===")


def main() -> None:
    parser = argparse.ArgumentParser(
        description="Monitor de Ofertas CVM 160 — FIDC / FII / FIP",
        formatter_class=argparse.RawDescriptionHelpFormatter,
    )
    parser.add_argument("--download", action="store_true", help="Apenas baixar arquivos")
    parser.add_argument("--load", action="store_true", help="Apenas carregar no DuckDB")
    parser.add_argument("--enrich", action="store_true", help="Apenas criar VIEWs enriquecidas")
    parser.add_argument("--load-anbima", metavar="ARQUIVO.xlsx",
                        help="Carrega Boletim ANBIMA (aba Anexo - Doméstico) no DuckDB")
    parser.add_argument("--inspect", action="store_true", help="Inspecionar colunas do CSV")
    parser.add_argument("--force", action="store_true", help="Forçar re-download mesmo com cache")
    parser.add_argument("--meta", action="store_true", help="Baixar dicionário de metadados")
    parser.add_argument("--dry-run", action="store_true", help="Simular sem gravar")

    args = parser.parse_args()

    if args.inspect:
        cmd_inspect(args)
    elif args.download:
        cmd_download(args)
    elif args.load:
        cmd_load(args)
    elif args.enrich:
        cmd_enrich(args)
    elif args.load_anbima:
        cmd_load_anbima(args)
    else:
        # Pipeline completo (default)
        cmd_full(args)


if __name__ == "__main__":
    main()
