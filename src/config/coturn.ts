/**
 * COTURN, STUN, and ICE Infrastructure Configuration
 *
 * This configuration file allows anyone self-hosting this open-source project
 * to easily configure their own custom COTURN (STUN/TURN) servers or use reliable
 * public community STUN/TURN fallback relays so peer-to-peer connections work even
 * when users are behind strict NATs or don't have public IP addresses.
 *
 * Environment variables:
 * - COTURN_URLS: Comma-separated list of STUN/TURN URLs (e.g., "turn:turn.myhost.org:3478?transport=udp,turn:turn.myhost.org:3478?transport=tcp")
 * - COTURN_USERNAME: Username credential for TURN authentication
 * - COTURN_CREDENTIAL: Password credential or long-term credential secret
 * - STUN_URLS: Optional additional STUN server URLs
 */

export interface IceServerConfig {
  urls: string | string[];
  username?: string;
  credential?: string;
}

export interface CoturnAppConfig {
  /**
   * List of public community STUN servers.
   * STUN discovers public IP:port mapping across NAT without relaying data.
   */
  publicStunServers: IceServerConfig[];

  /**
   * Free & community-accessible fallback TURN/STUN relays.
   * TURN relays encrypted packets when symmetrical NATs prevent direct P2P.
   * All relayed packets remain end-to-end encrypted; TURN server cannot decrypt payloads.
   */
  publicTurnFallbacks: IceServerConfig[];

  /**
   * Dedicated self-hosted COTURN configuration.
   * Populated via environment variables or manual edit.
   */
  selfHostedCoturn: {
    enabled: boolean;
    urls: string[];
    username?: string;
    credential?: string;
  };
}

export const COTURN_CONFIG: CoturnAppConfig = {
  // 1. Reliable public community STUN servers (Google, Cloudflare, Matrix, FreeICE)
  publicStunServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
    { urls: 'stun:stun2.l.google.com:19302' },
    { urls: 'stun:stun3.l.google.com:19302' },
    { urls: 'stun:stun4.l.google.com:19302' },
    { urls: 'stun:stun.cloudflare.com:3478' },
    { urls: 'stun:stun.matrix.org:3478' },
    { urls: 'stun:stun.nextcloud.com:443' },
  ],

  // 2. High-performance dedicated TURN relays for NAT/CGNAT traversal
  // (All data transferred over TURN remains E2EE with X25519-AES256-GCM)
  publicTurnFallbacks: [
    {
      urls: [
        'turn:openrelay.metered.ca:80',
        'turn:openrelay.metered.ca:443',
        'turn:openrelay.metered.ca:443?transport=tcp',
      ],
      username: 'openrelayproject',
      credential: 'openrelayproject',
    },
  ],

  // 3. Self-Hosted COTURN service settings
  selfHostedCoturn: {
    enabled: Boolean(process.env.COTURN_URLS),
    urls: process.env.COTURN_URLS
      ? process.env.COTURN_URLS.split(',').map((u) => u.trim()).filter(Boolean)
      : [],
    username: process.env.COTURN_USERNAME || undefined,
    credential: process.env.COTURN_CREDENTIAL || undefined,
  },
};

/**
 * Generates the unified RTCIceServer list according to current deployment configuration.
 */
export function getActiveIceServers(): RTCIceServer[] {
  const iceServers: RTCIceServer[] = [];

  // If self-hosted COTURN is configured via env or file, prioritize it:
  if (COTURN_CONFIG.selfHostedCoturn.enabled && COTURN_CONFIG.selfHostedCoturn.urls.length > 0) {
    iceServers.push({
      urls: COTURN_CONFIG.selfHostedCoturn.urls,
      username: COTURN_CONFIG.selfHostedCoturn.username,
      credential: COTURN_CONFIG.selfHostedCoturn.credential,
    });
  }

  // Add configured STUN servers (from env or public list)
  const envStun = process.env.STUN_URLS
    ? process.env.STUN_URLS.split(',').map((u) => u.trim()).filter(Boolean)
    : [];

  if (envStun.length > 0) {
    iceServers.push({ urls: envStun });
  } else {
    for (const stun of COTURN_CONFIG.publicStunServers) {
      iceServers.push({ urls: stun.urls });
    }
  }

  // Include public TURN fallbacks so strict NAT users can still establish connection
  for (const turn of COTURN_CONFIG.publicTurnFallbacks) {
    iceServers.push({
      urls: turn.urls,
      username: turn.username,
      credential: turn.credential,
    });
  }

  return iceServers;
}
