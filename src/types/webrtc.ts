/**
 * WebRTC & Call Types
 */

export type CallState =
  | 'idle'
  | 'calling' // Outgoing ringing
  | 'incoming' // Incoming ringing
  | 'connecting'
  | 'connected'
  | 'ended';

export interface ActiveCall {
  peerUid: string;
  callType: 'video' | 'audio';
  direction: 'incoming' | 'outgoing';
  state: CallState;
  startTime?: number;
  localStream?: MediaStream;
  remoteStream?: MediaStream;
  isAudioMuted: boolean;
  isVideoMuted: boolean;
}
