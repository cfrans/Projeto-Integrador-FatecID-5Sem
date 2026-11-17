# Arquitetura

## Componentes e responsabilidades

```mermaid
flowchart TD
    M[Mobile Expo] -->|REST: autenticação, dispositivos e pareamento| B[Backend NestJS]
    A[Lux Agent Python 3] -->|polling REST/HTTPS de vínculos e agent.ping| B[Backend NestJS]
    A -->|leitura via libmalcontent comprovada; escrita futura| G[GNOME / controles parentais]
    B -->|Prisma| D[(MySQL 8.4)]
    U[Interface local Python / GTK4 / libadwaita futura] -->|pareamento sob demanda e autorização local a validar| A
```

O mobile é um cliente remoto e conversa somente com a API; não acessa MySQL nem o computador Lux diretamente. O backend é um monólito modular em TypeScript/Node.js LTS com NestJS, REST e Prisma. Ele disponibiliza a API, persiste dados e intermedeia operações com agentes. O agente Python 3 será instalado como serviço systemd, iniciará comunicação com o backend por polling e integrará operações locais permitidas pelo sistema, reportando resultados. O GNOME/Lux aplica as restrições. A interface gráfica local de pareamento será um aplicativo Python/GTK4/libadwaita distinto do serviço, aberto sob demanda por um administrador. Fechá-la não interrompe o Agent. Ambos serão instalados no Lux; estarem neste repositório não implica execução no servidor ou celular.

O backend persiste responsáveis, dispositivos, inventário, pedidos de instalação e contratos de pareamento em MySQL; autentica responsáveis com Argon2id e JWT de 30 minutos, e computadores com credenciais individuais provisionadas administrativamente. O mobile usa login, consulta de perfil e listagem reais, armazena a sessão em SecureStore no Android/iOS e protege a navegação. A listagem filtra pelo responsável autenticado e distingue vínculo ativo de fixtures legadas; nenhum registro comprova integração Linux. As fixtures são identificadas como demonstração. O client simulado possui presença por heartbeat; isso não comprova conexão Linux. As consultas de inventário e pedidos exigem vínculo ativo; a ingestão existe somente para o client demonstrativo. Existe uma PoC local de leitura libmalcontent em `lux-agent/`; o diagnóstico autenticado e o polling de vínculos Agent → backend já existem; `agent.ping` já usa reserva, diário e resultado persistido; comandos parentais e aplicação de políticas pelo agente são futuros. O agente iniciará a comunicação por REST/HTTPS (polling); conectividade de entrada no computador não é requisito assumido. Os contratos de identidade e pareamento estão definidos nesta etapa; confirmação de aplicação parental ainda depende de investigação e validação no Lux real.

O código do Agent está no pacote `lux_agent`, com CLI `python3 -m lux_agent` (em `lux-agent/`) e testes separados. Transporte, polling, comandos, diário e leitura malcontent têm módulos próprios; os três scripts antigos são wrappers de compatibilidade. Estrutura, execução e sincronização restrita estão no [README do Agent](../lux-agent/README.md#organização-e-execução).

## Etapas de implementação

Estado baseado na implementação existente. “Implementada” descreve o código existente, sem implicar validação em todos os ambientes. Os critérios de conclusão das etapas parciais/planejadas continuam pendentes.

| Etapa | Estado | Evidência atual e trabalho restante |
| --- | --- | --- |
| 1. Fundação NestJS, Prisma, MySQL e Docker | Implementada | Scaffold modular, conexão/saúde, dez migrations, objetos SQL usados pela API e Compose com watch. Execução no host prevista pelos mesmos scripts/configuração; limites da validação em [README](../README.md#limites-de-validação-dos-fluxos). |
| 2. Autenticação, dispositivos e integração mobile | Parcial | Cadastro, login/perfil JWT, alteração de e-mail/senha, recuperação por pergunta de segurança, listagem autorizada e revogação integrados. Contas podem ser criadas pelo app ou por seed; computadores reais nascem do autorregistro do Agent no pareamento; seed, provisionamento administrativo e cadastro demonstrativo ficam para desenvolvimento/teste. Não há edição geral de dispositivos nem presença real. |
| 3. Infraestrutura de pareamento seguro | Implementada na API/mobile | Identidade individual, token de cinco minutos/uso único, consumo transacional, leitura/confirmação de QR e revogação. Autorregistro e pareamento pelo Agent com autorização local `pkexec` ([Integração Lux](lux-integration.md#pareamento-pelo-agent)). |
| 4. Prova de conceito Python/malcontent no Lux | Leitura validada com e sem restrições | VM Lux 3/Canopus, GNOME 50.4, malcontent 0.13.1-5. Própria conta consultada sem sudo; leitura restritiva de outra conta exigiu sudo autenticado pelo usuário. JSONs antes/depois idênticos e campos expostos pela CLI compatíveis; testes no WSL2 e Lux. Privilégios mínimos do futuro serviço pendentes; ver [registro](lux-integration.md#registro-de-provas-técnicas). |
| 5. Lux Agent mínimo | Parcial | Diagnóstico/polling, HTTPS verificado e primeiro comando `agent.ping` com reserva, diário e resultado validados no Lux real. Serviço systemd instalado por `install.sh`, com relatórios, reinício e revogação validados no Lux ([instalação](../lux-agent/README.md#instalar-como-serviço)). 121 testes Python em WSL2/Lux, 18 testes MySQL; [contrato](agent-protocol.md) e [evidências](agent-ping-validation.md). Pareamento por QR no terminal (`lux-agent pair`) com autorização administrativa local. Comandos parentais pendentes. |
| 6. Interface GTK4/libadwaita | Planejada | Aplicativo Python independente que exibe o QR em janela, reutilizando o auxiliar de pareamento via `pkexec`. |
| 7. Controle parental nativo real | Parcial | Backend: as configurações de um computador real geram `parental.app_filter.set` na fila e reconciliam o resultado ([contrato](agent-protocol.md#comandos-parentais-contrato)), desligado por `ENABLE_PARENTAL_COMMANDS`. Agent executa o `set` com releitura (testes com malcontent substituído). Mobile e validação no GNOME pendentes. |
| 8. Validação ponta a ponta e expansão | Planejada | Validar mobile → API → Agent → GNOME, falhas, revogação e aplicação confirmada; expandir capacidades gradualmente. |

A investigação GNOME pode avançar na VM disponível. O foco acadêmico principal permanece no mobile; mocks identificados e contratos explícitos permitem seu desenvolvimento sem bloquear pela integração Linux. Etapas do roadmap não equivalem a entregas executadas.

## Fluxo esperado de operações parentais

O [protocolo do Agent](agent-protocol.md) implementa `agent.ping`, validado ponta a ponta com Lux real por HTTPS ([evidências](agent-ping-validation.md)), e o lado do backend dos [comandos parentais](agent-protocol.md#comandos-parentais-contrato). O Agent ainda não executa malcontent remotamente nem escreve no GNOME.

**Estado desejado convertido em comando.** O responsável não cria o comando parental. Ele edita as configurações do computador (`settings` + `revision`), o mesmo contrato do [client simulado](simulated-client.md). Para computador real, cada nova revision grava o filtro derivado e cria `parental.app_filter.set` com o filtro completo, cancelando os pendentes anteriores. Computador simulado nunca gera comando: continua confirmado pelo próprio client.

1. O responsável solicita a alteração pelo mobile via HTTPS/REST.
2. NestJS autentica, autoriza o recurso e registra o comando pendente em MySQL por Prisma.
3. O Agent do computador inicia polling autenticado por HTTPS/REST e recebe trabalho autorizado. O servidor não precisa iniciar conexão de entrada no Lux.
4. O Agent executa somente a operação local suportada por libmalcontent/D-Bus e serviços GNOME, respeitando permissões, e consulta se a alteração foi aplicada.
5. O Agent informa sucesso confirmado, falha ou indisponibilidade; o backend registra o resultado e o mobile o consulta.

Comando recebido ou pendente não pode aparecer como concluído. O mobile só indicará configuração efetivamente aplicada após confirmação apropriada do Agent. Estados, repetição segura, recuperação após desconexão e comportamento offline precisam de contrato antes da implementação. D-Bus comunica processos locais; systemd mantém o serviço em execução. O Agent não cria outro mecanismo parental nem aceita execução arbitrária de comandos.

## Mocks e contratos

Há duas fronteiras de simulação:

| Cenário | Fluxo | O que o mock substitui |
| --- | --- | --- |
| Utilitário demonstrativo preservado, fora do fluxo atual | `pairingDemo` no mobile → mock em memória | Simulação local de pareamento, sem modificar a API ou conectar ao Lux |
| Implementado, com API integrada | Mobile → Backend → `simulated-client/` | Cadastro demonstrativo, pareamento, configurações, inventário e decisões de instalação, sem aplicar políticas no sistema operacional |

`devices.listPairedComputers(): Promise<PairedComputer[]>` usa `GET /devices`, sem fallback para mock. A resposta traz `id`, `name`, `managedUser` opcional, `status: "unverified"`, `lastSeen: null`, `isDemo`, `paired` e `associationId` quando pareado. O nome histórico do método não implica pareamento validado. Home e Computadores consomem o serviço HTTP da feature; autenticação e erros passam pelo cliente compartilhado. Os seeds podem criar fixtures persistidas com `isDemo: true`, mas não simulam um agente online.

A tela de pareamento usa a API para validar e consumir o QR, sem mock nem fallback. Uma fixture de identidade/pareamento deve permanecer demonstrativa, inclusive na confirmação mobile, e não comprova conexão a um Lux.

O client demonstrativo reutiliza a identidade e o pareamento existentes, mas seu estado versionado é separado do protocolo futuro de comandos reais. Há uma única tabela adicional por vínculo e reutilização do inventário/pedidos; contrato e execução em [Client simulado](simulated-client.md). Uma confirmação simulada não comprova suporte nem aplicação da operação no GNOME.

## Fronteiras do pareamento

O MVP permite um responsável ativo por computador. No autorregistro, o Agent gera localmente uma credencial aleatória e envia só seu hash SHA-256 com nome e usuário gerenciado. Registrar não concede nada: o registro fica pendente na sessão de pareamento, e `Device`, identidade e vínculo só são criados quando um responsável autenticado conclui o pareamento pelo QR em até cinco minutos. O provisionamento administrativo continua disponível para desenvolvimento e operação. O `deviceId` sozinho não autentica. O procedimento e suas limitações estão em [Integração Lux](lux-integration.md).

O Agent exige autorização administrativa local (`pkexec` com `auth_admin`) antes de registrar o computador ou solicitar uma sessão. O backend autentica o Agent, mas não consegue comprovar sozinho a autorização Linux. O QR contém apenas um token temporário, separado da identidade do Agent. O responsável autenticado valida o token, confirma o computador e solicita o consumo. Consumo e criação do vínculo ocorrem na mesma transação, serializados por computador (ou pela sessão, no autorregistro), impedindo uso concorrente e dois responsáveis ativos. Phishing de QR, em que alguém induz o responsável a ler o QR de outro computador, é limitação conhecida, mitigada pela tela de confirmação do mobile com nome e usuário do computador.

A revogação remove o acesso do responsável na API e invalida sessões pendentes do computador. Para associar novamente, é necessária outra sessão criada após autorização local. O Agent só pode consultar ou revogar vínculos do próprio computador. A revogação no backend não demonstra remoção de restrições Linux; o efeito local ainda depende do Agent e da investigação GNOME.

Fixtures e identidades de desenvolvimento devem permanecer identificadas como demonstração e não podem ser aceitas como agentes em produção. Mesmo uma associação real na API não comprova presença online nem integração Linux. HTTPS é obrigatório fora do desenvolvimento local; não se transmite credencial administrativa Linux.

## Limites técnicos do Lux

O ambiente disponível é uma VM VirtualBox com Lux 3/Canopus (Debian Trixie), GNOME 50.4, malcontent 0.13.1-5 e AccountsService ativo. A leitura via Python/PyGObject/libmalcontent está comprovada em contas com e sem restrições, com autenticação administrativa para consultar outra conta. O usuário relatou configuração nativa de horários, bloqueio de login via PAM/GDM e restrições observadas no GNOME; isso não implementa escrita pelo Agent nem comprova encerramento automático ou bloqueio de execução direta. `libpam-malcontent` precisou de instalação manual. A avaliação de horários UTC foi verificada em memória; aplicação efetiva nas fronteiras do dia, privilégios mínimos e autorização do futuro serviço ainda exigem validação. Ver [integração Lux](lux-integration.md) para evidências e limites.
