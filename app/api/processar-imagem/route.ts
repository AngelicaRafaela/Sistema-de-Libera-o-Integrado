import { NextRequest, NextResponse } from "next/server";
import { GoogleGenAI } from "@google/genai";
import { PROMPT_EXTRACAO, interpretarRespostaIA } from "@/lib/extrair";

export const runtime = "nodejs";
export const maxDuration = 60;

const CHAVES_API = [process.env.GEMINI_API_KEY, process.env.GEMINI_API_KEY_2].filter(
  (chave): chave is string => Boolean(chave)
);
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

// Erros que valem tentar a próxima chave: limite/quota (429) OU modelo
// sobrecarregado do lado do Google (503/UNAVAILABLE), que é o mais comum na prática.
function ehErroParaTentarProximaChave(erro: unknown): boolean {
  if (!erro || typeof erro !== "object") return false;
  const status =
    "status" in erro ? (erro as { status?: unknown }).status : undefined;
  const code =
    "code" in erro ? (erro as { code?: unknown }).code : undefined;
  const mensagem =
    "message" in erro ? String((erro as { message?: unknown }).message) : "";
  return (
    ehErroDeLimite(erro) ||
    status === 503 ||
    code === 503 ||
    status === "UNAVAILABLE" ||
    /UNAVAILABLE|overloaded|high demand/i.test(mensagem)
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

    if (CHAVES_API.length === 0) {
      return NextResponse.json(
        {
          ok: false,
          tipo: "erro",
          erro: "Nenhuma chave da API do Gemini configurada.",
        },
        { status: 500 }
      );
    }

    const bytes = Buffer.from(await arquivo.arrayBuffer());
    const base64 = bytes.toString("base64");

    let ultimoErro: unknown = null;

    for (let i = 0; i < CHAVES_API.length; i++) {
      const client = new GoogleGenAI({ apiKey: CHAVES_API[i] });

      try {
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
        ultimoErro = erro;

        // Se deu erro de limite/quota ou o modelo está sobrecarregado (503),
        // e ainda há outra chave disponível, tenta a próxima.
        if (ehErroParaTentarProximaChave(erro) && i < CHAVES_API.length - 1) {
          console.warn(`Chave ${i + 1} falhou (limite ou sobrecarga), tentando próxima chave.`);
          continue;
        }

        throw erro;
      }
    }

    throw ultimoErro;
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

    if (ehErroParaTentarProximaChave(erro)) {
      return NextResponse.json(
        {
          ok: false,
          tipo: "limite",
          erro:
            "O modelo do Gemini está sobrecarregado no momento (todas as chaves configuradas falharam). Aguarde alguns instantes e clique em \"Processar imagens\" novamente.",
        },
        { status: 503 }
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