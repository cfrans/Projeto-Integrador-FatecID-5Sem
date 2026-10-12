# piplup

Projeto Integrador: aplicativo Expo para controle parental em computadores Lenovo Lux, com API NestJS, Prisma e MySQL. Login, perfil, listagem, pareamento e revogação de vínculos usam a API real. A demonstração usa computadores fictícios; ainda não há Lux Agent, interface GTK ou integração Lux/GNOME. Consulte o [estado das etapas](docs/architecture.md#etapas-de-implementação).

## 1. Pré-requisitos e clone

- Git, Node.js **24.15+ na linha 24**, npm e Expo Go compatível com **SDK 57** no celular.
- **Com Docker:** Docker Desktop no Windows/macOS ou Engine com Compose v2 no Linux.
- **Sem Docker:** MySQL **8.4** local ou servidor de desenvolvimento acessível.

Confira `git --version`, `node --version` e `npm --version`. Para Docker, também `docker --version` e `docker compose version`; para cliente MySQL local, `mysql --version`.

```bash
git clone https://github.com/cfrans/Projeto-Integrador-FatecID-5Sem.git
cd Projeto-Integrador-FatecID-5Sem
```

## 2. Configuração inicial

Na raiz, copie o exemplo (no PowerShell: `Copy-Item .env.example .env`):

```bash
cp .env.example .env
```

Edite `.env`:

- Preencha `MYSQL_PASSWORD`, `JWT_SECRET` e, com Docker, `MYSQL_ROOT_PASSWORD` com uma senha diferente. Para gerar o JWT_SECRET: `node -e "console.log(require('node:crypto').randomBytes(32).toString('hex'))"`.
- Mantenha `NODE_ENV=development`. Defina `DEV_GUARDIAN_EMAIL`, `DEV_GUARDIAN_NAME` e `DEV_GUARDIAN_PASSWORD` (12–128 caracteres) para criar sua conta de teste.
- Os valores padrão usam banco `piplup`, usuário `piplup_app`, MySQL `127.0.0.1:3306` e API `3000`. Ajuste os dados MySQL se usar outro servidor; para conexão remota, consulte [configuração de transporte](docs/backend.md#desenvolvimento-no-host).

As credenciais são individuais e privadas: nunca versione `.env`. NestJS e Prisma carregam esse arquivo mesmo executados em `backend/`; não crie outra cópia nem uma `DATABASE_URL`. O mobile recebe somente a configuração pública da API, explicada no passo 4.

## 3A. Preparar com Docker

Abra Docker Desktop e aguarde o Engine iniciar, se usar Desktop. Na raiz:

```bash
docker compose up -d
docker compose ps
```

A primeira execução constrói a imagem. O backend espera MySQL, gera Prisma Client, aplica migrations e inicia NestJS com hot reload. Aguarde os serviços saudáveis e teste `http://localhost:3000/health`. Swagger: `http://localhost:3000/docs` (ajuste se mudou `PORT`).

Para um banco novo, crie a conta de login:

```bash
docker compose run --rm backend npm run prisma:seed
```

Opcionalmente, crie dispositivos demonstrativos com `docker compose run --rm backend npm run prisma:seed:devices`. Não repita o seed de conta se ela já existir. Seeds ficam em containers separados para preservar o servidor em watch.

Logs: `docker compose logs -f backend`; reiniciar API: `docker compose restart backend`; desligar: `docker compose down`, que preserva os dados. Mudanças TypeScript têm hot reload; dependências/Dockerfile exigem `docker compose up -d --build`. [Detalhes do Docker](docs/backend.md#executar-com-docker).

## 3B. Preparar sem Docker

Instale/inicie MySQL 8.4 ou use um servidor provisionado. Para criar banco e conta locais, entre com `mysql -u root -p` e execute uma vez, substituindo a senha:

```sql
CREATE DATABASE piplup CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci;
CREATE USER 'piplup_app'@'localhost' IDENTIFIED BY '<senha_local>';
GRANT ALL PRIVILEGES ON piplup.* TO 'piplup_app'@'localhost';
```

Use esses dados na `.env`: `MYSQL_HOST=127.0.0.1`, `MYSQL_PORT=3306`, `MYSQL_DATABASE=piplup`, `MYSQL_USER=piplup_app` e a senha escolhida. `MYSQL_ROOT_PASSWORD` pode ficar vazio; a API não usa root. Para banco existente/remoto e permissões de origem, veja [MySQL sem Docker](docs/database.md#sem-docker).

A partir da raiz:

```bash
cd backend
npm install
npm run prisma:generate
npm run prisma:migrate:deploy
```

Em banco novo, antes do servidor, execute `npm run prisma:seed` para criar sua conta. Para dispositivos demonstrativos, use também `npm run prisma:seed:devices`. Se a conta já existir, não repita seu seed. Depois:

```bash
npm run start:dev
```

Confira `http://localhost:3000/health` e Swagger em `/docs`. Nenhum comando Docker é necessário. Para instalação reproduzível, use `npm ci` no lugar de `npm install`.

### Migrations

`npm run prisma:migrate:deploy` aplica migrations existentes; o Docker faz isso ao iniciar. Após receber novas migrations/schema, no host aplique as migrations e execute `npm run prisma:generate` antes do watch.

Para criar uma migration, prepare as [permissões shadow](docs/database.md#prisma-e-sql) num banco exclusivo de desenvolvimento e, em `backend/`, execute:

```bash
npm run prisma:migrate:dev -- --name <nome> --create-only
```

Revise o SQL, aplique com `npm run prisma:migrate:deploy` e gere o client. Não use `db push` ou reset para contornar erros. Mudar credenciais na `.env` não altera contas de um volume MySQL existente. [Banco e migrations](docs/database.md).

## 4. Abrir no celular

Com a API iniciada, abra outro terminal na raiz:

```bash
cd mobile
npm install
npx expo start
```

Leia o QR no Expo Go (Android) ou com a câmera (iPhone). Faça login com a conta criada pelo seed. O QR abre o app; não faz pareamento com o Lux.

O computador pode usar cabo e o celular Wi-Fi, desde que a rede permita comunicação. Descubra o IPv4 do adaptador ativo: `ipconfig` no Windows, `ip -4 addr` no Linux ou `ipconfig getifaddr en0` no macOS. Teste **no navegador do celular** `http://<IP-do-PC>:3000/health`; deve retornar `{ "status": "ok", "database": "ok" }`. `localhost` no celular aponta para o próprio aparelho.

Em desenvolvimento LAN, o mobile tenta usar o IPv4 privado informado pelo Expo, com API na porta `3000`. Para WSL, outra porta/servidor ou falha dessa descoberta, copie `mobile/.env.example` para `mobile/.env.local` e preencha:

```env
EXPO_PUBLIC_API_URL=http://<IP-do-PC>:<PORT>
```

Substitua IP/porta e reinicie o Expo. Não coloque segredos nesse arquivo.

**WSL2:** com Docker Desktop, habilite Settings → Resources → WSL Integration e use o IP LAN do Windows. Evite manter outro Docker Engine ativo no Ubuntu. Firewall, perfil Public e isolamento do Wi-Fi podem bloquear a API; use Private somente em redes confiáveis. NestJS direto no WSL/NAT pode exigir encaminhamento. [Guia WSL e firewall](docs/mobile.md#wsl2-e-firewall).

Se o QR não conectar, tente `npx expo start --tunnel`. **O túnel expõe o Metro, não a API.** Redes sem comunicação direta exigem uma conexão privada entre os aparelhos ou um servidor de desenvolvimento protegido/HTTPS. [Conectividade e teste manual](docs/mobile.md#validação-manual-no-celular).

## Uso diário

| Terminal | Com Docker                      | Sem Docker                                               |
| -------- | ------------------------------- | -------------------------------------------------------- |
| Backend  | Na raiz: `docker compose up -d` | Em `backend/`: `npm run start:dev`, com MySQL disponível |
| App      | Em `mobile/`: `npx expo start`  | Em `mobile/`: `npx expo start`                           |

## Limites de validação dos fluxos

Os fluxos com e sem Docker usam os mesmos scripts, configuração e migrations. `docker compose config --quiet` verifica a configuração; `/health` com HTTP 200 e `database: "ok"` verifica o acesso da API ao banco. Esses checks não comprovam instalação do zero, execução com MySQL independente do Docker ou acesso por celular físico. O fluxo sem Docker está configurado, mas sua validação completa permanece pendente. Use a versão Node declarada nos pré-requisitos e execute o [roteiro manual](docs/mobile.md#validação-manual-no-celular) para verificar rede, WSL/firewall e câmera no ambiente de cada integrante.

## Problemas e referências

| Problema                                           | Onde conferir                                                                                                                                                                                  |
| -------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Porta ocupada / containers falhando                | Confira `PORT` e `.env`. Com Docker: `docker compose config --quiet`, `docker compose ps -a` e `docker compose logs --tail 100 backend mysql`. [Backend](docs/backend.md#executar-com-docker). |
| MySQL indisponível / credenciais recusadas         | Confira serviço, host, porta e conta; `npx prisma migrate status` em `backend/`. Não remova volumes para corrigir credenciais. [Banco](docs/database.md).                                      |
| Prisma Client desatualizado / migrations pendentes | Pare o watch, gere o client e aplique migrations; no Docker, reinicie o backend. [Migrations](docs/database.md#prisma-e-sql).                                                                  |
| API funciona no PC, mas não no celular             | Teste a URL mostrada no erro do app; confira IP, firewall e isolamento. [WSL e firewall](docs/mobile.md#wsl2-e-firewall).                                                                      |
| Expo Go não abre / login falha                     | Confira SDK 57, conexão ao Metro, URL da API e conta criada. [Mobile](docs/mobile.md#autenticação-e-api).                                                                                      |

Testes: [backend](docs/backend.md#verificações), [mobile](docs/mobile.md#configuração-e-verificações) e [checklist no celular](docs/mobile.md#validação-manual-no-celular). Builds: [EAS](docs/mobile.md#builds-com-eas). Projeto: [índice](docs/README.md), [arquitetura](docs/architecture.md), [design](docs/design.md) e [Lux Agent](docs/lux-integration.md).
