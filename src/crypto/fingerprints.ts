/**
 * Cryptographic Fingerprint Generation
 * SHA-256 hash formatted into human-readable visual verification blocks
 */

import { sha256 } from '@noble/hashes/sha2.js';
import { hexToBytes, bytesToHex, utf8ToBytes } from './utils';

/**
 * Generate a formatted cryptographic fingerprint from a hex public key or string.
 * Example format: "AB4F-82D1-19C4-77A2-58E3-91B0-C4D2-E8A1"
 */
export function generateFingerprint(publicKeyHex: string): string {
  try {
    const rawBytes = publicKeyHex.length % 2 === 0
      ? hexToBytes(publicKeyHex)
      : utf8ToBytes(publicKeyHex);
    const hash = sha256(rawBytes);
    const hex = bytesToHex(hash).toUpperCase();
    
    // Group into 4-character blocks (8 blocks = 32 hex chars / 16 bytes displayed)
    const blocks: string[] = [];
    for (let i = 0; i < 32; i += 4) {
      blocks.push(hex.slice(i, i + 4));
    }
    return blocks.join('-');
  } catch {
    // Fallback for non-hex input
    const hash = sha256(utf8ToBytes(publicKeyHex));
    const hex = bytesToHex(hash).toUpperCase();
    const blocks: string[] = [];
    for (let i = 0; i < 32; i += 4) {
      blocks.push(hex.slice(i, i + 4));
    }
    return blocks.join('-');
  }
}

/**
 * Deterministically derives a unique conversationId from two peer UIDs
 */
export function deriveConversationId(uidA: string, uidB: string): string {
  const canonical = [uidA, uidB].sort().join('::');
  const hash = sha256(utf8ToBytes(canonical));
  return bytesToHex(hash);
}
