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

  constructor() {
    this.fetchRemoteIceServers();
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
    const pc = this.getOrCreateConnection(peerUid);
    this.makingOffer.set(peerUid, true);

    try {
      // If already in have-local-offer, we already have a pending offer waiting for answer
      if (pc.signalingState === 'have-local-offer' && pc.localDescription) {
        console.log(`[PeerConnectionManager] An offer is already active for peer ${peerUid}`);
        return pc.localDescription;
      }

      if (pc.signalingState !== 'stable') {
        console.warn(`[PeerConnectionManager] Creating offer while signalingState is ${pc.signalingState}`);
      }

      const offer = await pc.createOffer({
        offerToReceiveAudio: true,
        offerToReceiveVideo: true,
      });

      if (pc.signalingState === 'closed') return null;

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
    } catch (err) {
      console.error('[PeerConnectionManager] Error creating offer:', err);
      return null;
    } finally {
      this.makingOffer.set(peerUid, false);
    }
  }

  public async handleOffer(
    peerUid: string,
    sdp: RTCSessionDescriptionInit
  ): Promise<RTCSessionDescriptionInit | null> {
    const pc = this.getOrCreateConnection(peerUid);
    if (!sdp || !sdp.sdp) {
      console.warn('[PeerConnectionManager] Received empty offer SDP');
      return null;
    }

    try {
      if (pc.signalingState === 'closed') return null;

      // Duplicate offer check: if this exact offer is already set as remoteDescription
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

      // Glare handling: if we have an un-answered local offer, roll it back to accept remote offer
      if (pc.signalingState === 'have-local-offer') {
        try {
          await pc.setLocalDescription({ type: 'rollback' });
        } catch (e) {
          console.warn('[PeerConnectionManager] Rollback of local offer:', e);
        }
      }

      await pc.setRemoteDescription(new RTCSessionDescription(sdp));
      await this.drainPendingCandidates(peerUid, pc);

      const answer = await pc.createAnswer();
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
    } catch (err) {
      console.error('[PeerConnectionManager] Error handling offer:', err);
      return null;
    }
  }

  public async handleAnswer(
    peerUid: string,
    sdp: RTCSessionDescriptionInit
  ): Promise<void> {
    const pc = this.connections.get(peerUid);
    if (!pc || !sdp || !sdp.sdp) return;

    // Per WebRTC (JSEP) standard:
    // Calling setRemoteDescription with an answer is ONLY legal when signalingState is
    // 'have-local-offer' or 'have-remote-pranswer'.
    // If the peer connection is already in 'stable', the answer has already been applied
    // (e.g. delivered via SSE and re-delivered by the fast polling queue).
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
      if (errorMsg.includes('Called in wrong state: stable')) {
        console.log(`[PeerConnectionManager] Answer already applied for ${peerUid} (stable state)`);
      } else {
        console.error('[PeerConnectionManager] Failed to set remote answer description:', err);
      }
    }
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
    if (clearCandidates) {
      this.pendingCandidates.delete(peerUid);
    }
  }

  public getConnection(peerUid: string): RTCPeerConnection | undefined {
    return this.connections.get(peerUid);
  }
}

export const peerConnectionManager = new PeerConnectionManager();
