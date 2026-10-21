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
//   · ⚠️ EL LINK ABRE ESA PROPUESTA. La API y el Ops Center mandan a `/video-editor/<p>?propuesta=<id>`, y hasta el
//     20/10 el `?propuesta=` no lo leía nadie: el editor traía todas y abría el panel SÓLO si llegaba una nueva. Quien
//     tocaba «Aceptar en el editor» por segunda vez caía en el editor con el chat cerrado y sin saber dónde estaba lo
//     que venía a aceptar. Ahora el panel se abre, baja hasta esa propuesta y la resalta; si ya se resolvió, lo dice.
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
import { focoDePropuesta, idDeMensaje } from "./foco";

const RUTA = "/api/video-editor/propuestas";
/** Cada cuánto se vuelve a mirar mientras el editor está a la vista. */
const CADA_MS = 60_000;

type PropuestaServer = { id: string; canal: string; escenaId: string; refs: Array<[string, string]>; operaciones: unknown; lineas: string[]; creada: string; version: number };

export { idDeMensaje };

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
		// Lo que el editor VIO: al resolver se manda, y si la propuesta creció se cierra sólo esto.
		propuestaApi: { id: p.id, canal: p.canal, version: Number(p.version) || 0, cuantas: Array.isArray(p.operaciones) ? p.operaciones.length : 0 },
	};
}

let buscando = false;

/**
 * Trae las propuestas abiertas del proyecto abierto y las pone en su hilo. Devuelve cuántas llegaron nuevas y cuáles
 * están abiertas, o `null` si no pudo mirar (el proyecto todavía no cargó, otra búsqueda en curso, la red).
 */
export async function traerPropuestas(editor: EditorCore, opciones: { incluir?: string | null } = {}): Promise<{ nuevas: number; abiertas: string[] } | null> {
	const proyecto = editor.project.getActiveOrNull();
	if (!proyecto || buscando) return null;
	const proyectoId = proyecto.metadata.id;
	buscando = true;
	try {
		// `propuesta`: la del link llega siempre, aunque haya más de 20 abiertas (lib/editor-video/propuestas-server.ts).
		const incluir = opciones.incluir ? `&propuesta=${encodeURIComponent(opciones.incluir)}` : "";
		const res = await fetch(`${RUTA}?proyecto=${encodeURIComponent(proyectoId)}${incluir}`, { cache: "no-store" });
		const r = (await res.json().catch(() => null)) as { ok?: boolean; propuestas?: PropuestaServer[] } | null;
		if (!r?.ok || !Array.isArray(r.propuestas)) return null;
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
			let ya = enHilo.get(p.id);
			if (ya && ya.estado !== "pendiente") {
				// ⚠️ LO QUE QUEDÓ de una propuesta que se resolvió EN PARTE (creció mientras se aceptaba: repartoAlResolver).
				// El mensaje viejo queda como historia con otro id, y el resto entra como uno nuevo con el id de siempre:
				// el link de la tarjeta lo sigue abriendo.
				const vio = ya.propuestaApi?.version;
				if (vio === undefined || vio === Number(p.version)) continue;
				const viejo = ya.id;
				cambiarHilo(proyectoId, (h) => ({ ...h, mensajes: h.mensajes.map((x) => (x.id === viejo ? { ...x, id: `${viejo}-v${vio}` } : x)) }));
				ya = undefined;
			} else if (ya && (ya.propuesta?.operaciones.length ?? 0) >= validarOperaciones(p.operaciones).operaciones.length) {
				// Ya está pendiente y no creció: nada que hacer.
				continue;
			}
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
		return { nuevas, abiertas: [...abiertas.keys()] };
	} catch {
		return null;
	} finally {
		buscando = false;
	}
}

/**
 * Cierra en la base una propuesta de la API que se aceptó o se descartó en el editor. Nunca falla: devuelve cuántos
 * cambios QUEDAN abiertos (los que llegaron después de lo que el editor vio, `vio`), o 0.
 */
export async function resolverEnServidor(
	propuestaId: string,
	estado: "aplicada" | "descartada",
	descartes: readonly string[] = [],
	vio: { version?: number; cuantas?: number } = {},
): Promise<number> {
	try {
		const res = await fetch(RUTA, {
			method: "PATCH",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ id: propuestaId, estado, descartes, version: vio.version, cuantas: vio.cuantas }),
		});
		const r = (await res.json().catch(() => null)) as { quedan?: unknown } | null;
		return typeof r?.quedan === "number" && r.quedan > 0 ? r.quedan : 0;
	} catch {
		return 0;
	}
}

/** Abre el panel en la propuesta del link, o dice por qué no está. */
function enfocarPropuesta(proyectoId: string, propuestaId: string, abiertas: readonly string[]): void {
	const f = focoDePropuesta(propuestaId, new Set(abiertas), leerHilo(proyectoId).mensajes);
	const estado = useChatAbierto.getState();
	estado.setAbierto(true);
	if (f.mensajeId) estado.setFoco(f.mensajeId);
	if (f.aviso) toast(f.aviso);
}

/** Cuántas veces se reintenta la primera búsqueda con `?propuesta=` mientras el proyecto carga (cada 1,5 s). */
const INTENTOS_FOCO = 20;

/**
 * Busca al abrir, al volver a la pestaña y cada tanto mientras se ve (lo monta editor-page.tsx). Con `foco` (el
 * `?propuesta=` del link), la primera búsqueda se reintenta hasta que el proyecto cargó y abre el panel en ESA.
 */
export function iniciarPropuestas(editor: EditorCore, opciones: { foco?: string | null; proyecto?: string } = {}): () => void {
	let pendienteDeFoco = opciones.foco ?? null;
	let intentos = 0;
	let reintento: ReturnType<typeof setTimeout> | null = null;
	// ⚠️ Una búsqueda en vuelo termina DESPUÉS de que este editor se fue (otra página, otro proyecto): su foco ya no es
	// de nadie y no se usa (revisión del 20/10).
	let cancelado = false;
	const buscar = () => {
		if (typeof document !== "undefined" && document.visibilityState !== "visible") return;
		void traerPropuestas(editor, { incluir: pendienteDeFoco }).then((r) => {
			if (cancelado || !pendienteDeFoco) return;
			const proyectoId = editor.project.getActiveOrNull()?.metadata.id;
			// ⚠️ EL FOCO ES DEL PROYECTO DEL LINK, no del que esté activo: mientras carga puede seguir el anterior, o uno
			// vacío si el del link no está en este navegador. Con otro activo, las abiertas son de otro proyecto y la
			// propuesta parecería «ya no abierta» sin serlo.
			if (r && proyectoId && (!opciones.proyecto || proyectoId === opciones.proyecto)) {
				const foco = pendienteDeFoco;
				pendienteDeFoco = null;
				enfocarPropuesta(proyectoId, foco, r.abiertas);
				return;
			}
			// ⚠️ El proyecto tarda en cargar (y la primera búsqueda sale a los 1,5 s): sin reintentar, el foco se perdía
			// justo en la apertura que lo traía.
			if (++intentos < INTENTOS_FOCO) reintento = setTimeout(buscar, 1500);
		});
	};
	const alPrincipio = setTimeout(buscar, 1500);
	const cada = setInterval(buscar, CADA_MS);
	const alVolver = () => buscar();
	window.addEventListener("focus", alVolver);
	document.addEventListener("visibilitychange", alVolver);
	return () => {
		cancelado = true;
		clearTimeout(alPrincipio);
		if (reintento) clearTimeout(reintento);
		clearInterval(cada);
		window.removeEventListener("focus", alVolver);
		document.removeEventListener("visibilitychange", alVolver);
	};
}
