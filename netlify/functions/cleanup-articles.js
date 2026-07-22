// DESATIVADO — DIRETRIZ 22/07/2026 (fundador): NADA é deletado da base.
// Todos os artigos, resumos e registros ficam armazenados permanentemente para
// a futura BIBLIOTECA PÚBLICA do OdontoFeed (acervo completo de tudo que já
// foi produzido). Esta função apagava artigos_enviados com mais de 180 dias;
// agora é um no-op mantido apenas porque o agendamento (netlify.toml) ainda a
// referencia — remove-se o schedule quando conveniente.

exports.handler = async () => {
  console.log('[cleanup-articles] retenção DESATIVADA por diretriz 22/07 — nada é deletado (acervo da biblioteca pública).');
  return {
    statusCode: 200,
    body: JSON.stringify({ deleted: 0, disabled: true, reason: 'diretriz-22-07-biblioteca-publica' }),
  };
};
