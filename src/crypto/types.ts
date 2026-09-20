/**
 * Cryptographic Data Types & Interfaces
 */

export interface UserIdentity {
  uid: string; // Cryptographically random UID: e.g. u_7f3c9d2a8e1b...
  identityPublicKey: string; // Ed25519 public key (hex)
  identityPrivateKey: string; // Ed25519 private key (hex) - NEVER transmitted
  encryptionPublicKey: string; // X25519 public key (hex)
  encryptionPrivateKey: string; // X25519 private key (hex) - NEVER transmitted
  fingerprint: string; // Formatted SHA-256 fingerprint
  createdAt: number;
}

export interface PeerIdentity {
  uid: string;
  identityPublicKey: string;
  encryptionPublicKey: string;
  fingerprint: string;
  firstSeenAt: number;
  lastSeenAt: number;
  verified: boolean;
  trusted: boolean;
}

export interface PeerStore {
  [uid: string]: PeerIdentity;
}

export interface SecureSession {
  sessionId: string;
  peerUid: string;
  localPublicKey: string;
  peerPublicKey: string;
  sharedSecretDerived: boolean;
  establishedAt: number;
  sessionKey: CryptoKey | null;
}

export interface HandshakePayload {
  version: number;
  senderUid: string;
  recipientUid: string;
  identityPublicKey: string;
  encryptionPublicKey: string;
  nonce: string;
  timestamp: number;
  signature: string;
}

export interface EncryptedEnvelope {
  algorithm: string; // "AES-256-GCM"
  ciphertext: string; // Base64
  iv: string; // Base64
  keyId: string;
  createdAt: number;
}

export interface WireMessage {
  protocolVersion: number; // 1
  id: string; // Unique message ID
  conversationId: string;
  senderUid: string;
  recipientUid: string;
  timestamp: number;
  type: 'text';
  ciphertext: string; // Base64 AES-256-GCM
  iv: string; // Base64 12-byte IV
  senderFingerprint: string;
  signature: string; // Ed25519 signature of canonical payload
}

export interface WireAck {
  type: 'message-ack';
  messageId: string;
  conversationId: string;
  senderUid: string;
  recipientUid: string;
  status: 'delivered';
  timestamp: number;
  signature?: string;
}
