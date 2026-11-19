# Backend

Fundação NestJS/TypeScript, Prisma e MySQL. Consulte [execução, estrutura e verificações](../docs/backend/api.md), [persistência](../docs/backend/database.md) e [arquitetura](../docs/architecture/overview.md).

Na raiz, configure `.env` a partir de `.env.example` e execute `docker compose up -d --build`. Saúde: `http://localhost:3000/health`; Swagger: `http://localhost:3000/docs` (desligado com `NODE_ENV=production`).

Implementados: cadastro, login e recuperação de senha de responsáveis; listagem autorizada; autorregistro e pareamento do Lux Agent; fila de comandos (`agent.ping` e `parental.app_filter.set`, este atrás de `ENABLE_PARENTAL_COMMANDS`); relatórios e presença do Agent; e a API do client simulado. Seeds de desenvolvimento criam contas e dispositivos demonstrativos.

Sem Docker, configure MySQL e `.env`, instale as dependências e gere o client/aplique migrations conforme o [tutorial da raiz](../README.md#3c-alternativa-sem-docker); depois execute `npm run start:dev` em `backend/`. Ambos os modos usam o mesmo código e migrations.
