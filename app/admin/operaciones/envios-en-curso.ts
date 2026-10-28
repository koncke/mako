// =============================================================================
// Lo que Martín mandó y todavía está saliendo: se ve en el acto, y sale por detrás (27/10/2026)
// =============================================================================
// Martín, desde el Ops Center: «Exactamente lo mismo pasa cuando adjunto capturas o envío un mensaje: tarda un montón en
// verse en el chat. Debe ser automático; si hay procesos por detrás, se tiene que enviar igual, no debe esperar absolutamente
// nada». Y de la nota de voz: «Los procesos siempre se tienen que ejecutar en segundo plano: el usuario debe poder navegar
// por el resto de la aplicación mientras hay procesos ejecutándose, como la transcripción».
//
// Antes, `mandar` (useCentro.ts) subía los adjuntos, firmaba, esperaba al servidor y RECIÉN AHÍ dibujaba el mensaje; la nota
// de voz, además, esperaba a transcribirse adentro de la caja, y si la caja se desmontaba (otro chat, otra tab) no salía.
// Ahora el mensaje se dibuja en el acto con su reloj (`EnvioLocal`), y lo que tarda corre ACÁ, fuera de React:
//   · cada chat tiene su COLA: lo que se mandó primero sale primero (una foto que sube no queda detrás de un texto que firmó
//     antes, ni al revés);
//   · lo que sale queda un rato como `listo` (el trabajo de verdad, con su id), hasta que la cola del servidor lo trae: así la
//     burbuja no desaparece entre que sale y el refresco;
//   · si falla, la burbuja queda con ✕, la frase de qué falló y «Reintentar» (la tarea guardada, con sus archivos).
// ⚠️ SIN 'use client' a propósito, como fotos-enviadas.ts: lo usa el motor (useCentro.ts) y el hilo (Hilo.tsx).
// ⚠️ Vive en la pestaña: recargarla corta lo que estaba saliendo (lo que no llegó a firmarse, se pierde; lo firmado, llegó).
// =============================================================================

import type { TrabajoP } from '@/lib/centro-chats';

export type FaseLocal = 'enviando' | 'transcribiendo' | 'fallo';
/** Un mensaje que todavía no salió: el trabajo como se va a ver, más en qué está. `clave`: el chat (su cola). */
export type EnvioLocal = TrabajoP & { local: { fase: FaseLocal; error?: string; clave: string } };
export type ResultadoEnvio = { ok: true; trabajo: TrabajoP } | { ok: false; error: string };
/** Lo que tarda. `fase` cambia lo que dice la burbuja mientras corre (de «transcribiendo» a «enviando»). */
export type TareaDeEnvio = (fase: (f: Exclude<FaseLocal, 'fallo'>) => void) => Promise<ResultadoEnvio>;

/** Cuánto queda a la vista lo que ya salió, mientras la cola del servidor no lo trae. */
export const LISTO_MS = 2 * 60_000;

type Entrada = { w: EnvioLocal | TrabajoP; tarea: TareaDeEnvio | null; listoAt: number | null };
const envios = new Map<string, Entrada>();
const colas = new Map<string, Promise<unknown>>();
const oyentes = new Set<() => void>();
let foto: ReadonlyArray<EnvioLocal | TrabajoP> = [];

function avisar() {
  const ahora = Date.now();
  for (const [id, e] of envios) if (e.listoAt != null && ahora - e.listoAt > LISTO_MS) envios.delete(id);
  foto = [...envios.values()].map((e) => e.w);
  for (const o of oyentes) o();
}

export function escucharEnvios(o: () => void): () => void {
  oyentes.add(o);
  return () => { oyentes.delete(o); };
}
/** Lo que está saliendo y lo que salió hace poco, como trabajos (la misma referencia mientras no cambie). */
export const enviosEnCurso = (): ReadonlyArray<EnvioLocal | TrabajoP> => foto;
export const sinEnvios = (): ReadonlyArray<EnvioLocal | TrabajoP> => [];

export const esEnvioLocal = (w: TrabajoP): w is EnvioLocal => !!(w as Partial<EnvioLocal>).local;
/** El id de un mensaje que todavía no tiene el suyo (el del servidor llega al firmar). */
export const idDeEnvioLocal = (): string => `local-${typeof crypto !== 'undefined' && 'randomUUID' in crypto ? crypto.randomUUID() : Math.random().toString(36).slice(2)}`;

function correr(id: string) {
  const e = envios.get(id);
  if (!e || !e.tarea || !esEnvioLocal(e.w)) return;
  const tarea = e.tarea;
  const clave = e.w.local.clave;
  const poner = (fase: FaseLocal, error?: string) => {
    const x = envios.get(id);
    if (!x || !esEnvioLocal(x.w)) return;
    x.w = { ...x.w, local: { ...x.w.local, fase, ...(error ? { error } : {}) } };
    avisar();
  };
  const antes = colas.get(clave) ?? Promise.resolve();
  const esta = antes.then(async () => {
    let r: ResultadoEnvio;
    try { r = await tarea((f) => poner(f)); } catch (err) { r = { ok: false, error: err instanceof Error && err.message ? err.message : 'No salió: vuelve a intentarlo' }; }
    if (!r.ok) { poner('fallo', r.error); return; }
    envios.set(id, { w: r.trabajo, tarea: null, listoAt: Date.now() });
    avisar();
  });
  colas.set(clave, esta.catch(() => null));
}

/** Dibuja `w` en el acto y corre `tarea` en la cola de su chat. */
export function ponerEnCamino(w: EnvioLocal, tarea: TareaDeEnvio) {
  envios.set(w.id, { w, tarea, listoAt: null });
  avisar();
  correr(w.id);
}

/** «Reintentar» de una burbuja que no salió: la misma tarea, otra vez al final de la cola de su chat. */
export function reintentarEnvio(id: string) {
  const e = envios.get(id);
  if (!e || !e.tarea || !esEnvioLocal(e.w) || e.w.local.fase !== 'fallo') return;
  e.w = { ...e.w, local: { fase: 'enviando', clave: e.w.local.clave } };
  avisar();
  correr(id);
}

/** «Descartar» de una burbuja que no salió. Lo que ya salió no se descarta (eso es otra cosa: cancelarlo). */
export function descartarEnvio(id: string) {
  const e = envios.get(id);
  if (!e || !esEnvioLocal(e.w) || e.w.local.fase !== 'fallo') return;
  envios.delete(id);
  avisar();
}

/** Los trabajos de la conversación con lo que está saliendo: lo del servidor manda (por id), y lo listo se va cuando llega. */
export function conLoQueSale<T extends TrabajoP>(delServidor: readonly T[], enCurso: ReadonlyArray<EnvioLocal | TrabajoP>): Array<T | EnvioLocal | TrabajoP> {
  const ids = new Set(delServidor.map((w) => w.id));
  return [...enCurso.filter((w) => !ids.has(w.id)), ...delServidor];
}
