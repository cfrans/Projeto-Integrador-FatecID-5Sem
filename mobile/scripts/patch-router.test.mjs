import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import path from 'node:path';
import { test } from 'node:test';
import { patchCard } from './patch-router.cjs';

const original = `    const interactionHandleRef = React.useRef(undefined);
    const onStartInteraction = (0, useLatestCallback_1.default)(() => {
        if (interactionHandleRef.current === undefined) {
            interactionHandleRef.current = react_native_1.InteractionManager.createInteractionHandle();
        }
    });
    const onEndInteraction = (0, useLatestCallback_1.default)(() => {
        if (interactionHandleRef.current !== undefined) {
            react_native_1.InteractionManager.clearInteractionHandle(interactionHandleRef.current);
            interactionHandleRef.current = undefined;
        }
    });
    onStartInteraction();
    animation.start(onFinish);
    onEndInteraction();
    onStartInteraction();
    onGestureBegin();
    onEndInteraction();
    onEndInteraction();
    onClose();
`;

test('router compatibility patch removes only obsolete handles and preserves animation and callback code', () => {
  const patched = patchCard(original);
  assert.doesNotMatch(patched, /InteractionManager|interactionHandleRef|onStartInteraction|onEndInteraction/);
  for (const callback of ['animation.start(onFinish);', 'onGestureBegin();', 'onClose();']) assert.ok(patched.includes(callback));
  assert.equal(patched.split('\n').length, original.split('\n').length);
  assert.equal(patchCard(patched), patched);
  assert.throws(() => patchCard(original.replace('    onStartInteraction();\n', '')));
});

test('the installed Router Card no longer accesses the deprecated API', async () => {
  const require = createRequire(import.meta.url);
  const root = path.dirname(require.resolve('expo-router/package.json'));
  const card = await readFile(path.join(root, 'build/react-navigation/stack/views/Stack/Card.js'), 'utf8');
  assert.doesNotMatch(card, /InteractionManager|onStartInteraction|onEndInteraction/);
  assert.match(card, /useNativeDriver/);
  assert.match(card, /onGestureBegin/);
});
