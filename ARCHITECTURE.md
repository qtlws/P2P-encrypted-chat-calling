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
│   ├── globals.css               # Tailwind v4 styles
│   ├── layout.tsx                # HTML entry point, metadata, viewport
│   └── page.tsx                  # Main client-side entry orchestrator
├── components/
│   ├── call/
│   │   ├── IncomingCallBanner.tsx # Ringing notification with accept/decline
│   │   └── VideoCallModal.tsx    # Fullscreen video grid, audio controls
│   ├── chat/
│   │   ├── ChatArea.tsx          # Message stream, input bar, call CTA
│   │   ├── NewChatModal.tsx      # UID connect flow with step-by-step states
│   │   ├── SecurityIndicatorModal.tsx # E2EE & Fingerprint verification sheet
│   │   └── Sidebar.tsx           # Contact list, unread badges, user card
│   ├── debug/
│   │   └── DebugPanel.tsx        # Dev-only inspector (WebRTC states, ICE)
│   ├── identity/
│   │   ├── IdentityModal.tsx     # My UID, keys, fingerprint, backup/restore
│   │   └── ResetIdentityDialog.tsx# Safety confirmation for clearing data
│   └── peer/
│       └── PeerVerificationModal.tsx # Verify, unverify, block, forget peer
├── lib/
│   ├── secureDataStorage.ts      # Mandatory single entry point for storage
│   └── utils.ts                  # Styling and formatting utilities
├── src/                          # Mirror export paths for strict requirement
│   ├── crypto/
│   │   ├── encryption.ts         # AES-256-GCM with associated authenticated data
│   │   ├── fingerprints.ts       # Human-readable formatted SHA-256 fingerprints
│   │   ├── handshake.ts          # Mutual signed handshake protocol
│   │   ├── identity.ts           # UID generation, Ed25519 & X25519 keypairs
│   │   ├── keyAgreement.ts       # X25519 ECDH shared secret
│   │   ├── keyDerivation.ts      # HKDF-SHA256 session key derivation
│   │   ├── signatures.ts         # Ed25519 signing & verification
│   │   └── types.ts              # Cryptographic types and interfaces
│   ├── services/
│   │   ├── chat/ChatManager.ts   # Chat orchestration, envelope builder, ACKs
│   │   ├── signaling/SignalingClient.ts # SSE real-time signaling client
│   │   └── webrtc/
│   │       ├── CallManager.ts    # Call lifecycle, ringtones, track management
│   │       ├── DataChannelManager.ts # RTCDataChannel transport & ACKs
│   │       ├── MediaManager.ts   # getUserMedia, device mute/unmute
│   │       └── PeerConnectionManager.ts # WebRTC peer connection manager
│   └── types/
│       ├── chat.ts               # Message, conversation, and envelope models
│       ├── peer.ts               # Peer identity, trust, fingerprint models
│       └── signaling.ts          # Signaling protocol message types
├── ARCHITECTURE.md
├── SECURITY.md
├── THREAT-MODEL.md
├── PROTOCOL.md
├── PRIVACY.md
└── README.md
```
