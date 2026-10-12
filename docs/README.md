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
| [Design](design.md) | PDF, padrões visuais e componentes |

Este diretório descreve o estado presente e decisões planejadas. Leia [Produto](product.md) e [Arquitetura](architecture.md) para distinguir claramente os mocks atuais dos recursos ainda não implementados.

## Estado e próximas etapas

O [roadmap em Arquitetura](architecture.md#etapas-de-implementação) é a referência única para estado, evidência e pendências de cada etapa. Fundação e infraestrutura de pareamento existem; a etapa conjunta de autenticação/gerenciamento de dispositivos é parcial, com login implementado e gerenciamento limitado. Agent Python/systemd, interface GTK e operações parentais reais ainda não existem. A prova GNOME depende do acesso ao ambiente Lux.

Prioridades: validar o ambiente GNOME em paralelo ao mobile, desenvolver o Agent mínimo, adicionar a interface GTK e integrar operações nativas comprovadas antes da validação ponta a ponta. Os detalhes e limites dos fluxos com/sem Docker estão no [README](../README.md#limites-de-validação-dos-fluxos).

Controles parentais além do fluxo de autenticação/dispositivos/pareamento dependem do que for demonstrado como disponível no GNOME instalado no Lux. O ambiente de referência previsto é GNOME 50.5, mas não há ISO Lux disponível para validar o sistema; por isso D-Bus, malcontent/libmalcontent, AccountsService e polkit continuam hipóteses. Consulte [Integração Lux](lux-integration.md).

O ambiente MySQL local é usado pelo backend; o app mobile não acessa o banco. Consulte [Banco de dados](database.md) para inicialização, limites do volume e decisões de schema/migrations.
