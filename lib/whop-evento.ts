// =============================================================================
// whop-evento — leer el payload de un webhook de Whop
// =============================================================================
// SIN `server-only` A PROPÓSITO, y no es un detalle de estilo: es parseo puro
// sobre un objeto, y vivía adentro de `lib/whop.ts`, que sí lo tiene. Ningún
// test podía importarlo, así que la parte que decide DE QUÉ CLASE y DE QUÉ
// CLIENTE es un evento era lo único del camino sin una sola aserción — que es
// exactamente donde más duele (AGENTS.md → «Un guard sobre algo destructivo…»,
// mismo criterio que `exigirClienteDePrueba` y `lib/model-catalogo.ts`).
//
// Sacarlo costó un evento de producción: el filtro buscaba ids que empezaran con
// `less` y el prefijo real es `lesn_`, así que descartaba TODAS las lecciones
// contestando «sin id de lección» — con 200, o sea que Whop lo daba por
// entregado. Ningún test de datos inventados lo habría encontrado: los habría
// inventado con el mismo prefijo equivocado.
// =============================================================================

export type EventoWhop = {
  /** ej. `course_lesson_interaction.completed` */
  event?: string;
  action?: string;
  data?: Record<string, unknown>;
};

/** El prefijo REAL de un id de lección de Whop. Es `lesn_`, no `less_`.
 *  Salió de un id real (`lesn_NxR3LfLTx5zpH`), no de una corazonada. */
export const PREFIJO_LECCION = 'lesn_';

/**
 * El id de lección que trae un evento de avance. Devuelve null en vez de
 * inventar: un id equivocado marca completado el bloque de OTRA clase, y eso no
 * se nota nunca — ni en un log ni en la pantalla.
 *
 * Las claves explícitas se toman TAL CUAL: si el campo se llama
 * `course_lesson_id`, es el id de la lección y no hay nada que adivinar.
 * Filtrarlas por una corazonada sobre el prefijo fue el bug.
 *
 * El `id` pelado sí se filtra, porque en un evento de interacción es el id de LA
 * INTERACCIÓN y no el de la lección.
 */
export function leccionDelEvento(ev: EventoWhop): string | null {
  const d = ev.data ?? {};
  for (const k of ['course_lesson_id', 'lesson_id']) {
    const v = d[k];
    if (typeof v === 'string' && v.trim()) return v.trim();
  }
  const anidado = d.course_lesson as { id?: unknown } | undefined;
  if (anidado && typeof anidado.id === 'string' && anidado.id.trim()) return anidado.id.trim();
  const suelto = d.id;
  if (typeof suelto === 'string' && suelto.startsWith(PREFIJO_LECCION)) return suelto;
  return null;
}

/** El email del alumno, que es lo único que lo cruza con el CRM. Whop lo manda
 *  en distintos lugares según el evento. Null antes que adivinar: un email
 *  inventado le escribe el avance a otro cliente. */
export function emailDelEvento(ev: EventoWhop): string | null {
  const d = (ev.data ?? {}) as Record<string, unknown>;
  const directo = d.email ?? d.user_email;
  if (typeof directo === 'string' && directo.includes('@')) return directo.trim();
  const user = d.user as { email?: unknown } | undefined;
  if (user && typeof user.email === 'string' && user.email.includes('@')) return user.email.trim();
  const member = d.member as { email?: unknown } | undefined;
  if (member && typeof member.email === 'string' && member.email.includes('@')) return member.email.trim();
  return null;
}

/** La company dueña del evento. Es lo que resuelve a qué workspace entregarlo. */
export function companyDelEvento(ev: EventoWhop): string | null {
  const d = (ev.data ?? {}) as Record<string, unknown>;
  const directo = d.company_id;
  if (typeof directo === 'string' && directo.trim()) return directo.trim();
  const company = d.company as { id?: unknown } | undefined;
  if (company && typeof company.id === 'string' && company.id.trim()) return company.id.trim();
  return null;
}

/** El nombre del evento, que Whop manda como `event` o como `action`. */
export function tipoDelEvento(ev: EventoWhop): string {
  return (ev.event ?? ev.action ?? '').trim();
}
