"use client";

/**
 * La forma de onda de un archivo leída de a trozos con un `AudioBufferSink` de mediabunny PROPIO, como
 * audio/decodificar.ts (nunca el del reproductor: «Decodificar fuera del reproductor» en docs/hallazgos-video-editor.md).
 * Los picos los suma ./picos-por-tramos.ts. Por qué: media/picos-por-tramos.ts.
 */
import { ALL_FORMATS, AudioBufferSink, BlobSource, Input } from "mediabunny";
import { PicosPorTramos } from "./picos-por-tramos";
import { DEFAULT_SOURCE_WAVEFORM_BUCKET_SIZE, type SourceWaveformSummary } from "./waveform-summary";

export type OndaPorTramos =
	| { estado: "listo"; resumen: SourceWaveformSummary }
	/** El archivo no tiene pista de audio: no hay onda que dibujar (igual que antes, cuando decodeAudioData fallaba). */
	| { estado: "sin-audio" }
	/** mediabunny no lo lee o el navegador no decodifica ese audio: va por el camino de antes (el archivo entero). */
	| { estado: "no-se-pudo" };

export async function ondaPorTramos({
	sourceKey,
	file,
	bucketSize = DEFAULT_SOURCE_WAVEFORM_BUCKET_SIZE,
}: {
	sourceKey: string;
	file: File;
	bucketSize?: number;
}): Promise<OndaPorTramos> {
	const input = new Input({ source: new BlobSource(file), formats: ALL_FORMATS });
	try {
		const pista = await input.getPrimaryAudioTrack();
		if (!pista) return { estado: "sin-audio" };
		if (!(await pista.canDecode())) return { estado: "no-se-pudo" };
		const sink = new AudioBufferSink(pista);
		const picos = new PicosPorTramos(bucketSize);
		let sampleRate = pista.sampleRate;
		let alguno = false;
		for await (const { buffer, timestamp } of sink.buffers()) {
			alguno = true;
			sampleRate = buffer.sampleRate;
			const canales = Array.from({ length: buffer.numberOfChannels }, (_, c) => buffer.getChannelData(c));
			picos.agregar(canales, Math.round(timestamp * sampleRate));
		}
		if (!alguno) return { estado: "no-se-pudo" };
		return { estado: "listo", resumen: picos.resumen({ sourceKey, sampleRate }) };
	} catch (error) {
		console.warn("[forma de onda] no se pudo leer de a trozos; va el archivo entero", error);
		return { estado: "no-se-pudo" };
	} finally {
		input.dispose();
	}
}
