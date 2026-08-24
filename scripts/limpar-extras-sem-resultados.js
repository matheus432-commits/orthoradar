// VARREDURA RETROATIVA: marca extra_sem_resultados em TODO o acervo (12/08).
//
// Contexto: a reprovação pós-resumo ("material sem resultados") passou a ser
// persistida no d03d2f7 — mas só é descoberta LAZY, quando o candidato chega à
// fila de extras de alguém, comendo uma vaga até lá. Este script antecipa a
// descoberta para o acervo INTEIRO, em todas as especialidades, usando a
// MESMA função determinística do e-mail (isResultadosIndisponiveis) sobre os
// textos JÁ GRAVADOS (resumo_pt / resumo_completo / impacto / achados).
// Zero IA, zero TTS — só leituras e updates no Firestore.
//
// Uso (workflow limpar-extras-sem-resultados.yml, SÓ dispatch manual):
//   DRY_RUN=true  (padrão) → só relata o que SERIA marcado, por especialidade
//   DRY_RUN=false          → grava extra_sem_resultados: true
//
// Quem já está reprovado (extra_sem_resultados ou veredito_extra_reprovado)
// é pulado. A checagem de veredito (Haiku) NÃO roda aqui — custaria IA; essa
// classe continua sendo drenada lazy pela trava barata, que já persiste.

const { Firestore } = require('../netlify/functions/_lib/firestore');
const { isResultadosIndisponiveis } = require('../netlify/functions/daily-digest');

// Parser TOLERANTE (12/08, run #2: o fundador rodou "false" e o run ficou em
// dry-run mesmo assim — comparação sensível a caixa/espaços é pegadinha de
// formulário). Aceita false/FALSE/False/0/não/nao/no; qualquer outra coisa é
// dry-run, e o valor RECEBIDO sai no log para nunca mais restar dúvida.
const DRY_RUN = !/^(false|0|n[aã]o|no)$/i.test(String(process.env.DRY_RUN ?? 'true').trim());

async function main() {
  const projectId = process.env.FIREBASE_PROJECT_ID || 'orthoradar';
  const apiKey = process.env.FIREBASE_API_KEY;
  if (!apiKey) { console.error('FIREBASE_API_KEY ausente'); process.exit(1); }
  const db = new Firestore(projectId, apiKey);

  console.log(`[limpar-extras] modo: ${DRY_RUN ? 'DRY-RUN (nada será gravado)' : 'GRAVANDO'} — input recebido: "${process.env.DRY_RUN ?? '(vazio, padrão true)'}"`);
  const artigos = await db.query('artigos', { limit: 5000 });
  const ativos = artigos.filter(a => a.status === 'active');
  console.log(`[limpar-extras] ${ativos.length} artigos ativos avaliados (de ${artigos.length} no acervo)`);

  const porEsp = new Map(); // esp → { avaliados, jaMarcados, novos, exemplos[] }
  let gravados = 0, falhas = 0;
  for (const a of ativos) {
    const esp = a.especialidade || '(sem especialidade)';
    const st = porEsp.get(esp) || { avaliados: 0, jaMarcados: 0, novos: 0, exemplos: [] };
    st.avaliados++;
    if (a.extra_sem_resultados || a.veredito_extra_reprovado) { st.jaMarcados++; porEsp.set(esp, st); continue; }
    if (isResultadosIndisponiveis(a)) {
      st.novos++;
      if (st.exemplos.length < 3) st.exemplos.push(`${a.id}: ${(a.titulo_pt || a.titulo || '').slice(0, 70)}`);
      if (!DRY_RUN) {
        await db.updateDoc('artigos', a.id, { extra_sem_resultados: true })
          .then(() => gravados++)
          .catch(err => { falhas++; console.error(`  ERRO em ${a.id}: ${err.message}`); });
      }
    }
    porEsp.set(esp, st);
  }

  console.log('\n[limpar-extras] POR ESPECIALIDADE (avaliados / já reprovados / novos a marcar):');
  const esps = [...porEsp.keys()].sort((x, y) => x.localeCompare(y, 'pt-BR'));
  let totalNovos = 0;
  for (const esp of esps) {
    const st = porEsp.get(esp);
    totalNovos += st.novos;
    console.log(`  ${esp}: ${st.avaliados} / ${st.jaMarcados} / ${st.novos}`);
    st.exemplos.forEach(ex => console.log(`      · ${ex}`));
  }
  console.log(`\n[limpar-extras] total de novos sem-resultados: ${totalNovos}${DRY_RUN ? ' (DRY-RUN — rode com dry_run=false para gravar)' : ` — gravados: ${gravados}, falhas: ${falhas}`}`);
  if (!DRY_RUN && falhas) process.exit(1);
}

main().then(() => process.exit(0)).catch(e => { console.error(e.message); process.exit(1); });
