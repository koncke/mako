// =============================================================================
// Navegación del reproductor: cuadros, puntos de corte y búsqueda rápida (J K L)
// =============================================================================
// Las acciones del preset «CapCut» que mueven el cabezal desde el reproductor
// (relevamiento-capcut-armazon.md §10). Funciones sueltas sobre el EditorCore,
// sin React: las llaman los atajos (atajos-reproductor.ts) y cualquier botón.
//
// La búsqueda rápida («Rebobinar a varias velocidades» / «Detener búsqueda
// rápida» / «Búsqueda rápida a la derecha») no tiene soporte en el motor: la
// reproducción de OpenCut va siempre a 1× y hacia adelante. A 1× hacia adelante
// se usa la reproducción normal (con sonido); a cualquier otra velocidad, un
// bucle propio que mueve el cabezal en cada cuadro de pantalla con la
// reproducción en pausa (imagen sin sonido: el audio-manager corta el sonido en
// cada salto cuando no se está reproduciendo).
//
// ⚠️ No usar `setScrubbing(true)` para esto: ese estado prende el
// desplazamiento automático por los bordes de la línea de tiempo, que sigue la
// ÚLTIMA posición del mouse sobre la regla y la haría correr sola.

import type { EditorCore } from "@/app/video-editor/_opencut/core";
import {
	roundMediaTime,
	TICKS_PER_SECOND,
	type MediaTime,
} from "@/app/video-editor/_opencut/wasm";

function ticksPorCuadro(editor: EditorCore): number {
	const fps = editor.project.getActive().settings.fps;
	return Math.round((TICKS_PER_SECOND * fps.denominator) / fps.numerator);
}

function irA(editor: EditorCore, ticks: number): void {
	const total = editor.timeline.getTotalDuration();
	editor.playback.seek({
		time: roundMediaTime({ time: Math.min(Math.max(0, ticks), total) }),
	});
}

/** «Cuadro anterior / Siguiente cuadro» (`n` = 1) y «Retroceder / Avanzar muchos fotogramas» (`n` = 10). */
export function moverCuadros(editor: EditorCore, n: number): void {
	detenerBusqueda(editor);
	irA(editor, editor.playback.getCurrentTime() + n * ticksPorCuadro(editor));
}

/** «Localizar hasta el primer / último fotograma». */
export function irAlBorde(editor: EditorCore, borde: "inicio" | "fin"): void {
	soltarBusqueda();
	irA(editor, borde === "inicio" ? 0 : editor.timeline.getLastFrameTime());
}

/**
 * Los puntos de corte de la línea de tiempo: dónde empieza y termina cada clip,
 * en todas las pistas (video, superpuestas y audio), más el 0 y el final.
 */
export function puntosDeCorte(editor: EditorCore): MediaTime[] {
	const { tracks } = editor.scenes.getActiveScene();
	const puntos = new Set<number>([0, editor.timeline.getTotalDuration()]);
	for (const pista of [tracks.main, ...tracks.overlay, ...tracks.audio]) {
		for (const elemento of pista.elements) {
			puntos.add(elemento.startTime);
			puntos.add(elemento.startTime + elemento.duration);
		}
	}
	return [...puntos]
		.filter((t) => Number.isFinite(t))
		.sort((a, b) => a - b)
		.map((t) => roundMediaTime({ time: t }));
}

/** «Último punto de corte» (↑) / «Siguiente punto de corte» (↓). */
export function irAPuntoDeCorte(editor: EditorCore, sentido: -1 | 1): void {
	soltarBusqueda();
	const actual = editor.playback.getCurrentTime();
	// Medio cuadro de tolerancia: parado justo sobre un corte, el «siguiente» es
	// el próximo, no el mismo.
	const margen = ticksPorCuadro(editor) / 2;
	const puntos = puntosDeCorte(editor);
	const destino =
		sentido > 0
			? puntos.find((t) => t > actual + margen)
			: [...puntos].reverse().find((t) => t < actual - margen);
	if (destino !== undefined) irA(editor, destino);
}

// ── Búsqueda rápida (J K L) ─────────────────────────────────────────────────

const VELOCIDAD_MAXIMA = 8;

let velocidad = 0; // cuadros de línea de tiempo por cuadro real; < 0 rebobina
let bucle: number | null = null;
let ultimoInstante = 0;
let editorDelBucle: EditorCore | null = null;
let soltarSuscripcion: (() => void) | null = null;
let moviendoPropio = false;

function pararBucle(): void {
	if (bucle !== null) cancelAnimationFrame(bucle);
	bucle = null;
	soltarSuscripcion?.();
	soltarSuscripcion = null;
	editorDelBucle = null;
}

function paso(instante: number): void {
	const editor = editorDelBucle;
	if (!editor) return;
	const segundos = Math.min(0.1, (instante - ultimoInstante) / 1000);
	ultimoInstante = instante;
	const actual = editor.playback.getCurrentTime();
	const siguiente = actual + segundos * velocidad * TICKS_PER_SECOND;
	const total = editor.timeline.getTotalDuration();
	moviendoPropio = true;
	irA(editor, siguiente);
	moviendoPropio = false;
	if (siguiente <= 0 || siguiente >= total) {
		velocidad = 0;
		pararBucle();
		return;
	}
	bucle = requestAnimationFrame(paso);
}

function arrancarBucle(editor: EditorCore): void {
	if (editor.playback.getIsPlaying()) editor.playback.pause();
	if (bucle !== null) return;
	editorDelBucle = editor;
	// Si el usuario reproduce o mueve el cabezal por su cuenta, la búsqueda
	// rápida se corta: dos cosas moviendo el cabezal a la vez es un tironeo.
	const soltarPlay = editor.playback.subscribe(() => {
		if (editor.playback.getIsPlaying()) {
			velocidad = 0;
			pararBucle();
		}
	});
	const soltarSeek = editor.playback.onSeek(() => {
		if (moviendoPropio) return;
		velocidad = 0;
		pararBucle();
	});
	soltarSuscripcion = () => {
		soltarPlay();
		soltarSeek();
	};
	ultimoInstante = performance.now();
	bucle = requestAnimationFrame(paso);
}

/**
 * J (`sentido` −1) / L (+1): la primera vez arranca a 1×, cada vez más dobla la
 * velocidad hasta 8×; el sentido contrario arranca de nuevo a 1×.
 */
export function busquedaRapida(editor: EditorCore, sentido: -1 | 1): void {
	const reproduciendo = editor.playback.getIsPlaying();
	// La velocidad guardada puede haber quedado vieja (la reproducción normal
	// terminó sola, o se pausó con Espacio): sin bucle, manda lo que se ve.
	if (bucle === null) velocidad = reproduciendo ? 1 : 0;
	const mismoSentido = Math.sign(velocidad) === sentido;
	if (mismoSentido) {
		velocidad = Math.max(-VELOCIDAD_MAXIMA, Math.min(VELOCIDAD_MAXIMA, velocidad * 2));
	} else {
		velocidad = sentido;
	}

	if (velocidad === 1) {
		// 1× hacia adelante = la reproducción de siempre, con sonido.
		pararBucle();
		if (!reproduciendo) editor.playback.play();
		return;
	}
	arrancarBucle(editor);
}

/** Corta la búsqueda rápida sin tocar la reproducción normal (saltos de cabezal). */
function soltarBusqueda(): void {
	velocidad = 0;
	pararBucle();
}

/** «Reproducir/Pausar»: con la búsqueda rápida corriendo, la corta y queda en pausa. */
export function alternarReproduccion(editor: EditorCore): void {
	if (bucle !== null) {
		soltarBusqueda();
		return;
	}
	editor.playback.toggle();
}

/** K: «Detener búsqueda rápida». También pausa la reproducción normal. */
export function detenerBusqueda(editor: EditorCore): void {
	soltarBusqueda();
	if (editor.playback.getIsPlaying()) editor.playback.pause();
}
