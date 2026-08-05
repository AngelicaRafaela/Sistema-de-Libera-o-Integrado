import { NextRequest, NextResponse } from "next/server";
import { GoogleGenAI } from "@google/genai";
import { PROMPT_EXTRACAO, interpretarRespostaIA } from "@/lib/extrair";

export const runtime = "nodejs";
export const maxDuration = 60; // Aumenta o tempo limite para aguardar o lote inteiro

const client = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
const NOME_MODELO = "gemini-flash-latest";

function ehErroDeLimite(erro: unknown): boolean {
  if (!erro || typeof erro !== "object") return false;
  const status =
    "status" in erro ? (erro as { status?: unknown }).status : undefined;
  const code =
    "code" in erro ? (erro as { code?: unknown }).code : undefined;
  const mensagem =
    "message" in erro ? String((erro as { message?: unknown }).message) : "";
  return (
    status === 429 ||
    code === 429 ||
    /RESOURCE_EXHAUSTED|rate limit|quota/i.test(mensagem)
  );
}

// Função auxiliar para criar uma pausa de segurança entre as requisições (evita o erro 429)
const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    // Mudamos para aceitar múltiplos arquivos de uma vez (ex: formData.append("imagens", arquivo))
    const arquivos = formData.getAll("imagens");

    if (!arquivos || arquivos.length === 0) {
      return NextResponse.json(
        { erro: "Nenhuma imagem recebida." },
        { status: 400 }
      );
    }

    const resultados = [];

    // Processa as imagens sequencialmente (em fila)
    for (let i = 0; i < arquivos.length; i++) {
      const arquivo = arquivos[i];
      if (!(arquivo instanceof File)) continue;

      try {
        const bytes = Buffer.from(await arquivo.arrayBuffer());
        const base64 = bytes.toString("base64");

        const resposta = await client.models.generateContent({
          model: NOME_MODELO,
          contents: [
            {
              role: "user",
              parts: [
                { text: PROMPT_EXTRACAO },
                { inlineData: { mimeType: arquivo.type || "image/jpeg", data: base64 } },
              ],
            },
          ],
        });

        const textoIA = resposta.text ?? "";
        const extraido = interpretarRespostaIA(textoIA);
        resultados.push({ ok: true, extraido, nome: arquivo.name });

        // Se ainda houverem imagens na fila, aguarda 1.5 segundos antes da próxima chamada
        if (i < arquivos.length - 1) {
          await delay(1500);
        }
      } catch (erroItem) {
        console.error(`Erro ao processar a imagem ${arquivo.name}:`, erroItem);

        // Se bater no limite mesmo com o delay, retorna o aviso amigável
        if (ehErroDeLimite(erroItem)) {
          return NextResponse.json(
            {
              ok: false,
              tipo: "limite",
              erro: "Limite de uso da API do Gemini atingido ao processar o lote. Aguarde alguns instantes e tente novamente.",
            },
            { status: 429 }
          );
        }

        resultados.push({ ok: false, erro: "Falha ao processar esta imagem.", nome: arquivo.name });
      }
    }

    return NextResponse.json({ ok: true, resultados });
  } catch (erro) {
    console.error("Erro geral no endpoint:", erro);
    return NextResponse.json(
      {
        ok: false,
        tipo: "erro",
        erro: "Falha ao processar as imagens. Tente novamente.",
      },
      { status: 500 }
    );
  }
}