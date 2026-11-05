# Protocolo de comandos do Lux Agent — versão 1

Implementado e validado com `agent.ping` entre responsável HTTP, NestJS, MySQL e Agent Python no Lux por HTTPS. O mobile ainda não cria nem apresenta comandos. Procedimento e evidências em [Validação de ping](agent-ping-validation.md); instalação systemd, GTK, pareamento local e operações parentais continuam pendentes.

## Escopo e revisão da proposta

REST/HTTPS de saída e persistência no MySQL existente, sem broker, WebSocket, Redis ou outra autenticação. Reutiliza JWT de responsável, `AgentAuthGuard`, `AgentIdentity`, `DeviceAssociation` e o lock de `Device` usado no pareamento. `lux_agent.parental` permanece independente do transporte remoto.

A única intenção válida é `{ "type": "agent.ping", "version": 1, "parameters": {} }`. Seu sucesso é `{ "reachable": true }`: confirma processamento e retorno, sem consultar hostname, contas, GNOME ou políticas. Operações/versões desconhecidas, parâmetros arbitrários, shell, scripts e URLs de retorno são recusados.

Decisões resolvidas antes da implementação:

| Tema | Contrato implementado |
| --- | --- |
| `requestId` | UUID v4, normalizado em minúsculas, único por `(associationId, requestId)`. Repetição equivalente retorna o mesmo comando; UUID novo é intenção nova. Outro vínculo pode usar o mesmo UUID, sem recuperar o histórico anterior. |
| Vínculo | Exige `DeviceAssociation` original com `revokedAt: null`, `activeDeviceId` igual ao dispositivo e responsável compatível com `Device.guardianId`. O campo do dispositivo sozinho não autoriza. |
| Revogação | Criação/claim/resultado e revogações serializam pela mesma linha de `Device`. A identidade é revalidada depois do lock; o guard não é a única verificação. Transações usam `READ COMMITTED` com lock exclusivo da linha do dispositivo, evitando gap locks entre computadores diferentes. |
| `claimId` | UUID v4, único por `(deviceId, claimId)`, vinculado à identidade autenticada e a uma única reserva. Não é credencial nem lease renovável. |
| Prazos | Cinco minutos para reservar; 30 segundos a partir do primeiro claim. Valores definidos pelo servidor, sem parâmetros de prazo enviados pelo cliente. O orçamento de 30 s é constante, não uma coluna redundante. |
| Incerteza | Timeout após reserva produz estado efetivo `unknown`, sem reentrega. Resultado tardio da mesma reserva é aceito somente com identidade e vínculo original ainda ativos. |
| Resultado | Definitivo e tipado. PUT equivalente retorna o mesmo recibo; status/erro diferentes retornam 409. O único resultado de sucesso aceito é `reachable: true`. |
| Limites | Servidor de produção/desenvolvimento inicializado por `main.ts`: corpos JSON até 16 KiB. Respostas de comandos são limitadas pelo contrato fixo e polling de no máximo um item; cliente recusa mais de 16 KiB. |

A reserva não torna a execução e a revogação uma transação distribuída. Revogar antes do claim impede a reserva. Depois do claim, não é possível garantir interrupção de execução local já autorizada/iniciada: a transação marca reservas sem resultado como `unknown` e bloqueia novos claims/resultados daquele vínculo. Nenhum resultado passa para novo responsável, inclusive se o mesmo responsável parear novamente.

O schema também inclui inventário, pedidos de instalação e `SimulationState` para o [client demonstrativo](simulated-client.md). Esse estado é separado do protocolo de `agent.ping`; a presença demonstrativa não é alimentada pelo polling do Agent real. PCs reais mantêm `status: "unverified"` e `lastSeen: null`.

## Endpoints

JSON validado, `Cache-Control: no-store` nas respostas de sucesso, UUIDs e datas UTC ISO 8601. Os endpoints de Agent derivam o dispositivo da identidade, sem aceitar seleção de outro computador.

| Endpoint | Autorização e resposta |
| --- | --- |
| `POST /devices/:deviceId/commands` | JWT; corpo `{ requestId, type, version, parameters }`; vínculo e identidade ativos. 201 na criação, 200 na repetição equivalente, com a representação do comando. Intenção válida incompatível com a chave existente: 409; operação/parâmetros inválidos: 400. |
| `GET /devices/:deviceId/commands/:id` | JWT; somente responsável com o vínculo original ainda ativo. Retorna a representação do comando; recurso alheio/inacessível: 404. |
| `GET /agent/commands` | Bearer do Agent; `{ protocolVersion: 1, serverTime, commands: [] }`, com no máximo o pendente válido mais antigo por `createdAt, id`. Ausência de vínculo retorna lista vazia. Não reserva. |
| `POST /agent/commands/:id/claim` | Bearer; corpo `{ claimId }`. 200 com `{ protocolVersion: 1, serverTime, command }`. Mesmo claim/identidade retorna estado atual e prazo original; outra reserva ou outro comando ainda `running` dentro do prazo: 409. |
| `PUT /agent/commands/:id/result` | Bearer; corpo abaixo. Retorna 200 com `{ id, status, completedAt }`, estável na repetição equivalente. Não aceita resultado sem claim correspondente. |

A representação do comando contém `id`, `associationId`, `requestId`, `type`, `version`, `parameters`, `status`, `createdAt`, `expiresAt`, `executionTimeoutSeconds: 30`, `claimId`, `executionDeadlineAt`, `result`, `error` e `completedAt`. Campos ainda não definidos são `null`. Não contém credenciais, hash de autenticação, nome ou email do responsável.

Criação:

```json
{
  "requestId": "26ed5ff2-cd21-4f75-a51d-fd5ba9a8a10b",
  "type": "agent.ping",
  "version": 1,
  "parameters": {}
}
```

Resultado:

```json
{
  "claimId": "da32dc6b-333b-40da-93db-2e743d789c26",
  "status": "succeeded",
  "result": { "reachable": true },
  "error": null
}
```

Falha usa `status: "failed"`, `result: null` e `error: { "code": "EXECUTION_TIMEOUT" }`. Códigos aceitos: `UNSUPPORTED_OPERATION`, `INVALID_PARAMETERS`, `EXECUTION_TIMEOUT`, `LOCAL_UNAVAILABLE`. O Agent atual recusa contrato/operação desconhecida antes de reservar e gera somente ping ou falha de orçamento local; não envia traceback, stderr ou dados Linux. Sucesso exige `error: null`; falha exige exatamente um código permitido.

Erros: 400 contrato inválido; 401 autenticação/identidade revogada; 404 recurso alheio/inexistente; 409 conflito; 410 vínculo original revogado, identidade indisponível na criação ou comando vencido/cancelado antes da reserva; 413 corpo excessivo; 503 indisponibilidade operacional. Erros não expõem exceções ou corpos do backend na CLI.

## Contrato proposto de relatórios do Agent

Esta seção define a próxima extensão do protocolo. Ela é uma especificação; os endpoints abaixo ainda não existem no backend e não devem ser confundidos com o client simulado. O objetivo é permitir que o Agent real envie um retrato do computador e que o responsável consulte dados cuja origem e horário de coleta sejam conhecidos.

### Endpoints usados pelo Agent

O Agent usa a credencial individual provisionada para o computador e nunca escolhe outro `deviceId` no corpo da requisição:

| Endpoint | Finalidade | Estado |
| --- | --- | --- |
| `GET /agent/associations` | Confirma a identidade e consulta o vínculo ativo do próprio computador. | Implementado |
| `GET /agent/commands` | Busca no máximo um comando parental pendente. | Implementado para `agent.ping` |
| `POST /agent/commands/:id/claim` | Reserva um comando antes da execução local. | Implementado para `agent.ping` |
| `PUT /agent/commands/:id/result` | Informa o resultado de uma operação reservada. | Implementado para `agent.ping` |
| `PUT /agent/reports` | Envia inventário e pedidos observados pelo computador em um relatório. | Implementado |

O endpoint de relatório deve derivar o dispositivo da identidade autenticada. Não aceita `deviceId`, `guardianId` ou associação escolhida pelo cliente. A resposta de sucesso deve incluir `reportId`, `receivedAt`, `applicationsReportedAt` e `installationRequestsReportedAt`.

### Autenticação

O Agent envia `Authorization: Bearer <credential>` por HTTPS. A credencial é aleatória, exclusiva do computador e provisionada administrativamente. O backend armazena somente seu hash SHA-256 e associa a identidade ao dispositivo. O guard deve verificar, na mesma operação de gravação, que:

1. a identidade existe e não foi revogada;
2. o vínculo original existe, está ativo e pertence ao dispositivo autenticado;
3. o dispositivo ainda pode receber relatórios.

Falha de autenticação ou revogação retorna `401`. O relatório não usa JWT do responsável e não recebe credencial administrativa do Linux.

### Relatório enviado

O corpo de `PUT /agent/reports` é JSON, limitado a 16 KiB inicialmente:

```json
{
  "protocolVersion": 1,
  "reportId": "3c8d8a4c-9a07-4c64-98c8-8ea70f1b1b8c",
  "collectedAt": "2026-11-04T20:00:00.000Z",
  "applications": [
    {
      "sourceId": "org.mozilla.firefox",
      "name": "Firefox",
      "category": "browser",
      "allowed": true
    }
  ],
  "installationRequests": [
    {
      "sourceId": "a8e47b1a-8fcf-46da-85ad-69ff6a604d22",
      "applicationName": "Firefox",
      "requesterName": "Conta gerenciada",
      "requestedAt": "2026-11-04T19:58:00.000Z",
      "ageRating": "L"
    }
  ]
}
```

`reportId` é um UUID v4 criado pelo Agent e identifica uma coleta. `collectedAt` é o horário UTC informado pelo computador; `receivedAt` é sempre definido pelo servidor e não é confiável para substituir o horário da coleta. `sourceId` é estável para o mesmo aplicativo ou pedido no computador e é obrigatório para reconciliar uma repetição sem duplicar linhas.

O relatório representa um retrato completo, não um conjunto de eventos. Portanto, a lista `applications` substitui o inventário anterior e a lista `installationRequests` reconcilia os pedidos observados. O Agent não envia decisões do responsável como se fossem observações locais; estados `APPROVED` e `DENIED` continuam sendo decisões do backend e só retornam ao computador por comandos próprios.

### Resposta e erros

Uma gravação nova retorna `201`:

```json
{
  "reportId": "3c8d8a4c-9a07-4c64-98c8-8ea70f1b1b8c",
  "accepted": true,
  "receivedAt": "2026-11-04T20:00:02.000Z",
  "applicationsReportedAt": "2026-11-04T20:00:02.000Z",
  "installationRequestsReportedAt": "2026-11-04T20:00:02.000Z"
}
```

Uma repetição equivalente do mesmo `reportId` retorna `200` com o mesmo recibo lógico e não reaplica o retrato. O servidor pode atualizar somente `receivedAt` no transporte, mas não deve mudar o conteúdo aceito nem os marcadores de coleta.

| Status | Significado |
| --- | --- |
| `400` | JSON, UUID, data, enumeração ou campo obrigatório inválido. |
| `401` | Bearer ausente, credencial inválida ou identidade revogada. |
| `409` | Mesmo `reportId` já foi aceito com conteúdo diferente. |
| `413` | Relatório excede o limite de tamanho. |
| `422` | Conteúdo coerente, mas impossível de reconciliar, por exemplo `sourceId` duplicado na mesma lista. |
| `503` | Falha de banco ou indisponibilidade operacional; o Agent deve conservar o relatório local. |

As respostas de erro possuem somente um código estável, por exemplo `{ "error": { "code": "REPORT_TOO_LARGE" } }`. Não retornam stack trace, senha, credencial, caminho local ou dados de outro dispositivo.

### Estados e confirmação

O relatório possui os estados efetivos `accepted`, `duplicate`, `rejected` e `unavailable` no diário do Agent. O backend persiste somente relatórios aceitos e conflitos auditáveis; `unavailable` é uma condição de transporte, não uma confirmação de falha do computador.

Uma operação parental só é **confirmada** quando o Agent recebe um comando válido, reserva-o, executa a ação local permitida e consulta novamente o estado do sistema para verificar o efeito esperado. O recebimento do comando, o `claim`, uma resposta HTTP 200 ou a gravação de uma configuração desejada não significam aplicação. O resultado deve ser `succeeded` somente com essa verificação; caso contrário deve ser `failed` com código tipado ou `unknown` quando não for possível distinguir execução de perda de comunicação.

### Repetição e atomicidade

O Agent grava `reportId`, conteúdo e estado pendente no diário local antes do envio. Após timeout, reinício ou resposta perdida, repete exatamente o mesmo relatório e não gera outro `reportId`. O backend deve aceitar a repetição equivalente sem duplicar aplicações, pedidos ou marcadores.

No backend, autenticação da identidade, reconciliação das duas listas, atualização de `applicationsReportedAt` e `installationRequestsReportedAt` e registro do recibo devem ocorrer em uma única transação. Se qualquer etapa falhar, todas as alterações do relatório são desfeitas e os marcadores anteriores permanecem intactos. Assim, o mobile nunca interpreta um inventário novo com pedidos antigos, ou o contrário, como uma coleta confirmada.

Os identificadores persistentes e a tabela de recibos são preparados pela migration `20261104200000_agent_report_idempotency`; a ingestão HTTP está implementada no backend e o Agent envia relatórios usando `--report-file` ou coleta aplicativos Linux com `--collect-report-file`. A coleta de pedidos de instalação ainda depende de uma fonte Linux validada. O `SimulationState` e seus endpoints continuam separados: uma confirmação do client simulado não comprova ingestão pelo Agent nem aplicação no GNOME.

## Persistência e estados

A migration `20261026035355_agent_ping_commands` cria somente `AgentCommand`, índices únicos/de fila e FKs restritivas para dispositivo, associação original e identidade da reserva. Não modifica registros existentes nem remove a CHECK de vínculo ativo. Campos: identificação/escopo, intenção, estado, criação/validade, claim/identidade/horários e resultado/erro/conclusão. Não há tabela de tentativas ou worker de expiração.

| Estado | Significado |
| --- | --- |
| `pending` | Persistido e ainda não reservado. |
| `running` | Reserva confirmada; não comprova que a execução começou. |
| `succeeded` | Resultado de ping validado e persistido. |
| `failed` | Falha tipada confirmada e persistida. |
| `expired` | Validade terminou antes do claim; não entregar. |
| `cancelled` | Revogação enquanto pendente. |
| `unknown` | Reserva sem resultado confiável após orçamento ou revogação. |

`expired` por validade e `unknown` por timeout são calculados na leitura pelo relógio do servidor, sem cron nem necessidade de gravar esses estados derivados. A fila filtra os expirados e nunca entrega comandos já reservados. Revogação grava `cancelled` para `pending` e `unknown` para `running`, na mesma transação; resultados terminais permanecem imutáveis.

Somente uma reserva ainda dentro do prazo pode estar em execução por dispositivo. Depois de timeout, um novo ping explícito pode avançar; o antigo não volta à fila. `expiresAt` não impede reenviar um resultado já produzido. Timeout de rede nunca é convertido em falha de execução confirmada.

## Agent e diário local

`python3 -m lux_agent poll --state-dir /diretorio/privado` (executado de `lux-agent/`) ativa o processamento no ciclo existente. Sem a opção, permanece o polling somente de vínculos. A cada ciclo, consulta associações, recupera claims/resultados locais pendentes, consulta no máximo um comando e processa somente ping validado. Não importa nem chama malcontent.

O diário SQLite usa a biblioteca padrão, `synchronous=FULL`, journal de rollback e commit antes de cada efeito externo. Diretório `0700`, arquivos regulares privados `0600`, pertencentes ao executor, sem symlinks/hardlinks. `flock` impede duas instâncias no mesmo diretório. O diário é vinculado por hash à origem e à credencial, recusando reutilização com outro backend/identidade. Seu diretório deve ficar em armazenamento persistente privado com diretórios ancestrais confiáveis; os exemplos em `/tmp` são exclusivos para testes descartáveis.

1. Salvar `commandId`, `claimId` e `claim_pending` antes do POST. Resposta perdida/reinício: repetir esse UUID.
2. Confirmar `running`, conferir orçamento com `serverTime` e tempo monotônico de ida/volta; salvar `started` antes de executar.
3. Salvar resultado local antes do PUT; marcar `acknowledged` somente após recibo compatível.
4. Reinício com resultado salvo: reenviar o PUT, sem executar. Reinício com `started` sem resultado: preservar registro e não repetir; o backend mostrará `unknown` ao vencer o prazo.
5. Claim devolvido com estado terminal/desconhecido ou sem orçamento não executa; registro fica abandonado/incerto. Falha de diário impede início da operação.

Não se promete execução exatamente uma vez: MySQL, disco local e processamento não compartilham transação. A janela entre `started` e resultado salvo é explicitamente incerta. Não remova, compartilhe ou recrie o diário para contornar conflitos. Exclusão/rotação e retenção ainda não têm automação.

## Rede e recuperação

Preservados: credencial privada, HTTPS e hostname verificados, CA explícita opcional, proxies de ambiente ignorados, redirects proibidos e HTTP apenas em loopback com opção explícita. Cada requisição de comandos tem limite de resposta de 16 KiB e prazo total controlado por temporizador Linux; o timeout da CLI não representa o tempo máximo de um ciclo com várias requisições. O prazo de execução de ping é independente do timeout de rede.

Cadência/backoff/jitter/`Retry-After` e sinais são os do polling existente. 429, conexão/timeout e 5xx transitórios preservam o diário e repetem no próximo ciclo; 501/505 são permanentes. 401 e TLS encerram. 409 encerra com diagnóstico e preserva o mesmo identificador para investigação; não troca claim ou executa outra vez. 404/410 de claim/resultado marcam a entrada como abandonada e permitem seguir consultando. SIGINT/SIGTERM não apagam pendências.

## Validação e limites

[Testes MySQL](../backend/test/commands.mysql-test.mjs): vínculo/identidade, fixture legada, isolamento, criação/claim/resultado idempotentes, concorrência, expiração após espera por lock, revogação administrativa/do responsável e resultado tardio. [Testes Python](../lux-agent/tests/test_commands.py): diário, exclusão, permissões, corrupção, troca de identidade/origem, respostas perdidas, reinício ambíguo e contratos não suportados. [Evidência real no Lux](agent-ping-validation.md#evidência--2026-10-26).

Ficam pendentes: UI mobile de comandos, usuário/instalação do serviço, pareamento/autorização local, quotas/retenção, presença, hospedagem HTTPS definitiva, primeira leitura remota e reconciliação antes de escritas parentais. `status: "unverified"`/`lastSeen: null` dos dispositivos permanecem. Sucesso de ping não comprova política aplicada ou identidade física do equipamento.

Referências: [Prisma 7: transações](https://www.prisma.io/docs/orm/v7/prisma-client/queries/transactions), [Prisma 7: migrations](https://www.prisma.io/docs/orm/v7/prisma-migrate/workflows/development-and-production), [SQLite no Python](https://docs.python.org/3.12/library/sqlite3.html) e [flock](https://docs.python.org/3.12/library/fcntl.html#fcntl.flock).
