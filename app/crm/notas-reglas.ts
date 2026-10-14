// =============================================================================
// notas-reglas — lo de una nota del lead que leen el server y la pantalla
// =============================================================================
// Puro a propósito (sin 'use server' ni 'use client'): lo importan las dos server actions que
// escriben el texto de una nota (`addLeadNoteAction` en app/crm/actions.ts y la edición en
// app/crm/notas-actions.ts), la caja de la ficha (NotasCard) y el test. Un archivo 'use server'
// no puede exportar una constante (AGENTS.md), y copiada en cada uno es como se separaron.

/**
 * El largo máximo de una nota, en caracteres. UNO para todos los que la escriben.
 *
 * ⚠️ EL CASO (revisión del 12/10/2026). La edición cortaba a 4000 con un `slice` y el alta no
 * cortaba nada: una nota dictada de 5000 entraba entera, alguien le corregía una letra y al guardar
 * se perdía la cola, con el toast «Nota guardada» — y la ficha, Customer Success, /m y MaKo leían la
 * nota cortada. Ahora los dos caminos RECHAZAN lo que pasa el tope (nunca recortan) y las dos cajas
 * lo topean al escribir. La nota por la API de MaKo topea más abajo (el `max: 2000` de su parámetro,
 * lib/api-mako/areas/crm.def.ts). /m (app/m/crm/acciones.ts) recortaba a 4000 ANTES de llamar al
 * alta; desde el 13/10/2026 también rechaza con este tope.
 */
export const TOPE_NOTA = 4000;

/**
 * El adjunto de una nota (archivos e imágenes, tercer feedback del 12/10/2026, punto 3: «las notas
 * como los chats de MaKo»). Vive en el bucket PRIVADO `lead-notas` (mig 0267) en
 * `<ws>/<lead>/<uuid>`: el workspace y el lead primero y puestos por el server, para que «¿este
 * archivo es de este lead?» se conteste con el prefijo. El nombre original NO entra en la ruta.
 * Los formatos y el tope son los de las notas del curso (`MIME_NOTA`, `TOPE_NOTA_BYTES`).
 */
export const BUCKET_NOTAS_LEAD = 'lead-notas';
const UUID = '[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}';

export function pathDeNotaLead(ws: number, leadId: number, uuid: string): string | null {
  if (!Number.isSafeInteger(ws) || ws <= 0 || !Number.isSafeInteger(leadId) || leadId <= 0) return null;
  if (!new RegExp('^' + UUID + '$').test(uuid)) return null;
  return `${ws}/${leadId}/${uuid}`;
}

/** ¿Este path es un adjunto subido para ESTE lead de ESTE workspace? Viaja desde el navegador. */
export function pathEsNotaDelLead(path: unknown, ws: number, leadId: number): boolean {
  return typeof path === 'string' && new RegExp('^' + ws + '/' + leadId + '/' + UUID + '$').test(path);
}

/**
 * «DD/MM/AAAA» de cuando se escribió una nota, en la zona del NEGOCIO: lo que deja «Nota borrada»
 * en el historial.
 *
 * ⚠️ CON LA ZONA, NUNCA EN UTC (revisión del 12/10/2026): con los getters UTC, una nota escrita a
 * las 18:30 en Tijuana (01:30 UTC del día siguiente) quedaba para siempre en el historial «escrita
 * el» día SIGUIENTE al que la tarjeta mostraba. La zona es la misma con la que la pinta la tarjeta
 * (`tzActual`, la de `tzWorkspaceAction`). '' si la fecha o la zona no se pueden leer: mejor sin
 * fecha que con la equivocada.
 */
export function fechaDeNota(iso: string, tz: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  try {
    return new Intl.DateTimeFormat('es-MX', { day: '2-digit', month: '2-digit', year: 'numeric', timeZone: tz }).format(d);
  } catch {
    return '';
  }
}
