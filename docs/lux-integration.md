# Integração Lenovo Lux / GNOME

## Estado conhecido

O projeto tem como alvo os computadores Lenovo Lux com GNOME. A versão GNOME 50.5 foi informada para o ambiente de referência, mas não há ISO do Lux disponível para reproduzir e inspecionar esse sistema. Não foi validada nesta etapa nenhuma API, permissão ou operação de controle parental. A integração não está implementada.

O agente planejado será escrito em Python 3 e executado como serviço systemd no computador. Ele iniciará a comunicação REST/HTTPS com o backend por polling, para que o celular não precise alcançar diretamente a rede local do Lux. O desenho é futuro e ainda precisa validar identidade do dispositivo, protocolo, autenticação, disponibilidade, entrega e confirmação de comandos.

Responsabilidades previstas para o agente: iniciar automaticamente com o sistema; autenticar a identidade do computador perante o backend; participar do pareamento somente após autorização local de uma pessoa administradora; consultar trabalho pendente por polling; aplicar localmente apenas operações que tenham suporte confirmado e autorização do sistema; reportar resultado e estado de aplicação; e tolerar falhas de rede sem afirmar sucesso quando não houver confirmação. A semântica de tentativas, repetição e sincronização será definida no protocolo.

## Hipóteses técnicas a validar

D-Bus, malcontent/libmalcontent, AccountsService e autorização por polkit são caminhos de investigação. Nenhum foi confirmado como interface adequada ou disponível no Lenovo Lux. Verificar a versão e os pacotes no equipamento real, consultar documentação oficial das interfaces instaladas e fazer provas pequenas com permissões explícitas. Não inferir suporte a partir apenas do nome de um componente.

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
2. Para iniciar pareamento, o Agent verifica autorização administrativa local. Só então solicita `POST /agent/pairing-sessions`, exibe o QR retornado e informa sua expiração. O administrador não precisa fornecer senha Linux ao backend ou mobile.
3. O responsável autenticado lê o QR, valida a solicitação e confirma o vínculo. O Agent consulta `GET /agent/associations` por polling para observar a associação no backend. Isso confirma um vínculo persistido, não aplicação de controles GNOME.
4. O administrador local poderá revogar um vínculo pelo Agent usando `DELETE /agent/associations/:associationId`. O responsável poderá revogar o próprio vínculo no mobile. O Agent deverá observar a revogação no polling e deixar de aceitar trabalho daquele responsável. Não se presume remoção ou alteração automática de restrições Linux.
5. Sem identidade válida, o Agent não cria sessões nem consulta vínculos. Diante de `401`, deve interromper operações autenticadas e exigir intervenção administrativa; diante de falha de rede/`503`, deve mostrar indisponibilidade e não afirmar sucesso. QR expirado ou consumido exige nova solicitação após nova autorização local. Dispositivo ocupado por outro vínculo não deve transferir acesso automaticamente.

A interface administrativa local, seu mecanismo de autorização, a instalação systemd, a apresentação do QR, o polling e o tratamento de falhas ainda precisam ser implementados no Agent Python. Credencial perdida ou comprometida deve ser invalidada pela operação administrativa do backend; não existe registro público ou token global para recuperar acesso. Testes de API e fixtures de desenvolvimento não comprovam essas obrigações nem identificam fisicamente um Lenovo Lux.

## Registro de provas técnicas

Para cada teste no Lux real, registrar versão do sistema e dos componentes, interfaces observadas, passos reproduzíveis, usuário/permissões, resultado e limitações. Diferenciar observação de hipótese. Só documentar uma capacidade como confirmada depois de demonstrá-la no ambiente alvo; registrar também falhas e operações indisponíveis.
