import '../config/load-env.js';

export const JWT_ISSUER = 'piplup-api';
export const JWT_AUDIENCE = 'piplup-mobile';
export const JWT_EXPIRES_IN_SECONDS = 1800;

export function getJwtSecret(): string {
  const secret = process.env.JWT_SECRET;

  if (!secret || Buffer.byteLength(secret, 'utf8') < 32) {
    throw new Error('JWT_SECRET é obrigatório e deve conter pelo menos 32 bytes.');
  }

  return secret;
}
