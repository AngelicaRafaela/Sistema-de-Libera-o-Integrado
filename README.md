# Sistema de Liberação Integrado

Web app que lê prints do ERP Datavale via Gemini, cruza os produtos com o
catálogo e monta o e-mail de liberação de crítica pronto para enviar.

## 1. Rodar localmente

```bash
npm install
cp .env.local.example .env.local
# edite .env.local e cole sua chave do Gemini em GEMINI_API_KEY
npm run dev
```

Abra http://localhost:3000

## 2. Gerar o catálogo de produtos (uma vez, e sempre que a tabela mudar)

O site nunca lê o `produtos.pdf` diretamente — ele lê um `lib/catalogo.json`
já processado, que fica commitado no repositório. Isso é bem mais rápido e
não depende de nenhuma lib de PDF rodando em produção.

```bash
node scripts/gerar-catalogo.mjs caminho/para/produtos.pdf
```

Isso sobrescreve `lib/catalogo.json`. Depois é só commitar o arquivo.

Sempre que a tabela de produtos for atualizada, rode o script de novo e
suba a mudança (pode ser um commit direto pelo GitHub, sem precisar mexer
no resto do código).

## 3. Deploy na Vercel

```bash
git init
git add .
git commit -m "Sistema de liberação integrado"
git branch -M main
git remote add origin <url_do_seu_repo_no_github>
git push -u origin main
```

Na Vercel:

1. **Add New Project** → importe o repositório.
2. Em **Environment Variables**, adicione:
   - `GEMINI_API_KEY` = sua chave do Gemini (a mesma que você usava no Colab)
3. Deploy.

A chave fica só no servidor (variável de ambiente), nunca é exposta no
navegador — diferente do Colab, onde ela ficava escrita direto no código.

## Como o processamento funciona

Cada imagem é enviada para `/api/processar-imagem` **individualmente** (não
manda tudo de uma vez para uma função só). O front dispara até 3 chamadas em
paralelo (`CONCORRENCIA` em `app/page.tsx`) e vai exibindo o resultado de
cada pedido assim que ele fica pronto — por isso a sensação de velocidade é
bem melhor que a versão em Gradio, que só devolvia algo depois de processar
o lote inteiro.

Se quiser, dá para aumentar `CONCORRENCIA` em `app/page.tsx` — só ficar de
olho no rate limit da sua chave do Gemini.
