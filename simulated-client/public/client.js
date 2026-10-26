const $ = (id) => document.getElementById(id);
let state;
let submitting = false;
let formError = '';
let renderedState = '';

function item(name, status, allowed) {
  const li = document.createElement('li');
  const label = document.createElement('span');
  label.textContent = name;
  const badge = document.createElement('span');
  badge.className = `status ${allowed === true ? 'allowed' : allowed === false ? 'blocked' : ''}`;
  badge.textContent = status;
  li.append(label, badge);
  return li;
}

function render(next) {
  state = next;
  const signature = JSON.stringify([{ ...next, snapshot: next.snapshot ? { ...next.snapshot, connection: undefined } : null }, formError]);
  if (signature === renderedState) return;
  renderedState = signature;
  $('setup').hidden = !!state.device;
  $('computer').hidden = !state.device;
  $('backend').textContent = state.backendUrl;
  $('notice').textContent = formError || state.error;
  if (!state.device) return;
  $('computer-name').textContent = state.device.name;
  $('managed-user').textContent = `Conta gerenciada: ${state.device.managedUser || 'não informada'}`;
  $('connection').textContent = state.stopped ? 'Identidade recusada · reinicie após corrigir' : state.connected ? 'Conectado à API' : 'Aguardando conexão ou pareamento';
  $('connection').className = `connection${state.connected ? ' connected' : ''}`;
  $('pairing').hidden = state.paired;
  $('qr').hidden = !state.pairing;
  if (state.pairing) {
    $('qr').src = state.pairing.qr;
    $('expiry').textContent = `QR válido até ${new Date(state.pairing.expiresAt).toLocaleTimeString('pt-BR')}`;
  } else $('expiry').textContent = 'Gere um novo QR se o anterior expirou.';
  $('policies').hidden = !state.snapshot;
  $('revision').textContent = state.snapshot ? `Revisão ${state.snapshot.revision} · confirmação simulada` : '';
  if (!state.snapshot) return;
  const settings = state.snapshot.settings;
  $('browser-policy').textContent = settings.blockBrowsers ? 'Bloqueio geral ativo. Somente as exceções estão liberadas.' : 'Bloqueio geral desativado.';
  $('browsers').replaceChildren(...[['firefox', 'Firefox'], ['chromium', 'Chromium'], ['brave', 'Brave'], ['gnome-web', 'Navegador escolar']].map(([id, name]) => {
    const allowed = !settings.blockBrowsers || settings.allowedBrowsers[id];
    return item(name, allowed ? 'Permitido' : 'Bloqueado', allowed);
  }));
  $('age').textContent = settings.ageRating === 'L' ? 'Livre' : `${settings.ageRating} anos`;
  $('installation-policy').textContent = settings.blockInstallation ? 'Instalações exigem aprovação do responsável.' : 'Instalação de aplicativos liberada.';
  $('applications').replaceChildren(...state.applications.map((app) => {
    const allowed = (settings.applicationRules[app.id] ?? true) && (app.name !== 'Firefox' || !settings.blockBrowsers || settings.allowedBrowsers.firefox);
    const li = item(app.name, allowed ? 'Permitido' : 'Bloqueado', allowed);
    const button = document.createElement('button');
    button.type = 'button';
    button.textContent = 'Tentar abrir';
    button.disabled = !state.connected;
    button.addEventListener('click', () => {
      $('launch-result').textContent = `${app.name}: ${allowed ? 'abertura permitida' : 'abertura bloqueada'} nesta simulação.`;
    });
    li.append(button);
    return li;
  }));
  const decisions = settings.installationDecisions;
  $('requests').replaceChildren(...state.installationRequests.map((request) => {
    const decision = decisions[request.id];
    return item(request.applicationName, decision === 'APPROVED' ? 'Aprovado' : decision === 'DENIED' ? 'Recusado' : 'Aguardando responsável', decision ? decision === 'APPROVED' : null);
  }));
  if (!state.installationRequests.length) $('requests').append(item('Nenhum pedido enviado', ''));
}

async function action(path, body) {
  if (submitting) return;
  submitting = true;
  formError = '';
  document.querySelectorAll('form button, #generate-qr').forEach((button) => { button.disabled = true; });
  try {
    const response = await fetch(path, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    const result = await response.json();
    if (!response.ok) throw new Error(result.message);
    render(result);
  } catch (error) { formError = error.message; $('notice').textContent = formError; }
  finally { submitting = false; document.querySelectorAll('form button, #generate-qr').forEach((button) => { button.disabled = false; }); }
}

$('registration').addEventListener('submit', (event) => {
  event.preventDefault();
  const data = Object.fromEntries(new FormData(event.currentTarget));
  event.currentTarget.elements.password.value = '';
  void action('/api/register', data);
});
$('generate-qr').addEventListener('click', () => void action('/api/pair', {}));
$('request-form').addEventListener('submit', (event) => {
  event.preventDefault();
  void action('/api/installation-request', Object.fromEntries(new FormData(event.currentTarget)));
});

async function refresh() {
  try {
    const response = await fetch('/api/state');
    if (!response.ok) throw new Error('Client local indisponível.');
    const next = await response.json();
    if (!submitting) render(next);
  } catch { $('notice').textContent = 'O programa local foi encerrado ou está indisponível.'; }
  setTimeout(() => void refresh(), 1500);
}
void refresh();
