# P2P Cryptographic & Signaling Protocol Specification

## Protocol Version: `1`
## Cipher Suite: `X25519-HKDF-SHA256-AES256GCM`

---

## 1. Signaling Messages

Signaling messages are exchanged over the ephemeral SSE / HTTP POST relay channel:

```typescript
type SignalMessage =
  | { type: 'presence'; uid: string }
  | { type: 'peer-request'; fromUid: string; toUid: string }
  | {
      type: 'handshake-init';
      fromUid: string;
      toUid: string;
      identityPublicKey: string;   // 32-byte Ed25519 hex
      encryptionPublicKey: string; // 32-byte X25519 hex
      nonce: string;               // 16-byte random hex
      timestamp: number;
      signature: string;           // 64-byte Ed25519 signature hex
    }
  | {
      type: 'handshake-ack';
      fromUid: string;
      toUid: string;
      identityPublicKey: string;
      encryptionPublicKey: string;
      nonce: string;
      timestamp: number;
      signature: string;
    }
  | {
      type: 'offer';
      fromUid: string;
      toUid: string;
      sdp: RTCSessionDescriptionInit;
    }
  | {
      type: 'answer';
      fromUid: string;
      toUid: string;
      sdp: RTCSessionDescriptionInit;
    }
  | {
      type: 'ice-candidate';
      fromUid: string;
      toUid: string;
      candidate: RTCIceCandidateInit;
    }
  | {
      type: 'call-invite';
      fromUid: string;
      toUid: string;
      callType: 'video' | 'audio';
    }
  | {
      type: 'call-accept';
      fromUid: string;
      toUid: string;
    }
  | {
      type: 'call-reject';
      fromUid: string;
      toUid: string;
      reason?: string;
    }
  | {
      type: 'call-hangup';
      fromUid: string;
      toUid: string;
    };
```

---

## 2. Key Agreement & Derivation Flow

1. **Exchange**: User A transmits `encryptionPublicKey_A` (X25519); User B transmits `encryptionPublicKey_B` (X25519).
2. **Shared Secret**:
   $$\text{SharedSecret} = \text{X25519}(\text{privKey}_A, \text{pubKey}_B) = \text{X25519}(\text{privKey}_B, \text{pubKey}_A)$$
3. **Session Context & Salt**:
   $$\text{CanonicalUIDs} = \text{sort}([\text{uid}_A, \text{uid}_B]).\text{join}(':') + ':' + \text{nonce}_A + ':' + \text{nonce}_B$$
   $$\text{Salt} = \text{SHA256}(\text{CanonicalUIDs})$$
4. **HKDF Expansion**:
   $$\text{SessionKey} = \text{HKDF-Expand}(\text{PRK} = \text{HKDF-Extract}(\text{Salt}, \text{SharedSecret}), \text{info} = \text{"P2P-E2EE-AES256GCM-v1"}, \text{len} = 32)$$

---

## 3. DataChannel Message Framing

Messages sent over the direct WebRTC DataChannel (`p2p-chat`) follow this structure:

```typescript
interface WireMessage {
  protocolVersion: 1;
  id: string;                         // Unique UUIDv4
  conversationId: string;             // SHA-256(sort(uidA, uidB))
  senderUid: string;
  recipientUid: string;
  timestamp: number;
  type: 'text';
  ciphertext: string;                 // Base64 AES-256-GCM ciphertext + auth tag
  iv: string;                         // Base64 12-byte initialization vector
  senderFingerprint: string;          // Human-readable SHA-256 fingerprint
  signature: string;                  // Hex 64-byte Ed25519 signature
}
```

```typescript
interface WireAck {
  type: 'message-ack';
  messageId: string;
  status: 'delivered';
  timestamp: number;
}
```
