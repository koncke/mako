// =============================================================================
// Editar subtítulos como en el panel de CapCut: dividir, combinar, reemplazar
// =============================================================================
// Los atajos son los de la ayuda del panel de subtítulos de CapCut (`pc_double_click_delete`
// del es-LA.po): «Dividir un subtítulo: Enter» · «Combinar hacia arriba: coloca el cursor
// al principio de un subtítulo y pulsa Delete» · «Combinar hacia abajo: … al final … Fn +
// Delete». Y «Buscar y reemplazar» (`find replace`, `pc_replace`, `pc_replace_all`).
//
// Cada operación es UN paso de deshacer (TracksSnapshotCommand, como insert.ts) y vuelve a
// partir las líneas del texto que cambió, con el borde de abajo donde estaba. Las palabras
// con su tiempo (palabras.ts) se reparten, se juntan o se corrigen con el texto: un
// subtítulo que cambió de palabras se queda sin ellas en vez de con las de otro.
//
// Lo que decide (dónde cortar, qué tiempo le toca a cada mitad) es puro y vive en
// palabras.ts, con test. Acá sólo se arma la línea de tiempo nueva.
// =============================================================================

import { EditorCore } from "@/app/video-editor/_opencut/core";
import { Command, type CommandResult } from "@/app/video-editor/_opencut/commands/base-command";
import { TracksSnapshotCommand } from "@/app/video-editor/_opencut/commands/timeline/tracks-snapshot";
import type { ParamValues } from "@/app/video-editor/_opencut/params";
import type { OverlayTrack, SceneTracks, TextElement } from "@/app/video-editor/_opencut/timeline";
import { generateUUID } from "@/app/video-editor/_opencut/utils/id";
import { mediaTimeFromSeconds, TICKS_PER_SECOND } from "@/app/video-editor/_opencut/wasm";
import { bordeInferiorDe, partirYUbicar } from "./build-subtitle-text-element";
import { lienzoDe, subtitulosDe } from "./insert";
import {
	codificarPalabras,
	coincidenConTexto,
	combinar,
	dividirEnCursor,
	leerCodificadas,
	PARAM_PALABRAS,
	palabrasDe,
	reemplazarEnTexto,
	rehacerPalabras,
	tokens,
	type PalabrasGuardadas,
	type TramoSubtitulo,
} from "./palabras";

const seg = (ticks: number) => ticks / TICKS_PER_SECOND;
const ticks = (s: number) => mediaTimeFromSeconds({ seconds: s });

/** Las palabras de un subtítulo en segundos de la línea de tiempo (null si no tiene o ya no valen). */
export function palabrasDelSubtitulo(el: TextElement): PalabrasGuardadas | null {
	return palabrasDe({
		contenido: String(el.params.content ?? ""),
		param: el.params[PARAM_PALABRAS],
		inicio: seg(el.startTime),
		recorteInicio: seg(el.trimStart),
		duracion: seg(el.duration),
	});
}

/**
 * Los params de un subtítulo con OTRO texto escrito a mano (el panel «Subtítulos» y
 * `cambiar_texto` del chat): las líneas se vuelven a partir con el borde de abajo donde
 * estaba (la X la decide quien lo movió), y los tiempos por palabra siguen si son las
 * mismas palabras (una corrección de ortografía); si cambió cuántas son, se van.
 * Se miran TODAS las palabras guardadas, no sólo las visibles: un subtítulo partido con
 * «Dividir» guarda el texto entero, y re-guardar sólo las visibles las anulaba.
 */
export function paramsConTexto(editor: EditorCore, element: TextElement, texto: string): ParamValues {
	const lienzo = lienzoDe(editor);
	const borde = bordeInferiorDe({ params: element.params, lienzo });
	const ubicado = partirYUbicar({
		params: { ...element.params, content: texto },
		lienzo,
		ubicacion: borde != null ? { bordeInferior: borde } : {},
	});
	const params: ParamValues = { content: ubicado.content, "transform.positionY": ubicado["transform.positionY"] };
	if (!element.params[PARAM_PALABRAS]) return params;
	const g = leerCodificadas(element.params[PARAM_PALABRAS]);
	const valen = g && coincidenConTexto(g.palabras, String(element.params.content ?? "")) ? g : null;
	const rehechas = valen ? rehacerPalabras(valen, texto) : null;
	// Relativas al origen del recorte, como estaban: `origen: 0`.
	params[PARAM_PALABRAS] = rehechas ? codificarPalabras({ palabras: rehechas.palabras, origen: 0, precision: rehechas.precision }) : "";
	return params;
}

/** El texto de un subtítulo con los saltos de línea juntados: lo que DICE. */
const loQueDice = (s: string) => tokens(s).join(" ");

/**
 * Un elemento de subtítulo con otro texto, otro tramo y otras palabras. Vuelve a partir
 * las líneas con el borde de abajo donde estaba; la X no se toca (la decide quien lo movió).
 */
function rehacer(
	editor: EditorCore,
	el: TextElement,
	tramo: TramoSubtitulo,
	opciones: { id?: string; recorteInicio?: number } = {},
): TextElement {
	const lienzo = lienzoDe(editor);
	const borde = bordeInferiorDe({ params: el.params, lienzo });
	const ubicado = partirYUbicar({
		params: { ...el.params, content: tramo.texto },
		lienzo,
		ubicacion: borde != null ? { bordeInferior: borde } : {},
	});
	const recorteInicio = opciones.recorteInicio ?? seg(el.trimStart);
	const params: ParamValues = { ...el.params, content: ubicado.content, "transform.positionY": ubicado["transform.positionY"] };
	delete params[PARAM_PALABRAS];
	if (tramo.palabras && tramo.palabras.palabras.length) {
		params[PARAM_PALABRAS] = codificarPalabras({
			palabras: tramo.palabras.palabras,
			origen: tramo.inicio - recorteInicio,
			precision: tramo.palabras.precision,
		});
	}
	return {
		...el,
		id: opciones.id ?? el.id,
		startTime: ticks(tramo.inicio),
		duration: ticks(Math.max(0.05, tramo.fin - tramo.inicio)),
		trimStart: opciones.recorteInicio !== undefined ? ticks(opciones.recorteInicio) : el.trimStart,
		params,
	};
}

/** Reemplaza elementos de UNA pista de texto en un solo paso de deshacer. */
function aplicarEnPista(
	editor: EditorCore,
	trackId: string,
	cambiar: (elementos: TextElement[]) => TextElement[] | null,
): boolean {
	const before = editor.scenes.getActiveSceneOrNull()?.tracks;
	if (!before) return false;
	let cambio = false;
	const overlay = before.overlay.map((t): OverlayTrack => {
		if (t.id !== trackId || t.type !== "text") return t;
		const nuevos = cambiar(t.elements);
		if (!nuevos) return t;
		cambio = true;
		return { ...t, elements: nuevos };
	});
	if (!cambio) return false;
	const after: SceneTracks = { ...before, overlay };
	editor.command.execute({ command: new TracksSnapshotCommand({ before, after }) });
	return true;
}

const tramoDe = (el: TextElement, texto?: string): TramoSubtitulo => ({
	texto: texto ?? loQueDice(String(el.params.content ?? "")),
	inicio: seg(el.startTime),
	fin: seg(el.startTime + el.duration),
	palabras: palabrasDelSubtitulo(el),
});

/**
 * «Dividir un subtítulo: Enter». `texto` es lo que está escrito en el campo (puede tener
 * una corrección sin confirmar) y `cursor` dónde está el cursor en ese texto. Devuelve el
 * id del subtítulo nuevo (la mitad derecha), o null si no se puede dividir ahí.
 */
export function dividirSubtitulo({
	editor,
	trackId,
	elementId,
	texto,
	cursor,
}: {
	editor: EditorCore;
	trackId: string;
	elementId: string;
	texto: string;
	cursor: number;
}): string | null {
	const track = editor.scenes.getActiveSceneOrNull()?.tracks.overlay.find((t) => t.id === trackId);
	const el = track?.type === "text" ? track.elements.find((e) => e.id === elementId) : undefined;
	if (!el) return null;
	const guardadas = palabrasDelSubtitulo(el);
	// Si lo escrito difiere de lo guardado (una corrección sin confirmar), las palabras
	// valen sólo si siguen siendo las mismas.
	const palabras = guardadas && loQueDice(texto) !== loQueDice(String(el.params.content ?? "")) ? rehacerPalabras(guardadas, texto) : guardadas;
	const partes = dividirEnCursor({ texto, cursor, inicio: seg(el.startTime), fin: seg(el.startTime + el.duration), palabras });
	if (!partes) return null;
	const nuevoId = generateUUID();
	const ok = aplicarEnPista(editor, trackId, (elementos) =>
		elementos.flatMap((e) =>
			e.id === el.id
				? [rehacer(editor, el, partes.izquierda), rehacer(editor, el, partes.derecha, { id: nuevoId, recorteInicio: 0 })]
				: [e],
		),
	);
	return ok ? nuevoId : null;
}

/**
 * «Combinar hacia arriba» (con el anterior) o «hacia abajo» (con el siguiente). Los dos
 * tienen que estar en la misma pista y seguidos en ella; si no, «No se puede combinar
 * aquí». Queda el de arriba, con su estilo. Devuelve el id del que queda, o null.
 */
export function combinarSubtitulo({
	editor,
	trackId,
	elementId,
	texto,
	direccion,
}: {
	editor: EditorCore;
	trackId: string;
	elementId: string;
	texto: string;
	direccion: "arriba" | "abajo";
}): string | null {
	const lista = subtitulosDe(editor.scenes.getActiveSceneOrNull()?.tracks);
	const i = lista.findIndex((s) => s.element.id === elementId);
	if (i < 0) return null;
	const j = direccion === "arriba" ? i - 1 : i + 1;
	const otro = lista[j];
	if (!otro || otro.track.id !== trackId) return null;
	const [primero, segundo] = direccion === "arriba" ? [otro, lista[i]] : [lista[i], otro];
	// Seguidos EN SU PISTA: nada de esa pista entre los dos.
	const enPista = [...primero.track.elements].sort((a, b) => a.startTime - b.startTime);
	if (enPista.indexOf(segundo.element) - enPista.indexOf(primero.element) !== 1) return null;
	// El que se está editando va con lo escrito en el campo (puede tener una corrección sin
	// confirmar); sus palabras valen sólo si siguen siendo las mismas.
	const tramoEditado = (el: TextElement): TramoSubtitulo => {
		if (el.id !== elementId) return tramoDe(el);
		const t = tramoDe(el, loQueDice(texto));
		const guardado = loQueDice(String(el.params.content ?? ""));
		return !t.palabras || t.texto === guardado ? t : { ...t, palabras: rehacerPalabras(t.palabras, t.texto) };
	};
	const junto = combinar(tramoEditado(primero.element), tramoEditado(segundo.element));
	const ok = aplicarEnPista(editor, trackId, (elementos) =>
		elementos.flatMap((e) => (e.id === segundo.element.id ? [] : e.id === primero.element.id ? [rehacer(editor, primero.element, junto)] : [e])),
	);
	return ok ? primero.element.id : null;
}

/**
 * La línea de tiempo con `buscar` reemplazado por `reemplazo` en los subtítulos (o sólo
 * en `soloId`). Devuelve cuántos cambiaron y la línea nueva; con 0, la misma.
 */
function conReemplazo(
	editor: EditorCore,
	before: SceneTracks,
	{ buscar, reemplazo, soloId }: { buscar: string; reemplazo: string; soloId?: string },
): { n: number; after: SceneTracks } {
	if (!buscar.trim()) return { n: 0, after: before };
	let n = 0;
	const overlay = before.overlay.map((t): OverlayTrack => {
		if (t.type !== "text") return t;
		let cambio = false;
		const elementos = t.elements.map((el) => {
			if (el.params.subtitulo !== true || (soloId && el.id !== soloId)) return el;
			const dice = loQueDice(String(el.params.content ?? ""));
			const r = reemplazarEnTexto(dice, buscar, reemplazo);
			if (r.veces === 0 || !r.texto.trim()) return el;
			cambio = true;
			n++;
			const tramo = tramoDe(el, loQueDice(r.texto));
			return rehacer(editor, el, { ...tramo, palabras: tramo.palabras ? rehacerPalabras(tramo.palabras, tramo.texto) : null });
		});
		return cambio ? { ...t, elements: elementos } : t;
	});
	return n ? { n, after: { ...before, overlay } } : { n: 0, after: before };
}

/**
 * «Buscar y reemplazar»: en un subtítulo (`soloId`, «Sustituir») o en todos («Reemplazar
 * todo»), en un solo paso de deshacer. Devuelve en cuántos subtítulos cambió algo.
 */
export function reemplazarEnSubtitulos({
	editor,
	buscar,
	reemplazo,
	soloId,
}: {
	editor: EditorCore;
	buscar: string;
	reemplazo: string;
	soloId?: string;
}): number {
	const before = editor.scenes.getActiveSceneOrNull()?.tracks;
	if (!before) return 0;
	const { n, after } = conReemplazo(editor, before, { buscar, reemplazo, soloId });
	if (n > 0) editor.command.execute({ command: new TracksSnapshotCommand({ before, after }) });
	return n;
}

/**
 * El mismo reemplazo como COMANDO, para meterlo en un lote (el chat, chat/aplicar.ts):
 * calcula sobre la línea de tiempo del momento en que se ejecuta, así ve lo que hicieron
 * los comandos de antes en el mismo lote.
 */
export class ReemplazarSubtitulosCommand extends Command {
	private before: SceneTracks | null = null;
	constructor(private readonly que: { buscar: string; reemplazo: string }) {
		super();
	}
	execute(): CommandResult | undefined {
		const editor = EditorCore.getInstance();
		const before = editor.scenes.getActiveScene().tracks;
		const { n, after } = conReemplazo(editor, before, this.que);
		if (n === 0) return undefined;
		this.before = before;
		editor.timeline.updateTracks(after);
		return undefined;
	}
	undo(): void {
		if (this.before) EditorCore.getInstance().timeline.updateTracks(this.before);
	}
}
