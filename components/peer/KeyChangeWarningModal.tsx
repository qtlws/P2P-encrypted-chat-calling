'use client';

import React from 'react';
import { AlertTriangle, ShieldAlert, X } from 'lucide-react';
import { KeyChangeEvent } from '@/src/services/chat/ChatManager';

interface KeyChangeWarningModalProps {
  event: KeyChangeEvent | null;
  onDismiss: () => void;
  onAcceptNewKey: (peerUid: string) => void;
}

export const KeyChangeWarningModal: React.FC<KeyChangeWarningModalProps> = ({
  event,
  onDismiss,
  onAcceptNewKey,
}) => {
  if (!event) return null;

  return (
    <div id="modal-key-change-backdrop" className="fixed inset-0 z-50 bg-black/80 backdrop-blur-xs flex items-center justify-center p-4">
      <div
        id="modal-key-change-warning"
        className="w-full max-w-md bg-zinc-900 border-2 border-rose-600 rounded-2xl p-6 shadow-2xl text-zinc-100 relative animate-in fade-in zoom-in-95 duration-150"
      >
        <button
          onClick={onDismiss}
          className="absolute top-4 right-4 p-1.5 rounded-lg text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800 transition-colors"
        >
          <X className="w-4 h-4" />
        </button>

        <div className="flex items-center space-x-3 mb-4 text-rose-400">
          <div className="w-12 h-12 rounded-xl bg-rose-500/10 border border-rose-500/30 flex items-center justify-center text-rose-400">
            <ShieldAlert className="w-7 h-7" />
          </div>
          <div>
            <h3 className="font-bold text-base text-rose-300">SECURITY WARNING</h3>
            <p className="text-xs text-zinc-400">Peer Public Identity Key Has Changed</p>
          </div>
        </div>

        <div className="space-y-3.5 text-xs">
          <p className="text-zinc-300 leading-relaxed">
            The cryptographic identity key received for peer <code className="text-rose-300 font-mono">{event.peerUid}</code> does not match the key previously stored on this device.
          </p>

          <div className="p-3 bg-zinc-950 rounded-xl border border-zinc-800 space-y-2 font-mono text-[11px]">
            <div>
              <span className="text-zinc-500 block text-[10px]">Previous Fingerprint:</span>
              <span className="text-zinc-300 select-all">{event.oldFingerprint}</span>
            </div>
            <div className="border-t border-zinc-900 pt-1.5">
              <span className="text-rose-400 font-semibold block text-[10px]">New Fingerprint:</span>
              <span className="text-rose-300 select-all">{event.newFingerprint}</span>
            </div>
          </div>

          <p className="text-[11px] text-zinc-400 leading-relaxed">
            This could indicate that the contact reinstalled their application or generated new keys, OR that an attacker is attempting a Man-in-the-Middle (MITM) key substitution attack. Do not proceed unless you verify the new fingerprint out-of-band.
          </p>

          <div className="flex space-x-2 pt-2">
            <button
              onClick={onDismiss}
              className="flex-1 py-2.5 bg-zinc-800 hover:bg-zinc-700 text-zinc-200 rounded-xl font-medium text-xs transition-colors"
            >
              Reject & Reject Connection
            </button>
            <button
              onClick={() => onAcceptNewKey(event.peerUid)}
              className="py-2.5 px-4 bg-rose-600 hover:bg-rose-500 text-white rounded-xl font-medium text-xs transition-colors"
            >
              Accept New Key
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
