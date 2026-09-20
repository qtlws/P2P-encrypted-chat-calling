'use client';

import React from 'react';
import { X, Bug, Terminal, Shield, Network } from 'lucide-react';
import { UserIdentity, SecureSession } from '@/src/crypto/types';
import { Conversation } from '@/src/types/chat';

interface DebugPanelProps {
  isOpen: boolean;
  onClose: () => void;
  identity: UserIdentity | null;
  activeConversation: Conversation | null;
  activeSession: SecureSession | null;
  isSignalingConnected: boolean;
  isP2PConnected: boolean;
}

export const DebugPanel: React.FC<DebugPanelProps> = ({
  isOpen,
  onClose,
  identity,
  activeConversation,
  activeSession,
  isSignalingConnected,
  isP2PConnected,
}) => {
  if (!isOpen) return null;

  return (
    <div id="modal-debug-panel-backdrop" className="fixed inset-0 z-50 bg-black/70 backdrop-blur-xs flex items-center justify-center p-4">
      <div
        id="modal-debug-panel"
        className="w-full max-w-lg bg-zinc-900 border border-zinc-800 rounded-2xl p-6 shadow-2xl text-zinc-100 relative max-h-[85vh] overflow-y-auto font-mono text-xs"
      >
        <button
          id="btn-close-debug-modal"
          onClick={onClose}
          className="absolute top-4 right-4 p-1.5 rounded-lg text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800 transition-colors"
        >
          <X className="w-4 h-4" />
        </button>

        <div className="flex items-center space-x-2.5 mb-4 text-emerald-400">
          <Terminal className="w-5 h-5" />
          <h3 className="font-semibold text-sm text-zinc-100">P2P Network & Cryptographic Telemetry</h3>
        </div>

        <div className="space-y-3.5">
          {/* Status block */}
          <div className="p-3 bg-zinc-950 rounded-xl border border-zinc-800 space-y-1.5">
            <div className="text-zinc-400 font-semibold text-[11px] uppercase tracking-wider mb-1 flex items-center space-x-1.5">
              <Network className="w-3.5 h-3.5 text-emerald-400" />
              <span>Transport & Rendezvous</span>
            </div>
            <div className="flex justify-between">
              <span className="text-zinc-500">Signaling Server SSE:</span>
              <span className={isSignalingConnected ? 'text-emerald-400' : 'text-amber-400'}>
                {isSignalingConnected ? 'CONNECTED' : 'DISCONNECTED'}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-zinc-500">WebRTC DataChannel:</span>
              <span className={isP2PConnected ? 'text-emerald-400' : 'text-zinc-400'}>
                {isP2PConnected ? 'DIRECT P2P ACTIVE' : 'PENDING'}
              </span>
            </div>
          </div>

          {/* Active Session info */}
          <div className="p-3 bg-zinc-950 rounded-xl border border-zinc-800 space-y-1.5">
            <div className="text-zinc-400 font-semibold text-[11px] uppercase tracking-wider mb-1 flex items-center space-x-1.5">
              <Shield className="w-3.5 h-3.5 text-emerald-400" />
              <span>Cryptographic Session State</span>
            </div>
            <div className="flex justify-between">
              <span className="text-zinc-500">Protocol Version:</span>
              <span className="text-zinc-300">1</span>
            </div>
            <div className="flex justify-between">
              <span className="text-zinc-500">Cipher Suite:</span>
              <span className="text-zinc-300">X25519-HKDF-AES256GCM</span>
            </div>
            <div className="flex justify-between">
              <span className="text-zinc-500">Shared Secret Derived:</span>
              <span className="text-emerald-400">{activeSession?.sharedSecretDerived ? 'TRUE' : 'FALSE'}</span>
            </div>
            {activeSession && (
              <div className="flex justify-between">
                <span className="text-zinc-500">Session ID:</span>
                <span className="text-zinc-300 truncate max-w-[200px]">{activeSession.sessionId}</span>
              </div>
            )}
          </div>

          {/* Identity Metadata */}
          {identity && (
            <div className="p-3 bg-zinc-950 rounded-xl border border-zinc-800 space-y-1 text-[11px]">
              <div className="text-zinc-400 font-semibold uppercase tracking-wider mb-1">Local Identity Node</div>
              <div className="text-zinc-500">UID: <span className="text-zinc-300">{identity.uid}</span></div>
              <div className="text-zinc-500">Fingerprint: <span className="text-emerald-400">{identity.fingerprint}</span></div>
              <div className="text-zinc-500">Created: <span className="text-zinc-400">{new Date(identity.createdAt).toISOString()}</span></div>
            </div>
          )}

          {/* Security Compliance Seal */}
          <div className="p-3 rounded-xl bg-zinc-950/80 border border-zinc-800 text-[11px] text-zinc-400 leading-relaxed">
            <span className="text-emerald-400 font-semibold">Zero Leak Guarantee:</span> Private signing/encryption keys and plaintext message payloads are never exposed to this inspector or logged to console or network tools.
          </div>
        </div>
      </div>
    </div>
  );
};
