// =============================================================================
// Agregar un efecto como CAPA, y leer/escribir los params de un efecto
// =============================================================================
// Cómo se aplica algo de color en CapCut:
//
//   · ⊕ en la biblioteca (o arrastrarlo a un hueco): una CAPA de 3 s en el
//     cabezal, en una pista de efectos, que afecta a todo lo que tiene debajo;
//   · arrastrarlo SOBRE un clip: se aplica a ese clip solo (lo resuelve el
//     drag-drop de la línea de tiempo con `addClipEffect`).
//
// Los paneles editan los params de dos clases de dueño, y `origenEfecto` /
// `origenCapa` los ponen detrás de la misma forma (un `ElementParamDefinition`
// con read/write y la ruta de animación de cada clave), para que la pestaña
// «Ajustar» sea la misma para un clip y para una capa de ajuste:
//
//   · efecto de un clip  → `element.effects[i].params`, ruta `effects.<id>.params.<clave>`;
//   · capa de efecto     → `element.params`, ruta `params.<clave>`.

import type { EditorCore } from "@/app/video-editor/_opencut/core";
import type { ParamDefinition, ParamValue, ParamValues } from "@/app/video-editor/_opencut/params";
import { buildDefaultParamValues, type ElementParamDefinition } from "@/app/video-editor/_opencut/params/registry";
import type { TimelineElement, VisualElement } from "@/app/video-editor/_opencut/timeline";
import { buildEffectElement } from "@/app/video-editor/_opencut/timeline/element-utils";
import { mediaTime, TICKS_PER_SECOND } from "@/app/video-editor/_opencut/wasm";
import { buildEffectParamPath } from "@/app/video-editor/_opencut/animation/effect-param-channel";
import { buildGraphicParamPath } from "@/app/video-editor/_opencut/animation/graphic-param-channel";
import { effectsRegistry } from "./registry";
import type { Effect } from "./types";

/** Lo que dura una capa nueva de efecto/filtro/ajuste. */
export const DURACION_CAPA = mediaTime({ ticks: 3 * TICKS_PER_SECOND });

/** Sobre qué clips se puede soltar un filtro o un efecto (CapCut: video e imagen). */
export const DESTINOS_CLIP: VisualElement["type"][] = ["video", "image"];

/** Agrega `effectType` como capa de 3 s en el cabezal (y queda elegida). */
export function agregarCapaEfecto(
	editor: EditorCore,
	{ effectType, params }: { effectType: string; params?: ParamValues },
): void {
	const element = buildEffectElement({
		effectType,
		startTime: editor.playback.getCurrentTime(),
		duration: DURACION_CAPA,
	});
	if (params) element.params = { ...element.params, ...params };
	editor.timeline.insertElement({
		placement: { mode: "auto", trackType: "effect" },
		element,
	});
}

// ── El dueño de los params ───────────────────────────────────────────────────

export type OrigenParams = {
	element: TimelineElement;
	trackId: string;
	/** El efecto ya existe (en una capa, siempre). */
	existe: boolean;
	/** Los params de la definición con su read/write sobre este dueño. */
	param: (def: ParamDefinition) => ElementParamDefinition;
	ruta: (clave: string) => string;
	/** Valores guardados (sin fotogramas clave). */
	valores: ParamValues;
	/** Crea el efecto si falta (un clip sin «Ajustar» todavía). Un paso de deshacer. */
	asegurar: (editor: EditorCore) => void;
	/** Escribe varios valores de una vez (↺ de una sección, «Aplicar a todo»). */
	escribir: (editor: EditorCore, cambios: ParamValues, opciones?: { quitarFotogramas?: string[] }) => void;
};

function efectoDe(element: TimelineElement, buscar: (e: Effect) => boolean): Effect | undefined {
	return "effects" in element ? element.effects?.find(buscar) : undefined;
}

/**
 * El efecto de un CLIP que cumple `buscar`; si no hay, uno nuevo de tipo
 * `tipoNuevo` (con id fijo por clip, así la vista previa de un deslizador y el
 * fotograma clave que se crean antes de confirmar hablan del mismo efecto).
 */
export function origenEfecto({
	element,
	trackId,
	buscar,
	tipoNuevo,
}: {
	element: TimelineElement;
	trackId: string;
	buscar: (e: Effect) => boolean;
	tipoNuevo: string;
}): OrigenParams {
	const actual = efectoDe(element, buscar);
	const id = actual?.id ?? `${tipoNuevo}-${element.id}`;

	const conEfecto = (el: TimelineElement, cambiar: (e: Effect) => Effect): TimelineElement => {
		if (!("effects" in el) && el.type !== "video" && el.type !== "image") return el;
		const efectos = ("effects" in el ? el.effects : undefined) ?? [];
		const i = efectos.findIndex((e) => e.id === id || buscar(e));
		if (i >= 0) {
			const copia = efectos.slice();
			copia[i] = cambiar(copia[i]);
			return { ...el, effects: copia } as TimelineElement;
		}
		const nuevo: Effect = {
			id,
			type: tipoNuevo,
			params: buildDefaultParamValues(effectsRegistry.get(tipoNuevo).params),
			enabled: true,
		};
		// El ajuste va primero: en CapCut el color se corrige antes de los efectos.
		return { ...el, effects: [cambiar(nuevo), ...efectos] } as TimelineElement;
	};

	return {
		element,
		trackId,
		existe: Boolean(actual),
		valores: actual?.params ?? buildDefaultParamValues(effectsRegistry.get(tipoNuevo).params),
		param: (def) => ({
			...def,
			read: ({ element: el }) => efectoDe(el, (e) => e.id === id || buscar(e))?.params[def.key] ?? def.default,
			write: ({ element: el, value }) =>
				conEfecto(el, (e) => ({ ...e, params: { ...e.params, [def.key]: value } })),
		}),
		ruta: (clave) => buildEffectParamPath({ effectId: id, paramKey: clave }),
		asegurar: (editor) => {
			if (actual) return;
			editor.timeline.updateElements({
				updates: [{ trackId, elementId: element.id, patch: conEfecto(element, (e) => e) }],
			});
		},
		escribir: (editor, cambios, opciones) => {
			const patch: Partial<TimelineElement> = conEfecto(element, (e) => ({
				...e,
				params: { ...e.params, ...cambios },
			}));
			if (opciones?.quitarFotogramas && element.animations) {
				const resto = { ...element.animations };
				for (const clave of opciones.quitarFotogramas) {
					delete resto[buildEffectParamPath({ effectId: id, paramKey: clave })];
				}
				patch.animations = Object.keys(resto).length > 0 ? resto : undefined;
			}
			editor.timeline.updateElements({ updates: [{ trackId, elementId: element.id, patch }] });
		},
	};
}

/** Los params de una CAPA de efecto (elemento `effect`). */
export function origenCapa({ element, trackId }: { element: TimelineElement; trackId: string }): OrigenParams {
	return {
		element,
		trackId,
		existe: true,
		valores: element.params,
		param: (def) => ({
			...def,
			read: ({ element: el }) => el.params[def.key] ?? def.default,
			write: ({ element: el, value }) => ({ ...el, params: { ...el.params, [def.key]: value } }) as TimelineElement,
		}),
		ruta: (clave) => buildGraphicParamPath({ paramKey: clave }),
		asegurar: () => {},
		escribir: (editor, cambios, opciones) => {
			const patch: Partial<TimelineElement> = { params: { ...element.params, ...cambios } };
			if (opciones?.quitarFotogramas && element.animations) {
				const resto = { ...element.animations };
				for (const clave of opciones.quitarFotogramas) delete resto[buildGraphicParamPath({ paramKey: clave })];
				patch.animations = Object.keys(resto).length > 0 ? resto : undefined;
			}
			editor.timeline.updateElements({ updates: [{ trackId, elementId: element.id, patch }] });
		},
	};
}

/** Un valor numérico de los params, con su default. */
export function valorNumero(valores: ParamValues, def: ParamDefinition): number {
	const v: ParamValue | undefined = valores[def.key];
	if (typeof v === "number") return v;
	const n = Number(v);
	return Number.isFinite(n) ? n : typeof def.default === "number" ? def.default : 0;
}
