# Protocolo de comandos do Lux Agent — versão 1

Implementado para `agent.ping` e para os [comandos parentais](#comandos-parentais-contrato), entre NestJS, MySQL e Agent Python no Lux por HTTPS. O mobile não cria comandos: edita as configurações do computador e mostra o estado da política. O que já foi validado no Lux está em [Validação](validation.md).

## Escopo e revisão da proposta

REST/HTTPS de saída e persistência no MySQL existente, sem broker, WebSocket, Redis ou outra autenticação. Reutiliza JWT de responsável, `AgentAuthGuard`, `AgentIdentity`, `DeviceAssociation` e o lock de `Device` usado no pareamento. `lux_agent.parental` permanece independente do transporte remoto.

A intenção usada na validação com o Lux real é `{ "type": "agent.ping", "version": 1, "parameters": {} }`; os tipos parentais estão em [Comandos parentais](#comandos-parentais-contrato). Seu sucesso é `{ "reachable": true }`: confirma processamento e retorno, sem consultar hostname, contas, GNOME ou políticas. Operações/versões desconhecidas, parâmetros arbitrários, shell, scripts e URLs de retorno são recusados.

Decisões resolvidas antes da implementação:

| Tema | Contrato implementado |
| --- | --- |
| `requestId` | UUID v4, normalizado em minúsculas, único por `(associationId, requestId)`. Repetição equivalente retorna o mesmo comando; UUID novo é intenção nova. Outro vínculo pode usar o mesmo UUID, sem recuperar o histórico anterior. O `set` gerado pelo backend usa um UUID derivado no formato v5; por isso o Agent aceita qualquer UUID canônico em `requestId` (`id`, `associationId` e `claimId` continuam v4). |
| Vínculo | Exige `DeviceAssociation` original com `revokedAt: null`, `activeDeviceId` igual ao dispositivo e responsável compatível com `Device.guardianId`. O campo do dispositivo sozinho não autoriza. |
| Revogação | Criação/claim/resultado e revogações serializam pela mesma linha de `Device`. A identidade é revalidada depois do lock; o guard não é a única verificação. Transações usam `READ COMMITTED` com lock exclusivo da linha do dispositivo, evitando gap locks entre computadores diferentes. |
| `claimId` | UUID v4, único por `(deviceId, claimId)`, vinculado à identidade autenticada e a uma única reserva. Não é credencial nem lease renovável. |
| Prazos | Cinco minutos para reservar; 30 segundos a partir do primeiro claim. Valores definidos pelo servidor, sem parâmetros de prazo enviados pelo cliente. O orçamento de 30 s é constante, não uma coluna redundante. |
| Incerteza | Timeout após reserva produz estado efetivo `unknown`, sem reentrega. Resultado tardio da mesma reserva é aceito somente com identidade e vínculo original ainda ativos. |
| Resultado | Definitivo e tipado. PUT equivalente retorna o mesmo recibo; status/erro diferentes retornam 409. O único resultado de sucesso aceito é `reachable: true`. |
| Limites | Servidor de produção/desenvolvimento inicializado por `main.ts`: corpos JSON até 16 KiB. Respostas de comandos são limitadas pelo contrato fixo e polling de no máximo um item; cliente recusa mais de 16 KiB. |

A reserva não torna a execução e a revogação uma transação distribuída. Revogar antes do claim impede a reserva. Depois do claim, não é possível garantir interrupção de execução local já autorizada/iniciada: a transação marca reservas sem resultado como `unknown` e bloqueia novos claims/resultados daquele vínculo. Nenhum resultado passa para novo responsável, inclusive se o mesmo responsável parear novamente.

O schema também inclui inventário, pedidos de instalação e `SimulationState` para o [client demonstrativo](simulated-client.md). Esse estado é separado do protocolo de `agent.ping`; a presença demonstrativa não é alimentada pelo polling do Agent real. A presença do Agent real vem de qualquer requisição autenticada (associações, comandos, relatórios), sem endpoint de heartbeat ([backend](backend.md#presença-do-agent-real)).

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

Falha usa `status: "failed"`, `result: null` e `error: { "code": "EXECUTION_TIMEOUT" }`. Códigos aceitos: `UNSUPPORTED_OPERATION`, `INVALID_PARAMETERS`, `EXECUTION_TIMEOUT`, `LOCAL_UNAVAILABLE`. O Agent recusa sem reservar um envelope inválido (UUIDs, datas, prazo, `type` não texto, `version` não inteiro, `parameters` não objeto), o que encerra o polling. Um envelope válido com operação/versão desconhecida é reservado e respondido com `UNSUPPORTED_OPERATION`; parâmetros fora do contrato da operação, com `INVALID_PARAMETERS`. Nos dois casos o polling continua e nada é executado. Não envia traceback, stderr ou dados Linux. Sucesso exige `error: null`; falha exige exatamente um código permitido.

Erros: 400 contrato inválido; 401 autenticação/identidade revogada; 404 recurso alheio/inexistente; 409 conflito; 410 vínculo original revogado, identidade indisponível na criação ou comando vencido/cancelado antes da reserva; 413 corpo excessivo; 503 indisponibilidade operacional. Erros não expõem exceções ou corpos do backend na CLI.

## Comandos parentais (contrato)

Estado: contrato e backend implementados e cobertos por testes unitários e por um teste MySQL com um Agent simulado (`backend/test/parental-commands.mysql-test.mjs`). O Lux Agent executa `set` ([execução no Agent](#execução-no-agent)), coberto por testes Python com malcontent substituído e validado no Lux; `read` não é implementado e recebe `UNSUPPORTED_OPERATION`. Enquanto `ENABLE_PARENTAL_COMMANDS` não for `true` (padrão), o backend não gera `set` a partir das configurações e recusa `read` com `501`. Reutilizam o ciclo criação, polling, claim e resultado do ping, sem novos endpoints de Agent.

A escrita só cobre o filtro de aplicativos, a única operação com prova técnica de escrita no Lux ([provas](lux-integration.md#provas-que-sustentam-as-decisões)). A conta gerenciada é definida localmente pelo Agent, nunca pelo backend ou pelo mobile; contas administrativas são recusadas localmente.

| `type` (versão 1) | `parameters` | Resultado de sucesso |
| --- | --- | --- |
| `parental.app_filter.set` | `{ "blockedApplications": ["desktop:firefox-esr.desktop"], "blockInstallation": false }` | O filtro **observado após reler o sistema**: `{ blockedApplications, blockInstallation }`. |
| `parental.app_filter.read` | `{}` | O filtro observado, no mesmo formato. |

`blockedApplications` aceita até 200 identificadores únicos de 1 a 191 caracteres (`[A-Za-z0-9][A-Za-z0-9._+:-]*`, o mesmo `sourceId` dos relatórios, como `desktop:gimp.desktop`), sem `/`, espaço, shell ou URLs. O Agent converte cada `sourceId` no caminho do executável e, ao reler, converte de volta. O backend ordena e normaliza a lista. `blockInstallation: true` corresponde a `AllowUserInstallation = AllowSystemInstallation = false` no malcontent.

### Origem dos comandos

`POST /devices/:id/commands` aceita só `agent.ping` e `parental.app_filter.read`; `set` retorna 400. O `set` é criado pelo backend quando o responsável altera as configurações de um **computador real** (`PATCH /simulation/devices/:id`, com `{ revision, settings }`), na mesma transação da nova revision:

- `ParentalPolicy.revision` recebe a revision das configurações; o comando guarda o mesmo valor em `policyRevision` e usa um `requestId` derivado de (vínculo, revision, tentativa).
- `blockedApplications` = `sourceId` dos apps reportados com `applicationRules[id] === false` + navegadores com `blockBrowsers && !allowedBrowsers[chave]`, apenas os que constam do último relatório do computador (o Agent recusa `.desktop` inexistente). Apps com `blockable=false` no último relatório ficam de fora, inclusive navegadores, mesmo que uma regra antiga os bloqueie. Cada app bloqueado puxa todos os apps com o mesmo `executable` (grupo), porque o malcontent bloqueia o executável. Tabela em `backend/src/simulation/real-app-filter.ts`: `firefox` → `firefox-esr`/`firefox`, `chromium` → `chromium`, `brave` → `brave-browser`, `gnome-web` → `org.gnome.Epiphany`.
- `ageRating` e `installationDecisions` não entram no filtro. Toda revision gera um comando, mesmo que o filtro não mude.
- Se um app bloqueado tiver `sourceId` fora do formato aceito, a alteração inteira retorna 400.
- **Grupos e apps não bloqueáveis.** `applicationRules` continua por app, mas uma regra enviada vale para o grupo inteiro: o backend grava o mesmo valor em todos os apps com o mesmo `executable`, e a resposta traz essas regras a mais. Retornam 400, sem salvar nada e com mensagem que diz isso: bloquear app com `blockable=false` e regras diferentes para apps do mesmo grupo no mesmo `PATCH`. Liberar app não bloqueável é aceito (limpa regra antiga). Inventário sem esses campos (Agent anterior ao LUX-16, client simulado) vale como bloqueável e sem grupo.
- Computador simulado nunca gera comando. Com a flag desligada, a revision é salva sem comando, e o próximo `PATCH` após ligá-la envia o filtro completo.
- **Reemissão.** Com a flag ligada, cada `GET /agent/commands` verifica a revision atual ainda não aplicada e sem erro: se nenhum `set` do vínculo estiver vivo (`pending` no prazo ou `running` no orçamento) e o da revision atual tiver ficado `expired` (5 min sem reserva) ou `unknown` (reserva sem resultado em 30 s), o backend cria outro `set` com o mesmo filtro e a mesma revision, com novo `requestId`, e o entrega na mesma consulta. São no máximo 3 `set` por revision; esgotados, a política fica `failed` com `EXECUTION_TIMEOUT`. Revision que nunca gerou `set` (flag desligada no `PATCH`) não é reemitida. Sem vínculo ativo não há reemissão.

O backend só aceita `succeeded` em `set` se o filtro observado for idêntico ao pedido (400 caso contrário). Quando a releitura divergir, o Agent informa `failed` com `VERIFICATION_FAILED`. Códigos de falha dos comandos parentais: os quatro do ping mais `PERMISSION_DENIED`, `ACCOUNT_NOT_MANAGED`, `VERIFICATION_FAILED` e `POLICY_UNAVAILABLE`; o ping continua aceitando só os quatro originais. Uma repetição do PUT com resultado diferente do definitivo retorna 409.

### Reconciliação

Cada vínculo tem no máximo uma política desejada (`ParentalPolicy`), versionada por `revision`. Gerar um `set` grava a política desejada com a revision das configurações, guarda essa revisão no comando (`policyRevision`) e cancela `set` ainda `pending` do mesmo vínculo; vence a intenção mais recente. Um `set` já reservado (`running`) não é interrompido.

| Estado (`GET /devices/:deviceId/parental-policy`) | Significado |
| --- | --- |
| `pending` | A revisão atual ainda não foi confirmada pelo Agent. Inclui comando aguardando, em execução ou com resultado incerto (`unknown`), que nunca marca como aplicado. |
| `applied` | O Agent confirmou, com releitura, a revisão atual. |
| `failed` | A revisão atual recebeu uma falha tipada (`error.code`); nova intenção volta a `pending`. |
| `drifted` | A revisão atual foi aplicada, mas uma leitura posterior observou outro estado. |

Um sucesso de revisão antiga avança `appliedRevision` até essa revisão, mas o estado continua `pending` enquanto a atual não for confirmada. Todo sucesso cancela os `set` ainda `pending` do vínculo com revision até a confirmada; assim, o resultado atrasado de um `unknown` já reemitido evita a reexecução. `read` só atualiza o estado observado (`observedAppFilter`, `observedAt`); não altera a política desejada. A resposta traz `revision`, `appliedRevision`, `appFilter`, `observedAppFilter`, `appliedAt`, `observedAt` e `error` (`{ code, at }`); sem política ou vínculo ativo do responsável, 404. A revogação do vínculo cancela/marca incertos os comandos como no ping, e um novo vínculo não herda a política. A migration `20261116120000_parental_commands` cria `ParentalPolicy` e `AgentCommand.policyRevision`; `20261117120000_parental_policy_error_time` acrescenta `ParentalPolicy.lastErrorAt`.

Para computador real, `GET`/`PATCH /simulation/devices/:id` mantêm o formato do simulado, mas `appliedRevision`/`appliedAt` vêm de `ParentalPolicy` (`null` sem política) e há dois campos a mais: `error` (`{ code, at }` da revision atual, senão `null`) e `enforcement` (`enabled`/`disabled`, conforme `ENABLE_PARENTAL_COMMANDS`). Com `disabled`, nada será aplicado no computador. `drifted` só aparece em `/parental-policy`.

### Execução no Agent

`parental.app_filter.set` é executado por `lux_agent.parental.apply_app_filter`, no mesmo ciclo de claim/diário do ping:

1. A conta vem de `poll --managed-user` (a unit repassa `LUX_AGENT_MANAGED_USER` de `/etc/lux-agent/agent.env`), nunca do comando. Ausente, inexistente, root ou membro do grupo `sudo` → `ACCOUNT_NOT_MANAGED`, sem tocar no malcontent.
2. Cada `sourceId` vira o caminho do executável (`.desktop` em `/usr/local/share` e `/usr/share`, `Exec` resolvido no `PATH` da sessão). App ausente, sem `Exec` resolvível ou aberto por lançador genérico (`env`, `sh`, `bash`, `xdg-open`, `flatpak`, `python3` etc., lista em `parental.GENERIC_LAUNCHERS`) → `POLICY_UNAVAILABLE`, sem gravar: o malcontent bloqueia pelo executável, e bloquear o lançador afetaria todos os apps que o usam. Pela mesma razão, apps que compartilham o executável são bloqueados juntos (no Lux de referência, os seis atalhos do LibreOffice usam `/usr/bin/libreoffice`). O relatório já informa esses casos (`blockable`, `executable`) e o backend não os pede; a recusa no Agent é a última barreira, para inventário desatualizado.
3. Grava com `Malcontent.Manager.set_app_filter` (lista de bloqueio + `AllowUser/SystemInstallation = !blockInstallation`) e relê. O filtro gravado substitui o anterior inteiro, inclusive o filtro OARS, que fica vazio; aplicar classificação etária real exigirá mesclar os dois.
4. Se os caminhos e as flags relidos forem idênticos aos desejados, devolve `succeeded` com os `sourceId` pedidos (o conjunto de caminhos relido corresponde exatamente a eles). Releitura divergente ou em lista de permissão → `VERIFICATION_FAILED`.
5. Erros do malcontent: `PERMISSION_DENIED` → `PERMISSION_DENIED`; `INVALID_USER` → `ACCOUNT_NOT_MANAGED`; bindings GI ausentes, D-Bus ou outro erro → `LOCAL_UNAVAILABLE`.

Gravar o mesmo filtro de novo é inofensivo, então a reemissão (novo `requestId`) é simplesmente reaplicada. Queda entre `started` e o resultado salvo não reexecuta: o backend marca `unknown` e reemite. Com o vínculo revogado a fila fica vazia: o Agent mantém o filtro aplicado e não limpa nada; limpar exige `uninstall.sh --reset-policies` ou `malcontent-client` pelo administrador.

Pendência: verificar no Lux o efeito do bloqueio de instalação (exige flatpak na VM; ver [provas](lux-integration.md#provas-que-sustentam-as-decisões)).

## Contrato de relatórios do Agent

Esta seção define a extensão de relatórios, implementada no backend (`PUT /agent/reports`) e no Agent. Não deve ser confundida com o client simulado. O objetivo é permitir que o Agent real envie um retrato do computador e que o responsável consulte dados cuja origem e horário de coleta sejam conhecidos.

### Endpoints usados pelo Agent

O Agent usa a credencial individual provisionada para o computador e nunca escolhe outro `deviceId` no corpo da requisição:

| Endpoint | Finalidade | Estado |
| --- | --- | --- |
| `GET /agent/associations` | Confirma a identidade e consulta o vínculo ativo do próprio computador. | Implementado |
| `GET /agent/commands` | Busca no máximo um comando pendente. | Implementado |
| `POST /agent/commands/:id/claim` | Reserva um comando antes da execução local. | Implementado |
| `PUT /agent/commands/:id/result` | Informa o resultado de uma operação reservada. | Implementado |
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
      "allowed": true,
      "blockable": true,
      "executable": "/usr/bin/firefox"
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

O relatório representa um retrato completo de aplicativos, não um conjunto de eventos: a lista `applications` substitui o inventário anterior. A lista `installationRequests` só insere ou atualiza os pedidos enviados; pedidos ausentes não são removidos, porque outros fluxos (como o [client simulado](simulated-client.md)) também criam pedidos `PENDING` no mesmo dispositivo. O Agent real envia lista vazia enquanto não houver fonte Linux validada; mesmo assim, o backend atualiza `installationRequestsReportedAt`. O Agent não envia decisões do responsável como se fossem observações locais; estados `APPROVED` e `DENIED` continuam sendo decisões do backend e só retornam ao computador por comandos próprios.

`blockable` e `executable` (LUX-16) vêm juntos ou não vêm. `executable` é o caminho absoluto resolvido a partir do `Exec` do `.desktop`, no mesmo `PATH` da sessão usado na execução (`/` inicial, até 191 code points), ou `null` quando `blockable=false`: `Exec` ausente ou não resolvido, lançador genérico ou caminho longo demais. Apps com o mesmo `executable` formam um grupo bloqueado junto. Combinação inconsistente → 422; `executable` relativo → 400. Sem os campos (Agent anterior), o app é gravado como bloqueável e sem grupo. O backend que não conhece os campos recusa o relatório com 400 (`forbidNonWhitelisted`): atualize o backend antes do Agent.

Textos são medidos em code points Unicode, como o `VARCHAR` utf8mb4 do MySQL e o `len()` do Python: `sourceId` 1–191, `name`/`applicationName` 1–200, `category`/`requesterName` 1–100 e `ageRating` 0–20. O limite de 16 KiB vale para o corpo enviado, que o Agent serializa como JSON compacto em UTF-8. Ao coletar mais de 200 aplicativos ou passar de 16 KiB, o Agent ordena por `sourceId`, envia o maior prefixo que cabe nos dois limites e registra um aviso no stderr. Nomes acima de 200 code points são truncados e `.desktop` com `sourceId` acima de 191 é ignorado.

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

O relatório possui os estados efetivos `accepted`, `duplicate`, `rejected` e `unavailable` no diário do Agent. No diário, `pending` vira `acknowledged` com o recibo, ou `rejected` com `400`, `409`, `413` ou `422`. Um relatório rejeitado não é reenviado, nem após reinício, e o polling continua com um aviso no stderr. O Agent só envia quando a consulta de vínculos do ciclo traz um vínculo ativo, porque o backend responde `401` a computador sem vínculo; sem vínculo, o relatório fica pendente. `401`, TLS e `501`/`505` continuam encerrando; `429` e os demais `5xx` mantêm o relatório `pending` para o próximo ciclo. O backend persiste somente relatórios aceitos e conflitos auditáveis; `unavailable` é uma condição de transporte, não uma confirmação de falha do computador.

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

`python3 -m lux_agent poll --state-dir /diretorio/privado` (executado de `lux-agent/`) ativa o processamento no ciclo existente. Sem a opção, permanece o polling somente de vínculos. A cada ciclo, consulta associações, recupera claims/resultados locais pendentes, consulta no máximo um comando e processa `agent.ping` ou `parental.app_filter.set` (com `--managed-user`); malcontent só é carregado ao executar um `set`.

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

[Testes MySQL](../backend/test/commands.mysql-test.mjs): vínculo/identidade, fixture legada, isolamento, criação/claim/resultado idempotentes, concorrência, expiração após espera por lock, revogação administrativa/do responsável e resultado tardio. [Testes Python](../lux-agent/tests/test_commands.py): diário, exclusão, permissões, corrupção, troca de identidade/origem, respostas perdidas, reinício ambíguo e contratos não suportados.

Ficam pendentes: quotas/retenção do diário, hospedagem HTTPS definitiva e `parental.app_filter.read` no Agent. Sucesso de ping não comprova política aplicada ou identidade física do equipamento.

Referências: [Prisma 7: transações](https://www.prisma.io/docs/orm/v7/prisma-client/queries/transactions), [Prisma 7: migrations](https://www.prisma.io/docs/orm/v7/prisma-migrate/workflows/development-and-production), [SQLite no Python](https://docs.python.org/3.12/library/sqlite3.html) e [flock](https://docs.python.org/3.12/library/fcntl.html#fcntl.flock).
