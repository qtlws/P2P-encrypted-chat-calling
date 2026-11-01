'use client';

import React, { useEffect, useRef, useState } from 'react';
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
} from 'lucide-react';
import { motion } from 'motion/react';
import { ActiveCall } from '@/src/types/webrtc';

interface VideoCallModalProps {
  call: ActiveCall | null;
  onEndCall: () => void;
  onToggleAudio: () => void;
  onToggleVideo: () => void;
}

export const VideoCallModal: React.FC<VideoCallModalProps> = ({
  call,
  onEndCall,
  onToggleAudio,
  onToggleVideo,
}) => {
  // Video element refs for desktop layout
  const desktopLocalVideoRef = useRef<HTMLVideoElement | null>(null);
  const desktopRemoteVideoRef = useRef<HTMLVideoElement | null>(null);

  // Video element refs for mobile layout
  const mobileLocalVideoRef = useRef<HTMLVideoElement | null>(null);
  const mobileRemoteVideoRef = useRef<HTMLVideoElement | null>(null);

  // Dedicated audio element
  const remoteAudioRef = useRef<HTMLAudioElement | null>(null);

  // Container ref to constrain mobile draggable floating preview
  const mobileStageRef = useRef<HTMLDivElement | null>(null);

  const [callDuration, setCallDuration] = useState(0);

  const remoteStream = call?.remoteStream ?? null;
  const localStream = call?.localStream ?? null;
  const isVideoMuted = call?.isVideoMuted ?? false;
  const isAudioMuted = call?.isAudioMuted ?? false;
  const isConnected = call?.state === 'connected';

  // Remote audio stream synchronization
  useEffect(() => {
    if (remoteAudioRef.current && remoteStream) {
      if (remoteAudioRef.current.srcObject !== remoteStream) {
        remoteAudioRef.current.srcObject = remoteStream;
      }
      remoteAudioRef.current.play().catch(() => {});
    }
  }, [remoteStream, isConnected]);

  // Remote video streams (both desktop & mobile views)
  useEffect(() => {
    if (remoteStream) {
      if (desktopRemoteVideoRef.current && desktopRemoteVideoRef.current.srcObject !== remoteStream) {
        desktopRemoteVideoRef.current.srcObject = remoteStream;
        desktopRemoteVideoRef.current.play().catch(() => {});
      }
      if (mobileRemoteVideoRef.current && mobileRemoteVideoRef.current.srcObject !== remoteStream) {
        mobileRemoteVideoRef.current.srcObject = remoteStream;
        mobileRemoteVideoRef.current.play().catch(() => {});
      }
    }
  }, [remoteStream, isConnected]);

  // Local video streams (both desktop & mobile views)
  useEffect(() => {
    if (localStream) {
      if (desktopLocalVideoRef.current && desktopLocalVideoRef.current.srcObject !== localStream) {
        desktopLocalVideoRef.current.srcObject = localStream;
        desktopLocalVideoRef.current.play().catch(() => {});
      }
      if (mobileLocalVideoRef.current && mobileLocalVideoRef.current.srcObject !== localStream) {
        mobileLocalVideoRef.current.srcObject = localStream;
        mobileLocalVideoRef.current.play().catch(() => {});
      }
    }
  }, [localStream, isVideoMuted]);

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

  if (!call || call.state === 'incoming' || call.state === 'idle') return null;

  const formatSeconds = (sec: number) => {
    const mins = Math.floor(sec / 60);
    const s = sec % 60;
    return `${mins.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  const isVideo = call.callType === 'video';

  return (
    <div id="modal-active-call" className="fixed inset-0 z-50 bg-zinc-950 flex flex-col select-none overflow-hidden">
      {/* Hidden dedicated audio element to guarantee remote voice playback */}
      <audio
        ref={remoteAudioRef}
        autoPlay
        playsInline
        className="hidden"
      />

      {/* Top Header Bar */}
      <header className="h-16 px-4 z-20 shrink-0 flex items-center justify-between border-b border-zinc-800/80 bg-zinc-900/90 backdrop-blur-md">
        <div className="flex items-center space-x-2.5 min-w-0">
          <div className="w-8 h-8 rounded-full bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400 shrink-0">
            <Lock className="w-4 h-4" />
          </div>
          <div className="min-w-0">
            <div className="font-mono text-xs font-semibold text-zinc-100 flex items-center space-x-1.5 truncate">
              <span className="truncate">{call.peerUid}</span>
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 shrink-0" />
            </div>
            <div className="text-[11px] font-mono text-zinc-400">
              {call.state === 'connected' ? (
                <span className="text-emerald-400 font-medium">P2P Encrypted • {formatSeconds(callDuration)}</span>
              ) : (
                <span className="text-amber-400 animate-pulse">Establishing peer connection...</span>
              )}
            </div>
          </div>
        </div>

        <div className="text-xs font-mono px-2.5 py-1 bg-zinc-800/80 border border-zinc-700/80 rounded-full text-zinc-300 flex items-center space-x-1.5 shrink-0">
          <Radio className="w-3 h-3 text-emerald-400" />
          <span>{isVideo ? 'P2P Video' : 'P2P Audio'}</span>
        </div>
      </header>

      {/* Main Calling Stage */}
      <div className="flex-1 relative flex items-center justify-center bg-zinc-950 overflow-hidden min-h-0">
        {isVideo ? (
          <>
            {/* ============================================================== */}
            {/* DESKTOP / LAPTOP LAYOUT (md and above): Two 3:4 divs side-by-side */}
            {/* ============================================================== */}
            <div className="hidden md:flex w-full h-full max-h-[calc(100vh-140px)] items-center justify-center gap-6 lg:gap-8 p-4 lg:p-6 min-h-0">
              {/* Upcoming (Remote) User Video Div - 3:4 aspect ratio */}
              <div
                id="desktop-remote-video-card"
                className="relative aspect-3/4 h-full max-h-[580px] w-auto max-w-[435px] rounded-2xl bg-zinc-900 border border-zinc-800 shadow-2xl overflow-hidden flex items-center justify-center group"
              >
                <video
                  ref={desktopRemoteVideoRef}
                  id="desktop-remote-video"
                  autoPlay
                  playsInline
                  className="w-full h-full object-cover"
                />

                {/* Remote video placeholder when waiting or no video */}
                {(!remoteStream || call.state !== 'connected') && (
                  <div className="absolute inset-0 flex flex-col items-center justify-center bg-zinc-900 text-center p-6 z-10">
                    <div className="w-20 h-20 rounded-full bg-zinc-800 border border-zinc-700 flex items-center justify-center text-zinc-400 mb-3 shadow-lg">
                      <User className="w-10 h-10" />
                    </div>
                    <h4 className="text-sm font-medium text-zinc-200 font-mono truncate max-w-[200px] mb-1">
                      {call.peerUid}
                    </h4>
                    <p className="text-xs text-amber-400 font-mono animate-pulse">
                      {call.state === 'calling' ? 'Calling peer...' : 'Connecting video stream...'}
                    </p>
                  </div>
                )}

                {/* Peer Name & Encryption Overlay Badge */}
                <div className="absolute bottom-3 left-3 right-3 flex items-center justify-between pointer-events-none z-10">
                  <div className="px-2.5 py-1 rounded-lg bg-black/60 backdrop-blur-sm border border-white/10 text-xs font-mono text-zinc-200 flex items-center space-x-1.5">
                    <span className="w-2 h-2 rounded-full bg-emerald-400" />
                    <span className="truncate max-w-[140px]">{call.peerUid.slice(0, 12)}...</span>
                  </div>
                  <div className="px-2 py-1 rounded-lg bg-black/60 backdrop-blur-sm border border-white/10 text-[10px] font-mono text-emerald-400">
                    Peer (3:4)
                  </div>
                </div>
              </div>

              {/* Current (Local) User Camera Video Div - 3:4 aspect ratio */}
              <div
                id="desktop-local-video-card"
                className="relative aspect-3/4 h-full max-h-[580px] w-auto max-w-[435px] rounded-2xl bg-zinc-900 border border-zinc-800 shadow-2xl overflow-hidden flex items-center justify-center group"
              >
                <video
                  ref={desktopLocalVideoRef}
                  id="desktop-local-video"
                  autoPlay
                  playsInline
                  muted
                  className={`w-full h-full object-cover -scale-x-100 ${isVideoMuted ? 'hidden' : 'block'}`}
                />

                {/* Local Camera Muted Placeholder */}
                {isVideoMuted && (
                  <div className="absolute inset-0 flex flex-col items-center justify-center bg-zinc-900 text-center p-6 z-10">
                    <div className="w-20 h-20 rounded-full bg-zinc-800 border border-zinc-700 flex items-center justify-center text-zinc-500 mb-3 shadow-lg">
                      <VideoOff className="w-8 h-8 text-zinc-400" />
                    </div>
                    <span className="text-sm font-mono text-zinc-300">Camera Off</span>
                    <span className="text-xs font-mono text-zinc-500 mt-1">Your video is paused</span>
                  </div>
                )}

                {/* Local User Badge */}
                <div className="absolute bottom-3 left-3 right-3 flex items-center justify-between pointer-events-none z-10">
                  <div className="px-2.5 py-1 rounded-lg bg-black/60 backdrop-blur-sm border border-white/10 text-xs font-mono text-zinc-200 flex items-center space-x-1.5">
                    <span className={`w-2 h-2 rounded-full ${isVideoMuted ? 'bg-amber-400' : 'bg-emerald-400'}`} />
                    <span>You (Local)</span>
                  </div>
                  <div className="flex items-center space-x-1">
                    {isAudioMuted && (
                      <span className="p-1 rounded-md bg-rose-950/80 border border-rose-800/80 text-rose-300">
                        <MicOff className="w-3 h-3" />
                      </span>
                    )}
                    <span className="px-2 py-1 rounded-lg bg-black/60 backdrop-blur-sm border border-white/10 text-[10px] font-mono text-zinc-300">
                      Current (3:4)
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* ============================================================== */}
            {/* MOBILE LAYOUT (< md): 1:1 larger div + 1:1 small draggable div */}
            {/* ============================================================== */}
            <div
              ref={mobileStageRef}
              className="md:hidden relative w-full h-full flex flex-col items-center justify-center p-3 min-h-0"
            >
              {/* Upcoming (Remote) User Video - 1:1 Larger Div */}
              <div
                id="mobile-remote-video-card"
                className="relative w-full max-w-[340px] sm:max-w-[380px] aspect-square rounded-2xl bg-zinc-900 border border-zinc-800 shadow-2xl overflow-hidden flex items-center justify-center"
              >
                <video
                  ref={mobileRemoteVideoRef}
                  id="mobile-remote-video"
                  autoPlay
                  playsInline
                  className="w-full h-full object-cover"
                />

                {/* Remote video placeholder */}
                {(!remoteStream || call.state !== 'connected') && (
                  <div className="absolute inset-0 flex flex-col items-center justify-center bg-zinc-900 text-center p-4 z-10">
                    <div className="w-16 h-16 rounded-full bg-zinc-800 border border-zinc-700 flex items-center justify-center text-zinc-400 mb-2 shadow-lg">
                      <User className="w-8 h-8" />
                    </div>
                    <h4 className="text-xs font-medium text-zinc-200 font-mono truncate max-w-[180px] mb-1">
                      {call.peerUid}
                    </h4>
                    <p className="text-[11px] text-amber-400 font-mono animate-pulse">
                      {call.state === 'calling' ? 'Calling peer...' : 'Connecting video stream...'}
                    </p>
                  </div>
                )}

                {/* Remote User Label */}
                <div className="absolute top-2.5 left-2.5 z-10 px-2 py-0.5 rounded-lg bg-black/60 backdrop-blur-xs border border-white/10 text-[11px] font-mono text-zinc-200 flex items-center space-x-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                  <span className="truncate max-w-[130px]">{call.peerUid.slice(0, 10)}...</span>
                </div>
              </div>

              {/* Current (Local) User Camera - 1:1 Small Floating Draggable Div */}
              <motion.div
                id="mobile-local-video-floating"
                drag
                dragConstraints={mobileStageRef}
                dragElastic={0.12}
                dragMomentum={false}
                className="absolute bottom-4 right-4 w-24 h-24 sm:w-28 sm:h-28 aspect-square rounded-xl bg-zinc-900 border-2 border-emerald-500/80 shadow-2xl overflow-hidden z-30 cursor-grab active:cursor-grabbing touch-none select-none"
                title="Drag to reposition preview (Top, Bottom, Left, Right)"
              >
                <video
                  ref={mobileLocalVideoRef}
                  id="mobile-local-video"
                  autoPlay
                  playsInline
                  muted
                  className={`w-full h-full object-cover -scale-x-100 ${isVideoMuted ? 'hidden' : 'block'}`}
                />

                {isVideoMuted && (
                  <div className="w-full h-full flex flex-col items-center justify-center bg-zinc-900 text-zinc-400 text-[10px] font-mono">
                    <VideoOff className="w-4 h-4 mb-0.5" />
                    <span>Off</span>
                  </div>
                )}

                {/* Floating Preview Drag Handle & Badge */}
                <div className="absolute top-1 right-1 p-0.5 rounded bg-black/60 text-zinc-300 pointer-events-none">
                  <GripHorizontal className="w-3 h-3" />
                </div>
                <div className="absolute bottom-1 left-1 px-1.5 py-0.5 rounded bg-black/60 text-[9px] font-mono text-zinc-200 pointer-events-none">
                  You
                </div>
              </motion.div>
            </div>
          </>
        ) : (
          /* Dedicated Audio Call Screen */
          <div className="flex flex-col items-center justify-center text-center p-8 z-10 max-w-sm">
            <div className="relative mb-6">
              <div className="w-28 h-28 rounded-full bg-zinc-900 border-2 border-emerald-500/40 flex items-center justify-center text-zinc-300 shadow-2xl">
                <User className="w-14 h-14 text-emerald-400" />
              </div>
              <div className="absolute -bottom-1 -right-1 w-9 h-9 rounded-full bg-zinc-900 border border-zinc-700 flex items-center justify-center text-emerald-400 shadow-md">
                <Volume2 className="w-4 h-4 animate-pulse" />
              </div>
            </div>

            <h4 className="text-base font-semibold text-zinc-100 font-mono mb-1 truncate max-w-xs">{call.peerUid}</h4>
            <div className="text-xs font-mono text-zinc-400 mb-3">
              {call.state === 'connected' ? (
                <span className="text-emerald-400 font-medium">P2P Audio Active • {formatSeconds(callDuration)}</span>
              ) : (
                <span className="text-amber-400 animate-pulse">Connecting P2P audio stream...</span>
              )}
            </div>

            <div className="flex items-center space-x-1.5 text-xs text-zinc-500 font-mono">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
              <span>Zero-knowledge direct audio stream</span>
            </div>
          </div>
        )}
      </div>

      {/* Call Controls Bar */}
      <footer className="h-20 shrink-0 bg-zinc-900/95 border-t border-zinc-800 flex items-center justify-center space-x-5 z-30 px-4 backdrop-blur-md pb-[env(safe-area-inset-bottom,0px)]">
        {/* Toggle Audio */}
        <button
          id="btn-toggle-audio"
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
