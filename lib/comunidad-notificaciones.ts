// =============================================================================
// comunidad-notificaciones — la campana de la comunidad (puro): a quién se avisa y cómo se agrupa
// =============================================================================
// Skool (relevo, B.3): la campana avisa de un like en lo tuyo, un comentario en tu post, una respuesta
// a tu comentario, una mención y lo nuevo en un post que sigues; cada aviso queda leído o sin leer, y
// los likes se AGRUPAN («Ana y 3 más le dieron like a tu post»). Acá se suma el evento que empieza
// pronto (lib/comunidad-calendario.ts lo anota cuando alguien abre la campana).
//
// Sin 'use client' ni 'server-only': lo usan la capa de datos (lib/comunidad-datos.ts, que ESCRIBE los
// avisos; lib/comunidad-campana.ts, que los LEE) y el test que lo ejecuta
// (tests/comunidad-notificaciones.test.ts). Acá no se lee ni se escribe nada.
//
// ⚠️ LOS MAILS NO EXISTEN TODAVÍA, a propósito (pedido de esta tanda: «sin mails por ahora»). Skool
//    manda un resumen diario y el recordatorio de 24 h de un evento; la tabla `comunidad_evento_avisos`
//    (mig 0217) está para ese recordatorio y hoy no la escribe nadie.

import { leerClave } from './comunidad-reglas';

export type TipoNotificacion = 'like' | 'comentario' | 'respuesta' | 'mencion' | 'post_seguido' | 'evento';

/**
 * Cuando una misma acción le toca a alguien por dos lados (comentan su post Y lo mencionan), le llega
 * UNA notificación: la de más arriba de esta lista. Dos avisos por el mismo comentario son ruido, y
 * el ruido es lo que enseña a no mirar la campana.
 */
export const PRIORIDAD: readonly TipoNotificacion[] = ['respuesta', 'mencion', 'comentario', 'post_seguido', 'like', 'evento'];

export type AvisoPendiente = { para: string; tipo: TipoNotificacion; postId: number | null; comentarioId?: number | null };

/**
 * A quién se le escribe, de una lista de avisos que produjo UNA acción:
 *   · nunca a quien la hizo (comentar tu propio post no te avisa a vos);
 *   · sólo a claves válidas (`u:<id>` / `l:<id>`);
 *   · una por persona, la de mayor prioridad (`PRIORIDAD`).
 * Mantiene el orden en que cada persona apareció por primera vez.
 */
export function destinatarios(actor: string, avisos: readonly AvisoPendiente[]): AvisoPendiente[] {
  const elegido = new Map<string, AvisoPendiente>();
  for (const x of avisos) {
    const k = leerClave(x.para);
    if (!k || k.clave === actor) continue;
    const ya = elegido.get(k.clave);
    if (!ya || PRIORIDAD.indexOf(x.tipo) < PRIORIDAD.indexOf(ya.tipo)) elegido.set(k.clave, { ...x, para: k.clave });
  }
  return [...elegido.values()];
}

/**
 * Los avisos de un COMENTARIO nuevo (o una respuesta), antes de filtrar:
 *   · a quien se le contestó (el autor del comentario respondido y el del hilo): «respuesta»;
 *   · a los mencionados: «mención»;
 *   · al autor del post, SI SIGUE su post (lo sigue por default; puede dejar de seguirlo): «comentario»;
 *   · al resto de los que siguen el post: «post_seguido».
 *
 * ⚠️ EL AUTOR DEL POST SIN SEGUIRLO NO RECIBE «comentario». Es lo que significa «dejar de seguir» con
 *    la campana del post: si igual le llegara, el botón no haría nada.
 */
export function avisosDeComentario(p: {
  autorPost: string;
  seguidores: readonly string[];
  contestados: readonly string[];
  menciones: readonly string[];
  postId: number;
  comentarioId: number;
}): AvisoPendiente[] {
  const base = { postId: p.postId, comentarioId: p.comentarioId };
  return [
    ...p.contestados.map((para) => ({ ...base, para, tipo: 'respuesta' as const })),
    ...p.menciones.map((para) => ({ ...base, para, tipo: 'mencion' as const })),
    ...(p.seguidores.includes(p.autorPost) ? [{ ...base, para: p.autorPost, tipo: 'comentario' as const }] : []),
    ...p.seguidores.filter((k) => k !== p.autorPost).map((para) => ({ ...base, para, tipo: 'post_seguido' as const })),
  ];
}

// ── Leer: agrupar ─────────────────────────────────────────────────────────────────

/** Una fila de `comunidad_notificaciones`, como la lee la campana. */
export type FilaNotificacion = {
  id: number;
  tipo: TipoNotificacion;
  de_miembro: string | null;
  post_id: number | null;
  comentario_id: number | null;
  evento_id: number | null;
  ocurrencia: string | null;
  leida_at: string | null;
  created_at: string;
};

export type GrupoNotificacion = {
  /** Todas las filas del grupo: marcarlo leído las marca a todas. */
  ids: number[];
  tipo: TipoNotificacion;
  /** Quiénes, sin repetir, del más reciente al más viejo. */
  de: string[];
  postId: number | null;
  comentarioId: number | null;
  eventoId: number | null;
  ocurrencia: string | null;
  /** La más reciente del grupo. */
  creado: string;
  /** Leído sólo si TODAS sus filas lo están: un like nuevo sobre un grupo leído lo vuelve a encender. */
  leida: boolean;
};

/**
 * Los avisos como se DIBUJAN: los likes sobre la misma cosa (el mismo post, o el mismo comentario) en
 * un solo renglón; todo lo demás, uno por fila. Del más reciente al más viejo.
 */
export function agruparNotificaciones(filas: readonly FilaNotificacion[]): GrupoNotificacion[] {
  const orden = filas.slice().sort((a, b) => (a.created_at < b.created_at ? 1 : a.created_at > b.created_at ? -1 : b.id - a.id));
  const grupos = new Map<string, GrupoNotificacion>();
  const out: GrupoNotificacion[] = [];
  for (const f of orden) {
    const clave = f.tipo === 'like' ? `like|${f.comentario_id != null ? `c${f.comentario_id}` : `p${f.post_id}`}` : `fila|${f.id}`;
    const ya = grupos.get(clave);
    if (ya) {
      ya.ids.push(Number(f.id));
      if (f.de_miembro && !ya.de.includes(f.de_miembro)) ya.de.push(f.de_miembro);
      if (!f.leida_at) ya.leida = false;
      continue;
    }
    const g: GrupoNotificacion = {
      ids: [Number(f.id)], tipo: f.tipo, de: f.de_miembro ? [f.de_miembro] : [],
      postId: f.post_id == null ? null : Number(f.post_id), comentarioId: f.comentario_id == null ? null : Number(f.comentario_id),
      eventoId: f.evento_id == null ? null : Number(f.evento_id), ocurrencia: f.ocurrencia, creado: f.created_at, leida: !!f.leida_at,
    };
    grupos.set(clave, g);
    out.push(g);
  }
  return out;
}

/** Cuántos renglones sin leer (lo que dice el globito de la campana). */
export const sinLeerDe = (grupos: ReadonlyArray<{ leida: boolean }>): number => grupos.filter((g) => !g.leida).length;

/** La clave que deduplica el aviso de un evento: una por persona, evento y FECHA de la ocurrencia. */
export const claveDeAvisoDeEvento = (eventoId: number, fecha: string): string => `e:${eventoId}:${fecha}`;

/** Cuánto antes de empezar se avisa de un evento (Skool manda su recordatorio 24 h antes). */
export const AVISO_EVENTO_MS = 24 * 3_600_000;
