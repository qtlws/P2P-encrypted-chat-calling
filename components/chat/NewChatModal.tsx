'use client';

import React, { useState } from 'react';
import { X, Search, Shield, ArrowRight, Loader2, CheckCircle2, AlertCircle, Copy, Info } from 'lucide-react';
import { ConnectionState } from '@/src/types/peer';

interface NewChatModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConnect: (peerUid: string) => Promise<void>;
  myUid: string;
}

export const NewChatModal: React.FC<NewChatModalProps> = ({
  isOpen,
  onClose,
  onConnect,
  myUid,
}) => {
  const [peerUid, setPeerUid] = useState('');
  const [status, setStatus] = useState<'idle' | 'connecting' | 'success' | 'error'>('idle');
  const [stepMessage, setStepMessage] = useState('');
  const [errorMessage, setErrorMessage] = useState('');

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanUid = peerUid.trim();

    if (!cleanUid) return;
    if (cleanUid === myUid) {
      setStatus('error');
      setErrorMessage('You cannot establish a secure session with your own UID.');
      return;
    }
    if (!cleanUid.startsWith('u_')) {
      setStatus('error');
      setErrorMessage('Invalid UID format. Peer UIDs start with "u_" prefix.');
      return;
    }

    setStatus('connecting');
    setErrorMessage('');
    setStepMessage('Contacting signaling rendezvous for peer presence...');

    try {
      setTimeout(() => {
        setStepMessage('Exchanging signed Ed25519 & X25519 handshake envelopes...');
      }, 500);

      await onConnect(cleanUid);

      setStatus('success');
      setStepMessage('Cryptographic handshake verified! Opening direct chat...');
      setTimeout(() => {
        onClose();
        setStatus('idle');
        setPeerUid('');
      }, 900);
    } catch (err: unknown) {
      setStatus('error');
      const msg = err instanceof Error ? err.message : 'Failed to establish peer session';
      setErrorMessage(msg);
    }
  };

  return (
    <div id="modal-new-chat-backdrop" className="fixed inset-0 z-50 bg-black/70 backdrop-blur-xs flex items-center justify-center p-4">
      <div
        id="modal-new-chat"
        className="w-full max-w-md bg-zinc-900 border border-zinc-800 rounded-2xl p-6 shadow-2xl text-zinc-100 relative animate-in fade-in zoom-in-95 duration-150"
      >
        <button
          id="btn-close-new-chat-modal"
          onClick={onClose}
          className="absolute top-4 right-4 p-1.5 rounded-lg text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800 transition-colors"
        >
          <X className="w-4 h-4" />
        </button>

        <div className="flex items-center space-x-3 mb-4">
          <div className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400">
            <Shield className="w-5 h-5" />
          </div>
          <div>
            <h3 className="font-semibold text-base text-zinc-100">Start Secure P2P Chat</h3>
            <p className="text-xs text-zinc-400">Enter a peer&apos;s cryptographic UID to initiate handshake</p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-mono text-zinc-300 mb-1.5">Peer UID</label>
            <div className="relative">
              <input
                id="input-peer-uid"
                type="text"
                placeholder="u_7f3c9d2a8e1b..."
                value={peerUid}
                onChange={(e) => {
                  setPeerUid(e.target.value);
                  if (status === 'error') setStatus('idle');
                }}
                disabled={status === 'connecting' || status === 'success'}
                className="w-full pl-3.5 pr-10 py-2.5 bg-zinc-950 border border-zinc-800 rounded-xl font-mono text-xs text-zinc-100 placeholder-zinc-600 focus:outline-none focus:border-emerald-500"
                autoFocus
              />
              <Search className="w-4 h-4 text-zinc-500 absolute right-3 top-1/2 -translate-y-1/2" />
            </div>
          </div>

          {/* Status Indicator */}
          {status === 'connecting' && (
            <div className="p-3 rounded-xl bg-zinc-950 border border-zinc-800/80 flex items-center space-x-2.5 text-xs text-zinc-300">
              <Loader2 className="w-4 h-4 text-emerald-400 animate-spin flex-shrink-0" />
              <span className="font-mono">{stepMessage}</span>
            </div>
          )}

          {status === 'success' && (
            <div className="p-3 rounded-xl bg-emerald-950/40 border border-emerald-800/40 flex items-center space-x-2.5 text-xs text-emerald-300">
              <CheckCircle2 className="w-4 h-4 text-emerald-400 flex-shrink-0" />
              <span className="font-mono">{stepMessage}</span>
            </div>
          )}

          {status === 'error' && (
            <div className="p-3 rounded-xl bg-rose-950/40 border border-rose-900/40 flex items-start space-x-2.5 text-xs text-rose-300">
              <AlertCircle className="w-4 h-4 text-rose-400 flex-shrink-0 mt-0.5" />
              <div>
                <span className="font-medium">Handshake Failed:</span>
                <p className="mt-0.5 text-rose-200">{errorMessage}</p>
              </div>
            </div>
          )}

          {/* Helpful Multi-tab Testing tip */}
          <div className="p-3 rounded-xl bg-zinc-950/60 border border-zinc-800 text-[11px] text-zinc-400 flex items-start space-x-2">
            <Info className="w-3.5 h-3.5 text-zinc-500 flex-shrink-0 mt-0.5" />
            <div>
              <span className="text-zinc-300 font-medium">Testing with two browser tabs:</span>
              <p className="mt-0.5 text-zinc-400 leading-relaxed">
                Open this app in an incognito or secondary window to get a second independent UID, copy it, and paste it here to test full E2EE chat and calling.
              </p>
            </div>
          </div>

          <div className="flex items-center justify-end space-x-2 pt-2">
            <button
              id="btn-cancel-new-chat"
              type="button"
              onClick={onClose}
              disabled={status === 'connecting'}
              className="px-4 py-2 text-xs font-medium text-zinc-400 hover:text-zinc-200 transition-colors"
            >
              Cancel
            </button>

            <button
              id="btn-connect-peer"
              type="submit"
              disabled={!peerUid.trim() || status === 'connecting' || status === 'success'}
              className="px-4 py-2.5 bg-emerald-600 hover:bg-emerald-500 active:bg-emerald-700 disabled:opacity-40 text-white rounded-xl text-xs font-semibold flex items-center space-x-1.5 transition-colors shadow-sm"
            >
              <span>Connect P2P</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
