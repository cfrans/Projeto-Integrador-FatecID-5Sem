# Backend

Fundação REST em NestJS 12.1.2, TypeScript e Node.js 24 LTS (24.15 ou superior na linha 24). Prisma 7.10.0 utiliza MySQL 8.4 por meio de `@prisma/adapter-mariadb`, que também suporta MySQL. As versões são fixadas no lockfile. Swagger 12.0.2 é compatível com NestJS 12.

## Estrutura e convenções

```text
backend/
  src/main.ts                    inicialização e Swagger (fora de produção)
  src/app.module.ts              módulo raiz
  src/app.controller.ts          saúde da API e banco
  src/config/                    ambiente e conexão MySQL
  src/prisma/                    módulo e serviço Prisma
  src/auth/                      login, contratos e proteção JWT
  src/devices/                   listagem e revogação por responsável
  src/pairing/                   sessões e autenticação individual do Agent
  src/commands/                  comandos tipados, reserva e resultado
  src/agent/agent-admin.ts        ferramenta administrativa de identidade
  prisma/schema.prisma           modelos de autenticação, dispositivos e pareamento
  prisma7.config.ts              CLI e caminho de migrations
  test/                          testes HTTP
  nest-cli.json                  projeto standard
  tsconfig*.json                 TypeScript
  oxlint.json                    lint padrão da CLI
  vitest.config*.ts              testes padrão da CLI
  Dockerfile                     build e execução
  package-lock.json              instalação reproduzível
```

O scaffold atual usa ESM, Vitest e Oxlint. Controllers recebem HTTP, services concentram lógica e módulos organizam providers conforme as convenções NestJS. DTOs validam entradas e documentam os contratos de autenticação e dispositivos. Os módulos adicionais são Prisma, Auth, Devices, Pairing, Commands e Simulation.

Para novos scaffolds, use os comandos oficiais compatíveis com as versões adotadas: `npx @nestjs/cli new` e `npx prisma init`. Antes de usar APIs NestJS, Prisma ou MySQL, consulte a documentação oficial correspondente às versões declaradas no projeto; não gere manualmente estruturas já fornecidas pelos scaffolds nem introduza camadas ou dependências sem necessidade demonstrada.

`PrismaService` conecta e executa `SELECT 1` durante a inicialização. `GET /health` consulta o banco novamente, retorna `{ "status": "ok", "database": "ok" }` ou HTTP 503 se a consulta falhar. Uma falha de conexão inicial impede a aplicação de iniciar. Shutdown hooks encerram a conexão ao receber sinais de término.

Swagger fica em `/docs`; OpenAPI em `/docs-json`; ambos ficam desligados com `NODE_ENV=production`. O ambiente local usa HTTP em localhost. O [HTTPS de desenvolvimento](lux-https-development.md) usa um proxy temporário e CA explícita no Agent, sem alterar NestJS/Compose. A hospedagem HTTPS definitiva não foi decidida.

## Executar com Docker

Na raiz, copie `.env.example` para `.env`, preencha senhas locais distintas para `MYSQL_PASSWORD` e `MYSQL_ROOT_PASSWORD`, e defina `JWT_SECRET` com pelo menos 32 bytes aleatórios. Nunca versione esse arquivo.

```bash
test -f .env || cp .env.example .env
docker compose config --quiet
docker compose up -d
docker compose ps
curl --fail http://localhost:3000/health
```

O Compose preserva MySQL e `mysql_data`. O backend recebe as credenciais da aplicação e as variáveis opcionais de seed, usa `mysql:3306` na rede interna e aguarda o healthcheck MySQL. O healthcheck backend consulta `/health`. `MYSQL_PORT` controla a porta MySQL no host, publicada em `127.0.0.1`; `PORT` controla a porta HTTP no host, publicada em todas as interfaces para acesso LAN pelo celular. O backend escuta em `0.0.0.0:3000` no container. Use essa exposição apenas numa rede de desenvolvimento confiável, com firewall adequado.

O Dockerfile mantém os estágios de build/produção e acrescenta `development`, selecionado pelo Compose. Esse estágio usa Node 24 LTS sobre Debian Trixie slim, OpenSSL, `npm ci`, dependências de desenvolvimento e usuário `node`. Ao iniciar, gera Prisma Client, aplica migrations versionadas com `migrate deploy` e executa `start:dev -- --no-shell`. A flag evita processos Node órfãos durante o watch na imagem slim, que não contém `ps`. O backend reinicia em caso de falha, inclusive quando o MySQL ainda está voltando de um reinício conjunto. Expo permanece fora do Docker.

Os mounts compartilham `src`, `prisma` e as configurações de compilação/Prisma; `node_modules`, `generated` e `dist` pertencem ao container. Alterações TypeScript têm hot reload sem rebuild. O `package.json` é copiado na imagem: mudanças nele, mesmo somente em scripts npm, exigem `docker compose up -d --build`, assim como alterações de dependências ou do Dockerfile. Após mudar o schema, reinicie o backend para gerar o client; após adicionar migrations já revisadas, o reinício aplica as pendências.

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

Use Node 24.15+ na linha 24 e npm, com MySQL 8.4 já saudável. No Windows, siga primeiro o [fluxo recomendado](../README.md#3a-recomendado-no-windows-mysql-no-docker-e-backend-pelo-npm) para iniciar somente o MySQL no Docker. Também é possível usar MySQL instalado diretamente ou servidor de desenvolvimento acessível. Prepare banco/usuário conforme [Banco](database.md), configure `.env` na raiz e execute em `backend/`:

```bash
cd backend
npm ci
npm run prisma:migrate:deploy
npm run prisma:generate
npm run start:dev
```

Se o MySQL é independente do Docker, nenhum comando Docker é necessário. `MYSQL_HOST` e `MYSQL_PORT` apontam para o servidor alcançável pelo host (`127.0.0.1:3306` por padrão); o Compose substitui apenas esses valores por `mysql:3306` dentro do backend. A configuração carrega `.env` da raiz, preservando variáveis já injetadas, e mantém o fallback legado de `backend/.env`. Não crie esse segundo arquivo para duplicar a configuração. Usuário, senha e nome do banco são codificados ao compor a URL Prisma; não é necessário manter uma `DATABASE_URL` adicional. `MYSQL_ROOT_PASSWORD` só é usado na inicialização do MySQL Docker e não é necessário para iniciar NestJS/Prisma no host.

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
node --env-file=/caminho/privado.env --test test/*.mysql-serial-test.mjs
```

Arquivos `*.mysql-serial-test.mjs` rodam depois e sozinhos: o teste de rollback cria e remove um trigger em `Device`, e esse DDL, em paralelo, causa deadlocks de metadata lock (1213) em outros testes.

O arquivo deve definir todas as variáveis da conexão e `NODE_ENV=test`, que têm precedência sobre `.env` da raiz. Não aponte esses testes para o banco da aplicação. Não é necessário Docker.

O teste de pareamento cobre autenticação independente do Agent, dados inválidos, expiração durante espera por lock, consumo concorrente e reutilização, autorização por recurso, revogação, restrições e rollback reais. Também executa a ferramenta administrativa, verificando arquivo exclusivo `0600`, ausência do segredo no stdout e invalidação da identidade. Esses testes não validam Agent real ou autorização Linux.

O teste de autorregistro cobre validação estrita do corpo, hash já usado (ativo ou revogado), reregistro revogando a sessão anterior, expiração, conclusão com criação de computador, identidade e vínculo, guard antes e depois do `complete`, a CHECK de alvo da sessão e o limite de taxa.

Lint, typecheck, validação do schema e testes unitários/HTTP verificam aspectos distintos do backend; os testes HTTP usam Prisma mockado e exigem permissão para abrir porta local. `/health` verifica a conexão real com MySQL, mas não substitui testes num banco dedicado ou comparação entre migrations e schema. A validação completa do fluxo sem Docker e da instalação do zero permanece pendente. Execute as verificações com a versão Node declarada; resultados obtidos em outra versão não comprovam compatibilidade suportada.

## Autenticação implementada

O bloco de autenticação e conta está implementado para responsáveis. `POST /auth/register` recebe `{ "name", "email", "password" }` (senha de 8 a 128 caracteres), normaliza nome/email, armazena hash Argon2id e retorna HTTP 201 com `{ "id", "name", "email" }` (HTTP 409 se o email já existir). `POST /auth/login` recebe `{ "email", "password" }`, normaliza o email com trim e minúsculas e compara a senha com Argon2id. Email inválido ou campos extras retornam HTTP 400; credenciais inválidas retornam HTTP 401 com mensagem genérica. A senha aceita de 1 a 128 caracteres no login; o seed exige no mínimo 12.

Sucesso retorna `{ "accessToken", "expiresIn": 1800, "guardian": { "id", "name", "email" } }`. `GET /auth/me` usa Bearer JWT para restaurar o perfil público. `PATCH /auth/me/email` atualiza o email do responsável autenticado (HTTP 409 em conflito) e `PATCH /auth/me/password` exige `{ "currentPassword", "newPassword" }`, validando a senha atual com Argon2id antes de atualizar o hash (HTTP 204). `GET /auth/me/security-question` e `PUT /auth/me/security-question` consultam e salvam a pergunta de segurança com resposta normalizada e hash Argon2id em `Guardian`. `POST /auth/recovery/question`, `POST /auth/recovery/verify` e `POST /auth/recovery/reset` permitem consultar a pergunta por email, verificar a resposta e redefinir a senha. Para não revelar se o email existe, `question` sempre retorna 200: sem conta ou sem pergunta, devolve uma pergunta fictícia escolhida por HMAC do email com `JWT_SECRET` (estável para o mesmo email); `verify` e `reset` respondem o mesmo 400 genérico para email inexistente, conta sem pergunta e resposta errada. A resposta precisa de pelo menos 4 caracteres ao ser definida; respostas antigas mais curtas continuam válidas. Tokens usam HS256, emissor `piplup-api`, audiência `piplup-mobile` e validade de 30 minutos. Cada request protegido valida assinatura, expiração e emissor/audiência, então consulta o responsável atual no MySQL; responsável removido perde acesso imediatamente. Falha operacional na consulta de autenticação retorna HTTP 503. Swagger documenta autenticação Bearer em `/docs`.

`JWT_SECRET` é obrigatório em todos os ambientes de execução e deve conter pelo menos 32 bytes UTF-8. Não há valor padrão ou fallback. O arquivo `.env.example` deixa o campo vazio de propósito; configure um segredo aleatório local antes de iniciar backend ou Compose. JWT não possui endpoint de logout ou revogação: remover o token do cliente encerra a sessão local, mas um token copiado continua utilizável até expirar, salvo remoção do responsável ([limitações](security.md#limitações)).

Limite de tentativas (`@nestjs/throttler`, registrado no `AppModule` e aplicado por rota com `ThrottlerGuard`): `login` e `register` aceitam 20 por minuto (a suíte Cypress faz cerca de 11 logins por minuto do mesmo IP), cada rota `recovery/*` 5 por minuto e `POST /agent/registrations` 5 por minuto, por IP e por rota; o excesso recebe `429`. A contagem fica em memória por instância e zera ao reiniciar; sem `trust proxy`, atrás de um proxy vale para o IP do proxy.

O seed de responsável é explícito e exclusivo para `NODE_ENV=development`. `DEV_GUARDIAN_EMAIL`, `DEV_GUARDIAN_NAME` e `DEV_GUARDIAN_PASSWORD` são obrigatórios, e a senha deve ter de 12 a 128 caracteres. O seed normaliza email, armazena hash Argon2id e falha se já houver responsável com o mesmo email; não altera usuário existente. Após configurar essas variáveis e `NODE_ENV=development` na `.env` da raiz, aplique migrations e execute `npm run prisma:seed` antes do servidor em watch. O script gera o client e compila antes de chamar `prisma db seed`.

## Listagem de dispositivos implementada

`GET /devices` exige Bearer JWT e consulta a view `vw_device_overview`, com filtro SQL parametrizado por `guardianId` do responsável validado pelo guard. A ordenação por nome e UUID é determinística e não há parâmetro de responsável no endpoint. A resposta é uma lista `{ id, name, managedUser, status, lastSeen, isDemo, paired, associationId? }`; erro operacional retorna HTTP 503. PCs sem contato ficam `unverified`/`null`. PCs reais seguem a [presença do Agent real](#presença-do-agent-real). PCs demonstrativos com vínculo e identidade ativos usam `online` por até 15 segundos após heartbeat autenticado, depois `offline`, com `lastSeen` ISO. O horário pertence a `SimulationState.lastSeenAt`; leitura pelo responsável não o renova. Presença e confirmação de configuração são independentes, conforme o [contrato da simulação](simulated-client.md#contrato-da-simulação).

`Device.guardianId` registra o escopo de propriedade/acesso da API. Nas fixtures legadas, esse campo não comprova pareamento. O campo `paired` só é verdadeiro quando há uma associação ativa; identidade do Lux e conexão Linux não são comprovadas pela listagem. Todos os registros criados pelo seed de desenvolvimento são demonstrativos (`isDemo: true`) e usam nomes/contas fictícios. O seed é separado: após aplicar migrations e já existir um responsável, configure `DEV_GUARDIAN_EMAIL` com o email dele e `NODE_ENV=development` na `.env`, e execute `npm run prisma:seed:devices` antes do servidor em watch. Ele não cria responsáveis nem altera dados existentes e pode ser repetido.

## Persistência

O schema e migrations aditivas de responsável e dispositivos estão versionados em `backend/prisma/`. `npm run prisma:migrate:deploy` aplica migrations pendentes em outros ambientes; `npm run prisma:migrate:dev -- --name <nome>` exige banco shadow em desenvolvimento. Não executar resets para contornar permissões. Requisitos acadêmicos e permissões para migrations estão em [Banco](database.md).

## Responsabilidades do backend

O backend implementa autenticação de responsáveis e leitura de registros de dispositivos limitada ao responsável autenticado. O módulo Pairing implementa autorregistro, sessões e vínculos revogáveis; a ferramenta administrativa provisiona e invalida identidades individuais. O [Lux Agent](../lux-agent/README.md) consulta vínculos, envia relatórios e processa comandos pelo [protocolo v1](agent-protocol.md). O backend gera e reconcilia [comandos parentais](agent-protocol.md#comandos-parentais-contrato), executados pelo Agent com releitura. A aplicação das restrições pertence ao GNOME; sucesso de transporte não deve ser confundido com aplicação confirmada no computador.

## Integração do mobile

O mobile usa a API para autenticação (`POST /auth/login` e `GET /auth/me`) e lista registros com `GET /devices`, enviando o Bearer token e validando a resposta antes de exibir. Os itens trazem a presença calculada pelo backend (`unverified`, `online` ou `offline`). O serviço de lista não usa fallback para fixtures locais quando a API falha.

O fluxo de QR utiliza os endpoints de validação e consumo descritos abaixo, sem fallback para mock. A listagem não aplica operações no Lux.

### Presença do Agent real

`AgentAuthGuard` registra `AgentIdentity.lastSeenAt` em toda requisição autenticada de dispositivo não demo (`GET /agent/associations`, comandos, relatórios), sem endpoint de heartbeat. Para não escrever no banco a cada chamada do ciclo, só grava se o valor estiver vazio ou com mais de 10 s; falha nessa escrita não bloqueia a requisição. O dispositivo fica `online` até 60 s após o último contato e depois `offline`: o polling padrão é 15 s com jitter de 20%, então o TTL tolera um ciclo perdido. Sem contato desde o pareamento: `unverified`. O mesmo cálculo aparece em `GET /devices` e em `connection` de `GET /simulation/devices/:id` do computador real. Presença é estado observado e não implica política aplicada; um Agent configurado com `--interval` acima de ~45 s aparecerá offline entre ciclos.

## Contratos de pareamento

O MVP permite um responsável ativo por computador. A identidade do Agent é independente do JWT do responsável: uma credencial aleatória exclusiva, gerada pelo Agent no autorregistro ou pela ferramenta administrativa. A API armazena somente o hash da credencial; o `deviceId` não autentica o Agent. A decisão e a obrigação de autorização administrativa local estão em [Integração Lux](lux-integration.md).

| Endpoint | Autenticação e finalidade |
| --- | --- |
| `POST /agent/registrations` | Público, com limite de taxa; registra um computador sem identidade e cria a sessão. Nada é criado até o `complete`. |
| `POST /agent/pairing-sessions` | Credencial individual do Agent; cria sessão após autorização administrativa local (`pkexec`) no Agent. |
| `GET /agent/associations` | Credencial do Agent; consulta vínculos somente do seu computador. |
| `DELETE /agent/associations/:associationId` | Credencial do Agent; revoga vínculo do seu computador, após autorização local. |
| `POST /pairing/validate` | JWT do responsável; recebe `{ token }` e valida sem consumir. |
| `POST /pairing/complete` | JWT do responsável; recebe `{ token }` e consome o token junto à criação do vínculo. |
| `GET /devices` | JWT do responsável; lista somente os dispositivos atualmente acessíveis. |
| `DELETE /devices/:id/association` | JWT do responsável; revoga seu vínculo ativo, sem excluir o computador. |

Os contratos estão implementados; o Agent os usa em `lux-agent pair` ([Integração Lux](lux-integration.md#pareamento-pelo-agent)). O token de pareamento contém 32 bytes aleatórios codificados em base64url, expira em cinco minutos e só pode ser consumido uma vez. Seu hash SHA-256 é único no banco; o token original não aparece em consultas de sessões ou associações. O QR usa `piplup://pair?token=<token>` e não transporta URL da API, senha Linux ou credencial do Agent. O cliente utiliza exclusivamente a API já configurada.

`POST /agent/registrations` recebe `{ credentialHash, name, managedUser }` (64 hex minúsculos; 1–100 caracteres; sem campos extras) e `POST /agent/pairing-sessions` recebe corpo vazio; ambos retornam `{ token, expiresAt, qrPayload }`. `POST /pairing/validate` retorna `{ valid: true, expiresAt, device: { id, name, managedUser, isDemo } }`; `POST /pairing/complete` retorna a representação de dispositivo com `paired: true` e `associationId`. `GET /agent/associations` retorna histórico `{ id, createdAt, revokedAt, guardian: { id, name } }`, sem tokens, hashes ou email do responsável. As operações DELETE bem-sucedidas retornam `204`.

No autorregistro, a sessão guarda o registro pendente (hash, nome, usuário e o UUID futuro do computador). Um novo registro com o mesmo hash revoga as sessões pendentes anteriores; hash já usado por uma `AgentIdentity`, ativa ou revogada, é recusado. A validação mostra nome e usuário registrados, e o `complete` cria `Device` (`isDemo: false`), `AgentIdentity` e vínculo numa transação. Até lá a credencial recebe `401`. O limite é de 5 registros por minuto por IP ([limite de tentativas](#autenticação-implementada)).

A validação não reserva o dispositivo nem prolonga o prazo. O consumo revalida token e identidade dentro de uma transação serializada por dispositivo. Dispositivo já associado não pode ganhar outro responsável. Revogar um vínculo retira o acesso imediatamente na API e invalida sessões pendentes; novo pareamento exige nova sessão. A revogação não executa ações GNOME nem confirma alterações no Linux.

Corpos inválidos retornam `400`; autenticação ausente/inválida retorna `401`; recurso de terceiros retorna `404`; conflito com vínculo existente ou credencial já registrada retorna `409`; excesso de registros retorna `429`; token inválido, expirado, consumido ou revogado retorna `410`; indisponibilidade do banco retorna `503`. Não enviar tokens em URLs HTTP, registrar credenciais em logs ou armazená-las no mobile. HTTPS é obrigatório fora do desenvolvimento local. Identidades demonstrativas só são aceitas quando `NODE_ENV` é `development` ou `test`; produção e ambiente não definido recusam essas credenciais.

### Provisionamento e invalidação administrativa

O provisionamento continua como ferramenta de desenvolvimento e operação; computadores reais usam o autorregistro. A ferramenta administrativa é executada por quem administra o backend, com suas credenciais MySQL protegidas. Seu acesso não é disponibilizado ao mobile nem ao Agent por HTTP. Após migrations e build, o procedimento é:

```bash
npm run agent:provision -- --name "Lux sala" --output /caminho/seguro/agent-credential
npm run agent:revoke -- --device-id <uuid>
```

O provisionamento cria o computador sem responsável e grava a credencial em arquivo novo e exclusivo, com permissão `0600`; nunca imprime o segredo no terminal. O administrador transfere esse arquivo por canal seguro e o instala manualmente em `/etc/lux-agent/credential` (dono `lux-agent`, `0600`); `install.sh` não recebe credencial. A invalidação administrativa da identidade também revoga sessões e o vínculo ativo. Reprovisionar uma instalação após perda/comprometimento da credencial exige novo procedimento administrativo, que cria novo registro/identidade; o histórico anterior é preservado, sem transferência automática de vínculos. Não há recuperação pública de segredo.

`--managed-user <conta>` (opcional, até 100 caracteres) grava `Device.managedUser`, que é só exibição: a conta gerenciada de fato é configurada localmente no Agent.

Para uma fixture de desenvolvimento, acrescente `--demo` ao provisionamento, com `NODE_ENV=development`. O computador recebe `isDemo: true`; essa identidade não autentica em produção. A ferramenta não implementa o Agent, autorização Linux ou exibição de QR. Não provisione fixtures como computadores reais.

O [roteiro mobile](mobile.md) documenta o teste manual completo com Docker/WSL: provisionamento da fixture, solicitação autenticada de sessão, geração local do QR e validação no celular.

## Consultas de aplicativos e pedidos de instalação

- `GET /devices/:deviceId/applications`: lista `{ id, name, category, allowed, blockable, executable }`, ordenada por nome e UUID. `blockable=false` indica app que não pode ser bloqueado; apps com o mesmo `executable` (não nulo) são bloqueados juntos ([regras](agent-protocol.md#origem-dos-comandos)).
- `GET /devices/:deviceId/installation-requests`: lista somente pedidos `PENDING`, com `{ id, applicationName, requesterName, requestedAt, ageRating }`, ordenados por data e UUID. `requestedAt` é uma data ISO 8601 UTC.

Ambos exigem JWT do responsável, UUID válido e associação ativa com aquele computador. Dispositivo inexistente, pertencente a outro responsável ou sem vínculo ativo retorna o mesmo HTTP 404. UUID inválido retorna 400; falha operacional retorna 503, sem detalhes internos.

Os dados vêm de `InstalledApplication` e `InstallationRequest`. `Device.applicationsReportedAt` e `Device.installationRequestsReportedAt` indicam se cada relatório já foi recebido. Sem o marcador correspondente, a consulta retorna 503 com mensagem de dados ainda não recebidos; com relatório e nenhum registro, retorna `[]`. O retorno é a última informação persistida, sem garantia de presença ou atualização do computador.

O Agent real publica aplicativos por `PUT /agent/reports` ([protocolo](agent-protocol.md#contrato-de-relatórios-do-agent)), sem pedidos de instalação e sem remover pedidos de outros fluxos. O [client simulado](simulated-client.md) publica relatórios demonstrativos autenticados por um módulo separado. Seeds atuais não inventam inventário nem pedidos. Pedidos de instalação reais estão fora do escopo: só a simulação persiste decisões e confirma sua própria aplicação. Para o computador real, `allowed` reflete a política desejada, aplicada pelo comando parental. Os estados `APPROVED` e `DENIED` apenas permitem excluir pedidos já decididos da consulta.

## Pendências

A hospedagem HTTPS definitiva e o comportamento offline do mobile não foram decididos. Ordem de atualização: quando o contrato do relatório muda, o backend sobe antes do Agent novo, porque a validação recusa campos desconhecidos com `400` (foi o caso dos campos `blockable`/`executable`). O backend não aplica restrições Linux nem envia comandos arbitrários para execução.

Referências: [Nest CLI](https://docs.nestjs.com/cli/overview), [comandos da CLI](https://docs.nestjs.com/cli/usages), [Swagger](https://docs.nestjs.com/openapi/introduction) e [Prisma 7/MySQL](https://www.prisma.io/docs/v7/prisma-orm/quickstart/mysql).

## Limitações e dependências

O override de MariaDB 3.5.4 fica restrito ao adapter Prisma para corrigir vulnerabilidades do driver, conforme o [changelog do mantenedor](https://github.com/mariadb-corporation/mariadb-connector-nodejs/releases/tag/3.5.4). A CLI Prisma entra na árvore de produção por peer dependency do client, apesar de estar declarada em devDependencies. Confira dependências com `npm audit`; atualizações precisam preservar a compatibilidade entre Prisma, Node e NestJS.

## Comandos do Agent

O módulo `Commands` implementa criação/consulta por responsável e polling/claim/resultado por Agent. O responsável só cria `agent.ping`; `parental.app_filter.set` nasce das configurações do computador real. Exige vínculo original ativo e identidade válida, com transações serializadas por dispositivo e índices de idempotência ([contrato completo](agent-protocol.md)). O bootstrap limita corpos JSON a 16 KiB.

## Simulação para demonstração

O módulo isolado `src/simulation` reutiliza JWT, identidade do Agent, pareamento e tabelas de inventário/pedidos. A única tabela nova, `SimulationState`, guarda configurações versionadas por vínculo e confirmação simulada. Cadastro autenticado e operações desse módulo são restritos a demonstração em `development`/`test`; não habilitam registro ou controle de PCs reais. Contratos e execução ficam em [Client simulado](simulated-client.md).

## Histórico de pedidos de instalação

`GET /devices/:deviceId/installation-requests/history` retorna os mesmos campos públicos da consulta de pendentes, mais `status: APPROVED | DENIED`. Exige JWT e vínculo ativo do responsável; filtra pedidos anteriores à criação do vínculo atual. Mantém a distinção entre relatório vazio (`200`), vínculo ausente (`404`) e relatório não recebido/indisponível (`503`). A rota de pendentes permanece inalterada. O histórico reflete o último relatório persistido; não é auditoria permanente, não armazena prazos locais nem exige migration.
