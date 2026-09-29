// =============================================================================
// disparador-mensaje — qué de «cuándo llega este mensaje» se puede elegir
// =============================================================================
// Módulo SIN `server-only`: lo importan el detalle de un mensaje (navegador), el
// choke point de los avisos y el despachador de reportes.
//
// ── POR QUÉ ACÁ NO HAY UN SELECTOR DE EVENTO ────────────────────────────────
// El pedido fue que el primer paso —el disparador— se pueda configurar: «un evento
// o está configurado por tiempo cada X tiempo por ejemplo». La mitad EVENTO no es
// una opción y medirlo es lo que lo demuestra: de los 65 mensajes del catálogo,
// 19 tienen un call site que los emite y los otros 46 son detecciones que todavía
// no existen. Lo que hace salir a cada uno es ese call site —un webhook de
// Calendly, un cron de vigilancia, un cambio de estado— o sea que «qué lo dispara»
// es lo que el mensaje ES. Un desplegable para convertir «un lead canceló la
// reunión» en «cada 3 días» sería el control que se dibuja y no cambia nada.
//
// La mitad que SÍ es una decisión del negocio es la otra: CADA CUÁNTO. Y tiene un
// mecanismo que ya funciona y ya está probado en producción —el dedup atómico de
// `lib/avisos.ts`, el que cerró los 21 pares duplicados del 27/09— así que lo que
// falta no es un motor nuevo: es que ese número salga de la pantalla en vez de
// estar cableado en cada call site.
//
// ── LA REGLA: SE PUEDE ESPACIAR, NUNCA APRETAR ──────────────────────────────
// El número del call site (o la cadencia del cron) es el TECHO de frecuencia, y
// está ahí por algo: el cron de alerta crítica revisa cada 10 minutos y avisa cada
// hora porque detectar rápido e insistir seguido son dos cosas distintas. Lo que
// el negocio elige es cualquier cosa POR DEBAJO de ese techo, y eso se aplica con
// un `Math.max` de los dos — nunca reemplazando uno por el otro.
//
// Por eso esta pantalla no puede producir un mensaje de más, que es lo único que
// habría que temerle: en el peor caso produce uno de menos, y eso es exactamente
// lo que se pidió al elegirlo.

/** Minutos mínimos entre dos salidas del mismo mensaje. 0 = sin límite propio. */
export type FrecuenciaMin = number;

export const SIN_LIMITE: FrecuenciaMin = 0;

const H = 60;
const D = 24 * H;

/**
 * Las opciones, en minutos. Una lista corta y a propósito: son las que un negocio
 * puede contestar sin pensar. Un campo libre de minutos contesta la misma pregunta
 * y obliga a traducir «una vez por semana» a 10.080.
 *
 * ⚠️ El `0` va PRIMERO y es el default. Es el comportamiento de hoy, y el default
 * de un campo nuevo es el que no le cambia la vida a nadie.
 */
export const FRECUENCIAS: ReadonlyArray<{ min: FrecuenciaMin; label: string }> = [
  { min: SIN_LIMITE, label: 'Cada vez' },
  { min: 1 * H, label: 'Máximo uno por hora' },
  { min: 6 * H, label: 'Máximo uno cada 6 horas' },
  { min: 1 * D, label: 'Máximo uno por día' },
  { min: 3 * D, label: 'Máximo uno cada 3 días' },
  { min: 7 * D, label: 'Máximo uno por semana' },
  { min: 30 * D, label: 'Máximo uno por mes' },
];

/** El techo: un mes. Más que eso no es espaciar un mensaje, es apagarlo — y para
 *  apagarlo ya está el interruptor, que además conserva el texto y no miente. */
export const FRECUENCIA_MAX: FrecuenciaMin = 30 * D;

/**
 * Lo que se guarda tiene que ser uno de los valores de la lista.
 *
 * No es prolijidad: el número gobierna cuántos mensajes recibe una persona, y un
 * valor de otra parte (un POST a mano, una preferencia vieja, un `NaN` de un parse)
 * entraría directo al `Math.max` del choke point. Un valor que no está en la lista
 * cae al más cercano POR DEBAJO, que es el lado que no silencia de más.
 */
export function sanearFrecuencia(v: unknown): FrecuenciaMin {
  const n = typeof v === 'number' ? v : Number(v);
  if (!Number.isFinite(n) || n <= 0) return SIN_LIMITE;
  const tope = Math.min(Math.floor(n), FRECUENCIA_MAX);
  let elegida: FrecuenciaMin = SIN_LIMITE;
  for (const f of FRECUENCIAS) if (f.min <= tope) elegida = f.min;
  return elegida;
}

/** El rótulo de un valor guardado, para pintarlo sin volver a recorrer la lista. */
export function labelFrecuencia(min: FrecuenciaMin): string {
  const f = FRECUENCIAS.find((x) => x.min === sanearFrecuencia(min));
  return f ? f.label : FRECUENCIAS[0]!.label;
}

/**
 * Los minutos que gobiernan DE VERDAD esta salida.
 *
 * `delCallSite` es lo que pide quien emite (el dedup de siempre) y `delNegocio` lo
 * que se eligió en la pantalla. Gana el mayor, y por eso esta función existe en vez
 * de un `??`: con `delNegocio ?? delCallSite`, elegir «cada vez» (0) en un aviso que
 * el call site protege con 60 minutos borraría esa protección — la pantalla pasaría
 * a poder producir MÁS mensajes que antes, que es justo lo que no puede hacer.
 */
export function frecuenciaEfectiva(delCallSite: number | undefined, delNegocio: unknown): FrecuenciaMin {
  const piso = typeof delCallSite === 'number' && delCallSite > 0 ? Math.floor(delCallSite) : 0;
  return Math.max(piso, sanearFrecuencia(delNegocio));
}

/**
 * El id del catálogo de cada reporte, desde el `tipo` que usa `lib/reportes.ts`.
 *
 * ⚠️ NO SON LA MISMA CADENA, y por eso este mapa existe: el reporte se identifica
 * internamente con guion BAJO (`reporte_diario`, que es también el `tipo` de su fila
 * en el feed) y en el catálogo de mensajes con guion MEDIO (`reporte-diario`). Pasarle
 * el primero al store de plantillas no da error: no encuentra la entrada, contesta el
 * default, y el control de la pantalla queda decorativo para los tres reportes — que
 * son justo los mensajes que más se abren.
 *
 * Va explícito y no con un `replace` de guiones: un mapa que no conoce una clave
 * devuelve `undefined` y el llamador cae al comportamiento de siempre, mientras un
 * `replace` inventa un id plausible para cualquier `tipo` que se agregue mañana.
 * `tests/disparador-frecuencia.test.ts` falla si alguno de los tres no está en el
 * catálogo.
 */
export const ID_DE_REPORTE: Readonly<Record<string, string>> = {
  reporte_horario: 'reporte-horario',
  reporte_diario: 'reporte-diario',
  reporte_semanal: 'reporte-semanal',
};

/** El id con el que este mensaje vive en el catálogo y en el store de plantillas. */
export function idDeMensaje(tipo: string): string {
  return ID_DE_REPORTE[tipo] ?? tipo;
}
