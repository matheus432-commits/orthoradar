# Pendências jurídicas — checklist vivo

Atualizado em 2026-07-14. Marcar itens conforme concluídos; NÃO apagar o
histórico. Origem: avaliação de viabilidade jurídica (LGPD, direito autoral,
CDC, planos e marca).

## Feito no código (aguarda deploy/merge)

- [x] Política de Privacidade publicada (`/privacidade.html`) e linkada no rodapé
- [x] Termos de Uso publicados (`/termos.html`), com planos, arrependimento (CDC
      art. 49) e cancelamento
- [x] Aceite expresso de Termos + Privacidade no cadastro, com data e versão
      gravadas no documento do usuário (`aceitouTermosEm`, `termosVersao`)
- [x] Correção CDC: "revisados editorialmente" → "gerados por IA com validação
      automatizada" (rodapé, e-mails diário e semanal)
- [x] Disclaimer clínico replicado no e-mail diário, no recap semanal e no
      roteiro do podcast (inclusive fallback)
- [x] Regra editorial de direito autoral escrita em `docs/REGRAS-EDITORIAIS.md`
      e replicada nos 4 prompts de IA
- [x] Endpoint de exclusão de conta (`delete-account`) — LGPD art. 18, V/VI

## Ação do titular do negócio (fora do código)

- [ ] **Criar as caixas de e-mail** `privacidade@odontofeed.com` e
      `contato@odontofeed.com` (ou redirecionamentos) — as páginas legais já
      apontam para elas
- [ ] Concluir a migração de segurança do Firestore (service account + rules
      deny-all) — obrigação de segurança da LGPD (art. 46)
- [ ] Revisão dos documentos legais por advogado(a) antes de ativar cobrança
- [ ] **Antes do primeiro pagamento:** CNPJ (provável ME/Simples), gateway de
      pagamento e nota fiscal; preencher razão social/CNPJ nos placeholders de
      `privacidade.html` e `termos.html`
- [ ] Botão "Excluir conta" no dashboard chamando o endpoint `delete-account`
- [ ] Verificar se o número de prova social da landing ("2.300+ artigos
      resumidos") corresponde ao real; ajustar se não

## ⚠️ NÃO ESQUECER — Marca (etapa final combinada)

- [ ] **Busca de anterioridade e eventual depósito da marca "ARIA"** (nome da
      assistente de IA do plano Premium) — pesquisar no INPI nas classes 41/42
      antes do lançamento público; usar como "ARIA do OdontoFeed" reduz risco
      de colisão. Nota: Opera (navegador) tem assistente "Aria" — segmento
      distinto, mas registrar a busca.
- [ ] **Depositar a marca "OdontoFeed" no INPI** (classes sugeridas: 41 —
      educação/informação; 42 — software/SaaS; considerar 44 — serviços
      odontológicos por afinidade). Fazer busca de anterioridade antes.
      Custo baixo; prioridade sobe assim que houver tração ou divulgação
      pública. *Combinado: executar ao final das demais etapas — este arquivo
      existe para ninguém esquecer.*
