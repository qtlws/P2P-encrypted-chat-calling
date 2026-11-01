'use client';

import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  Video,
  Phone,
  ShieldCheck,
  Shield,
  Lock,
  Send,
  Trash2,
  Check,
  CheckCheck,
  Clock,
  AlertTriangle,
  Radio,
  ArrowLeft,
  ChevronDown,
} from 'lucide-react';
import { Conversation, StoredMessage } from '@/src/types/chat';
import { UserIdentity } from '@/src/crypto/types';

interface ChatAreaProps {
  identity: UserIdentity | null;
  conversation: Conversation | null;
  messages: StoredMessage[];
  onSendMessage: (text: string) => Promise<void>;
  onStartCall: (peerUid: string, type: 'video' | 'audio') => void;
  onOpenSecurityModal: () => void;
  onOpenPeerVerificationModal: () => void;
  onDeleteConversation: (id: string) => void;
  isP2PConnected: boolean;
  onBack?: () => void;
}

export const ChatArea: React.FC<ChatAreaProps> = ({
  identity,
  conversation,
  messages,
  onSendMessage,
  onStartCall,
  onOpenSecurityModal,
  onOpenPeerVerificationModal,
  onDeleteConversation,
  isP2PConnected,
  onBack,
}) => {
  const [inputText, setInputText] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [errorNotice, setErrorNotice] = useState<string | null>(null);
  const [showScrollBottomPill, setShowScrollBottomPill] = useState(false);

  const containerRef = useRef<HTMLDivElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const isAtBottomRef = useRef(true);
  const prevMessagesCountRef = useRef(messages.length);

  const scrollToBottom = useCallback((smooth = true) => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({
        behavior: smooth ? 'smooth' : 'auto',
      });
      setShowScrollBottomPill(false);
      isAtBottomRef.current = true;
    }
  }, []);

  // Monitor user scrolling: detect whether they are near the bottom
  const handleScroll = () => {
    const el = containerRef.current;
    if (!el) return;
    const threshold = 120; // 120px leeway
    const distanceToBottom = el.scrollHeight - el.scrollTop - el.clientHeight;
    const isBottom = distanceToBottom <= threshold;
    isAtBottomRef.current = isBottom;

    if (isBottom && showScrollBottomPill) {
      setShowScrollBottomPill(false);
    }
  };

  // Immediate scroll to bottom on conversation change
  useEffect(() => {
    if (conversation?.id) {
      scrollToBottom(false);
      prevMessagesCountRef.current = messages.length;
    }
  }, [conversation?.id, scrollToBottom, messages.length]);

  // Handle new incoming or outgoing messages
  useEffect(() => {
    const previousCount = prevMessagesCountRef.current;
    prevMessagesCountRef.current = messages.length;

    if (messages.length === 0) return;

    const latestMessage = messages[messages.length - 1];
    const isOutgoing = identity ? latestMessage?.senderUid === identity.uid : false;

    // If message count increased
    if (messages.length > previousCount) {
      // Auto-scroll to bottom IF:
      // 1. User was already near bottom, OR
      // 2. The user themselves sent this message
      if (isAtBottomRef.current || isOutgoing) {
        scrollToBottom(true);
      } else {
        // User has deliberately scrolled up to read older messages:
        // Do NOT jerk their view, show the "New messages" indicator pill!
        setShowScrollBottomPill(true);
      }
    }
  }, [messages, identity, scrollToBottom]);

  if (!conversation) {
    return (
      <main id="chat-empty-view" className="flex-1 flex flex-col items-center justify-center p-4 sm:p-8 bg-zinc-950 text-center select-none w-full max-w-full overflow-y-auto">
        <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-2xl bg-zinc-900 border border-zinc-800 flex items-center justify-center text-emerald-400 mb-4 shadow-sm">
          <Lock className="w-7 h-7 sm:w-8 sm:h-8" />
        </div>
        <h2 className="text-lg sm:text-xl font-semibold text-zinc-100 mb-2 tracking-tight px-2">
          Zero-Knowledge Peer-to-Peer Messenger
        </h2>
        <p className="text-xs sm:text-sm text-zinc-400 max-w-md mb-6 leading-relaxed px-4">
          No centralized database. No server-side message storage. Keys and identities are generated locally in your browser and messages travel directly between peers over WebRTC.
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 sm:gap-3 max-w-lg w-full text-left text-xs font-mono px-2">
          <div className="p-3 sm:p-3.5 rounded-xl bg-zinc-900/60 border border-zinc-800 text-zinc-400">
            <div className="font-semibold text-zinc-200 mb-1 flex items-center space-x-1.5">
              <span className="w-2 h-2 rounded-full bg-emerald-400" />
              <span>Ed25519 & X25519</span>
            </div>
            <span>Client-side identity signatures & ECDH key exchange.</span>
          </div>
          <div className="p-3 sm:p-3.5 rounded-xl bg-zinc-900/60 border border-zinc-800 text-zinc-400">
            <div className="font-semibold text-zinc-200 mb-1 flex items-center space-x-1.5">
              <span className="w-2 h-2 rounded-full bg-emerald-400" />
              <span>AES-256-GCM AEAD</span>
            </div>
            <span>Authenticated message encryption with unique nonces.</span>
          </div>
        </div>
      </main>
    );
  }

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputText.trim() || isSending) return;

    setErrorNotice(null);
    setIsSending(true);
    try {
      await onSendMessage(inputText.trim());
      setInputText('');
      isAtBottomRef.current = true;
      scrollToBottom(true);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to deliver message';
      setErrorNotice(msg);
    } finally {
      setIsSending(false);
    }
  };

  return (
    <main id="chat-active-view" className="flex-1 flex flex-col h-full w-full max-w-full min-w-0 bg-zinc-950 overflow-hidden relative">
      {/* Conversation Header */}
      <header id="chat-header" className="h-14 sm:h-16 px-2.5 sm:px-4 border-b border-zinc-800 bg-zinc-900/90 backdrop-blur-xs flex items-center justify-between shrink-0 w-full min-w-0 max-w-full">
        <div className="flex items-center space-x-2 sm:space-x-3 min-w-0 flex-1 overflow-hidden">
          {/* Mobile Back Button */}
          {onBack && (
            <button
              id="btn-mobile-back"
              onClick={onBack}
              className="md:hidden p-1.5 -ml-1 rounded-lg text-zinc-400 hover:text-white hover:bg-zinc-800 transition-colors shrink-0"
              title="Back to conversation list"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
          )}

          <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl bg-zinc-800 border border-zinc-700 flex items-center justify-center text-zinc-300 font-mono text-xs font-semibold shrink-0">
            {conversation.peerUid.slice(2, 4).toUpperCase()}
          </div>

          <div className="min-w-0 flex-1 overflow-hidden">
            <div className="flex items-center space-x-1.5 min-w-0">
              <span className="font-mono text-xs sm:text-sm font-medium text-zinc-100 truncate">
                {conversation.peerUid}
              </span>

              <button
                id="btn-verify-peer-header"
                onClick={onOpenPeerVerificationModal}
                title="Click to view & verify peer cryptographic identity and fingerprint"
                className={`flex items-center space-x-1 text-xs px-1.5 sm:px-2 py-0.5 rounded-full border transition-colors shrink-0 cursor-pointer ${
                  conversation.verified
                    ? 'bg-emerald-950/60 border-emerald-800/80 text-emerald-400 hover:bg-emerald-900/60'
                    : 'bg-zinc-800 border-zinc-700 hover:border-zinc-600 text-amber-400'
                }`}
              >
                {conversation.verified ? (
                  <>
                    <ShieldCheck className="w-3 h-3 text-emerald-400" />
                    <span className="text-[10px] text-emerald-400 font-medium hidden sm:inline">Verified</span>
                  </>
                ) : (
                  <>
                    <Shield className="w-3 h-3 text-amber-400" />
                    <span className="text-[10px] text-amber-400 font-medium hidden sm:inline">Verify</span>
                  </>
                )}
              </button>
            </div>

            <div className="flex items-center space-x-2 mt-0.5 text-[10px] sm:text-[11px] font-mono text-zinc-400 min-w-0">
              <span className="truncate">FP: {conversation.peerIdentityFingerprint}</span>
            </div>
          </div>
        </div>

        {/* Header Actions */}
        <div className="flex items-center space-x-1 sm:space-x-1.5 shrink-0 ml-1.5">
          {/* Security Status Pill */}
          <button
            id="btn-security-indicator"
            onClick={onOpenSecurityModal}
            className={`flex items-center space-x-1 px-1.5 py-1.5 sm:px-2.5 sm:py-1.5 rounded-lg border text-xs font-mono transition-colors ${
              isP2PConnected
                ? 'bg-emerald-950/40 border-emerald-800/50 text-emerald-300 hover:bg-emerald-900/40'
                : 'bg-zinc-800/80 border-zinc-700 text-zinc-300 hover:bg-zinc-800'
            }`}
            title="Inspect Cryptographic Security & Fingerprints"
          >
            <Lock className="w-3.5 h-3.5 text-emerald-400" />
            <span className="hidden md:inline">
              {isP2PConnected ? 'P2P DataChannel' : 'E2EE Ready'}
            </span>
          </button>

          {/* Audio Call */}
          <button
            id="btn-start-audio-call"
            onClick={() => onStartCall(conversation.peerUid, 'audio')}
            title="Start P2P Audio Call"
            className="p-1.5 sm:p-2 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-300 hover:text-white transition-colors border border-zinc-700"
          >
            <Phone className="w-4 h-4" />
          </button>

          {/* Video Call */}
          <button
            id="btn-start-video-call"
            onClick={() => onStartCall(conversation.peerUid, 'video')}
            title="Start P2P Video Call"
            className="p-1.5 sm:p-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white transition-colors"
          >
            <Video className="w-4 h-4" />
          </button>

          {/* Delete conversation */}
          <button
            id="btn-delete-conversation"
            onClick={() => {
              if (confirm('Delete local encrypted chat records for this conversation? Counterparty retains their local copy.')) {
                onDeleteConversation(conversation.id);
              }
            }}
            title="Delete local chat records"
            className="p-1.5 sm:p-2 rounded-lg hover:bg-zinc-800 text-zinc-400 hover:text-rose-400 transition-colors"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      </header>

      {/* Messages Stream Container */}
      <div
        id="messages-container"
        ref={containerRef}
        onScroll={handleScroll}
        className="flex-1 overflow-y-auto overflow-x-hidden p-2.5 sm:p-4 space-y-3 scroll-smooth w-full min-w-0 max-w-full"
      >
        {/* E2EE Guarantee Banner */}
        <div className="p-3 rounded-xl bg-zinc-900/70 border border-zinc-800 text-center max-w-xl mx-auto my-2">
          <div className="flex items-center justify-center space-x-1.5 text-xs font-semibold text-emerald-400 mb-1">
            <Lock className="w-3.5 h-3.5" />
            <span>End-to-End Encrypted Session</span>
          </div>
          <p className="text-[11px] text-zinc-400 leading-relaxed">
            Messages are encrypted with AES-256-GCM via X25519-HKDF, signed with Ed25519, and stored exclusively on your device using secure storage envelopes. No server ever sees your messages or keys.
          </p>
        </div>

        {/* Message Items */}
        {messages.map((msg) => {
          const isOutgoing = identity ? msg.senderUid === identity.uid : false;
          return (
            <div
              key={msg.id}
              id={`message-bubble-${msg.id}`}
              className={`flex flex-col w-full max-w-full min-w-0 ${isOutgoing ? 'items-end' : 'items-start'}`}
            >
              <div
                className={`max-w-[88%] sm:max-w-[75%] px-3.5 sm:px-4 py-2 sm:py-2.5 rounded-2xl text-sm leading-relaxed shadow-sm break-words [overflow-wrap:anywhere] [word-break:break-word] ${
                  isOutgoing
                    ? 'bg-emerald-600 text-white rounded-br-none'
                    : 'bg-zinc-900 border border-zinc-800 text-zinc-100 rounded-bl-none'
                }`}
              >
                {/* Plaintext safe render */}
                <span className="whitespace-pre-wrap break-words [overflow-wrap:anywhere]">{msg.plaintext || '[Encrypted Message]'}</span>

                {/* Metadata row */}
                <div
                  className={`mt-1 flex items-center space-x-1.5 text-[10px] font-mono select-none ${
                    isOutgoing ? 'text-emerald-200 justify-end' : 'text-zinc-500 justify-start'
                  }`}
                >
                  <span>
                    {new Date(msg.timestamp).toLocaleTimeString([], {
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </span>

                  {isOutgoing && (
                    <span className="flex items-center">
                      {msg.status === 'sending' && <Clock className="w-3 h-3 text-emerald-300 animate-spin" />}
                      {msg.status === 'sent' && <Check className="w-3 h-3 text-emerald-300" />}
                      {msg.status === 'delivered' && <CheckCheck className="w-3 h-3 text-emerald-200" />}
                      {msg.status === 'failed' && <span className="text-rose-300">Failed</span>}
                    </span>
                  )}
                </div>
              </div>

              {/* Sender fingerprint hint */}
              <span className="text-[10px] text-zinc-600 font-mono mt-0.5 px-1">
                {isOutgoing ? 'You' : `Peer ${msg.senderFingerprint ? msg.senderFingerprint.slice(0, 9) : ''}`}
              </span>
            </div>
          );
        })}

        <div ref={messagesEndRef} className="h-1" />
      </div>

      {/* Floating "Scroll to Bottom" button when new message arrives and user is scrolled up */}
      {showScrollBottomPill && (
        <div className="absolute bottom-16 sm:bottom-20 right-3 sm:right-4 z-20">
          <button
            id="btn-scroll-bottom"
            onClick={() => scrollToBottom(true)}
            className="flex items-center space-x-1.5 px-3 py-1.5 rounded-full bg-emerald-600 hover:bg-emerald-500 text-white shadow-lg text-xs font-mono font-medium transition-all animate-bounce"
          >
            <ChevronDown className="w-3.5 h-3.5" />
            <span>New messages</span>
          </button>
        </div>
      )}

      {/* Active Transport Status Bar */}
      {!isP2PConnected && (
        <div className="px-2.5 sm:px-4 py-1.5 bg-zinc-900/90 border-t border-zinc-800/80 flex items-center justify-between text-xs text-zinc-400 w-full min-w-0 overflow-hidden shrink-0">
          <div className="flex items-center space-x-2 min-w-0">
            <Radio className="w-3.5 h-3.5 text-emerald-400 animate-pulse shrink-0" />
            <span className="text-[10px] sm:text-[11px] font-mono truncate">
              Direct WebRTC DataChannel negotiating. Encrypted messaging & calls active.
            </span>
          </div>
        </div>
      )}

      {errorNotice && (
        <div className="px-2.5 sm:px-4 py-2 bg-rose-950/40 border-t border-rose-900/40 flex items-center space-x-2 text-xs text-rose-300 w-full min-w-0 shrink-0">
          <AlertTriangle className="w-4 h-4 shrink-0 text-rose-400" />
          <span className="truncate">{errorNotice}</span>
        </div>
      )}

      {/* Message Input Bar */}
      <form
        id="chat-input-form"
        onSubmit={handleSend}
        className="p-2 sm:p-3 border-t border-zinc-800 bg-zinc-900/95 flex items-center space-x-2 w-full max-w-full min-w-0 shrink-0 pb-[max(0.65rem,env(safe-area-inset-bottom))]"
      >
        <input
          id="input-message"
          type="text"
          placeholder="Type an encrypted message..."
          value={inputText}
          onChange={(e) => setInputText(e.target.value)}
          className="flex-1 min-w-0 min-h-[42px] sm:min-h-[44px] bg-zinc-950 border border-zinc-800 rounded-xl px-3 sm:px-4 py-2 sm:py-2.5 text-sm text-zinc-100 placeholder-zinc-500 focus:outline-none focus:border-emerald-500 transition-colors"
        />

        <button
          id="btn-send-message"
          type="submit"
          disabled={!inputText.trim() || isSending}
          className="min-h-[42px] sm:min-h-[44px] px-3 sm:px-4 py-2 sm:py-2.5 bg-emerald-600 hover:bg-emerald-500 active:bg-emerald-700 disabled:opacity-40 text-white rounded-xl font-medium text-sm transition-colors flex items-center space-x-1.5 shadow-sm shrink-0"
        >
          <span className="hidden sm:inline">Send</span>
          <Send className="w-3.5 h-3.5" />
        </button>
      </form>
    </main>
  );
};
