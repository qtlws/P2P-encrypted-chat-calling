/**
 * Cryptographic Handshake Protocol
 * Mutual signed authentication and session key agreement
 */

import { HandshakePayload, SecureSession, UserIdentity, PeerIdentity } from './types';
import { getRandomBytes, bytesToHex } from './utils';
import { signCanonicalPayload, verifyCanonicalPayload } from './signatures';
import { computeSharedSecret } from './keyAgreement';
import { deriveWebCryptoSessionKey } from './keyDerivation';
import { generateFingerprint } from './fingerprints';

const HANDSHAKE_MAX_AGE_MS = 5 * 60 * 1000; // 5 minutes replay window

/**
 * Creates an authentic signed handshake payload
 */
export function createHandshakePayload(
  myIdentity: UserIdentity,
  recipientUid: string
): HandshakePayload {
  const nonce = bytesToHex(getRandomBytes(16));
  const timestamp = Date.now();

  const unsignedData = {
    version: 1,
    senderUid: myIdentity.uid,
    recipientUid,
    identityPublicKey: myIdentity.identityPublicKey,
    encryptionPublicKey: myIdentity.encryptionPublicKey,
    nonce,
    timestamp,
  };

  const signature = signCanonicalPayload(unsignedData, myIdentity.identityPrivateKey);

  return {
    ...unsignedData,
    signature,
  };
}

/**
 * Validates an incoming handshake payload:
 * - Replay prevention (timestamp age)
 * - Ed25519 signature verification against sender's identityPublicKey
 */
export function verifyHandshakePayload(payload: HandshakePayload): {
  valid: boolean;
  error?: string;
} {
  const now = Date.now();
  if (Math.abs(now - payload.timestamp) > HANDSHAKE_MAX_AGE_MS) {
    return { valid: false, error: 'Handshake payload expired or invalid clock skew' };
  }

  const { signature, ...unsignedData } = payload;
  const isSignatureValid = verifyCanonicalPayload(
    unsignedData,
    signature,
    payload.identityPublicKey
  );

  if (!isSignatureValid) {
    return { valid: false, error: 'Handshake Ed25519 digital signature invalid' };
  }

  return { valid: true };
}

/**
 * Derives a mutual SecureSession from local identity and counterparty's handshake payload
 */
export async function establishSecureSession(
  myIdentity: UserIdentity,
  peerHandshake: HandshakePayload,
  myNonce: string
): Promise<{
  session: SecureSession;
  peerIdentity: PeerIdentity;
}> {
  // 1. Verify handshake signature
  const verification = verifyHandshakePayload(peerHandshake);
  if (!verification.valid) {
    throw new Error(verification.error || 'Invalid handshake signature');
  }

  // 2. Compute X25519 Shared Secret
  const sharedSecret = computeSharedSecret(
    myIdentity.encryptionPrivateKey,
    peerHandshake.encryptionPublicKey
  );

  // 3. Construct canonical session salt context binding UIDs, nonces, and session protocol
  const canonicalUids = [myIdentity.uid, peerHandshake.senderUid].sort().join(':');
  const canonicalNonces = [myNonce, peerHandshake.nonce].sort().join(':');
  const saltContext = `P2P-SESSION:${canonicalUids}:${canonicalNonces}`;

  // 4. Derive AES-256-GCM Session Key via HKDF-SHA256
  const { cryptoKey } = await deriveWebCryptoSessionKey(sharedSecret, saltContext);

  const sessionId = `sess_${canonicalUids}_${myNonce.slice(0, 8)}`;
  const fingerprint = generateFingerprint(peerHandshake.identityPublicKey);

  const session: SecureSession = {
    sessionId,
    peerUid: peerHandshake.senderUid,
    localPublicKey: myIdentity.encryptionPublicKey,
    peerPublicKey: peerHandshake.encryptionPublicKey,
    sharedSecretDerived: true,
    establishedAt: Date.now(),
    sessionKey: cryptoKey,
  };

  const peerIdentity: PeerIdentity = {
    uid: peerHandshake.senderUid,
    identityPublicKey: peerHandshake.identityPublicKey,
    encryptionPublicKey: peerHandshake.encryptionPublicKey,
    fingerprint,
    firstSeenAt: Date.now(),
    lastSeenAt: Date.now(),
    verified: false,
    trusted: true,
  };

  return { session, peerIdentity };
}
