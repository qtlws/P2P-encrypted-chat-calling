/**
 * Chat and Message Domain Types
 */

import { EncryptedEnvelope } from '@/src/crypto/types';

export interface StoredMessage {
  id: string; // Unique UUID
  conversationId: string; // Canonical conversation hash
  senderUid: string;
  recipientUid: string;
  timestamp: number;
  type: 'text';
  plaintext?: string; // Populated only in memory while UI is active; NEVER persisted in plaintext
  senderEnvelope: EncryptedEnvelope; // Encrypted with sender's local storage key
  recipientEnvelope: EncryptedEnvelope; // Encrypted with shared session key
  signature: string; // Ed25519 signature
  protocolVersion: number;
  status: 'sending' | 'sent' | 'delivered' | 'failed';
  senderFingerprint: string;
}

export interface Conversation {
  id: string; // Canonical conversation hash
  peerUid: string;
  peerIdentityFingerprint: string;
  peerEncryptionPublicKey: string;
  lastMessageSnippet?: string;
  lastMessageTimestamp?: number;
  createdAt: number;
  updatedAt: number;
  verified: boolean;
  unreadCount: number;
  onlineStatus?: 'online' | 'offline';
  p2pConnected?: boolean;
}
