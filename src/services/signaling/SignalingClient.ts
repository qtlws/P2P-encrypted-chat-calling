/**
 * SignalingClient
 * Connects to ephemeral SSE stream and dispatches signaling envelopes via HTTP POST
 * Includes automatic keepalive, seamless reconnection, and queue polling fallback.
 */

import { SignalMessage } from '@/src/types/signaling';

type SignalListener = (message: SignalMessage) => void;
type ConnectionStateListener = (connected: boolean) => void;

export class SignalingClient {
  private uid: string | null = null;
  private eventSource: EventSource | null = null;
  private listeners: Set<SignalListener> = new Set();
  private stateListeners: Set<ConnectionStateListener> = new Set();
  private heartbeatTimer: ReturnType<typeof setInterval> | null = null;
  private pollTimer: ReturnType<typeof setInterval> | null = null;
  private isConnected = false;
  private isConnecting = false;
  private reconnectTimeout: ReturnType<typeof setTimeout> | null = null;

  constructor() {
    if (typeof window !== 'undefined') {
      // Re-connect / check signaling when tab becomes visible
      document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible' && this.uid) {
          this.pollPendingMessages();
          if (!this.isConnected && !this.isConnecting) {
            this.connect();
          }
        }
      });
      window.addEventListener('online', () => {
        if (this.uid) this.connect();
      });
    }
  }

  public setUid(uid: string) {
    if (this.uid === uid && this.isConnected) return;
    this.uid = uid;
    this.connect();
  }

  public getUid(): string | null {
    return this.uid;
  }

  public isSignalingConnected(): boolean {
    return this.isConnected;
  }

  public connect() {
    if (typeof window === 'undefined' || !this.uid) return;
    if (this.isConnecting || this.isConnected) return;

    this.isConnecting = true;
    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout);
      this.reconnectTimeout = null;
    }

    try {
      if (this.eventSource) {
        this.eventSource.close();
        this.eventSource = null;
      }

      const sseUrl = `/api/signaling?uid=${encodeURIComponent(this.uid)}`;
      this.eventSource = new EventSource(sseUrl);

      this.eventSource.onopen = () => {
        this.isConnected = true;
        this.isConnecting = false;
        this.notifyState(true);
        this.startHeartbeat();
        // Immediately poll queue just in case
        this.pollPendingMessages();
      };

      this.eventSource.onmessage = (event) => {
        if (!event.data) return;
        try {
          const data = JSON.parse(event.data) as SignalMessage;
          if (data.type === 'ping' || data.type === 'connected') return;
          this.notifyListeners(data);
        } catch (e) {
          console.warn('[SignalingClient] Parse error on SSE payload:', e);
        }
      };

      this.eventSource.onerror = () => {
        this.isConnected = false;
        this.isConnecting = false;
        this.notifyState(false);
        this.stopHeartbeat();
        if (this.eventSource) {
          this.eventSource.close();
          this.eventSource = null;
        }

        // Schedule proactive reconnect in 2 seconds
        if (!this.reconnectTimeout) {
          this.reconnectTimeout = setTimeout(() => {
            this.reconnectTimeout = null;
            if (this.uid) {
              this.connect();
            }
          }, 2000);
        }
      };
    } catch (err) {
      this.isConnecting = false;
      this.isConnected = false;
      this.notifyState(false);
      console.warn('[SignalingClient] Failed to open SSE connection:', err);
    }
  }

  /**
   * Fast polling fallback to pull any queued messages
   */
  public async pollPendingMessages() {
    if (!this.uid) return;
    try {
      const res = await fetch(`/api/signaling?uid=${encodeURIComponent(this.uid)}&poll=true`);
      if (res.ok) {
        const data = await res.json();
        if (data.ok && Array.isArray(data.messages)) {
          for (const msg of data.messages) {
            this.notifyListeners(msg);
          }
        }
      }
    } catch {
      // Ignored
    }
  }

  public disconnect() {
    this.stopHeartbeat();
    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout);
      this.reconnectTimeout = null;
    }
    if (this.eventSource) {
      this.eventSource.close();
      this.eventSource = null;
    }
    this.isConnected = false;
    this.isConnecting = false;
    this.notifyState(false);
  }

  public async send(message: SignalMessage | Record<string, any>): Promise<{ ok: boolean; error?: string; delivered?: boolean; queued?: boolean }> {
    try {
      const res = await fetch('/api/signaling', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(message),
      });
      const data = await res.json();
      return data;
    } catch (err) {
      return { ok: false, error: err instanceof Error ? err.message : 'Network error' };
    }
  }

  public subscribe(listener: SignalListener): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  public onConnectionStateChange(listener: ConnectionStateListener): () => void {
    this.stateListeners.add(listener);
    listener(this.isConnected);
    return () => {
      this.stateListeners.delete(listener);
    };
  }

  private notifyListeners(message: SignalMessage) {
    for (const listener of this.listeners) {
      try {
        listener(message);
      } catch (err) {
        console.error('[SignalingClient] Listener exception:', err);
      }
    }
  }

  private notifyState(connected: boolean) {
    for (const listener of this.stateListeners) {
      try {
        listener(connected);
      } catch (err) {
        console.error('[SignalingClient] State listener exception:', err);
      }
    }
  }

  private startHeartbeat() {
    this.stopHeartbeat();
    // Heartbeat every 15s + fallback poll check
    this.heartbeatTimer = setInterval(() => {
      if (this.uid && this.isConnected) {
        this.send({ type: 'presence', uid: this.uid }).catch(() => {});
        this.pollPendingMessages().catch(() => {});
      }
    }, 15000);
  }

  private stopHeartbeat() {
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = null;
    }
  }
}

export const signalingClient = new SignalingClient();
