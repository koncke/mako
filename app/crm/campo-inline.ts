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
// ⚠️ YA ESTÁN TODOS LOS DEL FORMULARIO. La primera pasada dejó afuera cuatro
// (fecha de agendamiento, motivo de salida, fecha límite de la nutrición manual y
// los dos links de Fathom) y esos cuatro eran exactamente la razón por la que el
// botón «Editar lead →» seguía existiendo. Lo único que sigue colgando de una
// pantalla aparte es el DEAL (Deal Details), que tiene su propia tab y su propio
// «Editar deal →».

import type { FathomLink } from '@/lib/leads';

/**
 * Los campos que la ficha edita en el lugar.
 *
 * ⚠️ LA CLAVE ES LA COLUMNA DE `leads`, con UNA excepción declarada: `fathom_r1` y
 * `fathom_r2` son los dos SLOTS de la columna `fathom_links`, que es un array. Se
 * parten en dos claves porque se editan en dos renglones distintos (el bloque de
 * la R1 y el de la R2) y porque guardar uno NO puede borrar el otro — que es
 * justo lo que hacía el formulario, que reescribía el array entero.
 */
export type CampoInline =
  | 'fecha_agenda'
  | 'fecha_junta_1'
  | 'fecha_junta_2'
  | 'fecha_confirmacion'
  | 'asistio_j1'
  | 'asistio_j2'
  | 'calificado'
  | 'closer'
  | 'setter'
  | 'motivo_perdida'
  | 'nutricion_manual_deadline'
  | 'fathom_r1'
  | 'fathom_r2';

/** Lo que la pantalla manda: texto de un `<input type="date">`, tri-estado o nombre. */
export type ValorInline = string | boolean | null;

/**
 * Por dónde se escribe cada campo. NO es un detalle de implementación:
 *
 *  · `lead` → `updateLead`, que es el único lugar que aplica las invariantes
 *    (sin fecha R1 no hay asistencia, sin asistencia no hay «calificado», y un
 *    motivo de salida sólo sobrevive si el lead está perdido o descalificado) y
 *    el único que DISPARA META CAPI cuando `calificado` pasa a true. Escribir
 *    `calificado` por el camino corto deja a Meta sin el evento que la pantalla
 *    dice que manda — que es justo el dato por el que el cliente la marca.
 *  · `meta` → `saveLeadMeta`, columnas sin invariante ni evento (closer/setter y
 *    la fecha límite de la nutrición manual).
 *  · `fathom` → también `saveLeadMeta`, pero PARCHEANDO un slot del array: la
 *    action lee los links que ya están, reemplaza el de esa reunión y deja el
 *    resto como estaba.
 */
export const VIA_INLINE: Record<CampoInline, 'lead' | 'meta' | 'fathom'> = {
  fecha_agenda: 'lead',
  fecha_junta_1: 'lead',
  fecha_junta_2: 'lead',
  fecha_confirmacion: 'lead',
  asistio_j1: 'lead',
  asistio_j2: 'lead',
  calificado: 'lead',
  // El motivo va por `updateLead` y no por el camino corto porque la invariante
  // es SUYA: «motivo solo tiene sentido en perdido/descalificado» está escrita
  // ahí, y por el camino corto un lead reabierto se quedaba con el motivo viejo.
  motivo_perdida: 'lead',
  closer: 'meta',
  setter: 'meta',
  nutricion_manual_deadline: 'meta',
  fathom_r1: 'fathom',
  fathom_r2: 'fathom',
};

/**
 * El GESTO de cada campo. Un «click y escribí» sobre un desplegable no existe:
 *  · `fecha`   → el click abre el campo de fecha (y su calendario).
 *  · `tri`     → el click abre Sí / No / —, ahí mismo.
 *  · `persona` → el click abre el desplegable del equipo.
 *  · `texto`   → el click pone el cursor y se sobrescribe (`EditableInline`).
 *  · `enlace`  → texto, pero validado: un link que no es de Fathom deja al
 *    buscador de grabaciones apuntando a la nada.
 * El contacto (nombre, empresa, email, teléfono) NO pasa por acá: ya se edita con
 * `EditableInline` en `InfoPrincipalCard`, que es el molde de esta casa.
 */
export const GESTO_INLINE: Record<CampoInline, 'fecha' | 'tri' | 'persona' | 'texto' | 'enlace'> = {
  fecha_agenda: 'fecha',
  fecha_junta_1: 'fecha',
  fecha_junta_2: 'fecha',
  fecha_confirmacion: 'fecha',
  asistio_j1: 'tri',
  asistio_j2: 'tri',
  calificado: 'tri',
  closer: 'persona',
  setter: 'persona',
  motivo_perdida: 'texto',
  nutricion_manual_deadline: 'fecha',
  fathom_r1: 'enlace',
  fathom_r2: 'enlace',
};

export function esCampoInline(campo: string): campo is CampoInline {
  return Object.prototype.hasOwnProperty.call(VIA_INLINE, campo);
}

const ISO_DIA = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Un link de grabación de Fathom.
 *
 * ⚠️ ES LA ÚNICA VALIDACIÓN QUE HAY, y hasta hoy NO EXISTÍA EN LA FICHA: el
 * formulario sólo ponía un `placeholder="https://fathom.video/…"` y guardaba
 * cualquier cosa que se pegara. La regla ya estaba escrita —pero en el canal de
 * MaKo (`lib/api-mako/areas/crm.run.ts`), o sea que el bot era más estricto que
 * la pantalla—. Acá queda una sola copia y el canal la importa.
 *
 * Importa porque el link es lo que siguen el reparto de grabaciones y el Closing
 * Analyst: con un texto cualquiera, el bloque de la reunión dibuja un «Abrir →»
 * que no abre nada y el análisis queda huérfano.
 */
export const FATHOM_URL = /^https:\/\/([a-z0-9-]+\.)*fathom\.video\//i;

/** Los dos slots fijos de `fathom_links`: una llamada de VENTA por reunión. */
export const ETIQUETA_FATHOM: Record<'fathom_r1' | 'fathom_r2', string> = {
  fathom_r1: 'Reunión 1',
  fathom_r2: 'Reunión 2',
};

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
  if (gesto === 'fecha') {
    // ⚠️ LA FECHA LÍMITE DE LA NUTRICIÓN MANUAL NO PUEDE QUEDAR VACÍA, y es la
    // única validación de campo que el formulario tenía de verdad («Para
    // "Nutrición - Manual" tienes que poner una fecha límite»). Sin ella el lead
    // se queda en Manual sin plazo: `lib/crm-auto-plan.ts` cuelga de esa fecha
    // para avisar que venció, así que vaciarla lo saca del radar en silencio.
    if (!s && campo === 'nutricion_manual_deadline') throw new Error('La nutrición manual necesita una fecha límite.');
    if (!s) return null;
    if (!ISO_DIA.test(s)) throw new Error(`"${campo}" espera una fecha (AAAA-MM-DD).`);
    return s;
  }
  if (!s) return null;
  if (gesto === 'enlace') {
    if (!FATHOM_URL.test(s)) throw new Error('El link tiene que ser una URL de Fathom (https://fathom.video/…).');
    return s.slice(0, 500);
  }
  if (gesto === 'texto') return s.slice(0, 500);
  // persona: el nombre de un miembro del equipo (o uno viejo que ya no está).
  return s.slice(0, 80);
}

/**
 * Reemplaza el link de UNA reunión y deja TODOS los demás como estaban.
 *
 * ⚠️ ES LO QUE EL FORMULARIO NO HACÍA. Su `buildFathom(u1, u2)` reconstruía el
 * array desde cero con dos slots: cualquier link que no cayera en esos dos —un
 * tercero, o uno con otra etiqueta— se perdía al guardar, sin aviso y sin línea en
 * el historial. Editando campo por campo eso sería peor todavía (tocar la R1
 * borraría la R2), así que acá se parchea EN SU POSICIÓN el primer link de esa
 * reunión y no se toca nada más.
 *
 * `esR2` entra por parámetro —y no importado acá— porque `etiquetaEsR2` vive en
 * `lib/insights-llamada-reparto.ts` junto al reparto de los análisis: es la MISMA
 * pregunta, y con dos copias el link cae en un bloque y su análisis en el otro.
 */
export function ponerLinkFathom(
  links: FathomLink[],
  campo: 'fathom_r1' | 'fathom_r2',
  url: string | null,
  esR2: (label: string | null | undefined) => boolean,
): FathomLink[] {
  const mio = campo === 'fathom_r2';
  // Un link sin URL no es un link: el array guarda {label, url} y una fila vacía
  // dibuja un «Abrir →» muerto. Es la misma limpieza que hacía el formulario.
  const vivos = links.filter((f) => f.url?.trim());
  const nuevo: FathomLink | null = url ? { label: ETIQUETA_FATHOM[campo], url } : null;
  const i = vivos.findIndex((f) => esR2(f.label) === mio);
  if (i < 0) return nuevo ? (mio ? [...vivos, nuevo] : [nuevo, ...vivos]) : vivos;
  const out = vivos.slice();
  if (nuevo) out[i] = nuevo;
  else out.splice(i, 1);
  return out;
}

/**
 * ¿Guardar por `updateLead` le va a BORRAR el monto de cierre a este lead?
 *
 * ⚠️ ESTO NO ERA PARANOIA, ERA UNA REGLA ESCRITA EN `updateLead`: «si cerro != true
 * → monto_cierre_usd y fecha_cierre se fuerzan a null», y se aplicaba mirara el
 * caller lo que mirara — aunque sólo hubiera mandado `asistio_j1`. Desde el
 * 06/10/2026 se aplica sólo si el caller tocó un campo que decide la venta
 * (`desenlaceAlGuardar`, lib/lead-desenlace.ts), así que el rescate de
 * `guardarCampoLeadAction` quedó como red: reescribe los mismos valores.
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
