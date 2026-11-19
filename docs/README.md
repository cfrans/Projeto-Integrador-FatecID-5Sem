# Documentação

Para instalar e abrir o aplicativo no celular, comece pelo [tutorial da raiz](../README.md). Os documentos abaixo detalham decisões e responsabilidades.

| Documento | Onde procurar |
| --- | --- |
| [Produto](product.md) | Propósito, estado atual e MVP planejado |
| [Arquitetura](architecture.md) | Componentes, etapas, contratos e fronteiras entre mocks e integração real |
| [Mobile](mobile.md) | Organização, sessão REST, URL da API e Expo Go |
| [Backend](backend.md) | Responsabilidades, implementação e contrato da API |
| [Banco](database.md) | MySQL 8.4 com Docker ou local, Prisma e migrations |
| [Engenharia de Software III](engenharia-de-software-iii.md) | Casos de uso, classes, backlog, padrões e metodologia ágil |
| [Testes](testing.md) | Cobertura, limites e execução Cypress/API/MySQL em Docker |
| [Lux](lux-integration.md) | Agent Python/systemd, interface GTK, malcontent/polkit e provas que sustentam as decisões |
| [HTTPS do Agent](lux-https-development.md) | Proxy temporário, CA explícita, testes e evidências de transporte seguro |
| [Protocolo do Agent](agent-protocol.md) | Contrato v1: ping, comandos parentais, relatórios, idempotência e recuperação |
| [Segurança](security.md) | Controles implementados e limitações conhecidas |
| [Validação](validation.md) | Última validação de cada parte do sistema e como repetir |
| [Design](design.md) | PDF, padrões visuais e componentes |
| [Client simulado](simulated-client.md) | Cadastro demonstrativo, QR e sincronização com o app sem depender do GNOME |

Este diretório descreve o estado presente. O [roadmap em Arquitetura](architecture.md#etapas-de-implementação) é a referência única para o estado de cada etapa; os demais documentos não repetem esse estado.

Para a entrega acadêmica, o [client simulado](simulated-client.md) permite cadastrar/parear PCs demonstrativos e refletir configurações do app pela API, como plano B quando o Lux não estiver disponível. O app mobile não acessa o banco; o ambiente MySQL é usado só pelo backend ([Banco](database.md)).
