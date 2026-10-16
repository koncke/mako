// =============================================================================
// chat/espejo — el editor sube la copia de LECTURA del proyecto abierto (para la API de MaKo)
// =============================================================================
// Etapa 3 del diseño AI-native (docs/diseno-mako-ai-native.md): el proyecto vive en el navegador y la API en el
// server. Un rato después de cada cambio (como el guardado del motor, core/managers/save-manager.ts) se arma la MISMA
// vista que lee el chat «Editar con IA» (./linea.ts → vistaDeLinea, con lo de ./contexto.ts) y se sube por
// /api/video-editor/proyectos. La leen `listar_proyectos_video` y `ver_proyecto_video`. Reglas: lib/editor-video/espejo.ts.
//
//   · LAS REFS NO SE REUSAN: la primera vez se leen las que la copia ya tiene, y se pasan como `refsPrevias`, así
//     «t2» sigue siendo el mismo texto entre una subida y otra, entre recargas, y una propuesta vieja no cae sobre
//     algo nuevo.
//   · NO SE SUBE LO MISMO DOS VECES: si la vista y las refs no cambiaron, no hay pedido.
//   · SIN LA TABLA (la migración no se aplicó) se deja de intentar en la pestaña.
//   · LO QUE MIRA ES LO DEL CHAT: sin selección y con el cabezal en 0 (no son del proyecto, son de quien lo mira).
// =============================================================================

import type { EditorCore } from "@/app/video-editor/_opencut/core";
import { TICKS_PER_SECOND } from "@/app/video-editor/_opencut/wasm";
import { TOPES_CHAT } from "@/lib/editor-video/chat-catalogo";
import { unirRefs } from "@/lib/editor-video/espejo";
import { vistaDeLinea } from "./linea";
import { datosDeLinea, disponiblesChat } from "./contexto";
import { alBorrarCopia } from "./espejo-borrar";

/** Un rato después del último cambio: editar seguido no sube una copia por tecla. */
const ESPERA_MS = 6000;
const RUTA = "/api/video-editor/proyectos";

/** Por proyecto: las refs que se recuerdan y lo último que se subió (para no repetir). */
const refsPorProyecto = new Map<string, Array<[string, string]>>();
const ultimaSubida = new Map<string, string>();
let sinTabla = false;

async function refsGuardadas(proyectoId: string): Promise<Array<[string, string]> | null> {
	const ya = refsPorProyecto.get(proyectoId);
	if (ya) return ya;
	try {
		const res = await fetch(`${RUTA}?proyecto=${encodeURIComponent(proyectoId)}`, { cache: "no-store" });
		const r = (await res.json().catch(() => null)) as { ok?: boolean; refs?: unknown; sinTabla?: boolean } | null;
		if (r?.sinTabla) {
			sinTabla = true;
			return null;
		}
		if (!r?.ok) return null;
		const refs = unirRefs(r.refs, []);
		refsPorProyecto.set(proyectoId, refs);
		return refs;
	} catch {
		return null;
	}
}

/** Arma la copia del proyecto abierto y la sube, si cambió. */
export async function subirEspejo(editor: EditorCore): Promise<void> {
	if (sinTabla) return;
	const proyecto = editor.project.getActiveOrNull();
	if (!proyecto || editor.project.getIsLoading()) return;
	const proyectoId = proyecto.metadata.id;
	const previas = await refsGuardadas(proyectoId);
	if (!previas || sinTabla) return;
	const disponibles = await disponiblesChat(editor);
	// Lo que hay AHORA (pudo cambiar durante los `await`): el mismo proyecto, y su escena.
	if (editor.project.getActiveOrNull()?.metadata.id !== proyectoId) return;
	const escena = editor.scenes.getActiveSceneOrNull();
	if (!escena) return;
	const datos = datosDeLinea(editor, escena.tracks);
	const vista = vistaDeLinea({
		tracks: escena.tracks,
		tps: TICKS_PER_SECOND,
		cabezal: 0,
		elegidos: [],
		refsPrevias: new Map(previas),
		disponibles,
		lienzo: datos.lienzo,
		mediosSinAudio: datos.mediosSinAudio,
		conPalabras: datos.conPalabras,
		medios: datos.medios,
	});
	const actuales: Array<[string, string]> = [
		...[...vista.refs.values()].map((x) => [x.elementId, x.ref] as [string, string]),
		...[...vista.medios.values()].map((m) => [m.mediaId, m.ref] as [string, string]),
	];
	const refs = unirRefs(previas, actuales);
	refsPorProyecto.set(proyectoId, refs);
	const demasiadoGrande = vista.json.length > TOPES_CHAT.vistaMax;
	const cuerpo = JSON.stringify({
		proyecto: proyectoId,
		nombre: proyecto.metadata.name,
		escenaId: escena.id,
		duracion: Number(proyecto.metadata.duration ?? 0) / TICKS_PER_SECOND,
		vista: demasiadoGrande ? null : vista.json,
		demasiadoGrande,
		refs,
	});
	if (ultimaSubida.get(proyectoId) === cuerpo) return;
	try {
		const res = await fetch(RUTA, { method: "PUT", headers: { "Content-Type": "application/json" }, body: cuerpo });
		const r = (await res.json().catch(() => null)) as { ok?: boolean; sinTabla?: boolean } | null;
		if (r?.sinTabla) sinTabla = true;
		else if (r?.ok) ultimaSubida.set(proyectoId, cuerpo);
	} catch {
		// Sin red: se vuelve a intentar con el próximo cambio.
	}
}

// Un proyecto borrado (core/managers/project-manager.ts → ./espejo-borrar.ts): se olvida lo que se recordaba de él.
alBorrarCopia((proyectoId) => {
	refsPorProyecto.delete(proyectoId);
	ultimaSubida.delete(proyectoId);
});

/**
 * Escucha los cambios del editor y sube la copia un rato después del último. Devuelve con qué dejar de escuchar
 * (lo monta editor-page.tsx). También sube al abrir: un proyecto viejo tiene copia apenas se abre.
 */
export function iniciarEspejo(editor: EditorCore): () => void {
	let timer: ReturnType<typeof setTimeout> | null = null;
	const programar = () => {
		if (sinTabla) return;
		if (timer) clearTimeout(timer);
		timer = setTimeout(() => {
			timer = null;
			void subirEspejo(editor);
		}, ESPERA_MS);
	};
	const bajas = [editor.scenes.subscribe(programar), editor.timeline.subscribe(programar), editor.project.subscribe(programar)];
	programar();
	return () => {
		for (const baja of bajas) baja();
		if (timer) clearTimeout(timer);
	};
}
