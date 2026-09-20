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
} from 'lucide-react';
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
  const localVideoRef = useRef<HTMLVideoElement>(null);
  const remoteVideoRef = useRef<HTMLVideoElement>(null);
  const [callDuration, setCallDuration] = useState(0);

  // Attach streams to video elements
  useEffect(() => {
    if (call?.localStream && localVideoRef.current) {
      localVideoRef.current.srcObject = call.localStream;
    }
  }, [call?.localStream]);

  useEffect(() => {
    if (call?.remoteStream && remoteVideoRef.current) {
      remoteVideoRef.current.srcObject = call.remoteStream;
    }
  }, [call?.remoteStream]);

  // Duration timer
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
    <div id="modal-active-call" className="fixed inset-0 z-50 bg-zinc-950 flex flex-col select-none">
      {/* Top Overlay Bar */}
      <div className="absolute top-0 inset-x-0 p-4 z-20 flex items-center justify-between bg-linear-to-b from-black/80 to-transparent">
        <div className="flex items-center space-x-2 text-white">
          <div className="w-8 h-8 rounded-full bg-emerald-600/30 border border-emerald-500/50 flex items-center justify-center text-emerald-400">
            <Lock className="w-4 h-4" />
          </div>
          <div>
            <div className="font-mono text-xs font-semibold text-zinc-100 flex items-center space-x-1.5">
              <span>{call.peerUid.slice(0, 16)}...</span>
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
            </div>
            <div className="text-[11px] font-mono text-zinc-400">
              {call.state === 'connected' ? (
                <span className="text-emerald-400 font-medium">P2P Encrypted • {formatSeconds(callDuration)}</span>
              ) : (
                <span className="text-amber-400 animate-pulse">Establishing WebRTC connection...</span>
              )}
            </div>
          </div>
        </div>

        <div className="text-xs font-mono px-2.5 py-1 bg-zinc-900/80 border border-zinc-800 rounded-full text-zinc-400 flex items-center space-x-1.5">
          <Radio className="w-3 h-3 text-emerald-400" />
          <span>{isVideo ? 'P2P Video' : 'P2P Audio'}</span>
        </div>
      </div>

      {/* Main Video Stage */}
      <div className="flex-1 relative flex items-center justify-center bg-zinc-950 overflow-hidden">
        {/* Remote Video Stream */}
        {call.remoteStream && !call.isVideoMuted && isVideo ? (
          <video
            ref={remoteVideoRef}
            id="remote-video"
            autoPlay
            playsInline
            className="w-full h-full object-cover"
          />
        ) : (
          <div className="flex flex-col items-center justify-center text-center p-8">
            <div className="w-24 h-24 rounded-full bg-zinc-900 border border-zinc-800 flex items-center justify-center text-zinc-500 mb-4 shadow-xl">
              <User className="w-12 h-12" />
            </div>
            <h4 className="text-base font-medium text-zinc-200 font-mono mb-1">{call.peerUid}</h4>
            <p className="text-xs text-zinc-400 font-mono">
              {call.state === 'connected' ? 'P2P Call Active (Audio Stream Only)' : 'Connecting peer media streams...'}
            </p>
          </div>
        )}

        {/* Local Video Preview (Picture-in-Picture) */}
        {isVideo && (
          <div
            id="local-video-pip"
            className="absolute bottom-24 right-4 w-36 sm:w-48 aspect-video rounded-xl bg-zinc-900 border border-zinc-700/80 shadow-2xl overflow-hidden z-20"
          >
            {call.localStream && !call.isVideoMuted ? (
              <video
                ref={localVideoRef}
                id="local-video"
                autoPlay
                playsInline
                muted // Mute local audio feedback!
                className="w-full h-full object-cover mirror-mode"
              />
            ) : (
              <div className="w-full h-full flex flex-col items-center justify-center text-zinc-500 text-xs">
                <VideoOff className="w-5 h-5 mb-1" />
                <span>Camera Off</span>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Call Controls Bar */}
      <div className="h-20 bg-zinc-900/90 border-t border-zinc-800 flex items-center justify-center space-x-4 z-20 px-4">
        {/* Toggle Audio */}
        <button
          id="btn-toggle-audio"
          onClick={onToggleAudio}
          className={`p-3.5 rounded-full transition-colors ${
            call.isAudioMuted
              ? 'bg-rose-600/20 border border-rose-500/40 text-rose-400 hover:bg-rose-600/30'
              : 'bg-zinc-800 border border-zinc-700 text-zinc-200 hover:bg-zinc-700'
          }`}
          title={call.isAudioMuted ? 'Unmute Microphone' : 'Mute Microphone'}
        >
          {call.isAudioMuted ? <MicOff className="w-5 h-5" /> : <Mic className="w-5 h-5" />}
        </button>

        {/* Toggle Video */}
        {isVideo && (
          <button
            id="btn-toggle-video"
            onClick={onToggleVideo}
            className={`p-3.5 rounded-full transition-colors ${
              call.isVideoMuted
                ? 'bg-rose-600/20 border border-rose-500/40 text-rose-400 hover:bg-rose-600/30'
                : 'bg-zinc-800 border border-zinc-700 text-zinc-200 hover:bg-zinc-700'
            }`}
            title={call.isVideoMuted ? 'Turn Camera On' : 'Turn Camera Off'}
          >
            {call.isVideoMuted ? <VideoOff className="w-5 h-5" /> : <Video className="w-5 h-5" />}
          </button>
        )}

        {/* End Call */}
        <button
          id="btn-end-call"
          onClick={onEndCall}
          className="p-3.5 rounded-full bg-rose-600 hover:bg-rose-500 active:bg-rose-700 text-white transition-colors shadow-lg"
          title="End Call"
        >
          <PhoneOff className="w-5 h-5" />
        </button>
      </div>
    </div>
  );
};
