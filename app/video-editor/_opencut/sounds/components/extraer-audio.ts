// =============================================================================
// Audio › Extraer audio: el audio de un video, como un archivo de audio aparte
// =============================================================================
// CapCut lo hace en el escritorio con FFmpeg; acá corre en el navegador con
// mediabunny (el mismo que lee los videos al importar). Se COPIAN los paquetes
// del audio cuando el contenedor de destino los admite (AAC → .m4a, Opus/Vorbis →
// .webm, MP3 → .mp3): es instantáneo y no pierde calidad. Si no se puede copiar
// (otro códec, o un contenedor raro), se decodifica y se escribe un WAV de 16
// bits, que pesa más pero lo lee cualquier navegador.
//
// Nada sale de la máquina: el archivo resultante se importa al proyecto como
// cualquier otro (IndexedDB/OPFS del workspace).

import {
	ALL_FORMATS,
	BlobSource,
	BufferTarget,
	Conversion,
	Input,
	Mp3OutputFormat,
	Mp4OutputFormat,
	Output,
	WavOutputFormat,
	WebMOutputFormat,
	type AudioCodec,
	type OutputFormat,
} from "mediabunny";

/** El video no tiene pista de audio («No se puede separar el audio», en CapCut). */
export class SinAudioError extends Error {
	constructor() {
		super("El video no tiene audio");
		this.name = "SinAudioError";
	}
}

type Destino = {
	formato: () => OutputFormat;
	extension: string;
	mime: string;
	/** Códec de salida forzado (el WAV); sin él, mediabunny copia si puede. */
	codec?: AudioCodec;
};

const WAV: Destino = {
	formato: () => new WavOutputFormat(),
	extension: "wav",
	mime: "audio/wav",
	codec: "pcm-s16",
};

function destinoParaCopiar(codec: AudioCodec | null): Destino | null {
	switch (codec) {
		case "aac":
			return { formato: () => new Mp4OutputFormat(), extension: "m4a", mime: "audio/mp4" };
		case "opus":
		case "vorbis":
			return { formato: () => new WebMOutputFormat(), extension: "webm", mime: "audio/webm" };
		case "mp3":
			return { formato: () => new Mp3OutputFormat(), extension: "mp3", mime: "audio/mpeg" };
		default:
			return null;
	}
}

function nombreSinExtension(nombre: string): string {
	const punto = nombre.lastIndexOf(".");
	return punto > 0 ? nombre.slice(0, punto) : nombre;
}

/** Devuelve el audio del video como un `File` listo para importar. */
export async function extraerAudio({
	file,
	onProgress,
}: {
	file: File;
	onProgress?: (porcentaje: number) => void;
}): Promise<File> {
	const input = new Input({ source: new BlobSource(file), formats: ALL_FORMATS });
	try {
		const pista = await input.getPrimaryAudioTrack();
		if (!pista) throw new SinAudioError();

		const intentos = [destinoParaCopiar(pista.codec), WAV].filter(
			(destino): destino is Destino => destino !== null,
		);

		for (const destino of intentos) {
			const output = new Output({
				format: destino.formato(),
				target: new BufferTarget(),
			});
			const conversion = await Conversion.init({
				input,
				output,
				tracks: "primary",
				video: { discard: true },
				audio: destino.codec ? { codec: destino.codec } : {},
			});
			// Inválida = el destino no admite esta pista: se prueba el siguiente.
			if (!conversion.isValid) continue;

			conversion.onProgress = (progreso) => onProgress?.(Math.round(progreso * 100));
			await conversion.execute();

			const buffer = output.target.buffer;
			if (!buffer || buffer.byteLength === 0) continue;
			return new File(
				[buffer],
				`${nombreSinExtension(file.name)}.${destino.extension}`,
				{ type: destino.mime, lastModified: Date.now() },
			);
		}

		throw new Error("No se pudo convertir la pista de audio");
	} finally {
		input.dispose();
	}
}
