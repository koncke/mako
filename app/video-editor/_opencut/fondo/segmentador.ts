// =============================================================================
// El segmentador de personas de «Eliminación automática» (MediaPipe, en el navegador)
// =============================================================================
// CapCut recorta a la persona con un modelo que corre en la PC (su carpeta
// `mattingmodel/`); acá, con el ImageSegmenter de @mediapipe/tasks-vision
// (Apache-2.0) y el modelo «selfie» (Apache-2.0, 244 KB), sin costo y sin mandar
// el video a ningún lado (diseño §1.6: nada que cobre por default).
//
//   · UNO por pestaña, perezoso: se crea la primera vez que un clip lo pide (el
//     interruptor del panel o un proyecto que ya lo tenía prendido) y se reusa
//     para todos los clips y cuadros.
//   · Modo IMAGEN, no VIDEO: el modo video exige timestamps crecientes, y acá
//     se segmentan varios clips alternados y se salta hacia atrás con el
//     cabezal; además cada cuadro sale igual en el reproductor y en el export.
//   · Delegado GPU (WebGL2 propio de MediaPipe) y, si no se puede, CPU. Si la
//     GPU falla con el segmentador ya andando (contexto perdido), se descarta y
//     el próximo cuadro lo vuelve a crear en CPU.
//   · El .wasm (13 MB) sale del CDN de jsdelivr con la versión FIJA: el JS de
//     npm y el wasm tienen que ser de la MISMA versión (lo cuida
//     tests/video-editor-fondo.test.ts contra node_modules). El modelo sale de
//     public/ve/modelos (exento del proxy por ruta) y, si no está, del bucket de
//     MediaPipe con la versión fija.
//   · Si no carga, el clip se ve SIN recortar y un aviso (el de CapCut): un
//     cuadro sin recortar es mejor que un cuadro que no sale. Queda en «fallo»
//     hasta que la persona vuelva a prender el interruptor (`reintentar`).

import type { ImageSegmenter } from "@mediapipe/tasks-vision";
import { toast } from "sonner";

/** La de package.json / node_modules. El wasm del CDN tiene que ser ESTA. */
export const VERSION_MEDIAPIPE = "1.1.0";
export const RUTA_WASM = `https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@${VERSION_MEDIAPIPE}/wasm`;
export const MODELOS_SELFIE = [
	"/ve/modelos/selfie_segmenter.tflite",
	"https://storage.googleapis.com/mediapipe-models/image_segmenter/selfie_segmenter/float16/1/selfie_segmenter.tflite",
] as const;

// es-LA.po de CapCut: `pc_smart_key_error_try_again`.
export const TEXTO_FALLO = "No se puede eliminar el fondo automáticamente. Intenta de nuevo.";

export type EstadoSegmentador = "inactivo" | "cargando" | "listo" | "fallo";

/**
 * Tope de la carga. El render ESPERA al segmentador (recorte-persona.ts,
 * `preparar`): un <script> del CDN que nunca contesta (un bloqueador, una red
 * que se cuelga) dejaría el reproductor y el export parados para siempre. Con
 * 13 MB de wasm la primera vez, 2 min alcanzan aun con una red lenta.
 */
const TOPE_CARGA_MS = 120_000;

let estado: EstadoSegmentador = "inactivo";
let segmentador: ImageSegmenter | null = null;
let delegado: "GPU" | "CPU" = "GPU";
let carga: Promise<boolean> | null = null;
let errorAvisado = false;
const oyentes = new Set<() => void>();

function fijar(nuevo: EstadoSegmentador): void {
	if (estado === nuevo) return;
	estado = nuevo;
	for (const o of oyentes) o();
}

export function estadoSegmentador(): EstadoSegmentador {
	return estado;
}

/** Para `useSyncExternalStore` (el panel muestra «Cargando…» o el aviso). */
export function suscribirSegmentador(oyente: () => void): () => void {
	oyentes.add(oyente);
	return () => oyentes.delete(oyente);
}

/** Una falla anterior no se reintenta sola: sólo cuando la persona vuelve a prenderlo. */
export function reintentarSegmentador(): void {
	if (estado === "fallo") {
		errorAvisado = false;
		fijar("inactivo");
	}
}

/** El archivo del modelo, validado: un 200 puede ser la página de login (hallazgos, «El proxy y public/»). */
async function bajarModelo(): Promise<Uint8Array> {
	let ultimo: unknown = null;
	for (const url of MODELOS_SELFIE) {
		try {
			const res = await fetch(url);
			if (!res.ok) throw new Error(`HTTP ${res.status}`);
			const bytes = new Uint8Array(await res.arrayBuffer());
			// Un .tflite es un flatbuffer con el identificador «TFL3» en los bytes 4–7.
			const id = String.fromCharCode(bytes[4] ?? 0, bytes[5] ?? 0, bytes[6] ?? 0, bytes[7] ?? 0);
			if (id !== "TFL3") throw new Error("no es un modelo TFLite");
			return bytes;
		} catch (error) {
			ultimo = error;
			console.warn(`[fondo] no pude bajar el modelo de ${url}`, error);
		}
	}
	throw ultimo ?? new Error("sin modelo");
}

async function crear(): Promise<ImageSegmenter> {
	const { FilesetResolver, ImageSegmenter: Segmentador } = await import("@mediapipe/tasks-vision");
	const [archivos, modelo] = await Promise.all([FilesetResolver.forVisionTasks(RUTA_WASM), bajarModelo()]);
	const con = (d: "GPU" | "CPU") =>
		Segmentador.createFromOptions(archivos, {
			// Una copia por intento: el búfer se pasa al heap del wasm.
			baseOptions: { modelAssetBuffer: modelo.slice(), delegate: d },
			runningMode: "IMAGE",
			outputConfidenceMasks: true,
			outputCategoryMask: false,
		});
	if (delegado === "GPU") {
		try {
			return await con("GPU");
		} catch (error) {
			console.warn("[fondo] sin GPU para el segmentador, va por CPU", error);
			delegado = "CPU";
		}
	}
	return con("CPU");
}

/**
 * Carga el segmentador si hace falta. Nunca rechaza: devuelve si quedó listo.
 * Llamadas simultáneas comparten la misma carga.
 */
export function cargarSegmentador(): Promise<boolean> {
	if (estado === "listo" && segmentador) return Promise.resolve(true);
	if (estado === "fallo") return Promise.resolve(false);
	if (carga) return carga;
	fijar("cargando");
	let vencida = false;
	let vencer: ReturnType<typeof setTimeout> | undefined;
	const tope = new Promise<never>((_, rechazar) => {
		vencer = setTimeout(() => {
			vencida = true;
			rechazar(new Error(`la carga tardó más de ${TOPE_CARGA_MS / 1000} s`));
		}, TOPE_CARGA_MS);
	});
	const creado = crear();
	// Si vence el tope y el segmentador llega igual después, se cierra: ya se
	// avisó la falla, y otro clic en el interruptor crea uno nuevo.
	creado.then(
		(s) => {
			if (vencida) s.close();
		},
		() => {},
	);
	const enCurso: Promise<boolean> = Promise.race([creado, tope])
		.then((s) => {
			segmentador = s;
			fijar("listo");
			return true;
		})
		.catch((error: unknown) => {
			console.error("[fondo] no se pudo cargar el segmentador", error);
			fijar("fallo");
			avisarFallo();
			return false;
		})
		.finally(() => {
			clearTimeout(vencer);
			if (carga === enCurso) carga = null;
		});
	carga = enCurso;
	return enCurso;
}

function avisarFallo(): void {
	if (errorAvisado) return;
	errorAvisado = true;
	toast.error(TEXTO_FALLO);
}

/**
 * Segmenta `imagen` y le pasa a `usar` la máscara de confianza mientras es
 * válida (MediaPipe la garantiza sólo durante su callback). Devuelve `false` si
 * el segmentador no está listo o falló; en ese caso el cuadro va sin recortar.
 */
export function segmentarPersona(
	imagen: OffscreenCanvas | HTMLCanvasElement,
	usar: (mascara: { confianza: Float32Array; esDeFondo: boolean }) => void,
): boolean {
	if (estado !== "listo" || !segmentador) return false;
	let hecho = false;
	try {
		segmentador.segment(imagen, (resultado) => {
			const mascaras = resultado.confidenceMasks;
			if (!mascaras || mascaras.length === 0) return;
			// Con dos o más máscaras la 0 es el FONDO (así lo documenta MediaPipe para
			// el selfie, y el multiclase también); con una sola, es la del rótulo
			// «selfie» del modelo: la persona.
			usar({ confianza: mascaras[0].getAsFloat32Array(), esDeFondo: mascaras.length >= 2 });
			hecho = true;
		});
	} catch (error) {
		console.error(`[fondo] la segmentación falló (${delegado})`, error);
		descartar();
		if (delegado === "GPU") {
			// Lo más común es el contexto WebGL perdido: el próximo cuadro lo
			// vuelve a crear, ya en CPU.
			delegado = "CPU";
			fijar("inactivo");
		} else {
			fijar("fallo");
			avisarFallo();
		}
		return false;
	}
	return hecho;
}

function descartar(): void {
	try {
		segmentador?.close();
	} catch {
		// Ya estaba roto: no hay nada que cerrar.
	}
	segmentador = null;
}
