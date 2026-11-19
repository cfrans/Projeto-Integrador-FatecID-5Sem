# Integração Lenovo Lux / GNOME

## Estado conhecido

O ambiente disponível é Lenovo Lux 3 (Canopus), baseado no Debian Trixie, instalado em VM VirtualBox, com GNOME Shell 50.4 e malcontent 0.13.1-5. AccountsService está funcionando e Python/PyGObject possui bindings Malcontent. O código-fonte permanece no WSL2; a VM, acessível por `ssh lux` com conta administrativa de desenvolvimento, recebe somente uma cópia para integração e testes.

O Agent é escrito em Python 3 e executado como serviço systemd pelo usuário de sistema `lux-agent`, instalado por `install.sh` ([instalação](../lux-agent/README.md#instalar-como-serviço)). Ele inicia a comunicação REST/HTTPS com o backend por polling, para que o celular não precise alcançar a rede local do Lux: consulta vínculos, envia o inventário de aplicativos, responde `agent.ping` e aplica `parental.app_filter.set` na conta gerenciada com releitura ([protocolo](agent-protocol.md)). O pareamento usa o mesmo auxiliar `pkexec` no terminal (`lux-agent pair`) e na janela GTK Piplup. O que já foi validado no Lux está em [Validação](validation.md).

Fora do escopo desta entrega: horários e classificação etária reais (LUX-11/12, opcionais), pedidos de instalação reais, atualização automática do Agent e detecção de mudanças feitas localmente no Controle Parental do GNOME.

## Capacidades observadas e limites

As provas manuais relatadas pelo usuário confirmam leitura de filtros e limites pelo `malcontent-client`, configuração de horários por `Malcontent.SessionLimitsBuilder` e `Malcontent.Manager.set_session_limits()`, bloqueio de login por horário no PAM/GDM e restrições de aplicativos/instalações observadas no GNOME. Pelo Agent, só a escrita do filtro de aplicativos e das flags de instalação foi reproduzida. `libpam-malcontent` foi instalado manualmente: não veio habilitado na instalação inicial. Não presumir a mesma configuração em outra instalação Lux.

A PoC usa `Gio.BusType.SYSTEM`, `Malcontent.Manager.get_app_filter()` e `get_session_limits()` com `ManagerGetValueFlags.NONE`, sem solicitar autorização interativa. A leitura das próprias políticas da conta de teste foi comprovada via SSH sem sudo. Na mesma sessão, ler as políticas da conta infantil foi negado tanto à PoC quanto à CLI, mesmo com a conta consultante no grupo sudo. A leitura restritiva foi então validada por execução com sudo autenticada pelo usuário no terminal, com saídas fornecidas para comparação. As regras instaladas permitem `ReadOwn` e exigem `auth_admin_keep` para `ReadAny` de filtros e limites; pertencer ao grupo sudo não autentica automaticamente uma consulta D-Bus. O uso de sudo na validação não define o privilégio do serviço; a autorização mínima para o filtro de aplicativos está em [Escrita privilegiada do filtro de aplicativos](#escrita-privilegiada-do-filtro-de-aplicativos). Falhas de consulta não produzem sucesso parcial.

Foram observadas particularidades de UTC nas provas manuais. A PoC preserva valores nativos serializados, sem conversão para horário local. A implementação [SessionLimits 0.13.1-5](https://sources.debian.org/src/malcontent/0.13.1-5/libmalcontent/session-limits.c/) usa UTC ao avaliar a faixa diária; testes em memória com a biblioteca instalada confirmaram início inclusivo e fim exclusivo. A leitura restritiva retornou `DailySchedule=[28800, 82800]`: 08:00–23:00 UTC, equivalente a 05:00–20:00 em `America/Sao_Paulo` em 2026-10-23. A avaliação dessa faixa reconstruída em memória não comprova sua aplicação pelo PAM/GDM; validar conversões e fronteiras de dia antes de escrever horários (LUX-11). Encerramento automático de sessões não foi comprovado; execução direta não é bloqueada ([Execução direta](#escrita-privilegiada-do-filtro-de-aplicativos)).

O Agent Python 3 roda sob systemd; a janela de pareamento Python/GTK4/libadwaita é um app separado ([interface gráfica](#interface-gráfica-local-de-pareamento)). O Agent usa as políticas e serviços nativos; não cria outro mecanismo de bloqueio nem exige modificar o código-fonte do GNOME ou do aplicativo Controle Parental. D-Bus permite comunicação entre processos locais; systemd gerencia a execução do serviço. O privilégio mínimo para ler e gravar o filtro de aplicativos foi demonstrado com regra polkit própria; horários e classificação etária ainda não.

Pedidos de liberação, expiração, encerramento automático e classificações do PDF não demonstram suporte do GNOME.

## Segurança e confiança

### Decisão para a confiança inicial do Agent

A identidade inicial do computador nasce do autorregistro: o Agent gera no Lux uma credencial de 256 bits aleatórios, guarda-a em arquivo restrito ao serviço e envia só o SHA-256 a `POST /agent/registrations`. SHA-256 simples basta pela entropia da credencial. Ela nunca é enviada ao mobile, incluída no QR ou registrada em logs. Registrar não concede nada: sem confirmação de um responsável autenticado em cinco minutos, o registro expira sem criar computador nem identidade. O backend permite invalidar a identidade, e o identificador do computador sozinho não autoriza solicitações. O Agent faz o autorregistro em `lux-agent pair` ([Pareamento pelo Agent](#pareamento-pelo-agent)).

A ferramenta administrativa (`agent:provision`, `agent:revoke`) fica só para desenvolvimento e operação; nesse caso a credencial é transferida por canal seguro e instalada manualmente, fora do `install.sh`. A credencial autentica uma instalação autorizada; não comprova por si só o modelo físico do equipamento nem que uma autorização administrativa local aconteceu em cada solicitação.

Cada sessão de pareamento exige autorização administrativa local: o auxiliar roda via `pkexec` com uma ação polkit própria (`auth_admin`). Um campo booleano enviado à API não é prova independente de autorização Linux; o backend confia no Agent para cumprir essa obrigação.

O QR transporta somente um token temporário de uso único, separado da credencial do Agent. Registrar o computador não concede acesso a um responsável. HTTPS é obrigatório fora de loopback.

As obrigações abaixo orientam backend e Agent; controles implementados e limitações estão em [Segurança](security.md):

- armazenar senhas de responsáveis usando hashing apropriado para senhas;
- autenticar e autorizar cada recurso com verificação de vínculo e escopo, sem confiar somente em autenticação de sessão;
- dar identidade própria ao computador/agente e autenticar a comunicação com o backend;
- exigir autorização local compatível com o sistema para cada operação privilegiada;
- proteger credenciais e segredos do agente no computador, sem expô-los ao mobile;
- parear por token aleatório temporário, de uso único e revogável, com autorização explícita de pessoa administradora local e privilégio mínimo;
- permitir revogar vínculos e invalidar a identidade/credenciais do computador;
- nunca enviar ou armazenar senha root/admin no mobile, nem aceitar comandos arbitrários recebidos pela rede. O agente deve executar somente operações explícitas e suportadas, com privilégios mínimos.

## Contrato do Agent

Os endpoints e formatos HTTP ficam em [Backend](backend.md); o Agent não tem acesso ao MySQL nem utilizará o JWT do responsável.

1. O auxiliar de pareamento gera a credencial individual no primeiro pareamento (ou quando a atual é recusada com `401`) e registra só o hash. O serviço a protege contra usuários não autorizados e a usa como Bearer exclusivamente no backend configurado e autenticado por HTTPS.
2. Para iniciar pareamento, o Agent exige autorização administrativa local (`pkexec`). Só então solicita `POST /agent/registrations` ou, com credencial válida, `POST /agent/pairing-sessions`; o terminal exibe o QR retornado e sua expiração. O administrador não precisa fornecer senha Linux ao backend ou mobile.
3. O responsável autenticado lê o QR, valida a solicitação e confirma o vínculo. O auxiliar consulta `GET /agent/associations` até haver vínculo ativo e reinicia o serviço. Isso confirma um vínculo persistido, não aplicação de controles GNOME.
4. O responsável revoga o vínculo no mobile. A API também aceita `DELETE /agent/associations/:associationId` pelo Agent, mas o Agent não tem comando para isso. Revogado o vínculo, o backend cancela os comandos pendentes; o Agent mantém as políticas já aplicadas e continua consultando, sem receber trabalho. Limpar as políticas exige ação local (`uninstall.sh --reset-policies`).
5. Sem identidade válida, o Agent não cria sessões nem consulta vínculos. Diante de `401`, deve interromper operações autenticadas e exigir intervenção administrativa; diante de falha de rede/`503`, deve mostrar indisponibilidade e não afirmar sucesso. QR expirado ou consumido exige nova solicitação após nova autorização local. Dispositivo ocupado por outro vínculo não deve transferir acesso automaticamente.

O polling repete consultas com backoff/jitter e Retry-After, distingue TLS de conexão e encerra em falhas permanentes. Credencial perdida ou comprometida deve ser invalidada pela operação administrativa do backend; um novo autorregistro cria outro computador e exige novo pareamento, sem transferir vínculos. Testes de API e fixtures de desenvolvimento não comprovam essas obrigações nem identificam fisicamente um Lenovo Lux.

## Interface gráfica local de pareamento

O app **Piplup** (`org.piplup.Pairing`, pacote [`lux_agent_gui`](../lux-agent/lux_agent_gui/)) é uma janela GTK4/libadwaita aberta pelo menu de aplicativos. É separada do serviço: não importa `lux_agent`, não lê a credencial nem fala com o backend. Executa `pkexec /opt/lux-agent/lux-agent-pair-helper`, o mesmo auxiliar e a mesma ação polkit do `lux-agent pair` ([Pareamento pelo Agent](#pareamento-pelo-agent)), e lê os eventos JSON do stdout com `Gio.Subprocess`, sem threads nem outro IPC.

| Estado na janela | Origem |
| --- | --- |
| Parear este computador | Início, com o auxiliar instalado |
| Aguardando autorização | `pkexec` iniciado, antes do primeiro evento |
| QR com contagem regressiva | `session`; QR gerado com `python3-qrcode`, contagem até `expiresAt` |
| Computador pareado / já pareado | `paired` / `already-paired` |
| O código expirou → Gerar novo código | `expired`; abre outro `pkexec`, que pede a senha de novo |
| Não foi possível parear | `error` (mensagem do auxiliar) ou fim do auxiliar sem evento final |
| Autorização necessária | `pkexec` termina com 126/127 sem eventos (cancelado ou senha errada) |
| Piplup não instalado | Auxiliar ausente em `/opt/lux-agent` |

Fechar a janela com o QR na tela cancela o pareamento (o auxiliar sai quando o processo pai termina) e não afeta o serviço. O acento vermelho do projeto (`#E5483D`) substitui o acento do sistema; o restante segue o tema claro/escuro do GNOME. O Agent omite `org.piplup.Pairing.desktop` do inventário de aplicativos, para que o responsável não veja nem bloqueie o próprio Piplup; o atalho aparece no menu de todas as contas, mas parear exige senha de administrador.

O roteiro demonstrativo em [Mobile](mobile.md#teste-manual-de-pareamento-com-dispositivo-de-demonstração) gera QR localmente usando a API; é ferramenta de desenvolvimento, não o pareamento do Agent.

## Pareamento pelo Agent

`lux-agent pair`, sem privilégio, executa `pkexec /opt/lux-agent/lux-agent-pair-helper`. A ação [`org.piplup.luxagent.pair`](../lux-agent/polkit/org.piplup.luxagent.pair.policy) exige `auth_admin` em qualquer sessão e fixa o caminho do auxiliar; usuário sem senha de administrador é negado. O auxiliar roda como root, não aceita argumentos e lê só `/etc/lux-agent` (URL, conta gerenciada e `ca.pem`, se existir).

1. Testa a credencial atual com `GET /agent/associations`. Vínculo ativo, ou `409` na sessão, encerra como "já pareado". Falha de rede, TLS ou `5xx` encerra sem tocar na credencial.
2. Sem credencial ou com `401`, gera 32 bytes aleatórios, grava `/etc/lux-agent/credential` de forma atômica (temporário no mesmo diretório, `0600`, dono `lux-agent`, `fsync`, `rename`) e envia `{credentialHash, name: hostname, managedUser}` a `POST /agent/registrations`, sem Bearer. Não distingue credencial nunca registrada de revogada: as duas não valem nada. Com credencial válida, usa `POST /agent/pairing-sessions`.
3. Escreve no stdout só eventos JSON, um por linha: `session` (`uri`, `expiresAt`), depois `paired`, `expired`, `already-paired` ou `error` (`message`). A credencial nunca sai do processo nem aparece em saída ou log.
4. Consulta `GET /agent/associations` a cada 3 s até a expiração. Durante o registro pendente a credencial nova recebe `401`, tratado como espera. Com vínculo ativo, roda `systemctl restart lux-agent`; na expiração, sai sem mexer no serviço. Se o processo pai terminar (janela ou terminal fechados), sai sem eventos e sem mexer no serviço; como o `pkexec` executa o auxiliar no próprio processo, o pai é quem chamou o `pkexec`. O `pkexec` fica aberto até 5 min, com o administrador presente.

O lado sem privilégio desenha o QR com `python3-qrcode` (meio-blocos Unicode, cores ANSI fixas, legível em tema claro ou escuro) e mostra a hora de expiração. O serviço não muda: `401` continua encerrando com código 3, sem reinício, e a recuperação é um novo `lux-agent pair`. Phishing de QR é limitação declarada, mitigada pela tela de confirmação no mobile, que mostra nome e conta registrados.

## Escrita privilegiada do filtro de aplicativos

O Agent roda como usuário de sistema `lux-agent` (sem login, sem home, sem shell) e grava o filtro pelo `Malcontent.Manager.set_app_filter()` no D-Bus de sistema, sem root nem senha interativa. A policy instalada exige `auth_admin_keep` para `AppFilter.ReadAny` e `AppFilter.ChangeAny`; a regra do pacote malcontent só libera leitura a membros de `sudo` em sessão local ativa. A regra [`50-lux-agent.rules`](../lux-agent/polkit/50-lux-agent.rules), instalada em `/etc/polkit-1/rules.d/`, libera somente essas duas ações para o usuário `lux-agent`. SessionLimits, AccountInfo e ações `*Own` não são liberadas. A regra não restringe a conta alvo, porque o polkit não informa qual conta está sendo alterada; quem limita o Agent à conta gerenciada é o próprio código ([Segurança](security.md#limitações)).

- **Identificador de aplicativo.** O malcontent bloqueia por caminho absoluto do executável, flatpak ref ou content type, não por desktop id. O report mantém `sourceId = desktop:<id>.desktop`; ao aplicar, o Agent lê `Exec` do `.desktop`, toma o primeiro argumento e o resolve no PATH padrão de sessão (`/usr/local/bin:/usr/bin:/bin:/usr/games`), como o GLib faz. Ex.: `desktop:firefox-esr.desktop` → `/usr/lib/firefox-esr/firefox-esr`. A releitura devolve caminhos; o filtro é sempre lista de bloqueio (`AppFilter=[false, ...]`). Consequências: `.desktop` que compartilham executável são bloqueados juntos; flatpak não foi verificado (não há flatpak na VM).
- **Navegadores.** Na VM só existe Firefox ESR (`firefox-esr.desktop`). Chromium, Brave e GNOME Web não estão instalados. A opção "Restringir navegadores web" do Controle Parental grava o content type `x-scheme-handler/http`, que bloqueia qualquer app que se declare navegador; bloquear um navegador específico exige o caminho do executável.
- **Momento do efeito.** Vale na sessão aberta: o app some da busca e do dock sem novo login. Processos já abertos continuam executando; o malcontent não encerra apps. O bloqueio vale para novas aberturas, e a interface deve dizer isso.
- **Execução direta.** O malcontent bloqueia o lançamento pelo GNOME, não a execução: pelo terminal, o executável bloqueado abre normalmente (comprovado), assim como o próprio Controle Parental do GNOME. Mitigação possível: bloquear também o app de terminal. Limitação aceita: o bloqueio vale para o GNOME.
- **Conta administrativa.** O Agent recusa root e membros dos grupos `sudo`, `admin` ou `wheel` (primário ou suplementar) via `/etc/group`, antes de acessar D-Bus.

## Verificações pendentes

- Efeito real do bloqueio de instalação (exige flatpak na VM) e `uninstall.sh --reset-policies` com filtro aplicado: LUX-10.
- Permissões polkit e efeito de horários (SessionLimits, `ReadAny/ChangeAny`) e classificação etária (OARS): LUX-11/12. O `set` atual zera o filtro OARS; o LUX-12 precisa mesclar com a classificação etária.
- Login de conta com limite de horário ativo falha nesta VM (ver [provas](#provas-que-sustentam-as-decisões)); investigar antes do LUX-11.
- UTC, fronteiras de dia e encerramento automático de sessões.
- Hospedagem HTTPS definitiva e indisponibilidade real do backend (LUX-10).

## Provas que sustentam as decisões

Resumo do que foi observado no Lux real e embasa as decisões acima. Data e ambiente de cada validação estão em [Validação](validation.md); o detalhe de cada execução fica no histórico do Git e nos tickets.

- **Leitura.** A própria conta é lida sem sudo. Ler outra conta é negado (`Not allowed to query parental controls data`) mesmo para membro de `sudo` por SSH: a policy instalada exige `auth_admin_keep` para `ReadAny`. Negação é falha, nunca "sem restrições".
- **Escrita via polkit.** Sem a regra `50-lux-agent.rules`, o usuário `lux-agent` recebe a mesma negação e nada é gravado. Com a regra, grava, relê igual e restaura. O app some da busca e do dock na hora; janela já aberta continua; pelo terminal o executável abre normalmente.
- **Instalação.** As flags são gravadas e relidas, mas o efeito não foi observado: o repositório Lux não publica catálogo AppStream, não há flatpak e conta sem privilégio já depende de administrador para apt/PackageKit.
- **Limite de horário.** Com `LimitType=1`, o login gráfico da conta gerenciada falha nesta VM (`pam_systemd`: `Failed to create session: Device or resource busy`) desde a atualização para systemd 261. Causa não investigada; o limite da conta de teste fica desligado.
- **Fronteiras UTC.** `SessionLimits.check_time_remaining()` em memória trata início como inclusivo e fim como exclusivo, em UTC.
