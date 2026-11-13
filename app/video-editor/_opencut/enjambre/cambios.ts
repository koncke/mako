// =============================================================================
// enjambre/cambios — QUÉ cambió en la línea de tiempo, para que cada cursor vaya ahí (12/11/2026)
// =============================================================================
// Martín, 12/11/2026, mirando la Edición automática: «no tiene sentido esos cursores que están haciendo cosas sobre algo que ya
// está creado… mira fotograma por fotograma cómo lo hace». En el reel de referencia (rama `referencias/reels-0911`,
// `edicion-mako.mp4`) cada cursor está DONDE aparece su cambio: arrastra el bloque del subtítulo nuevo a su pista, corta el clip
// en el punto del corte, coloca el B-roll. Hasta ese día los cursores recorrían por turno lo que ya existía (../cursores.ts →
// `tareaDeAgente`, cada 420 ms): parecían trabajar sobre lo de antes.
//
// Acá: `cambiosEntre` compara la línea de tiempo de antes y la de ahora y dice lo que APARECIÓ (un subtítulo, un B-roll, una capa
// de plano, un emoji), dónde hubo un CORTE (los pedazos de un clip partido, lo que se sacó) y lo que CAMBIÓ (el estilo de un
// subtítulo, sus palabras clave, el volumen de un clip). Lo que sólo se CORRIÓ por un borrado en cadena no cuenta: no lo tocó
// nadie. `useCambiosEnjambre` los guarda con el agente que trabajaba (./components/cursores.tsx se suscribe a la línea de
// tiempo mientras hay cursores) y ../cursores.ts → `tareasConCambios` reparte cada cambio a un cursor.
//
// Puro (salvo el store): lo prueba tests/video-editor-enjambre-cambios.test.ts.
// =============================================================================

import { create } from "zustand";
import type { AgenteId } from "./plan";

/** Lo que pasó en la línea de tiempo, con el segundo donde se ve. `id`: el elemento (vacío si ya no existe: lo sacado). */
export type Cambio = { tipo: "aparece" | "corte" | "cambia"; id: string; en: number; elemento: string };

/** Un cambio con quién lo hizo y cuándo (ms del reloj). */
export type CambioVivo = Cambio & { agente: AgenteId; t: number };

type Suelto = { id: string; type?: string; startTime: number; duration: number; trimStart?: number; trimEnd?: number; mediaId?: unknown; params?: unknown };
type PistasSueltas = {
	main: { elements: readonly unknown[] };
	overlay: ReadonlyArray<{ elements: readonly unknown[] }>;
	audio: ReadonlyArray<{ elements: readonly unknown[] }>;
};

/** Los cambios de un mismo paso se muestran de a uno; más que esto no se llega a ver (un estilo cambia 300 subtítulos). */
export const TOPE_CAMBIOS = 120;

/** Cuánto vive un cambio para su cursor: después, el agente ya está en otra cosa. */
export const VIDA_CAMBIO_MS = 20_000;

function elementos(t: PistasSueltas | null | undefined): Map<string, Suelto> {
	const m = new Map<string, Suelto>();
	if (!t) return m;
	for (const pista of [t.main, ...t.overlay, ...t.audio]) {
		for (const e of pista.elements as Suelto[]) if (e && typeof e.id === "string") m.set(e.id, e);
	}
	return m;
}

/**
 * Lo que cambió de `antes` a `despues`, en el orden del video y hasta `tope`. `tps`: ticks por segundo (las pruebas no cargan el
 * motor). Un pedazo nuevo de un clip partido (mismo archivo que un clip que ya estaba) es un CORTE en su arranque; un elemento
 * que se fue es un corte donde estaba; un elemento con otro objeto es un CAMBIO sólo si cambió algo más que su lugar (un borrado
 * en cadena corre todo lo de después, y eso no es trabajo de nadie).
 */
export function cambiosEntre(antes: PistasSueltas | null | undefined, despues: PistasSueltas, tps: number, tope = TOPE_CAMBIOS): Cambio[] {
	const A = elementos(antes);
	const D = elementos(despues);
	const viejosPorMedio = new Set([...A.values()].map((e) => e.mediaId).filter((m): m is string => typeof m === "string" && !!m));
	const out: Cambio[] = [];
	for (const [id, d] of D) {
		const a = A.get(id);
		const en = d.startTime / tps;
		const elemento = d.type ?? "otro";
		if (!a) {
			const pedazo = typeof d.mediaId === "string" && viejosPorMedio.has(d.mediaId);
			out.push({ tipo: pedazo ? "corte" : "aparece", id, en, elemento });
			continue;
		}
		if (a === d) continue;
		const soloSeCorrio =
			a.params === d.params && a.duration === d.duration && (a.trimStart ?? 0) === (d.trimStart ?? 0) && (a.trimEnd ?? 0) === (d.trimEnd ?? 0);
		if (soloSeCorrio) continue;
		out.push({ tipo: a.duration !== d.duration || (a.trimEnd ?? 0) !== (d.trimEnd ?? 0) ? "corte" : "cambia", id, en, elemento });
	}
	for (const [id, a] of A) if (!D.has(id)) out.push({ tipo: "corte", id: "", en: a.startTime / tps, elemento: a.type ?? "otro" });
	return out.sort((x, y) => x.en - y.en).slice(0, Math.max(0, tope));
}

type Cambios = {
	lista: CambioVivo[];
	sumar: (cambios: readonly Cambio[], agente: AgenteId, ahora?: number) => void;
	limpiar: () => void;
};

/** Los cambios de los últimos segundos, con su agente. Lo llena ./components/cursores.tsx; lo leen sus cursores. */
export const useCambiosEnjambre = create<Cambios>()((set) => ({
	lista: [],
	sumar: (cambios, agente, ahora = Date.now()) => {
		if (!cambios.length) return;
		set((s) => ({
			lista: [...s.lista.filter((c) => ahora - c.t < VIDA_CAMBIO_MS), ...cambios.map((c) => ({ ...c, agente, t: ahora }))].slice(-TOPE_CAMBIOS * 2),
		}));
	},
	limpiar: () => set({ lista: [] }),
}));
