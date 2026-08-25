// ACADEMY — recomendador de periódicos + alerta de predatórios.
//
// Base: data/academy-periodicos.json (curadoria manual, MVP relato de caso).
// Ordem de recomendação para INICIANTE (spec, Etapa 7): nacionais de acesso
// aberto SEM taxa primeiro; APC alta por último, sempre com o valor à vista.
//
// PREDATÓRIOS: além da lista curada (flag doaj), a checagem ao vivo consulta
// a API pública do DOAJ (quando a rede permite) e aplica os sinais de alerta
// COPE/Think-Check-Submit em linguagem simples. Sem rede, a recomendação segue
// com a curadoria local e diz que a checagem ao vivo ficou indisponível.

const fs = require('fs');
const path = require('path');
const https = require('https');

const CATALOGO = JSON.parse(fs.readFileSync(path.join(__dirname, '..', '..', '..', '..', 'data', 'academy-periodicos.json'), 'utf8'));

// Recomenda para um relato de caso da especialidade dada.
function recomendar({ especialidade } = {}) {
  const aptos = CATALOGO.periodicos.filter(p =>
    p.aceitaRelatoDeCaso &&
    (!p.somenteEspecialidades || !especialidade || p.somenteEspecialidades.includes(especialidade)));
  const pontua = (p) => (p.nacional ? 4 : 0) + (p.acessoAberto ? 2 : 0) + (/sem taxa/i.test(p.apc) ? 3 : 0) + (p.doaj ? 1 : 0);
  return aptos
    .sort((a, b) => pontua(b) - pontua(a))
    .map(p => ({
      ...p,
      recomendadoParaIniciante: pontua(p) >= 7,
      alertaCusto: /sem taxa/i.test(p.apc) ? null : `Este periódico pode cobrar do autor (${p.apc}). Confirme o valor vigente antes de submeter.`,
    }));
}

// Sinais de alerta de periódico predatório (COPE / Think-Check-Submit),
// em linguagem clínica — usados quando o dentista sugere um periódico fora
// da curadoria.
const SINAIS_PREDATORIO = [
  'Convite por e-mail elogiando seu "prestígio" e prometendo publicação em dias',
  'Promessa de aceite garantido ou revisão por pares em menos de 2 semanas',
  'Taxa (APC) cobrada ANTES da revisão por pares, ou só revelada após o aceite',
  'Site sem corpo editorial identificável (nomes/afiliações verificáveis)',
  'Escopo gigante ("todas as áreas da saúde e engenharia") sem foco',
  'Fator de impacto "próprio" ou de métricas desconhecidas (não JCR/Scopus)',
  'Ausência no DOAJ sendo periódico de acesso aberto que cobra APC',
];

// Checagem AO VIVO no DOAJ (api pública). Devolve { verificado, noDoaj } ou
// { verificado:false } quando a rede não deixa — nunca lança.
function checarDoaj(tituloOuIssn) {
  return new Promise((resolve) => {
    const q = encodeURIComponent(String(tituloOuIssn || '').slice(0, 120));
    const req = https.request({
      hostname: 'doaj.org', path: `/api/search/journals/${q}`, method: 'GET',
      headers: { Accept: 'application/json' }, timeout: 6000,
    }, (res) => {
      let corpo = '';
      res.on('data', (c) => { corpo += c; if (corpo.length > 400000) req.destroy(); });
      res.on('end', () => {
        try {
          const j = JSON.parse(corpo);
          resolve({ verificado: true, noDoaj: (j.total || 0) > 0, total: j.total || 0 });
        } catch { resolve({ verificado: false }); }
      });
    });
    req.on('timeout', () => { req.destroy(); resolve({ verificado: false }); });
    req.on('error', () => resolve({ verificado: false }));
    req.end();
  });
}

module.exports = { CATALOGO, recomendar, SINAIS_PREDATORIO, checarDoaj };
