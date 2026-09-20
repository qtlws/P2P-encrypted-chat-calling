'use client';

import React, { useState } from 'react';
import {
  Shield,
  ShieldCheck,
  Plus,
  Copy,
  Check,
  Key,
  Radio,
  Lock,
  Search,
  User,
  ExternalLink,
} from 'lucide-react';
import { Conversation } from '@/src/types/chat';
import { UserIdentity } from '@/src/crypto/types';

interface SidebarProps {
  identity: UserIdentity | null;
  conversations: Conversation[];
  activeConversationId: string | null;
  onSelectConversation: (id: string) => void;
  onOpenNewChat: () => void;
  onOpenIdentityModal: () => void;
  onOpenDebugPanel: () => void;
  isSignalingOnline: boolean;
}

export const Sidebar: React.FC<SidebarProps> = ({
  identity,
  conversations,
  activeConversationId,
  onSelectConversation,
  onOpenNewChat,
  onOpenIdentityModal,
  onOpenDebugPanel,
  isSignalingOnline,
}) => {
  const [copied, setCopied] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  const copyMyUid = () => {
    if (!identity) return;
    navigator.clipboard.writeText(identity.uid);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const filteredConversations = conversations.filter((c) =>
    c.peerUid.toLowerCase().includes(searchQuery.toLowerCase()) ||
    c.peerIdentityFingerprint.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <aside
      id="app-sidebar"
      className="w-full md:w-84 lg:w-96 bg-zinc-900 border-r border-zinc-800 flex flex-col h-full select-none text-zinc-100 flex-shrink-0"
    >
      {/* Header */}
      <div id="sidebar-header" className="p-4 border-b border-zinc-800 flex items-center justify-between">
        <div className="flex items-center space-x-2.5">
          <div className="w-8 h-8 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400">
            <Lock className="w-4 h-4" />
          </div>
          <div>
            <h1 className="font-semibold text-sm tracking-tight text-zinc-100">Zero-Knowledge P2P</h1>
            <div className="flex items-center space-x-1.5 mt-0.5">
              <span
                className={`w-1.5 h-1.5 rounded-full ${
                  isSignalingOnline ? 'bg-emerald-400 animate-pulse' : 'bg-amber-400'
                }`}
              />
              <span className="text-[11px] text-zinc-400 font-mono">
                {isSignalingOnline ? 'Signaling Rendezvous Active' : 'Connecting to Server...'}
              </span>
            </div>
          </div>
        </div>

        <button
          id="btn-identity-settings"
          onClick={onOpenIdentityModal}
          title="My Cryptographic Identity"
          className="p-2 rounded-lg hover:bg-zinc-800 text-zinc-400 hover:text-zinc-200 transition-colors"
        >
          <Key className="w-4 h-4" />
        </button>
      </div>

      {/* User Identity Card */}
      {identity && (
        <div id="my-identity-card" className="p-3 mx-3 mt-3 rounded-xl bg-zinc-950/80 border border-zinc-800/80">
          <div className="flex items-center justify-between text-xs mb-1.5">
            <span className="text-zinc-400 font-medium flex items-center space-x-1">
              <User className="w-3.5 h-3.5 text-zinc-500" />
              <span>Your Ephemeral UID</span>
            </span>
            <span className="text-[10px] text-emerald-400 font-mono bg-emerald-950/50 border border-emerald-800/50 px-1.5 py-0.5 rounded">
              Ed25519+X25519
            </span>
          </div>

          <div className="flex items-center justify-between bg-zinc-900 border border-zinc-800 rounded-lg p-2 font-mono text-xs text-zinc-300">
            <span className="truncate pr-2 select-all">{identity.uid}</span>
            <button
              id="btn-copy-uid"
              onClick={copyMyUid}
              className="flex items-center space-x-1 text-xs px-2 py-1 bg-zinc-800 hover:bg-zinc-700 text-zinc-200 rounded transition-colors flex-shrink-0"
              title="Copy your UID to share with peer"
            >
              {copied ? (
                <>
                  <Check className="w-3 h-3 text-emerald-400" />
                  <span className="text-[11px] text-emerald-400">Copied</span>
                </>
              ) : (
                <>
                  <Copy className="w-3 h-3" />
                  <span className="text-[11px]">Copy</span>
                </>
              )}
            </button>
          </div>

          <div className="mt-2 flex items-center justify-between text-[11px] text-zinc-500 font-mono">
            <span>Fingerprint:</span>
            <span className="text-zinc-400">{identity.fingerprint.slice(0, 14)}...</span>
          </div>
        </div>
      )}

      {/* Action Buttons */}
      <div className="p-3 space-y-2">
        <button
          id="btn-new-chat"
          onClick={onOpenNewChat}
          className="w-full flex items-center justify-center space-x-2 py-2.5 px-4 bg-emerald-600 hover:bg-emerald-500 active:bg-emerald-700 text-white text-sm font-medium rounded-xl shadow-sm transition-colors"
        >
          <Plus className="w-4 h-4" />
          <span>New Secure Chat</span>
        </button>

        {/* Search */}
        <div className="relative">
          <Search className="w-3.5 h-3.5 text-zinc-500 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            id="input-search-conversations"
            type="text"
            placeholder="Search active peers..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-3 py-1.5 text-xs bg-zinc-950 border border-zinc-800 rounded-lg text-zinc-200 placeholder-zinc-500 focus:outline-none focus:border-zinc-700"
          />
        </div>
      </div>

      {/* Conversations List */}
      <div id="conversations-list" className="flex-1 overflow-y-auto px-3 space-y-1">
        <div className="text-[11px] font-semibold text-zinc-500 uppercase tracking-wider px-2 py-1">
          Encrypted Chats ({filteredConversations.length})
        </div>

        {filteredConversations.length === 0 ? (
          <div className="p-6 text-center text-zinc-500 text-xs">
            <p className="font-medium text-zinc-400">No chats yet</p>
            <p className="mt-1 text-[11px]">
              Click &quot;New Secure Chat&quot; above and enter another user&apos;s UID to initiate end-to-end encryption.
            </p>
          </div>
        ) : (
          filteredConversations.map((conv) => {
            const isActive = conv.id === activeConversationId;
            return (
              <button
                key={conv.id}
                id={`conversation-item-${conv.id}`}
                onClick={() => onSelectConversation(conv.id)}
                className={`w-full text-left p-2.5 rounded-xl transition-all border ${
                  isActive
                    ? 'bg-zinc-800/90 border-zinc-700 text-white'
                    : 'bg-zinc-950/40 border-transparent hover:bg-zinc-800/40 text-zinc-300'
                }`}
              >
                <div className="flex items-center justify-between mb-1">
                  <div className="flex items-center space-x-1.5 min-w-0">
                    <span className="font-mono text-xs font-medium text-zinc-200 truncate">
                      {conv.peerUid.slice(0, 16)}...
                    </span>
                    {conv.verified ? (
                      <span title="Peer Identity Verified" className="flex items-center">
                        <ShieldCheck className="w-3.5 h-3.5 text-emerald-400 flex-shrink-0" />
                      </span>
                    ) : (
                      <span title="Unverified Peer" className="flex items-center">
                        <Shield className="w-3.5 h-3.5 text-zinc-500 flex-shrink-0" />
                      </span>
                    )}
                  </div>

                  <div className="flex items-center space-x-1.5">
                    {conv.p2pConnected ? (
                      <span className="flex items-center space-x-1 text-[10px] text-emerald-400 font-mono">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                        <span>P2P</span>
                      </span>
                    ) : (
                      <span className="text-[10px] text-zinc-500 font-mono">Idle</span>
                    )}

                    {conv.unreadCount > 0 && (
                      <span className="bg-emerald-500 text-white font-bold text-[10px] px-1.5 py-0.2 rounded-full">
                        {conv.unreadCount}
                      </span>
                    )}
                  </div>
                </div>

                <div className="flex items-center justify-between text-[11px] text-zinc-400">
                  <span className="truncate pr-2">
                    {conv.lastMessageSnippet || 'Secure session ready'}
                  </span>
                  {conv.lastMessageTimestamp && (
                    <span className="text-[10px] text-zinc-500 flex-shrink-0">
                      {new Date(conv.lastMessageTimestamp).toLocaleTimeString([], {
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </span>
                  )}
                </div>
              </button>
            );
          })
        )}
      </div>

      {/* Footer / Architecture notice */}
      <div className="p-3 border-t border-zinc-800 bg-zinc-950/60 flex items-center justify-between text-[11px] text-zinc-500">
        <span className="flex items-center space-x-1">
          <Radio className="w-3 h-3 text-emerald-500" />
          <span>WebRTC DataChannel</span>
        </span>
        <button
          id="btn-open-debugger"
          onClick={onOpenDebugPanel}
          className="text-zinc-400 hover:text-zinc-200 underline text-[10px]"
        >
          Debug Inspector
        </button>
      </div>
    </aside>
  );
};
