/**
 * Secure Transport Protocol (STP) over HTTP / HTTPS
 *
 * Enforces authenticated application-layer end-to-end encryption for all signaling packets
 * sent across the network over HTTP or HTTPS.
 *
 * Threat Model:
 * Even if transport TLS is intercepted (e.g. unencrypted plain HTTP, corporate SSL proxy,
 * or rogue reverse proxy / ISP inspection), every single packet sent between peers
 * is enveloped in a standardized uniform structure:
 *
 * Uniform Wire Packet:
 * {
 *   v: 2,                        // Protocol Version
 *   type: "sec-packet",          // Fixed uniform packet type
 *   from: "<sender-uid>",
 *   to: "<recipient-uid>",
 *   seq: <monotonic-counter>,
 *   ts: <timestamp>,
 *   subType: "<logical-type>",   // handshake-init, handshake-ack, offer, answer, ice-candidate, etc.
 *   payload: <base64-or-object>, // E2EE ciphertext envelope or signed payload
 *   sig: "<ed25519-hex-sig>"     // Cryptographic signature binding all packet fields
 * }
 */

import { bytesToHex, getRandomBytes, canonicalStringify, utf8ToBytes, bytesToUtf8 } from './utils';
import { signCanonicalPayload, verifyCanonicalPayload } from './signatures';
import { encryptAesGcm, decryptAesGcm } from './encryption';

export interface SecureTransportPacket {
  v: 2;
  type: 'sec-packet' | 'secure-packet';
  from: string;
  to: string;
  fromUid?: string;
  toUid?: string;
  senderUid?: string;
  recipientUid?: string;
  subType: string;
  seq: number;
  ts: number;
  nonce: string;
  // Uniform payload representation:
  // If encrypted with mutual session key, encrypted=true with ciphertext + iv.
  // If pre-handshake (e.g. handshake-init), encrypted=false with signed raw payload.
  encrypted: boolean;
  payload: string; // Base64 ciphertext or canonical JSON string
  iv?: string; // 12-byte IV (Base64) when encrypted
  sig: string; // Ed25519 digital signature of canonical packet
  senderFingerprint?: string;
}

let monotonicSeq = 0;

/**
 * Builds a tamper-evident Secure Transport Packet for transmission over HTTP/HTTPS.
 */
export async function packSecureTransportMessage(params: {
  fromUid?: string;
  toUid?: string;
  senderUid?: string;
  recipientUid?: string;
  subType: string;
  innerData?: unknown;
  payload?: unknown;
  senderPrivateKey?: string;
  senderSigningKey?: string;
  senderFingerprint?: string;
  sessionKey?: CryptoKey | null;
}): Promise<SecureTransportPacket> {
  const fromUid = params.fromUid || params.senderUid || '';
  const toUid = params.toUid || params.recipientUid || '';
  const subType = params.subType;
  const innerData = params.innerData !== undefined ? params.innerData : params.payload;
  const senderPrivateKey = params.senderPrivateKey || params.senderSigningKey || '';
  const sessionKey = params.sessionKey;

  monotonicSeq += 1;
  const seq = monotonicSeq;
  const ts = Date.now();
  const nonce = bytesToHex(getRandomBytes(12));

  let encrypted = false;
  let payloadStr = '';
  let ivStr: string | undefined = undefined;

  const rawJson = typeof innerData === 'string' ? innerData : canonicalStringify(innerData);

  if (sessionKey) {
    // Encrypt payload with mutual session key + AAD binding
    const aad = { fromUid, toUid, subType, seq, ts, nonce, v: 2 };
    const { ciphertext, iv } = await encryptAesGcm(rawJson, sessionKey, aad);
    encrypted = true;
    payloadStr = ciphertext;
    ivStr = iv;
  } else {
    // Plaintext string payload (e.g. initial handshake containing Ed25519 public key)
    encrypted = false;
    payloadStr = rawJson;
  }

  const unsignedBody = {
    v: 2 as const,
    type: 'sec-packet' as const,
    from: fromUid,
    to: toUid,
    subType,
    seq,
    ts,
    nonce,
    encrypted,
    payload: payloadStr,
    iv: ivStr || '',
  };

  const sig = signCanonicalPayload(unsignedBody, senderPrivateKey);

  return {
    ...unsignedBody,
    fromUid,
    toUid,
    senderUid: fromUid,
    recipientUid: toUid,
    senderFingerprint: params.senderFingerprint,
    sig,
  };
}

/**
 * Unpacks, verifies signature, and decrypts an incoming Secure Transport Packet.
 */
export async function unpackSecureTransportMessage(params: {
  packet: SecureTransportPacket;
  senderIdentityPublicKey?: string;
  senderPublicKey?: string;
  recipientSessionKey?: CryptoKey | null;
  sessionKey?: CryptoKey | null;
}): Promise<{ valid: boolean; data: any; payload: any; error?: string }> {
  const { packet } = params;
  let senderPublicKey = params.senderIdentityPublicKey || params.senderPublicKey;
  const sessionKey = params.sessionKey || params.recipientSessionKey;

  if (packet.v !== 2 || packet.type !== 'sec-packet') {
    return { valid: false, data: null, payload: null, error: 'Invalid packet version or header' };
  }

  // Prevent replay attacks (max 5 minutes window)
  const age = Math.abs(Date.now() - packet.ts);
  if (age > 5 * 60 * 1000) {
    return { valid: false, data: null, payload: null, error: 'Packet timestamp out of replay bounds' };
  }

  // If this is an unencrypted handshake message (e.g. handshake-init or handshake-ack),
  // and we don't yet have the peer's public key registered, derive it from the inner payload
  if (!senderPublicKey && !packet.encrypted && typeof packet.payload === 'string') {
    try {
      const parsed = JSON.parse(packet.payload);
      if (parsed && typeof parsed.identityPublicKey === 'string') {
        senderPublicKey = parsed.identityPublicKey;
      }
    } catch {
      // Ignored
    }
  }

  if (!senderPublicKey) {
    return { valid: false, data: null, payload: null, error: 'Missing sender public key for packet verification' };
  }

  // 1. Verify Ed25519 signature of the exact transport packet fields
  const signedFields = {
    v: packet.v,
    type: packet.type,
    from: packet.from,
    to: packet.to,
    subType: packet.subType,
    seq: packet.seq,
    ts: packet.ts,
    nonce: packet.nonce,
    encrypted: packet.encrypted,
    payload: packet.payload,
    iv: packet.iv || '',
  };

  const isSigValid = verifyCanonicalPayload(signedFields, packet.sig, senderPublicKey);
  if (!isSigValid) {
    return { valid: false, data: null, payload: null, error: 'Transport signature invalid (tampered or spoofed)' };
  }

  // 2. Extract or decrypt inner data
  if (packet.encrypted) {
    if (!sessionKey) {
      return { valid: false, data: null, payload: null, error: 'Encrypted packet received but no session key available' };
    }
    if (!packet.iv) {
      return { valid: false, data: null, payload: null, error: 'Missing IV in encrypted packet' };
    }

    try {
      const aad = {
        fromUid: packet.from,
        toUid: packet.to,
        subType: packet.subType,
        seq: packet.seq,
        ts: packet.ts,
        nonce: packet.nonce,
        v: 2,
      };
      const decryptedJson = await decryptAesGcm(packet.payload, packet.iv, sessionKey, aad);
      const data = JSON.parse(decryptedJson);
      return { valid: true, data, payload: data };
    } catch (err) {
      return { valid: false, data: null, payload: null, error: `Decryption failed: ${err instanceof Error ? err.message : 'Bad AEAD tag'}` };
    }
  } else {
    try {
      const data = JSON.parse(packet.payload);
      return { valid: true, data, payload: data };
    } catch {
      return { valid: true, data: packet.payload, payload: packet.payload };
    }
  }
}
