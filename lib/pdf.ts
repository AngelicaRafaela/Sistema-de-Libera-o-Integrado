import { jsPDF } from "jspdf";
import type { PedidoExtraido } from "./extrair";

type RGB = [number, number, number];

const COR = {
  ink: [31, 42, 55] as RGB,
  inkSoft: [75, 87, 104] as RGB,
  ledger: [184, 173, 160] as RGB,
  amberDark: [166, 98, 31] as RGB,
  stamp: [63, 107, 78] as RGB,
};

const MARGEM_X = 15;
const LARGURA_PAGINA = 210;
const ALTURA_PAGINA = 297;
const LARGURA_CONTEUDO = LARGURA_PAGINA - MARGEM_X * 2;

function truncarUmaLinha(doc: jsPDF, texto: string, maxWidth: number): string {
  if (doc.getTextWidth(texto) <= maxWidth) return texto;
  let cortado = texto;
  while (cortado.length > 0 && doc.getTextWidth(cortado + "…") > maxWidth) {
    cortado = cortado.slice(0, -1);
  }
  return cortado + "…";
}

interface LinhasCard {
  pedido: PedidoExtraido;
  linhasProdutos: string[][];
  altura: number;
}

function prepararCard(doc: jsPDF, pedido: PedidoExtraido): LinhasCard {
  doc.setFont("courier", "normal");
  doc.setFontSize(8);

  const listaProdutos =
    pedido.produtos.length > 0
      ? pedido.produtos.map(
          (p) => `${p.codigo} - ${p.descricao} - R$ ${p.valor}`
        )
      : ["(Nenhum produto detectado na observação)"];

  let totalLinhas = 0;
  const linhasProdutos = listaProdutos.map((texto) => {
    const linhas = doc.splitTextToSize(texto, LARGURA_CONTEUDO - 10) as string[];
    totalLinhas += linhas.length;
    return linhas;
  });

  const altura = 20 + totalLinhas * 4.2 + 6;
  return { pedido, linhasProdutos, altura };
}

function desenharCard(doc: jsPDF, card: LinhasCard, y: number) {
  const { pedido, linhasProdutos, altura } = card;

  doc.setDrawColor(...COR.ledger);
  doc.setLineWidth(0.3);
  doc.roundedRect(MARGEM_X, y, LARGURA_CONTEUDO, altura, 1.5, 1.5);

  const fieldY = y + 8;
  const colunas: { label: string; valor: string; x: number; largura: number }[] = [
    { label: "PEDIDO", valor: pedido.pedido, x: MARGEM_X + 5, largura: 38 },
    { label: "CLIENTE", valor: pedido.cliente, x: MARGEM_X + 46, largura: 60 },
    { label: "DATA", valor: pedido.data, x: MARGEM_X + 110, largura: 26 },
    { label: "PLANTA", valor: pedido.planta, x: MARGEM_X + 140, largura: 24 },
  ];

  colunas.forEach((c) => {
    doc.setFont("courier", "normal");
    doc.setFontSize(6.5);
    doc.setTextColor(...COR.inkSoft);
    doc.text(c.label, c.x, fieldY - 3.5);

    doc.setFont("courier", "bold");
    doc.setFontSize(9);
    doc.setTextColor(...COR.ink);
    const valor = truncarUmaLinha(doc, c.valor, c.largura);
    doc.text(valor, c.x, fieldY);
  });

  // Carimbo "LIBERAR"
  const stampW = 26;
  const stampH = 7;
  const stampX = MARGEM_X + LARGURA_CONTEUDO - stampW - 5;
  const stampY = y + 4;
  doc.setDrawColor(...COR.stamp);
  doc.setLineWidth(0.6);
  doc.roundedRect(stampX, stampY, stampW, stampH, 1, 1);
  doc.setFont("courier", "bold");
  doc.setFontSize(8);
  doc.setTextColor(...COR.stamp);
  doc.text("LIBERAR", stampX + stampW / 2, stampY + stampH / 2 + 1.3, {
    align: "center",
  });

  // Linha tracejada
  const dashY = y + 15;
  doc.setDrawColor(...COR.ledger);
  doc.setLineDashPattern([1, 1], 0);
  doc.line(MARGEM_X + 3, dashY, MARGEM_X + LARGURA_CONTEUDO - 3, dashY);
  doc.setLineDashPattern([], 0);

  // Produtos
  let py = dashY + 5;
  doc.setFont("courier", "normal");
  doc.setFontSize(8);
  doc.setTextColor(...COR.inkSoft);
  linhasProdutos.forEach((linhas) => {
    linhas.forEach((linha) => {
      doc.text(linha, MARGEM_X + 5, py);
      py += 4.2;
    });
  });
}

export function gerarPdfPedidos(pedidos: PedidoExtraido[]) {
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  let y = 18;

  doc.setFont("courier", "bold");
  doc.setFontSize(9);
  doc.setTextColor(...COR.amberDark);
  doc.text("MANIFESTO DE LIBERACAO . DATAVALE", MARGEM_X, y);
  y += 8;

  doc.setFont("helvetica", "bold");
  doc.setFontSize(16);
  doc.setTextColor(...COR.ink);
  doc.text(`Pedidos Liberados (${pedidos.length})`, MARGEM_X, y);
  y += 5;

  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.setTextColor(...COR.inkSoft);
  doc.text(`Gerado em ${new Date().toLocaleString("pt-BR")}`, MARGEM_X, y);
  y += 9;

  pedidos.forEach((pedido) => {
    const card = prepararCard(doc, pedido);

    if (y + card.altura > ALTURA_PAGINA - 15) {
      doc.addPage();
      y = 18;
    }

    desenharCard(doc, card, y);
    y += card.altura + 6;
  });

  doc.save("pedidos_liberados.pdf");
}
