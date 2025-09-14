'use client';

import { useState, useEffect, useRef } from 'react';
import { AudioRecording, RecordingState } from '../types/audio';
import { audioStorage } from '../lib/audioStorage';
import MicrophoneSelector from './MicrophoneSelector';

interface AudioRecorderProps {
  onRecordingComplete: (recording: AudioRecording) => void;
}

export default function AudioRecorder({ onRecordingComplete }: AudioRecorderProps) {
  const [recordingState, setRecordingState] = useState<RecordingState>({
    isRecording: false,
    isPaused: false,
    recordingTime: 0,
    mediaRecorder: null,
    audioStream: null,
  });
  const [error, setError] = useState<string>('');
  const [permissionGranted, setPermissionGranted] = useState<boolean>(false);
  const [selectedDeviceId, setSelectedDeviceId] = useState<string>('');

  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const chunksRef = useRef<Blob[]>([]);

  useEffect(() => {
    // Request microphone permission on component mount
    requestMicrophonePermission();

    return () => {
      // Cleanup on unmount
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
      if (recordingState.audioStream) {
        recordingState.audioStream.getTracks().forEach(track => track.stop());
      }
    };
  }, []);

  const requestMicrophonePermission = async () => {
    try {
      const constraints = selectedDeviceId
        ? { audio: { deviceId: { exact: selectedDeviceId } } }
        : { audio: true };

      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      setPermissionGranted(true);
      stream.getTracks().forEach(track => track.stop()); // Stop the test stream
      setError('');
    } catch (err) {
      setPermissionGranted(false);
      setError('Microphone permission is required to record audio.');
    }
  };

  const startRecording = async () => {
    try {
      if (!permissionGranted) {
        await requestMicrophonePermission();
        if (!permissionGranted) return;
      }

      const constraints = selectedDeviceId
        ? { audio: { deviceId: { exact: selectedDeviceId } } }
        : { audio: true };

      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      const mediaRecorder = new MediaRecorder(stream);

      chunksRef.current = [];

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          chunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = async () => {
        const audioBlob = new Blob(chunksRef.current, { type: mediaRecorder.mimeType });
        const duration = recordingState.recordingTime;

        // Create recording object
        const recording: AudioRecording = {
          id: `recording_${Date.now()}`,
          name: `Recording ${new Date().toLocaleString()}`,
          blob: audioBlob,
          duration,
          createdAt: new Date(),
          mimeType: mediaRecorder.mimeType,
        };

        // Save to IndexedDB
        try {
          await audioStorage.saveRecording(recording);
          onRecordingComplete(recording);
        } catch (err) {
          setError('Failed to save recording');
          console.error('Save error:', err);
        }

        // Cleanup
        stream.getTracks().forEach(track => track.stop());
        setRecordingState(prev => ({
          ...prev,
          isRecording: false,
          isPaused: false,
          recordingTime: 0,
          mediaRecorder: null,
          audioStream: null,
        }));

        if (timerRef.current) {
          clearInterval(timerRef.current);
        }
      };

      mediaRecorder.start();

      // Start timer
      timerRef.current = setInterval(() => {
        setRecordingState(prev => ({
          ...prev,
          recordingTime: prev.recordingTime + 1,
        }));
      }, 1000);

      setRecordingState(prev => ({
        ...prev,
        isRecording: true,
        isPaused: false,
        mediaRecorder,
        audioStream: stream,
      }));

      setError('');
    } catch (err) {
      setError('Failed to start recording. Please check microphone permissions.');
      console.error('Recording error:', err);
    }
  };

  const stopRecording = () => {
    if (recordingState.mediaRecorder && recordingState.isRecording) {
      recordingState.mediaRecorder.stop();
    }
  };

  const pauseRecording = () => {
    if (recordingState.mediaRecorder && recordingState.isRecording) {
      recordingState.mediaRecorder.pause();
      setRecordingState(prev => ({ ...prev, isPaused: true }));

      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
    }
  };

  const resumeRecording = () => {
    if (recordingState.mediaRecorder && recordingState.isPaused) {
      recordingState.mediaRecorder.resume();
      setRecordingState(prev => ({ ...prev, isPaused: false }));

      // Resume timer
      timerRef.current = setInterval(() => {
        setRecordingState(prev => ({
          ...prev,
          recordingTime: prev.recordingTime + 1,
        }));
      }, 1000);
    }
  };

  const formatTime = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div className="audio-recorder">
      <MicrophoneSelector
        selectedDeviceId={selectedDeviceId}
        onDeviceChange={setSelectedDeviceId}
        disabled={recordingState.isRecording || recordingState.isPaused}
      />

      <div className="recorder-status">
        {recordingState.isRecording && (
          <div className="recording-indicator">
            <span className="pulse-dot"></span>
            <span>Recording: {formatTime(recordingState.recordingTime)}</span>
          </div>
        )}
        {recordingState.isPaused && (
          <div className="paused-indicator">
            <span>Paused: {formatTime(recordingState.recordingTime)}</span>
          </div>
        )}
      </div>

      <div className="recorder-controls">
        {!recordingState.isRecording && !recordingState.isPaused && (
          <button
            onClick={startRecording}
            disabled={!permissionGranted}
            className="record-button"
          >
            🎤 Start Recording
          </button>
        )}

        {recordingState.isRecording && !recordingState.isPaused && (
          <>
            <button onClick={pauseRecording} className="pause-button">
              ⏸️ Pause
            </button>
            <button onClick={stopRecording} className="stop-button">
              ⏹️ Stop
            </button>
          </>
        )}

        {recordingState.isPaused && (
          <>
            <button onClick={resumeRecording} className="resume-button">
              ▶️ Resume
            </button>
            <button onClick={stopRecording} className="stop-button">
              ⏹️ Stop
            </button>
          </>
        )}
      </div>

      {error && (
        <div className="error-message">
          {error}
          {!permissionGranted && (
            <button onClick={requestMicrophonePermission} className="retry-button">
              Grant Permission
            </button>
          )}
        </div>
      )}
    </div>
  );
}