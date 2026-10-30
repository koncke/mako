// =============================================================================
// copywriter/editado — la marca de quién editó un guion (docs/diseno-copywriter.md, D9)
// =============================================================================
// Puro y sin `server-only`: lo usan el server (al guardar), el editor (para dibujarla) y los tests.
//
// Lo que se ve: la propiedad «Última edición» del guion. «Ana con el link · 28 oct, 17:05» si lo último lo guardó
// alguien de AFUERA (resaltada para el dueño); si no, el nombre de quien lo guardó del equipo. El nombre de un invitado
// sale de su invitación; el de alguien con el link abierto lo escribe esa persona y NO está verificado, por eso dice
// «con el link».
// =============================================================================

import type { EditadoPor } from './tipos';

export const TOPE_NOMBRE_VISITA = 60;

/** Lo que se muestra cuando quien entró con el link no dijo su nombre. */
export const ALGUIEN = 'Alguien con el link';

/** Un nombre tal como lo escribió alguien: sin caracteres de control, sin espacios de más y con tope. Vacío = null. */
export function nombreDeVisita(v: unknown): string | null {
  if (typeof v !== 'string') return null;
  const s = v.replace(/[\u0000-\u001f\u007f]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, TOPE_NOMBRE_VISITA).trim();
  return s || null;
}

/** La marca leída de la base: lo que no cierra (sin nombre, sin fecha válida) no se muestra. */
export function sanearEditado(v: unknown): EditadoPor | null {
  if (!v || typeof v !== 'object') return null;
  const o = v as Record<string, unknown>;
  const por = nombreDeVisita(o.por);
  const at = typeof o.at === 'string' && !Number.isNaN(Date.parse(o.at)) ? o.at : null;
  if (!por || !at) return null;
  return { por, afuera: o.afuera === true, at };
}

/**
 * Quién guarda con un link compartido. Un INVITADO es quien recibió su link personal por mail: su nombre, o su email.
 * Con el link abierto, el nombre que escribió esa persona, o «Alguien con el link». Siempre `afuera`.
 */
export function autorDeVisita(invitado: { nombre: string | null; email: string } | null, escrito: unknown): Omit<EditadoPor, 'at'> {
  if (invitado) return { por: nombreDeVisita(invitado.nombre) ?? nombreDeVisita(invitado.email) ?? ALGUIEN, afuera: true };
  return { por: nombreDeVisita(escrito) ?? ALGUIEN, afuera: true };
}

/** «Ana con el link · 28 oct, 17:05»: el valor de la propiedad «Última edición». La hora, la del navegador. */
export function quienYCuando(e: EditadoPor): string {
  let cuando = '';
  try {
    cuando = new Date(e.at).toLocaleString('es-AR', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
  } catch { /* sin fecha legible, sin fecha */ }
  const quien = !e.afuera ? e.por : e.por === ALGUIEN ? 'Alguien con el link' : `${e.por} con el link`;
  return `${quien}${cuando ? ` · ${cuando}` : ''}`;
}
