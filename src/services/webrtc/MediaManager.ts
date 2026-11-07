/**
 * MediaManager
 * Manages local user media devices (camera, microphone) and track states
 * Provides high-compatibility acquisition with fallback support.
 */

export interface MediaPermissionStatus {
  camera: PermissionState | 'unsupported';
  microphone: PermissionState | 'unsupported';
  isSecure: boolean;
  canAccessMediaDevices: boolean;
}

export class MediaManager {
  private localStream: MediaStream | null = null;
  private syntheticAudioCtx: AudioContext | null = null;

  /**
   * Check current browser media permissions and security context
   */
  public async checkPermissions(): Promise<MediaPermissionStatus> {
    const isClient = typeof window !== 'undefined';
    const isSecure = isClient ? (window.isSecureContext ?? false) : false;
    const canAccessMediaDevices = isClient && !!navigator.mediaDevices && !!navigator.mediaDevices.getUserMedia;

    let camera: PermissionState | 'unsupported' = 'unsupported';
    let microphone: PermissionState | 'unsupported' = 'unsupported';

    if (isClient && navigator.permissions && navigator.permissions.query) {
      try {
        const camQuery = await navigator.permissions.query({ name: 'camera' as PermissionName });
        camera = camQuery.state;
      } catch {
        camera = 'unsupported';
      }

      try {
        const micQuery = await navigator.permissions.query({ name: 'microphone' as PermissionName });
        microphone = micQuery.state;
      } catch {
        microphone = 'unsupported';
      }
    }

    return {
      camera,
      microphone,
      isSecure,
      canAccessMediaDevices,
    };
  }

  /**
   * Proactively request media permissions by acquiring and immediately releasing a brief test stream.
   * This triggers the browser's native permission request prompt on any domain or localhost.
   */
  public async requestMediaPermissions(video = true, audio = true): Promise<boolean> {
    if (typeof navigator === 'undefined' || !navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      return false;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: video,
        audio: audio,
      });
      // Immediately stop all tracks from the test probe so camera/mic lights turn off
      stream.getTracks().forEach((track) => {
        try { track.stop(); } catch {}
      });
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Acquire local camera & microphone with optimal audio settings and resilient cross-browser fallbacks
   */
  public async acquireMedia(video = true, audio = true): Promise<MediaStream> {
    if (typeof navigator === 'undefined' || !navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      const isSecure = typeof window !== 'undefined' ? window.isSecureContext : false;
      if (!isSecure) {
        throw new Error('Camera and microphone access requires a secure context (HTTPS or localhost). Please access via HTTPS or use port forwarding.');
      }
      throw new Error('WebRTC MediaDevices API is not supported in this browser');
    }

    this.stopMedia();

    // High quality WebRTC voice calling constraints
    const audioConstraints: MediaTrackConstraints | boolean = audio
      ? {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        }
      : false;

    const videoConstraints: MediaTrackConstraints | boolean = video
      ? {
          width: { ideal: 1280 },
          height: { ideal: 720 },
          facingMode: 'user',
        }
      : false;

    try {
      // 1. Try with full optimal constraints
      const stream = await navigator.mediaDevices.getUserMedia({
        video: videoConstraints,
        audio: audioConstraints,
      });

      // Ensure all acquired audio tracks are unmuted by default
      stream.getAudioTracks().forEach((track) => {
        track.enabled = true;
      });

      this.localStream = stream;
      return stream;
    } catch (err: unknown) {
      const errorName = err instanceof Error ? err.name : '';

      // 2. Resilient fallback: Try standard boolean constraints if advanced constraints were rejected
      if (errorName !== 'NotAllowedError' && errorName !== 'PermissionDeniedError') {
        try {
          const fallbackStream = await navigator.mediaDevices.getUserMedia({
            video: video ? true : false,
            audio: audio ? true : false,
          });
          fallbackStream.getAudioTracks().forEach((track) => {
            track.enabled = true;
          });
          this.localStream = fallbackStream;
          return fallbackStream;
        } catch {
          // If video+audio failed, try audio only if video device was unavailable
          if (video && audio) {
            try {
              const audioOnlyStream = await navigator.mediaDevices.getUserMedia({
                video: false,
                audio: true,
              });
              audioOnlyStream.getAudioTracks().forEach((track) => {
                track.enabled = true;
              });
              this.localStream = audioOnlyStream;
              return audioOnlyStream;
            } catch {
              // Continue to synthetic fallback
            }
          }
        }
      }

      // If user denied permission explicitly, surface clear notice with guidance
      if (errorName === 'NotAllowedError' || errorName === 'PermissionDeniedError') {
        throw new Error('Camera/Microphone permission was denied by the user. Please check your browser address bar and grant media permissions.');
      }

      // If no physical camera/microphone device found, create synthetic media so call can connect
      if (errorName === 'NotFoundError' || errorName === 'DevicesNotFoundError') {
        const synthetic = this.createSyntheticMediaStream(video, audio);
        if (synthetic) {
          this.localStream = synthetic;
          return synthetic;
        }
      }

      throw new Error(err instanceof Error ? err.message : 'Failed to access camera/microphone');
    }
  }

  private createSyntheticMediaStream(video: boolean, audio: boolean): MediaStream | null {
    if (typeof window === 'undefined') return null;
    try {
      const stream = new MediaStream();

      if (video) {
        const canvas = document.createElement('canvas');
        canvas.width = 640;
        canvas.height = 480;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.fillStyle = '#09090b';
          ctx.fillRect(0, 0, 640, 480);
          ctx.fillStyle = '#10b981';
          ctx.font = '22px monospace';
          ctx.fillText('P2P Encrypted Stream Active', 40, 240);
        }
        const canvasStream = canvas.captureStream ? canvas.captureStream(15) : null;
        if (canvasStream) {
          canvasStream.getVideoTracks().forEach((t) => stream.addTrack(t));
        }
      }

      if (audio) {
        const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
        if (AudioCtx) {
          this.syntheticAudioCtx = new AudioCtx();
          const osc = this.syntheticAudioCtx.createOscillator();
          const gain = this.syntheticAudioCtx.createGain();
          gain.gain.value = 0.001; // Silent tone
          const dst = this.syntheticAudioCtx.createMediaStreamDestination();
          osc.connect(gain);
          gain.connect(dst);
          osc.start();
          dst.stream.getAudioTracks().forEach((t) => stream.addTrack(t));
        }
      }

      return stream.getTracks().length > 0 ? stream : null;
    } catch {
      return null;
    }
  }

  public getLocalStream(): MediaStream | null {
    return this.localStream;
  }

  public toggleAudio(enabled: boolean) {
    if (!this.localStream) return;
    this.localStream.getAudioTracks().forEach((track) => {
      track.enabled = enabled;
    });
  }

  public toggleVideo(enabled: boolean) {
    if (!this.localStream) return;
    this.localStream.getVideoTracks().forEach((track) => {
      track.enabled = enabled;
    });
  }

  public stopMedia() {
    if (this.localStream) {
      this.localStream.getTracks().forEach((track) => {
        try {
          track.stop();
        } catch {
          // Ignored
        }
      });
      this.localStream = null;
    }
    if (this.syntheticAudioCtx) {
      try {
        this.syntheticAudioCtx.close();
      } catch {
        // Ignored
      }
      this.syntheticAudioCtx = null;
    }
  }
}

export const mediaManager = new MediaManager();
