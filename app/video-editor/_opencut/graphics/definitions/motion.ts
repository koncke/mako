// =============================================================================
// Motion graphics en el Video Editor: una definición de `graphic` ANIMADA por plantilla de lib/motion
// =============================================================================
// Pedido de Martín (26/10/2026): «implementa esto de punta a punta: https://github.com/iart-ai/motion-skills que se
// puedan hacer motions graphics en la web y en el editor». El motion graphic es un elemento `graphic` del motor de
// OpenCut con `definitionId` = `motion-<plantilla>`: sus campos (textos, colores, tono) son los params de la
// definición, así el panel de la derecha los edita como los de una forma (graphic-tab.tsx), el chat los cambia por id
// y el proyecto los guarda sin nada nuevo. Lo único distinto es que se dibuja en CADA cuadro con su tiempo
// (`animado`) y del tamaño del lienzo.
//
// El dibujo es el de lib/motion (la misma escena que la landing): `armarEscena` una vez por params, proporción y
// duración (cacheada), y `dibujarEscena` en el tiempo del cuadro. Sin tiempo (la miniatura de la biblioteca), el
// cuadro final de la versión de landing: el bloque terminado.
// =============================================================================

import type { ParamDefinition, ParamValues } from "@/app/video-editor/_opencut/params";
import { armarEscena, instanteQueDibuja } from "@/lib/motion/escena";
import { dibujarEscena } from "@/lib/motion/canvas";
import { cargarFuentesMotion, familiasDe, fuentesListas } from "@/lib/motion/fuentes";
import { PLANTILLAS, camposDe } from "@/lib/motion/plantillas";
import { PLANTILLAS_MOTION, type CampoMotion, type Escena, type IdPlantilla } from "@/lib/motion/tipos";
import type { GraphicDefinition } from "../types";

/** El prefijo de los `definitionId` de motion: `motion-titular`, `motion-cifra`… */
export const PREFIJO_MOTION = "motion-";
export const idDefinicionMotion = (p: IdPlantilla) => `${PREFIJO_MOTION}${p}`;
export function plantillaDeDefinicion(definitionId: string): IdPlantilla | null {
	if (!definitionId.startsWith(PREFIJO_MOTION)) return null;
	const p = definitionId.slice(PREFIJO_MOTION.length);
	return (PLANTILLAS_MOTION as readonly string[]).includes(p) ? (p as IdPlantilla) : null;
}

/** Un campo de la plantilla como parámetro del motor. Nada es «keyframable»: la coreografía es de la plantilla. */
function paramDeCampo(c: CampoMotion): ParamDefinition {
	switch (c.tipo) {
		case "texto":
			return { key: c.clave, label: c.rotulo, type: "text", default: c.porDefecto, keyframable: false };
		case "numero":
			return { key: c.clave, label: c.rotulo, type: "number", default: c.porDefecto, min: c.min, max: c.max, step: c.paso, keyframable: false };
		case "color":
			return { key: c.clave, label: c.rotulo, type: "color", default: c.porDefecto, keyframable: false };
		case "opcion":
			return { key: c.clave, label: c.rotulo, type: "select", default: c.porDefecto, options: c.opciones.map((o) => ({ value: o.valor, label: o.rotulo })), keyframable: false };
		case "si-no":
			return { key: c.clave, label: c.rotulo, type: "boolean", default: c.porDefecto, keyframable: false };
	}
}

/** Los valores de la plantilla que trae un elemento (sus params tienen también los del elemento: posición, opacidad…). */
export function valoresDeParams(p: IdPlantilla, params: ParamValues): Record<string, string | number | boolean> {
	const out: Record<string, string | number | boolean> = {};
	for (const c of camposDe(p)) {
		const v = params[c.clave];
		if (typeof v === "string" || typeof v === "number" || typeof v === "boolean") out[c.clave] = v;
	}
	return out;
}

// La escena se arma una vez por (params, proporción, duración, modo): en el reproductor cambia sólo el tiempo.
const cache = new Map<string, Escena>();
function escenaDe(p: IdPlantilla, params: ParamValues, aspecto: number, duracion: number | undefined): Escena {
	const valores = valoresDeParams(p, params);
	const video = duracion !== undefined;
	const clave = JSON.stringify([p, valores, Math.round(aspecto * 1000), video ? Math.round(duracion * 1000) : 0]);
	let e = cache.get(clave);
	if (!e) {
		e = armarEscena({ plantilla: p, valores }, { aspecto, video, durMs: video ? duracion * 1000 : undefined });
		if (cache.size > 64) cache.clear();
		cache.set(clave, e);
	}
	return e;
}

function definicion(p: IdPlantilla): GraphicDefinition {
	const def = PLANTILLAS[p];
	return {
		id: idDefinicionMotion(p),
		name: `Motion · ${def.nombre}`,
		keywords: ["motion", "animación", "animado", def.nombre.toLowerCase(), p],
		params: camposDe(p).map(paramDeCampo),
		animado: true,
		render({ ctx, params, width, height, tiempo, duracion }) {
			const e = escenaDe(p, params, width / height, tiempo === undefined ? undefined : duracion);
			dibujarEscena(ctx, e, tiempo === undefined ? e.durMs : tiempo * 1000, width, height);
		},
		// En los tramos quietos (todo entró y nada sale todavía) todos los cuadros son el mismo: el nodo no redibuja.
		instanteDeDibujo({ params, tiempo, duracion, width, height }) {
			return instanteQueDibuja(escenaDe(p, params, width / height, duracion), tiempo * 1000) / 1000;
		},
		preparar(params) {
			const familias = familiasDe(escenaDe(p, params, 16 / 9, undefined));
			return fuentesListas(familias) ? null : cargarFuentesMotion(familias);
		},
	};
}

export const motionGraphicDefinitions: GraphicDefinition[] = PLANTILLAS_MOTION.map(definicion);
