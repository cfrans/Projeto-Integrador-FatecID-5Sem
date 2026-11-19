# Produto

## Propósito

O Lenovo Lux Parental (PIPLUP, identificado como `piplup` no código) é um projeto acadêmico de interface mobile para que o responsável consulte e altere remotamente o controle parental disponível nos computadores Lenovo Lux usados pela criança. O celular é um cliente remoto; quem aplica restrições é o GNOME/Lux.

## Estado atual

O aplicativo Expo usa autenticação real de responsáveis e consulta e configura computadores pela API NestJS, com persistência em MySQL via Prisma. Um computador Lux real é pareado por QR com autorização do administrador local; o Lux Agent, instalado como serviço, aplica o bloqueio de aplicativos, navegadores e instalação definido no app e confirma por releitura. O [client simulado](simulated-client.md) permite cadastrar e parear PCs demonstrativos; a confirmação dele vale somente para a simulação. Estado detalhado em [Arquitetura](architecture.md#etapas-de-implementação).

## Usuários

- Responsável: usa o mobile para autenticar-se, consultar computadores autorizados, parear/revogar vínculos, alterar restrições e acompanhar se foram aplicadas.
- Administrador local do Lux: autoriza o pareamento (app Piplup ou `lux-agent pair`, senha de administrador) e operações locais que exigirem permissão.
- Criança/conta gerenciada: utiliza o computador sujeito às políticas nativas; essa conta não equivale à conta do responsável na API.
- Administrador do backend: invalida a identidade do computador quando necessário; o provisionamento manual fica para desenvolvimento, pois o Agent se registra no pareamento.

## Funcionalidades previstas

O produto prevê autenticação real do responsável, cadastro e listagem de computadores, pareamento seguro por QR Code e revogação de vínculos. Também prevê consulta e alteração remotas de controles parentais, incluindo limites de tempo, controles de aplicativos, instalação e faixa etária. Esses controles dependem das capacidades comprovadas no GNOME/Lux e podem exigir ajuste do escopo.

O foco principal do projeto acadêmico é a experiência mobile e sua integração com o sistema do computador. O planejamento de integração não compromete a entrega mobile, que pode ser demonstrada com mocks. A aplicação local das restrições ocorre no computador, por meio do GNOME e do agente; o celular é um cliente remoto.

## MVP planejado

O primeiro MVP deverá reunir autenticação real, gerenciamento de dispositivos e pareamento seguro. A integração parental real será incremental após a prova técnica no Lux; os controles candidatos não são todos requisitos obrigatórios do MVP. Consulte as etapas em [Arquitetura](architecture.md).

## Fora de escopo

Criar um mecanismo próprio de bloqueio parental ou modificar o código-fonte do GNOME/Controle Parental. Nesta entrega também ficam de fora: pedidos de instalação reais vindos do computador, pacote `.deb`, atualização automática do Agent e detecção de mudanças feitas localmente no Controle Parental do GNOME. Horário de dormir e classificação etária reais são opcionais; no computador real, perfis aplicam só apps, navegadores e instalação.

## Referências e limites

Os identificadores RF e comportamentos do protótipo PDF são referências visuais/de produto, não requisitos técnicos validados. Pedidos temporários de liberação, encerramento automático de aplicativos, contagem de tentativas e fila offline precisam de decisão própria e validação técnica antes de entrarem no escopo.

O serviço de mock pode sustentar o desenvolvimento acadêmico e a interface. Uma resposta simulada não comprova que a operação existe no Lux nem que uma restrição foi aplicada.

## Questões em aberto

- Comportamento do app quando o computador fica offline por muito tempo (hoje a alteração fica pendente até o Agent voltar).
- Quais funções além do MVP priorizar depois da entrega.
