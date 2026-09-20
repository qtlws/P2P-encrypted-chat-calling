/**
 * X25519 Diffie-Hellman Key Agreement
 * Derives a raw 32-byte shared secret from private X25519 key and peer's public X25519 key
 */

import { x25519 } from '@noble/curves/ed25519.js';
import { hexToBytes, bytesToHex } from './utils';

/**
 * Computes the X25519 ECDH shared secret.
 * Returns raw 32 bytes Uint8Array.
 */
export function computeSharedSecret(
  privateKeyHex: string,
  peerPublicKeyHex: string
): Uint8Array {
  const privBytes = hexToBytes(privateKeyHex);
  const peerPubBytes = hexToBytes(peerPublicKeyHex);
  const sharedSecret = x25519.getSharedSecret(privBytes, peerPubBytes);
  return sharedSecret;
}

/**
 * Computes and returns shared secret as hex
 */
export function computeSharedSecretHex(
  privateKeyHex: string,
  peerPublicKeyHex: string
): string {
  const secret = computeSharedSecret(privateKeyHex, peerPublicKeyHex);
  return bytesToHex(secret);
}
