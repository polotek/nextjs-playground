export interface AudioDevice {
  deviceId: string;
  label: string;
  groupId: string;
}

export class AudioDeviceManager {
  async getAudioInputDevices(): Promise<AudioDevice[]> {
    try {
      // Request permissions first to get device labels
      await navigator.mediaDevices.getUserMedia({ audio: true });

      const devices = await navigator.mediaDevices.enumerateDevices();
      const audioInputs = devices.filter(device => device.kind === 'audioinput');

      return audioInputs.map(device => ({
        deviceId: device.deviceId,
        label: device.label || `Microphone ${device.deviceId.slice(0, 8)}`,
        groupId: device.groupId,
      }));
    } catch (error) {
      console.error('Error getting audio devices:', error);
      return [];
    }
  }

  async getDefaultDevice(): Promise<string> {
    try {
      const devices = await this.getAudioInputDevices();
      return devices.length > 0 ? devices[0].deviceId : '';
    } catch (error) {
      console.error('Error getting default device:', error);
      return '';
    }
  }

  async testDevice(deviceId: string): Promise<boolean> {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: { deviceId: { exact: deviceId } }
      });

      // Test if the device is working by checking if we get audio tracks
      const audioTracks = stream.getAudioTracks();
      const isWorking = audioTracks.length > 0 && audioTracks[0].readyState === 'live';

      // Stop the test stream
      stream.getTracks().forEach(track => track.stop());

      return isWorking;
    } catch (error) {
      console.error('Error testing device:', error);
      return false;
    }
  }
}

export const audioDeviceManager = new AudioDeviceManager();