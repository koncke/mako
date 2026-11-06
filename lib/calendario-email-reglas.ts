// =============================================================================
// calendario-email-reglas — un «Email» del Calendario enlazado a Email Marketing (6/11/2026), lo puro
// =============================================================================
// La promesa a la agencia de Thiago: «programar en el Calendar un anuncio, un email». Un evento de formato Email era un
// recordatorio que se tildaba a mano. Ahora se ENLAZA a un broadcast de Email Marketing, que se programa a la hora del
// evento con la MISMA regla que «Programar» en Email Marketing (`programar_broadcast`, lib/api-mako/areas/email.run.ts), y
// el evento dice lo que pasó de verdad. Acá, sin base ni red: qué evento se puede enlazar y cómo se lee el email enlazado.
// Lo usan lib/calendario-email.ts, su operación de la API y el modal (app/calendario/EnlazarEmail.tsx).
// =============================================================================

/** El evento, como lo guarda `calendario_eventos`. */
export type EventoParaEmail = { tipo: string; formato: string | null; dia_completo: boolean; inicio: string };

/** El broadcast enlazado, lo que se dibuja de él. */
export type EmailEnlazado = { id: number; asunto: string; estado: string; programado_at: string | null; enviado_at: string | null };

/** Los estados de un broadcast que se pueden enlazar (programar): los de `EDITABLE` de Email Marketing, menos el cancelado. */
export const ESTADOS_ENLAZABLES: readonly string[] = ['borrador', 'programado'];

/** Un minuto de margen: lo que pide `programar_broadcast` («la fecha tiene que ser futura»). */
export const MARGEN_PROGRAMAR_MS = 60_000;

/**
 * Por qué este evento NO se puede enlazar a un email (null = se puede). Un email sale a una HORA: un evento de todo el día
 * no la tiene, y uno que ya pasó no se programa.
 */
export function motivoParaNoEnlazar(e: EventoParaEmail, ahoraMs: number): string | null {
  if (e.tipo !== 'publicacion' || e.formato !== 'email') return 'Sólo una publicación de formato Email se enlaza a un email.';
  if (e.dia_completo) return 'Ponle una hora al evento: el email sale a esa hora.';
  const t = Date.parse(e.inicio);
  if (!Number.isFinite(t)) return 'El evento no tiene una hora válida.';
  if (t < ahoraMs + MARGEN_PROGRAMAR_MS) return 'El evento ya pasó: un email se programa para más adelante.';
  return null;
}

/** Lo que dice el evento de su email: el estado de verdad, no un tilde. */
export function estadoDelEmail(b: EmailEnlazado | null): { texto: string; tono: 'info' | 'good' | 'warn' | 'neutro'; enviado: boolean } {
  if (!b) return { texto: 'Sin email enlazado', tono: 'neutro', enviado: false };
  if (b.estado === 'enviado') return { texto: 'Enviado', tono: 'good', enviado: true };
  if (b.estado === 'enviando') return { texto: 'Enviándose', tono: 'info', enviado: false };
  if (b.estado === 'programado') return { texto: 'Programado', tono: 'info', enviado: false };
  return { texto: 'Sin programar (en borrador)', tono: 'warn', enviado: false };
}

/** ¿El email programado sale a la hora del evento? Si el evento se movió y el email no, ya no coinciden. */
export function coincideLaHora(b: Pick<EmailEnlazado, 'estado' | 'programado_at'>, inicio: string): boolean {
  if (b.estado !== 'programado' || !b.programado_at) return true;
  return Date.parse(b.programado_at) === Date.parse(inicio);
}
