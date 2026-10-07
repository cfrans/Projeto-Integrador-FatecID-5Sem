# Backend

Backend technology: TBD

O MySQL local é disponibilizado pelo `docker-compose.yml` na raiz. A API ainda não está implementada; quando a tecnologia do backend for definida e existir um serviço executável, sua entrega deverá incluir um Dockerfile e consumir as variáveis de conexão local sem expor credenciais ao mobile ou ao Lux Agent. Ainda não há Dockerfile do backend.

## Responsabilidades esperadas

Disponibilizar API ao mobile, acessar MySQL, autenticar responsáveis/dispositivos, validar autorização dos vínculos e intermediar consultas/comandos ao Lux. A aplicação das restrições pertence ao GNOME; sucesso de transporte não deve ser confundido com aplicação confirmada no computador.

## Contrato de listagem provisório no mobile

O mobile define `DevicesSource.listPairedComputers(): Promise<PairedComputer[]>`. Cada registro contém `id`, `name`, `status` (`online` ou `offline`), `managedUser` e `lastSeen` (data ISO 8601 ou `null`). O serviço seleciona `mockDevices`; Home e computadores usam essa listagem. O mock oferece três registros fictícios. O tipo é interno ao mobile: não é schema de banco nem contrato HTTP acordado.

O pareamento atual é separado da listagem: `pairingDemo.simulatePairing()` é uma operação de demonstração que adiciona idempotentemente um quarto computador fictício ao mock em memória. O estado existe apenas enquanto o processo do app estiver ativo; a operação não lê QR Code, conecta ao Lux ou define um método da API.

Quando houver implementação HTTP, acordar endpoint, método, payload, autorização, resposta vazia e tratamento de erros. A API de pareamento será definida separadamente após estabelecer os requisitos e validar capacidades e regras. Login, consulta real, alteração de configurações e pareamento não estão conectados a um backend.

## TBD

Linguagem, framework, ORM, hospedagem, sessões/tokens, protocolo com Agent, confirmação de comandos, erros e comportamento offline. Nenhuma dessas escolhas foi implementada nesta entrega.
