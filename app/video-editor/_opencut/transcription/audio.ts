// =============================================================================
// El audio que entra a Whisper: 16 kHz, mono, en trozos de hasta 30 s
// =============================================================================

export const DEFAULT_TRANSCRIPTION_SAMPLE_RATE = 16000;

export const DEFAULT_CHUNK_LENGTH_SECONDS = 30;
export const DEFAULT_STRIDE_SECONDS = 5;

/**
 * Pasa el audio de la línea de tiempo (el WAV de `extractTimelineAudio`) a 16 kHz
 * mono para Whisper.
 *
 * Con un OfflineAudioContext y no con `decodeAudioToFloat32` (media/audio.ts):
 * aquel crea un AudioContext por llamada y no lo cierra, y Chrome topea cuántos
 * puede haber vivos. Un contexto offline no toma el dispositivo de audio y el
 * remuestreo a 16 kHz lo hace `decodeAudioData` al decodificar.
 */
export async function decodificarMono16k(blob: Blob): Promise<Float32Array> {
	const datos = await blob.arrayBuffer();
	const ctx = new OfflineAudioContext(1, 1, DEFAULT_TRANSCRIPTION_SAMPLE_RATE);
	const buffer = await ctx.decodeAudioData(datos);
	const canales = buffer.numberOfChannels;
	if (canales === 1) return buffer.getChannelData(0).slice();
	const salida = new Float32Array(buffer.length);
	for (let c = 0; c < canales; c++) {
		const canal = buffer.getChannelData(c);
		for (let i = 0; i < canal.length; i++) salida[i] += canal[i] / canales;
	}
	return salida;
}

// ── Trozos para Whisper ──────────────────────────────────────────────────────

/** Un pedazo del audio, en muestras, que se transcribe de una vez. */
export type TrozoAudio = { desde: number; hasta: number };

const VENTANA_RMS_S = 0.02;
const MAX_TROZO_S = 29.5;
/** Dónde se busca el corte: en los últimos N segundos del trozo. */
const BUSQUEDA_CORTE_S = 6;
/**
 * Por debajo de esto (RMS, escala -1…1, ≈ −46 dBFS) un trozo es silencio y no
 * se le da a Whisper. ⚠️ No es prolijidad: Whisper en silencio o con música sola
 * INVENTA texto («Subtítulos realizados por la comunidad de Amara.org», «¡Gracias
 * por ver!»), que es su alucinación más conocida en español.
 */
const RMS_SILENCIO = 0.005;

/**
 * Corta el audio en trozos de hasta ~30 s (lo que Whisper ve de una vez) por el
 * punto MÁS CALLADO cerca del final de cada uno, en vez de cada 30 s exactos con
 * solapamiento (lo que hace el pipeline con `chunk_length_s`). Así ninguna
 * palabra queda partida entre dos trozos, cada trozo es una unidad de progreso,
 * y los trozos en silencio se saltan enteros.
 */
export function trocearAudio({
	muestras,
	sampleRate = DEFAULT_TRANSCRIPTION_SAMPLE_RATE,
}: {
	muestras: Float32Array;
	sampleRate?: number;
}): TrozoAudio[] {
	const paso = Math.max(1, Math.round(VENTANA_RMS_S * sampleRate));
	const nVentanas = Math.ceil(muestras.length / paso);
	const rms = new Float32Array(nVentanas);
	for (let v = 0; v < nVentanas; v++) {
		let suma = 0;
		const fin = Math.min(muestras.length, (v + 1) * paso);
		for (let i = v * paso; i < fin; i++) suma += muestras[i] * muestras[i];
		rms[v] = Math.sqrt(suma / Math.max(1, fin - v * paso));
	}

	const maxVentanas = Math.floor(MAX_TROZO_S / VENTANA_RMS_S);
	const busqueda = Math.floor(BUSQUEDA_CORTE_S / VENTANA_RMS_S);
	const trozos: TrozoAudio[] = [];
	let inicio = 0;
	while (inicio < nVentanas) {
		let fin = Math.min(nVentanas, inicio + maxVentanas);
		if (fin < nVentanas) {
			// El corte va en la ventana más callada de los últimos segundos (con un
			// promedio corto para no elegir un cero suelto en medio de una sílaba).
			let mejor = fin;
			let mejorValor = Number.POSITIVE_INFINITY;
			for (let v = Math.max(inicio + 1, fin - busqueda); v < fin; v++) {
				const valor = (rms[v - 1] + rms[v] + (rms[v + 1] ?? rms[v])) / 3;
				if (valor < mejorValor) {
					mejorValor = valor;
					mejor = v;
				}
			}
			fin = mejor;
		}
		let max = 0;
		for (let v = inicio; v < fin; v++) max = Math.max(max, rms[v]);
		if (max >= RMS_SILENCIO) {
			trozos.push({ desde: inicio * paso, hasta: Math.min(muestras.length, fin * paso) });
		}
		inicio = fin;
	}
	return trozos;
}
