'use client';

import React, { useEffect, useRef, useState, useCallback } from 'react';
import {
  Mic,
  MicOff,
  Video,
  VideoOff,
  PhoneOff,
  User,
  Radio,
  Lock,
  Volume2,
  GripHorizontal,
  Pin,
  PinOff,
  ZoomIn,
  ZoomOut,
  RotateCcw,
  Maximize2,
  Minimize2,
  GitMerge,
  Pause,
  Play,
  Shield,
  Users,
  PhoneIncoming,
} from 'lucide-react';
import { motion } from 'motion/react';
import { ActiveCall, CallParticipant } from '@/src/types/webrtc';
import { chatManager } from '@/src/services/chat/ChatManager';

interface VideoCallModalProps {
  call: ActiveCall | null;
  onEndCall: () => void;
  onToggleAudio: () => void;
  onToggleVideo: () => void;
  onTogglePin?: (peerUid: string) => void;
  onSetZoomLevel?: (level: number) => void;
  onToggleMinimize?: () => void;
  onAcceptCallWaitingAndHold?: () => void;
  onRejectCallWaiting?: () => void;
  onMergeCallWaiting?: () => void;
  onMergeHeldCall?: (heldId?: string) => void;
  onResumeHeldCall?: (heldId?: string) => void;
}

/**
 * Individual participant video card component with automatic stream attachment
 */
const ParticipantTile: React.FC<{
  peerUid: string;
  stream: MediaStream | null;
  isLocal?: boolean;
  isVideoMuted?: boolean;
  isAudioMuted?: boolean;
  onHold?: boolean;
  isPinned?: boolean;
  onTogglePin?: () => void;
  className?: string;
  aspectClass?: string;
  showPinButton?: boolean;
}> = ({
  peerUid,
  stream,
  isLocal = false,
  isVideoMuted = false,
  isAudioMuted = false,
  onHold = false,
  isPinned = false,
  onTogglePin,
  className = '',
  aspectClass = 'aspect-3/4',
  showPinButton = true,
}) => {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  // Determine whether peer is known through prior chat/handshake (P2P zero-knowledge privacy)
  const isKnown = isLocal || chatManager.isPeerKnown(peerUid);
  const displayName = isLocal
    ? 'You (Local)'
    : isKnown
    ? `${peerUid.slice(0, 10)}...`
    : 'Anonymous Peer';

  useEffect(() => {
    if (videoRef.current && stream) {
      if (videoRef.current.srcObject !== stream) {
        videoRef.current.srcObject = stream;
      }
      videoRef.current.play().catch(() => {});
    }
  }, [stream]);

  useEffect(() => {
    if (!isLocal && audioRef.current && stream) {
      if (audioRef.current.srcObject !== stream) {
        audioRef.current.srcObject = stream;
      }
      audioRef.current.play().catch(() => {});
    }
  }, [stream, isLocal]);

  return (
    <div
      className={`relative ${aspectClass} rounded-2xl bg-zinc-900 border border-zinc-800 shadow-xl overflow-hidden flex items-center justify-center group ${className}`}
    >
      {!isLocal && <audio ref={audioRef} autoPlay playsInline className="hidden" />}

      {/* Video Element */}
      <video
        ref={videoRef}
        autoPlay
        playsInline
        muted={isLocal}
        className={`w-full h-full object-cover ${isLocal ? '-scale-x-100' : ''} ${
          isVideoMuted || onHold ? 'hidden' : 'block'
        }`}
      />

      {/* Fallback / Muted / On-Hold Placeholder */}
      {(isVideoMuted || onHold || !stream) && (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-zinc-900/95 text-center p-3 z-10">
          <div className="w-14 h-14 rounded-full bg-zinc-800 border border-zinc-700 flex items-center justify-center text-zinc-400 mb-2 shadow-md">
            {onHold ? (
              <Pause className="w-7 h-7 text-amber-400 animate-pulse" />
            ) : isVideoMuted ? (
              <VideoOff className="w-6 h-6 text-zinc-400" />
            ) : isKnown ? (
              <User className="w-7 h-7 text-emerald-400" />
            ) : (
              <Shield className="w-7 h-7 text-indigo-400" />
            )}
          </div>
          <span className="text-xs font-mono font-medium text-zinc-200 truncate max-w-[150px]">
            {displayName}
          </span>
          <span className="text-[10px] font-mono text-zinc-400 mt-0.5">
            {onHold
              ? 'Call On Hold'
              : isVideoMuted
              ? 'Camera Paused'
              : !stream
              ? 'Connecting stream...'
              : 'P2P Encrypted'}
          </span>
        </div>
      )}

      {/* Top Controls: Pin Button & Privacy / Host Tag */}
      <div className="absolute top-2.5 left-2.5 right-2.5 flex items-center justify-between z-20 pointer-events-none">
        <div className="px-2 py-0.5 rounded-md bg-black/60 backdrop-blur-xs border border-white/10 text-[10px] font-mono text-zinc-200 flex items-center space-x-1">
          {isKnown ? (
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 shrink-0" />
          ) : (
            <Shield className="w-3 h-3 text-indigo-400 shrink-0" />
          )}
          <span className="truncate max-w-[110px]">{displayName}</span>
        </div>

        {showPinButton && onTogglePin && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onTogglePin();
            }}
            className={`pointer-events-auto p-1.5 rounded-lg border transition-all cursor-pointer ${
              isPinned
                ? 'bg-amber-500 text-black border-amber-400 shadow-md'
                : 'bg-black/60 hover:bg-zinc-800 border-white/10 text-zinc-300'
            }`}
            title={isPinned ? 'Unpin screen' : 'Pin to spotlight view'}
          >
            {isPinned ? <PinOff className="w-3.5 h-3.5" /> : <Pin className="w-3.5 h-3.5" />}
          </button>
        )}
      </div>

      {/* Bottom Status Overlay */}
      <div className="absolute bottom-2.5 left-2.5 right-2.5 flex items-center justify-between z-20 pointer-events-none">
        <div className="flex items-center space-x-1">
          {isAudioMuted && (
            <span className="p-1 rounded-md bg-rose-950/80 border border-rose-800/80 text-rose-300">
              <MicOff className="w-3 h-3" />
            </span>
          )}
          {onHold && (
            <span className="px-1.5 py-0.5 rounded bg-amber-500/20 border border-amber-500/40 text-[10px] font-mono text-amber-300">
              Hold
            </span>
          )}
        </div>
        {!isKnown && (
          <span className="px-1.5 py-0.5 rounded bg-indigo-500/20 border border-indigo-500/30 text-[9px] font-mono text-indigo-300">
            Anonymous
          </span>
        )}
      </div>
    </div>
  );
};

export const VideoCallModal: React.FC<VideoCallModalProps> = ({
  call,
  onEndCall,
  onToggleAudio,
  onToggleVideo,
  onTogglePin,
  onSetZoomLevel,
  onToggleMinimize,
  onAcceptCallWaitingAndHold,
  onRejectCallWaiting,
  onMergeCallWaiting,
  onMergeHeldCall,
  onResumeHeldCall,
}) => {
  const [callDuration, setCallDuration] = useState(0);

  // Pan state for pinned screen when zoomed
  const zoomLevel = call?.zoomLevel ?? 1.0;
  const [panOffset, setPanOffset] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const dragStartRef = useRef<{ x: number; y: number; startPanX: number; startPanY: number } | null>(null);

  // Mobile stage ref for draggable elements
  const mobileStageRef = useRef<HTMLDivElement | null>(null);

  // Call duration counter
  useEffect(() => {
    if (call?.state !== 'connected' || !call?.startTime) {
      return;
    }

    const startTime = call.startTime;
    const timer = setInterval(() => {
      setCallDuration(Math.floor((Date.now() - startTime) / 1000));
    }, 1000);

    return () => {
      clearInterval(timer);
      setCallDuration(0);
    };
  }, [call?.state, call?.startTime]);

  const handleZoomChange = useCallback(
    (newLevel: number) => {
      const clamped = Math.min(3.0, Math.max(1.0, Math.round(newLevel * 10) / 10));
      if (clamped === 1.0) {
        setPanOffset({ x: 0, y: 0 });
      }
      onSetZoomLevel?.(clamped);
    },
    [onSetZoomLevel]
  );

  const handleMouseDown = (e: React.MouseEvent) => {
    if (zoomLevel <= 1.0) return;
    setIsDragging(true);
    dragStartRef.current = {
      x: e.clientX,
      y: e.clientY,
      startPanX: panOffset.x,
      startPanY: panOffset.y,
    };
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDragging || !dragStartRef.current) return;
    const dx = e.clientX - dragStartRef.current.x;
    const dy = e.clientY - dragStartRef.current.y;
    const maxOffset = (zoomLevel - 1) * 150;
    setPanOffset({
      x: Math.max(-maxOffset, Math.min(maxOffset, dragStartRef.current.startPanX + dx)),
      y: Math.max(-maxOffset, Math.min(maxOffset, dragStartRef.current.startPanY + dy)),
    });
  };

  const handleMouseUp = () => {
    setIsDragging(false);
    dragStartRef.current = null;
  };

  if (!call || call.state === 'incoming' || call.state === 'idle') return null;

  const isVideo = call.callType === 'video';
  const isVideoMuted = call.isVideoMuted ?? false;
  const isAudioMuted = call.isAudioMuted ?? false;
  const isMinimized = call.isMinimized ?? false;
  const participants = call.participants || [];
  const candidateCount = participants.length + 1; // Remote participants + local user
  const pinnedPeerUid = call.pinnedPeerUid;
  const callWaiting = call.callWaiting;
  const heldCalls = call.heldCalls || [];

  const formatSeconds = (sec: number) => {
    const mins = Math.floor(sec / 60);
    const s = sec % 60;
    return `${mins.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  // Find stream for pinned peer
  const getPinnedStream = (): { stream: MediaStream | null; isLocal: boolean; isKnown: boolean; peerUid: string } => {
    if (pinnedPeerUid === 'local') {
      return { stream: call.localStream || null, isLocal: true, isKnown: true, peerUid: 'local' };
    }
    const part = participants.find((p) => p.peerUid === pinnedPeerUid);
    if (part) {
      return {
        stream: part.stream || null,
        isLocal: false,
        isKnown: chatManager.isPeerKnown(part.peerUid),
        peerUid: part.peerUid,
      };
    }
    // Default to first remote participant
    if (participants.length > 0) {
      return {
        stream: participants[0].stream || call.remoteStream || null,
        isLocal: false,
        isKnown: chatManager.isPeerKnown(participants[0].peerUid),
        peerUid: participants[0].peerUid,
      };
    }
    return { stream: call.localStream || null, isLocal: true, isKnown: true, peerUid: 'local' };
  };

  // =========================================================================
  // 1. FLOATING POP-UP / IN-APP PICTURE-IN-PICTURE (PiP) VIEW
  // Allows user to concurrently chat, switch conversations, and use the app
  // =========================================================================
  if (isMinimized) {
    const primaryPart = participants[0];
    const isPrimaryKnown = primaryPart ? chatManager.isPeerKnown(primaryPart.peerUid) : true;
    const titleText = primaryPart
      ? isPrimaryKnown
        ? `${primaryPart.peerUid.slice(0, 10)}...`
        : 'Anonymous Peer'
      : 'Active Call';

    return (
      <div
        id="floating-call-pip"
        className="fixed bottom-5 right-5 z-50 w-80 sm:w-88 rounded-2xl bg-zinc-900/95 border border-zinc-700/80 shadow-2xl backdrop-blur-md overflow-hidden flex flex-col select-none transition-all"
      >
        {/* Floating Header */}
        <div className="px-3 py-2 bg-zinc-800/80 border-b border-zinc-700/60 flex items-center justify-between">
          <div className="flex items-center space-x-2 min-w-0">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            <span className="text-xs font-mono font-medium text-zinc-100 truncate">{titleText}</span>
            <span className="text-[10px] font-mono text-emerald-400 px-1.5 py-0.2 rounded bg-emerald-500/10">
              {formatSeconds(callDuration)}
            </span>
          </div>
          <div className="flex items-center space-x-1 shrink-0">
            <button
              onClick={onToggleMinimize}
              className="p-1.5 rounded-lg text-zinc-400 hover:text-zinc-100 hover:bg-zinc-700/60 transition-colors cursor-pointer"
              title="Expand to Full Screen"
            >
              <Maximize2 className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* Video Thumbnail in PiP */}
        <div className="relative aspect-video w-full bg-zinc-950 flex items-center justify-center overflow-hidden">
          {isVideo && primaryPart?.stream ? (
            <video
              autoPlay
              playsInline
              ref={(el) => {
                if (el && primaryPart.stream && el.srcObject !== primaryPart.stream) {
                  el.srcObject = primaryPart.stream;
                  el.play().catch(() => {});
                }
              }}
              className="w-full h-full object-cover"
            />
          ) : (
            <div className="flex flex-col items-center justify-center p-3 text-center">
              <div className="w-10 h-10 rounded-full bg-zinc-800 border border-zinc-700 flex items-center justify-center text-zinc-400 mb-1">
                {isPrimaryKnown ? <User className="w-5 h-5" /> : <Shield className="w-5 h-5 text-indigo-400" />}
              </div>
              <span className="text-[11px] font-mono text-zinc-300 truncate max-w-[180px]">{titleText}</span>
              <span className="text-[10px] font-mono text-zinc-500">
                {candidateCount} Candidates in mesh
              </span>
            </div>
          )}

          {/* Mini local user camera preview */}
          {isVideo && call.localStream && (
            <div className="absolute bottom-2 right-2 w-16 h-12 rounded-lg bg-zinc-900 border border-white/20 overflow-hidden shadow-lg">
              <video
                autoPlay
                playsInline
                muted
                ref={(el) => {
                  if (el && call.localStream && el.srcObject !== call.localStream) {
                    el.srcObject = call.localStream;
                    el.play().catch(() => {});
                  }
                }}
                className={`w-full h-full object-cover -scale-x-100 ${isVideoMuted ? 'hidden' : 'block'}`}
              />
              {isVideoMuted && (
                <div className="w-full h-full flex items-center justify-center bg-zinc-900 text-[8px] font-mono text-zinc-400">
                  Off
                </div>
              )}
            </div>
          )}

          {/* PiP Call Waiting Badge if someone is calling */}
          {callWaiting && (
            <div className="absolute inset-x-2 top-2 z-20 p-2 rounded-xl bg-amber-950/95 border border-amber-600/80 shadow-lg text-[10px] font-mono text-amber-200 flex items-center justify-between">
              <span className="truncate">Call waiting...</span>
              <button
                onClick={onToggleMinimize}
                className="px-2 py-0.5 rounded bg-amber-600 text-white font-medium hover:bg-amber-500"
              >
                View
              </button>
            </div>
          )}
        </div>

        {/* Quick PiP Floating Action Controls */}
        <div className="p-2.5 bg-zinc-900 border-t border-zinc-800 flex items-center justify-around">
          <button
            onClick={onToggleAudio}
            className={`p-2 rounded-full cursor-pointer transition-colors ${
              isAudioMuted
                ? 'bg-rose-600/20 text-rose-400 border border-rose-500/40'
                : 'bg-zinc-800 text-zinc-200 hover:bg-zinc-700'
            }`}
            title={isAudioMuted ? 'Unmute' : 'Mute'}
          >
            {isAudioMuted ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
          </button>
          {isVideo && (
            <button
              onClick={onToggleVideo}
              className={`p-2 rounded-full cursor-pointer transition-colors ${
                isVideoMuted
                  ? 'bg-rose-600/20 text-rose-400 border border-rose-500/40'
                  : 'bg-zinc-800 text-zinc-200 hover:bg-zinc-700'
              }`}
              title={isVideoMuted ? 'Camera On' : 'Camera Off'}
            >
              {isVideoMuted ? <VideoOff className="w-4 h-4" /> : <Video className="w-4 h-4" />}
            </button>
          )}
          <button
            onClick={onToggleMinimize}
            className="p-2 rounded-full bg-zinc-800 hover:bg-zinc-700 text-zinc-200 cursor-pointer transition-colors"
            title="Expand Call Window"
          >
            <Maximize2 className="w-4 h-4" />
          </button>
          <button
            onClick={onEndCall}
            className="p-2 rounded-full bg-rose-600 hover:bg-rose-500 text-white cursor-pointer transition-colors shadow-md"
            title="End Call"
          >
            <PhoneOff className="w-4 h-4" />
          </button>
        </div>
      </div>
    );
  }

  // =========================================================================
  // 2. FULL CALL MODAL VIEW
  // =========================================================================
  const pinnedInfo = getPinnedStream();
  const hasPin = Boolean(pinnedPeerUid);
  const isMultiParty = candidateCount > 2;

  return (
    <div
      id="modal-active-call"
      className="fixed inset-0 z-50 bg-zinc-950 flex flex-col select-none overflow-hidden"
    >
      {/* ============================================================== */}
      {/* Header Bar: Status, Encryption Badge, Candidates, Minimize */}
      {/* ============================================================== */}
      <header className="h-16 px-4 z-30 shrink-0 flex items-center justify-between border-b border-zinc-800/80 bg-zinc-900/90 backdrop-blur-md">
        <div className="flex items-center space-x-2.5 min-w-0">
          <div className="w-8 h-8 rounded-full bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400 shrink-0">
            <Lock className="w-4 h-4" />
          </div>
          <div className="min-w-0">
            <div className="font-mono text-xs font-semibold text-zinc-100 flex items-center space-x-2 truncate">
              <span className="truncate">
                {candidateCount > 2
                  ? `Group Mesh Call (${candidateCount} Candidates)`
                  : chatManager.isPeerKnown(call.peerUid)
                  ? call.peerUid
                  : 'Anonymous Peer'}
              </span>
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 shrink-0" />
            </div>
            <div className="text-[11px] font-mono text-zinc-400">
              {call.state === 'connected' ? (
                <span className="text-emerald-400 font-medium">
                  P2P Mesh Encrypted • {formatSeconds(callDuration)}
                </span>
              ) : call.state === 'on-hold' ? (
                <span className="text-amber-400">Call On Hold</span>
              ) : (
                <span className="text-amber-400 animate-pulse">
                  {call.statusMessage || 'Establishing peer connection...'}
                </span>
              )}
            </div>
          </div>
        </div>

        <div className="flex items-center space-x-2 shrink-0">
          {/* Candidates Badge */}
          <div className="hidden sm:flex items-center space-x-1.5 text-xs font-mono px-2.5 py-1 bg-zinc-800/80 border border-zinc-700/80 rounded-full text-zinc-300">
            <Users className="w-3.5 h-3.5 text-emerald-400" />
            <span>{candidateCount}/5 Candidates</span>
          </div>

          {/* Call Type Badge */}
          <div className="text-xs font-mono px-2.5 py-1 bg-zinc-800/80 border border-zinc-700/80 rounded-full text-zinc-300 flex items-center space-x-1.5">
            <Radio className="w-3 h-3 text-emerald-400" />
            <span>{isVideo ? 'Video' : 'Audio'}</span>
          </div>

          {/* Minimize into Floating Pop-up (PiP) */}
          <button
            id="btn-minimize-call"
            type="button"
            onClick={onToggleMinimize}
            className="p-2 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-200 border border-zinc-700/80 transition-colors cursor-pointer"
            title="Minimize to Floating Pop-up (Chat concurrently)"
          >
            <Minimize2 className="w-4 h-4" />
          </button>
        </div>
      </header>

      {/* ============================================================== */}
      {/* Call Waiting Banner (When a 3rd/4th party calls while in call) */}
      {/* ============================================================== */}
      {callWaiting && (
        <div
          id="banner-call-waiting"
          className="z-40 px-4 py-3 bg-amber-950/95 border-b border-amber-600/80 flex flex-wrap items-center justify-between gap-3 backdrop-blur-md transition-all shadow-xl"
        >
          <div className="flex items-center space-x-3 min-w-0">
            <div className="w-8 h-8 rounded-full bg-amber-500/20 border border-amber-500/40 flex items-center justify-center text-amber-300 shrink-0 animate-pulse">
              <PhoneIncoming className="w-4 h-4" />
            </div>
            <div className="min-w-0">
              <div className="text-xs font-semibold text-amber-100 flex items-center space-x-1.5">
                <span>Incoming Call Waiting</span>
                <span className="text-[10px] px-1.5 py-0.2 bg-amber-500/20 text-amber-300 rounded font-mono">
                  {callWaiting.callType === 'video' ? 'Video' : 'Audio'}
                </span>
              </div>
              <p className="text-[11px] font-mono text-amber-300/90 truncate">
                From:{' '}
                {chatManager.isPeerKnown(callWaiting.callerUid)
                  ? callWaiting.callerUid
                  : 'Anonymous Candidate'}
              </p>
            </div>
          </div>

          <div className="flex items-center space-x-2 shrink-0">
            {/* Merge Directly */}
            {candidateCount < 5 && onMergeCallWaiting && (
              <button
                type="button"
                onClick={onMergeCallWaiting}
                className="px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 active:bg-emerald-700 text-white text-xs font-medium flex items-center space-x-1.5 shadow-md cursor-pointer transition-colors"
                title="Merge caller into group call"
              >
                <GitMerge className="w-3.5 h-3.5" />
                <span>Merge Call</span>
              </button>
            )}

            {/* Answer & Put Current on Hold */}
            {onAcceptCallWaitingAndHold && (
              <button
                type="button"
                onClick={onAcceptCallWaitingAndHold}
                className="px-3 py-1.5 rounded-xl bg-amber-600 hover:bg-amber-500 active:bg-amber-700 text-white text-xs font-medium flex items-center space-x-1.5 shadow-md cursor-pointer transition-colors"
                title="Answer caller and put current call on hold"
              >
                <Pause className="w-3.5 h-3.5" />
                <span>Answer & Hold</span>
              </button>
            )}

            {/* Decline */}
            {onRejectCallWaiting && (
              <button
                type="button"
                onClick={onRejectCallWaiting}
                className="px-3 py-1.5 rounded-xl bg-rose-600 hover:bg-rose-500 active:bg-rose-700 text-white text-xs font-medium flex items-center space-x-1.5 shadow-md cursor-pointer transition-colors"
                title="Decline waiting call"
              >
                <PhoneOff className="w-3.5 h-3.5" />
                <span>Decline</span>
              </button>
            )}
          </div>
        </div>
      )}

      {/* ============================================================== */}
      {/* On-Hold Calls Bar (If any previous call was put on hold) */}
      {/* ============================================================== */}
      {heldCalls.length > 0 && (
        <div
          id="banner-calls-on-hold"
          className="z-30 px-4 py-2 bg-zinc-900 border-b border-zinc-800 flex items-center justify-between text-xs font-mono text-zinc-300"
        >
          <div className="flex items-center space-x-2 truncate">
            <Pause className="w-3.5 h-3.5 text-amber-400" />
            <span>
              {heldCalls.length} call session on hold (
              {chatManager.isPeerKnown(heldCalls[0].peerUid)
                ? heldCalls[0].peerUid.slice(0, 10) + '...'
                : 'Anonymous'}
              )
            </span>
          </div>

          <div className="flex items-center space-x-2 shrink-0">
            {candidateCount < 5 && onMergeHeldCall && (
              <button
                type="button"
                onClick={() => onMergeHeldCall(heldCalls[0]?.id)}
                className="px-2.5 py-1 rounded-lg bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-400 border border-emerald-500/40 text-[11px] font-medium flex items-center space-x-1 cursor-pointer transition-colors"
              >
                <GitMerge className="w-3 h-3" />
                <span>Merge into Mesh</span>
              </button>
            )}
            {onResumeHeldCall && (
              <button
                type="button"
                onClick={() => onResumeHeldCall(heldCalls[0]?.id)}
                className="px-2.5 py-1 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-200 border border-zinc-700 text-[11px] flex items-center space-x-1 cursor-pointer transition-colors"
              >
                <Play className="w-3 h-3" />
                <span>Swap / Resume</span>
              </button>
            )}
          </div>
        </div>
      )}

      {/* ============================================================== */}
      {/* Main Calling Stage */}
      {/* ============================================================== */}
      <div className="flex-1 relative flex flex-col items-center justify-center bg-zinc-950 overflow-hidden min-h-0 p-3 md:p-6">
        {isVideo ? (
          <>
            {/* -------------------------------------------------------- */}
            {/* SCENARIO A: PINNED SPOTLIGHT VIEW (>2 users or explicit pin) */}
            {/* -------------------------------------------------------- */}
            {hasPin || (isMultiParty && pinnedPeerUid !== null) ? (
              <div className="w-full h-full flex flex-col md:flex-row gap-4 min-h-0 items-center justify-center">
                {/* Pinned Featured Screen with Interactive Zoom & Pan */}
                <div className="relative flex-1 w-full h-full max-h-[calc(100vh-230px)] rounded-2xl bg-zinc-900 border-2 border-amber-500/60 shadow-2xl overflow-hidden flex items-center justify-center group select-none">
                  <div
                    onMouseDown={handleMouseDown}
                    onMouseMove={handleMouseMove}
                    onMouseUp={handleMouseUp}
                    onMouseLeave={handleMouseUp}
                    className={`relative w-full h-full flex items-center justify-center overflow-hidden ${
                      zoomLevel > 1.0 ? 'cursor-grab active:cursor-grabbing' : ''
                    }`}
                  >
                    {/* Zoomable Video Frame */}
                    <div
                      style={{
                        transform: `scale(${zoomLevel}) translate(${panOffset.x / zoomLevel}px, ${
                          panOffset.y / zoomLevel
                        }px)`,
                        transformOrigin: 'center center',
                        transition: isDragging ? 'none' : 'transform 0.15s ease-out',
                      }}
                      className="w-full h-full flex items-center justify-center"
                    >
                      <video
                        autoPlay
                        playsInline
                        muted={pinnedInfo.isLocal}
                        ref={(el) => {
                          if (el && pinnedInfo.stream && el.srcObject !== pinnedInfo.stream) {
                            el.srcObject = pinnedInfo.stream;
                            el.play().catch(() => {});
                          }
                        }}
                        className={`w-full h-full object-cover ${pinnedInfo.isLocal ? '-scale-x-100' : ''}`}
                      />
                    </div>
                  </div>

                  {/* Pinned Info Badge */}
                  <div className="absolute top-3 left-3 z-20 px-2.5 py-1 rounded-lg bg-black/70 backdrop-blur-md border border-white/10 text-xs font-mono text-zinc-100 flex items-center space-x-1.5 pointer-events-none">
                    <Pin className="w-3.5 h-3.5 text-amber-400 fill-amber-400" />
                    <span>
                      {pinnedInfo.isLocal
                        ? 'You (Pinned)'
                        : pinnedInfo.isKnown
                        ? `${pinnedInfo.peerUid.slice(0, 10)}...`
                        : 'Anonymous Peer'}
                    </span>
                  </div>

                  {/* Unpin Button */}
                  <div className="absolute top-3 right-3 z-20 flex items-center space-x-2">
                    <button
                      type="button"
                      onClick={() => onTogglePin?.(pinnedInfo.peerUid)}
                      className="px-2.5 py-1 rounded-lg bg-amber-500 hover:bg-amber-400 text-black font-medium text-xs font-mono flex items-center space-x-1 shadow-lg cursor-pointer transition-colors"
                      title="Unpin screen"
                    >
                      <PinOff className="w-3.5 h-3.5" />
                      <span>Unpin</span>
                    </button>
                  </div>

                  {/* Interactive Zoom Controls Overlay */}
                  <div className="absolute bottom-3 inset-x-3 z-20 flex items-center justify-between pointer-events-none">
                    <div className="px-2 py-1 rounded-lg bg-black/70 backdrop-blur-md border border-white/10 text-[11px] font-mono text-zinc-300">
                      Zoom: <span className="text-amber-400 font-semibold">{Math.round(zoomLevel * 100)}%</span>
                      {zoomLevel > 1.0 && <span className="ml-2 text-zinc-400">(Drag to pan)</span>}
                    </div>

                    <div className="pointer-events-auto flex items-center space-x-1.5 bg-black/70 backdrop-blur-md border border-white/10 p-1 rounded-xl shadow-xl">
                      <button
                        type="button"
                        onClick={() => handleZoomChange(zoomLevel - 0.25)}
                        disabled={zoomLevel <= 1.0}
                        className="p-1.5 rounded-lg text-zinc-300 hover:text-white hover:bg-zinc-800 disabled:opacity-30 disabled:pointer-events-none cursor-pointer transition-colors"
                        title="Zoom Out"
                      >
                        <ZoomOut className="w-4 h-4" />
                      </button>

                      {/* Zoom Slider */}
                      <input
                        type="range"
                        min="1.0"
                        max="3.0"
                        step="0.1"
                        value={zoomLevel}
                        onChange={(e) => handleZoomChange(parseFloat(e.target.value))}
                        className="w-20 sm:w-28 accent-amber-400 cursor-pointer h-1.5 bg-zinc-700 rounded-lg appearance-none"
                        title="Adjust Zoom Level"
                      />

                      <button
                        type="button"
                        onClick={() => handleZoomChange(zoomLevel + 0.25)}
                        disabled={zoomLevel >= 3.0}
                        className="p-1.5 rounded-lg text-zinc-300 hover:text-white hover:bg-zinc-800 disabled:opacity-30 disabled:pointer-events-none cursor-pointer transition-colors"
                        title="Zoom In"
                      >
                        <ZoomIn className="w-4 h-4" />
                      </button>

                      <button
                        type="button"
                        onClick={() => handleZoomChange(1.0)}
                        className="p-1.5 rounded-lg text-zinc-300 hover:text-white hover:bg-zinc-800 text-[11px] font-mono cursor-pointer transition-colors"
                        title="Reset Zoom to 1.0x"
                      >
                        <RotateCcw className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                </div>

                {/* Filmstrip / Side Grid of Other Candidates */}
                <div className="w-full md:w-64 lg:w-72 shrink-0 flex md:flex-col gap-3 overflow-x-auto md:overflow-y-auto max-h-40 md:max-h-[calc(100vh-230px)] p-1">
                  {/* Local preview if not pinned */}
                  {pinnedPeerUid !== 'local' && (
                    <ParticipantTile
                      peerUid="local"
                      stream={call.localStream || null}
                      isLocal={true}
                      isVideoMuted={isVideoMuted}
                      isAudioMuted={isAudioMuted}
                      isPinned={false}
                      onTogglePin={() => onTogglePin?.('local')}
                      className="w-32 md:w-full shrink-0"
                      aspectClass="aspect-video"
                    />
                  )}

                  {/* Remote participants */}
                  {participants.map((p) => {
                    if (p.peerUid === pinnedPeerUid) return null;
                    return (
                      <ParticipantTile
                        key={p.peerUid}
                        peerUid={p.peerUid}
                        stream={p.stream || null}
                        isLocal={false}
                        isVideoMuted={p.isVideoMuted}
                        isAudioMuted={p.isAudioMuted}
                        onHold={p.onHold}
                        isPinned={false}
                        onTogglePin={() => onTogglePin?.(p.peerUid)}
                        className="w-32 md:w-full shrink-0"
                        aspectClass="aspect-video"
                      />
                    );
                  })}
                </div>
              </div>
            ) : isMultiParty ? (
              /* -------------------------------------------------------- */
              /* SCENARIO B: MULTI-PARTY GRID (>2 candidates, no active pin) */
              /* -------------------------------------------------------- */
              <div className="w-full h-full max-h-[calc(100vh-200px)] grid grid-cols-2 md:grid-cols-3 gap-3 md:gap-4 p-2 overflow-y-auto">
                {/* Local user tile */}
                <ParticipantTile
                  peerUid="local"
                  stream={call.localStream || null}
                  isLocal={true}
                  isVideoMuted={isVideoMuted}
                  isAudioMuted={isAudioMuted}
                  isPinned={false}
                  onTogglePin={() => onTogglePin?.('local')}
                  aspectClass="aspect-video md:aspect-3/4"
                />

                {/* Remote candidates tiles */}
                {participants.map((p) => (
                  <ParticipantTile
                    key={p.peerUid}
                    peerUid={p.peerUid}
                    stream={p.stream || null}
                    isLocal={false}
                    isVideoMuted={p.isVideoMuted}
                    isAudioMuted={p.isAudioMuted}
                    onHold={p.onHold}
                    isPinned={false}
                    onTogglePin={() => onTogglePin?.(p.peerUid)}
                    aspectClass="aspect-video md:aspect-3/4"
                  />
                ))}
              </div>
            ) : (
              /* -------------------------------------------------------- */
              /* SCENARIO C: 2-USER 1:1 CALL (Desktop 3:4 & Mobile 1:1)   */
              /* -------------------------------------------------------- */
              <>
                {/* Desktop layout: Two 3:4 cards side by side */}
                <div className="hidden md:flex w-full h-full max-h-[calc(100vh-200px)] items-center justify-center gap-6 lg:gap-8 min-h-0">
                  {/* Remote user card */}
                  <ParticipantTile
                    peerUid={participants[0]?.peerUid || call.peerUid}
                    stream={participants[0]?.stream || call.remoteStream || null}
                    isLocal={false}
                    onHold={participants[0]?.onHold || call.state === 'on-hold'}
                    isPinned={pinnedPeerUid === (participants[0]?.peerUid || call.peerUid)}
                    onTogglePin={() => onTogglePin?.(participants[0]?.peerUid || call.peerUid)}
                    className="h-full max-h-[580px] w-auto max-w-[435px]"
                    aspectClass="aspect-3/4"
                  />

                  {/* Local user camera card */}
                  <ParticipantTile
                    peerUid="local"
                    stream={call.localStream || null}
                    isLocal={true}
                    isVideoMuted={isVideoMuted}
                    isAudioMuted={isAudioMuted}
                    isPinned={pinnedPeerUid === 'local'}
                    onTogglePin={() => onTogglePin?.('local')}
                    className="h-full max-h-[580px] w-auto max-w-[435px]"
                    aspectClass="aspect-3/4"
                  />
                </div>

                {/* Mobile layout: 1:1 larger card + 1:1 small draggable floating card */}
                <div
                  ref={mobileStageRef}
                  className="md:hidden relative w-full h-full flex flex-col items-center justify-center p-2 min-h-0"
                >
                  {/* Remote user 1:1 larger card */}
                  <ParticipantTile
                    peerUid={participants[0]?.peerUid || call.peerUid}
                    stream={participants[0]?.stream || call.remoteStream || null}
                    isLocal={false}
                    onHold={participants[0]?.onHold || call.state === 'on-hold'}
                    isPinned={pinnedPeerUid === (participants[0]?.peerUid || call.peerUid)}
                    onTogglePin={() => onTogglePin?.(participants[0]?.peerUid || call.peerUid)}
                    className="w-full max-w-[340px] sm:max-w-[380px]"
                    aspectClass="aspect-square"
                  />

                  {/* Draggable local camera 1:1 small card */}
                  <motion.div
                    drag
                    dragConstraints={mobileStageRef}
                    dragElastic={0.12}
                    dragMomentum={false}
                    className="absolute bottom-4 right-4 w-24 h-24 sm:w-28 sm:h-28 rounded-xl bg-zinc-900 border-2 border-emerald-500/80 shadow-2xl overflow-hidden z-30 cursor-grab active:cursor-grabbing touch-none select-none"
                    title="Drag to reposition (Top, Bottom, Left, Right)"
                  >
                    <ParticipantTile
                      peerUid="local"
                      stream={call.localStream || null}
                      isLocal={true}
                      isVideoMuted={isVideoMuted}
                      isAudioMuted={isAudioMuted}
                      showPinButton={false}
                      className="w-full h-full"
                      aspectClass="aspect-square"
                    />
                    <div className="absolute top-1 right-1 p-0.5 rounded bg-black/60 text-zinc-300 pointer-events-none">
                      <GripHorizontal className="w-3 h-3" />
                    </div>
                  </motion.div>
                </div>
              </>
            )}
          </>
        ) : (
          /* -------------------------------------------------------- */
          /* DEDICATED AUDIO CALL SCREEN (1 to 5 candidates)          */
          /* -------------------------------------------------------- */
          <div className="flex flex-col items-center justify-center text-center p-6 z-10 max-w-md">
            <div className="relative mb-6">
              <div className="w-28 h-28 rounded-full bg-zinc-900 border-2 border-emerald-500/40 flex items-center justify-center text-zinc-300 shadow-2xl">
                {candidateCount > 2 ? (
                  <Users className="w-14 h-14 text-emerald-400" />
                ) : chatManager.isPeerKnown(call.peerUid) ? (
                  <User className="w-14 h-14 text-emerald-400" />
                ) : (
                  <Shield className="w-14 h-14 text-indigo-400" />
                )}
              </div>
              <div className="absolute -bottom-1 -right-1 w-9 h-9 rounded-full bg-zinc-900 border border-zinc-700 flex items-center justify-center text-emerald-400 shadow-md">
                <Volume2 className="w-4 h-4 animate-pulse" />
              </div>
            </div>

            <h4 className="text-base font-semibold text-zinc-100 font-mono mb-1 truncate max-w-xs">
              {candidateCount > 2
                ? `Group Audio Call (${candidateCount} Candidates)`
                : chatManager.isPeerKnown(call.peerUid)
                ? call.peerUid
                : 'Anonymous Peer'}
            </h4>

            <div className="text-xs font-mono text-zinc-400 mb-3">
              {call.state === 'connected' ? (
                <span className="text-emerald-400 font-medium">
                  Direct Audio Mesh Active • {formatSeconds(callDuration)}
                </span>
              ) : call.state === 'on-hold' ? (
                <span className="text-amber-400">Call On Hold</span>
              ) : (
                <span className="text-amber-400 animate-pulse">
                  {call.statusMessage || 'Connecting P2P audio stream...'}
                </span>
              )}
            </div>

            {/* Audio mesh participant avatars */}
            {candidateCount > 2 && (
              <div className="flex items-center justify-center -space-x-2 my-2">
                {participants.map((p, idx) => {
                  const known = chatManager.isPeerKnown(p.peerUid);
                  return (
                    <div
                      key={p.peerUid}
                      title={known ? p.peerUid : 'Anonymous Candidate'}
                      className="w-8 h-8 rounded-full bg-zinc-800 border-2 border-zinc-950 flex items-center justify-center text-zinc-300 text-xs font-mono shadow"
                    >
                      {known ? idx + 1 : <Shield className="w-3.5 h-3.5 text-indigo-400" />}
                    </div>
                  );
                })}
              </div>
            )}

            <div className="flex items-center space-x-1.5 text-xs text-zinc-500 font-mono mt-2">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
              <span>Zero-knowledge end-to-end direct audio</span>
            </div>
          </div>
        )}
      </div>

      {/* ============================================================== */}
      {/* Call Controls Bar                                              */}
      {/* ============================================================== */}
      <footer className="h-20 shrink-0 bg-zinc-900/95 border-t border-zinc-800 flex items-center justify-center space-x-5 z-30 px-4 backdrop-blur-md pb-[env(safe-area-inset-bottom,0px)]">
        {/* Toggle Audio */}
        <button
          id="btn-toggle-audio"
          type="button"
          onClick={onToggleAudio}
          className={`p-3.5 rounded-full transition-colors cursor-pointer relative z-30 ${
            isAudioMuted
              ? 'bg-rose-600/20 border border-rose-500/40 text-rose-400 hover:bg-rose-600/30'
              : 'bg-zinc-800 border border-zinc-700 text-zinc-200 hover:bg-zinc-700'
          }`}
          title={isAudioMuted ? 'Unmute Microphone' : 'Mute Microphone'}
        >
          {isAudioMuted ? <MicOff className="w-5 h-5" /> : <Mic className="w-5 h-5" />}
        </button>

        {/* Toggle Video (only in video call) */}
        {isVideo && (
          <button
            id="btn-toggle-video"
            type="button"
            onClick={onToggleVideo}
            className={`p-3.5 rounded-full transition-colors cursor-pointer relative z-30 ${
              isVideoMuted
                ? 'bg-rose-600/20 border border-rose-500/40 text-rose-400 hover:bg-rose-600/30'
                : 'bg-zinc-800 border border-zinc-700 text-zinc-200 hover:bg-zinc-700'
            }`}
            title={isVideoMuted ? 'Turn Camera On' : 'Turn Camera Off'}
          >
            {isVideoMuted ? <VideoOff className="w-5 h-5" /> : <Video className="w-5 h-5" />}
          </button>
        )}

        {/* End Call */}
        <button
          id="btn-end-call"
          type="button"
          onClick={onEndCall}
          className="p-3.5 rounded-full bg-rose-600 hover:bg-rose-500 active:bg-rose-700 text-white transition-colors shadow-lg cursor-pointer relative z-30"
          title="End Call"
        >
          <PhoneOff className="w-5 h-5" />
        </button>
      </footer>
    </div>
  );
};
