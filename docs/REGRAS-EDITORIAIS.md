# Regras editoriais do OdontoFeed

Estas regras são vinculantes para todo conteúdo gerado pela plataforma — resumos,
notas editoriais, Achado da Semana e roteiros de podcast. Elas estão replicadas
nos prompts de IA (`_lib/claude.js`, `_lib/editorial-generator.js`,
`_lib/achado-semana.js`, `_lib/podcast-script.js`) e qualquer prompt novo DEVE
incorporá-las.

## 1. Direito autoral (Lei 9.610/98)

Fatos, descobertas e dados científicos **não** são protegidos por direito
autoral; a **expressão** (o texto do abstract/artigo) **é**.

Portanto:

- **PROIBIDO** reproduzir o abstract ou trechos do artigo, na íntegra ou em parte;
- **PROIBIDO** traduzir literalmente o abstract (tradução é obra derivada — exige licença);
- **PROIBIDO** parafrasear frase a frase seguindo a estrutura do original;
- **OBRIGATÓRIO** escrever texto original: extrair os fatos e achados e redigi-los
  com palavras e estrutura próprias;
- **OBRIGATÓRIO** citar a fonte (periódico, ano) e vincular ao original
  (PubMed/DOI) em toda exibição;
- O abstract entra nos prompts **apenas como contexto** (e truncado), nunca como
  material a ser vertido para o português.

O mesmo vale para o áudio: o roteiro do podcast narra o **nosso** resumo, nunca
o texto original. O fallback sem IA usa somente `resumo_pt` (texto próprio) —
nunca `abstract`.

## 2. Transparência sobre IA (CDC, art. 37)

- Todo conteúdo gerado por IA é declarado como tal: "gerados por IA com
  validação automatizada". **Nunca** afirmar revisão editorial humana enquanto
  ela não existir de fato.
- Números de prova social (assinantes, artigos resumidos) exibidos no site devem
  ser reais e verificáveis — nunca inflar fallbacks hardcoded.

## 3. Disclaimer clínico

Toda superfície de conteúdo (site, e-mail diário, recap semanal, podcast) deve
carregar o aviso de que o material é informativo, pode conter imprecisões e não
substitui a leitura do artigo original nem o julgamento clínico do profissional.
