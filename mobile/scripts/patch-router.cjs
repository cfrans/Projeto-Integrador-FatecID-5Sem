const fs = require('node:fs');
const path = require('node:path');

function patchCard(source) {
  if (!source.includes('InteractionManager') && !source.includes('onStartInteraction') && !source.includes('onEndInteraction')) return source;
  const patterns = [
    [/^    const interactionHandleRef = React\.useRef\(undefined\);\r?\n/m, 1],
    [/^    const onStartInteraction = \(0, useLatestCallback_1\.default\)\(\(\) => \{\r?\n[\s\S]*?^    \}\);\r?\n/m, 1],
    [/^    const onEndInteraction = \(0, useLatestCallback_1\.default\)\(\(\) => \{\r?\n[\s\S]*?^    \}\);\r?\n/m, 1],
    [/^\s*onStartInteraction\(\);\r?\n/gm, 2],
    [/^\s*onEndInteraction\(\);\r?\n/gm, 3],
  ];
  let result = source;
  for (const [pattern, count] of patterns) {
    if ([...result.matchAll(new RegExp(pattern.source, pattern.flags.includes('g') ? pattern.flags : `${pattern.flags}g`))].length !== count) throw new Error('Expo Router Card changed. Review the InteractionManager patch.');
    result = result.replace(pattern, (match) => match.replace(/[^\r\n]/g, ''));
  }
  if (/InteractionManager|interactionHandleRef|onStartInteraction|onEndInteraction/.test(result)) throw new Error('Incomplete Expo Router patch');
  return result;
}

function patchRouter() {
  const root = path.dirname(require.resolve('expo-router/package.json'));
  const version = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8')).version;
  if (version !== '57.0.24') throw new Error(`Review the InteractionManager patch for expo-router ${version}.`);
  const target = path.join(root, 'build/react-navigation/stack/views/Stack/Card.js');
  const source = fs.readFileSync(target, 'utf8');
  const patched = patchCard(source);
  if (source !== patched) fs.writeFileSync(target, patched);
}

module.exports = { patchCard, patchRouter };
if (require.main === module) patchRouter();
