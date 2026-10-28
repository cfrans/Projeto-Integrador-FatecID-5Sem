import { ApiError } from '../../../lib/api.ts';
import type { PairedComputer } from './devices.ts';

export type ComputersState =
  | { status: 'loading' }
  | { status: 'error'; message: string }
  | { status: 'loaded'; computers: PairedComputer[]; refreshError?: string };

export function computerListFailure(previous: ComputersState, error: unknown, preserve: boolean, message: string): ComputersState {
  const transient = error instanceof ApiError && (error.kind === 'unavailable' || error.status === 429 || (error.status !== undefined && error.status >= 500));
  return preserve && previous.status === 'loaded' && transient
    ? { ...previous, refreshError: message }
    : { status: 'error', message };
}
