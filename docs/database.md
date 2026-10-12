# Banco de dados

O banco é MySQL 8.4, executado em Docker ou instalado localmente/em um servidor de desenvolvimento acessível. Os dois modos usam o mesmo schema e migrations Prisma. Mobile e Lux Agent não recebem credenciais MySQL. O schema contém Guardian para autenticação e Device para registros associados ao escopo de acesso de um responsável. Fixtures legadas não comprovam pareamento. A infraestrutura de identidade e vínculo está descrita abaixo; associação na API não comprova presença online nem integração Linux.

## Com Docker

O `docker-compose.yml` da raiz inicia NestJS e MySQL e guarda os dados no volume nomeado `mysql_data`. MySQL é publicado em `127.0.0.1:${MYSQL_PORT}`; a API é publicada na rede do host. Copie `.env.example` para `.env`, preencha as credenciais locais e use:

```bash
docker compose config --quiet
docker compose up -d
docker compose ps
```

`docker compose down` para os containers sem remover o volume. A imagem oficial do MySQL aplica `MYSQL_DATABASE`, `MYSQL_USER`, `MYSQL_PASSWORD` e `MYSQL_ROOT_PASSWORD` somente quando o diretório de dados está vazio; mudar `.env` após inicializar o volume não altera as contas ou o banco já existentes.

O backend espera MySQL saudável, gera Prisma Client e aplica as migrations pendentes em cada inicialização. Dentro do container usa `mysql:3306`; no host, NestJS e a CLI Prisma usam `MYSQL_HOST`/`MYSQL_PORT` da mesma `.env`. Não é necessário alternar manualmente o endereço ao trocar de modo. O volume guarda os dados entre reinícios; não o remova para resolver falhas de autenticação ou migrations.

## Sem Docker

Instale/inicie MySQL 8.4 ou obtenha os dados de um servidor de desenvolvimento. Para um banco local novo, entre como administrador com `mysql -u root -p` (ou o método administrativo da instalação) e execute uma vez, substituindo a senha:

```sql
CREATE DATABASE piplup CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci;
CREATE USER 'piplup_app'@'localhost' IDENTIFIED BY '<senha_local>';
GRANT ALL PRIVILEGES ON piplup.* TO 'piplup_app'@'localhost';
```

Use esses mesmos banco, usuário e senha na `.env` da raiz, com `MYSQL_HOST=127.0.0.1` e a porta configurada (padrão `3306`). Não use root na aplicação. Se banco/conta já existirem, use as credenciais provisionadas em vez de repetir a criação. Para um servidor remoto ou MySQL no Windows acessado pelo WSL com NAT, o administrador deve permitir a conexão da origem correta; `'localhost'` não autoriza qualquer computador. Transporte remoto seguro ainda exige configuração específica do driver; não exponha MySQL sem ela. Consulte [contas MySQL 8.4](https://dev.mysql.com/doc/refman/8.4/en/creating-accounts.html) e [Backend](backend.md).

Em `backend/`:

```bash
npm install
npm run prisma:generate
npm run prisma:migrate:deploy
npx prisma migrate status
npm run start:dev
```

`/health` verifica o acesso real ao banco; HTTP 200 com `database: "ok"` confirma a consulta. Aplicar migrations e gerar o client não dependem de Docker. `MYSQL_ROOT_PASSWORD` é apenas para inicializar a imagem Docker e pode ficar vazio neste modo.

## Prisma e SQL

### Contrato de persistência do pareamento

O MVP permite um responsável ativo por dispositivo, representado por `Device.guardianId`. Esse campo é opcional para computadores provisionados ainda sem responsável; fixtures existentes conservam seu vínculo demonstrativo. O provisionamento de identidade não atribui um responsável automaticamente.

O pareamento acrescenta `AgentIdentity` (uma identidade por dispositivo, hash único de credencial e revogação), `PairingSession` (hash único do token, criação, expiração, consumo e revogação) e `DeviceAssociation` (histórico do responsável, dispositivo, criação e revogação). Segredos aleatórios de alta entropia são armazenados por hash SHA-256; o token em texto aparece somente na resposta de criação da sessão. A validade é de cinco minutos, sem extensão na validação.

Criação de sessão, consumo e revogação são serializados pelo bloqueio da linha do dispositivo, dentro de transações curtas. O consumo revalida identidade, validade e estado do token após obter o bloqueio, atualiza o token e cria o vínculo na mesma transação. Uma falha desfaz todas as alterações. A revogação retira o responsável ativo e invalida sessões pendentes; uma nova associação exige nova sessão. A consulta de validade não consome o token nem reserva o computador.

`DeviceAssociation.activeDeviceId` é igual ao dispositivo enquanto o vínculo está ativo e fica `NULL` quando revogado. Um índice único permite no máximo um vínculo ativo por computador; a CHECK `DeviceAssociation_active_state_check` impõe a correspondência entre esses campos e `revokedAt`. A CHECK é mantida no SQL versionado porque não é expressa pelo schema Prisma. A relação do histórico com Device usa `RESTRICT` para exclusão e atualização, compatível com essa CHECK no MySQL 8.4. Não remover a CHECK em futuras migrations. O procedimento administrativo e a obrigação de autorização local estão em [Integração Lux](lux-integration.md).

Migrations Prisma são versionadas junto ao código e aplicadas de forma controlada entre ambientes. Prisma é o caminho padrão para acesso e alterações de dados. Os requisitos acadêmicos incluem views, funções, procedures, triggers, transações e tratamento de erros SQL; implemente-os quando os casos de uso e o schema estiverem definidos. SQL direto via Prisma é permitido para esses recursos, com consultas parametrizadas e sem concatenar dados de usuário.

`backend/prisma/schema.prisma` define `Guardian` com UUID, email único, nome e hash Argon2id da senha, e `Device` com UUID, nome, usuário gerenciado opcional, `guardianId` e `isDemo`. As migrations versionadas criam esses modelos. A relação usa comportamento restritivo para exclusão e índice simples por `guardianId`; nomes não são identidade única. `prisma:generate` gera código ignorado pelo Git, sem alterar o banco. Comandos e execução estão em [Backend](backend.md).

Para **aplicar migrations existentes**, use `npm run prisma:migrate:deploy` em `backend/` ou a inicialização automática do Compose. Esse comando não cria migrations nem exige shadow database.

Para **criar uma nova migration**, altere o schema intencionalmente e use um banco exclusivo de desenvolvimento. O Prisma precisa criar/remover bancos temporários de comparação (shadow databases). A conta padrão do Compose só tem permissões no banco da aplicação. A preparação abaixo é opcional, feita por um administrador apenas para quem desenvolve migrations; não é necessária para executar a API.

Com MySQL local, execute como administrador:

```sql
GRANT CREATE, ALTER, DROP, INDEX, REFERENCES ON `prisma_migrate_shadow_db%`.* TO 'piplup_app'@'localhost';
```

No MySQL do Compose, entre com `docker compose exec mysql mysql -u root -p`, informe a senha administrativa de `.env` e aplique o mesmo grant à conta criada pela imagem, `'piplup_app'@'%'`. Ajuste o nome se alterou `MYSQL_USER`. Essas permissões se limitam aos bancos temporários com esse prefixo; não conceda privilégios globais nem guarde dados reais nesses bancos. Confira `SHOW VARIABLES LIKE 'partial_revokes';`: o grant por padrão requer valor `OFF`. Em servidores com `partial_revokes=ON` ou restrições administradas, peça uma configuração específica de shadow database ao administrador antes de usar `migrate dev`; a configuração atual do projeto utiliza criação automática.

Depois, em `backend/`, gere o SQL sem aplicá-lo imediatamente:

```bash
npm run prisma:migrate:dev -- --name <nome> --create-only
```

Revise `prisma/migrations/<data_nome>/migration.sql`, versione a migration junto ao schema e aplique com `npm run prisma:migrate:deploy`; atualize o client com `npm run prisma:generate`. No Docker, a criação pode ser executada com `docker compose run --rm backend npm run prisma:migrate:dev -- --name <nome> --create-only`; o mount de `prisma` preserva o SQL no host. Após revisar, `docker compose restart backend` aplica a pendência e gera o client.

O Prisma reinicializa somente os bancos shadow temporários nesse fluxo. Se detectar drift e pedir reset do banco da aplicação, interrompa e investigue; não aceite para contornar o erro. Nunca configure o banco principal como shadow. As permissões seguem a [documentação Prisma 7](https://www.prisma.io/docs/orm/v7/prisma-migrate/understanding-prisma-migrate/shadow-database), incluindo a limitação de padrões de nome no MySQL.

Recursos SQL não expressos no schema deverão ser mantidos em SQL versionado nas migrations reais; evite alterações manuais sem histórico. Transações e tratamento de erros devem acompanhar os casos de uso que precisarem de atomicidade e distinguir falhas de validação, conflito e indisponibilidade.

O seed de dispositivos de desenvolvimento requer `DEV_GUARDIAN_EMAIL` de uma conta existente e cria registros fictícios com `isDemo=true`. Com `NODE_ENV=development` na `.env` da raiz, execute `npm run prisma:seed:devices` após as migrations e antes do servidor em watch, ou `docker compose run --rm backend npm run prisma:seed:devices`. Ele não cria responsáveis nem atualiza registros existentes. Esses registros legados não recebem identidade de Agent ou associação real automaticamente. Contas gerenciadas e configurações parentais ainda dependem da validação Linux.
