'use client';

// =============================================================================
// mako/chat/hilo — el hilo del chat «MaKo IA»: un store de módulo, por diseño, guardado en la base
// =============================================================================
// Copia de app/video-editor/_opencut/chat/hilo.ts. Un store y no un estado del componente: el panel se cierra y se
// desmonta, y la respuesta de un pedido largo tiene que caer en el chat aunque el panel no esté abierto.
//
// Se guarda uno por persona y por diseño en `image_editor_chats` (mig 0303), por /api/image-editor/chat; el formato y
// el saneo son de lib/image-editor/chat/hilo.ts. Cómo se sincroniza:
//   · se LEE la primera vez que se abre el chat de un diseño (`cargarHilo`) y se UNE con lo que la pestaña ya tenga;
//   · se GUARDA un rato después de cada cambio (un pedido, una respuesta, un «Aceptar»), con la versión leída;
//   · ante un 409 (otra pestaña guardó en el medio) se une por id —gana el último cambio— y se vuelve a guardar;
//   · SIN la tabla (la migración no se aplicó) se deja de intentar: el hilo sigue en la pestaña.
// Lo que no sobrevive a recargar (el deshacer de una aplicada) se queda en memoria y no se guarda: una
// aplicada que vuelve de la base ya no tiene «Restaurar» (la vuelta es Ctrl+Z, mientras dure la pestaña).
// =============================================================================

import { hiloAlAbrir, hiloParaGuardar, unirHilos, type EstadoPropuesta, type MensajeGuardado, type PropuestaGuardada } from '@/lib/image-editor/chat/hilo';
import type { CambioImagen } from '@/lib/image-editor/chat/aplicar';

export type { EstadoPropuesta };

/** Lo que hace falta para «Restaurar»: la versión del documento justo después de aplicar (el deshacer es el del editor). */
export type Aplicada = { version: number };

/** Una propuesta en memoria: la guardada y, mientras dure la pestaña, la versión del documento con que se pidió. */
export type Propuesta = PropuestaGuardada & { docVersion?: number };

/** `c`: cuándo se creó; `t`: su último cambio (ms). */
export type Mensaje =
  | { id: string; c: number; t: number; de: 'yo'; texto: string; alcance: string | null }
  | {
      id: string; c: number; t: number; de: 'mako'; texto: string; error?: boolean;
      propuesta?: Propuesta; cambios?: CambioImagen[]; descartes?: string[]; estado?: EstadoPropuesta; aviso?: string;
      /** Sólo en memoria: lo que hace falta para «Restaurar». */
      aplicada?: Aplicada;
      propuestaApi?: { id: string; canal: string };
      links?: Array<{ texto: string; href: string }>;
    };
export type MensajeMako = Extract<Mensaje, { de: 'mako' }>;
type SinId<M> = M extends unknown ? Omit<M, 'id' | 'c' | 't'> : never;
export type MensajeNuevo = SinId<Mensaje>;

export type Hilo = { mensajes: Mensaje[]; corriendo: boolean };
const HILO_VACIO: Hilo = { mensajes: [], corriendo: false };

const hilos = new Map<string, Hilo>();
const oyentes = new Set<() => void>();

const nuevoId = (): string =>
  typeof crypto !== 'undefined' && 'randomUUID' in crypto ? crypto.randomUUID() : `m${Date.now().toString(36)}${Math.random().toString(36).slice(2, 10)}`;

export function conId(m: MensajeNuevo): Mensaje {
  const ahora = Date.now();
  return { ...m, id: nuevoId(), c: ahora, t: ahora } as Mensaje;
}

export function leerHilo(disenoId: string): Hilo {
  return hilos.get(disenoId) ?? HILO_VACIO;
}

export function cambiarHilo(disenoId: string, f: (h: Hilo) => Hilo) {
  const antes = hilos.get(disenoId) ?? HILO_VACIO;
  const despues = f(antes);
  hilos.set(disenoId, despues);
  for (const o of oyentes) o();
  if (despues.mensajes !== antes.mensajes) programarGuardado(disenoId);
}

export function cambiarMensaje(disenoId: string, id: string, cambio: Partial<MensajeMako>) {
  const t = Date.now();
  cambiarHilo(disenoId, (h) => ({ ...h, mensajes: h.mensajes.map((m) => (m.id === id && m.de === 'mako' ? { ...m, ...cambio, t } : m)) }));
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

/** Lo que se manda a la base de un mensaje (sin el deshacer ni la versión de la pestaña). */
export function aGuardado(m: Mensaje): MensajeGuardado {
  if (m.de === 'yo') return m;
  const { propuesta, aplicada: _aplicada, ...resto } = m;
  if (!propuesta) return resto;
  const { docVersion: _v, ...guardada } = propuesta;
  return { ...resto, propuesta: guardada };
}

/** Une lo de esta pestaña con lo del server: por id, gana el último cambio (y el de la pestaña conserva su deshacer). */
export function unirConServidor(local: readonly Mensaje[], servidor: readonly MensajeGuardado[]): Mensaje[] {
  const propios = new Map(local.map((m) => [m.id, m] as const));
  return unirHilos(local.map(aGuardado), servidor).map((g) => {
    const l = propios.get(g.id);
    return l && l.t >= g.t ? l : g;
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// La sincronización con /api/image-editor/chat
// ─────────────────────────────────────────────────────────────────────────────

const ESPERA_GUARDADO_MS = 700;
const RUTA = '/api/image-editor/chat';

type Sync = { estado: 'sin-cargar' | 'cargando' | 'listo' | 'sin-tabla'; version: number | null; sucio: boolean; guardando: boolean; timer: ReturnType<typeof setTimeout> | null };
const syncs = new Map<string, Sync>();
const nombres = new Map<string, string>();

function syncDe(disenoId: string): Sync {
  let s = syncs.get(disenoId);
  if (!s) {
    s = { estado: 'sin-cargar', version: null, sucio: false, guardando: false, timer: null };
    syncs.set(disenoId, s);
  }
  return s;
}

type RespuestaHilo = { ok: true; hilo: { mensajes: unknown; version: number } | null } | { ok: false; sinTabla?: boolean; error?: string };

/** Lee el hilo guardado de un diseño (una vez por pestaña) y lo une con lo que ya hay. `nombre`: el título del diseño. */
export async function cargarHilo(disenoId: string, nombre?: string | null): Promise<void> {
  if (nombre) nombres.set(disenoId, nombre);
  const s = syncDe(disenoId);
  if (s.estado !== 'sin-cargar') return;
  s.estado = 'cargando';
  let r: RespuestaHilo | null = null;
  try {
    const res = await fetch(`${RUTA}?diseno=${encodeURIComponent(disenoId)}`, { cache: 'no-store' });
    r = (await res.json().catch(() => null)) as RespuestaHilo | null;
  } catch {
    r = null;
  }
  if (!r || !r.ok) {
    // Sin la tabla, no se insiste. Un error de red vuelve a intentar la próxima vez que se abra el chat.
    s.estado = r && 'sinTabla' in r && r.sinTabla ? 'sin-tabla' : 'sin-cargar';
    return;
  }
  s.estado = 'listo';
  if (r.hilo) {
    s.version = r.hilo.version;
    const guardados = hiloAlAbrir(r.hilo.mensajes);
    cambiarHilo(disenoId, (h) => ({ ...h, mensajes: unirConServidor(h.mensajes, guardados) }));
  }
  if (s.sucio || (leerHilo(disenoId).mensajes.length && !r.hilo)) programarGuardado(disenoId);
}

function programarGuardado(disenoId: string) {
  const s = syncDe(disenoId);
  s.sucio = true;
  if (s.estado !== 'listo') return;
  if (s.timer) clearTimeout(s.timer);
  s.timer = setTimeout(() => {
    s.timer = null;
    void guardar(disenoId);
  }, ESPERA_GUARDADO_MS);
}

type RespuestaGuardar =
  | { ok: true; version: number }
  | { ok: false; conflicto: true; hilo: { mensajes: unknown; version: number } }
  | { ok: false; sinTabla?: boolean; error?: string };

async function guardar(disenoId: string): Promise<void> {
  const s = syncDe(disenoId);
  if (s.estado !== 'listo' || !s.sucio) return;
  if (s.guardando) return; // al terminar el que corre, vuelve a mirar `sucio`
  s.guardando = true;
  s.sucio = false;
  let error = false;
  try {
    const res = await fetch(RUTA, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        diseno: disenoId,
        nombre: nombres.get(disenoId) ?? null,
        mensajes: hiloParaGuardar(leerHilo(disenoId).mensajes.map(aGuardado)),
        version: s.version,
      }),
    });
    const r = (await res.json().catch(() => null)) as RespuestaGuardar | null;
    if (r?.ok) s.version = r.version;
    else if (r && 'conflicto' in r && r.conflicto) {
      s.version = r.hilo.version;
      const delServidor = hiloParaGuardar(r.hilo.mensajes);
      cambiarHilo(disenoId, (h) => ({ ...h, mensajes: unirConServidor(h.mensajes, delServidor) }));
    } else if (r && 'sinTabla' in r && r.sinTabla) s.estado = 'sin-tabla';
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
  if (s.sucio && !s.timer) programarGuardado(disenoId);
}
