# 🔒 Zero-Knowledge P2P End-to-End Encrypted Web Chat & Video Calling

[![Next.js](https://img.shields.io/badge/Next.js-15.5-black?style=for-the-badge&logo=next.js)](https://nextjs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.9-blue?style=for-the-badge&logo=typescript)](https://www.typescriptlang.org/)
[![WebRTC](https://img.shields.io/badge/WebRTC-P2P_Audio_%26_Video-orange?style=for-the-badge&logo=webrtc)](https://webrtc.org/)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-v4-38bdf8?style=for-the-badge&logo=tailwind-css)](https://tailwindcss.com/)
[![E2EE Security](https://img.shields.io/badge/Security-AES--256--GCM_%2B_Ed25519-emerald?style=for-the-badge&logo=shield)](./SECURITY.md)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow?style=for-the-badge)](./LICENSE)

A production-grade, zero-knowledge, peer-to-peer web messaging and real-time audio/video communication platform. Built with **in-browser cryptographic identity**, **AES-256-GCM authenticated encryption**, **direct WebRTC DataChannels**, and an **ephemeral zero-storage signaling rendezvous server**.

No accounts, no email addresses, no phone numbers, no tracking, and **zero server-side message persistence**.

---

## 🌟 Key Features

* **Client-Generated Cryptographic Identity**:
  * Pure client-side **Ed25519** (identity signing & signature verification) and **X25519** (Diffie-Hellman key agreement) keypairs generated via audited `@noble/curves` primitives.
  * Private keys never leave your browser runtime.
* **Deterministic Mutual End-to-End Encryption (E2EE)**:
  * Messages are encrypted with **AES-256-GCM** using keys derived via **HKDF-SHA256**.
  * Each message is bound with Authenticated Additional Data (AAD), a unique 12-byte cryptographically random IV, and an Ed25519 digital signature to protect against tampering, eavesdropping, and spoofing.
* **Direct WebRTC Audio & Video Calling**:
  * Direct peer-to-peer `RTCPeerConnection` for crystal-clear voice and video.
  * **Desktop / Laptop View**: Balanced side-by-side **3:4 aspect ratio cards** for a clean, non-oversized desktop experience.
  * **Mobile View**: Prominent **1:1 square video card** for remote peer with a touch/mouse **draggable floating 1:1 camera preview** (`motion/react`) you can position anywhere on screen.
* **Intelligent Chat Auto-Scroll**:
  * Automatically follows new messages as they arrive if you are at the bottom of the conversation.
  * Reading previous message history is never interrupted; a floating **"↓ New messages"** button lets you smoothly jump to latest messages at your own pace.
* **Zero-Storage Ephemeral Signaling**:
  * Next.js App Router API route (`/api/signaling`) handles initial SDP offer/answer handshakes and ICE candidate exchange via Server-Sent Events (SSE) and fast polling fallback.
  * Server stores **zero chat messages, zero contacts, zero private keys**, and enforces an automatic 60-second TTL on in-memory signaling envelopes.
* **Human-Readable Cryptographic Fingerprints**:
  * Distinctive visual safety numbers formatted as `XXXX-XXXX-XXXX-...` for out-of-band verification against Man-in-the-Middle (MITM) attacks.
  * Built-in 1-tap peer verification and automated warning dialogs if a peer's public key changes.
* **Client-Side Encrypted Storage**:
  * Centralized `secureDataStorage.ts` encrypts all local conversations, peer records, and message archives under a client-managed master key.
* **Password-Protected Identity Backup & Restore**:
  * Export your identity key bundle encrypted with PBKDF2 + AES-256-GCM and restore it on any browser or device.

---

## 📋 System Requirements

| Requirement | Supported Version | Notes |
| :--- | :--- | :--- |
| **Node.js** | `>= 18.18.0` (v20+ or v22+ recommended) | Tested on Node.js v20.x and v22.x |
| **Package Manager** | `npm` `>= 9.0`, `bun`, `pnpm`, or `yarn` | Any modern JavaScript package manager |
| **Modern Browser** | Chrome, Edge, Firefox, Safari (iOS 15+), Brave, Arc | Requires WebRTC and Web Crypto API support |
| **Context** | `localhost` or valid `https://` | **Mandatory**: Web browsers only grant camera and microphone access (`getUserMedia`) over secure origins (`https://` or `localhost`). |

---

## 🚀 Quick Start & Installation

### 1. Clone the Repository

```bash
git clone https://github.com/vijayjvvc/P2P-encrypted-chat-calling.git
cd P2P-encrypted-chat-calling
```

### 2. Install Dependencies

Using `npm`:
```bash
npm install
```

Or using `bun`:
```bash
bun install
```

### 3. Configure Environment Variables (Optional)

Copy the example environment configuration:
```bash
cp .env.example .env.local
```

The app includes built-in Google STUN servers and Coturn TLS TURN relay configurations out of the box. If you run your own Coturn TURN/STUN server:
```env
COTURN_URLS=turns:your-coturn-domain.com:5349?transport=tcp,turn:your-coturn-domain.com:3478?transport=udp
COTURN_USERNAME=your_username
COTURN_CREDENTIAL=your_password
```

### 4. Start Development Server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

---

## 🌐 Testing Across Different Devices & Networks Using VS Code Port Forwarding

WebRTC peer-to-peer calling and camera/microphone access require a secure `https://` context on remote devices. **Visual Studio Code's built-in Port Forwarding** provides a free, instant public HTTPS tunnel with a trusted SSL certificate, making cross-network and mobile testing seamless.

### Step-by-Step Port Forwarding Guide

1. **Open the project in VS Code**:
   Launch VS Code and open your project workspace.

2. **Start the local server**:
   Open a terminal inside VS Code and run:
   ```bash
   npm run dev
   ```
   Ensure the server is running on port `3000`.

3. **Open the Ports Panel**:
   * In the bottom panel (next to Terminal, Output, and Problems), click on the **Ports** tab.
   * *(Alternatively, press `Ctrl+Shift+P` on Windows/Linux or `Cmd+Shift+P` on macOS, type `Ports: Focus on Ports View`, and press Enter).*

4. **Forward Port 3000**:
   * Click **"Forward a Port"** (or the **`+`** icon).
   * Enter port number `3000` and press `Enter`.

5. **Change Port Visibility to Public (Crucial Step)**:
   * By default, VS Code sets forwarded ports to **Private** (which only allows access while logged into your GitHub account).
   * **Right-click** on the forwarded port `3000` row.
   * Go to **Port Visibility** $\rightarrow$ Select **Public**.
   * *(Note: VS Code will display a brief prompt confirming you want to make the port accessible to anyone with the link; click **Continue**).*

6. **Copy the Forwarded HTTPS Address**:
   * In the **Forwarded Address** column, hover over the URL and click the **Copy** icon.
   * The address will look like:
     ```
     https://xxxx-3000.asse.devtunnels.ms
     ```

7. **Test on Any Device or Network**:
   * **Device 1 (Your Laptop)**: Open `http://localhost:3000` or the forwarded HTTPS URL.
   * **Device 2 (Your Phone or Friend's Computer)**: Open the copied `https://xxxx-3000.asse.devtunnels.ms` URL in Safari, Chrome, or any mobile browser.
   * Camera and microphone permissions will work natively because the tunnel provides valid HTTPS!

---

## 💬 How to Chat & Call

1. **Find Your Cryptographic UID**:
   * On first launch, a unique client-side UID (`u_...`) is generated.
   * Click the **Copy** button on the UID card in the sidebar or under **Identity Settings** (`🔑`).
2. **Start a New Chat**:
   * Click **"+ New Secure Chat"** on Device 1.
   * Paste the UID of Device 2 and click **"Connect"**.
   * A cryptographic handshake is exchanged; once authenticated, the conversation opens immediately.
3. **Verify Identity & Safety Fingerprint**:
   * Click the **Verify** badge in the chat header.
   * Compare the 32-character hexadecimal fingerprint with your counterparty out-of-band (or over voice).
   * Click **"Mark Identity as Verified"** to confirm peer authenticity.
4. **Initiate Real-Time Voice or Video Calls**:
   * Click the **Phone** (`📞`) or **Video** (`📹`) icon in the chat header.
   * Device 2 will display an incoming ringing banner with **Accept** and **Decline** options.
   * Once accepted, enjoy encrypted peer-to-peer audio and video with adaptive desktop 3:4 side-by-side cards or mobile 1:1 draggable preview!

---

## 🛡️ Security & Cryptographic Architecture

```
┌─────────────────────────────────────────────────────────────────────────┐
│                      Client Browser Security Boundary                   │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  [ Ed25519 Identity Keypair ]         [ X25519 ECDH Keypair ]           │
│         │                                        │                      │
│         ▼                                        ▼                      │
│  Digital Signatures                     Diffie-Hellman Exchange         │
│  (Tamper-Proof Packets)                          │                      │
│                                                  ▼                      │
│                                         Pairwise Shared Secret          │
│                                                  │                      │
│                                           HKDF-SHA256                   │
│                                                  │                      │
│                                                  ▼                      │
│                                        [ AES-256-GCM Key ]              │
│                                                  │                      │
│               ┌──────────────────────────────────┴────────────────┐     │
│               ▼                                                   ▼     │
│       Message Ciphertext                               Direct Media     │
│    (AAD + Random 12-byte IV)                     (WebRTC DTLS-SRTP P2P) │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

For complete technical specifications, review our protocol and threat modeling documentation:
* [ARCHITECTURE.md](./ARCHITECTURE.md) - Full component breakdown and sequence diagrams.
* [PROTOCOL.md](./PROTOCOL.md) - Exact JSON framing, wire structures, and signaling specs.
* [SECURITY.md](./SECURITY.md) - Cryptographic algorithm suites and key isolation boundaries.
* [THREAT-MODEL.md](./THREAT-MODEL.md) - Adversary capabilities and security mitigations.
* [PRIVACY.md](./PRIVACY.md) - Zero-knowledge principles and data minimization policy.

---

## 📁 Repository Structure

```
├── app/
│   ├── api/
│   │   ├── ice-servers/route.ts    # STUN/TURN ICE server configuration endpoint
│   │   └── signaling/route.ts      # Ephemeral in-memory SSE signaling relay
│   ├── globals.css                 # Tailwind CSS styles
│   ├── layout.tsx                  # HTML root layout, viewport meta, SEO tags
│   └── page.tsx                    # Main app state orchestrator
├── components/
│   ├── call/
│   │   ├── IncomingCallBanner.tsx  # Ringing incoming call banner
│   │   └── VideoCallModal.tsx      # Desktop 3:4 & Mobile 1:1 draggable call stage
│   ├── chat/
│   │   ├── ChatArea.tsx            # Smart auto-scroll message stream, header & input
│   │   ├── NewChatModal.tsx        # UID connection dialog
│   │   ├── SecurityIndicatorModal.tsx # Cryptographic fingerprint audit sheet
│   │   └── Sidebar.tsx             # Conversations list, search, identity card
│   ├── debug/
│   │   └── DebugPanel.tsx          # Real-time WebRTC & signaling diagnostics
│   ├── identity/
│   │   └── IdentityModal.tsx       # Passphrase-protected key backup & recovery
│   └── peer/
│       ├── KeyChangeWarningModal.tsx   # MITM key replacement security warning
│       └── PeerVerificationModal.tsx   # 1-tap fingerprint trust verification
├── lib/
│   ├── secureDataStorage.ts        # Client-side AES-GCM storage encryption
│   └── utils.ts                    # Class name merging & formatting
└── src/
    ├── config/
    │   └── coturn.ts               # STUN and TLS TURN server configuration
    ├── crypto/
    │   ├── encryption.ts           # AES-256-GCM AEAD encryption & decryption
    │   ├── fingerprints.ts         # SHA-256 formatted fingerprint generation
    │   ├── handshake.ts            # Mutual signed cryptographic handshake
    │   ├── identity.ts             # In-browser Ed25519 & X25519 key generator
    │   ├── keyAgreement.ts         # X25519 ECDH shared secret derivation
    │   ├── keyDerivation.ts        # HKDF-SHA256 WebCrypto key derivations
    │   ├── secureProtocol.ts       # Secure Transport Protocol (STP) v2 envelopes
    │   └── signatures.ts           # Ed25519 digital signature signing & verification
    └── services/
        ├── chat/ChatManager.ts     # E2EE messaging & storage orchestration
        ├── signaling/SignalingClient.ts # Resilient SSE + fast polling client
        └── webrtc/
            ├── CallManager.ts      # Audio & video call state machine
            ├── DataChannelManager.ts # RTCDataChannel transport & message ACKs
            ├── MediaManager.ts     # Camera & microphone stream capture
            └── PeerConnectionManager.ts # WebRTC connection & ICE candidate exchange
```

---

## 👥 Contributors

Thanks to all the contributors who help make this project better!

<a href="https://github.com/vijayjvvc/P2P-encrypted-chat-calling/graphs/contributors">
  <img src="https://contrib.rocks/image?repo=vijayjvvc/P2P-encrypted-chat-calling" alt="Contributors" />
</a>

Contributions, bug reports, and pull requests are warmly welcomed! Please check our [SECURITY.md](./SECURITY.md) guidelines before proposing cryptographic changes.

---

## 📜 License

This project is licensed under the [MIT License](./LICENSE). You are free to use, modify, and distribute it for personal and commercial projects.
