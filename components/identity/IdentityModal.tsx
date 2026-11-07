'use client';

import React, { useState } from 'react';
import {
  X,
  Key,
  ShieldAlert,
  Download,
  Upload,
  Copy,
  Check,
  RotateCcw,
  Eye,
  EyeOff,
  AlertTriangle,
} from 'lucide-react';
import { UserIdentity } from '@/src/crypto/types';
import { exportEncryptedBackup, importEncryptedBackup } from '@/src/crypto/encryption';
import { chatManager } from '@/src/services/chat/ChatManager';
import { Conversation, PeerRecord, StoredMessage } from '@/src/types/chat';

interface IdentityModalProps {
  isOpen: boolean;
  onClose: () => void;
  identity: UserIdentity | null;
  onRestoreIdentity: (newIdentity: UserIdentity) => Promise<void>;
  onResetIdentity: () => Promise<void>;
}

export const IdentityModal: React.FC<IdentityModalProps> = ({
  isOpen,
  onClose,
  identity,
  onRestoreIdentity,
  onResetIdentity,
}) => {
  const [copiedField, setCopiedField] = useState<string | null>(null);
  const [exportPassword, setExportPassword] = useState('');
  const [importPassword, setImportPassword] = useState('');
  const [showExportPassphrase, setShowExportPassphrase] = useState(false);
  const [showImportPassphrase, setShowImportPassphrase] = useState(false);
  const [importJson, setImportJson] = useState('');
  const [includeChats, setIncludeChats] = useState(true);
  const [includePeers, setIncludePeers] = useState(true);
  const [activeTab, setActiveTab] = useState<'overview' | 'backup' | 'danger'>('overview');
  const [statusMessage, setStatusMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [showDangerConfirm, setShowDangerConfirm] = useState(false);

  if (!isOpen || !identity) return null;

  const copyToClipboard = (text: string, field: string) => {
    navigator.clipboard.writeText(text);
    setCopiedField(field);
    setTimeout(() => setCopiedField(null), 2000);
  };

  const handleExport = async (e?: React.SyntheticEvent) => {
    if (e) e.preventDefault();
    if (!exportPassword) return;

    try {
      const backupBundle = {
        version: 2,
        format: 'p2p-full-backup-v2',
        createdAt: Date.now(),
        identity: {
          uid: identity.uid,
          fingerprint: identity.fingerprint,
          identityPublicKey: identity.identityPublicKey,
          identityPrivateKey: identity.identityPrivateKey,
          encryptionPublicKey: identity.encryptionPublicKey,
          encryptionPrivateKey: identity.encryptionPrivateKey,
          createdAt: identity.createdAt,
        },
        conversations: includeChats ? chatManager.getConversations() : [],
        messages: includeChats ? chatManager.getAllMessages() : {},
        peers: includePeers ? chatManager.getAllPeerRecords() : [],
      };

      const backupStr = await exportEncryptedBackup(backupBundle, exportPassword);
      const blob = new Blob([backupStr], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `p2p-full-backup-${identity.uid.slice(0, 10)}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      setStatusMessage({ type: 'success', text: 'Encrypted backup package downloaded successfully!' });
      setExportPassword('');
    } catch (err: unknown) {
      setStatusMessage({
        type: 'error',
        text: err instanceof Error ? err.message : 'Failed to export backup',
      });
    }
  };

  const handleImport = async (e?: React.SyntheticEvent) => {
    if (e) e.preventDefault();
    if (!importPassword || !importJson.trim()) return;

    try {
      const restored = await importEncryptedBackup<any>(importJson.trim(), importPassword);
      let targetIdentity: UserIdentity | null = null;
      if (restored?.identity?.uid) {
        targetIdentity = restored.identity;
      } else if (restored?.uid && restored?.identityPrivateKey) {
        targetIdentity = restored;
      }

      if (!targetIdentity || !targetIdentity.uid || !targetIdentity.identityPrivateKey || !targetIdentity.encryptionPrivateKey) {
        throw new Error('Invalid restored identity key structure');
      }

      await onRestoreIdentity(targetIdentity);

      if (restored.conversations || restored.messages || restored.peers) {
        await chatManager.restoreFullBackupData(
          restored.conversations,
          restored.messages,
          restored.peers
        );
      }

      setStatusMessage({ type: 'success', text: 'Identity, chats & contacts successfully restored!' });
      setTimeout(() => onClose(), 1200);
    } catch (err: unknown) {
      setStatusMessage({
        type: 'error',
        text: err instanceof Error ? err.message : 'Invalid password or corrupted backup',
      });
    }
  };

  return (
    <div id="modal-identity-backdrop" className="fixed inset-0 z-50 bg-black/75 backdrop-blur-xs flex items-center justify-center p-4">
      <div
        id="modal-identity"
        className="w-full max-w-lg bg-zinc-900 border border-zinc-800 rounded-2xl p-6 shadow-2xl text-zinc-100 relative animate-in fade-in zoom-in-95 duration-150 max-h-[90vh] overflow-y-auto"
      >
        <button
          id="btn-close-identity-modal"
          onClick={onClose}
          className="absolute top-4 right-4 p-1.5 rounded-lg text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800 transition-colors"
        >
          <X className="w-4 h-4" />
        </button>

        <div className="flex items-center space-x-3 mb-4">
          <div className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400">
            <Key className="w-5 h-5" />
          </div>
          <div>
            <h3 className="font-semibold text-base text-zinc-100">Cryptographic Identity</h3>
            <p className="text-xs text-zinc-400">Client-side keys, verification fingerprints & backup</p>
          </div>
        </div>

        {/* Navigation Tabs */}
        <div className="flex border-b border-zinc-800 mb-4 text-xs font-medium">
          <button
            id="tab-identity-overview"
            onClick={() => setActiveTab('overview')}
            className={`pb-2.5 px-3 border-b-2 transition-colors ${
              activeTab === 'overview'
                ? 'border-emerald-500 text-emerald-400 font-semibold'
                : 'border-transparent text-zinc-400 hover:text-zinc-200'
            }`}
          >
            Keys & Fingerprint
          </button>
          <button
            id="tab-identity-backup"
            onClick={() => setActiveTab('backup')}
            className={`pb-2.5 px-3 border-b-2 transition-colors ${
              activeTab === 'backup'
                ? 'border-emerald-500 text-emerald-400 font-semibold'
                : 'border-transparent text-zinc-400 hover:text-zinc-200'
            }`}
          >
            Backup & Recovery
          </button>
          <button
            id="tab-identity-danger"
            onClick={() => setActiveTab('danger')}
            className={`pb-2.5 px-3 border-b-2 transition-colors ${
              activeTab === 'danger'
                ? 'border-rose-500 text-rose-400 font-semibold'
                : 'border-transparent text-zinc-400 hover:text-zinc-200'
            }`}
          >
            Danger Zone
          </button>
        </div>

        {statusMessage && (
          <div
            className={`p-3 rounded-xl mb-4 text-xs flex items-center space-x-2 ${
              statusMessage.type === 'success'
                ? 'bg-emerald-950/50 border border-emerald-800 text-emerald-300'
                : 'bg-rose-950/50 border border-rose-800 text-rose-300'
            }`}
          >
            {statusMessage.type === 'success' ? <Check className="w-4 h-4" /> : <AlertTriangle className="w-4 h-4" />}
            <span>{statusMessage.text}</span>
          </div>
        )}

        {/* Tab 1: Overview */}
        {activeTab === 'overview' && (
          <div className="space-y-3.5 text-xs">
            <div>
              <label className="block text-zinc-400 font-mono mb-1">Your UID (Lookup Identifier)</label>
              <div className="flex items-center space-x-2 bg-zinc-950 p-2.5 rounded-xl border border-zinc-800 font-mono text-zinc-200">
                <span className="truncate flex-1 select-all">{identity.uid}</span>
                <button
                  onClick={() => copyToClipboard(identity.uid, 'uid')}
                  className="p-1.5 hover:bg-zinc-800 rounded text-zinc-400 hover:text-zinc-100"
                >
                  {copiedField === 'uid' ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                </button>
              </div>
            </div>

            <div>
              <label className="block text-zinc-400 font-mono mb-1">Identity Fingerprint (SHA-256)</label>
              <div className="flex items-center space-x-2 bg-zinc-950 p-2.5 rounded-xl border border-zinc-800 font-mono text-emerald-400">
                <span className="truncate flex-1 select-all">{identity.fingerprint}</span>
                <button
                  onClick={() => copyToClipboard(identity.fingerprint, 'fp')}
                  className="p-1.5 hover:bg-zinc-800 rounded text-zinc-400 hover:text-zinc-100"
                >
                  {copiedField === 'fp' ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                </button>
              </div>
            </div>

            <div>
              <label className="block text-zinc-400 font-mono mb-1">Identity Public Key (Ed25519)</label>
              <div className="flex items-center space-x-2 bg-zinc-950 p-2.5 rounded-xl border border-zinc-800 font-mono text-zinc-300">
                <span className="truncate flex-1 text-[11px] select-all">{identity.identityPublicKey}</span>
                <button
                  onClick={() => copyToClipboard(identity.identityPublicKey, 'idpub')}
                  className="p-1.5 hover:bg-zinc-800 rounded text-zinc-400 hover:text-zinc-100"
                >
                  {copiedField === 'idpub' ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                </button>
              </div>
            </div>

            <div>
              <label className="block text-zinc-400 font-mono mb-1">Encryption Public Key (X25519)</label>
              <div className="flex items-center space-x-2 bg-zinc-950 p-2.5 rounded-xl border border-zinc-800 font-mono text-zinc-300">
                <span className="truncate flex-1 text-[11px] select-all">{identity.encryptionPublicKey}</span>
                <button
                  onClick={() => copyToClipboard(identity.encryptionPublicKey, 'encpub')}
                  className="p-1.5 hover:bg-zinc-800 rounded text-zinc-400 hover:text-zinc-100"
                >
                  {copiedField === 'encpub' ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                </button>
              </div>
            </div>

            <div className="p-3 rounded-xl bg-zinc-950/60 border border-zinc-800 text-[11px] text-zinc-400 leading-relaxed">
              <span className="font-semibold text-zinc-300">Privacy Notice:</span> Private signing and encryption keys never leave this browser tab. They are encrypted in local storage with AES-256-GCM.
            </div>
          </div>
        )}

        {/* Tab 2: Backup */}
        {activeTab === 'backup' && (
          <div className="space-y-5 text-xs">
            {/* Export (Non-form container to prevent browser password managers from prompting to save) */}
            <div className="p-4 rounded-xl bg-zinc-950 border border-zinc-800 space-y-3">
              <div className="flex items-center space-x-2 text-zinc-200 font-medium">
                <Download className="w-4 h-4 text-emerald-400" />
                <span>Export Encrypted Identity & Chat Backup</span>
              </div>
              <p className="text-[11px] text-zinc-400">
                Encrypt your keys, chat history, and contacts into a protected .json backup file using PBKDF2 + AES-256-GCM.
              </p>

              {/* Scope Selection Checkboxes */}
              <div className="space-y-2 py-1">
                <label className="text-[10px] font-semibold text-zinc-400 uppercase tracking-wider block font-mono">
                  Select Backup Contents
                </label>

                <div className="flex items-start space-x-2.5 p-2.5 rounded-lg bg-zinc-900/90 border border-zinc-800">
                  <input
                    type="checkbox"
                    checked={true}
                    disabled={true}
                    className="mt-0.5 rounded text-emerald-500 bg-zinc-800 border-zinc-700"
                  />
                  <div>
                    <span className="font-medium text-zinc-200">Cryptographic Identity Keys & Fingerprints</span>
                    <span className="ml-1.5 text-[10px] text-emerald-400 font-mono">(Required)</span>
                    <p className="text-[10px] text-zinc-400 mt-0.5 font-mono">
                      UID, SHA-256 Fingerprint, Ed25519 & X25519 public/private keys (required to decrypt messages).
                    </p>
                  </div>
                </div>

                <label className="flex items-start space-x-2.5 p-2.5 rounded-lg bg-zinc-900 border border-zinc-800 hover:border-zinc-700 cursor-pointer select-none transition-colors">
                  <input
                    id="checkbox-backup-chats"
                    type="checkbox"
                    checked={includeChats}
                    onChange={(e) => setIncludeChats(e.target.checked)}
                    className="mt-0.5 rounded text-emerald-500 bg-zinc-800 border-zinc-700 focus:ring-0"
                  />
                  <div>
                    <span className="font-medium text-zinc-200">Include Encrypted Chat Conversations & Messages</span>
                    <p className="text-[10px] text-zinc-400 mt-0.5">
                      Packages all conversation threads and local AES-256-GCM encrypted message logs.
                    </p>
                  </div>
                </label>

                <label className="flex items-start space-x-2.5 p-2.5 rounded-lg bg-zinc-900 border border-zinc-800 hover:border-zinc-700 cursor-pointer select-none transition-colors">
                  <input
                    id="checkbox-backup-peers"
                    type="checkbox"
                    checked={includePeers}
                    onChange={(e) => setIncludePeers(e.target.checked)}
                    className="mt-0.5 rounded text-emerald-500 bg-zinc-800 border-zinc-700 focus:ring-0"
                  />
                  <div>
                    <span className="font-medium text-zinc-200">Include Users & Peer Contacts List</span>
                    <p className="text-[10px] text-zinc-400 mt-0.5">
                      Saves known peers, verification statuses, and authentic public keys in the export.
                    </p>
                  </div>
                </label>
              </div>

              {/* Passphrase Input with toggle and anti-autofill */}
              <div className="relative">
                <input
                  id="input-export-password"
                  type={showExportPassphrase ? 'text' : 'password'}
                  name="vault_enc_encryption_passphrase"
                  autoComplete="new-password"
                  autoCorrect="off"
                  autoCapitalize="off"
                  spellCheck={false}
                  data-lpignore="true"
                  data-1p-ignore="true"
                  data-form-type="other"
                  aria-autocomplete="none"
                  placeholder="Choose a strong backup passphrase..."
                  value={exportPassword}
                  onChange={(e) => setExportPassword(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      handleExport();
                    }
                  }}
                  className="w-full pr-10 px-3 py-2 bg-zinc-900 border border-zinc-800 rounded-lg text-zinc-100 placeholder-zinc-600 focus:outline-none focus:border-emerald-500 text-xs font-mono"
                />
                <button
                  type="button"
                  onClick={() => setShowExportPassphrase(!showExportPassphrase)}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-zinc-300 transition-colors p-1"
                  title={showExportPassphrase ? 'Hide passphrase' : 'Show passphrase'}
                >
                  {showExportPassphrase ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                </button>
              </div>

              <button
                id="btn-download-backup"
                type="button"
                onClick={() => handleExport()}
                disabled={!exportPassword}
                className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 active:bg-emerald-700 disabled:opacity-40 text-white rounded-lg font-medium transition-colors"
              >
                Download Encrypted Backup
              </button>
            </div>

            {/* Import (Non-form container to prevent browser password managers from prompting to save) */}
            <div className="p-4 rounded-xl bg-zinc-950 border border-zinc-800 space-y-3">
              <div className="flex items-center space-x-2 text-zinc-200 font-medium">
                <Upload className="w-4 h-4 text-emerald-400" />
                <span>Restore Identity, Chats & Contacts From Backup</span>
              </div>
              <textarea
                id="input-import-json"
                name="vault_restore_payload"
                autoComplete="off"
                spellCheck={false}
                data-lpignore="true"
                data-1p-ignore="true"
                data-form-type="other"
                placeholder="Paste backup JSON file content here..."
                value={importJson}
                onChange={(e) => setImportJson(e.target.value)}
                rows={3}
                className="w-full px-3 py-2 bg-zinc-900 border border-zinc-800 rounded-lg text-zinc-100 placeholder-zinc-600 focus:outline-none focus:border-emerald-500 text-xs font-mono"
              />

              {/* Import Passphrase with toggle and anti-autofill */}
              <div className="relative">
                <input
                  id="input-import-password"
                  type={showImportPassphrase ? 'text' : 'password'}
                  name="vault_restore_decryption_passphrase"
                  autoComplete="new-password"
                  autoCorrect="off"
                  autoCapitalize="off"
                  spellCheck={false}
                  data-lpignore="true"
                  data-1p-ignore="true"
                  data-form-type="other"
                  aria-autocomplete="none"
                  placeholder="Enter the backup passphrase..."
                  value={importPassword}
                  onChange={(e) => setImportPassword(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      handleImport();
                    }
                  }}
                  className="w-full pr-10 px-3 py-2 bg-zinc-900 border border-zinc-800 rounded-lg text-zinc-100 placeholder-zinc-600 focus:outline-none focus:border-emerald-500 text-xs font-mono"
                />
                <button
                  type="button"
                  onClick={() => setShowImportPassphrase(!showImportPassphrase)}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-zinc-300 transition-colors p-1"
                  title={showImportPassphrase ? 'Hide passphrase' : 'Show passphrase'}
                >
                  {showImportPassphrase ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                </button>
              </div>

              <button
                id="btn-restore-backup"
                type="button"
                onClick={() => handleImport()}
                disabled={!importPassword || !importJson.trim()}
                className="px-4 py-2 bg-zinc-800 hover:bg-zinc-700 active:bg-zinc-600 disabled:opacity-40 text-zinc-100 rounded-lg font-medium transition-colors"
              >
                Restore Identity & Chats
              </button>
            </div>
          </div>
        )}

        {/* Tab 3: Danger Zone */}
        {activeTab === 'danger' && (
          <div className="space-y-4 text-xs">
            <div className="p-4 rounded-xl bg-rose-950/30 border border-rose-900/50 space-y-3">
              <div className="flex items-center space-x-2 text-rose-400 font-semibold">
                <ShieldAlert className="w-5 h-5" />
                <span>Reset Cryptographic Identity</span>
              </div>
              <p className="text-[11px] text-zinc-300 leading-relaxed">
                This will permanently delete your local identity keypairs, clear all cached peer records, wipe browser localStorage/sessionStorage, and purge all locally encrypted chat histories from this browser. This action cannot be undone unless you have an exported backup file.
              </p>

              {!showDangerConfirm ? (
                <button
                  id="btn-show-reset-confirm"
                  type="button"
                  onClick={() => setShowDangerConfirm(true)}
                  className="px-4 py-2 bg-rose-600 hover:bg-rose-500 text-white rounded-lg font-semibold transition-colors"
                >
                  Reset Local Identity...
                </button>
              ) : (
                <div className="p-3 bg-zinc-900 rounded-lg border border-rose-800/80 space-y-2">
                  <p className="font-semibold text-rose-300">Are you absolutely sure?</p>
                  <div className="flex space-x-2">
                    <button
                      id="btn-confirm-reset-identity"
                      type="button"
                      onClick={async () => {
                        try {
                          localStorage.clear();
                          sessionStorage.clear();
                        } catch {}
                        await onResetIdentity();
                        onClose();
                      }}
                      className="px-3 py-1.5 bg-rose-600 hover:bg-rose-500 text-white rounded font-medium"
                    >
                      Yes, Delete Everything & Generate New Keys
                    </button>
                    <button
                      type="button"
                      onClick={() => setShowDangerConfirm(false)}
                      className="px-3 py-1.5 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 rounded font-medium"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
