# Documentação

Para instalar e abrir o aplicativo no celular, comece pelo [tutorial da raiz](../README.md). Os documentos abaixo detalham decisões e responsabilidades.

| Documento | Onde procurar |
| --- | --- |
| [Produto](product.md) | Propósito, estado atual e MVP planejado |
| [Arquitetura](architecture.md) | Componentes, etapas, contratos e fronteiras entre mocks e integração real |
| [Mobile](mobile.md) | Organização, sessão REST, URL da API e Expo Go |
| [Backend](backend.md) | Responsabilidades, implementação e contrato da API |
| [Banco](database.md) | MySQL 8.4 com Docker ou local, Prisma e migrations |
| [Lux](lux-integration.md) | Agent Python/systemd, interface GTK, hipóteses GNOME, segurança e provas técnicas |
| [HTTPS do Agent](lux-https-development.md) | Proxy temporário, CA explícita, testes e evidências de transporte seguro |
| [Protocolo do Agent](agent-protocol.md) | Contrato v1 implementado para ping, idempotência, reserva e recuperação |
| [Validação de ping](agent-ping-validation.md) | Testes isolados e prova ponta a ponta por HTTPS com o Lux real |
| [Design](design.md) | PDF, padrões visuais e componentes |
| [Client simulado](simulated-client.md) | Cadastro demonstrativo, QR e sincronização com o app sem depender do GNOME |

Este diretório descreve o estado presente e decisões planejadas. Leia [Produto](product.md) e [Arquitetura](architecture.md) para distinguir claramente os mocks atuais dos recursos ainda não implementados.

## Estado e próximas etapas

O [roadmap em Arquitetura](architecture.md#etapas-de-implementação) é a referência única para estado, evidência e pendências de cada etapa. Fundação e infraestrutura de pareamento existem; a etapa conjunta de autenticação/gerenciamento de dispositivos é parcial, com login implementado e gerenciamento limitado. Existe uma PoC Python de leitura nativa validada na VM Lux em contas com e sem restrições; consultar outra conta exigiu autenticação administrativa. O Agent possui diagnóstico autenticado e polling somente de leitura de vínculos validados no Lux; `agent.ping` possui infraestrutura de comandos e diário persistente validados por HTTPS; serviço systemd, interface GTK e operações parentais remotas ainda não existem.

Para a entrega acadêmica, o [client simulado](simulated-client.md) permite cadastrar/parear PCs demonstrativos e refletir configurações do app pela API. A integração nativa possui diagnóstico `agent.ping` implementado; pareamento/autorização local, GTK e comandos parentais permanecem futuros. Os detalhes e limites dos fluxos com/sem Docker estão no [README](../README.md#limites-de-validação-dos-fluxos).

Controles parentais além do fluxo de autenticação/dispositivos/pareamento dependem do que for demonstrado como disponível no GNOME instalado no Lux. A VM disponível usa Lux 3/Canopus, GNOME 50.4 e malcontent 0.13.1-5; leitura via libmalcontent/AccountsService está comprovada com e sem restrições. Provas manuais, limitações de aplicação e permissões pendentes estão em [Integração Lux](lux-integration.md).

O ambiente MySQL local é usado pelo backend; o app mobile não acessa o banco. Consulte [Banco de dados](database.md) para inicialização, limites do volume e decisões de schema/migrations.
