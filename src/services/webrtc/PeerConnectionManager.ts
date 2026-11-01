/**
 * PeerConnectionManager
 * Manages RTCPeerConnection instances, STUN/TURN ice servers, SDP negotiation, and ICE candidates
 */

import { signalingClient } from '../signaling/SignalingClient';
import { ConnectionState } from '@/src/types/peer';
import { getActiveIceServers } from '@/src/config/coturn';

type StateChangeHandler = (peerUid: string, state: ConnectionState) => void;
type TrackHandler = (peerUid: string, event: RTCTrackEvent) => void;
type DataChannelCreatedHandler = (peerUid: string, channel: RTCDataChannel) => void;

export class PeerConnectionManager {
  private connections = new Map<string, RTCPeerConnection>();
  private pendingCandidates = new Map<string, RTCIceCandidateInit[]>();
  private localUid: string | null = null;
  private onStateChange: StateChangeHandler | null = null;
  private onTrack: TrackHandler | null = null;
  private onDataChannel: DataChannelCreatedHandler | null = null;
  private cachedIceServers: RTCIceServer[] | null = null;
  private makingOffer = new Map<string, boolean>();
  private operationQueues = new Map<string, Promise<unknown>>();

  constructor() {
    this.fetchRemoteIceServers();
  }

  private isPolitePeer(peerUid: string): boolean {
    if (!this.localUid) return false;
    return this.localUid < peerUid;
  }

  private enqueueOperation<T>(peerUid: string, fn: () => Promise<T>): Promise<T> {
    const prev = this.operationQueues.get(peerUid) || Promise.resolve();
    const next = prev
      .catch(() => {})
      .then(fn);
    this.operationQueues.set(peerUid, next as Promise<unknown>);
    return next;
  }

  public async fetchRemoteIceServers(): Promise<RTCIceServer[]> {
    if (typeof window === 'undefined') {
      return getActiveIceServers();
    }
    try {
      const res = await fetch('/api/ice-servers');
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data.iceServers) && data.iceServers.length > 0) {
          this.cachedIceServers = data.iceServers;
          return data.iceServers;
        }
      }
    } catch {
      // Fallback
    }
    this.cachedIceServers = getActiveIceServers();
    return this.cachedIceServers;
  }

  public getRtcConfig(): RTCConfiguration {
    return {
      iceServers: this.cachedIceServers && this.cachedIceServers.length > 0
        ? this.cachedIceServers
        : getActiveIceServers(),
      iceTransportPolicy: 'all',
    };
  }

  public setLocalUid(uid: string) {
    this.localUid = uid;
  }

  public setCallbacks(
    onStateChange: StateChangeHandler,
    onTrack: TrackHandler,
    onDataChannel: DataChannelCreatedHandler
  ) {
    this.onStateChange = onStateChange;
    this.onTrack = onTrack;
    this.onDataChannel = onDataChannel;
  }

  /**
   * Resets and creates a fresh RTCPeerConnection for a new call session
   * Preserves pending candidate queue so early arriving ICE signals are not discarded.
   */
  public createFreshConnectionForCall(peerUid: string): RTCPeerConnection {
    const existing = this.connections.get(peerUid);
    if (existing) {
      try { existing.close(); } catch {}
      this.connections.delete(peerUid);
    }
    this.operationQueues.delete(peerUid);
    return this.getOrCreateConnection(peerUid);
  }

  public getOrCreateConnection(peerUid: string): RTCPeerConnection {
    const existing = this.connections.get(peerUid);
    if (
      existing &&
      existing.connectionState !== 'closed' &&
      existing.connectionState !== 'failed' &&
      existing.signalingState !== 'closed'
    ) {
      return existing;
    }

    if (existing) {
      try { existing.close(); } catch {}
      this.connections.delete(peerUid);
    }

    const pc = new RTCPeerConnection(this.getRtcConfig());
    this.connections.set(peerUid, pc);

    pc.onicecandidate = async (event) => {
      if (event.candidate && this.localUid) {
        const candidateData = event.candidate.toJSON();
        signalingClient.send({
          type: 'ice-candidate',
          fromUid: this.localUid,
          toUid: peerUid,
          candidate: candidateData,
        }).catch(() => {});
      }
    };

    const updateConnectionState = () => {
      const isConnected =
        pc.connectionState === 'connected' ||
        pc.iceConnectionState === 'connected' ||
        pc.iceConnectionState === 'completed';
      const isFailed =
        pc.connectionState === 'failed' ||
        pc.iceConnectionState === 'failed';
      const isConnecting =
        pc.connectionState === 'connecting' ||
        pc.iceConnectionState === 'checking';

      let state: ConnectionState = 'disconnected';
      if (isConnected) state = 'connected';
      else if (isFailed) state = 'failed';
      else if (isConnecting) state = 'connecting';

      if (this.onStateChange) {
        this.onStateChange(peerUid, state);
      }
    };

    pc.onconnectionstatechange = updateConnectionState;
    pc.oniceconnectionstatechange = updateConnectionState;

    pc.ontrack = (event) => {
      if (this.onTrack) {
        this.onTrack(peerUid, event);
      }
    };

    pc.ondatachannel = (event) => {
      if (this.onDataChannel) {
        this.onDataChannel(peerUid, event.channel);
      }
    };

    return pc;
  }

  public async createOffer(peerUid: string): Promise<RTCSessionDescriptionInit | null> {
    return this.enqueueOperation(peerUid, async () => {
      const pc = this.getOrCreateConnection(peerUid);
      if (pc.signalingState === 'closed') return null;

      // If already in have-local-offer, we already have a pending offer waiting for answer
      if (pc.signalingState === 'have-local-offer' && pc.localDescription) {
        console.log(`[PeerConnectionManager] An offer is already active for peer ${peerUid}`);
        return pc.localDescription;
      }

      // If remote peer already sent an offer and we are in have-remote-offer:
      // Peer is the answerer for this negotiation cycle, so createOffer cannot be called
      if (pc.signalingState === 'have-remote-offer') {
        console.log(`[PeerConnectionManager] Peer ${peerUid} is in have-remote-offer (answerer), skipping createOffer`);
        return null;
      }

      // W3C WebRTC: createOffer requires stable state
      if (pc.signalingState !== 'stable') {
        console.log(`[PeerConnectionManager] Skipping createOffer: signalingState is ${pc.signalingState}`);
        return null;
      }

      this.makingOffer.set(peerUid, true);

      try {
        const offer = await pc.createOffer({
          offerToReceiveAudio: true,
          offerToReceiveVideo: true,
        });

        const currentSignalingState = pc.signalingState as RTCSignalingState;
        if (currentSignalingState === 'closed' || pc.connectionState === 'closed') return null;

        if (currentSignalingState !== 'stable' && currentSignalingState !== 'have-local-offer') {
          console.log(`[PeerConnectionManager] State changed to ${currentSignalingState} during createOffer, aborting setLocalDescription`);
          return null;
        }

        await pc.setLocalDescription(offer);
        const localDesc = pc.localDescription || offer;

        if (this.localUid) {
          await signalingClient.send({
            type: 'offer',
            fromUid: this.localUid,
            toUid: peerUid,
            sdp: localDesc,
          });
        }

        return localDesc;
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        if (msg.includes('cannot create an offer in a state other than stable')) {
          console.log(`[PeerConnectionManager] createOffer safely skipped: signalingState was ${pc.signalingState}`);
        } else {
          console.error('[PeerConnectionManager] Error creating offer:', err);
        }
        return null;
      } finally {
        this.makingOffer.set(peerUid, false);
      }
    });
  }

  public async handleOffer(
    peerUid: string,
    sdp: RTCSessionDescriptionInit
  ): Promise<RTCSessionDescriptionInit | null> {
    return this.enqueueOperation(peerUid, async () => {
      const pc = this.getOrCreateConnection(peerUid);
      if (!sdp || !sdp.sdp || pc.signalingState === 'closed') {
        return null;
      }

      try {
        // 1. Duplicate offer check: if this exact offer is already set as remoteDescription
        if (pc.remoteDescription?.sdp === sdp.sdp) {
          console.log(`[PeerConnectionManager] Duplicate offer already applied for ${peerUid}`);
          if (pc.localDescription) {
            if (this.localUid) {
              signalingClient.send({
                type: 'answer',
                fromUid: this.localUid,
                toUid: peerUid,
                sdp: pc.localDescription,
              }).catch(() => {});
            }
            return pc.localDescription;
          }
        }

        // 2. Glare handling: Perfect Negotiation with polite peer arbitration
        const isMakingOffer = !!this.makingOffer.get(peerUid);
        const isOfferCollision = pc.signalingState !== 'stable' || isMakingOffer;
        const isPolite = this.isPolitePeer(peerUid);

        if (isOfferCollision) {
          if (!isPolite) {
            console.log(`[PeerConnectionManager] Glare collision detected. Impolite peer ignoring offer from ${peerUid}`);
            return null;
          }

          // Polite peer: roll back our own local offer if we have one
          if (pc.signalingState === 'have-local-offer') {
            try {
              await pc.setLocalDescription({ type: 'rollback' });
            } catch (e) {
              console.warn('[PeerConnectionManager] Rollback of local offer:', e);
            }
          }
        }

        // 3. Set remote description
        if (pc.signalingState !== 'stable' && pc.signalingState !== 'have-local-offer') {
          console.log(`[PeerConnectionManager] Skipping handleOffer: signalingState is ${pc.signalingState}`);
          return null;
        }

        try {
          await pc.setRemoteDescription(new RTCSessionDescription(sdp));
        } catch (setRemoteErr: unknown) {
          const errStr = setRemoteErr instanceof Error ? setRemoteErr.message : String(setRemoteErr);
          if (errStr.includes('Called in wrong state')) {
            console.log(`[PeerConnectionManager] Remote description already active for ${peerUid}`);
            return pc.localDescription;
          }
          throw setRemoteErr;
        }

        await this.drainPendingCandidates(peerUid, pc);

        // 4. Create answer - only legal in have-remote-offer
        const stateBeforeAnswer = pc.signalingState as RTCSignalingState;
        if (stateBeforeAnswer !== 'have-remote-offer') {
          console.log(`[PeerConnectionManager] Expected have-remote-offer, currently ${stateBeforeAnswer}. Skipping answer creation.`);
          return pc.localDescription;
        }

        const answer = await pc.createAnswer();

        // 5. Set local description - ensure state is strictly have-remote-offer
        const stateBeforeLocalDesc = pc.signalingState as RTCSignalingState;
        if (stateBeforeLocalDesc !== 'have-remote-offer') {
          console.log(`[PeerConnectionManager] State changed to ${stateBeforeLocalDesc} before setLocalDescription(answer). Skipping.`);
          return pc.localDescription;
        }

        await pc.setLocalDescription(answer);
        const localDesc = pc.localDescription || answer;

        if (this.localUid) {
          await signalingClient.send({
            type: 'answer',
            fromUid: this.localUid,
            toUid: peerUid,
            sdp: localDesc,
          });
        }

        return localDesc;
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        if (msg.includes('Called in wrong state: stable')) {
          console.log(`[PeerConnectionManager] Offer already answered or settled for ${peerUid} (stable state)`);
          return pc.localDescription;
        }
        console.error('[PeerConnectionManager] Error handling offer:', err);
        return null;
      }
    });
  }

  public async handleAnswer(
    peerUid: string,
    sdp: RTCSessionDescriptionInit
  ): Promise<void> {
    return this.enqueueOperation(peerUid, async () => {
      const pc = this.connections.get(peerUid);
      if (!pc || !sdp || !sdp.sdp || pc.signalingState === 'closed') return;

      // Duplicate answer check
      if (pc.remoteDescription?.sdp === sdp.sdp) {
        console.log(`[PeerConnectionManager] Answer already applied for ${peerUid}`);
        await this.drainPendingCandidates(peerUid, pc);
        return;
      }

      // Per WebRTC (JSEP) standard:
      // Calling setRemoteDescription with an answer is ONLY legal when signalingState is
      // 'have-local-offer' or 'have-remote-pranswer'.
      if (pc.signalingState !== 'have-local-offer' && pc.signalingState !== 'have-remote-pranswer') {
        console.log(
          `[PeerConnectionManager] Skipping setRemoteDescription for peer ${peerUid}: signalingState is '${pc.signalingState}' (already settled or not expecting answer)`
        );
        if (pc.remoteDescription && pc.remoteDescription.type) {
          await this.drainPendingCandidates(peerUid, pc);
        }
        return;
      }

      try {
        await pc.setRemoteDescription(new RTCSessionDescription(sdp));
        await this.drainPendingCandidates(peerUid, pc);
      } catch (err: unknown) {
        const errorMsg = err instanceof Error ? err.message : String(err);
        if (errorMsg.includes('Called in wrong state: stable') || errorMsg.includes('Called in wrong state')) {
          console.log(`[PeerConnectionManager] Answer already applied for ${peerUid} (stable state)`);
        } else {
          console.error('[PeerConnectionManager] Failed to set remote answer description:', err);
        }
      }
    });
  }

  public async handleIceCandidate(
    peerUid: string,
    candidate: RTCIceCandidateInit
  ): Promise<void> {
    if (!candidate) return;
    const pc = this.connections.get(peerUid);
    if (pc && pc.connectionState !== 'closed' && pc.signalingState !== 'closed' && pc.remoteDescription && pc.remoteDescription.type) {
      try {
        await pc.addIceCandidate(candidate);
      } catch (e) {
        console.warn('[PeerConnectionManager] Failed to add ICE candidate:', e);
      }
    } else {
      const queue = this.pendingCandidates.get(peerUid) || [];
      queue.push(candidate);
      this.pendingCandidates.set(peerUid, queue);
    }
  }

  private async drainPendingCandidates(peerUid: string, pc: RTCPeerConnection) {
    const queue = this.pendingCandidates.get(peerUid);
    if (!queue || queue.length === 0) return;

    // Clear queue upfront to prevent duplicate draining loops
    this.pendingCandidates.delete(peerUid);

    for (const candidate of queue) {
      try {
        if (pc.connectionState !== 'closed' && pc.signalingState !== 'closed') {
          await pc.addIceCandidate(candidate);
        }
      } catch (e) {
        console.warn('[PeerConnectionManager] Drain ICE error:', e);
      }
    }
  }

  public closeConnection(peerUid: string, clearCandidates = true) {
    const pc = this.connections.get(peerUid);
    if (pc) {
      try { pc.close(); } catch {}
      this.connections.delete(peerUid);
    }
    this.operationQueues.delete(peerUid);
    this.makingOffer.delete(peerUid);
    if (clearCandidates) {
      this.pendingCandidates.delete(peerUid);
    }
  }

  public getConnection(peerUid: string): RTCPeerConnection | undefined {
    return this.connections.get(peerUid);
  }
}

export const peerConnectionManager = new PeerConnectionManager();
