import { NextRequest, NextResponse } from "next/server";
import { GoogleGenAI } from "@google/genai";
import { PROMPT_EXTRACAO, interpretarRespostaIA } from "@/lib/extrair";

export const runtime = "nodejs";
export const maxDuration = 60;

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

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const arquivo = formData.get("imagem");

    if (!arquivo || !(arquivo instanceof File)) {
      return NextResponse.json(
        { erro: "Nenhuma imagem recebida." },
        { status: 400 }
      );
    }

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

    return NextResponse.json({ ok: true, extraido });
 } catch (erro) {
    console.error("Erro ao processar imagem:", erro);

    if (ehErroDeLimite(erro)) {
      return NextResponse.json(
        {
          ok: false,
          tipo: "limite",
          erro:
            "Limite de uso da API do Gemini atingido no momento. Aguarde alguns instantes e clique em \"Processar imagens\" novamente.",
        },
        { status: 429 }
      );
    }

    return NextResponse.json(
      {
        ok: false,
        tipo: "erro",
        erro: "Falha ao processar esta imagem. Tente novamente.",
      },
      { status: 500 }
    );
  }
}
}
