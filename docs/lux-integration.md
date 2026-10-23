# Integração Lenovo Lux / GNOME

## Estado conhecido

O ambiente disponível é Lenovo Lux 3 (Canopus), baseado no Debian Trixie, instalado em VM VirtualBox, com GNOME Shell 50.4 e malcontent 0.13.1-5. AccountsService está funcionando e Python/PyGObject possui bindings Malcontent. O código-fonte permanece no WSL2; a VM, acessível por `ssh lux` com conta administrativa de desenvolvimento, recebe somente uma cópia para integração e testes.

O agente planejado será escrito em Python 3 e executado como serviço systemd no computador. Ele iniciará a comunicação REST/HTTPS com o backend por polling, para que o celular não precise alcançar diretamente a rede local do Lux. Os contratos de identidade e pareamento já existem no backend; seu uso pelo serviço instalado, a proteção local da credencial, o protocolo de comandos, a disponibilidade e a confirmação de aplicação ainda precisam ser implementados e validados. `lux-agent/` contém uma PoC Python somente de leitura de filtros e limites para usuário explícito, com testes isolados e [procedimento SSH/rsync](../lux-agent/README.md). Não há serviço systemd, interface GTK ou comunicação com backend.

Responsabilidades previstas para o agente: iniciar automaticamente com o sistema; autenticar a identidade do computador perante o backend; participar do pareamento somente após autorização local de uma pessoa administradora; consultar trabalho pendente por polling; aplicar localmente apenas operações que tenham suporte confirmado e autorização do sistema; reportar resultado e estado de aplicação; e tolerar falhas de rede sem afirmar sucesso quando não houver confirmação. A semântica de tentativas, repetição e sincronização será definida no protocolo.

## Capacidades observadas e limites

As provas manuais relatadas pelo usuário confirmam leitura de filtros e limites pelo `malcontent-client`, configuração de horários por `Malcontent.SessionLimitsBuilder` e `Malcontent.Manager.set_session_limits()`, bloqueio de login por horário no PAM/GDM e restrições de aplicativos/instalações observadas no GNOME. Não foram reproduzidas escritas nesta PoC. `libpam-malcontent` foi instalado manualmente: não veio habilitado na instalação inicial. Não presumir a mesma configuração em outra instalação Lux.

A PoC usa `Gio.BusType.SYSTEM`, `Malcontent.Manager.get_app_filter()` e `get_session_limits()` com `ManagerGetValueFlags.NONE`, sem solicitar autorização interativa. A leitura das próprias políticas da conta de teste foi comprovada via SSH sem sudo; a conta pertence ao grupo sudo, mas isso não comprova permissões para outras contas ou para um futuro usuário de serviço. Nenhuma política é alterada. Falhas de consulta não produzem sucesso parcial.

Foram observadas particularidades de UTC nas provas manuais. A PoC preserva valores nativos serializados, sem conversão para horário local. A implementação [SessionLimits 0.13.1-5](https://sources.debian.org/src/malcontent/0.13.1-5/libmalcontent/session-limits.c/) usa UTC ao avaliar a faixa diária; validar conversões e fronteiras de dia antes de futuras escritas. A consulta de configuração não comprova aplicação efetiva. Encerramento automático de sessões e bloqueio de execução direta de aplicativos permanecem não comprovados.

Python 3/systemd e a interface Python/GTK4/libadwaita permanecem decisões de implementação futura. O Agent usará as políticas e serviços nativos; não criará outro mecanismo de bloqueio nem exigirá modificar o código-fonte do GNOME ou do aplicativo Controle Parental. D-Bus permite comunicação entre processos locais; systemd gerencia a execução do serviço. Privilégios mínimos e autorização local por operação ainda precisam ser demonstrados; não há fluxo polkit próprio implementado.

Investigar quais contas podem ser administradas, quais restrições podem ser consultadas/alteradas, quais privilégios são exigidos, como detectar aplicação efetiva e como reportar indisponibilidade e erros. Pedidos de liberação, expiração, encerramento automático, restrição por navegador e classificações do PDF não demonstram suporte do GNOME.

## Segurança e confiança

### Decisão para a confiança inicial do Agent

A identidade inicial do computador será provisionada por uma ferramenta administrativa do backend, sem endpoint público de registro. Uma pessoa autorizada a operar o backend criará uma credencial criptograficamente aleatória e exclusiva por dispositivo. Um administrador local instalará essa credencial no Lux em arquivo restrito ao serviço; ela nunca será enviada ao mobile, incluída no QR ou registrada em logs. O backend armazenará apenas o hash da credencial, permitindo sua invalidação. O identificador do computador sozinho não autoriza solicitações.

Esse procedimento exige participação de quem administra o backend e do administrador local do Lux. A transferência da credencial deve ocorrer por canal seguro. A credencial autentica uma instalação autorizada; não comprova por si só o modelo físico do equipamento nem que uma autorização administrativa local aconteceu em cada solicitação.

Após o provisionamento, o futuro Agent deverá exigir autorização administrativa local antes de solicitar cada sessão de pareamento. A verificação local e a proteção da credencial precisam ser implementadas e testadas no Lux real; um campo booleano enviado à API não será tratado como prova independente de autorização Linux. O backend confiará no Agent previamente provisionado para cumprir essa obrigação. O mecanismo local concreto permanece pendente de investigação, sem assumir suporte a polkit.

O QR transportará somente um token temporário de uso único, separado da credencial do Agent. O provisionamento e o pareamento são operações distintas: preparar a identidade do computador não concede acesso a um responsável. HTTPS será obrigatório fora do ambiente local de desenvolvimento. A infraestrutura de identidade e pareamento está implementada no backend; a proteção da credencial, a autorização local e a validação no Agent continuam pendentes.

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

A interface administrativa local, seu mecanismo de autorização, a instalação systemd, a apresentação do QR, o polling e o tratamento de falhas ainda precisam ser implementados no Agent Python. Credencial perdida ou comprometida deve ser invalidada pela operação administrativa do backend; não existe registro público ou token global para recuperar acesso. Testes de API e fixtures de desenvolvimento não comprovam essas obrigações nem identificam fisicamente um Lenovo Lux.

## Interface gráfica local de pareamento

Componente planejado em Python com GTK4/libadwaita, visualmente integrado ao GNOME e aberto sob demanda por um administrador local. É distinto do serviço Python/systemd: o Agent inicia no boot e continua em segundo plano mesmo quando a interface é fechada. O transporte local entre interface e Agent e o mecanismo de autorização ainda precisam ser definidos e validados; não há contrato IPC implementado.

Fluxo esperado:

1. O administrador abre a interface no Lux e autoriza localmente o pareamento.
2. A interface solicita ao Agent uma sessão; o Agent previamente provisionado autentica-se no backend e solicita o token temporário.
3. A interface exibe QR e expiração, sem expor a credencial permanente do Agent.
4. O responsável autenticado lê o QR no mobile e confirma o computador.
5. O backend valida autenticação, autorização, identidade e token e cria o vínculo somente após as verificações, conforme o contrato implementado.
6. O computador aparece na lista autorizada; o Agent observa a associação no polling. Isso não confirma aplicação de restrições.

O futuro Agent mínimo poderá usar QR no terminal antes da interface GTK; a PoC atual é exclusivamente de leitura local. O roteiro demonstrativo em [Mobile](mobile.md#teste-manual-de-pareamento-com-dispositivo-de-demonstração) já gera QR localmente usando a API, mas é ferramenta de desenvolvimento, não implementação do Agent ou autorização Linux.

## Verificações pendentes

- Repetir a PoC com conta infantil e políticas restritivas já configuradas, mediante indicação explícita da conta; validar falhas reais de autorização e indisponibilidade. A leitura atual cobre somente a própria conta de teste, sem restrições.
- Contas administráveis, permissões D-Bus/AccountsService/polkit e limites de cada operação parental.
- UTC, fronteiras de dia, encerramento automático de sessões e bloqueio de execução direta de aplicativos.
- Instalação systemd, início no boot, usuário do serviço e proteção local da credencial com privilégio mínimo.
- Autorização local do administrador, comunicação interface/Agent, QR temporário e revogação com computador real.
- HTTPS autenticado, polling, reconexão, repetição segura e consulta posterior que comprove a aplicação; os contratos de comandos ainda não existem.

Essas verificações podem continuar na VM disponível; não bloqueiam a experiência mobile com mocks identificados. O estado das oito etapas fica em [Arquitetura](architecture.md#etapas-de-implementação).

## Registro de provas técnicas

Para cada teste no Lux real, registrar versão do sistema e dos componentes, interfaces observadas, passos reproduzíveis, usuário/permissões, resultado e limitações. Diferenciar observação de hipótese. Só documentar uma capacidade como confirmada depois de demonstrá-la no ambiente alvo; registrar também falhas e operações indisponíveis.

### PoC de leitura via SSH — 2026-10-23

- Ambiente confirmado nesta execução: Lux 3/Canopus, Debian Trixie, GNOME Shell 50.4, Python 3.14.6, python3-gi 3.57.1-1, malcontent/bindings/libpam-malcontent 0.13.1-5, AccountsService 23.13.9-8+b2 ativo. A data local da VM foi consultada; sincronização do relógio não foi validada.
- Conta de teste explicitamente indicada; execução SSH pela própria conta (grupo sudo), sem sudo e sem autorização interativa. Procedimento reproduzível no [README da PoC](../lux-agent/README.md#sincronizar-e-executar-no-lux).
- A execução da PoC concluiu com JSON: `app_filter.enabled=false`, `AppFilter=[false, []]`, `OarsFilter=["oars-1.1", {}]`, instalações de usuário/sistema permitidas; `session_limits.enabled=false`, `LimitType=0`.
- Comparação: as consultas de filtros e limites pelo `malcontent-client`, sem interação e para a mesma conta, retornaram resultados compatíveis. Consultas anteriores à PoC retornaram os mesmos valores; o código chama somente getters. Nenhuma escrita parental, alteração de PAM, contas ou serviços foi executada.
- Sete testes unitários passaram no WSL2 (Python 3.12.3) e no Lux, incluindo dependência ausente e erro sem JSON parcial. Políticas restritivas são verificadas com objetos simulados nos testes; não foram verificadas por esta PoC na VM. Não há evidência nova de encerramento de sessão, execução direta ou leitura de outra conta.
