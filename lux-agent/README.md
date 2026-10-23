# Lux Agent

Este diretório contém a primeira integração com o Lux: um programa que lê as configurações de controle parental de uma conta, testes que podem rodar no WSL2 e instruções para executar na VM. A consulta já funcionou no Lux; alterações de políticas e conexão com o backend ficam para etapas futuras.

Prova de conceito somente de leitura em Python 3/PyGObject/libmalcontent. Consulta os filtros de aplicativos e limites de sessão de um nome de login explícito usando o D-Bus de sistema e AccountsService. Não altera políticas, contas, PAM ou serviços; não possui comunicação com backend, pareamento, unidade systemd ou interface GTK.

O serviço planejado será Python 3/systemd, instalado no próprio Lenovo Lux. Iniciará comunicação de saída REST/HTTPS com o NestJS por polling, com identidade individual e privilégios mínimos. A VM de referência é Lux 3/Canopus (Debian Trixie), GNOME 50.4 e malcontent 0.13.1-5. A leitura nativa está disponível; permissões para outras contas e autorização local do futuro serviço ainda precisam ser validadas.

A interface de pareamento será um aplicativo separado em Python/GTK4/libadwaita, aberto sob demanda por administrador local. Fechá-la não encerrará o serviço. QR no terminal pertence a uma etapa futura, fora desta PoC.

A identidade e os endpoints de pareamento já existem no backend; proteção local da credencial, autorização administrativa, instalação do serviço, comunicação e escrita de políticas GNOME pelo Agent ainda não existem. Consulte [Integração Lux](../docs/lux-integration.md) e o [roadmap](../docs/architecture.md#etapas-de-implementação).

O futuro mock do Agent no backend também não foi implementado. Os mocks preservados no mobile não participam dos fluxos REST atuais nem comprovam integração Linux; consulte [Mocks e contratos](../docs/architecture.md#mocks-e-contratos).

## Desenvolver e testar no WSL2

O fonte permanece versionado neste repositório. Os testes usam `unittest` da biblioteca padrão, sem GI, D-Bus ou dependências pip:

```bash
python3 -m unittest discover -s lux-agent -v
python3 -m compileall -q lux-agent
python3 lux-agent/read_policies.py --help
```

O diretório ainda não tem ferramentas Python de lint/typecheck configuradas. Compilação verifica sintaxe; os testes verificam usuário obrigatório/inexistente, dependência ausente, flags sem interação, valores nativos, políticas desativadas e falha sem saída parcial. Esses testes isolados não comprovam permissões nem aplicação de restrições no Lux.

## Sincronizar e executar no Lux

Execute na raiz do repositório no WSL2. Use o alias SSH já configurado, sem copiar chaves ou credenciais. Primeiro verifique conectividade e ambiente, sem `sudo`:

```bash
ssh -o BatchMode=yes -o ConnectTimeout=10 lux 'id; cat /etc/os-release; gnome-shell --version; python3 --version; command -v rsync; systemctl is-active accounts-daemon'
ssh lux 'dpkg-query -W malcontent gir1.2-malcontent-0 python3-gi; python3 -c '\''import gi; gi.require_version("Malcontent", "0"); from gi.repository import Malcontent; print(Malcontent.Manager.get_app_filter.__doc__); print(Malcontent.Manager.get_session_limits.__doc__)'\'''
```

Se faltar dependência ou houver divergência, investigue antes de prosseguir. Instalação de pacotes ou alteração da configuração do Lux exige confirmação; não faz parte deste procedimento.

Revise a simulação e depois execute o mesmo rsync sem `-n`:

```bash
rsync -rltivn -e 'ssh -o BatchMode=yes -o ConnectTimeout=10' --include='/read_policies.py' --include='/test_read_policies.py' --include='/README.md' --exclude='*' lux-agent/ lux:lux-agent-poc/
rsync -rltiv -e 'ssh -o BatchMode=yes -o ConnectTimeout=10' --include='/read_policies.py' --include='/test_read_policies.py' --include='/README.md' --exclude='*' lux-agent/ lux:lux-agent-poc/
ssh lux 'python3 -B -m unittest discover -s ~/lux-agent-poc -v'
ssh lux 'python3 -B ~/lux-agent-poc/read_policies.py --user USUARIO_ALVO'
```

O destino é uma cópia executável em `~/lux-agent-poc/`, sem Git e sem edição de fonte na VM. A lista de inclusão transfere somente os três arquivos indicados; `.env`, chaves, credenciais, caches e qualquer outro arquivo ficam excluídos. Não use `--delete` nem sincronize a raiz do repositório. Substitua `USUARIO_ALVO` pelo login da conta que deseja consultar; não há usuário implícito nem seleção automática de conta infantil.

Use o Python do sistema Lux com seus bindings GI. Não execute com `sudo`: a PoC usa `ManagerGetValueFlags.NONE`, sem autorização interativa ou elevação automática. Permissão negada, serviço indisponível ou dados inválidos retornam erro em stderr e código 1, sem JSON parcial. Argumentos inválidos retornam 2; uma consulta completa retorna 0 e JSON em stdout.

O JSON inclui nome/UID, `enabled` e `policy` para cada consulta. `policy` preserva `serialize().unpack()` da biblioteca; tuplas viram arrays JSON. É saída diagnóstica da PoC, sem contrato de backend. `enabled` descreve a configuração, não comprova bloqueio efetivo. As duas leituras são sequenciais, sem snapshot transacional. `DailySchedule`, quando presente, mantém segundos desde meia-noite; não convertemos para horário local. A interpretação de UTC exige cuidado e validação antes de futuras escritas.

Referências usadas: cliente oficial instalado em `/usr/bin/malcontent-client`, contrato local `/usr/share/dbus-1/interfaces/com.endlessm.ParentalControls.SessionLimits.xml` e [fonte de SessionLimits 0.13.1-5](https://sources.debian.org/src/malcontent/0.13.1-5/libmalcontent/session-limits.c/). Registro de resultados e limitações em [Integração Lux](../docs/lux-integration.md#registro-de-provas-técnicas).
