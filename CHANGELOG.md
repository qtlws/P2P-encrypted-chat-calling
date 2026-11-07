# Changelog

All notable changes to the **Zero-Knowledge P2P Encrypted Chat & Calling** project are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

---

## [1.2.1] - 2026-11-07

### 🚀 Major Features & Additions

#### 👥 Multi-Party Group Audio & Video Calling (Up to 5 Participants)
* **Mesh Multi-Candidate Calling**: Up to 5 concurrent participants in full peer-to-peer audio and video calls.
* **Spotlight Pinning & Zoom**: Click any participant card to spotlight-pin their video feed to a prominent main view. Includes interactive **Zoom In (`+`)**, **Zoom Out (`-`)**, and **Reset Zoom** magnification controls with smooth CSS transformations.
* **Responsive Participant Grid**: Dynamic multi-tile layout that intelligently scales between mobile and desktop viewports, arranging non-pinned video tiles in a balanced grid.
* **In-Call Participant Invitation ("Add Call")**: Directly invite additional known contacts into an ongoing conversation without disconnecting active peers.
* **Call Waiting & Call Merging**:
  * When in an active call and receiving a new incoming call, an unobtrusive banner offers **Decline**, **Answer (Hold Current Call)**, or **Merge Calls**.
  * Merging brings all parties together into the unified multi-party session.
* **Privacy-Preserving Anonymous Caller Cards**:
  * In a multi-party call where User A knows Users B and C, but B and C have never performed a mutual handshake, B and C's screens display each other as **"Anonymous Peer"** with masked identifiers.
  * UIDs are only revealed to contacts who have mutually handshaked, preventing out-of-band metadata leakage across untrusted group members.

#### 📱 Draggable Picture-in-Picture (PiP) Floating Calling Stage
* **Simultaneous In-Call Chatting**: Minimize the call to a lightweight floating card so you can read, write, and send messages while staying on the call.
* **Draggable Motion Handle**: Built with `motion/react` non-momentum dragging with grab handles for fluid positioning across touch and desktop interfaces.
* **Mobile Input Accommodation**: Scaled to 50% width (`min-w-[175px] max-w-[220px]`) and docked above the bottom chat bar (`bottom-24`), preventing keyboard or input box occlusion on smartphones.
* **Compact Quick Controls**: Integrated toggles for microphone mute, camera disable, add participant, fullscreen restore, and one-tap hangup.

#### 🔔 Pure Web Audio API Synthesized Chime & Ringtone
* **Zero External Audio Assets**: Generates realistic incoming telephone rings and call-waiting double-beep chime alerts directly in the browser via the native `AudioContext` oscillator.
* **Zero Tracking / Zero Network Requests**: No external MP3/WAV files, ensuring pristine offline support and zero referrer leaks.
* **Dual-Tone Melody**: Dual-frequency harmonic chime (C5 523.25 Hz + E5 659.25 Hz) cycling every 2.8 seconds until answered or dismissed.

#### 🗑️ Mutual "Delete Chat from Both Ends"
* **Remote History Purge**: Session initiators can request a complete, cryptographic deletion of the conversation history from both their device and the recipient's device.
* **Active P2P Requirement**: Enforces that the counterparty must be actively online and connected via an authenticated WebRTC DataChannel (`isP2PConnected`) before the command can be dispatched, preventing half-wipes.

### ⚡ Performance & Signaling Optimizations

* **Server-Sent Events (SSE) First**: Eliminated aggressive 1.2-second signaling poll loops while the SSE stream is active, slashing signaling server requests by over **95%** (from 1,000+ requests/30s for 100 users down to minimal passive event listeners).
* **6-Second Disconnected Fallback**: Graceful fallback polling activates only when SSE encounters network disconnects or proxy disruptions.
* **45-Second Presence Heartbeat**: Lightened server presence heartbeat intervals to conserve client battery and reduce mobile data consumption.
* **5-Second P2P DataChannel Keepalive**: Lightweight ping/pong packets across active DataChannels keep NAT firewall pinholes open and detect unexpected disconnections within seconds.
* **Lockscreen & Mobile Wake Recovery**: Listens to browser `visibilitychange` and `window.online` events to immediately re-verify P2P state and re-establish signaling connections when mobile devices wake from sleep.
* **Non-Destructive Call Termination**: Ending an audio or video call stops media tracks and removes RTP senders without closing the underlying `RTCPeerConnection` or chat `RTCDataChannel`, preventing unintended drops into idle state.

### 🛡️ Privacy, Security & UX Improvements

* **Form Autofill Suppression**: Disabled browser autocomplete, auto-suggestions, and Chrome password manager prompts on sensitive message input fields and passphrase generation modals (`autocomplete="off"`, `data-lpignore="true"`).
* **Full Encrypted Backup & Restore**: Identity export now packages complete encrypted chat history, peer rosters, Ed25519 identity keypairs, X25519 key agreements, and public/private keys into an AES-256-GCM passphrase-protected JSON bundle.
* **Safe Clickable Links**: URLs inside messages are rendered as clickable links formatted with strict `rel="noopener noreferrer"` and `target="_blank"`, with zero external preview scrapers to protect client IP addresses.
* **Futuristic Onboarding Experience**: Interactive first-time visitor modal with simulated cryptographic relay initialization, explaining zero-knowledge principles before generating the user's local identity keys.
* **Complete Identity Reset**: Wipes all indexed keys, conversation records, and local storage on demand, generating a completely fresh identity detached from previous UIDs.

---

## [1.1.1] - 2026-11-06

### Added
* **Smart Auto-Scroll**: Messages stream smoothly into view with smart scroll retention and a floating "↓ New messages" button.
* **Visual Safety Fingerprints**: SHA-256 safety numbers formatted as `XXXX-XXXX-XXXX-...` for out-of-band MITM verification.
* **Client-Side Encrypted Storage**: Centralized `secureDataStorage.ts` for encrypting local browser storage with AES-256-GCM.
* **STUN & Coturn TLS TURN Configuration**: Seamless NAT traversal with fallback to encrypted TURN relays over port 5349.

---

## [1.0.0] - 2026-11-05

### Added
* Initial release of Zero-Knowledge P2P Encrypted Chat & Video Calling platform.
* Client-side **Ed25519** digital signatures and **X25519** ECDH key agreement.
* **AES-256-GCM** authenticated message encryption via Web Crypto API.
* Direct peer-to-peer WebRTC `RTCDataChannel` text messaging.
* 1-on-1 peer-to-peer audio and video calling.
* Ephemeral zero-storage signaling server with automatic in-memory TTL cleanup.
