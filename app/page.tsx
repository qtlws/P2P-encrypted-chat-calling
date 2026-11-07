'use client';

import React, { useEffect, useState, useCallback, useRef } from 'react';
import { secureDataStorage } from '@/lib/secureDataStorage';
import { createIdentity } from '@/src/crypto/identity';
import { UserIdentity } from '@/src/crypto/types';
import { Conversation, StoredMessage } from '@/src/types/chat';
import { PeerRecord } from '@/src/types/peer';
import { ActiveCall } from '@/src/types/webrtc';
import { chatManager, KeyChangeEvent } from '@/src/services/chat/ChatManager';
import { callManager } from '@/src/services/webrtc/CallManager';
import { dataChannelManager } from '@/src/services/webrtc/DataChannelManager';
import { signalingClient } from '@/src/services/signaling/SignalingClient';

import { Sidebar } from '@/components/chat/Sidebar';
import { ChatArea } from '@/components/chat/ChatArea';
import { NewChatModal } from '@/components/chat/NewChatModal';
import { IdentityModal } from '@/components/identity/IdentityModal';
import { SecurityIndicatorModal } from '@/components/chat/SecurityIndicatorModal';
import { PeerVerificationModal } from '@/components/peer/PeerVerificationModal';
import { KeyChangeWarningModal } from '@/components/peer/KeyChangeWarningModal';
import { VideoCallModal } from '@/components/call/VideoCallModal';
import { IncomingCallBanner } from '@/components/call/IncomingCallBanner';
import { DebugPanel } from '@/components/debug/DebugPanel';
import { MediaPermissionBanner } from '@/components/media/MediaPermissionBanner';
import { FuturisticLoadingScreen } from '@/components/ui/FuturisticLoadingScreen';
import { WelcomeOnboardingModal } from '@/components/onboarding/WelcomeOnboardingModal';
import { ArrowLeft, Loader2, AlertCircle, X } from 'lucide-react';

export default function AppHome() {
  const [identity, setIdentity] = useState<UserIdentity | null>(null);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeConversationId, setActiveConversationId] = useState<string | null>(null);
  const [messages, setMessages] = useState<StoredMessage[]>([]);
  const [activeCall, setActiveCall] = useState<ActiveCall | null>(null);
  const [isInitializing, setIsInitializing] = useState(true);
  const [showRelayLoading, setShowRelayLoading] = useState(true);
  const [showWelcomeOnboarding, setShowWelcomeOnboarding] = useState(false);
  const [isGeneratingIdentity, setIsGeneratingIdentity] = useState(false);
  const [isSignalingOnline, setIsSignalingOnline] = useState(false);
  const [callError, setCallError] = useState<string | null>(null);

  // Modals state
  const [showNewChatModal, setShowNewChatModal] = useState(false);
  const [showIdentityModal, setShowIdentityModal] = useState(false);
  const [showSecurityModal, setShowSecurityModal] = useState(false);
  const [showPeerModal, setShowPeerModal] = useState(false);
  const [showDebugPanel, setShowDebugPanel] = useState(false);
  const [keyChangeEvent, setKeyChangeEvent] = useState<KeyChangeEvent | null>(null);

  // Mobile screen state
  const [mobileView, setMobileView] = useState<'sidebar' | 'chat'>('sidebar');

  /**
   * Application Bootstrap Phase:
   * Inspects local storage for existing identity.
   * If existing identity is found, boots automatically.
   * If storage is empty, defers generation until user clicks button in WelcomeOnboardingModal.
   */
  useEffect(() => {
    let isMounted = true;

    async function bootstrap() {
      try {
        const localIdentity = await secureDataStorage.get<UserIdentity>('app:identity');

        if (localIdentity && localIdentity.uid && localIdentity.identityPrivateKey) {
          if (!isMounted) return;
          setIdentity(localIdentity);
          await chatManager.initialize(localIdentity);
          signalingClient.setUid(localIdentity.uid);
          setIsSignalingOnline(true);
        }
      } catch (err) {
        console.error('[Bootstrap] Initialization error:', err);
      } finally {
        if (isMounted) setIsInitializing(false);
      }
    }

    bootstrap();

    return () => {
      isMounted = false;
      signalingClient.disconnect();
    };
  }, []);

  const activeConversationIdRef = useRef<string | null>(null);
  useEffect(() => {
    activeConversationIdRef.current = activeConversationId;
  }, [activeConversationId]);

  const activeConversation = conversations.find((c) => c.id === activeConversationId) || null;
  const isP2PConnected = Boolean(activeConversation?.p2pConnected);

  /**
   * Subscriptions to application events
   */
  useEffect(() => {
    if (!identity) return;

    const unsubConvs = chatManager.onConversationsChange((convList) => {
      setConversations(convList);
    });

    const unsubConvDeleted = chatManager.onConversationDeleted((deletedId) => {
      if (activeConversationIdRef.current === deletedId) {
        setActiveConversationId(null);
        setMessages([]);
        setMobileView('sidebar');
      }
    });

    const unsubMsgs = chatManager.onMessagesChange((convId, msgs) => {
      if (convId === activeConversationIdRef.current) {
        setMessages(msgs);
      }
    });

    const unsubKeyChange = chatManager.onKeyChange((evt) => {
      setKeyChangeEvent(evt);
    });

    const unsubCall = callManager.subscribe((call) => {
      setActiveCall(call);
    });

    const unsubSignaling = signalingClient.onConnectionStateChange((online) => {
      setIsSignalingOnline(online);
    });

    return () => {
      unsubConvs();
      unsubConvDeleted();
      unsubMsgs();
      unsubKeyChange();
      unsubCall();
      unsubSignaling();
    };
  }, [identity]);

  const handleSelectConversation = useCallback((convId: string) => {
    setActiveConversationId(convId);
    setMessages(chatManager.getMessages(convId));
    chatManager.markConversationRead(convId);
    setMobileView('chat');
  }, []);

  const handleSendMessage = async (text: string) => {
    if (!activeConversationId) return;
    await chatManager.sendMessage(activeConversationId, text);
  };

  const handleStartCall = async (peerUid: string, type: 'video' | 'audio') => {
    try {
      setCallError(null);
      await callManager.startCall(peerUid, type);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Could not initiate call';
      setCallError(msg);
      setTimeout(() => setCallError(null), 9000);
    }
  };

  const handleNewChatConnect = async (peerUid: string) => {
    const conv = await chatManager.initiateChat(peerUid);
    handleSelectConversation(conv.id);
  };

  const handleGenerateIdentity = async () => {
    setIsGeneratingIdentity(true);
    try {
      const newIdentity = createIdentity();
      await secureDataStorage.set<UserIdentity>('app:identity', newIdentity);
      setIdentity(newIdentity);
      await chatManager.initialize(newIdentity);
      signalingClient.setUid(newIdentity.uid);
      setIsSignalingOnline(true);
      setShowWelcomeOnboarding(false);
    } catch (err) {
      console.error('[GenerateIdentity] Error:', err);
    } finally {
      setIsGeneratingIdentity(false);
    }
  };

  const handleRestoreIdentity = async (newIdentity: UserIdentity) => {
    await secureDataStorage.set<UserIdentity>('app:identity', newIdentity);
    setIdentity(newIdentity);
    setShowWelcomeOnboarding(false);
    await chatManager.initialize(newIdentity);
    signalingClient.setUid(newIdentity.uid);
    setIsSignalingOnline(true);
  };

  const handleDeleteConversationBothEnds = async (convId: string) => {
    await chatManager.deleteConversationBothEnds(convId);
    if (activeConversationId === convId) {
      setActiveConversationId(null);
      setMessages([]);
      setMobileView('sidebar');
    }
  };

  const handleResetIdentity = async () => {
    // 1. Wipe all connections, in-memory chats, peers, and browser storage
    await chatManager.resetAll();

    // 2. Clear all local React states
    setIdentity(null);
    setActiveConversationId(null);
    setConversations([]);
    setMessages([]);

    // 3. Open Welcome Onboarding so the user generates a completely fresh identity
    setShowWelcomeOnboarding(true);
  };

  const handleRelayLoadingComplete = () => {
    setShowRelayLoading(false);
    // If no identity exists in storage, show the Welcome Onboarding popup dialog
    if (!identity) {
      setShowWelcomeOnboarding(true);
    }
  };

  const activePeerRecord = activeConversation
    ? chatManager.getPeer(activeConversation.peerUid) || {
        uid: activeConversation.peerUid,
        identityPublicKey: activeConversation.peerEncryptionPublicKey,
        encryptionPublicKey: activeConversation.peerEncryptionPublicKey,
        fingerprint: activeConversation.peerIdentityFingerprint,
        firstSeenAt: activeConversation.createdAt,
        lastSeenAt: activeConversation.updatedAt,
        verified: activeConversation.verified,
        blocked: false,
      }
    : null;
  const activeSession = activeConversation ? chatManager.getSession(activeConversation.peerUid) || null : null;

  // Futuristic loading screen when app opens
  if (showRelayLoading || isInitializing) {
    return <FuturisticLoadingScreen onComplete={handleRelayLoadingComplete} />;
  }

  return (
    <div className="h-dvh h-[100dvh] w-full max-w-full bg-zinc-950 text-zinc-100 flex flex-col overflow-hidden select-none font-sans relative">
      {/* Media Permission Status & Access Request Banner */}
      <MediaPermissionBanner />

      {/* In-App Call Alert Notification */}
      {callError && (
        <div className="absolute top-14 left-1/2 -translate-x-1/2 z-50 max-w-lg w-[92%] p-3 rounded-xl bg-rose-950/90 border border-rose-600/80 shadow-2xl text-rose-200 text-xs font-mono flex items-center justify-between">
          <div className="flex items-center space-x-2 min-w-0 pr-2">
            <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
            <span className="truncate">{callError}</span>
          </div>
          <button
            onClick={() => setCallError(null)}
            className="p-1 rounded-lg hover:bg-rose-900 text-rose-300 transition-colors cursor-pointer"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Main Chat Workspace */}
      <div className="flex-1 flex w-full min-h-0 overflow-hidden">
        {/* Sidebar Panel */}
        <div className={`${mobileView === 'sidebar' ? 'flex' : 'hidden md:flex'} flex-col w-full md:w-84 lg:w-96 h-full shrink-0 overflow-hidden border-r border-zinc-800`}>
          <Sidebar
            identity={identity}
            conversations={conversations}
            activeConversationId={activeConversationId}
            onSelectConversation={handleSelectConversation}
            onOpenNewChat={() => setShowNewChatModal(true)}
            onOpenIdentityModal={() => setShowIdentityModal(true)}
            onOpenDebugPanel={() => setShowDebugPanel(true)}
            isSignalingOnline={isSignalingOnline}
          />
        </div>

        {/* Chat Area Panel */}
        <div className={`${mobileView === 'chat' ? 'flex' : 'hidden md:flex'} flex-1 flex-col h-full w-full min-w-0 overflow-hidden`}>
        <ChatArea
          identity={identity}
          conversation={activeConversation}
          messages={messages}
          onSendMessage={handleSendMessage}
          onStartCall={handleStartCall}
          onOpenSecurityModal={() => setShowSecurityModal(true)}
          onOpenPeerVerificationModal={() => setShowPeerModal(true)}
          onDeleteConversation={async (id) => {
            await chatManager.deleteConversation(id);
            setActiveConversationId(null);
            setMobileView('sidebar');
          }}
          onDeleteConversationBothEnds={handleDeleteConversationBothEnds}
          isP2PConnected={isP2PConnected}
          onBack={() => setMobileView('sidebar')}
        />
        </div>
      </div>

      {/* Incoming Call Ringing Banner */}
      <IncomingCallBanner
        call={activeCall}
        onAccept={() => callManager.acceptCall()}
        onReject={() => callManager.rejectCall()}
      />

      {/* Active Video/Audio Call Screen */}
      <VideoCallModal
        call={activeCall}
        onEndCall={() => callManager.endCall()}
        onToggleAudio={() => callManager.toggleAudio()}
        onToggleVideo={() => callManager.toggleVideo()}
        onTogglePin={(peerUid) => callManager.togglePin(peerUid)}
        onSetZoomLevel={(level) => callManager.setZoomLevel(level)}
        onToggleMinimize={() => callManager.toggleMinimize()}
        onAcceptCallWaitingAndHold={() => callManager.acceptCallWaitingAndHoldCurrent()}
        onRejectCallWaiting={() => callManager.rejectCallWaiting()}
        onMergeCallWaiting={() => callManager.mergeCallWaiting()}
        onMergeHeldCall={(id) => callManager.mergeHeldCall(id)}
        onResumeHeldCall={(id) => callManager.resumeHeldCall(id)}
      />

      {/* New Chat Modal */}
      <NewChatModal
        isOpen={showNewChatModal}
        onClose={() => setShowNewChatModal(false)}
        onConnect={handleNewChatConnect}
        myUid={identity?.uid || ''}
      />

      {/* My Identity Modal */}
      <IdentityModal
        isOpen={showIdentityModal}
        onClose={() => setShowIdentityModal(false)}
        identity={identity}
        onRestoreIdentity={handleRestoreIdentity}
        onResetIdentity={handleResetIdentity}
      />

      {/* Cryptographic Security Details Sheet */}
      <SecurityIndicatorModal
        isOpen={showSecurityModal}
        onClose={() => setShowSecurityModal(false)}
        conversation={activeConversation}
        identity={identity}
        isP2PConnected={isP2PConnected}
      />

      {/* Peer Verification & Trust Modal */}
      <PeerVerificationModal
        isOpen={showPeerModal}
        onClose={() => setShowPeerModal(false)}
        peer={activePeerRecord}
        onToggleVerified={async (peerUid, verified) => {
          await chatManager.setPeerVerified(peerUid, verified);
        }}
        onToggleBlocked={async (peerUid, blocked) => {
          await chatManager.setPeerBlocked(peerUid, blocked);
        }}
      />

      {/* Key Change Security Warning Modal */}
      <KeyChangeWarningModal
        event={keyChangeEvent}
        onDismiss={() => setKeyChangeEvent(null)}
        onAcceptNewKey={async (peerUid) => {
          // If explicitly accepted by user, unblock and dismiss
          setKeyChangeEvent(null);
        }}
      />

      {/* Dev Debug Inspector */}
      <DebugPanel
        isOpen={showDebugPanel}
        onClose={() => setShowDebugPanel(false)}
        identity={identity}
        activeConversation={activeConversation}
        activeSession={activeSession}
        isSignalingConnected={isSignalingOnline}
        isP2PConnected={isP2PConnected}
      />

      {/* Welcome Onboarding Modal (Appears when local storage has no identity) */}
      <WelcomeOnboardingModal
        isOpen={showWelcomeOnboarding && !identity}
        onGenerateIdentity={handleGenerateIdentity}
        onOpenRestore={() => setShowIdentityModal(true)}
        isGenerating={isGeneratingIdentity}
      />
    </div>
  );
}
