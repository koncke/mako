// =============================================================================
// chat/hilo — el hilo del chat «Editar con IA»: un store de módulo, por proyecto, guardado en la base
// =============================================================================
// Un store y no un estado del componente: el panel se cierra y se desmonta, y la respuesta de un pedido largo tiene
// que caer en el chat aunque el panel no esté abierto cuando llega.
//
// Desde el 16/10 (etapa 3 del diseño AI-native) el hilo además se GUARDA: uno por persona y por proyecto en
// `video_editor_chats` (mig 0298), por /api/video-editor/chat. El formato y el saneo son de
// lib/editor-video/chat-hilo.ts. Cómo se sincroniza:
//   · se LEE la primera vez que se abre el chat de un proyecto (`cargarHilo`) y se UNE con lo que la pestaña ya tenga;
//   · se GUARDA un rato después de cada cambio (un pedido, una respuesta, un «Aceptar»), con la versión leída;
//   · ante un 409 (otra pestaña guardó en el medio) se une por id —gana el último cambio de cada mensaje— y se
//     vuelve a guardar;
//   · SIN la tabla (la migración no se aplicó) se deja de intentar: el hilo sigue en la pestaña, como antes.
// Lo que no sobrevive a recargar (el deshacer de una aplicada, las pistas de cuando se pidió) se queda en memoria y
// no se guarda: una aplicada que vuelve de la base ya no tiene «Restaurar».
// =============================================================================

import {
	hiloAlAbrir,
	hiloParaGuardar,
	unirHilos,
	type EstadoPropuesta,
	type MensajeGuardado,
} from "@/lib/editor-video/chat-hilo";
import type { CambioChat } from "./linea";
import type { AplicadaChat, PropuestaChat } from "./aplicar";

export type { EstadoPropuesta };

/** `c`: cuándo se creó; `t`: su último cambio (ms). */
export type Mensaje =
	| { id: string; c: number; t: number; de: "yo"; texto: string; alcance: string | null }
	| {
			id: string;
			c: number;
			t: number;
			de: "mako";
			texto: string;
			error?: boolean;
			propuesta?: PropuestaChat;
			cambios?: CambioChat[];
			descartes?: string[];
			estado?: EstadoPropuesta;
			aviso?: string;
			/** Sólo en memoria: lo que hace falta para «Restaurar» (el deshacer no sobrevive a recargar). */
			aplicada?: AplicadaChat;
			/** Una propuesta que llegó por la API de MaKo (./propuestas.ts): al aceptarla o descartarla se cierra en la base. */
			propuestaApi?: { id: string; canal: string };
			/** Una burbuja de un pedido que no es del proyecto abierto (./pedidos.ts): a dónde lleva. Siempre de adentro de la app. */
			links?: Array<{ texto: string; href: string }>;
	  };
export type MensajeMako = Extract<Mensaje, { de: "mako" }>;
type SinId<M> = M extends unknown ? Omit<M, "id" | "c" | "t"> : never;
/** Un mensaje nuevo: el id y las horas los pone el store. */
export type MensajeNuevo = SinId<Mensaje>;

export type Hilo = { mensajes: Mensaje[]; corriendo: boolean };
const HILO_VACIO: Hilo = { mensajes: [], corriendo: false };

const hilos = new Map<string, Hilo>();
const oyentes = new Set<() => void>();

const nuevoId = (): string =>
	typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : `m${Date.now().toString(36)}${Math.random().toString(36).slice(2, 10)}`;

/** Le pone id y horas a un mensaje nuevo. */
export function conId(m: MensajeNuevo): Mensaje {
	const ahora = Date.now();
	return { ...m, id: nuevoId(), c: ahora, t: ahora } as Mensaje;
}

export function leerHilo(proyectoId: string): Hilo {
	return hilos.get(proyectoId) ?? HILO_VACIO;
}

/** Cambia el hilo de un proyecto (y lo deja para guardar si cambiaron los mensajes). */
export function cambiarHilo(proyectoId: string, f: (h: Hilo) => Hilo) {
	const antes = hilos.get(proyectoId) ?? HILO_VACIO;
	const despues = f(antes);
	hilos.set(proyectoId, despues);
	for (const o of oyentes) o();
	if (despues.mensajes !== antes.mensajes) programarGuardado(proyectoId);
}

/** Cambia un mensaje de MaKo (su estado, su aviso…), con la hora del cambio. */
export function cambiarMensaje(proyectoId: string, id: string, cambio: Partial<MensajeMako>) {
	const t = Date.now();
	cambiarHilo(proyectoId, (h) => ({ ...h, mensajes: h.mensajes.map((m) => (m.id === id && m.de === "mako" ? { ...m, ...cambio, t } : m)) }));
}

export function suscribir(f: () => void) {
	oyentes.add(f);
	return () => {
		oyentes.delete(f);
	};
}

// ─────────────────────────────────────────────────────────────────────────────
// Guardado ↔ memoria
// ─────────────────────────────────────────────────────────────────────────────

/** Lo que se manda a la base de un mensaje (sin las pistas ni el deshacer). */
export function aGuardado(m: Mensaje): MensajeGuardado {
	if (m.de === "yo") return m;
	const { propuesta, aplicada: _aplicada, ...resto } = m;
	return {
		...resto,
		...(propuesta
			? {
					propuesta: {
						escenaId: propuesta.escenaId,
						refsPorId: [...propuesta.refsPorId],
						elegidos: propuesta.elegidos,
						alcance: propuesta.alcance,
						operaciones: propuesta.operaciones,
					},
				}
			: {}),
	};
}

/** Un mensaje leído de la base, para la memoria. La propuesta es la de ESTE proyecto (el hilo es por proyecto). */
export function deGuardado(g: MensajeGuardado, proyectoId: string): Mensaje {
	if (g.de === "yo") return g;
	const { propuesta, ...resto } = g;
	return {
		...resto,
		...(propuesta
			? {
					propuesta: {
						proyectoId,
						escenaId: propuesta.escenaId,
						refsPorId: new Map(propuesta.refsPorId),
						elegidos: propuesta.elegidos,
						alcance: propuesta.alcance,
						operaciones: propuesta.operaciones,
					},
				}
			: {}),
	};
}

/**
 * Une lo de esta pestaña con lo del server: por id, gana el último cambio. Si gana el de la pestaña se queda ESE objeto
 * (con su deshacer y sus pistas, que no viajan); si no, el del server.
 */
export function unirConServidor(local: readonly Mensaje[], servidor: readonly MensajeGuardado[], proyectoId: string): Mensaje[] {
	const propios = new Map(local.map((m) => [m.id, m] as const));
	return unirHilos(local.map(aGuardado), servidor).map((g) => {
		const l = propios.get(g.id);
		return l && l.t >= g.t ? l : deGuardado(g, proyectoId);
	});
}

// ─────────────────────────────────────────────────────────────────────────────
// La sincronización con /api/video-editor/chat
// ─────────────────────────────────────────────────────────────────────────────

/** Un rato después del último cambio: un pedido y su respuesta van en un solo guardado si llegan juntos. */
const ESPERA_GUARDADO_MS = 700;
const RUTA = "/api/video-editor/chat";

type Sync = {
	estado: "sin-cargar" | "cargando" | "listo" | "sin-tabla";
	version: number | null;
	sucio: boolean;
	guardando: boolean;
	timer: ReturnType<typeof setTimeout> | null;
};
const syncs = new Map<string, Sync>();
const nombres = new Map<string, string>();

function syncDe(proyectoId: string): Sync {
	let s = syncs.get(proyectoId);
	if (!s) {
		s = { estado: "sin-cargar", version: null, sucio: false, guardando: false, timer: null };
		syncs.set(proyectoId, s);
	}
	return s;
}

type RespuestaHilo = { ok: true; hilo: { mensajes: unknown; version: number } | null } | { ok: false; sinTabla?: boolean; error?: string };

/** Lee el hilo guardado de un proyecto (una vez por pestaña) y lo une con lo que ya hay. `nombre`: el del proyecto. */
export async function cargarHilo(proyectoId: string, nombre?: string | null): Promise<void> {
	if (nombre) nombres.set(proyectoId, nombre);
	const s = syncDe(proyectoId);
	if (s.estado !== "sin-cargar") return;
	s.estado = "cargando";
	let r: RespuestaHilo | null = null;
	try {
		const res = await fetch(`${RUTA}?proyecto=${encodeURIComponent(proyectoId)}`, { cache: "no-store" });
		r = (await res.json().catch(() => null)) as RespuestaHilo | null;
	} catch {
		r = null;
	}
	if (!r || !r.ok) {
		// Sin la tabla, no se insiste. Un error de red vuelve a intentar la próxima vez que se abra el chat.
		s.estado = r && "sinTabla" in r && r.sinTabla ? "sin-tabla" : "sin-cargar";
		return;
	}
	s.estado = "listo";
	if (r.hilo) {
		s.version = r.hilo.version;
		const guardados = hiloAlAbrir(r.hilo.mensajes);
		cambiarHilo(proyectoId, (h) => ({ ...h, mensajes: unirConServidor(h.mensajes, guardados, proyectoId) }));
	}
	if (s.sucio || (leerHilo(proyectoId).mensajes.length && !r.hilo)) programarGuardado(proyectoId);
}

function programarGuardado(proyectoId: string) {
	const s = syncDe(proyectoId);
	s.sucio = true;
	if (s.estado !== "listo") return;
	if (s.timer) clearTimeout(s.timer);
	s.timer = setTimeout(() => {
		s.timer = null;
		void guardar(proyectoId);
	}, ESPERA_GUARDADO_MS);
}

type RespuestaGuardar =
	| { ok: true; version: number }
	| { ok: false; conflicto: true; hilo: { mensajes: unknown; version: number } }
	| { ok: false; sinTabla?: boolean; error?: string };

async function guardar(proyectoId: string): Promise<void> {
	const s = syncDe(proyectoId);
	if (s.estado !== "listo" || !s.sucio) return;
	if (s.guardando) return; // al terminar el que corre, vuelve a mirar `sucio`
	s.guardando = true;
	s.sucio = false;
	let error = false;
	try {
		const res = await fetch(RUTA, {
			method: "PUT",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({
				proyecto: proyectoId,
				nombre: nombres.get(proyectoId) ?? null,
				mensajes: hiloParaGuardar(leerHilo(proyectoId).mensajes.map(aGuardado)),
				version: s.version,
			}),
		});
		const r = (await res.json().catch(() => null)) as RespuestaGuardar | null;
		if (r?.ok) s.version = r.version;
		else if (r && "conflicto" in r && r.conflicto) {
			// Otra pestaña guardó en el medio: se une sobre su versión, y unir deja el hilo para guardar otra vez.
			s.version = r.hilo.version;
			const delServidor = hiloParaGuardar(r.hilo.mensajes);
			cambiarHilo(proyectoId, (h) => ({ ...h, mensajes: unirConServidor(h.mensajes, delServidor, proyectoId) }));
		} else if (r && "sinTabla" in r && r.sinTabla) s.estado = "sin-tabla";
		else error = true;
	} catch {
		error = true;
	} finally {
		s.guardando = false;
	}
	// Un error no se reintenta en bucle: queda para guardar con el próximo cambio.
	if (error) {
		s.sucio = true;
		return;
	}
	// Lo que cambió mientras se guardaba se guarda ahora.
	if (s.sucio && !s.timer) programarGuardado(proyectoId);
}
