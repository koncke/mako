// =============================================================================
// Los RITMOS de un clip de audio: marcarlos, guardarlos y ubicarlos
// =============================================================================
// «Marcar ritmos» de CapCut (relevamiento-capcut-funciones §3.4): Ritmo 1 /
// Ritmo 2 automáticos, «Agregar ritmo» a mano en el cabezal y «Borrar los
// ritmos». Se dibujan como puntos sobre el clip (./components/ritmos-clip.tsx) y
// el imán los usa como puntos de encaje (timeline/element-snap-source.ts).
//
// Se guardan en segundos de la FUENTE (audio/claves.ts → RITMOS*): recortar,
// dividir o cambiar la velocidad del clip no los corre del golpe, y al estirar
// el recorte aparecen los que estaban afuera.
//
// La detección (./dsp/ritmos.ts) corre sobre el archivo ENTERO (hasta 10 min;
// más largo, el tramo del clip) una sola vez por fuente y queda en memoria:
// Ritmo 1 y Ritmo 2 salen del mismo análisis.

import type { EditorCore } from "@/app/video-editor/_opencut/core";
import type { MediaAsset } from "@/app/video-editor/_opencut/media/types";
import type { ParamValues } from "@/app/video-editor/_opencut/params";
import { getClipTimeAtSourceTime, getSourceTimeAtClipTime } from "@/app/video-editor/_opencut/retime";
import type { AudioElement, RetimeConfig } from "@/app/video-editor/_opencut/timeline";
import { TICKS_PER_SECOND } from "@/app/video-editor/_opencut/wasm";
import {
	RITMOS,
	RITMOS_MANUALES,
	RITMOS_MODO,
	escribirLista,
	leerLista,
	ritmosDeFuente,
} from "./claves";
import { claveFuente, recorrerFuente } from "./decodificar";
import { AcumuladorAnalisis, detectarRitmos, type Ritmos } from "./dsp/ritmos";

export type ModoRitmo = "1" | "2";

/** Un ritmo a menos de esto del cabezal es «el del cabezal» (≈ un cuadro). */
const TOLERANCIA_S = 0.04;

// ── Ubicar ───────────────────────────────────────────────────────────────────

type ClipRitmico = {
	params: ParamValues;
	trimStart: number;
	duration: number;
	retime?: RetimeConfig;
};

/** Los ritmos del clip en SEGUNDOS DEL CLIP, sólo los que caen adentro. */
export function ritmosEnClip(element: ClipRitmico): number[] {
	const fuente = ritmosDeFuente(element.params);
	if (fuente.length === 0) return [];
	const recorte = element.trimStart / TICKS_PER_SECOND;
	const duracion = element.duration / TICKS_PER_SECOND;
	const salida: number[] = [];
	for (const s of fuente) {
		const t = getClipTimeAtSourceTime({ sourceTime: s - recorte, retime: element.retime, clipDuration: duracion });
		if (t >= 0 && t <= duracion) salida.push(t);
	}
	return salida;
}

// ── Detectar ─────────────────────────────────────────────────────────────────

const detecciones = new Map<string, Promise<Ritmos>>();

/**
 * Hasta cuánto audio se analiza de una vez. Una música entra entera; de un
 * audio larguísimo (el extraído de una grabación de una hora) se analiza el
 * tramo del clip, para no decodificar una hora para marcar un minuto.
 */
const ANALISIS_MAX_S = 600;

function tramoAnalisis(element: AudioElement): { desde: number; hasta?: number } {
	const fuente = (element.sourceDuration ?? 0) / TICKS_PER_SECOND;
	if (fuente > 0 && fuente <= ANALISIS_MAX_S) return { desde: 0 };
	const desde = element.trimStart / TICKS_PER_SECOND;
	return { desde, hasta: desde + ANALISIS_MAX_S };
}

async function analizar(
	element: AudioElement,
	mediaAssets: readonly MediaAsset[],
	tramo: { desde: number; hasta?: number },
): Promise<Ritmos> {
	const acumulador = new AcumuladorAnalisis();
	// En un objeto: lo escribe el callback y TS no sigue asignaciones adentro de uno.
	const leido = { inicio: null as number | null };
	const ok = await recorrerFuente({
		element,
		mediaAssets,
		...tramo,
		alTrozo: ({ canales, sampleRate, inicio }) => {
			leido.inicio ??= inicio;
			acumulador.agregar(canales, sampleRate);
		},
	});
	if (!ok) return { ritmo1: [], ritmo2: [], bpm: 0 };
	const r = await detectarRitmos(acumulador.resultado());
	const corrido = (lista: number[]) => lista.map((s) => s + (leido.inicio ?? 0));
	return { ritmo1: corrido(r.ritmo1), ritmo2: corrido(r.ritmo2), bpm: r.bpm };
}

export function detectarRitmosDeClip(element: AudioElement, mediaAssets: readonly MediaAsset[]): Promise<Ritmos> {
	const tramo = tramoAnalisis(element);
	const clave = `${claveFuente(element)}|${tramo.desde}|${tramo.hasta ?? ""}`;
	let pendiente = detecciones.get(clave);
	if (!pendiente) {
		pendiente = analizar(element, mediaAssets, tramo);
		detecciones.set(clave, pendiente);
		// Un error no queda guardado: se puede volver a intentar.
		pendiente.catch(() => detecciones.delete(clave));
	}
	return pendiente;
}

// ── Escribir ─────────────────────────────────────────────────────────────────

type Ref = { editor: EditorCore; trackId: string; element: AudioElement };

function escribir({ editor, trackId, element }: Ref, params: ParamValues) {
	editor.timeline.updateElements({
		updates: [{ trackId, elementId: element.id, patch: { params: { ...element.params, ...params } } }],
	});
}

/** «Ritmo 1» / «Ritmo 2». Devuelve cuántos ritmos quedaron marcados. */
export async function marcarRitmosAutomaticos(
	ref: Ref & { mediaAssets: readonly MediaAsset[]; modo: ModoRitmo },
): Promise<number> {
	const r = await detectarRitmosDeClip(ref.element, ref.mediaAssets);
	const lista = ref.modo === "1" ? r.ritmo1 : r.ritmo2;
	if (lista.length === 0) return 0;
	// El clip pudo cambiar mientras se analizaba: se escribe sobre el actual.
	const actual = buscarActual(ref);
	if (!actual) return 0;
	escribir({ ...ref, element: actual }, { [RITMOS]: escribirLista(lista), [RITMOS_MODO]: ref.modo });
	return ritmosEnClip(actual).length;
}

/** Los ritmos (auto + manuales) que están en el cabezal, en segundos de la fuente. */
function enElCabezal(element: AudioElement, cabezal: number): { fuente: number; locales: number[] } | null {
	const local = cabezal - element.startTime / TICKS_PER_SECOND;
	const duracion = element.duration / TICKS_PER_SECOND;
	if (local < 0 || local > duracion) return null;
	const fuente =
		element.trimStart / TICKS_PER_SECOND +
		getSourceTimeAtClipTime({ clipTime: local, retime: element.retime, clipDuration: duracion });
	const cerca = ritmosDeFuente(element.params).filter((s) => Math.abs(s - fuente) <= TOLERANCIA_S);
	return { fuente, locales: cerca };
}

export function hayRitmoEnCabezal(element: AudioElement, cabezalSegundos: number): boolean {
	return (enElCabezal(element, cabezalSegundos)?.locales.length ?? 0) > 0;
}

export function cabezalSobreClip(element: AudioElement, cabezalSegundos: number): boolean {
	return enElCabezal(element, cabezalSegundos) !== null;
}

/**
 * «Agregar ritmo» en el cabezal; si ya hay uno ahí, lo saca («Eliminar los
 * ritmos» del cabezal), como el botón de CapCut que alterna.
 */
export function alternarRitmoEnCabezal(ref: Ref & { cabezalSegundos: number }): void {
	const alli = enElCabezal(ref.element, ref.cabezalSegundos);
	if (!alli) return;
	const params = ref.element.params;
	if (alli.locales.length > 0) {
		const fuera = (s: number) => !alli.locales.includes(s);
		escribir(ref, {
			[RITMOS]: escribirLista(leerLista(params, RITMOS).filter(fuera)),
			[RITMOS_MANUALES]: escribirLista(leerLista(params, RITMOS_MANUALES).filter(fuera)),
		});
		return;
	}
	escribir(ref, { [RITMOS_MANUALES]: escribirLista([...leerLista(params, RITMOS_MANUALES), alli.fuente]) });
}

/** «Borrar los ritmos»: los automáticos y los manuales. */
export function borrarRitmos(ref: Ref): void {
	escribir(ref, { [RITMOS]: "", [RITMOS_MANUALES]: "", [RITMOS_MODO]: "" });
}

function buscarActual({ editor, trackId, element }: Ref): AudioElement | null {
	const [con] = editor.timeline.getElementsWithTracks({ elements: [{ trackId, elementId: element.id }] });
	return con && con.element.type === "audio" ? con.element : null;
}
