# Validação de `agent.ping`

O [contrato v1](agent-protocol.md) é a referência para autorização, idempotência, estados e recuperação. A criação/consulta é pela API de responsável; ainda não existe UI mobile para comandos. Ping apenas produz `{ "reachable": true }`, sem acessar malcontent ou políticas.

## Preparar banco isolado

Use Node 24.15+ na linha 24, MySQL 8.4, Python 3.12+ e o alias `ssh lux`. Nunca rode testes MySQL no banco da aplicação. Se o backend estiver em watch sobre os fontes alterados, combine sua parada antes de gerar/aplicar a nova migration; não reinicie serviços compartilhados automaticamente.

A migration `20261026035355_agent_ping_commands/migration.sql` foi gerada com `npm run prisma:migrate:dev -- --name agent_ping_commands --create-only`, revisada e aplicada somente em MySQL descartável. Cria tabela/índices/FKs; não altera dados anteriores. Antes de atualizar bancos persistentes, revise o SQL e planeje a atualização conjunta de schema, Prisma Client e backend. Iniciar/reiniciar o Compose normal aplica migrations automaticamente; não o use como ambiente descartável.

Prepare um arquivo privado fora do Git conforme [verificações MySQL](backend.md#verificações): `NODE_ENV=test`, banco terminado em `_test`, conexão MySQL de teste e JWT aleatório. Para MySQL Docker descartável, use um projeto Compose separado, MySQL com `tmpfs: /var/lib/mysql`, rede própria e porta API loopback diferente. A validação registrada abaixo usou `lux-ping-validation`, API em `127.0.0.1:13001` e o banco `piplup_commands_test`; não usou o volume `mysql_data` do projeto.

Com as variáveis de teste injetadas no processo, em `backend/`:

```bash
npm run prisma:migrate:deploy
npm run prisma:generate
npm run prisma:validate
npm run lint
npm run typecheck
npm run build
npm test
npm run test:e2e
npm run test:mysql
```

Alternativamente, para carregar o arquivo privado em cada ferramenta, use os comandos documentados em [Backend](backend.md#verificações), como `node --env-file=/caminho/test.env --test test/*.mysql-test.mjs`. Variáveis injetadas têm precedência sobre a `.env` da raiz. Não use `db push`, reset ou aplicação manual do SQL para contornar migrations.

A suíte MySQL cria e remove somente suas fixtures aleatórias. Testa autenticação, dispositivos, pareamento e comandos. Não comprova, sozinha, execução do Python no Lux.

## Preparar a prova real

1. Antes de iniciar a API de teste, crie uma conta de responsável exclusiva com o seed existente, `NODE_ENV=development` e `DEV_GUARDIAN_*` apontando apenas ao banco isolado. Volte a API para `NODE_ENV=test`. Provisione uma identidade exclusiva com `--demo`, pela [ferramenta existente](backend.md#provisionamento-e-invalidação-administrativa). Não use uma credencial de outro ambiente.
2. Inicie a API compilada nesse banco. Monte o [proxy HTTPS temporário](lux-https-development.md) na rede da API de teste, apontando para ela. Se a API estiver no host em `13001`, ajuste o upstream conforme a rede Docker; não confunda com a API persistente em `3000`. Nesta prova, Nginx resolveu `backend:3000` na rede isolada, com HTTPS publicado em `127.0.0.1:13445`.
3. [Sincronize os fontes Python](../lux-agent/README.md#sincronizar-e-executar-no-lux), usando a lista restrita `deploy-files.txt`, que inclui o pacote e `tests/`. Transfira por SSH, separadamente, somente a credencial e a CA pública. Nunca envie chaves da CA/servidor ao Lux.
4. Prepare um diretório privado para o diário. Para uso contínuo, escolha armazenamento persistente com pais confiáveis e preserve-o entre execuções. Use `/tmp` somente na prova descartável e remova-o após revogar a identidade.

O pareamento de fixture é conduzido pelo operador de desenvolvimento através dos endpoints existentes, como nos testes MySQL. Não representa autorização administrativa local já implementada no Agent e não usa GTK/QR.

## Criar e consultar como responsável

Para reproduzir sem colocar tokens na linha de comando ou imprimi-los, crie um diretório privado `0700` fora do repositório contendo:

- `guardian.json`, modo `0600`, com `{ "email": "conta-de-teste", "password": "senha-de-teste" }` da conta criada pelo seed.
- `credential`, modo `0600`, emitido pelo provisionamento.
- `ca.pem`, certificado público da CA do proxy.

Salve o helper abaixo nesse diretório como `ping-check.py`. Ele usa apenas a biblioteca padrão, HTTPS com verificação e API existente; `create` faz login/pareamento de fixture/criação, e `read` consulta o estado. Não armazena JWT nem imprime segredos. `requestId` e localização do comando ficam no `command.json` para recuperação do teste.

```python
import json
import os
import ssl
import sys
import uuid
from pathlib import Path
from urllib.request import HTTPSHandler, HTTPRedirectHandler, ProxyHandler, Request, build_opener

class NoRedirect(HTTPRedirectHandler):
    def redirect_request(self, *args):
        return None

os.umask(0o077)
root = Path(__file__).resolve().parent
origin = 'https://localhost:13445'
actor = json.loads((root / 'guardian.json').read_text())
opener = build_opener(ProxyHandler({}), NoRedirect(), HTTPSHandler(
    context=ssl.create_default_context(cafile=str(root / 'ca.pem'))))

def call(method, path, body=None, bearer=None):
    headers = {'Content-Type': 'application/json'}
    if bearer:
        headers['Authorization'] = 'Bearer ' + bearer
    data = None if body is None else json.dumps(body).encode()
    with opener.open(Request(origin + path, data=data, method=method,
                             headers=headers), timeout=10) as response:
        return json.load(response)

jwt = call('POST', '/auth/login', actor)['accessToken']
if sys.argv[1] == 'create':
    credential = (root / 'credential').read_text().strip()
    session = call('POST', '/agent/pairing-sessions', {}, credential)
    paired = call('POST', '/pairing/complete', {'token': session['token']}, jwt)
    intent = {'requestId': str(uuid.uuid4()), 'type': 'agent.ping',
              'version': 1, 'parameters': {}}
    path = '/devices/' + paired['id'] + '/commands'
    record = {'path': path, 'intent': intent}
    with (root / 'command.json').open('x') as output:
        json.dump(record, output)
else:
    record = json.loads((root / 'command.json').read_text())
command = call('POST', record['path'], record['intent'], jwt)
state = call('GET', record['path'] + '/' + command['id'], bearer=jwt)
print(json.dumps({'id': state['id'], 'status': state['status'],
                  'result': state['result'], 'completedAt': state['completedAt']}))
```

Execute `python3 /caminho/privado/ping-check.py create`: deve mostrar `pending`. A modalidade `read` repete a criação com a intenção salva, comprovando idempotência, e consulta o mesmo registro. O helper é exclusivo de teste e não é um novo endpoint ou implementação de pareamento local. Em caso de falha durante `create`, investigue se o vínculo já foi criado antes de tentar novo pareamento.

## Processar no Lux

Com os caminhos privados preparados na VM, execute no host:

```bash
ssh -o BatchMode=yes -o ExitOnForwardFailure=yes \
  -R 127.0.0.1:13446:127.0.0.1:13445 lux \
  'cd ~/lux-agent-poc && python3 -B -m lux_agent poll --backend-url https://localhost:13446 --credential-file /caminho/privado/credential --ca-file /caminho/privado/ca.pem --state-dir /caminho/privado/state --interval 1 --jitter 0 --max-queries 3'
```

Esperado: um resultado confirmado no primeiro ciclo, zero nos seguintes, sem nomes, tokens ou dados Linux. O túnel encaminha TLS sem terminá-lo; o certificado deve ser válido para `localhost`. Não use `--allow-local-http` nessa prova.

Execute `python3 /caminho/privado/ping-check.py read`: esperado `succeeded`, `{ "reachable": true }` e horário de conclusão. Repita o comando SSH com o mesmo diário; não deve executar novamente. Se o comando expirar antes do processamento, crie uma nova intenção explicitamente; não altere o relógio, prazo ou diário para ressuscitá-lo.

```bash
PYTHONPATH=lux-agent python3 -B -m unittest discover -s lux-agent/tests -v
python3 -B -m compileall -q lux-agent/lux_agent lux-agent/tests
ssh -o BatchMode=yes lux 'cd ~/lux-agent-poc && python3 -B -m unittest discover -s tests -v'
```

## Evidência — 2026-10-26

- Backend Node 24.21.0, NestJS/Prisma atuais e MySQL 8.4 em banco tmpfs exclusivo; schema validado, migration gerada pelo Prisma, SQL revisado e aplicada só no ambiente descartável.
- WSL2 Python 3.12.3 e Lux Python 3.14.6: 63 testes Python passaram em cada ambiente. Backend: lint/typecheck/build, seis testes unitários, cinco HTTP e 18 testes MySQL passaram (incluindo 14 subcenários novos de comandos).
- Login HTTPS 200; criação de sessão de fixture 201 e pareamento 200 pelos endpoints existentes. Responsável criou comando por HTTPS com 201; repetição equivalente retornou 200 e o mesmo UUID.
- Comando `0b2df89e-92c2-46eb-b0a0-422c76847f37`, criado em `2026-10-26T05:09:16.521Z`; Agent executou no Lux com CA explícita por SSH/Nginx. Primeira consulta confirmou um resultado, as duas seguintes zero.
- Consulta HTTPS pelo responsável retornou `succeeded`, `result: { "reachable": true }`, `error: null`, conclusão em `2026-10-26T05:09:16.900Z` e claim registrado. Nova execução do processo com o mesmo diário não repetiu o ping.
- A execução concorrente da suíte revelou gap locks entre sessões de pareamento de dispositivos distintos; `READ COMMITTED` com o lock por dispositivo corrigiu a causa. Um teste antigo de rollback também passou a contar somente sua fixture, eliminando interferência da contagem global; o teste de expiração sob lock passou a vencer a validade dentro da transação bloqueadora, sem depender de uma espera curta do relógio. Há teste adicional com oito computadores pareando/reservando simultaneamente.
- Respostas perdidas, crash após `started`, falhas de diário, contratos inválidos e recuperação transitória foram exercitados em servidores locais/testes controlados nos dois sistemas, sem falha física induzida no Lux ou GNOME. Concorrência/revogação/expiração foram exercitadas contra MySQL real.

## Limpeza e limites

Revogue a identidade demonstrativa pela ferramenta administrativa antes de remover credenciais/diário. Pare somente proxy e containers exclusivos do teste. Apagar o MySQL tmpfs descarta suas fixtures/resultados. Remova material TLS e arquivos privados do host/container/Lux, sem remover a cópia dos fontes. Nenhuma CA global ou serviço Lux é instalado.

Nesta execução, a identidade de teste foi revogada e o ambiente descartável/material privado removido. O MySQL persistente do projeto permaneceu ativo e sem nova migration; o backend original ficou parado conforme autorização, para não iniciar código novo contra schema antigo. Reativá-lo exige revisar a migration e atualizar a imagem/client/schema em conjunto.

Não validado: comandos parentais, malcontent remoto, UI mobile de comandos, systemd, autorização/pareamento local, hospedagem definitiva e tolerância a perda física de disco. Não há promessa de execução exatamente uma vez nem automação de retenção do diário. Os certificados temporários precisam ser regenerados em outra apresentação.
