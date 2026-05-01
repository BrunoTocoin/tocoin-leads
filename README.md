# Tocoin — Gerador de Leads com IA

App de captura de leads com geração de imagem via Gemini Imagen 3.

## Stack
- Frontend: HTML/CSS/JS puro
- Banco de dados: Supabase (PostgreSQL)
- Geração de imagem: Google Gemini Imagen 3
- Hospedagem: Google Cloud Run

---

## 1. Configurar o Supabase

Antes de subir o app, crie a tabela de leads no Supabase.

Acesse seu projeto em https://supabase.com e vá em **SQL Editor** e execute:

```sql
CREATE TABLE leads (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  nome text NOT NULL,
  telefone text NOT NULL,
  email text NOT NULL,
  tipo text,
  material text,
  descricao text,
  criado_em timestamptz DEFAULT now()
);
```

---

## 2. Atualizar o número do WhatsApp

No arquivo `index.html`, localize a linha:

```js
const WHATSAPP = '5548999999999';
```

Substitua pelo número real da Tocoin no formato internacional (55 + DDD + número).

---

## 3. Subir no GitHub

1. Acesse https://github.com/new
2. Crie um repositório chamado `tocoin-leads` (privado ou público)
3. Faça upload dos arquivos `index.html` e `Dockerfile`

---

## 4. Deploy no Cloud Run

1. Acesse https://console.cloud.google.com
2. Vá em **Cloud Run → Create Service**
3. Selecione **"Continuously deploy from a repository"**
4. Conecte seu GitHub e selecione o repositório `tocoin-leads`
5. Em **Build configuration**, selecione **Dockerfile**
6. Em **Authentication**, marque **"Allow unauthenticated invocations"** (acesso público)
7. Clique em **Create**

O Cloud Run vai fazer o build e publicar automaticamente. A URL pública aparece no topo do serviço.

---

## 5. Atualizar automaticamente

Sempre que você fizer push no GitHub, o Cloud Run atualiza o app automaticamente.
