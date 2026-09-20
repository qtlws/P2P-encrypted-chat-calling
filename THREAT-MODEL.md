# Threat Model & Security Boundaries

## 1. Adversary Model & Assumptions

We evaluate security under the standard cryptographic threat model:
* **Network Adversary (Passive & Active)**: Can observe, drop, delay, replay, or inject packets between peers and between clients and the signaling server.
* **Malicious Signaling Server**: The signaling operator is assumed to be curious or potentially untrusted. It can log all signaling messages, observe IP addresses, or attempt to inject fraudulent public keys.
* **Malicious Peer**: A communicating counterparty may attempt to forge messages, replay old sessions, or claim a false identity.
* **Local Device Examiner**: An entity with casual or temporary physical access to the device trying to inspect browser storage.

---

## 2. Protected Threats (Mitigated)

| Threat | Mitigation Mechanism |
| :--- | :--- |
| **Plaintext Message Interception** | End-to-end AES-256-GCM encryption with shared secret derived via X25519 ECDH + HKDF. Server sees zero plaintext. |
| **Signaling Server Eavesdropping** | Server acts strictly as an ephemeral broker. Private keys and plaintext messages are never sent to or routed through the server. |
| **Message Tampering / Forgery** | AES-256-GCM authentication tag + Ed25519 digital signature over canonical metadata. Any modified byte fails verification and is rejected. |
| **Replay Attacks** | Cryptographically random nonces (16 bytes) in handshakes, unique UUIDv4 message IDs, local duplicate-detection window, and timestamp validity checks. |
| **UID Spoofing / Impersonation** | UIDs are not trusted alone. Identity is bound to Ed25519 public keys signed by the private key holder, verified against stored fingerprints. |
| **Key Substitution / MITM** | Cryptographic fingerprint comparison (`XXXX-XXXX-XXXX-...`) out-of-band and local key-change alert warning if a peer key changes. |
| **Casual Storage Inspection** | `secureDataStorage.ts` encrypts all stored state (identities, peers, conversations, messages) with AES-256-GCM. No plaintext in localStorage. |

---

## 3. Residual Risks & Unprotected Threats (Honest Disclosure)

| Risk | Explanation & Limitations |
| :--- | :--- |
| **XSS / Malicious Browser Extensions** | If an attacker executes arbitrary JavaScript in the application's origin, they can access in-memory private keys. LocalStorage encryption cannot protect against in-origin script execution. |
| **Compromised Operating System / Malware** | Keyloggers, screen scrapers, or memory dumpers on the host device can bypass client-side protections. |
| **Network Metadata Exposure (IP Addresses)** | WebRTC peer-to-peer connections inherently reveal client IP addresses to communicating peers and STUN/TURN servers. |
| **Offline Delivery Limitation** | Because there is no centralized message repository, messages cannot be delivered if the recipient is offline. Messages are only exchanged when both peers are online. |
| **Lost Identity on Browser Cache Purge** | Because identities are stored solely on the client, clearing browser data deletes the user's cryptographic identity unless they exported an encrypted backup file. |
