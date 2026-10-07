# Produto

## Propósito e atores

O piplup permite que um responsável consulte e altere, pelo celular, configurações parentais existentes em computadores Lenovo Lux. A conta gerenciada pertence à criança/dependente. O mobile é uma interface remota; a aplicação das restrições pertence ao GNOME/Lux.

## Escopo desta entrega

Configuração Expo e perfis EAS, execução no Expo Go e preservação das rotas/layouts existentes. Quatro telas oferecem um fluxo demonstrativo de login, início, computadores e pareamento com dados simulados; o pareamento aparece na própria tela e mantém o computador fictício apenas em memória. O MySQL local está configurado para desenvolvimento futuro do backend, sem API conectada ao mobile ou integração com Linux.

## Funcionalidades candidatas

Autenticação do responsável, pareamento por QR Code, listagem de computadores, consulta e alteração de configurações parentais e revogação de vínculos. Dependem da definição do MVP e da viabilidade da integração.

Os identificadores RF e comportamentos do PDF são referências do protótipo, não requisitos técnicos validados. Pedidos temporários de liberação, encerramento automático de aplicativos, contagem de tentativas e fila offline precisam de decisão e investigação próprias.

## Fora do escopo atual

Produto completo, mecanismo próprio de controle parental, autenticação real, backend executável, schema MySQL e Lux Agent. A entrega acadêmica deve poder funcionar com mocks.

## OPEN QUESTION

- Qual o MVP final e quais funções o GNOME instalado no Lux realmente oferece?
- Qual o comportamento esperado quando o computador estiver desconectado?
- Quais contas gerenciadas e permissões um responsável poderá administrar?
