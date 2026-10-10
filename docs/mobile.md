# Mobile

Expo + React Native + TypeScript estrito + Expo Router. Dependências e comandos vivem em `mobile/`; instalação reproduzível com `npm ci`. Consulte o README da raiz para execução. O mobile é a interface remota do responsável: restrições só poderão ser aplicadas no computador Lux pelo GNOME/agente, após a integração ser validada.

## Organização

- `src/app`: somente rotas/layouts; cada rota compõe sua tela de feature ou o `Screen` para placeholders, sem regras ou HTTP.
- `src/components/Screen.tsx`: estrutura compartilhada dos placeholders ainda não implementados.
- `src/theme`: tokens e tema de navegação já existentes; preservados para evitar reorganização estética.
- `src/features/auth`: login REST, serviço de autenticação, sessão compartilhada e armazenamento do token.
- `src/features/devices`: Home, lista e cartão de computador, com serviço provisório de listagem.
- `src/features/pairing`: tela visual de pareamento demonstrativo; não ativa câmera nem verifica QR.
- `src/mocks/devices.ts`: listagem de três computadores fictícios e serviço de pareamento simulado.
- `src/components/ui`: componentes de interface compartilhados usados pelas features.

Criar hooks, stores, lib ou outras features apenas quando houver responsabilidade concreta. UI de uma única feature permanece nela. Estado local permanece em React até haver necessidade real de compartilhamento global.

## Rotas preservadas

`/`, `/home`, `/computers` e `/qr-scan` formam o fluxo demonstrativo de login, início, computadores e pareamento. Login, Home, lista e pareamento usam telas de feature. `/pairing-done`, `/access-request`, `/sync-failure`, `/about` e `/restrictions/{browsers,apps,install,age}` continuam como oito rotas placeholder, fora do fluxo implementado. Stack principal e Tabs foram preservados; a existência de uma rota não confirma viabilidade da funcionalidade.

## Autenticação e API

`src/lib/api.ts` é o cliente HTTP compartilhado. Ele lê `EXPO_PUBLIC_API_URL` em tempo de build, sem endereço padrão, aplica timeout, envia `Authorization: Bearer` nas solicitações autenticadas e diferencia configuração, indisponibilidade, validação e sessão não autorizada. Respostas `401` invalidam a sessão somente quando pertencem ao token ainda ativo; uma resposta atrasada de uma sessão anterior não encerra uma sessão mais recente.

O contrato atual é `POST /auth/login` com `{ email, password }`, que retorna `{ accessToken, expiresIn, guardian }`, e `GET /auth/me`, que retorna `{ id, name, email }`. A senha fica apenas no estado do formulário e é limpa depois do envio. A sessão consulta `/auth/me` ao restaurar um token, usa `expiresIn` para a validade local e encerra automaticamente quando expira. Não há refresh token nem endpoint de logout no servidor; sair remove o token local. Erros de conexão durante a restauração mantêm o token para uma nova tentativa. Acesso às rotas existentes é controlado com `Stack.Protected` após a restauração.

No Android e iOS, o token e a data de expiração são armazenados com `expo-secure-store`. No navegador, a sessão fica somente em memória e termina ao recarregar a página; o app não grava tokens em `localStorage`. Erros ao ler, gravar ou remover a sessão segura são mostrados na interface, sem tratar uma falha de rede como logout.

Configure `EXPO_PUBLIC_API_URL` no ambiente usado pelo Expo, por exemplo em `mobile/.env.local`:

```env
EXPO_PUBLIC_API_URL=http://192.168.1.10:3000
```

Esse valor é incorporado ao app e não pode conter segredos. Use HTTPS fora do desenvolvimento local. Em simuladores, use o endereço do host acessível pelo simulador; um celular físico precisa do endereço LAN do computador que hospeda a API. Para desenvolvimento local, `cd backend && npm run start:dev` inicia a API na porta `3000`; `backend/src/main.ts` faz o bind em `0.0.0.0`, então o celular na mesma rede pode usar o IP LAN do computador, desde que o firewall permita a conexão. O `docker-compose.yml` atual publica a API somente em `127.0.0.1`, portanto um celular físico não a alcança por padrão. Essa exposição padrão do Docker permanece restrita; não use `localhost` no celular para tentar alcançar o computador.

## Dados e mock

Consumidores chamam `devices.listPairedComputers()`, que retorna `Promise<PairedComputer[]>`. O contrato provisório traz `id`, `name`, `status` (`online`/`offline`), `managedUser` e `lastSeen` em ISO 8601 ou `null`. A Home consome o serviço, atualiza a lista ao recuperar foco e apresenta carregamento, erro com nova tentativa, lista e estado vazio; ela não importa `src/mocks`.

O mock fornece três registros fictícios para demonstrar a listagem e os estados de conexão. `pairingDemo.simulatePairing()` adiciona um quarto registro fictício, idempotente e mantido apenas em memória até o app ser reiniciado. Cada retorno da listagem e do pareamento é uma cópia dos dados internos. O fluxo não lê QR, autentica ou conecta ao Lux; a simulação não é contrato HTTP. Para usar API real na listagem, implementar `DevicesSource` via HTTP no serviço da feature e trocar a seleção exportada.

O login e a sessão já usam o contrato REST de autenticação descrito acima. A listagem de dispositivos e o pareamento ainda são demonstrativos e continuam no mock; esta etapa não conecta esses fluxos à API. Para a futura listagem real, o serviço de dispositivos deverá usar o mesmo cliente HTTP e sua invalidação de sessão em respostas `401`. Pareamento seguro, cadastro real de dispositivos e controles parentais continuam pendentes e dependerão de contratos e capacidades comprovadas no GNOME/Lux.

## UI e segurança

Antes de implementar UI, consultar [design](design.md) e o protótipo correspondente. Verificar React Native Reusables antes de criar componentes genéricos. Usar tokens existentes, padrões mobile e compatibilidade Android/iOS. O único módulo nativo adicionado nesta etapa é `expo-secure-store`, compatível com Expo Go; o fluxo de câmera/QR continua inativo. Se uma futura dependência nativa não estiver incluída no Expo Go, será necessário configurar um development build e ajustar o fluxo EAS conforme a documentação Expo da versão instalada. Os perfis EAS existentes são configuração, não evidência de build publicado ou de funcionalidade nativa disponível.

Nunca armazenar senha root/admin ou tratar QR como credencial administrativa permanente. A sessão usa armazenamento seguro nativo e não persiste credenciais no navegador.

## Configuração e verificações

Entrada `expo-router/entry`, plugin `expo-router`, scheme `piplup` e alias `@/*` para `src/*`. TypeScript inclui tipos gerados do Expo. Sem configuração Babel/Metro personalizada enquanto o padrão atender ao projeto.

Executar `npm run lint`, `npm run typecheck` e `npm run test:api` em `mobile/`. Para validar os bundles nativos sem gerar projetos locais, usar `npx expo export --platform android --platform ios --output-dir /tmp/lux-mobile-auth-export`. Não gerar/editar `ios/` e `android/` manualmente; configuração nativa pertence ao app config e plugins. Novos módulos nativos podem exigir development build.

ESLint foi mantido na série 9: a série 10 falhou ao carregar `react/display-name` por uso de `getFilename` no plugin React. A versão 9 também emite aviso de fim de suporte; revisar a atualização quando a configuração/plugins Expo suportarem a série 10. A configuração flat utiliza `eslint-config-expo`, sem regras adicionais arbitrárias.

O `.npmrc` preexistente com `legacy-peer-deps=true` foi preservado; não representa uma nova decisão de dependências. Na instalação/auditoria deste bootstrap, npm reportou 29 vulnerabilidades (10 moderadas, 19 altas), incluindo dependências transitivas das ferramentas Expo/React Native/ngrok. O relatório chegou a sugerir downgrades incompatíveis de Expo/React Native; não aplicar `npm audit fix --force` sem avaliar compatibilidade e cada advisory. A auditoria permanece pendente de resolução; lint/typecheck/doctor não atestam segurança das dependências.

Referências: [instalação do Router](https://docs.expo.dev/router/installation/) e [lint do Expo](https://docs.expo.dev/guides/using-eslint/).
