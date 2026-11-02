import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { test } from 'node:test';
import { createImageCache } from '../src/lib/image-cache.ts';

test('startup image loading shares pending requests and skips successful images on later calls', async () => {
  const calls = [];
  let finish;
  const waiting = new Promise((resolve) => { finish = resolve; });
  const preload = createImageCache(async (uri) => { calls.push(uri); await waiting; return true; });
  const first = preload(['photo', 'computer', 'photo']);
  const second = preload(['photo']);
  await Promise.resolve();
  assert.deepEqual(calls, ['photo', 'computer']);
  finish();
  await Promise.all([first, second]);
  await preload(['photo', 'computer']);
  assert.deepEqual(calls, ['photo', 'computer']);
});

test('one broken image does not block others and failed or false requests can be retried', async () => {
  const calls = [];
  let retry = false;
  const preload = createImageCache(async (uri) => {
    calls.push(uri);
    if (!retry && uri === 'broken') throw new Error('offline');
    return retry || uri !== 'missing';
  });
  await preload(['ready', 'broken', 'missing']);
  retry = true;
  await preload(['ready', 'broken', 'missing']);
  assert.deepEqual(calls, ['ready', 'broken', 'missing', 'broken', 'missing']);
});

test('the startup catalog contains every bundled app raster image', async () => {
  const root = fileURLToPath(new URL('..', import.meta.url));
  const catalog = await readFile(path.join(root, 'src/lib/image-assets.ts'), 'utf8');
  const registered = new Set([...catalog.matchAll(/require\('(\.\.[^']+)'\)/g)].map((match) => path.resolve(root, 'src/lib', match[1])));
  async function walk(directory) {
    for (const entry of await readdir(directory, { withFileTypes: true })) {
      const file = path.join(directory, entry.name);
      if (entry.isDirectory()) await walk(file);
      else if (/\.(png|jpe?g|webp)$/i.test(entry.name)) assert.ok(registered.has(file), `Missing startup image: ${file}`);
    }
  }
  await walk(path.join(root, 'assets'));
});
