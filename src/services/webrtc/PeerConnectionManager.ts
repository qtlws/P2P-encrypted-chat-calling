/**
 * PeerConnectionManager
 * Manages RTCPeerConnection instances, STUN ice servers, SDP negotiation, and ICE candidates
 */

import { signalingClient } from '../signaling/SignalingClient';
import { ConnectionState } from '@/src/types/peer';
import { getActiveIceServers } from '@/src/config/coturn';
import { chatManager } from '../chat/ChatManager';
import { packSecureTransportMessage } from '@/src/crypto/secureProtocol';

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

  constructor() {
    this.fetchRemoteIceServers();
  }

  /**
   * Fetches latest COTURN and STUN configuration from server endpoint
   */
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
      // Fallback to local config
    }
    this.cachedIceServers = getActiveIceServers();
    return this.cachedIceServers;
  }

  public getRtcConfig(): RTCConfiguration {
    return {
      iceServers: this.cachedIceServers && this.cachedIceServers.length > 0
        ? this.cachedIceServers
        : getActiveIceServers(),
      iceCandidatePoolSize: 2,
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

  public getOrCreateConnection(peerUid: string): RTCPeerConnection {
    const existing = this.connections.get(peerUid);
    if (existing && existing.connectionState !== 'closed') {
      return existing;
    }

    const pc = new RTCPeerConnection(this.getRtcConfig());
    this.connections.set(peerUid, pc);

    pc.onicecandidate = async (event) => {
      if (event.candidate && this.localUid) {
        const identity = chatManager.getIdentity();
        const session = chatManager.getSession(peerUid);
        const candidateData = event.candidate.toJSON();

        if (identity) {
          try {
            const securePacket = await packSecureTransportMessage({
              subType: 'ice-candidate',
              fromUid: this.localUid,
              toUid: peerUid,
              senderPrivateKey: identity.identityPrivateKey,
              senderFingerprint: identity.fingerprint,
              sessionKey: session?.sessionKey || null,
              innerData: { candidate: candidateData },
            });
            await signalingClient.send(securePacket);
            return;
          } catch (err) {
            console.warn('[PeerConnectionManager] Failed to pack secure ICE packet:', err);
          }
        }

        signalingClient.send({
          type: 'ice-candidate',
          fromUid: this.localUid,
          toUid: peerUid,
          candidate: candidateData,
        }).catch(() => {});
      }
    };

    pc.onconnectionstatechange = () => {
      const stateMap: Record<RTCPeerConnectionState, ConnectionState> = {
        new: 'connecting',
        connecting: 'connecting',
        connected: 'connected',
        disconnected: 'disconnected',
        failed: 'failed',
        closed: 'disconnected',
      };
      const state = stateMap[pc.connectionState] || 'disconnected';
      if (this.onStateChange) {
        this.onStateChange(peerUid, state);
      }
    };

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

  public async createOffer(peerUid: string): Promise<RTCSessionDescriptionInit> {
    const pc = this.getOrCreateConnection(peerUid);
    const offer = await pc.createOffer();
    await pc.setLocalDescription(offer);

    if (this.localUid) {
      const identity = chatManager.getIdentity();
      const session = chatManager.getSession(peerUid);

      if (identity) {
        try {
          const securePacket = await packSecureTransportMessage({
            subType: 'offer',
            fromUid: this.localUid,
            toUid: peerUid,
            senderPrivateKey: identity.identityPrivateKey,
            senderFingerprint: identity.fingerprint,
            sessionKey: session?.sessionKey || null,
            innerData: { sdp: offer },
          });
          await signalingClient.send(securePacket);
          return offer;
        } catch (err) {
          console.warn('[PeerConnectionManager] Failed to pack secure offer packet:', err);
        }
      }

      await signalingClient.send({
        type: 'offer',
        fromUid: this.localUid,
        toUid: peerUid,
        sdp: offer,
      });
    }

    return offer;
  }

  public async handleOffer(
    peerUid: string,
    sdp: RTCSessionDescriptionInit
  ): Promise<RTCSessionDescriptionInit> {
    const pc = this.getOrCreateConnection(peerUid);
    await pc.setRemoteDescription(new RTCSessionDescription(sdp));

    // Process any queued ICE candidates
    await this.drainPendingCandidates(peerUid, pc);

    const answer = await pc.createAnswer();
    await pc.setLocalDescription(answer);

    if (this.localUid) {
      const identity = chatManager.getIdentity();
      const session = chatManager.getSession(peerUid);

      if (identity) {
        try {
          const securePacket = await packSecureTransportMessage({
            subType: 'answer',
            fromUid: this.localUid,
            toUid: peerUid,
            senderPrivateKey: identity.identityPrivateKey,
            senderFingerprint: identity.fingerprint,
            sessionKey: session?.sessionKey || null,
            innerData: { sdp: answer },
          });
          await signalingClient.send(securePacket);
          return answer;
        } catch (err) {
          console.warn('[PeerConnectionManager] Failed to pack secure answer packet:', err);
        }
      }

      await signalingClient.send({
        type: 'answer',
        fromUid: this.localUid,
        toUid: peerUid,
        sdp: answer,
      });
    }

    return answer;
  }

  public async handleAnswer(
    peerUid: string,
    sdp: RTCSessionDescriptionInit
  ): Promise<void> {
    const pc = this.connections.get(peerUid);
    if (!pc) return;

    await pc.setRemoteDescription(new RTCSessionDescription(sdp));
    await this.drainPendingCandidates(peerUid, pc);
  }

  public async handleIceCandidate(
    peerUid: string,
    candidate: RTCIceCandidateInit
  ): Promise<void> {
    const pc = this.connections.get(peerUid);
    if (pc && pc.remoteDescription && pc.remoteDescription.type) {
      try {
        await pc.addIceCandidate(new RTCIceCandidate(candidate));
      } catch (e) {
        console.warn('[PeerConnectionManager] Failed to add ICE candidate:', e);
      }
    } else {
      // Queue until remote description is set
      const queue = this.pendingCandidates.get(peerUid) || [];
      queue.push(candidate);
      this.pendingCandidates.set(peerUid, queue);
    }
  }

  private async drainPendingCandidates(peerUid: string, pc: RTCPeerConnection) {
    const queue = this.pendingCandidates.get(peerUid);
    if (!queue || queue.length === 0) return;

    for (const candidate of queue) {
      try {
        await pc.addIceCandidate(new RTCIceCandidate(candidate));
      } catch (e) {
        console.warn('[PeerConnectionManager] Drain ICE error:', e);
      }
    }
    this.pendingCandidates.delete(peerUid);
  }

  public closeConnection(peerUid: string) {
    const pc = this.connections.get(peerUid);
    if (pc) {
      pc.close();
      this.connections.delete(peerUid);
    }
    this.pendingCandidates.delete(peerUid);
  }

  public getConnection(peerUid: string): RTCPeerConnection | undefined {
    return this.connections.get(peerUid);
  }
}

export const peerConnectionManager = new PeerConnectionManager();
