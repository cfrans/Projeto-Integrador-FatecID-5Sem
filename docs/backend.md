# Backend

Backend technology: TBD

## Responsabilidades esperadas

Disponibilizar API ao mobile, acessar MySQL, autenticar responsáveis/dispositivos, validar autorização dos vínculos e intermediar consultas/comandos ao Lux. A aplicação das restrições pertence ao GNOME; sucesso de transporte não deve ser confundido com aplicação confirmada no computador.

## Contrato inicial provisório

O mobile define `DevicesSource.listPairedComputers(): Promise<PairedComputer[]>`, com `{ id: string; name: string }`. O mock retorna `[]`. Este contrato serve para desenvolver a feature sem o backend; não é um schema de banco ou contrato HTTP final.

Quando houver implementação HTTP, acordar endpoint, método, payload, autorização, resposta vazia e tratamento de erros. Consulta/alteração de configurações e pareamento terão contratos definidos após validar capacidades e regras.

## TBD

Linguagem, framework, ORM, hospedagem, sessões/tokens, protocolo com Agent, confirmação de comandos, erros e comportamento offline. Nenhuma dessas escolhas foi implementada nesta entrega.
