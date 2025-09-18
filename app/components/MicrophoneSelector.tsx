'use client';

import { useState, useEffect } from 'react';
import { track } from '@vercel/analytics';
import { AudioDevice, audioDeviceManager } from '../lib/audioDevices';

interface MicrophoneSelectorProps {
  selectedDeviceId: string;
  onDeviceChange: (deviceId: string) => void;
  disabled?: boolean;
}

export default function MicrophoneSelector({
  selectedDeviceId,
  onDeviceChange,
  disabled = false
}: MicrophoneSelectorProps) {
  const [devices, setDevices] = useState<AudioDevice[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string>('');

  useEffect(() => {
    loadDevices();

    // Listen for device changes (when devices are plugged/unplugged)
    const handleDeviceChange = () => {
      loadDevices();
    };

    navigator.mediaDevices.addEventListener('devicechange', handleDeviceChange);

    return () => {
      navigator.mediaDevices.removeEventListener('devicechange', handleDeviceChange);
    };
  }, []);

  const loadDevices = async () => {
    try {
      setIsLoading(true);
      setError('');

      const audioDevices = await audioDeviceManager.getAudioInputDevices();
      setDevices(audioDevices);

      // Track device enumeration
      track('devices_enumerated', {
        device_count: audioDevices.length,
        has_multiple_devices: audioDevices.length > 1
      });

      // If no device is selected and we have devices available, select the first one
      if (!selectedDeviceId && audioDevices.length > 0) {
        onDeviceChange(audioDevices[0].deviceId);
      }

      // If the currently selected device is no longer available, switch to the first available
      if (selectedDeviceId && !audioDevices.find(d => d.deviceId === selectedDeviceId) && audioDevices.length > 0) {
        onDeviceChange(audioDevices[0].deviceId);
      }

    } catch (err) {
      setError('Failed to load microphone devices');
      console.error('Error loading devices:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleDeviceSelect = async (deviceId: string) => {
    if (disabled) return;

    try {
      setError('');

      // Test the device before switching
      const isWorking = await audioDeviceManager.testDevice(deviceId);

      if (isWorking) {
        onDeviceChange(deviceId);

        // Track successful device switch
        track('microphone_switched', {
          device_label: devices.find(d => d.deviceId === deviceId)?.label || 'Unknown',
          total_devices: devices.length
        });
      } else {
        setError('Selected microphone is not working properly');

        // Track device test failure
        track('microphone_test_failed');
      }
    } catch (err) {
      setError('Failed to switch to selected microphone');
      console.error('Error selecting device:', err);
    }
  };

  const refreshDevices = () => {
    // Track device refresh action
    track('devices_refreshed');

    loadDevices();
  };

  if (isLoading) {
    return (
      <div className="microphone-selector loading">
        <div className="selector-label">
          <span>🎤</span>
          <span>Loading microphones...</span>
        </div>
      </div>
    );
  }

  if (devices.length === 0) {
    return (
      <div className="microphone-selector no-devices">
        <div className="selector-label">
          <span>🎤</span>
          <span>No microphones found</span>
        </div>
        <button onClick={refreshDevices} className="refresh-button">
          🔄 Refresh
        </button>
      </div>
    );
  }

  return (
    <div className="microphone-selector">
      <div className="selector-label">
        <span>🎤</span>
        <span>Microphone:</span>
      </div>

      <div className="selector-controls">
        <select
          value={selectedDeviceId}
          onChange={(e) => handleDeviceSelect(e.target.value)}
          disabled={disabled}
          className="device-select"
        >
          {devices.map((device) => (
            <option key={device.deviceId} value={device.deviceId}>
              {device.label}
            </option>
          ))}
        </select>

        <button
          onClick={refreshDevices}
          className="refresh-button"
          title="Refresh device list"
          disabled={disabled}
        >
          🔄
        </button>
      </div>

      {error && (
        <div className="device-error">
          {error}
        </div>
      )}

      {devices.length > 1 && (
        <div className="device-info">
          {devices.length} microphone{devices.length !== 1 ? 's' : ''} available
        </div>
      )}
    </div>
  );
}