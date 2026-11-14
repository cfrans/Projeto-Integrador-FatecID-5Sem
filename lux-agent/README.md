# Lux Agent

Pacote Python `lux_agent` com quatro subcomandos: `read-policies` lê políticas nativas; `prove-app-filter` prova a escrita do filtro de aplicativos com releitura e restauração; `check-backend` valida uma vez a identidade provisionada; `poll` consulta vínculos, processa `agent.ping` e, com `--collect-report-file` e `--state-dir`, coleta aplicativos Linux e envia relatórios autenticados para `PUT /agent/reports`. No Lux, `poll` roda como serviço systemd instalado por `install.sh` ([Instalar como serviço](#instalar-como-serviço)). Não há comandos parentais vindos do backend, pareamento local ou GTK.

O [protocolo v1](../docs/agent-protocol.md) implementa reserva única e resultado idempotente de ping com diário privado. A [validação ponta a ponta](../docs/agent-ping-validation.md) usou NestJS/MySQL e Lux reais por HTTPS. Operações parentais continuam fora do executor.

A PoC de leitura usa PyGObject/libmalcontent e AccountsService, sem alterar políticas ou solicitar elevação. A VM de referência é Lux 3/Canopus, GNOME 50.4 e malcontent 0.13.1-5. Leituras com e sem restrições foram validadas; consultar outra conta exigiu autenticação administrativa. A escrita do filtro de aplicativos pelo usuário de sistema `lux-agent`, sem root, foi provada com a regra polkit em `polkit/` ([evidência](../docs/lux-integration.md#escrita-do-filtro-de-aplicativos-via-polkit--2026-11-13)). O [client simulado](../docs/simulated-client.md) é um programa separado para demonstração; seu contrato não implementa comandos ou políticas Linux neste Agent.

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
├── polkit/
│   └── 50-lux-agent.rules
├── lux_agent/
│   ├── __init__.py
│   ├── __main__.py
│   ├── cli.py
│   ├── config.py
│   ├── errors.py
│   ├── backend.py
│   ├── polling.py
│   ├── reports.py
│   ├── commands.py
│   ├── journal.py
│   └── parental.py
└── tests/
    ├── __init__.py
    ├── test_check_backend.py
    ├── test_poll_associations.py
    ├── test_commands.py
    ├── test_https_transport.py
    ├── test_read_policies.py
    ├── test_parental_write.py
    ├── test_reports.py
    └── test_cli.py
```

| Módulo | Responsabilidade |
| --- | --- |
| `cli` / `__main__` | argparse, subcomandos, montagem do executor e tratamento de saída/sinais do ciclo. |
| `config` | Validação de URL, leitura segura da credencial e limites de configuração. Não lê `.env` automaticamente. |
| `errors` | `DiagnosticError` compartilhado, sem dependência da CLI ou do transporte. |
| `backend` | HTTP/HTTPS/JSON, Bearer, CA, redirects, validação de associações e prazo total de requisições. |
| `polling` | Cadência, backoff/jitter, Retry-After e consultas sequenciais. |
| `commands` | Contrato e processamento exclusivo de ping, claim e reenvio de resultados. |
| `journal` | SQLite privado, exclusão e persistência; formato e vínculo com origem/credencial preservados. |
| `parental` | Leitura e escrita malcontent, conversão `desktop:<id>` → executável e recusa de conta administrativa; carrega GI somente ao acessar políticas. Independente de polling/comandos. |

O diagnóstico de backend não mantém ciclo; `poll` executa em primeiro plano e é supervisionado pelo systemd no Lux; `read-policies` é diagnóstico local independente. A futura GTK continua separada. Não há dependência de execução além do Python e dos bindings GI do sistema. `errors.py` evita que configuração/diário dependam do módulo HTTP; o prazo total foi centralizado porque polling e comandos duplicavam o mesmo tratamento.

A partir da raiz do repositório:

```bash
cd lux-agent
python3 -B -m lux_agent --help
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

O Agent coleta entradas `.desktop` visíveis em `$XDG_DATA_HOME/applications` e nos diretórios `applications` de `$XDG_DATA_DIRS`. Entradas `Hidden=true`, `NoDisplay=true` e tipos diferentes de `Application` são ignoradas. O relatório usa o nome do arquivo `.desktop` como `sourceId`, gera um novo `reportId`, não inventa pedidos de instalação e é gravado com modo `0600`. Os aplicativos são ordenados por `sourceId`. Com mais de 200 aplicativos ou mais de 16 KiB, só o maior prefixo que cabe nos dois limites é enviado, com aviso no stderr (detalhes em [protocolo](../docs/agent-protocol.md#relatório-enviado)). Com uma média de ~85 bytes por aplicativo, o limite de 16 KiB costuma chegar antes do limite de 200.

Para coletar e enviar um relatório no primeiro ciclo do polling:

```bash
python3 -B -m lux_agent poll --backend-url https://api.exemplo \
    --credential-file /caminho/privado/credential \
    --state-dir /caminho/privado/state \
    --collect-report-file /caminho/privado/report.json
```

`--collect-report-file` e `--report-file` são alternativas. A coleta atualiza o arquivo uma vez no início do processo; o diário conserva o mesmo `reportId` e reenvia o payload após timeout, reinício ou resposta perdida. Uma rejeição definitiva (`400`, `409`, `413` ou `422`) marca o relatório como `rejected` no diário, que não é reenviado, e o polling continua. O backend só aceita relatório de computador com vínculo ativo; enquanto a consulta de vínculos do ciclo não trouxer um com `revokedAt: null`, o Agent não envia e registra `Relatórios: aguardando vínculo ativo com um responsável.`. Assim, um computador instalado antes do pareamento não confunde o `401` de "sem vínculo" com credencial revogada. A coleta de pedidos de instalação e a leitura de políticas parentais ainda dependem de fontes Linux que não foram validadas.

Os três scripts antigos permanecem como wrappers para a mesma CLI; argumentos, mensagens operacionais e códigos de saída são preservados. O texto de uso do argparse passa a identificar os subcomandos. Imports internos devem usar `lux_agent.*`; `command_processor.py` e `command_journal.py` foram movidos para `commands.py` e `journal.py`, sem wrappers de biblioteca. Registros históricos abaixo mantêm os nomes usados nas provas anteriores.

Configuração continua explícita nos argumentos. Credencial/CA ficam fora dos fontes; por exemplo, `~/.config/lux-agent/credential` e `~/.config/lux-agent/ca.pem`, em diretório privado. O diário deve ficar em armazenamento persistente, por exemplo `~/.local/state/lux-agent/commands`, com pai existente e confiável. Não use `~/lux-agent-poc/`, caches de build ou diretórios temporários de deploy para estado. A refatoração não move, apaga ou migra diários existentes; continue apontando `--state-dir` para o mesmo diretório, com a mesma origem e credencial.

## Prova de escrita do filtro de aplicativos

`prove-app-filter` grava um filtro de bloqueio na conta gerenciada, relê e compara, e **sempre** restaura o filtro anterior, inclusive em erro ou Ctrl+C. Bloqueia os aplicativos de `--block desktop:<id>.desktop` (repetível) e proíbe instalação de usuário e de sistema. `--hold N` (até 600 s) mantém o bloqueio ativo por N segundos antes de restaurar, para observação na sessão gráfica.

Recusa conta administrativa (root ou grupo `sudo`) antes de carregar GI. Códigos de saída: `0` gravado, relido igual e restaurado; `1` releitura diferente, restauração não confirmada ou falha; `2` argumento ou aplicativo inválido; `3` conta administrativa; `4` permissão negada pelo polkit.

Com o Agent instalado ([Instalar como serviço](#instalar-como-serviço)), que cria o usuário `lux-agent` e a regra polkit:

```bash
cd /opt/lux-agent && sudo -u lux-agent python3 -B -m lux_agent prove-app-filter --user CONTA_GERENCIADA --block desktop:firefox-esr.desktop
```

A prova do LUX-1 usou uma cópia manual em `/opt/lux-agent-poc`, removida no LUX-3.

## Instalar como serviço

`install.sh` e `uninstall.sh` rodam no Lux com sudo, a partir da cópia sincronizada pela allowlist (`~/lux-agent-poc`). Não há `.deb`.

```bash
sudo ~/lux-agent-poc/install.sh --backend-url https://api.exemplo --managed-user CONTA_INFANTIL \
    --credential-file /caminho/credential [--ca-file /caminho/ca.pem]
sudo ~/lux-agent-poc/uninstall.sh [--reset-policies] [--yes]
```

| Caminho | Dono e modo | Conteúdo |
| --- | --- | --- |
| `/opt/lux-agent/lux_agent/` | root, `0755`/`0644` | Pacote Python; o serviço não pode alterá-lo |
| `/etc/lux-agent/` | `root:lux-agent`, `0750` | Configuração |
| `/etc/lux-agent/agent.env` | root, `0600` | `LUX_AGENT_BACKEND_URL`, `LUX_AGENT_MANAGED_USER`, `LUX_AGENT_POLL_OPTIONS` (ver `agent.env.example`) |
| `/etc/lux-agent/credential` | `lux-agent`, `0600` | Credencial provisionada |
| `/etc/lux-agent/ca.pem` | root, `0644` | CA explícita opcional (desenvolvimento) |
| `/var/lib/lux-agent/` | `lux-agent`, `0700` | Diário (`state/`) e último relatório coletado |
| `/etc/systemd/system/lux-agent.service` | root, `0644` | Unit de `lux-agent.service` |
| `/etc/polkit-1/rules.d/50-lux-agent.rules` | root, `0644` | Regra polkit do LUX-1 |

- **Usuário:** `lux-agent`, de sistema, sem shell nem home. O serviço não roda como root.
- **Conta gerenciada:** `--managed-user` ou pergunta interativa. É decisão local; o backend nunca a escolhe. Recusa conta inexistente, root, UID fora de 1000–59999 e membros do grupo `sudo`.
- **Credencial:** copiada só se ainda não existir; reexecuções nunca a sobrescrevem. Sem credencial, a unit fica habilitada mas não inicia (`ConditionPathExists`); rode de novo com `--credential-file`. Hoje ela vem da [ferramenta de provisionamento](../docs/backend.md#provisionamento-e-invalidação-administrativa).
- **Reexecução:** idempotente. Atualiza código, unit e regra, reaproveita URL, opções e conta já gravadas e reinicia o serviço.
- **Reinício:** `Restart=on-failure`, exceto códigos 2 (configuração), 3 (credencial revogada) e 6 (incompatibilidade), que param o serviço sem loop (`RestartPreventExitStatus`). Falhas de rede e TLS continuam reiniciando ou repetindo com backoff.
- **Logs:** journald (`journalctl -u lux-agent`), sem credencial, Bearer ou corpo HTTP.
- **Desinstalação:** remove tudo da tabela, inclusive a credencial, e o usuário. As políticas da criança são mantidas; `--reset-policies` limpa o filtro de aplicativos via `malcontent-client set-app-filter`. A identidade continua válida no backend até ser revogada.
- **Coleta:** o serviço não lê `$HOME` (`ProtectHome=yes`); o relatório lista aplicativos de `/usr/local/share` e `/usr/share`.

### Validação no Lux — 2026-11-14

Lux 3/Canopus, Python 3.14.6, backend NestJS/MySQL no WSL2 por HTTPS com CA explícita e proxy temporário ([guia](../docs/lux-https-development.md)), alcançado por túnel SSH em `https://localhost:13443`.

- `install.sh` recusou `gabriel` (grupo `sudo`) e instalou para `crianca-teste`; reexecução manteve a credencial e reiniciou o serviço.
- Sem vínculo, o primeiro report recebeu `401` e o serviço parou com código 3 sem reiniciar. Isso revelou o caso do computador ainda não pareado, corrigido com a espera por vínculo ativo descrita em [Coleta](#coleta-de-aplicativos-linux).
- Após parear por API: report aceito com 59 aplicativos (de 120 `.desktop`, os demais ocultos), sem corte por limite; Firefox incluído. `agent.ping` processado pelo serviço em ~4 s.
- `systemctl restart` e reboot da VM: serviço iniciou no boot, repetiu com backoff até o túnel voltar e não reprocessou o ping (mesmo `claimId`). Cada processo envia um relatório novo.
- Revogação pela ferramenta administrativa: `401`, código 3, `NRestarts=0`.
- Journal (131 linhas) sem a credencial, `Bearer` ou traceback.
- `uninstall.sh --yes` removeu unit, diretórios, usuário e grupo; filtro da criança igual antes e depois. `--reset-policies` não foi exercitado no Lux (filtro já estava vazio).
- 99 testes passaram no WSL2 e no Lux.

## Diagnóstico autenticado

`lux_agent.backend` usa somente a biblioteca padrão Python e o contrato existente `GET /agent/associations`. A credencial Bearer identifica o computador no backend por SHA-256; não é necessário enviar `deviceId`, hostname ou JWT de responsável. A consulta aceita histórico vazio e não cria vínculo, presença ou sessão de pareamento. Nenhum endpoint novo foi necessário.

Provisione pela [ferramenta administrativa existente](../docs/backend.md#provisionamento-e-invalidação-administrativa), usando `--demo` para fixtures com `NODE_ENV=development`. O arquivo contém somente a credencial aleatória, nunca seu hash. Transfira-o separadamente por SSH/SFTP, sem incluí-lo no rsync dos fontes. Mantenha-o fora do repositório e em diretório privado `0700`, pertencente à conta executora; o arquivo deve pertencer à mesma conta e ter modo `0400` ou `0600`. Não use symlink ou hardlink. O comando verifica essas propriedades do arquivo antes de enviá-lo; não corrige permissões nem instala credenciais automaticamente. Administradores/root continuam capazes de acessar o segredo. No serviço instalado, a credencial fica em `/etc/lux-agent/credential`, do usuário `lux-agent`, modo `0600`.

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

### Evidência desta iteração — 2026-10-24

- Identidade demonstrativa criada pela ferramenta existente; consulta real Agent → NestJS → MySQL retornou HTTP 200/histórico vazio no WSL2 e no Lux via túnel SSH.
- No Lux: credencial aleatória no formato correto recusada com HTTP 401/código 3; a credencial válida também foi recusada após revogação pela ferramenta administrativa. Conexão recusada em loopback retornou código 4.
- 14 testes Python passaram no WSL2 (3.12.3) e Lux (3.14.6), incluindo os sete testes originais da PoC. HTTP 503, timeout e respostas inválidas foram simulados; não se interrompeu o MySQL/backend para provocar indisponibilidade real.
- A PoC leu novamente a própria conta no Lux sem sudo, com filtros/limites desativados. A leitura restritiva anterior está preservada no [registro de integração](../docs/lux-integration.md#registro-de-provas-técnicas); não foi repetida com privilégios nesta iteração.
- Backend no container Node 24.21.0: lint, typecheck, seis testes unitários e cinco testes HTTP passaram. Para os HTTP, foi necessário copiar `backend/test` para `/app/test`, pois o Compose não monta esse diretório. Nenhum contrato/backend foi alterado; a suíte MySQL dedicada não foi executada.
- A identidade demonstrativa de validação foi revogada, preservando seu histórico; os arquivos temporários da credencial foram removidos do WSL2, container e Lux. Os containers de desenvolvimento ficaram iniciados. Não houve alteração de PAM, políticas, permissões Linux, serviços ou comandos privilegiados na VM.

Pendências daquele diagnóstico inicial: HTTPS real e falhas TLS, usuário/instalação do serviço, polling e recuperação de conexão, autorização administrativa local e pareamento. O incremento de polling abaixo cobre repetição de consultas e recuperação transitória. Sucesso deste diagnóstico não comprova aplicação de política nem identidade física do equipamento.

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

### Validação do polling — 2026-10-24

- Três consultas consecutivas retornaram HTTP 200/histórico vazio no WSL2 e no Lux contra NestJS/MySQL reais, com intervalo de 1 s, jitter 0 e limite 3. A VM usou loopback por túnel SSH; HTTPS real estava pendente nessa etapa e foi validado posteriormente no [guia HTTPS](../docs/lux-https-development.md).
- Revogação durante um ciclo no WSL2: primeira consulta HTTP 200; após invalidação administrativa da identidade demonstrativa, a segunda recebeu HTTP 401 e o processo encerrou com código 3, sem terceira tentativa. No Lux, a mesma identidade já revogada foi recusada na primeira consulta, também com código 3.
- A suíte final tem 42 testes, executados em Python 3.12.3 no WSL2 e 3.14.6 no Lux. Cadência, recuperação, backoff, jitter e esperas longas usam tempo simulado. HTTP 429/503 e `Retry-After` usam servidor local; falhas de certificado são simuladas. Subprocessos limitados verificam SIGINT/SIGTERM durante espera e SIGTERM durante HTTP em andamento. O prazo total também foi exercitado, sem esperar o atraso completo.
- A PoC leu novamente a própria conta no Lux sem sudo, com filtros/limites desativados. Não houve nova leitura privilegiada. Não se desligou o backend/MySQL para provocar indisponibilidade e não se executou a suíte MySQL dedicada.
- A identidade demonstrativa foi revogada; os arquivos temporários de credencial foram removidos ao concluir. A sincronização de fontes incluiu somente os seis arquivos Python, excluindo configurações/credenciais; a transferência do segredo foi separada, por SSH. Nenhuma configuração parental, serviço ou código do backend foi alterado.

Referências: [sinais Python 3.14](https://docs.python.org/3.14/library/signal.html), [erros urllib no Python 3.12](https://docs.python.org/3.12/library/urllib.error.html) e [Retry-After na RFC 9110](https://www.rfc-editor.org/rfc/rfc9110.html#section-10.2.3).

## Processar `agent.ping`

Adicione `--state-dir /caminho/privado/state` ao polling para habilitar o executor. O diretório deve ser exclusivo, `0700`, pertencente à conta executora e localizado sob pais confiáveis. Se ainda não existir, o Agent cria somente esse diretório; o pai deve existir. Em uso contínuo, preserve-o em armazenamento persistente e mantenha a mesma origem/credencial. Sem essa opção, o comportamento continua somente leitura de vínculos.

```bash
PYTHONPATH=lux-agent python3 -B -m lux_agent poll --backend-url https://localhost:3443 --credential-file /caminho/privado/credential --ca-file /caminho/privado/ca.pem --state-dir /caminho/privado/state --max-queries 3
```

`lux_agent.commands` valida o contrato, reserva antes de executar e devolve apenas `{ "reachable": true }`. `lux_agent.journal` usa SQLite padrão com commits duráveis, arquivos privados `0600` e exclusão por `flock`. Guarda claim antes do POST, `started` antes da execução e resultado antes do PUT. Resultado salvo é reenviado sem reexecução; `started` sem resultado permanece incerto. Não há promessa de execução exatamente uma vez. Não apague o diário para contornar um conflito.

A CLI mantém backoff, TLS, timeout por requisição e sinais. Comandos usam limite de 16 KiB por resposta. Sem rede/503, preserva pendências para o ciclo seguinte; 401/TLS/409 encerram. 404/410 de claim/resultado abandonam a autorização local. O processamento não importa malcontent, não recebe shell e não altera presença no mobile.

Procedimento e resultados: [validação de ping](../docs/agent-ping-validation.md). Passaram 63 testes Python no WSL2 e Lux, incluindo respostas de claim/resultado perdidas, reinício, erros de diário e comandos desconhecidos. A aplicação de políticas e o pareamento/autorização administrativa local permanecem pendentes.

## Desenvolver e testar no WSL2

O fonte permanece versionado neste repositório. Os testes usam `unittest` da biblioteca padrão, sem GI, D-Bus ou dependências pip. A suíte HTTPS também exige o executável OpenSSL 3 para gerar certificados temporários:

```bash
cd lux-agent
python3 -B -m unittest discover -s tests -v
python3 -B -m compileall -q lux_agent tests
python3 -B -m lux_agent read-policies --help
python3 -B -m lux_agent prove-app-filter --help
```

A suíte tem 99 testes em `tests/`, incluindo CLI/imports, wrappers, lista restrita de deploy e sintaxe dos scripts de instalação. O comando antigo `python3 -m unittest discover -s lux-agent -v`, na raiz do repositório, continua descobrindo a suíte. O diretório ainda não tem ferramentas Python de lint/typecheck configuradas. Compilação verifica sintaxe; os testes de comunicação usam um servidor HTTP local temporário e verificam Bearer, respostas, redirecionamento, falhas e proteção da credencial. Os testes da PoC verificam usuário obrigatório/inexistente, dependência ausente, flags sem interação, valores nativos, políticas desativadas e falha sem saída parcial. Esses testes isolados não comprovam permissões nem aplicação de restrições no Lux.

## Validação da reorganização — 2026-10-26

- Referência anterior: 63 testes passaram antes da alteração; todos os nomes/casos foram preservados em `tests/`. Depois, 69 testes passaram no WSL2/Python 3.12.3 e Lux/Python 3.14.6. Incluem sinais, TLS real, credencial, polling, ping, respostas perdidas e diário; os seis novos casos verificam estrutura/CLI/deploy.
- Wheel construído e instalado somente em área isolada, sem rede ou dependências de execução adicionais; entrada `lux-agent` e `python3 -m lux_agent` funcionaram fora do repositório. Compilação e checagens de links/sintaxe passaram. Não há lint/typecheck Python configurado.
- Deploy via allowlist validado no Lux. Os sete fontes antigos foram removidos somente após comparar seus hashes com a versão anterior do repositório; os três wrappers permaneceram. Nenhuma credencial/diário existente foi migrado.
- CLI real no Lux contra servidor HTTPS de contrato isolado no WSL2, por SSH: diagnóstico autenticado, polling/ping e reinício com o mesmo diário retornaram 0; CA/hostname inválidos retornaram 4 e credencial inválida retornou 3. Confirmação do resultado perdida retornou 4; reinício reenviou dois PUTs idênticos no total, com apenas um claim. Dados de teste ficaram fora do deploy e foram removidos ao concluir.
- `read-policies` consultou a própria conta do Lux sem sudo e retornou JSON válido. Não houve nova leitura privilegiada, escrita parental, instalação ou alteração de serviços.
- O relógio da VM estava aproximadamente quatro minutos atrás do host. A recusa inicial de certificado recém-emitido foi correta; a prova cruzada usou certificados de teste com validade iniciada no dia anterior. Não se alterou relógio, validação TLS ou confiança global.

O backend, Prisma, banco e protocolo HTTP não foram alterados nem reiniciados. A prova NestJS/MySQL anterior continua registrada em [Validação de ping](../docs/agent-ping-validation.md); nesta refatoração, o teste cruzado usou servidor de contrato, sem repetir essa integração real. A classe `CommandJournal` foi comparada por AST e permaneceu idêntica, preservando formato e persistência.

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

Na primeira atualização de uma cópia antiga, sete fontes deixam de pertencer ao deploy: os cinco `test_*.py` antigos na raiz, `command_processor.py` e `command_journal.py`. Após conferir que não possuem alterações locais, remova somente esses arquivos obsoletos; não remova credenciais, bancos ou diretórios de estado. Os três scripts executáveis antigos são atualizados como wrappers e continuam funcionando. A descoberta recomendada usa `-s tests`, evitando executar testes antigos que ainda não tenham sido removidos.

Use o Python do sistema Lux com seus bindings GI e comece sem `sudo`: a PoC usa `ManagerGetValueFlags.NONE`, sem autorização interativa ou elevação automática. Permissão negada, serviço indisponível ou dados inválidos retornam erro em stderr e código 1, sem JSON parcial. Argumentos inválidos retornam 2; uma consulta completa retorna 0 e JSON em stdout.

Na VM de referência, consultar a própria conta funcionou sem sudo, mas consultar outra conta pela sessão SSH administrativa foi negado à PoC e à CLI. As regras locais exigem autenticação administrativa para `ReadAny`; pertencer ao grupo sudo não basta. A negativa é falha de autorização, não prova de que a conta está sem restrições. Para comparar sem solicitar interação, use `malcontent-client get-app-filter --no-interactive USUARIO_ALVO` e `malcontent-client get-session-limits --no-interactive USUARIO_ALVO` no Lux. Consultas privilegiadas dependem de autorização explícita e autenticação local: `sudo -n` exigiu senha, e a leitura restritiva foi concluída pelo usuário com sudo autenticado no próprio terminal. Os JSONs antes/depois foram idênticos e os campos expostos pela CLI foram compatíveis. Não altere regras polkit para contornar essa limitação. Evidências em [Integração Lux](../docs/lux-integration.md#registro-de-provas-técnicas).

O JSON inclui nome/UID, `enabled` e `policy` para cada consulta. `policy` preserva `serialize().unpack()` da biblioteca; tuplas viram arrays JSON. É saída diagnóstica da PoC, sem contrato de backend. `enabled` descreve a configuração, não comprova bloqueio efetivo. As duas leituras são sequenciais, sem snapshot transacional. `DailySchedule`, quando presente, mantém segundos desde meia-noite; não convertemos para horário local. A interpretação de UTC exige cuidado e validação antes de futuras escritas.

Referências usadas: cliente oficial instalado em `/usr/bin/malcontent-client`, contrato local `/usr/share/dbus-1/interfaces/com.endlessm.ParentalControls.SessionLimits.xml` e [fonte de SessionLimits 0.13.1-5](https://sources.debian.org/src/malcontent/0.13.1-5/libmalcontent/session-limits.c/). Registro de resultados e limitações em [Integração Lux](../docs/lux-integration.md#registro-de-provas-técnicas).
