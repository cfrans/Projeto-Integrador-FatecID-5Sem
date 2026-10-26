import assert from 'node:assert/strict';
import { test } from 'node:test';
import { findApplicationBrand } from '../src/features/restrictions/services/application-brand.ts';
import { computerIconsStorageKey, isComputerIcon, parseComputerIcons } from '../src/features/devices/services/computer-icons.ts';

test('identifies display names and Linux application IDs without loose substring matches', () => {
  for (const [name, expected] of [[' Firefox ESR ', 'firefox'], ['ORG.MOZILLA.FIREFOX', 'firefox'], ['org.libreoffice.LibreOffice', 'libreoffice'], ['LibreOffice Writer', 'libreoffice'], ['VISUAL STUDIO CODE', 'vscode'], ['VS-Code', 'vscode'], ['org.gimp.GIMP', 'gimp'], ['Telegram Desktop', 'telegram'], ['com.valvesoftware.Steam', 'steam'], ['Microsoft Edge', 'edge']]) assert.equal(findApplicationBrand(name), expected);
  for (const name of ['', 'Aplicativo da escola', 'Firefox updater unknown', 'Steam clone']) assert.equal(findApplicationBrand(name), null);
});

test('restores computer icon preferences and ignores malformed or retired entries', () => {
  const first = '0a38ce2d-9654-41f1-8098-944e0874752c';
  const second = 'c421635b-caa6-48b8-8b10-08c2144e0993';
  assert.deepEqual(parseComputerIcons(JSON.stringify({ [first]: 'laptop', [second]: 'gaming' })), { [first]: 'laptop', [second]: 'gaming' });
  assert.deepEqual(parseComputerIcons(JSON.stringify({ [first]: 'future-icon', [second]: 'server', invalid: 'desktop' })), { [second]: 'server' });
  for (const raw of [null, '', 'not json', 'null', '[]', '42', '{"__proto__":"desktop"}']) assert.deepEqual(parseComputerIcons(raw), {});
  assert.equal(isComputerIcon('desktop'), true);
  assert.equal(isComputerIcon('../arbitrary-file'), false);
});

test('keeps appearance preferences separate for each guardian', () => {
  assert.notEqual(computerIconsStorageKey('guardian-one'), computerIconsStorageKey('guardian-two'));
  assert.equal(computerIconsStorageKey('guardian-one'), computerIconsStorageKey('guardian-one'));
});
