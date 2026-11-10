// =============================================================================
// La cadena de audio de UN clip: lo que se procesa antes de mezclar
// =============================================================================
// Dos lugares hacen sonar la línea de tiempo: la reproducción
// (core/managers/audio-manager.ts) y la mezcla del export (media/audio.ts). Para
// que un clip suene IGUAL en los dos, todo lo que no es una ganancia pasa por
// esta función, con el clip ya llevado a su tiempo (recorte + velocidad):
//
//   reducir el ruido (./dsp/ruido.ts, con RNNoise, en un worker: ./ruido-hilo/)  →  modificador de voz (./voz.ts)
//
// Las GANANCIAS (volumen con ◇, «Normalizar la intensidad», fundidos) no pasan
// por acá: se aplican al mezclar, muestra a muestra en el export y con
// automatización en la reproducción, que es exacto y no obliga a procesar.
//
// Si el clip no pide nada, `procesarClip` devuelve el mismo búfer. `signal` corta el trabajo (la vista previa lo
// corta cuando el clip deja de pedir ese procesado: core/managers/audio-manager.ts).

import type { ParamValues } from "@/app/video-editor/_opencut/params";
import { REDUCIR_RUIDO, claveProcesado, leerVoz } from "./claves";
import { reducirRuidoEnSegundoPlano } from "./ruido-hilo/cliente";
import { aplicarVoz } from "./voz";

/** CapCut guarda `denoise_rate 0,85` por defecto, y no lo deja cambiar. */
const INTENSIDAD_RUIDO = 0.85;

export { claveProcesado };

export async function procesarClip({
	buffer,
	params,
	signal,
}: {
	buffer: AudioBuffer;
	params: ParamValues;
	signal?: AbortSignal;
}): Promise<AudioBuffer> {
	if (!claveProcesado(params)) return buffer;
	const sampleRate = buffer.sampleRate;
	let canales: Float32Array[] = Array.from({ length: buffer.numberOfChannels }, (_, c) =>
		buffer.getChannelData(c),
	);
	if (params[REDUCIR_RUIDO] === true) {
		canales = await reducirRuidoEnSegundoPlano({ canales, sampleRate, intensidad: INTENSIDAD_RUIDO }, { signal });
	}
	signal?.throwIfAborted();
	const voz = leerVoz(params);
	if (voz) canales = await aplicarVoz({ canales, sampleRate, ajustes: voz });

	const salida = new AudioBuffer({
		length: buffer.length,
		numberOfChannels: canales.length,
		sampleRate,
	});
	canales.forEach((c, i) => {
		salida.copyToChannel(
			(c.length === buffer.length ? c : c.subarray(0, buffer.length)) as Float32Array<ArrayBuffer>,
			i,
		);
	});
	return salida;
}
