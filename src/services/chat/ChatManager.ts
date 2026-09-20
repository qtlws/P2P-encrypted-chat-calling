/**
 * ChatManager
 * Core orchestrator for E2EE messaging, dual storage envelopes, key agreements, and trust verification
 */

import { secureDataStorage } from '@/lib/secureDataStorage';
import { UserIdentity, PeerIdentity, SecureSession, WireMessage, WireAck } from '@/src/crypto/types';
import { StoredMessage, Conversation } from '@/src/types/chat';
import { PeerRecord, ConnectionState } from '@/src/types/peer';
import { createHandshakePayload, establishSecureSession, verifyHandshakePayload } from '@/src/crypto/handshake';
import { encryptAesGcm, decryptAesGcm } from '@/src/crypto/encryption';
import { signCanonicalPayload, verifyCanonicalPayload } from '@/src/crypto/signatures';
import { deriveConversationId, generateFingerprint } from '@/src/crypto/fingerprints';
import { signalingClient } from '../signaling/SignalingClient';
import { peerConnectionManager } from '../webrtc/PeerConnectionManager';
import { dataChannelManager } from '../webrtc/DataChannelManager';
import { callManager } from '../webrtc/CallManager';
import { SignalMessage } from '@/src/types/signaling';
import { bytesToHex, getRandomBytes } from '@/src/crypto/utils';
import {
  packSecureTransportMessage,
  unpackSecureTransportMessage,
  SecureTransportPacket,
} from '@/src/crypto/secureProtocol';

export interface KeyChangeEvent {
  peerUid: string;
  oldFingerprint: string;
  newFingerprint: string;
}

type ConversationChangeHandler = (conversations: Conversation[]) => void;
type MessageChangeHandler = (conversationId: string, messages: StoredMessage[]) => void;
type KeyChangeHandler = (event: KeyChangeEvent) => void;
type ConnectionStatusHandler = (peerUid: string, state: ConnectionState) => void;

export class ChatManager {
  private identity: UserIdentity | null = null;
  private conversations = new Map<string, Conversation>();
  private messages = new Map<string, StoredMessage[]>();
  private peerRecords = new Map<string, PeerRecord>();
  private sessions = new Map<string, SecureSession>();
  private processedMessageIds = new Set<string>();

  private conversationListeners: Set<ConversationChangeHandler> = new Set();
  private messageListeners: Set<MessageChangeHandler> = new Set();
  private keyChangeListeners: Set<KeyChangeHandler> = new Set();
  private connectionListeners: Set<ConnectionStatusHandler> = new Set();

  private pendingHandshakeNonces = new Map<string, string>(); // peerUid -> myNonce

  /**
   * Initialize ChatManager with the local UserIdentity
   */
  public async initialize(identity: UserIdentity): Promise<void> {
    this.identity = identity;
    signalingClient.setUid(identity.uid);
    peerConnectionManager.setLocalUid(identity.uid);
    callManager.setLocalUid(identity.uid);

    // Setup WebRTC and DataChannel callbacks
    peerConnectionManager.setCallbacks(
      (peerUid, state) => this.handleConnectionStateChange(peerUid, state),
      (peerUid, event) => callManager.handleRemoteTrack(peerUid, event),
      (peerUid, channel) => dataChannelManager.registerIncomingChannel(peerUid, channel)
    );

    dataChannelManager.onMessage((peerUid, message) => {
      this.handleIncomingDataChannelPayload(peerUid, message);
    });

    dataChannelManager.onStatusChange((peerUid, isOpen) => {
      const conv = Array.from(this.conversations.values()).find((c) => c.peerUid === peerUid);
      if (conv) {
        conv.p2pConnected = isOpen;
        if (isOpen) conv.onlineStatus = 'online';
        this.notifyConversations();
      }
    });

    // Subscribe to signaling stream
    signalingClient.subscribe((signal) => {
      this.handleSignalingMessage(signal);
    });

    // Hydrate persistent storage
    await this.hydrateFromStorage();

    // Auto-ping existing peers if any to re-establish WebRTC sessions
    this.reconnectExistingPeers();
  }

  public getIdentity(): UserIdentity | null {
    return this.identity;
  }

  public getSession(peerUid: string): SecureSession | undefined {
    return this.sessions.get(peerUid);
  }

  public getPeer(peerUid: string): PeerRecord | undefined {
    return this.peerRecords.get(peerUid);
  }

  public getConversations(): Conversation[] {
    return Array.from(this.conversations.values()).sort((a, b) => b.updatedAt - a.updatedAt);
  }

  public getMessages(conversationId: string): StoredMessage[] {
    return this.messages.get(conversationId) || [];
  }

  /**
   * Load stored peer records, conversations, and decrypted messages into memory
   */
  private async hydrateFromStorage() {
    const peers = await secureDataStorage.get<Record<string, PeerRecord>>('app:peers');
    if (peers) {
      Object.values(peers).forEach((p) => this.peerRecords.set(p.uid, p));
    }

    const savedConvs = await secureDataStorage.get<Conversation[]>('app:conversations');
    if (savedConvs) {
      savedConvs.forEach((c) => {
        c.p2pConnected = false;
        c.onlineStatus = 'offline';
        this.conversations.set(c.id, c);
      });
    }

    // Hydrate messages for each conversation
    for (const conv of this.conversations.values()) {
      const stored = await secureDataStorage.get<StoredMessage[]>(`app:messages:${conv.id}`);
      if (stored) {
        for (const msg of stored) {
          this.processedMessageIds.add(msg.id);
          msg.plaintext = msg.plaintext || '[Encrypted Message]';
        }
        this.messages.set(conv.id, stored);
      }
    }

    this.notifyConversations();
  }

  /**
   * Proactively attempts handshake reconnect for previously saved contacts
   */
  private async reconnectExistingPeers() {
    if (!this.identity) return;
    for (const conv of this.conversations.values()) {
      try {
        const handshake = createHandshakePayload(this.identity, conv.peerUid);
        this.pendingHandshakeNonces.set(conv.peerUid, handshake.nonce);
        const transportPacket = await packSecureTransportMessage({
          subType: 'handshake-init',
          senderUid: this.identity.uid,
          recipientUid: conv.peerUid,
          senderSigningKey: this.identity.identityPrivateKey,
          senderFingerprint: this.identity.fingerprint,
          payload: handshake,
        });
        signalingClient.send(transportPacket).catch(() => {});
      } catch {
        // Silently skip offline peers
      }
    }
  }

  /**
   * Initiates a secure chat session with a counterparty UID
   */
  public async initiateChat(peerUid: string): Promise<Conversation> {
    if (!this.identity) throw new Error('Identity not initialized');
    if (peerUid === this.identity.uid) throw new Error('Cannot start chat with self');

    const conversationId = deriveConversationId(this.identity.uid, peerUid);

    // Create or retrieve conversation
    let conv = this.conversations.get(conversationId);
    if (!conv) {
      conv = {
        id: conversationId,
        peerUid,
        peerIdentityFingerprint: 'Connecting...',
        peerEncryptionPublicKey: '',
        createdAt: Date.now(),
        updatedAt: Date.now(),
        verified: false,
        unreadCount: 0,
        p2pConnected: false,
        onlineStatus: 'online',
      };
      this.conversations.set(conversationId, conv);
      await this.persistConversations();
      this.notifyConversations();
    }

    // Step 1: Send handshake-init to peer via signaling
    const handshake = createHandshakePayload(this.identity, peerUid);
    this.pendingHandshakeNonces.set(peerUid, handshake.nonce);

    this.notifyConnectionState(peerUid, 'handshaking');

    const transportPacket = await packSecureTransportMessage({
      subType: 'handshake-init',
      senderUid: this.identity.uid,
      recipientUid: peerUid,
      senderSigningKey: this.identity.identityPrivateKey,
      senderFingerprint: this.identity.fingerprint,
      payload: handshake,
    });

    const res = await signalingClient.send(transportPacket);

    if (!res.ok) {
      this.notifyConnectionState(peerUid, 'failed');
      throw new Error(res.error || 'Signaling failure');
    }

    return conv;
  }

  /**
   * Signaling Message Router with SecureTransportProtocol support
   */
  private async handleSignalingMessage(signal: SignalMessage | any) {
    if (!this.identity) return;

    // Support SecureTransportPacket (v2 E2EE signaling envelope)
    if (signal.type === 'sec-packet' || signal.type === 'secure-packet') {
      const packet = signal as SecureTransportPacket;
      const peerUid = packet.senderUid || packet.from || packet.fromUid || '';
      const peerRec = this.peerRecords.get(peerUid);
      const session = this.sessions.get(peerUid);

      const unpackResult = await unpackSecureTransportMessage({
        packet,
        senderPublicKey: peerRec?.identityPublicKey,
        recipientSessionKey: session?.sessionKey,
      });

      if (!unpackResult.valid) {
        console.warn('[ChatManager] Discarded invalid/tampered secure transport packet:', unpackResult.error);
        return;
      }

      const unpackedPayload = unpackResult.payload;

      switch (packet.subType) {
        case 'handshake-init': {
          await this.handleIncomingHandshakeInit(peerUid, unpackedPayload);
          break;
        }
        case 'handshake-ack': {
          await this.handleIncomingHandshakeAck(peerUid, unpackedPayload);
          break;
        }
        case 'chat-message': {
          if (unpackedPayload) {
            await this.handleIncomingWireMessage(peerUid, unpackedPayload);
          }
          break;
        }
        case 'offer': {
          await peerConnectionManager.handleOffer(peerUid, unpackedPayload?.sdp);
          break;
        }
        case 'answer': {
          await peerConnectionManager.handleAnswer(peerUid, unpackedPayload?.sdp);
          break;
        }
        case 'ice-candidate': {
          await peerConnectionManager.handleIceCandidate(peerUid, unpackedPayload?.candidate);
          break;
        }
        case 'call-invite': {
          callManager.handleIncomingInvite(peerUid, unpackedPayload?.callType);
          break;
        }
        case 'call-accept': {
          await callManager.handleCallAccepted(peerUid);
          break;
        }
        case 'call-reject': {
          callManager.handleCallRejected(peerUid);
          break;
        }
        case 'call-hangup': {
          callManager.handleCallRejected(peerUid);
          break;
        }
      }
      return;
    }

    // Direct fallback support
    switch (signal.type) {
      case 'handshake-init': {
        await this.handleIncomingHandshakeInit(signal.fromUid || signal.from, signal.payload);
        break;
      }
      case 'handshake-ack': {
        await this.handleIncomingHandshakeAck(signal.fromUid || signal.from, signal.payload);
        break;
      }
      case 'chat-message': {
        await this.handleIncomingWireMessage(signal.fromUid || signal.from, signal.payload);
        break;
      }
      case 'offer': {
        await peerConnectionManager.handleOffer(signal.fromUid || signal.from, signal.sdp);
        break;
      }
      case 'answer': {
        await peerConnectionManager.handleAnswer(signal.fromUid || signal.from, signal.sdp);
        break;
      }
      case 'ice-candidate': {
        await peerConnectionManager.handleIceCandidate(signal.fromUid || signal.from, signal.candidate);
        break;
      }
      case 'call-invite': {
        callManager.handleIncomingInvite(signal.fromUid || signal.from, signal.callType);
        break;
      }
      case 'call-accept': {
        await callManager.handleCallAccepted(signal.fromUid || signal.from);
        break;
      }
      case 'call-reject': {
        callManager.handleCallRejected(signal.fromUid || signal.from);
        break;
      }
      case 'call-hangup': {
        callManager.handleCallRejected(signal.fromUid || signal.from);
        break;
      }
    }
  }

  /**
   * Handle incoming handshake initialization from a peer
   */
  private async handleIncomingHandshakeInit(fromUid: string, payload: any) {
    if (!this.identity) return;

    // Check if peer is blocked
    const peerRec = this.peerRecords.get(fromUid);
    if (peerRec && peerRec.blocked) {
      return;
    }

    // Verify handshake payload
    const verification = verifyHandshakePayload(payload);
    if (!verification.valid) {
      console.warn('[ChatManager] Invalid handshake-init:', verification.error);
      return;
    }

    // Check for unexpected key change (MITM / Key Replacement warning)
    const newFingerprint = generateFingerprint(payload.identityPublicKey);
    if (peerRec && peerRec.identityPublicKey !== payload.identityPublicKey) {
      this.notifyKeyChange({
        peerUid: fromUid,
        oldFingerprint: peerRec.fingerprint,
        newFingerprint,
      });
      return;
    }

    // Create my own response handshake
    const myHandshake = createHandshakePayload(this.identity, fromUid);

    // Establish secure session
    const { session, peerIdentity } = await establishSecureSession(
      this.identity,
      payload,
      myHandshake.nonce
    );
    this.sessions.set(fromUid, session);

    // Save or update peer identity
    await this.updatePeerRecord(peerIdentity);

    // Send handshake-ack back (wrapped in SecureTransportPacket)
    const ackPacket = await packSecureTransportMessage({
      subType: 'handshake-ack',
      senderUid: this.identity.uid,
      recipientUid: fromUid,
      senderSigningKey: this.identity.identityPrivateKey,
      senderFingerprint: this.identity.fingerprint,
      payload: myHandshake,
    });
    await signalingClient.send(ackPacket);

    // Update conversation model
    const conversationId = deriveConversationId(this.identity.uid, fromUid);
    let conv = this.conversations.get(conversationId);
    if (!conv) {
      conv = {
        id: conversationId,
        peerUid: fromUid,
        peerIdentityFingerprint: peerIdentity.fingerprint,
        peerEncryptionPublicKey: peerIdentity.encryptionPublicKey,
        createdAt: Date.now(),
        updatedAt: Date.now(),
        verified: peerIdentity.verified,
        unreadCount: 0,
        p2pConnected: false,
        onlineStatus: 'online',
      };
      this.conversations.set(conversationId, conv);
      await this.persistConversations();
    } else {
      conv.peerIdentityFingerprint = peerIdentity.fingerprint;
      conv.peerEncryptionPublicKey = peerIdentity.encryptionPublicKey;
      conv.onlineStatus = 'online';
      await this.persistConversations();
    }

    this.notifyConversations();

    // Prepare WebRTC peer connection so answering offers is immediate
    const pc = peerConnectionManager.getOrCreateConnection(fromUid);
    dataChannelManager.createDataChannel(fromUid, pc);
  }

  /**
   * Handle incoming handshake acknowledgment from counterparty
   */
  private async handleIncomingHandshakeAck(fromUid: string, payload: any) {
    if (!this.identity) return;

    const myNonce = this.pendingHandshakeNonces.get(fromUid) || bytesToHex(getRandomBytes(16));

    // Verify counterparty handshake
    const { session, peerIdentity } = await establishSecureSession(
      this.identity,
      payload,
      myNonce
    );

    // Check key change
    const peerRec = this.peerRecords.get(fromUid);
    if (peerRec && peerRec.identityPublicKey !== payload.identityPublicKey) {
      this.notifyKeyChange({
        peerUid: fromUid,
        oldFingerprint: peerRec.fingerprint,
        newFingerprint: peerIdentity.fingerprint,
      });
      return;
    }

    this.sessions.set(fromUid, session);
    await this.updatePeerRecord(peerIdentity);

    // Update conversation
    const conversationId = deriveConversationId(this.identity.uid, fromUid);
    let conv = this.conversations.get(conversationId);
    if (!conv) {
      conv = {
        id: conversationId,
        peerUid: fromUid,
        peerIdentityFingerprint: peerIdentity.fingerprint,
        peerEncryptionPublicKey: peerIdentity.encryptionPublicKey,
        createdAt: Date.now(),
        updatedAt: Date.now(),
        verified: peerIdentity.verified,
        unreadCount: 0,
        p2pConnected: false,
        onlineStatus: 'online',
      };
      this.conversations.set(conversationId, conv);
    } else {
      conv.peerIdentityFingerprint = peerIdentity.fingerprint;
      conv.peerEncryptionPublicKey = peerIdentity.encryptionPublicKey;
      conv.onlineStatus = 'online';
    }

    await this.persistConversations();
    this.notifyConversations();

    // Now that keys are mutually derived, initiate WebRTC connection & DataChannel
    this.notifyConnectionState(fromUid, 'connecting');
    const pc = peerConnectionManager.getOrCreateConnection(fromUid);
    dataChannelManager.createDataChannel(fromUid, pc);
    await peerConnectionManager.createOffer(fromUid);
  }

  /**
   * Send an encrypted chat message to a peer (WebRTC DataChannel with zero-knowledge signaling fallback)
   */
  public async sendMessage(conversationId: string, plaintext: string): Promise<StoredMessage> {
    if (!this.identity) throw new Error('Identity not initialized');
    const conv = this.conversations.get(conversationId);
    if (!conv) throw new Error('Conversation not found');

    const peerUid = conv.peerUid;
    const session = this.sessions.get(peerUid);
    if (!session || !session.sessionKey) {
      // Re-trigger handshake
      await this.initiateChat(peerUid);
      throw new Error('Cryptographic handshake in progress with peer. Please retry in 1 second.');
    }

    const messageId = `m_${bytesToHex(getRandomBytes(16))}`;
    const timestamp = Date.now();

    // Authenticated Associated Data (AAD)
    const aad = {
      id: messageId,
      conversationId,
      senderUid: this.identity.uid,
      recipientUid: peerUid,
      timestamp,
      protocolVersion: 1,
    };

    // 1. Encrypt with shared session key
    const { ciphertext, iv } = await encryptAesGcm(plaintext, session.sessionKey, aad);

    // 2. Sign canonical wire payload with Ed25519 identity key
    const wireDataToSign = {
      protocolVersion: 1,
      id: messageId,
      conversationId,
      senderUid: this.identity.uid,
      recipientUid: peerUid,
      timestamp,
      type: 'text' as const,
      ciphertext,
      iv,
      senderFingerprint: this.identity.fingerprint,
    };

    const signature = signCanonicalPayload(wireDataToSign, this.identity.identityPrivateKey);
    const wireMessage: WireMessage = {
      ...wireDataToSign,
      signature,
    };

    // 3. Dual transport delivery:
    // First attempt direct WebRTC DataChannel
    let deliveredDirectly = dataChannelManager.send(peerUid, wireMessage);

    // If DataChannel is still negotiating or closed, relay zero-knowledge encrypted packet over signaling
    if (!deliveredDirectly) {
      try {
        const securePacket = await packSecureTransportMessage({
          subType: 'chat-message',
          senderUid: this.identity.uid,
          recipientUid: peerUid,
          senderSigningKey: this.identity.identityPrivateKey,
          senderFingerprint: this.identity.fingerprint,
          sessionKey: session.sessionKey,
          payload: wireMessage,
        });
        const sigRes = await signalingClient.send(securePacket);
        if (sigRes.ok) {
          deliveredDirectly = true;
        }
      } catch (err) {
        console.warn('[ChatManager] Fallback signaling transport error:', err);
      }
    }

    // 4. Create StoredMessage
    const storedMessage: StoredMessage = {
      id: messageId,
      conversationId,
      senderUid: this.identity.uid,
      recipientUid: peerUid,
      timestamp,
      type: 'text',
      plaintext,
      senderEnvelope: {
        algorithm: 'AES-256-GCM',
        ciphertext,
        iv,
        keyId: 'local_master_storage_key_v1',
        createdAt: timestamp,
      },
      recipientEnvelope: {
        algorithm: 'AES-256-GCM',
        ciphertext,
        iv,
        keyId: session.sessionId,
        createdAt: timestamp,
      },
      signature,
      protocolVersion: 1,
      status: deliveredDirectly ? 'sent' : 'delivered',
      senderFingerprint: this.identity.fingerprint,
    };

    // 5. Append to in-memory messages
    const currentMsgs = this.messages.get(conversationId) || [];
    currentMsgs.push(storedMessage);
    this.messages.set(conversationId, currentMsgs);

    // 6. Update conversation snippet
    conv.lastMessageSnippet = plaintext;
    conv.lastMessageTimestamp = timestamp;
    conv.updatedAt = timestamp;

    this.notifyMessages(conversationId);
    this.notifyConversations();

    // 7. Persist encrypted in storage
    await this.persistMessages(conversationId);
    await this.persistConversations();

    return storedMessage;
  }

  /**
   * Handles incoming payloads received directly over WebRTC DataChannel
   */
  private async handleIncomingDataChannelPayload(peerUid: string, payload: any) {
    if (!this.identity) return;

    if (payload.type === 'message-ack') {
      const ack = payload as WireAck;
      this.handleIncomingAck(ack);
      return;
    }

    const wireMsg = payload as WireMessage;
    if (wireMsg.type === 'text') {
      await this.handleIncomingWireMessage(peerUid, wireMsg);
    }
  }

  /**
   * Handle incoming text message over DataChannel or signaling relay
   */
  private async handleIncomingWireMessage(peerUid: string, msg: WireMessage) {
    if (!this.identity) return;

    // 1. Replay & Duplicate prevention
    if (this.processedMessageIds.has(msg.id)) {
      return;
    }
    this.processedMessageIds.add(msg.id);

    // 2. Retrieve peer record & session
    const peer = this.peerRecords.get(peerUid);
    if (!peer) {
      console.warn('[ChatManager] Message received from unknown peer:', peerUid);
      return;
    }

    const session = this.sessions.get(peerUid);
    if (!session || !session.sessionKey) {
      console.warn('[ChatManager] No session to decrypt message from:', peerUid);
      return;
    }

    // 3. Verify digital signature against peer identity public key
    const { signature, ...canonicalWireData } = msg;
    const isSigValid = verifyCanonicalPayload(
      canonicalWireData,
      signature,
      peer.identityPublicKey
    );

    if (!isSigValid) {
      console.error('[ChatManager] Signature verification failed! Tampered message rejected.');
      return;
    }

    // 4. Decrypt AES-256-GCM ciphertext
    const aad = {
      id: msg.id,
      conversationId: msg.conversationId,
      senderUid: msg.senderUid,
      recipientUid: msg.recipientUid,
      timestamp: msg.timestamp,
      protocolVersion: msg.protocolVersion,
    };

    let plaintext = '';
    try {
      plaintext = await decryptAesGcm(msg.ciphertext, msg.iv, session.sessionKey, aad);
    } catch (err) {
      console.error('[ChatManager] Decryption failed! Ciphertext or AAD tampered:', err);
      return;
    }

    // 5. Store message with local encrypted envelope
    const storedMsg: StoredMessage = {
      id: msg.id,
      conversationId: msg.conversationId,
      senderUid: msg.senderUid,
      recipientUid: msg.recipientUid,
      timestamp: msg.timestamp,
      type: 'text',
      plaintext,
      senderEnvelope: {
        algorithm: 'AES-256-GCM',
        ciphertext: msg.ciphertext,
        iv: msg.iv,
        keyId: session.sessionId,
        createdAt: msg.timestamp,
      },
      recipientEnvelope: {
        algorithm: 'AES-256-GCM',
        ciphertext: msg.ciphertext,
        iv: msg.iv,
        keyId: session.sessionId,
        createdAt: msg.timestamp,
      },
      signature: msg.signature,
      protocolVersion: msg.protocolVersion,
      status: 'delivered',
      senderFingerprint: msg.senderFingerprint,
    };

    // Update conversation
    let conv = this.conversations.get(msg.conversationId);
    if (!conv) {
      conv = {
        id: msg.conversationId,
        peerUid,
        peerIdentityFingerprint: peer.fingerprint,
        peerEncryptionPublicKey: peer.encryptionPublicKey,
        createdAt: Date.now(),
        updatedAt: msg.timestamp,
        verified: peer.verified,
        unreadCount: 1,
        p2pConnected: false,
        onlineStatus: 'online',
        lastMessageSnippet: plaintext,
        lastMessageTimestamp: msg.timestamp,
      };
      this.conversations.set(msg.conversationId, conv);
    } else {
      conv.lastMessageSnippet = plaintext;
      conv.lastMessageTimestamp = msg.timestamp;
      conv.updatedAt = msg.timestamp;
      conv.unreadCount = (conv.unreadCount || 0) + 1;
    }

    const current = this.messages.get(msg.conversationId) || [];
    current.push(storedMsg);
    this.messages.set(msg.conversationId, current);

    this.notifyMessages(msg.conversationId);
    this.notifyConversations();

    // 6. Send authenticated Delivery ACK back over DataChannel
    const ack: WireAck = {
      type: 'message-ack',
      messageId: msg.id,
      conversationId: msg.conversationId,
      senderUid: this.identity.uid,
      recipientUid: peerUid,
      status: 'delivered',
      timestamp: Date.now(),
    };
    dataChannelManager.send(peerUid, ack);

    // 7. Persist to storage
    await this.persistMessages(msg.conversationId);
    await this.persistConversations();
  }

  /**
   * Handle incoming ACK
   */
  private handleIncomingAck(ack: WireAck) {
    const list = this.messages.get(ack.conversationId);
    if (!list) return;

    const target = list.find((m) => m.id === ack.messageId);
    if (target) {
      target.status = ack.status;
      this.notifyMessages(ack.conversationId);
      this.persistMessages(ack.conversationId).catch(() => {});
    }
  }

  private handleConnectionStateChange(peerUid: string, state: ConnectionState) {
    this.notifyConnectionState(peerUid, state);
    const conv = Array.from(this.conversations.values()).find((c) => c.peerUid === peerUid);
    if (conv) {
      conv.p2pConnected = state === 'connected';
      if (state === 'connected') conv.onlineStatus = 'online';
      this.notifyConversations();
    }
  }

  private async updatePeerRecord(peerIdentity: PeerIdentity | PeerRecord) {
    const existing = this.peerRecords.get(peerIdentity.uid);
    const record: PeerRecord = {
      uid: peerIdentity.uid,
      identityPublicKey: peerIdentity.identityPublicKey,
      encryptionPublicKey: peerIdentity.encryptionPublicKey,
      fingerprint: peerIdentity.fingerprint,
      firstSeenAt: existing?.firstSeenAt || Date.now(),
      lastSeenAt: Date.now(),
      verified: peerIdentity.verified ?? existing?.verified ?? false,
      blocked: ('blocked' in peerIdentity ? peerIdentity.blocked : existing?.blocked) ?? false,
    };
    this.peerRecords.set(record.uid, record);

    const allPeers: Record<string, PeerRecord> = {};
    this.peerRecords.forEach((v, k) => {
      allPeers[k] = v;
    });
    await secureDataStorage.set('app:peers', allPeers);
  }

  public async setPeerVerified(peerUid: string, verified: boolean) {
    const peer = this.peerRecords.get(peerUid);
    if (peer) {
      peer.verified = verified;
      await this.updatePeerRecord(peer);
      const conv = Array.from(this.conversations.values()).find((c) => c.peerUid === peerUid);
      if (conv) {
        conv.verified = verified;
        await this.persistConversations();
        this.notifyConversations();
      }
    }
  }

  public async setPeerBlocked(peerUid: string, blocked: boolean) {
    const peer = this.peerRecords.get(peerUid);
    if (peer) {
      peer.blocked = blocked;
      await this.updatePeerRecord(peer);
      if (blocked) {
        peerConnectionManager.closeConnection(peerUid);
      }
      this.notifyConversations();
    }
  }

  public markConversationRead(conversationId: string) {
    const conv = this.conversations.get(conversationId);
    if (conv && conv.unreadCount > 0) {
      conv.unreadCount = 0;
      this.notifyConversations();
      this.persistConversations().catch(() => {});
    }
  }

  public async deleteConversation(conversationId: string) {
    this.conversations.delete(conversationId);
    this.messages.delete(conversationId);
    await secureDataStorage.remove(`app:messages:${conversationId}`);
    await this.persistConversations();
    this.notifyConversations();
  }

  private async persistConversations() {
    const list = Array.from(this.conversations.values());
    await secureDataStorage.set('app:conversations', list);
  }

  private async persistMessages(conversationId: string) {
    const list = this.messages.get(conversationId) || [];
    await secureDataStorage.set(`app:messages:${conversationId}`, list);
  }

  // Event dispatchers
  public onConversationsChange(handler: ConversationChangeHandler): () => void {
    this.conversationListeners.add(handler);
    handler(this.getConversations());
    return () => {
      this.conversationListeners.delete(handler);
    };
  }

  public onMessagesChange(handler: MessageChangeHandler): () => void {
    this.messageListeners.add(handler);
    return () => {
      this.messageListeners.delete(handler);
    };
  }

  public onKeyChange(handler: KeyChangeHandler): () => void {
    this.keyChangeListeners.add(handler);
    return () => {
      this.keyChangeListeners.delete(handler);
    };
  }

  public onConnectionStatus(handler: ConnectionStatusHandler): () => void {
    this.connectionListeners.add(handler);
    return () => {
      this.connectionListeners.delete(handler);
    };
  }

  private notifyConversations() {
    const list = this.getConversations();
    for (const h of this.conversationListeners) {
      try {
        h(list);
      } catch (err) {
        console.error('[ChatManager] Conversation listener exception:', err);
      }
    }
  }

  private notifyMessages(conversationId: string) {
    const list = this.messages.get(conversationId) || [];
    for (const h of this.messageListeners) {
      try {
        h(conversationId, list);
      } catch (err) {
        console.error('[ChatManager] Message listener exception:', err);
      }
    }
  }

  private notifyKeyChange(event: KeyChangeEvent) {
    for (const h of this.keyChangeListeners) {
      try {
        h(event);
      } catch (err) {
        console.error('[ChatManager] KeyChange listener exception:', err);
      }
    }
  }

  private notifyConnectionState(peerUid: string, state: ConnectionState) {
    for (const h of this.connectionListeners) {
      try {
        h(peerUid, state);
      } catch (err) {
        console.error('[ChatManager] Connection listener exception:', err);
      }
    }
  }
}

export const chatManager = new ChatManager();
