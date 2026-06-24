declare module 'opus-recorder' {
  interface RecorderOptions {
    encoderPath?: string;
    numberOfChannels?: number;
    encoderSampleRate?: number;
    encoderApplication?: number;
    encoderBitRate?: number;
    streamPages?: boolean;
    monitorGain?: number;
    recordingGain?: number;
  }
  export default class Recorder {
    constructor(options?: RecorderOptions);
    state: 'inactive' | 'recording' | 'paused';
    start(): Promise<void>;
    stop(): Promise<void> | void;
    close(): void;
    pause(): void;
    resume(): void;
    static isRecordingSupported(): boolean;
    ondataavailable: (typedArray: Uint8Array) => void;
    onstart: () => void;
    onstop: () => void;
    onpause: () => void;
    onresume: () => void;
  }
}
