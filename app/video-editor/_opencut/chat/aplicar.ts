// =============================================================================
// chat/aplicar — aceptar y restaurar una propuesta del chat
// =============================================================================
// El contrato es el del Landing (`aceptarPropuesta` en app/web-generator/editor/
// paneles/PanelAgente.tsx), en el mismo orden:
//
//   1. Lo pendiente, guardado (`editor.save.flush`). Si no se guardó, NO se aplica: la
//      revisión ofrece «Aplicar igual».
//   2. Recién ahí, la línea de tiempo: la de AHORA, con las mismas referencias con las que
//      se pidió (`refsPrevias`), y se vuelve a revisar. Lo que se borró o se bloqueó mientras
//      tanto se descarta con su motivo. Las fuentes que pide un estilo se cargan ANTES de
//      mirarla (como el selector de fuentes, que carga y después escribe): después de
//      mirarla no hay otro `await` hasta el lote.
//   3. Todo con los comandos del PROPIO motor (chat/comandos.ts), en un BatchCommand: UN
//      paso de deshacer. Así un corte, un borrado o un cambio de volumen del chat se portan
//      igual que los de la barra (imán, transiciones, fundidos, animaciones). Los cortes por
//      tiempo o por frase van al final del lote.
//   4. Lo que tarda (revertir, congelar, medir para normalizar, subtitular, usar una
//      plantilla) va DESPUÉS, cada uno con su paso: procesa el archivo, transcribe o arma.
//      «Restaurar» deshace todos los pasos. Lo que no cambió nada se dice («No se aplica: …»),
//      no se calla: también un reemplazo que al ejecutarse no entró.
//
// ⚠️ El editor de video no tiene historial de versiones como el Landing («Antes de un cambio
// de IA»): la vuelta atrás es «Restaurar» (el deshacer, si nadie tocó la línea de tiempo
// después) o Ctrl+Z. Está anotado en docs/hallazgos-video-editor.md.
// =============================================================================

import type { EditorCore } from "@/app/video-editor/_opencut/core";
import { BatchCommand } from "@/app/video-editor/_opencut/commands/batch-command";
import type { SceneTracks, TimelineElement, TScene } from "@/app/video-editor/_opencut/timeline/types";
import { plantillaPorId } from "@/lib/editor-video/plantillas";
import { usarPlantilla, type ResultadoUsar } from "@/app/video-editor/_opencut/plantillas/instanciar";
import { leerAncla } from "@/app/video-editor/_opencut/plantillas/huecos";
import { buscarClip } from "@/app/video-editor/_opencut/reemplazo/puro";
import { TICKS_PER_SECOND, roundMediaTime } from "@/app/video-editor/_opencut/wasm";
import type { OperacionChat } from "@/lib/editor-video/chat-catalogo";
import { generarSubtitulos } from "@/app/video-editor/_opencut/subtitles/generar";
import { revertirClip } from "@/app/video-editor/_opencut/commands/timeline/element/revertir";
import { congelarCuadro } from "@/app/video-editor/_opencut/commands/timeline/element/congelar";
import { alternarNormalizacion } from "@/app/video-editor/_opencut/audio/normalizar";
import { NORMALIZAR_OBJETIVO } from "@/app/video-editor/_opencut/audio/claves";
import type { ClipConAudio } from "@/app/video-editor/_opencut/audio/decodificar";
import { loadFonts } from "@/app/video-editor/_opencut/fonts/google-fonts";
import { revisarOperaciones, vistaDeLinea, type OperacionResuelta } from "./linea";
import { armarLote, esLarga, type OperacionLarga } from "./comandos";
import { datosDeLinea, disponiblesChat } from "./contexto";

/** Lo que propuso la IA, con lo necesario para aplicarlo en la línea de tiempo correcta. */
export type PropuestaChat = {
	proyectoId: string;
	escenaId: string;
	/**
	 * La línea de tiempo al mandar (para avisar «Cambiaste la línea de tiempo mientras tanto»). No viene en una
	 * propuesta que se leyó guardada (chat/hilo.ts): esas pistas no se guardan, y la revisión al aceptar es la misma.
	 */
	tracksEnviados?: SceneTracks;
	/** id → ref de la vista que se mandó: de los elementos y de los medios de Multimedia. */
	refsPorId: Map<string, string>;
	elegidos: Array<{ trackId: string; elementId: string }>;
	alcance: "video" | "seleccion";
	operaciones: OperacionChat[];
};

/** Lo necesario para deshacer un cambio aplicado: `pasos` son los del historial (el lote, y uno por cada operación larga). */
export type AplicadaChat = { escenaId: string; antes: SceneTracks; despues: SceneTracks; pasos: number };

export type ResultadoAceptar =
	| { ok: true; aplicada: AplicadaChat; descartes: string[] }
	| { ok: false; error: string; sinVersion?: boolean };

/** Por qué no se armó una plantilla (plantillas/instanciar.ts), para la persona. */
const NO_SE_ARMO: Record<Extract<ResultadoUsar, { ok: false }>["motivo"], string> = {
	"sin-proyecto": "no hay un proyecto abierto",
	"no-vacia": "la plantilla se usa con la línea de tiempo vacía",
	ocupado: "ya se está armando otra plantilla",
	error: "no se pudo cargar la plantilla",
};

/**
 * Una operación larga, contra el elemento de AHORA (el lote pudo moverlo). Devuelve lo que
 * hay que decir de ella (los huecos que quedaron con su muestra, por qué no se armó…).
 */
async function correrLarga(editor: EditorCore, r: OperacionLarga): Promise<string[]> {
	if (r.op === "generar_subtitulos") {
		await generarSubtitulos(editor);
		return [];
	}
	if (r.op === "usar_plantilla") {
		const plantilla = plantillaPorId(r.plantilla);
		if (!plantilla) return [`no existe la plantilla «${r.plantilla}»`];
		// La MISMA entrada que la pestaña Plantillas: fuentes, muestras y un paso de deshacer.
		const usada = await usarPlantilla(editor, plantilla, { textos: r.textos, medios: r.medios, avisar: false });
		return usada.ok ? usada.descartes : [NO_SE_ARMO[usada.motivo]];
	}
	const objetivo = { trackId: r.el.trackId, elementId: r.el.elementId };
	const [par] = editor.timeline.getElementsWithTracks({ elements: [objetivo] });
	if (!par) return [];
	if (r.op === "revertir") {
		await revertirClip(editor, objetivo);
		return [];
	}
	if (r.op === "congelar") {
		const desde = Math.round(r.desde * TICKS_PER_SECOND);
		if (desde >= par.element.duration) return [];
		await congelarCuadro(editor, { ...objetivo, tiempo: roundMediaTime({ time: par.element.startTime + desde }) });
		return [];
	}
	if (par.element.type !== "video" && par.element.type !== "audio") return [];
	// «Normalizar la intensidad» con el objetivo pedido: mide y escribe en un paso (audio/normalizar.ts).
	const clip = { ...par.element, params: { ...par.element.params, [NORMALIZAR_OBJETIVO]: r.objetivo } } as ClipConAudio;
	await alternarNormalizacion({ editor, trackId: objetivo.trackId, element: clip, mediaAssets: editor.media.getAssets(), activar: true }).catch(() => null);
	return [];
}

const QUE_NO_SE_PUDO: Record<OperacionLarga["op"], string> = {
	revertir: "revertir",
	congelar: "congelar",
	normalizar: "normalizar",
	generar_subtitulos: "generar los subtítulos",
	usar_plantilla: "usar la plantilla",
};

/** Las fuentes de los textos de plantilla que se van a reescribir: se vuelven a partir midiendo con ELLAS. */
function fuentesDeHuecos(editor: EditorCore, p: PropuestaChat): string[] {
	const tracks = editor.scenes.getActiveSceneOrNull()?.tracks;
	if (!tracks) return [];
	const idPorRef = new Map([...p.refsPorId].map(([id, ref]) => [ref, id] as const));
	const textos = tracks.overlay.flatMap((t) => t.elements as TimelineElement[]).filter((e) => e.type === "text");
	return p.operaciones.flatMap((o) => {
		if (o.op !== "cambiar_texto") return [];
		const el = textos.find((e) => e.id === idPorRef.get(o.ref));
		const familia = el && leerAncla(el.params) ? String(el.params.fontFamily ?? "") : "";
		return familia ? [familia] : [];
	});
}

/** ACEPTAR. El orden es el contrato (ver la cabecera). */
export async function aceptarPropuesta(editor: EditorCore, p: PropuestaChat, op: { sinVersion?: boolean } = {}): Promise<ResultadoAceptar> {
	const enSuLugar = (): { error: string } | { escena: TScene } => {
		const proyecto = editor.project.getActiveOrNull();
		const escena = editor.scenes.getActiveSceneOrNull();
		if (!proyecto || proyecto.metadata.id !== p.proyectoId) return { error: "Es de otro proyecto" };
		if (!escena || escena.id !== p.escenaId) return { error: "Es de otra escena" };
		return { escena };
	};
	const alPedir = enSuLugar();
	if ("error" in alPedir) return { ok: false, error: alPedir.error };

	// 1. Lo pendiente, guardado.
	if (!op.sinVersion) {
		try {
			await editor.save.flush();
		} catch {
			return { ok: false, error: "No se guardó el proyecto", sinVersion: true };
		}
	}

	// 2. Lo del motor y las fuentes de los estilos, ANTES de mirar la línea de tiempo.
	const disponibles = await disponiblesChat(editor);
	const fuentes = [
		...p.operaciones.flatMap((o) =>
			o.op === "estilo_texto" && o.estilo.fuente ? [disponibles.fuentes.todas.get(o.estilo.fuente.toLowerCase()) ?? o.estilo.fuente] : [],
		),
		...fuentesDeHuecos(editor, p),
	];
	if (fuentes.length) await loadFonts({ families: [...new Set(fuentes)] }).catch(() => {});

	// La línea de tiempo de AHORA (pudo cambiar durante los `await`). De acá al lote, sin esperas.
	const lugar = enSuLugar();
	if ("error" in lugar) return { ok: false, error: lugar.error };
	const antes = lugar.escena.tracks;
	const datos = datosDeLinea(editor, antes);
	const vista = vistaDeLinea({
		tracks: antes,
		tps: TICKS_PER_SECOND,
		cabezal: 0,
		elegidos: p.elegidos,
		refsPrevias: p.refsPorId,
		disponibles,
		lienzo: datos.lienzo,
		mediosSinAudio: datos.mediosSinAudio,
		conPalabras: datos.conPalabras,
		medios: datos.medios,
	});
	const { resueltas, descartes } = revisarOperaciones({ operaciones: p.operaciones, vista, alcance: p.alcance, transcripcion: datos.transcripcion });
	if (!resueltas.length) return { ok: false, error: descartes[0] ? `No se aplica: ${descartes[0]}` : "Ya no hay nada que cambiar" };

	// 3. Un paso de deshacer para lo que se arma en el momento.
	const lote = armarLote(resueltas, { idioma: datos.transcripcion.idioma });
	const largas = resueltas.filter(esLarga);
	const actuales = () => editor.scenes.getActiveSceneOrNull()?.tracks;
	let pasos = 0;
	if (lote.comandos.length) {
		const comandos = lote.comandos;
		editor.command.execute({ command: comandos.length === 1 ? comandos[0] : new BatchCommand(comandos) });
		if (actuales() !== antes) pasos++;
		for (const { que, comando } of lote.cortes) {
			const hecho = comando.resumen();
			if (!hecho) descartes.push(`no se cortó ${que}`);
			else if (hecho.sinClip) descartes.push(`${hecho.sinClip === 1 ? "un tramo" : `${hecho.sinClip} tramos`} de ${que} sin video debajo`);
		}
		// Un reemplazo que al ejecutarse no entró (el video no alcanzaba, el medio ya no estaba)
		// no cambia nada y no avisa: se mira si el clip quedó con el medio pedido (el último, si hubo varios).
		const reemplazos = new Map<string, Extract<OperacionResuelta, { op: "reemplazar_clip" }>>();
		for (const r of resueltas) if (r.op === "reemplazar_clip") reemplazos.set(r.el.elementId, r);
		const ahora = actuales();
		for (const r of reemplazos.values()) {
			const clip = ahora ? buscarClip(ahora, { trackId: r.el.trackId, elementId: r.el.elementId }) : null;
			if (clip?.element.mediaId !== r.mediaId) descartes.push(`no se pudo reemplazar ${r.el.titulo}`);
		}
	}

	// 4. Lo que tarda, después y aparte: cada uno con su paso.
	for (const r of largas) {
		const previo = actuales();
		const avisos = await correrLarga(editor, r);
		descartes.push(...avisos);
		if (actuales() !== previo) pasos++;
		else if (!avisos.length) descartes.push(`no se pudo ${QUE_NO_SE_PUDO[r.op]}${"el" in r ? ` ${r.el.titulo}` : ""}`);
	}
	const despues = actuales();
	// Si la línea de tiempo no cambió, no se aplicó: decir «Aplicado» sería mentir.
	if (!despues || despues === antes || pasos === 0) return { ok: false, error: descartes[0] ? `No se aplica: ${descartes[0]}` : "No se aplicó el cambio" };
	return { ok: true, aplicada: { escenaId: p.escenaId, antes, despues, pasos }, descartes };
}

/**
 * «Restaurar» un cambio aplicado con el deshacer del editor, SÓLO si nadie tocó la línea de
 * tiempo después (es el mismo objeto que dejó el cambio). Si el deshacer no vuelve
 * exactamente a lo de antes, se rehace y devuelve false: ahí la vuelta es Ctrl+Z.
 */
export function deshacerPropuesta(editor: EditorCore, a: AplicadaChat): boolean {
	const escena = editor.scenes.getActiveSceneOrNull();
	if (!escena || escena.id !== a.escenaId || escena.tracks !== a.despues) return false;
	for (let i = 0; i < a.pasos; i++) editor.command.undo();
	if (editor.scenes.getActiveSceneOrNull()?.tracks === a.antes) return true;
	for (let i = 0; i < a.pasos; i++) editor.command.redo();
	return false;
}
