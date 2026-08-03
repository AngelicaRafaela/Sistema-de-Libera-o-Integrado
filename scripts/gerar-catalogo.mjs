// Gera lib/catalogo.json a partir de um produtos.pdf local.
//
// Uso:
//   node scripts/gerar-catalogo.mjs caminho/para/produtos.pdf
//
// Rode isso sempre que a tabela de produtos mudar, e faça commit do
// lib/catalogo.json atualizado. O site em produção nunca lê o PDF —
// ele só lê esse JSON, que fica junto do código.

import fs from "node:fs";
import path from "node:path";
import pdfParse from "pdf-parse";

const caminhoPdf = process.argv[2];

if (!caminhoPdf) {
  console.error("Uso: node scripts/gerar-catalogo.mjs caminho/para/produtos.pdf");
  process.exit(1);
}

const buffer = fs.readFileSync(caminhoPdf);
const dados = await pdfParse(buffer);

const catalogo = {};
const linhas = dados.text.split("\n");

const regexLinha =
  /^\s*(\d+)\s*\|?\s*(.*?)(?=\s*\||\s+BOVINOS|\s+SUINOS|\s+INDUSTRIALIZADO|\s+BOUTIQUE|\s+TCHE|\s+\d{7}|$)/;

for (const linha of linhas) {
  const m = linha.match(regexLinha);
  if (m) {
    const codigo = m[1].trim();
    const descricao = m[2].trim();
    if (codigo && descricao) {
      catalogo[codigo] = descricao;
    }
  }
}

const destino = path.join(process.cwd(), "lib", "catalogo.json");
fs.writeFileSync(destino, JSON.stringify(catalogo, null, 2), "utf-8");

console.log(`✅ ${Object.keys(catalogo).length} produtos extraídos e salvos em ${destino}`);
