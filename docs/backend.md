# Backend

Fundação REST em NestJS 12.1.2, TypeScript e Node.js 24 LTS (24.15 ou superior na linha 24). Prisma 7.10.0 utiliza MySQL 8.4 por meio de `@prisma/adapter-mariadb`, que também suporta MySQL. As versões são fixadas no lockfile. Swagger 12.0.2 é compatível com NestJS 12.

## Estrutura e convenções

```text
backend/
  src/main.ts                    inicialização e Swagger
  src/app.module.ts              módulo raiz
  src/app.controller.ts          saúde da API e banco
  src/config/                    ambiente e conexão MySQL
  src/prisma/                    módulo e serviço Prisma
  src/auth/                      login, contratos e proteção JWT
  src/devices/                   listagem de registros por responsável
  prisma/schema.prisma           modelos Guardian/Device e gerador Prisma
  prisma7.config.ts              CLI e caminho de migrations
  test/                          testes HTTP
  nest-cli.json                  projeto standard
  tsconfig*.json                 TypeScript
  oxlint.json                    lint padrão da CLI
  vitest.config*.ts              testes padrão da CLI
  Dockerfile                     build e execução
  package-lock.json              instalação reproduzível
```

O scaffold atual usa ESM, Vitest e Oxlint. Controllers recebem HTTP, services concentram lógica e módulos organizam providers conforme as convenções NestJS. DTOs validam entradas e documentam os contratos de autenticação e dispositivos. Os módulos adicionais são Prisma, Auth e Devices.

`PrismaService` conecta e executa `SELECT 1` durante a inicialização. `GET /health` consulta o banco novamente, retorna `{ "status": "ok", "database": "ok" }` ou HTTP 503 se a consulta falhar. Uma falha de conexão inicial impede a aplicação de iniciar. Shutdown hooks encerram a conexão ao receber sinais de término.

Swagger fica em `/docs`; OpenAPI em `/docs-json`. O ambiente local usa HTTP em localhost. HTTPS e exposição da API serão decisões de hospedagem futuras, antes de conectar responsáveis ou agentes reais.

## Executar com Docker

Na raiz, copie `.env.example` para `.env`, preencha senhas locais distintas para `MYSQL_PASSWORD` e `MYSQL_ROOT_PASSWORD`, e defina `JWT_SECRET` com pelo menos 32 bytes aleatórios. Nunca versione esse arquivo.

```bash
cp .env.example .env
docker compose config --quiet
docker compose up -d
docker compose ps
curl --fail http://localhost:3000/health
```

O Compose preserva MySQL e `mysql_data`. O backend recebe as credenciais da aplicação e as variáveis opcionais de seed, usa `mysql:3306` na rede interna e aguarda o healthcheck MySQL. O healthcheck backend consulta `/health`. `MYSQL_PORT` controla a porta MySQL no host, publicada em `127.0.0.1`; `PORT` controla a porta HTTP no host, publicada em todas as interfaces para acesso LAN pelo celular. O backend escuta em `0.0.0.0:3000` no container. Use essa exposição apenas numa rede de desenvolvimento confiável, com firewall adequado.

O Dockerfile mantém os estágios de build/produção e acrescenta `development`, selecionado pelo Compose. Esse estágio usa Node 24 LTS sobre Debian Trixie slim, OpenSSL, `npm ci`, dependências de desenvolvimento e usuário `node`. Ao iniciar, gera Prisma Client, aplica migrations versionadas com `migrate deploy` e executa `start:dev -- --no-shell`. A flag evita processos Node órfãos durante o watch na imagem slim, que não contém `ps`. O backend reinicia em caso de falha, inclusive quando o MySQL ainda está voltando de um reinício conjunto. Expo permanece fora do Docker.

Os mounts compartilham `src`, `prisma` e as configurações de compilação/Prisma; `node_modules`, `generated` e `dist` pertencem ao container. Alterações TypeScript têm hot reload sem rebuild. Após mudar dependências ou o Dockerfile, use `docker compose up -d --build`. Após mudar o schema, reinicie o backend para gerar o client; após adicionar migrations já revisadas, o reinício aplica as pendências.

Seeds continuam explícitos. Preencha `DEV_GUARDIAN_*` na raiz e execute, uma vez para criar a conta e opcionalmente para as fixtures:

```bash
docker compose run --rm backend npm run prisma:seed
docker compose run --rm backend npm run prisma:seed:devices
```

Use `run --rm` para esses scripts: eles geram/compilam o projeto num container separado. Executar seed ou build com `exec` no backend em watch pode apagar seu `dist` e interferir no servidor. O seed de conta não atualiza um responsável existente; o de dispositivos pode ser repetido sem duplicar as fixtures.

```bash
docker compose logs -f backend
docker compose restart backend
docker compose down
```

`down` preserva os dados. Não use opções que removam volumes. Alterar `.env` não altera contas existentes no volume; consulte [Banco](database.md).

## Desenvolvimento no host

Use Node 24.15+ na linha 24 e npm, com MySQL 8.4 instalado ou um servidor de desenvolvimento acessível. Prepare banco/usuário conforme [Banco](database.md), configure `.env` na raiz e execute em `backend/`:

```bash
cd backend
npm install
npm run prisma:generate
npm run prisma:migrate:deploy
npm run start:dev
```

Nenhum comando Docker é necessário nesse fluxo. `MYSQL_HOST` e `MYSQL_PORT` apontam para o servidor alcançável pelo host (`127.0.0.1:3306` por padrão); o Compose substitui apenas esses valores por `mysql:3306` dentro do backend. A configuração carrega `.env` da raiz, preservando variáveis já injetadas, e mantém o fallback legado de `backend/.env`. Não crie esse segundo arquivo para duplicar a configuração. Usuário, senha e nome do banco são codificados ao compor a URL Prisma; não é necessário manter uma `DATABASE_URL` adicional. `MYSQL_ROOT_PASSWORD` só é usado na inicialização do MySQL Docker e não é necessário para iniciar NestJS/Prisma no host.

Na primeira instalação, gere o client e aplique migrations conforme acima. Para criar o responsável e fixtures, configure também `NODE_ENV=development` e `DEV_GUARDIAN_*` na raiz e execute `npm run prisma:seed` e `npm run prisma:seed:devices` antes de iniciar o watch. No uso diário, basta `npm run start:dev`. Para instalação reproduzível pelo lockfile, use `npm ci`.

MySQL 8.4 usa autenticação `caching_sha2_password`. O exemplo local habilita `MYSQL_ALLOW_PUBLIC_KEY_RETRIEVAL=true` para obter a chave RSA do servidor e autenticar na rede Docker/localhost sem trocar o mecanismo nativo. Fora desse ambiente isolado, mantenha a opção desabilitada e configure TLS com validação de certificado ou uma chave confiável antes de conectar a um banco remoto; transporte remoto ainda não está configurado. A opção permanece desabilitada quando não declarada. Veja as [opções oficiais do driver](https://mariadb.com/docs/connectors/mariadb-connector-nodejs/node-js-connection-options).

### Verificações

```bash
npm run prisma:validate
npm run lint
npm run typecheck
npm run build
npm test
npm run test:e2e
```

Os testes Vitest substituem Prisma por mock. Para executar o build: `npm run start:prod`. Para conferir conexão real, inicie a API e abra `http://localhost:3000/health`; HTTP 200 com `database: "ok"` comprova a consulta MySQL. `npx prisma migrate status` em `backend/` verifica o histórico de migrations usando a mesma conexão.

O teste `npm run test:mysql` usa a API compilada e MySQL real. Exige `NODE_ENV=test`, banco dedicado com nome terminado em `_test`, variáveis MySQL e `JWT_SECRET`, migrations aplicadas e build atual. Os testes criam responsáveis e dispositivos aleatórios e removem somente as fixtures criadas por cada teste. Para carregar uma configuração privada de teste sem depender da sintaxe de variáveis do shell, crie um arquivo fora do Git contendo essas variáveis e execute em `backend/`:

```bash
node --env-file=/caminho/privado.env node_modules/prisma/build/index.js migrate deploy
npm run prisma:generate
npm run build
node --env-file=/caminho/privado.env --test test/*.mysql-test.mjs
```

O arquivo deve definir todas as variáveis da conexão e `NODE_ENV=test`, que têm precedência sobre `.env` da raiz. Não aponte esses testes para o banco da aplicação. Não é necessário Docker.

## Autenticação implementada

O primeiro bloco de autenticação está implementado para responsáveis. `POST /auth/login` recebe `{ "email", "password" }`, normaliza o email com trim e minúsculas e compara a senha com Argon2id. Email inválido ou campos extras retornam HTTP 400; credenciais inválidas retornam HTTP 401 com mensagem genérica. A senha aceita de 1 a 128 caracteres no login; o seed exige no mínimo 12.

Sucesso retorna `{ "accessToken", "expiresIn": 1800, "guardian": { "id", "name", "email" } }`. `GET /auth/me` usa Bearer JWT para restaurar o perfil público. Tokens usam HS256, emissor `piplup-api`, audiência `piplup-mobile` e validade de 30 minutos. Cada request protegido valida assinatura, expiração e emissor/audiência, então consulta o responsável atual no MySQL; responsável removido perde acesso imediatamente. Falha operacional na consulta de autenticação retorna HTTP 503. Swagger documenta autenticação Bearer em `/docs`.

`JWT_SECRET` é obrigatório em todos os ambientes de execução e deve conter pelo menos 32 bytes UTF-8. Não há valor padrão ou fallback. O arquivo `.env.example` deixa o campo vazio de propósito; configure um segredo aleatório local antes de iniciar backend ou Compose. JWT não possui endpoint de logout ou revogação: remover o token do cliente encerra a sessão local, mas um token copiado continua utilizável até expirar, salvo remoção do responsável.

O seed de responsável é explícito e exclusivo para `NODE_ENV=development`. `DEV_GUARDIAN_EMAIL`, `DEV_GUARDIAN_NAME` e `DEV_GUARDIAN_PASSWORD` são obrigatórios, e a senha deve ter de 12 a 128 caracteres. O seed normaliza email, armazena hash Argon2id e falha se já houver responsável com o mesmo email; não altera usuário existente. Após configurar essas variáveis e `NODE_ENV=development` na `.env` da raiz, aplique migrations e execute `npm run prisma:seed` antes do servidor em watch. O script gera o client e compila antes de chamar `prisma db seed`.

## Listagem de dispositivos implementada

`GET /devices` exige Bearer JWT e consulta somente registros cujo `guardianId` é o id do responsável validado pelo guard. A ordenação por nome e UUID é determinística e não há parâmetro de responsável no endpoint. A resposta é uma lista `{ id, name, managedUser, status: "unverified", lastSeen: null, isDemo }`; erro operacional no MySQL retorna HTTP 503. O backend não persiste presença nem horário de atividade. `unverified` e `lastSeen: null` evitam afirmar conexão com o computador antes de implementar e validar um agente.

`Device.guardianId` registra o escopo de propriedade/acesso da API. Esse vínculo de banco não comprova pareamento, identidade do Lux ou conexão real. Todos os registros criados pelo seed de desenvolvimento são demonstrativos (`isDemo: true`) e usam nomes/contas fictícios. O seed é separado: após aplicar migrations e já existir um responsável, configure `DEV_GUARDIAN_EMAIL` com o email dele e `NODE_ENV=development` na `.env`, e execute `npm run prisma:seed:devices` antes do servidor em watch. Ele não cria responsáveis nem altera dados existentes e pode ser repetido.

## Persistência

O schema e migrations aditivas de responsável e dispositivos estão versionados em `backend/prisma/`. `npm run prisma:migrate:deploy` aplica migrations pendentes em outros ambientes; `npm run prisma:migrate:dev -- --name <nome>` exige banco shadow em desenvolvimento. Não executar resets para contornar permissões. Requisitos acadêmicos e permissões para migrations estão em [Banco](database.md).

## Responsabilidades do backend

O backend implementa autenticação de responsáveis e leitura de registros de dispositivos limitada ao responsável autenticado. Não há operações por dispositivo, gerenciamento de agentes nem pareamento implementados. A aplicação das restrições pertence ao GNOME; sucesso de transporte não deve ser confundido com aplicação confirmada no computador.

## Integração do mobile

O mobile usa a API para autenticação (`POST /auth/login` e `GET /auth/me`) e lista registros com `GET /devices`, enviando o Bearer token e validando a resposta antes de exibir. Os itens aparecem como `unverified` com `lastSeen: null`, sem afirmar que o computador está online ou offline. O serviço de lista não usa fallback para fixtures locais quando a API falha.

`pairingDemo.simulatePairing()` continua sendo uma operação de demonstração do mobile e não cria Device no banco. Esse mock de pareamento permanece separado da lista da API. O endpoint de listagem não faz pareamento ou consulta o Lux; operações reais dependem de contrato e validação no computador.

## Próximas responsabilidades e decisões pendentes

As próximas etapas tratarão criação e ciclo de vida dos dispositivos, identidade de agentes, pareamento temporário de uso único, revogação e coordenação de comandos suportados. Autenticação e listagem já estão integradas ao mobile; comportamento offline ainda não foi acordado. O backend não aplica restrições Linux nem envia comandos arbitrários para execução.

Referências: [Nest CLI](https://docs.nestjs.com/cli/overview), [comandos da CLI](https://docs.nestjs.com/cli/usages), [Swagger](https://docs.nestjs.com/openapi/introduction) e [Prisma 7/MySQL](https://www.prisma.io/docs/v7/prisma-orm/quickstart/mysql).

## Limitações e dependências

O override de MariaDB 3.5.4 fica restrito ao adapter Prisma para corrigir vulnerabilidades do driver, conforme o [changelog do mantenedor](https://github.com/mariadb-corporation/mariadb-connector-nodejs/releases/tag/3.5.4). A CLI Prisma entra na árvore de produção por peer dependency do client, apesar de estar declarada em devDependencies. Confira dependências com `npm audit`; atualizações precisam preservar a compatibilidade entre Prisma, Node e NestJS.
