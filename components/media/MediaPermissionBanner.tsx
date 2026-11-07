'use client';

import React, { useEffect, useState, useCallback, useRef } from 'react';
import {
  Camera,
  Mic,
  ShieldAlert,
  CheckCircle2,
  AlertTriangle,
  X,
  Volume2,
  RefreshCw,
  ExternalLink,
} from 'lucide-react';
import { mediaManager, MediaPermissionStatus } from '@/src/services/webrtc/MediaManager';

export const MediaPermissionBanner: React.FC = () => {
  const [permissionStatus, setPermissionStatus] = useState<MediaPermissionStatus | null>(null);
  const [isDismissed, setIsDismissed] = useState(false);
  const [isRequesting, setIsRequesting] = useState(false);
  const [requestError, setRequestError] = useState<string | null>(null);
  const [showTestModal, setShowTestModal] = useState(false);
  const [testStream, setTestStream] = useState<MediaStream | null>(null);
  const [micVolume, setMicVolume] = useState<number>(0);
  const audioContextRef = useRef<AudioContext | null>(null);
  const animFrameRef = useRef<number | null>(null);
  const testVideoRef = useRef<HTMLVideoElement | null>(null);

  const refreshStatus = useCallback(async () => {
    try {
      const status = await mediaManager.checkPermissions();
      setPermissionStatus(status);
    } catch {
      // Ignore
    }
  }, []);

  useEffect(() => {
    let active = true;
    mediaManager.checkPermissions().then((status) => {
      if (active) setPermissionStatus(status);
    }).catch(() => {});

    // Listen for permission changes if supported
    if (typeof navigator !== 'undefined' && navigator.permissions && navigator.permissions.query) {
      navigator.permissions.query({ name: 'camera' as PermissionName }).then((p) => {
        p.onchange = () => {
          mediaManager.checkPermissions().then((st) => {
            if (active) setPermissionStatus(st);
          }).catch(() => {});
        };
      }).catch(() => {});

      navigator.permissions.query({ name: 'microphone' as PermissionName }).then((p) => {
        p.onchange = () => {
          mediaManager.checkPermissions().then((st) => {
            if (active) setPermissionStatus(st);
          }).catch(() => {});
        };
      }).catch(() => {});
    }

    return () => {
      active = false;
    };
  }, []);

  const handleRequestPermissions = async () => {
    setIsRequesting(true);
    setRequestError(null);
    try {
      const granted = await mediaManager.requestMediaPermissions(true, true);
      if (granted) {
        await refreshStatus();
        setIsDismissed(false);
      } else {
        setRequestError('Permission was not granted. Please check your browser address bar.');
      }
    } catch (err: unknown) {
      setRequestError(err instanceof Error ? err.message : 'Failed to request permissions');
    } finally {
      setIsRequesting(false);
      await refreshStatus();
    }
  };

  const startMediaTest = async () => {
    setShowTestModal(true);
    setRequestError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: 640, height: 480, facingMode: 'user' },
        audio: { echoCancellation: true, noiseSuppression: true },
      });
      setTestStream(stream);

      if (testVideoRef.current) {
        testVideoRef.current.srcObject = stream;
        testVideoRef.current.play().catch(() => {});
      }

      // Audio volume analyzer
      const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (AudioCtx) {
        const audioCtx = new AudioCtx();
        audioContextRef.current = audioCtx;
        const source = audioCtx.createMediaStreamSource(stream);
        const analyzer = audioCtx.createAnalyser();
        analyzer.fftSize = 256;
        source.connect(analyzer);

        const dataArray = new Uint8Array(analyzer.frequencyBinCount);
        const checkVolume = () => {
          analyzer.getByteFrequencyData(dataArray);
          let sum = 0;
          for (let i = 0; i < dataArray.length; i++) {
            sum += dataArray[i];
          }
          const avg = sum / dataArray.length;
          setMicVolume(Math.min(100, Math.round((avg / 128) * 100)));
          animFrameRef.current = requestAnimationFrame(checkVolume);
        };
        checkVolume();
      }
    } catch (err: unknown) {
      setRequestError(err instanceof Error ? err.message : 'Could not access devices for testing');
    }
  };

  const stopMediaTest = () => {
    if (testStream) {
      testStream.getTracks().forEach((t) => t.stop());
      setTestStream(null);
    }
    if (animFrameRef.current) {
      cancelAnimationFrame(animFrameRef.current);
      animFrameRef.current = null;
    }
    if (audioContextRef.current) {
      audioContextRef.current.close().catch(() => {});
      audioContextRef.current = null;
    }
    setMicVolume(0);
    setShowTestModal(false);
  };

  if (!permissionStatus) return null;

  const isSecure = permissionStatus.isSecure;
  const isDenied = permissionStatus.camera === 'denied' || permissionStatus.microphone === 'denied';
  const isGranted = permissionStatus.camera === 'granted' && permissionStatus.microphone === 'granted';

  // If already granted and not dismissed, show nothing or subtle indicator
  if (isGranted && !showTestModal) {
    return null;
  }

  // If dismissed by user and not insecure
  if (isDismissed && !isDenied && isSecure && !showTestModal) {
    return null;
  }

  return (
    <>
      {/* Top Banner Alert */}
      <div className="w-full bg-zinc-900 border-b border-zinc-800 px-4 py-2.5 sm:py-3 transition-all">
        <div className="max-w-6xl mx-auto flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs font-mono">
          <div className="flex items-start sm:items-center space-x-2.5 min-w-0">
            {!isSecure ? (
              <div className="p-1.5 rounded-lg bg-amber-500/10 text-amber-400 shrink-0 mt-0.5 sm:mt-0">
                <ShieldAlert className="w-4 h-4" />
              </div>
            ) : isDenied ? (
              <div className="p-1.5 rounded-lg bg-rose-500/10 text-rose-400 shrink-0 mt-0.5 sm:mt-0">
                <AlertTriangle className="w-4 h-4" />
              </div>
            ) : (
              <div className="p-1.5 rounded-lg bg-indigo-500/10 text-indigo-400 shrink-0 mt-0.5 sm:mt-0">
                <Mic className="w-4 h-4" />
              </div>
            )}

            <div className="min-w-0">
              {!isSecure ? (
                <div>
                  <span className="font-semibold text-amber-400">Media Access Restricted (Insecure Context): </span>
                  <span className="text-zinc-300">
                    Browsers require HTTPS or localhost for microphone and camera. Use HTTPS or VS Code Port Forwarding.
                  </span>
                </div>
              ) : isDenied ? (
                <div>
                  <span className="font-semibold text-rose-400">Camera / Microphone Blocked in Browser: </span>
                  <span className="text-zinc-300">
                    Click the lock or site settings icon in your URL address bar, allow Camera & Microphone, and refresh.
                  </span>
                </div>
              ) : (
                <div>
                  <span className="font-semibold text-zinc-100">Camera & Microphone Access Required: </span>
                  <span className="text-zinc-400">
                    Grant media permissions so you can place and receive encrypted voice and video calls seamlessly.
                  </span>
                </div>
              )}

              {requestError && (
                <div className="text-rose-400 text-[11px] mt-1 font-sans">{requestError}</div>
              )}
            </div>
          </div>

          <div className="flex items-center space-x-2 shrink-0 self-end sm:self-center">
            {isSecure && !isDenied && (
              <button
                type="button"
                onClick={handleRequestPermissions}
                disabled={isRequesting}
                className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 active:bg-emerald-700 text-white font-medium transition-colors flex items-center space-x-1.5 shadow-sm cursor-pointer disabled:opacity-50 text-xs"
              >
                {isRequesting ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    <span>Requesting...</span>
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    <span>Grant Media Access</span>
                  </>
                )}
              </button>
            )}

            <button
              type="button"
              onClick={startMediaTest}
              className="px-2.5 py-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-300 hover:text-white transition-colors flex items-center space-x-1 border border-zinc-700 text-xs cursor-pointer"
              title="Test microphone and camera"
            >
              <Camera className="w-3.5 h-3.5" />
              <span>Test Devices</span>
            </button>

            <button
              type="button"
              onClick={() => setIsDismissed(true)}
              className="p-1 rounded-lg text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800 transition-colors cursor-pointer"
              title="Dismiss banner"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Device Test Modal */}
      {showTestModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-2xl bg-zinc-900 border border-zinc-800 shadow-2xl p-5 select-none font-mono">
            <div className="flex items-center justify-between pb-3 border-b border-zinc-800 mb-4">
              <div className="flex items-center space-x-2">
                <Volume2 className="w-5 h-5 text-emerald-400" />
                <h3 className="text-sm font-semibold text-zinc-100">Media Device Diagnostic</h3>
              </div>
              <button
                type="button"
                onClick={stopMediaTest}
                className="p-1.5 rounded-lg text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800 transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Video Preview */}
            <div className="relative aspect-video w-full rounded-xl bg-zinc-950 border border-zinc-800 overflow-hidden mb-4 flex items-center justify-center">
              <video
                ref={(el) => {
                  testVideoRef.current = el;
                  if (el && testStream && el.srcObject !== testStream) {
                    el.srcObject = testStream;
                    el.play().catch(() => {});
                  }
                }}
                autoPlay
                playsInline
                muted
                className="w-full h-full object-cover -scale-x-100"
              />
              {!testStream && (
                <div className="flex flex-col items-center justify-center text-zinc-500 text-xs">
                  <Camera className="w-8 h-8 mb-1 text-zinc-600" />
                  <span>Connecting camera preview...</span>
                </div>
              )}
            </div>

            {/* Live Microphone Volume Meter */}
            <div className="space-y-2 mb-4 bg-zinc-950/60 p-3 rounded-xl border border-zinc-800">
              <div className="flex items-center justify-between text-xs text-zinc-300">
                <div className="flex items-center space-x-1.5">
                  <Mic className="w-3.5 h-3.5 text-emerald-400" />
                  <span>Microphone Audio Level</span>
                </div>
                <span className="text-emerald-400 font-bold">{micVolume}%</span>
              </div>
              <div className="w-full h-2 rounded-full bg-zinc-800 overflow-hidden">
                <div
                  className="h-full bg-emerald-500 transition-all duration-75"
                  style={{ width: `${micVolume}%` }}
                />
              </div>
              <p className="text-[11px] text-zinc-500 font-sans">
                Speak into your microphone to verify live audio input detection.
              </p>
            </div>

            <div className="flex justify-end space-x-2">
              <button
                type="button"
                onClick={stopMediaTest}
                className="px-4 py-2 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-200 text-xs font-semibold cursor-pointer transition-colors"
              >
                Close Diagnostic
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
