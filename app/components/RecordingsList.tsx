'use client';

import { useState, useEffect, useRef } from 'react';
import { track } from '@vercel/analytics';
import { AudioRecording, PlaybackState } from '../types/audio';
import { audioStorage } from '../lib/audioStorage';

interface RecordingsListProps {
  recordings: AudioRecording[];
  onRecordingsChange: () => void;
}

export default function RecordingsList({ recordings, onRecordingsChange }: RecordingsListProps) {
  const [playbackStates, setPlaybackStates] = useState<{ [id: string]: PlaybackState }>({});
  const audioRefs = useRef<{ [id: string]: HTMLAudioElement }>({});

  useEffect(() => {
    // Initialize playback states for all recordings
    const initialStates: { [id: string]: PlaybackState } = {};
    recordings.forEach(recording => {
      initialStates[recording.id] = {
        isPlaying: false,
        currentTime: 0,
        duration: recording.duration,
        audio: null,
      };
    });
    setPlaybackStates(initialStates);

    // Cleanup audio elements on unmount
    return () => {
      Object.values(audioRefs.current).forEach(audio => {
        if (audio) {
          audio.pause();
          audio.src = '';
        }
      });
    };
  }, [recordings]);

  const createAudioElement = (recording: AudioRecording): HTMLAudioElement => {
    if (audioRefs.current[recording.id]) {
      return audioRefs.current[recording.id];
    }

    const audio = new Audio();
    const audioUrl = URL.createObjectURL(recording.blob);
    audio.src = audioUrl;
    audio.preload = 'metadata';

    audio.addEventListener('loadedmetadata', () => {
      setPlaybackStates(prev => ({
        ...prev,
        [recording.id]: {
          ...prev[recording.id],
          duration: audio.duration,
        },
      }));
    });

    audio.addEventListener('timeupdate', () => {
      setPlaybackStates(prev => ({
        ...prev,
        [recording.id]: {
          ...prev[recording.id],
          currentTime: audio.currentTime,
        },
      }));
    });

    audio.addEventListener('ended', () => {
      setPlaybackStates(prev => ({
        ...prev,
        [recording.id]: {
          ...prev[recording.id],
          isPlaying: false,
          currentTime: 0,
        },
      }));
    });

    audioRefs.current[recording.id] = audio;
    return audio;
  };

  const playRecording = async (recording: AudioRecording) => {
    // Stop all other playing audio
    Object.entries(playbackStates).forEach(([id, state]) => {
      if (state.isPlaying && id !== recording.id) {
        pauseRecording(id);
      }
    });

    const audio = createAudioElement(recording);

    try {
      await audio.play();
      setPlaybackStates(prev => ({
        ...prev,
        [recording.id]: {
          ...prev[recording.id],
          isPlaying: true,
          audio,
        },
      }));

      // Track playback start
      track('playback_started', {
        recording_duration: recording.duration,
        recording_age_days: Math.floor((Date.now() - recording.createdAt.getTime()) / (1000 * 60 * 60 * 24))
      });
    } catch (error) {
      console.error('Error playing audio:', error);

      // Track playback error
      track('playback_error');
    }
  };

  const pauseRecording = (recordingId: string) => {
    const audio = audioRefs.current[recordingId];
    if (audio) {
      const currentTime = audio.currentTime;
      audio.pause();
      setPlaybackStates(prev => ({
        ...prev,
        [recordingId]: {
          ...prev[recordingId],
          isPlaying: false,
        },
      }));

      // Track playback pause
      track('playback_paused', {
        playback_time: Math.round(currentTime)
      });
    }
  };

  const seekTo = (recordingId: string, time: number) => {
    const audio = audioRefs.current[recordingId];
    if (audio) {
      const oldTime = audio.currentTime;
      audio.currentTime = time;
      setPlaybackStates(prev => ({
        ...prev,
        [recordingId]: {
          ...prev[recordingId],
          currentTime: time,
        },
      }));

      // Track seek action
      track('playback_seek', {
        from_time: Math.round(oldTime),
        to_time: Math.round(time)
      });
    }
  };

  const deleteRecording = async (recordingId: string) => {
    if (confirm('Are you sure you want to delete this recording?')) {
      try {
        await audioStorage.deleteRecording(recordingId);

        // Cleanup audio element
        const audio = audioRefs.current[recordingId];
        if (audio) {
          audio.pause();
          URL.revokeObjectURL(audio.src);
          delete audioRefs.current[recordingId];
        }

        // Track recording deletion
        track('recording_deleted', {
          total_recordings: recordings.length - 1
        });

        onRecordingsChange();
      } catch (error) {
        console.error('Error deleting recording:', error);

        // Track deletion error
        track('recording_delete_error');
      }
    }
  };

  const formatTime = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const formatDate = (date: Date): string => {
    return new Date(date).toLocaleDateString() + ' ' + new Date(date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  if (recordings.length === 0) {
    return (
      <div className="recordings-list empty">
        <p>No recordings yet. Start recording to see your audio files here!</p>
      </div>
    );
  }

  return (
    <div className="recordings-list">
      <h2>Your Recordings ({recordings.length})</h2>
      <div className="recordings-container">
        {recordings.map((recording) => {
          const playbackState = playbackStates[recording.id] || {
            isPlaying: false,
            currentTime: 0,
            duration: recording.duration,
            audio: null,
          };

          return (
            <div key={recording.id} className="recording-item">
              <div className="recording-info">
                <h3 className="recording-name">{recording.name}</h3>
                <p className="recording-date">{formatDate(recording.createdAt)}</p>
              </div>

              <div className="playback-controls">
                <button
                  onClick={() =>
                    playbackState.isPlaying
                      ? pauseRecording(recording.id)
                      : playRecording(recording)
                  }
                  className="play-pause-button"
                >
                  {playbackState.isPlaying ? '⏸️' : '▶️'}
                </button>

                <div className="progress-container">
                  <input
                    type="range"
                    min="0"
                    max={playbackState.duration}
                    value={playbackState.currentTime}
                    onChange={(e) => seekTo(recording.id, Number(e.target.value))}
                    className="progress-bar"
                  />
                  <div className="time-display">
                    <span>{formatTime(playbackState.currentTime)}</span>
                    <span>/</span>
                    <span>{formatTime(playbackState.duration)}</span>
                  </div>
                </div>

                <button
                  onClick={() => deleteRecording(recording.id)}
                  className="delete-button"
                  title="Delete recording"
                >
                  🗑️
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}