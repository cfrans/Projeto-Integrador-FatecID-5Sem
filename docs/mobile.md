# Mobile

Expo + React Native + TypeScript estrito + Expo Router; Button, Input e Card são adaptações locais de React Native Reusables, conforme [Design](design.md#react-native-reusables). Dependências e comandos vivem em `mobile/`; instalação reproduzível com `npm ci`. Consulte o README da raiz para execução. O mobile é a interface remota do responsável: restrições só poderão ser aplicadas no computador Lux pelo GNOME/agente, após a integração ser validada.

## Organização

- `src/app`: somente rotas/layouts; cada rota compõe sua tela de feature ou o `Screen` para placeholders, sem regras ou HTTP.
- `src/components/Screen.tsx`: estrutura compartilhada dos placeholders ainda não implementados.
- `src/theme`: paletas clara/escura, tokens de layout e factories dos temas de navegação; `src/features/theme/ThemeProvider.tsx` resolve e persiste a preferência.
- `src/features/auth`: login REST, serviço de autenticação, sessão compartilhada e armazenamento do token.
- `src/features/devices`: Home e lista carregam registros da API; o cartão distingue conexão não validada e fixtures de demonstração. `ComputerAppearanceProvider` compartilha os ícones personalizados, persistidos por conta em SecureStore no Android/iOS e localStorage no navegador (somente preferência visual, sem token).
- `src/features/pairing`: leitura de QR, validação e confirmação de vínculo pela API; estados e token temporário ficam na feature.
- `src/mocks/devices.ts`: listagem de três computadores fictícios e serviço de pareamento simulado.
- `src/components/ui`: componentes de interface compartilhados usados pelas features.

Criar hooks, stores, lib ou outras features apenas quando houver responsabilidade concreta. UI de uma única feature permanece nela. Estado local permanece em React até haver necessidade real de compartilhamento global.

## Convenções de ferramentas

Use npm e `package-lock.json`, executando comandos mobile em `mobile/`. Antes de escrever código com APIs Expo/React Native, confira a versão de `expo` em `package.json` e consulte `https://docs.expo.dev/versions/v<major>.0.0/`. Para Router, EAS e demais tópicos, consulte [o índice Expo](https://docs.expo.dev/llms.txt) e siga o documento específico; não dependa apenas de memória.

Instale dependências mobile com `npx expo install <package>` para resolver versões compatíveis com o SDK. Prefira módulos Expo recomendados e consulte as skills disponíveis antes de adicionar dependências. Use Expo Router para navegação, com `Link`, `router` e `useLocalSearchParams` de `expo-router`. Configuração nativa, limites do Expo Go e EAS estão nas seções de [UI e segurança](#ui-e-segurança), [verificações](#configuração-e-verificações) e [builds](#builds-com-eas).

## Carregamento de logos

As cinco fotos da equipe em Sobre são assets locais em `mobile/assets/team`, copiados dos avatares atuais do GitHub. Não dependem de internet nem acompanham futuras alterações dos perfis; somente os links externos continuam exigindo conexão.

`src/lib/image-assets.ts` centraliza todas as imagens raster do projeto: aplicativos, navegadores, aparelhos, equipe, interface e recursos de abertura, além dos ícones de voltar da Stack. A raiz antecipa o cache com `Image.prefetch` e mantém a tela de abertura até a conclusão, com limite de oito segundos para não impedir o acesso se um asset falhar ou a rede estiver lenta. No nativo, usa as mesmas URLs resolvidas pelos componentes; na web, `expo-asset` resolve os módulos. Mudanças de sessão tentam novamente falhas; imagens concluídas ou em andamento não duplicam pedidos. Imagens da interface desativam o fade Android. No Expo Go, a primeira abertura ainda baixa recursos do Metro; o sistema pode descartar o cache. Testes verificam cobertura do catálogo, deduplicação e repetição após falhas.

A Home mantém os cartões montados ao recuperar foco e consulta dados sem substituir a página por um estado de carregamento, preservando a posição da rolagem enquanto o conteúdo continua disponível. Falhas transitórias mantêm os últimos dados com aviso; falhas de autorização ou contrato limpam os dados. Uma remoção real de conteúdo pode reduzir a posição máxima rolável.

`postinstall` executa `scripts/patch-router.cjs` para remover os handles obsoletos de `InteractionManager` da Card do `expo-router` 57.0.24. No React Native 0.86 esses handles já são inoperantes; a alteração preserva animações, callbacks e gestos, sem suprimir logs nem trocar agendamento de tarefas. O script é idempotente, valida a versão e a estrutura esperadas e exige revisão ao atualizar o Router. Depois de instalar/aplicar, reinicie o Expo com `--clear` para descartar o bundle anterior. Testes verificam a alteração e a dependência instalada.

## Rotas e seleção de computador

`/`, `/home`, `/computers` e `/qr-scan` formam o fluxo de login, início, computadores e pareamento pela API. Os cartões com vínculo ativo abrem `/restrictions/browsers?deviceId=<UUID>`. As quatro abas compartilham a seleção em `RestrictionDeviceProvider`; somente computadores com vínculo ativo podem ser selecionados. Um único vínculo é selecionado automaticamente; vários vínculos exigem escolha. Um identificador ausente da lista ou revogado não é substituído por outro computador. A seleção fica somente em memória no fluxo de restrições e não é salva entre sessões. O seletor modal mostra nome e conta; trocar o PC preserva a aba. As abas usam `backBehavior="none"`: o retorno do sistema Android é encaminhado à Stack para sair das restrições para a tela anterior, como o botão do cabeçalho, em vez de selecionar Navegadores. O navegador das abas permanece montado durante carregamento e troca de seleção; somente o conteúdo de cada rota aguarda computador/configurações, evitando retornar à primeira aba.

`/restrictions/apps` consulta o inventário persistido do computador selecionado, e `/restrictions/install` consulta seus pedidos pendentes. A lista de aplicativos mostra o prazo local do último pedido aprovado correspondente, quando disponível neste aparelho; a consulta do histórico não transforma prazo local em restrição aplicada. Os contratos e a diferença entre relatório ausente e lista vazia estão em [Backend](backend.md#consultas-de-aplicativos-e-pedidos-de-instalação). As telas descartam respostas após perda de foco ou troca do computador. As quatro abas persistem configurações demonstrativas em `SimulationProvider`, com consulta periódica, revisão e confirmação pelo [client simulado](simulated-client.md). `/pairing-done` continua placeholder, fora do fluxo implementado.

`/access-request?deviceId=<UUID>&requestId=<UUID>` usa pedidos de instalação pendentes (`GET /devices/:id/installation-requests`); permitir ou recusar grava `installationDecisions` pela simulação (`PATCH /simulation/devices/:id`), apenas para PCs demonstrativos. A aprovação enviada não comprova aplicação no Lux. O backend não oferece justificativa, prazo ou encerramento automático.

Os prazos são informativos e locais: 30 min, 1 h, 2 h, até dormir, esta semana e sem limite. “Esta semana” termina na próxima segunda-feira às 00h, no fuso do aparelho; “Até dormir” usa a preferência configurada e avança para o dia seguinte quando o horário já passou. Datas de término são exibidas junto do horário. O prazo é salvo após a API aceitar a decisão, separado por responsável, computador, vínculo e pedido, em SecureStore no Android/iOS e localStorage na web. Falhas de leitura/escrita exibem aviso e nova tentativa, sem desfazer a decisão da API. O relógio não envia bloqueios; atingir zero não confirma bloqueio. “Encerrar liberação agora” envia `DENIED` à simulação. Um novo vínculo não reutiliza o prazo do anterior.

## Sincronização e perfis reutilizáveis

O menu da Home e as telas de restrições abrem **Sincronização** (`/sync-failure`) e **Perfis de restrição** (`/restriction-profiles`). Nas restrições, essas ações ficam no menu de três pontos dentro do cartão do PC e levam o computador selecionado. O menu flutua sobre a tela, sem reservar uma linha ou afastar o status do cartão; tocar fora ou voltar pelo sistema fecha o menu. A área de seleção do PC permanece separada do botão de ações. Na Home, Sincronização consulta todos os vínculos ativos e Perfis permite selecionar o destino.

Sincronização consulta dispositivos e snapshots demonstrativos a cada cinco segundos enquanto a tela está em foco e o app em primeiro plano. Mostra conexão, última comunicação, revisão enviada, revisão confirmada e data da confirmação. Falhas são isoladas por PC; uma falha da listagem remove os cartões anteriores. Respostas de outro vínculo não são aceitas. **Consultar novamente** somente lê a API; não reenvia alterações. Confirmação do client simulado não representa aplicação no Lux; PCs reais indicam integração indisponível.

Perfis salvam somente bloqueio de navegadores, as quatro exceções conhecidas, bloqueio de instalação e classificação etária. Regras por ID de aplicativo, pedidos, decisões e prazos permanecem no PC de destino. O perfil captura a configuração enviada à API, inclusive quando ainda aguarda o client. Aplicar exige confirmação do destino e envia uma única alteração parcial com controle de revisão existente; sucesso do envio não antecipa a confirmação do client. Mudanças no computador, vínculo ou revisão invalidam a confirmação aberta.

Até 20 perfis com nomes únicos de até 40 caracteres são guardados por responsável neste aparelho: SecureStore no Android/iOS e localStorage na web, com índice e registros separados para manter valores pequenos. Falhas de leitura não viram lista vazia nem autorizam sobrescrita; falhas de gravação não confirmam salvamento. Excluir um perfil não altera PCs configurados. Não há sincronização de perfis entre celulares nem novos endpoints. Testes automatizados cobrem isolamento, persistência, corrupção, falhas de armazenamento, limite, concorrência de escrita e estados de sincronização; conferir seleção, confirmação e aparência em aparelho.

## Banner de novos pedidos

`RequestBanner` consulta pedidos a cada cinco segundos enquanto o app está aberto, em primeiro plano e autenticado. A primeira consulta bem-sucedida de cada computador/vínculo estabelece uma referência silenciosa; novos IDs aparecem num cartão compacto sobre a interface, respeitando a área segura. **Ver pedido** abre a solicitação; com vários novos pedidos, **Ver pedidos** abre a lista. **Dispensar** remove o aviso sem alterar o pedido. Pedidos respondidos e vínculos revogados retiram os avisos na próxima consulta bem-sucedida. Troca de conta isola o acompanhamento, e pedidos já observados não são repetidos durante a sessão.

O banner usa os componentes do app em Android, iOS e web. Não solicita permissão do sistema nem usa `expo-notifications`, canais, patches ou serviços de push. Erros de conexão continuam nas telas de consulta; o banner não acrescenta uma faixa global de erro. Notificação push para uma futura build própria é uma possibilidade planejada, sem implementação nesta etapa.

## Pendências de implementação

Configurações e aprovação/recusa de instalação são persistidas para PCs demonstrativos. O app distingue salvamento, espera pelo client e aplicação simulada confirmada; temporizadores locais não representam sucesso. PCs reais exibem indisponibilidade dessa integração, sem controles que aparentem executar ações nativas. O comportamento futuro deve seguir o [fluxo de operações](architecture.md#fluxo-esperado-de-operações-parentais). O mobile se comunica apenas com NestJS, sem MySQL ou APIs GNOME locais.

## Autenticação e API

`src/lib/api.ts` é o cliente HTTP compartilhado. Ele prioriza `EXPO_PUBLIC_API_URL`, validada como URL HTTP/HTTPS sem credenciais, consulta ou fragmento; caminhos base são permitidos. Sem essa variável, no modo de desenvolvimento usa o host informado pelo Expo apenas quando `hostUri` contém um IPv4 privado RFC1918 e aponta a API para a porta `3000`. O adaptador `src/lib/api-runtime.ts` fornece `Constants.expoConfig?.hostUri` somente em desenvolvimento. Endereços ausentes, loopback, públicos, IPv6 e túneis não geram uma URL presumida: inicie o Expo no modo LAN ou configure `EXPO_PUBLIC_API_URL`. O cliente aplica timeout, envia `Authorization: Bearer` nas solicitações autenticadas e diferencia configuração, indisponibilidade, validação e sessão não autorizada. Respostas `401` invalidam a sessão somente quando pertencem ao token ainda ativo; uma resposta atrasada de uma sessão anterior não encerra uma sessão mais recente.

O idioma pode ser alterado em **Sobre o projeto → Idioma** entre português, inglês e espanhol. Na primeira abertura, sem preferência salva, o app detecta o idioma do dispositivo com `expo-localization`: variantes `pt-*` usam português, `es-*` usam espanhol e os demais usam inglês. O locale é reavaliado quando o app volta ao primeiro plano. Uma escolha manual é armazenada localmente e tem prioridade nas próximas aberturas; a chave versionada evita que uma preferência antiga impeça a detecção. A preferência atualiza login, cadastro, Home, computadores, pareamento, títulos de navegação, abas e telas de restrições. Novos textos devem consumir `useLanguage` e as chaves em `src/features/i18n/translations.ts`.

A seção "Pedidos de liberação" da Home mostra os três pedidos mais recentes da API; "Ver todos" abre `/access-requests`. Nessa tela, **Ver histórico** alterna para pedidos aprovados/recusados persistidos no relatório do vínculo atual; **Ver pendentes** retorna à lista original. O histórico informa o status, a data do pedido e o prazo local quando salvo neste aparelho. Não é uma trilha de auditoria permanente: o relatório do simulador é limitado e substituído a cada publicação. Não são injetados pedidos fictícios. As consultas são independentes por PC pareado: resultados disponíveis aparecem junto de um aviso de lista incompleta quando algum PC falha; a lista detalha o computador/erro e permite nova tentativa. Lista vazia só é anunciada após consultas bem-sucedidas. Falhas na consulta de dispositivos limpam os pedidos exibidos.

A barra superior da Home tem a engrenagem, que abre **Configurações**, e um menu hambúrguer com **Adicionar computador**, **Pedidos de liberação**, **Sobre o projeto** e **Sair**. `/settings` reúne seções com linhas que abrem e fecham ao tocar em "Alterar"/"Fechar" (uma por vez): **Sua conta** (alterar e-mail via `PATCH /auth/me/email`, atualizando a sessão ativa, e alterar senha via `PATCH /auth/me/password`), **Horário de dormir** (seletor de horário nativo em Android/iOS e campo de hora do navegador na web; padrão 21:30, guardado só no aparelho com SecureStore no Android/iOS e localStorage na web, com feedback de falha e nova tentativa; define o fim da opção "Até dormir" na liberação), **Idioma** e **Tema**. **Pergunta de segurança** (`GET` e `PUT /auth/me/security-question`: pergunta associada à conta e resposta salva como hash Argon2id no backend). **Esqueci minha senha** (login) abre `/forgot-password`: consulta a pergunta da conta (`POST /auth/recovery/question`), valida a resposta com limite de 5 tentativas por visita (`POST /auth/recovery/verify`) e redefine a senha no backend (`POST /auth/recovery/reset`).

O tema pode ser alterado em **Configurações → Tema** entre **Sistema**, **Claro** e **Escuro**. Sistema é o padrão e acompanha `useColorScheme()` enquanto o app está aberto; valores do sistema diferentes de `light` resolvem para escuro. A escolha manual é armazenada pelo `expo-secure-store` na chave `piplup.theme-preference`. As telas usam `useTheme`/`useThemedStyles` e as paletas em `src/theme/colors.ts`; o leitor de QR mantém o visor e seus overlays na paleta escura em qualquer preferência. O contêiner raiz, os conteúdos de navegação e o fundo nativo (`expo-system-ui`) acompanham a mesma paleta. A Stack raiz usa `expo-router/js-stack` com `slide_from_right` e `react-native-gesture-handler`, mantendo a tela de saída montada até a animação terminar. Essa alternativa oficial evita a remoção antecipada do conteúdo observada no retorno da Stack nativa no Expo Go; a animação usa o driver nativo no Android/iOS. O fundo dos cartões segue a paleta atual. O menu da Home usa a posição medida do cabeçalho e um modal que ocupa a área da barra de status, evitando somar o inset duas vezes. Conferir transições e alinhamento em aparelho, nos dois temas.

O contrato atual inclui `POST /auth/register` com `{ name, email, password }`, `POST /auth/login` com `{ email, password }`, que retorna `{ accessToken, expiresIn, guardian }`, e `GET /auth/me`, que retorna `{ id, name, email }`. A senha fica apenas no estado do formulário e é limpa depois do envio. A sessão consulta `/auth/me` ao restaurar um token, usa `expiresIn` para a validade local e encerra automaticamente quando expira. Não há refresh token nem endpoint de logout no servidor; sair remove o token local. Erros de conexão durante a restauração mantêm o token para uma nova tentativa. Acesso às rotas existentes é controlado com `Stack.Protected` após a restauração.

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

Remova apenas as regras criadas para essa configuração. Os comandos seguem as referências [portproxy](https://learn.microsoft.com/en-us/windows-server/administration/windows-commands/netsh-interface) e [New-NetFirewallRule](https://learn.microsoft.com/en-us/powershell/module/netsecurity/new-netfirewallrule). Esses ajustes dependem da máquina e não são executados pelos scripts do projeto.

Para o Metro, `npx expo start` usa LAN e normalmente a porta `8081`; essa porta também precisa ser alcançável ao usar LAN. Se o QR do Expo no WSL não conectar, `npx expo start --tunnel` é uma alternativa, com `EXPO_PUBLIC_API_URL` apontando explicitamente à API já acessível. Isso evita encaminhar Metro manualmente e não substitui o teste da porta da API.

## Validação manual no celular

1. Inicie o backend pelo modo escolhido; prepare a conta/fixtures conforme o [tutorial](../README.md).
2. Com celular e computador na mesma rede, abra `http://<IP_LAN>:<PORT>/health` no navegador do aparelho. Espere `{ "status": "ok", "database": "ok" }`. No WSL, use o IP LAN do Windows e confira a exposição da porta acima.
3. Inicie Expo em `mobile/`, abra o QR no Expo Go e faça login com a conta criada. Confira a lista de dispositivos demonstrativos (ou a lista vazia se não criou fixtures).
4. Reabra o aplicativo e confira a restauração da sessão; a sessão expira após 30 minutos.
5. Pare apenas o backend e tente atualizar a listagem: deve aparecer erro de conexão, sem substituir os dados por mock ou invalidar a sessão por falha de rede. Inicie a API novamente e tente atualizar.
6. Confira se os erros de conexão mostram a URL da API sem expor senha, JWT ou outras credenciais.
7. Em Configurações, alterne português, inglês e espanhol nos temas claro/escuro e Sistema. Confira títulos, erros, textos longos e retorno às telas; reinicie e confira preferências. Abra o seletor nativo de horário, confirme um horário de dormir, feche/reabra o formulário e reinicie o app para conferir o mesmo horário. Cancele o seletor e confira que o valor não mudou.
8. Com dois PCs demonstrativos, confira seleção, pedidos por PC e uma consulta indisponível: exibir os pedidos disponíveis com aviso de lista incompleta. Com relatórios vazios válidos em todos os PCs, não deve aparecer pedido fictício. Reative o serviço e use nova tentativa para remover o aviso.
9. Aprove um pedido com prazo, saia e reabra o detalhe: o prazo local deve permanecer e a data de término deve estar clara. Confira “Esta semana” e “Até dormir”, sem anúncio de bloqueio automático. Saia da conta e entre com outro responsável: nenhum prazo deve ser compartilhado. Revogue e refaça o vínculo: o prazo anterior não deve ser reutilizado.
10. Com fonte ampliada e TalkBack/VoiceOver, percorra botões, opções de prazo e formulários pelo foco. Confira leitura de rótulos/erros, opção selecionada, alvos de toque, contraste e ausência de corte em telas estreitas. Câmera/permissão, teclado nativo e leitores de tela precisam ser testados em aparelho.

Verificação desta alteração: testes automatizados cobrem traduções/temas, seleção/revogação, falhas de consulta, cálculos de prazo, restauração e isolamento por conta/vínculo, além de falhas de armazenamento. Bundles Android/iOS/web foram gerados com Node 24.22.0. A inspeção visual automatizada não foi concluída: o navegador integrado não alcançou o servidor local e o acesso ao Firefox expirou na ferramenta. Os passos em aparelho acima permanecem pendentes; exportação e testes não os substituem.

## Dados e mock

`devices.listPairedComputers()` consulta `GET /devices` com o bearer token e valida a resposta. O contrato traz `{ id, name, managedUser, status, lastSeen, isDemo, paired, associationId? }`. PCs reais/fixtures sem contato usam `unverified` e `lastSeen: null`. Somente PCs demonstrativos pareados com identidade válida têm presença `online`/`offline` e horário ISO, derivados do heartbeat do client (expira após 15 segundos). Isso não comprova conexão Linux. Home e lista atualizam no foco e a cada cinco segundos sem desmontar os cartões em consultas bem-sucedidas. Falhas da API aparecem como erro, nunca como offline ou fallback para mock; `401` invalida a sessão e `503` preserva a mensagem do serviço.

`src/mocks/devices.ts` preserva três registros fictícios com `isDemo: true` e estados demonstrativos online/offline; a listagem atual não os consome. O mock `pairingDemo.simulatePairing()` é preservado em memória para desenvolvimento, mas não autoriza dispositivos e não participa do fluxo real de leitura. Não é fallback para erro da API.

## Pareamento por QR e revogação

A integração está implementada nesta etapa. A tela `/qr-scan` usa `expo-camera`, compatível com o SDK 57, preservando a moldura, os tokens e os componentes existentes. A câmera exige permissão explícita; negativa ou ausência de suporte não implica falha de autenticação.

O QR aceito é `piplup://pair?token=<token-base64url>`, com token de 32 bytes aleatórios. Dados fora desse formato são rejeitados no mobile antes de enviar qualquer solicitação. O conteúdo não define o servidor: o app usa exclusivamente a API previamente configurada. Tokens não são persistidos, enviados em parâmetros de navegação ou registrados em logs.

O responsável autenticado envia `{ token }` para `POST /pairing/validate`, confere o computador retornado e confirma `POST /pairing/complete`. A validação não reserva o computador; expiração, consumo concorrente ou revogação entre as duas solicitações podem impedir a conclusão. O backend é a fonte de autorização, e a tela deve distinguir falha de rede de confirmação de vínculo. Depois de uma resposta perdida, consultar a lista é a forma de verificar se a operação chegou a concluir.

Uma associação persistida não comprova presença online. O campo `paired` distingue vínculo ativo de fixtures antigas. Presença demonstrativa depende de contato autenticado recente; PCs reais continuam com conexão não validada. Dispositivos `isDemo: true` permanecem identificados como demonstração, inclusive na confirmação. Nenhuma resposta simulada comprova integração real com o Lux.

A lista oferece remoção somente para vínculo ativo, com confirmação antes de `DELETE /devices/:id/association`. Depois da revogação, o dispositivo desaparece da lista daquele responsável. Não há exclusão do computador nem execução de controles Linux; outro responsável só poderá associar após uma nova sessão criada pelo Agent autorizado. O MVP permite um responsável ativo por Lux.

## Teste manual de pareamento com dispositivo de demonstração

Este roteiro usa Docker e um registro fictício com `isDemo: true`. O trecho Python solicita uma sessão autenticada como faria o futuro Agent; o vínculo é persistido pela API, mas nenhum computador físico é controlado. Não são testadas autorização administrativa Linux, instalação systemd ou integração GNOME. Identidades demonstrativas só autenticam em desenvolvimento/teste.

### 1. Preparar API e celular

Na raiz, com `.env` e a conta do responsável já preparados conforme [Backend](backend.md):

```bash
docker compose up -d --build
curl --fail http://localhost:3000/health
```

O rebuild é necessário para atualizar scripts do `package.json` dentro da imagem; evita `Missing script: "agent:provision"`. A inicialização aplica as migrations pendentes sem remover o volume MySQL.

No navegador do celular, confira `http://<IP_LAN>:<PORT>/health`. Se necessário, configure `EXPO_PUBLIC_API_URL` em `mobile/.env.local` conforme a seção de rede acima. Em um terminal, inicie Expo dentro de `mobile/`:

```bash
npx expo start
```

Abra o app no Expo Go e faça login. O QR do Expo abre o aplicativo; o QR de pareamento será lido dentro do app em **Computadores → Adicionar computador**.

### 2. Provisionar a fixture uma única vez

Em outro terminal, na raiz do repositório:

```bash
mkdir -m 700 -p /tmp/piplup-pairing-demo

docker compose run --rm --build \
  --volume /tmp/piplup-pairing-demo:/credentials \
  backend npm run agent:provision -- \
  --demo \
  --name "Lux de demonstração" \
  --output /credentials/agent-credential
```

Guarde o UUID exibido. A credencial fica em `/tmp/piplup-pairing-demo/agent-credential`, com permissão `0600`; não a copie para o mobile ou para geradores de QR. O comando cria um novo dispositivo sem responsável e recusa sobrescrever arquivos. Se essa credencial já existe, prossiga para a geração da sessão em vez de repetir o provisionamento. Use `run --rm` para que o build administrativo não interfira no backend em watch.

### 3. Preparar o gerador local

O gerador é uma ferramenta de desenvolvimento em `/tmp`, sem dependência adicional no projeto:

```bash
python3 -m venv /tmp/piplup-pairing-demo/qr-tools
/tmp/piplup-pairing-demo/qr-tools/bin/pip install qrcode
```

O pacote gera a imagem localmente, conforme sua [documentação](https://github.com/lincolnloop/python-qrcode). Não envie o conteúdo do QR para serviços externos.

### 4. Solicitar uma sessão e gerar o QR

Com a API iniciada, execute o trecho abaixo. Ajuste `3000` se a porta publicada for outra:

```bash
/tmp/piplup-pairing-demo/qr-tools/bin/python - <<'PY'
import json
import os
from pathlib import Path
from urllib.request import Request, urlopen

import qrcode
from qrcode.image.svg import SvgPathFillImage

folder = Path("/tmp/piplup-pairing-demo")
credential = (folder / "agent-credential").read_text().strip()

request = Request(
    "http://127.0.0.1:3000/agent/pairing-sessions",
    data=b"{}",
    headers={
        "Authorization": f"Bearer {credential}",
        "Content-Type": "application/json",
    },
    method="POST",
)

with urlopen(request, timeout=10) as response:
    session = json.load(response)

os.umask(0o077)
output = folder / "pareamento.svg"
qrcode.make(
    session["qrPayload"],
    image_factory=SvgPathFillImage,
).save(str(output))

print("QR salvo:", output)
print("Expira em:", session["expiresAt"])
PY
```

Abra `pareamento.svg` no navegador do computador. No WSL, abra a pasta no Explorador do Windows e escolha **Abrir com → Edge ou Chrome**:

```bash
explorer.exe "$(wslpath -w /tmp/piplup-pairing-demo)"
```

### 5. Confirmar e conferir o resultado

No celular, abra **Computadores → Adicionar computador**, permita a câmera, leia a imagem e confirme **Lux de demonstração**. A tela deve mostrar **Vínculo de demonstração criado**. Na lista, espere **Demonstração**, **Vínculo ativo** e **Conexão não validada**.

O QR expira em cinco minutos. Para renová-lo, repita somente a etapa 4 e atualize a imagem no navegador; criar outra sessão invalida a anterior. Depois de confirmar, uma nova sessão é recusada com `409` enquanto o vínculo estiver ativo. Para repetir o pareamento, remova o vínculo no app e gere uma nova sessão.

| Verificação | Resultado esperado |
| --- | --- |
| Ler o mesmo QR depois de confirmar | Erro de token usado; nenhuma segunda associação. |
| Esperar mais de cinco minutos antes de ler | Erro de token expirado. |
| Ler um QR fora do formato de pareamento | Erro de formato, sem associação. |
| Remover vínculo na lista | Dispositivo deixa de aparecer para esse responsável. |
| Gerar sessão após remover o vínculo | Novo QR permite novo pareamento. |

`FileNotFoundError` para `agent-credential` indica que o provisionamento não concluiu ou que o arquivo temporário não existe mais. Resolva primeiro a etapa 2. Remover o vínculo mantém a identidade do dispositivo; para invalidar também essa credencial, use a ferramenta administrativa de revogação descrita em [Backend](backend.md).

## UI e segurança

Antes de implementar UI, consultar [design](design.md) e o protótipo correspondente. Verificar React Native Reusables antes de criar componentes genéricos. Usar tokens existentes, padrões mobile e compatibilidade Android/iOS. O armazenamento da sessão usa `expo-secure-store`, compatível com Expo Go; a câmera/QR usa `expo-camera` nesta etapa, com permissão apenas de câmera para leitura. Se uma futura dependência nativa não estiver incluída no Expo Go, será necessário configurar um development build e ajustar o fluxo EAS conforme a documentação Expo da versão instalada. Os perfis EAS existentes são configuração, não evidência de build publicado ou de funcionalidade nativa disponível.

Nunca armazenar senha root/admin ou tratar QR como credencial administrativa permanente. A sessão usa armazenamento seguro nativo e não persiste credenciais no navegador.

## Configuração e verificações

Entrada `expo-router/entry`, plugin `expo-router`, scheme `piplup` e alias `@/*` para `src/*`. TypeScript inclui tipos gerados do Expo. Sem configuração Babel/Metro personalizada enquanto o padrão atender ao projeto.

Ative a versão da raiz com `nvm use` antes de instalar dependências ou verificar o projeto. Executar `npm run lint`, `npm run typecheck` e `npm run test:api` em `mobile/`. Para validar os bundles nativos sem gerar projetos locais, usar `npx expo export --platform android --platform ios --output-dir /tmp/lux-mobile-export`. Não gerar/editar `ios/` e `android/` manualmente; configuração nativa pertence ao app config e plugins. Novos módulos nativos podem exigir development build.

ESLint usa a série 9 por compatibilidade com o plugin React e `eslint-config-expo`; a atualização para a série 10 depende do suporte dos plugins. A configuração flat utiliza `eslint-config-expo`, sem regras adicionais arbitrárias.

O `.npmrc` utiliza `legacy-peer-deps=true`. Confira dependências com `npm audit` e avalie compatibilidade antes de atualizar Expo/React Native ou aplicar correções automáticas.

Referências: [instalação do Router](https://docs.expo.dev/router/installation/) e [lint do Expo](https://docs.expo.dev/guides/using-eslint/) e [Camera no SDK 57](https://docs.expo.dev/versions/v57.0.0/sdk/camera/).

Lint, typecheck e `npm run test:api` verificam código, contratos HTTP, seleção de computador, parsing do QR, paridade de traduções, interpolação, detecção de idioma e resolução de tema. A persistência nativa de preferências e o comportamento visual após troca de idioma/tema ainda exigem validação em aparelho. A exportação Android/iOS verifica a geração de bundles, mas não testa câmera, permissões ou acessibilidade num aparelho físico. O roteiro manual deve ser executado no ambiente de cada integrante. Pareamento ponta a ponta, autorização administrativa local e exibição do QR pelo Agent continuam pendentes de validação com o Agent real.

## Builds com EAS

O projeto mantém perfis EAS para Android: `development` e `preview` geram APKs internos; `production` gera AAB para a Play Store. O perfil `development` não inclui `expo-dev-client`, então o desenvolvimento atual usa Expo Go. Build iOS de produção requer credenciais Apple. Estes comandos opcionais são executados em `mobile/`:

```bash
npx eas-cli@latest login
npx eas-cli@latest build:configure
npx eas-cli@latest build --platform android --profile preview
```

Para os demais perfis, substitua `preview` por `development` ou `production`. Consulte [configuração EAS](https://docs.expo.dev/build/eas-json/) e [builds APK](https://docs.expo.dev/build-reference/apk/).

Home usa atalhos sem alegar bloqueios ou uma idade fixa. A tela de idade mostra a preferência escolhida e informa que o inventário não possui classificação etária; não calcula contagens fictícias de bloqueios. Nas restrições, presença/último contato e confirmação/horário de aplicação simulada são exibidos separadamente.
