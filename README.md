# 🔒 Zero-Knowledge P2P End-to-End Encrypted Web Chat & Group Calling

[![Version](https://img.shields.io/badge/Version-1.2.1-emerald?style=for-the-badge&logo=semver)](./CHANGELOG.md)
[![Next.js](https://img.shields.io/badge/Next.js-15.5-black?style=for-the-badge&logo=next.js)](https://nextjs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.9-blue?style=for-the-badge&logo=typescript)](https://www.typescriptlang.org/)
[![WebRTC](https://img.shields.io/badge/WebRTC-P2P_Mesh_Audio_%26_Video-orange?style=for-the-badge&logo=webrtc)](https://webrtc.org/)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-v4-38bdf8?style=for-the-badge&logo=tailwind-css)](https://tailwindcss.com/)
[![E2EE Security](https://img.shields.io/badge/Security-AES--256--GCM_%2B_Ed25519-emerald?style=for-the-badge&logo=shield)](./SECURITY.md)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow?style=for-the-badge)](./LICENSE)

A production-grade, zero-knowledge, peer-to-peer web messaging and real-time multi-party audio/video communication platform. Built with **in-browser cryptographic identity**, **AES-256-GCM authenticated encryption**, **direct WebRTC DataChannels**, and an **ephemeral zero-storage signaling rendezvous server**.

No accounts, no email addresses, no phone numbers, no tracking, and **zero server-side message persistence**.

---

## 🌟 What's New in v1.2.1

* 👥 **Multi-Party Group Calling (Up to 5 Participants)**: Full mesh WebRTC group voice and video calling with dynamic participant layout.
* 🔍 **Screen Pinning & Interactive Zoom**: Select any candidate's video feed to pin as the primary spotlight stage with zoom-in (`+`), zoom-out (`-`), and zoom-reset magnification controls.
* ➕ **In-Call "Add Participant" & Call Merging**: Add more peers during an active call, or merge incoming callers seamlessly with call-waiting alerts.
* 🕶️ **Privacy-Preserving Anonymous Caller Cards**: Un-handshaked participants in a group call are shown with anonymous labels and masked identities, preventing out-of-band metadata leakage across untrusted group members.
* 📱 **Draggable Picture-in-Picture (PiP) Calling Stage**: Dockable floating call preview with smooth `motion/react` dragging. Sized to 50% width on mobile and positioned above the chat bar so you can read, write, and send messages while calling.
* 🔔 **Web Audio API Synthesized Ringtone**: Realistic dual-tone telephone ringing (C5 523Hz + E5 659Hz) and call-waiting double-beep chime synthesized directly via native browser `AudioContext`—no external audio files or tracking.
* 🗑️ **Mutual "Delete Chat from Both Ends"**: Initiators can remotely wipe message history from both devices across authenticated DataChannels, with active connection safeguards.
* ⚡ **Optimized SSE-First Signaling & Reconnect**: Eliminated polling during active Server-Sent Events; 6s disconnected fallback polling; automatic reconnection when mobile devices wake from sleep (`visibilitychange` / `online`).
* 🔒 **Encrypted Full Backup & Restore**: Identity export bundled with full encrypted chat histories, peer rosters, Ed25519/X25519 keys, and safety fingerprints protected by a master passphrase.
* 🛡️ **Anti-Autofill & IP-Protected Links**: Message input boxes and passphrase prompts disable browser autocomplete and password manager popups; URLs render as safe clickable links with zero preview scrapers to preserve IP anonymity.

---

## 🚀 Key Features

### 1. In-Browser Cryptographic Identity
* Pure client-side **Ed25519** (identity signing & signature verification) and **X25519** (Diffie-Hellman key agreement) keypairs generated via audited `@noble/curves` primitives.
* Private keys are stored in encrypted browser storage and never touch any server or network socket.

### 2. Deterministic Mutual End-to-End Encryption (E2EE)
* Text messages, attachments, and remote deletion signals are encrypted with **AES-256-GCM** using keys derived via **HKDF-SHA256**.
* Each message payload includes Authenticated Additional Data (AAD), a unique 12-byte cryptographically random IV, and an Ed25519 digital signature to protect against eavesdropping, forgery, and replay attacks.

### 3. Multi-Party Audio & Video Calling (Up to 5 Candidates)
* **Direct Mesh WebRTC**: Zero media relay through third-party servers; direct peer-to-peer audio and video transmission via DTLS-SRTP.
* **Spotlight Pin View**: Pin any participant's video feed to make it the prominent screen, with smooth CSS zoom controls for inspecting presentations or details.
* **Responsive Layouts**: Desktop mode balances pinned and non-pinned video tiles; mobile view uses touch-friendly aspect ratios with draggable previews.
* **Add Call & Call Merging**: Invite additional contacts mid-call or merge an incoming call into your current group conversation.
* **Anonymous Peer Cards**: Group participants who have not previously exchanged a direct cryptographic handshake see each other as "Anonymous Peer" to guarantee zero metadata leakage.

### 4. Floating Picture-in-Picture (PiP) Calling Stage
* Continue chatting in the main window while on an active call.
* Draggable widget with handle grip powered by `motion/react`.
* Mobile layout occupies 50% width docked safely above the chat input box.
* Includes one-tap controls for microphone mute, camera toggle, add candidate, fullscreen toggle, and hang up.

### 5. Client-Synthesized Audio Chime & Ringtones
* Incoming call alerts and call-waiting notifications generated purely in-browser with the Web Audio API.
* Works seamlessly in private/incognito tabs and offline PWA environments without loading external audio assets.

### 6. Mutual "Delete Chat from Both Ends"
* The conversation initiator can delete messages and purge the peer from both local and remote devices.
* Requires the counterparty to be actively connected via an authenticated WebRTC DataChannel (`isP2PConnected`) before dispatching the wipe command.

### 7. Resilient, High-Efficiency Signaling
* Next.js App Router API endpoint (`/api/signaling`) coordinates initial WebRTC handshakes via Server-Sent Events (SSE).
* Heavy polling is disabled while SSE is active, reducing server requests by over **95%**.
* Background/sleep wake-up listeners automatically re-verify P2P DataChannels and re-establish signaling sessions without page reloads.
* Non-destructive call hangup stops media tracks without severing the chat DataChannel.

### 8. Human-Readable Safety Fingerprints
* 32-character hexadecimal fingerprints formatted as `XXXX-XXXX-XXXX-...` for out-of-band verification against Man-in-the-Middle (MITM) attacks.
* Automatic tamper-detection dialog if a peer's public key changes unexpectedly.

### 9. Encrypted Backup & Recovery
* Export your entire profile, including cryptographic keys, peer records, and encrypted chat archives, into a password-protected JSON backup (PBKDF2 + AES-256-GCM).
* Restore your identity across different browsers and devices with zero server involvement.

---

## 📋 System Requirements

| Requirement | Supported Version | Notes |
| :--- | :--- | :--- |
| **Node.js** | `>= 18.18.0` (v20+ or v22+ recommended) | Tested on Node.js v20.x and v22.x LTS |
| **Package Manager** | `npm` `>= 9.0`, `bun`, `pnpm`, or `yarn` | Any modern JavaScript package manager |
| **Modern Browser** | Chrome, Edge, Firefox, Safari (iOS 15+), Brave, Arc | Requires WebRTC and Web Crypto API support |
| **Context** | `localhost` or valid `https://` | **Mandatory**: Browsers only permit camera, microphone (`getUserMedia`), and crypto primitives on secure origins (`https://` or `localhost`). |

---

## 🛠️ Quick Start & Installation

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

The application includes built-in Google STUN servers and Coturn TLS TURN relay configurations out of the box. If you run your own Coturn TURN/STUN relay server:
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

## 🌐 Testing Across Devices Using VS Code Port Forwarding

WebRTC calling and camera/microphone access require a secure `https://` context on remote devices. **Visual Studio Code's built-in Port Forwarding** provides a free, instant public HTTPS tunnel with a trusted SSL certificate, making cross-network and mobile testing effortless.

### Step-by-Step Port Forwarding Guide

1. **Open the project in VS Code**:
   Launch VS Code and open your project workspace.

2. **Start the local server**:
   Open a terminal inside VS Code and run:
   ```bash
   npm run dev
   ```
   Verify that the server is listening on port `3000`.

3. **Open the Ports Panel**:
   * In the bottom panel (alongside Terminal, Output, and Problems), click on the **Ports** tab.
   * *(Alternatively, press `Ctrl+Shift+P` on Windows/Linux or `Cmd+Shift+P` on macOS, type `Ports: Focus on Ports View`, and press Enter).*

4. **Forward Port 3000**:
   * Click **"Forward a Port"** (or the **`+`** icon).
   * Enter port number `3000` and press `Enter`.

5. **Change Port Visibility to Public (Crucial Step)**:
   * By default, VS Code sets forwarded ports to **Private** (which requires logging into GitHub).
   * **Right-click** on the forwarded port `3000` entry.
   * Select **Port Visibility** $\rightarrow$ **Public**.
   * *(Click **Continue** on the brief confirmation prompt).*

6. **Copy the Forwarded HTTPS Address**:
   * In the **Forwarded Address** column, click the **Copy** icon next to the generated URL.
   * The address will resemble:
     ```
     https://xxxx-3000.asse.devtunnels.ms
     ```

7. **Test on Any Device or Network**:
   * **Device 1 (Computer)**: Open `http://localhost:3000` or the forwarded HTTPS URL.
   * **Device 2 (Smartphone)**: Open the copied `https://...devtunnels.ms` URL in Safari or Chrome.
   * Camera and microphone permissions will work natively because the tunnel provides valid HTTPS!

---

## 💬 Usage Guide

### Connecting with a Peer
1. **Copy Your Cryptographic UID**:
   * On first launch, a unique client-side UID (`u_...`) is generated.
   * Click the **Copy** button on the UID card in the sidebar or under **Identity Settings** (`🔑`).
2. **Start a New Chat**:
   * Click **"+ New Secure Chat"** on Device 1.
   * Paste the UID of Device 2 and click **"Connect"**.
   * A cryptographic handshake is exchanged; once authenticated, the conversation opens immediately.
3. **Verify Fingerprints**:
   * Click the **Verify** badge in the chat header to compare the 32-character hexadecimal fingerprint out-of-band.
   * Mark as verified to save the peer's verified state.

### Placing Audio & Video Calls
1. Click the **Phone** (`📞`) or **Video** (`📹`) button in the chat header.
2. The remote device will chime with the synthesized ringtone and display an incoming banner.
3. Click **Accept** to connect the call.
4. **Group Calls**: Click **"Add Call"** (`👤+`) in the call controls to invite more peers (up to 5 total).
5. **Pin & Zoom**: Click any participant's video to pin them as the spotlight view, and use the `+` / `-` buttons to zoom in or out.
6. **Chat While Calling**: Click the minimize icon to shrink the call into a draggable floating PiP widget and chat uninterrupted.

### Deleting Chat from Both Ends
1. Open an active conversation where you initiated the chat.
2. Confirm the peer shows the green **P2P Connected** indicator.
3. Click the red **"Delete Both Ends"** button in the chat header.
4. Confirm the prompt to permanently purge the messages and contact record from both devices.

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
* [CHANGELOG.md](./CHANGELOG.md) - Version release history and updates.
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
│   │   ├── ice-servers/route.ts       # STUN/TURN ICE server configuration endpoint
│   │   └── signaling/route.ts         # Ephemeral in-memory SSE signaling relay
│   ├── globals.css                    # Tailwind CSS styles
│   ├── layout.tsx                     # HTML root layout, viewport meta, SEO tags
│   └── page.tsx                       # Main app state orchestrator
├── components/
│   ├── call/
│   │   ├── IncomingCallBanner.tsx     # Ringing incoming call banner with ringtone
│   │   └── VideoCallModal.tsx         # Multi-party call stage, pinning, zoom & draggable PiP
│   ├── chat/
│   │   ├── ChatArea.tsx               # Smart auto-scroll message stream, header & input
│   │   ├── NewChatModal.tsx           # UID connection dialog
│   │   ├── SecurityIndicatorModal.tsx # Cryptographic fingerprint audit sheet
│   │   └── Sidebar.tsx                # Conversations list, search, identity card
│   ├── debug/
│   │   └── DebugPanel.tsx             # Real-time WebRTC & signaling diagnostics
│   ├── identity/
│   │   └── IdentityModal.tsx          # Passphrase-protected key backup & recovery
│   ├── media/
│   │   └── MediaPermissionBanner.tsx  # Camera & microphone permission prompt
│   ├── onboarding/
│   │   └── WelcomeOnboardingModal.tsx # First-time zero-knowledge welcome modal
│   └── peer/
│       ├── KeyChangeWarningModal.tsx  # MITM key replacement security warning
│       └── PeerVerificationModal.tsx  # 1-tap fingerprint trust verification
├── lib/
│   ├── secureDataStorage.ts           # Client-side AES-GCM storage encryption
│   └── utils.ts                       # Class name merging & formatting
└── src/
    ├── config/
    │   └── coturn.ts                  # STUN and TLS TURN server configuration
    ├── crypto/
    │   ├── encryption.ts              # AES-256-GCM AEAD encryption & decryption
    │   ├── fingerprints.ts            # SHA-256 formatted fingerprint generation
    │   ├── handshake.ts               # Mutual signed cryptographic handshake
    │   ├── identity.ts                # In-browser Ed25519 & X25519 key generator
    │   ├── keyAgreement.ts            # X25519 ECDH shared secret derivation
    │   ├── keyDerivation.ts           # HKDF-SHA256 WebCrypto key derivations
    │   ├── secureProtocol.ts          # Secure Transport Protocol (STP) v2 envelopes
    │   └── signatures.ts              # Ed25519 digital signature signing & verification
    ├── lib/
    │   ├── callRingtone.ts            # Web Audio API dual-tone ringtone synthesizer
    │   ├── messageFormatting.ts       # Safe link detection and sanitization
    │   └── secureDataStorage.ts       # Indexed storage persistence
    └── services/
        ├── chat/ChatManager.ts        # E2EE messaging & storage orchestration
        ├── signaling/SignalingClient.ts # Resilient SSE + fallback polling client
        └── webrtc/
            ├── CallManager.ts         # Multi-party audio & video call state machine
            ├── DataChannelManager.ts  # RTCDataChannel transport & ping/pong keepalives
            ├── MediaManager.ts        # Camera & microphone stream capture
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
