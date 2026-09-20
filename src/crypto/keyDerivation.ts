/**
 * HKDF-SHA256 Key Derivation (RFC 5869)
 * Derives application-specific AES-256-GCM session keys from raw X25519 shared secret
 */

import { hkdf } from '@noble/hashes/hkdf.js';
import { sha256 } from '@noble/hashes/sha2.js';
import { utf8ToBytes, bytesToHex } from './utils';

const PROTOCOL_INFO = utf8ToBytes('P2P-E2EE-AES256GCM-v1');

/**
 * Derives a 32-byte (256-bit) symmetric key using HKDF-SHA256
 */
export function deriveSessionKeyBytes(
  sharedSecret: Uint8Array,
  saltContext: string
): Uint8Array {
  const salt = sha256(utf8ToBytes(saltContext));
  const derived = hkdf(sha256, sharedSecret, salt, PROTOCOL_INFO, 32);
  return derived;
}

/**
 * Converts derived key bytes into a browser WebCrypto CryptoKey suitable for AES-GCM
 */
export async function importAesGcmKey(rawKeyBytes: Uint8Array): Promise<CryptoKey> {
  const cryptoObj = typeof window !== 'undefined' ? window.crypto : globalThis.crypto;
  if (!cryptoObj || !cryptoObj.subtle) {
    throw new Error('WebCrypto API is not available');
  }

  return await cryptoObj.subtle.importKey(
    'raw',
    rawKeyBytes as unknown as BufferSource,
    { name: 'AES-GCM', length: 256 },
    false, // non-extractable for maximum security
    ['encrypt', 'decrypt']
  );
}

/**
 * Derives and imports a WebCrypto AES-GCM session key in a single step
 */
export async function deriveWebCryptoSessionKey(
  sharedSecret: Uint8Array,
  saltContext: string
): Promise<{ cryptoKey: CryptoKey; rawKeyHex: string }> {
  const keyBytes = deriveSessionKeyBytes(sharedSecret, saltContext);
  const cryptoKey = await importAesGcmKey(keyBytes);
  return { cryptoKey, rawKeyHex: bytesToHex(keyBytes) };
}
