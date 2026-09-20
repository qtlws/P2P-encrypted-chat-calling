# P2P End-to-End Encrypted Web Chat & Calling

A production-grade, zero-knowledge peer-to-peer web communication application featuring:

- **Client-Side Cryptographic Identity**: Pure in-browser Ed25519 (Identity & Signatures) and X25519 (ECDH Key Agreement).
- **End-to-End Encryption**: AES-256-GCM authenticated encryption with unique per-message IVs, derived via HKDF-SHA256.
- **Client-Only Encrypted Persistence**: Centralized `secureDataStorage.ts` abstraction encrypting all local records with a local master key.
- **WebRTC Direct Transport**: Direct `RTCDataChannel` for instant encrypted text chats and `RTCPeerConnection` for peer-to-peer video & audio calls.
- **Zero-Storage Signaling Server**: Ephemeral in-memory routing only; stores no messages, no contacts, no private keys.
- **Cryptographic Fingerprint & Key Verification**: Human-readable identity fingerprints (`XXXX-XXXX-XXXX-...`) with automated key-change warnings.
- **Encrypted Identity Backup & Recovery**: Password-protected export/import of identity keys.

---

## Quick Start

1. Launch the application: your cryptographic UID and keypairs are generated immediately in your browser.
2. Share your UID with a peer.
3. Click **"+ New Chat"**, enter the peer's UID, and initiate connection.
4. Once connected via WebRTC, exchange end-to-end encrypted messages or click the **Video Call** / **Audio Call** button for real-time peer-to-peer calling.
