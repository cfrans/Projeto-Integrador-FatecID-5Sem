# Mobile

Expo + React Native + TypeScript estrito + Expo Router. Dependências e comandos vivem em `mobile/`; instalação reproduzível com `npm ci`. Consulte o README da raiz para execução. O mobile é a interface remota do responsável: restrições só poderão ser aplicadas no computador Lux pelo GNOME/agente, após a integração ser validada.

## Organização

- `src/app`: somente rotas/layouts; cada rota compõe sua tela de feature ou o `Screen` para placeholders, sem regras ou HTTP.
- `src/components/Screen.tsx`: estrutura compartilhada dos placeholders ainda não implementados.
- `src/theme`: tokens e tema de navegação já existentes; preservados para evitar reorganização estética.
- `src/features/auth`: login REST, serviço de autenticação, sessão compartilhada e armazenamento do token.
- `src/features/devices`: Home e lista carregam registros da API; o cartão distingue conexão não validada e fixtures de demonstração.
- `src/features/pairing`: tela visual de pareamento demonstrativo; não ativa câmera nem verifica QR.
- `src/mocks/devices.ts`: listagem de três computadores fictícios e serviço de pareamento simulado.
- `src/components/ui`: componentes de interface compartilhados usados pelas features.

Criar hooks, stores, lib ou outras features apenas quando houver responsabilidade concreta. UI de uma única feature permanece nela. Estado local permanece em React até haver necessidade real de compartilhamento global.

## Rotas preservadas

`/`, `/home`, `/computers` e `/qr-scan` formam o fluxo de login, início, computadores e simulação de pareamento. Login, Home, lista e pareamento usam telas de feature. `/pairing-done`, `/access-request`, `/sync-failure`, `/about` e `/restrictions/{browsers,apps,install,age}` continuam como oito rotas placeholder, fora do fluxo implementado. Stack principal e Tabs foram preservados; a existência de uma rota não confirma viabilidade da funcionalidade.

## Autenticação e API

`src/lib/api.ts` é o cliente HTTP compartilhado. Ele prioriza `EXPO_PUBLIC_API_URL`, validada como URL HTTP/HTTPS sem credenciais, consulta ou fragmento; caminhos base são permitidos. Sem essa variável, no modo de desenvolvimento usa o host informado pelo Expo apenas quando `hostUri` contém um IPv4 privado RFC1918 e aponta a API para a porta `3000`. O adaptador `src/lib/api-runtime.ts` fornece `Constants.expoConfig?.hostUri` somente em desenvolvimento. Endereços ausentes, loopback, públicos, IPv6 e túneis não geram uma URL presumida: inicie o Expo no modo LAN ou configure `EXPO_PUBLIC_API_URL`. O cliente aplica timeout, envia `Authorization: Bearer` nas solicitações autenticadas e diferencia configuração, indisponibilidade, validação e sessão não autorizada. Respostas `401` invalidam a sessão somente quando pertencem ao token ainda ativo; uma resposta atrasada de uma sessão anterior não encerra uma sessão mais recente.

O contrato atual é `POST /auth/login` com `{ email, password }`, que retorna `{ accessToken, expiresIn, guardian }`, e `GET /auth/me`, que retorna `{ id, name, email }`. A senha fica apenas no estado do formulário e é limpa depois do envio. A sessão consulta `/auth/me` ao restaurar um token, usa `expiresIn` para a validade local e encerra automaticamente quando expira. Não há refresh token nem endpoint de logout no servidor; sair remove o token local. Erros de conexão durante a restauração mantêm o token para uma nova tentativa. Acesso às rotas existentes é controlado com `Stack.Protected` após a restauração.

No Android e iOS, o token e a data de expiração são armazenados com `expo-secure-store`. No navegador, a sessão fica somente em memória e termina ao recarregar a página; o app não grava tokens em `localStorage`. Erros ao ler, gravar ou remover a sessão segura são mostrados na interface, sem tratar uma falha de rede como logout.

Copie `mobile/.env.example` para `mobile/.env.local` apenas quando for configurar uma URL explícita; vazio mantém o modo automático de desenvolvimento quando o host LAN do Expo é um IPv4 privado. Por exemplo:

```env
EXPO_PUBLIC_API_URL=http://192.168.1.10:3000
```

Esse valor é incorporado ao app e não pode conter segredos. Use HTTPS fora do desenvolvimento local. Em simuladores, use o endereço do host acessível pelo simulador; um celular físico precisa do endereço LAN do computador que hospeda a API. `backend/src/main.ts` faz o bind em `0.0.0.0`, e o Compose publica a porta HTTP em todas as interfaces do host (`3000` por padrão). Nos dois modos, o firewall e a rede precisam permitir acesso pelo celular. MySQL continua publicado somente em `127.0.0.1` no Docker. Não use `localhost` no celular para alcançar o computador. Erros de rede mostram a URL efetivamente utilizada, sem headers ou credenciais; teste essa URL com `/health` no navegador do celular.

O modo automático pressupõe Metro e API no mesmo computador, API na porta `3000` e host do Expo alcançável pelo aparelho. No WSL2 com NAT, o host privado informado pelo Expo pode ser o IP interno da VM; ele não comprova acesso pela LAN. Configure a URL com o IP LAN do Windows e disponibilize a porta da API, ou use rede espelhada quando suportada. Se alterar `PORT`, usar outro servidor, emulador ou iniciar o Expo com `--tunnel`, configure `EXPO_PUBLIC_API_URL` explicitamente e reinicie o Expo/recarregue o app. O túnel do Expo expõe o Metro, não a API NestJS. Consulte [rede WSL](https://learn.microsoft.com/en-us/windows/wsl/networking) e [Expo CLI](https://docs.expo.dev/more/expo-cli/).

## Dados e mock

`devices.listPairedComputers()` consulta `GET /devices` com o bearer token da sessão e valida toda a resposta antes de exibi-la. O contrato atual traz `{ id, name, managedUser, status, lastSeen, isDemo }`: `id` é UUID, `managedUser` é `string` ou `null`, `status` é `unverified`, `lastSeen` é `null` e `isDemo` é booleano. A API ainda não valida a conexão do computador; por isso a interface mostra “Conexão não validada” e “Pareamento pendente”, sem afirmar que ele está online ou offline. Uma resposta inválida ou falha da API aparece como erro e não ativa fallback para mock. Erros `401` invalidam a sessão; indisponibilidade do serviço (`503`) mantém a mensagem da API. Home e lista recarregam ao recuperar foco e mostram carregamento, erro com nova tentativa ou lista vazia.

`src/mocks/devices.ts` preserva três registros fictícios com `isDemo: true` e estados demonstrativos online/offline; a listagem atual não os consome. `pairingDemo.simulatePairing()` adiciona um registro fictício, idempotente e mantido apenas em memória, exibido na própria confirmação da simulação. O serviço de listagem usa apenas a API e permanece separado desse mock: simular pareamento não altera a lista do backend. A tela não lê QR, autentica nem conecta ao Lux.

O login e a sessão usam o contrato REST de autenticação descrito acima. A leitura da lista também é real; pareamento, criação, edição e remoção de dispositivos não estão implementados. Pareamento seguro e controles parentais continuam pendentes e dependerão de contratos e capacidades comprovadas no GNOME/Lux.

## UI e segurança

Antes de implementar UI, consultar [design](design.md) e o protótipo correspondente. Verificar React Native Reusables antes de criar componentes genéricos. Usar tokens existentes, padrões mobile e compatibilidade Android/iOS. O único módulo nativo adicionado nesta etapa é `expo-secure-store`, compatível com Expo Go; o fluxo de câmera/QR continua inativo. Se uma futura dependência nativa não estiver incluída no Expo Go, será necessário configurar um development build e ajustar o fluxo EAS conforme a documentação Expo da versão instalada. Os perfis EAS existentes são configuração, não evidência de build publicado ou de funcionalidade nativa disponível.

Nunca armazenar senha root/admin ou tratar QR como credencial administrativa permanente. A sessão usa armazenamento seguro nativo e não persiste credenciais no navegador.

## Configuração e verificações

Entrada `expo-router/entry`, plugin `expo-router`, scheme `piplup` e alias `@/*` para `src/*`. TypeScript inclui tipos gerados do Expo. Sem configuração Babel/Metro personalizada enquanto o padrão atender ao projeto.

Executar `npm run lint`, `npm run typecheck` e `npm run test:api` em `mobile/`. Para validar os bundles nativos sem gerar projetos locais, usar `npx expo export --platform android --platform ios --output-dir /tmp/lux-mobile-export`. Não gerar/editar `ios/` e `android/` manualmente; configuração nativa pertence ao app config e plugins. Novos módulos nativos podem exigir development build.

Na validação desta etapa passaram lint, typecheck, 11 testes do cliente/contrato e export Android/iOS. O cliente HTTP consumiu login, perfil e dispositivos de uma API compilada conectada ao MySQL real de teste. Interação da UI, armazenamento nativo e navegação em aparelho físico ainda precisam de validação; exportar bundles não comprova esses comportamentos no dispositivo.

ESLint foi mantido na série 9: a série 10 falhou ao carregar `react/display-name` por uso de `getFilename` no plugin React. A versão 9 também emite aviso de fim de suporte; revisar a atualização quando a configuração/plugins Expo suportarem a série 10. A configuração flat utiliza `eslint-config-expo`, sem regras adicionais arbitrárias.

O `.npmrc` preexistente com `legacy-peer-deps=true` foi preservado; não representa uma nova decisão de dependências. Na instalação/auditoria deste bootstrap, npm reportou 29 vulnerabilidades (10 moderadas, 19 altas), incluindo dependências transitivas das ferramentas Expo/React Native/ngrok. O relatório chegou a sugerir downgrades incompatíveis de Expo/React Native; não aplicar `npm audit fix --force` sem avaliar compatibilidade e cada advisory. A auditoria permanece pendente de resolução; lint/typecheck/doctor não atestam segurança das dependências.

Referências: [instalação do Router](https://docs.expo.dev/router/installation/) e [lint do Expo](https://docs.expo.dev/guides/using-eslint/).
