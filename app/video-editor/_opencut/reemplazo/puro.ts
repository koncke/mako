// =============================================================================
// «Reemplazar el clip» / «Sustituir»: las cuentas (sin editor ni WASM)
// =============================================================================
// Como CapCut (es-LA.po: `pc_replace_fragment`, `pc_replace_clip`): el clip
// nuevo ocupa el lugar del viejo con su MISMO id, inicio y duración, y conserva
// lo que se le hizo al clip: transición, animaciones, efectos, máscaras,
// fotogramas clave y la velocidad («El efecto de velocidad se aplicará de nuevo»,
// `velocity_speed_replace_will_process`). De la fuente se usa el principio
// (trimStart 0); elegir otro tramo no entra (plan §8).
//
// Lo que decide:
//   · Un video más corto que lo que el clip recorre de fuente (duración ×
//     velocidad media) se RECHAZA («El video actual es más corto que el clip
//     original», `pc_the_current_video_is_shorter_than_the_original_clip`). Una
//     foto sirve siempre.
//   · Puede cambiar de foto a video o al revés. Los params son los DECLARADOS del
//     tipo nuevo (las claves de `base(tipo)`): lo del tipo viejo que el nuevo no
//     tiene se cae (el volumen al pasar a foto), y lo sin declarar también, salvo
//     las marcas de la plantilla y el silencio de «Activar/Desactivar el clip».
//     Lo del ARCHIVO no pasa aunque viniera declarado: `audio.normalizar` (va con
//     la sonoridad medida del archivo viejo, audio/claves.ts) y `revertir.*`
//     (el clip nuevo no está revertido).
//   · Un HUECO de plantilla (plantillas/huecos.ts) cubre el MISMO rectángulo
//     donde se ve hoy (`rectoMostrado`): se recorta la fuente nueva a esa
//     proporción con `cubrirCelda` (plantillas/geometria.ts), se saca la marca de
//     muestra y, si el hueco lo pide, el video entra silenciado. Un clip que no es
//     hueco conserva su transform y su recorte.
//   · Llenar una MUESTRA llena todas las muestras de ese hueco (`objetivosDel-
//     Reemplazo`): en «Antes y después» el mismo «Antes» va entero y en la celda
//     de arriba. Si el video no alcanza para alguna, no se llena ninguna.
//
// Puro: lo que llega al motor entra por parámetro (los params por defecto `base`,
// los ticks por segundo `tps`, el tamaño de cada medio). Lo usan el comando
// (./comando.ts), el diálogo y el soltar, y el chat. Test:
// tests/video-editor-reemplazo.test.ts.

import type { ParamValues } from "@/app/video-editor/_opencut/params";
import type {
	ElementRef,
	ImageElement,
	SceneTracks,
	TimelineElement,
	TimelineTrack,
	VideoElement,
} from "@/app/video-editor/_opencut/timeline";
import type { MediaAsset } from "@/app/video-editor/_opencut/media/types";
import type { MediaTime } from "@/app/video-editor/_opencut/wasm";
import { NORMALIZAR } from "@/app/video-editor/_opencut/audio/claves";
import { rectDeParams } from "@/app/video-editor/_opencut/recorte/geometria";
import { velocidadMediaDe } from "@/app/video-editor/_opencut/retime/resolve";
import { cubrirCelda, paramsDeCubrir, type Rect, type Tamano } from "@/app/video-editor/_opencut/plantillas/geometria";
import { leerMarcas, MARCA, PREFIJO_PLANTILLA } from "@/app/video-editor/_opencut/plantillas/huecos";
import { huecosDe, plantillaPorId, type HuecoClip } from "@/lib/editor-video/plantillas";

export type ClipReemplazable = VideoElement | ImageElement;
export type Acepta = HuecoClip["acepta"];
export type MotivoReemplazo = "corto" | "tipo" | "sin-clip";

/** El medio que entra. `duracion` en segundos (los videos); sin tamaño, se lo toma como el lienzo. */
export type MedioReemplazo = {
	mediaId: string;
	type: "video" | "image";
	nombre: string;
	width?: number;
	height?: number;
	duracion?: number;
};

/** Los params por defecto de un tipo (buildDefaultParamValues de params/registry.ts). */
export type BaseParams = (tipo: "video" | "image") => ParamValues;

/** Lo que va del archivo viejo y no pasa al nuevo aunque esté declarado. */
const PREFIJOS_DEL_ARCHIVO = ["revertir."];
const CLAVES_DEL_ARCHIVO = new Set<string>([NORMALIZAR]);
/** Sin declarar, pero del CLIP y no del archivo (actions/use-editor-actions.ts, «alternar-clip»). */
const SILENCIADO_ANTES = "clip.silenciadoAntes";

export const esClipReemplazable = (e: TimelineElement | null | undefined): e is ClipReemplazable =>
	e?.type === "video" || e?.type === "image";

/** El medio de Multimedia como lo pide el reemplazo (sólo video o foto). */
export function medioDeAsset(asset: MediaAsset): MedioReemplazo | null {
	if (asset.type !== "video" && asset.type !== "image") return null;
	return {
		mediaId: asset.id,
		type: asset.type,
		nombre: asset.name,
		width: asset.width,
		height: asset.height,
		duracion: asset.duration,
	};
}

const pistas = (tracks: SceneTracks): TimelineTrack[] => [...tracks.overlay, tracks.main, ...tracks.audio];

/** El clip de `ref`; si cambió de pista (un lote del chat), se lo busca por id. */
export function buscarClip(
	tracks: SceneTracks,
	ref: ElementRef,
): { track: TimelineTrack; element: ClipReemplazable } | null {
	const enSuPista = pistas(tracks).find((t) => t.id === ref.trackId);
	const candidatas = enSuPista ? [enSuPista, ...pistas(tracks)] : pistas(tracks);
	for (const track of candidatas) {
		const element = (track.elements as TimelineElement[]).find((e) => e.id === ref.elementId);
		if (element) return esClipReemplazable(element) ? { track, element } : null;
	}
	return null;
}

/** ¿Es un clip de muestra de una plantilla (sin sustituir)? Lo usa el soltar. */
export function esMuestraEn(tracks: SceneTracks, ref: ElementRef): boolean {
	const clip = buscarClip(tracks, ref);
	return clip !== null && leerMarcas(clip.element.params)?.muestra === true;
}

/** Qué acepta el clip: lo que dice su hueco en el catálogo; un clip común, todo. */
export function aceptaDe(params: ParamValues): Acepta {
	const m = leerMarcas(params);
	if (!m?.hueco) return "ambos";
	const plantilla = plantillaPorId(m.plantilla);
	const hueco = plantilla ? huecosDe(plantilla).find((h) => h.nombre === m.hueco && h.tipo === "clip") : null;
	return hueco?.acepta ?? "ambos";
}

export const aceptaMedio = (acepta: Acepta, tipo: MedioReemplazo["type"]) =>
	acepta === "ambos" || (acepta === "video" ? tipo === "video" : tipo === "image");

/**
 * La grilla del diálogo: Multimedia sin los medios ocultos (muestras, cuadros congelados,
 * revertidos: `ephemeral`), sin el audio, y sólo lo que acepta el clip.
 */
export function mediosParaReemplazo<T extends Pick<MediaAsset, "type" | "ephemeral">>(
	medios: readonly T[],
	acepta: Acepta,
): Array<T & { type: "video" | "image" }> {
	return medios.filter(
		(m): m is T & { type: "video" | "image" } =>
			!m.ephemeral && (m.type === "video" || m.type === "image") && aceptaMedio(acepta, m.type),
	);
}

/** La fuente que recorre el clip, en ticks: duración × velocidad media (una foto no tiene velocidad). */
export function fuenteNecesaria(elemento: ClipReemplazable): number {
	const velocidad = elemento.type === "video" ? velocidadMediaDe(elemento.retime) : 1;
	return Math.round(elemento.duration * velocidad);
}

/** ¿Alcanza el medio para `necesita` ticks de fuente? Una foto, siempre. */
export function alcanza(medio: Pick<MedioReemplazo, "type" | "duracion">, necesita: number, tps: number): boolean {
	return medio.type !== "video" || Math.round((medio.duracion ?? 0) * tps) >= necesita;
}

const num = (v: unknown, porDefecto: number) => (typeof v === "number" && Number.isFinite(v) ? v : porDefecto);

/**
 * Dónde se ve hoy el clip, en px del lienzo desde arriba a la izquierda (sin giro):
 * la fuente recortada (`recorte.*`), encajada en el lienzo como hace el compositor
 * (`min(W / ancho, H / alto)`, frame-descriptor.ts), por la escala, en su posición.
 */
export function rectoMostrado({ params, fuente, lienzo }: { params: ParamValues; fuente: Tamano; lienzo: Tamano }): Rect {
	const recorte = rectDeParams(params);
	const w = fuente.width * recorte.ancho;
	const h = fuente.height * recorte.alto;
	const encaje = Math.min(lienzo.width / w, lienzo.height / h);
	const ancho = w * encaje * Math.abs(num(params["transform.scaleX"], 1));
	const alto = h * encaje * Math.abs(num(params["transform.scaleY"], 1));
	const cx = lienzo.width / 2 + num(params["transform.positionX"], 0);
	const cy = lienzo.height / 2 + num(params["transform.positionY"], 0);
	return { x: cx - ancho / 2, y: cy - alto / 2, ancho, alto };
}

/** Los params que pasan del clip viejo al nuevo (ver la cabecera). */
function paramsConservados(elemento: ClipReemplazable, tipo: MedioReemplazo["type"], base: BaseParams): ParamValues {
	const params: ParamValues = { ...base(tipo) };
	for (const clave of Object.keys(params)) {
		if (CLAVES_DEL_ARCHIVO.has(clave) || PREFIJOS_DEL_ARCHIVO.some((p) => clave.startsWith(p))) continue;
		const valor = elemento.params[clave];
		if (valor !== undefined) params[clave] = valor;
	}
	for (const [clave, valor] of Object.entries(elemento.params)) {
		if (clave.startsWith(PREFIJO_PLANTILLA) && clave !== MARCA.muestra) params[clave] = valor;
	}
	if (tipo === "video" && elemento.type === "video" && elemento.params[SILENCIADO_ANTES] !== undefined) {
		params[SILENCIADO_ANTES] = elemento.params[SILENCIADO_ANTES];
	}
	return params;
}

export type Reemplazado = { ok: true; elemento: ClipReemplazable } | { ok: false; motivo: MotivoReemplazo };

/** El clip `elemento` con el medio `medio` (mismo id, inicio y duración). */
export function elementoReemplazado({
	elemento,
	medio,
	tps,
	lienzo,
	fuenteActual,
	base,
}: {
	elemento: ClipReemplazable;
	medio: MedioReemplazo;
	tps: number;
	lienzo: Tamano;
	/** El tamaño del medio que tiene HOY (para saber dónde se ve). */
	fuenteActual: Tamano;
	base: BaseParams;
}): Reemplazado {
	if (!aceptaMedio(aceptaDe(elemento.params), medio.type)) return { ok: false, motivo: "tipo" };
	const necesita = fuenteNecesaria(elemento);
	if (!alcanza(medio, necesita, tps)) return { ok: false, motivo: "corto" };

	let params = paramsConservados(elemento, medio.type, base);
	const marcas = leerMarcas(elemento.params);
	if (marcas?.hueco) {
		const celda = rectoMostrado({ params: elemento.params, fuente: fuenteActual, lienzo });
		const fuente =
			medio.width && medio.height ? { width: medio.width, height: medio.height } : { width: lienzo.width, height: lienzo.height };
		params = { ...params, ...paramsDeCubrir(cubrirCelda({ fuente, celda, lienzo })) };
		if (medio.type === "video" && marcas.silenciar) params.muted = true;
	}

	const comun = {
		id: elemento.id,
		name: medio.nombre,
		mediaId: medio.mediaId,
		startTime: elemento.startTime,
		duration: elemento.duration,
		trimStart: 0 as MediaTime,
		hidden: elemento.hidden ?? false,
		params,
		...(elemento.animations ? { animations: elemento.animations } : {}),
		...(elemento.effects?.length ? { effects: elemento.effects } : {}),
		...(elemento.masks?.length ? { masks: elemento.masks } : {}),
	};
	if (medio.type === "image") return { ok: true, elemento: { ...comun, type: "image", trimEnd: 0 as MediaTime } };
	const fuente = Math.round((medio.duracion ?? 0) * tps);
	const retime = elemento.type === "video" ? elemento.retime : undefined;
	return {
		ok: true,
		elemento: {
			...comun,
			type: "video",
			trimEnd: (fuente - necesita) as MediaTime,
			sourceDuration: fuente as MediaTime,
			isSourceAudioEnabled: true,
			...(retime ? { retime } : {}),
		},
	};
}

/**
 * Qué se reemplaza al reemplazar `ref`: el clip y, si es una MUESTRA, las otras
 * muestras del mismo hueco (misma plantilla y nombre; las de una pista bloqueada
 * no). El clip pedido va primero.
 */
export function objetivosDelReemplazo(tracks: SceneTracks, ref: ElementRef): ElementRef[] {
	const clip = buscarClip(tracks, ref);
	if (!clip) return [];
	const propio = { trackId: clip.track.id, elementId: clip.element.id };
	const m = leerMarcas(clip.element.params);
	if (!m?.muestra || !m.hueco) return [propio];
	const hermanas: ElementRef[] = [];
	for (const track of [...tracks.overlay, tracks.main]) {
		if (track.locked) continue;
		for (const e of track.elements as TimelineElement[]) {
			if (e.id === clip.element.id || !esClipReemplazable(e)) continue;
			const otra = leerMarcas(e.params);
			if (otra?.muestra && otra.plantilla === m.plantilla && otra.hueco === m.hueco) {
				hermanas.push({ trackId: track.id, elementId: e.id });
			}
		}
	}
	return [propio, ...hermanas];
}

/** Lo que pide el reemplazo de `ref` (el diálogo apaga lo que no sirve): qué acepta y cuánta fuente. */
export function requisitosDelReemplazo(
	tracks: SceneTracks,
	ref: ElementRef,
): { acepta: Acepta; necesita: number; esVideo: boolean } | null {
	const clip = buscarClip(tracks, ref);
	if (!clip) return null;
	const necesita = Math.max(
		0,
		...objetivosDelReemplazo(tracks, ref).map((o) => {
			const otro = buscarClip(tracks, o);
			return otro ? fuenteNecesaria(otro.element) : 0;
		}),
	);
	return { acepta: aceptaDe(clip.element.params), necesita, esVideo: clip.element.type === "video" };
}

/** Las pistas con los elementos de `nuevos` (por id) en lugar de los viejos; lo demás, intacto. */
export function conElementos(tracks: SceneTracks, nuevos: ReadonlyMap<string, TimelineElement>): SceneTracks {
	function pista<T extends TimelineTrack>(track: T): T {
		if (!(track.elements as TimelineElement[]).some((e) => nuevos.has(e.id))) return track;
		return { ...track, elements: (track.elements as TimelineElement[]).map((e) => nuevos.get(e.id) ?? e) } as T;
	}
	return { overlay: tracks.overlay.map(pista), main: pista(tracks.main), audio: tracks.audio.map(pista) };
}

/** La línea de tiempo con `ref` (y sus hermanas de muestra) reemplazados por `medio`. */
export function lineaReemplazada({
	tracks,
	ref,
	medio,
	tps,
	lienzo,
	tamanoDe,
	base,
}: {
	tracks: SceneTracks;
	ref: ElementRef;
	medio: MedioReemplazo;
	tps: number;
	lienzo: Tamano;
	/** El tamaño de un medio de la biblioteca (null si no se sabe: se toma el lienzo). */
	tamanoDe: (mediaId: string) => Tamano | null;
	base: BaseParams;
}): { ok: true; tracks: SceneTracks; objetivos: ElementRef[] } | { ok: false; motivo: MotivoReemplazo } {
	const objetivos = objetivosDelReemplazo(tracks, ref);
	if (objetivos.length === 0) return { ok: false, motivo: "sin-clip" };
	const nuevos = new Map<string, TimelineElement>();
	for (const o of objetivos) {
		const clip = buscarClip(tracks, o);
		if (!clip) return { ok: false, motivo: "sin-clip" };
		const r = elementoReemplazado({
			elemento: clip.element,
			medio,
			tps,
			lienzo,
			fuenteActual: tamanoDe(clip.element.mediaId) ?? lienzo,
			base,
		});
		if (!r.ok) return r;
		nuevos.set(clip.element.id, r.elemento);
	}
	return { ok: true, tracks: conElementos(tracks, nuevos), objetivos };
}
