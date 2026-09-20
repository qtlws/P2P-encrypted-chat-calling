/**
 * AES-256-GCM Authenticated Symmetric Encryption
 * Enforces unique 12-byte IVs, Additional Authenticated Data (AAD), and Envelope structure
 */

import { bytesToBase64, base64ToBytes, utf8ToBytes, bytesToUtf8, getRandomBytes, canonicalStringify } from './utils';
import { EncryptedEnvelope } from './types';

/**
 * Encrypts a plaintext string with AES-256-GCM using WebCrypto.
 * @param plaintext The secret message or JSON string to encrypt
 * @param key CryptoKey (AES-GCM 256)
 * @param associatedData Optional metadata object to cryptographically bind to ciphertext (AAD)
 */
export async function encryptAesGcm(
  plaintext: string,
  key: CryptoKey,
  associatedData?: unknown
): Promise<{ ciphertext: string; iv: string }> {
  const cryptoObj = typeof window !== 'undefined' ? window.crypto : globalThis.crypto;
  if (!cryptoObj || !cryptoObj.subtle) {
    throw new Error('WebCrypto API is not available');
  }

  // 12 bytes (96 bits) IV is the NIST-recommended standard for AES-GCM
  const iv = getRandomBytes(12);
  const encodedPlaintext = utf8ToBytes(plaintext);

  const algorithmParams: AesGcmParams = {
    name: 'AES-GCM',
    iv: iv as unknown as BufferSource,
    tagLength: 128, // 128-bit authentication tag
  };

  if (associatedData !== undefined) {
    algorithmParams.additionalData = utf8ToBytes(canonicalStringify(associatedData)) as unknown as BufferSource;
  }

  const ciphertextBuffer = await cryptoObj.subtle.encrypt(
    algorithmParams,
    key,
    encodedPlaintext as unknown as BufferSource
  );

  return {
    ciphertext: bytesToBase64(new Uint8Array(ciphertextBuffer)),
    iv: bytesToBase64(iv),
  };
}

/**
 * Decrypts an AES-256-GCM ciphertext using WebCrypto.
 * Automatically verifies the 128-bit authentication tag and optional associated data.
 * Throws an error if ciphertext or associated data has been tampered with.
 */
export async function decryptAesGcm(
  ciphertextBase64: string,
  ivBase64: string,
  key: CryptoKey,
  associatedData?: unknown
): Promise<string> {
  const cryptoObj = typeof window !== 'undefined' ? window.crypto : globalThis.crypto;
  if (!cryptoObj || !cryptoObj.subtle) {
    throw new Error('WebCrypto API is not available');
  }

  const iv = base64ToBytes(ivBase64);
  const ciphertextBytes = base64ToBytes(ciphertextBase64);

  const algorithmParams: AesGcmParams = {
    name: 'AES-GCM',
    iv: iv as unknown as BufferSource,
    tagLength: 128,
  };

  if (associatedData !== undefined) {
    algorithmParams.additionalData = utf8ToBytes(canonicalStringify(associatedData)) as unknown as BufferSource;
  }

  const decryptedBuffer = await cryptoObj.subtle.decrypt(
    algorithmParams,
    key,
    ciphertextBytes as unknown as BufferSource
  );

  return bytesToUtf8(new Uint8Array(decryptedBuffer));
}

/**
 * Creates an EncryptedEnvelope
 */
export async function createEncryptedEnvelope(
  plaintext: string,
  key: CryptoKey,
  keyId: string,
  associatedData?: unknown
): Promise<EncryptedEnvelope> {
  const { ciphertext, iv } = await encryptAesGcm(plaintext, key, associatedData);
  return {
    algorithm: 'AES-256-GCM',
    ciphertext,
    iv,
    keyId,
    createdAt: Date.now(),
  };
}

/**
 * Decrypts an EncryptedEnvelope
 */
export async function decryptEncryptedEnvelope(
  envelope: EncryptedEnvelope,
  key: CryptoKey,
  associatedData?: unknown
): Promise<string> {
  return await decryptAesGcm(envelope.ciphertext, envelope.iv, key, associatedData);
}

/**
 * Password-Based Key Derivation (PBKDF2) for secure Identity Backup/Export
 */
export async function deriveKeyFromPassword(
  passphrase: string,
  salt: Uint8Array
): Promise<CryptoKey> {
  const cryptoObj = typeof window !== 'undefined' ? window.crypto : globalThis.crypto;
  const pwBytes = utf8ToBytes(passphrase);

  const baseKey = await cryptoObj.subtle.importKey(
    'raw',
    pwBytes as unknown as BufferSource,
    { name: 'PBKDF2' },
    false,
    ['deriveKey']
  );

  return await cryptoObj.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt: salt as unknown as BufferSource,
      iterations: 100000,
      hash: 'SHA-256',
    },
    baseKey,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt']
  );
}

/**
 * Exports data encrypted with a user-provided passphrase
 */
export async function exportEncryptedBackup(
  data: unknown,
  passphrase: string
): Promise<string> {
  const salt = getRandomBytes(16);
  const key = await deriveKeyFromPassword(passphrase, salt);
  const jsonStr = JSON.stringify(data);
  const { ciphertext, iv } = await encryptAesGcm(jsonStr, key);

  const backupPackage = {
    version: 1,
    format: 'p2p-encrypted-backup-v1',
    salt: bytesToBase64(salt),
    iv,
    ciphertext,
    createdAt: Date.now(),
  };

  return JSON.stringify(backupPackage, null, 2);
}

/**
 * Imports and decrypts a backup with the passphrase
 */
export async function importEncryptedBackup<T>(
  backupJson: string,
  passphrase: string
): Promise<T> {
  const parsed = JSON.parse(backupJson);
  if (!parsed.salt || !parsed.iv || !parsed.ciphertext) {
    throw new Error('Invalid backup file format');
  }

  const salt = base64ToBytes(parsed.salt);
  const key = await deriveKeyFromPassword(passphrase, salt);
  const decryptedJson = await decryptAesGcm(parsed.ciphertext, parsed.iv, key);
  return JSON.parse(decryptedJson) as T;
}
