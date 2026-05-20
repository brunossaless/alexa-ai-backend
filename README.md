# Alexa AI Backend

Backend NestJS para skill Alexa **agente pessoal** (OpenAI + endpoint `POST /alexa`).

Desenvolvido por **Bruno Sales**.

## Local

```bash
npm install
# crie .env local (gitignored) — nomes das variáveis em DEPLOY.md
npm run start:dev
```

Variáveis locais: veja nomes em `DEPLOY.md` (nunca commite valores reais).

## Deploy

Produção no **[Render](https://render.com)** — guia completo em **[DEPLOY.md](./DEPLOY.md)**.

## Estrutura

- `src/alexa-skill.service.ts` — handlers da skill
- `src/alexa-ai.service.ts` — OpenAI
- `src/alexa-user-access.service.ts` — allowlist por `userId`
- `skill-model/` — interaction model pt-BR para o Developer Console
