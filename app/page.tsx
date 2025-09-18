'use client';

import { useState, useEffect } from 'react';
import { track } from '@vercel/analytics';
import AudioRecorder from './components/AudioRecorder';
import RecordingsList from './components/RecordingsList';
import { AudioRecording } from './types/audio';
import { audioStorage } from './lib/audioStorage';
import './styles/audio-recorder.css';

export default function Home() {
  const [recordings, setRecordings] = useState<AudioRecording[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    initializeStorage();
  }, []);

  const initializeStorage = async () => {
    try {
      await audioStorage.init();
      await loadRecordings();
    } catch (error) {
      console.error('Failed to initialize storage:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const loadRecordings = async () => {
    try {
      const savedRecordings = await audioStorage.getRecordings();
      setRecordings(savedRecordings);

      // Track app initialization
      track('app_initialized', {
        existing_recordings: savedRecordings.length,
        has_existing_data: savedRecordings.length > 0
      });
    } catch (error) {
      console.error('Failed to load recordings:', error);
    }
  };

  const handleRecordingComplete = (newRecording: AudioRecording) => {
    setRecordings(prev => [newRecording, ...prev]);
  };

  const handleRecordingsChange = () => {
    loadRecordings();
  };

  if (isLoading) {
    return (
      <div style={{
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        minHeight: '100vh',
        fontSize: '1.2rem',
        color: '#666'
      }}>
        Loading audio recorder...
      </div>
    );
  }

  return (
    <div style={{ minHeight: '100vh', backgroundColor: '#f8fafc', padding: '2rem 1rem' }}>
      <main>
        <div style={{ textAlign: 'center', marginBottom: '3rem' }}>
          <h1 style={{
            fontSize: '2.5rem',
            fontWeight: 'bold',
            color: '#333',
            marginBottom: '0.5rem'
          }}>
            Audio Recorder
          </h1>
          <p style={{ color: '#666', fontSize: '1.1rem' }}>
            Record, save, and play back your audio messages
          </p>
        </div>

        <AudioRecorder onRecordingComplete={handleRecordingComplete} />

        <RecordingsList
          recordings={recordings}
          onRecordingsChange={handleRecordingsChange}
        />
      </main>
    </div>
  );
}
