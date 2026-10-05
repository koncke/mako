// =============================================================================
// campo-inline — qué campos del lead se editan EN EL LUGAR, y por dónde escriben
// =============================================================================
// «Que ya no exista el botón de "editar" en la ruta de cada lead, sino que
// simplemente en cada campo … le doy click arriba y ya puedo sobre escribir»
// (Martín, 05/10/2026). Este módulo es el CATÁLOGO de esos campos: lo lee la
// pantalla (para saber qué gesto dibujar) y la server action (para validar lo que
// le llega). Es puro a propósito — sin 'use server' ni 'use client' — así el
// catálogo no se parte en dos copias que se desincronicen.
//
// ⚠️ NO ESTÁN TODOS LOS CAMPOS DEL LEAD, y la lista no es un gusto: están los que
// tienen un LUGAR donde se leen en la ficha. Un campo sin lugar no se puede editar
// «ahí mismo» porque no hay ahí. Los que faltan (motivo de pérdida, deadline de
// nutrición manual, el deal entero) siguen colgando del botón «Editar».

/** Los campos que la ficha edita en el lugar. La clave ES la columna de `leads`. */
export type CampoInline =
  | 'fecha_junta_1'
  | 'fecha_junta_2'
  | 'fecha_confirmacion'
  | 'asistio_j1'
  | 'asistio_j2'
  | 'calificado'
  | 'closer'
  | 'setter';

/** Lo que la pantalla manda: texto de un `<input type="date">`, tri-estado o nombre. */
export type ValorInline = string | boolean | null;

/**
 * Por dónde se escribe cada campo. NO es un detalle de implementación:
 *
 *  · `lead` → `updateLead`, que es el único lugar que aplica las invariantes
 *    (sin fecha R1 no hay asistencia, sin asistencia no hay «calificado») y el
 *    único que DISPARA META CAPI cuando `calificado` pasa a true. Escribir
 *    `calificado` por el camino corto deja a Meta sin el evento que la pantalla
 *    dice que manda — que es justo el dato por el que el cliente la marca.
 *  · `meta` → `saveLeadMeta`, columnas sin invariante ni evento (closer/setter).
 */
export const VIA_INLINE: Record<CampoInline, 'lead' | 'meta'> = {
  fecha_junta_1: 'lead',
  fecha_junta_2: 'lead',
  fecha_confirmacion: 'lead',
  asistio_j1: 'lead',
  asistio_j2: 'lead',
  calificado: 'lead',
  closer: 'meta',
  setter: 'meta',
};

/**
 * El GESTO de cada campo. Un «click y escribí» sobre un desplegable no existe:
 *  · `fecha`   → el click abre el campo de fecha (y su calendario).
 *  · `tri`     → el click abre Sí / No / —, ahí mismo.
 *  · `persona` → el click abre el desplegable del equipo.
 * El texto libre (nombre, empresa, email, teléfono) NO pasa por acá: ya se edita
 * con `EditableInline` en `InfoPrincipalCard`, que es el molde de esta casa.
 */
export const GESTO_INLINE: Record<CampoInline, 'fecha' | 'tri' | 'persona'> = {
  fecha_junta_1: 'fecha',
  fecha_junta_2: 'fecha',
  fecha_confirmacion: 'fecha',
  asistio_j1: 'tri',
  asistio_j2: 'tri',
  calificado: 'tri',
  closer: 'persona',
  setter: 'persona',
};

export function esCampoInline(campo: string): campo is CampoInline {
  return Object.prototype.hasOwnProperty.call(VIA_INLINE, campo);
}

const ISO_DIA = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Normaliza lo que llega de la pantalla al tipo de la columna, o tira.
 *
 * ⚠️ VALIDA DE VERDAD porque el llamador NO es la pantalla: es una server action,
 * o sea una URL. Un `fecha_junta_1: 'mañana'` entra en Postgres como error de
 * tipo y sube como un 500 sin nombre; un `calificado: 'si'` entraría como truthy
 * y mandaría un evento a Meta por un dato que nadie marcó.
 */
export function valorDeCampo(campo: CampoInline, v: ValorInline): string | boolean | null {
  const gesto = GESTO_INLINE[campo];
  if (gesto === 'tri') {
    if (v === true || v === false || v === null) return v;
    throw new Error(`"${campo}" solo acepta sí, no o sin marcar.`);
  }
  if (typeof v === 'boolean') throw new Error(`"${campo}" no es un sí/no.`);
  const s = (v ?? '').trim();
  if (!s) return null;
  if (gesto === 'fecha') {
    if (!ISO_DIA.test(s)) throw new Error(`"${campo}" espera una fecha (AAAA-MM-DD).`);
    return s;
  }
  // persona: el nombre de un miembro del equipo (o uno viejo que ya no está).
  return s.slice(0, 80);
}

/**
 * ¿Guardar por `updateLead` le va a BORRAR el monto de cierre a este lead?
 *
 * ⚠️ ESTO NO ES PARANOIA, ES UNA REGLA QUE YA ESTÁ ESCRITA EN `updateLead`: «si
 * cerro != true → monto_cierre_usd y fecha_cierre se fuerzan a null», y se aplica
 * mire el caller lo que mire — aunque sólo haya mandado `asistio_j1`.
 *
 * Y hay leads a los que eso les saca un número real: `lib/pagos.ts` y el editor
 * del deal escriben `monto_cierre_usd` DIRECTO, sin pasar por `updateLead`, así
 * que un lead en «Facturando» (estado `abierto`, `cerro` null) tiene monto y no
 * tiene `cerro`. Corregirle «asistió a R1» desde la ficha le vaciaba la venta.
 *
 * El síntoma es peor que el bug: el monto desaparece del lead y de Revenue sin un
 * error, sin un toast y sin una línea en el historial que diga quién lo sacó.
 */
export function montoEnRiesgo(l: { cerro?: boolean | null; monto_cierre_usd?: number | null; fecha_cierre?: string | null }): boolean {
  return l.cerro !== true && (l.monto_cierre_usd != null || l.fecha_cierre != null);
}
