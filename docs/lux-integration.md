# Integração Lenovo Lux / GNOME

## Estado conhecido

O projeto tem como alvo os computadores Lenovo Lux com GNOME. A versão GNOME 50.5 foi informada para o ambiente de referência, mas não há ISO do Lux disponível para reproduzir e inspecionar esse sistema. Não foi validada nesta etapa nenhuma API, permissão ou operação de controle parental. A integração não está implementada.

O agente planejado será escrito em Python 3 e executado como serviço systemd no computador. Ele iniciará a comunicação REST/HTTPS com o backend por polling, para que o celular não precise alcançar diretamente a rede local do Lux. O desenho é futuro e ainda precisa validar identidade do dispositivo, protocolo, autenticação, disponibilidade, entrega e confirmação de comandos.

Responsabilidades previstas para o agente: iniciar automaticamente com o sistema; autenticar a identidade do computador perante o backend; participar do pareamento somente após autorização local de uma pessoa administradora; consultar trabalho pendente por polling; aplicar localmente apenas operações que tenham suporte confirmado e autorização do sistema; reportar resultado e estado de aplicação; e tolerar falhas de rede sem afirmar sucesso quando não houver confirmação. A semântica de tentativas, repetição e sincronização será definida no protocolo.

## Hipóteses técnicas a validar

D-Bus, malcontent/libmalcontent, AccountsService e autorização por polkit são caminhos de investigação. Nenhum foi confirmado como interface adequada ou disponível no Lenovo Lux. Verificar a versão e os pacotes no equipamento real, consultar documentação oficial das interfaces instaladas e fazer provas pequenas com permissões explícitas. Não inferir suporte a partir apenas do nome de um componente.

Investigar quais contas podem ser administradas, quais restrições podem ser consultadas/alteradas, quais privilégios são exigidos, como detectar aplicação efetiva e como reportar indisponibilidade e erros. Pedidos de liberação, expiração, encerramento automático, restrição por navegador e classificações do PDF não demonstram suporte do GNOME.

## Segurança planejada

As medidas abaixo são requisitos futuros para implementação e validação, não capacidades existentes:

- armazenar senhas de responsáveis usando hashing apropriado para senhas;
- autenticar e autorizar cada recurso com verificação de vínculo e escopo, sem confiar somente em autenticação de sessão;
- dar identidade própria ao computador/agente e autenticar a comunicação com o backend;
- exigir autorização local compatível com o sistema para cada operação privilegiada;
- proteger credenciais e segredos do agente no computador, sem expô-los ao mobile;
- parear por token aleatório temporário, de uso único e revogável, com autorização explícita de pessoa administradora local e privilégio mínimo;
- permitir revogar vínculos e invalidar a identidade/credenciais do computador;
- nunca enviar ou armazenar senha root/admin no mobile, nem aceitar comandos arbitrários recebidos pela rede. O agente deve executar somente operações explícitas e suportadas, com privilégios mínimos.

QR Code pode transportar o token temporário de pareamento, mas não deve ser credencial administrativa permanente. O protocolo deverá proteger tokens em trânsito e impedir reutilização após consumo ou expiração. Detalhes de validade, revogação e rotação serão definidos no contrato de pareamento.

## Registro de provas técnicas

Para cada teste no Lux real, registrar versão do sistema e dos componentes, interfaces observadas, passos reproduzíveis, usuário/permissões, resultado e limitações. Diferenciar observação de hipótese. Só documentar uma capacidade como confirmada depois de demonstrá-la no ambiente alvo; registrar também falhas e operações indisponíveis.
