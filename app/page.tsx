"use client";

import { useCallback, useRef, useState } from "react";
import type { PedidoExtraido } from "@/lib/extrair";
import { montarEmailFinal } from "@/lib/email";

type StatusItem = "pendente" | "processando" | "concluido" | "erro";

interface ItemImagem {
  id: string;
  arquivo: File;
  preview: string;
  status: StatusItem;
  resultado?: PedidoExtraido;
  erro?: string;
}

const CONCORRENCIA = 3;

function novoId() {
  return Math.random().toString(36).slice(2, 10);
}

async function processarUmaImagem(arquivo: File): Promise<
  { ok: true; extraido: PedidoExtraido } | { ok: false; erro: string }
> {
  const formData = new FormData();
  formData.append("imagem", arquivo);

  const resp = await fetch("/api/processar-imagem", {
    method: "POST",
    body: formData,
  });

  const dados = await resp.json();

  if (!resp.ok || !dados.ok) {
    return { ok: false, erro: dados.erro ?? "Falha desconhecida." };
  }

  return { ok: true, extraido: dados.extraido as PedidoExtraido };
}

export default function Home() {
  const [itens, setItens] = useState<ItemImagem[]>([]);
  const [processando, setProcessando] = useState(false);
  const [arrastando, setArrastando] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const adicionarArquivos = useCallback((lista: FileList | File[]) => {
    const novos: ItemImagem[] = Array.from(lista)
      .filter((f) => f.type.startsWith("image/"))
      .map((arquivo) => ({
        id: novoId(),
        arquivo,
        preview: URL.createObjectURL(arquivo),
        status: "pendente" as StatusItem,
      }));
    setItens((atual) => [...atual, ...novos]);
  }, []);

  const removerItem = (id: string) => {
    setItens((atual) => atual.filter((i) => i.id !== id));
  };

  const processarTodos = async () => {
    setProcessando(true);

    const fila = itens.filter((i) => i.status === "pendente" || i.status === "erro");
    let cursor = 0;

    async function worker() {
      while (cursor < fila.length) {
        const item = fila[cursor];
        cursor += 1;

        setItens((atual) =>
          atual.map((i) => (i.id === item.id ? { ...i, status: "processando" } : i))
        );

        const resultado = await processarUmaImagem(item.arquivo);

        setItens((atual) =>
          atual.map((i) => {
            if (i.id !== item.id) return i;
            if (resultado.ok) {
              return { ...i, status: "concluido", resultado: resultado.extraido, erro: undefined };
            }
            return { ...i, status: "erro", erro: resultado.erro };
          })
        );
      }
    }

    await Promise.all(
      Array.from({ length: Math.min(CONCORRENCIA, fila.length) }, () => worker())
    );

    setProcessando(false);
  };

  const concluidos = itens.filter((i) => i.status === "concluido" && i.resultado);
  const emailFinal =
    concluidos.length > 0
      ? montarEmailFinal(concluidos.map((i) => i.resultado!.blocoTexto))
      : "";

  const totalFila = itens.filter((i) => i.status !== "concluido").length;
  const processadosNestaRodada = itens.filter(
    (i) => i.status === "concluido" || i.status === "erro"
  ).length;

  const copiarEmail = async () => {
    await navigator.clipboard.writeText(emailFinal);
  };

  const baixarEmail = () => {
    const blob = new Blob([emailFinal], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "email_liberacao_prints.txt";
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <main className="min-h-screen px-4 py-12 sm:py-16">
      <div className="mx-auto max-w-3xl">
        <header className="mb-10">
          <p className="font-mono text-xs tracking-[0.25em] text-amber-dark uppercase">
            Manifesto de liberação · Datavale
          </p>
          <h1 className="mt-2 text-3xl font-semibold text-ink sm:text-4xl">
            Sistema de Liberação Integrado
          </h1>
          <p className="mt-2 max-w-xl text-sm text-ink-soft">
            Envie os prints da crítica de pedido. Cada um vira uma etiqueta de
            liberação, cruzada com o catálogo de produtos — e ao final você leva
            o e-mail pronto.
          </p>
        </header>

        {/* Zona de upload */}
        <section
          onDragOver={(e) => {
            e.preventDefault();
            setArrastando(true);
          }}
          onDragLeave={() => setArrastando(false)}
          onDrop={(e) => {
            e.preventDefault();
            setArrastando(false);
            if (e.dataTransfer.files) adicionarArquivos(e.dataTransfer.files);
          }}
          onClick={() => inputRef.current?.click()}
          className={`cursor-pointer rounded-sm border-2 border-dashed px-6 py-10 text-center transition-colors ${
            arrastando
              ? "border-amber bg-kraft-dark"
              : "border-ledger bg-kraft-dark/40 hover:bg-kraft-dark/70"
          }`}
        >
          <input
            ref={inputRef}
            type="file"
            accept="image/*"
            multiple
            className="hidden"
            onChange={(e) => e.target.files && adicionarArquivos(e.target.files)}
          />
          <p className="font-mono text-sm text-ink">
            Arraste os prints aqui, ou clique para selecionar
          </p>
          <p className="mt-1 text-xs text-ink-soft">PNG, JPG — quantos precisar</p>
        </section>

        {/* Chips dos arquivos pendentes */}
        {itens.length > 0 && (
          <div className="mt-6 flex flex-wrap gap-2">
            {itens.map((item) => (
              <div
                key={item.id}
                className="flex items-center gap-2 rounded-sm border border-ledger bg-white/50 py-1 pl-1 pr-2 text-xs"
              >
                <img
                  src={item.preview}
                  alt=""
                  className="h-8 w-8 rounded-sm object-cover"
                />
                <span className="max-w-[10rem] truncate font-mono text-ink-soft">
                  {item.arquivo.name}
                </span>
                <StatusBadge status={item.status} />
                {item.status !== "processando" && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      removerItem(item.id);
                    }}
                    className="text-ink-soft hover:text-reject"
                    aria-label={`Remover ${item.arquivo.name}`}
                  >
                    ×
                  </button>
                )}
              </div>
            ))}
          </div>
        )}

        {/* Ação principal */}
        {itens.length > 0 && (
          <div className="mt-6 flex items-center gap-4">
            <button
              onClick={processarTodos}
              disabled={processando || itens.every((i) => i.status === "concluido")}
              className="rounded-sm bg-amber px-5 py-2.5 font-mono text-sm font-medium text-kraft transition-colors hover:bg-amber-dark disabled:cursor-not-allowed disabled:opacity-50"
            >
              {processando
                ? `Processando ${processadosNestaRodada}/${itens.length}...`
                : "Processar imagens"}
            </button>
            {processando && (
              <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-ledger/40">
                <div
                  className="h-full bg-amber transition-all duration-300"
                  style={{
                    width: `${(processadosNestaRodada / Math.max(itens.length, 1)) * 100}%`,
                  }}
                />
              </div>
            )}
          </div>
        )}

        {/* Tickets de resultado */}
        {concluidos.length > 0 && (
          <section className="mt-10 space-y-4">
            <h2 className="font-mono text-xs uppercase tracking-[0.2em] text-ink-soft">
              Pedidos liberados ({concluidos.length})
            </h2>
            {concluidos.map((item) => (
              <TicketPedido key={item.id} extraido={item.resultado!} />
            ))}
          </section>
        )}

        {/* E-mail final */}
        {emailFinal && (
          <section className="mt-10">
            <div className="flex items-center justify-between">
              <h2 className="font-mono text-xs uppercase tracking-[0.2em] text-ink-soft">
                E-mail pronto
              </h2>
              <div className="flex gap-2">
                <button
                  onClick={copiarEmail}
                  className="rounded-sm border border-ink px-3 py-1.5 font-mono text-xs text-ink hover:bg-ink hover:text-kraft"
                >
                  Copiar
                </button>
                <button
                  onClick={baixarEmail}
                  className="rounded-sm bg-ink px-3 py-1.5 font-mono text-xs text-kraft hover:bg-ink-soft"
                >
                  Baixar .txt
                </button>
              </div>
            </div>
            <pre className="mt-3 whitespace-pre-wrap rounded-sm border border-ledger bg-white/60 p-4 font-mono text-xs leading-relaxed text-ink">
              {emailFinal}
            </pre>
          </section>
        )}
      </div>
    </main>
  );
}

function StatusBadge({ status }: { status: StatusItem }) {
  const mapa: Record<StatusItem, { texto: string; classe: string }> = {
    pendente: { texto: "pendente", classe: "text-ink-soft" },
    processando: { texto: "lendo...", classe: "text-amber-dark" },
    concluido: { texto: "ok", classe: "text-stamp" },
    erro: { texto: "erro", classe: "text-reject" },
  };
  const { texto, classe } = mapa[status];
  return <span className={`font-mono ${classe}`}>{texto}</span>;
}

function TicketPedido({ extraido }: { extraido: PedidoExtraido }) {
  return (
    <div className="animar-carimbo relative overflow-hidden rounded-sm border border-ledger bg-white/70 p-5">
      <div className="absolute right-4 top-4 rotate-3 rounded-sm border-2 border-stamp px-2 py-0.5 font-mono text-[10px] font-bold uppercase tracking-wider text-stamp">
        Liberado
      </div>
      <dl className="grid grid-cols-2 gap-x-6 gap-y-1 font-mono text-sm text-ink sm:grid-cols-4">
        <Campo rotulo="Pedido" valor={extraido.pedido} />
        <Campo rotulo="Cliente" valor={extraido.cliente} />
        <Campo rotulo="Data" valor={extraido.data} />
        <Campo rotulo="Planta" valor={extraido.planta} />
      </dl>
      <div className="mt-3 border-t border-dashed border-ledger pt-3">
        {extraido.produtos.length > 0 ? (
          <ul className="space-y-1 font-mono text-xs text-ink-soft">
            {extraido.produtos.map((p, idx) => (
              <li key={idx}>
                {p.codigo} — {p.descricao} — R$ {p.valor}
              </li>
            ))}
          </ul>
        ) : (
          <p className="font-mono text-xs text-ink-soft">
            Nenhum produto detectado na observação.
          </p>
        )}
      </div>
    </div>
  );
}

function Campo({ rotulo, valor }: { rotulo: string; valor: string }) {
  return (
    <div>
      <dt className="text-[10px] uppercase tracking-wider text-ink-soft">{rotulo}</dt>
      <dd className="truncate">{valor}</dd>
    </div>
  );
}
