# Español 90

Sistema de estudo de espanhol para 90 dias, 1 hora por dia, com foco em
**conduzir uma conversa com confiança** sobre negócios, rotina, viagens e odontologia.

Abre no Safari (iPhone, iPad ou Mac). Não precisa de servidor, login ou internet:
todo o conteúdo está dentro do próprio `index.html` e o progresso fica salvo no navegador.

## Como usar

| | |
|---|---|
| **Local** | abrir `espanhol/index.html` direto no Safari |
| **iPhone** | abrir a página → Compartilhar → *Adicionar à Tela de Início* (vira app) |
| **Publicado** | a versão Artifact é o mesmo arquivo (`artifact.html`) |

O progresso é gravado em `localStorage`. **Exporte o backup** de vez em quando
(aba Progresso) — limpar os dados do Safari apaga tudo.

## As oito abas

- **Hoje** — o plano fechado de 60 minutos, em 6 blocos, com cronômetro.
- **Leitura** — o texto do dia; cada frase vira card do Anki com um toque.
- **Anki** — revisão espaçada (SM-2) das frases. Atalhos: `espaço`, `1`–`4`.
- **1000 palavras** — a lista de frequência, filtrável por quanto a palavra se
  parece com o português. O filtro *Diferente* mostra o que exige decoreba real.
- **Falsos amigos** — 111 armadilhas, com o que a palavra *parece*, o que ela
  *significa* e como dizer o sentido enganoso em espanhol. Tem quiz.
- **Temático** — 353 termos de odontologia, negócios, viagens e rotina, com frase de exemplo.
- **Conversa** — roteiros, muletas para ganhar tempo, conectores e os erros que denunciam o brasileiro.
- **Progresso** — streak, histórico de 30 dias e o *termômetro de conversa*.

## Estrutura

```
espanhol/
  index.html              gerado — documento completo (Safari, Netlify)
  artifact.html           gerado — mesmo conteúdo sem <html>, para publicar como Artifact
  build.mjs               junta dados + app em um arquivo só
  src/
    app.html              HTML e CSS
    core.js               estado, SRS, semelhança PT/ES, plano do dia
    views.js              interface das oito abas
    data/
      frequencia.txt      1004 palavras · es|pt|classe
      falsos-amigos.txt   111 · es|parece|significa|comoDizer|exES|exPT|tema
      tematico.txt        353 · es|pt|tema|sub|exES|exPT
      conversa.json       roteiros, muletas, conectores, armadilhas gramaticais
      lecturas/Lxxx.json  um arquivo por texto de leitura
  scripts/
    nova-leitura.mjs      valida e adiciona um texto novo, e reconstrói o app
```

Depois de mexer em qualquer arquivo de `src/`, rode:

```bash
node espanhol/build.mjs
```

## Texto novo por dia

```bash
node espanhol/scripts/nova-leitura.mjs texto.json
```

O script valida o formato, numera o arquivo (`L016`, `L017`…) e reconstrói o app.
Formato esperado no cabeçalho de `scripts/nova-leitura.mjs`.

## Como o sistema mede o progresso

O **termômetro de conversa** combina cinco componentes com pesos:

| Componente | Peso | Alvo |
|---|---|---|
| Núcleo das 1000 palavras | 25% | 1004 vistas |
| Vocabulário temático dominado | 20% | 200 termos |
| Frases maduras no Anki (21 dias+) | 25% | 250 cards |
| Volume de revisão | 15% | 2000 revisões |
| Constância | 15% | 75 dias ativos |

Chegar a ~80% em 90 dias exige exatamente o ritmo previsto no plano diário:
15 palavras novas, 1 texto e a revisão do Anki em dia.
