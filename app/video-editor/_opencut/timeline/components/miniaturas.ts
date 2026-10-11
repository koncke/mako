// =============================================================================
// Miniaturas de los clips de video: la tira continua de CapCut
// =============================================================================
// OpenCut dibujaba UNA miniatura (la del archivo) repetida a lo largo del clip.
// CapCut muestra la tira continua: cada recuadro es el cuadro del video que cae
// en ese punto. Acá se decodifican esos cuadros, chicos y bajo demanda (sólo
// los que se ven), y se guardan en memoria por archivo.
//
// ⚠️ NO usar `services/video-cache` para esto, aunque parezca lo obvio: ese
// caché es el del reproductor y numera los pedidos por archivo (una «generación»
// por `mediaId`); pedirle cuadros desde la línea de tiempo invalida el cuadro
// que el reproductor está esperando y la reproducción tartamudea. Este módulo
// abre su PROPIO `Input` de mediabunny por archivo, con un `CanvasSink` del
// tamaño de la miniatura.

import { ALL_FORMATS, BlobSource, CanvasSink, Input } from "mediabunny";

type Fuente = {
	input: Input;
	sinks: Map<number, CanvasSink>;
	/** Los pedidos a un mismo archivo van en fila (un decodificador por vez). */
	cola: Promise<void>;
	/** El primer cuadro no siempre está en 0: antes de él el sink devuelve `null`. */
	primerTiempo: number;
};

const fuentes = new Map<string, Promise<Fuente | null>>();
const cache = new Map<string, HTMLCanvasElement>();
const pendientes = new Set<string>();
/** Pedidos que el decodificador contestó sin cuadro: no se vuelven a pedir
 *  (si no, cada aviso re-dibuja, re-pide y decodifica de nuevo, sin fin). */
const sinCuadro = new Set<string>();
const oyentes = new Map<string, Set<() => void>>();
const fallidos = new Set<string>();

/** Tope de cuadros en memoria (todas las tiras): ~96 px de alto, unos 25 KB cada uno. */
const TOPE_CACHE = 1500;

const clave = (mediaId: string, alto: number, t: number) =>
	`${mediaId}|${alto}|${Math.round(t * 1000)}`;

function abrir(mediaId: string, file: File): Promise<Fuente | null> {
	let fuente = fuentes.get(mediaId);
	if (!fuente) {
		fuente = (async () => {
			try {
				const input = new Input({
					source: new BlobSource(file),
					formats: ALL_FORMATS,
				});
				const pista = await input.getPrimaryVideoTrack();
				if (!pista || !(await pista.canDecode())) {
					fallidos.add(mediaId);
					return null;
				}
				const primerTiempo = await pista.getFirstTimestamp().catch(() => 0);
				return { input, sinks: new Map(), cola: Promise.resolve(), primerTiempo };
			} catch {
				// Un archivo que no se decodifica deja la miniatura del archivo
				// repetida (lo de OpenCut): una tira vacía es peor que una repetida.
				fallidos.add(mediaId);
				return null;
			}
		})();
		fuentes.set(mediaId, fuente);
	}
	return fuente;
}

async function sinkDe(fuente: Fuente, alto: number): Promise<CanvasSink | null> {
	const ya = fuente.sinks.get(alto);
	if (ya) return ya;
	const pista = await fuente.input.getPrimaryVideoTrack();
	if (!pista) return null;
	const sink = new CanvasSink(pista, { height: alto, poolSize: 0 });
	fuente.sinks.set(alto, sink);
	return sink;
}

function avisar(mediaId: string) {
	for (const oyente of oyentes.get(mediaId) ?? []) oyente();
}

function guardar(k: string, lienzo: HTMLCanvasElement) {
	cache.set(k, lienzo);
	if (cache.size > TOPE_CACHE) {
		const masViejo = cache.keys().next().value;
		if (masViejo !== undefined) cache.delete(masViejo);
	}
}

/** El cuadro ya decodificado (o `null` si todavía no está). */
export function cuadroCacheado({
	mediaId,
	alto,
	tiempo,
}: {
	mediaId: string;
	alto: number;
	tiempo: number;
}): HTMLCanvasElement | null {
	const k = clave(mediaId, alto, tiempo);
	const lienzo = cache.get(k);
	if (lienzo) {
		// Al fondo de la fila del tope: lo que se está mirando no se descarta.
		cache.delete(k);
		cache.set(k, lienzo);
	}
	return lienzo ?? null;
}

export function miniaturasFallaron(mediaId: string): boolean {
	return fallidos.has(mediaId);
}

/**
 * Pide los cuadros que falten (tiempos de la fuente, en segundos). Avisa a los
 * oyentes del archivo a medida que llegan.
 */
export function pedirCuadros({
	mediaId,
	file,
	alto,
	tiempos,
}: {
	mediaId: string;
	file: File;
	alto: number;
	tiempos: number[];
}): void {
	if (fallidos.has(mediaId)) return;
	const faltan = [...new Set(tiempos)]
		.filter((t) => {
			const k = clave(mediaId, alto, t);
			return !cache.has(k) && !pendientes.has(k) && !sinCuadro.has(k);
		})
		.sort((a, b) => a - b);
	if (faltan.length === 0) return;
	for (const t of faltan) pendientes.add(clave(mediaId, alto, t));

	void abrir(mediaId, file).then((fuente) => {
		if (!fuente) {
			for (const t of faltan) pendientes.delete(clave(mediaId, alto, t));
			avisar(mediaId);
			return;
		}
		fuente.cola = fuente.cola.then(async () => {
			try {
				const sink = await sinkDe(fuente, alto);
				if (!sink) return;
				let i = 0;
				const pedidos = faltan.map((t) => Math.max(t, fuente.primerTiempo));
				for await (const envuelto of sink.canvasesAtTimestamps(pedidos)) {
					const t = faltan[i++];
					if (t === undefined) break;
					const k = clave(mediaId, alto, t);
					pendientes.delete(k);
					if (!envuelto) {
						sinCuadro.add(k);
						continue;
					}
					const origen = envuelto.canvas;
					const lienzo = document.createElement("canvas");
					lienzo.width = origen.width;
					lienzo.height = origen.height;
					lienzo.getContext("2d")?.drawImage(origen, 0, 0);
					guardar(k, lienzo);
					// Avisar de a varios: re-dibujar la tira por cada cuadro la traba.
					if (i % 6 === 0) avisar(mediaId);
				}
			} catch (error) {
				// Igual que un `null`: no se vuelve a pedir, o el aviso de abajo
				// re-dibuja, re-pide y vuelve a fallar en bucle.
				for (const t of faltan) {
					const k = clave(mediaId, alto, t);
					if (!cache.has(k)) sinCuadro.add(k);
				}
				console.warn("[miniaturas] no se pudieron decodificar cuadros", error);
			} finally {
				for (const t of faltan) pendientes.delete(clave(mediaId, alto, t));
				avisar(mediaId);
			}
		});
	});
}

export function escucharMiniaturas(
	mediaId: string,
	oyente: () => void,
): () => void {
	let set = oyentes.get(mediaId);
	if (!set) {
		set = new Set();
		oyentes.set(mediaId, set);
	}
	set.add(oyente);
	return () => {
		set?.delete(oyente);
	};
}

/** Un cuadro grande, para el diálogo «Portada». Resuelve `null` si no se puede. */
export async function cuadroGrande({
	mediaId,
	file,
	tiempo,
	alto = 360,
}: {
	mediaId: string;
	file: File;
	tiempo: number;
	alto?: number;
}): Promise<HTMLCanvasElement | null> {
	const ya = cuadroCacheado({ mediaId, alto, tiempo });
	if (ya) return ya;
	if (miniaturasFallaron(mediaId)) return null;
	return new Promise((resolve) => {
		const quitar = escucharMiniaturas(mediaId, () => {
			const listo = cuadroCacheado({ mediaId, alto, tiempo });
			if (listo || miniaturasFallaron(mediaId)) {
				quitar();
				resolve(listo);
			} else if (!pendientes.has(clave(mediaId, alto, tiempo))) {
				quitar();
				resolve(null);
			}
		});
		pedirCuadros({ mediaId, file, alto, tiempos: [tiempo] });
	});
}
