import assert from 'node:assert/strict';
import { test } from 'node:test';
import { sha256Hex } from '../src/lib/sha256.ts';
import { createSecurityQuestionStore, normalizeAnswer } from '../src/features/auth/security-question-store.ts';

function memoryStorage() {
  const data = new Map();
  return {
    data,
    get: async (key) => data.get(key) ?? null,
    set: async (key, value) => { data.set(key, value); },
  };
}

function createStore(storage = memoryStorage()) {
  return createSecurityQuestionStore(storage, sha256Hex, () => 'salt');
}

test('sha256 matches known vectors', () => {
  assert.equal(sha256Hex(''), 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855');
  assert.equal(sha256Hex('abc'), 'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad');
  assert.equal(
    sha256Hex('abcdbcdecdefdefgefghfghighijhijkijkljklmklmnlmnomnopnopq'),
    '248d6a61d20638b8e5c026930c3e6039a33ce45964ff2167f6ecedd419db06c1',
  );
});

test('answers ignore case, accents and extra spaces', () => {
  assert.equal(normalizeAnswer('  Ração   do  GATO '), 'racao do gato');
});

test('verifies the saved answer and rejects others', async () => {
  const store = createStore();
  assert.equal(await store.save('Ana@Email.com', 'Qual o nome do seu pet?', 'Tobias'), true);
  assert.equal(await store.getQuestion('ana@email.com'), 'Qual o nome do seu pet?');
  assert.equal(await store.verify('ana@email.com', ' tobiás '), true);
  assert.equal(await store.verify('ana@email.com', 'Rex'), false);
  assert.equal(await store.verify('outra@email.com', 'Tobias'), false);
  assert.equal(await store.getQuestion('outra@email.com'), null);
});

test('does not store the answer in plain text and rejects short input', async () => {
  const storage = memoryStorage();
  const store = createStore(storage);
  assert.equal(await store.save('ana@email.com', 'curta', 'Tobias'), false);
  assert.equal(await store.save('ana@email.com', 'Qual o nome do seu pet?', ' '), false);
  assert.equal(storage.data.size, 0);
  await store.save('ana@email.com', 'Qual o nome do seu pet?', 'Tobias');
  assert.ok(![...storage.data.values()].some((value) => value.toLowerCase().includes('tobias')));
});

test('fails loudly when stored data is corrupted', async () => {
  const storage = memoryStorage();
  storage.data.set('piplup.security-questions', '[1]');
  await assert.rejects(createStore(storage).getQuestion('ana@email.com'));
});
