"""
enricher.py — Cria VIEW unificada das ofertas CVM (legado + Resolução 160).

Fontes:
  ofertas_raw  — oferta_distribuicao.csv (legado, até 2022)
                 Colunas-chave: Tipo_Fundo_Investimento, Data_Inicio_Oferta,
                 Data_Encerramento_Oferta, Valor_Total, Nome_Lider, Rito_Oferta
  ofertas_160  — oferta_resolucao_160.csv (Resolução CVM 160, 2023+)
                 Colunas-chave: Valor_Mobiliario, Data_requerimento,
                 Data_Encerramento, Valor_Total_Registrado, Nome_Lider,
                 Gestor (direto!), Publico_alvo (direto!)
"""

import duckdb
import pandas as pd

from config import TIPOS_FUNDO_PREFIXOS
from src.utils import log


def create_views(con: duckdb.DuckDBPyConnection) -> None:
    """Cria (ou substitui) a VIEW ofertas_fundos (UNION legado + Res 160)."""
    log.info("=== Criando VIEWs ===")

    tipo_like_legacy = " OR ".join(
        f"o.Tipo_Fundo_Investimento LIKE '{p}%'" for p in TIPOS_FUNDO_PREFIXOS
    )
    # Para Res 160: filtra por prefixo de Valor_Mobiliario
    tipo_like_160 = " OR ".join(
        f"o.Valor_Mobiliario LIKE 'Cotas de {p}%'" for p in TIPOS_FUNDO_PREFIXOS
    )

    con.execute("DROP VIEW IF EXISTS ofertas_fundos")
    con.execute(f"""
        CREATE VIEW ofertas_fundos AS

        -- === LEGADO (até 2022) ===
        SELECT
            o.Numero_Registro_Oferta                            AS codigo_cvm,
            o.Numero_Processo                                   AS numero_processo,
            o.cnpj_norm                                         AS cnpj_emissor,
            COALESCE(c.nome_fundo, o.Nome_Emissor)              AS emissor_nome,
            CASE
                WHEN INSTR(o.Tipo_Fundo_Investimento, ' - ') > 0
                THEN LEFT(o.Tipo_Fundo_Investimento,
                          INSTR(o.Tipo_Fundo_Investimento, ' - ') - 1)
                ELSE o.Tipo_Fundo_Investimento
            END                                                 AS tipo_fundo,
            o.Tipo_Ativo                                        AS tipo_ativo,
            NULL                                                AS tipo_lastro,
            o.Rito_Oferta                                       AS rito,
            o.Modalidade_Oferta                                 AS modalidade,
            TRY_CAST(o.Data_Inicio_Oferta AS DATE)              AS data_inicio,
            TRY_CAST(o.Data_Encerramento_Oferta AS DATE)        AS data_encerramento,
            CASE
                WHEN o.Data_Encerramento_Oferta IS NULL
                  OR TRY_CAST(o.Data_Encerramento_Oferta AS DATE) > CURRENT_DATE
                THEN 'Ativa'
                ELSE 'Encerrada'
            END                                                 AS status,
            TRY_CAST(o.Valor_Total AS DOUBLE)                   AS volume,
            o.Nome_Lider                                        AS coordenador,
            c.gestor                                            AS gestor,
            NULL                                                AS publico_alvo,
            'legado'                                            AS fonte
        FROM ofertas_raw o
        LEFT JOIN cadastro_fi c ON o.cnpj_norm = c.cnpj_norm
        WHERE {tipo_like_legacy}

        UNION ALL

        -- === RESOLUÇÃO CVM 160 (2023+) ===
        SELECT
            o.Numero_Processo                                   AS codigo_cvm,
            o.Numero_Processo                                   AS numero_processo,
            o.cnpj_norm                                         AS cnpj_emissor,
            COALESCE(c.nome_fundo, o.Nome_Emissor)              AS emissor_nome,
            -- FIDC NP: usa flag dedicada; demais: extrai sigla de Valor_Mobiliario
            CASE
                WHEN o.FIDC_nao_padronizado = 'S' THEN 'FIDC NP'
                ELSE REGEXP_REPLACE(o.Valor_Mobiliario, '^Cotas de ', '')
            END                                                 AS tipo_fundo,
            o.Valor_Mobiliario                                  AS tipo_ativo,
            o.Tipo_lastro                                       AS tipo_lastro,
            o.Rito_Requerimento                                 AS rito,
            o.Tipo_requerimento                                 AS modalidade,
            TRY_CAST(o.Data_requerimento AS DATE)               AS data_inicio,
            TRY_CAST(o.Data_Encerramento AS DATE)               AS data_encerramento,
            CASE
                WHEN o.Status_Requerimento = 'Registro Concedido'
                  OR o.Status_Requerimento = 'Aguardando Bookbuilding'
                THEN 'Ativa'
                ELSE 'Encerrada'
            END                                                 AS status,
            TRY_CAST(o.Valor_Total_Registrado AS DOUBLE)        AS volume,
            o.Nome_Lider                                        AS coordenador,
            COALESCE(o.Gestor, c.gestor)                        AS gestor,
            o.Publico_alvo                                      AS publico_alvo,
            'resolucao_160'                                     AS fonte
        FROM ofertas_160 o
        LEFT JOIN cadastro_fi c ON o.cnpj_norm = c.cnpj_norm
        WHERE {tipo_like_160}
    """)

    n = con.execute("SELECT COUNT(*) FROM ofertas_fundos").fetchone()[0]
    log.info("  ofertas_fundos: %d ofertas totais (FIDC/FII/FIP)", n)

    dist = con.execute("""
        SELECT tipo_fundo, fonte, COUNT(*) AS n
        FROM ofertas_fundos
        GROUP BY 1, 2
        ORDER BY 3 DESC
    """).fetchall()
    for tipo, fonte, cnt in dist:
        log.info("    %-15s %-15s %d", tipo, fonte, cnt)


def create_securitizacao_view(con: duckdb.DuckDBPyConnection) -> None:
    """Cria VIEW ofertas_mercado_capitais: FIDC/FII/FIP (legado + Res160) + Debêntures (Res160 only).

    Debêntures NÃO existem no CSV legado (oferta_distribuicao.csv).
    Aparecem apenas em oferta_resolucao_160.csv a partir de 2023.
    FIDC/FII/FIP vêm da view ofertas_fundos (já unifica legado + Res160).
    """
    log.info("=== Criando VIEW ofertas_mercado_capitais ===")

    tabelas = {
        r[0]
        for r in con.execute(
            "SELECT table_name FROM information_schema.tables WHERE table_type = 'BASE TABLE'"
        ).fetchall()
    }
    views = {
        r[0]
        for r in con.execute(
            "SELECT table_name FROM information_schema.views"
        ).fetchall()
    }

    partes = []

    # FIDC, FII, FIP — fonte: view ofertas_fundos (já unifica legado + Res160)
    if "ofertas_fundos" in views:
        partes.append("""
            SELECT
                numero_processo,
                cnpj_emissor,
                emissor_nome,
                CASE
                    WHEN tipo_fundo IN ('FIDC', 'FIDC NP', 'FICFIDC') THEN 'FIDC'
                    WHEN tipo_fundo = 'FII'                            THEN 'FII'
                    WHEN tipo_fundo IN ('FIP', 'FICFIP')               THEN 'FIP'
                    ELSE tipo_fundo
                END                 AS tipo_ativo,
                rito,
                data_inicio,
                data_encerramento,
                status,
                volume,
                coordenador,
                fonte
            FROM ofertas_fundos
        """)

    # Debêntures — SOMENTE Resolução 160 (não existem no legado)
    if "ofertas_160" in tabelas:
        partes.append("""
            SELECT
                o.Numero_Processo                                   AS numero_processo,
                o.cnpj_norm                                         AS cnpj_emissor,
                o.Nome_Emissor                                      AS emissor_nome,
                'Debêntures'                                        AS tipo_ativo,
                o.Rito_Requerimento                                 AS rito,
                TRY_CAST(o.Data_requerimento AS DATE)               AS data_inicio,
                TRY_CAST(o.Data_Encerramento AS DATE)               AS data_encerramento,
                CASE
                    WHEN o.Status_Requerimento IN ('Registro Concedido', 'Aguardando Bookbuilding')
                    THEN 'Ativa'
                    ELSE 'Encerrada'
                END                                                 AS status,
                TRY_CAST(o.Valor_Total_Registrado AS DOUBLE)        AS volume,
                o.Nome_Lider                                        AS coordenador,
                'resolucao_160'                                     AS fonte
            FROM ofertas_160 o
            WHERE o.Valor_Mobiliario IN ('Debêntures', 'Debêntures Conversíveis')
        """)

    if not partes:
        log.warning("  Nenhuma fonte encontrada. Rode --load e --enrich (FIDC/FII/FIP) primeiro.")
        return

    con.execute("DROP VIEW IF EXISTS ofertas_mercado_capitais")
    con.execute(
        "CREATE VIEW ofertas_mercado_capitais AS "
        + " UNION ALL ".join(partes)
    )

    n = con.execute("SELECT COUNT(*) FROM ofertas_mercado_capitais").fetchone()[0]
    log.info("  ofertas_mercado_capitais: %d ofertas (FIDC/FII/FIP/Debêntures)", n)

    dist = con.execute("""
        SELECT tipo_ativo, COUNT(*) AS n, COALESCE(SUM(volume), 0) AS vol,
               MIN(YEAR(data_inicio)) AS ano_min, MAX(YEAR(data_inicio)) AS ano_max
        FROM ofertas_mercado_capitais
        WHERE data_inicio IS NOT NULL
        GROUP BY tipo_ativo
        ORDER BY n DESC
    """).fetchall()
    for tipo, cnt, vol, ano_min, ano_max in dist:
        log.info(
            "    %-15s %5d ofertas  R$ %.1f bi  (%s–%s)",
            tipo, cnt, (vol or 0) / 1e9, ano_min, ano_max,
        )


def _map_titulo_anbima(titulo) -> str | None:
    """Mapeia título do boletim ANBIMA para tipo_ativo padronizado."""
    if not isinstance(titulo, str):
        return None
    t = titulo.strip()
    if t == "FIDC":
        return "FIDC"
    if t == "FII":
        return "FII"
    if "Deb" in t:  # Debêntures / Debêntures Conversíveis
        return "Debêntures"
    return None


def load_anbima_boletim(con: duckdb.DuckDBPyConnection, excel_path: str) -> None:
    """Lê o Boletim ANBIMA (aba '02-02-Vlr') e cria tabela anbima_vol_encerrado.

    Estrutura da aba '02-02-Vlr':
      Header na linha 10 (0-indexed). Colunas usadas:
        Col 1  = Data  (formato "Jan/20")
        Col 3  = Debêntures  (valor em R$)
        Col 11 = FIDC        (valor em R$)
        Col 15 = FII         (valor em R$)
      Linhas separadoras de ano (ex: "2020") são filtradas.

    Tabelas criadas:
      anbima_vol_encerrado  — agregado anual por tipo_ativo
      anbima_meta           — data_base (último mês disponível, ex: "Mar/26")
    """
    import re

    log.info("=== Carregando Boletim ANBIMA: %s ===", excel_path)

    xl = pd.ExcelFile(excel_path, engine="openpyxl")

    # Aba consolidada de valores encerrados por mês
    sheet = next((s for s in xl.sheet_names if "02-02" in s and "Vlr" in s), None)
    if not sheet:
        # Fallback: qualquer aba com "Vlr" no nome dentro de mercado de capitais
        sheet = next((s for s in xl.sheet_names if "Vlr" in s), None)
    if not sheet:
        log.warning("  Aba '02-02-Vlr' não encontrada. Abas disponíveis: %s", xl.sheet_names[:10])
        return

    log.info("  Lendo aba: %s", sheet)

    # Header na linha 10 (0-indexed = 11ª linha do Excel)
    df_raw = pd.read_excel(xl, sheet_name=sheet, header=10, engine="openpyxl")

    # Selecionar colunas por posição: 1=Data, 3=Debentures, 11=FIDC, 15=FII
    cols = df_raw.columns.tolist()
    if len(cols) < 16:
        log.warning("  Número de colunas insuficiente (%d). Abortando.", len(cols))
        return

    df = df_raw.iloc[:, [1, 3, 11, 15]].copy()
    df.columns = ["data", "debentures", "fidc", "fii"]

    # Manter apenas linhas com data no formato "Mmm/AA" (ex: "Jan/20")
    mask = df["data"].astype(str).str.match(r"^[A-Za-záéíóúÁÉÍÓÚ]{3}/\d{2}$")
    df = df[mask].copy()

    if df.empty:
        log.warning("  Nenhuma linha de dados encontrada após filtro de datas.")
        return

    # Converter "Jan/20" → datetime
    meses_pt = {
        "Jan": "Jan", "Fev": "Feb", "Mar": "Mar", "Abr": "Apr",
        "Mai": "May", "Jun": "Jun", "Jul": "Jul", "Ago": "Aug",
        "Set": "Sep", "Out": "Oct", "Nov": "Nov", "Dez": "Dec",
    }

    def parse_mes_ano(s: str) -> pd.Timestamp | None:
        try:
            mes_pt, ano_2d = s.split("/")
            mes_en = meses_pt.get(mes_pt[:3], mes_pt[:3])
            return pd.to_datetime(f"{mes_en}/20{ano_2d}", format="%b/%Y")
        except Exception:
            return None

    df["dt"] = df["data"].map(parse_mes_ano)
    df = df.dropna(subset=["dt"])
    df["ano"] = df["dt"].dt.year

    # Data base = último mês disponível
    data_base_str = df["data"].iloc[-1] if not df.empty else None
    log.info("  Período: %s a %s  (%d meses)", df["data"].iloc[0], df["data"].iloc[-1], len(df))

    # Converter volumes para numérico
    for col in ["debentures", "fidc", "fii"]:
        df[col] = pd.to_numeric(df[col], errors="coerce")

    # Agregar por ano
    agg = df.groupby("ano").agg(
        debentures=("debentures", "sum"),
        fidc=("fidc", "sum"),
        fii=("fii", "sum"),
    ).reset_index()

    # Montar tabela longa: tipo_ativo, ano, vol_encerrado
    rows_list = []
    for _, row in agg.iterrows():
        ano = int(row["ano"])
        for tipo, col in [("Debêntures", "debentures"), ("FIDC", "fidc"), ("FII", "fii")]:
            vol = row[col]
            if pd.notna(vol) and vol > 0:
                rows_list.append((tipo, ano, vol))

    con.execute("DROP TABLE IF EXISTS anbima_vol_encerrado")
    con.execute("""
        CREATE TABLE anbima_vol_encerrado (
            tipo_ativo    VARCHAR,
            ano           INTEGER,
            n_encerradas  INTEGER,
            vol_encerrado DOUBLE
        )
    """)
    # n_encerradas não está disponível na aba 02-02-Vlr (dados agregados, sem contagem de operações)
    con.executemany(
        "INSERT INTO anbima_vol_encerrado VALUES (?, ?, 0, ?)",
        rows_list,
    )

    # Tabela de metadados: data base
    con.execute("DROP TABLE IF EXISTS anbima_meta")
    con.execute("""
        CREATE TABLE anbima_meta (
            chave  VARCHAR PRIMARY KEY,
            valor  VARCHAR
        )
    """)
    if data_base_str:
        con.execute("INSERT INTO anbima_meta VALUES ('data_base', ?)", [str(data_base_str)])

    n = con.execute("SELECT COUNT(*) FROM anbima_vol_encerrado").fetchone()[0]
    log.info("  anbima_vol_encerrado: %d linhas", n)
    log.info("  anbima_meta.data_base: %s", data_base_str)

    dist = con.execute("""
        SELECT tipo_ativo, ano, vol_encerrado / 1e9 AS vol_bi
        FROM anbima_vol_encerrado ORDER BY tipo_ativo, ano
    """).fetchall()
    for tipo, ano, vol_bi in dist:
        log.info("    %-15s %d  R$ %.1f bi", tipo, ano, vol_bi)
