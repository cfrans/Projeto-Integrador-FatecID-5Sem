# Validação

Última validação de cada parte do sistema. Cada linha é **substituída** pela validação mais recente daquela parte; o detalhe de execuções anteriores fica no histórico do Git. Ao registrar, informe data, ambiente, o que foi comprovado e o que ficou de fora. Um teste existente não é evidência de aprovação: a validação precisa corresponder ao código atual.

Ambiente Lux de referência: VM VirtualBox com Lux 3/Canopus (Debian Trixie), GNOME 50.4, malcontent 0.13.1-5, conta gerenciada sem privilégio administrativo. Nas validações abaixo o backend rodou no WSL2 e o Agent o alcançou por HTTPS com CA explícita ([proxy temporário](../lux/https-development.md)) por túnel SSH.

## Última validação por parte

| Parte | Data | O que foi comprovado | Fora desta validação |
| --- | --- | --- | --- |
| Suíte automatizada completa em Docker ([Testes](test-suite.md)) | 2026-11-19 | MySQL (32), integração mobile/API/MySQL/client (1) e Cypress (5 cenários) passando, com o limite de tentativas, a recuperação sem enumeração e a revogação do JWT (401 após logout, troca e redefinição de senha). Fora do Docker: backend 77 unitários e 8 HTTP, mobile 94 de contrato (WSL2); client 13 e Agent 150 na rodada anterior do mesmo dia. | Repetir sobre o commit final (LUX-10). |
| Comandos parentais pelo app (apps, navegadores, instalação) | 2026-11-18 | App no celular (Expo Go) bloqueou e liberou apps no Lux: pendente → aplicado em ~10 s, app sumiu da sessão da criança, grupo do LibreOffice bloqueado junto, app não bloqueável sem interruptor, alterações seguidas aplicaram só a última. Com o Agent offline, a alteração ficou pendente e foi aplicada ao voltar. | Efeito do bloqueio de instalação (sem flatpak na VM); perfis no real só por testes. |
| Execução do `set` no Agent | 2026-11-17 | Serviço aplicou e releu o filtro (0,17 s), app pedido inexistente/lançador genérico gerou `POLICY_UNAVAILABLE` sem gravar nada, liberar limpou o filtro. Pelo terminal o app bloqueado ainda abre. | `uninstall.sh --reset-policies` com filtro aplicado. |
| Janela de pareamento Piplup | 2026-11-18 | Instalação do atalho, estados "já pareado", "autorização necessária", QR com contagem e "pareado"; fechar a janela cancela sem afetar o serviço. | Leitura do QR pela câmera a partir da janela (confirmação feita pela API). |
| Pareamento pelo terminal (`lux-agent pair`) | 2026-11-15 | Senha de administrador pedida, QR lido pelo app no celular, confirmação com nome e conta, serviço iniciado com relatório aceito; conta sem privilégio negada. Journal sem credencial, Bearer ou token. | — |
| Serviço systemd (`install.sh`/`uninstall.sh`) | 2026-11-14 | Recusa de conta administrativa, reexecução idempotente, relatório com 59 apps, `agent.ping` em ~4 s, reinício e reboot sem reprocessar, revogação encerrando com código 3, desinstalação removendo tudo e mantendo o filtro. | Hardening extra da unit (`PrivateDevices` em diante), a validar no LUX-10. |
| Escrita do filtro via polkit | 2026-11-13 | Sem a regra, negado; com a regra, grava, relê igual e restaura ([provas](../lux/integration.md#provas-que-sustentam-as-decisões)). | Horários e classificação etária. |
| Presença real do Agent | 2026-11-18 | Online/offline pelo último contato, com o Agent rodando no WSL. | Presença com o serviço no Lux (LUX-10). |
| Transporte HTTPS do Agent | 2026-10-25 | CA não confiável e hostname incompatível recusados sem repetição; revogação durante o polling encerra com código 3. | Hospedagem definitiva, DNS/LAN pública. |
| Client simulado | 2026-10-25 | Migrations do zero, presença por heartbeat, integração mobile/API/MySQL/client e bundle Android. | Interação e câmera em aparelho físico. |

## Como repetir

- Testes automatizados: [Testes](test-suite.md), [Backend](../backend/api.md#verificações), [Mobile](../mobile/app.md#configuração-e-verificações) e `python3 -B -m unittest discover -s tests` em `lux-agent/`.
- Agent no Lux: [sincronizar, instalar e parear](../../lux-agent/README.md#instalar-como-serviço), com o backend acessível por [HTTPS de desenvolvimento](../lux/https-development.md) e `ENABLE_PARENTAL_COMMANDS=true`.
- No celular: [roteiro manual](../mobile/app.md#validação-manual-no-celular).
