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
import { ArrowLeft, Loader2 } from 'lucide-react';

export default function AppHome() {
  const [identity, setIdentity] = useState<UserIdentity | null>(null);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeConversationId, setActiveConversationId] = useState<string | null>(null);
  const [messages, setMessages] = useState<StoredMessage[]>([]);
  const [activeCall, setActiveCall] = useState<ActiveCall | null>(null);
  const [isInitializing, setIsInitializing] = useState(true);
  const [isSignalingOnline, setIsSignalingOnline] = useState(false);
  const [isP2PConnected, setIsP2PConnected] = useState(false);

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
   * Application Bootstrap Phase
   */
  useEffect(() => {
    let isMounted = true;

    async function bootstrap() {
      try {
        // 1. Check existing identity in secureDataStorage
        let localIdentity = await secureDataStorage.get<UserIdentity>('app:identity');

        if (!localIdentity) {
          // 2. Generate local cryptographic identity
          localIdentity = createIdentity();
          await secureDataStorage.set<UserIdentity>('app:identity', localIdentity);
        }

        if (!isMounted) return;
        setIdentity(localIdentity);

        // 3. Initialize Chat & Signaling subsystems
        await chatManager.initialize(localIdentity);

        // 4. Connect to signaling server SSE stream
        signalingClient.setUid(localIdentity.uid);
        setIsSignalingOnline(true);
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

  /**
   * Subscriptions to application events
   */
  useEffect(() => {
    if (!identity) return;

    const unsubConvs = chatManager.onConversationsChange((convList) => {
      setConversations(convList);
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

    const unsubChannel = dataChannelManager.onStatusChange((peerUid, isOpen) => {
      const activeId = activeConversationIdRef.current;
      if (!activeId) return;
      const conv = chatManager.getConversations().find((c) => c.id === activeId);
      if (conv && conv.peerUid === peerUid) {
        setIsP2PConnected(isOpen);
      }
    });

    const unsubSignaling = signalingClient.onConnectionStateChange((online) => {
      setIsSignalingOnline(online);
    });

    return () => {
      unsubConvs();
      unsubMsgs();
      unsubKeyChange();
      unsubCall();
      unsubChannel();
      unsubSignaling();
    };
  }, [identity]);

  const handleSelectConversation = useCallback((convId: string) => {
    setActiveConversationId(convId);
    setMessages(chatManager.getMessages(convId));
    chatManager.markConversationRead(convId);
    const conv = chatManager.getConversations().find((c) => c.id === convId);
    if (conv) {
      setIsP2PConnected(dataChannelManager.isChannelOpen(conv.peerUid));
    } else {
      setIsP2PConnected(false);
    }
    setMobileView('chat');
  }, []);

  const handleSendMessage = async (text: string) => {
    if (!activeConversationId) return;
    await chatManager.sendMessage(activeConversationId, text);
  };

  const handleStartCall = async (peerUid: string, type: 'video' | 'audio') => {
    try {
      await callManager.startCall(peerUid, type);
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : 'Could not initiate call');
    }
  };

  const handleNewChatConnect = async (peerUid: string) => {
    const conv = await chatManager.initiateChat(peerUid);
    handleSelectConversation(conv.id);
  };

  const handleRestoreIdentity = async (newIdentity: UserIdentity) => {
    await secureDataStorage.set<UserIdentity>('app:identity', newIdentity);
    setIdentity(newIdentity);
    await chatManager.initialize(newIdentity);
  };

  const handleResetIdentity = async () => {
    await secureDataStorage.clear();
    const newIdentity = createIdentity();
    await secureDataStorage.set<UserIdentity>('app:identity', newIdentity);
    setIdentity(newIdentity);
    setActiveConversationId(null);
    setConversations([]);
    setMessages([]);
    await chatManager.initialize(newIdentity);
  };

  const activeConversation = conversations.find((c) => c.id === activeConversationId) || null;
  const activePeerRecord = activeConversation ? chatManager.getPeer(activeConversation.peerUid) || null : null;
  const activeSession = activeConversation ? chatManager.getSession(activeConversation.peerUid) || null : null;

  if (isInitializing) {
    return (
      <div className="h-screen w-screen bg-zinc-950 flex flex-col items-center justify-center text-zinc-100 font-mono">
        <Loader2 className="w-8 h-8 text-emerald-400 animate-spin mb-4" />
        <h2 className="text-sm font-semibold text-zinc-200">Initializing Zero-Knowledge Environment</h2>
        <p className="text-xs text-zinc-500 mt-1">Generating client-side keys & loading encrypted storage...</p>
      </div>
    );
  }

  return (
    <div className="h-screen w-screen bg-zinc-950 text-zinc-100 flex overflow-hidden select-none font-sans">
      {/* Mobile Back Header when in Chat view */}
      {mobileView === 'chat' && (
        <div className="md:hidden fixed top-2 left-2 z-40">
          <button
            onClick={() => setMobileView('sidebar')}
            className="p-2 rounded-xl bg-zinc-900 border border-zinc-800 text-zinc-300 shadow-md flex items-center space-x-1 text-xs"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Chats</span>
          </button>
        </div>
      )}

      {/* Sidebar Panel */}
      <div className={`${mobileView === 'sidebar' ? 'block' : 'hidden md:block'} h-full`}>
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
      <div className={`${mobileView === 'chat' ? 'flex' : 'hidden md:flex'} flex-1 h-full`}>
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
          isP2PConnected={isP2PConnected}
        />
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
    </div>
  );
}
