<p align="center">
  <img src="simulated-client/public/piplup.svg" alt="Logo do piplup" width="180">
</p>

<h1 align="center">piplup</h1>

<p align="center">Parental Insight Platform for Lux User Protection</p>

<p align="center">
  <a href="https://expo.dev/"><img src="https://img.shields.io/badge/Expo-SDK%2057-000020?logo=expo&amp;logoColor=white" alt="Expo SDK 57"></a>
  <a href="https://reactnative.dev/"><img src="https://img.shields.io/badge/React_Native-0.86-20232A?logo=react&amp;logoColor=white" alt="React Native"></a>
  <a href="https://www.typescriptlang.org/"><img src="https://img.shields.io/badge/TypeScript-6-3178C6?logo=typescript&amp;logoColor=white" alt="TypeScript"></a>
  <a href="https://nodejs.org/"><img src="https://img.shields.io/badge/Node.js-24-5FA04E?logo=nodedotjs&amp;logoColor=white" alt="Node.js 24"></a>
  <a href="https://creativecommons.org/licenses/by-nc-nd/4.0/deed.pt-br"><img src="https://img.shields.io/badge/Licen%C3%A7a-CC%20BY--NC--ND%204.0-blue?logo=creativecommons&amp;logoColor=white" alt="Licença: CC BY-NC-ND 4.0"></a>
  <br>
  <a href="https://nestjs.com/"><img src="https://img.shields.io/badge/NestJS-12-E0234E?logo=nestjs&amp;logoColor=white" alt="NestJS"></a>
  <a href="https://www.prisma.io/"><img src="https://img.shields.io/badge/Prisma-7-2D3748?logo=prisma&amp;logoColor=white" alt="Prisma"></a>
  <a href="https://www.mysql.com/"><img src="https://img.shields.io/badge/MySQL-8.4-4479A1?logo=mysql&amp;logoColor=white" alt="MySQL 8.4"></a>
  <a href="https://www.docker.com/"><img src="https://img.shields.io/badge/Docker-2496ED?logo=docker&amp;logoColor=white" alt="Docker"></a>
  <a href="https://www.python.org/"><img src="https://img.shields.io/badge/Python-3776AB?logo=python&amp;logoColor=white" alt="Python"></a>
</p>

---

## 📑 Índice

- [📖 O que é o piplup?](#-o-que-é-o-piplup)
- [Estado atual](#estado-atual)
  - [Já implementado](#já-implementado)
  - [Próximos passos](#próximos-passos)
- [🚀 Como rodar o projeto localmente](#-como-rodar-o-projeto-localmente)
  - [1. Pré-requisitos e clone](#1-pré-requisitos-e-clone)
  - [2. Configuração inicial](#2-configuração-inicial)
  - [3A. Recomendado no Windows: MySQL no Docker e backend pelo npm](#3a-recomendado-no-windows-mysql-no-docker-e-backend-pelo-npm)
  - [3B. Alternativa: MySQL e backend no Docker](#3b-alternativa-mysql-e-backend-no-docker)
  - [3C. Alternativa: sem Docker](#3c-alternativa-sem-docker)
  - [4. Client simulado (segundo terminal)](#4-client-simulado-segundo-terminal)
  - [5. Abrir o app no celular (terceiro terminal)](#5-abrir-o-app-no-celular-terceiro-terminal)
  - [Demonstração sem Lux](#demonstração-sem-lux)
- [Uso diário e atualizações](#uso-diário-e-atualizações)
- [Limites de validação dos fluxos](#limites-de-validação-dos-fluxos)
- [Problemas e referências](#problemas-e-referências)
- [Documentação](#documentação)
- [📜 Licença](#-licença)

---

## 📖 O que é o piplup?

Projeto Integrador: aplicativo Expo para controle parental em computadores Lenovo Lux, com API NestJS, Prisma e MySQL. Login, perfil, listagem, pareamento e revogação de vínculos usam a API real. O mobile também possui telas de controle para navegadores, aplicativos, instalação e faixa etária, seleção de idioma em português, inglês e espanhol, e temas claro/escuro com acento vermelho. O [client simulado](docs/simulated-client.md) permite cadastrar PCs demonstrativos, parear por QR e refletir configurações persistidas do app. Existe uma [implementação Python do Agent](lux-agent/README.md) com consulta autenticada, `agent.ping`, coleta de aplicativos Linux e envio idempotente de relatórios por HTTPS. No Lux, o Agent é instalado como serviço `systemd` por `lux-agent/install.sh`, validado com reports reais, e pareado pela janela GTK Piplup ou pelo terminal; a integração parental ponta a ponta continua pendente. Consulte o [estado das etapas](docs/architecture.md#etapas-de-implementação).

---

## Estado atual

### Já implementado

- Aplicativo mobile em Expo 57, React Native e TypeScript, com navegação protegida por autenticação.
- Login, consulta de perfil, expiração de sessão e armazenamento seguro do token em Android/iOS.
- Backend NestJS com Prisma, MySQL, Docker Compose, migrations, health check e Swagger.
- Autenticação de responsáveis com JWT e Argon2id.
- Listagem autorizada de computadores e revogação de vínculos.
- Pareamento por QR Code com token temporário, validação, confirmação, consumo único e revogação.
- Home, lista de computadores, leitura de QR Code e estados de carregamento, erro e lista vazia.
- Telas de Navegadores, Aplicativos, Instalação e Faixa etária com seleção compartilhada de computador e identidade visual do protótipo.
- Consultas autenticadas de inventário de aplicativos e pedidos de instalação persistidos; coleta de pedidos pelo Agent ainda pendente.
- Ingestão autenticada de relatórios do Agent, com atualização transacional de inventário, pedidos e marcadores de coleta.
- Agent Python com polling autenticado, diário persistente, reenvio idempotente e coleta real de aplicativos Linux por arquivos `.desktop`.
- Estados condicionais para aplicativos instalados e pedidos de instalação: sem computador pareado, não há dados fictícios exibidos.
- Seleção de idioma em **Sobre o projeto → Idioma**, com português, inglês e espanhol. O idioma inicial é detectado pelo sistema do dispositivo e a escolha manual é persistida.
- Temas **Sistema**, **Claro** e **Escuro** em **Sobre o projeto → Tema**. Sistema acompanha a aparência do dispositivo; a escolha manual é persistida. O visor da câmera no pareamento permanece escuro.
- Primeiro comando `agent.ping` com autorização por vínculo, reserva única e diário do Agent, validado no Lux real por HTTPS; sem comandos parentais ou UI mobile de comandos.
- Testes de typecheck, lint, testes de API e verificações de integração existentes no backend/mobile.

### Próximos passos

1. Instalar e validar a unidade `systemd` no Lux real, com identidade provisionada, URL HTTPS definitiva e recuperação de conexão.
2. Integrar confirmação de operações reais; o client simulado confirma suas próprias revisões, mas não comprova aplicação no GNOME.
3. Definir privilégios mínimos do Agent e validar operações de escrita; a leitura de políticas na VM Lux já foi validada com e sem restrições, exigindo autenticação administrativa para outra conta.
4. Implementar a coleta real de pedidos de instalação e suas decisões, registrando sucesso, falha e indisponibilidade no backend.
5. Implementar a janela GTK4/libadwaita de pareamento do Agent (o QR no terminal já existe).
6. Conectar o Agent às decisões de instalação e restrições, registrando confirmação posterior no backend.
7. Expandir a cobertura de testes para troca de idioma e tema, múltiplos computadores, ausência de conexão, pedidos de instalação e fluxo ponta a ponta.

As telas de restrições já existem como superfície de produto, e a coleta de aplicativos já foi validada ponta a ponta localmente. A aplicação real de políticas no computador ainda depende dos endpoints parentais, do Agent instalado no Lux e da validação GNOME descritos acima. O [roadmap da arquitetura](docs/architecture.md#etapas-de-implementação) mantém o estado técnico detalhado e as limitações conhecidas.

---

## 🚀 Como rodar o projeto localmente

### 1. Pré-requisitos e clone

- Git, Node.js **24.15+ na linha 24**, npm e Expo Go compatível com **SDK 57** no celular.
- **Com Docker:** Docker Desktop no Windows/macOS ou Engine com Compose v2 no Linux.
- **Sem Docker:** MySQL **8.4** local ou servidor de desenvolvimento acessível.

Confira `git --version`, `node --version` e `npm --version`. Para Docker, também `docker --version` e `docker compose version`; para cliente MySQL local, `mysql --version`.

```bash
git clone https://github.com/cfrans/Projeto-Integrador-FatecID-5Sem.git
cd Projeto-Integrador-FatecID-5Sem
```

#### Node por projeto

Com [nvm-windows](https://github.com/coreybutler/nvm-windows) no Windows ou [nvm](https://github.com/nvm-sh/nvm#installing-and-updating) no Linux/macOS instalado, execute na raiz:

```bash
nvm install 24.22.0
nvm use 24.22.0
```

O arquivo `.nvmrc` fixa Node **24.22.0** para backend e mobile. Os comandos explícitos também funcionam no nvm-windows. Ative essa versão nos terminais usados para o projeto e confirme com `node --version`. Instale as dependências com `npm ci` em `backend/` e `mobile/` depois de ativar essa versão.

### 2. Configuração inicial

Na raiz, crie `.env` **somente se ainda não existir**. No PowerShell:

```powershell
if (!(Test-Path .env)) { Copy-Item .env.example .env }
```

Em Bash: `test -f .env || cp .env.example .env`. Preserve as credenciais do ambiente já configurado.

Edite `.env`:

- Preencha `MYSQL_PASSWORD`, `JWT_SECRET` e, com Docker, `MYSQL_ROOT_PASSWORD` com uma senha diferente. Para gerar o JWT_SECRET: `node -e "console.log(require('node:crypto').randomBytes(32).toString('hex'))"`.
- Mantenha `NODE_ENV=development`. Defina `DEV_GUARDIAN_EMAIL`, `DEV_GUARDIAN_NAME` e `DEV_GUARDIAN_PASSWORD` (12–128 caracteres) para criar sua conta de teste.
- Os valores padrão usam banco `piplup`, usuário `piplup_app`, MySQL `127.0.0.1:3306` e API `3000`. Ajuste os dados MySQL se usar outro servidor; para conexão remota, consulte [configuração de transporte](docs/backend.md#desenvolvimento-no-host).

As credenciais são individuais e privadas: nunca versione `.env`. NestJS e Prisma carregam esse arquivo mesmo executados em `backend/`; não crie outra cópia nem uma `DATABASE_URL`. O mobile recebe somente a configuração pública da API, explicada no passo 5.

### 3A. Recomendado no Windows: MySQL no Docker e backend pelo npm

Abra o Docker Desktop e espere o Engine iniciar. No terminal **na raiz do projeto**, com `.env` preenchida:

```powershell
docker compose config --quiet
docker compose stop backend
docker compose up -d --wait --wait-timeout 120 mysql
docker compose ps
Test-NetConnection 127.0.0.1 -Port 3306
```

O MySQL precisa aparecer como **healthy** e `TcpTestSucceeded` deve ser `True` (ajuste a porta se mudou `MYSQL_PORT`). `stop backend` evita duas APIs disputando a porta 3000 quando você já usou o backend no Docker; não para o MySQL nem apaga dados.

**No mesmo terminal**, depois de confirmar o banco:

```powershell
cd backend
npm ci
npm run prisma:migrate:deploy
npm run prisma:generate
```

Somente se a conta ainda não existir, execute `npm run prisma:seed`, usando `DEV_GUARDIAN_*` da `.env`. O cadastro de PCs da demonstração será feito pelo client; não precisa rodar o seed de dispositivos. Depois:

```powershell
npm run start:dev
```

Deixe esse terminal aberto. Em outro terminal, teste `Invoke-RestMethod http://127.0.0.1:3000/health`: deve retornar `status: ok` e `database: ok`. Swagger: `http://127.0.0.1:3000/docs`.

**Erro P1001 em `prisma:migrate:deploy`:** a CLI não alcançou o MySQL. Volte aos comandos do Docker e ao teste da porta antes de repetir a migration. Se o banco está saudável mas o login é recusado, confira as credenciais existentes; alterar a `.env` não altera a senha de um volume já inicializado. Não remova o volume.

Continue nos passos 4 e 5. O backend e o client rodam no computador; o celular acessa somente a API e o Metro.

### 3B. Alternativa: MySQL e backend no Docker

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

### 3C. Alternativa: sem Docker

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
npm ci
npm run prisma:migrate:deploy
npm run prisma:generate
```

Em banco novo, antes do servidor, execute `npm run prisma:seed` para criar sua conta. Para dispositivos demonstrativos, use também `npm run prisma:seed:devices`. Se a conta já existir, não repita seu seed. Depois:

```bash
npm run start:dev
```

Confira `http://localhost:3000/health` e Swagger em `/docs`. Nenhum comando Docker é necessário nesta alternativa.

#### Migrations

`npm run prisma:migrate:deploy` aplica migrations existentes; o Docker faz isso ao iniciar. Após receber novas migrations/schema, no host aplique as migrations e execute `npm run prisma:generate` antes do watch.

Para criar uma migration, prepare as [permissões shadow](docs/database.md#prisma-e-sql) num banco exclusivo de desenvolvimento e, em `backend/`, execute:

```bash
npm run prisma:migrate:dev -- --name <nome> --create-only
```

Revise o SQL, aplique com `npm run prisma:migrate:deploy` e gere o client. Não use `db push` ou reset para contornar erros. Mudar credenciais na `.env` não altera contas de um volume MySQL existente. [Banco e migrations](docs/database.md).

### 4. Client simulado (segundo terminal)

Com a API saudável, abra outro terminal **na raiz**, ative Node 24 e execute:

```powershell
cd simulated-client
npm ci
npm start
```

Mantenha aberto e acesse `http://127.0.0.1:4317` no PC. Cadastre o computador usando o login do responsável. Depois leia **esse QR dentro do app**, em **Adicionar computador**, e confirme. [Roteiro da demonstração](docs/simulated-client.md).

### 5. Abrir o app no celular (terceiro terminal)

O projeto permanece no **SDK 57**. Expo Go para SDK 58 não abre este projeto; não existe flag de compatibilidade. No Android, instale a [versão oficial para SDK 57](https://expo.dev/go?device=true&platform=android&sdkVersion=57). A atualização automática da loja pode substituí-la. Em iPhone físico não é possível instalar uma versão antiga do Expo Go; use uma development build compatível. [Orientação oficial](https://docs.expo.dev/workflow/upgrading-expo-sdk-walkthrough/).

Descubra o IPv4 da conexão ativa com `ipconfig` no Windows (`ip -4 addr` no Linux). **No navegador do celular**, teste `http://<IP-do-PC>:3000/health`. Só continue quando retornar `status: ok` e `database: ok`. PC por cabo e celular por Wi-Fi funcionam se a rede permitir comunicação; estar no mesmo roteador não garante acesso. `localhost` no celular aponta para o próprio aparelho.

Abra outro terminal **na raiz**, ative Node 24, substitua o IP abaixo pelo seu e execute no PowerShell:

```powershell
cd mobile
npm ci
$env:EXPO_PUBLIC_API_URL = 'http://192.168.0.140:3000'
npx expo start --go --lan
```

O IP é um exemplo; confira o seu a cada mudança de rede. Ajuste a porta se mudou `PORT`. Em Bash: `export EXPO_PUBLIC_API_URL='http://<IP-do-PC>:3000'`. Para persistir, crie `mobile/.env.local` a partir de `mobile/.env.example` somente se ainda não existir e defina `EXPO_PUBLIC_API_URL`. Não coloque senhas nem JWT nesse arquivo. A variável do terminal tem prioridade sobre o arquivo.

Leia **o QR do terminal Expo** no Expo Go para abrir o app. Faça login com a conta criada pelo seed. Esse QR é diferente do QR de pareamento exibido pelo client.

Se o app ficar branco e não aparecer bundle no terminal, teste no navegador do celular `http://<IP-do-PC>:8081/status` (ou a porta Metro exibida no terminal). Se o Metro não conectar, pare o Expo com Ctrl+C e tente, **no mesmo terminal com a URL da API definida**:

```powershell
npx expo start --go --tunnel --clear
```

O túnel resolve o acesso ao Metro, **não expõe a API**: o teste `/health` no celular continua necessário. Não use a URL do túnel como `EXPO_PUBLIC_API_URL`. [Conectividade, WSL e firewall](docs/mobile.md#wsl2-e-firewall).

### Demonstração sem Lux

Com backend, migrations e conta de teste preparados, execute `npm ci` e `npm start` em `simulated-client/`. Abra `http://127.0.0.1:4317`, cadastre o PC e leia o QR em **Adicionar computador** no app. As quatro abas salvam configurações e aguardam confirmação do client. [Roteiro completo](docs/simulated-client.md).

---

## Uso diário e atualizações

| Processo | Comando / diretório |
| --- | --- |
| Banco no Docker | Raiz: `docker compose up -d --wait mysql` |
| Backend no host | `backend/`: `npm run start:dev` |
| Client | `simulated-client/`: `npm start` |
| App | `mobile/`: defina a URL da API e use `npx expo start --go --lan` ou `--tunnel` |

Mantenha os três terminais npm/Expo abertos. Se optou pelo backend no Docker, substitua seu terminal por `docker compose up -d --build` na raiz.

Após mudanças apenas em telas, pressione **r** no terminal Expo. Se um asset continuar antigo, reinicie o Expo com `--clear`. Após atualizar schema/migrations, pare o backend com Ctrl+C, confirme o MySQL saudável, execute em `backend/` `npm run prisma:migrate:deploy` e `npm run prisma:generate`, e reinicie o backend. Reinicie também o client quando seu código mudar. Execute `npm ci` novamente somente quando as dependências/lockfile mudarem ou numa primeira instalação.

---

## Limites de validação dos fluxos

Os fluxos com e sem Docker usam os mesmos scripts, configuração e migrations. `docker compose config --quiet` verifica a configuração; `/health` com HTTP 200 e `database: "ok"` verifica o acesso da API ao banco. Esses checks não comprovam instalação do zero, execução com MySQL independente do Docker ou acesso por celular físico. A instalação com MySQL 8.4 isolado em Docker, migrations, backend local e fluxo app/API/client possui testes de integração. MySQL instalado diretamente no host e abertura em outros celulares ainda exigem validação no ambiente de cada integrante. Use a versão Node declarada nos pré-requisitos e execute o [roteiro manual](docs/mobile.md#validação-manual-no-celular) para verificar rede, WSL/firewall e câmera no ambiente de cada integrante.

---

## Problemas e referências

| Problema                                           | Onde conferir                                                                                                                                                                                  |
| -------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Porta ocupada / containers falhando                | Confira `PORT` e `.env`. Com Docker: `docker compose config --quiet`, `docker compose ps -a` e `docker compose logs --tail 100 backend mysql`. [Backend](docs/backend.md#executar-com-docker). |
| MySQL indisponível / credenciais recusadas         | Confira serviço, host, porta e conta; `npx prisma migrate status` em `backend/`. Não remova volumes para corrigir credenciais. [Banco](docs/database.md).                                      |
| Prisma Client desatualizado / migrations pendentes | Pare o watch, aplique migrations e gere o client; no Docker, reinicie o backend. [Migrations](docs/database.md#prisma-e-sql).                                                                  |
| API funciona no PC, mas não no celular             | Teste a URL mostrada no erro do app; confira IP, firewall e isolamento. [WSL e firewall](docs/mobile.md#wsl2-e-firewall).                                                                      |
| Expo Go não abre / login falha                     | Confira SDK 57, conexão ao Metro, URL da API e conta criada. [Mobile](docs/mobile.md#autenticação-e-api).                                                                                      |

---

## Documentação

Testes: [Cypress/API/MySQL em Docker](docs/testing.md), [backend](docs/backend.md#verificações), [mobile](docs/mobile.md#configuração-e-verificações) e [checklist no celular](docs/mobile.md#validação-manual-no-celular). Builds: [EAS](docs/mobile.md#builds-com-eas). Projeto: [índice](docs/README.md), [Engenharia de Software III](docs/software-engineering-iii.md), [arquitetura](docs/architecture.md), [design](docs/design.md) e [Lux Agent](docs/lux-integration.md).

---

## 📜 Licença

Este projeto está sob a licença [**CC BY-NC-ND 4.0**](https://creativecommons.org/licenses/by-nc-nd/4.0/deed.pt-br) (Creative Commons — Atribuição, Não Comercial, Sem Derivações). O compartilhamento é permitido com atribuição, para fins não comerciais e sem distribuição de versões modificadas. Materiais de terceiros mantêm suas respectivas licenças.
