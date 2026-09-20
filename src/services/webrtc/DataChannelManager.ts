/**
 * DataChannelManager
 * Manages RTCDataChannel ('p2p-chat') for direct P2P transport of encrypted payloads and ACKs
 */

import { WireMessage, WireAck } from '@/src/crypto/types';

type MessagePayload = WireMessage | WireAck;
type MessageHandler = (peerUid: string, message: MessagePayload) => void;
type ChannelStatusHandler = (peerUid: string, isOpen: boolean) => void;

export class DataChannelManager {
  private channels = new Map<string, RTCDataChannel>();
  private messageHandlers: Set<MessageHandler> = new Set();
  private statusHandlers: Set<ChannelStatusHandler> = new Set();

  public createDataChannel(peerUid: string, pc: RTCPeerConnection): RTCDataChannel {
    const channel = pc.createDataChannel('p2p-chat', {
      ordered: true,
    });
    this.setupChannel(peerUid, channel);
    return channel;
  }

  public registerIncomingChannel(peerUid: string, channel: RTCDataChannel) {
    this.setupChannel(peerUid, channel);
  }

  private setupChannel(peerUid: string, channel: RTCDataChannel) {
    this.channels.set(peerUid, channel);

    channel.onopen = () => {
      this.notifyStatus(peerUid, true);
    };

    channel.onclose = () => {
      this.notifyStatus(peerUid, false);
      this.channels.delete(peerUid);
    };

    channel.onerror = (err) => {
      console.warn(`[DataChannelManager] Channel error for ${peerUid}:`, err);
      this.notifyStatus(peerUid, false);
    };

    channel.onmessage = (event) => {
      try {
        const parsed = JSON.parse(event.data) as MessagePayload;
        this.notifyMessage(peerUid, parsed);
      } catch (e) {
        console.warn('[DataChannelManager] Message parse failure:', e);
      }
    };
  }

  public send(peerUid: string, payload: MessagePayload): boolean {
    const channel = this.channels.get(peerUid);
    if (!channel || channel.readyState !== 'open') {
      return false;
    }
    try {
      channel.send(JSON.stringify(payload));
      return true;
    } catch (err) {
      console.warn('[DataChannelManager] Send failure:', err);
      return false;
    }
  }

  public isChannelOpen(peerUid: string): boolean {
    const channel = this.channels.get(peerUid);
    return !!channel && channel.readyState === 'open';
  }

  public onMessage(handler: MessageHandler): () => void {
    this.messageHandlers.add(handler);
    return () => {
      this.messageHandlers.delete(handler);
    };
  }

  public onStatusChange(handler: ChannelStatusHandler): () => void {
    this.statusHandlers.add(handler);
    return () => {
      this.statusHandlers.delete(handler);
    };
  }

  private notifyMessage(peerUid: string, message: MessagePayload) {
    for (const h of this.messageHandlers) {
      try {
        h(peerUid, message);
      } catch (err) {
        console.error('[DataChannelManager] Message handler error:', err);
      }
    }
  }

  private notifyStatus(peerUid: string, isOpen: boolean) {
    for (const h of this.statusHandlers) {
      try {
        h(peerUid, isOpen);
      } catch (err) {
        console.error('[DataChannelManager] Status handler error:', err);
      }
    }
  }
}

export const dataChannelManager = new DataChannelManager();
