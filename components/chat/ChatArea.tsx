'use client';

import React, { useState, useRef, useEffect } from 'react';
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
  ExternalLink,
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
}) => {
  const [inputText, setInputText] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [errorNotice, setErrorNotice] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  if (!conversation) {
    return (
      <main id="chat-empty-view" className="flex-1 flex flex-col items-center justify-center p-8 bg-zinc-950 text-center select-none">
        <div className="w-16 h-16 rounded-2xl bg-zinc-900 border border-zinc-800 flex items-center justify-center text-emerald-400 mb-4 shadow-sm">
          <Lock className="w-8 h-8" />
        </div>
        <h2 className="text-xl font-semibold text-zinc-100 mb-2 tracking-tight">
          Zero-Knowledge Peer-to-Peer Messenger
        </h2>
        <p className="text-sm text-zinc-400 max-w-md mb-6 leading-relaxed">
          No centralized database. No server-side message storage. Keys and identities are generated locally in your browser and messages travel directly between peers over WebRTC.
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-w-lg text-left text-xs font-mono">
          <div className="p-3 rounded-xl bg-zinc-900/60 border border-zinc-800 text-zinc-400">
            <div className="font-semibold text-zinc-200 mb-1 flex items-center space-x-1.5">
              <span className="w-2 h-2 rounded-full bg-emerald-400" />
              <span>Ed25519 & X25519</span>
            </div>
            <span>Client-side identity signatures & ECDH key exchange.</span>
          </div>
          <div className="p-3 rounded-xl bg-zinc-900/60 border border-zinc-800 text-zinc-400">
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
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to deliver message';
      setErrorNotice(msg);
    } finally {
      setIsSending(false);
    }
  };

  return (
    <main id="chat-active-view" className="flex-1 flex flex-col h-full bg-zinc-950 overflow-hidden">
      {/* Conversation Header */}
      <header id="chat-header" className="h-16 px-4 border-b border-zinc-800 bg-zinc-900/80 flex items-center justify-between flex-shrink-0">
        <div className="flex items-center space-x-3 min-w-0">
          <div className="w-9 h-9 rounded-xl bg-zinc-800 border border-zinc-700 flex items-center justify-center text-zinc-300 font-mono text-xs font-semibold flex-shrink-0">
            {conversation.peerUid.slice(2, 4).toUpperCase()}
          </div>

          <div className="min-w-0">
            <div className="flex items-center space-x-2">
              <span className="font-mono text-sm font-medium text-zinc-100 truncate">
                {conversation.peerUid}
              </span>

              <button
                id="btn-verify-peer-header"
                onClick={onOpenPeerVerificationModal}
                className="flex items-center space-x-1 text-xs px-2 py-0.5 rounded-full border transition-colors flex-shrink-0 bg-zinc-800 border-zinc-700 hover:border-zinc-600"
              >
                {conversation.verified ? (
                  <>
                    <ShieldCheck className="w-3 h-3 text-emerald-400" />
                    <span className="text-[10px] text-emerald-400 font-medium">Verified</span>
                  </>
                ) : (
                  <>
                    <Shield className="w-3 h-3 text-amber-400" />
                    <span className="text-[10px] text-amber-400 font-medium">Unverified</span>
                  </>
                )}
              </button>
            </div>

            <div className="flex items-center space-x-2 mt-0.5 text-[11px] font-mono text-zinc-400">
              <span className="truncate">FP: {conversation.peerIdentityFingerprint}</span>
            </div>
          </div>
        </div>

        {/* Header Actions */}
        <div className="flex items-center space-x-1.5 flex-shrink-0">
          {/* Security Status Pill */}
          <button
            id="btn-security-indicator"
            onClick={onOpenSecurityModal}
            className={`flex items-center space-x-1.5 px-2.5 py-1.5 rounded-lg border text-xs font-mono transition-colors ${
              isP2PConnected
                ? 'bg-emerald-950/40 border-emerald-800/50 text-emerald-300 hover:bg-emerald-900/40'
                : 'bg-zinc-800/80 border-zinc-700 text-zinc-300 hover:bg-zinc-800'
            }`}
            title="Inspect Cryptographic Security & Fingerprints"
          >
            <Lock className="w-3.5 h-3.5 text-emerald-400" />
            <span className="hidden sm:inline">
              {isP2PConnected ? 'P2P DataChannel' : 'E2EE Ready'}
            </span>
          </button>

          {/* Audio Call */}
          <button
            id="btn-start-audio-call"
            onClick={() => onStartCall(conversation.peerUid, 'audio')}
            title="Start P2P Audio Call"
            className="p-2 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-300 hover:text-white transition-colors border border-zinc-700"
          >
            <Phone className="w-4 h-4" />
          </button>

          {/* Video Call */}
          <button
            id="btn-start-video-call"
            onClick={() => onStartCall(conversation.peerUid, 'video')}
            title="Start P2P Video Call"
            className="p-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white transition-colors"
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
            className="p-2 rounded-lg hover:bg-zinc-800 text-zinc-400 hover:text-rose-400 transition-colors"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      </header>

      {/* Messages Stream */}
      <div id="messages-container" className="flex-1 overflow-y-auto p-4 space-y-3.5">
        {/* E2EE Guarantee Banner */}
        <div className="p-3.5 rounded-xl bg-zinc-900/70 border border-zinc-800 text-center max-w-xl mx-auto my-2">
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
              className={`flex flex-col ${isOutgoing ? 'items-end' : 'items-start'}`}
            >
              <div
                className={`max-w-[85%] sm:max-w-[70%] px-4 py-2.5 rounded-2xl text-sm leading-relaxed break-words shadow-sm ${
                  isOutgoing
                    ? 'bg-emerald-600 text-white rounded-br-none'
                    : 'bg-zinc-900 border border-zinc-800 text-zinc-100 rounded-bl-none'
                }`}
              >
                {/* Render text as pure string (Zero danger of XSS injection) */}
                <span className="whitespace-pre-wrap">{msg.plaintext || '[Encrypted Message]'}</span>

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

        <div ref={messagesEndRef} />
      </div>

      {/* Warning Notice if Disconnected */}
      {!isP2PConnected && (
        <div className="px-4 py-2 bg-amber-950/40 border-t border-amber-900/40 flex items-center space-x-2 text-xs text-amber-300">
          <AlertTriangle className="w-4 h-4 flex-shrink-0 text-amber-400" />
          <span>
            Direct P2P DataChannel is currently connecting. Messages will automatically sync as soon as peer session connects.
          </span>
        </div>
      )}

      {errorNotice && (
        <div className="px-4 py-2 bg-rose-950/40 border-t border-rose-900/40 flex items-center space-x-2 text-xs text-rose-300">
          <AlertTriangle className="w-4 h-4 flex-shrink-0 text-rose-400" />
          <span>{errorNotice}</span>
        </div>
      )}

      {/* Message Input Bar */}
      <form id="chat-input-form" onSubmit={handleSend} className="p-3 border-t border-zinc-800 bg-zinc-900/90 flex items-center space-x-2">
        <input
          id="input-message"
          type="text"
          placeholder="Type an end-to-end encrypted message..."
          value={inputText}
          onChange={(e) => setInputText(e.target.value)}
          className="flex-1 bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-2.5 text-sm text-zinc-100 placeholder-zinc-500 focus:outline-none focus:border-emerald-500"
          autoFocus
        />

        <button
          id="btn-send-message"
          type="submit"
          disabled={!inputText.trim() || isSending}
          className="px-4 py-2.5 bg-emerald-600 hover:bg-emerald-500 active:bg-emerald-700 disabled:opacity-40 text-white rounded-xl font-medium text-sm transition-colors flex items-center space-x-1.5 shadow-sm"
        >
          <span>Send</span>
          <Send className="w-3.5 h-3.5" />
        </button>
      </form>
    </main>
  );
};
