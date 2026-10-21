import assert from 'node:assert/strict';
import { test } from 'node:test';
import { selectRestrictionComputer } from '../src/features/restrictions/services/device-selection.ts';

const first = { id: 'first', isPaired: true };
const second = { id: 'second', isPaired: true };
const legacy = { id: 'legacy', isPaired: false };

test('restricts selection to active links and requires a choice for multiple computers', () => {
  assert.equal(selectRestrictionComputer([], null), null);
  assert.equal(selectRestrictionComputer([legacy], null), null);
  assert.equal(selectRestrictionComputer([legacy, first], null), first);
  assert.equal(selectRestrictionComputer([first, second], null), null);
  assert.equal(selectRestrictionComputer([first, second], 'second'), second);
});

test('never substitutes another computer for a missing, revoked or invalid selection', () => {
  for (const id of ['missing', 'legacy', '']) {
    assert.equal(selectRestrictionComputer([first, legacy], id), null);
  }
  assert.equal(selectRestrictionComputer([second], 'first'), null);
});
