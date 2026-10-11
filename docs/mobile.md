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

## WSL2 e firewall

Com **Docker Desktop no Windows**, abra o Desktop, aguarde o Engine iniciar e habilite a integração da distribuição em Settings → Resources → WSL Integration. Execute o Compose no WSL, teste `http://localhost:3000/health` no Windows e use o IPv4 do adaptador ativo (Ethernet ou Wi-Fi) mostrado por `ipconfig` para o celular. O Docker Desktop encaminha a porta publicada ao host Windows; não é necessário criar um portproxy por padrão. Se o Windows acessa a API, mas o celular não, confira o firewall e o isolamento de clientes do Wi-Fi. Veja [rede Docker Desktop](https://docs.docker.com/desktop/features/networking/).

Evite manter simultaneamente Docker Desktop e um Docker Engine instalado diretamente no Ubuntu WSL. Eles podem manter containers distintos na mesma porta; excluir o repositório não remove containers nem suas políticas de reinício. Se optar pelo Desktop, confirme o Engine local com `pgrep -a dockerd` e `systemctl is-active docker.service docker.socket`. Parar/desabilitar essas unidades interrompe os containers desse Engine sem apagar dados; avalie os serviços existentes antes de fazê-lo. A CLI deve usar a integração Desktop. Veja [Docker Desktop/WSL](https://docs.docker.com/desktop/features/wsl/).

Com **NestJS direto no WSL ou Docker Engine dentro da distribuição**, o NAT padrão do WSL2 precisa de encaminhamento para acesso LAN. Como alternativa, Windows 11 22H2 ou posterior oferece `networkingMode=mirrored`; siga a configuração e as regras Hyper-V na [documentação WSL](https://learn.microsoft.com/en-us/windows/wsl/networking). Não altere o modo de rede sem considerar os serviços que já utiliza.

Para encaminhar somente a API no modo NAT, primeiro confirme que a porta Windows está livre. No PowerShell, descubra o IP do Wi-Fi com `ipconfig` e o IP da distribuição com `wsl hostname -I`. Use o IP da distribuição que executa o servidor; não copie um endereço Docker/VPN. No PowerShell **como administrador**, substitua os valores abaixo pelos IPs encontrados (e `3000` por `PORT`, se mudou):

```powershell
netsh interface portproxy add v4tov4 listenaddress=<IP_LAN_WINDOWS> listenport=3000 connectaddress=<IP_WSL> connectport=3000
```

Esse comando encaminha a porta no IP LAN do Windows ao backend WSL. Não o use sobre a porta já publicada pelo Docker Desktop. O endereço WSL pode mudar após reiniciar a distribuição; atualize o encaminhamento nesse caso. Confira as regras com `netsh interface portproxy show all`.

Confira o perfil com `Get-NetConnectionProfile`. Regras explícitas `Block` para `com.docker.backend` no perfil ativo prevalecem sobre permissões de porta. Para consultar essas regras no PowerShell:

```powershell
Get-NetFirewallApplicationFilter -PolicyStore ActiveStore |
  Where-Object { $_.Program -like '*com.docker.backend*' } |
  Get-NetFirewallRule |
  Format-List Name, Enabled, Direction, Action, Profile
```

Somente numa rede doméstica confiável, classifique a interface correta como privada, no PowerShell como administrador, substituindo o nome abaixo pelo mostrado em `Get-NetConnectionProfile`:

```powershell
Set-NetConnectionProfile -InterfaceAlias "<INTERFACE>" -NetworkCategory Private
```

Isso mantém o firewall ligado e passa a usar todas as regras do perfil Private, incluindo eventuais permissões de descoberta/compartilhamento e do Docker; não se limita à API. Não classifique redes desconhecidas como privadas. Uma regra específica não restringe outra permissão mais ampla já existente. Consulte [precedência de regras](https://learn.microsoft.com/en-us/windows/security/operating-system-security/network-security/windows-firewall/rules) e [perfil de conexão](https://learn.microsoft.com/en-us/powershell/module/netconnection/set-netconnectionprofile).

Se faltar uma permissão de entrada numa rede **privada e confiável**, uma regra limitada à porta da API e à sub-rede local pode ser criada no PowerShell como administrador:

```powershell
New-NetFirewallRule -Name PiplupApiDev -DisplayName "Piplup API dev" -Direction Inbound -Action Allow -Protocol TCP -LocalPort 3000 -Profile Private -RemoteAddress LocalSubnet
```

A regra permite entrada na porta indicada; se já existe uma permissão aplicável ao Docker, ela pode ser desnecessária. Políticas corporativas, VPNs e firewall Hyper-V podem exigir ajustes pelo administrador. Não desative o firewall inteiro. Para remover somente essa configuração quando deixar de utilizá-la:

```powershell
netsh interface portproxy delete v4tov4 listenaddress=<IP_LAN_WINDOWS> listenport=3000
Remove-NetFirewallRule -Name PiplupApiDev
```

Remova apenas as regras que você criou. Os comandos seguem as referências [portproxy](https://learn.microsoft.com/en-us/windows-server/administration/windows-commands/netsh-interface) e [New-NetFirewallRule](https://learn.microsoft.com/en-us/powershell/module/netsecurity/new-netfirewallrule). Esses ajustes dependem da máquina e não são executados pelos scripts do projeto.

Para o Metro, `npx expo start` usa LAN e normalmente a porta `8081`; essa porta também precisa ser alcançável ao usar LAN. Se o QR do Expo no WSL não conectar, `npx expo start --tunnel` é uma alternativa, com `EXPO_PUBLIC_API_URL` apontando explicitamente à API já acessível. Isso evita encaminhar Metro manualmente e não substitui o teste da porta da API.

## Validação manual no celular

1. Inicie o backend pelo modo escolhido; prepare a conta/fixtures conforme o [tutorial](../README.md).
2. Com celular e computador na mesma rede, abra `http://<IP_LAN>:<PORT>/health` no navegador do aparelho. Espere `{ "status": "ok", "database": "ok" }`. No WSL, use o IP LAN do Windows e confira a exposição da porta acima.
3. Inicie Expo em `mobile/`, abra o QR no Expo Go e faça login com a conta criada. Confira a lista de dispositivos demonstrativos (ou a lista vazia se não criou fixtures).
4. Reabra o aplicativo e confira a restauração da sessão; a sessão expira após 30 minutos.
5. Pare apenas o backend e tente atualizar a listagem: deve aparecer erro de conexão, sem substituir os dados por mock ou invalidar a sessão por falha de rede. Inicie a API novamente e tente atualizar.
6. Confira se os erros de conexão mostram a URL da API sem expor senha, JWT ou outras credenciais.

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

ESLint usa a série 9 por compatibilidade com o plugin React e `eslint-config-expo`; a atualização para a série 10 depende do suporte dos plugins. A configuração flat utiliza `eslint-config-expo`, sem regras adicionais arbitrárias.

O `.npmrc` utiliza `legacy-peer-deps=true`. Confira dependências com `npm audit` e avalie compatibilidade antes de atualizar Expo/React Native ou aplicar correções automáticas.

Referências: [instalação do Router](https://docs.expo.dev/router/installation/) e [lint do Expo](https://docs.expo.dev/guides/using-eslint/).

## Builds com EAS

O projeto mantém perfis EAS para Android: `development` e `preview` geram APKs internos; `production` gera AAB para a Play Store. O perfil `development` não inclui `expo-dev-client`, então o desenvolvimento atual usa Expo Go. Build iOS de produção requer credenciais Apple. Estes comandos opcionais são executados em `mobile/`:

```bash
npx eas-cli@latest login
npx eas-cli@latest build:configure
npx eas-cli@latest build --platform android --profile preview
```

Para os demais perfis, substitua `preview` por `development` ou `production`. Consulte [configuração EAS](https://docs.expo.dev/build/eas-json/) e [builds APK](https://docs.expo.dev/build-reference/apk/).
