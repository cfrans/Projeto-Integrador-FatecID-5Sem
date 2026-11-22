# Validação

Última validação de cada parte do sistema. Cada linha é **substituída** pela validação mais recente daquela parte; o detalhe de execuções anteriores fica no histórico do Git. Ao registrar, informe data, ambiente, o que foi comprovado e o que ficou de fora. Um teste existente não é evidência de aprovação: a validação precisa corresponder ao código atual.

Ambiente Lux de referência: VM VirtualBox com Lux 3/Canopus (Debian Trixie), GNOME 50.4, malcontent 0.13.1-5, conta gerenciada sem privilégio administrativo. Nas validações abaixo o backend rodou no WSL2 e o Agent o alcançou por HTTPS com CA explícita ([proxy temporário](../lux/https-development.md)) por túnel SSH.

## Última validação por parte

| Parte | Data | O que foi comprovado | Fora desta validação |
| --- | --- | --- | --- |
| Suíte automatizada completa em Docker ([Testes](test-suite.md)) | 2026-11-21 | Sobre o commit `7e1d16a`: MySQL (32), integração mobile/API/MySQL/client (1) e Cypress (5 cenários) passando. Agent: 150 testes no WSL2 e 150 no Lux. | Backend unitário/HTTP, mobile de contrato e client fora do Docker não foram reexecutados nesta rodada (último registro: 2026-11-19). |
| Comandos parentais pelo app (apps, navegadores, instalação) | 2026-11-21 | Instalação do zero, pareamento com uma conta criada na hora e bloqueio do Firefox + instalação pelo celular: pedido → aplicado em 11 s (0,17 s no Agent), parâmetros iguais à releitura, `installation disallowed` no malcontent e app fora da sessão da criança. Com o serviço parado, a alteração ficou pendente 28 s e foi aplicada na reconexão. | Efeito do bloqueio de instalação: sem flatpak nos repositórios do Lux e sem catálogo na Central de Programas, não há onde observar. Perfis no real só por testes. |
| Execução do `set` no Agent | 2026-11-21 | Serviço aplicou e releu o filtro, app pedido inexistente/lançador genérico gerou `POLICY_UNAVAILABLE` sem gravar nada (2026-11-17), liberar limpou o filtro. `uninstall.sh --reset-policies` com instalação bloqueada voltou a permitir e deixou o filtro vazio. Pelo terminal o app bloqueado ainda abre. | — |
| Janela de pareamento Piplup | 2026-11-21 | Instalação do atalho, estados "já pareado", "autorização necessária", QR com contagem e "pareado"; QR lido pela câmera do celular a partir da janela, duas vezes; fechar a janela cancela sem afetar o serviço. | — |
| Pareamento pelo terminal (`lux-agent pair`) | 2026-11-15 | Senha de administrador pedida, QR lido pelo app no celular, confirmação com nome e conta, serviço iniciado com relatório aceito; conta sem privilégio negada. Journal sem credencial, Bearer ou token. | — |
| Serviço systemd (`install.sh`/`uninstall.sh`) | 2026-11-21 | Do zero com o hardening completo da unit (`PrivateDevices` a `SystemCallFilter`): relatório aceito, D-Bus com o AccountsService e backend funcionando. Reinício sem reprocessar comandos. Vínculo removido pelo app: serviço segue consultando e políticas mantidas. Identidade revogada: 401 na consulta seguinte, código 3 e nenhum reinício. `uninstall.sh` removeu tudo e a reinstalação pareou de novo. Recusa de conta administrativa, idempotência e reboot: 2026-11-14. | — |
| Escrita do filtro via polkit | 2026-11-13 | Sem a regra, negado; com a regra, grava, relê igual e restaura ([provas](../lux/integration.md#provas-que-sustentam-as-decisões)). | Horários e classificação etária. |
| Presença real do Agent | 2026-11-21 | Com o serviço no Lux: Online ativo, Offline depois de `systemctl stop` (com "Computador offline" na alteração pendente) e Online de novo após `start`. | Tempos de transição não cronometrados. |
| Transporte HTTPS do Agent | 2026-10-25 | CA não confiável e hostname incompatível recusados sem repetição; revogação durante o polling encerra com código 3. | Hospedagem definitiva, DNS/LAN pública. |
| Client simulado | 2026-10-25 | Migrations do zero, presença por heartbeat, integração mobile/API/MySQL/client e bundle Android. | Interação e câmera em aparelho físico. |

## Como repetir

- Testes automatizados: [Testes](test-suite.md), [Backend](../backend/api.md#verificações), [Mobile](../mobile/app.md#configuração-e-verificações) e `python3 -B -m unittest discover -s tests` em `lux-agent/`.
- Agent no Lux: [sincronizar, instalar e parear](../../lux-agent/README.md#instalar-como-serviço), com o backend acessível por [HTTPS de desenvolvimento](../lux/https-development.md) e `ENABLE_PARENTAL_COMMANDS=true`.
- No celular: [roteiro manual](../mobile/app.md#validação-manual-no-celular).
