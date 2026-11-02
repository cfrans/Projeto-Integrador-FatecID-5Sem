const $ = (id) => document.getElementById(id);
let state;
let submitting = false;
let formError = '';
let renderedState = '';

function item(name, status, allowed) {
  const li = document.createElement('li');
  const label = document.createElement('span');
  const brand = state?.catalog?.find((app) => app.name === name);
  if (brand) { const img = document.createElement('img'); img.src = brand.logo; img.alt = ''; img.width = 28; img.height = 28; label.append(img); }
  label.append(document.createTextNode(name));
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
  renderCatalog();
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
  document.querySelectorAll('form button[type="submit"], #generate-qr, #choose-app').forEach((button) => { button.disabled = true; });
  try {
    const response = await fetch(path, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    const result = await response.json();
    if (!response.ok) throw new Error(result.message);
    render(result);
  } catch (error) { formError = error.message; $('notice').textContent = formError; }
  finally { submitting = false; document.querySelectorAll('form button[type="submit"], #generate-qr, #choose-app').forEach((button) => { button.disabled = false; }); }
}


let selectedCatalogId = '';
function renderCatalog() {
  const catalog = state.catalog ?? [];
  const unavailable = catalog.find((app) => app.id === selectedCatalogId);
  if (unavailable && (state.applications.some((app) => app.name === unavailable.name) || state.installationRequests.some((request) => request.applicationName === unavailable.name && !state.snapshot.settings.installationDecisions[request.id]))) selectedCatalogId = '';
  const selected = catalog.find((app) => app.id === selectedCatalogId);
  $('application-id').value = selectedCatalogId;
  $('selected-app').textContent = selected?.name ?? 'Selecionar aplicativo ▾';
  $('app-rating').textContent = selected ? `${selected.category} · classificação demonstrativa: ${selected.ageRating}` : '';
  $('app-options').replaceChildren(...catalog.map((app) => {
    const option = document.createElement('button');
    option.type = 'button'; option.setAttribute('role', 'option'); option.setAttribute('aria-selected', String(app.id === selectedCatalogId));
    const installed = state.applications.some((item) => item.name === app.name);
    const pending = state.installationRequests.some((request) => request.applicationName === app.name && !state.snapshot.settings.installationDecisions[request.id]);
    option.disabled = installed || pending;
    const img = document.createElement('img'); img.src = app.logo; img.alt = ''; img.width = 28; img.height = 28;
    option.append(img, document.createTextNode(`${app.name}${installed ? ' · instalado' : pending ? ' · pedido pendente' : ''}`));
    option.addEventListener('click', () => { selectedCatalogId = app.id; $('app-options').hidden = true; $('choose-app').setAttribute('aria-expanded', 'false'); renderCatalog(); $('choose-app').focus(); });
    return option;
  }));
}
$('choose-app').addEventListener('click', () => {
  $('app-options').hidden = !$('app-options').hidden;
  $('choose-app').setAttribute('aria-expanded', String(!$('app-options').hidden));
  if (!$('app-options').hidden) $('app-options').querySelector('button:not(:disabled)')?.focus();
});
$('app-options').addEventListener('keydown', (event) => {
  const options = [...$('app-options').querySelectorAll('button:not(:disabled)')];
  const index = options.indexOf(document.activeElement);
  if (event.key === 'ArrowDown' || event.key === 'ArrowUp') { event.preventDefault(); options[(index + (event.key === 'ArrowDown' ? 1 : -1) + options.length) % options.length]?.focus(); }
  if (event.key === 'Escape') { $('app-options').hidden = true; $('choose-app').setAttribute('aria-expanded', 'false'); $('choose-app').focus(); }
});

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
