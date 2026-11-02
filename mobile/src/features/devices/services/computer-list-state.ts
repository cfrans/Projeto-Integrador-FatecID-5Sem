import { ApiError } from '../../../lib/api.ts';
import type { PairedComputer } from './devices.ts';

export type ComputersState =
  | { status: 'loading' }
  | { status: 'error'; message: string }
  | { status: 'loaded'; computers: PairedComputer[]; refreshError?: string };

export function isTransientComputerFailure(error: unknown): boolean {
  return error instanceof ApiError && (error.kind === 'unavailable' || error.status === 429 || (error.status !== undefined && error.status >= 500));
}

export function beginComputerRefresh(previous: ComputersState): ComputersState {
  return previous.status === 'loaded' ? previous : { status: 'loading' };
}

export function computerListFailure(previous: ComputersState, error: unknown, preserve: boolean, message: string): ComputersState {
  return preserve && previous.status === 'loaded' && isTransientComputerFailure(error)
    ? { ...previous, refreshError: message }
    : { status: 'error', message };
}
