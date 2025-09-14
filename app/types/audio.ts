export interface AudioRecording {
  id: string;
  name: string;
  blob: Blob;
  duration: number;
  createdAt: Date;
  mimeType: string;
}

export interface RecordingState {
  isRecording: boolean;
  isPaused: boolean;
  recordingTime: number;
  mediaRecorder: MediaRecorder | null;
  audioStream: MediaStream | null;
}

export interface PlaybackState {
  isPlaying: boolean;
  currentTime: number;
  duration: number;
  audio: HTMLAudioElement | null;
}