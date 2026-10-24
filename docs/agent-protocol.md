# Proposta de polling e comandos do Lux Agent

Status: proposta de comandos para revisão, não implementada nem aprovada. Os endpoints e o modelo de comandos abaixo não existem em execução. O polling somente de leitura de associações foi implementado separadamente; consultar o [README do Agent](../lux-agent/README.md#polling-somente-de-leitura). A etapa 5 permanece parcial; o estado implementado fica em [Arquitetura](architecture.md#etapas-de-implementação).

## Contratos existentes e fronteiras

| Recurso existente | Reuso e limite |
| --- | --- |
| `AgentIdentity` e `AgentAuthGuard` | Credencial Bearer individual, hash SHA-256, `deviceId` derivado da identidade, recusa de revogados e de demonstração fora de desenvolvimento/teste. Falha de banco na autenticação retorna 503. |
| JWT de responsável | Identifica o solicitante mobile; não autentica o Agent. |
| `DeviceAssociation` | Histórico e no máximo um vínculo ativo por computador; a solicitação deve pertencer ao vínculo específico que a autorizou. |
| `Device.guardianId` | Escopo da listagem atual. Fixtures legadas podem ter responsável sem associação ativa: esse campo sozinho não deve autorizar novos comandos. |
| `PairingSession` | Confiança no vínculo via token temporário. Não reutilizar tokens ou sessões como comandos. |
| `GET /agent/associations` | Histórico do próprio computador; pode observar vínculos periodicamente, mas não fornece solicitações nem registra presença. |
| `POST /agent/pairing-sessions`, DELETE de associações | Pareamento e revogação; não constituem transporte de comandos. |
| `check_backend.py` / `poll_associations.py` | Diagnóstico único e polling de vínculos; compartilham proteção de arquivo, URL/TLS, redirects bloqueados, registros validados e erros classificados com `Retry-After`. O diagnóstico mantém retorno por contagem e códigos existentes; polling distingue TLS permanente de conexão transitória. |
| `read_policies.py` | Leitura local, independente do HTTP, para login explícito. Seu JSON não é contrato de resultado remoto. |

O schema tem somente `Guardian`, `Device`, `AgentIdentity`, `PairingSession` e `DeviceAssociation`. Há polling somente de leitura dos vínculos; não há fila, comandos, resultados, capacidades anunciadas, executor remoto, diário local ou presença persistida. A listagem mantém `status: "unverified"` e `lastSeen: null`.

A revogação atual de vínculo invalida sessões de pareamento e retira `Device.guardianId`, mas não revoga a identidade do Agent. A revogação administrativa da identidade invalida também sessões/vínculo. Nenhum desses caminhos trata comandos, pois esse modelo ainda não existe. Operações de pareamento usam transação e lock da linha de `Device`; esse padrão pode ser reutilizado sem manter lock durante HTTP ou execução Linux.

## Escopo mínimo proposto

REST/HTTPS de saída, consultas curtas periódicas e MySQL/Prisma como persistência. Sem broker, WebSocket, Redis, segundo sistema de autenticação ou acesso de entrada no Lux.

Para validar futuramente o transporte completo, aceitar inicialmente apenas `agent.ping`, versão 1, parâmetros `{}` e resultado `{ "reachable": true }`. Essa operação diagnóstica não consulta contas nem altera o GNOME. Ela comprova processamento e retorno pelo Agent; não equivale a uma política aplicada. Não é executada nesta iteração.

`policies.read` é candidata posterior, não operação já autorizada: depende de definir a conta gerenciada local, permissões de leitura e um resultado tipado. Escritas parentais ficam excluídas desta versão. Não aceitar shell, scripts, caminhos executáveis, nomes de funções livres, URLs de retorno ou seleção arbitrária de usuários. Operações/versões desconhecidas são recusadas, sem fallback.

## Endpoints novos propostos

Todos usam JSON validado, limite inicial proposto de 16 KiB por corpo/resposta e `Cache-Control: no-store`. Identificadores são UUIDs, datas são UTC ISO 8601. O Agent usa o Bearer existente em cada requisição; nunca recebe nem informa um `deviceId` para escolher outro computador. Preservar HTTPS com certificado validado, redirects bloqueados e proxies de ambiente ignorados; a única exceção HTTP continua sendo loopback de desenvolvimento com opção explícita, sem fallback automático.

| Endpoint proposto | Contrato e autorização |
| --- | --- |
| `GET /agent/commands` | Agent; retorna no máximo uma solicitação própria ainda pendente, a mais antiga por `createdAt, id`. Só retorna vínculos atualmente ativos. Sem reserva implícita. |
| `POST /agent/commands/:id/claim` | Agent; corpo `{ claimId }`. Reserva única e atômica. Repetir o mesmo `claimId` retorna o estado atual da mesma reserva; outro identificador não toma seu lugar. |
| `PUT /agent/commands/:id/result` | Agent; corpo `{ claimId, status, result, error }`. Persiste resultado definitivo uma única vez; repetição equivalente retorna 200 e o mesmo registro; resultado diferente retorna 409. |
| `POST /devices/:deviceId/commands` | JWT do responsável; corpo `{ requestId, type, version, parameters }`. Exige associação ativa do solicitante e identidade ativa; cria `pending`, retorna 201, ou 200 se repetição equivalente. |
| `GET /devices/:deviceId/commands/:id` | JWT; consulta estado/resultado somente se o responsável ainda possui o vínculo original ativo. Novo responsável não herda resultados do anterior. |

Os dois endpoints do responsável são a fronteira futura de criação/consulta; não exigem mudanças no mobile nesta iteração. Um teste inicial poderá criar fixtures isoladas, sem expor um endpoint administrativo público.

Exemplo de resposta de polling:

```json
{
  "protocolVersion": 1,
  "serverTime": "2026-10-24T12:00:00.000Z",
  "commands": [
    {
      "id": "8cfb7732-e7b8-4b71-bdfa-1cba99dfc981",
      "associationId": "7ea5c654-e28e-4516-a0ae-38f7657a7898",
      "type": "agent.ping",
      "version": 1,
      "parameters": {},
      "status": "pending",
      "createdAt": "2026-10-24T11:59:30.000Z",
      "expiresAt": "2026-10-24T12:04:30.000Z",
      "executionTimeoutSeconds": 30,
      "claimId": null,
      "executionDeadlineAt": null
    }
  ]
}
```

Fila vazia ou ausência de vínculo: 200 com `commands: []`, sem erro de autenticação. Solicitações já reservadas não voltam à fila; o diário e a repetição do claim original permitem recuperar seu estado. GET somente calcula o estado efetivo pelo relógio do servidor, sem reservar ou consumir. Não oferece prova de presença nem altera o contrato de `/devices`.

A resposta de claim é 200 com `{ protocolVersion, serverTime, command }`, no mesmo formato. A primeira reserva devolve `running`, o `claimId` recebido e `executionDeadlineAt`. O Agent só pode iniciar trabalho após essa confirmação e o registro local descrito abaixo. Repetições mostram o estado atual, inclusive se já concluído; não reiniciam prazos. O estado só muda mediante claim/resultado válido ou vencimento/revogação previstos; não aceitar status livre enviado pelo cliente.

Exemplo de envio de resultado:

```json
{
  "claimId": "6c6e2d93-d1b5-4081-b2d0-a19569b64b17",
  "status": "succeeded",
  "result": { "reachable": true },
  "error": null
}
```

`failed` exige `result: null` e `error: { code }`; `succeeded` exige resultado específico da operação e `error: null`. Códigos iniciais: `UNSUPPORTED_OPERATION`, `INVALID_PARAMETERS`, `EXECUTION_TIMEOUT`, `LOCAL_UNAVAILABLE`; futuras leituras podem acrescentar `PERMISSION_DENIED`. Não transmitir traceback, stderr, senha ou mensagens brutas de D-Bus. PUT retorna 200 com `{ id, status, completedAt }`, estável nas repetições equivalentes. O backend só aceita transições e resultados compatíveis com a operação registrada.

## Persistência e autorização propostas

Uma tabela `AgentCommand`, sem tabela de tentativas na primeira versão:

| Grupo | Campos propostos |
| --- | --- |
| Identificação e escopo | `id`, `deviceId`, `associationId`, `requestId` |
| Intenção imutável | `type`, `version`, `parameters` JSON validado |
| Estado e prazos | `status`, `createdAt`, `expiresAt`, `executionTimeoutSeconds` |
| Reserva única | `claimId` opcional único, `claimedByIdentityId`, `claimedAt`, `executionDeadlineAt` |
| Resultado | `result` JSON opcional, `errorCode` opcional, `completedAt` opcional |

Relacionar a Device, DeviceAssociation e AgentIdentity; preservar histórico com exclusão restritiva. O responsável deriva da associação original, sem nova tabela de permissões. Unicidade de `(associationId, requestId)` evita duplicação na criação; comparar a intenção validada, sem depender da ordem das chaves JSON. Mesma chave com intenção diferente: 409. Índice de consulta por `(deviceId, status, createdAt, id)`. Detalhes de tipos, CHECKs e SQL da migration exigem revisão própria; nenhum schema foi alterado.

Criação, claim, resultado e revogações devem serializar pela mesma linha de `Device`, com consultas parametrizadas e transações curtas. Depois do lock, revalidar identidade, ambiente demo, associação original, `guardianId`, prazo e estado. O claim fica vinculado à identidade autenticada; o UUID da reserva não é outra credencial. O guard sozinho não fecha uma corrida entre autenticação e revogação. Não aceitar `guardianId`, vínculo, estado inicial ou prazos arbitrários enviados pelo mobile.

Polling deve filtrar pelo dispositivo autenticado e associação ativa correspondente ao responsável atual, nunca apenas por `guardianId`. Revalidar essas condições na transação de claim, mesmo se o GET acabou de autorizá-las. Um vínculo novo, inclusive com o mesmo responsável, não revive solicitações do vínculo anterior.

## Estados, prazos e recuperação

| Estado proposto | Significado |
| --- | --- |
| `pending` | Registrado, ainda sem reserva; não executado pelo protocolo. |
| `running` | Reservado para processamento; não comprova que a chamada local começou ou terminou. |
| `succeeded` | Resultado validado e persistido; para `agent.ping`, apenas diagnóstico. |
| `failed` | Agent confirmou falha conhecida e persistiu o erro; não inferir isso de timeout HTTP. |
| `expired` | Prazo para reservar terminou enquanto estava pendente; não entregar. |
| `cancelled` | Vínculo/identidade revogado antes da reserva; não entregar. |
| `unknown` | Houve reserva, mas falta resultado confiável após prazo ou revogação; efeito local não pode ser presumido. |

Transições: `pending → running → succeeded/failed`; `pending → expired/cancelled`; `running → unknown` por prazo ou revogação sem resultado. Um `unknown` por timeout admite resultado tardio da mesma reserva se identidade e vínculo continuam ativos. `succeeded`/`failed` são imutáveis. Cancelar ou expirar trabalho ainda pendente não significa desfazer políticas.

`expiresAt` limita o início da reserva, não o envio posterior de um resultado já produzido. `executionDeadlineAt` é calculado pelo servidor na primeira reserva. Não renovar prazos em retries. As consultas de fila e de estado calculam expiração/timeout sem escrita; mutações materializam o estado sob lock. Não é necessário um worker de expiração ou cron nesta versão. Inicialmente propor validade de cinco minutos e orçamento de processamento de 30 segundos para ping, sem relação com o token de pareamento. Valores precisam de revisão antes do uso em outras operações.

A reserva é única: não há lease com reentrega automática, troca de executor ou repetição da execução após timeout. Isso reduz estados e impede que uma resposta perdida faça o backend ordenar a mesma execução novamente. Aceita-se a perda de disponibilidade: casos ambíguos exigem diagnóstico e, para uma nova execução desejada, uma nova solicitação explícita. O claim deve permitir no máximo uma reserva `running` ainda dentro do prazo por dispositivo. Após `unknown`, um novo ping explícito pode avançar; a solicitação incerta nunca volta à fila. Inicialmente somente ping é aceito; antes de escritas será necessário rever reconciliação, ordenação e efeitos tardios.

O futuro Agent mantém um diário privado durável por `commandId`/`claimId`, fora do repositório, e exclusão entre instâncias locais:

1. Persistir a intenção de claim e seu UUID antes de POST. Resposta perdida: repetir o mesmo claim, nunca gerar outra reserva.
2. Confirmada a reserva e ainda dentro do prazo, persistir `started` antes de qualquer execução. Um GET repetido não dispara trabalho.
3. Persistir o resultado definitivo antes do PUT. Manter uma saída pendente até o backend confirmar o mesmo resultado.
4. Reinício com resultado salvo: reenviar somente o PUT. Reinício com `started` sem resultado: não executar de novo; preservar incerteza, que aparecerá como `unknown` após o prazo.
5. Sem diário confiável, não assumir que uma reserva devolvida pelo backend nunca foi executada. Falha de escrita no diário impede iniciar operação.

Não se promete execução exatamente uma vez: não existe transação única entre MySQL, disco do Agent e GNOME. O protocolo deduplica criação/reserva/resultado e evita reexecução automática conhecida; a janela entre registrar `started` e salvar o resultado fica explicitamente incerta. Novas solicitações com outros UUIDs representam novas intenções, mesmo com parâmetros iguais.

## Cadência e falhas de comunicação

Proposta inicial: polling a cada 15 segundos após o término da consulta, variação aleatória de até 20%, uma requisição por vez e um processamento por computador. Não adicionar long polling nem atualizar presença nesta entrega. No piloto de observação, usar somente GET de associações; não interpretar HTTP 200 como Agent online no mobile.

| Situação | Comportamento proposto |
| --- | --- |
| Sem rede, DNS, timeout de conexão/leitura, 5xx | Aguardar com backoff 15, 30, 60, 120, até 300 segundos e jitter; resetar após resposta válida. Não acumular requisições sobrepostas. |
| 429/503 com `Retry-After` válido | Esperar pelo menos o prazo indicado; não encurtá-lo para caber no teto do backoff. |
| 401 | Parar o ciclo e exigir intervenção administrativa; nunca reprovisionar sozinho. |
| TLS/certificado inválido, 403, protocolo/JSON incompatível | Parar com diagnóstico controlado; nunca ignorar certificado ou tentar HTTP como fallback. |
| 400/404 | Erro de contrato/recurso; não repetir cegamente. Recurso de outro dispositivo retorna 404. |
| 409 | Reserva ou resultado conflitante; reconciliar o mesmo identificador, sem executar novamente. |
| 410 | Solicitação expirada/revogada antes da reserva; descartar autorização para iniciar e consultar novamente. |

O diagnóstico único mantém timeout por operação de rede. O polling de vínculos já limita a consulta inteira via temporizador Linux e a resposta a 1 MiB; testes cobrem interrupção de consulta lenta. O futuro transporte de comandos ainda precisa do orçamento de execução e dos limites de payload propostos acima. Usar relógio monotônico para esperas e orçamento local, levando em conta `serverTime` e tempo de trânsito; o servidor decide validade. Relógio local divergente não estende autorização. SIGINT/SIGTERM interrompem espera sem apagar resultados ainda não confirmados.

Computador offline mantém solicitações pendentes no backend até expirar; ao voltar não recebe vencidas nem de vínculos revogados. Não enfileirar execução parental local para funcionar desconectado. Revogação de vínculo permite continuar observando associações com a identidade válida; revogação de identidade encerra toda comunicação autenticada.

Revogar não interrompe uma chamada Linux já iniciada. A futura implementação precisa estender os dois caminhos existentes de revogação, na mesma transação, para cancelar pendências e marcar reservas sem resultado como incertas; recusa claims/resultados posteriores do vínculo revogado. Um resultado já salvo no Agent não deve vazar para novo responsável. Identidade revogada recebe 401 inclusive no reenvio de resultado. Para futuras escritas, controle de autorização e privilégio mínimo local continuam obrigatórios; HTTPS não fornece permissões no GNOME.

## Validação do contrato e próxima implementação

Revisão de cenários, ainda sem testes executáveis do protocolo novo:

| Cenário | Resultado exigido na futura implementação |
| --- | --- |
| Dois POSTs de criação iguais | Um comando; mesma resposta lógica. Chave reutilizada com outro conteúdo: 409. |
| Dois Agents disputam claim | Uma reserva sob lock; outra recebe conflito. Mesmo claim repetido é consultado, sem renovar prazo. |
| Resposta do claim se perde | Repetição do mesmo UUID recupera a reserva. Sem resultado local, uma execução anterior incerta não é repetida. |
| PUT foi salvo, mas sua resposta se perde | Reenvio equivalente recebe o mesmo resultado; conteúdo diferente não o sobrescreve. |
| Processo cai depois de chamar GNOME | Diário sem resultado definitivo impede nova execução; estado desconhecido, sem sucesso presumido. |
| Revogação entre GET e claim | Claim revalida sob lock e não autoriza execução. |
| Revogação após claim | Não prometer interrupção local; estado incerto sem resultado, sem reentrega ou acesso por novo vínculo. |
| Fixture legada, outro dispositivo ou outro responsável | Não autorizar comandos; recurso alheio retorna 404. |
| Offline além da validade ou prazo excedido após reserva | `expired` antes do claim; `unknown` depois do claim, sem repetição automática. |

Próximos incrementos recomendados:

1. Revisar esta proposta, especialmente reserva sem reentrega, prazos e diagnóstico inicial `agent.ping`.
2. Observação periódica de `GET /agent/associations` implementada em `poll_associations.py`, sem mutação no backend nem executor. A extração do cliente preserva registros, categoria de erro e `Retry-After`; cadência, backoff, 401, TLS, interrupção e ausência de sobreposição têm testes. Isso não implementa os endpoints de comandos propostos.
3. Após a revisão do contrato, implementar modelo/migration e endpoints de polling/reserva/resultado no backend com fixtures e testes HTTP/MySQL dedicados: concorrência, isolamento, revogação e idempotência. Validar primeiro com cliente de teste, sem GNOME.
4. Implementar diário e processamento exclusivo de ping no Agent. Depois especificar separadamente a primeira leitura remota e seu alvo local; só então considerar escritas comprovadas.

Pendências de segurança/produto: conta gerenciada autorizada e proteção contra troca/reuso de UID; usuário/privilégios do Agent; autorização local por operação; HTTPS real e certificado; retenção e proteção do diário/resultados; quotas de comandos; observabilidade sem segredos. Ausência de polling não distingue computador desligado de falha de rede: presença exige contrato próprio. Não introduzir permissões Linux ou infraestrutura adicionais para resolver essas pendências nesta iteração.

Fundamentação: [RFC 9110, semântica e idempotência HTTP](https://www.rfc-editor.org/rfc/rfc9110.html#section-9.2.2) e [identificadores de intenção e retries idempotentes, AWS Builders' Library](https://aws.amazon.com/builders-library/making-retries-safe-with-idempotent-APIs/). São referências de desenho; a proposta não depende de serviços AWS.
