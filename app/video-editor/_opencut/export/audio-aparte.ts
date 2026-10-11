// =============================================================================
// «Audio» del diálogo Exportar: la mezcla de la línea de tiempo en un archivo
// =============================================================================
// CapCut exporta el audio aparte (casilla «Audio») además del video. La mezcla
// ya la arma el motor (`createTimelineAudioBuffer`: todas las pistas, con sus
// volúmenes y fundidos, a 44,1 kHz estéreo); acá sólo se codifica:
//
// · WAV: PCM de 16 bits escrito a mano. No hay nada que negociar con el navegador.
// · MP3: lamejs (JS puro, ya está en el repo por los audios de WhatsApp). Ningún
//   navegador codifica MP3 con WebCodecs. ⚠️ lamejs no escribe la cabecera Xing:
//   algunos reproductores calculan mal la duración (app/whatsapp/_shared/AudioPlay.tsx).
// · AAC: WebCodecs por mediabunny, en un .aac (ADTS). Si el navegador no tiene
//   el codificador AAC, la opción se dibuja apagada (opciones.ts → soporteAudio).

import { AdtsOutputFormat, AudioBufferSource, BufferTarget, Output, Quality } from "mediabunny";
import { AUDIO_BITRATE, type FormatoAudioId } from "./opciones";

export async function codificarAudio({
	buffer,
	formato,
}: {
	buffer: AudioBuffer;
	formato: FormatoAudioId;
}): Promise<Blob> {
	if (formato === "wav") return wav(buffer);
	if (formato === "mp3") return mp3(buffer);
	return aac(buffer);
}

export const EXTENSION_AUDIO: Record<FormatoAudioId, string> = { aac: ".aac", mp3: ".mp3", wav: ".wav" };
export const MIME_AUDIO: Record<FormatoAudioId, string> = { aac: "audio/aac", mp3: "audio/mpeg", wav: "audio/wav" };

function aInt16(canal: Float32Array): Int16Array {
	const salida = new Int16Array(canal.length);
	for (let i = 0; i < canal.length; i++) {
		const v = Math.max(-1, Math.min(1, canal[i]));
		salida[i] = v < 0 ? v * 0x8000 : v * 0x7fff;
	}
	return salida;
}

function wav(buffer: AudioBuffer): Blob {
	const canales = Math.min(2, buffer.numberOfChannels);
	const muestras = buffer.length;
	const bytesDatos = muestras * canales * 2;
	const vista = new DataView(new ArrayBuffer(44 + bytesDatos));
	const texto = (off: number, s: string) => {
		for (let i = 0; i < s.length; i++) vista.setUint8(off + i, s.charCodeAt(i));
	};
	texto(0, "RIFF");
	vista.setUint32(4, 36 + bytesDatos, true);
	texto(8, "WAVE");
	texto(12, "fmt ");
	vista.setUint32(16, 16, true);
	vista.setUint16(20, 1, true); // PCM
	vista.setUint16(22, canales, true);
	vista.setUint32(24, buffer.sampleRate, true);
	vista.setUint32(28, buffer.sampleRate * canales * 2, true);
	vista.setUint16(32, canales * 2, true);
	vista.setUint16(34, 16, true);
	texto(36, "data");
	vista.setUint32(40, bytesDatos, true);
	const datos = Array.from({ length: canales }, (_, c) => aInt16(buffer.getChannelData(c)));
	let off = 44;
	for (let i = 0; i < muestras; i++) {
		for (let c = 0; c < canales; c++) {
			vista.setInt16(off, datos[c][i], true);
			off += 2;
		}
	}
	return new Blob([vista.buffer], { type: MIME_AUDIO.wav });
}

async function mp3(buffer: AudioBuffer): Promise<Blob> {
	// Import perezoso: el codificador pesa y sólo se usa al exportar MP3.
	const { Mp3Encoder } = await import("@breezystack/lamejs");
	const estereo = buffer.numberOfChannels > 1;
	const izq = aInt16(buffer.getChannelData(0));
	const der = estereo ? aInt16(buffer.getChannelData(1)) : undefined;
	const codificador = new Mp3Encoder(estereo ? 2 : 1, buffer.sampleRate, AUDIO_BITRATE / 1000);
	const partes: Uint8Array[] = [];
	// 1152 muestras: el tamaño de un cuadro MPEG-1 Layer III.
	const BLOQUE = 1152;
	for (let i = 0; i < izq.length; i += BLOQUE) {
		const parte = der
			? codificador.encodeBuffer(izq.subarray(i, i + BLOQUE), der.subarray(i, i + BLOQUE))
			: codificador.encodeBuffer(izq.subarray(i, i + BLOQUE));
		if (parte.length > 0) partes.push(parte);
	}
	const cola = codificador.flush();
	if (cola.length > 0) partes.push(cola);
	return new Blob(partes as BlobPart[], { type: MIME_AUDIO.mp3 });
}

async function aac(buffer: AudioBuffer): Promise<Blob> {
	const output = new Output({ format: new AdtsOutputFormat(), target: new BufferTarget() });
	const fuente = new AudioBufferSource({ codec: "aac", quality: new Quality({ bitrate: AUDIO_BITRATE }) });
	output.addAudioTrack(fuente);
	await output.start();
	await fuente.add(buffer);
	fuente.close();
	await output.finalize();
	const datos = output.target.buffer;
	if (!datos) throw new Error("AAC vacío");
	return new Blob([datos], { type: MIME_AUDIO.aac });
}
