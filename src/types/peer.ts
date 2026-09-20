/**
 * Peer Identity and Trust Domain Types
 */

export interface PeerRecord {
  uid: string;
  identityPublicKey: string;
  encryptionPublicKey: string;
  fingerprint: string;
  firstSeenAt: number;
  lastSeenAt: number;
  verified: boolean;
  blocked: boolean;
  notes?: string;
}

export type ConnectionState =
  | 'idle'
  | 'discovering'
  | 'handshaking'
  | 'connecting'
  | 'connected'
  | 'reconnecting'
  | 'disconnected'
  | 'failed';
