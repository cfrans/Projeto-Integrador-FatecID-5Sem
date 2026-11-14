# Testes

## Cobertura e limites

| Camada | Ferramenta / localização | O que verifica |
| --- | --- | --- |
| Backend unitário | Vitest, `backend/src/**/*.spec.ts` | Regras de autenticação, consultas, contratos e tratamento de falhas com persistência substituída |
| API HTTP | Vitest/Supertest, `backend/test/app.e2e-spec.ts` | Guards, DTOs, rotas e status HTTP com Prisma substituído |
| Banco e API reais | Node test runner, `backend/test/*.mysql-test.mjs` e `*.mysql-serial-test.mjs` (à parte) | Migrations, autenticação, isolamento, concorrência, relatórios, comandos e objetos SQL em MySQL 8.4 |
| Mobile | `mobile/scripts/api.test.mjs` | Contratos, seleção, traduções, temas, armazenamento, prazos locais, perfis e falhas |
| Client | `simulated-client/test/` | Cadastro, identidade, sincronização, pedidos e integração com serviços mobile/API/MySQL |
| Interface web | Cypress 16.2.1, `e2e/cypress/e2e/mvp.cy.js` | Login/erro, restrições pendentes e confirmadas, recusa de instalação, falha de rede e revogação |

Cypress testa a **versão web do mesmo aplicativo Expo**, servida a partir de uma exportação de produção, com NestJS/MySQL e o client simulado reais. O pareamento é preparado por chamadas reais à API nos fixtures; a leitura da câmera não é automatizada. Somente o cenário de indisponibilidade intercepta uma requisição para induzir falha. Não há respostas de sucesso falsas substituindo a integração.

Os casos usam contas e PCs aleatórios, separados por teste, e removem apenas seus fixtures. A suíte exige `NODE_ENV=test`, banco terminado em `_test` e execução no container de testes. Não execute testes MySQL contra o banco de uso diário.

Câmera, permissões, armazenamento nativo, acessibilidade e navegação Android/iOS continuam no [roteiro em aparelho](mobile.md#validação-manual-no-celular). Cypress não comprova políticas no Lux nem substitui testes nativos. [Limites oficiais](https://docs.cypress.io/app/references/trade-offs).

## Execução completa em Docker

Use Docker já instalado e em execução. A imagem de testes contém Node, Cypress e navegador; as instalações npm e a execução acontecem dentro do container. Não é necessário instalar Cypress ou abrir navegador no host. O primeiro build baixa a imagem e dependências.

Crie um arquivo privado **fora do repositório**, com credenciais exclusivas de teste:

```dotenv
MYSQL_DATABASE=piplup_academic_test
MYSQL_USER=piplup_test
MYSQL_PASSWORD=<senha-aleatoria-de-teste>
JWT_SECRET=<segredo-aleatorio-de-pelo-menos-32-bytes>
```

Na raiz, substitua o caminho do arquivo:

```bash
docker compose -p piplup-tests --env-file /caminho/privado/test.env -f docker-compose.test.yml run --build --rm tests
```

O Compose usa MySQL 8.4 em `tmpfs`, sem publicar portas nem reutilizar o volume do desenvolvimento. A suíte gera Prisma, aplica migrations, compila a API, executa os testes MySQL e a integração do client, exporta o mobile web e executa Cypress em modo headless. Os passos são sequenciais: compilar novamente enquanto outra suíte usa `backend/dist` pode invalidar seus imports.

`PIPLUP_TEST_BROWSER` seleciona o navegador disponível na imagem. O padrão é Electron; pode ser alterado para Firefox no arquivo privado. A [imagem oficial](https://github.com/cypress-io/cypress-docker-images/tree/master/included) fornece os executáveis dentro do container.

Depois de conferir os resultados, remova os containers **somente desse projeto de testes**:

```bash
docker compose -p piplup-tests --env-file /caminho/privado/test.env -f docker-compose.test.yml down
```

Ao remover o container MySQL, o banco em memória é descartado. Nenhum comando acima remove o volume `mysql_data` do desenvolvimento.

## Evidências

Cypress gera relatório JUnit em `e2e/results/` e captura de tela quando um cenário falha, em `e2e/cypress/screenshots/`. Esses artefatos são ignorados pelo Git. As credenciais dos fixtures são temporárias e os comandos de digitação não as registram no Command Log. As saídas Node dos testes de integração informam casos aprovados/falhos no terminal.

Um arquivo de teste existente não é evidência de aprovação. Ao registrar uma execução, informe data, commit/diff, ferramenta, ambiente, quantidade de casos, falhas e limitações. A validação final precisa corresponder aos arquivos atuais, após todas as correções.

Os comandos individuais de lint/typecheck/unitários continuam em [Backend](backend.md#verificações), [Mobile](mobile.md#configuração-e-verificações) e [Client](simulated-client.md#verificações). Não execute suites de integração em paralelo com processos que recompilam a mesma saída.

## Validação em 09/11/2026

Executada sobre o diff local da branch `Caio-Franson`, com base em `a85771b`, sem novo commit. A execução final ocorreu em containers Linux/ARM64, Node 24.22.0, MySQL 8.4 e Cypress 16.2.1/Electron 146. As dez migrations foram aplicadas em um banco vazio de testes.

| Verificação | Resultado |
| --- | --- |
| Backend: lint, typecheck, build e validação Prisma | Passaram |
| Backend: Vitest unitário / HTTP | 37 / 7 aprovados |
| Backend: Node/MySQL, incluindo objetos SQL | 27 aprovados |
| Integração serviços mobile + API + MySQL + client | 1 aprovado |
| Mobile: lint, typecheck e testes de contratos | Passaram; 81 testes aprovados |
| Client: lint e testes isolados | Passaram; 13 testes aprovados |
| Cypress: login, restrições, pedido, rede e revogação | 5 aprovados, sem falhas |
| Scripts E2E: verificação de sintaxe | Passou |

O relatório Cypress aprovado é `e2e/results/mvp-577c2533ca176f6d9ddc7d9619da7c48.xml`, um artefato local ignorado pelo Git. As tentativas iniciais no host tiveram falhas durante os ajustes e não são a evidência final. Os downloads de Cypress/PlantUML feitos no host foram removidos; os containers temporários foram encerrados. Nenhuma migration foi aplicada ao banco de uso diário. O aceite em aparelho físico e o ensaio da apresentação continuam pendentes.
