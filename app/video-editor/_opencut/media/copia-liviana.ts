"use client";

/**
 * Arma la COPIA LIVIANA de un video con el `Conversion` de mediabunny, igual que `sounds/components/extraer-audio.ts`.
 * Las reglas (tamaño, claves, nombre) están en ./copia-liviana-reglas.ts.
 *
 * La copia:
 * - no lleva audio: la vista previa suena con el original (core/managers/audio-manager.ts);
 * - va sin metadatos de rotación: el giro del celular queda dibujado en los cuadros, y el ancho y el alto son los que
 *   se ven;
 * - lleva un cuadro clave por segundo, para que mover el cabezal no decodifique desde 5 s antes;
 * - empieza en el 0 del original (`trim.start: 0`). Según la documentación de mediabunny (`ConversionOptions.trim`), sin
 *   eso arranca en el primer instante de las pistas que quedan: un video cuyo primer cuadro no esté en 0 quedaría corrido
 *   contra el audio. Medido con un video que arranca en 0: los cuadros caen en el mismo instante (120 de 120). Con uno
 *   que no arranque en 0 todavía no se probó.
 */
import {
	ALL_FORMATS,
	BlobSource,
	BufferTarget,
	Conversion,
	Input,
	Mp4OutputFormat,
	Output,
	QUALITY_MEDIUM,
} from "mediabunny";
import { medidasDeCopia } from "./copia-liviana-reglas";

export async function crearCopiaLiviana({
	file,
	signal,
}: {
	file: File;
	signal?: AbortSignal;
}): Promise<File | null> {
	if (signal?.aborted) return null;
	const input = new Input({ source: new BlobSource(file), formats: ALL_FORMATS });
	try {
		const pista = await input.getPrimaryVideoTrack();
		if (!pista) return null;
		const medidas = medidasDeCopia({ width: pista.displayWidth, height: pista.displayHeight });
		if (!medidas) return null;

		const destino = new BufferTarget();
		const output = new Output({ format: new Mp4OutputFormat({ fastStart: "in-memory" }), target: destino });
		const conversion = await Conversion.init({
			input,
			output,
			tracks: "primary",
			video: {
				width: medidas.width,
				height: medidas.height,
				fit: "fill",
				codec: "avc",
				quality: QUALITY_MEDIUM,
				keyFrameInterval: 1,
				allowTransformationMetadata: false,
				forceTranscode: true,
			},
			audio: { discard: true },
			trim: { start: 0 },
			showWarnings: false,
		});
		if (!conversion.isValid) return null;

		const cortar = () => void conversion.cancel();
		signal?.addEventListener("abort", cortar, { once: true });
		try {
			await conversion.execute();
		} finally {
			signal?.removeEventListener("abort", cortar);
		}
		if (signal?.aborted || !destino.buffer) return null;
		return new File([destino.buffer], `${file.name}.liviana.mp4`, { type: "video/mp4" });
	} catch (error) {
		if (!signal?.aborted) console.warn("[copia liviana] no se pudo armar; la vista previa usa el original", error);
		return null;
	} finally {
		input.dispose();
	}
}
