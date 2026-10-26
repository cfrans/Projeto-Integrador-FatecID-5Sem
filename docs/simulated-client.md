# Client simulado

A demonstração usa o fluxo mobile → NestJS → client local, com MySQL real. O programa em `simulated-client/` representa um PC, exibe o QR de pareamento e reflete navegadores, aplicativos, faixa etária e instalação definidos no app. Também envia pedidos de instalação e recebe aprovação/recusa. Não instala aplicativos, bloqueia processos nem altera o GNOME ou o sistema operacional.

O cabeçalho e o favicon usam os dois pinguins do `PenguinLogo` do mobile, com as mesmas proporções e cores da paleta escura. Os arquivos locais são servidos pelo próprio client.

## Executar

Siga primeiro o [passo 3A do README](../README.md#3a-recomendado-no-windows-mysql-no-docker-e-backend-pelo-npm): MySQL saudável **antes** de aplicar migrations, gerar o Prisma Client e iniciar o backend. Use `NODE_ENV=development` e uma conta criada pelo seed. Para client e celular, siga os passos 4 e 5 do mesmo guia.

Em outro terminal, com Node 24.15+ na linha 24:

```bash
cd simulated-client
npm ci
npm start
```

1. Abra `http://127.0.0.1:4317` no computador. Preencha nome do PC, conta gerenciada e o login do responsável criado pelo seed. Esse login autoriza somente a criação de uma identidade demonstrativa, ainda sem vínculo.
2. No app, faça login e escolha **Adicionar computador**. Leia o QR mostrado pelo client e confirme o vínculo; o QR expira em cinco minutos e pode ser renovado no client.
3. O PC aparece em **Computadores**. Abra **Restrições** no cartão e altere os controles. Um único PC pareado é selecionado automaticamente; com vários, escolha no seletor compartilhado.
4. O client consulta a API a cada dois segundos, reflete a revisão e confirma sua aplicação simulada. O app diferencia salvamento, espera pelo client e confirmação.
5. Envie um pedido de instalação pelo client e decida na aba **Instalação** do app. A decisão aparece no client; nenhum programa é instalado.

A senha e o JWT usados no cadastro não são persistidos. A credencial individual fica no arquivo local ignorado `simulated-client/.state/identity.json`, nunca no navegador ou QR. A identidade e o inventário demonstrativo são reutilizados após reiniciar o programa; as configurações permanecem no backend. Proteja esse arquivo com as permissões da conta local. O programa usa modos `0700`/`0600` onde suportados; no Windows, a proteção depende das ACLs da pasta.

## Configuração

| Variável do processo do client | Padrão / uso |
| --- | --- |
| `PIPLUP_API_URL` | `http://127.0.0.1:3000`; somente origem, sem caminho, credenciais ou query |
| `PIPLUP_CLIENT_PORT` | `4317`, escuta apenas em `127.0.0.1` |
| `PIPLUP_CLIENT_STATE` | Caminho para outra identidade local; use também outra porta para demonstrar vários PCs |
| `PIPLUP_ALLOW_LAN_HTTP` | `true` permite HTTP para API em outro computador numa rede de desenvolvimento confiável; fora disso, use HTTPS |

PowerShell: `$env:PIPLUP_API_URL = 'http://127.0.0.1:3000'` antes de `npm start`. O celular usa a URL LAN da API descrita em [Mobile](mobile.md); ele não acessa a porta local do client. Ao trocar a origem do backend, use outro arquivo de estado para não enviar a identidade ao servidor errado.

Fechar somente a aba do navegador mantém o programa rodando. Ctrl+C no terminal interrompe a sincronização. Sem o client, alterações ficam pendentes; não há fila de ações no celular. A cada consulta, o client envia um heartbeat autenticado: a presença é online por até 15 segundos desde o último contato e depois offline. Antes do primeiro contato fica não validada. Home/lista consultam a cada cinco segundos; restrições a cada dois. Esse estado comprova comunicação do simulador, não funcionamento de um PC real ou do GNOME. A confirmação de aplicação e seu horário são independentes da presença.

Revogar o vínculo no app retira o acesso, e o client descarta as configurações daquele vínculo na próxima consulta. Um novo pareamento começa com configurações padrão e sem decisões do responsável anterior. Se a identidade for invalidada administrativamente, o client interrompe as consultas; use uma nova identidade/arquivo de estado após o reprovisionamento. Revogação não altera políticas de um sistema operacional real.

## Contrato da simulação

As respostas de estado incluem `connection: { status, lastSeen }`; leitura pelo responsável não renova a presença. Heartbeats de vínculos antigos são rejeitados. O servidor usa seu próprio horário.

Todos os endpoints abaixo recusam execução fora de `development`/`test`. Acesso a configurações e relatórios exige dispositivo `isDemo: true`, identidade válida e vínculo ativo; a criação exige JWT de responsável. Os endpoints reais de pareamento e autenticação foram reutilizados.

| Endpoint | Autenticação e finalidade |
| --- | --- |
| `POST /simulation/devices` | JWT; `{ name, managedUser? }` → `{ device, credential }`; cria somente PC demonstrativo, sem parear |
| `GET /simulation/devices/:id` | JWT do responsável vinculado; consulta configurações e confirmação |
| `PATCH /simulation/devices/:id` | Mesmo JWT; `{ revision, settings }`, com alteração parcial e controle de concorrência |
| `GET /agent/simulation` | Credencial do próprio client; consulta configurações do vínculo ativo |
| `POST /agent/simulation/heartbeat` | Mesma credencial; `{ associationId }`; registra contato no vínculo ativo sem confirmar configurações |
| `PUT /agent/simulation` | Mesma credencial; `{ associationId, revision, applications, installationRequests }`; publica relatório e confirma a revisão |

`SimulationState` é a única tabela nova, ligada ao vínculo, contendo `settings`, `revision`, `appliedRevision`, `appliedAt` e `lastSeenAt`. As configurações são `blockBrowsers`, `allowedBrowsers`, `blockInstallation`, `ageRating`, `applicationRules` e `installationDecisions`. Mapas são mesclados por chave, validados e limitados; aplicações e pedidos devem pertencer ao inventário recebido. As idades aceitas são `L`, `10`, `12`, `16` e `18`.

O relatório reutiliza `InstalledApplication`, `InstallationRequest` e os marcadores de relatório de `Device`. Atualização e confirmação são transacionais, usando o mesmo lock de computador do pareamento/revogação. Revisão ou vínculo antigo retorna `409`, sem substituir relatórios; recurso sem acesso retorna `404`; falha operacional retorna `503`. Reenviar a mesma revisão não duplica registros. Uma confirmação vale exclusivamente para a simulação, sem comprovar aplicação Linux.

Este contrato de estado demonstrativo é separado da [protocolo de comandos do Agent real](agent-protocol.md). O Agent Python e sua leitura malcontent foram preservados.

## Verificações

Em `simulated-client/`, `npm test` verifica cadastro, QR, sigilo da identidade, sincronização, revisão antiga, pedidos, revogação, origens locais e respostas inválidas; `npm run lint` verifica sintaxe. O backend inclui testes unitários e `test/simulation.mysql-test.mjs`, executado por `npm run test:mysql` somente com `NODE_ENV=test` e banco exclusivo terminado em `_test`. Use os comandos de [Backend](backend.md#verificações), incluindo build antes da suíte MySQL. Os testes de contrato mobile fazem parte de `npm run test:api`.

`npm run test:integration` em `simulated-client/` usa os serviços HTTP reais do mobile, API, banco de teste e programa local juntos. Requer dependências nos três diretórios, backend compilado e o mesmo ambiente MySQL exclusivo terminado em `_test`.

Validação em 25/10/2026: seis migrations aplicadas do zero em MySQL 8.4 descartável; testes de presença pela API cobrem primeiro contato, expiração, isolamento entre responsáveis, revogação e novo vínculo. Passaram lint/typecheck, 28 testes unitários e seis HTTP do backend, 40 testes de API mobile, oito testes do client e a integração mobile/API/MySQL/client. A suíte MySQL completa (cinco testes) também passou em Linux, incluindo permissões POSIX; o bundle Android foi compilado pelo Expo com HTTP 200. As novas alterações visuais ainda exigem conferência no celular físico; gerar bundle não valida interação ou câmera.
