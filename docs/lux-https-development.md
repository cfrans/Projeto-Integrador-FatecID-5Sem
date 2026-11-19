# HTTPS temporário para o Lux Agent

Este procedimento valida Agent → HTTPS → proxy Nginx → NestJS → MySQL, sem mudar o Compose, endpoints ou schema. O proxy termina TLS na mesma rede Docker da API; o trecho interno até NestJS continua HTTP. É uma ferramenta temporária de desenvolvimento, não uma decisão de hospedagem. Não use esta configuração para exposição pública.

O hostname de desenvolvimento é `localhost`. O certificado de servidor tem SAN `DNS:localhost`, assinado por uma CA privada de curta duração. No Lux, um túnel SSH encaminha os bytes TLS sem terminá-los; o Agent continua verificando cadeia, validade e hostname. Nenhuma CA é instalada na confiança global. A CA pública é transferida por SSH; sua chave privada permanece somente no host de desenvolvimento.

Alternativas: TLS diretamente no NestJS exigiria mudar sua inicialização e configuração; uma CA pública exigiria domínio/resolução e emissão externa; instalar uma CA global ampliaria a confiança da máquina. O proxy descartável com CA explícita permite testar o fluxo existente com menos alterações.

## Preparação

Requisitos: backend/MySQL preparados conforme o [README](../README.md), Docker Compose v2, OpenSSL 3, Python 3.12+ no Linux e SSH para o Lux. Execute na raiz do repositório, em Bash. Confira os serviços antes de iniciá-los; não reinicie ou interrompa serviços compartilhados para este teste.

```bash
docker compose config --quiet
docker compose ps
```

Se o ambiente ainda estiver desligado, inicie-o com `docker compose up -d` e aguarde backend/MySQL saudáveis. Isso aplica as migrations já previstas no projeto. Não remova volumes. As variáveis privadas continuam na `.env` da raiz; nenhuma variável TLS é necessária ali ou no Compose.

## CA e certificado fora do Git

No mesmo terminal, mantenha `LUX_TLS_DIR` até a limpeza. O diretório é exclusivo e os arquivos são privados. Os certificados duram dois dias; gere novamente quando expirarem. O relógio dos dois ambientes precisa estar correto.

```bash
umask 077
LUX_TLS_DIR=$(mktemp -d /tmp/lux-https.XXXXXX)
openssl req -x509 -newkey rsa:2048 -noenc \
  -keyout "$LUX_TLS_DIR/ca.key" -out "$LUX_TLS_DIR/ca.pem" \
  -days 2 -subj '/CN=Lux temporary development CA' \
  -addext 'basicConstraints=critical,CA:TRUE' \
  -addext 'keyUsage=critical,keyCertSign,cRLSign'
openssl req -new -newkey rsa:2048 -noenc \
  -keyout "$LUX_TLS_DIR/server.key" -out "$LUX_TLS_DIR/server.csr" \
  -subj '/CN=localhost'
cat > "$LUX_TLS_DIR/server.ext" <<'EXT'
subjectAltName=DNS:localhost
basicConstraints=critical,CA:FALSE
keyUsage=critical,digitalSignature,keyEncipherment
extendedKeyUsage=serverAuth
subjectKeyIdentifier=hash
authorityKeyIdentifier=keyid,issuer
EXT
openssl x509 -req -in "$LUX_TLS_DIR/server.csr" \
  -CA "$LUX_TLS_DIR/ca.pem" -CAkey "$LUX_TLS_DIR/ca.key" -CAcreateserial \
  -out "$LUX_TLS_DIR/server.pem" -days 2 -extfile "$LUX_TLS_DIR/server.ext"
openssl verify -CAfile "$LUX_TLS_DIR/ca.pem" \
  -verify_hostname localhost "$LUX_TLS_DIR/server.pem"
```

O último comando deve retornar `OK`. Não copie `ca.key` ou `server.key` para o Lux. Nunca versione os artefatos, mesmo se o Git não os ignorar.

## Proxy descartável

Descubra a rede efetiva do backend para suportar nomes de projeto Compose diferentes. O container temporário publica somente loopback; a API HTTP existente não é reconfigurada. Este roteiro não usa `--network host`, que não funcionou para acesso pelo WSL2 neste ambiente Docker Desktop.

```bash
LUX_BACKEND_ID=$(docker compose ps -q backend)
LUX_DOCKER_NETWORK=$(docker inspect "$LUX_BACKEND_ID" --format '{{range $name, $_ := .NetworkSettings.Networks}}{{$name}}{{end}}')
cat > "$LUX_TLS_DIR/nginx.conf" <<'NGINX'
events {}
http {
  access_log off;
  error_log /dev/stderr crit;
  server {
    listen 443 ssl;
    ssl_certificate /tls/server.pem;
    ssl_certificate_key /tls/server.key;
    ssl_protocols TLSv1.2 TLSv1.3;
    location / {
      proxy_pass http://backend:3000;
      proxy_set_header Host $host;
    }
  }
}
NGINX
docker run --rm -d --name lux-https-validation \
  --network "$LUX_DOCKER_NETWORK" -p 127.0.0.1:3443:443 \
  --mount "type=bind,src=$LUX_TLS_DIR,dst=/tls,readonly" \
  nginx:stable-alpine nginx -c /tls/nginx.conf -g 'daemon off;'
curl --fail --cacert "$LUX_TLS_DIR/ca.pem" https://localhost:3443/health
```

Esperado: HTTP 200 com `database: "ok"`. Se o nome do container ou a porta já estiverem ocupados, escolha outro nome/porta e ajuste os comandos seguintes; não pare o ocupante. A imagem será baixada se ausente. Em caso de múltiplas redes no backend, selecione a rede que resolve o serviço `backend`.

## Identidade e consultas reais

O provisionamento abaixo é ferramenta de desenvolvimento para testar o transporte com o Agent dos fontes; o serviço instalado obtém a credencial por `lux-agent pair` ([pareamento](../lux-agent/README.md#parear-com-um-responsável)), usando a mesma CA em `install.sh --ca-file`. Use uma identidade demonstrativa exclusiva, sem vínculos. O backend saudável já possui o código compilado pelo watch. Registre o UUID retornado como `LUX_DEVICE_ID`, sem imprimir o conteúdo da credencial.

```bash
docker compose exec -T backend node dist/src/agent/agent-admin.js provision \
  --name 'Validação HTTPS temporária' --demo --output /tmp/lux-https-credential
LUX_DEVICE_ID='<UUID retornado pelo provisionamento>'
docker cp "$LUX_BACKEND_ID:/tmp/lux-https-credential" "$LUX_TLS_DIR/credential"
chmod 600 "$LUX_TLS_DIR/credential"
PYTHONPATH=lux-agent python3 -B -m lux_agent check-backend --backend-url https://localhost:3443 \
  --credential-file "$LUX_TLS_DIR/credential" --ca-file "$LUX_TLS_DIR/ca.pem"
PYTHONPATH=lux-agent python3 -B -m lux_agent poll --backend-url https://localhost:3443 \
  --credential-file "$LUX_TLS_DIR/credential" --ca-file "$LUX_TLS_DIR/ca.pem" \
  --interval 1 --jitter 0 --max-queries 3
```

Esperado: diagnóstico e três consultas com HTTP 200, histórico vazio e saída 0. `--ca-file` está disponível nos dois comandos: seleciona um arquivo PEM de CAs confiáveis somente para o processo. Omitido, usa a confiança padrão do Python; informado, usa o conjunto indicado. Não desativa a validação de certificado ou hostname. Arquivo ausente/inválido retorna código 2 com erro controlado. Não há fallback HTTP nem redirecionamento.

Para o Lux, [sincronize os fontes](../lux-agent/README.md#sincronizar-e-executar-no-lux), usando `deploy-files.txt`, que inclui `tests/test_https_transport.py`. Crie um diretório temporário privado e transfira separadamente apenas a credencial e a CA pública:

```bash
LUX_REMOTE_TLS_DIR=$(ssh -o BatchMode=yes lux 'umask 077; mktemp -d /tmp/lux-https.XXXXXX')
scp "$LUX_TLS_DIR/credential" "$LUX_TLS_DIR/ca.pem" "lux:$LUX_REMOTE_TLS_DIR/"
ssh -o BatchMode=yes -o ExitOnForwardFailure=yes \
  -R 127.0.0.1:13443:127.0.0.1:3443 lux \
  "cd ~/lux-agent-poc && python3 -B -m lux_agent poll --backend-url https://localhost:13443 --credential-file $LUX_REMOTE_TLS_DIR/credential --ca-file $LUX_REMOTE_TLS_DIR/ca.pem --interval 1 --jitter 0 --max-queries 3"
```

O túnel encerra ao terminar o comando. Para o diagnóstico, troque o subcomando `poll` por `check-backend` e remova as três opções de polling. Não use `--allow-local-http`.

## Recusas, revogação e erros

Repita o polling anterior no host e no Lux, dentro do mesmo encaminhamento SSH, com estas variações. Para conferir cada código de saída, use `echo $?` imediatamente após o comando.

| Cenário | Alteração e resultado esperado |
| --- | --- |
| CA não confiável | Omita `--ca-file`, sem instalar a CA no sistema: categoria `tls`, código 4 e somente uma tentativa |
| Hostname incompatível | Mantenha a CA, substitua `localhost` por `127.0.0.1`: categoria `tls`, código 4 e somente uma tentativa; o certificado não tem SAN de IP |
| CA inválida/ausente | Passe um caminho inexistente ou PEM inválido: `configuration`, código 2 |
| Credencial inválida | Gere outro arquivo privado com `python3 -c 'import secrets; print(secrets.token_urlsafe(32))' > "$LUX_TLS_DIR/invalid-credential"`, use-o com a CA válida: HTTP 401, código 3 |
| Conexão recusada | Use uma porta loopback comprovadamente sem listener, CA válida e `--max-queries 2`: categoria `connection`, duas tentativas e código 4 |
| Revogação durante polling | Inicie com `--interval 15 --jitter 0 --max-queries 3`; após a primeira consulta 200, execute a revogação abaixo em outro terminal: consulta seguinte 401, código 3, sem terceira tentativa |

```bash
docker compose exec -T backend node dist/src/agent/agent-admin.js revoke \
  --device-id "$LUX_DEVICE_ID"
```

A revogação é feita apenas na identidade criada para este teste e preserva o histórico. Depois dela, o diagnóstico também deve retornar 401/código 3. Para repetir um cenário de sucesso, provisione outra identidade exclusiva e revogue-a ao terminar.

```bash
PYTHONPATH=lux-agent python3 -B -m unittest discover -s lux-agent/tests -v
ssh -o BatchMode=yes lux 'cd ~/lux-agent-poc && python3 -B -m unittest discover -s tests -v'
```

Os testes TLS exigem o executável `openssl`; geram certificados/chaves em diretório temporário e os removem ao terminar. Cobrem cadeia/hostname, certificado expirado, CA inválida, Bearer, ambas as CLIs, HTTP 401/503, recusa de redirect e contrato inválido com servidor HTTPS local. Esse servidor de teste não substitui a prova com NestJS/MySQL acima. Não interrompa banco/backend para induzir 503.

## Limpeza

Depois de revogar a identidade, remova apenas os artefatos desta execução. Não remova diretórios de outros testes. Os comandos abaixo pressupõem as variáveis preservadas no mesmo terminal.

```bash
docker stop lux-https-validation
docker compose exec -T backend node -e "require('node:fs').unlinkSync('/tmp/lux-https-credential')"
ssh -o BatchMode=yes lux "rm -- $LUX_REMOTE_TLS_DIR/credential $LUX_REMOTE_TLS_DIR/ca.pem; rmdir -- $LUX_REMOTE_TLS_DIR"
rm -- "$LUX_TLS_DIR"/*
rmdir -- "$LUX_TLS_DIR"
```

O proxy é removido por `--rm`. Nenhum serviço ou confiança global é instalado no Lux. Backend/MySQL permanecem no estado escolhido pela equipe; não execute `compose down` em ambiente compartilhado sem confirmação.

Limites: o procedimento usa `localhost` por túnel SSH e terminação TLS temporária; não valida DNS/LAN pública, hospedagem definitiva ou TLS entre proxy e NestJS.

Referências: [SSLContext e confiança explícita no Python 3.12](https://docs.python.org/3.12/library/ssl.html#ssl.create_default_context), [HTTPSHandler](https://docs.python.org/3.12/library/urllib.request.html#urllib.request.HTTPSHandler) e [OpenSSL req 3.0](https://docs.openssl.org/3.0/man1/openssl-req/).
