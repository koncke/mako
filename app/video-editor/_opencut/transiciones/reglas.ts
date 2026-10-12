// =============================================================================
// Transiciones: cuándo rige una y cuánto dura (puro: sin editor ni WASM)
// =============================================================================
// Lo usan la escena (qué se dibuja), el panel, la biblioteca y el arrastre, así
// que vive en un solo lugar. Sin el WASM a propósito: `TICKS_PER_SECOND` sale de
// él y node no carga el .wasm, así que quien llama pasa los ticks por segundo
// (`tps`) y esto se puede probar con node (tests/video-editor-transiciones.test.ts).

import type { TimelineElement, TimelineTrack } from "@/app/video-editor/_opencut/timeline";
import {
	DURACION_MINIMA,
	DURACION_POR_DEFECTO,
	PARAM_TRANSICION_DURACION,
	PARAM_TRANSICION_ID,
	PREFIJO_TRANSICION,
} from "./claves";

/** Lo que una transición necesita saber de un clip. */
export type ClipCorte = Pick<TimelineElement, "id" | "startTime" | "duration" | "params"> & {
	type: TimelineElement["type"];
	hidden?: boolean;
};

/** Sólo entre clips de video o imagen (CapCut: «La transición solo puede agregarse a las pistas del video»). */
export function admiteTransicion(element: { type: string }): boolean {
	return element.type === "video" || element.type === "image";
}

/**
 * El clip `b` empieza justo donde termina `a`. Tolerancia de 1 tick, la misma
 * con la que D dibuja el ⧓ (timeline/components/timeline-element.tsx): si una
 * regla y el marcador no coinciden, se ve un ⧓ sin transición o al revés.
 */
export function estanPegados(a: ClipCorte, b: ClipCorte): boolean {
	return a.id !== b.id && Math.abs(b.startTime - (a.startTime + a.duration)) <= 1;
}

/** El id de la transición guardada en el clip, o `null`. */
export function idTransicion(element: { params?: Record<string, unknown> }): string | null {
	const id = element.params?.[PARAM_TRANSICION_ID];
	return typeof id === "string" && id.length > 0 ? id : null;
}

/** La duración PEDIDA (segundos), sin el tope del corte. */
export function duracionPedida(element: { params?: Record<string, unknown> }): number {
	const v = element.params?.[PARAM_TRANSICION_DURACION];
	const n = typeof v === "number" ? v : Number.parseFloat(String(v ?? ""));
	return Number.isFinite(n) && n > 0 ? n : DURACION_POR_DEFECTO;
}

/** El tope (segundos): la mitad del clip más corto del corte. */
export function duracionMaxima(a: ClipCorte, b: ClipCorte, tps: number): number {
	return Math.min(a.duration, b.duration) / 2 / tps;
}

/** La que se dibuja (segundos): la pedida, sin pasar el tope. */
export function duracionEfectiva(a: ClipCorte, b: ClipCorte, tps: number): number {
	return Math.min(duracionPedida(a), duracionMaxima(a, b, tps));
}

/** El corte no admite ni la duración mínima (CapCut: «El video es demasiado corto…»). */
export function corteMuyCorto(a: ClipCorte, b: ClipCorte, tps: number): boolean {
	return duracionMaxima(a, b, tps) < DURACION_MINIMA;
}

function ordenados<T extends ClipCorte>(elementos: readonly T[]): T[] {
	return elementos
		.filter((e) => admiteTransicion(e) && !e.hidden)
		.slice()
		.sort((x, y) => x.startTime - y.startTime || x.id.localeCompare(y.id));
}

/** El clip pegado a la derecha de `a` en la misma pista, si hay. */
export function siguientePegado<T extends ClipCorte>(elementos: readonly T[], a: ClipCorte): T | null {
	return ordenados(elementos).find((b) => estanPegados(a, b)) ?? null;
}

/** El clip pegado a la izquierda de `b` en la misma pista, si hay. */
export function anteriorPegado<T extends ClipCorte>(elementos: readonly T[], b: ClipCorte): T | null {
	return ordenados(elementos).find((a) => estanPegados(a, b)) ?? null;
}

/** Los cortes de una pista: cada par de clips visuales pegados, en orden. */
export function cortesDePista<T extends ClipCorte>(elementos: readonly T[]): Array<{ a: T; b: T }> {
	const lista = ordenados(elementos);
	const cortes: Array<{ a: T; b: T }> = [];
	for (let i = 0; i + 1 < lista.length; i++) {
		if (estanPegados(lista[i], lista[i + 1])) cortes.push({ a: lista[i], b: lista[i + 1] });
	}
	return cortes;
}

/**
 * Los elementos de una pista como UNA lista. `track.elements` es una unión de
 * listas (una por tipo de pista) y TypeScript no infiere el genérico de eso.
 */
export function clipsDe(track: Pick<TimelineTrack, "elements">): readonly TimelineElement[] {
	return track.elements as readonly TimelineElement[];
}

/** El clip tiene una transición que RIGE (id guardado y un clip pegado a la derecha). */
export function transicionVigente(track: Pick<TimelineTrack, "type" | "elements">, element: ClipCorte): boolean {
	if (track.type !== "video" || !admiteTransicion(element) || !idTransicion(element)) return false;
	return siguientePegado(clipsDe(track), element) !== null;
}

/** Los params sin `transicion.*` (la mitad izquierda de un clip dividido, un clip borrado al lado). */
export function sinTransicion<P extends Record<string, unknown>>(params: P): P {
	if (!Object.keys(params).some((k) => k.startsWith(PREFIJO_TRANSICION))) return params;
	return Object.fromEntries(
		Object.entries(params).filter(([k]) => !k.startsWith(PREFIJO_TRANSICION)),
	) as P;
}
