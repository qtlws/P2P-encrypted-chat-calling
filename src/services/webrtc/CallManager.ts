/**
 * CallManager
 * Multi-party audio & video calling coordinator with P2P full mesh topology (up to 5 candidates),
 * call waiting, hold & merge capabilities, selective spotlight pinning, zoom controls,
 * and floating in-app picture-in-picture (PiP) window.
 */

import { ActiveCall, CallParticipant, HeldCallSession, CallWaitingInfo } from '@/src/types/webrtc';
import { mediaManager } from './MediaManager';
import { peerConnectionManager } from './PeerConnectionManager';
import { dataChannelManager } from './DataChannelManager';
import { signalingClient } from '../signaling/SignalingClient';

type CallChangeHandler = (call: ActiveCall | null) => void;

export const MAX_CALL_CANDIDATES = 5; // Maximum 5 candidates per call session

export class CallManager {
  private activeCall: ActiveCall | null = null;
  private localUid: string | null = null;
  private listeners: Set<CallChangeHandler> = new Set();
  private senders: Map<string, RTCRtpSender[]> = new Map();
  private onCallEndHandler: ((peerUid: string) => void) | null = null;

  public setOnCallEndHandler(handler: (peerUid: string) => void) {
    this.onCallEndHandler = handler;
  }

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
   * Start an outgoing call to a peer
   */
  public async startCall(peerUid: string, callType: 'video' | 'audio'): Promise<void> {
    if (!this.localUid) throw new Error('Local identity not initialized');
    if (this.activeCall && this.activeCall.state !== 'idle' && this.activeCall.state !== 'ended') {
      throw new Error('A call is already active');
    }

    // 1. Acquire local camera & microphone
    const stream = await mediaManager.acquireMedia(callType === 'video', true);

    // 2. Prepare RTCPeerConnection and attach DataChannel
    const pc = peerConnectionManager.createFreshConnectionForCall(peerUid);
    dataChannelManager.createDataChannel(peerUid, pc);

    // 3. Attach local media tracks
    const peerSenders: RTCRtpSender[] = [];
    stream.getTracks().forEach((track) => {
      const sender = pc.addTrack(track, stream);
      peerSenders.push(sender);
    });
    this.senders.set(peerUid, peerSenders);

    this.activeCall = {
      id: `call_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      peerUid,
      callType,
      direction: 'outgoing',
      state: 'calling',
      localStream: stream,
      isAudioMuted: false,
      isVideoMuted: false,
      participants: [
        {
          peerUid,
          joinedAt: Date.now(),
        },
      ],
      pinnedPeerUid: null,
      zoomLevel: 1.0,
      isMinimized: false,
      callWaiting: null,
      heldCalls: [],
      statusMessage: undefined,
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
    if (this.activeCall && this.activeCall.state !== 'idle' && this.activeCall.state !== 'ended') {
      // If already connected or incoming from the same peer, ignore duplicate invite
      if (this.activeCall.peerUid === fromUid || this.activeCall.participants.some((p) => p.peerUid === fromUid)) {
        return;
      }

      // Check candidate capacity limit (max 5 candidates)
      if (this.activeCall.participants.length >= MAX_CALL_CANDIDATES - 1) {
        if (this.localUid) {
          signalingClient.send({
            type: 'call-reject',
            fromUid: this.localUid,
            toUid: fromUid,
            reason: 'Call limit reached (maximum 5 participants)',
          }).catch(() => {});
        }
        return;
      }

      // Candidate is on another call: inform caller and show Call Waiting notification
      if (this.localUid) {
        signalingClient.send({
          type: 'call-busy-waiting',
          fromUid: this.localUid,
          toUid: fromUid,
          reason: 'Candidate is on another call... waiting',
        }).catch(() => {});
      }

      this.activeCall.callWaiting = {
        callerUid: fromUid,
        callType,
        timestamp: Date.now(),
      };
      this.notify();
      return;
    }

    this.activeCall = {
      id: `call_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      peerUid: fromUid,
      callType,
      direction: 'incoming',
      state: 'incoming',
      isAudioMuted: false,
      isVideoMuted: false,
      participants: [
        {
          peerUid: fromUid,
          joinedAt: Date.now(),
        },
      ],
      pinnedPeerUid: null,
      zoomLevel: 1.0,
      isMinimized: false,
      callWaiting: null,
      heldCalls: [],
      statusMessage: undefined,
    };
    this.notify();
  }

  /**
   * Called when the remote recipient is busy in another call
   */
  public handleCallBusyWaiting(fromUid: string, reason?: string) {
    if (!this.activeCall || this.activeCall.peerUid !== fromUid) return;
    this.activeCall.statusMessage = reason || 'Candidate is in another call... waiting';
    this.notify();
  }

  /**
   * Accept an incoming call (standard 1:1 or first call)
   */
  public async acceptCall(): Promise<void> {
    if (!this.activeCall || this.activeCall.state !== 'incoming' || !this.localUid) return;

    const peerUid = this.activeCall.peerUid;
    const callType = this.activeCall.callType;

    // 1. Acquire local camera & microphone
    const stream = await mediaManager.acquireMedia(callType === 'video', true);

    // 2. Prepare RTCPeerConnection
    const pc = peerConnectionManager.createFreshConnectionForCall(peerUid);

    // 3. Attach local media tracks
    const peerSenders: RTCRtpSender[] = [];
    stream.getTracks().forEach((track) => {
      const sender = pc.addTrack(track, stream);
      peerSenders.push(sender);
    });
    this.senders.set(peerUid, peerSenders);

    this.activeCall = {
      ...this.activeCall,
      state: 'connected',
      startTime: Date.now(),
      localStream: stream,
      statusMessage: undefined,
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
   * Decline incoming initial call
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
   * Accept incoming waiting call and put current ongoing call on hold
   */
  public async acceptCallWaitingAndHoldCurrent(): Promise<void> {
    if (!this.activeCall || !this.activeCall.callWaiting || !this.localUid) return;
    const waiting = this.activeCall.callWaiting;
    const newPeerUid = waiting.callerUid;
    const newCallType = waiting.callType;

    // 1. Put current active participants on hold
    const heldSession: HeldCallSession = {
      id: this.activeCall.id || `held_${Date.now()}`,
      peerUid: this.activeCall.peerUid,
      callType: this.activeCall.callType,
      participants: [...this.activeCall.participants],
      heldAt: Date.now(),
    };

    for (const p of this.activeCall.participants) {
      p.onHold = true;
      signalingClient.send({
        type: 'call-hold',
        fromUid: this.localUid,
        toUid: p.peerUid,
      }).catch(() => {});
    }

    // 2. Ensure media stream is active
    let stream = this.activeCall.localStream;
    if (!stream) {
      stream = await mediaManager.acquireMedia(newCallType === 'video', true);
    }

    // 3. Setup connection for new caller
    const pc = peerConnectionManager.createFreshConnectionForCall(newPeerUid);
    const peerSenders: RTCRtpSender[] = [];
    stream.getTracks().forEach((track) => {
      const sender = pc.addTrack(track, stream!);
      peerSenders.push(sender);
    });
    this.senders.set(newPeerUid, peerSenders);

    // 4. Update active call to the new peer
    this.activeCall = {
      ...this.activeCall,
      id: `call_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      peerUid: newPeerUid,
      callType: newCallType,
      direction: 'incoming',
      state: 'connected',
      startTime: Date.now(),
      localStream: stream,
      participants: [{ peerUid: newPeerUid, joinedAt: Date.now() }],
      pinnedPeerUid: null,
      zoomLevel: 1.0,
      callWaiting: null,
      heldCalls: [...(this.activeCall.heldCalls || []), heldSession],
      statusMessage: undefined,
    };
    this.notify();

    // 5. Send accept to the new caller
    await signalingClient.send({
      type: 'call-accept',
      fromUid: this.localUid,
      toUid: newPeerUid,
    });
  }

  /**
   * Decline waiting call
   */
  public async rejectCallWaiting(): Promise<void> {
    if (!this.activeCall || !this.activeCall.callWaiting || !this.localUid) return;
    const waiting = this.activeCall.callWaiting;
    this.activeCall.callWaiting = null;
    this.notify();

    await signalingClient.send({
      type: 'call-reject',
      fromUid: this.localUid,
      toUid: waiting.callerUid,
      reason: 'Call declined',
    });
  }

  /**
   * Merge waiting call directly into the active group call (up to 5 candidates)
   */
  public async mergeCallWaiting(): Promise<void> {
    if (!this.activeCall || !this.activeCall.callWaiting || !this.localUid) return;
    const waiting = this.activeCall.callWaiting;
    const newPeerUid = waiting.callerUid;

    // Check maximum 5 candidates limit
    if (this.activeCall.participants.length >= MAX_CALL_CANDIDATES - 1) {
      console.warn('[CallManager] Cannot merge: Maximum 5 candidates reached');
      return;
    }

    this.activeCall.callWaiting = null;

    // 1. Ensure local stream
    let stream = this.activeCall.localStream;
    if (!stream) {
      stream = await mediaManager.acquireMedia(this.activeCall.callType === 'video', true);
      this.activeCall.localStream = stream;
    }

    // 2. Prepare connection to new participant
    const pc = peerConnectionManager.createFreshConnectionForCall(newPeerUid);
    const peerSenders: RTCRtpSender[] = [];
    stream.getTracks().forEach((track) => {
      const sender = pc.addTrack(track, stream!);
      peerSenders.push(sender);
    });
    this.senders.set(newPeerUid, peerSenders);

    // 3. Existing participant UIDs before adding the new one
    const existingRemoteUids = this.activeCall.participants.map((p) => p.peerUid);

    // 4. Add new participant
    this.activeCall.participants.push({
      peerUid: newPeerUid,
      joinedAt: Date.now(),
    });
    this.notify();

    // 5. Accept new caller
    await signalingClient.send({
      type: 'call-accept',
      fromUid: this.localUid,
      toUid: newPeerUid,
    });

    // 6. Mesh coordination: Instruct all existing participants and new participant to connect
    const allParticipants = [this.localUid, ...existingRemoteUids, newPeerUid];
    for (const existingUid of existingRemoteUids) {
      // Existing peer initiates connection to new peer
      signalingClient.send({
        type: 'call-mesh-join',
        fromUid: this.localUid,
        toUid: existingUid,
        newPeerUid: newPeerUid,
        callType: this.activeCall.callType,
        shouldInitiate: true,
        allParticipants,
      }).catch(() => {});

      // New peer prepares to receive from existing peer
      signalingClient.send({
        type: 'call-mesh-join',
        fromUid: this.localUid,
        toUid: newPeerUid,
        newPeerUid: existingUid,
        callType: this.activeCall.callType,
        shouldInitiate: false,
        allParticipants,
      }).catch(() => {});
    }
  }

  /**
   * Merge a held call session into the active call
   */
  public async mergeHeldCall(heldSessionId?: string): Promise<void> {
    if (!this.activeCall || !this.localUid || this.activeCall.heldCalls.length === 0) return;

    const heldIndex = heldSessionId
      ? this.activeCall.heldCalls.findIndex((h) => h.id === heldSessionId)
      : 0;
    if (heldIndex === -1) return;

    const heldSession = this.activeCall.heldCalls[heldIndex];
    this.activeCall.heldCalls.splice(heldIndex, 1);

    const stream = this.activeCall.localStream;
    const currentRemoteUids = this.activeCall.participants.map((p) => p.peerUid);

    // Incorporate held participants up to MAX_CALL_CANDIDATES
    for (const heldPart of heldSession.participants) {
      if (this.activeCall.participants.length >= MAX_CALL_CANDIDATES - 1) break;
      if (!this.activeCall.participants.some((p) => p.peerUid === heldPart.peerUid)) {
        heldPart.onHold = false;
        this.activeCall.participants.push(heldPart);

        // Resume participant
        signalingClient.send({
          type: 'call-resume',
          fromUid: this.localUid,
          toUid: heldPart.peerUid,
        }).catch(() => {});

        // Setup/re-attach tracks if needed
        if (stream) {
          const pc = peerConnectionManager.getOrCreateConnection(heldPart.peerUid);
          const existingSenders = this.senders.get(heldPart.peerUid) || [];
          if (existingSenders.length === 0) {
            const newSenders: RTCRtpSender[] = [];
            stream.getTracks().forEach((track) => {
              newSenders.push(pc.addTrack(track, stream!));
            });
            this.senders.set(heldPart.peerUid, newSenders);
          }
        }

        // Mesh coordination between held peer and existing peers
        for (const existingUid of currentRemoteUids) {
          signalingClient.send({
            type: 'call-mesh-join',
            fromUid: this.localUid,
            toUid: existingUid,
            newPeerUid: heldPart.peerUid,
            callType: this.activeCall.callType,
            shouldInitiate: true,
          }).catch(() => {});

          signalingClient.send({
            type: 'call-mesh-join',
            fromUid: this.localUid,
            toUid: heldPart.peerUid,
            newPeerUid: existingUid,
            callType: this.activeCall.callType,
            shouldInitiate: false,
          }).catch(() => {});
        }
      }
    }

    this.notify();
  }

  /**
   * Switch/Resume a call that was put on hold
   */
  public async resumeHeldCall(heldSessionId?: string): Promise<void> {
    if (!this.activeCall || !this.localUid || this.activeCall.heldCalls.length === 0) return;

    const heldIndex = heldSessionId
      ? this.activeCall.heldCalls.findIndex((h) => h.id === heldSessionId)
      : 0;
    if (heldIndex === -1) return;

    const heldSession = this.activeCall.heldCalls[heldIndex];

    // Put current active participants on hold
    for (const p of this.activeCall.participants) {
      p.onHold = true;
      signalingClient.send({
        type: 'call-hold',
        fromUid: this.localUid,
        toUid: p.peerUid,
      }).catch(() => {});
    }

    const currentHeld: HeldCallSession = {
      id: this.activeCall.id || `held_${Date.now()}`,
      peerUid: this.activeCall.peerUid,
      callType: this.activeCall.callType,
      participants: [...this.activeCall.participants],
      heldAt: Date.now(),
    };

    // Swap held call to active
    this.activeCall.heldCalls.splice(heldIndex, 1);
    this.activeCall.heldCalls.push(currentHeld);

    this.activeCall.peerUid = heldSession.peerUid;
    this.activeCall.callType = heldSession.callType;
    this.activeCall.participants = heldSession.participants.map((p) => ({ ...p, onHold: false }));

    // Resume the held participants
    for (const p of this.activeCall.participants) {
      signalingClient.send({
        type: 'call-resume',
        fromUid: this.localUid,
        toUid: p.peerUid,
      }).catch(() => {});
    }

    this.notify();
  }

  /**
   * Proactively add a new candidate to the active call (up to 5 candidates total)
   */
  public async addParticipantToCall(newPeerUid: string): Promise<void> {
    if (!this.localUid) throw new Error('Local identity not initialized');
    if (!this.activeCall || (this.activeCall.state !== 'connected' && this.activeCall.state !== 'calling')) {
      throw new Error('No active call to add candidate to');
    }

    if (newPeerUid === this.localUid) {
      throw new Error('Cannot add yourself to the call');
    }

    // Check capacity limit: 1 local + up to 4 remote = 5 total candidates
    if (this.activeCall.participants.length >= MAX_CALL_CANDIDATES - 1) {
      throw new Error('Call is at maximum capacity (5 candidates)');
    }

    // Check if candidate is already in call
    if (this.activeCall.participants.some((p) => p.peerUid === newPeerUid)) {
      throw new Error('Candidate is already in this call');
    }

    // Ensure local stream is active
    let stream = this.activeCall.localStream;
    if (!stream) {
      stream = await mediaManager.acquireMedia(this.activeCall.callType === 'video', true);
      this.activeCall.localStream = stream;
    }

    // Prepare connection & DataChannel
    const pc = peerConnectionManager.createFreshConnectionForCall(newPeerUid);
    dataChannelManager.createDataChannel(newPeerUid, pc);

    // Attach local media tracks
    const peerSenders: RTCRtpSender[] = [];
    stream.getTracks().forEach((track) => {
      const sender = pc.addTrack(track, stream!);
      peerSenders.push(sender);
    });
    this.senders.set(newPeerUid, peerSenders);

    // Add candidate to participants list
    this.activeCall.participants.push({
      peerUid: newPeerUid,
      joinedAt: Date.now(),
    });
    this.notify();

    // Send call invite to the new candidate
    await signalingClient.send({
      type: 'call-invite',
      fromUid: this.localUid,
      toUid: newPeerUid,
      callType: this.activeCall.callType,
    });
  }

  /**
   * Counterparty accepted call -> Caller initiates WebRTC offer and meshes other participants
   */
  public async handleCallAccepted(fromUid: string) {
    if (!this.activeCall) return;

    // Check if participant already in list
    const participant = this.activeCall.participants.find((p) => p.peerUid === fromUid);
    if (!participant) {
      this.activeCall.participants.push({
        peerUid: fromUid,
        joinedAt: Date.now(),
      });
    }

    this.activeCall.state = 'connected';
    this.activeCall.startTime = this.activeCall.startTime || Date.now();
    this.activeCall.statusMessage = undefined;
    this.notify();

    // Outgoing caller creates offer to negotiate audio/video tracks
    await peerConnectionManager.createOffer(fromUid);

    // If there are other remote participants already in the call, coordinate mesh:
    const otherParticipants = this.activeCall.participants.filter((p) => p.peerUid !== fromUid);
    if (otherParticipants.length > 0 && this.localUid) {
      const allParticipants = [this.localUid, ...this.activeCall.participants.map((p) => p.peerUid)];
      for (const other of otherParticipants) {
        signalingClient.send({
          type: 'call-mesh-join',
          fromUid: this.localUid,
          toUid: other.peerUid,
          newPeerUid: fromUid,
          callType: this.activeCall.callType,
          shouldInitiate: true,
          allParticipants,
        }).catch(() => {});

        signalingClient.send({
          type: 'call-mesh-join',
          fromUid: this.localUid,
          toUid: fromUid,
          newPeerUid: other.peerUid,
          callType: this.activeCall.callType,
          shouldInitiate: false,
          allParticipants,
        }).catch(() => {});
      }
    }
  }

  /**
   * Counterparty rejected or hung up
   */
  public handleCallRejected(fromUid: string) {
    if (!this.activeCall) return;

    // If waiting caller was rejected
    if (this.activeCall.callWaiting && this.activeCall.callWaiting.callerUid === fromUid) {
      this.activeCall.callWaiting = null;
      this.notify();
      return;
    }

    // In a multi-party call, if one participant hangs up, remove them while keeping the call alive
    if (this.activeCall.participants.length > 1) {
      this.activeCall.participants = this.activeCall.participants.filter((p) => p.peerUid !== fromUid);
      if (this.activeCall.pinnedPeerUid === fromUid) {
        this.activeCall.pinnedPeerUid = null;
        this.activeCall.zoomLevel = 1.0;
      }
      if (this.activeCall.peerUid === fromUid && this.activeCall.participants.length > 0) {
        this.activeCall.peerUid = this.activeCall.participants[0].peerUid;
      }
      const pc = peerConnectionManager.getConnection(fromUid);
      if (pc && pc.connectionState !== 'closed' && pc.signalingState !== 'closed') {
        const senders = this.senders.get(fromUid) || [];
        for (const sender of senders) {
          try { pc.removeTrack(sender); } catch {}
        }
      }
      this.senders.delete(fromUid);
      if (this.onCallEndHandler) {
        this.onCallEndHandler(fromUid);
      }
      this.notify();
      return;
    }

    // If 1:1 call or last participant
    this.endLocalCall();
  }

  /**
   * Handle remote peer putting call on hold
   */
  public handleRemoteHold(fromUid: string) {
    if (!this.activeCall) return;
    const participant = this.activeCall.participants.find((p) => p.peerUid === fromUid);
    if (participant) {
      participant.onHold = true;
    }
    if (this.activeCall.participants.length <= 1) {
      this.activeCall.state = 'on-hold';
    }
    this.notify();
  }

  /**
   * Handle remote peer resuming call from hold
   */
  public handleRemoteResume(fromUid: string) {
    if (!this.activeCall) return;
    const participant = this.activeCall.participants.find((p) => p.peerUid === fromUid);
    if (participant) {
      participant.onHold = false;
    }
    if (this.activeCall.state === 'on-hold') {
      this.activeCall.state = 'connected';
    }
    this.notify();
  }

  /**
   * Handle participant leaving the mesh
   */
  public handleParticipantLeft(peerUid: string) {
    this.handleCallRejected(peerUid);
  }

  /**
   * Mesh join invitation received from group call coordinator
   */
  public async handleMeshJoin(fromUid: string, payload: any) {
    if (!this.activeCall || !this.localUid) return;
    const newPeerUid = payload.newPeerUid;
    if (!newPeerUid || newPeerUid === this.localUid) return;

    // Check candidate limit
    if (this.activeCall.participants.length >= MAX_CALL_CANDIDATES - 1) {
      return;
    }

    // Add to participants if not present
    let participant = this.activeCall.participants.find((p) => p.peerUid === newPeerUid);
    if (!participant) {
      participant = {
        peerUid: newPeerUid,
        joinedAt: Date.now(),
      };
      this.activeCall.participants.push(participant);
      this.notify();
    }

    // Ensure connection & attach local tracks
    const pc = peerConnectionManager.getOrCreateConnection(newPeerUid);
    dataChannelManager.createDataChannel(newPeerUid, pc);

    if (this.activeCall.localStream) {
      const existingSenders = this.senders.get(newPeerUid) || [];
      if (existingSenders.length === 0) {
        const newSenders: RTCRtpSender[] = [];
        this.activeCall.localStream.getTracks().forEach((track) => {
          newSenders.push(pc.addTrack(track, this.activeCall!.localStream!));
        });
        this.senders.set(newPeerUid, newSenders);
      }
    }

    // Deterministic arbitration or explicit initiator flag
    if (payload.shouldInitiate) {
      await peerConnectionManager.createOffer(newPeerUid);
    }
  }

  /**
   * Handle incoming remote audio/video tracks
   */
  public handleRemoteTrack(peerUid: string, event: RTCTrackEvent) {
    if (!this.activeCall) return;

    let participant = this.activeCall.participants.find((p) => p.peerUid === peerUid);
    if (!participant) {
      participant = {
        peerUid,
        joinedAt: Date.now(),
      };
      this.activeCall.participants.push(participant);
    }

    const stream =
      event.streams && event.streams[0]
        ? event.streams[0]
        : participant.stream || new MediaStream();

    if (!stream.getTracks().some((t) => t.id === event.track.id)) {
      stream.addTrack(event.track);
    }

    // Ensure audio track is enabled
    event.track.enabled = true;

    // Create fresh MediaStream reference so React state updates trigger playback
    const freshStream = new MediaStream(stream.getTracks());
    participant.stream = freshStream;

    // Set primary remote stream if matching or unset
    if (this.activeCall.peerUid === peerUid || !this.activeCall.remoteStream) {
      this.activeCall.remoteStream = freshStream;
    }

    this.activeCall.state = 'connected';
    this.notify();
  }

  /**
   * Toggle Pin Spotlight for a participant or local video
   */
  public togglePin(peerUid: string) {
    if (!this.activeCall) return;
    if (this.activeCall.pinnedPeerUid === peerUid) {
      this.activeCall.pinnedPeerUid = null;
      this.activeCall.zoomLevel = 1.0;
    } else {
      this.activeCall.pinnedPeerUid = peerUid;
      this.activeCall.zoomLevel = 1.0;
    }
    this.notify();
  }

  /**
   * Set Zoom Level for pinned spotlight (1.0x to 3.0x)
   */
  public setZoomLevel(level: number) {
    if (!this.activeCall) return;
    const clamped = Math.min(3.0, Math.max(1.0, Math.round(level * 100) / 100));
    this.activeCall.zoomLevel = clamped;
    this.notify();
  }

  /**
   * Toggle Picture-in-Picture / Pop-up minimization
   */
  public toggleMinimize() {
    if (!this.activeCall) return;
    this.activeCall.isMinimized = !this.activeCall.isMinimized;
    this.notify();
  }

  public setMinimized(minimized: boolean) {
    if (!this.activeCall) return;
    this.activeCall.isMinimized = minimized;
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
    if (this.localUid) {
      for (const p of this.activeCall.participants) {
        signalingClient.send({
          type: 'call-hangup',
          fromUid: this.localUid,
          toUid: p.peerUid,
        }).catch(() => {});
      }
      for (const held of this.activeCall.heldCalls) {
        for (const p of held.participants) {
          signalingClient.send({
            type: 'call-hangup',
            fromUid: this.localUid,
            toUid: p.peerUid,
          }).catch(() => {});
        }
      }
    }
    this.endLocalCall();
  }

  private endLocalCall() {
    const participants = this.activeCall ? [...this.activeCall.participants] : [];
    mediaManager.stopMedia();

    for (const p of participants) {
      const pc = peerConnectionManager.getConnection(p.peerUid);
      if (pc && pc.connectionState !== 'closed' && pc.signalingState !== 'closed') {
        const senders = this.senders.get(p.peerUid) || [];
        for (const sender of senders) {
          try { pc.removeTrack(sender); } catch {}
        }
      }
      if (this.onCallEndHandler) {
        this.onCallEndHandler(p.peerUid);
      }
    }

    this.senders.clear();
    this.activeCall = null;
    this.notify();
  }
}

export const callManager = new CallManager();
