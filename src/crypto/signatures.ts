/**
 * Ed25519 Digital Signatures
 * Signs canonical serialized payloads and verifies counterparty signatures
 */

import { ed25519 } from '@noble/curves/ed25519.js';
import { sha256 } from '@noble/hashes/sha2.js';
import { hexToBytes, bytesToHex, utf8ToBytes, canonicalStringify } from './utils';

/**
 * Sign any serializable object using Ed25519.
 * Computes SHA-256 of canonical JSON and signs the 32-byte digest.
 */
export function signCanonicalPayload(
  payload: unknown,
  privateKeyHex: string
): string {
  const canonicalJson = canonicalStringify(payload);
  const msgDigest = sha256(utf8ToBytes(canonicalJson));
  const privBytes = hexToBytes(privateKeyHex);
  const signatureBytes = ed25519.sign(msgDigest, privBytes);
  return bytesToHex(signatureBytes);
}

/**
 * Verifies that an Ed25519 signature is valid for a given canonical payload.
 */
export function verifyCanonicalPayload(
  payload: unknown,
  signatureHex: string,
  publicKeyHex: string
): boolean {
  try {
    const canonicalJson = canonicalStringify(payload);
    const msgDigest = sha256(utf8ToBytes(canonicalJson));
    const sigBytes = hexToBytes(signatureHex);
    const pubBytes = hexToBytes(publicKeyHex);
    return ed25519.verify(sigBytes, msgDigest, pubBytes);
  } catch {
    return false;
  }
}
