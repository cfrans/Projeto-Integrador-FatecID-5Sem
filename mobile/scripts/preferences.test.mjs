import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { test } from 'node:test';
import { deviceLanguage, translate, translations, localizeMessage } from '../src/features/i18n/translations.ts';
import { resolveTheme } from '../src/features/theme/preferences.ts';

const languages = ['pt-BR', 'en', 'es'];

test('detects device locales and falls back to English for unsupported languages', () => {
  for (const locale of ['pt', 'pt-BR', 'PT-PT']) assert.equal(deviceLanguage(locale), 'pt-BR');
  for (const locale of ['es', 'es-MX', 'ES-ES']) assert.equal(deviceLanguage(locale), 'es');
  for (const locale of ['', 'fr-FR', 'en-US', 'ptx']) assert.equal(deviceLanguage(locale), 'en');
});

test('all languages supply the same keys and interpolation variables', () => {
  const keys = Object.keys(translations['pt-BR']).sort();
  for (const language of languages) {
    assert.deepEqual(Object.keys(translations[language]).sort(), keys);
    for (const key of keys) {
      assert.ok(translations[language][key].trim(), `${language}: ${key}`);
      assert.deepEqual(
        (translations[language][key].match(/\{\w+\}/g) ?? []).sort(),
        (translations['pt-BR'][key].match(/\{\w+\}/g) ?? []).sort(),
        `${language}: ${key}`,
      );
    }
  }
});

test('static translation references in screens have a translation in every language', () => {
  function check(directory) {
    for (const entry of readdirSync(directory, { withFileTypes: true })) {
      const path = join(directory, entry.name);
      if (entry.isDirectory()) check(path);
      else if (path.endsWith('.tsx')) {
        for (const [, key] of readFileSync(path, 'utf8').matchAll(/\bt\(['"]([^'"]+)['"]/g)) {
          for (const language of languages) assert.ok(translations[language][key], `${path}: ${language}: ${key}`);
        }
      }
    }
  }
  check(fileURLToPath(new URL('../src', import.meta.url)));
});

test('changing the language translates labels, accessible actions and connection errors', () => {
  assert.equal(translate('en', 'common.back'), 'Back');
  assert.equal(translate('es', 'restriction.allowInstall', { name: 'Firefox' }), 'Permitir instalación de Firefox');
  assert.equal(localizeMessage('en', 'Sua sessão expirou. Entre novamente.'), 'Your session expired. Sign in again.');
  assert.match(localizeMessage('es', 'Não foi possível conectar à API em http://127.0.0.1:3000. Confira a rede e se o backend está iniciado.'), /^No se pudo conectar.*http:\/\/127\.0\.0\.1:3000/);
  assert.equal(localizeMessage('en', 'Custom server detail'), 'Custom server detail');
});

test('system theme follows appearance changes while explicit preferences override the system', () => {
  assert.equal(resolveTheme('system', 'light'), 'light');
  assert.equal(resolveTheme('system', 'dark'), 'dark');
  assert.equal(resolveTheme('system', null), 'dark');
  for (const appearance of ['dark', 'light', null]) {
    assert.equal(resolveTheme('light', appearance), 'light');
    assert.equal(resolveTheme('dark', appearance), 'dark');
  }
});
