/**
 * SignalingClient
 * Connects to ephemeral SSE stream and dispatches signaling envelopes via HTTP POST
 * Includes automatic keepalive, seamless reconnection, deduplication, and active fast polling fallback.
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
  private processedSignalIds: Set<string> = new Set();

  constructor() {
    if (typeof window !== 'undefined') {
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

    // Always start fast polling immediately so message signals are never dropped
    this.startFastPolling();
    this.pollPendingMessages();

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
        this.pollPendingMessages();
      };

      this.eventSource.onmessage = (event) => {
        if (!event.data) return;
        try {
          const data = JSON.parse(event.data) as SignalMessage & { sigId?: string; id?: string };
          if (data.type === 'ping' || data.type === 'connected') return;

          const signalId = data.sigId || data.id;
          if (signalId && this.processedSignalIds.has(signalId)) {
            return; // Deduplicate
          }
          if (signalId) {
            this.markProcessed(signalId);
          }

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

        // Fast polling continues pulling messages in background.
        // Schedule proactive SSE reconnect in 2 seconds
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

  private markProcessed(id: string) {
    this.processedSignalIds.add(id);
    if (this.processedSignalIds.size > 1000) {
      const arr = Array.from(this.processedSignalIds);
      for (let i = 0; i < 300; i++) {
        this.processedSignalIds.delete(arr[i]);
      }
    }
  }

  /**
   * Fast polling fallback to pull any queued messages (< 1.5s interval)
   */
  public async pollPendingMessages() {
    if (!this.uid) return;
    try {
      const res = await fetch(`/api/signaling?uid=${encodeURIComponent(this.uid)}&poll=true`);
      if (res.ok) {
        const data = await res.json();
        if (data.ok && Array.isArray(data.messages)) {
          for (const msg of data.messages) {
            const signalId = msg.sigId || msg.id;
            if (signalId && this.processedSignalIds.has(signalId)) {
              continue; // Deduplicate
            }
            if (signalId) {
              this.markProcessed(signalId);
            }
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
    this.stopFastPolling();
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

  public async send(message: SignalMessage | Record<string, any>): Promise<{ ok: boolean; error?: string; delivered?: boolean; queued?: boolean; sigId?: string }> {
    const sigId = (message as any).sigId || (message as any).id || `sig_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
    const payload = {
      ...message,
      sigId,
      id: sigId,
    };
    try {
      const res = await fetch('/api/signaling', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
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

  private startFastPolling() {
    this.stopFastPolling();
    // Fast poll every 1200ms to guarantee zero dropped signaling envelopes
    this.pollTimer = setInterval(() => {
      if (this.uid) {
        this.pollPendingMessages().catch(() => {});
      }
    }, 1200);
  }

  private stopFastPolling() {
    if (this.pollTimer) {
      clearInterval(this.pollTimer);
      this.pollTimer = null;
    }
  }

  private startHeartbeat() {
    this.stopHeartbeat();
    this.heartbeatTimer = setInterval(() => {
      if (this.uid && this.isConnected) {
        this.send({ type: 'presence', uid: this.uid }).catch(() => {});
      }
    }, 12000);
  }

  private stopHeartbeat() {
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = null;
    }
  }
}

export const signalingClient = new SignalingClient();
