export function saudacaoAtual(agora: Date = new Date()): string {
  const hora = agora.getHours();
  if (hora >= 5 && hora < 12) return "bom dia";
  if (hora >= 12 && hora < 18) return "boa tarde";
  return "boa noite";
}

export function montarEmailFinal(blocos: string[]): string {
  const cabecalho = `Prezados, ${saudacaoAtual()}.\n\nSolicito, por gentileza, a liberação de crítica referente a VALOR DO PRODUTO ABAIXO DA TABELA para o(s) pedido(s) detalhado(s) abaixo:\n\n`;
  const separador = "\n\n" + "-".repeat(60) + "\n\n";
  return cabecalho + blocos.join(separador) + "\n\nAtenciosamente,";
}
