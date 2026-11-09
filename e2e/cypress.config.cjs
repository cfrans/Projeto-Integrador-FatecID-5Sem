const { defineConfig } = require('cypress');

module.exports = defineConfig({
  video: false,
  viewportWidth: 430,
  viewportHeight: 932,
  defaultCommandTimeout: 12000,
  reporter: 'junit',
  reporterOptions: { mochaFile: 'results/mvp-[hash].xml', toConsole: true },
  e2e: {
    specPattern: 'cypress/e2e/**/*.cy.js',
    supportFile: false,
    async setupNodeEvents(on, config) {
      const { createTasks } = await import('./tasks.mjs');
      const tasks = await createTasks();
      on('task', tasks);
      on('after:run', () => tasks['demo:cleanup']());
      return config;
    },
  },
});
