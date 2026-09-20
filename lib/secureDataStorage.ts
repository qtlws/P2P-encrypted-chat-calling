/**
 * Secure Data Storage Module
 * 
 * CRITICAL ARCHITECTURE RULE:
 * This module is the SINGLE entry and exit point for all persistent client-side
 * application data. No other component, hook, or utility directly touches
 * localStorage, sessionStorage, or IndexedDB.
 * 
 * Every record is encrypted using AES-256-GCM with a unique 12-byte IV before being
 * written to persistence.
 */

interface StorageEnvelope {
  format: 'p2p-secure-storage-v1';
  algorithm: 'AES-256-GCM';
  iv: string; // Base64 12-byte IV
  ciphertext: string; // Base64 ciphertext with auth tag
  updatedAt: number;
}

const DB_NAME = 'p2p_keystore_db';
const DB_VERSION = 1;
const KEY_STORE_NAME = 'master_keys';
const MASTER_KEY_ID = 'local_storage_master_key_v1';

class SecureDataStorageService {
  private masterKey: CryptoKey | null = null;
  private isInitialized = false;
  private initPromise: Promise<void> | null = null;

  /**
   * Initializes the storage engine and derives or loads the master storage encryption key.
   */
  private async initialize(): Promise<void> {
    if (this.isInitialized && this.masterKey) return;
    if (this.initPromise) return this.initPromise;

    this.initPromise = (async () => {
      const cryptoObj = typeof window !== 'undefined' ? window.crypto : globalThis.crypto;
      if (!cryptoObj || !cryptoObj.subtle) {
        throw new Error('WebCrypto is not supported in this runtime environment');
      }

      // Try loading existing Master Key from IndexedDB
      this.masterKey = await this.loadMasterKeyFromIndexedDb();

      if (!this.masterKey) {
        // Generate a new 256-bit AES-GCM master key
        this.masterKey = await cryptoObj.subtle.generateKey(
          { name: 'AES-GCM', length: 256 },
          true, // extractable so we can persist in keystore
          ['encrypt', 'decrypt']
        );
        await this.saveMasterKeyToIndexedDb(this.masterKey);
      }

      this.isInitialized = true;
    })();

    return this.initPromise;
  }

  /**
   * Loads master key from browser's isolated IndexedDB keystore
   */
  private async loadMasterKeyFromIndexedDb(): Promise<CryptoKey | null> {
    if (typeof window === 'undefined' || !window.indexedDB) return null;

    return new Promise((resolve) => {
      try {
        const req = window.indexedDB.open(DB_NAME, DB_VERSION);
        req.onupgradeneeded = () => {
          const db = req.result;
          if (!db.objectStoreNames.contains(KEY_STORE_NAME)) {
            db.createObjectStore(KEY_STORE_NAME, { keyPath: 'id' });
          }
        };
        req.onsuccess = () => {
          const db = req.result;
          const tx = db.transaction(KEY_STORE_NAME, 'readonly');
          const store = tx.objectStore(KEY_STORE_NAME);
          const getReq = store.get(MASTER_KEY_ID);
          getReq.onsuccess = () => {
            if (getReq.result && getReq.result.key) {
              resolve(getReq.result.key as CryptoKey);
            } else {
              resolve(null);
            }
          };
          getReq.onerror = () => resolve(null);
        };
        req.onerror = () => resolve(null);
      } catch {
        resolve(null);
      }
    });
  }

  /**
   * Persists master key in browser's isolated IndexedDB keystore
   */
  private async saveMasterKeyToIndexedDb(key: CryptoKey): Promise<void> {
    if (typeof window === 'undefined' || !window.indexedDB) return;

    return new Promise((resolve) => {
      try {
        const req = window.indexedDB.open(DB_NAME, DB_VERSION);
        req.onupgradeneeded = () => {
          const db = req.result;
          if (!db.objectStoreNames.contains(KEY_STORE_NAME)) {
            db.createObjectStore(KEY_STORE_NAME, { keyPath: 'id' });
          }
        };
        req.onsuccess = () => {
          const db = req.result;
          const tx = db.transaction(KEY_STORE_NAME, 'readwrite');
          const store = tx.objectStore(KEY_STORE_NAME);
          store.put({ id: MASTER_KEY_ID, key });
          tx.oncomplete = () => resolve();
          tx.onerror = () => resolve();
        };
        req.onerror = () => resolve();
      } catch {
        resolve();
      }
    });
  }

  /**
   * Retrieve and decrypt a stored record by key.
   */
  public async get<T>(key: string): Promise<T | null> {
    if (typeof window === 'undefined') return null;
    await this.initialize();
    if (!this.masterKey) throw new Error('Storage encryption key uninitialized');

    const rawCiphertextEnvelope = window.localStorage.getItem(key);
    if (!rawCiphertextEnvelope) return null;

    try {
      const envelope = JSON.parse(rawCiphertextEnvelope) as StorageEnvelope;
      if (envelope.format !== 'p2p-secure-storage-v1' || !envelope.iv || !envelope.ciphertext) {
        // Unknown or corrupted format
        return null;
      }

      // Convert Base64 back to Uint8Array
      const iv = this.base64ToBytes(envelope.iv);
      const ciphertext = this.base64ToBytes(envelope.ciphertext);

      const cryptoObj = window.crypto;
      const decryptedBuf = await cryptoObj.subtle.decrypt(
        {
          name: 'AES-GCM',
          iv: iv as unknown as BufferSource,
          additionalData: new TextEncoder().encode(key) as unknown as BufferSource,
        },
        this.masterKey,
        ciphertext as unknown as BufferSource
      );

      const plaintext = new TextDecoder().decode(decryptedBuf);
      return JSON.parse(plaintext) as T;
    } catch (err) {
      console.warn(`[secureDataStorage] Decryption failed for key "${key}":`, err);
      return null;
    }
  }

  /**
   * Encrypt and persist a record by key.
   */
  public async set<T>(key: string, value: T): Promise<void> {
    if (typeof window === 'undefined') return;
    await this.initialize();
    if (!this.masterKey) throw new Error('Storage encryption key uninitialized');

    const serialized = JSON.stringify(value);
    const plaintextBytes = new TextEncoder().encode(serialized);

    // Generate unique 12-byte IV for every write
    const iv = new Uint8Array(12);
    window.crypto.getRandomValues(iv);

    const cryptoObj = window.crypto;
    const ciphertextBuf = await cryptoObj.subtle.encrypt(
      {
        name: 'AES-GCM',
        iv: iv as unknown as BufferSource,
        additionalData: new TextEncoder().encode(key) as unknown as BufferSource,
      },
      this.masterKey,
      plaintextBytes as unknown as BufferSource
    );

    const envelope: StorageEnvelope = {
      format: 'p2p-secure-storage-v1',
      algorithm: 'AES-256-GCM',
      iv: this.bytesToBase64(iv),
      ciphertext: this.bytesToBase64(new Uint8Array(ciphertextBuf)),
      updatedAt: Date.now(),
    };

    window.localStorage.setItem(key, JSON.stringify(envelope));
  }

  /**
   * Removes a record from persistent storage.
   */
  public async remove(key: string): Promise<void> {
    if (typeof window === 'undefined') return;
    window.localStorage.removeItem(key);
  }

  /**
   * Checks whether a record exists in storage.
   */
  public async has(key: string): Promise<boolean> {
    if (typeof window === 'undefined') return false;
    return window.localStorage.getItem(key) !== null;
  }

  /**
   * Clears all application storage keys.
   */
  public async clear(): Promise<void> {
    if (typeof window === 'undefined') return;
    const keysToRemove: string[] = [];
    for (let i = 0; i < window.localStorage.length; i++) {
      const k = window.localStorage.key(i);
      if (k && k.startsWith('app:')) {
        keysToRemove.push(k);
      }
    }
    for (const k of keysToRemove) {
      window.localStorage.removeItem(k);
    }
  }

  private bytesToBase64(bytes: Uint8Array): string {
    let binary = '';
    for (let i = 0; i < bytes.byteLength; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    return btoa(binary);
  }

  private base64ToBytes(base64: string): Uint8Array {
    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i);
    }
    return bytes;
  }
}

export const secureDataStorage = new SecureDataStorageService();
export default secureDataStorage;
