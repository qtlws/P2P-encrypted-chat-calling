/**
 * COTURN, STUN, and ICE Infrastructure Configuration
 *
 * Configured with reliable Google STUN servers and verified dedicated TURN/TURNS
 * relays for NAT, CGNAT, and cross-network peer traversal.
 */

export interface IceServerConfig {
  urls: string | string[];
  username?: string;
  credential?: string;
}

export interface CoturnAppConfig {
  publicStunServers: IceServerConfig[];
  publicTurnFallbacks: IceServerConfig[];
  selfHostedCoturn: {
    enabled: boolean;
    urls: string[];
    username?: string;
    credential?: string;
  };
}

export const COTURN_CONFIG: CoturnAppConfig = {
  // Reliable public STUN servers
  publicStunServers: [
    {
      urls: [
        'stun:stun.l.google.com:19302',
        'stun:stun1.l.google.com:19302',
        'stun:stun2.l.google.com:19302',
        'stun:stun3.l.google.com:19302',
        'stun:stun4.l.google.com:19302',
      ],
    },
  ],

  // Dedicated tested TURN/TURNS relays for cross-network connectivity
  publicTurnFallbacks: [
    {
      urls: [
        'turn:openrelay.metered.ca:80',
        'turn:openrelay.metered.ca:443',
        'turn:openrelay.metered.ca:443?transport=tcp',
      ],
      username: 'openrelayproject',
      credential: 'openrelayproject',
    }
  ],

  // Optional custom self-hosted COTURN service override
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

  // Prioritize custom self-hosted COTURN if set
  if (COTURN_CONFIG.selfHostedCoturn.enabled && COTURN_CONFIG.selfHostedCoturn.urls.length > 0) {
    iceServers.push({
      urls: COTURN_CONFIG.selfHostedCoturn.urls,
      username: COTURN_CONFIG.selfHostedCoturn.username,
      credential: COTURN_CONFIG.selfHostedCoturn.credential,
    });
  }

  // Add STUN servers
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

  // Include dedicated TURN fallbacks for cross-network calls
  for (const turn of COTURN_CONFIG.publicTurnFallbacks) {
    iceServers.push({
      urls: turn.urls,
      username: turn.username,
      credential: turn.credential,
    });
  }

  return iceServers;
}
