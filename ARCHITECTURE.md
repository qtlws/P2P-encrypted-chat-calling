# System Architecture: Zero-Knowledge P2P Encrypted Messenger

## 1. High-Level Architectural Diagram

```
                     ┌────────────────────────────────────────────────────────┐
                     │              Ephemeral Signaling Server                │
                     │                 (Next.js App Router)                   │
                     │                                                        │
                     │  • Ephemeral in-memory Map<uid, ClientConnection>       │
                     │  • SSE stream (GET /api/signaling?uid=...)              │
                     │  • Signal dispatch (POST /api/signaling)                │
                     │  • SDP Offer / Answer relay                            │
                     │  • ICE candidate exchange                              │
                     │  • Automatic 60-second inactivity expiration           │
                     │  • ZERO message database                               │
                     │  • ZERO contact database                               │
                     │  • ZERO private keys or plaintext knowledge            │
                     └───────────────────────────┬────────────────────────────┘
                                                 │
                                  Signaling only │ (Encrypted handshake & SDP)
                                                 │
                     ┌───────────────────────────┴────────────────────────────┐
                     │                                                        │
                     ▼                                                        ▼
      ┌─────────────────────────────┐                          ┌─────────────────────────────┐
      │          User A             │                          │          User B             │
      │                             │                          │                             │
      │  • Random UID (u_xxxx)      │                          │  • Random UID (u_yyyy)      │
      │  • Ed25519 Identity Keypair │                          │  • Ed25519 Identity Keypair │
      │  • X25519 Encryption Keypair│                          │  • X25519 Encryption Keypair│
      │  • Local Master Storage Key │                          │  • Local Master Storage Key │
      │  • secureDataStorage (AEAD) │                          │  • secureDataStorage (AEAD) │
      │  • In-memory Plaintexts     │                          │  • In-memory Plaintexts     │
      └──────────────┬──────────────┘                          └──────────────┬──────────────┘
                     │                                                        │
                     │◄────────────────── WebRTC P2P ────────────────────────►│
                     │      Direct RTCDataChannel ('p2p-chat')                │
                     │      Direct MediaStream (Video / Audio)                │
                     │      AEAD (AES-256-GCM) + Ed25519 Signatures           │
                     └────────────────────────────────────────────────────────┘
```

## 2. Component Layering

The application strictly separates presentation, cryptographic operations, state management, and transport:

```
┌────────────────────────────────────────────────────────────────────────────┐
│ Presentation Layer (React 19 + Tailwind CSS)                               │
│  - App Layout & Navigation                                                 │
│  - Sidebar & Conversation List                                             │
│  - Chat Area & Message Bubbles (Plain text rendering, sanitized)           │
│  - Video / Audio Call Overlay & Controls                                   │
│  - Identity & Key Export/Import Modals                                     │
│  - Peer Verification & Fingerprint Comparison Modals                       │
│  - Security Indicator & Developer Debug Inspector                          │
└─────────────────────────────────────┬──────────────────────────────────────┘
                                      │
┌─────────────────────────────────────▼──────────────────────────────────────┐
│ Application Orchestration Layer                                            │
│  - Bootstrap Service: Initialization, Identity Loading, Peer Hydration     │
│  - ChatManager: Message composing, envelope encryption, delivery tracking  │
│  - CallManager: Media acquisition, call state machine (ringing, connected) │
└─────────────────────────────────────┬──────────────────────────────────────┘
                                      │
┌─────────────────────────────────────▼──────────────────────────────────────┐
│ Transport & Networking Layer                                               │
│  - SignalingClient: Server-Sent Events (SSE) stream + HTTP POST dispatcher │
│  - PeerConnectionManager: RTCPeerConnection, STUN/TURN, ICE Candidates     │
│  - DataChannelManager: RTCDataChannel lifecycle, buffering, ACK protocol   │
│  - MediaManager: Local camera/mic stream, track toggling, audio metering   │
└─────────────────────────────────────┬──────────────────────────────────────┘
                                      │
┌─────────────────────────────────────▼──────────────────────────────────────┐
│ Cryptographic Core Layer (Audited Primitives: Noble Curves & WebCrypto)     │
│  - Identity (Ed25519 Keypair generation, signing, verification)            │
│  - Key Agreement (X25519 ECDH shared secret derivation)                   │
│  - Key Derivation (HKDF-SHA256 session root & message key derivation)      │
│  - Symmetric AEAD (AES-256-GCM authenticated encryption, unique IVs)       │
│  - Cryptographic Fingerprints (SHA-256 canonical hex formatting)           │
│  - Handshake Protocol (Signed nonces, timestamp verification, replay guard)│
└─────────────────────────────────────┬──────────────────────────────────────┘
                                      │
┌─────────────────────────────────────▼──────────────────────────────────────┐
│ Storage Layer (Zero Plaintext Persistence)                                 │
│  - secureDataStorage.ts (Sole entry and exit point for client persistence) │
│  - Master Storage Key (256-bit AES-GCM encryption of all stored records)   │
│  - Encrypted Envelopes: Sender Envelope + Recipient Envelope               │
└────────────────────────────────────────────────────────────────────────────┘
```

## 3. Directory Layout

```
/
├── app/
│   ├── api/
│   │   └── signaling/
│   │       └── route.ts          # Ephemeral in-memory signaling relay
│   ├── api/
│   │   ├── ice-servers/
│   │   │   └── route.ts          # Dynamic STUN & Coturn TLS TURN ICE relay configuration
│   │   └── signaling/
│   │       └── route.ts          # Ephemeral in-memory SSE signaling relay
│   ├── globals.css               # Tailwind CSS v4 styles
│   ├── layout.tsx                # HTML entry point, metadata, viewport, SEO
│   └── page.tsx                  # Main client-side state orchestrator
├── components/
│   ├── call/
│   │   ├── IncomingCallBanner.tsx # Ringing incoming call banner with accept/decline
│   │   └── VideoCallModal.tsx    # Desktop 3:4 side-by-side & mobile 1:1 draggable call stage
│   ├── chat/
│   │   ├── ChatArea.tsx          # Smart auto-scroll message stream, header & input
│   │   ├── NewChatModal.tsx      # UID connect flow with step-by-step states
│   │   ├── SecurityIndicatorModal.tsx # E2EE & Fingerprint verification audit modal
│   │   └── Sidebar.tsx           # Contact list, search, identity card, backup CTA
│   ├── debug/
│   │   └── DebugPanel.tsx        # Dev-only inspector (WebRTC states, ICE candidates)
│   ├── identity/
│   │   └── IdentityModal.tsx     # My UID, keys, fingerprint, backup/restore
│   └── peer/
│       ├── KeyChangeWarningModal.tsx # MITM key replacement security alert dialog
│       └── PeerVerificationModal.tsx # 1-tap fingerprint verification modal
├── lib/
│   ├── secureDataStorage.ts      # Centralized client-side AES-GCM storage encryption
│   └── utils.ts                  # Class names merging & utility helpers
├── src/
│   ├── config/
│   │   └── coturn.ts             # Default STUN & Coturn TLS TURN relay configuration
│   ├── crypto/
│   │   ├── encryption.ts         # AES-256-GCM AEAD encryption & decryption
│   │   ├── fingerprints.ts       # Human-readable formatted SHA-256 fingerprints
│   │   ├── handshake.ts          # Mutual signed handshake protocol
│   │   ├── identity.ts           # UID generation, Ed25519 & X25519 keypair generation
│   │   ├── keyAgreement.ts       # X25519 ECDH shared secret derivation
│   │   ├── keyDerivation.ts      # HKDF-SHA256 session & mutual root key derivation
│   │   ├── secureProtocol.ts     # Secure Transport Protocol (STP) v2 envelope builder
│   │   ├── signatures.ts         # Ed25519 signing & verification
│   │   ├── types.ts              # Cryptographic types and interfaces
│   │   └── utils.ts              # ArrayBuffer & Base64 encoding/decoding utilities
│   ├── services/
│   │   ├── chat/ChatManager.ts   # Chat orchestration, envelope builder, ACKs, dual-path delivery
│   │   ├── signaling/SignalingClient.ts # Resilient SSE + fast polling client
│   │   └── webrtc/
│   │       ├── CallManager.ts    # Call lifecycle, ringtones, track management
│   │       ├── DataChannelManager.ts # RTCDataChannel transport & ACKs
│   │       ├── MediaManager.ts   # getUserMedia, device mute/unmute, stream capture
│   │       └── PeerConnectionManager.ts # WebRTC connection, Coturn ICE configuration
│   └── types/
│       ├── chat.ts               # Message, conversation, and envelope models
│       ├── peer.ts               # Peer identity, trust, fingerprint models
│       ├── signaling.ts          # Signaling protocol message types
│       └── webrtc.ts             # Call state, media controls, connection types
├── ARCHITECTURE.md
├── SECURITY.md
├── THREAT-MODEL.md
├── PROTOCOL.md
├── PRIVACY.md
└── README.md
```

## 4. Dual-Path Transport Architecture

To provide maximum delivery reliability while preserving strict zero-knowledge end-to-end encryption:

1. **Primary Path (Direct WebRTC DataChannel)**:
   * When both peers are directly connected via `RTCPeerConnection`, messages are transmitted over the WebRTC DataChannel (`p2p-chat`) with sub-millisecond peer-to-peer latency.
2. **Fallback Path (Encrypted Signaling Envelope)**:
   * If the peer-to-peer DataChannel is still negotiating ICE candidates, traversing symmetric NATs, or temporarily reconnecting, encrypted `WireMessage` payloads are safely transmitted via the `/api/signaling` relay.
   * Because every message is sealed with AES-256-GCM and signed with Ed25519 before reaching the transport layer, the signaling relay sees only opaque ciphertext. Plaintext never touches the server.

## 5. Responsive Real-Time Call Interface

The video calling interface automatically adapts to user hardware and viewport dimensions:
* **Desktop & Laptop Screens**: Displays local and remote video streams in balanced **3:4 aspect ratio containers** side-by-side. This ensures high-resolution camera feeds do not stretch or overwhelm large displays.
* **Mobile Devices**: Displays the incoming remote peer in a prominent **1:1 square video frame** with the local user's camera preview presented as a **1:1 floating thumbnail**. Users can drag and position the preview anywhere on screen via smooth gesture physics (`motion/react`).
