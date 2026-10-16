// =============================================================================
// chat/propuestas — lo que la API de MaKo propuso en el proyecto abierto, como un cambio más del chat
// =============================================================================
// Etapa 3 del diseño AI-native: las operaciones del chat «Editar con IA» pasan a la API (lib/editor-video/chat-api.ts)
// y cada una deja su cambio en una PROPUESTA del proyecto (mig 0302, por /api/video-editor/propuestas). El editor la
// trae y la pone en el hilo como una respuesta de MaKo con su revisión «Original | Modificado»; se acepta con el
// MISMO «Aceptar» (./aplicar.ts → aceptarPropuesta, que la revisa contra la línea de tiempo de ahora con las refs de
// la propuesta) y, aceptada o descartada, se cierra en la base.
//
//   · Se buscan al abrir el editor, al volver a la pestaña y cada tanto mientras se ve. Si llega una nueva, el panel
//     del chat se abre: quien la pidió por WhatsApp la está esperando.
//   · El mensaje tiene el id de la propuesta (`api-<id>`): no se repite al volver a buscar, y si la propuesta creció
//     (otra acción se sumó) el mensaje se actualiza mientras siga pendiente.
//   · Una que ya no está abierta (se resolvió en otra pestaña) queda descartada en el hilo, con su aviso.
// =============================================================================

import { toast } from "sonner";
import type { EditorCore } from "@/app/video-editor/_opencut/core";
import { TICKS_PER_SECOND } from "@/app/video-editor/_opencut/wasm";
import { validarOperaciones } from "@/lib/editor-video/chat-catalogo";
import { CANAL_TEXTO } from "@/lib/editor-video/propuestas";
import { revisarOperaciones, vistaDeLinea } from "./linea";
import { datosDeLinea, disponiblesChat } from "./contexto";
import { cambiarHilo, cambiarMensaje, cargarHilo, leerHilo, type Mensaje, type MensajeMako } from "./hilo";
import { useChatAbierto } from "./estado";

const RUTA = "/api/video-editor/propuestas";
/** Cada cuánto se vuelve a mirar mientras el editor está a la vista. */
const CADA_MS = 60_000;

type PropuestaServer = { id: string; canal: string; escenaId: string; refs: Array<[string, string]>; operaciones: unknown; lineas: string[]; creada: string };

/** El id del mensaje de una propuesta de la API: estable, así no se repite. */
export const idDeMensaje = (propuestaId: string) => `api-${propuestaId}`;

/** El texto del mensaje: de dónde llegó y qué pide, una línea por cambio. */
export function textoDePropuesta(p: { canal: string; lineas: readonly string[] }): string {
	const desde = CANAL_TEXTO[p.canal] ?? p.canal;
	return [`Propuesta por ${desde}:`, ...p.lineas.slice(0, 12).map((l) => `• ${l}`), ...(p.lineas.length > 12 ? [`y ${p.lineas.length - 12} más`] : [])].join("\n");
}

/** Arma el mensaje de una propuesta contra la línea de tiempo de AHORA (lo mismo que mira «Aceptar»). */
async function mensajeDe(editor: EditorCore, proyectoId: string, p: PropuestaServer): Promise<Mensaje | null> {
	const disponibles = await disponiblesChat(editor);
	const escena = editor.scenes.getActiveSceneOrNull();
	if (!escena || editor.project.getActiveOrNull()?.metadata.id !== proyectoId) return null;
	const datos = datosDeLinea(editor, escena.tracks);
	const refsPorId = new Map(p.refs);
	const vista = vistaDeLinea({
		tracks: escena.tracks,
		tps: TICKS_PER_SECOND,
		cabezal: 0,
		elegidos: [],
		refsPrevias: refsPorId,
		disponibles,
		lienzo: datos.lienzo,
		mediosSinAudio: datos.mediosSinAudio,
		conPalabras: datos.conPalabras,
		medios: datos.medios,
	});
	const { operaciones, descartes: deForma } = validarOperaciones(p.operaciones);
	const revision = revisarOperaciones({ operaciones, vista, alcance: "video", transcripcion: datos.transcripcion });
	const descartes = [...deForma, ...revision.descartes];
	const creada = Date.parse(p.creada) || Date.now();
	return {
		id: idDeMensaje(p.id),
		c: creada,
		t: Date.now(),
		de: "mako",
		texto: textoDePropuesta(p),
		estado: "pendiente",
		cambios: revision.cambios,
		...(descartes.length ? { descartes } : {}),
		propuesta: { proyectoId, escenaId: p.escenaId, refsPorId, elegidos: [], alcance: "video", operaciones },
		propuestaApi: { id: p.id, canal: p.canal },
	};
}

let buscando = false;

/** Trae las propuestas abiertas del proyecto abierto y las pone en su hilo. Devuelve cuántas llegaron nuevas. */
export async function traerPropuestas(editor: EditorCore): Promise<number> {
	const proyecto = editor.project.getActiveOrNull();
	if (!proyecto || buscando) return 0;
	const proyectoId = proyecto.metadata.id;
	buscando = true;
	try {
		const res = await fetch(`${RUTA}?proyecto=${encodeURIComponent(proyectoId)}`, { cache: "no-store" });
		const r = (await res.json().catch(() => null)) as { ok?: boolean; propuestas?: PropuestaServer[] } | null;
		if (!r?.ok || !Array.isArray(r.propuestas)) return 0;
		// Lo guardado primero: si la propuesta ya estaba en el hilo, no se repite.
		await cargarHilo(proyectoId, proyecto.metadata.name);
		const abiertas = new Map(r.propuestas.map((p) => [p.id, p] as const));
		const delHilo = leerHilo(proyectoId).mensajes.filter((m): m is MensajeMako => m.de === "mako" && !!m.propuestaApi);
		// Las que ya no están abiertas: se resolvieron en otra pestaña.
		for (const m of delHilo) {
			if (m.estado === "pendiente" && !abiertas.has(m.propuestaApi!.id)) cambiarMensaje(proyectoId, m.id, { estado: "descartada", aviso: "Se resolvió en otra pestaña." });
		}
		const enHilo = new Map(delHilo.map((m) => [m.propuestaApi!.id, m] as const));
		let nuevas = 0;
		for (const p of abiertas.values()) {
			const ya = enHilo.get(p.id);
			// Ya está y no creció (o ya no está pendiente): nada que hacer.
			if (ya && (ya.estado !== "pendiente" || (ya.propuesta?.operaciones.length ?? 0) >= validarOperaciones(p.operaciones).operaciones.length)) continue;
			const m = await mensajeDe(editor, proyectoId, p);
			if (!m) continue;
			if (ya) cambiarHilo(proyectoId, (h) => ({ ...h, mensajes: h.mensajes.map((x) => (x.id === m.id ? m : x)) }));
			else {
				cambiarHilo(proyectoId, (h) => ({ ...h, mensajes: [...h.mensajes, m].sort((a, b) => a.c - b.c) }));
				nuevas++;
			}
		}
		if (nuevas) {
			useChatAbierto.getState().setAbierto(true);
			toast(nuevas === 1 ? "MaKo te propone un cambio" : `MaKo te propone ${nuevas} cambios`);
		}
		return nuevas;
	} catch {
		return 0;
	} finally {
		buscando = false;
	}
}

/** Cierra en la base una propuesta de la API que se aceptó o se descartó en el editor. No espera ni falla. */
export function resolverEnServidor(propuestaId: string, estado: "aplicada" | "descartada", descartes: readonly string[] = []): void {
	void fetch(RUTA, {
		method: "PATCH",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify({ id: propuestaId, estado, descartes }),
	}).catch(() => {});
}

/** Busca al abrir, al volver a la pestaña y cada tanto mientras se ve (lo monta editor-page.tsx). */
export function iniciarPropuestas(editor: EditorCore): () => void {
	const buscar = () => {
		if (typeof document !== "undefined" && document.visibilityState !== "visible") return;
		void traerPropuestas(editor);
	};
	const alPrincipio = setTimeout(buscar, 1500);
	const cada = setInterval(buscar, CADA_MS);
	const alVolver = () => buscar();
	window.addEventListener("focus", alVolver);
	document.addEventListener("visibilitychange", alVolver);
	return () => {
		clearTimeout(alPrincipio);
		clearInterval(cada);
		window.removeEventListener("focus", alVolver);
		document.removeEventListener("visibilitychange", alVolver);
	};
}
