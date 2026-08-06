export function montarEmailFinal(blocos: string[]): string {
  const cabecalho =
    "Prezados, boa tarde.\n\nSolicito, por gentileza, a liberação de crítica referente a VALOR DO PRODUTO ABAIXO DA TABELA para o(s) pedido(s) detalhado(s) abaixo:\n\n";
  const separador = "\n\n" + "-".repeat(60) + "\n\n";
  return cabecalho + blocos.join(separador) + "\n\nAtenciosamente,";
}
