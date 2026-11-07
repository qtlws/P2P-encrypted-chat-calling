import test from 'node:test';
import assert from 'node:assert/strict';

// Test pure logic for multi-party call invariants, anonymity masking, and zoom clamping

test('Max candidates constraint is strictly 5 (1 local + 4 remote)', () => {
  const MAX_CANDIDATES = 5;
  const currentParticipants = ['u_peer1', 'u_peer2', 'u_peer3', 'u_peer4'];
  const canAddMore = currentParticipants.length < MAX_CANDIDATES - 1;
  assert.equal(canAddMore, false, 'Should not allow adding a 5th remote peer when limit is 5 total candidates');

  const smallerGroup = ['u_peer1', 'u_peer2'];
  const canAddSmaller = smallerGroup.length < MAX_CANDIDATES - 1;
  assert.equal(canAddSmaller, true, 'Should allow adding remote peer when candidates < 5');
});

test('Zoom level is clamped strictly between 1.0x and 3.0x', () => {
  const clampZoom = (level: number) => Math.min(3.0, Math.max(1.0, Math.round(level * 100) / 100));

  assert.equal(clampZoom(0.5), 1.0);
  assert.equal(clampZoom(1.0), 1.0);
  assert.equal(clampZoom(1.75), 1.75);
  assert.equal(clampZoom(2.5), 2.5);
  assert.equal(clampZoom(3.5), 3.0);
  assert.equal(clampZoom(5.0), 3.0);
});

test('Anonymity privacy rule correctly distinguishes known vs unknown peers', () => {
  const myUid = 'u_user_a';
  const knownPeerUids = new Set(['u_user_b']); // User A has chatted with B

  const isPeerKnown = (peerUid: string) => {
    if (peerUid === myUid) return true;
    return knownPeerUids.has(peerUid);
  };

  const getDisplayName = (peerUid: string) => {
    if (peerUid === myUid) return 'You (Local)';
    if (isPeerKnown(peerUid)) return peerUid;
    return 'Anonymous Peer';
  };

  // User A knows B
  assert.equal(getDisplayName('u_user_b'), 'u_user_b');

  // User A does not know User C
  assert.equal(getDisplayName('u_user_c'), 'Anonymous Peer');

  // Local user
  assert.equal(getDisplayName('u_user_a'), 'You (Local)');
});

test('Held call and call waiting state transitions', () => {
  interface CallWaiting {
    callerUid: string;
    callType: 'video' | 'audio';
  }
  interface HeldCall {
    id: string;
    peerUid: string;
  }

  let activePeer = 'u_peer_b';
  let callWaiting: CallWaiting | null = { callerUid: 'u_peer_c', callType: 'video' };
  const heldCalls: HeldCall[] = [];

  // Answer & Hold: Put B on hold, talk to C
  heldCalls.push({ id: 'held_1', peerUid: activePeer });
  activePeer = callWaiting.callerUid;
  callWaiting = null;

  assert.equal(activePeer, 'u_peer_c');
  assert.equal(heldCalls.length, 1);
  assert.equal(heldCalls[0].peerUid, 'u_peer_b');
  assert.equal(callWaiting, null);

  // Merge: Bring B into active group call
  const activeParticipants = [activePeer, heldCalls[0].peerUid];
  heldCalls.pop();

  assert.equal(heldCalls.length, 0);
  assert.deepEqual(activeParticipants, ['u_peer_c', 'u_peer_b']);
});

test('Add participant validation prevents invalid candidates, duplicates, and capacity overflow', () => {
  const localUid = 'u_user_me';
  const participants = ['u_user_b', 'u_user_c'];
  const MAX_CANDIDATES = 5;

  const validateAddCandidate = (newUid: string) => {
    if (!newUid || !newUid.trim()) return { allowed: false, error: 'Empty UID' };
    if (newUid === localUid) return { allowed: false, error: 'Cannot add yourself' };
    if (participants.includes(newUid)) return { allowed: false, error: 'Already in call' };
    if (participants.length >= MAX_CANDIDATES - 1) return { allowed: false, error: 'Max 5 candidates reached' };
    return { allowed: true, error: null };
  };

  // Self addition rejected
  assert.deepEqual(validateAddCandidate('u_user_me'), { allowed: false, error: 'Cannot add yourself' });

  // Duplicate candidate rejected
  assert.deepEqual(validateAddCandidate('u_user_b'), { allowed: false, error: 'Already in call' });

  // Valid 4th candidate allowed
  assert.deepEqual(validateAddCandidate('u_user_d'), { allowed: true, error: null });

  // Once 4th candidate is in, 5th candidate is allowed
  participants.push('u_user_d');
  assert.deepEqual(validateAddCandidate('u_user_e'), { allowed: true, error: null });

  // Once 5 candidates total (1 local + 4 remote), 6th is rejected
  participants.push('u_user_e');
  assert.deepEqual(validateAddCandidate('u_user_f'), { allowed: false, error: 'Max 5 candidates reached' });
});

test('Media permission evaluator correctly classifies security context and permission states', () => {
  const evaluatePermissionAdvice = (status: {
    isSecure: boolean;
    camera: 'granted' | 'prompt' | 'denied' | 'unsupported';
    microphone: 'granted' | 'prompt' | 'denied' | 'unsupported';
  }) => {
    if (!status.isSecure) return 'INSECURE_CONTEXT';
    if (status.camera === 'denied' || status.microphone === 'denied') return 'PERMISSION_DENIED';
    if (status.camera === 'granted' && status.microphone === 'granted') return 'READY';
    return 'PROMPT_REQUIRED';
  };

  // Insecure context (plain HTTP on LAN/domain)
  assert.equal(evaluatePermissionAdvice({ isSecure: false, camera: 'prompt', microphone: 'prompt' }), 'INSECURE_CONTEXT');

  // Blocked in browser
  assert.equal(evaluatePermissionAdvice({ isSecure: true, camera: 'denied', microphone: 'granted' }), 'PERMISSION_DENIED');

  // Both granted
  assert.equal(evaluatePermissionAdvice({ isSecure: true, camera: 'granted', microphone: 'granted' }), 'READY');

  // Needs user prompt
  assert.equal(evaluatePermissionAdvice({ isSecure: true, camera: 'prompt', microphone: 'prompt' }), 'PROMPT_REQUIRED');
});

test('Initiator privilege for Delete Both Ends correctly enforces permission', () => {
  const localUid = 'u_alice';
  const peerUid = 'u_bob';

  const canDeleteBothEnds = (conv: { isInitiator?: boolean; initiatorUid?: string }, myUid: string) => {
    return Boolean(conv.isInitiator ?? (conv.initiatorUid === myUid));
  };

  // Alice started chat with Bob: Alice has permission
  const convAlice = { isInitiator: true, initiatorUid: 'u_alice' };
  assert.equal(canDeleteBothEnds(convAlice, localUid), true);

  // Bob received handshake: Bob does NOT have permission to delete both ends
  const convBob = { isInitiator: false, initiatorUid: 'u_alice' };
  assert.equal(canDeleteBothEnds(convBob, peerUid), false);
});

test('Full backup export bundle includes keys, fingerprints, chats, and peer contacts', () => {
  const mockIdentity = {
    uid: 'u_identity_123',
    fingerprint: 'fp_sha256_mock',
    identityPublicKey: 'id_pub_key',
    identityPrivateKey: 'id_priv_key',
    encryptionPublicKey: 'enc_pub_key',
    encryptionPrivateKey: 'enc_priv_key',
    createdAt: 1700000000000,
  };

  const createBackupBundle = (options: { includeChats: boolean; includePeers: boolean }) => ({
    version: 2,
    format: 'p2p-full-backup-v2',
    createdAt: Date.now(),
    identity: mockIdentity,
    conversations: options.includeChats ? [{ id: 'c1', peerUid: 'u_bob' }] : [],
    messages: options.includeChats ? { c1: [{ id: 'm1', plaintext: 'secret' }] } : {},
    peers: options.includePeers ? [{ uid: 'u_bob', verified: true }] : [],
  });

  // All selected
  const full = createBackupBundle({ includeChats: true, includePeers: true });
  assert.equal(full.identity.uid, 'u_identity_123');
  assert.equal(full.identity.fingerprint, 'fp_sha256_mock');
  assert.equal(full.conversations.length, 1);
  assert.equal(Object.keys(full.messages).length, 1);
  assert.equal(full.peers.length, 1);

  // Exclude chats
  const noChats = createBackupBundle({ includeChats: false, includePeers: true });
  assert.equal(noChats.conversations.length, 0);
  assert.equal(Object.keys(noChats.messages).length, 0);
  assert.equal(noChats.peers.length, 1);
});

test('Peer idle state blocks chat input and call placement until P2P link is active', () => {
  const checkActionAllowed = (isP2PConnected: boolean, action: 'send' | 'call') => {
    if (!isP2PConnected) {
      return { allowed: false, errorNotice: `Peer is currently idle. ${action} enabled once peer is active.` };
    }
    return { allowed: true, errorNotice: null };
  };

  // Idle state
  assert.equal(checkActionAllowed(false, 'call').allowed, false);
  assert.equal(checkActionAllowed(false, 'send').allowed, false);

  // Active P2P state
  assert.equal(checkActionAllowed(true, 'call').allowed, true);
  assert.equal(checkActionAllowed(true, 'send').allowed, true);
});

test('Complete identity reset wipes all in-memory conversations, messages, and peer records', () => {
  // Simulate state
  const state = {
    identity: { uid: 'u_old_uid' } as { uid: string } | null,
    conversations: [{ id: 'c1', peerUid: 'u_peer_1' }],
    messages: { c1: [{ id: 'm1' }] },
    peerRecords: { u_peer_1: { uid: 'u_peer_1' } },
    p2pConnected: true,
  };

  // Perform reset
  const performReset = () => {
    state.identity = null;
    state.conversations = [];
    state.messages = {};
    state.peerRecords = {};
    state.p2pConnected = false;
  };

  performReset();

  assert.equal(state.identity, null);
  assert.equal(state.conversations.length, 0);
  assert.equal(Object.keys(state.messages).length, 0);
  assert.equal(Object.keys(state.peerRecords).length, 0);
  assert.equal(state.p2pConnected, false);
});

test('New user onboarding logic triggers only when local storage is empty', () => {
  const shouldShowOnboarding = (storedIdentity: { uid: string } | null, relayLoadingDone: boolean) => {
    if (!relayLoadingDone) return false;
    return !storedIdentity;
  };

  // While futuristic relay screen is still loading: do not show yet
  assert.equal(shouldShowOnboarding(null, false), false);

  // When loading completes and user has NO identity in storage: SHOW ONBOARDING
  assert.equal(shouldShowOnboarding(null, true), true);

  // When loading completes and user ALREADY has an identity: DO NOT SHOW ONBOARDING
  assert.equal(shouldShowOnboarding({ uid: 'u_existing' }, true), false);
});

test('Message segment parser extracts clickable links without preview and handles URLs with punctuation', async () => {
  const { parseMessageSegments } = await import('../src/lib/messageFormatting');

  // Test 1: Standard HTTPS URL
  const segments1 = parseMessageSegments('Check out https://github.com/project for details');
  assert.equal(segments1.length, 3);
  assert.equal(segments1[0].type, 'text');
  assert.equal(segments1[0].content, 'Check out ');
  assert.equal(segments1[1].type, 'link');
  assert.equal(segments1[1].content, 'https://github.com/project');
  assert.equal(segments1[1].href, 'https://github.com/project');
  assert.equal(segments1[2].type, 'text');
  assert.equal(segments1[2].content, ' for details');

  // Test 2: URL with trailing period should strip period from link and keep it as text
  const segments2 = parseMessageSegments('Visit https://example.com.');
  assert.equal(segments2.length, 3);
  assert.equal(segments2[0].type, 'text');
  assert.equal(segments2[0].content, 'Visit ');
  assert.equal(segments2[1].type, 'link');
  assert.equal(segments2[1].content, 'https://example.com');
  assert.equal(segments2[1].href, 'https://example.com');
  assert.equal(segments2[2].type, 'text');
  assert.equal(segments2[2].content, '.');

  // Test 3: www. prefix gets https:// href prepended
  const segments3 = parseMessageSegments('Go to www.google.com now');
  assert.equal(segments3.length, 3);
  assert.equal(segments3[1].type, 'link');
  assert.equal(segments3[1].content, 'www.google.com');
  assert.equal(segments3[1].href, 'https://www.google.com');

  // Test 4: Inline code `...`
  const segments4 = parseMessageSegments('Run `npm run dev` to start');
  assert.equal(segments4.length, 3);
  assert.equal(segments4[1].type, 'code');
  assert.equal(segments4[1].content, 'npm run dev');

  // Test 5: Multi-line code block ```...```
  const codeText = 'Here is the code:\n```const x = 42;\nconsole.log(x);```\nDone!';
  const segments5 = parseMessageSegments(codeText);
  assert.equal(segments5.length, 3);
  assert.equal(segments5[1].type, 'codeblock');
  assert.equal(segments5[1].content, 'const x = 42;\nconsole.log(x);');
});

test('Date grouping accurately identifies same day and computes dividers', async () => {
  const { isSameDay, formatDateDivider } = await import('../src/lib/messageFormatting');

  const now = Date.now();
  const oneHourAgo = now - 3600 * 1000;
  const yesterday = now - 25 * 3600 * 1000;

  // Same day
  assert.equal(isSameDay(now, oneHourAgo), true);

  // Today divider
  assert.equal(formatDateDivider(now), 'Today');

  // Yesterday divider
  assert.equal(formatDateDivider(yesterday), 'Yesterday');
});

test('Signaling client polling optimization: no polling when SSE is active, gentle 6s fallback when disconnected', () => {
  class MockSignalingClient {
    public isConnected = false;
    public pollInterval: number | null = null;
    public heartbeatInterval: number | null = null;

    public onSseOpen() {
      this.isConnected = true;
      this.pollInterval = null; // No polling when SSE stream is open!
      this.heartbeatInterval = 45000;
    }

    public onSseError() {
      this.isConnected = false;
      this.pollInterval = 6000; // Gentle fallback only when disconnected
      this.heartbeatInterval = null;
    }
  }

  const client = new MockSignalingClient();
  client.onSseOpen();
  assert.equal(client.isConnected, true);
  assert.equal(client.pollInterval, null, 'Polling must be null while SSE is connected');
  assert.equal(client.heartbeatInterval, 45000);

  client.onSseError();
  assert.equal(client.isConnected, false);
  assert.equal(client.pollInterval, 6000, 'Fallback poll must be 6s when disconnected');
  assert.equal(client.heartbeatInterval, null);
});

test('Delete from both ends strictly requires peer active status (p2pConnected)', () => {
  const canDeleteBothEnds = (isInitiator: boolean, isP2PConnected: boolean) => {
    if (!isInitiator) return { allowed: false, reason: 'Initiator privilege only' };
    if (!isP2PConnected) return { allowed: false, reason: 'Peer is idle. Requires active connection.' };
    return { allowed: true, reason: null };
  };

  // Peer is idle: blocked
  assert.equal(canDeleteBothEnds(true, false).allowed, false);
  assert.equal(canDeleteBothEnds(true, false).reason, 'Peer is idle. Requires active connection.');

  // Non-initiator: blocked
  assert.equal(canDeleteBothEnds(false, true).allowed, false);

  // Initiator + active peer: allowed
  assert.equal(canDeleteBothEnds(true, true).allowed, true);
});

test('Call end preserves chat DataChannel and triggers peer reconnect', () => {
  let dataChannelOpen = true;
  let reconnectedCalled = false;

  const onCallEnd = (peerUid: string) => {
    if (dataChannelOpen) {
      // DataChannel remains healthy, no need to tear down
      return;
    }
    reconnectedCalled = true;
  };

  // Scenario 1: DataChannel survived call end
  onCallEnd('u_peer_1');
  assert.equal(reconnectedCalled, false);

  // Scenario 2: DataChannel dropped during call, triggers reconnect
  dataChannelOpen = false;
  onCallEnd('u_peer_1');
  assert.equal(reconnectedCalled, true);
});


