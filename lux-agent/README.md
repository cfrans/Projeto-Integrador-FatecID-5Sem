# Lux Agent

Fundação Python 3 do Agent com dois comandos independentes: `read_policies.py` lê políticas nativas; `check_backend.py` valida uma vez a identidade provisionada contra o NestJS. Não há polling, pareamento local, operações remotas, serviço systemd ou GTK.

A PoC de leitura usa PyGObject/libmalcontent e AccountsService, sem alterar políticas ou solicitar elevação. A VM de referência é Lux 3/Canopus, GNOME 50.4 e malcontent 0.13.1-5. Leituras com e sem restrições foram validadas; consultar outra conta exigiu autenticação administrativa. Privilégios mínimos do futuro serviço permanecem pendentes. O mock do Agent no backend ainda não existe.

## Diagnóstico autenticado

`check_backend.py` usa somente a biblioteca padrão Python e o contrato existente `GET /agent/associations`. A credencial Bearer identifica o computador no backend por SHA-256; não é necessário enviar `deviceId`, hostname ou JWT de responsável. A consulta aceita histórico vazio e não cria vínculo, presença ou sessão de pareamento. Nenhum endpoint novo foi necessário.

Provisione pela [ferramenta administrativa existente](../docs/backend.md#provisionamento-e-invalidação-administrativa), usando `--demo` para fixtures com `NODE_ENV=development`. O arquivo contém somente a credencial aleatória, nunca seu hash. Transfira-o separadamente por SSH/SFTP, sem incluí-lo no rsync dos fontes. Mantenha-o fora do repositório e em diretório privado `0700`, pertencente à conta executora; o arquivo deve pertencer à mesma conta e ter modo `0400` ou `0600`. Não use symlink ou hardlink. O comando verifica essas propriedades do arquivo antes de enviá-lo; não corrige permissões nem instala credenciais automaticamente. Administradores/root continuam capazes de acessar o segredo; o usuário definitivo do serviço será definido posteriormente.

```bash
python3 -B lux-agent/check_backend.py --backend-url https://api.exemplo --credential-file /caminho/privado/agent-credential
python3 -B lux-agent/check_backend.py --backend-url http://127.0.0.1:3000 --credential-file /caminho/privado/agent-credential --allow-local-http
```

A URL deve ser apenas a origem (sem usuário, senha, caminho, query ou fragmento). HTTPS valida certificados pelo Python/sistema; não existe opção para ignorar TLS. HTTP exige `--allow-local-http` e host loopback (`127.0.0.1`, `::1` ou `localhost`). Proxies de ambiente são ignorados e redirecionamentos recusados para evitar encaminhamento da credencial. Configure somente um backend confiável. `--timeout` controla operações de rede (padrão 10 segundos; máximo 120), não um prazo total da execução. Não há repetição automática.

Saída de sucesso: HTTP 200 e quantidade de associações no histórico, sem nomes de responsáveis, tokens ou conteúdo bruto. Falhas vão para stderr, sem corpo HTTP ou detalhes de exceções. Códigos de saída:

| Código | Diagnóstico |
| --- | --- |
| 0 | Comunicação autenticada confirmada e resposta compatível |
| 2 | Argumentos, URL ou arquivo de credencial inválidos |
| 3 | HTTP 401: identidade inválida/revogada; intervenção administrativa |
| 4 | Falha de conexão, TLS ou timeout |
| 5 | HTTP 429 ou 5xx: indisponibilidade; repetir manualmente depois |
| 6 | HTTP inesperado/redirecionamento ou resposta incompatível |

### Desenvolvimento com a VM

Para alcançar o backend do WSL2 sem expô-lo na rede da VM, use um encaminhamento SSH temporário (somente loopback). A credencial já deve estar instalada separadamente no caminho privado indicado:

```bash
ssh -o BatchMode=yes -o ExitOnForwardFailure=yes -R 127.0.0.1:13000:127.0.0.1:3000 lux 'python3 -B ~/lux-agent-poc/check_backend.py --backend-url http://127.0.0.1:13000 --credential-file ~/.local/state/lux-agent/credential --allow-local-http'
```

O Agent inicia a requisição no Lux; o backend não acessa a VM. O túnel existe somente durante o comando. Essa prova usa HTTP em loopback dentro de SSH, não valida uma implantação HTTPS real.

### Evidência desta iteração — 2026-10-24

- Identidade demonstrativa criada pela ferramenta existente; consulta real Agent → NestJS → MySQL retornou HTTP 200/histórico vazio no WSL2 e no Lux via túnel SSH.
- No Lux: credencial aleatória no formato correto recusada com HTTP 401/código 3; a credencial válida também foi recusada após revogação pela ferramenta administrativa. Conexão recusada em loopback retornou código 4.
- 14 testes Python passaram no WSL2 (3.12.3) e Lux (3.14.6), incluindo os sete testes originais da PoC. HTTP 503, timeout e respostas inválidas foram simulados; não se interrompeu o MySQL/backend para provocar indisponibilidade real.
- A PoC leu novamente a própria conta no Lux sem sudo, com filtros/limites desativados. A leitura restritiva anterior está preservada no [registro de integração](../docs/lux-integration.md#registro-de-provas-técnicas); não foi repetida com privilégios nesta iteração.
- Backend no container Node 24.21.0: lint, typecheck, seis testes unitários e cinco testes HTTP passaram. Para os HTTP, foi necessário copiar `backend/test` para `/app/test`, pois o Compose não monta esse diretório. Nenhum contrato/backend foi alterado; a suíte MySQL dedicada não foi executada.
- A identidade demonstrativa de validação foi revogada, preservando seu histórico; os arquivos temporários da credencial foram removidos do WSL2, container e Lux. Os containers de desenvolvimento ficaram iniciados. Não houve alteração de PAM, políticas, permissões Linux, serviços ou comandos privilegiados na VM.

Pendências: HTTPS real e falhas TLS, usuário/instalação do serviço, polling e recuperação de conexão, autorização administrativa local e pareamento. Sucesso deste diagnóstico não comprova aplicação de política nem identidade física do equipamento.

Referências de implementação: [urllib.request no Python 3.12](https://docs.python.org/3.12/library/urllib.request.html) e [os no Python 3.14](https://docs.python.org/3.14/library/os.html#os.open).

## Desenvolver e testar no WSL2

O fonte permanece versionado neste repositório. Os testes usam `unittest` da biblioteca padrão, sem GI, D-Bus ou dependências pip:

```bash
python3 -m unittest discover -s lux-agent -v
python3 -m compileall -q lux-agent
python3 lux-agent/read_policies.py --help
```

O diretório ainda não tem ferramentas Python de lint/typecheck configuradas. Compilação verifica sintaxe; os testes de comunicação usam um servidor HTTP local temporário e verificam Bearer, respostas, redirecionamento, falhas e proteção da credencial. Os testes da PoC verificam usuário obrigatório/inexistente, dependência ausente, flags sem interação, valores nativos, políticas desativadas e falha sem saída parcial. Esses testes isolados não comprovam permissões nem aplicação de restrições no Lux.

## Sincronizar e executar no Lux

Execute na raiz do repositório no WSL2. Use o alias SSH já configurado, sem copiar chaves ou credenciais. Primeiro verifique conectividade e ambiente, sem `sudo`:

```bash
ssh -o BatchMode=yes -o ConnectTimeout=10 lux 'id; cat /etc/os-release; gnome-shell --version; python3 --version; command -v rsync; systemctl is-active accounts-daemon'
ssh lux 'dpkg-query -W malcontent gir1.2-malcontent-0 python3-gi; python3 -c '\''import gi; gi.require_version("Malcontent", "0"); from gi.repository import Malcontent; print(Malcontent.Manager.get_app_filter.__doc__); print(Malcontent.Manager.get_session_limits.__doc__)'\'''
```

Se faltar dependência ou houver divergência, investigue antes de prosseguir. Instalação de pacotes ou alteração da configuração do Lux exige confirmação; não faz parte deste procedimento.

Revise a simulação e depois execute o mesmo rsync sem `-n`:

```bash
rsync -rltivn -e 'ssh -o BatchMode=yes -o ConnectTimeout=10' --include='/check_backend.py' --include='/test_check_backend.py' --include='/read_policies.py' --include='/test_read_policies.py' --include='/README.md' --exclude='*' lux-agent/ lux:lux-agent-poc/
rsync -rltiv -e 'ssh -o BatchMode=yes -o ConnectTimeout=10' --include='/check_backend.py' --include='/test_check_backend.py' --include='/read_policies.py' --include='/test_read_policies.py' --include='/README.md' --exclude='*' lux-agent/ lux:lux-agent-poc/
ssh lux 'python3 -B -m unittest discover -s ~/lux-agent-poc -v'
ssh lux 'python3 -B ~/lux-agent-poc/read_policies.py --user USUARIO_ALVO'
```

O destino é uma cópia executável em `~/lux-agent-poc/`, sem Git e sem edição de fonte na VM. A lista de inclusão transfere somente os cinco arquivos indicados; `.env`, chaves, credenciais, caches e qualquer outro arquivo ficam excluídos. Não use `--delete` nem sincronize a raiz do repositório. Substitua `USUARIO_ALVO` pelo login da conta que deseja consultar; não há usuário implícito nem seleção automática de conta infantil.

Use o Python do sistema Lux com seus bindings GI e comece sem `sudo`: a PoC usa `ManagerGetValueFlags.NONE`, sem autorização interativa ou elevação automática. Permissão negada, serviço indisponível ou dados inválidos retornam erro em stderr e código 1, sem JSON parcial. Argumentos inválidos retornam 2; uma consulta completa retorna 0 e JSON em stdout.

Na VM de referência, consultar a própria conta funcionou sem sudo, mas consultar outra conta pela sessão SSH administrativa foi negado à PoC e à CLI. As regras locais exigem autenticação administrativa para `ReadAny`; pertencer ao grupo sudo não basta. A negativa é falha de autorização, não prova de que a conta está sem restrições. Para comparar sem solicitar interação, use `malcontent-client get-app-filter --no-interactive USUARIO_ALVO` e `malcontent-client get-session-limits --no-interactive USUARIO_ALVO` no Lux. Consultas privilegiadas dependem de autorização explícita e autenticação local: `sudo -n` exigiu senha, e a leitura restritiva foi concluída pelo usuário com sudo autenticado no próprio terminal. Os JSONs antes/depois foram idênticos e os campos expostos pela CLI foram compatíveis. Não altere regras polkit para contornar essa limitação. Evidências em [Integração Lux](../docs/lux-integration.md#registro-de-provas-técnicas).

O JSON inclui nome/UID, `enabled` e `policy` para cada consulta. `policy` preserva `serialize().unpack()` da biblioteca; tuplas viram arrays JSON. É saída diagnóstica da PoC, sem contrato de backend. `enabled` descreve a configuração, não comprova bloqueio efetivo. As duas leituras são sequenciais, sem snapshot transacional. `DailySchedule`, quando presente, mantém segundos desde meia-noite; não convertemos para horário local. A interpretação de UTC exige cuidado e validação antes de futuras escritas.

Referências usadas: cliente oficial instalado em `/usr/bin/malcontent-client`, contrato local `/usr/share/dbus-1/interfaces/com.endlessm.ParentalControls.SessionLimits.xml` e [fonte de SessionLimits 0.13.1-5](https://sources.debian.org/src/malcontent/0.13.1-5/libmalcontent/session-limits.c/). Registro de resultados e limitações em [Integração Lux](../docs/lux-integration.md#registro-de-provas-técnicas).
