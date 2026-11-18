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
PAIR_HELPER=$APP_DIR/lux-agent-pair-helper
PAIR_ACTION=/usr/share/polkit-1/actions/org.piplup.luxagent.pair.policy
COMMAND=/usr/local/bin/lux-agent
GUI_COMMAND=/usr/local/bin/piplup
DESKTOP_FILE=/usr/share/applications/org.piplup.Pairing.desktop
ICON_DIR=/usr/share/icons/hicolor
ICON=$ICON_DIR/scalable/apps/org.piplup.Pairing.svg

usage() {
    cat <<'EOF'
Uso: sudo ./install.sh [opções]

Instala o Lux Agent como serviço systemd e o comando lux-agent. Pode ser
executado novamente para atualizar código e configuração; a credencial
existente é mantida. O pareamento (lux-agent pair) gera a credencial.

  --backend-url URL        Origem HTTPS do backend (pergunta se ausente)
  --managed-user CONTA     Conta infantil gerenciada (pergunta se ausente)
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
ca_source=""
while (( $# > 0 )); do
    case $1 in
        --backend-url) backend_url=${2:?}; shift 2 ;;
        --managed-user) managed_user=${2:?}; shift 2 ;;
        --ca-file) ca_source=${2:?}; shift 2 ;;
        -h|--help) usage; exit 0 ;;
        *) usage >&2; exit 2 ;;
    esac
done

(( EUID == 0 )) || die "execute com sudo."
command -v python3 >/dev/null || die "python3 não encontrado."
command -v systemctl >/dev/null || die "systemd não encontrado."
for file in lux-agent.service polkit/50-lux-agent.rules polkit/org.piplup.luxagent.pair.policy \
        scripts/lux-agent scripts/lux-agent-pair-helper scripts/piplup lux_agent/__main__.py \
        lux_agent_gui/__main__.py desktop/org.piplup.Pairing.desktop desktop/org.piplup.Pairing.svg; do
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

missing_packages=()
python3 -c 'import qrcode' 2>/dev/null || missing_packages+=(python3-qrcode)
command -v pkexec >/dev/null || missing_packages+=(pkexec)
python3 -c 'import gi' 2>/dev/null || missing_packages+=(python3-gi)
python3 -c 'import gi; gi.require_version("Gtk", "4.0")' 2>/dev/null || missing_packages+=(gir1.2-gtk-4.0)
python3 -c 'import gi; gi.require_version("Adw", "1")' 2>/dev/null || missing_packages+=(gir1.2-adw-1)
if (( ${#missing_packages[@]} > 0 )); then
    echo "Instalando dependências: ${missing_packages[*]}."
    DEBIAN_FRONTEND=noninteractive apt-get install -y --no-install-recommends "${missing_packages[@]}" >/dev/null \
        || die "não foi possível instalar ${missing_packages[*]}."
fi

if ! id -u "$SERVICE_USER" >/dev/null 2>&1; then
    useradd --system --user-group --no-create-home --home-dir /nonexistent --shell /usr/sbin/nologin "$SERVICE_USER"
    echo "Usuário de sistema $SERVICE_USER criado."
fi

install -d -m 0755 -o root -g root "$APP_DIR"
rm -rf -- "$APP_DIR/lux_agent"
install -d -m 0755 -o root -g root "$APP_DIR/lux_agent"
install -m 0644 -o root -g root "$SOURCE_DIR"/lux_agent/*.py "$APP_DIR/lux_agent/"
rm -rf -- "$APP_DIR/lux_agent_gui"
install -d -m 0755 -o root -g root "$APP_DIR/lux_agent_gui"
install -m 0644 -o root -g root "$SOURCE_DIR"/lux_agent_gui/*.py "$APP_DIR/lux_agent_gui/"
install -m 0755 -o root -g root "$SOURCE_DIR/scripts/lux-agent-pair-helper" "$PAIR_HELPER"
install -m 0755 -o root -g root "$SOURCE_DIR/scripts/lux-agent" "$COMMAND"
install -m 0755 -o root -g root "$SOURCE_DIR/scripts/piplup" "$GUI_COMMAND"
install -D -m 0644 -o root -g root "$SOURCE_DIR/desktop/org.piplup.Pairing.desktop" "$DESKTOP_FILE"
install -D -m 0644 -o root -g root "$SOURCE_DIR/desktop/org.piplup.Pairing.svg" "$ICON"
gtk-update-icon-cache -q -t -f "$ICON_DIR" 2>/dev/null || true

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
    chown "$SERVICE_USER:$SERVICE_USER" "$CREDENTIAL"
    chmod 0600 "$CREDENTIAL"
fi

install -d -m 0700 -o "$SERVICE_USER" -g "$SERVICE_USER" "$STATE_DIR"
install -m 0644 -o root -g root "$SOURCE_DIR/lux-agent.service" "$UNIT"
install -m 0644 -o root -g root "$SOURCE_DIR/polkit/50-lux-agent.rules" "$POLKIT_RULE"
install -m 0644 -o root -g root "$SOURCE_DIR/polkit/org.piplup.luxagent.pair.policy" "$PAIR_ACTION"

systemctl daemon-reload
systemctl enable lux-agent.service >/dev/null
if [[ -e $CREDENTIAL ]]; then
    systemctl restart lux-agent.service
    echo "Serviço lux-agent instalado e (re)iniciado para a conta gerenciada '$managed_user'."
else
    echo "Serviço lux-agent instalado; ele inicia após o pareamento."
    echo "Para parear, um administrador abre Piplup no menu de aplicativos (ou roda piplup) ou executa: lux-agent pair"
fi
