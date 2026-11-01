/**
 * CallManager
 * Orchestrates Audio & Video calling lifecycle, track negotiation, and call state transitions
 */

import { ActiveCall } from '@/src/types/webrtc';
import { mediaManager } from './MediaManager';
import { peerConnectionManager } from './PeerConnectionManager';
import { dataChannelManager } from './DataChannelManager';
import { signalingClient } from '../signaling/SignalingClient';

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
    handler(this.activeCall ? { ...this.activeCall } : null);
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

    // 1. Acquire local user camera & microphone
    const stream = await mediaManager.acquireMedia(callType === 'video', true);

    // 2. Prepare a pristine RTCPeerConnection and attach DataChannel
    const pc = peerConnectionManager.createFreshConnectionForCall(peerUid);
    dataChannelManager.createDataChannel(peerUid, pc);

    // 3. Attach local media tracks
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

    // 4. Send call invite
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
      // If already connected or incoming from the same peer, ignore duplicate invite
      if (this.activeCall.peerUid === fromUid) {
        return;
      }
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

    // 1. Acquire local user camera & microphone
    const stream = await mediaManager.acquireMedia(callType === 'video', true);

    // 2. Prepare RTCPeerConnection (candidate queue is preserved)
    const pc = peerConnectionManager.createFreshConnectionForCall(peerUid);

    // 3. Attach local media tracks
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

    // 4. Send call accept to caller
    await signalingClient.send({
      type: 'call-accept',
      fromUid: this.localUid,
      toUid: peerUid,
    });
  }

  /**
   * Reject an incoming call
   */
  public async rejectCall(reason = 'Call declined'): Promise<void> {
    if (!this.activeCall || !this.localUid) return;
    const peerUid = this.activeCall.peerUid;

    await signalingClient.send({
      type: 'call-reject',
      fromUid: this.localUid,
      toUid: peerUid,
      reason,
    });

    this.endLocalCall();
  }

  /**
   * Counterparty accepted call -> Caller initiates WebRTC offer
   */
  public async handleCallAccepted(fromUid: string) {
    if (!this.activeCall || this.activeCall.peerUid !== fromUid) return;

    // If call is already connected, avoid re-triggering offer creation
    if (this.activeCall.state === 'connected') {
      console.log(`[CallManager] Call with ${fromUid} already marked connected, skipping duplicate offer`);
      return;
    }

    this.activeCall = {
      ...this.activeCall,
      state: 'connected',
      startTime: Date.now(),
    };
    this.notify();

    // Outgoing caller creates offer to negotiate audio/video tracks
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

    const stream =
      event.streams && event.streams[0]
        ? event.streams[0]
        : this.activeCall.remoteStream || new MediaStream();

    if (!stream.getTracks().some((t) => t.id === event.track.id)) {
      stream.addTrack(event.track);
    }

    this.activeCall = {
      ...this.activeCall,
      state: 'connected',
      remoteStream: stream,
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
      signalingClient.send({
        type: 'call-hangup',
        fromUid: this.localUid,
        toUid: peerUid,
      }).catch(() => {});
    }
    this.endLocalCall();
  }

  private endLocalCall() {
    const peerUid = this.activeCall?.peerUid;
    mediaManager.stopMedia();
    this.senders = [];
    this.activeCall = null;
    if (peerUid) {
      peerConnectionManager.closeConnection(peerUid, true);
    }
    this.notify();
  }
}

export const callManager = new CallManager();
