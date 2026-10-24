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
| [Proposta de protocolo do Agent](agent-protocol.md) | Comandos, idempotência e recuperação para revisão; separado do polling de vínculos implementado |
| [Design](design.md) | PDF, padrões visuais e componentes |

Este diretório descreve o estado presente e decisões planejadas. Leia [Produto](product.md) e [Arquitetura](architecture.md) para distinguir claramente os mocks atuais dos recursos ainda não implementados.

## Estado e próximas etapas

O [roadmap em Arquitetura](architecture.md#etapas-de-implementação) é a referência única para estado, evidência e pendências de cada etapa. Fundação e infraestrutura de pareamento existem; a etapa conjunta de autenticação/gerenciamento de dispositivos é parcial, com login implementado e gerenciamento limitado. Existe uma PoC Python de leitura nativa validada na VM Lux em contas com e sem restrições; consultar outra conta exigiu autenticação administrativa. O Agent possui diagnóstico autenticado e polling somente de leitura de vínculos validados no Lux; infraestrutura de comandos, serviço systemd, interface GTK e aplicação de operações parentais pelo projeto ainda não existem.

Prioridades: ampliar a validação de políticas/permissões na VM em paralelo ao mobile, continuar o Agent mínimo com protocolo de comandos e pareamento local, adicionar a interface GTK e integrar operações nativas comprovadas antes da validação ponta a ponta. Os detalhes e limites dos fluxos com/sem Docker estão no [README](../README.md#limites-de-validação-dos-fluxos).

Controles parentais além do fluxo de autenticação/dispositivos/pareamento dependem do que for demonstrado como disponível no GNOME instalado no Lux. A VM disponível usa Lux 3/Canopus, GNOME 50.4 e malcontent 0.13.1-5; leitura via libmalcontent/AccountsService está comprovada com e sem restrições. Provas manuais, limitações de aplicação e permissões pendentes estão em [Integração Lux](lux-integration.md).

O ambiente MySQL local é usado pelo backend; o app mobile não acessa o banco. Consulte [Banco de dados](database.md) para inicialização, limites do volume e decisões de schema/migrations.
