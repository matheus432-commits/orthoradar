# Auditoria de conteúdo — Ortodontia, Módulo 2 (Más oclusões)

Registro das rodadas de detecção de informação falsa, errada ou mal interpretada
nas 16 páginas do módulo, na mesma rotina do Módulo 1 (`AUDITORIA-M1.md`):
leitura crítica durante a escrita, confirmação externa dos pontos marcados e
releitura final com testes automatizados e render das figuras.

O teste `netlify/functions/_lib/__tests__/campus-conteudo.test.js` trava os
fatos conferidos aqui (bloco "módulo 2"). Toda página continua em `rascunho` e
nada é visível ao aluno antes da assinatura do validador.

Regras mantidas: número populacional, idade média e ponto de divergência entre
autores ficam com `[VERIFICAR]`; frases que citam um erro para negá-lo não
contam como afirmação; nenhuma referência recebe PMID, DOI ou URL à mão.

## Rodada 1 — leitura crítica durante a escrita

| # | Página | Achado | Ação |
|---|--------|--------|------|
| 1 | `maoclusao-etiologia-moyers` | O nome do programa, "teoria da equivalência de Moyers", não foi localizado como denominação na obra de Moyers nem em busca dirigida. O conteúdo correspondente é a equação ortodôntica de Dockrell (1952), a classificação etiológica em sete grupos e o princípio de que causas diferentes produzem o mesmo resultado (equifinalidade). | Página escrita com esse conteúdo; a denominação do programa ficou registrada no campo de autoria com `[VERIFICAR]` para o validador confirmar nome e fonte. |
| 2 | `maoclusao-tipo-assimetrias` | O texto inicial dizia que o "crescimento excessivo de um côndilo" produzia tanto o alongamento quanto a hiperplasia hemimandibular. Em Obwegeser e Makek (1986), o alongamento hemimandibular é horizontal e a cabeça do côndilo pode não estar aumentada. | Reescrito: "crescimento excessivo de um lado da mandíbula"; acrescentado que no alongamento o côndilo pode parecer normal. |
| 3 | `maoclusao-tipo-classe-iii` | "Prognatismo mandibular puro menos frequente do que a imagem clássica sugere" era vago. Ellis e McNamara (1984): retrusão maxilar pura 19,5% e prognatismo mandibular puro 19,2%; combinações somam o restante. | Reescrito com as proporções parecidas (em torno de um quinto cada) e `[VERIFICAR]`. |
| 4 | `maoclusao-outras` | Data de Simon: a obra alemã é de 1922; a edição em inglês, de 1926, e algumas fontes citam 1926. | Mantido 1922 (citação usual nos textos brasileiros); divergência registrada aqui. |
| 5 | várias | Parágrafos acima de 520 caracteres em 7 páginas (limite da especificação). | Divididos em fronteira de frase por rotina automática; validador estrutural verde em todas. |

## Rodada 2 — confirmação externa dos pontos marcados

| Tema | O que a página diz | O que as fontes dizem | Decisão |
|------|--------------------|------------------------|---------|
| Angle | 1899; relação mesiodistal dos primeiros molares; três classes; subdivisão nomeia o lado alterado | Angle EH, Dental Cosmos 1899; convenção da subdivisão varia entre serviços | Confirmado; convenção com `[VERIFICAR]` |
| Dewey e Lischer | Dewey 1915: Classe I tipos 1 a 5 (apinhamento, protrusão, cruzada anterior, cruzada posterior, migração), Classe III tipos 1 a 3; Lischer 1912: neutro, disto e mesioclusão, versões | Revisão de 2024 e fontes de ensino confirmam a lista de Dewey e os termos de Lischer, incluindo torsiversão (giroversão) | Confirmado |
| Simon | Frankfurt: atração e abstração; orbital: protração e retração; sagital mediano: contração e distração; lei do canino no terço distal do canino superior | Oxford Reference e revisões confirmam planos, termos e lei do canino; data 1922/1926 | Confirmado; data registrada |
| Ackerman e Proffit | 1969, cinco características em diagrama de conjuntos; rotações em 2007 | Ackerman e Proffit, Am J Orthod 1969; Ackerman, Proffit, Sarver et al., 2007 | Confirmado |
| IOTN | Cinco graus pela pior característica, ordem MOCDO; limiares por grau | Brook e Shaw 1989; tabela do componente de saúde dentária: trespasse 3,5 a 6 com lábios incompetentes grau 3, 6 a 9 grau 4, maior que 9 grau 5; invertido maior que 3,5 com dificuldade grau 5; cruzadas com discrepância maior que 2 mm grau 4; deslocamentos 2 a 4 grau 3; erupção impedida grau 5 | Confirmado; limiares mantidos com `[VERIFICAR]` para aplicação formal |
| DAI | Até 25, 26 a 30, 31 a 35, 36 ou mais; dez medidas com pesos; OMS | Cons, Jenny e Kohout 1986; OMS 1997; faixas idênticas em revisões | Confirmado |
| Tanaka e Johnston | Metade da soma dos incisivos inferiores + 10,5 (inferior) e + 11 (superior) | Tanaka e Johnston, JADA 1974; validações posteriores | Confirmado; `[VERIFICAR]` mantido pela variação populacional |
| Dockrell e Moyers | Causa, tempo, tecido, resultado (Dockrell, Dental Record 1952); sete grupos etiológicos | Fontes de ensino e citações confirmam a equação e a lista de sete grupos | Confirmado |
| Tríade de Graber | Frequência, duração, intensidade; limiar de várias horas por dia | Graber 1959; textos citam 4 a 6 horas por dia como mínimo para deformar | Confirmado; limiar com `[VERIFICAR]` |
| Canino palatino | Extração do decíduo redireciona boa parte dos casos | Ericson e Kurol 1988: normalização em 78% (36 de 46), em crianças de 10 a 13 anos | Confirmado; percentual não inserido na página (marcador mantido) |
| Molar ectópico | Parte se autocorrige | Bjerklin e Kurol; revisões: 59 a 66% reversíveis | Confirmado |
| Componentes da Classe II | Retrusão mandibular mais comum, maxila normal ou retruída | McNamara 1981 (já confirmado no Módulo 1) | Confirmado |
| Componentes da Classe III | Maxila deficiente participa de grande parte; formas puras em proporções parecidas | Ellis e McNamara 1984: 19,5% retrusão maxilar pura, 19,2% prognatismo puro | **Corrigido** (ver rodada 1, item 3) |
| Alongamento e hiperplasia hemimandibular | Alongamento horizontal, mento para o lado oposto, corpo no mesmo nível; hiperplasia vertical | Obwegeser e Makek 1986; revisões de 2018 e 2019 | **Corrigido** quanto ao côndilo (rodada 1, item 2) |
| Cruzada posterior | Não se corrige sozinha; forma mais comum é constrição bilateral com deslize | Kutin e Hawes 1969: autocorreção em 8% de 515 crianças; até 90% das cruzadas posteriores em desenvolvimento têm deslize lateral | Confirmado; página passou a citar "menos de um caso em dez" com `[VERIFICAR]` |
| Respiração bucal | Adenoidectomia com normalização parcial do padrão | Linder-Aronson 1970 (81 pacientes, seguimento 5 anos): 80% voltaram a respirar pelo nariz; crescimento mandibular maior que os controles | Confirmado |
| Prevalências (Classe II, III, mordida aberta, cruzada) | Frases qualitativas, sem números | Variam por população; cruzada posterior 8 a 22% na mista precoce | Mantidas qualitativas com `[VERIFICAR]` |

Ocorrências de `[VERIFICAR]` no módulo: 73 em 16 páginas, todas em número
populacional, idade média, limiar de índice ou divergência entre autores. A
lista com localização é impressa por
`node scripts/campus-progresso.js --modulo ortodontia/mas-oclusoes`.

## Rodada 3 — figuras, consistência interna e testes

- Todas as 16 páginas renderizadas a 1280 e 375 px sem overflow horizontal e
  sem erros de página; todos os `<use>` da biblioteca resolvidos.
- Revisão visual das 78 figuras: 23 correções de rótulos que saíam da caixa ou
  cruzavam elementos (p1, p3, p4, p6, p7, p8, p9, p10, p11, p12, p13, p14,
  p15, p16), todas commitadas em separado.
- Teste de conteúdo estendido com o bloco "módulo 2": 16 páginas no formato 2,
  fatos travados por página (Angle 1899 e subdivisão; Steiner 82/80/2; Wits no
  plano oclusal; Lischer, Dewey tipo 5, lei do canino; MOCDO, faixas do DAI,
  PAR como resultado; esqueleto herdado e alinhamento ambiental; tríade de
  Graber e deglutição como consequência; E antes do 6 e sapata distal;
  mesiodens e lateral conoide; Dockrell e sete grupos; faixas de discrepância e
  Tanaka e Johnston; retrusão mandibular e divisão 2 vira divisão 1; Classe III
  piora com o crescimento e pseudo-Classe III; mordida aberta pelos molares;
  mordida profunda completa; cruzada bilateral com deslize; mento para o lado
  curto na deficiência), padrões de erro (termo proibido, PMID/DOI/URL, emoji,
  "Distalização" com maiúscula, idades com `[VERIFICAR]`) e existência deste
  registro cobrindo as 16 páginas.
- Nenhuma contradição encontrada entre "Em um minuto", corpo, flashcards e
  gabaritos.

## Cobertura por página

| Página | Afirmações conferidas | Situação |
|--------|-----------------------|----------|
| `maoclusao-angle` | 1899, critério, três classes, divisões, subdivisão, pseudo-Classe III, limitações | confirmada; 1 `[VERIFICAR]` |
| `maoclusao-esqueletica` | SNA 82, SNB 80, ANB 2; Wits; McNamara; componentes; compensação dentária | confirmada; 8 `[VERIFICAR]` |
| `maoclusao-outras` | Lischer, Bennett, Dewey, Simon, Ackerman e Proffit, BSI, Andrews (chaves e elementos) | confirmada; data de Simon registrada; 1 `[VERIFICAR]` |
| `maoclusao-indices` | IOTN (MOCDO, graus, estético), DAI, PAR, ICON, normativa x percebida | confirmada; 7 `[VERIFICAR]` |
| `maoclusao-etiologia-genetica` | herdabilidade, gêmeos, Corruccini, três grupos de Proffit, equilíbrio, causas específicas | confirmada; 2 `[VERIFICAR]` |
| `maoclusao-etiologia-habitos` | tríade de Graber, quatro marcas, idade de correção, deglutição, respiração bucal, Linder-Aronson, Harvold | confirmada; 8 `[VERIFICAR]` |
| `maoclusao-etiologia-perda-precoce` | consequências por dente, maxila x mandíbula, raiz do sucessor, mantenedores, 6 condenado | confirmada; 3 `[VERIFICAR]` |
| `maoclusao-etiologia-anomalias` | agenesia, mesiodens, lateral conoide, canino (Ericson e Kurol), ectópico (Bjerklin e Kurol), anquilose, transposição | confirmada; 5 `[VERIFICAR]` |
| `maoclusao-etiologia-moyers` | Dockrell 1952, sete grupos, classificação pelo tecido, equifinalidade, tipos de Classe II de Moyers | denominação do programa registrada; 3 `[VERIFICAR]` |
| `maoclusao-tipo-classe-i` | discrepância e faixas, Moyers e Tanaka-Johnston, fontes de espaço, seriada, estabilidade (Little) | confirmada; 9 `[VERIFICAR]` |
| `maoclusao-tipo-classe-ii` | divisões, retrusão mandibular, lábio preso, trauma, quatro perguntas, divisão 2 vira divisão 1 | confirmada; 3 `[VERIFICAR]` |
| `maoclusao-tipo-classe-iii` | componentes (Ellis e McNamara), pseudo, crescimento, prognóstico, ferramentas | 1 correção; 8 `[VERIFICAR]` |
| `maoclusao-tipo-mordida-aberta` | dentária x esquelética, face longa, causas, alavanca, estabilidade | confirmada; 2 `[VERIFICAR]` |
| `maoclusao-tipo-mordida-profunda` | medida, completa e traumática, face curta, Spee, três métodos, ângulo interincisal | confirmada; 4 `[VERIFICAR]` |
| `maoclusao-tipo-mordida-cruzada` | tipos, funcional x verdadeira, causas, Kutin e Hawes, ferramentas por idade | 1 acréscimo (autocorreção rara); 4 `[VERIFICAR]` |
| `maoclusao-tipo-assimetrias` | quatro origens, Obwegeser e Makek, deficiência, exame, cintilografia, conduta | 1 correção; 5 `[VERIFICAR]` |

## Fontes consultadas na rodada 2

- Angle EH. Classification of malocclusion. Dental Cosmos 1899.
- Dewey M. 1915; revisão "Dewey's Modification for Angle's Class I Malocclusion: Revisited" (2024). Lischer BE, 1912.
- Simon P. Grundzüge einer systematischen Diagnostik der Gebissanomalien, 1922 (edição inglesa 1926); Oxford Reference.
- Ackerman JL, Proffit WR. Am J Orthod 1969. Ackerman JL, Proffit WR, Sarver DM, Ackerman MB, Kean MR. 2007.
- Brook PH, Shaw WC. Eur J Orthod 1989; tabela do componente de saúde dentária do IOTN.
- Cons NC, Jenny J, Kohout FJ. DAI, 1986; OMS, Oral Health Surveys 1997; revisões comparando DAI e IOTN.
- Tanaka MM, Johnston LE. JADA 1974; estudos de validação em populações diversas.
- Dockrell RB. Dental Record 1952; Moyers RE, Handbook of Orthodontics (sete grupos etiológicos).
- Graber TM. Thumb and finger sucking. Am J Orthod 1959; StatPearls sobre hábitos de sucção.
- Ericson S, Kurol J. Eur J Orthod 1988. Bjerklin K, Kurol J; revisão sistemática de autocorreção do molar ectópico (2024).
- McNamara JA Jr. Angle Orthod 1981. Ellis E, McNamara JA Jr. J Oral Maxillofac Surg 1984.
- Obwegeser HL, Makek MS. J Maxillofac Surg 1986; revisões de hiperplasia condilar (2018, 2019).
- Kutin G, Hawes RR. Am J Orthod 1969; metanálise de correção precoce da cruzada unilateral (2022).
- Linder-Aronson S. Acta Otolaryngol Suppl 1970; Linder-Aronson S, 1979.
- Proffit WR et al. Ortodontia Contemporânea; Graber LW et al. Ortodontia: princípios e técnicas atuais; Moyers RE. Ortodontia.

## Rodada 4 — resolução das marcações (05/09)

As marcações `[VERIFICAR]` deste módulo foram resolvidas por busca de fontes e retiradas; correções de texto e a lista de buscas estão em `AUDITORIA-RODADA-4.md`.
