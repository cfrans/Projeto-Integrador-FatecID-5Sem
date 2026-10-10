# Banco de dados

O banco é MySQL 8.4, executado em Docker para desenvolvimento. O backend NestJS executável usa Prisma como acesso de dados; mobile e Lux Agent não recebem credenciais MySQL. O schema contém Guardian para autenticação e Device para registros associados ao escopo de acesso de um responsável. Device não comprova pareamento, identidade do agente ou presença online; ainda não há contrato de associação real com o Lux.

## Ambiente local

O `docker-compose.yml` da raiz inicia NestJS e MySQL e guarda os dados no volume nomeado `mysql_data`. As portas do host são vinculadas a `127.0.0.1`, limitando a conexão à máquina local. Copie `.env.example` para `.env`, preencha as credenciais locais e use:

```bash
docker compose config --quiet
docker compose up -d --build
docker compose ps
```

`docker compose down` para os containers sem remover o volume. A imagem oficial do MySQL aplica `MYSQL_DATABASE`, `MYSQL_USER`, `MYSQL_PASSWORD` e `MYSQL_ROOT_PASSWORD` somente quando o diretório de dados está vazio; mudar `.env` após inicializar o volume não altera as contas ou o banco já existentes.

## Prisma e SQL

Migrations Prisma são versionadas junto ao código e aplicadas de forma controlada entre ambientes. Prisma é o caminho padrão para acesso e alterações de dados. Os requisitos acadêmicos incluem views, funções, procedures, triggers, transações e tratamento de erros SQL; implemente-os quando os casos de uso e o schema estiverem definidos. SQL direto via Prisma é permitido para esses recursos, com consultas parametrizadas e sem concatenar dados de usuário.

`backend/prisma/schema.prisma` define `Guardian` com UUID, email único, nome e hash Argon2id da senha, e `Device` com UUID, nome, usuário gerenciado opcional, `guardianId` e `isDemo`. A migration `20261010190000_add_devices` é aditiva e foi gerada com Prisma 7 comparando o schema committed de Guardian ao novo schema; a geração não conectou ao banco. A relação usa comportamento restritivo para exclusão e índice simples por `guardianId`; nomes não são identidade única. `prisma:generate` gera código ignorado pelo Git, sem alterar o banco. Comandos e execução estão em [Backend](backend.md).

Para criar migrations com `prisma migrate dev`, é necessário um banco temporário de comparação (shadow database). O usuário atual da imagem MySQL tem permissões apenas no banco da aplicação; esse fluxo exige provisionar um shadow database separado e suas permissões, ou uma conta de desenvolvimento apropriada. A credencial root não deve ser usada pela aplicação. `migrate deploy` não exige shadow database. Não configure o banco principal como shadow database. Consulte a [documentação Prisma 7](https://www.prisma.io/docs/orm/v7/prisma-migrate/understanding-prisma-migrate/shadow-database).

Recursos SQL não expressos no schema deverão ser mantidos em SQL versionado nas migrations reais; evite alterações manuais sem histórico. Transações e tratamento de erros devem acompanhar os casos de uso que precisarem de atomicidade e distinguir falhas de validação, conflito e indisponibilidade.

O seed de dispositivos de desenvolvimento requer `DEV_GUARDIAN_EMAIL` de uma conta existente e cria registros fictícios com `isDemo=true`; é executado por `NODE_ENV=development npm run prisma:seed:devices` após as migrations. Ele não cria responsáveis nem atualiza registros existentes. Vínculo de pareamento revogável, identidade real do computador, contas gerenciadas e configurações parentais ainda dependem de requisitos e validação da integração.
