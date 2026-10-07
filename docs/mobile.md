# Mobile

Expo + React Native + TypeScript estrito + Expo Router. Dependências e comandos vivem em `mobile/`; instalação reproduzível com `npm ci`. Consulte o README da raiz para execução.

## Organização

- `src/app`: somente rotas/layouts; cada rota compõe sua tela de feature ou o `Screen` para placeholders, sem regras ou HTTP.
- `src/components/Screen.tsx`: estrutura compartilhada dos placeholders ainda não implementados.
- `src/theme`: tokens e tema de navegação já existentes; preservados para evitar reorganização estética.
- `src/features/devices`: Home, cartão de computador e serviço com o contrato provisório de listagem.
- `src/mocks/devices.ts`: implementação simulada do serviço, com três computadores fictícios.
- `src/components/ui`: componentes de interface compartilhados usados pelas features.

Criar hooks, stores, lib ou outras features apenas quando houver responsabilidade concreta. UI de uma única feature permanece nela. Estado local permanece em React até haver necessidade real de compartilhamento global.

## Rotas preservadas

`/`, `/home`, `/computers`, `/qr-scan`, `/pairing-done`, `/access-request`, `/sync-failure`, `/about` e `/restrictions/{browsers,apps,install,age}`. Stack principal e Tabs de restrições foram mantidos. Login e Home já usam telas de feature; as outras rotas ainda são placeholders, sem fluxo interativo completo. A existência de uma rota não confirma viabilidade da funcionalidade.

## Dados e mock

Consumidores chamam `devices.listPairedComputers()`, que retorna `Promise<PairedComputer[]>`. O contrato provisório traz `id`, `name`, `status` (`online`/`offline`), `managedUser` e `lastSeen` em ISO 8601 ou `null`. A Home consome o serviço, atualiza a lista ao recuperar foco e apresenta carregamento, erro com nova tentativa, lista e estado vazio; ela não importa `src/mocks`.

O mock fornece três registros fictícios para demonstrar a listagem e os estados de conexão. Eles não representam pareamento, autenticação ou conexão Linux reais. Para usar API real, implementar `DevicesSource` via HTTP no serviço da feature e trocar a seleção exportada.

Ainda não há base URL, cliente HTTP, autenticação ou fallback automático para mock. Endpoints e erros dependem do contrato acordado com o backend.

## UI e segurança

Antes de implementar UI, consultar [design](design.md) e o protótipo correspondente. Verificar React Native Reusables antes de criar componentes genéricos. Usar tokens existentes, padrões mobile e compatibilidade Android/iOS.

Quando houver tokens/segredos, preferir SecureStore. Nunca armazenar senha root/admin ou tratar QR como credencial administrativa permanente.

## Configuração e verificações

Entrada `expo-router/entry`, plugin `expo-router`, scheme `piplup` e alias `@/*` para `src/*`. TypeScript inclui tipos gerados do Expo. Sem configuração Babel/Metro personalizada enquanto o padrão atender ao projeto.

Executar lint e typecheck antes de concluir alterações. Adicionar testes de comportamento quando a primeira feature os justificar. Não gerar/editar `ios/` e `android/` manualmente; configuração nativa pertence ao app config e plugins. Novos módulos nativos podem exigir development build.

ESLint foi mantido na série 9: a série 10 falhou ao carregar `react/display-name` por uso de `getFilename` no plugin React. A versão 9 também emite aviso de fim de suporte; revisar a atualização quando a configuração/plugins Expo suportarem a série 10. A configuração flat utiliza `eslint-config-expo`, sem regras adicionais arbitrárias.

O `.npmrc` preexistente com `legacy-peer-deps=true` foi preservado; não representa uma nova decisão de dependências. Na instalação/auditoria deste bootstrap, npm reportou 29 vulnerabilidades (10 moderadas, 19 altas), incluindo dependências transitivas das ferramentas Expo/React Native/ngrok. O relatório chegou a sugerir downgrades incompatíveis de Expo/React Native; não aplicar `npm audit fix --force` sem avaliar compatibilidade e cada advisory. A auditoria permanece pendente de resolução; lint/typecheck/doctor não atestam segurança das dependências.

Referências: [instalação do Router](https://docs.expo.dev/router/installation/) e [lint do Expo](https://docs.expo.dev/guides/using-eslint/).
