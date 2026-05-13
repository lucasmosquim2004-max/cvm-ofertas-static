"""
export_json.py — Exporta dados do DuckDB para arquivos JSON estáticos.

Uso:
    python export_json.py [--out DIR]

Por padrão salva em ../cvm-ofertas-static/public/data/
"""

import argparse
import datetime
import decimal
import json
import os
import pathlib

import duckdb

DB_PATH = pathlib.Path(__file__).parent / "data" / "ofertas.duckdb"

# ---------------------------------------------------------------------------
# Helpers de serialização
# ---------------------------------------------------------------------------

def _default(obj):
    """Serializa tipos que json.dumps não conhece."""
    if isinstance(obj, (datetime.date, datetime.datetime)):
        return obj.isoformat()
    if isinstance(obj, decimal.Decimal):
        return float(obj)
    raise TypeError(f"Object of type {type(obj)} is not JSON serializable")


def save(path: pathlib.Path, data):
    path.parent.mkdir(parents=True, exist_ok=True)
    with open(path, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=2, default=_default)
    print(f"  Salvo: {path.name} ({path.stat().st_size // 1024} KB)")


# ---------------------------------------------------------------------------
# SQL helpers
# ---------------------------------------------------------------------------

TIPO_NORM = """
  CASE
    WHEN tipo_fundo IN ('FIDC', 'FIDC NP', 'FICFIDC') THEN 'Cotas de FIDC'
    WHEN tipo_fundo = 'FII'                            THEN 'Cotas de FII'
    WHEN tipo_fundo IN ('FIP', 'FICFIP')               THEN 'Cotas de FIP'
    ELSE tipo_fundo
  END
"""

TIPO_NORM_OF = """
  CASE
    WHEN of.tipo_fundo IN ('FIDC', 'FIDC NP', 'FICFIDC') THEN 'Cotas de FIDC'
    WHEN of.tipo_fundo = 'FII'                            THEN 'Cotas de FII'
    WHEN of.tipo_fundo IN ('FIP', 'FICFIP')               THEN 'Cotas de FIP'
    ELSE of.tipo_fundo
  END
"""

TIPO_NORM_BARE = """
  CASE
    WHEN tipo_fundo IN ('FIDC', 'FIDC NP', 'FICFIDC') THEN 'Cotas de FIDC'
    WHEN tipo_fundo = 'FII'                            THEN 'Cotas de FII'
    WHEN tipo_fundo IN ('FIP', 'FICFIP')               THEN 'Cotas de FIP'
    ELSE tipo_fundo
  END
"""


def rows_to_dicts(rel):
    """Converte resultado DuckDB para lista de dicts."""
    cols = [d[0] for d in rel.description]
    return [dict(zip(cols, row)) for row in rel.fetchall()]


# ---------------------------------------------------------------------------
# summary.json
# ---------------------------------------------------------------------------

def export_summary(con, out_dir: pathlib.Path):
    print("Exportando summary.json...")

    kpi = con.execute("""
        SELECT
            COUNT(*) FILTER (WHERE data_inicio >= CURRENT_DATE - 30)                         AS novas_30d,
            COALESCE(SUM(volume) FILTER (WHERE data_inicio >= CURRENT_DATE - 30), 0)         AS volume_30d,
            COUNT(*) FILTER (WHERE data_inicio >= CURRENT_DATE - 365 AND status = 'Ativa')   AS ativas_12m,
            COUNT(*) FILTER (WHERE YEAR(data_inicio) = YEAR(CURRENT_DATE))                   AS total_ano
        FROM ofertas_fundos
    """).fetchone()

    por_tipo = rows_to_dicts(con.execute("""
        SELECT tipo_fundo, COUNT(*) AS n, COALESCE(SUM(volume), 0) AS volume
        FROM ofertas_fundos
        WHERE data_inicio >= CURRENT_DATE - 365
        GROUP BY tipo_fundo
        ORDER BY n DESC
    """))

    por_mes = rows_to_dicts(con.execute("""
        SELECT
            STRFTIME(data_inicio, '%Y-%m') AS mes,
            COUNT(*)                       AS n,
            COALESCE(SUM(volume), 0)       AS volume
        FROM ofertas_fundos
        WHERE data_inicio >= CURRENT_DATE - 365
            AND data_inicio IS NOT NULL
        GROUP BY mes
        ORDER BY mes
    """))

    # Volume por tipo de ativo (60d) — da tabela ofertas_160
    try:
        por_tipo_60d = rows_to_dicts(con.execute("""
            SELECT
                o.Valor_Mobiliario                                              AS tipo_ativo,
                COALESCE(SUM(TRY_CAST(o.Valor_Total_Registrado AS DOUBLE)), 0) AS volume,
                COUNT(*)                                                        AS n
            FROM ofertas_160 o
            WHERE TRY_CAST(o.Data_requerimento AS DATE) >= CURRENT_DATE - 60
                AND o.Valor_Mobiliario IS NOT NULL
            GROUP BY tipo_ativo
            ORDER BY volume DESC
            LIMIT 10
        """))
    except Exception:
        por_tipo_60d = []

    # Status das ofertas (12m) — da tabela ofertas_160
    try:
        por_status_12m = rows_to_dicts(con.execute("""
            SELECT
                o.Status_Requerimento AS status_cvm,
                COUNT(*)              AS n
            FROM ofertas_160 o
            WHERE TRY_CAST(o.Data_requerimento AS DATE) >= CURRENT_DATE - 365
                AND o.Status_Requerimento IS NOT NULL
            GROUP BY status_cvm
            ORDER BY n DESC
        """))
    except Exception:
        por_status_12m = []

    top_emissores = rows_to_dicts(con.execute("""
        SELECT
            emissor_nome,
            COALESCE(SUM(volume), 0) AS volume,
            COUNT(*)                 AS n
        FROM ofertas_fundos
        WHERE data_inicio >= CURRENT_DATE - 365
            AND emissor_nome IS NOT NULL
        GROUP BY emissor_nome
        ORDER BY volume DESC
        LIMIT 10
    """))

    top_coordenadores = rows_to_dicts(con.execute("""
        SELECT
            coordenador,
            COALESCE(SUM(volume), 0) AS volume,
            COUNT(*)                 AS n
        FROM ofertas_fundos
        WHERE data_inicio >= CURRENT_DATE - 365
            AND coordenador IS NOT NULL
        GROUP BY coordenador
        ORDER BY volume DESC
        LIMIT 10
    """))

    data = {
        "novas_30d": int(kpi[0]),
        "volume_30d": float(kpi[1]),
        "ativas_12m": int(kpi[2]),
        "total_ano": int(kpi[3]),
        "por_tipo": [
            {"tipo_fundo": str(r["tipo_fundo"] or ""), "n": int(r["n"]), "volume": float(r["volume"])}
            for r in por_tipo
        ],
        "por_mes": [
            {"mes": str(r["mes"] or ""), "n": int(r["n"]), "volume": float(r["volume"])}
            for r in por_mes
        ],
        "por_tipo_60d": [
            {"tipo_ativo": str(r["tipo_ativo"] or ""), "volume": float(r["volume"]), "n": int(r["n"])}
            for r in por_tipo_60d
        ],
        "por_status_12m": [
            {"status_cvm": str(r["status_cvm"] or ""), "n": int(r["n"])}
            for r in por_status_12m
        ],
        "top_emissores": [
            {"emissor_nome": str(r["emissor_nome"] or ""), "volume": float(r["volume"]), "n": int(r["n"])}
            for r in top_emissores
        ],
        "top_coordenadores": [
            {"coordenador": str(r["coordenador"] or ""), "volume": float(r["volume"]), "n": int(r["n"])}
            for r in top_coordenadores
        ],
    }
    save(out_dir / "summary.json", data)


# ---------------------------------------------------------------------------
# ofertas.json
# ---------------------------------------------------------------------------

def export_ofertas(con, out_dir: pathlib.Path):
    print("Exportando ofertas.json...")
    rows = rows_to_dicts(con.execute("""
        SELECT
            codigo_cvm,
            numero_processo,
            cnpj_emissor,
            emissor_nome,
            tipo_fundo,
            COALESCE(tipo_ativo, tipo_fundo)  AS tipo_ativo,
            tipo_lastro,
            rito,
            modalidade,
            CAST(data_inicio AS VARCHAR)       AS data_inicio,
            CAST(data_encerramento AS VARCHAR) AS data_encerramento,
            status,
            volume,
            coordenador,
            gestor,
            publico_alvo,
            fonte
        FROM ofertas_fundos
        WHERE data_inicio IS NOT NULL
        ORDER BY data_inicio DESC
        LIMIT 5000
    """))
    # Normalizar tipos
    cleaned = []
    for r in rows:
        cleaned.append({
            "codigo_cvm": r.get("codigo_cvm"),
            "numero_processo": r.get("numero_processo"),
            "cnpj_emissor": r.get("cnpj_emissor"),
            "emissor_nome": r.get("emissor_nome"),
            "tipo_fundo": r.get("tipo_fundo"),
            "tipo_ativo": r.get("tipo_ativo"),
            "tipo_lastro": r.get("tipo_lastro"),
            "rito": r.get("rito"),
            "modalidade": r.get("modalidade"),
            "data_inicio": r.get("data_inicio"),
            "data_encerramento": r.get("data_encerramento"),
            "status": str(r.get("status") or ""),
            "volume": float(r["volume"]) if r.get("volume") is not None else None,
            "coordenador": r.get("coordenador"),
            "gestor": r.get("gestor"),
            "publico_alvo": r.get("publico_alvo"),
            "fonte": str(r.get("fonte") or ""),
        })
    save(out_dir / "ofertas.json", cleaned)


# ---------------------------------------------------------------------------
# mercado_overview.json
# ---------------------------------------------------------------------------

def export_mercado_overview(con, out_dir: pathlib.Path):
    print("Exportando mercado_overview.json...")

    rows = rows_to_dicts(con.execute(f"""
        SELECT
            YEAR(data_inicio)                         AS ano,
            {TIPO_NORM}                               AS tipo_fundo,
            COUNT(*)                                  AS n,
            COALESCE(SUM(volume), 0)                  AS volume,
            COUNT(*) FILTER (WHERE status = 'Ativa')  AS ativas
        FROM ofertas_fundos
        WHERE YEAR(data_inicio) >= 2019 AND data_inicio IS NOT NULL
        GROUP BY ano, {TIPO_NORM}
        ORDER BY ano, tipo_fundo
    """))

    ativas_total = con.execute(
        "SELECT COUNT(*) AS total FROM ofertas_fundos WHERE status = 'Ativa'"
    ).fetchone()[0]

    ytd = con.execute(f"""
        SELECT
            COUNT(*) FILTER (
                WHERE YEAR(data_inicio) = YEAR(CURRENT_DATE)
                  AND DAYOFYEAR(data_inicio) <= DAYOFYEAR(CURRENT_DATE)
            ) AS ytd_atual_n,
            COUNT(*) FILTER (
                WHERE YEAR(data_inicio) = YEAR(CURRENT_DATE) - 1
                  AND DAYOFYEAR(data_inicio) <= DAYOFYEAR(CURRENT_DATE)
            ) AS ytd_anterior_n,
            COALESCE(SUM(volume) FILTER (
                WHERE YEAR(data_inicio) = YEAR(CURRENT_DATE)
                  AND DAYOFYEAR(data_inicio) <= DAYOFYEAR(CURRENT_DATE)
            ), 0) AS ytd_atual_vol,
            COALESCE(SUM(volume) FILTER (
                WHERE YEAR(data_inicio) = YEAR(CURRENT_DATE) - 1
                  AND DAYOFYEAR(data_inicio) <= DAYOFYEAR(CURRENT_DATE)
            ), 0) AS ytd_anterior_vol
        FROM ofertas_fundos
        WHERE data_inicio IS NOT NULL
    """).fetchone()

    data_base = con.execute("""
        SELECT strftime(MAX(data_inicio), '%m/%Y') AS data_base
        FROM ofertas_fundos WHERE data_inicio IS NOT NULL
    """).fetchone()[0]

    ytd_atual_n = int(ytd[0] or 0)
    ytd_ant_n = int(ytd[1] or 0)
    ytd_atual_vol = float(ytd[2] or 0)
    ytd_ant_vol = float(ytd[3] or 0)

    ano_atual = datetime.date.today().year
    sum_year = {"n": 0, "vol": 0.0}
    for r in rows:
        if int(r["ano"]) == ano_atual:
            sum_year["n"] += int(r["n"])
            sum_year["vol"] += float(r["volume"])

    data = {
        "rows": [
            {
                "ano": int(r["ano"]),
                "tipo_fundo": str(r["tipo_fundo"] or ""),
                "n": int(r["n"]),
                "volume": float(r["volume"]),
                "ativas": int(r["ativas"]),
            }
            for r in rows
        ],
        "data_base": data_base,
        "kpis": {
            "total_ano": sum_year["n"],
            "volume_ano": sum_year["vol"],
            "ytd_atual_n": ytd_atual_n,
            "ytd_anterior_n": ytd_ant_n,
            "ytd_atual_vol": ytd_atual_vol,
            "ytd_anterior_vol": ytd_ant_vol,
            "ytd_yoy_n": round(((ytd_atual_n - ytd_ant_n) / ytd_ant_n) * 100, 1) if ytd_ant_n > 0 else 0,
            "ytd_yoy_vol": round(((ytd_atual_vol - ytd_ant_vol) / ytd_ant_vol) * 100, 1) if ytd_ant_vol > 0 else 0,
            "ativas_total": int(ativas_total or 0),
        },
    }
    save(out_dir / "mercado_overview.json", data)


# ---------------------------------------------------------------------------
# mercado_tendencia.json
# ---------------------------------------------------------------------------

def export_mercado_tendencia(con, out_dir: pathlib.Path):
    print("Exportando mercado_tendencia.json...")

    anual = rows_to_dicts(con.execute(f"""
        SELECT
            YEAR(data_inicio) AS ano,
            {TIPO_NORM}       AS tipo_fundo,
            COUNT(*) AS n,
            COALESCE(SUM(volume), 0) AS volume,
            0 AS ativas
        FROM ofertas_fundos
        WHERE data_inicio >= '2019-01-01' AND data_inicio IS NOT NULL
        GROUP BY ano, {TIPO_NORM}
        ORDER BY ano, tipo_fundo
    """))

    mensal = rows_to_dicts(con.execute(f"""
        SELECT
            STRFTIME(data_inicio, '%Y-%m') AS mes,
            {TIPO_NORM}                    AS tipo_fundo,
            COUNT(*) AS n,
            COALESCE(SUM(volume), 0) AS volume
        FROM ofertas_fundos
        WHERE data_inicio >= CURRENT_DATE - 365 AND data_inicio IS NOT NULL
        GROUP BY mes, {TIPO_NORM}
        ORDER BY mes, tipo_fundo
    """))

    ticket = rows_to_dicts(con.execute(f"""
        SELECT
            YEAR(data_inicio)               AS ano,
            {TIPO_NORM}                     AS tipo_fundo,
            ROUND(AVG(volume) / 1e6, 2)     AS ticket_medio,
            COUNT(*)                        AS n
        FROM ofertas_fundos
        WHERE data_inicio >= '2019-01-01'
            AND data_inicio IS NOT NULL
            AND volume > 0
        GROUP BY ano, {TIPO_NORM}
        ORDER BY ano, tipo_fundo
    """))

    data = {
        "anual": [
            {
                "ano": int(r["ano"]),
                "tipo_fundo": str(r["tipo_fundo"] or ""),
                "n": int(r["n"]),
                "volume": float(r["volume"]),
                "ativas": 0,
            }
            for r in anual
        ],
        "mensal": [
            {
                "mes": str(r["mes"] or ""),
                "tipo_fundo": str(r["tipo_fundo"] or ""),
                "n": int(r["n"]),
                "volume": float(r["volume"]),
            }
            for r in mensal
        ],
        "ticket": [
            {
                "ano": int(r["ano"]),
                "tipo_fundo": str(r["tipo_fundo"] or ""),
                "ticket_medio": float(r["ticket_medio"] or 0),
                "n": int(r["n"]),
            }
            for r in ticket
        ],
    }
    save(out_dir / "mercado_tendencia.json", data)


# ---------------------------------------------------------------------------
# mercado_eficiencia.json
# ---------------------------------------------------------------------------

def export_mercado_eficiencia(con, out_dir: pathlib.Path):
    print("Exportando mercado_eficiencia.json...")

    dias = rows_to_dicts(con.execute(f"""
        SELECT
            {TIPO_NORM}                                  AS tipo_fundo,
            rito,
            YEAR(data_inicio)                            AS ano,
            COUNT(*)                                     AS total,
            COUNT(*) FILTER (WHERE status = 'Encerrada') AS encerradas,
            ROUND(AVG(
                CASE WHEN status = 'Encerrada'
                     AND data_encerramento IS NOT NULL
                     AND data_inicio IS NOT NULL
                THEN DATEDIFF('day', data_inicio, data_encerramento)
                END
            ), 1)                                        AS dias_medio_captacao
        FROM ofertas_fundos
        WHERE data_inicio IS NOT NULL
            AND tipo_fundo IS NOT NULL
            AND rito IS NOT NULL
        GROUP BY {TIPO_NORM}, rito, ano
        ORDER BY tipo_fundo, rito, ano
    """))

    ticket_atual = rows_to_dicts(con.execute(f"""
        SELECT
            {TIPO_NORM}                AS tipo_fundo,
            ROUND(AVG(volume) / 1e6, 2) AS ticket_medio,
            COUNT(*)                    AS n
        FROM ofertas_fundos
        WHERE YEAR(data_inicio) = YEAR(CURRENT_DATE)
            AND data_inicio IS NOT NULL
            AND volume > 0
        GROUP BY {TIPO_NORM}
        ORDER BY ticket_medio DESC
    """))

    data = {
        "dias": [
            {
                "tipo_fundo": str(r["tipo_fundo"] or ""),
                "rito": str(r["rito"] or ""),
                "ano": int(r["ano"]),
                "total": int(r["total"]),
                "encerradas": int(r["encerradas"]),
                "dias_medio_captacao": float(r["dias_medio_captacao"]) if r["dias_medio_captacao"] is not None else None,
            }
            for r in dias
        ],
        "ticket_atual": [
            {
                "tipo_fundo": str(r["tipo_fundo"] or ""),
                "ticket_medio": float(r["ticket_medio"] or 0),
                "n": int(r["n"]),
            }
            for r in ticket_atual
        ],
    }
    save(out_dir / "mercado_eficiencia.json", data)


# ---------------------------------------------------------------------------
# mercado_volume_mensal.json
# ---------------------------------------------------------------------------

def export_mercado_volume_mensal(con, out_dir: pathlib.Path):
    print("Exportando mercado_volume_mensal.json...")
    try:
        rows = rows_to_dicts(con.execute("""
            SELECT
                STRFTIME(TRY_CAST(Data_requerimento AS DATE), '%Y-%m')       AS mes,
                Valor_Mobiliario                                              AS valor_mobiliario,
                COALESCE(SUM(TRY_CAST(Valor_Total_Registrado AS DOUBLE)), 0) AS volume,
                COUNT(*)                                                      AS n
            FROM ofertas_160
            WHERE TRY_CAST(Data_requerimento AS DATE) >= DATE_TRUNC('month', CURRENT_DATE - INTERVAL 24 MONTH)
                AND TRY_CAST(Data_requerimento AS DATE) IS NOT NULL
                AND Valor_Mobiliario IS NOT NULL
                AND Valor_Mobiliario != ''
                AND Valor_Mobiliario NOT IN (
                    'Notas Promissórias',
                    'Cotas de Funcine',
                    'Ações'
                )
            GROUP BY mes, Valor_Mobiliario
            ORDER BY mes, Valor_Mobiliario
        """))
    except Exception as e:
        print(f"  Aviso (volume_mensal): {e}")
        rows = []

    data = {
        "rows": [
            {
                "mes": str(r["mes"] or ""),
                "valor_mobiliario": str(r["valor_mobiliario"] or ""),
                "volume": float(r["volume"] or 0),
                "n": int(r["n"]),
            }
            for r in rows
        ]
    }
    save(out_dir / "mercado_volume_mensal.json", data)


# ---------------------------------------------------------------------------
# mercado_segmentacao.json
# ---------------------------------------------------------------------------

def _normalize_name(s: str) -> str:
    import unicodedata, re
    s = s.upper()
    s = unicodedata.normalize("NFD", s)
    s = "".join(c for c in s if unicodedata.category(c) != "Mn")
    s = s.replace(".", " ").replace("/", " ").replace(",", " ").replace("-", " ")
    s = re.sub(
        r"\b(S\s*A|SA|LTDA|EPP|ME|EIRELI|DTVM|CCTVM|CTVM|TVM|DTV|S/A|"
        r"GESTORA DE RECURSOS|ADMINISTRACAO DE RECURSOS|GESTAO DE RECURSOS|"
        r"INVESTIMENTOS|ASSET MANAGEMENT)\b",
        "",
        s,
    )
    return re.sub(r"\s+", " ", s).strip()


def _aggregate_by_normalized(rows, get_name, get_ano, get_value):
    from collections import defaultdict
    acc = {}  # key -> {display, variants: {name: count}, por_ano: {ano: value}, total}
    for r in rows:
        original = (get_name(r) or "").strip()
        if not original:
            continue
        key = _normalize_name(original)
        if not key:
            continue
        if key not in acc:
            acc[key] = {"display": original, "variants": defaultdict(int), "por_ano": defaultdict(float), "total": 0.0}
        acc[key]["variants"][original] += 1
        ano = get_ano(r)
        acc[key]["por_ano"][ano] += get_value(r)
        acc[key]["total"] += get_value(r)
        # escolhe variante mais frequente como display
        best = max(acc[key]["variants"], key=lambda k: acc[key]["variants"][k])
        acc[key]["display"] = best
    return acc


def export_mercado_segmentacao(con, out_dir: pathlib.Path):
    print("Exportando mercado_segmentacao.json...")
    import datetime as dt

    ano_atual = dt.date.today().year
    anos = [ano_atual - 2, ano_atual - 1, ano_atual]

    pa = rows_to_dicts(con.execute("""
        SELECT
            YEAR(data_inicio) AS ano,
            publico_alvo,
            COUNT(*) AS n
        FROM ofertas_fundos
        WHERE publico_alvo IS NOT NULL AND data_inicio IS NOT NULL
        GROUP BY ano, publico_alvo
        ORDER BY ano
    """))

    coord_raw = rows_to_dicts(con.execute(f"""
        SELECT
            YEAR(data_inicio)        AS ano,
            coordenador,
            COALESCE(SUM(volume), 0) AS volume
        FROM ofertas_fundos
        WHERE coordenador IS NOT NULL
            AND YEAR(data_inicio) IN ({','.join(str(a) for a in anos)})
        GROUP BY ano, coordenador
    """))

    gest_raw = rows_to_dicts(con.execute(f"""
        SELECT
            YEAR(data_inicio) AS ano,
            gestor,
            COUNT(*)          AS n
        FROM ofertas_fundos
        WHERE gestor IS NOT NULL
            AND YEAR(data_inicio) IN ({','.join(str(a) for a in anos)})
        GROUP BY ano, gestor
    """))

    try:
        lastro = rows_to_dicts(con.execute("""
            SELECT
                Tipo_lastro AS tipo_lastro,
                COUNT(*) AS n
            FROM ofertas_160
            WHERE Tipo_lastro IS NOT NULL
                AND Tipo_lastro != ''
            GROUP BY Tipo_lastro
            ORDER BY n DESC
            LIMIT 15
        """))
    except Exception:
        lastro = []

    # Agregar coordenadores por nome normalizado
    coord_agg = _aggregate_by_normalized(
        coord_raw,
        get_name=lambda r: str(r["coordenador"] or ""),
        get_ano=lambda r: int(r["ano"]),
        get_value=lambda r: float(r["volume"] or 0),
    )
    coordenadores_3y = [
        {"ano": ano, "coordenador": v["display"], "volume": float(v["por_ano"].get(ano, 0))}
        for v in coord_agg.values()
        for ano in v["por_ano"]
    ]

    # Agregar gestores por nome normalizado
    gest_agg = _aggregate_by_normalized(
        gest_raw,
        get_name=lambda r: str(r["gestor"] or ""),
        get_ano=lambda r: int(r["ano"]),
        get_value=lambda r: float(r["n"] or 0),
    )
    gestores_3y = [
        {"ano": ano, "gestor": v["display"], "n": int(v["por_ano"].get(ano, 0))}
        for v in gest_agg.values()
        for ano in v["por_ano"]
    ]

    data = {
        "publico_alvo": [
            {"ano": int(r["ano"]), "publico_alvo": str(r["publico_alvo"] or ""), "n": int(r["n"])}
            for r in pa
        ],
        "coordenadores_3y": coordenadores_3y,
        "gestores_3y": gestores_3y,
        "lastro": [
            {"tipo_lastro": str(r["tipo_lastro"] or ""), "n": int(r["n"])}
            for r in lastro
        ],
        "anos": anos,
    }
    save(out_dir / "mercado_segmentacao.json", data)


# ---------------------------------------------------------------------------
# mercado_pipeline.json
# ---------------------------------------------------------------------------

def export_mercado_pipeline(con, out_dir: pathlib.Path):
    print("Exportando mercado_pipeline.json...")
    rows = rows_to_dicts(con.execute("""
        SELECT
            MONTH(data_inicio) AS mes_num,
            ROUND(COUNT(*) * 1.0 / COUNT(DISTINCT YEAR(data_inicio)), 1) AS media_por_ano
        FROM ofertas_fundos
        WHERE data_inicio IS NOT NULL
        GROUP BY mes_num
        ORDER BY mes_num
    """))
    data = {
        "sazonalidade": [
            {"mes_num": int(r["mes_num"]), "media_por_ano": float(r["media_por_ano"] or 0)}
            for r in rows
        ]
    }
    save(out_dir / "mercado_pipeline.json", data)


# ---------------------------------------------------------------------------
# mercado_captacao_real.json
# ---------------------------------------------------------------------------

def export_mercado_captacao_real(con, out_dir: pathlib.Path):
    print("Exportando mercado_captacao_real.json...")

    # Verificar se tabela ANBIMA existe
    try:
        n_anbima = con.execute(
            "SELECT COUNT(*) AS n FROM information_schema.tables WHERE table_name = 'anbima_captacao_ofertas'"
        ).fetchone()[0]
        anbima_existe = int(n_anbima or 0) > 0
    except Exception:
        anbima_existe = False

    if anbima_existe:
        anbima_join = "LEFT JOIN anbima_captacao_ofertas a ON a.numero_processo = of.numero_processo"
        anbima_fields = """
            COALESCE(SUM(GREATEST(a.delta_pl, 0)) FILTER (WHERE a.fetch_status = 'ok'), 0) AS total_captado,
            COALESCE(ROUND(AVG(LEAST(GREATEST(a.taxa_captacao, 0), 2)) FILTER (WHERE a.fetch_status = 'ok') * 100, 1), 0) AS taxa_media,
            COALESCE(ROUND(MEDIAN(LEAST(GREATEST(a.taxa_captacao, 0), 2)) FILTER (WHERE a.fetch_status = 'ok') * 100, 1), 0) AS taxa_mediana,
            COUNT(a.numero_processo) FILTER (WHERE a.fetch_status = 'ok') AS n_com_anbima,
        """
        captado_mensal = "COALESCE(SUM(GREATEST(a.delta_pl, 0)) FILTER (WHERE a.fetch_status = 'ok'), 0) AS captado"
    else:
        anbima_join = ""
        anbima_fields = "0 AS total_captado, 0 AS taxa_media, 0 AS taxa_mediana, 0 AS n_com_anbima,"
        captado_mensal = "0 AS captado"

    por_classe = rows_to_dicts(con.execute(f"""
        SELECT
            {TIPO_NORM_OF}                                          AS tipo_fundo,
            COUNT(*)                                                AS n_total,
            COUNT(*) FILTER (WHERE of.status = 'Encerrada')        AS n_encerradas,
            COUNT(*) FILTER (WHERE of.status = 'Ativa')            AS n_ativas,
            COALESCE(SUM(of.volume), 0)                            AS total_ofertado,
            {anbima_fields}
            COUNT(*) AS n_ofertas
        FROM ofertas_fundos of
        {anbima_join}
        WHERE of.tipo_fundo IS NOT NULL
        GROUP BY {TIPO_NORM_OF}
        ORDER BY total_ofertado DESC
    """))

    mensal = rows_to_dicts(con.execute(f"""
        SELECT
            STRFTIME(of.data_encerramento, '%Y-%m')    AS mes,
            {TIPO_NORM_OF}                             AS tipo_fundo,
            COALESCE(SUM(of.volume), 0)                AS ofertado,
            {captado_mensal}
        FROM ofertas_fundos of
        {anbima_join}
        WHERE of.status = 'Encerrada'
            AND of.data_encerramento >= CURRENT_DATE - INTERVAL '2 years'
            AND of.data_encerramento IS NOT NULL
        GROUP BY mes, {TIPO_NORM_OF}
        ORDER BY mes
    """))

    if anbima_existe:
        top_sub = rows_to_dicts(con.execute(f"""
            SELECT
                of.numero_processo,
                of.emissor_nome,
                {TIPO_NORM_OF} AS tipo_fundo,
                CAST(of.data_encerramento AS VARCHAR) AS data_encerramento,
                of.volume                AS valor_ofertado,
                a.delta_pl,
                a.taxa_captacao
            FROM ofertas_fundos of
            JOIN anbima_captacao_ofertas a ON a.numero_processo = of.numero_processo
            WHERE a.fetch_status = 'ok'
                AND a.taxa_captacao IS NOT NULL
                AND a.taxa_captacao < 0.5
                AND of.volume >= 50000000
            ORDER BY of.volume DESC
            LIMIT 20
        """))
    else:
        top_sub = []

    cobertura = con.execute(f"""
        SELECT
            (SELECT COUNT(*) FROM ofertas_fundos WHERE status = 'Encerrada') AS total_cvm,
            {'(SELECT COUNT(*) FROM anbima_captacao_ofertas WHERE fetch_status = \'ok\') AS com_dados' if anbima_existe else '0 AS com_dados'}
    """).fetchone()

    if anbima_existe:
        try:
            status_rows = rows_to_dicts(con.execute("""
                SELECT fetch_status, COUNT(*) AS n
                FROM anbima_captacao_ofertas
                GROUP BY fetch_status ORDER BY n DESC
            """))
        except Exception:
            status_rows = []
    else:
        status_rows = []

    taxa_sucesso_rows = rows_to_dicts(con.execute(f"""
        SELECT
            YEAR(data_inicio)                                                           AS ano,
            {TIPO_NORM_BARE}                                                            AS tipo_fundo,
            COUNT(*)                                                                    AS n_ofertadas,
            COUNT(*) FILTER (WHERE status = 'Encerrada')                               AS n_encerradas,
            ROUND(COUNT(*) FILTER (WHERE status = 'Encerrada') * 100.0 / COUNT(*), 1)  AS taxa_sucesso
        FROM ofertas_fundos
        WHERE YEAR(data_inicio) >= YEAR(CURRENT_DATE) - 2
            AND data_inicio IS NOT NULL
            AND tipo_fundo IS NOT NULL
        GROUP BY ano, {TIPO_NORM_BARE}

        UNION ALL

        SELECT
            YEAR(data_inicio)                                                           AS ano,
            'Consolidado'                                                               AS tipo_fundo,
            COUNT(*)                                                                    AS n_ofertadas,
            COUNT(*) FILTER (WHERE status = 'Encerrada')                               AS n_encerradas,
            ROUND(COUNT(*) FILTER (WHERE status = 'Encerrada') * 100.0 / COUNT(*), 1)  AS taxa_sucesso
        FROM ofertas_fundos
        WHERE YEAR(data_inicio) >= YEAR(CURRENT_DATE) - 2
            AND data_inicio IS NOT NULL
        GROUP BY ano

        ORDER BY ano, tipo_fundo
    """))

    data = {
        "disponivel": True,
        "total_cvm": int(cobertura[0] or 0),
        "total_processadas": sum(int(r["n"]) for r in status_rows),
        "cobertura_anbima": int(cobertura[1] or 0),
        "status_breakdown": [
            {"fetch_status": str(r["fetch_status"] or ""), "n": int(r["n"])}
            for r in status_rows
        ],
        "taxa_sucesso": [
            {
                "ano": int(r["ano"]),
                "tipo_fundo": str(r["tipo_fundo"] or ""),
                "n_ofertadas": int(r["n_ofertadas"]),
                "n_encerradas": int(r["n_encerradas"]),
                "taxa_sucesso": float(r["taxa_sucesso"] or 0),
            }
            for r in taxa_sucesso_rows
        ],
        "por_classe": [
            {
                "tipo_fundo": str(r["tipo_fundo"] or ""),
                "n_ofertas": int(r["n_total"]),
                "n_encerradas": int(r["n_encerradas"]),
                "n_ativas": int(r["n_ativas"]),
                "n_com_anbima": int(r["n_com_anbima"]),
                "total_ofertado": float(r["total_ofertado"] or 0),
                "total_captado": float(r.get("total_captado") or 0),
                "taxa_media": float(r.get("taxa_media") or 0),
                "taxa_mediana": float(r.get("taxa_mediana") or 0),
            }
            for r in por_classe
        ],
        "mensal": [
            {
                "mes": str(r["mes"] or ""),
                "tipo_fundo": str(r["tipo_fundo"] or ""),
                "ofertado": float(r["ofertado"] or 0),
                "captado": float(r["captado"] or 0),
            }
            for r in mensal
        ],
        "top_sub": [
            {
                "numero_processo": str(r["numero_processo"] or ""),
                "emissor_nome": str(r["emissor_nome"] or ""),
                "tipo_fundo": str(r["tipo_fundo"] or ""),
                "data_encerramento": str(r["data_encerramento"] or ""),
                "valor_ofertado": float(r["valor_ofertado"] or 0),
                "delta_pl": float(r["delta_pl"] or 0),
                "taxa_captacao": float(r["taxa_captacao"] or 0),
            }
            for r in top_sub
        ],
    }
    save(out_dir / "mercado_captacao_real.json", data)


# ---------------------------------------------------------------------------
# mercado_securitizacao.json
# ---------------------------------------------------------------------------

def export_mercado_securitizacao(con, out_dir: pathlib.Path):
    print("Exportando mercado_securitizacao.json...")

    EMPTY = {
        "disponivel": False,
        "anbima_disponivel": False,
        "por_tipo_ano": [],
        "consolidado_ano": [],
        "anos": [],
    }

    # Verificar se view existe
    try:
        rows = con.execute(
            "SELECT view_name FROM duckdb_views() WHERE view_name = 'ofertas_mercado_capitais'"
        ).fetchall()
        view_exists = len(rows) > 0
    except Exception:
        view_exists = False

    if not view_exists:
        save(out_dir / "mercado_securitizacao.json", EMPTY)
        return

    # Verificar tabela ANBIMA
    try:
        n = con.execute(
            "SELECT COUNT(*) FROM information_schema.tables WHERE table_name = 'anbima_vol_encerrado' AND table_type = 'BASE TABLE'"
        ).fetchone()[0]
        has_anbima = int(n or 0) > 0
    except Exception:
        has_anbima = False

    try:
        anbima_data_base = None
        if has_anbima:
            row = con.execute("SELECT valor FROM anbima_meta WHERE chave = 'data_base'").fetchone()
            anbima_data_base = row[0] if row else None
    except Exception:
        anbima_data_base = None

    try:
        row = con.execute(
            "SELECT strftime(MAX(data_encerramento), '%m/%Y') AS max_data FROM ofertas_mercado_capitais WHERE data_encerramento IS NOT NULL AND status = 'Encerrada'"
        ).fetchone()
        cvm_data_base = row[0] if row else None
    except Exception:
        cvm_data_base = None

    # Aba Registradas × Encerradas
    por_tipo_ano = rows_to_dicts(con.execute("""
        SELECT
            YEAR(data_inicio)                                                           AS ano,
            tipo_ativo,
            COUNT(*)                                                                    AS n_ofertadas,
            COUNT(*) FILTER (WHERE status = 'Encerrada')                               AS n_encerradas,
            COALESCE(SUM(volume), 0)                                                    AS vol_ofertado,
            COALESCE(SUM(volume) FILTER (WHERE status = 'Encerrada'), 0)                AS vol_encerrado,
            ROUND(COUNT(*) FILTER (WHERE status = 'Encerrada') * 100.0 / COUNT(*), 1)  AS taxa_encerramento
        FROM ofertas_mercado_capitais
        WHERE YEAR(data_inicio) >= YEAR(CURRENT_DATE) - 2
            AND data_inicio IS NOT NULL
            AND tipo_ativo IN ('FIDC', 'FII', 'FIP', 'Debêntures')
            AND volume IS NOT NULL
        GROUP BY ano, tipo_ativo
        ORDER BY ano, vol_ofertado DESC
    """))

    consolidado_ano = rows_to_dicts(con.execute("""
        SELECT
            YEAR(data_inicio)                                                           AS ano,
            COUNT(*)                                                                    AS n_ofertadas,
            COUNT(*) FILTER (WHERE status = 'Encerrada')                               AS n_encerradas,
            COALESCE(SUM(volume), 0)                                                    AS vol_ofertado,
            COALESCE(SUM(volume) FILTER (WHERE status = 'Encerrada'), 0)                AS vol_encerrado,
            ROUND(COUNT(*) FILTER (WHERE status = 'Encerrada') * 100.0 / COUNT(*), 1)  AS taxa_encerramento
        FROM ofertas_mercado_capitais
        WHERE YEAR(data_inicio) >= YEAR(CURRENT_DATE) - 2
            AND data_inicio IS NOT NULL
            AND tipo_ativo IN ('FIDC', 'FII', 'FIP', 'Debêntures')
        GROUP BY ano
        ORDER BY ano
    """))

    # Aba Captação Efetiva
    captacao_tipo = rows_to_dicts(con.execute("""
        SELECT
            YEAR(data_encerramento)  AS ano,
            tipo_ativo,
            COALESCE(SUM(volume), 0) AS vol_ofertado_cvm,
            COUNT(*)                 AS n_encerradas_cvm
        FROM ofertas_mercado_capitais
        WHERE status = 'Encerrada'
            AND data_encerramento IS NOT NULL
            AND YEAR(data_encerramento) >= YEAR(CURRENT_DATE) - 2
            AND tipo_ativo IN ('FIDC', 'FII', 'FIP', 'Debêntures')
            AND volume IS NOT NULL
        GROUP BY ano, tipo_ativo
        ORDER BY ano, tipo_ativo
    """))

    captacao_consolidado_rows = rows_to_dicts(con.execute("""
        SELECT
            YEAR(data_encerramento)  AS ano,
            COALESCE(SUM(volume), 0) AS vol_ofertado_cvm,
            COUNT(*)                 AS n_encerradas_cvm
        FROM ofertas_mercado_capitais
        WHERE status = 'Encerrada'
            AND data_encerramento IS NOT NULL
            AND YEAR(data_encerramento) >= YEAR(CURRENT_DATE) - 2
            AND tipo_ativo IN ('FIDC', 'FII', 'FIP', 'Debêntures')
        GROUP BY ano
        ORDER BY ano
    """))

    anbima_rows = []
    anbima_consolidado = []
    if has_anbima:
        try:
            anbima_rows = rows_to_dicts(con.execute("""
                SELECT tipo_ativo, ano, n_encerradas, vol_encerrado
                FROM anbima_vol_encerrado
                WHERE ano >= YEAR(CURRENT_DATE) - 2
                ORDER BY tipo_ativo, ano
            """))
            anbima_consolidado = rows_to_dicts(con.execute("""
                SELECT ano, SUM(n_encerradas) AS n_encerradas, SUM(vol_encerrado) AS vol_encerrado
                FROM anbima_vol_encerrado
                WHERE ano >= YEAR(CURRENT_DATE) - 2
                GROUP BY ano ORDER BY ano
            """))
        except Exception:
            pass

    # Build lookup maps
    captacao_tipo_map = {f"{r['tipo_ativo']}|{int(r['ano'])}": r for r in captacao_tipo}
    captacao_cons_map = {int(r["ano"]): r for r in captacao_consolidado_rows}
    anbima_map = {f"{r['tipo_ativo']}|{int(r['ano'])}": r for r in anbima_rows}
    anbima_cons_map = {int(r["ano"]): r for r in anbima_consolidado}

    anos = sorted(set(int(r["ano"]) for r in por_tipo_ano))
    anos_captacao = sorted(
        set(int(r["ano"]) for r in captacao_tipo) | set(int(r["ano"]) for r in anbima_rows)
    )

    # Build captacao_tipo_ano
    captacao_tipo_ano_out = []
    for ano in anos_captacao:
        for tipo in ["FIDC", "FII", "FIP", "Debêntures"]:
            cvm = captacao_tipo_map.get(f"{tipo}|{ano}")
            anbima = anbima_map.get(f"{tipo}|{ano}")
            if not cvm and not anbima:
                continue
            captacao_tipo_ano_out.append({
                "ano": ano,
                "tipo_ativo": tipo,
                "vol_ofertado_cvm": float(cvm["vol_ofertado_cvm"]) if cvm else 0,
                "n_encerradas_cvm": int(cvm["n_encerradas_cvm"]) if cvm else 0,
                "vol_encerrado_anbima": float(anbima["vol_encerrado"]) if anbima else None,
                "n_encerradas_anbima": int(anbima["n_encerradas"]) if anbima else None,
            })

    # Build captacao_consolidado
    captacao_consolidado_out = []
    for ano in anos_captacao:
        cvm = captacao_cons_map.get(ano)
        anbima = anbima_cons_map.get(ano)
        captacao_consolidado_out.append({
            "ano": ano,
            "vol_ofertado_cvm": float(cvm["vol_ofertado_cvm"]) if cvm else 0,
            "n_encerradas_cvm": int(cvm["n_encerradas_cvm"]) if cvm else 0,
            "vol_encerrado_anbima": float(anbima["vol_encerrado"]) if anbima else None,
            "n_encerradas_anbima": int(anbima["n_encerradas"]) if anbima else None,
        })

    data = {
        "disponivel": True,
        "anbima_disponivel": has_anbima,
        "anbima_data_base": anbima_data_base,
        "cvm_data_base": cvm_data_base,
        "anos": anos,
        "anos_captacao": anos_captacao,
        "por_tipo_ano": [
            {
                "ano": int(r["ano"]),
                "tipo_ativo": str(r["tipo_ativo"] or ""),
                "n_ofertadas": int(r["n_ofertadas"]),
                "n_encerradas": int(r["n_encerradas"]),
                "vol_ofertado": float(r["vol_ofertado"]),
                "vol_encerrado": float(r["vol_encerrado"]),
                "taxa_encerramento": float(r["taxa_encerramento"] or 0),
                "vol_distribuido_anbima": None,
                "n_distribuidas_anbima": None,
            }
            for r in por_tipo_ano
        ],
        "consolidado_ano": [
            {
                "ano": int(r["ano"]),
                "n_ofertadas": int(r["n_ofertadas"]),
                "n_encerradas": int(r["n_encerradas"]),
                "vol_ofertado": float(r["vol_ofertado"]),
                "vol_encerrado": float(r["vol_encerrado"]),
                "taxa_encerramento": float(r["taxa_encerramento"] or 0),
                "vol_distribuido_anbima": None,
                "n_distribuidas_anbima": None,
            }
            for r in consolidado_ano
        ],
        "captacao_tipo_ano": captacao_tipo_ano_out,
        "captacao_consolidado": captacao_consolidado_out,
    }
    save(out_dir / "mercado_securitizacao.json", data)


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------

def main():
    parser = argparse.ArgumentParser(description="Exporta JSONs do DuckDB para o site estático")
    parser.add_argument(
        "--out",
        default=str(pathlib.Path(__file__).parent.parent / "cvm-ofertas-static" / "public" / "data"),
        help="Diretório de saída (default: ../cvm-ofertas-static/public/data)",
    )
    parser.add_argument(
        "--db",
        default=str(DB_PATH),
        help=f"Caminho para o arquivo DuckDB (default: {DB_PATH})",
    )
    args = parser.parse_args()

    out_dir = pathlib.Path(args.out)
    db_path = pathlib.Path(args.db)

    print(f"DuckDB: {db_path}")
    print(f"Saída:  {out_dir}")
    print()

    if not db_path.exists():
        print(f"ERRO: arquivo DuckDB não encontrado: {db_path}")
        raise SystemExit(1)

    con = duckdb.connect(str(db_path), read_only=True)

    try:
        export_summary(con, out_dir)
        export_ofertas(con, out_dir)
        export_mercado_overview(con, out_dir)
        export_mercado_tendencia(con, out_dir)
        export_mercado_eficiencia(con, out_dir)
        export_mercado_volume_mensal(con, out_dir)
        export_mercado_segmentacao(con, out_dir)
        export_mercado_pipeline(con, out_dir)
        export_mercado_captacao_real(con, out_dir)
        export_mercado_securitizacao(con, out_dir)
    finally:
        con.close()

    print()
    print("Exportação concluída.")


if __name__ == "__main__":
    main()
