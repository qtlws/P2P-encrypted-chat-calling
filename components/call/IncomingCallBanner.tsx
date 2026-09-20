'use client';

import React from 'react';
import { Phone, PhoneOff, Video, User } from 'lucide-react';
import { ActiveCall } from '@/src/types/webrtc';

interface IncomingCallBannerProps {
  call: ActiveCall | null;
  onAccept: () => void;
  onReject: () => void;
}

export const IncomingCallBanner: React.FC<IncomingCallBannerProps> = ({
  call,
  onAccept,
  onReject,
}) => {
  if (!call || call.state !== 'incoming') return null;

  return (
    <div
      id="banner-incoming-call"
      className="fixed top-5 inset-x-4 max-w-md mx-auto z-50 bg-zinc-900 border border-emerald-500/40 rounded-2xl p-4 shadow-2xl flex items-center justify-between animate-bounce duration-1000"
    >
      <div className="flex items-center space-x-3 min-w-0 pr-2">
        <div className="w-10 h-10 rounded-full bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center text-emerald-400 flex-shrink-0 animate-pulse">
          {call.callType === 'video' ? <Video className="w-5 h-5" /> : <Phone className="w-5 h-5" />}
        </div>
        <div className="min-w-0">
          <div className="text-xs font-semibold text-zinc-100 flex items-center space-x-1.5">
            <span>Incoming {call.callType === 'video' ? 'Video' : 'Audio'} Call</span>
          </div>
          <p className="text-[11px] font-mono text-zinc-400 truncate">{call.peerUid}</p>
        </div>
      </div>

      <div className="flex items-center space-x-2 flex-shrink-0">
        <button
          id="btn-accept-call"
          onClick={onAccept}
          className="p-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 active:bg-emerald-700 text-white shadow-md transition-colors"
          title="Accept Call"
        >
          <Phone className="w-4 h-4" />
        </button>
        <button
          id="btn-reject-call"
          onClick={onReject}
          className="p-2.5 rounded-xl bg-rose-600 hover:bg-rose-500 active:bg-rose-700 text-white shadow-md transition-colors"
          title="Decline Call"
        >
          <PhoneOff className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
};
