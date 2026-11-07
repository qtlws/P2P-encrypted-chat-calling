'use client';

import React, { useState, useEffect } from 'react';
import { Shield, Radio, Activity, Cpu, CheckCircle2 } from 'lucide-react';

interface FuturisticLoadingScreenProps {
  onComplete: () => void;
}

const STEPS = [
  { label: 'Initializing WebCrypto Entropy & CSPRNG Subsystems', status: 'OK' },
  { label: 'Querying Global Decentralized Signaling Relays', status: 'CONNECTED (4 NODES)' },
  { label: 'Negotiating Zero-Knowledge STUN/ICE Mesh Routing', status: 'ESTABLISHED' },
  { label: 'Sovereign E2EE Peer-to-Peer Environment Active', status: 'READY' },
];

export const FuturisticLoadingScreen: React.FC<FuturisticLoadingScreenProps> = ({ onComplete }) => {
  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const [progress, setProgress] = useState(15);
  const [isDone, setIsDone] = useState(false);

  useEffect(() => {
    const timer1 = setTimeout(() => {
      setCurrentStepIndex(1);
      setProgress(42);
    }, 380);

    const timer2 = setTimeout(() => {
      setCurrentStepIndex(2);
      setProgress(76);
    }, 780);

    const timer3 = setTimeout(() => {
      setCurrentStepIndex(3);
      setProgress(100);
    }, 1200);

    const timer4 = setTimeout(() => {
      setIsDone(true);
      setTimeout(onComplete, 250);
    }, 1500);

    return () => {
      clearTimeout(timer1);
      clearTimeout(timer2);
      clearTimeout(timer3);
      clearTimeout(timer4);
    };
  }, [onComplete]);

  return (
    <div
      id="futuristic-loading-screen"
      className={`fixed inset-0 z-50 bg-zinc-950 text-zinc-100 flex flex-col items-center justify-center p-6 select-none transition-opacity duration-300 font-mono ${
        isDone ? 'opacity-0 pointer-events-none' : 'opacity-100'
      }`}
    >
      {/* Background Cyber Grid */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-emerald-950/20 via-zinc-950 to-zinc-950 pointer-events-none" />
      <div className="absolute inset-0 bg-[linear-gradient(to_right,#18181b15_1px,transparent_1px),linear-gradient(to_bottom,#18181b15_1px,transparent_1px)] bg-[size:32px_32px] pointer-events-none" />

      {/* Futuristic Concentric Radar Ring Assembly */}
      <div className="relative mb-8 flex items-center justify-center">
        {/* Outer Rotating Radar Ring */}
        <div className="w-28 h-28 sm:w-32 sm:h-32 rounded-full border border-emerald-500/20 border-t-emerald-400 border-r-emerald-500/40 animate-spin [animation-duration:3s]" />
        
        {/* Middle Counter-Rotating Ring */}
        <div className="absolute w-20 h-20 sm:w-24 sm:h-24 rounded-full border border-zinc-800 border-b-cyan-400 border-l-cyan-500/40 animate-spin [animation-duration:2s] [animation-direction:reverse]" />

        {/* Center Glowing Shield Core */}
        <div className="absolute w-14 h-14 sm:w-16 sm:h-16 rounded-2xl bg-zinc-900 border border-emerald-500/40 shadow-[0_0_25px_rgba(16,185,129,0.25)] flex items-center justify-center text-emerald-400 animate-pulse">
          <Shield className="w-7 h-7 sm:w-8 sm:h-8" />
        </div>

        {/* Ambient Signal Pulse Indicator */}
        <span className="absolute -top-1 -right-1 flex h-3 w-3">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
          <span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-500" />
        </span>
      </div>

      {/* Network Header */}
      <div className="text-center z-10 max-w-md w-full mb-6">
        <div className="inline-flex items-center space-x-1.5 px-3 py-1 rounded-full bg-emerald-950/60 border border-emerald-800/60 text-emerald-300 text-[10px] tracking-widest uppercase mb-2">
          <Radio className="w-3 h-3 text-emerald-400 animate-pulse" />
          <span>GLOBAL RELAY MESH &bull; EPHEMERAL TELEMETRY</span>
        </div>
        <h1 className="text-base sm:text-lg font-bold text-zinc-100 tracking-tight">
          CONNECTING TO SECURE RELAYS
        </h1>
        <p className="text-xs text-zinc-400 mt-1">
          Establishing anonymous zero-knowledge peer-to-peer transport...
        </p>
      </div>

      {/* Telemetry Progress Bar */}
      <div className="w-full max-w-sm z-10 space-y-2 mb-6">
        <div className="flex justify-between items-center text-[10px] text-zinc-400">
          <span className="flex items-center space-x-1">
            <Activity className="w-3 h-3 text-emerald-400" />
            <span>RELAY SYNCHRONIZATION</span>
          </span>
          <span className="text-emerald-400 font-bold">{progress}%</span>
        </div>
        <div className="w-full h-1.5 bg-zinc-900 rounded-full overflow-hidden border border-zinc-800">
          <div
            className="h-full bg-gradient-to-r from-emerald-500 via-teal-400 to-cyan-400 rounded-full transition-all duration-300 shadow-[0_0_12px_rgba(52,211,153,0.5)]"
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>

      {/* Real-time Subsystem Status Feed */}
      <div className="w-full max-w-sm z-10 p-3 rounded-xl bg-zinc-900/80 border border-zinc-800/80 backdrop-blur-xs space-y-2">
        <div className="text-[10px] text-zinc-500 uppercase tracking-wider font-semibold border-b border-zinc-800/60 pb-1 flex items-center justify-between">
          <span>Boot Subsystems Log</span>
          <Cpu className="w-3 h-3 text-zinc-600" />
        </div>
        {STEPS.map((step, idx) => {
          const isCurrent = idx === currentStepIndex;
          const isPassed = idx < currentStepIndex;
          return (
            <div
              key={idx}
              className={`flex items-center justify-between text-[11px] transition-colors ${
                isPassed
                  ? 'text-zinc-300'
                  : isCurrent
                  ? 'text-emerald-300 font-semibold'
                  : 'text-zinc-600'
              }`}
            >
              <div className="flex items-center space-x-1.5 min-w-0 pr-2">
                {isPassed ? (
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                ) : isCurrent ? (
                  <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping shrink-0" />
                ) : (
                  <span className="w-1.5 h-1.5 rounded-full bg-zinc-700 shrink-0" />
                )}
                <span className="truncate">{step.label}</span>
              </div>
              <span
                className={`text-[9px] shrink-0 font-bold px-1.5 py-0.5 rounded ${
                  isPassed
                    ? 'bg-zinc-800 text-emerald-400'
                    : isCurrent
                    ? 'bg-emerald-950 text-emerald-300 animate-pulse'
                    : 'text-zinc-700'
                }`}
              >
                {step.status}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
};
