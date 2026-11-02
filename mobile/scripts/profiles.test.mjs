import assert from 'node:assert/strict';
import { test } from 'node:test';
import { addProfile, deleteProfile, loadProfiles, MAX_PROFILES, parseProfile, profileSettings } from '../src/features/restrictions/services/profiles.ts';
import { translations, translate } from '../src/features/i18n/translations.ts';

const settings = {
  blockBrowsers: true, allowedBrowsers: { firefox: true, chromium: false, brave: false, 'gnome-web': true },
  blockInstallation: true, ageRating: '12', applicationRules: { 'pc-specific': false }, installationDecisions: { 'old-request': 'APPROVED' },
};
const profile = { id: 'study', name: 'Estudos', settings };

function memoryStorage() {
  const values = new Map();
  return { values, async get(key) { return values.get(key) ?? null; }, async set(key, value) { values.set(key, value); } };
}

test('profiles copy portable settings and never copy device rules, requests or browser keys outside the contract', () => {
  const parsed = parseProfile({ ...profile, settings: { ...settings, allowedBrowsers: { ...settings.allowedBrowsers, unsafe: true } } });
  assert.deepEqual(parsed.settings, {
    blockBrowsers: true, allowedBrowsers: { firefox: true, chromium: false, brave: false, 'gnome-web': true }, blockInstallation: true, ageRating: '12',
  });
  parsed.settings.allowedBrowsers.firefox = false;
  assert.equal(settings.allowedBrowsers.firefox, true);
  const target = { ...settings, applicationRules: { target: true }, installationDecisions: { request: 'DENIED' } };
  const applied = { ...target, ...profileSettings(parsed.settings) };
  assert.deepEqual(applied.applicationRules, target.applicationRules);
  assert.deepEqual(applied.installationDecisions, target.installationDecisions);
});

test('profiles persist across reloads, remain isolated by guardian, and deletion does not touch another guardian', async () => {
  const storage = memoryStorage();
  assert.deepEqual(await loadProfiles(storage, 'guardian-a'), []);
  await addProfile(storage, 'guardian-a', profile);
  assert.deepEqual(await loadProfiles(storage, 'guardian-a'), [parseProfile(profile)]);
  assert.deepEqual(await loadProfiles(storage, 'guardian-b'), []);
  await addProfile(storage, 'guardian-b', { ...profile, name: 'Outro' });
  assert.deepEqual(await deleteProfile(storage, 'guardian-a', profile.id), []);
  assert.deepEqual(await loadProfiles(storage, 'guardian-a'), []);
  assert.equal((await loadProfiles(storage, 'guardian-b'))[0].name, 'Outro');
});

test('malformed profiles, missing records and damaged indexes are rejected without overwriting data', async () => {
  for (const value of [null, {}, { ...profile, id: '../unsafe' }, { ...profile, name: ' ' }, { ...profile, name: 'a'.repeat(41) },
    { ...profile, settings: { ...settings, allowedBrowsers: {} } }, { ...profile, settings: { ...settings, ageRating: '8' } },
    { ...profile, settings: { ...settings, blockInstallation: 'yes' } }]) assert.throws(() => parseProfile(value));
  for (const invalid of ['not-json', '{}', '["study","study"]', '["missing"]']) {
    const storage = memoryStorage();
    storage.values.set('piplup.profiles.v1.guardian', invalid);
    await assert.rejects(loadProfiles(storage, 'guardian'));
    await assert.rejects(addProfile(storage, 'guardian', profile));
    assert.equal(storage.values.get('piplup.profiles.v1.guardian'), invalid);
  }
});

test('failed profile writes never report success or replace the previously committed list', async () => {
  for (const failIndex of [false, true]) {
    const storage = memoryStorage();
    await addProfile(storage, 'guardian', profile);
    const failing = { get: storage.get, async set(key, value) {
      if (failIndex ? key === 'piplup.profiles.v1.guardian' : key.endsWith('.second')) throw new Error('storage full');
      await storage.set(key, value);
    } };
    await assert.rejects(addProfile(failing, 'guardian', { ...profile, id: 'second', name: 'Outro' }));
    assert.deepEqual(await loadProfiles(storage, 'guardian'), [parseProfile(profile)]);
    if (failIndex) {
      await assert.rejects(deleteProfile(failing, 'guardian', 'study'));
      assert.equal((await loadProfiles(storage, 'guardian')).length, 1);
    }
  }
  await assert.rejects(loadProfiles({ async get() { throw new Error('unavailable'); }, async set() {} }, 'guardian'));
});

test('profiles reject duplicate names and IDs, enforce a bounded index, and keep native storage entries small', async () => {
  const storage = memoryStorage();
  await addProfile(storage, 'guardian', profile);
  await assert.rejects(addProfile(storage, 'guardian', { ...profile, id: 'other', name: ' estudos ' }));
  await assert.rejects(addProfile(storage, 'guardian', { ...profile, name: 'Other' }));
  for (let i = 1; i < MAX_PROFILES; i++) await addProfile(storage, 'guardian', { ...profile, id: `profile-${i}`, name: `Perfil ${i}` });
  await assert.rejects(addProfile(storage, 'guardian', { ...profile, id: 'full', name: 'Full' }));
  for (const value of storage.values.values()) assert.ok(Buffer.byteLength(value) < 2048);
});

test('profile and synchronization copy exists in all supported languages', () => {
  const keys = Object.keys(translations['pt-BR']).filter((key) => key.startsWith('profiles.') || key.startsWith('sync.'));
  for (const language of ['pt-BR', 'en', 'es']) for (const key of keys) assert.notEqual(translate(language, key), key);
});

test('overlapping profile mutations cannot overwrite a concurrently committed list', async () => {
  const storage = memoryStorage();
  const results = await Promise.allSettled([
    addProfile(storage, 'guardian-concurrent', profile),
    addProfile(storage, 'guardian-concurrent', { ...profile, id: 'second', name: 'Other' }),
  ]);
  assert.equal(results.filter((result) => result.status === 'fulfilled').length, 1);
  assert.equal((await loadProfiles(storage, 'guardian-concurrent')).length, 1);
  await addProfile(storage, 'guardian-concurrent', { ...profile, id: 'second', name: 'Other' });
  assert.equal((await loadProfiles(storage, 'guardian-concurrent')).length, 2);
});
