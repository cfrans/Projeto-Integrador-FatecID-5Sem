# Backend

Fundação NestJS/TypeScript, Prisma e MySQL. Consulte [execução, estrutura e verificações](../docs/backend.md), [persistência](../docs/database.md) e [arquitetura](../docs/architecture.md).

Na raiz, configure `.env` a partir de `.env.example` e execute `docker compose up -d --build`. Saúde: `http://localhost:3000/health`; Swagger: `http://localhost:3000/docs`.

Implementados: login/perfil de responsáveis, listagem autorizada, identidade individual de computador provisionada administrativamente, sessões temporárias de pareamento e vínculos revogáveis. Seeds de desenvolvimento criam contas e dispositivos demonstrativos.

Sem Docker, configure MySQL e `.env`, instale as dependências e gere o client/aplique migrations conforme o [tutorial da raiz](../README.md#3b-preparar-sem-docker); depois execute `npm run start:dev` em `backend/`. Ambos os modos usam o mesmo código e migrations.

Ainda não há fila de comandos parentais, presença de computadores, Lux Agent ou integração GNOME. Os endpoints `/agent/*` são contratos do backend, não um Agent instalado no Lux.
