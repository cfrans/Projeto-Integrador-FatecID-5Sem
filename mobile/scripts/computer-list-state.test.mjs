import assert from 'node:assert/strict';
import { test } from 'node:test';
import { ApiError } from '../src/lib/api.ts';
import { beginComputerRefresh, computerListFailure } from '../src/features/devices/services/computer-list-state.ts';

const loaded = { status: 'loaded', computers: [{ id: 'cached-device' }] };

test('refocusing Home keeps mounted computer cards and content height while refreshing', () => {
  assert.equal(beginComputerRefresh(loaded), loaded);
  assert.deepEqual(beginComputerRefresh({ status: 'loading' }), { status: 'loading' });
  assert.deepEqual(beginComputerRefresh({ status: 'error', message: 'offline' }), { status: 'loading' });
});

test('keeps the last list only for transient background or manual refresh failures', () => {
  for (const error of [new ApiError('unavailable', 'offline'), new ApiError('server', 'busy', 503), new ApiError('server', 'limited', 429)]) {
    assert.deepEqual(computerListFailure(loaded, error, true, 'try again'), { ...loaded, refreshError: 'try again' });
    assert.equal(loaded.refreshError, undefined);
  }
});

test('clears cached devices after authorization or malformed-response failures', () => {
  for (const error of [new ApiError('unauthorized', 'expired', 401), new ApiError('server', 'forbidden', 403), new ApiError('server', 'missing', 404), new Error('invalid contract')]) {
    assert.deepEqual(computerListFailure(loaded, error, true, 'unavailable'), { status: 'error', message: 'unavailable' });
  }
});

test('initial and post-removal failures never restore old devices', () => {
  const error = new ApiError('unavailable', 'offline');
  assert.deepEqual(computerListFailure({ status: 'loading' }, error, true, 'offline'), { status: 'error', message: 'offline' });
  assert.deepEqual(computerListFailure(loaded, error, false, 'offline'), { status: 'error', message: 'offline' });
});

test('preserves a confirmed empty list when refresh is temporarily unavailable', () => {
  assert.deepEqual(computerListFailure({ status: 'loaded', computers: [] }, new ApiError('unavailable', 'offline'), true, 'offline'), { status: 'loaded', computers: [], refreshError: 'offline' });
});
