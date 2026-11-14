#!/bin/bash
set -euo pipefail

SOURCE_DIR=$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)
SERVICE_USER=lux-agent
APP_DIR=/opt/lux-agent
CONFIG_DIR=/etc/lux-agent
ENV_FILE=$CONFIG_DIR/agent.env
CREDENTIAL=$CONFIG_DIR/credential
CA_FILE=$CONFIG_DIR/ca.pem
STATE_DIR=/var/lib/lux-agent
UNIT=/etc/systemd/system/lux-agent.service
POLKIT_RULE=/etc/polkit-1/rules.d/50-lux-agent.rules

usage() {
    cat <<'EOF'
Uso: sudo ./install.sh [opções]

Instala o Lux Agent como serviço systemd. Pode ser executado novamente para
atualizar código e configuração; a credencial existente nunca é sobrescrita.

  --backend-url URL        Origem HTTPS do backend (pergunta se ausente)
  --managed-user CONTA     Conta infantil gerenciada (pergunta se ausente)
  --credential-file PATH   Credencial provisionada, instalada só se ainda não houver uma
  --ca-file PATH           CA PEM explícita do backend (desenvolvimento)
  -h, --help               Mostra esta ajuda
EOF
}

die() {
    echo "Erro: $*" >&2
    exit 1
}

current_value() {
    [[ -f $ENV_FILE ]] || return 0
    sed -n "s/^$1=//p" "$ENV_FILE" | tail -n 1
}

ask() {
    local prompt=$1 default=$2 answer
    [[ -t 0 ]] || die "$prompt: informe pela opção correspondente."
    if [[ -n $default ]]; then
        read -r -p "$prompt [$default]: " answer
    else
        read -r -p "$prompt: " answer
    fi
    printf '%s' "${answer:-$default}"
}

validate_backend_url() {
    [[ $1 =~ ^https://[^[:space:]/?#@]+/?$ ]] || die "URL do backend deve ser uma origem HTTPS, sem caminho ou credenciais."
}

validate_managed_user() {
    local user=$1 uid
    [[ $user =~ ^[a-z_][a-z0-9_-]*$ ]] || die "nome de conta inválido: '$user'."
    uid=$(id -u -- "$user" 2>/dev/null) || die "a conta '$user' não existe."
    (( uid >= 1000 && uid < 60000 )) || die "'$user' não é uma conta de pessoa (UID $uid)."
    if id -nG -- "$user" | tr ' ' '\n' | grep -qx sudo; then
        die "'$user' é administrativa (grupo sudo); escolha uma conta padrão."
    fi
}

backend_url=""
managed_user=""
credential_source=""
ca_source=""
while (( $# > 0 )); do
    case $1 in
        --backend-url) backend_url=${2:?}; shift 2 ;;
        --managed-user) managed_user=${2:?}; shift 2 ;;
        --credential-file) credential_source=${2:?}; shift 2 ;;
        --ca-file) ca_source=${2:?}; shift 2 ;;
        -h|--help) usage; exit 0 ;;
        *) usage >&2; exit 2 ;;
    esac
done

(( EUID == 0 )) || die "execute com sudo."
command -v python3 >/dev/null || die "python3 não encontrado."
command -v systemctl >/dev/null || die "systemd não encontrado."
for file in lux-agent.service polkit/50-lux-agent.rules lux_agent/__main__.py; do
    [[ -f $SOURCE_DIR/$file ]] || die "arquivo ausente na origem: $file."
done

[[ -n $backend_url ]] || backend_url=$(current_value LUX_AGENT_BACKEND_URL)
[[ -n $backend_url ]] || backend_url=$(ask "Origem HTTPS do backend" "")
validate_backend_url "$backend_url"

managed_user=${managed_user:-$(ask "Conta infantil gerenciada" "$(current_value LUX_AGENT_MANAGED_USER)")}
validate_managed_user "$managed_user"

poll_options=$(current_value LUX_AGENT_POLL_OPTIONS)
if [[ -n $ca_source ]]; then
    [[ -f $ca_source ]] || die "CA não encontrada: $ca_source."
    grep -q -- '-----BEGIN CERTIFICATE-----' "$ca_source" || die "CA não está em formato PEM."
    poll_options="--ca-file $CA_FILE"
fi

if [[ -n $credential_source && ! -e $CREDENTIAL ]]; then
    [[ -f $credential_source ]] || die "credencial não encontrada: $credential_source."
    grep -Eqx '[A-Za-z0-9_-]{43}' "$credential_source" || die "formato da credencial provisionada inválido."
fi

if ! id -u "$SERVICE_USER" >/dev/null 2>&1; then
    useradd --system --user-group --no-create-home --home-dir /nonexistent --shell /usr/sbin/nologin "$SERVICE_USER"
    echo "Usuário de sistema $SERVICE_USER criado."
fi

install -d -m 0755 -o root -g root "$APP_DIR"
rm -rf -- "$APP_DIR/lux_agent"
install -d -m 0755 -o root -g root "$APP_DIR/lux_agent"
install -m 0644 -o root -g root "$SOURCE_DIR"/lux_agent/*.py "$APP_DIR/lux_agent/"

install -d -m 0750 -o root -g "$SERVICE_USER" "$CONFIG_DIR"
env_tmp=$(mktemp "$CONFIG_DIR/.agent.env.XXXXXX")
printf 'LUX_AGENT_BACKEND_URL=%s\nLUX_AGENT_MANAGED_USER=%s\nLUX_AGENT_POLL_OPTIONS=%s\n' \
    "$backend_url" "$managed_user" "$poll_options" >"$env_tmp"
chmod 0600 "$env_tmp"
mv -f -- "$env_tmp" "$ENV_FILE"

if [[ -n $ca_source ]]; then
    install -m 0644 -o root -g root "$ca_source" "$CA_FILE"
fi

if [[ -e $CREDENTIAL ]]; then
    [[ -z $credential_source ]] || echo "Credencial existente mantida; $credential_source não foi usado."
    chown "$SERVICE_USER:$SERVICE_USER" "$CREDENTIAL"
    chmod 0600 "$CREDENTIAL"
elif [[ -n $credential_source ]]; then
    install -m 0600 -o "$SERVICE_USER" -g "$SERVICE_USER" "$credential_source" "$CREDENTIAL"
    echo "Credencial instalada em $CREDENTIAL."
fi

install -d -m 0700 -o "$SERVICE_USER" -g "$SERVICE_USER" "$STATE_DIR"
install -m 0644 -o root -g root "$SOURCE_DIR/lux-agent.service" "$UNIT"
install -m 0644 -o root -g root "$SOURCE_DIR/polkit/50-lux-agent.rules" "$POLKIT_RULE"

systemctl daemon-reload
systemctl enable lux-agent.service >/dev/null
if [[ -e $CREDENTIAL ]]; then
    systemctl restart lux-agent.service
    echo "Serviço lux-agent instalado e (re)iniciado para a conta gerenciada '$managed_user'."
else
    echo "Serviço lux-agent instalado, mas não iniciado: falta a credencial."
    echo "Execute novamente com --credential-file PATH."
fi
