// =============================================================================
// El exportador de video: dibuja cada cuadro y lo codifica con mediabunny
// =============================================================================
// El render del motor trabaja SIEMPRE en el tamaño del lienzo del proyecto: las
// posiciones de los elementos están en píxeles del lienzo (frame-descriptor.ts:
// `centerX = renderer.width / 2 + position.x`), así que dibujar en otro tamaño
// los correría de lugar. Lo que cambia con la «Resolución» de CapCut es el
// ARCHIVO: cada cuadro del lienzo se reescala antes de codificarse con el
// `transform` de mediabunny, que baja con mipmaps (sin serrucho al achicar 4×).
// Subir de 1080P a 4K interpola: para nitidez nativa, el lienzo tiene que ser de
// ese tamaño (el formato del proyecto lo decide el reproductor).
//
// Lo que sale es un MP4/MOV/WebM válido porque lo arma mediabunny entero:
// · con un BufferTarget, el MP4 va con «fast start» en memoria (`moov` antes de
//   `mdat`), que es lo que se reproduce en cualquier lado apenas descarga;
// · el `avcC`/`hvcC` sale de los metadatos del VideoEncoder (`avc: {format:
//   'avc'}`), no de una cadena armada a mano;
// · los tiempos van en segundos exactos (`i / fps`), sin deriva en 29,97.

import EventEmitter from "eventemitter3";

import {
	Output,
	Mp4OutputFormat,
	MovOutputFormat,
	WebMOutputFormat,
	BufferTarget,
	CanvasSource,
	AudioBufferSource,
	Quality,
	QUALITY_LOW,
	QUALITY_MEDIUM,
	QUALITY_HIGH,
	QUALITY_VERY_HIGH,
	type VideoEncodingConfig,
} from "mediabunny";
import type { FrameRate } from "@/app/video-editor/_opencut/wasm/opencut";
import { TICKS_PER_SECOND } from "@/app/video-editor/_opencut/wasm";
import { frameRateToFloat } from "@/app/video-editor/_opencut/fps/utils";
import type { RootNode } from "./nodes/root-node";
import type { ExportFormat, ExportQuality } from "@/app/video-editor/_opencut/export";
import { CanvasRenderer } from "./canvas-renderer";

export type CodecVideoExportable = "avc" | "hevc" | "av1" | "vp9";

type ExportParams = {
	/** El tamaño del LIENZO del proyecto: en el que se dibuja. */
	width: number;
	height: number;
	fps: FrameRate;
	format: ExportFormat;
	/** La calidad de OpenCut, para quien no pase `bitrate` (el exportador viejo del renderer-manager). */
	quality: ExportQuality;
	/** El tamaño del ARCHIVO («Resolución» de CapCut). Sin esto, el del lienzo. */
	salida?: { width: number; height: number };
	/** Bits por segundo del video («Tasa de bits»). */
	bitrate?: number;
	bitrateMode?: "variable" | "constant";
	codec?: CodecVideoExportable;
	/** La cadena de codec ya probada con isConfigSupported (ver export/opciones.ts → cadenaAvc). */
	fullCodecString?: string;
	shouldIncludeAudio?: boolean;
	audioBuffer?: AudioBuffer;
	audioBitrate?: number;
};

const qualityMap = {
	low: QUALITY_LOW,
	medium: QUALITY_MEDIUM,
	high: QUALITY_HIGH,
	very_high: QUALITY_VERY_HIGH,
};

export type SceneExporterEvents = {
	progress: [progress: number];
	complete: [buffer: ArrayBuffer];
	error: [error: Error];
	cancelled: [];
};

export class SceneExporter extends EventEmitter<SceneExporterEvents> {
	private renderer: CanvasRenderer;
	private params: ExportParams;

	private isCancelled = false;

	constructor(params: ExportParams) {
		super();
		this.params = params;
		this.renderer = new CanvasRenderer({
			width: params.width,
			height: params.height,
			fps: params.fps,
		});
	}

	cancel(): void {
		this.isCancelled = true;
	}

	private formatoDeSalida() {
		switch (this.params.format) {
			case "webm":
				return new WebMOutputFormat();
			case "mov":
				return new MovOutputFormat();
			default:
				return new Mp4OutputFormat();
		}
	}

	private configVideo(): VideoEncodingConfig {
		const { format, codec, bitrate, bitrateMode, salida, width, height, fullCodecString, quality } = this.params;
		// WebM sólo lleva VP8/VP9/AV1: un H.264 ahí lo rechaza el muxer al final.
		const codecFinal: CodecVideoExportable =
			codec ?? (format === "webm" ? "vp9" : "avc");
		const config: VideoEncodingConfig = {
			codec: codecFinal,
			quality: bitrate
				? new Quality({ bitrate, bitrateMode: bitrateMode ?? "variable" })
				: qualityMap[quality],
			// Un cuadro clave cada 2 s: lo que espera cualquier reproductor para saltar.
			keyFrameInterval: 2,
		};
		if (fullCodecString && codecFinal === "avc") config.fullCodecString = fullCodecString;
		const destino = salida ?? { width, height };
		// H.264/HEVC exigen lados pares: un lienzo impar también pasa por el reescalado.
		if (destino.width !== width || destino.height !== height || width % 2 === 1 || height % 2 === 1) {
			config.transform = {
				width: Math.max(2, Math.round(destino.width / 2) * 2),
				height: Math.max(2, Math.round(destino.height / 2) * 2),
				fit: "fill",
			};
		}
		return config;
	}

	async export({
		rootNode,
	}: {
		rootNode: RootNode;
	}): Promise<ArrayBuffer | null> {
		const fps = this.renderer.fps;
		const fpsFloat = frameRateToFloat(fps);
		const ticksPerFrame = Math.round(
			(TICKS_PER_SECOND * fps.denominator) / fps.numerator,
		);
		const frameCount = Math.max(1, Math.floor(rootNode.duration / ticksPerFrame));
		const { audioBuffer, shouldIncludeAudio, format } = this.params;

		const output = new Output({
			format: this.formatoDeSalida(),
			target: new BufferTarget(),
		});

		const videoSource = new CanvasSource(
			this.renderer.getOutputCanvas(),
			this.configVideo(),
		);

		output.addVideoTrack(videoSource, { frameRate: fpsFloat });

		let audioSource: AudioBufferSource | null = null;
		if (shouldIncludeAudio && audioBuffer) {
			let audioCodec: "aac" | "opus" = format === "webm" ? "opus" : "aac";

			if (audioCodec === "aac" && typeof AudioEncoder !== "undefined") {
				const { supported } = await AudioEncoder.isConfigSupported({
					codec: "mp4a.40.2",
					sampleRate: audioBuffer.sampleRate,
					numberOfChannels: audioBuffer.numberOfChannels,
					bitrate: this.params.audioBitrate ?? 192_000,
				});
				// Sin AAC (algunos Firefox en Linux) va Opus: el MP4 sigue siendo válido
				// y se reproduce en navegadores, aunque QuickTime no lo abra.
				if (!supported) audioCodec = "opus";
			}

			audioSource = new AudioBufferSource({
				codec: audioCodec,
				quality: new Quality({ bitrate: this.params.audioBitrate ?? 192_000 }),
			});
			output.addAudioTrack(audioSource);
		}

		await output.start();

		if (audioSource && audioBuffer) {
			await audioSource.add(audioBuffer);
			audioSource.close();
		}

		for (let i = 0; i < frameCount; i++) {
			if (this.isCancelled) {
				await output.cancel();
				this.emit("cancelled");
				return null;
			}

			const timeTicks = i * ticksPerFrame;
			await this.renderer.render({ node: rootNode, time: timeTicks });
			// El sello del cuadro sale de `i / fps` y no de los ticks redondeados:
			// así 29,97 y 59,94 no acumulan deriva contra el audio.
			await videoSource.add(i / fpsFloat, 1 / fpsFloat);

			this.emit("progress", i / frameCount);
		}

		if (this.isCancelled) {
			await output.cancel();
			this.emit("cancelled");
			return null;
		}

		videoSource.close();
		await output.finalize();
		this.emit("progress", 1);

		const buffer = output.target.buffer;
		if (!buffer) {
			this.emit("error", new Error("Failed to export video"));
			return null;
		}

		this.emit("complete", buffer);
		return buffer;
	}
}
