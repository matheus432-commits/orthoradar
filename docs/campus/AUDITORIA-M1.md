# Auditoria de conteúdo — Ortodontia, Módulo 1 (Crescimento e desenvolvimento)

Registro das rodadas de detecção de informação falsa, errada ou mal interpretada
nas 14 páginas do módulo, pedidas pelo fundador em 04/09/2026 ("faça várias
rodadas de teste para detecção de possíveis erros de informações falsas ou
erradas ou mal interpretadas").

Este documento é o lastro do teste automatizado
`netlify/functions/_lib/__tests__/campus-conteudo.test.js`, que trava os fatos
conferidos aqui para que uma edição futura não os desfaça. Ele não substitui a
revisão do ortodontista validador: toda página continua em `rascunho` e nada é
visível ao aluno antes da assinatura.

Regras aplicadas em todas as rodadas:

- Só fato consolidado é afirmado sem marca. Número populacional (idade média,
  percentual, milímetros) fica com `[VERIFICAR]` até o validador assinar, mesmo
  quando a literatura consultada confirma a ordem de grandeza.
- Quando as fontes divergem, a página mostra a divergência em vez de escolher um
  número e apresentá-lo como consenso.
- Frases que citam um erro para negá-lo ("Onde o aluno erra", alternativa
  errada do autoteste, lado "mito" de um quadro) não contam como afirmação da
  página. O teste distingue prosa total de prosa afirmativa por isso.
- Nenhuma referência recebe PMID, DOI ou URL escrito à mão. Referência
  verificável só entra pela Biblioteca do OdontoFeed.

## Rodada 1 — leitura crítica, afirmação por afirmação

Método: releitura integral das 14 páginas, listando cada afirmação de fato
(anatomia, cronologia, autoria, resultado de estudo) e confrontando com o
conhecimento consolidado dos textos-base declarados em cada página
(`referenciasBase`). Três problemas encontrados e corrigidos:

| # | Página | Problema | Correção |
|---|--------|----------|----------|
| 1 | `ortodontia/maturacao-vertebras` | CS3 descrito como se exigisse "ao menos um corpo retangular horizontal" em C3/C4. No método de Baccetti, Franchi e McNamara (2005) o que define CS3 é a concavidade em C2 e C3 com C4 ainda plana; os corpos de C3 e C4 podem ser **trapezoides ou retangulares horizontais**. Corpo retangular obrigatório é CS4. | Redefinido em todos os pontos: "Em um minuto", infográfico, seção 5, fluxograma (nó 4), linha do tempo CS1–CS6, checagem, flashcard, explicação do autoteste e placeholder de imagem clínica. |
| 2 | `ortodontia/crescimento-teorias` | Referência a Petrovic citada de forma vaga, sem obra identificável. | Substituída pela obra concreta: Petrovic AG, Stutzmann JJ, Oudet CL. *Control processes in the postnatal growth of the condylar cartilage of the mandible*. In: McNamara JA Jr (ed). *Determinants of Mandibular Form and Growth*. Craniofacial Growth Series, Monograph 4. Ann Arbor: Center for Human Growth and Development, University of Michigan; 1975. Confirmada na rodada 2 (capítulo, pp. 101-154). |
| 3 | `ortodontia/oclusao-denticao-mista` | Sequência de erupção superior favorável apresentada com segurança excessiva. | Reescrita como "primeiro pré-molar antes do canino (4-3-5 ou 4-5-3)" com `[VERIFICAR]` em todas as ocorrências ("Em um minuto", lista, infográfico, macete). Na rodada 2 as fontes confirmam 4-5-3 como a mais favorável e mais frequente no arco superior; 4-3-5 aparece em textos clássicos como aceitável. Mantido o marcador por ser ponto de divergência entre autores. |

Afirmações conferidas e mantidas na rodada 1 (sem alteração): espaços primatas
(superior mesial ao canino, inferior distal); plano terminal e desfechos
(degrau mesial → Classe I, reto → topo a topo → ajuste mesial, degrau distal →
Classe II); rotações de Björk (implantes medem a interna; plano mandibular
mostra a total; anterior é a mais comum); côndilo cresce para cima e para trás
com deslocamento para baixo e para a frente; superfície anterior da maxila
reabsortiva (Enlow); palato desce por reabsorção nasal e aposição oral;
Sicher/Scott/Moss; centro versus sítio de crescimento (Baume); Andrews 1972,
120 oclusões, seis chaves; ensaios de duas fases (Tulloch, Keeling, O'Brien).

## Rodada 2 — confirmação externa dos pontos marcados

Método: para cada `[VERIFICAR]` e para cada autoria/número citado, busca
dirigida na literatura (resumos indexados, revisões sistemáticas, capítulos de
referência) sem uso de nenhum serviço pago. Resultado por tema:

| Tema | O que a página diz | O que as fontes dizem | Decisão |
|------|--------------------|------------------------|---------|
| CVM, estágios | CS2 só C2 côncava; CS3 C2+C3 côncavas, C4 plana, corpos trapezoides ou retangulares deitados; CS4 três concavidades e corpos retangulares deitados; CS5 ao menos um quadrado; CS6 ao menos um retângulo em pé; pico entre CS3 e CS4 | Baccetti, Franchi, McNamara (Semin Orthod 2005) e guia de uso posterior descrevem exatamente isso. Metanálise de 2022 dá idade média de CS3 12,0 e CS4 13,4 anos | Confirmado. Intervalos em anos permanecem `[VERIFICAR]` (média populacional) |
| Pico de estatura | ~12 anos meninas, ~14 meninos, variação ±2 anos; menarca depois do pico | Mean age at PHV 12,1 (meninas) e 13,7 (meninos); menarca cerca de 1 ano após o pico; PHV 9,8 cm/ano e 11,3 cm/ano | Confirmado. Marcadores mantidos por serem médias populacionais |
| Sesamoide ulnar do polegar | surge pouco antes do pico | Hägg e Taranger (Acta Odontol Scand 1980): ossificação do sesamoide antes ou no pico, em média cerca de um ano antes; Fishman (1982): SMI 4 = sesamoide, antes do capeamento (SMI 5-7) que coincide com o pico | Confirmado; `[VERIFICAR]` retirado das três frases e acrescentada a ressalva "ou junto dele em parte dos pacientes" |
| Fishman | 11 indicadores, quatro fases, rádio por último | SMI 1-11; sítios polegar, terceiro dedo, quinto dedo e rádio; fusão do rádio = SMI 11 | Confirmado |
| Espaço livre de Nance | maior no inferior | Nance (1947): 1,7 mm por lado inferior e 0,9 mm por lado superior; textos atuais citam ~2,5 e ~1,5 mm por lado | Confirmado quanto à direção; **acrescentado** parágrafo com as duas faixas de valores e `[VERIFICAR]`, porque as fontes divergem |
| Passivo dos incisivos | "alguns milímetros, mais no superior"; termo atribuído a Moyers | Termo *incisor liability* é de **Mayne (1969)**, difundido pelo manual de Moyers; valores clássicos 7,6 mm superior e 6,0 mm inferior | **Corrigida a autoria** (Mayne, não Moyers) e inseridos os valores clássicos com `[VERIFICAR]` |
| Sétima chave de Andrews | "aparece em textos posteriores" | Acrescentada por Bennett e McLaughlin (anos 1990); não está no artigo de 1972 | Confirmado; atribuição explicitada e `[VERIFICAR]` retirado |
| Proporção face:crânio | 1:8 ao nascer → 1:2,5 no adulto | Fontes trazem 8:1 ao nascer e **1:2** no adulto; 1:2,5 aparece em outros textos | **Corrigido** para "algo entre 1:2 e 1:2,5 no adulto, conforme a fonte", com `[VERIFICAR]` |
| Sincondrose esfeno-occipital | "fecha na adolescência" | TC e TCFC: início da fusão ~10-12 anos; fusão completa entre ~16 e 20 anos (17 no Irã; 18 mulheres e 20 homens na Turquia) | **Corrigido** para "funde no fim da adolescência, entre cerca de 16 e 20 anos", com `[VERIFICAR]` |
| Sincondrose esfeno-etmoidal / "por volta dos 7 anos" (maxila) | crescimento da base do crânio deixa de empurrar a maxila por volta dos 7 anos | Esfeno-etmoidal funde por volta dos 6-7 anos | Confirmado; marcador mantido (idade média) |
| Sínfise mandibular | funde no primeiro ano de vida | Fusão entre 6 e 9 meses, completa no primeiro ano | Confirmado; `[VERIFICAR]` retirado (duas ocorrências) |
| Cartilagem de Meckel | deixa martelo, bigorna e ligamento esfenomandibular; mandíbula ossifica ao lado, intramembranosa | Idem, mais o ligamento anterior do martelo | Confirmado |
| Sinais estruturais de Björk | sete sinais listados; último item vago ("espaços interdentários e eixo dos molares") | Björk e Skieller (1969/1972): inclinação da cabeça do côndilo, curvatura do canal, forma da borda inferior, inclinação da sínfise, ângulo intermolar, ângulo interincisal, altura facial anterior inferior | **Corrigido**: item reescrito como "ângulo intermolar", sem espaços interdentários; `[VERIFICAR]` retirado |
| Ensaios de duas fases | sem vantagem final; mais tempo, consultas e custo | Tulloch e Proffit (AJODO 2004), Keeling (AJODO 1998), O'Brien (AJODO 2009): sem diferença esquelética, de extrações ou de oclusão final; grupo precoce com mais consultas, mais tempo e mais custo | Confirmado; `[VERIFICAR]` retirado dessa frase |
| Aparelhos funcionais, ganho esquelético | "1 a 2 mm" | Cozza e col. (AJODO 2006, revisão sistemática): dois terços das amostras com alongamento mandibular suplementar > 2 mm; nenhum dos quatro ensaios randomizados mostrou ganho clinicamente significativo | **Reescrito**: "em torno de 2 mm nas revisões de estudos controlados e sem diferença clinicamente relevante nos ensaios randomizados", com `[VERIFICAR]` |
| Arco na dentição permanente | intercaninos inferior diminui após a adolescência | Bishara e col. (AJODO 1997, 6 semanas a 45 anos): largura intercaninos estabelecida aos 8 anos no inferior; queda após a erupção completa, maior na intercaninos que na intermolar | Confirmado |
| Plano terminal mais frequente | plano reto é o mais frequente | Varia por população: reto 47-54% em metanálise e em várias amostras; degrau mesial predomina em outras | Mantido com `[VERIFICAR]` (já marcado) |
| Patinho feio | 8 a 11 anos; fecha com a erupção dos caninos | Broadbent (Angle Orthod 1937): diastema e laterais divergentes na fase entre a erupção dos laterais e dos caninos; fecha com os caninos | Confirmado |
| Baume | centro versus sítio; plano terminal; ajuste mesial precoce e tardio | Baume LJ. *Physiological tooth migration and its significance for the development of occlusion*, série em J Dent Res 1950 (partes I a IV) | Confirmado |
| Enlow | superfície anterior da maxila reabsortiva; palato desce | Padrão de remodelação de Enlow: maxila inferior reabsortiva no processo alveolar e fossa canina; palato desce por reabsorção superior e deposição inferior | Confirmado |

Ocorrências de `[VERIFICAR]` após a rodada 2: 42 em 14 páginas (eram 49),
todas em número populacional, idade média ou ponto de divergência entre fontes.
A lista completa com localização é impressa por
`node scripts/campus-progresso.js --modulo ortodontia/crescimento-e-desenvolvimento`.

## Rodada 3 — consistência interna e releitura final

Método: para cada página, confronto entre "Em um minuto", corpo, infográfico,
flashcards e gabarito do autoteste, procurando a mesma afirmação dita de dois
jeitos incompatíveis; releitura das frases corrigidas nas rodadas 1 e 2 dentro
do contexto; execução do validador estrutural e do teste de conteúdo; render
das páginas alteradas a 375 px.

Achados e ações:

- `ortodontia/maturacao-vertebras`: após a rodada 1 restava um placeholder de
  imagem clínica pedindo "corpo de C3 retangular horizontal" como se fosse
  requisito de CS3. Reescrito para "corpos de C3 e C4 trapezoides ou
  retangulares deitados".
- Teste de conteúdo: três checagens negativas disparavam em frases do "Onde o
  aluno erra" e em alternativas erradas do autoteste (o sesamoide "não marca o
  fim", a menarca "não é o início", "não atribuir a Moss"). O teste passou a
  separar prosa afirmativa de prosa total; os três casos eram falsos positivos
  e o conteúdo estava correto.
- Nenhuma contradição interna encontrada entre "Em um minuto", corpo, flashcards
  e gabaritos nas 14 páginas.

## Cobertura por página

| Página | Afirmações conferidas | Situação |
|--------|-----------------------|----------|
| `crescimento-conceitos` | curvas de Scammon; gradiente cefalocaudal; proporção face:crânio; crescimento x desenvolvimento x maturação | 1 correção (proporção 1:2 a 1:2,5); 1 `[VERIFICAR]` |
| `crescimento-teorias` | Sicher, Scott, Moss, Van Limborgh, Petrovic; centro x sítio (Baume); expectativa de ganho com funcionais | 2 correções (referência de Petrovic; magnitude do ganho); 1 `[VERIFICAR]` |
| `crescimento-mecanismos` | ossificação intramembranosa x endocondral; sincondroses; deslocamento primário x secundário; princípio do V | 1 correção (fusão da esfeno-occipital); 1 `[VERIFICAR]` |
| `crescimento-maxila` | deslocamento passivo e sutural; superfície anterior reabsortiva; descida do palato; "por volta dos 7 anos" | confirmada; 5 `[VERIFICAR]` (idades) |
| `crescimento-mandibula` | Meckel e derivados; cartilagens secundárias; sínfise; côndilo para cima e para trás; borda posterior depositante | confirmada; 2 `[VERIFICAR]` retirados; 2 mantidos |
| `crescimento-rotacoes` | interna x total x matriz; implantes de Björk; anterior mais comum; sete sinais estruturais | 1 correção (ângulo intermolar); 0 `[VERIFICAR]` |
| `maturacao-surto-puberal` | pico ~12 e ~14; variação; menarca pós-pico; surto mandibular acompanha o estatural | confirmada; 8 `[VERIFICAR]` (médias populacionais) |
| `maturacao-mao-punho` | sequência epífise igual, sesamoide, capeamento, fusões, rádio; Fishman, Hägg e Taranger, Greulich e Pyle; mão esquerda | confirmada; 3 `[VERIFICAR]` retirados; 1 mantido |
| `maturacao-vertebras` | CS1–CS6; C2 não dá forma de corpo; pico entre CS3 e CS4; reprodutibilidade discutida | 1 correção (CS3) + 1 placeholder; 4 `[VERIFICAR]` |
| `maturacao-tempo-tratamento` | Classe II e as duas fases (Tulloch, Keeling, O'Brien); Classe III cedo para a maxila; cirurgia após o fim do crescimento | confirmada; 1 `[VERIFICAR]` retirado; 1 mantido |
| `oclusao-denticao-decidua` | cronologia; espaços primatas e de desenvolvimento; planos terminais e desfechos; Baume | confirmada; 2 `[VERIFICAR]` (SVG: faixas etárias; frequência do plano reto) |
| `oclusao-denticao-mista` | períodos; passivo dos incisivos (Mayne) e compensações; patinho feio; Nance; ajuste mesial tardio; sequência favorável | 2 correções (autoria Mayne; valores de Nance) + 1 da rodada 1; 10 `[VERIFICAR]` |
| `oclusao-denticao-permanente` | cronologia; encolhimento do arco (Bishara); apinhamento tardio em não tratados; terceiro molar não comprovado | confirmada; 6 `[VERIFICAR]` |
| `oclusao-chaves-andrews` | 1972, 120 casos, seis chaves; chave I com o 7 inferior; angulação x inclinação; curva de Spee; sétima chave (Bennett e McLaughlin) | 1 correção (atribuição da sétima chave); 0 `[VERIFICAR]` |

## Fontes consultadas na rodada 2

Citadas por autor, periódico e ano; nenhuma entra nas páginas com PMID/DOI/URL.

- Baccetti T, Franchi L, McNamara JA Jr. The Cervical Vertebral Maturation (CVM) method. Semin Orthod 2005. Guia de uso do método (revisão, 2021). Metanálise de idade cronológica por estágio CVM (2022).
- Hägg U, Taranger J. Skeletal stages of the hand and wrist as indicators of the pubertal growth spurt. Acta Odontol Scand 1980;38:187-200.
- Fishman LS. Radiographic evaluation of skeletal maturation. Angle Orthod 1982.
- Nance HN. The limitations of orthodontic treatment. Am J Orthod Oral Surg 1947. Revisões sobre espaço livre e redução secular (2021).
- Mayne WR. Serial extraction. In: Graber TM (ed). Current Orthodontic Concepts and Techniques. 1969 (origem do termo *incisor liability*).
- Andrews LF. The six keys to normal occlusion. Am J Orthod 1972;62:296-309. Bennett JC, McLaughlin RP. Orthodontic management of the dentition with the preadjusted appliance. 1993/1997 (sétima chave).
- Petrovic AG, Stutzmann JJ, Oudet CL. In: McNamara JA Jr (ed). Determinants of Mandibular Form and Growth. Monograph 4, 1975, pp. 101-154.
- Baume LJ. Physiological tooth migration and its significance for the development of occlusion. J Dent Res 1950 (série).
- Björk A. Prediction of mandibular growth rotation. Am J Orthod 1969. Björk A, Skieller V. Facial development and tooth eruption. Am J Orthod 1972.
- Cozza P, Baccetti T, Franchi L, De Toffol L, McNamara JA Jr. Mandibular changes produced by functional appliances in Class II malocclusion: a systematic review. Am J Orthod Dentofacial Orthop 2006;129:599.e1-12.
- Tulloch JFC, Proffit WR, Phillips C. Outcomes in a 2-phase randomized clinical trial of early Class II treatment. Am J Orthod Dentofacial Orthop 2004. Keeling SD et al. Am J Orthod Dentofacial Orthop 1998. O'Brien K et al. Early treatment for Class II Division 1 malocclusion with the Twin-block appliance: a multi-center, randomized, controlled trial. Am J Orthod Dentofacial Orthop 2009.
- Bishara SE, Jakobsen JR, Treder J, Nowak A. Arch width changes from 6 weeks to 45 years of age. Am J Orthod Dentofacial Orthop 1997.
- Broadbent BH. The face of the normal child. Angle Orthod 1937;7:183-208.
- Estudos de TC/TCFC sobre fusão da sincondrose esfeno-occipital (Irã 2020, Turquia, Índia 2023) e relação com CVM (2016).
- Merck Manual (crescimento e maturação sexual do adolescente); J Clin Res Pediatr Endocrinol (idade do pico de velocidade e estadiamento puberal).
- Enlow DH, Hans MG. Essentials of Facial Growth; Enlow DH. Handbook of Facial Growth (padrões de remodelação da maxila e do palato).

## Rodada 4 — resolução das marcações (05/09)

As marcações `[VERIFICAR]` deste módulo foram resolvidas por busca de fontes e retiradas; correções de texto e a lista de buscas estão em `AUDITORIA-RODADA-4.md`.
