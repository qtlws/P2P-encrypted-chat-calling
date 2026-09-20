'use client';

import React, { useState } from 'react';
import { X, ShieldCheck, ShieldAlert, Shield, Check, Ban, Trash2, Copy } from 'lucide-react';
import { PeerRecord } from '@/src/types/peer';

interface PeerVerificationModalProps {
  isOpen: boolean;
  onClose: () => void;
  peer: PeerRecord | null;
  onToggleVerified: (peerUid: string, verified: boolean) => Promise<void>;
  onToggleBlocked: (peerUid: string, blocked: boolean) => Promise<void>;
}

export const PeerVerificationModal: React.FC<PeerVerificationModalProps> = ({
  isOpen,
  onClose,
  peer,
  onToggleVerified,
  onToggleBlocked,
}) => {
  const [copied, setCopied] = useState(false);

  if (!isOpen || !peer) return null;

  const copyFingerprint = () => {
    navigator.clipboard.writeText(peer.fingerprint);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div id="modal-peer-verification-backdrop" className="fixed inset-0 z-50 bg-black/70 backdrop-blur-xs flex items-center justify-center p-4">
      <div
        id="modal-peer-verification"
        className="w-full max-w-md bg-zinc-900 border border-zinc-800 rounded-2xl p-6 shadow-2xl text-zinc-100 relative animate-in fade-in zoom-in-95 duration-150"
      >
        <button
          id="btn-close-peer-verification-modal"
          onClick={onClose}
          className="absolute top-4 right-4 p-1.5 rounded-lg text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800 transition-colors"
        >
          <X className="w-4 h-4" />
        </button>

        <div className="flex items-center space-x-3 mb-4">
          <div className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400">
            {peer.verified ? <ShieldCheck className="w-5 h-5" /> : <Shield className="w-5 h-5 text-amber-400" />}
          </div>
          <div>
            <h3 className="font-semibold text-base text-zinc-100">Peer Trust & Identity</h3>
            <p className="text-xs text-zinc-400 font-mono truncate max-w-[240px]">{peer.uid}</p>
          </div>
        </div>

        <div className="space-y-4 text-xs">
          {/* Fingerprint Display */}
          <div className="p-3.5 rounded-xl bg-zinc-950 border border-zinc-800">
            <div className="flex items-center justify-between text-zinc-400 font-mono mb-1.5">
              <span>Cryptographic Fingerprint</span>
              <button onClick={copyFingerprint} className="text-zinc-400 hover:text-zinc-200 flex items-center space-x-1">
                {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                <span className="text-[10px]">{copied ? 'Copied' : 'Copy'}</span>
              </button>
            </div>
            <div className="p-2.5 bg-zinc-900 rounded-lg border border-zinc-800/80 font-mono text-xs text-emerald-400 select-all tracking-wider text-center">
              {peer.fingerprint}
            </div>
            <p className="text-[11px] text-zinc-500 mt-2 leading-relaxed">
              Compare this fingerprint with your counterparty through an independent, trusted channel (such as in person or voice call) to guarantee no Man-in-the-Middle is present.
            </p>
          </div>

          {/* Timestamps */}
          <div className="grid grid-cols-2 gap-2 font-mono text-[11px] text-zinc-400">
            <div className="p-2.5 rounded-lg bg-zinc-950 border border-zinc-800">
              <span className="text-zinc-500 block text-[10px]">First Seen:</span>
              <span>{new Date(peer.firstSeenAt).toLocaleDateString()}</span>
            </div>
            <div className="p-2.5 rounded-lg bg-zinc-950 border border-zinc-800">
              <span className="text-zinc-500 block text-[10px]">Last Session:</span>
              <span>{new Date(peer.lastSeenAt).toLocaleTimeString()}</span>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="space-y-2 pt-2">
            <button
              id="btn-toggle-verify-peer"
              onClick={async () => {
                await onToggleVerified(peer.uid, !peer.verified);
              }}
              className={`w-full py-2.5 px-4 rounded-xl font-medium text-xs flex items-center justify-center space-x-2 transition-colors ${
                peer.verified
                  ? 'bg-zinc-800 hover:bg-zinc-700 text-zinc-300'
                  : 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-sm'
              }`}
            >
              <ShieldCheck className="w-4 h-4" />
              <span>{peer.verified ? 'Mark as Unverified' : 'Mark Identity as Verified'}</span>
            </button>

            <button
              id="btn-toggle-block-peer"
              onClick={async () => {
                await onToggleBlocked(peer.uid, !peer.blocked);
              }}
              className={`w-full py-2 px-4 rounded-xl font-medium text-xs flex items-center justify-center space-x-2 transition-colors border ${
                peer.blocked
                  ? 'bg-amber-950/40 border-amber-800 text-amber-300'
                  : 'bg-zinc-950 border-zinc-800 hover:bg-zinc-800 text-zinc-400 hover:text-zinc-200'
              }`}
            >
              <Ban className="w-3.5 h-3.5" />
              <span>{peer.blocked ? 'Unblock Peer' : 'Block Peer (Reject Connections)'}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
