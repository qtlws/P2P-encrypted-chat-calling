import { NextResponse } from 'next/server';
import { getActiveIceServers, COTURN_CONFIG } from '@/src/config/coturn';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

/**
 * GET /api/ice-servers
 * Provides the configured ICE (STUN/TURN) servers to connecting clients.
 * This ensures clients automatically receive self-hosted or public community COTURN credentials.
 */
export async function GET() {
  try {
    const iceServers = getActiveIceServers();
    return NextResponse.json({
      iceServers,
      coturnConfigured: COTURN_CONFIG.selfHostedCoturn.enabled,
      hasTurnRelay: iceServers.some((s) => {
        const u = Array.isArray(s.urls) ? s.urls : [s.urls];
        return u.some((url) => url.startsWith('turn:'));
      }),
    });
  } catch (error) {
    console.error('Failed to resolve ICE servers:', error);
    return NextResponse.json(
      {
        iceServers: [
          { urls: 'stun:stun.l.google.com:19302' },
          { urls: 'stun:stun1.l.google.com:19302' },
        ],
        coturnConfigured: false,
        hasTurnRelay: false,
      },
      { status: 200 }
    );
  }
}
