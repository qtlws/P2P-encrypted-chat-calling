/**
 * Signaling Server and Protocol Types
 */

import { HandshakePayload } from '@/src/crypto/types';
import { SecureTransportPacket } from '@/src/crypto/secureProtocol';

export type SignalMessage =
  | SecureTransportPacket
  | {
      type: 'connected';
      uid?: string;
      timestamp?: number;
    }
  | {
      type: 'ping';
      timestamp?: number;
    }
  | {
      type: 'presence';
      uid: string;
      timestamp?: number;
    }
  | {
      type: 'chat-message';
      fromUid: string;
      toUid: string;
      payload: any;
    }
  | {
      type: 'peer-request';
      fromUid: string;
      toUid: string;
    }
  | {
      type: 'handshake-init';
      fromUid: string;
      toUid: string;
      payload: HandshakePayload;
    }
  | {
      type: 'handshake-ack';
      fromUid: string;
      toUid: string;
      payload: HandshakePayload;
    }
  | {
      type: 'offer';
      fromUid: string;
      toUid: string;
      sdp: RTCSessionDescriptionInit;
    }
  | {
      type: 'answer';
      fromUid: string;
      toUid: string;
      sdp: RTCSessionDescriptionInit;
    }
  | {
      type: 'ice-candidate';
      fromUid: string;
      toUid: string;
      candidate: RTCIceCandidateInit;
    }
  | {
      type: 'call-invite';
      fromUid: string;
      toUid: string;
      callType: 'video' | 'audio';
    }
  | {
      type: 'call-accept';
      fromUid: string;
      toUid: string;
    }
  | {
      type: 'call-reject';
      fromUid: string;
      toUid: string;
      reason?: string;
    }
  | {
      type: 'call-hangup';
      fromUid: string;
      toUid: string;
    }
  | {
      type: 'call-busy-waiting';
      fromUid: string;
      toUid: string;
      reason?: string;
    }
  | {
      type: 'call-hold';
      fromUid: string;
      toUid: string;
    }
  | {
      type: 'call-resume';
      fromUid: string;
      toUid: string;
    }
  | {
      type: 'call-mesh-join';
      fromUid: string;
      toUid: string;
      newPeerUid: string;
      callType: 'video' | 'audio';
      shouldInitiate?: boolean;
      allParticipants?: string[];
    }
  | {
      type: 'call-participant-left';
      fromUid: string;
      toUid: string;
      peerUid: string;
    }
  | {
      type: 'peer-offline';
      targetUid: string;
    }
  | {
      type: 'chat-delete-both';
      fromUid: string;
      toUid: string;
      conversationId: string;
    };

