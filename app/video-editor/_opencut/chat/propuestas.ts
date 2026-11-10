// =============================================================================
// chat/propuestas — lo que la API de MaKo propuso en el proyecto abierto, como un cambio más del chat
// =============================================================================
// Etapa 3 del diseño AI-native: las operaciones del chat «Editar con IA» pasan a la API (lib/editor-video/chat-api.ts)
// y cada una deja su cambio en una PROPUESTA del proyecto (mig 0302, por /api/video-editor/propuestas). El editor la
// trae y la pone en el hilo como una respuesta de MaKo con su revisión «Original | Modificado»; se acepta con el
// MISMO «Aceptar» (./aplicar.ts → aceptarPropuesta, que la revisa contra la línea de tiempo de ahora con las refs de
// la propuesta) y, aceptada o descartada, se cierra en la base.
//
//   · Se buscan al abrir el editor, al volver a la pestaña y cada tanto mientras se ve. Si llega una nueva, lo avisa:
//     quien la pidió por WhatsApp la está esperando (el chat ya está a la vista: desde el 29/10/2026 no se cierra).
//   · El mensaje tiene el id de la propuesta (`api-<id>`): no se repite al volver a buscar, y si la propuesta creció
//     (otra acción se sumó) el mensaje se actualiza mientras siga pendiente.
//   · Una que ya no está abierta (se resolvió en otra pestaña) queda descartada en el hilo, con su aviso.
//   · ⚠️ EL LINK ABRE ESA PROPUESTA. La API y el Ops Center mandan a `/video-editor/<p>?propuesta=<id>`, y hasta el
//     20/10 el `?propuesta=` no lo leía nadie: el editor traía todas y abría el panel SÓLO si llegaba una nueva. Quien
//     tocaba «Aceptar en el editor» por segunda vez caía en el editor con el chat cerrado y sin saber dónde estaba lo
//     que venía a aceptar. Ahora el chat baja hasta esa propuesta y la resalta; si ya se resolvió, lo dice.
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
import { focoDePropuesta, idDeMensaje, queMostrar } from "./foco";

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
async function mensajeDe(editor: EditorCore, proyectoId: string, p: PropuestaServer, id: string = idDeMensaje(p.id)): Promise<Mensaje | null> {
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
		fondo: datos.fondo,
	});
	const { operaciones, descartes: deForma } = validarOperaciones(p.operaciones);
	const revision = revisarOperaciones({ operaciones, vista, alcance: "video", transcripcion: datos.transcripcion });
	const descartes = [...deForma, ...revision.descartes];
	const creada = Date.parse(p.creada) || Date.now();
	return {
		id,
		c: creada,
		t: Date.now(),
		de: "mako",
		texto: textoDePropuesta(p),
		estado: "pendiente",
		cambios: revision.cambios,
		...(descartes.length ? { descartes } : {}),
		propuesta: { proyectoId, escenaId: p.escenaId, refsPorId, elegidos: [], alcance: "video", operaciones },
		// Al aceptar o descartar se cierran en la base EXACTAMENTE las operaciones de este mensaje (por contenido).
		propuestaApi: { id: p.id, canal: p.canal, version: Number(p.version) || 0, cuantas: operaciones.length },
	};
}

let buscando = false;

/** Una operación guardada como la ve el editor (validada), para compararla por contenido con lo que mostró un mensaje. */
const comoLaVe = (op: unknown): unknown => validarOperaciones([op]).operaciones[0] ?? op;

/** Cuántas propuestas pide el editor por id, como mucho (lib/editor-video/propuestas-server.ts → TOPE_INCLUIR). */
const TOPE_INCLUIR = 40;

/**
 * Trae las propuestas abiertas del proyecto abierto y las pone en su hilo. Devuelve cuántas llegaron nuevas y cuáles
 * están abiertas, o `null` si no pudo mirar (el proyecto todavía no cargó, otra búsqueda en curso, la red).
 *
 *   · Pide POR ID las que le importan (la del link, las pendientes y las de cierre sin confirmar): una que no vino en
 *     el listado de 20 se daba por «resuelta en otra pestaña» sin estarlo (revisión del 21/10). Lo pedido por id que
 *     no vuelve, sí está cerrado.
 *   · Reintenta los cierres que no llegaron a la base (la red, la sesión, un choque).
 *   · De cada abierta, muestra sólo lo que ningún mensaje manejó (./foco.ts → queMostrar).
 */
export async function traerPropuestas(editor: EditorCore, opciones: { incluir?: string | null } = {}): Promise<{ nuevas: number; abiertas: string[] } | null> {
	const proyecto = editor.project.getActiveOrNull();
	if (!proyecto || buscando) return null;
	const proyectoId = proyecto.metadata.id;
	buscando = true;
	try {
		// Lo guardado primero: hace falta para saber qué pedir por id, y para no repetir lo que ya está.
		await cargarHilo(proyectoId, proyecto.metadata.name);
		const deApi = () => leerHilo(proyectoId).mensajes.filter((m): m is MensajeMako => m.de === "mako" && !!m.propuestaApi);
		const sinCerrar = (m: MensajeMako) => m.estado === "pendiente" || !m.propuestaApi?.cerrada;
		const pedir = [...new Set([opciones.incluir ?? "", ...deApi().filter(sinCerrar).map((m) => m.propuestaApi!.id)].filter(Boolean))].slice(0, TOPE_INCLUIR);
		const qs = pedir.map((id) => `&propuesta=${encodeURIComponent(id)}`).join("");
		const res = await fetch(`${RUTA}?proyecto=${encodeURIComponent(proyectoId)}${qs}`, { cache: "no-store" });
		const r = (await res.json().catch(() => null)) as { ok?: boolean; propuestas?: PropuestaServer[] } | null;
		if (!r?.ok || !Array.isArray(r.propuestas)) return null;
		const abiertas = new Map(r.propuestas.map((p) => [p.id, p] as const));
		const pedidas = new Set(pedir);

		for (const m of deApi()) {
			const id = m.propuestaApi!.id;
			if (!abiertas.has(id)) {
				// Sólo se afirma «se resolvió» de lo que se pidió por id y no volvió.
				if (!pedidas.has(id)) continue;
				if (m.estado === "pendiente") cambiarMensaje(proyectoId, m.id, { estado: "descartada", aviso: "Se resolvió en otra pestaña.", propuestaApi: { ...m.propuestaApi!, cerrada: true } });
				else if (!m.propuestaApi!.cerrada) cambiarMensaje(proyectoId, m.id, { propuestaApi: { ...m.propuestaApi!, cerrada: true } });
				continue;
			}
			// Un cierre que no llegó a la base (aceptada, descartada o deshecha): se vuelve a mandar. Es idempotente:
			// lo que ya no está no se saca dos veces.
			const manejada = m.estado === "aplicada" || m.estado === "descartada" || m.estado === "restaurada";
			if (manejada && !m.propuestaApi!.cerrada && m.propuesta) {
				void resolverEnServidor(id, m.estado === "descartada" ? "descartada" : "aplicada", [], m.propuesta.operaciones).then((c) => {
					if (c.cerrada) marcarCerrada(proyectoId, m.id);
				});
			}
		}

		let nuevas = 0;
		for (const p of abiertas.values()) {
			const crudas = Array.isArray(p.operaciones) ? p.operaciones : [];
			const suyos = deApi().filter((m) => m.propuestaApi!.id === p.id);
			const d = queMostrar(p.id, crudas.map(comoLaVe), suyos.map((m) => ({ id: m.id, estado: m.estado, cerrada: !!m.propuestaApi?.cerrada, ops: m.propuesta?.operaciones ?? [] })));
			if (d.accion === "nada") continue;
			const lineas = Array.isArray(p.lineas) && p.lineas.length === crudas.length ? d.quedan.map((i) => p.lineas[i]) : p.lineas;
			const m = await mensajeDe(editor, proyectoId, { ...p, operaciones: d.quedan.map((i) => crudas[i]), lineas }, d.id);
			if (!m) continue;
			if (d.accion === "reemplazar") cambiarHilo(proyectoId, (h) => ({ ...h, mensajes: h.mensajes.map((x) => (x.id === d.id ? m : x)) }));
			else {
				cambiarHilo(proyectoId, (h) => ({ ...h, mensajes: [...h.mensajes, m].sort((a, b) => a.c - b.c) }));
				nuevas++;
			}
		}
		if (nuevas) {
			toast(nuevas === 1 ? "MaKo te propone un cambio" : `MaKo te propone ${nuevas} cambios`);
		}
		return { nuevas, abiertas: [...abiertas.keys()] };
	} catch {
		return null;
	} finally {
		buscando = false;
	}
}

/** Anota en el mensaje que la base confirmó su cierre: no se vuelve a mandar. */
export function marcarCerrada(proyectoId: string, mensajeId: string): void {
	const m = leerHilo(proyectoId).mensajes.find((x): x is MensajeMako => x.id === mensajeId && x.de === "mako");
	if (m?.propuestaApi && !m.propuestaApi.cerrada) cambiarMensaje(proyectoId, mensajeId, { propuestaApi: { ...m.propuestaApi, cerrada: true } });
}

/**
 * Cierra en la base lo que tenía un mensaje que se aceptó o se descartó en el editor: EXACTAMENTE esas operaciones
 * (`ops`), por contenido. Nunca falla: `cerrada` = la base lo confirmó (o ya no estaba abierta); `quedan` = cuántas
 * siguen abiertas en esa propuesta (llegaron después).
 */
export async function resolverEnServidor(
	propuestaId: string,
	estado: "aplicada" | "descartada",
	descartes: readonly string[] = [],
	ops: readonly unknown[] = [],
): Promise<{ cerrada: boolean; quedan: number }> {
	try {
		const res = await fetch(RUTA, {
			method: "PATCH",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ id: propuestaId, estado, descartes, ops }),
		});
		const r = (await res.json().catch(() => null)) as { ok?: unknown; yaResuelta?: unknown; quedan?: unknown } | null;
		const quedan = typeof r?.quedan === "number" && r.quedan > 0 ? r.quedan : 0;
		return { cerrada: r?.ok === true || r?.yaResuelta === true, quedan };
	} catch {
		return { cerrada: false, quedan: 0 };
	}
}

/** Lleva el chat a la propuesta del link, o dice por qué no está. */
function enfocarPropuesta(proyectoId: string, propuestaId: string, abiertas: readonly string[]): void {
	const f = focoDePropuesta(propuestaId, new Set(abiertas), leerHilo(proyectoId).mensajes);
	if (f.mensajeId) useChatAbierto.getState().setFoco(f.mensajeId);
	if (f.aviso) toast(f.aviso);
}

/** Cuántas veces se reintenta la primera búsqueda con `?propuesta=` mientras el proyecto carga (cada 1,5 s). */
const INTENTOS_FOCO = 20;

/**
 * Busca al abrir, al volver a la pestaña y cada tanto mientras se ve (lo monta editor-page.tsx). Con `foco` (el
 * `?propuesta=` del link), la primera búsqueda se reintenta hasta que el proyecto cargó y lleva el chat a ESA.
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
