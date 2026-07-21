#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Gera o PDF branded do Plano de Divulgação do OdontoFeed.

Uso: python3 scripts/gerar-plano-divulgacao-pdf.py [saida.pdf]
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
GREEN  = colors.HexColor("#25D366")

OUT = sys.argv[1] if len(sys.argv) > 1 else "OdontoFeed-Plano-Divulgacao.pdf"

# As fontes base do ReportLab (Helvetica) não têm glifos de emoji — sairiam como
# quadrados. Trocamos os emojis por marcadores textuais equivalentes para o PDF
# (as mensagens com emojis de verdade ficam no dashboard e no botão WhatsApp).
_EMOJI_MAP = {
    "👉": "»", "⭐": "★", "💡": "•", "•": "•", "🦷": "", "📚": "", "💬": "",
    "🎁": "", "📷": "", "🎧": "", "📋": "", "✓": "✓", "🔗": "",
}
def clean(s):
    for k, v in _EMOJI_MAP.items():
        s = s.replace(k, v)
    # remove emojis remanescentes (pictográficos >= 0x1F000) e seletores/ZWJ,
    # preservando tipografia (— » • ★ ✓).
    out = "".join(ch for ch in s if ord(ch) < 0x1F000 and ord(ch) not in (0xFE0F, 0x200D))
    while "  " in out:
        out = out.replace("  ", " ")
    return out.strip()

_RLParagraph = Paragraph
def Paragraph(text, style=None):  # noqa: F811 — wrapper que limpa emojis
    return _RLParagraph(clean(text), style)

styles = getSampleStyleSheet()

def S(name, **kw):
    base = kw.pop("parent", styles["Normal"])
    return ParagraphStyle(name, parent=base, **kw)

st_h1     = S("h1", fontName="Helvetica-Bold", fontSize=19, textColor=INK, spaceAfter=4, leading=23)
st_h2     = S("h2", fontName="Helvetica-Bold", fontSize=13.5, textColor=BLUE, spaceBefore=16, spaceAfter=7, leading=17)
st_h3     = S("h3", fontName="Helvetica-Bold", fontSize=11, textColor=INK, spaceBefore=9, spaceAfter=3, leading=14)
st_body   = S("body", fontSize=10, textColor=SLATE, leading=15.5, spaceAfter=7, alignment=TA_LEFT)
st_small  = S("small", fontSize=8.5, textColor=MUTED, leading=12)
st_msg    = S("msg", fontSize=9.5, textColor=INK, leading=15, spaceAfter=3, leftIndent=2)
st_msglbl = S("msglbl", fontName="Helvetica-Bold", fontSize=10, textColor=BLUE, spaceAfter=4)
st_note   = S("note", fontSize=9, textColor=SLATE, leading=14)
st_cell   = S("cell", fontSize=9, textColor=SLATE, leading=13)
st_cellh  = S("cellh", fontName="Helvetica-Bold", fontSize=9, textColor=colors.white, leading=13)
st_cover_t= S("covt", fontName="Helvetica-Bold", fontSize=30, textColor=colors.white, leading=34, alignment=TA_CENTER)
st_cover_s= S("covs", fontSize=13, textColor=colors.HexColor("#94a3b8"), leading=19, alignment=TA_CENTER)


def header_footer(canvas, doc):
    canvas.saveState()
    w, h = A4
    # Faixa superior fina
    canvas.setFillColor(NAVY)
    canvas.rect(0, h - 14 * mm, w, 14 * mm, fill=1, stroke=0)
    canvas.setFillColor(CYAN)
    canvas.setFont("Helvetica-Bold", 11)
    canvas.drawString(20 * mm, h - 9.4 * mm, "OdontoFeed")
    canvas.setFillColor(colors.HexColor("#94a3b8"))
    canvas.setFont("Helvetica", 8)
    canvas.drawRightString(w - 20 * mm, h - 9.4 * mm, "Plano de Divulgação")
    # Rodapé
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
    # Barra de acento
    canvas.setFillColor(BLUE)
    canvas.rect(0, h * 0.5 + 60, w, 4, fill=1, stroke=0)
    canvas.setFillColor(CYAN)
    canvas.setFont("Helvetica-Bold", 15)
    canvas.drawCentredString(w / 2, h * 0.5 + 120, "OdontoFeed")
    canvas.setFillColor(colors.white)
    canvas.setFont("Helvetica-Bold", 32)
    canvas.drawCentredString(w / 2, h * 0.5 + 30, "Plano de Divulgação")
    canvas.setFillColor(colors.HexColor("#94a3b8"))
    canvas.setFont("Helvetica", 13)
    canvas.drawCentredString(w / 2, h * 0.5, "Crescimento por indicação — comece pelo seu WhatsApp")
    canvas.setFont("Helvetica", 10)
    canvas.drawCentredString(w / 2, h * 0.5 - 30, "As 3 mensagens prontas  ·  Programa Indique e Ganhe  ·  Roteiro de execução")
    # rodapé da capa
    canvas.setFillColor(colors.HexColor("#475569"))
    canvas.setFont("Helvetica", 9)
    canvas.drawCentredString(w / 2, 40 * mm, "Ciência odontológica todo dia — e-mail, site e podcast")
    canvas.setFillColor(AMBER)
    canvas.setFont("Helvetica-Bold", 10)
    canvas.drawCentredString(w / 2, 32 * mm, "Premium 100% grátis nesta fase")
    canvas.setFillColor(colors.HexColor("#334155"))
    canvas.setFont("Helvetica", 8)
    canvas.drawCentredString(w / 2, 20 * mm, "Documento interno · 21/07/2026")
    canvas.restoreState()


def msg_box(label, lines, accent=BLUE):
    """Caixa de mensagem de WhatsApp (rótulo + corpo em card)."""
    inner = [Paragraph(label, st_msglbl)]
    for ln in lines:
        inner.append(Paragraph(ln, st_msg))
    t = Table([[inner]], colWidths=[165 * mm])
    t.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, -1), BGSOFT),
        ("BOX", (0, 0), (-1, -1), 0.75, LINE),
        ("LINEBEFORE", (0, 0), (0, -1), 3, accent),
        ("LEFTPADDING", (0, 0), (-1, -1), 12),
        ("RIGHTPADDING", (0, 0), (-1, -1), 12),
        ("TOPPADDING", (0, 0), (-1, -1), 10),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 10),
    ]))
    return t


def callout(title, body, bg="#EFF6FF", border=BLUE, tcolor=BLUE):
    inner = [Paragraph("<b>%s</b>" % title, S("cot", fontName="Helvetica-Bold", fontSize=10.5, textColor=tcolor, spaceAfter=4)),
             Paragraph(body, st_note)]
    t = Table([[inner]], colWidths=[165 * mm])
    t.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, -1), colors.HexColor(bg)),
        ("BOX", (0, 0), (-1, -1), 0.75, border),
        ("LEFTPADDING", (0, 0), (-1, -1), 12),
        ("RIGHTPADDING", (0, 0), (-1, -1), 12),
        ("TOPPADDING", (0, 0), (-1, -1), 10),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 10),
    ]))
    return t


# ── Documento ────────────────────────────────────────────────────────────────
doc = BaseDocTemplate(
    OUT, pagesize=A4,
    leftMargin=20 * mm, rightMargin=20 * mm,
    topMargin=20 * mm, bottomMargin=18 * mm,
    title="OdontoFeed — Plano de Divulgação", author="OdontoFeed",
)
frame = Frame(doc.leftMargin, doc.bottomMargin, doc.width, doc.height, id="main")
doc.addPageTemplates([
    PageTemplate(id="cover", frames=[frame], onPage=cover),
    PageTemplate(id="content", frames=[frame], onPage=header_footer),
])

story = []
story.append(NextPageTemplate("content"))  # capa desenhada no canvas
story.append(PageBreak())

# ── Introdução ──
story.append(Paragraph("Por onde começar", st_h1))
story.append(HRFlowable(width="100%", thickness=2, color=BLUE, spaceAfter=10))
story.append(Paragraph(
    "O objetivo desta fase é colocar o OdontoFeed na mão de dentistas de verdade — "
    "começando pela rede de contatos do fundador no WhatsApp e crescendo por indicação, "
    "onde cada dentista traz o próximo. Enquanto a forma de pagamento não está no ar, "
    "<b>o Premium está 100% grátis</b> — esse é o maior argumento de conversão que temos "
    "agora. Ele está embutido em todas as mensagens e no convite de indicação.", st_body))

story.append(callout(
    "⭐ O gancho que abre portas",
    "Hoje o plano Premium está de graça para que todos conheçam 100% do OdontoFeed. "
    "Toda mensagem diz isso — é o que faz a pessoa parar e se cadastrar.",
    bg="#FFFBEB", border=AMBER, tcolor=colors.HexColor("#B45309")))

# ── Seção 1: as mensagens ──
story.append(Paragraph("1. As 3 mensagens de WhatsApp", st_h2))
story.append(Paragraph(
    "Três versões para três situações. Todas carregam o aviso do Premium grátis e o "
    "convite para indicar. Troque <b>SEULINK</b> pelo seu link de indicação (seção 2). "
    "Mande a Mensagem 1 para contatos próximos (individual), a Mensagem 2 em grupos, e a "
    "Mensagem 3 como status ou recado curto.", st_body))

story.append(KeepTogether(msg_box("Mensagem 1 — amigos próximos (individual)", [
    "Oi! 🦷 Tô com um projeto que acho que vai te ajudar todo dia: o <b>OdontoFeed</b>.",
    "Todo dia de manhã ele te manda um resumo da ciência mais recente da <b>sua especialidade</b> "
    "— direto do PubMed, resumido pra leitura rápida. Tem e-mail, site com os resumos completos, "
    "e até <b>podcast diário no Spotify</b> pra ouvir indo pro consultório.",
    "⭐ <b>É importante:</b> hoje o <b>plano Premium está de graça</b> pra que todo mundo conheça "
    "100% do OdontoFeed. Então aproveita pra se cadastrar e conhecer o app inteiro, sem pagar nada.",
    "Entra pelo meu link 👉 <b>SEULINK</b>",
    "<i>(Se curtir, me fala o que achou — tô ouvindo todo mundo pra deixar redondo.)</i>",
])))
story.append(Spacer(1, 9))
story.append(KeepTogether(msg_box("Mensagem 2 — grupos de dentistas / colegas (broadcast)", [
    "Pessoal, deixando uma recomendação que vale pra todo mundo aqui do grupo 🦷📚",
    "<b>OdontoFeed</b> — atualização científica odontológica <b>todo dia</b>, na sua especialidade. "
    "Você acorda com um resumo dos estudos mais recentes (PubMed), lê em 2 minutos ou ouve o "
    "<b>podcast no Spotify</b>. Curadoria de verdade, com transparência sobre o uso de IA.",
    "⭐ <b>Importante:</b> neste momento o <b>plano Premium está 100% grátis</b> pra todos conhecerem "
    "o app completo — biblioteca pessoal, comparação de estudos e a assistente de IA. Aproveitem "
    "pra se cadastrar e testar tudo enquanto está liberado.",
    "Cadastro pelo meu link 👉 <b>SEULINK</b>",
], accent=CYAN)))
story.append(Spacer(1, 9))
story.append(KeepTogether(msg_box("Mensagem 3 — recado curto / status", [
    "🦷 Ciência odontológica da <b>sua especialidade</b>, todo dia, no e-mail e no Spotify: "
    "<b>OdontoFeed</b>.",
    "⭐ O <b>Premium está grátis</b> agora pra conhecer o app 100%. Aproveita e se cadastra 👉 "
    "<b>SEULINK</b>",
], accent=GREEN)))

# ── Seção 2: indicação ──
story.append(Paragraph("2. Indique um colega, ganhe Premium", st_h2))
story.append(Paragraph(
    "Cada dentista cadastrado tem um <b>link de indicação próprio</b> dentro da conta "
    "(dashboard → aba <b>Amigos</b> → “Indique um colega, ganhe Premium”).", st_body))
story.append(callout(
    "A regra",
    "A cada <b>3 colegas</b> que se cadastrarem pelo seu link, você ganha <b>1 mês grátis de "
    "Premium</b>. Sem limite — indique quantos quiser."))
story.append(Spacer(1, 8))
for b in [
    "O link tem o formato <b>odontofeed.com/?ref=SEUCODIGO</b>.",
    "Quando alguém se cadastra por ele, a indicação é <b>contada automaticamente</b> e aparece na "
    "barra de progresso do dashboard.",
    "Como nesta fase todos já estão no Premium de cortesia, os meses ganhos ficam <b>creditados na "
    "conta</b> e valem quando o Premium virar pago. <b>Nada se perde.</b>",
    "Os botões <b>Copiar</b> e <b>WhatsApp</b> já entregam a mensagem pronta (com o aviso do "
    "Premium grátis embutido).",
]:
    story.append(Paragraph("•&nbsp;&nbsp;" + b, st_body))
story.append(callout(
    "Por que isso cresce sozinho",
    "Cada pessoa que entra recebe o próprio link e o mesmo incentivo — encaminhar para os colegas "
    "dela. É o mesmo movimento que você faz agora, repetido por cada novo dentista.",
    bg="#ECFDF5", border=colors.HexColor("#10B981"), tcolor=colors.HexColor("#047857")))

# ── Seção 3: roteiro ──
story.append(Paragraph("3. Roteiro de execução", st_h2))
passos = [
    ("Pegue seu link", "No dashboard (aba Amigos). É o <b>?ref=</b> que identifica todas as suas indicações."),
    ("Semana 1 — individual", "Mande a Mensagem 1 para os dentistas do seu WhatsApp, um a um (converte mais que broadcast). Meta: 30–50 envios."),
    ("Semana 1–2 — grupos", "Poste a Mensagem 2 nos grupos de dentistas, colegas de turma, especialização, congressos."),
    ("Sempre ligado — status", "Deixe a Mensagem 3 no status do WhatsApp e nas bios (Instagram: odontofeed.com)."),
    ("Peça a indicação de volta", "Ao responder quem entrou: “pega teu link na aba Amigos e manda pros teus colegas — a cada 3 você ganha um mês de Premium”."),
    ("Acompanhe", "O progresso aparece no dashboard; o painel de cadastros mostra o crescimento diário."),
]
rows = [[Paragraph("<b>%d</b>" % (i + 1), st_cellh), Paragraph("<b>%s</b>" % t, st_cell), Paragraph(d, st_cell)]
        for i, (t, d) in enumerate(passos)]
tbl = Table(rows, colWidths=[10 * mm, 42 * mm, 113 * mm])
tbl.setStyle(TableStyle([
    ("BACKGROUND", (0, 0), (0, -1), BLUE),
    ("VALIGN", (0, 0), (-1, -1), "TOP"),
    ("TOPPADDING", (0, 0), (-1, -1), 7),
    ("BOTTOMPADDING", (0, 0), (-1, -1), 7),
    ("LEFTPADDING", (0, 0), (-1, -1), 8),
    ("RIGHTPADDING", (0, 0), (-1, -1), 8),
    ("ROWBACKGROUNDS", (1, 0), (-1, -1), [colors.white, BGSOFT]),
    ("LINEBELOW", (0, 0), (-1, -1), 0.5, LINE),
    ("ALIGN", (0, 0), (0, -1), "CENTER"),
]))
story.append(tbl)

# ── Seção 4: canais ──
story.append(Paragraph("4. Canais de apoio (já no ar)", st_h2))
for b in [
    "<b>Site:</b> odontofeed.com — cadastro + resumos completos + dashboard.",
    "<b>Instagram:</b> @odontofeedbr — carrossel diário por especialidade + Reels com o áudio do podcast.",
    "<b>Spotify:</b> odontofeed.com/spotify — edição diária em áudio (~8 min).",
    "<b>E-mail:</b> o digest diário leva de volta ao dashboard, onde tudo acontece.",
]:
    story.append(Paragraph("•&nbsp;&nbsp;" + b, st_body))
story.append(Paragraph(
    "Todos os canais apontam para o cadastro, e o cadastro entra em Premium de cortesia — "
    "o funil está fechado e coerente.", st_body))

# ── Seção 5: métricas ──
story.append(Paragraph("5. O que medir", st_h2))
mrows = [[Paragraph("Indicador", st_cellh), Paragraph("Onde ver", st_cellh), Paragraph("Meta desta fase", st_cellh)]]
for a, b, c in [
    ("Novos cadastros/dia", "Painel de cadastros (Firestore)", "Crescimento constante"),
    ("Indicações por usuário", "Dashboard → Amigos", "≥ 1 por usuário ativo"),
    ("Cadastros via ?ref=", "Campo referredBy nos cadastros", "Parcela crescente do total"),
    ("Retenção", "Aberturas de e-mail / uso do dashboard", "Engajamento diário"),
]:
    mrows.append([Paragraph(a, st_cell), Paragraph(b, st_cell), Paragraph(c, st_cell)])
mtbl = Table(mrows, colWidths=[48 * mm, 62 * mm, 55 * mm])
mtbl.setStyle(TableStyle([
    ("BACKGROUND", (0, 0), (-1, 0), NAVY),
    ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
    ("TOPPADDING", (0, 0), (-1, -1), 7),
    ("BOTTOMPADDING", (0, 0), (-1, -1), 7),
    ("LEFTPADDING", (0, 0), (-1, -1), 9),
    ("ROWBACKGROUNDS", (0, 1), (-1, -1), [colors.white, BGSOFT]),
    ("BOX", (0, 0), (-1, -1), 0.5, LINE),
    ("INNERGRID", (0, 0), (-1, -1), 0.5, LINE),
]))
story.append(mtbl)
story.append(Spacer(1, 8))
story.append(callout(
    "O sinal de que o loop pegou",
    "A fatia de novos cadastros que vêm com <b>referredBy</b> preenchido subindo semana a semana. "
    "Quando isso acontece, o crescimento deixa de depender só dos seus envios.",
    bg="#ECFDF5", border=colors.HexColor("#10B981"), tcolor=colors.HexColor("#047857")))

doc.build(story)
print("PDF gerado:", OUT)
