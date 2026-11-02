/**
 * WebRTC & Call Types
 */

export type CallState =
  | 'idle'
  | 'calling' // Outgoing ringing
  | 'incoming' // Incoming ringing
  | 'connecting'
  | 'connected'
  | 'on-hold'
  | 'ended';

export interface CallParticipant {
  peerUid: string;
  stream?: MediaStream;
  isAudioMuted?: boolean;
  isVideoMuted?: boolean;
  onHold?: boolean;
  isHost?: boolean;
  joinedAt?: number;
}

export interface CallWaitingInfo {
  callerUid: string;
  callType: 'video' | 'audio';
  timestamp: number;
}

export interface HeldCallSession {
  id: string;
  peerUid: string;
  callType: 'video' | 'audio';
  participants: CallParticipant[];
  heldAt: number;
}

export interface ActiveCall {
  id?: string;
  peerUid: string; // Primary peer UID (or initiator)
  callType: 'video' | 'audio';
  direction: 'incoming' | 'outgoing';
  state: CallState;
  startTime?: number;
  localStream?: MediaStream;
  remoteStream?: MediaStream;
  isAudioMuted: boolean;
  isVideoMuted: boolean;

  // Multi-party calling support (up to 5 candidates)
  participants: CallParticipant[];

  // Selective pin & zoom view
  pinnedPeerUid: string | null;
  zoomLevel: number; // 1.0 to 3.0

  // Pop-up / In-App PiP window
  isMinimized: boolean;

  // Call waiting & on-hold support
  callWaiting: CallWaitingInfo | null;
  heldCalls: HeldCallSession[];
  statusMessage?: string;
}

