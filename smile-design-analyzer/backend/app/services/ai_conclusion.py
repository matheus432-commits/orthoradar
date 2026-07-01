"""
ai_conclusion.py
================

Geracao da CONCLUSAO CLINICA por Inteligencia Artificial.

Regras de negocio (importantes):
  * A IA interpreta SOMENTE as medidas ja calculadas (passadas como contexto).
  * A IA NUNCA inventa numeros nem cria medidas que nao existem no relatorio.
  * O texto imita a linguagem de um especialista em odontologia estetica.

Implementacao:
  * Se ``ANTHROPIC_API_KEY`` estiver configurada, usa o modelo Claude
    (``claude-opus-4-8``) via SDK oficial ``anthropic``.
  * Caso contrario (ou em caso de erro/rede), cai para um gerador
    deterministico baseado em regras (``_fallback_conclusion``), garantindo que
    o sistema funcione totalmente offline e sem custo.
"""
from __future__ import annotations

import json
import os
from typing import Optional

MODEL_ID = "claude-opus-4-8"

SYSTEM_PROMPT = (
    "Voce e um especialista em odontologia estetica e design de sorriso (Digital "
    "Smile Design). Voce recebe um relatorio JSON com medidas ja calculadas a "
    "partir de pontos marcados sobre uma fotografia. Escreva uma CONCLUSAO CLINICA "
    "em portugues do Brasil, com tom profissional, objetivo e tecnico, semelhante "
    "ao laudo de um especialista.\n\n"
    "REGRAS OBRIGATORIAS:\n"
    "1. Utilize EXCLUSIVAMENTE os valores presentes no relatorio. NUNCA invente "
    "medidas, numeros ou estruturas que nao estejam no JSON.\n"
    "2. Se uma medida estiver ausente ou nao calibrada, nao afirme um valor: "
    "mencione que nao foi possivel avaliar ou que depende de calibracao.\n"
    "3. Estruture o texto em: (a) linha media, (b) exposicao gengival, (c) "
    "corredor bucal, (d) proporcao e simetria dentaria, (e) arco/linha do "
    "sorriso, (f) planos horizontais, (g) sugestoes esteticas.\n"
    "4. Seja conciso (150-300 palavras). Nao use markdown, apenas texto corrido "
    "em paragrafos curtos.\n"
    "5. Ao final, inclua uma frase de sugestoes esteticas coerentes com os "
    "achados (sem prometer resultados)."
)


def generate_conclusion(report: dict) -> dict:
    """Gera a conclusao clinica.

    Args:
        report: relatorio completo produzido por ``run_analysis``.

    Returns:
        dict com ``text`` (conclusao) e ``source`` ("ai" ou "rule-based").
    """
    api_key = os.environ.get("ANTHROPIC_API_KEY")
    if api_key:
        try:
            return {"text": _ai_conclusion(report), "source": "ai"}
        except Exception as exc:  # noqa: BLE001 - fallback resiliente
            return {
                "text": _fallback_conclusion(report),
                "source": "rule-based",
                "warning": f"IA indisponivel ({exc.__class__.__name__}); "
                "usada conclusao baseada em regras.",
            }
    return {"text": _fallback_conclusion(report), "source": "rule-based"}


def _ai_conclusion(report: dict) -> str:
    """Chama o modelo Claude para redigir a conclusao."""
    from anthropic import Anthropic  # import tardio: opcional em runtime

    client = Anthropic()
    # Passamos apenas o relatorio; o modelo nao tem outra fonte de numeros.
    user_content = (
        "Relatorio de medidas (JSON). Escreva a conclusao clinica usando "
        "apenas estes valores:\n\n" + json.dumps(report, ensure_ascii=False, indent=2)
    )

    message = client.messages.create(
        model=MODEL_ID,
        max_tokens=1200,
        thinking={"type": "adaptive"},
        system=SYSTEM_PROMPT,
        messages=[{"role": "user", "content": user_content}],
    )

    # Extrai apenas os blocos de texto (ignora blocos de thinking).
    parts = [b.text for b in message.content if getattr(b, "type", None) == "text"]
    text = "\n".join(parts).strip()
    return text or _fallback_conclusion(report)


def _fmt_mm(value: Optional[float]) -> str:
    return f"{value:.1f} mm" if isinstance(value, (int, float)) else "valor nao calibrado"


def _fallback_conclusion(report: dict) -> str:
    """Conclusao deterministica, baseada apenas nos valores do relatorio.

    Serve como redundancia offline. Tambem usa exclusivamente valores calculados.
    """
    s = report.get("summary", {})
    lines: list[str] = []

    # (a) Linha media
    md = report.get("midline")
    if md:
        dev = md.get("deviation_mm")
        side = md.get("side", "")
        if dev is not None:
            lines.append(
                f"A linha media dentaria apresenta desvio de {_fmt_mm(dev)} para a "
                f"{side} do paciente, classificado como {md.get('classification')}."
            )
        else:
            lines.append(
                f"A linha media dentaria mostra desvio de {md.get('deviation_px')} px "
                f"para a {side} do paciente (sem calibracao para conversao em mm)."
            )

    # (b) Exposicao gengival
    ge = report.get("gingival_exposure")
    if ge:
        cls = ge.get("classification")
        mm = ge.get("exposure_mm")
        if mm is not None:
            lines.append(
                f"A exposicao gengival e de {_fmt_mm(mm)}, considerada {cls}."
            )
        else:
            lines.append(f"A exposicao gengival foi classificada como {cls}.")

    # (c) Corredor bucal
    bc = report.get("buccal_corridor")
    if bc and bc.get("classification"):
        sym = bc.get("symmetry_percent")
        sym_txt = f" com simetria de {sym}% entre os lados" if sym is not None else ""
        lines.append(f"O corredor bucal foi classificado como {bc['classification']}{sym_txt}.")

    # (d) Proporcao / simetria dentaria
    cd = report.get("central_dominance")
    if cd:
        lines.append(
            f"O indice de dominancia dos incisivos centrais e de "
            f"{cd.get('dominance_index')} ({cd.get('interpretation')})."
        )
    ss = report.get("smile_symmetry")
    if ss:
        lines.append(
            f"A simetria global do sorriso e de {ss.get('overall_percent')}% "
            f"({ss.get('classification')})."
        )

    # (e) Arco / linha do sorriso
    sa = report.get("smile_arc")
    if sa:
        lines.append(
            f"O arco do sorriso apresenta forma {sa.get('arc_shape')} e a linha do "
            f"sorriso foi avaliada como {sa.get('smile_line')}."
        )

    # (f) Planos horizontais
    op = report.get("occlusal_plane")
    ip = report.get("interpupillary")
    if ip and op and op.get("parallelism_deg") is not None:
        lines.append(
            f"A linha interpupilar apresenta inclinacao de "
            f"{ip.get('inclination_deg')} graus e o plano incisal forma "
            f"{op.get('parallelism_deg')} graus com ela."
        )

    # (g) Sugestoes esteticas coerentes com os achados
    suggestions = _suggestions(report)
    if suggestions:
        lines.append("Sugestoes esteticas: " + suggestions)

    if not lines:
        return (
            "Nao ha medidas suficientes para gerar uma conclusao. Marque os pontos "
            "obrigatorios e, se possivel, realize a calibracao."
        )
    return " ".join(lines)


def _suggestions(report: dict) -> str:
    """Monta sugestoes esteticas simples a partir das classificacoes."""
    tips: list[str] = []
    md = report.get("midline")
    if md and md.get("deviation_mm") and md["deviation_mm"] > 1.0:
        tips.append("avaliar correcao da linha media dentaria")
    ge = report.get("gingival_exposure")
    if ge and ge.get("classification") == "excessiva":
        tips.append("considerar manejo da exposicao gengival")
    bc = report.get("buccal_corridor")
    if bc and bc.get("classification") == "corredor reduzido / ausente":
        tips.append("avaliar expansao do arco para melhorar o corredor bucal")
    sa = report.get("smile_arc")
    if sa and sa.get("arc_shape") == "concavo":
        tips.append("avaliar reconstrucao das bordas incisais para arco mais harmonico")
    return "; ".join(tips) + "." if tips else ""
