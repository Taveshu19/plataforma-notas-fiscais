// 19/11/2026 (Laura): boleto que chega depois de a nota ser enviada pelo lançamento. Antes, "subir boleto" ficava desligado para nota
// "Enviado" (só o "vincular boleto" funcionava). Agora o boleto do computador também entra enquanto a nota não foi enviada para
// escriturar (etapa das Aprovações antes de Encaminhadas). Ele fica em arquivos_processados, aparece nas Aprovações e segue no envio
// (Aprovações, escriturar-painel e TAG leem os boletos extras desde 19/11). Aplicado nos painéis de Expansão e Engenharia.
export function comBoletoDepoisDoEnvio(html){
  const trocar = (de, para) => { const n = html.split(de).length - 1; if (n !== 1) throw Error(`boleto-depois-do-envio: esperava 1x, achei ${n}x: ${de.slice(0, 70)}`); html = html.split(de).join(para); };
  trocar("const podeSubirBoleto = rec.status !== 'Enviado' && !travado;",
    "const podeSubirBoleto = (rec.status !== 'Enviado' || boletoAindaEntra(rec)) && !travado;");
  trocar("  async function subirBoletoLocal(id, file){\n    const rec = LANCAMENTOS.find(r=>r.id===id);\n    if(!rec) return;\n    if(rec.status === 'Enviado'){ avisarLancamentoJaEnviadoBloqueado(); return; }",
    "  // Boleto depois do envio (19/11/2026): entra enquanto a nota não foi enviada para escriturar.\n" +
    "  function boletoAindaEntra(rec){\n" +
    "    const et = window.ExpansaoDados?.fluxo?.[rec.id]?.etapa;\n" +
    "    return !!rec && rec.status === 'Enviado' && !!et && !['encaminhada', 'fiscal', 'cancelada', 'removida', 'arquivada'].includes(et);\n" +
    "  }\n" +
    "  async function subirBoletoLocal(id, file){\n    const rec = LANCAMENTOS.find(r=>r.id===id);\n    if(!rec) return;\n" +
    "    if(rec.status === 'Enviado' && !boletoAindaEntra(rec)){ showToast({ title:'Nota já enviada para escriturar', msg:'Esta nota já saiu para a escrituração. Para incluir arquivo, abra a nota nas Aprovações (Arquivos: incluir ou remover), nas etapas em que isso é permitido.', tipo:'info' }); return; }");
  // Nota já enviada: o boleto novo entra só como arquivo da nota (a linha do lançamento não muda).
  trocar("      if(!rec.arquivo_boleto_nome){\n        const patch = { arquivo_boleto_nome: file.name, arquivo_boleto_path: path };",
    "      if(!rec.arquivo_boleto_nome && rec.status !== 'Enviado'){\n        const patch = { arquivo_boleto_nome: file.name, arquivo_boleto_path: path };");
  return html;
}
