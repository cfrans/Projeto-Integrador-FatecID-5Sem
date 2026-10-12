import { api } from '@/lib/api';
import { createPairingSource } from './pairing';

export const pairing = createPairingSource((path, options) => api.request<unknown>(path, options));
