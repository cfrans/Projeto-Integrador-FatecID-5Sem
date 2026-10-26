# Lux Agent

Fundação Python 3 do Agent com três comandos: `read_policies.py` lê políticas nativas; `check_backend.py` valida uma vez a identidade provisionada; `poll_associations.py` consulta periodicamente os vínculos no NestJS, somente por GET. Não há infraestrutura de comandos remotos, pareamento local, serviço systemd ou GTK.

A [proposta de protocolo](../docs/agent-protocol.md) separa a observação periódica de vínculos, agora implementada, do futuro transporte de comandos, com reserva, resultados e recuperação. Os endpoints e modelos de comandos continuam em revisão, sem implementação.

A PoC de leitura usa PyGObject/libmalcontent e AccountsService, sem alterar políticas ou solicitar elevação. A VM de referência é Lux 3/Canopus, GNOME 50.4 e malcontent 0.13.1-5. Leituras com e sem restrições foram validadas; consultar outra conta exigiu autenticação administrativa. Privilégios mínimos do futuro serviço permanecem pendentes. O [client simulado](../docs/simulated-client.md) é um programa separado para demonstração; seu contrato não implementa comandos ou políticas Linux neste Agent.

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

Pendências daquele diagnóstico inicial: HTTPS real e falhas TLS, usuário/instalação do serviço, polling e recuperação de conexão, autorização administrativa local e pareamento. O incremento de polling abaixo cobre repetição de consultas e recuperação transitória. Sucesso deste diagnóstico não comprova aplicação de política nem identidade física do equipamento.

Referências de implementação: [urllib.request no Python 3.12](https://docs.python.org/3.12/library/urllib.request.html) e [os no Python 3.14](https://docs.python.org/3.14/library/os.html#os.open).

## Polling somente de leitura

`poll_associations.py` reutiliza a validação de URL e arquivo privado e a função `fetch_associations()` em `check_backend.py`. O diagnóstico antigo mantém seus argumentos, códigos de saída e retorno por contagem; o cliente compartilhado preserva registros apenas em memória e acrescenta categoria de erro, possibilidade de repetição, status HTTP e `Retry-After`.

```bash
python3 -B lux-agent/poll_associations.py --backend-url https://api.exemplo --credential-file /caminho/privado/agent-credential --max-queries 3
```

| Opção | Comportamento |
| --- | --- |
| `--interval` | Base entre consultas, contada após o término da anterior; padrão 15 s |
| `--max-backoff` | Teto do atraso com jitter; padrão 300 s; deve ser pelo menos o intervalo |
| `--jitter` | Variação proporcional; padrão 0.2 (±20%); aceita 0 para diagnóstico reproduzível |
| `--timeout` | Prazo total por consulta, padrão 10 s, máximo 120 s |
| `--max-queries` | Limite de tentativas, incluindo falhas; não espera após a última; omitido mantém o ciclo |

Intervalo e backoff devem ser positivos e no máximo 86400 s; jitter deve estar entre 0 e menos de 1. A primeira consulta é imediata. Só há uma requisição por vez e nenhum processamento de comandos. Falhas transitórias dobram a base de espera até o teto; sucesso restaura a base ao intervalo. O jitter é aplicado antes do teto. Em HTTP 429/503, um `Retry-After` válido em segundos ou data HTTP é um piso da espera, inclusive acima do teto; um cabeçalho inválido usa o backoff normal. Datas HTTP dependem do relógio local correto. O limite de tentativas não é um limite de duração: `Retry-After` pode impor uma espera longa, interrompível por sinal.

Categorias de erro: `configuration`, `authentication`, `tls`, `connection`, `http` e `response`. Falhas de conexão/timeout e HTTP 429/5xx permitem repetição, exceto 501/505 por incompatibilidade. HTTP 401 encerra com código 3; TLS encerra com 4; demais erros HTTP permanentes e contrato inválido encerram com o código do diagnóstico. Não há fallback para HTTP, desativação de certificado ou redirecionamento. A exceção HTTP continua restrita ao loopback com `--allow-local-http` explícito.

Ctrl+C/SIGTERM encerram com código 0 e mensagem de interrupção, sem traceback. O limite de consultas retorna o código da última tentativa: 0 se bem-sucedida, 4/5 se terminou sem recuperar uma falha transitória. Interromper manualmente não comprova sucesso da comunicação. A saída contém só número da consulta, contagem do histórico e erros controlados; não imprime nomes, identificadores dos vínculos, credencial, corpo HTTP ou exceções brutas. Nenhuma associação é criada/revogada e `status`/`lastSeen` do mobile não mudam.

O ciclo é uma CLI Linux executada na thread principal. Usa SIGALRM/`setitimer` para limitar o tempo da consulta inteira (além do timeout de socket) e restaura os handlers ao terminar. SIGINT/SIGTERM também interrompem esperas e I/O Python em andamento. Não usa threads de consulta nem deixa chamadas sobrepostas; funções nativas que não retornem ao interpretador podem atrasar a entrega de sinais. A proteção e o limite de resposta de 1 MiB do cliente existente são preservados.

No Lux, com a credencial já instalada separadamente, use o mesmo túnel temporário:

```bash
ssh -o BatchMode=yes -o ExitOnForwardFailure=yes -R 127.0.0.1:13000:127.0.0.1:3000 lux 'python3 -B ~/lux-agent-poc/poll_associations.py --backend-url http://127.0.0.1:13000 --credential-file ~/.local/state/lux-agent/credential --allow-local-http --interval 1 --jitter 0 --max-queries 3'
```

### Validação do polling — 2026-10-24

- Três consultas consecutivas retornaram HTTP 200/histórico vazio no WSL2 e no Lux contra NestJS/MySQL reais, com intervalo de 1 s, jitter 0 e limite 3. A VM usou loopback por túnel SSH; HTTPS real continua pendente.
- Revogação durante um ciclo no WSL2: primeira consulta HTTP 200; após invalidação administrativa da identidade demonstrativa, a segunda recebeu HTTP 401 e o processo encerrou com código 3, sem terceira tentativa. No Lux, a mesma identidade já revogada foi recusada na primeira consulta, também com código 3.
- A suíte final tem 42 testes, executados em Python 3.12.3 no WSL2 e 3.14.6 no Lux. Cadência, recuperação, backoff, jitter e esperas longas usam tempo simulado. HTTP 429/503 e `Retry-After` usam servidor local; falhas de certificado são simuladas. Subprocessos limitados verificam SIGINT/SIGTERM durante espera e SIGTERM durante HTTP em andamento. O prazo total também foi exercitado, sem esperar o atraso completo.
- A PoC leu novamente a própria conta no Lux sem sudo, com filtros/limites desativados. Não houve nova leitura privilegiada. Não se desligou o backend/MySQL para provocar indisponibilidade e não se executou a suíte MySQL dedicada.
- A identidade demonstrativa foi revogada; os arquivos temporários de credencial foram removidos ao concluir. A sincronização de fontes incluiu somente os seis arquivos Python, excluindo configurações/credenciais; a transferência do segredo foi separada, por SSH. Nenhuma configuração parental, serviço ou código do backend foi alterado.

Referências: [sinais Python 3.14](https://docs.python.org/3.14/library/signal.html), [erros urllib no Python 3.12](https://docs.python.org/3.12/library/urllib.error.html) e [Retry-After na RFC 9110](https://www.rfc-editor.org/rfc/rfc9110.html#section-10.2.3).

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
rsync -rltivn -e 'ssh -o BatchMode=yes -o ConnectTimeout=10' --include='/poll_associations.py' --include='/test_poll_associations.py' --include='/check_backend.py' --include='/test_check_backend.py' --include='/read_policies.py' --include='/test_read_policies.py' --include='/README.md' --exclude='*' lux-agent/ lux:lux-agent-poc/
rsync -rltiv -e 'ssh -o BatchMode=yes -o ConnectTimeout=10' --include='/poll_associations.py' --include='/test_poll_associations.py' --include='/check_backend.py' --include='/test_check_backend.py' --include='/read_policies.py' --include='/test_read_policies.py' --include='/README.md' --exclude='*' lux-agent/ lux:lux-agent-poc/
ssh lux 'python3 -B -m unittest discover -s ~/lux-agent-poc -v'
ssh lux 'python3 -B ~/lux-agent-poc/read_policies.py --user USUARIO_ALVO'
```

O destino é uma cópia executável em `~/lux-agent-poc/`, sem Git e sem edição de fonte na VM. A lista de inclusão transfere somente os sete arquivos indicados (seis Python e este README); `.env`, chaves, credenciais, caches e qualquer outro arquivo ficam excluídos. Não use `--delete` nem sincronize a raiz do repositório. Substitua `USUARIO_ALVO` pelo login da conta que deseja consultar; não há usuário implícito nem seleção automática de conta infantil.

Use o Python do sistema Lux com seus bindings GI e comece sem `sudo`: a PoC usa `ManagerGetValueFlags.NONE`, sem autorização interativa ou elevação automática. Permissão negada, serviço indisponível ou dados inválidos retornam erro em stderr e código 1, sem JSON parcial. Argumentos inválidos retornam 2; uma consulta completa retorna 0 e JSON em stdout.

Na VM de referência, consultar a própria conta funcionou sem sudo, mas consultar outra conta pela sessão SSH administrativa foi negado à PoC e à CLI. As regras locais exigem autenticação administrativa para `ReadAny`; pertencer ao grupo sudo não basta. A negativa é falha de autorização, não prova de que a conta está sem restrições. Para comparar sem solicitar interação, use `malcontent-client get-app-filter --no-interactive USUARIO_ALVO` e `malcontent-client get-session-limits --no-interactive USUARIO_ALVO` no Lux. Consultas privilegiadas dependem de autorização explícita e autenticação local: `sudo -n` exigiu senha, e a leitura restritiva foi concluída pelo usuário com sudo autenticado no próprio terminal. Os JSONs antes/depois foram idênticos e os campos expostos pela CLI foram compatíveis. Não altere regras polkit para contornar essa limitação. Evidências em [Integração Lux](../docs/lux-integration.md#registro-de-provas-técnicas).

O JSON inclui nome/UID, `enabled` e `policy` para cada consulta. `policy` preserva `serialize().unpack()` da biblioteca; tuplas viram arrays JSON. É saída diagnóstica da PoC, sem contrato de backend. `enabled` descreve a configuração, não comprova bloqueio efetivo. As duas leituras são sequenciais, sem snapshot transacional. `DailySchedule`, quando presente, mantém segundos desde meia-noite; não convertemos para horário local. A interpretação de UTC exige cuidado e validação antes de futuras escritas.

Referências usadas: cliente oficial instalado em `/usr/bin/malcontent-client`, contrato local `/usr/share/dbus-1/interfaces/com.endlessm.ParentalControls.SessionLimits.xml` e [fonte de SessionLimits 0.13.1-5](https://sources.debian.org/src/malcontent/0.13.1-5/libmalcontent/session-limits.c/). Registro de resultados e limitações em [Integração Lux](../docs/lux-integration.md#registro-de-provas-técnicas).
