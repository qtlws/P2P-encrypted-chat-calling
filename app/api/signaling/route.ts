/**
 * Ephemeral Signaling Server
 * 
 * CRITICAL ARCHITECTURE RULE:
 * This server is strictly a discovery & signaling rendezvous layer.
 * - ZERO persistent message storage (ephemeral in-memory queue with 60s TTL)
 * - ZERO contact database
 * - ZERO private keys
 * - Ephemeral in-memory SSE clients with keepalive heartbeats and queued message delivery
 */

import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

interface QueuedSignal {
  id: string;
  data: any;
  timestamp: number;
}

interface EphemeralClient {
  uid: string;
  controller: ReadableStreamDefaultController;
  lastSeen: number;
}

// In-memory ephemeral registry
const clients = new Map<string, EphemeralClient>();
const messageQueues = new Map<string, QueuedSignal[]>();

const QUEUE_TTL_MS = 60000; // 60 seconds TTL for queued signaling envelopes
const CLEANUP_INTERVAL_MS = 15000;
let lastCleanup = Date.now();

function cleanupStaleState() {
  const now = Date.now();
  if (now - lastCleanup < CLEANUP_INTERVAL_MS) return;
  lastCleanup = now;

  // Cleanup expired client streams (> 90s without activity/keepalive)
  for (const [uid, client] of clients.entries()) {
    if (now - client.lastSeen > 90000) {
      try {
        client.controller.close();
      } catch {
        // Ignored
      }
      clients.delete(uid);
    }
  }

  // Cleanup expired queues
  for (const [uid, queue] of messageQueues.entries()) {
    const valid = queue.filter((item) => now - item.timestamp < QUEUE_TTL_MS);
    if (valid.length === 0) {
      messageQueues.delete(uid);
    } else {
      messageQueues.set(uid, valid);
    }
  }
}

function flushQueueToClient(uid: string, client: EphemeralClient) {
  const queue = messageQueues.get(uid);
  if (!queue || queue.length === 0) return;

  for (const item of queue) {
    try {
      const ssePayload = `data: ${JSON.stringify(item.data)}\n\n`;
      client.controller.enqueue(new TextEncoder().encode(ssePayload));
    } catch {
      break;
    }
  }
  // Clear the flushed messages
  messageQueues.delete(uid);
}

/**
 * GET: Establish Server-Sent Events (SSE) connection or poll for a given UID
 */
export async function GET(req: NextRequest) {
  cleanupStaleState();
  const { searchParams } = new URL(req.url);
  const uid = searchParams.get('uid');
  const isPoll = searchParams.get('poll') === 'true';

  if (!uid || !uid.startsWith('u_') || uid.length > 64) {
    return new NextResponse('Invalid or missing UID parameter', { status: 400 });
  }

  // If client is doing a polling fetch fallback
  if (isPoll) {
    const queue = messageQueues.get(uid) || [];
    messageQueues.delete(uid);
    return NextResponse.json({ ok: true, messages: queue.map((q) => q.data) });
  }

  // Close previous active controller if any
  const existing = clients.get(uid);
  if (existing) {
    try {
      existing.controller.close();
    } catch {
      // Ignored
    }
    clients.delete(uid);
  }

  let keepAliveTimer: NodeJS.Timeout | null = null;

  const stream = new ReadableStream({
    start(controller) {
      const client: EphemeralClient = {
        uid,
        controller,
        lastSeen: Date.now(),
      };
      clients.set(uid, client);

      // Send initial connection ACK
      const initEvent = `data: ${JSON.stringify({ type: 'connected', uid, timestamp: Date.now() })}\n\n`;
      controller.enqueue(new TextEncoder().encode(initEvent));

      // Flush any pending messages that arrived while client was connecting
      flushQueueToClient(uid, client);

      // Periodic keepalive comment every 10 seconds to prevent proxy / browser timeout
      keepAliveTimer = setInterval(() => {
        try {
          client.lastSeen = Date.now();
          controller.enqueue(new TextEncoder().encode(': keepalive\n\n'));
        } catch {
          if (keepAliveTimer) clearInterval(keepAliveTimer);
          clients.delete(uid);
        }
      }, 10000);
    },
    cancel() {
      if (keepAliveTimer) clearInterval(keepAliveTimer);
      clients.delete(uid);
    },
  });

  return new NextResponse(stream, {
    headers: {
      'Content-Type': 'text/event-stream; charset=utf-8',
      'Cache-Control': 'no-cache, no-transform',
      'Connection': 'keep-alive',
      'X-Accel-Buffering': 'no',
    },
  });
}

/**
 * POST: Relay an ephemeral signaling message from one UID to another
 */
export async function POST(req: NextRequest) {
  cleanupStaleState();

  try {
    const body = await req.json();
    const type = body.type;
    const fromUid = body.fromUid || body.from || body.senderUid;
    const toUid = body.toUid || body.to || body.recipientUid;

    if (!type || typeof type !== 'string') {
      return NextResponse.json({ error: 'Missing or invalid message type' }, { status: 400 });
    }

    // Refresh sender timestamp
    if (fromUid && clients.has(fromUid)) {
      const sender = clients.get(fromUid)!;
      sender.lastSeen = Date.now();
    }

    // Handle presence heartbeat ping
    if (type === 'presence') {
      return NextResponse.json({ ok: true, active: true });
    }

    // Check target peer
    if (!toUid || typeof toUid !== 'string') {
      return NextResponse.json({ error: 'Missing target toUid' }, { status: 400 });
    }

    // Normalize envelope fields for universal compatibility
    const normalizedBody = {
      ...body,
      fromUid: fromUid || body.fromUid,
      toUid: toUid || body.toUid,
      from: fromUid || body.from,
      to: toUid || body.to,
      senderUid: fromUid || body.senderUid,
      recipientUid: toUid || body.recipientUid,
    };

    const recipient = clients.get(toUid);
    let deliveredDirectly = false;

    if (recipient) {
      const ssePayload = `data: ${JSON.stringify(normalizedBody)}\n\n`;
      try {
        recipient.controller.enqueue(new TextEncoder().encode(ssePayload));
        recipient.lastSeen = Date.now();
        deliveredDirectly = true;
      } catch {
        clients.delete(toUid);
      }
    }

    // Always keep a short-lived backup in recipient's ephemeral queue if not delivered directly
    if (!deliveredDirectly) {
      const queue = messageQueues.get(toUid) || [];
      queue.push({
        id: `sig_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
        data: normalizedBody,
        timestamp: Date.now(),
      });
      // Limit queue to 50 items
      if (queue.length > 50) queue.shift();
      messageQueues.set(toUid, queue);
    }

    return NextResponse.json({
      ok: true,
      delivered: deliveredDirectly,
      queued: !deliveredDirectly,
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ error: 'Failed to process signaling message', details: msg }, { status: 500 });
  }
}
