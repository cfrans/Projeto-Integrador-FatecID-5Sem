# Lux Agent

Diretório reservado à integração Linux; contém apenas este README, sem código Python, unidade systemd ou interface GTK.

O serviço planejado será Python 3/systemd, instalado no próprio Lenovo Lux. Iniciará comunicação de saída REST/HTTPS com o NestJS por polling e usará apenas interfaces locais autorizadas do controle parental nativo. D-Bus, libmalcontent/PyGObject, AccountsService e polkit precisam ser validados na instalação real de referência GNOME 50.5.

A interface de pareamento será um aplicativo separado em Python/GTK4/libadwaita, aberto sob demanda por administrador local. Fechá-la não encerra o serviço. A prova de conceito poderá exibir QR no terminal antes da interface GTK.

A identidade e os endpoints de pareamento já existem no backend; proteção local da credencial, autorização administrativa, instalação, comunicação e operações GNOME ainda não existem. Consulte [Integração Lux](../docs/lux-integration.md) e o [roadmap](../docs/architecture.md#etapas-de-implementação).

O futuro mock do Agent no backend também não foi implementado. Os mocks preservados no mobile não participam dos fluxos REST atuais nem comprovam integração Linux; consulte [Mocks e contratos](../docs/architecture.md#mocks-e-contratos).
