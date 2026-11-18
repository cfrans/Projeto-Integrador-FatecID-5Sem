#!/bin/bash
set -euo pipefail

SERVICE_USER=lux-agent
APP_DIR=/opt/lux-agent
CONFIG_DIR=/etc/lux-agent
ENV_FILE=$CONFIG_DIR/agent.env
STATE_DIR=/var/lib/lux-agent
UNIT=/etc/systemd/system/lux-agent.service
POLKIT_RULE=/etc/polkit-1/rules.d/50-lux-agent.rules
PAIR_ACTION=/usr/share/polkit-1/actions/org.piplup.luxagent.pair.policy
COMMAND=/usr/local/bin/lux-agent
GUI_COMMAND=/usr/local/bin/piplup
DESKTOP_FILE=/usr/share/applications/org.piplup.Pairing.desktop
ICON_DIR=/usr/share/icons/hicolor
ICON=$ICON_DIR/scalable/apps/org.piplup.Pairing.svg

usage() {
    cat <<'EOF'
Uso: sudo ./uninstall.sh [opções]

Remove serviço, comandos lux-agent e piplup, atalho e ícone Piplup,
código, configuração, credencial, estado, regra e ação polkit e o usuário
lux-agent. As políticas da conta gerenciada são mantidas.

  --reset-policies  Também limpa o filtro de aplicativos da conta gerenciada
  -y, --yes         Não pede confirmação
  -h, --help        Mostra esta ajuda
EOF
}

die() {
    echo "Erro: $*" >&2
    exit 1
}

reset_policies=false
assume_yes=false
while (( $# > 0 )); do
    case $1 in
        --reset-policies) reset_policies=true; shift ;;
        -y|--yes) assume_yes=true; shift ;;
        -h|--help) usage; exit 0 ;;
        *) usage >&2; exit 2 ;;
    esac
done

(( EUID == 0 )) || die "execute com sudo."

managed_user=""
[[ -f $ENV_FILE ]] && managed_user=$(sed -n 's/^LUX_AGENT_MANAGED_USER=//p' "$ENV_FILE" | tail -n 1)
if $reset_policies; then
    [[ -n $managed_user ]] || die "conta gerenciada desconhecida; não é possível limpar políticas."
    command -v malcontent-client >/dev/null || die "malcontent-client não encontrado."
fi

if ! $assume_yes; then
    [[ -t 0 ]] || die "confirme com --yes."
    echo "Serão removidos: $UNIT, $POLKIT_RULE, $PAIR_ACTION, $COMMAND, $GUI_COMMAND, $DESKTOP_FILE, $ICON, $APP_DIR, $CONFIG_DIR (incluindo a credencial), $STATE_DIR e o usuário $SERVICE_USER."
    $reset_policies && echo "O filtro de aplicativos da conta '$managed_user' será limpo."
    read -r -p "Continuar? [s/N] " answer
    [[ $answer == [sS] ]] || die "cancelado."
fi

if $reset_policies; then
    malcontent-client set-app-filter --no-interactive \
        --allow-user-installation --allow-system-installation "$managed_user" >/dev/null
    echo "Filtro de aplicativos de '$managed_user' limpo."
fi

if [[ -e $UNIT ]]; then
    systemctl disable --now lux-agent.service >/dev/null 2>&1 || true
fi
rm -f -- "$UNIT" "$POLKIT_RULE" "$PAIR_ACTION" "$COMMAND" "$GUI_COMMAND" "$DESKTOP_FILE" "$ICON"
gtk-update-icon-cache -q -t -f "$ICON_DIR" 2>/dev/null || true
systemctl daemon-reload
systemctl reset-failed lux-agent.service >/dev/null 2>&1 || true

rm -rf -- "$APP_DIR" "$CONFIG_DIR" "$STATE_DIR"

if id -u "$SERVICE_USER" >/dev/null 2>&1; then
    userdel "$SERVICE_USER"
fi

echo "Lux Agent removido."
echo "A identidade do computador continua válida no backend; revogue-a pela ferramenta administrativa se não for reinstalar."
