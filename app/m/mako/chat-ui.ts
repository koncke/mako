// =============================================================================
// /m/mako — las decisiones de la PANTALLA del chat, puras (sin React, sin server)
// =============================================================================
// Lo que el chat del teléfono necesita decidir y que se prueba sin navegador
// (tests/m-mako-chat.test.ts):
//   · cómo se lee una respuesta de /api/m/mako (el 413 de Vercel es TEXTO PLANO);
//   · qué se puede reintentar y qué no (un turno que pudo haber corrido NO se repite:
//     costaría otra vez y podría dejar dos acciones pendientes iguales);
//   · cómo se arma el hilo con lo que el turno devolvió (`aviso` y `paraLaPersona` se
//     MUESTRAN y no se guardan: no vuelven al recargar, a propósito);
//   · qué dice la fila y el sheet de una propuesta después de confirmar o cancelar;
//   · el gesto del micrófono (deslizar a la izquierda cancela, hacia arriba bloquea);
//   · el tamaño al que se achica una foto antes de subirla;
//   · qué es un archivo elegido, qué sale al tocar Enviar en la vista previa, qué dice la
//     vista mientras no se puede enviar y cuánto tapa el teclado de iOS
//     (tests/m-mako-vista-previa.test.ts).
//
// Lo importan componentes 'use client': SÓLO TIPOS de lib/mako-turno-app-reglas.ts (ese
// módulo arrastra el registro de la API de MaKo, ~400 descripciones) y VALORES sólo de
// lib/mako-adjuntos.ts, que está escrito para el navegador.
// =============================================================================

import type {
  MensajeChat, PropuestaPantalla, RespuestaTurno, ResultadoTarjeta, TarjetaPendiente,
} from '@/lib/mako-turno-app-reglas';
import { ERROR_ADJUNTO, TOPE_ADJUNTOS, TOPE_TOTAL_BYTES } from '@/lib/mako-adjuntos';
import { GRAMATICA } from '@/lib/mako-gramatica';

// ── El hilo ──────────────────────────────────────────────────────────────────

export type EstadoPropuesta = 'pendiente' | 'aplicando' | 'hecho' | 'cancelada' | 'vencida' | 'resuelta' | 'fallo';

export type ItemHilo =
  | {
      k: 'msg';
      id: string;
      role: 'user' | 'assistant';
      texto: string;
      at: string | null;
      /** una nota de voz de ESTA sesión de la pantalla: se escucha y debajo va lo que se entendió */
      voz?: { url: string; secs: number } | null;
      /** los nombres de lo que se adjuntó (no se guardan: al recargar no vuelven) */
      adjuntos?: string[];
      /** enviando · error (no llegó: se puede reintentar) · incierto (no sé si llegó) */
      estado?: 'enviando' | 'error' | 'incierto';
      error?: string;
    }
  | { k: 'propuesta'; id: string; t: TarjetaPendiente; estado: EstadoPropuesta; nota?: string }
  | { k: 'pantalla'; id: string; p: PropuestaPantalla }
  /** `mako` = lo escribió el código para la persona (la agenda); `plataforma` = no pude */
  | { k: 'aviso'; id: string; texto: string; tono: 'mako' | 'plataforma' };

let secuencia = 0;
/** Un id local para la `key` de React (los mensajes guardados no traen id). */
export const idLocal = (pre: string): string => `${pre}-${Date.now().toString(36)}-${(++secuencia).toString(36)}`;

const aMensaje = (m: MensajeChat, i: number): ItemHilo => ({
  k: 'msg', id: `m${i}-${m.created_at ?? ''}`, role: m.role, texto: m.content, at: m.created_at ?? null,
});

const aPropuesta = (t: TarjetaPendiente): ItemHilo => ({ k: 'propuesta', id: `p${t.pendienteId}`, t, estado: 'pendiente' });

/** El hilo de una sesión recién abierta: los mensajes guardados y, al final, lo que espera. */
export function itemsDeSesion(mensajes: readonly MensajeChat[], propuestas: readonly TarjetaPendiente[]): ItemHilo[] {
  return [...mensajes.map(aMensaje), ...propuestas.map(aPropuesta)];
}

/**
 * Lo que se SUMA al hilo con la respuesta de un turno. El mensaje de la persona ya está
 * dibujado (optimista), así que de `mensajes` se toma sólo lo de MaKo. El cartel de la
 * plataforma y lo que armó el código van como avisos: se ven, no son un turno de MaKo.
 */
export function itemsDeRespuesta(r: RespuestaTurno, yaVistas: ReadonlySet<number> = new Set()): ItemHilo[] {
  const out: ItemHilo[] = [];
  r.mensajes.forEach((m) => {
    if (m.role === 'assistant' && m.content.trim()) out.push({ ...aMensaje(m, 0), id: idLocal('a') });
  });
  for (const t of r.paraLaPersona) if (t.trim()) out.push({ k: 'aviso', id: idLocal('v'), texto: t, tono: 'mako' });
  if (r.aviso) out.push({ k: 'aviso', id: idLocal('v'), texto: r.aviso, tono: 'plataforma' });
  for (const t of r.propuestas) if (!yaVistas.has(t.pendienteId)) out.push(aPropuesta(t));
  for (const p of r.pantallas) out.push({ k: 'pantalla', id: idLocal('s'), p });
  return out;
}

// ── La respuesta HTTP ────────────────────────────────────────────────────────

export type Leido<T> =
  | { ok: true; datos: T }
  /** `reintentable`: el server lo rechazó ANTES de correr el turno (no se guardó nada) */
  | { ok: false; error: string; reintentable: boolean };

export const ERROR_INCIERTO = 'No sé si llegó. Recarga el chat antes de reintentar.';

/**
 * Lee lo que contestó /api/m/mako. El cuerpo se pasa como TEXTO: el 413 de Vercel (más de
 * ~4,5 MB) llega en texto plano, y un `res.json()` directo tiraría con un error que no dice
 * qué pasó.
 *
 * ⚠️ Sólo un 4xx con su `{ ok:false, error }` es reintentable: el route lo devuelve antes de
 * guardar nada. Un 5xx, un cuerpo que no es JSON, la red caída (status 0) o el corte por
 * tiempo pueden haber corrido el turno entero —con sus acciones pendientes—, así que no se
 * reintenta a ciegas: se recarga el chat y se mira.
 */
export function leerRespuesta<T>(status: number, texto: string): Leido<T> {
  if (status === 413) return { ok: false, error: ERROR_ADJUNTO.pesado, reintentable: true };
  let j: unknown = null;
  try { j = JSON.parse(texto); } catch { /* no es JSON */ }
  const obj = j && typeof j === 'object' ? (j as Record<string, unknown>) : null;
  if (status >= 200 && status < 300 && obj) return { ok: true, datos: obj as T };
  if (status >= 400 && status < 500 && obj && typeof obj.error === 'string') {
    return { ok: false, error: obj.error, reintentable: status !== 408 && status !== 429 };
  }
  return { ok: false, error: ERROR_INCIERTO, reintentable: false };
}

// ── Lo que se adjunta ────────────────────────────────────────────────────────

/** Una foto se achica a este lado mayor antes de subir: unos 300-600 KB en JPEG. */
export const LADO_MAX = 1600;

/** El tamaño al que se dibuja una imagen de w×h: nunca se agranda, se conserva la forma. */
export function medidasAchicadas(w: number, h: number, max = LADO_MAX): { w: number; h: number } {
  if (!(w > 0) || !(h > 0)) return { w: 0, h: 0 };
  const k = Math.min(1, max / Math.max(w, h));
  return { w: Math.max(1, Math.round(w * k)), h: Math.max(1, Math.round(h * k)) };
}

/** ¿Entran estos archivos? Los mismos topes que el route (4 archivos, 4 MB en total). */
export function problemaDeSeleccion(bytes: readonly number[]): string | null {
  if (bytes.length > TOPE_ADJUNTOS) return ERROR_ADJUNTO.muchos;
  if (bytes.reduce((n, b) => n + b, 0) > TOPE_TOTAL_BYTES) return ERROR_ADJUNTO.pesado;
  return null;
}

/** Un archivo que viaja con el turno (lo arma `envioDe`; ChatMako lo sube por multipart). */
export type AdjuntoM = { id: string; file: File; nombre: string; tipo: 'image' | 'document' };

/**
 * Qué es un archivo elegido: por su tipo o, si el navegador no lo dio, por su extensión. null = no
 * se manda (solo fotos o PDF). El route lo vuelve a mirar por sus BYTES (lib/mako-adjuntos.ts): esto
 * es para decirlo antes de subir, no para confiar en lo que dijo el navegador.
 * ⚠️ NO es el `accept` de la lista (`aceptaSegun`): un PDF sin tipo, como lo entregan algunos
 * selectores de Android, quedaría afuera por una regla que el route no tiene.
 */
export function tipoDeElegido(f: { name: string; type: string }): 'image' | 'document' | null {
  if (f.type.startsWith('image/') || /\.(jpe?g|png|webp|gif|heic|heif)$/i.test(f.name)) return 'image';
  if (f.type === 'application/pdf' || /\.pdf$/i.test(f.name)) return 'document';
  return null;
}

/**
 * Lo que sale al tocar Enviar (en el composer o en la vista previa): el texto recortado y TODOS
 * los archivos juntados, en el orden de la tira. Sin archivos, sólo el texto.
 */
export function envioDe(texto: string, items: readonly { id: string; file: File }[]): { texto: string; adjuntos: AdjuntoM[] } {
  return {
    texto: texto.trim(),
    adjuntos: items.map((it) => ({
      id: it.id, file: it.file, nombre: it.file.name, tipo: tipoDeElegido(it.file) === 'image' ? 'image' : 'document',
    })),
  };
}

/**
 * Lo que dice la vista previa mientras algo no la deja enviar (va con su giro). null = nada: se
 * puede enviar. Un Enviar apagado sin motivo a la vista se lee como un botón roto.
 */
export function avisoDeVista(s: { preparando: boolean; transcribiendo: boolean; ocupado: boolean }): string | null {
  if (s.preparando) return 'Preparando el archivo…';
  if (s.transcribiendo) return 'Transcribiendo…';
  if (s.ocupado) return `${GRAMATICA.analizando.rotulo} · tu mensaje anterior`;
  return null;
}

/**
 * Cuánto tapa el teclado, en px. En iOS el layout NO se achica con el teclado (hay que correr lo
 * de abajo esto); en Android el viewport ya se achica solo (`interactive-widget=resizes-content`,
 * app/m/layout.tsx) y da 0.
 */
export function altoTeclado(innerHeight: number, vv: { height: number; offsetTop: number } | null | undefined): number {
  if (!vv) return 0;
  return Math.max(0, Math.round(innerHeight - vv.height - vv.offsetTop));
}

// ── El micrófono ─────────────────────────────────────────────────────────────

/** Mantener más de esto = nota de voz; menos = un toque (dictado al campo). */
export const ESPERA_MANTENER_MS = 250;
/** Deslizar a la izquierda más de esto cancela la nota. */
export const UMBRAL_CANCELAR_PX = 80;
/** Deslizar hacia arriba más de esto la bloquea (sigue grabando sin el dedo). */
export const UMBRAL_BLOQUEAR_PX = 70;
/** Una nota de voz dura como mucho esto; los últimos 15 s se cuentan para atrás. */
export const TOPE_NOTA_S = 120;

/** Qué hace el dedo que mantiene el micrófono. Cancelar gana: es lo que no deja rastro. */
export function gestoDelMic(dx: number, dy: number): 'cancelar' | 'bloquear' | null {
  if (dx <= -UMBRAL_CANCELAR_PX) return 'cancelar';
  if (dy <= -UMBRAL_BLOQUEAR_PX && Math.abs(dx) < UMBRAL_CANCELAR_PX) return 'bloquear';
  return null;
}

/** Los segundos que le quedan a la nota, sólo en los últimos 15. */
export function restanteNota(secs: number): number | null {
  const r = TOPE_NOTA_S - secs;
  return r <= 15 ? Math.max(0, r) : null;
}

export const duracion = (secs: number): string => {
  const s = Math.max(0, Math.floor(secs));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
};

/** ¿Este error es «el micrófono está bloqueado»? (y no otra falla, que se dice tal cual) */
export function esMicBloqueado(error: string | null | undefined): boolean {
  const e = (error ?? '').toLowerCase();
  return /micr[oó]fono/.test(e) && /(permis|no me dej[oó]|bloque)/.test(e);
}

/** Cómo se habilita, en una frase. iOS no tiene candado en la barra: se hace en Ajustes. */
export const comoHabilitarMic = (ios: boolean): string => ios
  ? 'Actívalo en Ajustes › Safari › Micrófono.'
  : 'Actívalo en el candado junto a la dirección.';

// ── Lo que dice MaKo mientras trabaja ────────────────────────────────────────

/** La fuente que acompaña al rótulo «Revisando» (GRAMATICA.analizando exige nombrarla). */
export function fuenteDelTurno(adjuntos: readonly { tipo: 'image' | 'document' }[]): string {
  if (adjuntos.some((a) => a.tipo === 'document')) return 'el PDF';
  if (adjuntos.length > 1) return 'las fotos';
  if (adjuntos.length === 1) return 'la foto';
  return 'tus datos';
}

/** A partir de acá el rótulo dice cuánto puede tardar (los turnos medidos: 23-108 s). */
export const AVISO_LENTO_S = 12;

// ── Después de confirmar o cancelar una propuesta ────────────────────────────

export const SALIDA_PROPUESTA = 'No ejecutar la acción';

/** El primario nombra la acción y su objeto: es el nombre de la operación. */
export const rotuloPrimario = (t: Pick<TarjetaPendiente, 'titulo'>): string => t.titulo.trim() || 'Ejecutar la acción';

export type TrasTarjeta = {
  /** el estado nuevo de la fila; `null` = sigue pendiente (se puede volver a intentar) */
  estado: EstadoPropuesta | null;
  /** 3-4 palabras, o null si no hay toast */
  toast: string | null;
  /** lo que dice el sheet: de quién fue y qué pasa ahora */
  frase: string | null;
  haptico: 'success' | 'error' | null;
};

/** Traduce lo que contestó la acción a lo que ve la persona. */
export function trasTarjeta(r: ResultadoTarjeta, accion: 'confirmar' | 'cancelar'): TrasTarjeta {
  if (r.ok) {
    return accion === 'confirmar'
      ? { estado: 'hecho', toast: 'Acción ejecutada', frase: null, haptico: 'success' }
      : { estado: 'cancelada', toast: 'No se ejecutó', frase: null, haptico: null };
  }
  if (r.error === 'Ya no está vigente') return { estado: 'vencida', toast: 'Ya no está vigente', frase: 'Venció: ya no se puede ejecutar.', haptico: null };
  if (r.error === 'Ya se resolvió') return { estado: 'resuelta', toast: 'Ya se resolvió', frase: 'Ya se resolvió en otro lado.', haptico: null };
  // Se ejecutó y falló: la pendiente quedó cerrada. No se ofrece reintentar.
  if (r.ejecutada) return { estado: 'fallo', toast: null, frase: `Se ejecutó y falló: ${r.error}`, haptico: 'error' };
  return { estado: null, toast: null, frase: `MaKo no pudo: ${r.error}`, haptico: 'error' };
}

/** El texto de la pill de cada estado. «Aprobación pendiente» es el único naranja. Los
 *  estados que son de MaKo salen de GRAMATICA: el rótulo de un estado no se escribe a mano. */
export const PILL_PROPUESTA: Record<EstadoPropuesta, { texto: string; tono: 'warn' | 'good' | 'neutro' | 'bad' }> = {
  pendiente: { texto: GRAMATICA.aprobacion.rotulo, tono: 'warn' },
  aplicando: { texto: GRAMATICA.ejecuta.rotulo, tono: 'neutro' },
  hecho: { texto: GRAMATICA.completo.rotulo, tono: 'good' },
  cancelada: { texto: 'No se ejecutó', tono: 'neutro' },
  vencida: { texto: 'Vencida', tono: 'neutro' },
  resuelta: { texto: 'Ya resuelta', tono: 'neutro' },
  fallo: { texto: 'Falló', tono: 'bad' },
};
