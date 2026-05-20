# Deploy no Render

## Segurança

- **Nunca** commite `.env` ou chaves no GitHub.
- Configure credenciais apenas no **Render Dashboard** → seu Web Service → **Environment**.
- O `render.yaml` não define valores de secrets.

Variáveis necessárias (crie no painel do Render):

| Nome | Obrigatório | Observação |
|------|-------------|------------|
| `OPENAI_API_KEY` | Sim | Painel OpenAI |
| `ALLOWED_ALEXA_USER_IDS` | Sim (produção) | `userId` da Alexa (log local ou JSON Input) |
| `ALEXA_VERIFY_SIGNATURE` | Sim | `true` em produção |
| `NODE_ENV` | Recomendado | `production` |

O Render define `PORT` automaticamente.

---

## 1. Repositório

Código em: `https://github.com/brunossaless/alexa-ai-backend`

---

## 2. Criar Web Service

**Opção A — Blueprint**

1. [dashboard.render.com](https://dashboard.render.com) → **New** → **Blueprint**
2. Conecte o repositório
3. Após criar o serviço, abra **Environment** e adicione as variáveis da tabela acima

**Opção B — Manual**

1. **New** → **Web Service** → conecte o repo
2. **Runtime:** Docker
3. **Health Check Path:** `/health`
4. **Environment:** adicione as variáveis da tabela
5. **Create Web Service**

---

## 3. Endpoint na Alexa

URL do Render (exemplo):

```text
https://alexa-ai-backend.onrender.com
```

**Alexa Developer Console** → **Build** → **Endpoint** → HTTPS:

```text
https://alexa-ai-backend.onrender.com/alexa
```

Teste: `https://alexa-ai-backend.onrender.com/health` → `ok`

---

## 4. Skill privada

1. **Backend:** `ALLOWED_ALEXA_USER_IDS` com seu `userId`
2. **Console:** **Distribution** → **Development** (só sua conta)

### Descobrir `userId`

Com `ALLOWED_ALEXA_USER_IDS` vazio só em **local** (`.env` não vai pro Git):

1. `npm run start:dev`
2. Simulador: `abrir agente pessoal`
3. Copie o `userId` do log ou do **JSON Input**
4. Cole no **Environment** do Render (não no repositório)

---

## 5. Plano Free

Serviço dorme sem uso; primeira requisição pode demorar. Para Echo no dia a dia, use plano **Starter**.

---

## 6. Checklist

- [ ] Deploy verde no Render
- [ ] Secrets só no painel Render
- [ ] `/health` responde `ok`
- [ ] Endpoint Alexa = `https://....onrender.com/alexa`
- [ ] Skill em Development
- [ ] Teste com pergunta curta
