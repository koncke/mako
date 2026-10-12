// =============================================================================
// Leer el audio de la FUENTE de un clip, por trozos, para analizarlo
// =============================================================================
// «Normalizar la intensidad» mide el tramo que suena; «Marcar ritmos» analiza
// el archivo entero. Ninguno de los dos necesita el audio remuestreado ni junto:
// se recorre el archivo con un `AudioBufferSink` de mediabunny PROPIO (nunca el
// del reproductor: ver «Decodificar fuera del reproductor» en
// docs/hallazgos-video-editor.md) y se le pasa cada trozo a quien analiza.
//
// La música de biblioteca (sourceType "library") llega por URL: se baja, se
// decodifica con un contexto SIN conexión (no deja un AudioContext vivo) y se
// entrega en un solo trozo.

import { ALL_FORMATS, AudioBufferSink, BlobSource, Input } from "mediabunny";
import type { MediaAsset } from "@/app/video-editor/_opencut/media/types";
import type { AudioElement, VideoElement } from "@/app/video-editor/_opencut/timeline";

export type ClipConAudio = AudioElement | VideoElement;

/** Un trozo: un Float32Array por canal, su tasa y su instante en la fuente (s). */
export type Trozo = { canales: Float32Array[]; sampleRate: number; inicio: number };

/** El archivo del clip, o null si es de biblioteca o no está. */
export function archivoDelClip(element: ClipConAudio, mediaAssets: readonly MediaAsset[]): File | null {
	if (element.type === "audio" && element.sourceType === "library") return null;
	const asset = mediaAssets.find((a) => a.id === element.mediaId);
	return asset?.file ?? null;
}

/** Una clave estable de la FUENTE (para no analizar dos veces el mismo archivo). */
export function claveFuente(element: ClipConAudio): string {
	return element.type === "audio" && element.sourceType === "library"
		? `url:${element.sourceUrl}`
		: `medio:${element.mediaId}`;
}

/**
 * Recorre el audio de la fuente entre `desde` y `hasta` (segundos de la
 * fuente; sin `hasta`, hasta el final). Devuelve false si el clip no tiene audio
 * legible.
 */
export async function recorrerFuente({
	element,
	mediaAssets,
	desde = 0,
	hasta,
	alTrozo,
}: {
	element: ClipConAudio;
	mediaAssets: readonly MediaAsset[];
	desde?: number;
	hasta?: number;
	alTrozo: (trozo: Trozo) => void | Promise<void>;
}): Promise<boolean> {
	if (element.type === "audio" && element.sourceType === "library") {
		const respuesta = await fetch(element.sourceUrl);
		if (!respuesta.ok) return false;
		const datos = await respuesta.arrayBuffer();
		const ctx = new OfflineAudioContext(1, 1, 44100);
		const b = await ctx.decodeAudioData(datos);
		const i0 = Math.max(0, Math.floor(desde * b.sampleRate));
		const i1 = Math.min(b.length, hasta === undefined ? b.length : Math.ceil(hasta * b.sampleRate));
		if (i1 <= i0) return false;
		await alTrozo({
			canales: Array.from({ length: Math.min(2, b.numberOfChannels) }, (_, c) =>
				b.getChannelData(c).slice(i0, i1),
			),
			sampleRate: b.sampleRate,
			inicio: i0 / b.sampleRate,
		});
		return true;
	}

	const archivo = archivoDelClip(element, mediaAssets);
	if (!archivo) return false;
	const input = new Input({ source: new BlobSource(archivo), formats: ALL_FORMATS });
	try {
		const pista = await input.getPrimaryAudioTrack();
		if (!pista) return false;
		const sink = new AudioBufferSink(pista);
		let alguno = false;
		for await (const { buffer, timestamp } of sink.buffers(desde, hasta)) {
			alguno = true;
			await alTrozo({
				canales: Array.from({ length: Math.min(2, buffer.numberOfChannels) }, (_, c) =>
					buffer.getChannelData(c),
				),
				sampleRate: buffer.sampleRate,
				inicio: timestamp,
			});
		}
		return alguno;
	} finally {
		input.dispose();
	}
}
