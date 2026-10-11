// =============================================================================
// El worker de Whisper (transformers.js): baja el modelo y transcribe
// =============================================================================
// Corre fuera del hilo de la pantalla: un minuto de audio son decenas de
// segundos de CPU/GPU. Recibe el audio de la línea de tiempo a 16 kHz mono y
// devuelve PALABRAS con su tiempo (los subtítulos de CapCut se cortan por
// pausas, y eso exige saber dónde termina cada palabra).
//
// Cómo transcribe:
//   1. Corta el audio en trozos de hasta ~30 s por el punto más callado
//      (transcription/audio.ts → trocearAudio) y salta los trozos en silencio.
//   2. Si el idioma es «Detectar automáticamente», lo detecta con UN paso del
//      decoder sobre el primer trozo con voz (ver `detectarIdioma`).
//   3. Cada trozo va con `return_timestamps: 'word'`. Si las marcas por palabra
//      fallan o vuelven inservibles, ese trozo y los que siguen van con tiempos
//      por frase y las palabras se reparten dentro de cada frase por largo.

import {
	pipeline,
	Tensor,
	type AutomaticSpeechRecognitionPipeline,
	type AutomaticSpeechRecognitionOutput,
} from "@huggingface/transformers";
import type {
	PalabraTranscrita,
	PrecisionTiempos,
} from "@/app/video-editor/_opencut/transcription/types";
import {
	DEFAULT_TRANSCRIPTION_SAMPLE_RATE,
	trocearAudio,
} from "@/app/video-editor/_opencut/transcription/audio";
import { repartirPorLargo } from "@/app/video-editor/_opencut/transcription/caption";

export type WorkerMessage =
	| { type: "init"; modelId: string; device: "webgpu" | "wasm"; dtype: "q4" | "q8" }
	| {
			type: "transcribe";
			audio: Float32Array;
			language: string | null;
			/**
			 * Sin marcas por palabra, fallar en vez de seguir por frase. Lo pide el
			 * servicio en WebGPU: ahí conviene pasar a WASM (que sí las da) antes que
			 * conformarse con tiempos repartidos.
			 */
			exigirPalabras: boolean;
	  }
	| { type: "cancel" };

export type WorkerResponse =
	| { type: "init-progress"; progress: number }
	| { type: "init-complete" }
	| { type: "init-error"; error: string }
	| { type: "transcribe-progress"; progress: number }
	| {
			type: "transcribe-complete";
			text: string;
			palabras: PalabraTranscrita[];
			precision: PrecisionTiempos;
			language: string;
	  }
	| { type: "transcribe-error"; error: string }
	| { type: "cancelled" };

let transcriber: AutomaticSpeechRecognitionPipeline | null = null;
let cancelled = false;
let lastReportedProgress = -1;
const fileBytes = new Map<string, { loaded: number; total: number }>();

const post = (msg: WorkerResponse) => self.postMessage(msg);

self.onmessage = async (event: MessageEvent<WorkerMessage>) => {
	const message = event.data;

	switch (message.type) {
		case "init":
			await handleInit(message);
			break;
		case "transcribe":
			await handleTranscribe({
				audio: message.audio,
				language: message.language,
				exigirPalabras: message.exigirPalabras,
			});
			break;
		case "cancel":
			cancelled = true;
			break;
	}
};

async function handleInit({
	modelId,
	device,
	dtype,
}: {
	modelId: string;
	device: "webgpu" | "wasm";
	dtype: "q4" | "q8";
}) {
	lastReportedProgress = -1;
	fileBytes.clear();

	try {
		transcriber = (await pipeline("automatic-speech-recognition", modelId, {
			dtype,
			device,
			progress_callback: (progressInfo: {
				status?: string;
				file?: string;
				loaded?: number;
				total?: number;
			}) => {
				const file = progressInfo.file;
				if (!file) return;

				const loaded = progressInfo.loaded ?? 0;
				const total = progressInfo.total ?? 0;

				if (progressInfo.status === "progress" && total > 0) {
					fileBytes.set(file, { loaded, total });
				} else if (progressInfo.status === "done") {
					const existing = fileBytes.get(file);
					if (existing) {
						fileBytes.set(file, { loaded: existing.total, total: existing.total });
					}
				}

				// El avance es por BYTES de todos los archivos juntos: por archivo, la
				// barra volvería a cero cuatro veces (config, tokenizer, encoder, decoder).
				let totalLoaded = 0;
				let totalSize = 0;
				for (const bytes of fileBytes.values()) {
					totalLoaded += bytes.loaded;
					totalSize += bytes.total;
				}
				if (totalSize === 0) return;

				const rounded = Math.floor((totalLoaded / totalSize) * 100);
				if (rounded !== lastReportedProgress) {
					lastReportedProgress = rounded;
					post({ type: "init-progress", progress: rounded });
				}
			},
		})) as unknown as AutomaticSpeechRecognitionPipeline;

		post({ type: "init-complete" });
	} catch (error) {
		post({
			type: "init-error",
			error: error instanceof Error ? error.message : "Failed to load model",
		});
	}
}

// ── Detección de idioma ──────────────────────────────────────────────────────

type PartesModelo = {
	processor: (audio: Float32Array) => Promise<{ input_features: Tensor }>;
	model: ((inputs: Record<string, unknown>) => Promise<{ logits: Tensor }>) & {
		generation_config?: {
			decoder_start_token_id?: number;
			lang_to_id?: Record<string, number>;
		};
	};
};

/**
 * ⚠️ transformers.js 3.8 NO detecta el idioma: sin `language`, un Whisper
 * multilingüe arranca con `<|en|>` («No language specified - defaulting to
 * English», models.js `_retrieve_init_tokens`). Un audio en español sale
 * TRADUCIDO o mal escrito en inglés, y el «Auto detect» de OpenCut hacía eso.
 *
 * Acá se hace lo que hace Whisper de verdad: un paso del decoder con sólo
 * `<|startoftranscript|>` y, de sus logits, el token de idioma más probable.
 */
async function detectarIdioma(audio: Float32Array): Promise<string | null> {
	if (!transcriber) return null;
	const partes = transcriber as unknown as PartesModelo;
	const config = partes.model.generation_config;
	const sot = config?.decoder_start_token_id;
	const idiomas = config?.lang_to_id;
	if (sot == null || !idiomas) return null;

	const { input_features } = await partes.processor(audio);
	const decoder_input_ids = new Tensor("int64", BigInt64Array.from([BigInt(sot)]), [1, 1]);
	const salida = await partes.model({ input_features, decoder_input_ids });
	const logits = salida.logits.data as Float32Array;
	// logits es [1, 1, vocab]: el único paso, de corrido.
	let mejor: string | null = null;
	let mejorValor = Number.NEGATIVE_INFINITY;
	for (const [token, id] of Object.entries(idiomas)) {
		const valor = logits[id];
		if (valor != null && valor > mejorValor) {
			mejorValor = valor;
			mejor = token.replace(/^<\|/, "").replace(/\|>$/, "");
		}
	}
	return mejor;
}

// ── Transcribir ──────────────────────────────────────────────────────────────

type Chunk = { text: string; timestamp: [number, number | null] };

function chunksDe(salida: unknown): Chunk[] {
	const r: AutomaticSpeechRecognitionOutput = Array.isArray(salida) ? salida[0] : salida;
	return ((r?.chunks ?? []) as unknown as Chunk[]).filter(
		(c) => c && typeof c.text === "string" && Array.isArray(c.timestamp),
	);
}

/**
 * Las marcas por palabra salen de alinear la atención cruzada (DTW). Cuando eso
 * se rompe (un backend que devuelve las atenciones mal, un modelo sin
 * `alignment_heads`) no siempre tira error: vuelve con NaN o con todas las
 * palabras en el mismo instante. Más de la mitad así = inservible.
 */
function marcasSirven(chunks: Chunk[], duracion: number): boolean {
	if (chunks.length === 0) return true;
	let malas = 0;
	for (const c of chunks) {
		const [ini, fin] = c.timestamp;
		if (!Number.isFinite(ini) || fin == null || !Number.isFinite(fin) || fin < ini || ini > duracion + 1) {
			malas++;
		}
	}
	const todasIguales = chunks.length > 3 && chunks.every((c) => c.timestamp[0] === chunks[0].timestamp[0]);
	return !todasIguales && malas <= chunks.length / 2;
}

/** El error que el servicio reconoce para cambiar de dispositivo. */
export const SIN_MARCAS_POR_PALABRA = "SIN_MARCAS_POR_PALABRA";

async function handleTranscribe({
	audio,
	language,
	exigirPalabras,
}: {
	audio: Float32Array;
	language: string | null;
	exigirPalabras: boolean;
}) {
	if (!transcriber) {
		post({ type: "transcribe-error", error: "Model not initialized" });
		return;
	}

	cancelled = false;
	const sr = DEFAULT_TRANSCRIPTION_SAMPLE_RATE;

	try {
		const trozos = trocearAudio({ muestras: audio, sampleRate: sr });
		const pasos = trozos.length + (language ? 0 : 1);
		let hechos = 0;
		const avanzar = () => {
			hechos++;
			post({ type: "transcribe-progress", progress: Math.round((hechos / Math.max(1, pasos)) * 100) });
		};
		post({ type: "transcribe-progress", progress: 0 });

		let idioma = language;
		if (!idioma && trozos.length > 0) {
			const primero = trozos[0];
			try {
				idioma = await detectarIdioma(audio.subarray(primero.desde, primero.hasta));
			} catch (error) {
				console.warn("[whisper] no se pudo detectar el idioma", error);
			}
			// Sin detección, español: el público de MaKo habla español, y el
			// default de transformers.js (inglés) traduce en vez de transcribir.
			idioma ??= "es";
			avanzar();
		}
		idioma ??= "es";

		const palabras: PalabraTranscrita[] = [];
		const textos: string[] = [];
		let porPalabra = true;

		for (const trozo of trozos) {
			if (cancelled) {
				post({ type: "cancelled" });
				return;
			}
			const sub = audio.subarray(trozo.desde, trozo.hasta);
			const offset = trozo.desde / sr;
			const duracion = sub.length / sr;
			const opciones = { language: idioma, task: "transcribe" } as const;

			let chunks: Chunk[] | null = null;
			if (porPalabra) {
				try {
					const crudo = await transcriber(sub, { ...opciones, return_timestamps: "word" });
					const candidatos = chunksDe(crudo);
					if (marcasSirven(candidatos, duracion)) chunks = candidatos;
					else console.warn("[whisper] marcas por palabra inservibles: sigo por frase");
				} catch (error) {
					console.warn("[whisper] las marcas por palabra fallaron: sigo por frase", error);
				}
				if (!chunks) {
					if (exigirPalabras) throw new Error(SIN_MARCAS_POR_PALABRA);
					porPalabra = false;
				}
			}

			if (chunks) {
				// Una marca NaN suelta (pasan `marcasSirven` si son pocas) toma el
				// final de la palabra anterior: un NaN que llega a la línea de tiempo
				// es un clip sin posición.
				let previo = 0;
				for (const c of chunks) {
					const texto = c.text.trim();
					if (!texto) continue;
					const t0 = Number.isFinite(c.timestamp[0]) ? c.timestamp[0] : previo;
					const t1 = c.timestamp[1] != null && Number.isFinite(c.timestamp[1]) ? c.timestamp[1] : t0;
					const ini = Math.max(0, Math.min(duracion, t0));
					const fin = Math.max(ini, Math.min(duracion, t1));
					previo = fin;
					palabras.push({ texto, inicio: offset + ini, fin: offset + fin });
					textos.push(texto);
				}
			} else {
				// Respaldo: tiempos por frase. Si esto también falla, el problema es
				// el dispositivo y el error sube (el servicio prueba con WASM).
				const crudo = await transcriber(sub, { ...opciones, return_timestamps: true });
				for (const c of chunksDe(crudo)) {
					const ini = Math.max(0, Math.min(duracion, c.timestamp[0] ?? 0));
					const fin = Math.max(ini, Math.min(duracion, c.timestamp[1] ?? duracion));
					for (const p of repartirPorLargo({ texto: c.text, inicio: offset + ini, fin: offset + fin })) {
						palabras.push(p);
						textos.push(p.texto);
					}
				}
			}
			avanzar();
		}

		if (cancelled) {
			post({ type: "cancelled" });
			return;
		}

		post({
			type: "transcribe-complete",
			text: textos.join(" "),
			palabras,
			precision: porPalabra ? "palabra" : "segmento",
			language: idioma,
		});
	} catch (error) {
		if (cancelled) {
			post({ type: "cancelled" });
			return;
		}
		post({
			type: "transcribe-error",
			error: error instanceof Error ? error.message : "Transcription failed",
		});
	}
}
