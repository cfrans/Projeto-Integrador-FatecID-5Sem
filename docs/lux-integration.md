# Integração Lenovo Lux / GNOME

## Estado conhecido

O ambiente disponível é Lenovo Lux 3 (Canopus), baseado no Debian Trixie, instalado em VM VirtualBox, com GNOME Shell 50.4 e malcontent 0.13.1-5. AccountsService está funcionando e Python/PyGObject possui bindings Malcontent. O código-fonte permanece no WSL2; a VM, acessível por `ssh lux` com conta administrativa de desenvolvimento, recebe somente uma cópia para integração e testes.

O agente planejado será escrito em Python 3 e executado como serviço systemd no computador. Ele iniciará a comunicação REST/HTTPS com o backend por polling, para que o celular não precise alcançar diretamente a rede local do Lux. Os contratos de identidade e pareamento já existem no backend. A proteção do arquivo de credencial e o diagnóstico de comunicação estão implementados; instalação do serviço, comandos parentais, disponibilidade contínua e confirmação de aplicação permanecem pendentes. `lux-agent/` contém a PoC de leitura nativa e um diagnóstico autenticado de execução única via `GET /agent/associations`, com [procedimento e evidências](../lux-agent/README.md). A consulta e o polling somente de leitura de vínculos foram validados no Lux por túnel SSH, com arquivo privado de credencial; `agent.ping` já usa transporte HTTPS com reserva/diário/resultado; não há comandos parentais, serviço systemd ou interface GTK.

Responsabilidades previstas para o agente: iniciar automaticamente com o sistema; autenticar a identidade do computador perante o backend; participar do pareamento somente após autorização local de uma pessoa administradora; consultar trabalho pendente por polling; aplicar localmente apenas operações que tenham suporte confirmado e autorização do sistema; reportar resultado e estado de aplicação; e tolerar falhas de rede sem afirmar sucesso quando não houver confirmação. A semântica de tentativas, repetição e sincronização será definida no protocolo.

## Capacidades observadas e limites

As provas manuais relatadas pelo usuário confirmam leitura de filtros e limites pelo `malcontent-client`, configuração de horários por `Malcontent.SessionLimitsBuilder` e `Malcontent.Manager.set_session_limits()`, bloqueio de login por horário no PAM/GDM e restrições de aplicativos/instalações observadas no GNOME. Não foram reproduzidas escritas nesta PoC. `libpam-malcontent` foi instalado manualmente: não veio habilitado na instalação inicial. Não presumir a mesma configuração em outra instalação Lux.

A PoC usa `Gio.BusType.SYSTEM`, `Malcontent.Manager.get_app_filter()` e `get_session_limits()` com `ManagerGetValueFlags.NONE`, sem solicitar autorização interativa. A leitura das próprias políticas da conta de teste foi comprovada via SSH sem sudo. Na mesma sessão, ler as políticas da conta infantil foi negado tanto à PoC quanto à CLI, mesmo com a conta consultante no grupo sudo. A leitura restritiva foi então validada por execução com sudo autenticada pelo usuário no terminal, com saídas fornecidas para comparação. As regras instaladas permitem `ReadOwn` e exigem `auth_admin_keep` para `ReadAny` de filtros e limites; pertencer ao grupo sudo não autentica automaticamente uma consulta D-Bus. O uso de sudo na validação não define o privilégio do serviço; a autorização mínima para o filtro de aplicativos está em [Escrita privilegiada do filtro de aplicativos](#escrita-privilegiada-do-filtro-de-aplicativos). Falhas de consulta não produzem sucesso parcial.

Foram observadas particularidades de UTC nas provas manuais. A PoC preserva valores nativos serializados, sem conversão para horário local. A implementação [SessionLimits 0.13.1-5](https://sources.debian.org/src/malcontent/0.13.1-5/libmalcontent/session-limits.c/) usa UTC ao avaliar a faixa diária; testes em memória com a biblioteca instalada confirmaram início inclusivo e fim exclusivo. A leitura restritiva retornou `DailySchedule=[28800, 82800]`: 08:00–23:00 UTC, equivalente a 05:00–20:00 em `America/Sao_Paulo` em 2026-10-23. A avaliação dessa faixa reconstruída em memória não comprova sua aplicação pelo PAM/GDM; validar conversões e fronteiras de dia antes de futuras escritas. Encerramento automático de sessões e bloqueio de execução direta de aplicativos permanecem não comprovados.

Python 3/systemd e a interface Python/GTK4/libadwaita permanecem decisões de implementação futura. O Agent usará as políticas e serviços nativos; não criará outro mecanismo de bloqueio nem exigirá modificar o código-fonte do GNOME ou do aplicativo Controle Parental. D-Bus permite comunicação entre processos locais; systemd gerencia a execução do serviço. O privilégio mínimo para ler e gravar o filtro de aplicativos foi demonstrado com regra polkit própria; horários, autorização local do pareamento e demais operações ainda precisam ser demonstrados.

Investigar quais contas podem ser administradas, quais restrições podem ser consultadas/alteradas, quais privilégios são exigidos, como detectar aplicação efetiva e como reportar indisponibilidade e erros. Pedidos de liberação, expiração, encerramento automático, restrição por navegador e classificações do PDF não demonstram suporte do GNOME.

## Segurança e confiança

### Decisão para a confiança inicial do Agent

A identidade inicial do computador será provisionada por uma ferramenta administrativa do backend, sem endpoint público de registro. Uma pessoa autorizada a operar o backend criará uma credencial criptograficamente aleatória e exclusiva por dispositivo. Um administrador local instalará essa credencial no Lux em arquivo restrito ao serviço; ela nunca será enviada ao mobile, incluída no QR ou registrada em logs. O backend armazenará apenas o hash da credencial, permitindo sua invalidação. O identificador do computador sozinho não autoriza solicitações.

Esse procedimento exige participação de quem administra o backend e do administrador local do Lux. A transferência da credencial deve ocorrer por canal seguro. A credencial autentica uma instalação autorizada; não comprova por si só o modelo físico do equipamento nem que uma autorização administrativa local aconteceu em cada solicitação.

Após o provisionamento, o futuro Agent deverá exigir autorização administrativa local antes de solicitar cada sessão de pareamento. A autorização local precisa ser implementada e testada no Lux real; a proteção do arquivo já é verificada pelo diagnóstico, mas a instalação para o futuro serviço permanece pendente; um campo booleano enviado à API não será tratado como prova independente de autorização Linux. O backend confiará no Agent previamente provisionado para cumprir essa obrigação. O mecanismo local concreto permanece pendente de investigação, sem assumir suporte a polkit.

O QR transportará somente um token temporário de uso único, separado da credencial do Agent. O provisionamento e o pareamento são operações distintas: preparar a identidade do computador não concede acesso a um responsável. HTTPS será obrigatório fora do ambiente local de desenvolvimento. A infraestrutura de identidade e pareamento está implementada no backend; a proteção do arquivo e a autenticação do diagnóstico foram validadas no Agent; autorização local, pareamento e instalação do serviço permanecem pendentes.

O backend implementa hashing Argon2id de senhas, JWT de responsáveis, credenciais individuais do Agent, sessões temporárias e revogação de vínculos. As obrigações abaixo incluem etapas locais ainda pendentes de implementação e validação no Lux:

- armazenar senhas de responsáveis usando hashing apropriado para senhas;
- autenticar e autorizar cada recurso com verificação de vínculo e escopo, sem confiar somente em autenticação de sessão;
- dar identidade própria ao computador/agente e autenticar a comunicação com o backend;
- exigir autorização local compatível com o sistema para cada operação privilegiada;
- proteger credenciais e segredos do agente no computador, sem expô-los ao mobile;
- parear por token aleatório temporário, de uso único e revogável, com autorização explícita de pessoa administradora local e privilégio mínimo;
- permitir revogar vínculos e invalidar a identidade/credenciais do computador;
- nunca enviar ou armazenar senha root/admin no mobile, nem aceitar comandos arbitrários recebidos pela rede. O agente deve executar somente operações explícitas e suportadas, com privilégios mínimos.

QR Code transporta somente o token temporário de pareamento, com validade de cinco minutos e uso único. Não é uma credencial administrativa permanente. O protocolo deve proteger tokens em trânsito e impedir reutilização após consumo ou expiração.

## Contrato do futuro Agent

Os endpoints e formatos HTTP ficam em [Backend](backend.md); o Agent não terá acesso ao MySQL nem utilizará o JWT do responsável.

1. Um administrador local instala a credencial individual previamente provisionada. O serviço deve protegê-la contra usuários não autorizados e utilizá-la como Bearer exclusivamente no backend configurado e autenticado por HTTPS.
2. Para iniciar pareamento, o Agent verifica autorização administrativa local. Só então solicita `POST /agent/pairing-sessions`; a interface local exibe o QR retornado e informa sua expiração, inicialmente podendo usar o terminal na prova de conceito. O administrador não precisa fornecer senha Linux ao backend ou mobile.
3. O responsável autenticado lê o QR, valida a solicitação e confirma o vínculo. O Agent consulta `GET /agent/associations` por polling para observar a associação no backend. Isso confirma um vínculo persistido, não aplicação de controles GNOME.
4. O administrador local poderá revogar um vínculo pelo Agent usando `DELETE /agent/associations/:associationId`. O responsável poderá revogar o próprio vínculo no mobile. O Agent deverá observar a revogação no polling e deixar de aceitar trabalho daquele responsável. Não se presume remoção ou alteração automática de restrições Linux.
5. Sem identidade válida, o Agent não cria sessões nem consulta vínculos. Diante de `401`, deve interromper operações autenticadas e exigir intervenção administrativa; diante de falha de rede/`503`, deve mostrar indisponibilidade e não afirmar sucesso. QR expirado ou consumido exige nova solicitação após nova autorização local. Dispositivo ocupado por outro vínculo não deve transferir acesso automaticamente.

A interface administrativa local, seu mecanismo de autorização, a instalação systemd, a apresentação do QR e comandos parentais ainda precisam ser implementados no Agent Python. O transporte mínimo de `agent.ping` está implementado com diário privado e resultados idempotentes. O polling de vínculos já repete consultas com backoff/jitter e Retry-After, distingue TLS de conexão e encerra em falhas permanentes; o diagnóstico de execução única permanece disponível. Credencial perdida ou comprometida deve ser invalidada pela operação administrativa do backend; não existe registro público ou token global para recuperar acesso. Testes de API e fixtures de desenvolvimento não comprovam essas obrigações nem identificam fisicamente um Lenovo Lux.

## Interface gráfica local de pareamento

Componente planejado em Python com GTK4/libadwaita, visualmente integrado ao GNOME e aberto sob demanda por um administrador local. É distinto do serviço Python/systemd: o Agent inicia no boot e continua em segundo plano mesmo quando a interface é fechada. O transporte local entre interface e Agent e o mecanismo de autorização ainda precisam ser definidos e validados; não há contrato IPC implementado.

Fluxo esperado:

1. O administrador abre a interface no Lux e autoriza localmente o pareamento.
2. A interface solicita ao Agent uma sessão; o Agent previamente provisionado autentica-se no backend e solicita o token temporário.
3. A interface exibe QR e expiração, sem expor a credencial permanente do Agent.
4. O responsável autenticado lê o QR no mobile e confirma o computador.
5. O backend valida autenticação, autorização, identidade e token e cria o vínculo somente após as verificações, conforme o contrato implementado.
6. O computador aparece na lista autorizada; o Agent observa a associação no polling. Isso não confirma aplicação de restrições.

O futuro Agent mínimo poderá usar QR no terminal antes da interface GTK; a PoC de políticas permanece exclusivamente de leitura local, separada do diagnóstico HTTP. O roteiro demonstrativo em [Mobile](mobile.md#teste-manual-de-pareamento-com-dispositivo-de-demonstração) já gera QR localmente usando a API, mas é ferramenta de desenvolvimento, não implementação do Agent ou autorização Linux.

## Escrita privilegiada do filtro de aplicativos

O Agent roda como usuário de sistema `lux-agent` (sem login, sem home, sem shell) e grava o filtro pelo `Malcontent.Manager.set_app_filter()` no D-Bus de sistema, sem root nem senha interativa. A policy instalada exige `auth_admin_keep` para `AppFilter.ReadAny` e `AppFilter.ChangeAny`; a regra do pacote malcontent só libera leitura a membros de `sudo` em sessão local ativa. A regra [`50-lux-agent.rules`](../lux-agent/polkit/50-lux-agent.rules), instalada em `/etc/polkit-1/rules.d/`, libera somente essas duas ações para o usuário `lux-agent`. SessionLimits, AccountInfo e ações `*Own` não são liberadas.

- **Identificador de aplicativo.** O malcontent bloqueia por caminho absoluto do executável, flatpak ref ou content type, não por desktop id. O report mantém `sourceId = desktop:<id>.desktop`; ao aplicar, o Agent lê `Exec` do `.desktop`, toma o primeiro argumento e o resolve no PATH padrão de sessão (`/usr/local/bin:/usr/bin:/bin:/usr/games`), como o GLib faz. Ex.: `desktop:firefox-esr.desktop` → `/usr/lib/firefox-esr/firefox-esr`. A releitura devolve caminhos; o filtro é sempre lista de bloqueio (`AppFilter=[false, ...]`). Consequências: `.desktop` que compartilham executável são bloqueados juntos; flatpak não foi verificado (não há flatpak na VM).
- **Navegadores.** Na VM só existe Firefox ESR (`firefox-esr.desktop`). Chromium, Brave e GNOME Web não estão instalados. A opção "Restringir navegadores web" do Controle Parental grava o content type `x-scheme-handler/http`, que bloqueia qualquer app que se declare navegador; bloquear um navegador específico exige o caminho do executável.
- **Momento do efeito.** Vale na sessão aberta: o app some da busca e do dock sem novo login. Processos já abertos continuam executando; o malcontent não encerra apps. O bloqueio vale para novas aberturas, e a interface deve dizer isso.
- **Execução direta.** O malcontent bloqueia o lançamento pelo GNOME, não a execução: pelo terminal, o executável bloqueado abre normalmente (comprovado), assim como o próprio Controle Parental do GNOME. Mitigação possível: bloquear também o app de terminal. Limitação aceita: o bloqueio vale para o GNOME.
- **Conta administrativa.** O Agent recusa root e membros do grupo `sudo` (primário ou suplementar) via `/etc/group`, antes de acessar D-Bus.

## Verificações pendentes

- Validar indisponibilidade real do serviço; a leitura restritiva com autenticação administrativa e a negativa de acesso sem autorização já foram observadas.
- Permissões polkit e efeito de horários (SessionLimits) e classificação etária (OARS); o filtro de aplicativos já foi provado.
- Login de conta com limite de horário ativo falha nesta VM (ver [escrita via polkit](#escrita-do-filtro-de-aplicativos-via-polkit--2026-11-13)); investigar antes do LUX-11.
- UTC, fronteiras de dia, encerramento automático de sessões e efeito real do bloqueio de instalação.
- Instalação systemd, início no boot, usuário do serviço e proteção local da credencial com privilégio mínimo.
- Autorização local do administrador, comunicação interface/Agent, QR temporário e revogação com computador real.
- Hospedagem HTTPS definitiva e recuperação em indisponibilidade real do backend; HTTPS com proxy temporário, recusas TLS e polling de vínculos já foram validados. Recuperação transitória simulada está coberta. O transporte de `agent.ping` foi validado; repetição/reconciliação de operações parentais e confirmação de aplicação ainda dependem de contrato próprio.

Essas verificações podem continuar na VM disponível; não bloqueiam a experiência mobile com mocks identificados. O estado das oito etapas fica em [Arquitetura](architecture.md#etapas-de-implementação).

## Registro de provas técnicas

Para cada teste no Lux real, registrar versão do sistema e dos componentes, interfaces observadas, passos reproduzíveis, usuário/permissões, resultado e limitações. Diferenciar observação de hipótese. Só documentar uma capacidade como confirmada depois de demonstrá-la no ambiente alvo; registrar também falhas e operações indisponíveis.

### PoC de leitura via SSH — 2026-10-23

- Ambiente confirmado nesta execução: Lux 3/Canopus, Debian Trixie, GNOME Shell 50.4, Python 3.14.6, python3-gi 3.57.1-1, malcontent/bindings/libpam-malcontent 0.13.1-5, AccountsService 23.13.9-8+b2 ativo. A data local da VM foi consultada; sincronização do relógio não foi validada.
- Conta de teste explicitamente indicada; execução SSH pela própria conta (grupo sudo), sem sudo e sem autorização interativa. Procedimento reproduzível no [README da PoC](../lux-agent/README.md#sincronizar-e-executar-no-lux).
- A execução da PoC concluiu com JSON: `app_filter.enabled=false`, `AppFilter=[false, []]`, `OarsFilter=["oars-1.1", {}]`, instalações de usuário/sistema permitidas; `session_limits.enabled=false`, `LimitType=0`.
- Comparação: as consultas de filtros e limites pelo `malcontent-client`, sem interação e para a mesma conta, retornaram resultados compatíveis. Consultas anteriores à PoC retornaram os mesmos valores; o código chama somente getters. Nenhuma escrita parental, alteração de PAM, contas ou serviços foi executada.
- Sete testes unitários passaram no WSL2 (Python 3.12.3) e no Lux, incluindo dependência ausente e erro sem JSON parcial. Políticas restritivas são verificadas com objetos simulados nos testes; não foram verificadas por esta PoC na VM. Não há evidência nova de encerramento de sessão, execução direta ou leitura de outra conta.

### Leitura restritiva, permissões e UTC — 2026-10-23

- Repositório inicialmente limpo; mesma VM, versões de GNOME, Python, malcontent e AccountsService confirmadas. A cópia da PoC foi atualizada pelo rsync restrito aos três arquivos documentados.
- Pela sessão SSH administrativa, a PoC retornou código 1, stderr `Not allowed to query parental controls data` e stdout vazio ao consultar outra conta. As duas consultas nativas retornaram código 2 com a mesma negativa, tanto com `--no-interactive` quanto com os comandos padrão. Não houve JSON parcial nem interpretação de permissão negada como ausência de restrições.
- A própria conta administrativa continuou retornando filtros/limites desativados e instalações permitidas, com código 0 e resultados compatíveis com a CLI. As duas saídas da CLI permaneceram idênticas antes e depois da PoC.
- O arquivo instalado `/usr/share/polkit-1/actions/com.endlessm.ParentalControls.policy` declara `ReadOwn=yes` e `ReadAny=auth_admin_keep` para AppFilter e SessionLimits em todos os tipos de sessão. Esse padrão é consistente com as negativas observadas; não foi feita auditoria de eventuais regras adicionais.
- Após autorização explícita, tentativas limitadas à PoC e aos getters nativos com `sudo -n` retornaram `sudo: a password is required`, sem executar as consultas. O usuário então executou no próprio terminal, via `ssh -t lux`, a sequência `sudo python3 -B ~/lux-agent-poc/read_policies.py --user USUARIO_ALVO`, os dois getters nativos com sudo/`--no-interactive` e novamente a PoC. As saídas foram fornecidas pelo usuário; o agente não recebeu a senha nem alterou mecanismos de autorização.
- Na conta infantil, a PoC retornou `app_filter.enabled=true`, `AppFilter=[false, ["/usr/bin/gnome-tweaks", "x-scheme-handler/http"]]`, `OarsFilter=["oars-1.1", {}]` e ambas as instalações proibidas. Limites ativos: `LimitType=1`, `DailySchedule=[28800, 82800]`. Os JSONs anteriores e posteriores às consultas nativas são idênticos. Nenhuma escrita parental, alteração de PAM, contas ou serviços foi executada.
- A CLI confirmou ausência de valores OARS, ambas as instalações proibidas e limites ativos sem tempo restante naquele momento. Seu código instalado não imprime a lista `AppFilter` em `get-app-filter`, portanto essa lista não foi comparada diretamente por esse comando. O resultado da CLI é consistente nos campos que ela expõe; não comprova bloqueio de execução direta ou de navegação.
- Sem timestamp na saída autenticada, não é possível conferir rigorosamente o tempo restante informado pela CLI naquele instante. Em memória, `SessionLimits.deserialize()` reconstruiu a faixa retornada, sem D-Bus ou setters: `check_time_remaining()` negou 07:59:59Z, permitiu 08:00:00Z (54000 s) e 22:59:59Z (1 s), e negou 23:00:00Z. Essa avaliação confirma as fronteiras UTC da biblioteca, sem testar o PAM/GDM.
- A CLI instalada usa `check_time_remaining()` com o instante da consulta e imprime tempo restante, enquanto a PoC apenas serializa a configuração. Esses formatos distintos precisam ser considerados na comparação; a PoC não converte segundos para horários nem calcula tempo restante.
- Sete testes unitários passaram novamente no WSL2 e no Lux; compilação Python e verificações da documentação passaram. Não foi identificado defeito que exigisse alteração de código ou novos testes unitários.

### Fundação de comunicação do Agent — 2026-10-24

`check_backend.py` reutiliza a credencial provisionada e `GET /agent/associations`, sem modificar o backend ou iniciar pareamento. HTTP 200 foi confirmado no WSL2 e no Lux com NestJS/MySQL reais; a VM iniciou a requisição via loopback em túnel SSH temporário. Credencial aleatória e identidade revogada retornaram 401/código 3; conexão recusada retornou código 4. Os 14 testes Python passaram nos dois ambientes. A leitura da própria conta sem sudo continuou funcionando, sem nova consulta privilegiada. Procedimento, segurança do arquivo, validações simuladas e limites estão no [README do Agent](../lux-agent/README.md#evidência-desta-iteração--2026-10-24). HTTPS real, polling, pareamento e serviço permanecem pendentes.

### Polling somente de leitura — 2026-10-24

`poll_associations.py` realiza consultas periódicas ao endpoint existente, sem criar sessões ou modificar vínculos. Três GETs consecutivos retornaram HTTP 200 no WSL2 e no Lux via túnel SSH; revogação durante um ciclo no WSL2 provocou HTTP 401 e encerramento com código 3. Os 42 testes passaram nos dois ambientes; a própria conta foi consultada pela PoC sem sudo. Erros HTTP transitórios/certificado foram exercitados em testes locais, sem HTTPS de produção ou interrupção real do backend. Procedimento, sinais, limites e evidências ficam no [README do Agent](../lux-agent/README.md#validação-do-polling--2026-10-24).

### Transporte HTTPS — 2026-10-25

Diagnóstico, polling e parada após revogação foram validados no WSL2 e Lux contra NestJS/MySQL reais usando Nginx temporário e certificado para `localhost` assinado por CA privada explícita. CA não confiável e hostname incompatível foram recusados sem repetição. Os 49 testes Python passaram nos dois ambientes, incluindo certificado expirado e erros HTTP sobre TLS real em servidor de teste. Procedimento, evidências e limites no [guia HTTPS](lux-https-development.md). Não houve alteração de confiança global, configuração parental ou serviços Lux. Hospedagem definitiva e comandos permanecem pendentes.

### Primeiro comando `agent.ping` — 2026-10-26

Responsável criou o comando por HTTPS, o Agent no Lux reservou/processou o ping e o responsável consultou `succeeded` com `{ "reachable": true }`, persistido em MySQL descartável. Reinício com o mesmo diário não repetiu a execução. Passaram 63 testes Python em cada sistema e a suíte MySQL completa com 18 testes. Identidade de teste revogada e artefatos temporários removidos; nenhuma política, conta ou serviço Lux foi alterado. [Procedimento, UUID/horários, limitações e estado do ambiente](agent-ping-validation.md).

### Organização como pacote Python — 2026-10-26

O Agent foi reorganizado em `lux_agent`, com CLI `python3 -m lux_agent`, testes separados e wrappers para as três entradas anteriores. Passaram 69 testes no WSL2 e Lux, preservando os 63 casos anteriores. A CLI no Lux também validou HTTPS/ping/reenvio com servidor de contrato isolado e leu as próprias políticas sem sudo. Nenhum backend, banco ou serviço/política do Lux foi alterado; a integração NestJS/MySQL anterior não foi repetida. [Estrutura, compatibilidade, deploy e evidências](../lux-agent/README.md#validação-da-reorganização--2026-10-26).

### Escrita do filtro de aplicativos via polkit — 2026-11-13

- Ambiente: Lux 3/Canopus, Debian Trixie, GNOME Shell 50.4, systemd 261.2-1, malcontent/bindings 0.13.1-5. `pkaction` lista ações `AppFilter`, `SessionLimits` e `AccountInfo`, cada uma com `ReadOwn`, `ReadAny`, `ChangeOwn` e `ChangeAny`; só `ReadOwn` é `yes`, as demais `auth_admin_keep`.
- Usuário de sistema `lux-agent` criado; código copiado para `/opt/lux-agent-poc` com dono root. Comando: `sudo -u lux-agent python3 -B prove_app_filter.py --user CONTA_GERENCIADA --block desktop:firefox-esr.desktop` ([procedimento](../lux-agent/README.md#prova-de-escrita-do-filtro-de-aplicativos)).
- Sem a regra: `MctManagerError: Not allowed to query parental controls data`, saída 4, nada gravado. O mesmo ocorre com a conta administrativa por SSH (sessão não ativa).
- Com a regra: gravou `/usr/lib/firefox-esr/firefox-esr` e instalações proibidas, releitura idêntica (`matches: true`), filtro anterior restaurado e confirmado (`restored: true`), saída 0. O arquivo da conta no AccountsService voltou ao conteúdo original.
- Com `--hold` e a conta gerenciada logada: o Firefox sumiu da busca e do dock na hora e voltou após a restauração; a janela já aberta continuou funcionando. No terminal da conta gerenciada, `firefox-esr` e `/usr/lib/firefox-esr/firefox-esr` abriram normalmente durante o bloqueio.
- Instalação: as flags foram gravadas e relidas, mas o efeito não foi verificado. O repositório do Lux não publica catálogo AppStream (DEP-11), então a Central de Programas não lista aplicativos para nenhuma conta; flatpak não está instalado; e conta sem privilégio administrativo já depende de autenticação de administrador para instalar via apt/PackageKit. O filtro original da conta também já proibia instalação. Verificar exige flatpak.
- Achado lateral: com limite de horário ativo (`LimitType=1`), o login gráfico da conta gerenciada falha nesta VM. `pam_systemd` registra `Failed to create session: Device or resource busy` para a sessão de gerenciador, o `user@UID.service` sai com `$XDG_RUNTIME_DIR is not set` e o GNOME não sobe. Com o limite desligado o login funciona; reboot não resolve. Não há login bem-sucedido dessa conta no journal desde a atualização de systemd 260 → 261 (2026-10-18). Causa exata não investigada; afeta o LUX-11.
- 91 testes unitários passaram no WSL2 e no Lux, incluindo 17 da escrita com malcontent simulado.
