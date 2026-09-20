/**
 * User Cryptographic Identity Generation & Management
 * Ed25519 Identity Keypair + X25519 Key Agreement Keypair + Secure Random UID
 */

import { ed25519, x25519 } from '@noble/curves/ed25519.js';
import { UserIdentity } from './types';
import { bytesToHex, getRandomBytes } from './utils';
import { generateFingerprint } from './fingerprints';

/**
 * Generate a cryptographically unpredictable UID using secure entropy.
 * Format: u_ followed by 32 hex chars (128 bits entropy).
 */
export function generateSecureUID(): string {
  const randomBytes = getRandomBytes(16);
  return `u_${bytesToHex(randomBytes)}`;
}

/**
 * Generates a brand new UserIdentity:
 * - Cryptographically random UID
 * - Ed25519 Signing & Identity keypair
 * - X25519 Encryption keypair
 * - Formatted SHA-256 fingerprint
 */
export function createIdentity(): UserIdentity {
  // 1. UID
  const uid = generateSecureUID();

  // 2. Ed25519 Keypair for identity & signing
  const idKeys = ed25519.keygen();
  const identityPrivateKey = bytesToHex(idKeys.secretKey);
  const identityPublicKey = bytesToHex(idKeys.publicKey);

  // 3. X25519 Keypair for Diffie-Hellman key agreement
  const encKeys = x25519.keygen();
  const encryptionPrivateKey = bytesToHex(encKeys.secretKey);
  const encryptionPublicKey = bytesToHex(encKeys.publicKey);

  // 4. Fingerprint
  const fingerprint = generateFingerprint(identityPublicKey);

  return {
    uid,
    identityPublicKey,
    identityPrivateKey,
    encryptionPublicKey,
    encryptionPrivateKey,
    fingerprint,
    createdAt: Date.now(),
  };
}

/**
 * Rotate encryption keypair while keeping UID and identity keypair intact
 */
export function rotateEncryptionKey(identity: UserIdentity): UserIdentity {
  const encKeys = x25519.keygen();
  return {
    ...identity,
    encryptionPublicKey: bytesToHex(encKeys.publicKey),
    encryptionPrivateKey: bytesToHex(encKeys.secretKey),
  };
}
