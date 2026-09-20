# Privacy Policy & Architecture Disclosure

## 1. Zero-Knowledge Guarantees

* **No Accounts or Passwords**: You never submit an email, phone number, real name, or password. Your cryptographic keypair is generated directly inside your browser.
* **No Server Message Storage**: The signaling server does not maintain an inbox, chat database, contact directory, or message log.
* **No Server-Side Decryption**: All message decryption keys exist solely in your local browser memory. The server has zero mathematical capability to decrypt your text messages, audio, or video.
* **Local-Only Chat History**: All conversations, peer records, and message histories reside in encrypted client storage on your device.

---

## 2. Ephemeral Data Handled by the Signaling Server

To connect two users, the signaling server must temporarily relay routing messages:
* Your ephemeral generated UID (e.g., `u_4a8b...`).
* Transient WebRTC signaling packets (SDP session descriptions and ICE candidate routing addresses).
* Your public identity and encryption keys (public keys contain no private key material).
* Active connection timestamps (automatically wiped after 60 seconds of inactivity).

---

## 3. WebRTC Peer-to-Peer Network Realities

* **Direct IP Visibility**: WebRTC establishes direct peer-to-peer UDP/TCP connections between devices. By design of the WebRTC protocol, communicating directly with a peer reveals your IP address to that peer.
* **STUN / TURN Usage**: When direct NAT traversal is impossible, traffic may be relayed via standard STUN/TURN servers.
