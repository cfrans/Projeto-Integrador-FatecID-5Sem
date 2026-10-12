# Arquitetura

## Componentes e responsabilidades

```mermaid
flowchart TD
    M[Mobile Expo] -->|REST: autenticação, dispositivos e pareamento| B[Backend NestJS]
    A[Lux Agent Python 3] -->|polling autenticado REST/HTTPS futuro| B[Backend NestJS]
    A -->|interfaces locais a validar| G[GNOME / controles parentais]
    B --> D[(MySQL 8.4)]
```

O mobile é um cliente remoto e conversa somente com a API; não acessa MySQL nem o computador Lux diretamente. O backend é um monólito modular em TypeScript/Node.js LTS com NestJS, REST e Prisma. Ele disponibiliza a API, persiste dados e intermedeia operações com agentes. O agente Python 3 será instalado como serviço systemd, iniciará comunicação com o backend por polling e integrará operações locais permitidas pelo sistema, reportando resultados. O GNOME/Lux aplica as restrições.

O backend persiste responsáveis, dispositivos e contratos de pareamento em MySQL; autentica responsáveis com Argon2id e JWT de 30 minutos, e computadores com credenciais individuais provisionadas administrativamente. O mobile usa login, consulta de perfil e listagem reais, armazena a sessão em SecureStore no Android/iOS e protege a navegação. A listagem filtra pelo responsável autenticado e distingue vínculo ativo de fixtures legadas; nenhum registro comprova integração Linux. As fixtures são identificadas como demonstração e a conexão permanece não validada. A comunicação agente-backend e a integração do agente com o GNOME são futuras. O agente iniciará a comunicação por REST/HTTPS (polling); conectividade de entrada no computador não é requisito assumido. Os contratos de identidade e pareamento estão definidos nesta etapa; confirmação de aplicação parental ainda depende de investigação e validação no Lux real.

## Etapas de implementação

1. Fundação concluída: aplicativo mobile demonstrativo com mocks, backend NestJS executável com Prisma, Docker/MySQL e documentação.
2. Backend/mobile desta etapa concluídos: autenticação real e listagem autorizada de registros de dispositivos integradas ao mobile. Responsáveis e fixtures são criados por seeds explícitos de desenvolvimento; não há cadastro público nem criação de dispositivos pela API.
3. Etapa atual: infraestrutura de identidade individual, sessões temporárias e vínculo revogável na API; integração do QR no mobile. A implementação e validação do Agent real continuam pendentes.
4. Prova técnica GNOME: investigar e implementar o mínimo do agente quando o ambiente Lux estiver disponível. Essa investigação pode ocorrer em paralelo com as etapas 2 e 3, mas não deve ser tratada como capacidade confirmada.
5. Operação ponta a ponta: validar autenticação, pareamento, disponibilidade, consulta e aplicação real no Lenovo Lux, documentando limites observados.

## Mocks e contratos

Há duas fronteiras de simulação:

| Cenário | Fluxo | O que o mock substitui |
| --- | --- | --- |
| Pareamento demonstrativo | Mobile → serviço mock no app | Simulação local de pareamento, sem modificar a API ou conectar ao Lux |
| Futuro, com API integrada | Mobile → Backend → mock do Lux Agent | Operações expostas pelo agente, permitindo desenvolver backend sem computador Lux |

`devices.listPairedComputers(): Promise<PairedComputer[]>` usa `GET /devices`, sem fallback para mock. A resposta traz `id`, `name`, `managedUser` opcional, `status: "unverified"`, `lastSeen: null`, `isDemo`, `paired` e `associationId` quando pareado. O nome histórico do método não implica pareamento validado. Home e Computadores consomem o serviço HTTP da feature; autenticação e erros passam pelo cliente compartilhado. Os seeds podem criar fixtures persistidas com `isDemo: true`, mas não simulam um agente online.

`pairingDemo.simulatePairing()` permanece como utilitário de mock, separado do fluxo HTTP. A tela de pareamento usa a API para validar e consumir o QR; os mocks existentes e placeholders parentais são preservados. Uma fixture de identidade/pareamento deve permanecer demonstrativa, inclusive na confirmação mobile, e não comprova conexão a um Lux.

No cenário futuro, o mock do agente deverá cumprir o mesmo contrato do agente real. Esse mock ainda não foi implementado. Uma resposta simulada não confirma suporte nem aplicação da operação no GNOME.

## Fronteiras do pareamento

O MVP permite um responsável ativo por computador. A identidade do Agent é provisionada administrativamente antes do pareamento: uma credencial aleatória individual é instalada por um administrador local, e somente seu hash fica no backend. Não há registro público que transforme um `deviceId` em identidade confiável. O procedimento e suas limitações estão em [Integração Lux](lux-integration.md).

O Agent previamente autorizado deve verificar a autorização administrativa local antes de solicitar uma sessão. O backend autentica o Agent, mas não consegue comprovar sozinho a autorização Linux; essa obrigação depende da implementação e validação do Agent real. O QR contém apenas um token temporário, separado da identidade do Agent. O responsável autenticado valida o token, confirma o computador e solicita o consumo. Consumo e criação do vínculo ocorrem na mesma transação, serializados por computador, impedindo uso concorrente e dois responsáveis ativos.

A revogação remove o acesso do responsável na API e invalida sessões pendentes do computador. Para associar novamente, é necessária outra sessão criada após autorização local. O Agent só pode consultar ou revogar vínculos do próprio computador. A revogação no backend não demonstra remoção de restrições Linux; o efeito local ainda depende do Agent e da investigação GNOME.

Fixtures e identidades de desenvolvimento devem permanecer identificadas como demonstração e não podem ser aceitas como agentes em produção. Mesmo uma associação real na API não comprova presença online nem integração Linux. HTTPS é obrigatório fora do desenvolvimento local; não se transmite credencial administrativa Linux.

## Limites técnicos do Lux

O ambiente informado é GNOME 50.5. Uma ISO do Lenovo Lux não está disponível para reproduzir o ambiente. D-Bus, malcontent/libmalcontent, AccountsService e autorização via polkit são hipóteses de investigação, não interfaces validadas nem uma promessa de API estável. Ver [integração Lux](lux-integration.md) para critérios e registro de evidências.
