/**
 * CallManager
 * Orchestrates Audio & Video calling lifecycle, track negotiation, and call state transitions
 */

import { ActiveCall, CallState } from '@/src/types/webrtc';
import { mediaManager } from './MediaManager';
import { peerConnectionManager } from './PeerConnectionManager';
import { signalingClient } from '../signaling/SignalingClient';
import { chatManager } from '../chat/ChatManager';
import { packSecureTransportMessage } from '@/src/crypto/secureProtocol';

type CallChangeHandler = (call: ActiveCall | null) => void;

export class CallManager {
  private activeCall: ActiveCall | null = null;
  private localUid: string | null = null;
  private listeners: Set<CallChangeHandler> = new Set();
  private senders: RTCRtpSender[] = [];

  public setLocalUid(uid: string) {
    this.localUid = uid;
  }

  public getActiveCall(): ActiveCall | null {
    return this.activeCall;
  }

  public subscribe(handler: CallChangeHandler): () => void {
    this.listeners.add(handler);
    handler(this.activeCall);
    return () => {
      this.listeners.delete(handler);
    };
  }

  private notify() {
    for (const h of this.listeners) {
      h(this.activeCall ? { ...this.activeCall } : null);
    }
  }

  /**
   * Start an outgoing call
   */
  public async startCall(peerUid: string, callType: 'video' | 'audio'): Promise<void> {
    if (!this.localUid) throw new Error('Local identity not initialized');
    if (this.activeCall) throw new Error('A call is already active');

    const stream = await mediaManager.acquireMedia(callType === 'video', true);
    const pc = peerConnectionManager.getOrCreateConnection(peerUid);

    // Attach local media tracks
    this.senders = [];
    stream.getTracks().forEach((track) => {
      const sender = pc.addTrack(track, stream);
      this.senders.push(sender);
    });

    this.activeCall = {
      peerUid,
      callType,
      direction: 'outgoing',
      state: 'calling',
      localStream: stream,
      isAudioMuted: false,
      isVideoMuted: false,
    };
    this.notify();

    // Signal peer
    const identity = chatManager.getIdentity();
    const session = chatManager.getSession(peerUid);
    if (identity) {
      try {
        const securePacket = await packSecureTransportMessage({
          subType: 'call-invite',
          fromUid: this.localUid,
          toUid: peerUid,
          senderPrivateKey: identity.identityPrivateKey,
          senderFingerprint: identity.fingerprint,
          sessionKey: session?.sessionKey || null,
          innerData: { callType },
        });
        await signalingClient.send(securePacket);
        return;
      } catch (err) {
        console.warn('[CallManager] Failed to pack secure call-invite packet:', err);
      }
    }

    await signalingClient.send({
      type: 'call-invite',
      fromUid: this.localUid,
      toUid: peerUid,
      callType,
    });
  }

  /**
   * Handle incoming call invitation
   */
  public handleIncomingInvite(fromUid: string, callType: 'video' | 'audio') {
    if (this.activeCall) {
      // Busy: reject
      if (this.localUid) {
        signalingClient.send({
          type: 'call-reject',
          fromUid: this.localUid,
          toUid: fromUid,
          reason: 'User is on another call',
        }).catch(() => {});
      }
      return;
    }

    this.activeCall = {
      peerUid: fromUid,
      callType,
      direction: 'incoming',
      state: 'incoming',
      isAudioMuted: false,
      isVideoMuted: false,
    };
    this.notify();
  }

  /**
   * Accept an incoming call
   */
  public async acceptCall(): Promise<void> {
    if (!this.activeCall || this.activeCall.state !== 'incoming' || !this.localUid) return;

    const peerUid = this.activeCall.peerUid;
    const callType = this.activeCall.callType;

    const stream = await mediaManager.acquireMedia(callType === 'video', true);
    const pc = peerConnectionManager.getOrCreateConnection(peerUid);

    this.senders = [];
    stream.getTracks().forEach((track) => {
      const sender = pc.addTrack(track, stream);
      this.senders.push(sender);
    });

    this.activeCall = {
      ...this.activeCall,
      state: 'connected',
      startTime: Date.now(),
      localStream: stream,
    };
    this.notify();

    // Send call accept
    const acceptIdentity = chatManager.getIdentity();
    const acceptSession = chatManager.getSession(peerUid);
    if (acceptIdentity) {
      try {
        const securePacket = await packSecureTransportMessage({
          subType: 'call-accept',
          fromUid: this.localUid,
          toUid: peerUid,
          senderPrivateKey: acceptIdentity.identityPrivateKey,
          senderFingerprint: acceptIdentity.fingerprint,
          sessionKey: acceptSession?.sessionKey || null,
          innerData: {},
        });
        await signalingClient.send(securePacket);
      } catch (err) {
        console.warn('[CallManager] Failed to pack secure call-accept packet:', err);
        await signalingClient.send({
          type: 'call-accept',
          fromUid: this.localUid,
          toUid: peerUid,
        });
      }
    } else {
      await signalingClient.send({
        type: 'call-accept',
        fromUid: this.localUid,
        toUid: peerUid,
      });
    }

    // Answering side triggers renegotiation offer if needed
    await peerConnectionManager.createOffer(peerUid);
  }

  /**
   * Reject an incoming call
   */
  public async rejectCall(reason = 'Call declined'): Promise<void> {
    if (!this.activeCall || !this.localUid) return;
    const peerUid = this.activeCall.peerUid;

    const rejectIdentity = chatManager.getIdentity();
    const rejectSession = chatManager.getSession(peerUid);
    if (rejectIdentity) {
      try {
        const securePacket = await packSecureTransportMessage({
          subType: 'call-reject',
          fromUid: this.localUid,
          toUid: peerUid,
          senderPrivateKey: rejectIdentity.identityPrivateKey,
          senderFingerprint: rejectIdentity.fingerprint,
          sessionKey: rejectSession?.sessionKey || null,
          innerData: { reason },
        });
        await signalingClient.send(securePacket);
      } catch (err) {
        console.warn('[CallManager] Failed to pack secure call-reject packet:', err);
        await signalingClient.send({
          type: 'call-reject',
          fromUid: this.localUid,
          toUid: peerUid,
          reason,
        });
      }
    } else {
      await signalingClient.send({
        type: 'call-reject',
        fromUid: this.localUid,
        toUid: peerUid,
        reason,
      });
    }

    this.endLocalCall();
  }

  /**
   * Counterparty accepted call
   */
  public async handleCallAccepted(fromUid: string) {
    if (!this.activeCall || this.activeCall.peerUid !== fromUid) return;

    this.activeCall = {
      ...this.activeCall,
      state: 'connected',
      startTime: Date.now(),
    };
    this.notify();

    // Outgoing caller creates offer to negotiate media tracks
    await peerConnectionManager.createOffer(fromUid);
  }

  /**
   * Counterparty rejected or hung up
   */
  public handleCallRejected(fromUid: string) {
    if (!this.activeCall || this.activeCall.peerUid !== fromUid) return;
    this.endLocalCall();
  }

  public handleRemoteTrack(peerUid: string, event: RTCTrackEvent) {
    if (!this.activeCall || this.activeCall.peerUid !== peerUid) return;

    const remoteStream = event.streams[0] || new MediaStream([event.track]);
    this.activeCall = {
      ...this.activeCall,
      remoteStream,
    };
    this.notify();
  }

  public toggleAudio() {
    if (!this.activeCall) return;
    const nextMuted = !this.activeCall.isAudioMuted;
    mediaManager.toggleAudio(!nextMuted);
    this.activeCall.isAudioMuted = nextMuted;
    this.notify();
  }

  public toggleVideo() {
    if (!this.activeCall) return;
    const nextMuted = !this.activeCall.isVideoMuted;
    mediaManager.toggleVideo(!nextMuted);
    this.activeCall.isVideoMuted = nextMuted;
    this.notify();
  }

  public async endCall(): Promise<void> {
    if (!this.activeCall) return;
    const peerUid = this.activeCall.peerUid;
    if (this.localUid && peerUid) {
      const hangupIdentity = chatManager.getIdentity();
      const hangupSession = chatManager.getSession(peerUid);
      if (hangupIdentity) {
        try {
          const securePacket = await packSecureTransportMessage({
            subType: 'call-hangup',
            fromUid: this.localUid,
            toUid: peerUid,
            senderPrivateKey: hangupIdentity.identityPrivateKey,
            senderFingerprint: hangupIdentity.fingerprint,
            sessionKey: hangupSession?.sessionKey || null,
            innerData: {},
          });
          await signalingClient.send(securePacket);
        } catch (err) {
          console.warn('[CallManager] Failed to pack secure call-hangup packet:', err);
          signalingClient.send({
            type: 'call-hangup',
            fromUid: this.localUid,
            toUid: peerUid,
          }).catch(() => {});
        }
      } else {
        signalingClient.send({
          type: 'call-hangup',
          fromUid: this.localUid,
          toUid: peerUid,
        }).catch(() => {});
      }
    }
    this.endLocalCall();
  }

  private endLocalCall() {
    mediaManager.stopMedia();
    if (this.activeCall) {
      const pc = peerConnectionManager.getConnection(this.activeCall.peerUid);
      if (pc) {
        this.senders.forEach((sender) => {
          try {
            pc.removeTrack(sender);
          } catch {
            // Ignored
          }
        });
      }
    }
    this.senders = [];
    this.activeCall = null;
    this.notify();
  }
}

export const callManager = new CallManager();
