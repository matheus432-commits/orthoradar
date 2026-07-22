// Regras de ESPECIALIDADES por cadastro — fonte única de verdade.
//
// Diretriz 22/07/2026 (substitui a de 07/2026 "uma por cadastro"): os resumos
// e os áudios já são gerados para TODAS as especialidades todos os dias, então
// não há custo marginal em entregar mais de uma ao mesmo dentista. O dentista
// pode escolher ATÉ 3 especialidades e recebe, na área de membro, as mesmas
// edições/podcasts já gerados. Recurso do plano PREMIUM (como hoje todos os
// cadastros são Premium cortesia, na prática todos podem escolher 3); no
// Gratuito permanece 1.
//
// O e-mail diário continua sendo o da especialidade PRINCIPAL (a primeira da
// lista) — as demais são consumidas na área de membro (frase oficial do
// produto: "Escolha até 3 especialidades para receber resumos em sua área de
// membro").

const { CICLO } = require('./especialidade-identidade');
const { isPremium } = require('./plans');

const ESPECIALIDADES_VALIDAS = new Set(CICLO);
const MAX_ESPECIALIDADES_PREMIUM = 3;
const MAX_ESPECIALIDADES_GRATUITO = 1;

// Teto de especialidades do plano do usuário (aceita user, plano ou string).
function maxEspecialidades(userOrPlan) {
  return isPremium(userOrPlan) ? MAX_ESPECIALIDADES_PREMIUM : MAX_ESPECIALIDADES_GRATUITO;
}

// Valida e normaliza a seleção de especialidades de um cadastro.
// Aceita string ou array; remove vazios e duplicatas PRESERVANDO a ordem
// (a primeira é a principal — define o e-mail diário).
// Retorna { ok:true, especialidades:[...] } ou { ok:false, error:'mensagem' }.
function validarEspecialidades(input, userOrPlan) {
  const bruto = Array.isArray(input) ? input : (input ? [input] : []);
  const vistas = new Set();
  const especialidades = [];
  for (const e of bruto) {
    const s = typeof e === 'string' ? e.trim() : '';
    if (!s || vistas.has(s)) continue;
    vistas.add(s);
    especialidades.push(s);
  }

  if (!especialidades.length) {
    return { ok: false, error: 'Escolha ao menos uma especialidade.' };
  }
  const invalida = especialidades.find(e => !ESPECIALIDADES_VALIDAS.has(e));
  if (invalida) {
    return { ok: false, error: 'Especialidade inválida: ' + invalida };
  }
  const max = maxEspecialidades(userOrPlan);
  if (especialidades.length > max) {
    return {
      ok: false,
      error: max === 1
        ? 'Seu plano permite 1 especialidade. Escolha até 3 especialidades com o Premium.'
        : `Escolha até ${max} especialidades para receber resumos em sua área de membro.`,
    };
  }
  return { ok: true, especialidades };
}

// Normaliza o campo `especialidade` de um doc de cadastro para array limpo.
function especialidadesDe(user) {
  const raw = Array.isArray(user?.especialidade)
    ? user.especialidade
    : (user?.especialidade ? [user.especialidade] : []);
  return raw.filter(e => typeof e === 'string' && e.trim()).map(e => e.trim());
}

// Escolhe a especialidade a exibir na área de membro: a solicitada (?esp=) se
// pertencer ao dentista; senão a principal (primeira). '' se não há nenhuma.
function escolherEspecialidade(especialidades, solicitada) {
  const lista = Array.isArray(especialidades) ? especialidades : [];
  if (solicitada && lista.includes(solicitada)) return solicitada;
  return lista[0] || '';
}

module.exports = {
  ESPECIALIDADES_VALIDAS,
  MAX_ESPECIALIDADES_PREMIUM,
  MAX_ESPECIALIDADES_GRATUITO,
  maxEspecialidades,
  validarEspecialidades,
  especialidadesDe,
  escolherEspecialidade,
};
