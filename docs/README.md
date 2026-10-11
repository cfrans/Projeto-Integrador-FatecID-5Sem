# Documentação

Para instalar e abrir o aplicativo no celular, comece pelo [tutorial da raiz](../README.md). Os documentos abaixo detalham decisões e responsabilidades.

| Documento | Onde procurar |
| --- | --- |
| [Produto](product.md) | Propósito, estado atual e MVP planejado |
| [Arquitetura](architecture.md) | Componentes, etapas, contratos e fronteiras entre mocks e integração real |
| [Mobile](mobile.md) | Organização, sessão REST, URL da API e Expo Go |
| [Backend](backend.md) | Responsabilidades, implementação e contrato da API |
| [Banco](database.md) | MySQL 8.4 com Docker ou local, Prisma e migrations |
| [Lux](lux-integration.md) | Agente, hipóteses GNOME, segurança planejada e provas técnicas |
| [Design](design.md) | PDF, padrões visuais e componentes |

Este diretório descreve o estado presente e decisões planejadas. Leia [Produto](product.md) e [Arquitetura](architecture.md) para distinguir claramente os mocks atuais dos recursos ainda não implementados.

## Próximas etapas

1. Fundação concluída: Expo, NestJS, Prisma e MySQL; desenvolvimento com Docker ou execução direta.
2. Autenticação e listagem autorizada integradas ao mobile; responsáveis e registros demonstrativos são criados por seeds explícitos. Não há cadastro público nem criação de dispositivos pela API.
3. Implementar pareamento seguro de computador/agente à conta responsável.
4. Fazer uma prova técnica mínima de GNOME no Lenovo Lux quando o ambiente estiver disponível; essa investigação pode avançar em paralelo às etapas 2 e 3.
5. Validar fluxo ponta a ponta no computador real, incluindo aplicação das operações suportadas, disponibilidade, erros e revogação.

Controles parentais além do fluxo de autenticação/dispositivos/pareamento dependem do que for demonstrado como disponível no GNOME instalado no Lux. GNOME 50.5 foi informado, mas não há ISO Lux disponível para validar o ambiente; por isso D-Bus, malcontent/libmalcontent, AccountsService e polkit continuam hipóteses. Consulte [Integração Lux](lux-integration.md).

O ambiente MySQL local é usado pelo backend; o app mobile não acessa o banco. Consulte [Banco de dados](database.md) para inicialização, limites do volume e decisões de schema/migrations.
