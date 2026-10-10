# Banco de dados

O banco é MySQL 8.4, executado em Docker para desenvolvimento. O backend NestJS executável usa Prisma como acesso de dados; mobile e Lux Agent não recebem credenciais MySQL. O schema de domínio será evoluído quando os requisitos e contratos do MVP forem detalhados. Não criar modelos ou migrations artificiais para antecipar entidades ainda não decididas.

## Ambiente local

O `docker-compose.yml` da raiz inicia NestJS e MySQL e guarda os dados no volume nomeado `mysql_data`. As portas do host são vinculadas a `127.0.0.1`, limitando a conexão à máquina local. Copie `.env.example` para `.env`, preencha as credenciais locais e use:

```bash
docker compose config --quiet
docker compose up -d --build
docker compose ps
```

`docker compose down` para os containers sem remover o volume. A imagem oficial do MySQL aplica `MYSQL_DATABASE`, `MYSQL_USER`, `MYSQL_PASSWORD` e `MYSQL_ROOT_PASSWORD` somente quando o diretório de dados está vazio; mudar `.env` após inicializar o volume não altera as contas ou o banco já existentes.

## Prisma e SQL

Quando os modelos forem definidos, migrations Prisma serão versionadas junto ao código e aplicadas de forma controlada entre ambientes. Prisma é o caminho padrão para acesso e alterações de dados. Os requisitos acadêmicos incluem views, funções, procedures, triggers, transações e tratamento de erros SQL; implemente-os quando os casos de uso e o schema estiverem definidos. SQL direto via Prisma é permitido para esses recursos, com consultas parametrizadas e sem concatenar dados de usuário.

`backend/prisma/schema.prisma` contém apenas o provider MySQL e o gerador do client; `backend/prisma7.config.ts` define a conexão e o caminho `prisma/migrations`. `prisma:generate` gera código ignorado pelo Git, sem alterar o banco. Não existem migrations nem tabelas de domínio nesta etapa. Comandos e execução estão em [Backend](backend.md).

Para criar migrations reais, `prisma migrate dev` precisa de um banco temporário de comparação (shadow database). O usuário atual da imagem MySQL tem permissões apenas no banco da aplicação; antes da primeira migration, será necessário provisionar um shadow database separado e suas permissões, ou uma conta de desenvolvimento apropriada. A credencial root não deve ser usada pela aplicação. `migrate deploy` não exige shadow database. Não configure o banco principal como shadow database. Consulte a [documentação Prisma 7](https://www.prisma.io/docs/orm/v7/prisma-migrate/understanding-prisma-migrate/shadow-database).

Recursos SQL não expressos no schema deverão ser mantidos em SQL versionado nas migrations reais; evite alterações manuais sem histórico. Transações e tratamento de erros devem acompanhar os casos de uso que precisarem de atomicidade e distinguir falhas de validação, conflito e indisponibilidade.

Conceitos já conhecidos do domínio: responsável, computador e vínculo de pareamento revogável. Contas gerenciadas e configurações parentais pertencem ao domínio funcional, mas a necessidade e a forma de persistir seus dados dependem dos requisitos e da validação da integração. Campos, relações, política de dados sensíveis e retenção serão documentados junto ao schema futuro.
