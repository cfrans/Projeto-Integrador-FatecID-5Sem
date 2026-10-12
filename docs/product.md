# Produto

## Propósito

O Lenovo Lux Parental (PIPLUP, identificado como `piplup` no código) é um projeto acadêmico de interface mobile para que o responsável consulte e altere remotamente o controle parental disponível nos computadores Lenovo Lux usados pela criança. O celular é um cliente remoto; quem aplica restrições é o GNOME/Lux.

## Estado atual

O aplicativo Expo usa autenticação real de responsáveis e consulta registros de computadores pela API NestJS. A persistência utiliza Prisma e MySQL. A infraestrutura de pareamento seguro está implementada no backend e integrada ao mobile; ainda não há Lux Agent nem integração Linux validada. Fixtures permanecem identificadas como demonstração.

## Usuários

- Responsável: usa o mobile para autenticar-se, consultar computadores autorizados, parear/revogar vínculos e, futuramente, consultar restrições, solicitar alterações e acompanhar resultados.
- Administrador local do Lux: autoriza o pareamento e operações locais que exigirem permissão; usará a interface GTK independente do serviço.
- Criança/conta gerenciada: utiliza o computador sujeito às políticas nativas; essa conta não equivale à conta do responsável na API.
- Administrador do backend: provisiona/invalida a identidade do computador antes do pareamento, conforme a decisão de confiança inicial.

## Funcionalidades previstas

O produto prevê autenticação real do responsável, cadastro e listagem de computadores, pareamento seguro por QR Code e revogação de vínculos. Também prevê consulta e alteração remotas de controles parentais, incluindo limites de tempo, controles de aplicativos, instalação e faixa etária. Esses controles dependem das capacidades comprovadas no GNOME/Lux e podem exigir ajuste do escopo.

O foco principal do projeto acadêmico é a experiência mobile e sua integração com o sistema do computador. O planejamento de integração não compromete a entrega mobile, que pode ser demonstrada com mocks. A aplicação local das restrições ocorre no computador, por meio do GNOME e do agente; o celular é um cliente remoto.

## MVP planejado

O primeiro MVP deverá reunir autenticação real, gerenciamento de dispositivos e pareamento seguro. A integração parental real será incremental após a prova técnica no Lux; os controles candidatos não são todos requisitos obrigatórios do MVP. Consulte as etapas em [Arquitetura](architecture.md).

## Etapa atual e fora de escopo

A fundação, autenticação e listagem autorizada já foram entregues. A infraestrutura de pareamento já existe na API/mobile, com um responsável ativo por computador, tokens temporários de uso único e revogação. A identidade do computador exige provisionamento administrativo separado do pareamento. O agente Lux e a aplicação de restrições reais não fazem parte desta etapa. A pequena interface local Python/GTK4/libadwaita de pareamento é planejada, separada do Agent systemd; a prova de conceito poderá começar com QR no terminal. Criar um mecanismo próprio de bloqueio parental ou modificar o código-fonte do GNOME/Controle Parental está fora do escopo.

## Referências e limites

Os identificadores RF e comportamentos do protótipo PDF são referências visuais/de produto, não requisitos técnicos validados. Pedidos temporários de liberação, encerramento automático de aplicativos, contagem de tentativas e fila offline precisam de decisão própria e validação técnica antes de entrarem no escopo.

O serviço de mock pode sustentar o desenvolvimento acadêmico e a interface. Uma resposta simulada não comprova que a operação existe no Lux nem que uma restrição foi aplicada.

## Questões em aberto

- Quais recursos de controle parental estão disponíveis na versão do GNOME instalada no Lenovo Lux?
- Qual o comportamento do produto quando o computador estiver indisponível?
- Quais contas gerenciadas e quais permissões o responsável pode administrar?
- Quais funções além do MVP devem ser priorizadas após a prova técnica?
