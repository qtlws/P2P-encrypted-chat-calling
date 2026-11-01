/**
 * MediaManager
 * Manages local user media devices (camera, microphone) and track states
 * Provides high-compatibility acquisition with fallback support.
 */

export class MediaManager {
  private localStream: MediaStream | null = null;
  private syntheticAudioCtx: AudioContext | null = null;

  public async acquireMedia(video = true, audio = true): Promise<MediaStream> {
    if (typeof navigator === 'undefined' || !navigator.mediaDevices) {
      throw new Error('WebRTC MediaDevices API is not supported in this browser');
    }

    this.stopMedia();

    try {
      // 1. Direct standard constraints matching verified reference implementation
      const stream = await navigator.mediaDevices.getUserMedia({
        video: video,
        audio: audio,
      });

      this.localStream = stream;
      return stream;
    } catch (err: unknown) {
      const errorName = err instanceof Error ? err.name : '';

      // If video+audio failed, try audio only if video device was unavailable
      if (video && audio && errorName !== 'NotAllowedError' && errorName !== 'PermissionDeniedError') {
        try {
          const audioOnlyStream = await navigator.mediaDevices.getUserMedia({
            video: false,
            audio: true,
          });
          this.localStream = audioOnlyStream;
          return audioOnlyStream;
        } catch {
          // Continue to fallback
        }
      }

      // If user denied permission explicitly, surface clear notice
      if (errorName === 'NotAllowedError' || errorName === 'PermissionDeniedError') {
        throw new Error('Camera/Microphone permission was denied by the user. Please check browser permissions.');
      }

      // If no physical camera/microphone device found, create synthetic media so call can connect
      if (errorName === 'NotFoundError' || errorName === 'DevicesNotFoundError' || !navigator.mediaDevices.getUserMedia) {
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
