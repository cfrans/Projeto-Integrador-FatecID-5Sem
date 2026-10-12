# Integração Lenovo Lux / GNOME

## Estado conhecido

O projeto tem como alvo os computadores Lenovo Lux com GNOME. O ambiente de referência previsto é GNOME 50.5, mas não há ISO do Lux disponível para reproduzir e inspecionar esse sistema. APIs, permissões e operações de controle parental ainda não foram validadas no Lux. A integração não está implementada.

O agente planejado será escrito em Python 3 e executado como serviço systemd no computador. Ele iniciará a comunicação REST/HTTPS com o backend por polling, para que o celular não precise alcançar diretamente a rede local do Lux. Os contratos de identidade e pareamento já existem no backend; seu uso pelo serviço instalado, a proteção local da credencial, o protocolo de comandos, a disponibilidade e a confirmação de aplicação ainda precisam ser implementados e validados. `lux-agent/` contém apenas um README, sem código Python, serviço systemd ou interface GTK.

Responsabilidades previstas para o agente: iniciar automaticamente com o sistema; autenticar a identidade do computador perante o backend; participar do pareamento somente após autorização local de uma pessoa administradora; consultar trabalho pendente por polling; aplicar localmente apenas operações que tenham suporte confirmado e autorização do sistema; reportar resultado e estado de aplicação; e tolerar falhas de rede sem afirmar sucesso quando não houver confirmação. A semântica de tentativas, repetição e sincronização será definida no protocolo.

## Hipóteses técnicas a validar

Python 3/systemd e a interface Python/GTK4/libadwaita são decisões de implementação futura. D-Bus, malcontent/libmalcontent via PyGObject, AccountsService e autorização por polkit são caminhos de investigação para integração local. Nenhum foi confirmado como interface adequada ou disponível no Lenovo Lux. Verificar a versão e os pacotes no equipamento real, consultar documentação oficial das interfaces instaladas e fazer provas pequenas com permissões explícitas. Não inferir suporte a partir apenas do nome de um componente ou da versão GNOME 50.5. O Agent usará as políticas e serviços que o controle parental nativo utiliza; não criará outro mecanismo de bloqueio nem exigirá modificar o código-fonte do GNOME ou do aplicativo Controle Parental. D-Bus permite comunicação entre processos locais; systemd gerencia a execução do serviço.

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

A prova de conceito poderá usar QR no terminal antes da interface GTK. O roteiro demonstrativo em [Mobile](mobile.md#teste-manual-de-pareamento-com-dispositivo-de-demonstração) já gera QR localmente usando a API, mas é ferramenta de desenvolvimento, não implementação do Agent ou autorização Linux.

## Verificações pendentes

- Acesso à instalação Lux de referência, versão efetiva GNOME/pacotes, APIs disponíveis e prova mínima Python/PyGObject com malcontent.
- Contas administráveis, permissões D-Bus/AccountsService/polkit e limites de cada operação parental.
- Instalação systemd, início no boot, usuário do serviço e proteção local da credencial com privilégio mínimo.
- Autorização local do administrador, comunicação interface/Agent, QR temporário e revogação com computador real.
- HTTPS autenticado, polling, reconexão, repetição segura e consulta posterior que comprove a aplicação; os contratos de comandos ainda não existem.

Essas verificações podem começar quando o ambiente estiver disponível; não bloqueiam a experiência mobile com mocks identificados. O estado das oito etapas fica em [Arquitetura](architecture.md#etapas-de-implementação).

## Registro de provas técnicas

Para cada teste no Lux real, registrar versão do sistema e dos componentes, interfaces observadas, passos reproduzíveis, usuário/permissões, resultado e limitações. Diferenciar observação de hipótese. Só documentar uma capacidade como confirmada depois de demonstrá-la no ambiente alvo; registrar também falhas e operações indisponíveis.
