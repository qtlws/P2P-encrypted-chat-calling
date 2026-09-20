# Cryptographic Security Specification

## 1. Cryptographic Algorithms

The application adheres strictly to modern, audited cryptographic algorithms:

* **Identity & Signatures**: **Ed25519** (Edwards-curve Digital Signature Algorithm over Curve25519) via `@noble/curves/ed25519`.
* **Key Agreement**: **X25519** (Montgomery curve Diffie-Hellman over Curve25519) via `@noble/curves/ed25519`.
* **Key Derivation**: **HKDF-SHA256** (RFC 5869) via `@noble/hashes/hkdf` and browser `crypto.subtle`.
* **Symmetric Authenticated Encryption**: **AES-256-GCM** via Web Crypto API (`window.crypto.subtle`), enforcing a unique 12-byte (96-bit) cryptographically random IV for every single encryption operation.
* **Cryptographic Hashes & Fingerprints**: **SHA-256** via `@noble/hashes/sha256`.
* **Random Number Generation**: `crypto.getRandomValues()` exclusively. Never `Math.random()`.

---

## 2. Key Lifecycle & Storage

1. **Identity Generation**:
   * On initial launch, if no identity exists in `secureDataStorage`, the client creates:
     * A random UID: `u_` followed by 32 hex characters (128 bits of entropy from `crypto.getRandomValues()`).
     * Ed25519 Signing Keypair (32-byte private scalar, 32-byte public key).
     * X25519 Encryption Keypair (32-byte private key, 32-byte public key).
2. **Local Storage Encryption**:
   * A 256-bit AES-GCM Master Storage Key is generated on initialization and stored in browser-managed secure storage.
   * All persistent values (`app:identity`, `app:peers`, `app:conversations`, `app:messages:<id>`) are encrypted with AES-256-GCM before writing to storage.
   * Plaintext message history and raw private keys are NEVER written in plaintext to browser storage.
3. **Private Key Isolation**:
   * Private keys (`identityPrivateKey`, `encryptionPrivateKey`, `masterStorageKey`) never leave the user's browser runtime.
   * They are never transmitted over signaling, WebRTC, or exported without an explicit user-provided backup password.

---

## 3. Handshake & Mutual Authentication

To prevent Man-in-the-Middle (MITM) attacks and identity spoofing:
1. Every peer exchange includes a signed handshake payload:
   * `senderUid`
   * `identityPublicKey`
   * `encryptionPublicKey`
   * `nonce` (16 bytes random)
   * `timestamp`
   * `signature`: Ed25519 signature over canonical payload `canonicalSerialize(uid, pubId, pubEnc, nonce, timestamp)`.
2. The recipient:
   * Verifies the Ed25519 signature using the received `identityPublicKey`.
   * Checks the peer against locally stored known peers in `secureDataStorage`:
     * If previously seen and the public key differs: **TRIGGERS A HARD SECURITY WARNING** ("Public key for this peer has changed. Do not automatically trust this peer.").
     * If new: prompts user to inspect the cryptographic fingerprint before marking verified.

---

## 4. Message Security & Envelope Model

Every message is protected by three cryptographic layers:
1. **Authenticated Encryption (AES-256-GCM)**:
   * Derived from X25519 ECDH shared secret + HKDF-SHA256 with session context.
   * Fresh 12-byte IV per message.
   * Authenticated Associated Data (AAD) binds message metadata (ID, conversationId, timestamps, protocol version).
2. **Ed25519 Signature**:
   * Sender signs canonical representation of `{ id, conversationId, senderUid, recipientUid, timestamp, ciphertext, iv, protocolVersion }`.
   * Recipient validates the signature before accepting or decrypting.
3. **Dual Storage Envelopes**:
   * **Recipient Envelope**: Ciphertext encrypted with the shared session key for peer transport.
   * **Sender Envelope**: Ciphertext encrypted with the user's local master storage key so the sender can review their own sent history offline without relying on the peer's private key.

---

## 5. WebRTC Transport Security

* WebRTC DataChannel and MediaStream connections use standard DTLS 1.3 / SRTP for peer-to-peer transport encryption.
* Transport-level encryption is treated as secondary: application-level AES-256-GCM encryption is mandatory for all messages.
* Even if a TURN relay or network adversary inspects the WebRTC packets, message payloads are double-encrypted with zero plaintext leakage.
