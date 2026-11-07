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
  ExternalLink,
  Copy,
} from 'lucide-react';
import { Conversation, StoredMessage } from '@/src/types/chat';
import { UserIdentity } from '@/src/crypto/types';
import { parseMessageSegments, isSameDay, formatDateDivider } from '@/src/lib/messageFormatting';

interface ChatAreaProps {
  identity: UserIdentity | null;
  conversation: Conversation | null;
  messages: StoredMessage[];
  onSendMessage: (text: string) => Promise<void>;
  onStartCall: (peerUid: string, type: 'video' | 'audio') => void;
  onOpenSecurityModal: () => void;
  onOpenPeerVerificationModal: () => void;
  onDeleteConversation: (id: string) => void;
  onDeleteConversationBothEnds?: (id: string) => Promise<void>;
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
  onDeleteConversationBothEnds,
  isP2PConnected,
  onBack,
}) => {
  const [inputText, setInputText] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [errorNotice, setErrorNotice] = useState<string | null>(null);
  const [showScrollBottomPill, setShowScrollBottomPill] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState<'none' | 'local' | 'both'>('none');
  const [isDeletingBoth, setIsDeletingBoth] = useState(false);
  const [copiedMessageId, setCopiedMessageId] = useState<string | null>(null);

  const containerRef = useRef<HTMLDivElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const isAtBottomRef = useRef(true);
  const prevMessagesCountRef = useRef(messages.length);

  // Auto-dismiss transient notices
  useEffect(() => {
    if (errorNotice) {
      const timer = setTimeout(() => setErrorNotice(null), 4000);
      return () => clearTimeout(timer);
    }
  }, [errorNotice]);

  const isInitiator = conversation
    ? Boolean(conversation.isInitiator ?? (conversation.initiatorUid === identity?.uid))
    : false;

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
    if (!isP2PConnected) {
      setErrorNotice('Peer is currently idle / not connected. Chat typing & messaging will enable when peer is active.');
      return;
    }
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

  const handleCopyMessage = async (msgId: string, text: string) => {
    if (!text) return;
    try {
      await navigator.clipboard.writeText(text);
      setCopiedMessageId(msgId);
      setTimeout(() => {
        setCopiedMessageId((cur) => (cur === msgId ? null : cur));
      }, 2000);
    } catch (err) {
      console.error('Failed to copy message text:', err);
    }
  };

  const renderMessageContent = (plaintext: string, isOutgoing: boolean) => {
    if (!plaintext) {
      return <span className="italic text-zinc-400">[Encrypted Message]</span>;
    }

    const segments = parseMessageSegments(plaintext);

    return (
      <div className="space-y-1">
        {segments.map((seg, idx) => {
          if (seg.type === 'link') {
            return (
              <a
                key={idx}
                href={seg.href}
                target="_blank"
                rel="noopener noreferrer"
                onClick={(e) => e.stopPropagation()}
                title={`Open external link: ${seg.href} (Direct link, no preview metadata generated)`}
                className={`inline-flex items-center space-x-0.5 underline underline-offset-2 break-all font-medium transition-colors cursor-pointer select-text ${
                  isOutgoing
                    ? 'text-emerald-100 hover:text-white decoration-emerald-200/80 hover:decoration-white'
                    : 'text-cyan-300 hover:text-cyan-200 decoration-cyan-400/80 hover:decoration-cyan-200'
                }`}
              >
                <span>{seg.content}</span>
                <ExternalLink className="w-3 h-3 inline-block shrink-0 ml-0.5 opacity-80" />
              </a>
            );
          }

          if (seg.type === 'code') {
            return (
              <code
                key={idx}
                className={`font-mono text-xs px-1.5 py-0.5 rounded break-all select-text ${
                  isOutgoing
                    ? 'bg-emerald-700/60 text-emerald-100 border border-emerald-500/40'
                    : 'bg-zinc-800/90 text-emerald-300 border border-zinc-700/60'
                }`}
              >
                {seg.content}
              </code>
            );
          }

          if (seg.type === 'codeblock') {
            return (
              <pre
                key={idx}
                className={`my-1.5 p-2.5 rounded-lg font-mono text-xs overflow-x-auto whitespace-pre select-text ${
                  isOutgoing
                    ? 'bg-emerald-800/60 text-emerald-100 border border-emerald-500/40'
                    : 'bg-zinc-950/90 text-emerald-300 border border-zinc-800'
                }`}
              >
                <code>{seg.content}</code>
              </pre>
            );
          }

          return (
            <span key={idx} className="whitespace-pre-wrap break-words [overflow-wrap:anywhere]">
              {seg.content}
            </span>
          );
        })}
      </div>
    );
  };

  const handleCallClick = (type: 'audio' | 'video') => {
    if (!isP2PConnected) {
      setErrorNotice(`Peer is currently idle / offline. P2P ${type} call can only be placed when peer is active.`);
      return;
    }
    if (conversation) {
      onStartCall(conversation.peerUid, type);
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
            onClick={() => handleCallClick('audio')}
            title={isP2PConnected ? "Start P2P Audio Call" : "Peer is idle. P2P audio call available when peer is active."}
            className={`p-1.5 sm:p-2 rounded-lg transition-colors border ${
              isP2PConnected
                ? 'bg-zinc-800 hover:bg-zinc-700 text-zinc-300 hover:text-white border-zinc-700'
                : 'bg-zinc-900/60 text-zinc-600 border-zinc-800/80 cursor-not-allowed opacity-50'
            }`}
          >
            <Phone className="w-4 h-4" />
          </button>

          {/* Video Call */}
          <button
            id="btn-start-video-call"
            onClick={() => handleCallClick('video')}
            title={isP2PConnected ? "Start P2P Video Call" : "Peer is idle. P2P video call available when peer is active."}
            className={`p-1.5 sm:p-2 rounded-lg transition-colors ${
              isP2PConnected
                ? 'bg-emerald-600 hover:bg-emerald-500 text-white'
                : 'bg-zinc-900/60 text-zinc-600 border border-zinc-800/80 cursor-not-allowed opacity-50'
            }`}
          >
            <Video className="w-4 h-4" />
          </button>

          {/* Initiator: Delete from both ends */}
          {isInitiator && onDeleteConversationBothEnds && (
            <button
              id="btn-delete-both-ends"
              onClick={() => {
                if (!isP2PConnected) {
                  setErrorNotice('Peer is currently idle. "Delete from both ends" requires peer to be active so deletion can be synchronized.');
                  return;
                }
                setShowDeleteModal('both');
              }}
              title={
                isP2PConnected
                  ? "Delete chat from both ends (Initiator feature)"
                  : "Peer is idle. 'Delete from both ends' requires peer to be active."
              }
              className={`flex items-center space-x-1 px-2 py-1 sm:px-2.5 sm:py-1.5 rounded-lg border transition-colors text-xs font-mono font-medium ${
                isP2PConnected
                  ? 'bg-rose-950/40 border-rose-800/60 hover:bg-rose-900/60 text-rose-300 cursor-pointer'
                  : 'bg-zinc-900/60 border-zinc-800/80 text-zinc-600 opacity-50 cursor-not-allowed'
              }`}
            >
              <Trash2 className="w-3.5 h-3.5 text-rose-400" />
              <span className="hidden sm:inline">Delete Both Ends</span>
            </button>
          )}

          {/* Delete local conversation */}
          <button
            id="btn-delete-conversation"
            onClick={() => setShowDeleteModal('local')}
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

        {/* Message Items with Date Dividers */}
        {messages.map((msg, index) => {
          const isOutgoing = identity ? msg.senderUid === identity.uid : false;
          const prevMsg = index > 0 ? messages[index - 1] : null;
          const showDateDivider = !prevMsg || !isSameDay(prevMsg.timestamp, msg.timestamp);

          return (
            <React.Fragment key={msg.id}>
              {/* Date divider badge */}
              {showDateDivider && (
                <div className="flex items-center justify-center my-3 w-full select-none">
                  <div className="h-px bg-zinc-800 flex-1 max-w-[80px] sm:max-w-[120px]" />
                  <span className="mx-2.5 px-2.5 py-0.5 rounded-full bg-zinc-800/80 border border-zinc-700/50 text-[10px] font-mono text-zinc-400 font-medium tracking-wide">
                    {formatDateDivider(msg.timestamp)}
                  </span>
                  <div className="h-px bg-zinc-800 flex-1 max-w-[80px] sm:max-w-[120px]" />
                </div>
              )}

              <div
                id={`message-bubble-${msg.id}`}
                className={`group flex flex-col w-full max-w-full min-w-0 ${isOutgoing ? 'items-end' : 'items-start'}`}
              >
                <div
                  className={`relative max-w-[90%] sm:max-w-[78%] px-3.5 sm:px-4 py-2 sm:py-2.5 rounded-2xl text-sm leading-relaxed shadow-sm break-words [overflow-wrap:anywhere] [word-break:break-word] ${
                    isOutgoing
                      ? 'bg-emerald-600 text-white rounded-br-none'
                      : 'bg-zinc-900 border border-zinc-800 text-zinc-100 rounded-bl-none'
                  }`}
                >
                  {/* Formatted Content: clickable links without previews, inline code, codeblocks, text */}
                  {renderMessageContent(msg.plaintext || '', isOutgoing)}

                  {/* Metadata row */}
                  <div
                    className={`mt-1.5 flex items-center space-x-1.5 text-[10px] font-mono select-none ${
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

                {/* Sender info & copy toolbar */}
                <div className="flex items-center space-x-1.5 mt-0.5 px-1">
                  <span className="text-[10px] text-zinc-600 font-mono">
                    {isOutgoing ? 'You' : `Peer ${msg.senderFingerprint ? msg.senderFingerprint.slice(0, 9) : ''}`}
                  </span>

                  {msg.plaintext && (
                    <button
                      id={`btn-copy-${msg.id}`}
                      type="button"
                      onClick={() => handleCopyMessage(msg.id, msg.plaintext || '')}
                      title={copiedMessageId === msg.id ? 'Copied to clipboard!' : 'Copy message text'}
                      className="opacity-0 group-hover:opacity-100 focus:opacity-100 transition-opacity p-0.5 rounded hover:bg-zinc-800 text-zinc-500 hover:text-zinc-300"
                    >
                      {copiedMessageId === msg.id ? (
                        <span className="flex items-center text-[10px] text-emerald-400 font-mono">
                          <Check className="w-2.5 h-2.5 mr-0.5" />
                          <span>Copied</span>
                        </span>
                      ) : (
                        <Copy className="w-2.5 h-2.5" />
                      )}
                    </button>
                  )}
                </div>
              </div>
            </React.Fragment>
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
      {!isP2PConnected ? (
        <div id="peer-idle-banner" className="px-2.5 sm:px-4 py-2 bg-amber-950/30 border-t border-amber-900/40 flex items-center justify-between text-xs text-amber-300 w-full min-w-0 overflow-hidden shrink-0">
          <div className="flex items-center space-x-2 min-w-0">
            <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse shrink-0" />
            <span className="text-[11px] font-mono truncate">
              Peer status: <span className="font-semibold text-amber-200">Idle</span>. Messaging & calls will activate once peer is active.
            </span>
          </div>
        </div>
      ) : (
        <div id="peer-active-banner" className="px-2.5 sm:px-4 py-1.5 bg-emerald-950/20 border-t border-emerald-900/30 flex items-center justify-between text-xs text-emerald-300 w-full min-w-0 overflow-hidden shrink-0">
          <div className="flex items-center space-x-2 min-w-0">
            <span className="w-2 h-2 rounded-full bg-emerald-400 shrink-0" />
            <span className="text-[10px] sm:text-[11px] font-mono text-emerald-400 truncate">
              Direct P2P DataChannel Active &bull; Zero-Knowledge E2EE Verified
            </span>
          </div>
        </div>
      )}

      {errorNotice && (
        <div className="px-2.5 sm:px-4 py-2 bg-rose-950/50 border-t border-rose-900/50 flex items-center space-x-2 text-xs text-rose-300 w-full min-w-0 shrink-0 animate-in fade-in duration-150">
          <AlertTriangle className="w-4 h-4 shrink-0 text-rose-400" />
          <span className="truncate">{errorNotice}</span>
        </div>
      )}

      {/* Message Input Bar with multiline support and anti-autofill */}
      <form
        id="chat-input-form"
        onSubmit={handleSend}
        autoComplete="off"
        noValidate
        data-form-type="other"
        className="p-2 sm:p-3 border-t border-zinc-800 bg-zinc-900/95 flex items-end space-x-2 w-full max-w-full min-w-0 shrink-0 pb-[max(0.65rem,env(safe-area-inset-bottom))]"
      >
        <div
          className="flex-1 min-w-0 relative"
          onClick={() => {
            if (!isP2PConnected) {
              setErrorNotice('Peer is currently idle / not connected. Chat typing & messaging will enable when peer is active.');
            }
          }}
        >
          <textarea
            id="input-message"
            name="ephemeral_p2p_chat_field"
            autoComplete="off"
            autoCorrect="off"
            autoCapitalize="off"
            spellCheck={false}
            data-form-type="other"
            data-lpignore="true"
            data-1p-ignore="true"
            aria-autocomplete="none"
            rows={1}
            disabled={!isP2PConnected || isSending}
            placeholder={
              isP2PConnected
                ? 'Type an encrypted message... (Shift+Enter for newline)'
                : 'Peer is idle. Chat input will open when peer is active (P2P)...'
            }
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                if (isP2PConnected && inputText.trim() && !isSending) {
                  handleSend(e);
                }
              }
            }}
            className={`w-full min-h-[42px] max-h-32 resize-none border rounded-xl px-3 sm:px-4 py-2 sm:py-2.5 text-sm transition-colors ${
              isP2PConnected
                ? 'bg-zinc-950 border-zinc-800 text-zinc-100 placeholder-zinc-500 focus:outline-none focus:border-emerald-500'
                : 'bg-zinc-950/60 border-zinc-800/60 text-zinc-500 placeholder-zinc-600 cursor-not-allowed'
            }`}
          />
        </div>

        <button
          id="btn-send-message"
          type="submit"
          disabled={!isP2PConnected || !inputText.trim() || isSending}
          className="min-h-[42px] px-3 sm:px-4 py-2 sm:py-2.5 bg-emerald-600 hover:bg-emerald-500 active:bg-emerald-700 disabled:opacity-30 disabled:cursor-not-allowed text-white rounded-xl font-medium text-sm transition-colors flex items-center space-x-1.5 shadow-sm shrink-0 mb-0.5"
        >
          <span className="hidden sm:inline">Send</span>
          <Send className="w-3.5 h-3.5" />
        </button>
      </form>

      {/* Delete Confirmation Modal */}
      {showDeleteModal === 'both' && (
        <div id="modal-delete-both" className="fixed inset-0 z-50 bg-black/80 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="w-full max-w-md bg-zinc-900 border border-rose-900/60 rounded-2xl p-6 shadow-2xl space-y-4 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center space-x-3 text-rose-400">
              <div className="w-10 h-10 rounded-xl bg-rose-950/60 border border-rose-800/80 flex items-center justify-center shrink-0">
                <Trash2 className="w-5 h-5 text-rose-400" />
              </div>
              <div>
                <h3 className="font-semibold text-base text-zinc-100">Delete Chat From Both Ends</h3>
                <span className="text-xs text-rose-300 font-mono">Initiator Privilege</span>
              </div>
            </div>
            <p className="text-xs text-zinc-300 leading-relaxed">
              A deletion request will be sent to the counterparty device. This will permanently erase this conversation and all encrypted message histories from <strong className="text-white">both your device and the peer&apos;s device</strong>, and remove each other from the chat list. This action cannot be undone.
            </p>
            <div className="flex items-center justify-end space-x-2 pt-2">
              <button
                type="button"
                onClick={() => setShowDeleteModal('none')}
                disabled={isDeletingBoth}
                className="px-3.5 py-2 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-xs font-medium transition-colors"
              >
                Cancel
              </button>
              <button
                id="btn-confirm-delete-both"
                type="button"
                disabled={isDeletingBoth}
                onClick={async () => {
                  if (!onDeleteConversationBothEnds || !conversation) return;
                  if (!isP2PConnected) {
                    setErrorNotice('Peer is currently idle. Cannot delete from both ends while peer is not active.');
                    setShowDeleteModal('none');
                    return;
                  }
                  setIsDeletingBoth(true);
                  try {
                    await onDeleteConversationBothEnds(conversation.id);
                    setShowDeleteModal('none');
                  } catch (err: unknown) {
                    setErrorNotice(err instanceof Error ? err.message : 'Failed to delete chat from both ends');
                  } finally {
                    setIsDeletingBoth(false);
                  }
                }}
                className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 disabled:opacity-50 text-white text-xs font-semibold transition-colors flex items-center space-x-1.5"
              >
                {isDeletingBoth ? 'Purging both devices...' : 'Delete From Both Ends'}
              </button>
            </div>
          </div>
        </div>
      )}

      {showDeleteModal === 'local' && (
        <div id="modal-delete-local" className="fixed inset-0 z-50 bg-black/80 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="w-full max-w-md bg-zinc-900 border border-zinc-800 rounded-2xl p-6 shadow-2xl space-y-4 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center space-x-3 text-zinc-300">
              <div className="w-10 h-10 rounded-xl bg-zinc-800 border border-zinc-700 flex items-center justify-center shrink-0">
                <Trash2 className="w-5 h-5 text-zinc-400" />
              </div>
              <div>
                <h3 className="font-semibold text-base text-zinc-100">Delete Local Chat</h3>
                <span className="text-xs text-zinc-400 font-mono">This device only</span>
              </div>
            </div>
            <p className="text-xs text-zinc-300 leading-relaxed">
              Delete local encrypted chat records for this conversation on this device? The counterparty will retain their local copy on their device.
            </p>
            <div className="flex items-center justify-end space-x-2 pt-2">
              <button
                type="button"
                onClick={() => setShowDeleteModal('none')}
                className="px-3.5 py-2 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-xs font-medium transition-colors"
              >
                Cancel
              </button>
              <button
                id="btn-confirm-delete-local"
                type="button"
                onClick={() => {
                  if (conversation) {
                    onDeleteConversation(conversation.id);
                  }
                  setShowDeleteModal('none');
                }}
                className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-semibold transition-colors"
              >
                Delete for Me Only
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
};
