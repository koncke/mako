// =============================================================================
// Plantillas: las MARCAS que deja una plantilla en sus elementos
// =============================================================================
// Una plantilla armada (./armar.ts) es una línea de tiempo común: lo único que la
// recuerda son estas claves en `element.params` (contrato en docs/diseno-editor-
// video.md §4.1):
//
//   plantilla.id         el id de la plantilla (lib/editor-video/plantillas.ts)
//   plantilla.hueco      el nombre del hueco. Varios elementos con el mismo nombre
//                        son UN hueco: llenarlo los llena todos
//   plantilla.muestra    true mientras el clip es la imagen de muestra (sin sustituir)
//   plantilla.opcional   el hueco se puede dejar con su muestra (el fondo del cierre)
//   plantilla.silenciar  al sustituirlo por un video, `muted` (dos clips a la vez)
//   plantilla.ancla      en los textos, JSON {"b":"arriba","y":300,"m":0.11}: qué borde
//                        va dónde (px de 1080x1920) y el margen lateral; con eso se
//                        vuelve a partir y ubicar un texto nuevo del hueco
//
// SIN declarar (como `tts`, subtitles/texto-a-voz.ts, o `audio.extraidoDe`,
// audio/claves.ts): no aparecen como control y «Pegar atributos» no las lleva (pega
// sólo lo declarado). Dividir y Duplicar sí las copian: las dos mitades siguen
// siendo el mismo hueco.
//
// Puro (sin editor ni WASM), con test (tests/video-editor-plantillas.test.ts).

import type { ParamValues } from "@/app/video-editor/_opencut/params";
import type { ElementRef, SceneTracks } from "@/app/video-editor/_opencut/timeline";

export const MARCA = {
	id: "plantilla.id",
	hueco: "plantilla.hueco",
	muestra: "plantilla.muestra",
	opcional: "plantilla.opcional",
	silenciar: "plantilla.silenciar",
	ancla: "plantilla.ancla",
} as const;

/** El prefijo de todas: lo que copia atributos o congela un cuadro las deja afuera. */
export const PREFIJO_PLANTILLA = "plantilla.";

/** Dónde va un texto de plantilla: el borde, su `y` en px de 1080x1920 y el margen lateral (proporción del ancho). */
export type AnclaTexto = { borde: "arriba" | "centro" | "abajo"; y: number; margen: number };

export function codificarAncla(a: AnclaTexto): string {
	return JSON.stringify({ b: a.borde, y: a.y, m: a.margen });
}

export function leerAncla(params: ParamValues | undefined): AnclaTexto | null {
	const crudo = params?.[MARCA.ancla];
	if (typeof crudo !== "string") return null;
	try {
		const j = JSON.parse(crudo) as { b?: unknown; y?: unknown; m?: unknown };
		const borde = j.b === "arriba" || j.b === "centro" || j.b === "abajo" ? j.b : null;
		if (!borde || typeof j.y !== "number" || !Number.isFinite(j.y)) return null;
		const margen = typeof j.m === "number" && j.m >= 0 && j.m < 0.5 ? j.m : 0;
		return { borde, y: j.y, margen };
	} catch {
		return null;
	}
}

export type MarcasPlantilla = {
	plantilla: string;
	hueco: string | null;
	muestra: boolean;
	opcional: boolean;
	silenciar: boolean;
	ancla: AnclaTexto | null;
};

/** Las marcas de un elemento, o `null` si no salió de una plantilla. */
export function leerMarcas(params: ParamValues | undefined): MarcasPlantilla | null {
	const id = params?.[MARCA.id];
	if (typeof id !== "string" || !id) return null;
	const hueco = params?.[MARCA.hueco];
	return {
		plantilla: id,
		hueco: typeof hueco === "string" && hueco ? hueco : null,
		muestra: params?.[MARCA.muestra] === true,
		opcional: params?.[MARCA.opcional] === true,
		silenciar: params?.[MARCA.silenciar] === true,
		ancla: leerAncla(params),
	};
}

export type HuecoEnLinea = {
	plantilla: string;
	nombre: string;
	tipo: "clip" | "texto";
	opcional: boolean;
	/** En el orden de la línea de tiempo. */
	elementos: Array<ElementRef & { muestra: boolean }>;
};

/**
 * Los huecos que hay hoy en la línea de tiempo. Se agrupan por plantilla Y nombre:
 * un clip pegado desde otro proyecto con otra plantilla no es el mismo hueco.
 */
export function huecosEnLinea(tracks: SceneTracks): HuecoEnLinea[] {
	const grupos = new Map<string, HuecoEnLinea & { inicios: number[] }>();
	for (const track of [...tracks.overlay, tracks.main]) {
		for (const element of track.elements) {
			const m = leerMarcas(element.params);
			if (!m?.hueco) continue;
			const tipo = element.type === "video" || element.type === "image" ? "clip" : element.type === "text" ? "texto" : null;
			if (!tipo) continue;
			const clave = `${m.plantilla}\u0000${m.hueco}`;
			let g = grupos.get(clave);
			if (!g) {
				g = { plantilla: m.plantilla, nombre: m.hueco, tipo, opcional: m.opcional, elementos: [], inicios: [] };
				grupos.set(clave, g);
			}
			g.elementos.push({ trackId: track.id, elementId: element.id, muestra: m.muestra });
			g.inicios.push(element.startTime as number);
		}
	}
	return [...grupos.values()]
		.map(({ inicios, ...g }) => {
			const orden = g.elementos.map((e, i) => ({ e, t: inicios[i] })).sort((a, b) => a.t - b.t);
			return { hueco: { ...g, elementos: orden.map((o) => o.e) }, desde: orden[0]?.t ?? 0 };
		})
		.sort((a, b) => a.desde - b.desde)
		.map((x) => x.hueco);
}

/** ¿Queda algún clip de muestra que haya que sustituir? Los opcionales y lo oculto no cuentan. */
export function quedanMuestras(tracks: SceneTracks): boolean {
	for (const track of [...tracks.overlay, tracks.main]) {
		if ("hidden" in track && track.hidden) continue;
		for (const element of track.elements) {
			if ("hidden" in element && element.hidden) continue;
			const m = leerMarcas(element.params);
			if (m?.muestra && !m.opcional) return true;
		}
	}
	return false;
}
