'use client';

import React from 'react';
import { X, Lock, ShieldCheck, Cpu, HardDrive, Network, AlertTriangle } from 'lucide-react';
import { Conversation } from '@/src/types/chat';
import { UserIdentity } from '@/src/crypto/types';

interface SecurityIndicatorModalProps {
  isOpen: boolean;
  onClose: () => void;
  conversation: Conversation | null;
  identity: UserIdentity | null;
  isP2PConnected: boolean;
}

export const SecurityIndicatorModal: React.FC<SecurityIndicatorModalProps> = ({
  isOpen,
  onClose,
  conversation,
  identity,
  isP2PConnected,
}) => {
  if (!isOpen || !conversation || !identity) return null;

  return (
    <div id="modal-security-indicator-backdrop" className="fixed inset-0 z-50 bg-black/70 backdrop-blur-xs flex items-center justify-center p-4">
      <div
        id="modal-security-indicator"
        className="w-full max-w-lg bg-zinc-900 border border-zinc-800 rounded-2xl p-6 shadow-2xl text-zinc-100 relative animate-in fade-in zoom-in-95 duration-150 max-h-[90vh] overflow-y-auto"
      >
        <button
          id="btn-close-security-modal"
          onClick={onClose}
          className="absolute top-4 right-4 p-1.5 rounded-lg text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800 transition-colors"
        >
          <X className="w-4 h-4" />
        </button>

        <div className="flex items-center space-x-3 mb-5">
          <div className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400">
            <Lock className="w-5 h-5" />
          </div>
          <div>
            <h3 className="font-semibold text-base text-zinc-100">Cryptographic Security Specification</h3>
            <p className="text-xs text-zinc-400">Verified zero-knowledge session properties</p>
          </div>
        </div>

        <div className="space-y-3.5 text-xs">
          {/* Transport & Connection */}
          <div className="p-3.5 rounded-xl bg-zinc-950 border border-zinc-800">
            <div className="flex items-center justify-between font-mono mb-2">
              <span className="text-zinc-400 flex items-center space-x-1.5">
                <Network className="w-3.5 h-3.5 text-emerald-400" />
                <span>Transport Layer</span>
              </span>
              <span className="text-emerald-400 font-semibold">
                {isP2PConnected ? 'Direct WebRTC DataChannel' : 'Connecting DataChannel'}
              </span>
            </div>
            <p className="text-[11px] text-zinc-400 leading-relaxed">
              Once connected, text and media flow directly user-to-user. The server acts exclusively as an ephemeral discovery relay and does not store or process messages.
            </p>
          </div>

          {/* Cryptographic Suite */}
          <div className="p-3.5 rounded-xl bg-zinc-950 border border-zinc-800">
            <div className="flex items-center justify-between font-mono mb-2">
              <span className="text-zinc-400 flex items-center space-x-1.5">
                <Cpu className="w-3.5 h-3.5 text-emerald-400" />
                <span>Cipher Suite</span>
              </span>
              <span className="text-zinc-200 font-semibold">X25519-HKDF-AES256GCM</span>
            </div>
            <div className="space-y-1.5 text-[11px] font-mono text-zinc-400">
              <div className="flex justify-between">
                <span>Key Agreement:</span>
                <span className="text-zinc-200">X25519 ECDH Curve25519</span>
              </div>
              <div className="flex justify-between">
                <span>Digital Signatures:</span>
                <span className="text-zinc-200">Ed25519 Edwards-curve</span>
              </div>
              <div className="flex justify-between">
                <span>Symmetric AEAD:</span>
                <span className="text-zinc-200">AES-256-GCM (Unique 12-byte IV)</span>
              </div>
              <div className="flex justify-between">
                <span>Key Derivation:</span>
                <span className="text-zinc-200">HKDF-SHA256 (RFC 5869)</span>
              </div>
            </div>
          </div>

          {/* Fingerprints */}
          <div className="p-3.5 rounded-xl bg-zinc-950 border border-zinc-800 space-y-2">
            <div className="flex items-center space-x-1.5 font-mono text-zinc-400">
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
              <span>Identity Fingerprints</span>
            </div>

            <div>
              <span className="text-[10px] text-zinc-500 font-mono">Your Identity Fingerprint:</span>
              <div className="p-2 bg-zinc-900 rounded border border-zinc-800/80 font-mono text-[11px] text-emerald-400 select-all">
                {identity.fingerprint}
              </div>
            </div>

            <div>
              <span className="text-[10px] text-zinc-500 font-mono">Peer Identity Fingerprint:</span>
              <div className="p-2 bg-zinc-900 rounded border border-zinc-800/80 font-mono text-[11px] text-zinc-200 select-all">
                {conversation.peerIdentityFingerprint}
              </div>
            </div>
          </div>

          {/* Local Persistence */}
          <div className="p-3.5 rounded-xl bg-zinc-950 border border-zinc-800">
            <div className="flex items-center justify-between font-mono mb-1.5">
              <span className="text-zinc-400 flex items-center space-x-1.5">
                <HardDrive className="w-3.5 h-3.5 text-emerald-400" />
                <span>Client Storage Security</span>
              </span>
              <span className="text-emerald-400 font-semibold">Dual Envelope AEAD</span>
            </div>
            <p className="text-[11px] text-zinc-400 leading-relaxed">
              All stored records in <code className="text-zinc-300">secureDataStorage.ts</code> are encrypted using AES-256-GCM. Plaintext exists solely in runtime memory.
            </p>
          </div>

          {/* Honest Threat Model Notice */}
          <div className="p-3 rounded-xl bg-amber-950/30 border border-amber-900/40 text-[11px] text-amber-200/90 leading-relaxed flex items-start space-x-2">
            <AlertTriangle className="w-4 h-4 text-amber-400 flex-shrink-0 mt-0.5" />
            <div>
              <span className="font-semibold text-amber-300">Security & Privacy Boundaries:</span>
              <p className="mt-0.5 text-zinc-400">
                P2P communication protects message contents, but communicating directly exposes your IP address to your peer and STUN servers. Local storage encryption protects against casual device dumps, but cannot protect against arbitrary in-origin XSS.
              </p>
            </div>
          </div>
        </div>

        <div className="mt-5 flex justify-end">
          <button
            id="btn-dismiss-security-modal"
            onClick={onClose}
            className="px-4 py-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-200 rounded-xl text-xs font-medium transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
