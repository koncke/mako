'use client';

// =============================================================================
// La grabadora del navegador: UNA grabación a la vez, viva aunque se cierre la ficha (04/11/2026)
// =============================================================================
// Pedido de Martín: «quiero que implementes el botón de "grabar" en el detail de un lead y en un dashboard template que sea
// "Call Calling"». El botón vive en la ficha (pop-up y ruta), en la ficha del teléfono y en la plantilla Cold Calling; lo que
// graba vive ACÁ, en el módulo y no en el componente: cerrar la ficha, abrir otro lead o cambiar de tab no corta la llamada. El
// indicador «● Grabando · Cortar» de la esquina (GrabacionEnCurso, montado en el layout) es la salida desde cualquier pantalla.
//
// Lo que no se ve en la firma:
//   · PARTES de 3 minutos (lib/grabar-llamada-reglas.ts): el grabador se REINICIA, así cada parte es un archivo entero que se sube
//     apenas se cierra. El nuevo arranca antes de cortar el viejo: no se pierde ni un segundo entre partes.
//   · LA PESTAÑA SE PIDE PRIMERO: `getDisplayMedia` exige el gesto de la persona y el permiso del micrófono se lo come. Y el
//     `AudioContext` que mezcla las dos se crea en el MISMO toque (antes de cualquier `await`): creado después, Chrome lo deja en
//     pausa y la mezcla sale muda, sin un error.
//   · LA SUBIDA REINTENTA, y una parte que no subió NO se tira: queda en memoria y `cortar()` la vuelve a intentar. El servidor
//     analiza recién con todas las partes (`partes` en «terminar»).
//   · El `fetch` va a /api/…: el parche de app/_components/WsFetch.tsx le pega el `?ws=` (el cliente que se mira).
// =============================================================================

import { useSyncExternalStore } from 'react';
import {
  BITS_POR_SEGUNDO, MAX_SEGUNDOS, SEGUNDOS_POR_PARTE, elegirMime, queSeGraba, type Entorno, type FuenteAudio, type OrigenGrabacion,
  type ResultadoLlamada,
} from '@/lib/grabar-llamada-reglas';

const RUTA = '/api/crm/llamadas-grabadas';

export type FaseGrabadora = 'libre' | 'pidiendo' | 'grabando' | 'cerrando' | 'cerrada';

export type EstadoGrabadora = {
  fase: FaseGrabadora;
  leadId: number | null;
  leadNombre: string | null;
  origen: OrigenGrabacion;
  grabacionId: string | null;
  fuente: FuenteAudio;
  /** Cuándo empezó (ms): el reloj de la pantalla. */
  desde: number | null;
  /** Lo que duró, al cortar. */
  segundos: number;
  /** Partes que no se pudieron subir todavía (se reintentan al cortar). */
  pendientes: number;
  /** Lo que se le dice a la persona (una línea): la pestaña sin audio, una parte que no subió. */
  aviso: string | null;
  error: string | null;
  /** Cómo terminó, si ya lo dijo (al cortar). */
  resultado: ResultadoLlamada | null;
  /** Sube cuando hay algo nuevo que releer (una grabación que se cerró): la lista de la ficha vuelve a pedir. */
  version: number;
};

const INICIAL: EstadoGrabadora = {
  fase: 'libre', leadId: null, leadNombre: null, origen: 'ficha', grabacionId: null, fuente: 'microfono',
  desde: null, segundos: 0, pendientes: 0, aviso: null, error: null, resultado: null, version: 0,
};

let estado: EstadoGrabadora = INICIAL;
const oyentes = new Set<() => void>();
function poner(cambio: Partial<EstadoGrabadora>) {
  estado = { ...estado, ...cambio };
  for (const o of oyentes) o();
}
const suscribir = (o: () => void) => { oyentes.add(o); return () => { oyentes.delete(o); }; };

/** El estado de la grabadora en un componente (se redibuja con cada cambio). */
export function useGrabadora(): EstadoGrabadora {
  return useSyncExternalStore(suscribir, () => estado, () => INICIAL);
}

// ── Lo que vive mientras se graba ─────────────────────────────────────────────────────────────────────────────────────────

type Parte = { n: number; inicio: number; segundos: number; blob: Blob };
let flujos: MediaStream[] = [];
let ctx: AudioContext | null = null;
let grabable: MediaStream | null = null;
let mime = '';
let grabador: MediaRecorder | null = null;
let n = 0;
let inicioParte = 0;
let rotar: ReturnType<typeof setTimeout> | null = null;
let tope: ReturnType<typeof setTimeout> | null = null;
let cola: Promise<void> = Promise.resolve();
const sinSubir: Parte[] = [];

/** Qué se puede grabar en ESTE navegador (lib/grabar-llamada-reglas.ts → `queSeGraba`). */
export function entornoActual(): Entorno {
  if (typeof window === 'undefined') return { graba: false, telefono: false, pestana: false };
  const md = navigator.mediaDevices;
  const graba = typeof window.MediaRecorder === 'function' && typeof md?.getUserMedia === 'function';
  const telefono = window.matchMedia?.('(pointer: coarse)').matches && Math.min(window.innerWidth, window.innerHeight) < 900;
  // El audio de una pestaña lo dan Chrome y Edge de computadora (`userAgentData` es de Chromium); Safari y Firefox no.
  const pestana = !telefono && typeof md?.getDisplayMedia === 'function' && 'userAgentData' in navigator;
  return { graba, telefono: !!telefono, pestana };
}
export const queSeGrabaAca = () => queSeGraba(entornoActual());

async function pedir<T>(cuerpo: Record<string, unknown>): Promise<T & { ok: boolean; error?: string }> {
  const r = await fetch(RUTA, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(cuerpo), signal: AbortSignal.timeout(30_000) });
  const t = await r.text();
  try { return JSON.parse(t) as T & { ok: boolean; error?: string }; } catch { return { ok: false, error: r.ok ? 'Respuesta inválida.' : `Error ${r.status}` } as T & { ok: boolean; error?: string }; }
}

/** Sube una parte, con tres intentos. true = quedó guardada. */
async function subir(p: Parte): Promise<boolean> {
  const id = estado.grabacionId;
  if (!id) return false;
  for (const espera of [0, 1500, 5000]) {
    if (espera) await new Promise((r) => setTimeout(r, espera));
    try {
      const f = new FormData();
      f.set('accion', 'parte'); f.set('id', id); f.set('n', String(p.n));
      f.set('inicio', String(Math.round(p.inicio))); f.set('segundos', String(Math.round(p.segundos)));
      f.set('audio', p.blob, `parte-${p.n}`);
      const r = await fetch(RUTA, { method: 'POST', body: f, signal: AbortSignal.timeout(90_000) });
      if (r.ok) return true;
      // Lo que el server rechaza por el archivo no mejora reintentando.
      if (r.status === 400 || r.status === 413 || r.status === 404) return false;
    } catch { /* la red: se reintenta */ }
  }
  return false;
}

function encolar(p: Parte) {
  cola = cola.then(async () => {
    const ok = await subir(p);
    if (!ok) { sinSubir.push(p); poner({ pendientes: sinSubir.length, aviso: 'Una parte no se subió todavía. Se reintenta al cortar.' }); }
  });
}

function nuevoGrabador(): MediaRecorder {
  const rec = new MediaRecorder(grabable!, { mimeType: mime, audioBitsPerSecond: BITS_POR_SEGUNDO });
  const trozos: Blob[] = [];
  const parte = { n: n++, inicio: (Date.now() - (estado.desde ?? Date.now())) / 1000 };
  inicioParte = Date.now();
  const empezo = inicioParte;
  rec.ondataavailable = (e) => { if (e.data && e.data.size) trozos.push(e.data); };
  rec.onstop = () => {
    const blob = new Blob(trozos, { type: rec.mimeType || mime });
    if (blob.size) encolar({ ...parte, segundos: (Date.now() - empezo) / 1000, blob });
    else n = Math.min(n, parte.n + 1); // una parte vacía (cortó en el mismo instante) no cuenta
  };
  rec.start();
  return rec;
}

function programarRotacion() {
  rotar = setTimeout(() => {
    if (estado.fase !== 'grabando' || !grabador) return;
    const viejo = grabador;
    grabador = nuevoGrabador();
    try { viejo.stop(); } catch { /* ya estaba parado */ }
    programarRotacion();
  }, SEGUNDOS_POR_PARTE * 1000);
}

function soltarTodo() {
  if (rotar) clearTimeout(rotar);
  if (tope) clearTimeout(tope);
  rotar = null; tope = null;
  for (const s of flujos) for (const t of s.getTracks()) { try { t.stop(); } catch { /* */ } }
  flujos = [];
  grabable = null;
  if (ctx) { ctx.close().catch(() => {}); ctx = null; }
  window.removeEventListener('beforeunload', avisarAlSalir);
}

function avisarAlSalir(e: BeforeUnloadEvent) {
  if (estado.fase === 'grabando' || estado.fase === 'cerrando') { e.preventDefault(); e.returnValue = ''; }
}

const textoDeError = (e: unknown): string => {
  const nombre = e instanceof DOMException ? e.name : '';
  if (nombre === 'NotAllowedError' || nombre === 'SecurityError') return 'El navegador no dio permiso para el micrófono. Permítelo y vuelve a intentar.';
  if (nombre === 'NotFoundError') return 'No encuentro un micrófono en este aparato.';
  if (nombre === 'NotReadableError') return 'Otra app está usando el micrófono (una llamada en curso en este aparato lo bloquea).';
  return e instanceof Error && e.message ? e.message : 'No pude empezar a grabar.';
};

/**
 * Empieza a grabar a este lead. Se llama DESDE el toque (ver la cabecera: la pestaña y el AudioContext necesitan el gesto).
 * `conPestana`: pedir también el audio de la pestaña de la llamada (Chrome y Edge de computadora).
 */
export async function empezar(o: { leadId: number; leadNombre: string; origen: OrigenGrabacion; conPestana: boolean }): Promise<void> {
  if (estado.fase === 'pidiendo' || estado.fase === 'grabando' || estado.fase === 'cerrando') return;
  const ent = entornoActual();
  if (!ent.graba) { poner({ ...INICIAL, version: estado.version, error: queSeGraba(ent).linea }); return; }
  const conPestana = o.conPestana && ent.pestana;
  // ⚠️ En el MISMO toque, antes de cualquier await (ver la cabecera).
  const mezcla = conPestana ? new AudioContext() : null;
  const elegido = elegirMime((m) => MediaRecorder.isTypeSupported(m));
  if (!elegido) { mezcla?.close().catch(() => {}); poner({ ...INICIAL, version: estado.version, error: 'Este navegador no graba audio.' }); return; }
  mime = elegido;
  poner({ ...INICIAL, version: estado.version, fase: 'pidiendo', leadId: o.leadId, leadNombre: o.leadNombre, origen: o.origen });
  let aviso: string | null = null;
  try {
    let pestana: MediaStream | null = null;
    if (conPestana) {
      try {
        // Chrome pide video para dejar elegir la pestaña; el video se apaga en el acto.
        pestana = await navigator.mediaDevices.getDisplayMedia({ video: true, audio: true });
        for (const t of pestana.getVideoTracks()) t.stop();
        if (!pestana.getAudioTracks().length) { aviso = 'La pestaña no compartió su audio: se graba sólo tu micrófono.'; pestana = null; }
      } catch { aviso = 'No se compartió la pestaña: se graba sólo tu micrófono.'; pestana = null; }
    }
    const mic = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true } });
    flujos = [mic, ...(pestana ? [pestana] : [])];
    if (pestana && mezcla) {
      const destino = mezcla.createMediaStreamDestination();
      mezcla.createMediaStreamSource(mic).connect(destino);
      mezcla.createMediaStreamSource(pestana).connect(destino);
      if (mezcla.state === 'suspended') await mezcla.resume().catch(() => {});
      ctx = mezcla;
      grabable = destino.stream;
    } else {
      mezcla?.close().catch(() => {});
      grabable = mic;
    }
    const fuente: FuenteAudio = pestana ? 'microfono_y_pestana' : 'microfono';
    const r = await pedir<{ id?: string }>({ accion: 'empezar', leadId: o.leadId, origen: o.origen, fuente, mime });
    if (!r.ok || !r.id) throw new Error(r.error || 'No pude empezar la grabación.');
    n = 0;
    sinSubir.length = 0;
    cola = Promise.resolve();
    poner({ fase: 'grabando', grabacionId: r.id, fuente, desde: Date.now(), aviso, error: null });
    grabador = nuevoGrabador();
    programarRotacion();
    tope = setTimeout(() => { void cortar(); }, MAX_SEGUNDOS * 1000);
    window.addEventListener('beforeunload', avisarAlSalir);
    // Si la persona deja de compartir la pestaña desde el navegador, sigue el micrófono (la mezcla ya no recibe ese lado).
    for (const t of pestana?.getAudioTracks() ?? []) t.addEventListener('ended', () => poner({ aviso: 'Dejaste de compartir la pestaña: sigue sólo tu micrófono.' }));
  } catch (e) {
    soltarTodo();
    poner({ ...INICIAL, version: estado.version, leadId: o.leadId, leadNombre: o.leadNombre, error: textoDeError(e) });
  }
}

/** Corta la grabación: cierra la última parte, sube lo que falta y le dice al server cuántas partes son. */
export async function cortar(): Promise<void> {
  if (estado.fase !== 'grabando') return;
  const segundos = estado.desde ? (Date.now() - estado.desde) / 1000 : 0;
  poner({ fase: 'cerrando', segundos });
  const ultimo = grabador;
  grabador = null;
  await new Promise<void>((listo) => {
    if (!ultimo || ultimo.state === 'inactive') { listo(); return; }
    ultimo.addEventListener('stop', () => setTimeout(listo, 0), { once: true });
    try { ultimo.stop(); } catch { listo(); }
  });
  soltarTodo();
  await cola;
  // Lo que no subió durante la llamada, una vez más.
  for (const p of [...sinSubir]) {
    if (await subir(p)) sinSubir.splice(sinSubir.indexOf(p), 1);
  }
  const id = estado.grabacionId;
  if (sinSubir.length) {
    poner({ fase: 'cerrada', pendientes: sinSubir.length, error: 'No pude subir parte del audio. Vuelve a intentarlo sin cerrar esta pestaña.' });
    return;
  }
  const r = id ? await pedir({ accion: 'terminar', id, partes: n, duracion: Math.round(segundos), resultado: estado.resultado }).catch(() => ({ ok: false, error: 'Sin conexión.' })) : { ok: false, error: 'No hay grabación.' };
  poner({ fase: 'cerrada', pendientes: 0, error: r.ok ? null : (r.error ?? 'No pude cerrar la grabación.'), version: estado.version + 1 });
}

/** Vuelve a intentar lo que no subió (después de un corte sin conexión). */
export async function reintentarSubida(): Promise<void> {
  if (estado.fase !== 'cerrada' || !sinSubir.length) return;
  poner({ fase: 'cerrando', error: null });
  for (const p of [...sinSubir]) {
    if (await subir(p)) sinSubir.splice(sinSubir.indexOf(p), 1);
  }
  if (sinSubir.length) { poner({ fase: 'cerrada', pendientes: sinSubir.length, error: 'Todavía no pude subir parte del audio.' }); return; }
  const id = estado.grabacionId;
  const r = id ? await pedir({ accion: 'terminar', id, partes: n, duracion: Math.round(estado.segundos), resultado: estado.resultado }).catch(() => ({ ok: false, error: 'Sin conexión.' })) : { ok: false };
  poner({ fase: 'cerrada', pendientes: 0, error: r.ok ? null : 'No pude cerrar la grabación.', version: estado.version + 1 });
}

/** Cómo terminó (un toque, después de cortar). Se guarda en la grabación. */
export async function decirResultado(resultado: ResultadoLlamada): Promise<boolean> {
  poner({ resultado });
  const id = estado.grabacionId;
  if (!id || estado.fase === 'grabando' || estado.fase === 'cerrando') return true; // viaja con «terminar»
  const r = await pedir({ accion: 'resultado', id, resultado }).catch(() => ({ ok: false }));
  if (r.ok) poner({ version: estado.version + 1 });
  return r.ok;
}

/** Cierra el indicador de una grabación terminada. Una que no subió no se cierra: se perdería el audio. */
export function soltarGrabacion(): void {
  if (estado.fase === 'cerrada' && !sinSubir.length) poner({ ...INICIAL, version: estado.version });
  else if (estado.fase === 'libre') poner({ error: null, aviso: null });
}

/** Lo que la ficha muestra de la grabación EN CURSO de otro lead (una a la vez). */
export const grabaAOtro = (e: EstadoGrabadora, leadId: number): boolean =>
  (e.fase === 'pidiendo' || e.fase === 'grabando' || e.fase === 'cerrando') && e.leadId != null && e.leadId !== leadId;
