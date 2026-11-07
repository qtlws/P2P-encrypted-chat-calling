'use client';

import React from 'react';
import {
  ShieldCheck,
  Key,
  Lock,
  Radio,
  Trash2,
  Sparkles,
  ArrowRight,
  Upload,
} from 'lucide-react';

interface WelcomeOnboardingModalProps {
  isOpen: boolean;
  onGenerateIdentity: () => void;
  onOpenRestore: () => void;
  isGenerating?: boolean;
}

export const WelcomeOnboardingModal: React.FC<WelcomeOnboardingModalProps> = ({
  isOpen,
  onGenerateIdentity,
  onOpenRestore,
  isGenerating = false,
}) => {
  if (!isOpen) return null;

  return (
    <div
      id="modal-welcome-onboarding-backdrop"
      className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-center justify-center p-4 select-none animate-in fade-in duration-200"
    >
      <div
        id="modal-welcome-onboarding"
        className="w-full max-w-xl bg-zinc-900 border border-zinc-800 rounded-3xl p-6 sm:p-8 shadow-2xl text-zinc-100 relative animate-in zoom-in-95 duration-200 max-h-[92vh] overflow-y-auto"
      >
        {/* Glow header badge */}
        <div className="flex items-center space-x-3 mb-6">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-emerald-500/20 to-teal-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400 shadow-[0_0_20px_rgba(16,185,129,0.2)]">
            <ShieldCheck className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center space-x-2">
              <span className="px-2 py-0.5 rounded-full bg-emerald-950/80 border border-emerald-800/80 text-[10px] font-mono font-medium text-emerald-300 uppercase tracking-wider">
                Zero-Knowledge P2P
              </span>
              <span className="text-zinc-500 text-xs">&bull;</span>
              <span className="text-[11px] font-mono text-zinc-400">100% Client-Side Sovereign</span>
            </div>
            <h2 className="text-xl sm:text-2xl font-bold text-zinc-100 tracking-tight mt-0.5">
              Welcome to Sovereign Chat
            </h2>
          </div>
        </div>

        {/* Project Mission & Architecture */}
        <p className="text-xs sm:text-sm text-zinc-300 leading-relaxed mb-6 font-sans">
          This is a pure <strong>zero-knowledge, peer-to-peer communication system</strong> engineered without accounts, centralized databases, or server message storage. All identities, encryption keys, and authentications reside solely in your browser memory.
        </p>

        {/* Feature Cards Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-6">
          {/* Pillar 1 */}
          <div className="p-3.5 rounded-2xl bg-zinc-950/70 border border-zinc-800/80 space-y-1.5">
            <div className="flex items-center space-x-2 text-emerald-400 text-xs font-semibold">
              <Key className="w-4 h-4" />
              <span>Cryptographic Keys</span>
            </div>
            <p className="text-[11px] text-zinc-400 leading-normal font-sans">
              Ed25519 digital signatures & X25519 ECDH key exchanges are computed on your device. Private keys never touch any server.
            </p>
          </div>

          {/* Pillar 2 */}
          <div className="p-3.5 rounded-2xl bg-zinc-950/70 border border-zinc-800/80 space-y-1.5">
            <div className="flex items-center space-x-2 text-cyan-400 text-xs font-semibold">
              <Radio className="w-4 h-4" />
              <span>Direct WebRTC Mesh</span>
            </div>
            <p className="text-[11px] text-zinc-400 leading-normal font-sans">
              Encrypted messages, audio, and video stream directly peer-to-peer. The signaling relay only brokers initial anonymous handshakes.
            </p>
          </div>

          {/* Pillar 3 */}
          <div className="p-3.5 rounded-2xl bg-zinc-950/70 border border-zinc-800/80 space-y-1.5">
            <div className="flex items-center space-x-2 text-teal-400 text-xs font-semibold">
              <Lock className="w-4 h-4" />
              <span>Authenticated AEAD</span>
            </div>
            <p className="text-[11px] text-zinc-400 leading-normal font-sans">
              AES-256-GCM authenticated ciphertexts with tamper-evident metadata. No third party or ISP can read your communications.
            </p>
          </div>

          {/* Pillar 4 */}
          <div className="p-3.5 rounded-2xl bg-zinc-950/70 border border-zinc-800/80 space-y-1.5">
            <div className="flex items-center space-x-2 text-rose-400 text-xs font-semibold">
              <Trash2 className="w-4 h-4" />
              <span>Total Sovereignty</span>
            </div>
            <p className="text-[11px] text-zinc-400 leading-normal font-sans">
              Initiator dual-end chat burn, password-encrypted JSON vault exports, and one-click instant identity reset in the Danger Zone.
            </p>
          </div>
        </div>

        {/* Primary Call-to-Action to generate identity */}
        <div className="space-y-3 pt-2">
          <button
            id="btn-generate-identity"
            type="button"
            onClick={onGenerateIdentity}
            disabled={isGenerating}
            className="w-full py-3.5 px-4 rounded-2xl bg-gradient-to-r from-emerald-600 via-emerald-500 to-teal-600 hover:from-emerald-500 hover:to-teal-500 active:scale-[0.99] transition-all text-white font-semibold text-sm shadow-[0_0_20px_rgba(16,185,129,0.3)] flex items-center justify-center space-x-2 cursor-pointer disabled:opacity-50"
          >
            {isGenerating ? (
              <>
                <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                <span>Deriving Ed25519 & X25519 Keypairs...</span>
              </>
            ) : (
              <>
                <Sparkles className="w-4 h-4" />
                <span>Generate Cryptographic Identity & Enter</span>
                <ArrowRight className="w-4 h-4 ml-1" />
              </>
            )}
          </button>

          {/* Secondary CTA: Restore backup if returning user */}
          <button
            id="btn-onboarding-restore"
            type="button"
            onClick={onOpenRestore}
            className="w-full py-2.5 px-4 rounded-xl bg-zinc-950 hover:bg-zinc-800 border border-zinc-800 text-zinc-300 hover:text-white text-xs font-medium transition-colors flex items-center justify-center space-x-2"
          >
            <Upload className="w-3.5 h-3.5 text-emerald-400" />
            <span>Already have a backup? Restore Identity from JSON</span>
          </button>
        </div>
      </div>
    </div>
  );
};
