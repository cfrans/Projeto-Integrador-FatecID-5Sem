# Backend

Fundação REST em NestJS 12.1.2, TypeScript e Node.js 24 LTS (24.15 ou superior na linha 24). Prisma 7.10.0 utiliza MySQL 8.4 por meio de `@prisma/adapter-mariadb`, que também suporta MySQL. Prisma 8 ainda era uma versão candidata durante esta implementação; a linha estável foi fixada no lockfile. Swagger 12.0.2 é compatível com NestJS 12.

## Estrutura e convenções

O projeto foi gerado pela CLI oficial NestJS 12.0.8 em modo standard, num diretório temporário, sem Git interno. A sintaxe foi conferida com `new --help` antes da geração:

```bash
npx @nestjs/cli@12.0.8 new backend --package-manager npm --skip-git
```

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
docker compose up -d --build
docker compose ps
curl --fail http://localhost:3000/health
```

O Compose preserva MySQL e `mysql_data`. O backend recebe somente as credenciais da aplicação, usa `mysql:3306` na rede interna e aguarda o healthcheck MySQL. O healthcheck backend consulta `/health`. `MYSQL_PORT` controla a porta MySQL no host e `PORT` a porta HTTP no host; o backend no container escuta em 3000. Ambas são publicadas em `127.0.0.1`.

O Dockerfile usa a imagem oficial Node 24 LTS sobre Debian Trixie slim, com OpenSSL requerido pelo Prisma, em estágios de dependências, geração/build e execução. Utiliza `npm ci`, dependências de produção e usuário `node`. Não executa migrations automaticamente nesta etapa. Expo permanece fora do Docker.

Antes do primeiro login, aplique as migrations pelo host conforme os comandos abaixo. A imagem de execução não contém o schema/config da CLI Prisma; migrations e seed são operações explícitas de desenvolvimento.

```bash
docker compose logs backend
docker compose down
```

`down` preserva os dados. Não use opções que removam volumes. Alterar `.env` não altera contas existentes no volume; consulte [Banco](database.md).

## Desenvolvimento no host

Use Node 24.15+ e npm. Com `.env` configurado na raiz:

```bash
docker compose up -d mysql
cd backend
npm ci
npm run prisma:generate
npm run prisma:migrate:deploy
npm run start:dev
```

`MYSQL_HOST=127.0.0.1` e `MYSQL_PORT=3306` apontam para o MySQL publicado. A configuração carrega `.env` da raiz e, complementarmente, `backend/.env`, preservando variáveis já injetadas. Usuário, senha e nome do banco são codificados ao compor a URL Prisma; não é necessário duplicar credenciais numa `DATABASE_URL` manual.

MySQL 8.4 usa autenticação `caching_sha2_password`. O exemplo local habilita `MYSQL_ALLOW_PUBLIC_KEY_RETRIEVAL=true` para obter a chave RSA do servidor e autenticar na rede Docker/localhost sem trocar o mecanismo nativo. Fora desse ambiente isolado, mantenha a opção desabilitada e configure TLS com validação de certificado ou uma chave confiável antes de conectar a um banco remoto; transporte remoto ainda não está configurado. A opção permanece desabilitada quando não declarada. Veja as [opções oficiais do driver](https://mariadb.com/docs/connectors/mariadb-connector-nodejs/node-js-connection-options).

```bash
npm run prisma:validate
npm run lint
npm run typecheck
npm run build
npm test
npm run test:e2e
```

Os testes Vitest substituem Prisma por mock. Para executar o build: `npm run start:prod`.

O teste `npm run test:mysql` usa a API compilada e MySQL real. Exige `NODE_ENV=test`, banco dedicado com nome terminado em `_test`, variáveis MySQL e `JWT_SECRET`, migrations aplicadas e build atual. Os testes criam responsáveis e dispositivos aleatórios e removem somente as fixtures criadas por cada teste. Um arquivo de ambiente privado de teste pode ser carregado com `NODE_ENV=test node --env-file=/caminho/privado.env --test test/*.mysql-test.mjs`; não use o banco da aplicação.

## Autenticação implementada

O primeiro bloco de autenticação está implementado para responsáveis. `POST /auth/login` recebe `{ "email", "password" }`, normaliza o email com trim e minúsculas e compara a senha com Argon2id. Email inválido ou campos extras retornam HTTP 400; credenciais inválidas retornam HTTP 401 com mensagem genérica. A senha aceita de 1 a 128 caracteres no login; o seed exige no mínimo 12.

Sucesso retorna `{ "accessToken", "expiresIn": 1800, "guardian": { "id", "name", "email" } }`. `GET /auth/me` usa Bearer JWT para restaurar o perfil público. Tokens usam HS256, emissor `piplup-api`, audiência `piplup-mobile` e validade de 30 minutos. Cada request protegido valida assinatura, expiração e emissor/audiência, então consulta o responsável atual no MySQL; responsável removido perde acesso imediatamente. Falha operacional na consulta de autenticação retorna HTTP 503. Swagger documenta autenticação Bearer em `/docs`.

`JWT_SECRET` é obrigatório em todos os ambientes de execução e deve conter pelo menos 32 bytes UTF-8. Não há valor padrão ou fallback. O arquivo `.env.example` deixa o campo vazio de propósito; configure um segredo aleatório local antes de iniciar backend ou Compose. JWT não possui endpoint de logout ou revogação: remover o token do cliente encerra a sessão local, mas um token copiado continua utilizável até expirar, salvo remoção do responsável.

O seed de responsável é explícito e exclusivo para `NODE_ENV=development`. `DEV_GUARDIAN_EMAIL`, `DEV_GUARDIAN_NAME` e `DEV_GUARDIAN_PASSWORD` são obrigatórios, e a senha deve ter de 12 a 128 caracteres. O seed normaliza email, armazena hash Argon2id e falha se já houver responsável com o mesmo email; não altera usuário existente. Após configurar essas variáveis e o MySQL, aplique migrations e execute `NODE_ENV=development npm run prisma:seed`. O script gera o client e compila antes de chamar `prisma db seed`.

Validação deste bloco em 10/10/2026: Prisma validate/generate, lint, typecheck, build, quatro testes unitários e quatro HTTP passaram. Migration, seed e teste de autenticação/persistência passaram em MySQL 8.4 isolado. O seed recusou execução em produção. Schemas de login/perfil, segurança Bearer e erro 503 foram conferidos no OpenAPI gerado.

## Listagem de dispositivos implementada

`GET /devices` exige Bearer JWT e consulta somente registros cujo `guardianId` é o id do responsável validado pelo guard. A ordenação por nome e UUID é determinística e não há parâmetro de responsável no endpoint. A resposta é uma lista `{ id, name, managedUser, status: "unverified", lastSeen: null, isDemo }`; erro operacional no MySQL retorna HTTP 503. O backend não persiste presença nem horário de atividade. `unverified` e `lastSeen: null` evitam afirmar conexão com o computador antes de implementar e validar um agente.

`Device.guardianId` registra o escopo de propriedade/acesso da API. Esse vínculo de banco não comprova pareamento, identidade do Lux ou conexão real. Todos os registros criados pelo seed de desenvolvimento são demonstrativos (`isDemo: true`) e usam nomes/contas fictícios. O seed é separado: após aplicar migrations e já existir um responsável, configure `DEV_GUARDIAN_EMAIL` com o email dele e execute `NODE_ENV=development npm run prisma:seed:devices`. Ele não cria responsáveis nem altera dados existentes e pode ser repetido.

Validação do conjunto em 10/10/2026: Prisma validate/generate, lint, typecheck, build, seis testes unitários e cinco HTTP passaram. As duas migrations e os dois testes HTTP/persistência passaram em MySQL 8.4 real isolado, incluindo lista vazia e isolamento entre responsáveis. Os seeds recusaram produção; repetir o seed demonstrativo manteve duas fixtures. O cliente HTTP do mobile consumiu login, perfil e lista reais; `/health` e o contrato Bearer/erros da listagem em `/docs-json` foram conferidos. O rebuild Docker desta etapa foi interrompido por falha de DNS (`EAI_AGAIN`) ao baixar dependências do npm; a API compilada foi validada no host com o MySQL em Docker.

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

O ambiente de implementação tem Node 24.14.0 e emite aviso de engine das ferramentas de scaffold; os checks locais passaram, mas use Node 24.15+ para respeitar os requisitos declarados. O plugin `vite-tsconfig-paths` padrão da CLI emite aviso de que a resolução nativa do Vite pode substituí-lo; não impede os testes.

O adapter Prisma fixa originalmente MariaDB 3.4.5. Um override restrito ao adapter utiliza MariaDB 3.5.4 para corrigir vulnerabilidades do driver, conforme o [changelog do mantenedor](https://github.com/mariadb-corporation/mariadb-connector-nodejs/releases/tag/3.5.4). Na auditoria desta fundação, `npm audit --omit=dev` ainda reporta quatro entradas altas ligadas a Prisma/config, `deepmerge-ts` e `mysql2`; a instalação completa reportou nove (duas baixas, uma moderada e seis altas). A CLI Prisma entra na árvore de produção por peer dependency do client, apesar de estar declarada em devDependencies. Os alertas seguem pendentes de atualização compatível; não aplicar downgrade major nem `npm audit fix --force` automaticamente. Checks funcionais não substituem auditoria de segurança.

## Verificação da fundação

Em 10/10/2026 passaram lint/typecheck do mobile, lint/typecheck/build do backend, dois testes unitários, um teste HTTP e validação/geração Prisma sem modelos. O Compose final passou `config --quiet` e `up -d --build --wait` em ambiente isolado: MySQL e backend saudáveis, `/health`, `/docs` e `/docs-json` com HTTP 200, Node 24.21.0 no container com UID 1000. Nenhuma migration foi aplicada. O ambiente de teste foi parado preservando os volumes.

A primeira imagem Bookworm encontrou uma camada ausente no cache local do Docker Desktop, inclusive ao tentar criar o container. A base final Trixie, com OpenSSL, foi construída e executada pelo Compose padrão sem apagar caches ou dados existentes. A ISO Lux segue indisponível e não houve validação GNOME.
