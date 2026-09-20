/**
 * MediaManager
 * Manages local user media devices (camera, microphone) and track states
 */

export class MediaManager {
  private localStream: MediaStream | null = null;

  public async acquireMedia(video = true, audio = true): Promise<MediaStream> {
    if (typeof navigator === 'undefined' || !navigator.mediaDevices) {
      throw new Error('WebRTC MediaDevices API is not supported in this browser');
    }

    // Stop existing tracks if any
    this.stopMedia();

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: video
          ? {
              width: { ideal: 1280 },
              height: { ideal: 720 },
              facingMode: 'user',
            }
          : false,
        audio: audio
          ? {
              echoCancellation: true,
              noiseSuppression: true,
              autoGainControl: true,
            }
          : false,
      });

      this.localStream = stream;
      return stream;
    } catch (err: unknown) {
      const errorName = err instanceof Error ? err.name : '';
      if (errorName === 'NotAllowedError' || errorName === 'PermissionDeniedError') {
        throw new Error('Camera/Microphone permission was denied by the user.');
      } else if (errorName === 'NotFoundError' || errorName === 'DevicesNotFoundError') {
        throw new Error('No camera or microphone device found on this system.');
      }
      throw new Error(err instanceof Error ? err.message : 'Failed to access camera/microphone');
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
  }
}

export const mediaManager = new MediaManager();
