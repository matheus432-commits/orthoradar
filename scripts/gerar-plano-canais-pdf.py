#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Gera o PDF branded do Plano de Expansão de Canais do OdontoFeed.

Foco: novos canais de distribuição que REAPROVEITAM a automação que já existe
(feed RSS do podcast, áudios MP3, carrosséis, reels, texto do digest, links) —
custo marginal ~zero. Hoje estamos só em Instagram e Spotify.

Uso: python3 scripts/gerar-plano-canais-pdf.py [saida.pdf]
Requer: reportlab
"""
import sys
from reportlab.lib.pagesizes import A4
from reportlab.lib.units import mm
from reportlab.lib import colors
from reportlab.lib.enums import TA_LEFT, TA_CENTER
from reportlab.platypus import (
    BaseDocTemplate, PageTemplate, Frame, Paragraph, Spacer, Table,
    TableStyle, HRFlowable, KeepTogether, NextPageTemplate, PageBreak,
)
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet

# ── Paleta OdontoFeed ────────────────────────────────────────────────────────
NAVY   = colors.HexColor("#0b1120")
BLUE   = colors.HexColor("#2563EB")
CYAN   = colors.HexColor("#06B6D4")
INK    = colors.HexColor("#0f172a")
SLATE  = colors.HexColor("#334155")
MUTED  = colors.HexColor("#64748b")
LINE   = colors.HexColor("#e2e8f0")
BGSOFT = colors.HexColor("#f1f5f9")
AMBER  = colors.HexColor("#F59E0B")
GREEN  = colors.HexColor("#10B981")

OUT = sys.argv[1] if len(sys.argv) > 1 else "OdontoFeed-Plano-Canais.pdf"

# Helvetica não tem glifos de emoji — troca por marcadores textuais.
_EMOJI_MAP = {"👉": "»", "⭐": "★", "💡": "•", "•": "•", "✓": "✓", "→": "->"}
def clean(s):
    for k, v in _EMOJI_MAP.items():
        s = s.replace(k, v)
    out = "".join(ch for ch in s if ord(ch) < 0x1F000 and ord(ch) not in (0xFE0F, 0x200D))
    while "  " in out:
        out = out.replace("  ", " ")
    return out.strip()

_RLParagraph = Paragraph
def Paragraph(text, style=None):  # noqa: F811
    return _RLParagraph(clean(text), style)

styles = getSampleStyleSheet()
def S(name, **kw):
    base = kw.pop("parent", styles["Normal"])
    return ParagraphStyle(name, parent=base, **kw)

st_h1    = S("h1", fontName="Helvetica-Bold", fontSize=19, textColor=INK, spaceAfter=4, leading=23)
st_h2    = S("h2", fontName="Helvetica-Bold", fontSize=13.5, textColor=BLUE, spaceBefore=15, spaceAfter=7, leading=17)
st_body  = S("body", fontSize=10, textColor=SLATE, leading=15.5, spaceAfter=7, alignment=TA_LEFT)
st_note  = S("note", fontSize=9, textColor=SLATE, leading=14)
st_cell  = S("cell", fontSize=8.5, textColor=SLATE, leading=12)
st_cellb = S("cellb", fontName="Helvetica-Bold", fontSize=8.5, textColor=INK, leading=12)
st_cellh = S("cellh", fontName="Helvetica-Bold", fontSize=8.5, textColor=colors.white, leading=12)


def header_footer(canvas, doc):
    canvas.saveState()
    w, h = A4
    canvas.setFillColor(NAVY)
    canvas.rect(0, h - 14 * mm, w, 14 * mm, fill=1, stroke=0)
    canvas.setFillColor(CYAN)
    canvas.setFont("Helvetica-Bold", 11)
    canvas.drawString(20 * mm, h - 9.4 * mm, "OdontoFeed")
    canvas.setFillColor(colors.HexColor("#94a3b8"))
    canvas.setFont("Helvetica", 8)
    canvas.drawRightString(w - 20 * mm, h - 9.4 * mm, "Plano de Expansão de Canais")
    canvas.setStrokeColor(LINE)
    canvas.setLineWidth(0.5)
    canvas.line(20 * mm, 14 * mm, w - 20 * mm, 14 * mm)
    canvas.setFillColor(MUTED)
    canvas.setFont("Helvetica", 8)
    canvas.drawString(20 * mm, 9.5 * mm, "odontofeed.com")
    canvas.drawRightString(w - 20 * mm, 9.5 * mm, "Página %d" % doc.page)
    canvas.restoreState()


def cover(canvas, doc):
    canvas.saveState()
    w, h = A4
    canvas.setFillColor(NAVY)
    canvas.rect(0, 0, w, h, fill=1, stroke=0)
    canvas.setFillColor(BLUE)
    canvas.rect(0, h * 0.5 + 60, w, 4, fill=1, stroke=0)
    canvas.setFillColor(CYAN)
    canvas.setFont("Helvetica-Bold", 15)
    canvas.drawCentredString(w / 2, h * 0.5 + 120, "OdontoFeed")
    canvas.setFillColor(colors.white)
    canvas.setFont("Helvetica-Bold", 30)
    canvas.drawCentredString(w / 2, h * 0.5 + 34, "Plano de Expansão")
    canvas.drawCentredString(w / 2, h * 0.5 + 2, "de Canais")
    canvas.setFillColor(colors.HexColor("#94a3b8"))
    canvas.setFont("Helvetica", 12.5)
    canvas.drawCentredString(w / 2, h * 0.5 - 34, "Novos canais reaproveitando a automação atual")
    canvas.setFillColor(AMBER)
    canvas.setFont("Helvetica-Bold", 11)
    canvas.drawCentredString(w / 2, h * 0.5 - 58, "Custo marginal ~ R$ 0  ·  os arquivos já são gerados todo dia")
    canvas.setFillColor(colors.HexColor("#475569"))
    canvas.setFont("Helvetica", 9)
    canvas.drawCentredString(w / 2, 34 * mm, "Hoje: Instagram + Spotify  ->  meta: presença onde o dentista já está")
    canvas.setFillColor(colors.HexColor("#334155"))
    canvas.setFont("Helvetica", 8)
    canvas.drawCentredString(w / 2, 20 * mm, "Documento interno · estratégia de distribuição")
    canvas.restoreState()


def callout(title, body, bg="#EFF6FF", border=BLUE, tcolor=BLUE):
    inner = [Paragraph("<b>%s</b>" % title, S("cot", fontName="Helvetica-Bold", fontSize=10.5, textColor=tcolor, spaceAfter=4)),
             Paragraph(body, st_note)]
    t = Table([[inner]], colWidths=[165 * mm])
    t.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, -1), colors.HexColor(bg)),
        ("BOX", (0, 0), (-1, -1), 0.75, border),
        ("LEFTPADDING", (0, 0), (-1, -1), 12), ("RIGHTPADDING", (0, 0), (-1, -1), 12),
        ("TOPPADDING", (0, 0), (-1, -1), 10), ("BOTTOMPADDING", (0, 0), (-1, -1), 10),
    ]))
    return t


def channel_table(rows, col_labels, widths):
    data = [[Paragraph(c, st_cellh) for c in col_labels]]
    for r in rows:
        data.append([Paragraph(r[0], st_cellb)] + [Paragraph(c, st_cell) for c in r[1:]])
    t = Table(data, colWidths=widths, repeatRows=1)
    t.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, 0), NAVY),
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ("TOPPADDING", (0, 0), (-1, -1), 6), ("BOTTOMPADDING", (0, 0), (-1, -1), 6),
        ("LEFTPADDING", (0, 0), (-1, -1), 7), ("RIGHTPADDING", (0, 0), (-1, -1), 7),
        ("ROWBACKGROUNDS", (0, 1), (-1, -1), [colors.white, BGSOFT]),
        ("BOX", (0, 0), (-1, -1), 0.5, LINE), ("INNERGRID", (0, 0), (-1, -1), 0.5, LINE),
    ]))
    return t


# ── Documento ────────────────────────────────────────────────────────────────
doc = BaseDocTemplate(
    OUT, pagesize=A4,
    leftMargin=20 * mm, rightMargin=20 * mm, topMargin=20 * mm, bottomMargin=18 * mm,
    title="OdontoFeed — Plano de Expansão de Canais", author="OdontoFeed",
)
frame = Frame(doc.leftMargin, doc.bottomMargin, doc.width, doc.height, id="main")
doc.addPageTemplates([
    PageTemplate(id="cover", frames=[frame], onPage=cover),
    PageTemplate(id="content", frames=[frame], onPage=header_footer),
])

story = []
story.append(NextPageTemplate("content"))
story.append(PageBreak())

# ── Introdução ──
story.append(Paragraph("A ideia central", st_h1))
story.append(HRFlowable(width="100%", thickness=2, color=BLUE, spaceAfter=10))
story.append(Paragraph(
    "Hoje o OdontoFeed está em <b>Instagram</b> e <b>Spotify</b>. Mas todo dia a automação já "
    "produz muito mais do que isso consome: um digest científico por especialidade (texto), "
    "os áudios do podcast (feed RSS), o carrossel e o reel do Instagram, capas e links. "
    "A estratégia deste plano é simples: <b>não gerar nada novo</b> — apenas <b>distribuir os "
    "arquivos que já existem</b> para os canais onde o dentista brasileiro também está. "
    "Cada canal abaixo consome um ativo que o pipeline já cria, então o <b>custo marginal é ~R$ 0</b> "
    "(só tempo de configuração e, em alguns, um pouco de automação reaproveitando o mesmo "
    "GitHub Actions que já publica no Instagram).", st_body))

story.append(callout(
    "★ A jogada de maior retorno e custo zero",
    "O podcast já é um <b>feed RSS</b>. O mesmo feed que alimenta o Spotify pode ser submetido, "
    "sem gerar nada de novo, ao Apple Podcasts, YouTube Music, Amazon Music, Deezer, Castbox e "
    "Pocket Casts. <b>Um feed -> presença em 7+ plataformas de áudio</b>, de graça.",
    bg="#FFFBEB", border=AMBER, tcolor=colors.HexColor("#B45309")))

# ── Seção 1: inventário de ativos ──
story.append(Paragraph("1. O que já geramos todo dia (e mal usamos)", st_h2))
story.append(Paragraph(
    "Antes dos canais, o inventário. Cada linha é um ativo que o pipeline já produz "
    "automaticamente — e que hoje serve a um ou dois canais só.", st_body))
story.append(channel_table(
    [
        ["Feed RSS do podcast", "Áudio diário por especialidade + edição completa (~8 min)", "Só Spotify"],
        ["Áudios MP3", "Um por estudo, prontos no Storage", "Spotify / site"],
        ["Carrossel", "Imagens 1080×1350 por especialidade", "Só Instagram"],
        ["Reel / vídeo curto", "Vídeo vertical com o áudio do episódio", "Só Instagram"],
        ["Texto do digest", "Título PT, resumo e resumo completo por estudo", "E-mail / site"],
        ["Links + capas", "Site, cadastro, ?ref=, capa quadrada, ícones", "Vários"],
    ],
    ["Ativo (já automático)", "O que é", "Onde usamos hoje"],
    [40 * mm, 78 * mm, 47 * mm]))
story.append(Spacer(1, 6))
story.append(Paragraph(
    "A tese: cada ativo acima serve <b>muito mais</b> canais do que serve hoje. Os próximos "
    "passos apenas os redirecionam.", st_note))

# ── Seção 2: Nível 1 ──
story.append(Paragraph("2. Nível 1 — ganhos imediatos, custo zero, mesmos arquivos", st_h2))
story.append(Paragraph(
    "Nenhuma geração nova. Só configuração (a maioria uma única vez) ou cross-post nativo.", st_body))
story.append(channel_table(
    [
        ["Diretórios de podcast", "O MESMO feed RSS", "Submeter o feed 1× em cada: Apple Podcasts, YouTube Music, Amazon Music, Deezer, Castbox, Pocket Casts", "R$ 0", "Baixo (1×)"],
        ["YouTube (canal)", "Reels + áudio+capa", "Reels viram Shorts; episódio vira vídeo (áudio + capa via ffmpeg no Actions)", "R$ 0", "Médio"],
        ["TikTok", "Reels já prontos", "Publicar o mesmo MP4 vertical (Content Posting API)", "R$ 0", "Médio"],
        ["Facebook (página) + Threads", "Posts do Instagram", "Cross-post nativo da Meta (mesmo Graph API já usado no IG)", "R$ 0", "Baixo"],
        ["Telegram (canal)", "Texto do digest + link + áudio", "Bot API (grátis) postando no mesmo passo do Actions", "R$ 0", "Baixo"],
    ],
    ["Canal", "Reaproveita", "Como (automação)", "Custo", "Esforço"],
    [30 * mm, 26 * mm, 68 * mm, 14 * mm, 17 * mm]))
story.append(Spacer(1, 7))
story.append(callout(
    "Por que estes primeiro",
    "Todos consomem um arquivo que já existe e não competem com o Instagram/Spotify — ampliam o "
    "alcance do MESMO conteúdo. Os diretórios de podcast e o cross-post Meta são praticamente "
    "'ligar um interruptor'; Telegram e YouTube reaproveitam o pipeline do GitHub Actions que "
    "já publica no Instagram.",
    bg="#ECFDF5", border=GREEN, tcolor=colors.HexColor("#047857")))

# ── Seção 3: Nível 2 ──
story.append(Paragraph("3. Nível 2 — descoberta e tráfego orgânico (custo zero, algum setup)", st_h2))
story.append(channel_table(
    [
        ["Acervo público + SEO", "Texto do digest", "Publicar as edições diárias como páginas indexáveis no site (Google) — tráfego orgânico perene", "R$ 0*", "Médio"],
        ["LinkedIn (página)", "Carrossel + legenda", "Post do carrossel (documento) para público profissional/clínicas", "R$ 0", "Baixo"],
        ["Pinterest", "Imagens do carrossel", "Cada slide vira um pin que linka ao site (busca visual de cauda longa)", "R$ 0", "Baixo"],
        ["Canal do WhatsApp", "Digest + link", "Canal de transmissão (grátis) com a chamada do dia -> cadastro", "R$ 0", "Baixo"],
    ],
    ["Canal", "Reaproveita", "Como", "Custo", "Esforço"],
    [30 * mm, 26 * mm, 68 * mm, 14 * mm, 17 * mm]))
story.append(Spacer(1, 5))
story.append(Paragraph(
    "<b>*</b> Hospedagem já inclusa no site (Netlify). O Acervo é o de maior retorno de longo "
    "prazo: o conteúdo já é escrito todo dia — publicá-lo de forma pública e indexável transforma "
    "meses de curadoria num acervo que o Google indexa e recomenda sozinho, sem custo por acesso.", st_note))

# ── Seção 4: Nível 3 ──
story.append(Paragraph("4. Nível 3 — oportunista / manual (quando houver tempo)", st_h2))
for b in [
    "<b>Comunidades e fóruns</b> (grupos de dentistas, Reddit r/Dentistry, comunidades de especialidade): compartilhar o estudo do dia com o link — manual, alto valor, baixa frequência.",
    "<b>Parcerias com perfis de odontologia</b>: oferecer o áudio/carrossel pronto para colegas republicarem (já temos o Plano de Divulgação e o material de stories).",
    "<b>Google Podcasts / agregadores menores</b>: qualquer diretório que aceite RSS entra sem esforço adicional — é sempre o mesmo feed.",
]:
    story.append(Paragraph("•&nbsp;&nbsp;" + b, st_body))

# ── Seção 5: roadmap ──
story.append(Paragraph("5. Sequência sugerida (sem estourar custo)", st_h2))
story.append(channel_table(
    [
        ["Fase 1 — esta semana", "Sem desenvolvimento", "Submeter o feed RSS aos diretórios de podcast; ligar cross-post IG -> Facebook + Threads; abrir canais no Telegram e no YouTube"],
        ["Fase 2 — 2 a 4 semanas", "Automação leve (Actions)", "Auto-post no Telegram no mesmo passo do digest; Shorts no YouTube a partir dos Reels; página no LinkedIn e Pinterest"],
        ["Fase 3 — quando fizer sentido", "Maior fricção de API", "TikTok (aprovação da API); Acervo público + SEO; presença em comunidades"],
    ],
    ["Fase", "Investimento", "O que fazer"],
    [38 * mm, 40 * mm, 87 * mm]))
story.append(Spacer(1, 7))
story.append(callout(
    "Regra de ouro para não criar custo",
    "Só entra canal que consuma um arquivo que o pipeline JÁ gera. Nada de conteúdo feito à mão "
    "por canal — se precisar produzir algo novo e recorrente, sai do escopo 'custo zero' e vira "
    "decisão à parte.",
    bg="#EFF6FF", border=BLUE, tcolor=BLUE))

# ── Seção 6: medição ──
story.append(Paragraph("6. Como medir cada canal", st_h2))
story.append(Paragraph(
    "Para saber o que funciona sem gastar com analytics: um <b>código de indicação (?ref=) por "
    "canal</b>. O link do Telegram usa <b>?ref=tg</b>, o do YouTube <b>?ref=yt</b>, e assim por "
    "diante. Aí o painel de admin mostra de onde vieram os cadastros e os acessos.", st_body))
story.append(channel_table(
    [
        ["Acessos e aberturas/dia", "Admin -> Acessos de hoje", "Tendência de alcance total subindo"],
        ["Cadastros por canal", "?ref= por canal (ex.: ?ref=tg, ?ref=yt)", "Descobrir os 2-3 canais que convertem"],
        ["Ouvintes de podcast", "Painel de cada diretório (grátis)", "Crescimento distribuído, não só Spotify"],
        ["Tráfego orgânico", "Search Console (grátis) no Acervo", "Cliques do Google subindo mês a mês"],
    ],
    ["Indicador", "Onde ver", "Sinal de sucesso"],
    [46 * mm, 62 * mm, 57 * mm]))
story.append(Spacer(1, 8))
story.append(callout(
    "O resumo em uma frase",
    "O conteúdo caro (curadoria + áudio + arte) já está pago e automatizado. Este plano só o "
    "espalha: um feed RSS em 7 tocadores, os reels em YouTube e TikTok, o carrossel em LinkedIn e "
    "Pinterest, o digest no Telegram e num acervo que o Google indexa — tudo a custo marginal zero.",
    bg="#ECFDF5", border=GREEN, tcolor=colors.HexColor("#047857")))

doc.build(story)
print("PDF gerado:", OUT)
