# Auditoria de conteúdo — Ortodontia, Módulo 3 (Biologia do movimento)

Registro das rodadas de detecção de informação falsa, errada ou mal interpretada
nas 12 páginas do módulo, na mesma rotina dos Módulos 1 e 2 (`AUDITORIA-M1.md`,
`AUDITORIA-M2.md`): leitura crítica durante a escrita, confirmação externa dos
pontos marcados e releitura final com testes automatizados e render das figuras.

O teste `netlify/functions/_lib/__tests__/campus-conteudo.test.js` trava os
fatos conferidos aqui (bloco "módulo 3"). Toda página continua em `rascunho` e
nada é visível ao aluno antes da assinatura do validador.

Regras mantidas: número populacional, prazo biológico médio, faixa de força,
prevalência e ponto de divergência entre autores ficam com `[VERIFICAR]`;
frases que citam um erro para negá-lo não contam como afirmação; nenhuma
referência recebe PMID, DOI ou URL à mão. Este módulo tem mais marcações do
que os anteriores porque trata de prazos, faixas de força e evidência de
eficácia, que variam entre estudos e mudam com o tempo.

## Páginas cobertas

| Tema | Arquivo | Assunto |
|------|---------|---------|
| Reações teciduais | `biomov-ligamento` | Ligamento e osso sob força |
| Reações teciduais | `biomov-pressao-tensao` | Pressão e tensão |
| Reações teciduais | `biomov-hialinizacao` | Hialinização |
| Reações teciduais | `biomov-remodelacao` | Remodelação |
| Forças | `biomov-forca-magnitude` | Magnitude, duração e direção |
| Forças | `biomov-forca-ideais` | Forças ideais por tipo de movimento |
| Forças | `biomov-forca-excessiva` | Efeitos de forças excessivas |
| Forças | `biomov-reabsorcao` | Reabsorção radicular |
| Efeitos colaterais | `biomov-lesoes-brancas` | Descalcificação e lesões brancas |
| Efeitos colaterais | `biomov-recessao` | Recessão e deiscências |
| Efeitos colaterais | `biomov-dor` | Dor e mobilidade |
| Efeitos colaterais | `biomov-aceleracao` | Aceleração do movimento |

## Rodada 1 — leitura crítica durante a escrita

| # | Página | Achado | Ação |
|---|--------|--------|------|
| 1 | `biomov-forca-ideais` | O texto inicial dizia que a intrusão reabsorve mais porque o ápice tem "cemento mais fino" e "mais celular e suscetível". O cemento apical é celular e espesso; o que a literatura sustenta é a concentração de pressão no ápice e a maior frequência de reabsorção nessa região, não a espessura. | Reescrito em quatro trechos: o ápice passou a ser "a região que mais reabsorve", sem afirmar espessura, com `[VERIFICAR]`. |
| 2 | `biomov-ligamento` | A primeira figura desenhava a coroa dentro do alvéolo. | Redesenhada com o osso começando abaixo da junção; rodapé encurtado. |
| 3 | `biomov-remodelacao` | O quadro sobre o fenômeno regional acelerado saiu com um campo vazio duplicado no JSON. | Removido antes da validação. |
| 4 | `biomov-forca-magnitude` | Faixas de Storey e Smith (150 a 200 g eficazes; 400 a 600 g moveram a ancoragem), pressão capilar de Schwarz (20 a 26 g/cm²), limiar de duração (4 a 8 horas por dia), relações M/F de Burstone (7:1, 10:1, 12:1) e posição do centro de resistência são valores de referência que variam entre edições e autores. | Todos mantidos com `[VERIFICAR]` e apresentados como orientação, não como lei. |
| 5 | `biomov-forca-ideais` | A tabela de forças (inclinação 35 a 60; translação 70 a 120; raiz 50 a 100; rotação e extrusão 35 a 60; intrusão 10 a 20 g) é síntese didática de Proffit, não resultado de um experimento único. | Apresentada como faixa didática para dente unirradicular médio, com o aviso de ajustar pela área radicular, e `[VERIFICAR]`. |
| 6 | `biomov-aceleracao` | O tema muda com a literatura; conclusões sobre eficácia envelhecem. | Campo de autoria avisa que as conclusões refletem revisões até a data de redação; cada afirmação de eficácia recebeu `[VERIFICAR]`. |
| 7 | várias | Parágrafos acima de 520 caracteres em 10 páginas; uma seção da página de aceleração ficou com quatro parágrafos seguidos após a divisão. | Divisões automáticas em fronteira de frase; a pergunta de checagem da seção foi movida para o meio da sequência. Validador estrutural verde em todas. |
| 8 | `biomov-pressao-tensao`, `biomov-aceleracao` | Páginas sem placeholder de imagem clínica. | Acrescentados: corte histológico do lado de tensão com osteoide; fotografia de micro-osteoperfurações. |

## Rodada 2 — confirmação externa dos pontos marcados

| Tema | O que a página diz | O que as fontes dizem | Decisão |
|------|--------------------|------------------------|---------|
| Schwarz (1932) | Força ótima não excede a pressão capilar do ligamento, em torno de 20 a 26 g/cm² | Revisões e fontes de ensino citam 20 a 25 ou 20 a 26 g/cm² de superfície radicular; Schwarz distinguia inclinação (20) de movimento de corpo (40 a 50) | Confirmado; faixa mantida com `[VERIFICAR]` |
| Storey e Smith (1952) | 150 a 200 g moveram bem o canino; 400 a 600 g moveram a ancoragem | Artigo clássico citado por revisões de retração de caninos com esses valores; texto original não acessado | Confirmado por citação secundária; `[VERIFICAR]` mantido |
| Proffit: faixas de força por movimento | Inclinação 35 a 60; translação 70 a 120; raiz 50 a 100; rotação 35 a 60; extrusão 35 a 60; intrusão 10 a 20 g | Revisões sistemáticas e materiais de ensino reproduzem exatamente essas faixas atribuídas a Proffit | Confirmado; `[VERIFICAR]` mantido por ser síntese didática |
| Proffit: limiar de duração | Cerca de 4 a 8 horas por dia | Edições recentes citam 4 a 8 horas; fontes de ensino citam 4 a 6 horas como mínimo de aparelhos removíveis | Confirmado; `[VERIFICAR]` mantido pela variação |
| Quinn e Yoshikawa (1985); Ren e colaboradores (2003) | Quatro hipóteses; a favorecida tem platô; revisão sistemática sem força ótima definida | Resumos dos artigos confirmam as quatro hipóteses com apoio à hipótese 4 e a ausência de evidência para uma força ótima | Confirmado |
| Burstone: M/F e centro de resistência | 7:1 inclinação controlada, 10:1 translação, 12:1 ou mais movimento de raiz; centro de resistência entre um terço e metade da raiz a partir da crista | Fontes de biomecânica reproduzem as relações; Burstone situa o centro de resistência a cerca de 40% da distância crista-ápice | Confirmado |
| von Böhl e colaboradores (2004) | Hialinização com forças leves e pesadas; sem relação proporcional entre força e velocidade | Dois artigos do grupo de Nijmegen em 2004: hialinização focal em cães com força constante de 25 cN (AJODO) e comparação de forças altas e baixas (Angle Orthod) | Confirmado; **referência do Angle Orthod acrescentada** às páginas de magnitude e de forças excessivas |
| Cadeia elastomérica | Perde em torno da metade da força no primeiro dia | Revisões relatam 50 a 70% de perda nas primeiras 24 horas, depois platô | Confirmado |
| Levander e Malmgren (1988, 1994) | Índice de 0 a 4; primeira radiografia aos 6 a 9 meses; pausa de 2 a 3 meses reduz a reabsorção final | Índice confirmado (0 sem; 1 contorno irregular; 2 menor que 2 mm; 3 de 2 mm a um terço; 4 acima de um terço); estudo original nos primeiros 6 a 9 meses; controle aos 3 meses recomendado em risco elevado | Confirmado; `[VERIFICAR]` mantido nos prazos |
| Brezniak e Wasserstein (2002) | Reabsorção radicular inflamatória induzida ortodonticamente em três graus | Artigos em duas partes no Angle Orthod 2002 confirmados; os três graus (cemento com remodelação, dentina com reparo, circunferencial apical) constam da parte I | Confirmado |
| Killiany (1999) | Encurtamento grave em poucos por cento | Revisão: mais de 3 mm em 30% dos pacientes; mais de 5 mm em 5% | Confirmado; página mantém frase qualitativa com `[VERIFICAR]` |
| Al-Qawasmi (2003) | Polimorfismo da interleucina-1 beta associado à reabsorção | Confirmado (homozigotos com risco 5,6 vezes maior de reabsorção acima de 2 mm) | Confirmado; percentual não inserido |
| Gorelick (1982); Øgaard (1988) | Lesões brancas em parcela grande dos pacientes; visíveis em cerca de quatro semanas | Gorelick: incidência significativamente maior em dentes colados e bandados; Øgaard: lesões visíveis em 4 semanas sem flúor | Confirmado |
| Sonesson e colaboradores (2017) | Escada conservadora: clareamento, microabrasão, infiltração | Revisão sistemática conclui que falta evidência confiável para estratégias de remineralização ou camuflagem | **Corrigido**: acrescentada ressalva de evidência limitada com `[VERIFICAR]` |
| Renkema (2013); Wennström (1987) | Recessões mais frequentes em tratados; movimento dentro do envelope de osso não causa recessão | Renkema: prevalência antes, após, 2 e 5 anos em 302 pacientes; Wennström: movimento seguro dentro do trabeculado, deiscência quando ultrapassa a cortical | Confirmado |
| Dor: curva e mediadores | Início em horas, pico em 24 horas, quase zero no sétimo dia; separadores e primeiro fio doem mais | Ngan e colaboradores 1989: dor em 4 horas, pico em 24 horas, quase zero no sétimo dia; separadores elastoméricos entre os mais dolorosos | Confirmado; `[VERIFICAR]` mantido |
| Analgésicos | Paracetamol de rotina; anti-inflamatórios inibem prostaglandinas e reduzem o movimento em modelos | Arias e Marquez-Orozco 2006: aspirina e ibuprofeno reduzem osteoclastos e movimento; paracetamol sem efeito | Confirmado |
| Frost: fenômeno regional acelerado | Pico em 1 a 2 meses; regride em alguns meses | Revisões: efeito de cerca de 4 meses, pico em 1 a 2 meses após a cirurgia | Confirmado |
| Vibração e fotobiomodulação | Sem aceleração clinicamente relevante; luz sem consenso | Woodhouse 2015 (81 pacientes): sem efeito na velocidade nem no tempo de alinhamento; Cochrane 2023 (23 estudos, 1.027 participantes): sem benefício de vibração ou fotobiomodulação | Confirmado |

Ocorrências de `[VERIFICAR]` no módulo: 184 em 12 páginas (contagem de
`metricas()` sobre todo o texto, inclusive rótulos de figura). Por página:
ligamento 4, pressão e tensão 1, hialinização 3, remodelação 5, magnitude 13,
forças ideais 20, forças excessivas 7, reabsorção 25, lesões brancas 27,
recessão 11, dor 30, aceleração 38. A lista com localização é impressa por
`node scripts/campus-progresso.js --modulo ortodontia/biologia-do-movimento`.

## Rodada 3 — figuras, consistência interna e testes

- Todas as 12 páginas renderizadas a 1280 e 375 px sem overflow horizontal e
  sem erros de página; todos os `<use>` da biblioteca resolvidos.
- Revisão visual das 66 figuras: 56 correções de rótulos que saíam da caixa,
  cruzavam setas ou se sobrepunham (p1, p3, p4, p5, p6, p7, p8, p9, p10, p11,
  p12) e dois redesenhos (corte do ligamento com a coroa fora do osso; cortes
  do envelope ósseo com raiz longa e deiscência visível), todos commitados em
  separado.
- Consistência entre páginas: a curva força-velocidade com limiar e platô
  (p5) é a mesma usada em p7; a classificação contínua, interrompida e
  intermitente aparece em p2 e p5 com os mesmos exemplos; o fenômeno regional
  acelerado é introduzido em p4 e desenvolvido em p12; o envelope de osso de
  p10 é retomado em p12 para negar que acelerar proteja o periodonto.
- Teste de conteúdo estendido com o bloco "módulo 3": 12 páginas no formato 2;
  eixo RANKL, RANK e osteoprotegerina; pressão capilar de Schwarz; três
  perfis de duração; Reitan e reabsorção solapante; ciclo ativação,
  reabsorção, reversão, formação; Storey e Smith; faixas de força por
  movimento na ordem correta; ápice sem "cemento mais fino"; cinco ramos da
  força excessiva; índice de Levander e Malmgren e pausa; lesão branca
  subsuperficial e quatro semanas; deiscência, fenestração e envelope; curva
  da dor e paracetamol; Frost, vibração sem efeito e "não amplia o envelope";
  padrões de erro (PMID, DOI, URL, termo proibido, emoji, "Distalização"
  maiúscula, faixas etárias com `[VERIFICAR]`); existência deste registro
  cobrindo os 12 arquivos.

## O que fica para o validador

- Confirmar as faixas de força e os prazos marcados `[VERIFICAR]` contra a
  edição de Proffit adotada pelo curso e decidir quais marcas saem.
- Decidir a redação final sobre aceleração (p12) à luz da literatura vigente
  no momento da publicação; a página avisa que o campo muda.
- Escolher as 12 imagens clínicas descritas nos placeholders (nenhuma foi
  baixada nem gerada).
