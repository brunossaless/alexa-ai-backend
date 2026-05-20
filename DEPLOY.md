# Deploy e skill privada (só você)

Duas camadas de proteção:

1. **Backend** — `ALLOWED_ALEXA_USER_IDS` bloqueia qualquer outra conta Amazon.
2. **Console Alexa** — skill em modo desenvolvimento ou distribuição privada.

---

## Deploy no Render (recomendado)

### Pré-requisitos

- Conta em [render.com](https://render.com)
- Código no **GitHub** ou **GitLab** (Render conecta ao repositório)

### Opção A — Blueprint (`render.yaml`)

1. Suba o projeto para um repositório Git.
2. Render → **New** → **Blueprint** → conecte o repo.
3. O Render lê `render.yaml` e cria o serviço **alexa-ai-backend**.
4. No painel, preencha os secrets que ficaram vazios:
   - `OPENAI_API_KEY`
   - `ALLOWED_ALEXA_USER_IDS` (seu `userId` longo da Alexa)

### Opção B — Manual (sem Blueprint)

1. **New** → **Web Service**
2. Conecte o repositório
3. **Runtime:** Docker
4. **Health Check Path:** `/health`
5. **Environment Variables:**

| Key | Value |
|-----|--------|
| `OPENAI_API_KEY` | sua chave `sk-...` |
| `ALLOWED_ALEXA_USER_IDS` | `amzn1.ask.account....` |
| `ALEXA_VERIFY_SIGNATURE` | `true` |
| `NODE_ENV` | `production` |

6. **Create Web Service** → aguarde o deploy

### URL do endpoint Alexa

Após o deploy, Render mostra algo como:

```text
https://alexa-ai-backend.onrender.com
```

No **Alexa Developer Console** → **Endpoint** → HTTPS:

```text
https://alexa-ai-backend.onrender.com/alexa
```

Teste: `https://alexa-ai-backend.onrender.com/health` → deve retornar `ok`.

### Plano Free do Render (importante)

No plano **grátis**, o serviço **dorme** após ~15 min sem uso. A primeira pergunta na Alexa pode demorar (cold start) e estourar o timeout de 8s.

Para uso no Echo no dia a dia, use o plano **Starter** (~US$ 7/mês) ou outro host sempre ligado.

### Atualizar o código

Cada `git push` na branch conectada dispara deploy automático (se Auto-Deploy estiver ativo).

---

## 1. Descobrir seu `userId` da Alexa

1. Suba o backend (local ou Fly) **sem** `ALLOWED_ALEXA_USER_IDS` (ou vazio).
2. Abra a skill no simulador ou no Echo e diga: `abrir agente pessoal`.
3. No log do servidor aparece:
   ```text
   Alexa userId (copie para ALLOWED_ALEXA_USER_IDS): amzn1.ask.account.XXXX
   ```
4. Copie esse valor.

---

## 2. Console Alexa

### Endpoint

**Build** → **Endpoint** → HTTPS:

```text
https://SEU-SERVICO.onrender.com/alexa
```

Região padrão (US/EU conforme skill). SSL do Render é aceito pela Amazon.

### Só sua conta (console)

**Distribution** (ou **Availability**):

| Opção | Efeito |
|--------|--------|
| **Development** | Só desenvolvedores da skill + dispositivos da sua conta Amazon |
| **Private** + beta testers | Lista explícita de e-mails Amazon |

Para uso pessoal, **Development** costuma bastar. O `ALLOWED_ALEXA_USER_IDS` no servidor impede outro `userId` mesmo que alguém ache o endpoint.

### Publicar

**Build Model** → testar no simulador → no Echo: *"Alexa, abrir agente pessoal"*.

---

## 3. Variáveis de ambiente

| Variável | Obrigatório | Descrição |
|----------|-------------|-----------|
| `OPENAI_API_KEY` | Sim | Chave OpenAI com crédito |
| `ALLOWED_ALEXA_USER_IDS` | Recomendado em produção | `userId` separados por vírgula |
| `ALEXA_VERIFY_SIGNATURE` | `true` em produção | Valida assinatura da Amazon |
| `PORT` | Não | Render injeta automaticamente; o app usa `process.env.PORT` |

---

## 4. Alternativa: Fly.io

Arquivos `fly.toml` e `Dockerfile` no repo. Ver [Fly docs](https://fly.io/docs) se preferir Fly em vez de Render.

Evite túnel temporário (`trycloudflare` / ngrok) em produção — a URL muda e a Alexa para de responder.

---

## 5. Checklist

- [ ] Web Service no Render com deploy verde
- [ ] `ALLOWED_ALEXA_USER_IDS` com seu `userId`
- [ ] `ALEXA_VERIFY_SIGNATURE=true`
- [ ] Endpoint no console = `https://....onrender.com/alexa`
- [ ] Skill em Development ou Private
- [ ] Teste: pergunta curta → resposta da IA em &lt; 8s
