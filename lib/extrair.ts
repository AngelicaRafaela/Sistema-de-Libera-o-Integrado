import catalogo from "./catalogo.json";

export const PROMPT_EXTRACAO = `
Analise a imagem desta tela do sistema ERP Datavale.
Extraia as seguintes informações e retorne EXATAMENTE no formato abaixo, sem adicionar mais nenhum texto. Se um campo não existir na imagem, coloque ___:

PEDIDO: [número do pedido selecionado na lista, ex: 4.483.343]
CLIENTE: [nome do cliente na linha amarela selecionada]
DATA: [data da coluna Data Carga da linha amarela]
PLANTA: [número da coluna Planta da linha amarela]
CARGA: [número da coluna Carga da linha amarela]
OBSERVACAO: [copie TODO o texto que está dentro do campo inferior 'Observação da Crítica']
`.trim();

export interface PedidoExtraido {
  pedido: string;
  cliente: string;
  data: string;
  planta: string;
  carga: string;
  produtos: { codigo: string; descricao: string; valor: string }[];
  blocoTexto: string;
}

function capturar(regex: RegExp, texto: string): string {
  const m = texto.match(regex);
  return m ? m[1].trim() : "___";
}

export function interpretarRespostaIA(textoIA: string): PedidoExtraido {
  const pedido = capturar(/PEDIDO:\s*(.*)/, textoIA);
  const cliente = capturar(/CLIENTE:\s*(.*)/, textoIA);
  const data = capturar(/DATA:\s*(.*)/, textoIA);
  const planta = capturar(/PLANTA:\s*(.*)/, textoIA);
  const carga = capturar(/CARGA:\s*(.*)/, textoIA);

  const obsMatch = textoIA.match(/OBSERVACAO:\s*([\s\S]*)/i);
  const observacao = obsMatch ? obsMatch[1].trim() : "";

  const catalogoTipado = catalogo as Record<string, string>;
  const itensRegex = /Produto\s+(\d+)\s+Valor\s+Pedido\s+R\$?\s*([\d.,]+)/gi;
  const produtos: PedidoExtraido["produtos"] = [];
  let m: RegExpExecArray | null;
  while ((m = itensRegex.exec(observacao)) !== null) {
    const codigo = m[1];
    const valor = m[2].replace(".", ",");
    const descricao = catalogoTipado[codigo] ?? "DESCRIÇÃO NÃO ENCONTRADA";
    produtos.push({ codigo, descricao, valor });
  }

  const textoProdutos =
    produtos.length > 0
      ? produtos
          .map((p) => `PRODUTO - ${p.codigo} - ${p.descricao} - R$ ${p.valor}`)
          .join("\n")
      : "(NENHUM PRODUTO DETECTADO NA OBSERVAÇÃO)";

  const blocoTexto = `PEDIDO  - ${pedido}\nCLIENTE - ${cliente}\nDATA    - ${data}\nPLANTA  - ${planta}\nCARGA   - ${carga}\n\nPRODUTOS:\n${textoProdutos}`;

  return { pedido, cliente, data, planta, carga, produtos, blocoTexto };
}
