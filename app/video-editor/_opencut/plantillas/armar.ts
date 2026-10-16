// =============================================================================
// Plantillas: de la definición a la línea de tiempo («Utilizar plantilla»)
// =============================================================================
// Arma las pistas de una plantilla (lib/editor-video/plantillas.ts) en un lienzo de
// verdad: cada pieza pasa a un elemento del motor con sus params, sus animaciones,
// su transición y sus marcas (./huecos.ts). Lo aplica _opencut/plantillas/
// instanciar.ts en UN paso de deshacer; acá no hay editor.
//
// Las cuentas (plan §1.3):
//   · Tiempo     ticks = round(round(s·fps)/fps · tps): cae en un cuadro. La
//                duración es fin − inicio en ticks: dos piezas pegadas comparten
//                el borde exacto (si no, el imán abre un hueco de un tick).
//   · Letra      fontSize = round1(px·f·90/H): el motor mide la letra contra el
//                ALTO (text/typography.ts); en 9:16 el número es igual en cualquier
//                tamaño de lienzo.
//   · Relleno    background.padding = round(em·H/6): el motor lo multiplica por
//                fontSize/15 (text/primitives.ts), así que da em veces la letra.
//   · Ancla      arriba → el borde de arriba de la caja (con su tarjeta) en y·f;
//                abajo → el de abajo; centro → el medio. Margen lateral 0,11 a los
//                dos lados: centrado, la tarjeta queda centrada; a la izquierda, el
//                borde de la TARJETA (no el de la letra) va en el margen.
//   · Animación  lo mismo que el panel al elegir (animaciones/elegir.ts):
//                cambiosAlElegir y después cambiosDeDuracion.
//   · Clip       recortado para CUBRIR su celda (./geometria.ts); sin celda, el
//                lienzo entero.
//   · Forma      un rectángulo de la fuente de 512 se ve de min(W, H) a escala 1
//                (graphic-node.ts + resolve.ts): escala = lado·f / min(W, H).
//
// Puro: TODO lo que llega al WASM entra por parámetro (molde: transcripcion/
// cortar.ts con `tps` y `dividir`): los params por defecto de cada tipo (`base`,
// params/registry.ts), `tps`, `fps`, la medida del texto (`medir`, que en el
// navegador es partirYUbicar) y los ids. Con test (tests/video-editor-plantillas.test.ts).

import type { ParamValue, ParamValues } from "@/app/video-editor/_opencut/params";
import type {
	GraphicElement,
	ImageElement,
	OverlayTrack,
	SceneTracks,
	TextElement,
	TimelineElement,
	VideoElement,
	VideoTrack,
} from "@/app/video-editor/_opencut/timeline";
import type { MediaTime } from "@/app/video-editor/_opencut/wasm";
import type { partirYUbicar, Ubicacion } from "@/app/video-editor/_opencut/subtitles/build-subtitle-text-element";
import { cambiosAlElegir, cambiosDeDuracion } from "@/app/video-editor/_opencut/animaciones/elegir";
import { TEXTO } from "@/app/video-editor/_opencut/params/extra/texto";
import { EFECTOS_TEXTO } from "@/app/video-editor/_opencut/text/estilos-predefinidos";
import { FONT_SIZE_SCALE_REFERENCE } from "@/app/video-editor/_opencut/text/typography";
import { PARAM_TRANSICION_DURACION, PARAM_TRANSICION_ID } from "@/app/video-editor/_opencut/transiciones/claves";
import { buildEmptyTrack } from "@/app/video-editor/_opencut/timeline/placement/track-factory";
import {
	huecosDe,
	largoTexto,
	LIENZO_REF,
	MARGEN_TEXTO,
	type Anim,
	type Celda,
	type PiezaClip,
	type PiezaForma,
	type PiezaTexto,
	type PistaPlantilla,
	type Plantilla,
} from "@/lib/editor-video/plantillas";
import { cubrirCelda, paramsDeCubrir, type Rect } from "./geometria";
import { codificarAncla, MARCA, type AnclaTexto } from "./huecos";

/** partirYUbicar (subtitles/build-subtitle-text-element.ts): llega al WASM, entra por parámetro. */
export type Medir = typeof partirYUbicar;
export type Lienzo = { width: number; height: number };
export type TipoBase = "video" | "image" | "text" | "graphic";
/** La imagen de muestra de un rótulo, ya guardada como medio oculto. */
export type MuestraClip = { mediaId: string; width: number; height: number };
/** Un medio de Multimedia para un hueco. `duracion` en segundos (los videos). */
export type MedioHueco = {
	mediaId: string;
	type: "video" | "image";
	width: number;
	height: number;
	duracion?: number;
	nombre: string;
};

export type ArmarLinea = {
	plantilla: Plantilla;
	lienzo: Lienzo;
	fps: number;
	tps: number;
	/** La pista principal de la escena: conserva su id (la vinculación la nombra). */
	principal: VideoTrack;
	/** Rótulo del hueco («Tu clip», «Antes»…; "" el cierre) → su muestra. */
	muestras: Record<string, MuestraClip>;
	/** Nombre del hueco → el medio que lo llena. */
	medios?: Record<string, MedioHueco>;
	/** Nombre del hueco → su texto. */
	textos?: Record<string, string>;
	/** Los params por defecto del tipo (buildDefaultElementParams; la forma, con los del rectángulo). */
	base: (tipo: TipoBase, definicion?: string) => ParamValues;
	medir: Medir;
	nuevoId: () => string;
};

const r1 = (v: number) => Math.round(v * 10) / 10;
const r2 = (v: number) => Math.round(v * 100) / 100;
const r4 = (v: number) => Math.round(v * 10_000) / 10_000;

/** Segundos de la plantilla → ticks, en un cuadro de `fps`. */
export function ticksEnCuadro(s: number, fps: number, tps: number): number {
	return Math.round((Math.round(s * fps) / fps) * tps);
}

/** El factor de LIENZO_REF al lienzo (en 9:16, el mismo en X y en Y). */
export const factorLienzo = (lienzo: Lienzo) => lienzo.width / LIENZO_REF.ancho;

export function escalarCelda(c: Celda, f: number): Rect {
	return { x: c.x * f, y: c.y * f, ancho: c.ancho * f, alto: c.alto * f };
}

/** fontSize del motor para una letra de `px` (px de LIENZO_REF). */
export function tamanoLetra(px: number, lienzo: Lienzo): number {
	return r1((px * factorLienzo(lienzo) * FONT_SIZE_SCALE_REFERENCE) / lienzo.height);
}

/** background.paddingX/Y para un relleno de `em` veces la letra. */
export function rellenoParam(em: number, lienzo: Lienzo): number {
	return Math.round((em * lienzo.height * 15) / FONT_SIZE_SCALE_REFERENCE);
}

/** Los params de animación de una pieza, como si se eligieran en el panel (en orden: entrada, salida, bucle). */
export function paramsDeAnimacion(
	anim: Anim | undefined,
	tipo: TipoBase,
	D: number,
	valores: ParamValues = {},
): Record<string, ParamValue> {
	const cambios: Record<string, ParamValue> = {};
	let actuales: ParamValues = { ...valores };
	for (const categoria of ["entrada", "salida", "bucle"] as const) {
		const elegida = anim?.[categoria];
		if (!elegida) continue;
		const [id, segundos] = elegida;
		const alElegir = cambiosAlElegir({ valores: actuales, tipo, D }, categoria, id);
		actuales = { ...actuales, ...alElegir };
		const deDuracion = cambiosDeDuracion({ valores: actuales, tipo, D }, categoria, segundos);
		actuales = { ...actuales, ...deDuracion };
		Object.assign(cambios, alElegir, deDuracion);
	}
	return cambios;
}

/** El ancla de una marca, en la `Ubicacion` de partirYUbicar (y lo que hay que correr después, al centro). */
export function ubicacionDeAncla(ancla: AnclaTexto, lienzo: Lienzo): { ubicacion: Ubicacion; desplazarY: number } {
	const y = ancla.y * factorLienzo(lienzo);
	const margenes = { margenIzquierdo: ancla.margen, margenDerecho: ancla.margen };
	if (ancla.borde === "arriba") return { ubicacion: { vertical: "top", margenPx: y, ...margenes }, desplazarY: 0 };
	if (ancla.borde === "abajo") return { ubicacion: { bordeInferior: y - lienzo.height / 2, ...margenes }, desplazarY: 0 };
	return { ubicacion: { vertical: "middle", ...margenes }, desplazarY: y - lienzo.height / 2 };
}

/**
 * Parte y ubica un texto según su ancla. Lo usan el armado y, al cambiar el texto de
 * un hueco (el chat), quien lo vuelve a ubicar: `repartir` junta los saltos de antes.
 */
export function ubicarTexto({
	params,
	ancla,
	lienzo,
	medir,
	repartir = false,
}: {
	params: ParamValues;
	ancla: AnclaTexto;
	lienzo: Lienzo;
	medir: Medir;
	repartir?: boolean;
}): ReturnType<Medir> {
	const { ubicacion, desplazarY } = ubicacionDeAncla(ancla, lienzo);
	const r = medir({ params, lienzo, ubicacion, repartir });
	if (!desplazarY) return r;
	return { ...r, "transform.positionY": r1(Number(r["transform.positionY"] ?? 0) + desplazarY) };
}

/** Lo que cada pista de la plantilla es en el motor, de ARRIBA hacia abajo (la principal va aparte). */
const SUPERPUESTAS: ReadonlyArray<{ pista: PistaPlantilla; tipo: "text" | "graphic" | "video" }> = [
	{ pista: "texto-1", tipo: "text" },
	{ pista: "texto-2", tipo: "text" },
	{ pista: "texto-3", tipo: "text" },
	{ pista: "texto-4", tipo: "text" },
	{ pista: "forma-1", tipo: "graphic" },
	{ pista: "video-1", tipo: "video" },
];

const nombreCorto = (s: string) => (s.split("\n")[0] ?? s).slice(0, 40);

export function armarLinea(a: ArmarLinea): { tracks: SceneTracks; descartes: string[] } {
	const { plantilla, lienzo, fps, tps, base, medir, nuevoId } = a;
	const f = factorLienzo(lienzo);
	const ticks = (s: number) => ticksEnCuadro(s, fps, tps);
	const descartes: string[] = [];
	const huecos = new Map(huecosDe(plantilla).map((h) => [h.nombre, h]));

	// Un video llena el hueco sólo si alcanza para su pieza más larga (CapCut rechaza
	// el más corto: `pc_the_current_video_is_shorter_than_the_original_clip`).
	const necesita = (nombre: string) =>
		Math.max(
			0,
			...plantilla.piezas
				.filter((p): p is PiezaClip => p.tipo === "clip" && p.hueco.nombre === nombre)
				.map((p) => ticks(p.fin) - ticks(p.inicio)),
		);
	const medios = new Map<string, MedioHueco>();
	for (const [nombre, medio] of Object.entries(a.medios ?? {})) {
		const h = huecos.get(nombre);
		if (!h || h.tipo !== "clip") {
			descartes.push(`"${nombre}" no es un hueco de clip de esta plantilla`);
		} else if ((h.acepta === "video" && medio.type !== "video") || (h.acepta === "imagen" && medio.type !== "image")) {
			descartes.push(`"${nombre}" acepta sólo ${h.acepta === "video" ? "video" : "imagen"}`);
		} else if (medio.type === "video" && Math.round((medio.duracion ?? 0) * tps) < necesita(nombre)) {
			descartes.push(`"${nombre}": el video dura ${r1(medio.duracion ?? 0)} s y el hueco pide ${h.segundos} s`);
		} else {
			medios.set(nombre, medio);
		}
	}
	const textos = new Map<string, string>();
	for (const [nombre, texto] of Object.entries(a.textos ?? {})) {
		const h = huecos.get(nombre);
		const t = texto.trim();
		if (!h || h.tipo !== "texto") descartes.push(`"${nombre}" no es un hueco de texto de esta plantilla`);
		else if (!t || largoTexto(t) > (h.maxCaracteres ?? 0)) descartes.push(`"${nombre}" admite hasta ${h.maxCaracteres} caracteres`);
		else textos.set(nombre, t);
	}

	const marcas = (extra: ParamValues): ParamValues => ({ [MARCA.id]: plantilla.id, ...extra });

	function clip(pieza: PiezaClip, inicio: number, duracion: number): VideoElement | ImageElement {
		const medio = medios.get(pieza.hueco.nombre);
		const muestra = a.muestras[pieza.hueco.rotulo];
		if (!medio && !muestra) throw new Error(`Falta la muestra «${pieza.hueco.rotulo}» de la plantilla ${plantilla.id}`);
		const fuente = medio ?? (muestra as MuestraClip);
		const tipo = medio?.type ?? "image";
		const celda = pieza.celda ? escalarCelda(pieza.celda, f) : { x: 0, y: 0, ancho: lienzo.width, alto: lienzo.height };
		let params: ParamValues = {
			...base(tipo),
			...paramsDeCubrir(cubrirCelda({ fuente: { width: fuente.width, height: fuente.height }, celda, lienzo })),
		};
		params = { ...params, ...paramsDeAnimacion(pieza.animacion, tipo, duracion / tps, params) };
		if (pieza.transicion) {
			params[PARAM_TRANSICION_ID] = pieza.transicion.id;
			params[PARAM_TRANSICION_DURACION] = pieza.transicion.duracion;
		}
		if (tipo === "video" && pieza.silenciar) params.muted = true;
		params = {
			...params,
			...marcas({ [MARCA.hueco]: pieza.hueco.nombre }),
			...(medio ? {} : { [MARCA.muestra]: true }),
			...(pieza.hueco.opcional ? { [MARCA.opcional]: true } : {}),
			...(pieza.silenciar ? { [MARCA.silenciar]: true } : {}),
		};
		const comun = {
			id: nuevoId(),
			mediaId: fuente.mediaId,
			name: medio?.nombre ?? (pieza.hueco.rotulo || "Cierre"),
			startTime: inicio as MediaTime,
			duration: duracion as MediaTime,
			trimStart: 0 as MediaTime,
			hidden: false,
			params,
		};
		if (tipo === "image") return { ...comun, type: "image", trimEnd: 0 as MediaTime };
		const fuenteTicks = Math.round((medio?.duracion ?? 0) * tps);
		return {
			...comun,
			type: "video",
			trimEnd: (fuenteTicks - duracion) as MediaTime,
			sourceDuration: fuenteTicks as MediaTime,
			isSourceAudioEnabled: true,
		};
	}

	function texto(pieza: PiezaTexto, inicio: number, duracion: number): TextElement {
		const { estilo } = pieza;
		const contenido = (pieza.hueco && textos.get(pieza.hueco.nombre)) || pieza.muestra;
		let params: ParamValues = {
			...base("text"),
			...(EFECTOS_TEXTO.find((e) => e.id === estilo.efecto)?.params ?? {}),
			content: contenido,
			fontFamily: estilo.fuente,
			fontSize: tamanoLetra(estilo.px, lienzo),
			fontWeight: estilo.negrita ? "bold" : "normal",
			fontStyle: estilo.cursiva ? "italic" : "normal",
			textAlign: estilo.alineacion === "izquierda" ? "left" : "center",
			[TEXTO.mayusculas]: estilo.mayusculas ? "mayusculas" : "ninguno",
			opacity: estilo.opacidad ?? 1,
		};
		if (estilo.relleno) {
			params["background.paddingX"] = rellenoParam(estilo.relleno[0], lienzo);
			params["background.paddingY"] = rellenoParam(estilo.relleno[1], lienzo);
		}
		params = { ...params, ...paramsDeAnimacion(pieza.animacion, "text", duracion / tps, params) };
		const ancla: AnclaTexto = { borde: pieza.ancla.borde, y: pieza.ancla.y, margen: MARGEN_TEXTO };
		params = {
			...params,
			...marcas({ [MARCA.ancla]: codificarAncla(ancla) }),
			...(pieza.hueco ? { [MARCA.hueco]: pieza.hueco.nombre } : {}),
		};
		params = { ...params, ...ubicarTexto({ params, ancla, lienzo, medir }) };
		return {
			id: nuevoId(),
			type: "text",
			name: nombreCorto(contenido),
			startTime: inicio as MediaTime,
			duration: duracion as MediaTime,
			trimStart: 0 as MediaTime,
			trimEnd: 0 as MediaTime,
			hidden: false,
			params,
		};
	}

	function forma(pieza: PiezaForma, inicio: number, duracion: number): GraphicElement {
		const c = escalarCelda(pieza.celda, f);
		const lado = Math.min(lienzo.width, lienzo.height);
		let params: ParamValues = {
			...base("graphic", pieza.forma),
			fill: pieza.relleno,
			"transform.scaleX": r4(c.ancho / lado),
			"transform.scaleY": r4(c.alto / lado),
			"transform.positionX": r2(c.x + c.ancho / 2 - lienzo.width / 2),
			"transform.positionY": r2(c.y + c.alto / 2 - lienzo.height / 2),
		};
		params = { ...params, ...paramsDeAnimacion(pieza.animacion, "graphic", duracion / tps, params), ...marcas({}) };
		return {
			id: nuevoId(),
			type: "graphic",
			definitionId: pieza.forma,
			name: "Rectángulo",
			startTime: inicio as MediaTime,
			duration: duracion as MediaTime,
			trimStart: 0 as MediaTime,
			trimEnd: 0 as MediaTime,
			hidden: false,
			params,
		};
	}

	const porPista = new Map<PistaPlantilla, TimelineElement[]>();
	for (const pieza of plantilla.piezas) {
		const inicio = ticks(pieza.inicio);
		const duracion = ticks(pieza.fin) - inicio;
		const elemento =
			pieza.tipo === "clip" ? clip(pieza, inicio, duracion) : pieza.tipo === "texto" ? texto(pieza, inicio, duracion) : forma(pieza, inicio, duracion);
		porPista.set(pieza.pista, [...(porPista.get(pieza.pista) ?? []), elemento]);
	}
	const enOrden = <T extends TimelineElement>(els: TimelineElement[] | undefined) =>
		((els ?? []) as T[]).slice().sort((x, y) => x.startTime - y.startTime);

	const overlay: OverlayTrack[] = [];
	for (const { pista, tipo } of SUPERPUESTAS) {
		if (!porPista.get(pista)?.length) continue;
		if (tipo === "text") overlay.push({ ...buildEmptyTrack({ id: nuevoId(), type: "text" }), elements: enOrden<TextElement>(porPista.get(pista)) });
		else if (tipo === "graphic")
			overlay.push({ ...buildEmptyTrack({ id: nuevoId(), type: "graphic" }), elements: enOrden<GraphicElement>(porPista.get(pista)) });
		else
			overlay.push({
				...buildEmptyTrack({ id: nuevoId(), type: "video" }),
				elements: enOrden<VideoElement | ImageElement>(porPista.get(pista)),
			});
	}
	const main: VideoTrack = { ...a.principal, elements: enOrden<VideoElement | ImageElement>(porPista.get("principal")) };
	return { tracks: { overlay, main, audio: [] }, descartes };
}
