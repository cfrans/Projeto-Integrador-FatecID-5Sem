# Lux Agent

Pacote Python `lux_agent` com cinco subcomandos: `pair` pareia o computador com um responsável por QR no terminal; `read-policies` lê políticas nativas; `prove-app-filter` prova a escrita do filtro de aplicativos com releitura e restauração; `check-backend` valida uma vez a identidade provisionada; `poll` consulta vínculos, processa `agent.ping` e `parental.app_filter.set` e, com `--collect-report-file` e `--state-dir`, coleta aplicativos Linux e envia relatórios autenticados para `PUT /agent/reports`. No Lux, `poll` roda como serviço systemd instalado por `install.sh` ([Instalar como serviço](#instalar-como-serviço)). A janela GTK de pareamento **Piplup** fica no pacote separado `lux_agent_gui` ([Parear](#parear-com-um-responsável)).

O [protocolo v1](../docs/agent-protocol.md) implementa reserva única e resultado idempotente com diário privado. O executor responde `agent.ping` e aplica o filtro de aplicativos (`parental.app_filter.set`) na conta gerenciada local, com releitura ([execução no Agent](../docs/agent-protocol.md#execução-no-agent)).

Leitura e escrita usam PyGObject/libmalcontent e AccountsService. A escrita pelo usuário de sistema `lux-agent`, sem root, depende da regra polkit em `polkit/` ([decisões e limites](../docs/lux-integration.md#provas-que-sustentam-as-decisões)); o que já foi validado no Lux está em [Validação](../docs/validation.md). O [client simulado](../docs/simulated-client.md) é um programa separado para demonstração; seu contrato não implementa comandos ou políticas Linux neste Agent.

## Organização e execução

```text
lux-agent/
├── pyproject.toml
├── .gitignore
├── deploy-files.txt
├── README.md
├── install.sh                instalação do serviço (sudo)
├── uninstall.sh              remoção do serviço (sudo)
├── lux-agent.service         unit systemd
├── agent.env.example         formato de /etc/lux-agent/agent.env
├── check_backend.py          compatibilidade de execução
├── poll_associations.py      compatibilidade de execução
├── read_policies.py          compatibilidade de execução
├── prove_app_filter.py       atalho para prove-app-filter
├── scripts/
│   ├── lux-agent             comando instalado em /usr/local/bin
│   ├── lux-agent-pair-helper auxiliar de pareamento executado via pkexec
│   └── piplup                abre a janela de pareamento (atalho Piplup)
├── desktop/
│   ├── org.piplup.Pairing.desktop
│   └── org.piplup.Pairing.svg
├── polkit/
│   ├── 50-lux-agent.rules
│   └── org.piplup.luxagent.pair.policy
├── lux_agent/
│   ├── __init__.py
│   ├── __main__.py
│   ├── cli.py
│   ├── config.py
│   ├── errors.py
│   ├── backend.py
│   ├── collector.py
│   ├── polling.py
│   ├── reports.py
│   ├── commands.py
│   ├── journal.py
│   ├── pairing.py
│   └── parental.py
├── lux_agent_gui/            janela GTK4/libadwaita, sem importar lux_agent
│   ├── __init__.py
│   ├── __main__.py
│   ├── session.py            eventos do auxiliar → estados, QR em pixels (sem GTK)
│   └── window.py
└── tests/
    ├── __init__.py
    ├── test_check_backend.py
    ├── test_poll_associations.py
    ├── test_collector.py
    ├── test_commands.py
    ├── test_https_transport.py
    ├── test_read_policies.py
    ├── test_pairing.py
    ├── test_parental_write.py
    ├── test_reports.py
    ├── test_gui_session.py
    └── test_cli.py
```

| Módulo | Responsabilidade |
| --- | --- |
| `cli` / `__main__` | argparse, subcomandos, montagem do executor e tratamento de saída/sinais do ciclo. |
| `config` | Validação de URL, leitura segura da credencial e limites de configuração. Não lê `.env` automaticamente. |
| `errors` | `DiagnosticError` compartilhado, sem dependência da CLI ou do transporte. |
| `backend` | HTTP/HTTPS/JSON, Bearer, CA, redirects, validação de associações e prazo total de requisições. |
| `polling` | Cadência, backoff/jitter, Retry-After e consultas sequenciais. |
| `commands` | Contrato, claim, despacho por tipo (`agent.ping`, `parental.app_filter.set`; demais → `UNSUPPORTED_OPERATION`) e reenvio de resultados. |
| `journal` | SQLite privado, exclusão e persistência; formato e vínculo com origem/credencial preservados. |
| `pairing` | Auxiliar privilegiado (credencial, autorregistro, sessão, espera do vínculo e reinício do serviço) e `pair`, que executa o auxiliar via `pkexec` e desenha o QR. Ver [Parear](#parear-com-um-responsável). |
| `parental` | Leitura e escrita malcontent, conversão `desktop:<id>` → executável e recusa de conta administrativa; `apply_app_filter` executa o `set` e traduz falhas em códigos do protocolo. Carrega GI somente ao acessar políticas; não conhece o transporte. |

O diagnóstico de backend não mantém ciclo; `poll` executa em primeiro plano e é supervisionado pelo systemd no Lux; `read-policies` é diagnóstico local independente. A janela GTK (`lux_agent_gui`) é processo separado e só conversa com o auxiliar. Não há dependência de execução além do Python e dos bindings GI do sistema. `errors.py` evita que configuração/diário dependam do módulo HTTP; o prazo total foi centralizado porque polling e comandos duplicavam o mesmo tratamento.

A partir da raiz do repositório:

```bash
cd lux-agent
python3 -B -m lux_agent --help
python3 -B -m lux_agent pair --help
python3 -B -m lux_agent check-backend --help
python3 -B -m lux_agent poll --help
python3 -B -m lux_agent read-policies --help
python3 -B -m lux_agent prove-app-filter --help
```

O pacote pode ser executado dos fontes, sem pip. O `pyproject.toml` declara somente metadados, empacotamento por setuptools e a entrada opcional `lux-agent`; para instalar, use um ambiente virtual próprio (`python3 -m pip install .`). Essa instalação não inclui os testes ou wrappers. Para a leitura malcontent, o Python selecionado precisa enxergar os bindings GI do sistema Lux; o procedimento SSH usa diretamente esse Python e dispensa instalação.

| Execução anterior, na raiz do repositório | Equivalente dentro de `lux-agent/` |
| --- | --- |
| `python3 lux-agent/check_backend.py ARGS` | `python3 -m lux_agent check-backend ARGS` |
| `python3 lux-agent/poll_associations.py ARGS` | `python3 -m lux_agent poll ARGS` |
| `python3 lux-agent/read_policies.py ARGS` | `python3 -m lux_agent read-policies ARGS` |

Os exemplos com `PYTHONPATH=lux-agent` abaixo partem da raiz do repositório; os comandos SSH entram no diretório de deploy.

### Coleta de aplicativos Linux

O Agent coleta entradas `.desktop` visíveis em `$XDG_DATA_HOME/applications` e nos diretórios `applications` de `$XDG_DATA_DIRS`. Entradas `Hidden=true`, `NoDisplay=true` e tipos diferentes de `Application` são ignoradas. O relatório usa o nome do arquivo `.desktop` como `sourceId`, gera um novo `reportId`, não inventa pedidos de instalação e é gravado com modo `0600`. Os aplicativos são ordenados por `sourceId`. Com mais de 200 aplicativos ou mais de 16 KiB, só o maior prefixo que cabe nos dois limites é enviado, com aviso no stderr (detalhes em [protocolo](../docs/agent-protocol.md#relatório-enviado)). Cada aplicativo informa também `blockable` e `executable` (executável resolvido do `Exec`, como na execução do `set`), que o backend usa para não pedir apps impossíveis de bloquear e para tratar apps do mesmo executável como grupo. Com uma média de ~140 bytes por aplicativo, cabem cerca de 115 no limite de 16 KiB, antes do limite de 200; o Lux de referência tem 59 visíveis.

Para coletar e enviar um relatório no primeiro ciclo do polling:

```bash
python3 -B -m lux_agent poll --backend-url https://api.exemplo \
    --credential-file /caminho/privado/credential \
    --state-dir /caminho/privado/state \
    --collect-report-file /caminho/privado/report.json
```

`--collect-report-file` e `--report-file` são alternativas. A coleta atualiza o arquivo uma vez no início do processo; o diário conserva o mesmo `reportId` e reenvia o payload após timeout, reinício ou resposta perdida. Uma rejeição definitiva (`400`, `409`, `413` ou `422`) marca o relatório como `rejected` no diário, que não é reenviado, e o polling continua. O backend só aceita relatório de computador com vínculo ativo; enquanto a consulta de vínculos do ciclo não trouxer um com `revokedAt: null`, o Agent não envia e registra `Relatórios: aguardando vínculo ativo com um responsável.`. Assim, um computador instalado antes do pareamento não confunde o `401` de "sem vínculo" com credencial revogada. O Agent não coleta pedidos de instalação (fora do escopo).

Os três scripts antigos permanecem como wrappers para a mesma CLI; argumentos, mensagens operacionais e códigos de saída são preservados. O texto de uso do argparse passa a identificar os subcomandos. Imports internos devem usar `lux_agent.*`; `command_processor.py` e `command_journal.py` foram movidos para `commands.py` e `journal.py`, sem wrappers de biblioteca.

Configuração continua explícita nos argumentos. Credencial/CA ficam fora dos fontes; por exemplo, `~/.config/lux-agent/credential` e `~/.config/lux-agent/ca.pem`, em diretório privado. O diário deve ficar em armazenamento persistente, por exemplo `~/.local/state/lux-agent/commands`, com pai existente e confiável. Não use `~/lux-agent-poc/`, caches de build ou diretórios temporários de deploy para estado. A refatoração não move, apaga ou migra diários existentes; continue apontando `--state-dir` para o mesmo diretório, com a mesma origem e credencial.

## Prova de escrita do filtro de aplicativos

`prove-app-filter` grava um filtro de bloqueio na conta gerenciada, relê e compara, e **sempre** restaura o filtro anterior, inclusive em erro ou Ctrl+C. Bloqueia os aplicativos de `--block desktop:<id>.desktop` (repetível) e proíbe instalação de usuário e de sistema. `--hold N` (até 600 s) mantém o bloqueio ativo por N segundos antes de restaurar, para observação na sessão gráfica.

Recusa conta administrativa (root ou grupos `sudo`, `admin`, `wheel`) antes de carregar GI. Códigos de saída: `0` gravado, relido igual e restaurado; `1` releitura diferente, restauração não confirmada ou falha; `2` argumento ou aplicativo inválido; `3` conta administrativa; `4` permissão negada pelo polkit.

Com o Agent instalado ([Instalar como serviço](#instalar-como-serviço)), que cria o usuário `lux-agent` e a regra polkit:

```bash
cd /opt/lux-agent && sudo -u lux-agent python3 -B -m lux_agent prove-app-filter --user CONTA_GERENCIADA --block desktop:firefox-esr.desktop
```

## Instalar como serviço

`install.sh` e `uninstall.sh` rodam no Lux com sudo, a partir da cópia sincronizada pela allowlist (`~/lux-agent-poc`). Não há `.deb`.

```bash
sudo ~/lux-agent-poc/install.sh --backend-url https://api.exemplo --managed-user CONTA_INFANTIL [--ca-file /caminho/ca.pem]
lux-agent pair
sudo ~/lux-agent-poc/uninstall.sh [--reset-policies] [--yes]
```

| Caminho | Dono e modo | Conteúdo |
| --- | --- | --- |
| `/opt/lux-agent/lux_agent/` | root, `0755`/`0644` | Pacote Python; o serviço não pode alterá-lo |
| `/opt/lux-agent/lux-agent-pair-helper` | root, `0755` | Auxiliar de pareamento (via `pkexec`) |
| `/usr/local/bin/lux-agent` | root, `0755` | Comando `lux-agent` (ex.: `lux-agent pair`) |
| `/opt/lux-agent/lux_agent_gui/`, `/usr/local/bin/piplup` | root | Janela de pareamento e seu lançador |
| `/usr/share/applications/org.piplup.Pairing.desktop`, `/usr/share/icons/hicolor/scalable/apps/org.piplup.Pairing.svg` | root, `0644` | Atalho e ícone Piplup no menu |
| `/etc/lux-agent/` | `root:lux-agent`, `0750` | Configuração |
| `/etc/lux-agent/agent.env` | root, `0600` | `LUX_AGENT_BACKEND_URL`, `LUX_AGENT_MANAGED_USER`, `LUX_AGENT_POLL_OPTIONS` (ver `agent.env.example`) |
| `/etc/lux-agent/credential` | `lux-agent`, `0600` | Credencial gerada pelo pareamento |
| `/etc/lux-agent/ca.pem` | root, `0644` | CA explícita opcional (desenvolvimento) |
| `/var/lib/lux-agent/` | `lux-agent`, `0700` | Diário (`state/`) e último relatório coletado |
| `/etc/systemd/system/lux-agent.service` | root, `0644` | Unit de `lux-agent.service` |
| `/etc/polkit-1/rules.d/50-lux-agent.rules` | root, `0644` | Regra polkit do LUX-1 |
| `/usr/share/polkit-1/actions/org.piplup.luxagent.pair.policy` | root, `0644` | Ação polkit do pareamento (`auth_admin`) |

- **Usuário:** `lux-agent`, de sistema, sem shell nem home. O serviço não roda como root.
- **Conta gerenciada:** `--managed-user` ou pergunta interativa. É decisão local; o backend nunca a escolhe. A unit a repassa ao `poll` por `--managed-user`. Recusa conta inexistente, root, UID fora de 1000–59999 e membros dos grupos `sudo`, `admin` ou `wheel`.
- **Credencial:** gerada por `lux-agent pair`; o `install.sh` não a recebe e reexecuções a mantêm. Sem credencial, a unit fica habilitada mas não inicia (`ConditionPathExists`) até o pareamento.
- **Dependências:** `python3-qrcode`, `pkexec`, `python3-gi`, `gir1.2-gtk-4.0` e `gir1.2-adw-1`, instalados com `apt-get` quando faltam (o papel do `Depends` de um futuro pacote).
- **Reexecução:** idempotente. Atualiza código, unit e regra, reaproveita URL, opções e conta já gravadas e reinicia o serviço.
- **Reinício:** `Restart=on-failure`, exceto códigos 2 (configuração), 3 (credencial revogada) e 6 (incompatibilidade), que param o serviço sem loop (`RestartPreventExitStatus`). Falhas de rede e TLS continuam reiniciando ou repetindo com backoff.
- **Isolamento:** a unit usa `NoNewPrivileges`, `ProtectSystem=strict`, `ProtectHome`, `PrivateTmp`, `PrivateDevices`, `ProtectKernel*`, `RestrictNamespaces`, `RestrictAddressFamilies`, `CapabilityBoundingSet=` vazio e `SystemCallFilter=@system-service`. As diretivas após `PrivateTmp` ainda precisam ser validadas no Lux (LUX-10).
- **Logs:** journald (`journalctl -u lux-agent`), sem credencial, Bearer ou corpo HTTP.
- **Desinstalação:** remove tudo da tabela, inclusive a credencial, e o usuário. As políticas da criança são mantidas; `--reset-policies` limpa o filtro de aplicativos via `malcontent-client set-app-filter`. A identidade continua válida no backend até ser revogada.
- **Coleta:** o serviço não lê `$HOME` (`ProtectHome=yes`); o relatório lista aplicativos de `/usr/local/share` e `/usr/share`.

## Parear com um responsável

Um administrador abre **Piplup** no menu de aplicativos (ou roda `piplup` no terminal da sessão gráfica) e clica em **Parear**, ou roda `lux-agent pair` no terminal; digita a senha de administrador e vê um QR com a expiração (5 min). A janela mostra contagem regressiva e os estados descritos em [interface gráfica](../docs/lux-integration.md#interface-gráfica-local-de-pareamento); fechá-la cancela o pareamento. O responsável lê o QR em **Adicionar computador** no app e confirma; o comando informa o vínculo e o serviço reinicia sozinho. Usuário sem senha de administrador é negado.

| Saída | Situação |
| --- | --- |
| 0 | Pareado, ou já pareado com um responsável |
| 1 | QR expirou sem confirmação, ou o serviço não reiniciou |
| 2 | Configuração, dependência ou arquivo de credencial inseguro (reinstale) |
| 4 | Autorização de administrador negada, ou conexão/TLS |
| 5 | Backend indisponível ou limite de registros (429) |
| 6 | Resposta incompatível |

Na primeira vez, ou quando o backend recusa a credencial (`401`, revogada ou nunca confirmada), o auxiliar gera outra e faz o autorregistro; com credencial válida, só abre uma nova sessão. O fluxo, as garantias e os limites estão em [Pareamento pelo Agent](../docs/lux-integration.md#pareamento-pelo-agent). Revogado o vínculo, o serviço para com código 3 e um novo `lux-agent pair` gera outra identidade.

## Diagnóstico autenticado

`lux_agent.backend` usa somente a biblioteca padrão Python e o contrato existente `GET /agent/associations`. A credencial Bearer identifica o computador no backend por SHA-256; não é necessário enviar `deviceId`, hostname ou JWT de responsável. A consulta aceita histórico vazio e não cria vínculo, presença ou sessão de pareamento. Nenhum endpoint novo foi necessário.

Para desenvolvimento, fora do serviço instalado, provisione pela [ferramenta administrativa existente](../docs/backend.md#provisionamento-e-invalidação-administrativa), usando `--demo` para fixtures com `NODE_ENV=development`. O arquivo contém somente a credencial aleatória, nunca seu hash. Transfira-o separadamente por SSH/SFTP, sem incluí-lo no rsync dos fontes. Mantenha-o fora do repositório e em diretório privado `0700`, pertencente à conta executora; o arquivo deve pertencer à mesma conta e ter modo `0400` ou `0600`. Não use symlink ou hardlink. O comando verifica essas propriedades do arquivo antes de enviá-lo; não corrige permissões nem instala credenciais automaticamente. Administradores/root continuam capazes de acessar o segredo. No serviço instalado, a credencial fica em `/etc/lux-agent/credential`, do usuário `lux-agent`, modo `0600`.

```bash
PYTHONPATH=lux-agent python3 -B -m lux_agent check-backend --backend-url https://api.exemplo --credential-file /caminho/privado/agent-credential
PYTHONPATH=lux-agent python3 -B -m lux_agent check-backend --backend-url http://127.0.0.1:3000 --credential-file /caminho/privado/agent-credential --allow-local-http
```

Para HTTPS real no WSL2 e no Lux, siga o [procedimento temporário com CA explícita](../docs/lux-https-development.md). Os dois comandos de rede aceitam `--ca-file /caminho/ca.pem`, sem instalar confiança global ou desativar a validação TLS.

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
ssh -o BatchMode=yes -o ExitOnForwardFailure=yes -R 127.0.0.1:13000:127.0.0.1:3000 lux 'cd ~/lux-agent-poc && python3 -B -m lux_agent check-backend --backend-url http://127.0.0.1:13000 --credential-file ~/.local/state/lux-agent/credential --allow-local-http'
```

O Agent inicia a requisição no Lux; o backend não acessa a VM. O túnel existe somente durante o comando. Essa prova usa HTTP em loopback dentro de SSH, não valida uma implantação HTTPS real.

Referências de implementação: [urllib.request no Python 3.12](https://docs.python.org/3.12/library/urllib.request.html) e [os no Python 3.14](https://docs.python.org/3.14/library/os.html#os.open).

## Polling somente de leitura

`lux_agent.polling` reutiliza as validações de `config` e `fetch_associations()` em `backend`. O diagnóstico antigo mantém seus argumentos, códigos de saída e retorno por contagem; o cliente compartilhado preserva registros apenas em memória e acrescenta categoria de erro, possibilidade de repetição, status HTTP e `Retry-After`.

```bash
PYTHONPATH=lux-agent python3 -B -m lux_agent poll --backend-url https://api.exemplo --credential-file /caminho/privado/agent-credential --max-queries 3
```

| Opção | Comportamento |
| --- | --- |
| `--interval` | Base entre consultas, contada após o término da anterior; padrão 15 s |
| `--max-backoff` | Teto do atraso com jitter; padrão 300 s; deve ser pelo menos o intervalo |
| `--jitter` | Variação proporcional; padrão 0.2 (±20%); aceita 0 para diagnóstico reproduzível |
| `--timeout` | Prazo total por consulta, padrão 10 s, máximo 120 s |
| `--max-queries` | Limite de tentativas, incluindo falhas; não espera após a última; omitido mantém o ciclo |

Intervalo e backoff devem ser positivos e no máximo 86400 s; jitter deve estar entre 0 e menos de 1. A primeira consulta é imediata. Só há uma requisição por vez; sem `--state-dir`, não há processamento de comandos. Falhas transitórias dobram a base de espera até o teto; sucesso restaura a base ao intervalo. O jitter é aplicado antes do teto. Em HTTP 429/503, um `Retry-After` válido em segundos ou data HTTP é um piso da espera, inclusive acima do teto; um cabeçalho inválido usa o backoff normal. Datas HTTP dependem do relógio local correto. O limite de tentativas não é um limite de duração: `Retry-After` pode impor uma espera longa, interrompível por sinal.

Categorias de erro: `configuration`, `authentication`, `tls`, `connection`, `http` e `response`. Falhas de conexão/timeout e HTTP 429/5xx permitem repetição, exceto 501/505 por incompatibilidade. HTTP 401 encerra com código 3; TLS encerra com 4; demais erros HTTP permanentes e contrato inválido encerram com o código do diagnóstico. Não há fallback para HTTP, desativação de certificado ou redirecionamento. A exceção HTTP continua restrita ao loopback com `--allow-local-http` explícito.

Ctrl+C/SIGTERM encerram com código 0 e mensagem de interrupção, sem traceback. O limite de consultas retorna o código da última tentativa: 0 se bem-sucedida, 4/5 se terminou sem recuperar uma falha transitória. Interromper manualmente não comprova sucesso da comunicação. A saída contém só número da consulta, contagem do histórico e erros controlados; não imprime nomes, identificadores dos vínculos, credencial, corpo HTTP ou exceções brutas. Nenhuma associação é criada/revogada e `status`/`lastSeen` do mobile não mudam.

O ciclo é uma CLI Linux executada na thread principal. Usa SIGALRM/`setitimer` para limitar o tempo da consulta inteira (além do timeout de socket) e restaura os handlers ao terminar. SIGINT/SIGTERM também interrompem esperas e I/O Python em andamento. Não usa threads de consulta nem deixa chamadas sobrepostas; funções nativas que não retornem ao interpretador podem atrasar a entrega de sinais. A proteção e o limite de resposta de 1 MiB do cliente existente são preservados.

No Lux, com a credencial já instalada separadamente, use o mesmo túnel temporário:

```bash
ssh -o BatchMode=yes -o ExitOnForwardFailure=yes -R 127.0.0.1:13000:127.0.0.1:3000 lux 'cd ~/lux-agent-poc && python3 -B -m lux_agent poll --backend-url http://127.0.0.1:13000 --credential-file ~/.local/state/lux-agent/credential --allow-local-http --interval 1 --jitter 0 --max-queries 3'
```

Referências: [sinais Python 3.14](https://docs.python.org/3.14/library/signal.html), [erros urllib no Python 3.12](https://docs.python.org/3.12/library/urllib.error.html) e [Retry-After na RFC 9110](https://www.rfc-editor.org/rfc/rfc9110.html#section-10.2.3).

## Processar `agent.ping`

Adicione `--state-dir /caminho/privado/state` ao polling para habilitar o executor. O diretório deve ser exclusivo, `0700`, pertencente à conta executora e localizado sob pais confiáveis. Se ainda não existir, o Agent cria somente esse diretório; o pai deve existir. Em uso contínuo, preserve-o em armazenamento persistente e mantenha a mesma origem/credencial. Sem essa opção, o comportamento continua somente leitura de vínculos.

```bash
PYTHONPATH=lux-agent python3 -B -m lux_agent poll --backend-url https://localhost:3443 --credential-file /caminho/privado/credential --ca-file /caminho/privado/ca.pem --state-dir /caminho/privado/state --max-queries 3
```

`lux_agent.commands` valida o contrato, reserva antes de executar e devolve `{ "reachable": true }` ou, para `parental.app_filter.set` com `--managed-user CONTA`, o filtro relido. Operação desconhecida é reservada e respondida com `UNSUPPORTED_OPERATION`, sem encerrar o polling. `lux_agent.journal` usa SQLite padrão com commits duráveis, arquivos privados `0600` e exclusão por `flock`. Guarda claim antes do POST, `started` antes da execução e resultado antes do PUT. Resultado salvo é reenviado sem reexecução; `started` sem resultado permanece incerto. Não há promessa de execução exatamente uma vez. Não apague o diário para contornar um conflito.

A CLI mantém backoff, TLS, timeout por requisição e sinais. Comandos usam limite de 16 KiB por resposta. Sem rede/503, preserva pendências para o ciclo seguinte; 401/TLS/409 encerram. 404/410 de claim/resultado abandonam a autorização local. Não recebe shell nem conta pelo comando, e não altera presença no mobile.

Os testes cobrem respostas de claim/resultado perdidas, reinício, erros de diário e comandos desconhecidos.

## Desenvolver e testar no WSL2

O fonte permanece versionado neste repositório. Os testes usam `unittest` da biblioteca padrão, sem GI, D-Bus ou dependências pip. A suíte HTTPS também exige o executável OpenSSL 3 para gerar certificados temporários:

```bash
cd lux-agent
python3 -B -m unittest discover -s tests -v
python3 -B -m compileall -q lux_agent tests
python3 -B -m lux_agent read-policies --help
python3 -B -m lux_agent prove-app-filter --help
```

A suíte em `tests/` inclui CLI/imports, wrappers, lista restrita de deploy e sintaxe dos scripts de instalação. O comando antigo `python3 -m unittest discover -s lux-agent -v`, na raiz do repositório, continua descobrindo a suíte. O diretório ainda não tem ferramentas Python de lint/typecheck configuradas. Compilação verifica sintaxe; os testes de comunicação usam um servidor HTTP local temporário e verificam Bearer, respostas, redirecionamento, falhas e proteção da credencial. Os testes da PoC verificam usuário obrigatório/inexistente, dependência ausente, flags sem interação, valores nativos, políticas desativadas e falha sem saída parcial. Esses testes isolados não comprovam permissões nem aplicação de restrições no Lux. A janela GTK não roda no WSL sem `gir1.2-gtk-4.0`/`gir1.2-adw-1`; seus testes cobrem só `session.py`.

## Sincronizar e executar no Lux

Execute na raiz do repositório no WSL2. Use o alias SSH já configurado, sem copiar chaves ou credenciais. Primeiro verifique conectividade e ambiente, sem `sudo`:

```bash
ssh -o BatchMode=yes -o ConnectTimeout=10 lux 'id; cat /etc/os-release; gnome-shell --version; python3 --version; command -v rsync; systemctl is-active accounts-daemon'
ssh lux 'dpkg-query -W malcontent gir1.2-malcontent-0 python3-gi; python3 -c '\''import gi; gi.require_version("Malcontent", "0"); from gi.repository import Malcontent; print(Malcontent.Manager.get_app_filter.__doc__); print(Malcontent.Manager.get_session_limits.__doc__)'\'''
```

Se faltar dependência ou houver divergência, investigue antes de prosseguir. Instalação de pacotes ou alteração da configuração do Lux exige confirmação; não faz parte deste procedimento.

Revise a simulação e depois execute a cópia. A lista `deploy-files.txt` contém cada arquivo permitido, incluindo pacote, testes e wrappers; não usa diretórios ou curingas para incluir conteúdo.

```bash
rsync -rltivn --files-from=lux-agent/deploy-files.txt -e 'ssh -o BatchMode=yes -o ConnectTimeout=10' lux-agent/ lux:lux-agent-poc/
rsync -rltiv --files-from=lux-agent/deploy-files.txt -e 'ssh -o BatchMode=yes -o ConnectTimeout=10' lux-agent/ lux:lux-agent-poc/
ssh -o BatchMode=yes lux 'cd ~/lux-agent-poc && python3 -B -m unittest discover -s tests -v'
ssh -o BatchMode=yes lux 'cd ~/lux-agent-poc && python3 -B -m lux_agent read-policies --user USUARIO_ALVO'
```

O destino é uma cópia executável em `~/lux-agent-poc/`, sem Git e sem edição de fonte na VM. A allowlist inclui somente fontes/metadados: `.env`, chaves, certificados, credenciais, caches e SQLite/diários não são sincronizados. Não use `--delete`, não sincronize a raiz do repositório e não copie estado junto aos fontes. Transfira credencial e CA pública separadamente pelo canal seguro e use caminhos externos ao deploy. Substitua `USUARIO_ALVO` explicitamente; não há seleção automática de conta.

Use o Python do sistema Lux com seus bindings GI e comece sem `sudo`: a PoC usa `ManagerGetValueFlags.NONE`, sem autorização interativa ou elevação automática. Permissão negada, serviço indisponível ou dados inválidos retornam erro em stderr e código 1, sem JSON parcial. Argumentos inválidos retornam 2; uma consulta completa retorna 0 e JSON em stdout.

Na VM de referência, consultar a própria conta funcionou sem sudo, mas consultar outra conta pela sessão SSH administrativa foi negado à PoC e à CLI. As regras locais exigem autenticação administrativa para `ReadAny`; pertencer ao grupo sudo não basta. A negativa é falha de autorização, não prova de que a conta está sem restrições. Para comparar sem solicitar interação, use `malcontent-client get-app-filter --no-interactive USUARIO_ALVO` e `malcontent-client get-session-limits --no-interactive USUARIO_ALVO` no Lux. Consultas privilegiadas exigem autenticação local (`sudo` interativo). Não altere regras polkit para contornar essa limitação.

O JSON inclui nome/UID, `enabled` e `policy` para cada consulta. `policy` preserva `serialize().unpack()` da biblioteca; tuplas viram arrays JSON. É saída diagnóstica da PoC, sem contrato de backend. `enabled` descreve a configuração, não comprova bloqueio efetivo. As duas leituras são sequenciais, sem snapshot transacional. `DailySchedule`, quando presente, mantém segundos desde meia-noite; não convertemos para horário local. A interpretação de UTC exige validação antes de escrever horários (LUX-11).

Referências usadas: cliente oficial instalado em `/usr/bin/malcontent-client`, contrato local `/usr/share/dbus-1/interfaces/com.endlessm.ParentalControls.SessionLimits.xml` e [fonte de SessionLimits 0.13.1-5](https://sources.debian.org/src/malcontent/0.13.1-5/libmalcontent/session-limits.c/).
