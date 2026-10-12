declare module "soundtouchjs" {
	export class PitchShifter {
		constructor(
			context: BaseAudioContext,
			buffer: AudioBuffer,
			bufferSize: number,
			onEnd?: () => void,
		);
		tempo: number;
		pitch: number;
		connect(destination: AudioNode): void;
		off(): void;
	}
	// El núcleo sin contexto de audio (audio/dsp/tono.ts): `SoundTouch` hace la
	// cuenta y `SimpleFilter` le pide muestras intercaladas (L,R,L,R) a la fuente.
	export class SoundTouch {
		pitch: number;
		pitchSemitones: number;
		tempo: number;
		rate: number;
	}
	export class SimpleFilter {
		constructor(
			source: {
				extract(target: Float32Array, numFrames: number, position: number): number;
			},
			pipe: SoundTouch,
			onEnd?: () => void,
		);
		extract(target: Float32Array, numFrames: number): number;
	}
}
