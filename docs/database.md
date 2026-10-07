# Banco de dados

Database: MySQL 8.4.

## Desenvolvimento local

O `docker-compose.yml` na raiz inicia somente o serviço MySQL e armazena os dados no volume nomeado `mysql_data`. A porta do host é vinculada a `127.0.0.1`; o mobile e o Lux Agent não acessam esse banco. Somente o backend deverá usar as credenciais da aplicação.

Para preparar o ambiente:

```bash
cp .env.example .env
```

Preencha `MYSQL_PASSWORD` e `MYSQL_ROOT_PASSWORD` em `.env`. Depois, valide e inicie:

```bash
docker compose config --quiet
docker compose up -d
docker compose ps
```

`docker compose down` para os containers e preserva `mysql_data`; uma nova inicialização reutiliza os dados. As variáveis `MYSQL_DATABASE`, `MYSQL_USER`, `MYSQL_PASSWORD` e `MYSQL_ROOT_PASSWORD` são aplicadas pela imagem oficial apenas na inicialização de um diretório de dados vazio. Alterar `.env` depois que o volume foi inicializado não altera o banco ou as contas existentes.

O backend é o único componente que acessa o banco principal. Mobile e Lux Agent não recebem credenciais MySQL.

Conceitos conhecidos: responsável, computador e vínculo de pareamento revogável. Contas gerenciadas e configurações parentais fazem parte do domínio, mas a necessidade de persistir cópias ainda precisa ser definida.

TODO: definir entidades, relações, identificadores, política de dados sensíveis e retenção após os contratos e requisitos do MVP. Nenhum schema, migration ou ORM nesta etapa.
