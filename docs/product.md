# Produto

## Propósito

O piplup é um projeto acadêmico de interface mobile para que o responsável consulte e altere remotamente o controle parental disponível nos computadores Lenovo Lux usados pela criança. O celular é um cliente remoto; quem aplica restrições é o GNOME/Lux.

## Estado atual

O aplicativo Expo contém quatro telas demonstrativas: login, início, computadores e pareamento simulado. A autenticação não é real, não há API conectada ao mobile, e os dados de computador vêm de mocks em memória. O pareamento demonstrativo não lê QR Code nem se conecta a um Lux. A fundação do backend executável existe, mas ainda não há integração Linux.

## Funcionalidades previstas

O produto prevê autenticação real do responsável, cadastro e listagem de computadores, pareamento seguro por QR Code e revogação de vínculos. Também prevê consulta e alteração remotas de controles parentais, incluindo limites de tempo, controles de aplicativos, instalação e faixa etária. Esses controles dependem das capacidades comprovadas no GNOME/Lux e podem exigir ajuste do escopo.

O foco principal do projeto acadêmico é a experiência mobile e sua integração com o sistema do computador. O planejamento de integração não compromete a entrega mobile, que pode ser demonstrada com mocks. A aplicação local das restrições ocorre no computador, por meio do GNOME e do agente; o celular é um cliente remoto.

## MVP planejado

O primeiro MVP deverá reunir autenticação real, gerenciamento de dispositivos e pareamento seguro. A integração parental real será incremental após a prova técnica no Lux; os controles candidatos não são todos requisitos obrigatórios do MVP. Consulte as etapas em [Arquitetura](architecture.md).

## Etapa atual e fora de escopo

A etapa atual entrega a fundação: aplicativo Expo, backend NestJS executável com Prisma, Docker/MySQL e documentação. A autenticação, dispositivos e pareamento do MVP ainda são módulos/funcionalidades futuras; o app mobile continua sem conexão à API. O agente Lux e a aplicação de restrições reais também não fazem parte desta etapa. Criar um mecanismo próprio de bloqueio parental está fora do escopo.

## Referências e limites

Os identificadores RF e comportamentos do protótipo PDF são referências visuais/de produto, não requisitos técnicos validados. Pedidos temporários de liberação, encerramento automático de aplicativos, contagem de tentativas e fila offline precisam de decisão própria e validação técnica antes de entrarem no escopo.

O serviço de mock pode sustentar o desenvolvimento acadêmico e a interface. Uma resposta simulada não comprova que a operação existe no Lux nem que uma restrição foi aplicada.

## Questões em aberto

- Quais recursos de controle parental estão disponíveis na versão do GNOME instalada no Lenovo Lux?
- Qual o comportamento do produto quando o computador estiver indisponível?
- Quais contas gerenciadas e quais permissões o responsável pode administrar?
- Quais funções além do MVP devem ser priorizadas após a prova técnica?
