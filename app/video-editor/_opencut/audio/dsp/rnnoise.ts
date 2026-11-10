// =============================================================================
// RNNoise (la red que usa CapCut) cargada a mano, desde public/ve/wasm/
// =============================================================================
// El binario es RNNoise 0.2 compilado por Jitsi: el que trae embebido en base64
// `@jitsi/rnnoise-wasm@0.2.1` (dist/rnnoise-sync.js), copiado tal cual a
// public/ve/wasm/rnnoise-0.2-jitsi-0.2.1.wasm (licencias al lado). Se eligió
// ése, y no los de 150 KB (shiguredo / web-noise-suppressor), MIDIENDO: con un
// ruido que cambia, el modelo 0.1 bajaba las pausas −18 dB y el 0.2 −42
// (docs/hallazgos-video-editor.md). Pesa 1,4 MB y se baja sólo la primera vez
// que un clip pide «Reducir el ruido».
//
// Por qué a mano y no con el pegamento de Jitsi ni por el bundler: el pegamento
// es «web,worker» (no corre en los tests de node) y el cargador de wasm del
// bundler en Vercel pide un archivo que no existe (el `?dpl=`, ver
// wasm/opencut.ts). El .wasm sólo importa dos funciones de memoria, así que el
// pegamento entero son las de abajo. Los nombres van minimizados en el binario;
// el mapa sale de rnnoise-sync.js (`asm["h"]` = `_rnnoise_create`, etc.) y lo
// cuida tests/video-editor-ruido.test.ts mirando las importaciones y exportaciones.
//
// RNNoise trabaja a 48 kHz, en cuadros de 480 muestras escaladas a ±32768, y
// devuelve cada cuadro con RETRASO: medido con la correlación de una voz contra
// su salida, 960 muestras (20 ms) en este binario (el 0.1 da 480).

/** Versionada en el nombre: un deploy nuevo no puede servir un binario viejo de caché. */
export const URL_WASM_RNNOISE = "/ve/wasm/rnnoise-0.2-jitsi-0.2.1.wasm";

/** Muestras por cuadro, a 48 kHz. */
export const CUADRO_RNNOISE = 480;
export const SR_RNNOISE = 48000;
/** Lo que la salida llega tarde respecto de la entrada (medido, ver la cabecera). */
export const RETARDO_RNNOISE = 960;

/** Los nombres del binario de Jitsi (minimizados por emscripten). */
const NOMBRES = {
	modulo: "a",
	resize: "a",
	memcpy: "b",
	memoria: "c",
	ctors: "d",
	malloc: "e",
	crear: "h",
	destruir: "i",
	procesar: "j",
} as const;

export type EstadoRnnoise = {
	/** Procesa UN cuadro en el lugar (480 muestras a ±32768). Devuelve la probabilidad de voz. */
	procesar(cuadro: Float32Array): number;
	liberar(): void;
};

export type MotorRnnoise = { crear(): EstadoRnnoise };

type Exportado = WebAssembly.Memory | ((...args: number[]) => number);

export async function instanciarRnnoise(bytes: BufferSource): Promise<MotorRnnoise> {
	let memoria: WebAssembly.Memory | null = null;
	const env = {
		[NOMBRES.memcpy]: (destino: number, origen: number, n: number) => {
			if (memoria) new Uint8Array(memoria.buffer).copyWithin(destino, origen, origen + n);
		},
		[NOMBRES.resize]: (pedido: number) => {
			if (!memoria) return 0;
			const falta = (pedido >>> 0) - memoria.buffer.byteLength;
			if (falta <= 0) return 1;
			try {
				memoria.grow(Math.ceil(falta / 65536));
				return 1;
			} catch {
				return 0;
			}
		},
	};
	const { instance } = await WebAssembly.instantiate(bytes, { [NOMBRES.modulo]: env });
	const ex = instance.exports as Record<string, Exportado>;
	const fn = (nombre: string) => ex[nombre] as (...args: number[]) => number;
	memoria = ex[NOMBRES.memoria] as WebAssembly.Memory;
	fn(NOMBRES.ctors)();
	// Un solo par de búferes por motor: cada `procesar` es sincrónico de punta a punta.
	const entrada = fn(NOMBRES.malloc)(CUADRO_RNNOISE * 4);
	const salida = fn(NOMBRES.malloc)(CUADRO_RNNOISE * 4);
	const mem = memoria;
	return {
		crear() {
			const st = fn(NOMBRES.crear)(0);
			if (!st) throw new Error("RNNoise: no se pudo crear el estado");
			let vivo = true;
			return {
				procesar(cuadro) {
					if (!vivo) throw new Error("RNNoise: estado liberado");
					// Las vistas se arman en cada cuadro: si la memoria crece, el búfer viejo queda desprendido.
					new Float32Array(mem.buffer, entrada, CUADRO_RNNOISE).set(cuadro);
					const vad = fn(NOMBRES.procesar)(st, salida, entrada);
					cuadro.set(new Float32Array(mem.buffer, salida, CUADRO_RNNOISE));
					return vad;
				},
				liberar() {
					if (!vivo) return;
					vivo = false;
					fn(NOMBRES.destruir)(st);
				},
			};
		},
	};
}

let cargando: Promise<MotorRnnoise> | null = null;

/**
 * La dirección del binario, armada contra el ORIGEN de la página. En el worker de «Reducir el ruido»
 * (audio/ruido-hilo/worker.ts) `location` no es la página: Turbopack arranca los workers desde un `blob:` que hace
 * `importScripts` de sus chunks (`getWorkerBlobURL` en su runtime, con `TURBOPACK_WORKER_LOCATION = location.origin`),
 * y contra un `blob:` una ruta como `/ve/wasm/…` no se resuelve: `fetch` tira. Su `location.origin` sí es el de la página.
 */
export function direccionWasmRnnoise(origen: string | null = typeof location === "undefined" ? null : location.origin): string {
	// Un origen opaco («null»: un worker de `data:`) no sirve de base: queda la ruta, como antes.
	return origen && origen !== "null" ? new URL(URL_WASM_RNNOISE, origen).href : URL_WASM_RNNOISE;
}

/** El motor del navegador (o del worker): se baja e instancia una vez; si falla, el próximo pedido reintenta. */
export function motorRnnoise(): Promise<MotorRnnoise> {
	if (!cargando) {
		cargando = (async () => {
			const url = direccionWasmRnnoise();
			const respuesta = await fetch(url);
			if (!respuesta.ok) throw new Error(`No se pudo bajar la reducción de ruido (${respuesta.status} en ${url})`);
			return instanciarRnnoise(await respuesta.arrayBuffer());
		})().catch((error: unknown) => {
			cargando = null;
			throw error;
		});
	}
	return cargando;
}
