/**
 * DataChannelManager
 * Manages RTCDataChannel ('p2p-chat') for direct P2P transport of encrypted payloads and ACKs
 */

import { WireMessage, WireAck } from '@/src/crypto/types';

export type MessagePayload = WireMessage | WireAck | { type: string; [key: string]: unknown };
type MessageHandler = (peerUid: string, message: MessagePayload) => void;
type ChannelStatusHandler = (peerUid: string, isOpen: boolean) => void;

export class DataChannelManager {
  private channels = new Map<string, RTCDataChannel>();
  private messageHandlers: Set<MessageHandler> = new Set();
  private statusHandlers: Set<ChannelStatusHandler> = new Set();

  public createDataChannel(peerUid: string, pc: RTCPeerConnection): RTCDataChannel {
    const existing = this.channels.get(peerUid);
    if (existing && existing.readyState !== 'closed') {
      return existing;
    }
    const channel = pc.createDataChannel('p2p-chat', {
      ordered: true,
    });
    this.setupChannel(peerUid, channel);
    return channel;
  }

  public registerIncomingChannel(peerUid: string, channel: RTCDataChannel) {
    this.setupChannel(peerUid, channel);
  }

  private pingTimers = new Map<string, ReturnType<typeof setInterval>>();

  private setupChannel(peerUid: string, channel: RTCDataChannel) {
    this.channels.set(peerUid, channel);

    const startPing = () => {
      this.stopPing(peerUid);
      const timer = setInterval(() => {
        const ch = this.channels.get(peerUid);
        if (ch && ch.readyState === 'open') {
          try {
            ch.send(JSON.stringify({ type: 'p2p-ping', ts: Date.now() }));
          } catch {
            this.notifyStatus(peerUid, false);
            this.stopPing(peerUid);
          }
        } else {
          this.stopPing(peerUid);
        }
      }, 5000);
      this.pingTimers.set(peerUid, timer);
    };

    if (channel.readyState === 'open') {
      this.notifyStatus(peerUid, true);
      startPing();
    }

    channel.onopen = () => {
      this.notifyStatus(peerUid, true);
      startPing();
    };

    channel.onclose = () => {
      this.stopPing(peerUid);
      this.notifyStatus(peerUid, false);
      this.channels.delete(peerUid);
    };

    channel.onerror = (err) => {
      console.warn(`[DataChannelManager] Channel error for ${peerUid}:`, err);
      this.stopPing(peerUid);
      this.notifyStatus(peerUid, false);
    };

    channel.onmessage = (event) => {
      try {
        const parsed = JSON.parse(event.data) as MessagePayload;
        // Internal P2P Keepalive Handling
        if (parsed && typeof parsed === 'object') {
          if (parsed.type === 'p2p-ping') {
            const ch = this.channels.get(peerUid);
            if (ch && ch.readyState === 'open') {
              try { ch.send(JSON.stringify({ type: 'p2p-pong', ts: Date.now() })); } catch {}
            }
            return;
          }
          if (parsed.type === 'p2p-pong') {
            return;
          }
        }
        this.notifyMessage(peerUid, parsed);
      } catch (e) {
        console.warn('[DataChannelManager] Message parse failure:', e);
      }
    };
  }

  private stopPing(peerUid: string) {
    const timer = this.pingTimers.get(peerUid);
    if (timer) {
      clearInterval(timer);
      this.pingTimers.delete(peerUid);
    }
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

  public closeAll() {
    for (const timer of this.pingTimers.values()) {
      clearInterval(timer);
    }
    this.pingTimers.clear();
    for (const channel of this.channels.values()) {
      try { channel.close(); } catch {}
    }
    this.channels.clear();
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
