const control = (name) => cy.get(`[data-testid="${name}"]`);

function visit() {
  cy.visit('/', {
    onBeforeLoad(window) {
      Object.defineProperty(window.navigator, 'language', { value: 'pt-BR', configurable: true });
      Object.defineProperty(window.navigator, 'languages', { value: ['pt-BR'], configurable: true });
    },
  });
}

function login(account, password = account.password) {
  visit();
  control('login-email').type(account.email, { log: false });
  control('login-password').type(password, { log: false });
  control('login-submit').click();
}

describe('MVP mobile web + API + MySQL + client simulado', () => {
  let account;

  beforeEach(() => {
    cy.task('demo:create', null, { log: false }).then((created) => { account = created; });
  });

  afterEach(() => { cy.task('demo:cleanup', null, { log: false }); });

  it('UC01: rejeita credenciais incorretas e permite uma nova tentativa', () => {
    cy.intercept('POST', '**/auth/login').as('login');
    login(account, 'SenhaIncorreta!123');
    cy.wait('@login').its('response.statusCode').should('eq', 401);
    cy.location('pathname').should('eq', '/');
    control('login-password').type(account.password, { log: false });
    control('login-submit').click();
    cy.wait('@login').its('response.statusCode').should('eq', 200);
    cy.location('pathname').should('eq', '/home');
    cy.contains('PC Cypress').should('be.visible');
  });

  it('UC04/UC05: confirma restrições somente depois da resposta do simulador', () => {
    login(account);
    cy.contains('[role="button"]', 'Restrições').first().click();
    cy.intercept('PATCH', '**/simulation/devices/*').as('save');
    cy.get('[role="switch"][aria-label="Bloquear navegadores"]').click();
    cy.wait('@save').its('response.statusCode').should('eq', 200);
    control('simulation-status').should('contain.text', 'aguardando');
    cy.task('demo:synchronize').its('snapshot.settings.blockBrowsers').should('eq', false);
    control('simulation-status').should('contain.text', 'Aplicado no client simulado');
    cy.contains('[role="tab"]', 'Idade').click();
    cy.get('[role="radio"]').filter('[aria-label^="16"]').click();
    cy.wait('@save').its('response.statusCode').should('eq', 200);
    cy.task('demo:synchronize').its('snapshot.settings.ageRating').should('eq', '16');
    cy.contains('[role="tab"]', 'Instalação').click();
    cy.get('[role="switch"][aria-label="Bloquear instalação"]').click();
    cy.wait('@save').its('response.statusCode').should('eq', 200);
    cy.task('demo:synchronize').its('snapshot.settings.blockInstallation').should('eq', false);
    control('simulation-status').should('contain.text', 'Aplicado no client simulado');
  });

  it('UC06: recebe e recusa um pedido de instalação do client simulado', () => {
    cy.task('demo:requestInstallation');
    login(account);
    cy.contains('[role="button"]', 'Restrições').first().click();
    cy.contains('[role="tab"]', 'Instalação').click();
    control('installation-screen').contains('GIMP').should('be.visible');
    cy.intercept('PATCH', '**/simulation/devices/*').as('decision');
    cy.contains('[role="button"]', 'Recusar').click();
    cy.wait('@decision').its('response.statusCode').should('eq', 200);
    cy.task('demo:synchronize').then((state) => {
      expect(Object.values(state.snapshot.settings.installationDecisions)).to.include('DENIED');
    });
    cy.contains('Nenhum pedido').should('be.visible');
  });

  it('UC05: falha de rede não confirma uma alteração nem encerra a sessão', () => {
    login(account);
    cy.contains('[role="button"]', 'Restrições').first().click();
    cy.intercept('PATCH', '**/simulation/devices/*', { forceNetworkError: true }).as('unavailable');
    cy.get('[role="switch"][aria-label="Bloquear navegadores"]').click();
    cy.wait('@unavailable');
    cy.get('[role="alert"]').should('be.visible');
    cy.location('pathname').should('include', '/restrictions');
    cy.task('demo:synchronize').its('snapshot.settings.blockBrowsers').should('eq', true);
  });

  it('UC03: revogação retira o PC da lista do responsável', () => {
    login(account);
    cy.contains('PC Cypress').should('be.visible');
    cy.task('demo:revoke');
    cy.contains('PC Cypress').should('not.exist');
    cy.location('pathname').should('eq', '/home');
  });
});
