// =============================================================================
// El desenlace de un lead al guardar — qué deriva `updateLead`, y CUÁNDO
// =============================================================================
// Módulo PURO (sin 'server-only' ni 'use client'): la decisión vivía adentro de
// `updateLead` (lib/leads.ts, que es server-only) y ahí ningún test la podía
// EJECUTAR. Es el mismo criterio que `calificadoSeDescarta` (lib/calificado-reunion.ts).
//
// Los cinco campos del desenlace se derivan entre sí:
//   · `estado_lead` manda y deriva `cerro`: ganado → true; perdido, descalificado y
//     no_responde → false; abierto → null. Si sólo vino `cerro` (flujos viejos), al
//     revés: el estado sale de `cerro`.
//   · `motivo_perdida` sólo tiene sentido en perdido o descalificado.
//   · La venta (`monto_cierre_usd` + `fecha_cierre`) sólo vive con `cerro = true`.
//     Con `cerro = true` el monto es opcional (se define después con el plan de
//     pagos) pero si está tiene que ser positivo, y la fecha de cierre se completa
//     con la de hoy si falta.
//
// ⚠️ ANTES ESTO SE APLICABA EN CADA GUARDADO, MANDARA EL CALLER LO QUE MANDARA, Y
// BORRABA VENTAS. `lib/pagos.ts` y el editor del deal (`app/crm/[id]/deal-actions.ts`)
// escriben `monto_cierre_usd` DIRECTO, sin pasar por `updateLead`, así que existen
// leads con la venta cargada y `cerro` en null: un lead en «Facturando» tiene estado
// `abierto`. Corregirle «asistió a R1», la fecha de una reunión o deshacer una línea
// del historial le vaciaba monto y fecha de cierre — en el lead y en Revenue, sin un
// error, sin un toast y sin una línea en el historial que dijera quién lo sacó
// (`fecha_cierre` ni siquiera está en AUDIT_FIELDS: ésa se perdía entera).
//
// LA REGLA: cada coerción se aplica SÓLO si el que llama tocó un campo que la decide.
// Corregir cualquier otro campo no le toca el desenlace a nadie.
//   · La venta: `estado_lead`, `cerro`, `monto_cierre_usd` — y `fecha_cierre`, que es
//     la otra mitad de la venta: dejarla afuera abriría una puerta para escribir una
//     fecha de cierre en un lead abierto por la misma función que existe para
//     impedirlo. (Hoy ningún caller la manda sola.)
//   · El motivo: `estado_lead`, `cerro` y el propio `motivo_perdida`. La ficha guarda
//     el motivo por `updateLead` justamente para que esta invariante se le aplique
//     (`VIA_INLINE` en app/crm/campo-inline.ts).
//
// Y lo que NO cambia, a propósito: un MOVIMIENTO de etapa (`setPipelineStage`) manda
// SIEMPRE `estado_lead`, así que pasar un Ganado a una etapa abierta sigue limpiando
// la venta — es lo pedido para un movimiento. Ojo que eso vale también entre dos
// etapas abiertas (Facturando → Falta pago): el estado viaja igual y la venta se
// limpia igual que antes de este cambio. Lo mismo `setMeetingManual` cuando reabre un
// desenlace terminal.
//
// ⚠️ Y lo que esta regla deja de hacer, también a propósito: ya no «cura» de rebote un
// lead incoherente cuando se le corrige otra cosa. Un ganado sin fecha de cierre no
// recibe la de HOY porque alguien le marcó una asistencia (sería inventar la fecha de
// una venta), y un ganado con monto ≤ 0 guardado por otro camino ya no bloquea
// cualquier corrección con «monto_cierre_usd debe ser positivo». Las dos cosas se
// siguen exigiendo en cuanto el caller toca la venta.
// =============================================================================

// Sólo el TIPO: `import type` se borra al compilar, así que este módulo no arrastra
// lib/leads.ts (server-only) y el test lo puede importar.
import type { EstadoLead } from './leads';

/** Los cinco campos del desenlace, como están guardados en `leads`. */
export type Desenlace = {
  estado_lead: EstadoLead;
  cerro: boolean | null;
  motivo_perdida: string | null;
  monto_cierre_usd: number | null;
  fecha_cierre: string | null;
};

/** Lo que mandó el que llama. Un campo ausente (o `undefined`) es un campo que NO tocó. */
export type CambioDeDesenlace = Partial<Desenlace>;

const CAMPOS: readonly (keyof Desenlace)[] = ['estado_lead', 'cerro', 'motivo_perdida', 'monto_cierre_usd', 'fecha_cierre'];

/** Los campos que deciden la venta (o la escriben). Sin ninguno, monto y fecha de cierre no se tocan. */
export const DECIDEN_LA_VENTA: readonly (keyof Desenlace)[] = ['estado_lead', 'cerro', 'monto_cierre_usd', 'fecha_cierre'];

/** Los campos que deciden si el motivo de salida sobrevive. */
export const DECIDEN_EL_MOTIVO: readonly (keyof Desenlace)[] = ['estado_lead', 'cerro', 'motivo_perdida'];

// `!== undefined` y no `in`: es la misma pregunta que `updateLead` ya le hacía a
// `estado_lead` y a `cerro`, y un `{ campo: undefined }` no escribe nada.
const toca = (cambio: CambioDeDesenlace, campos: readonly (keyof Desenlace)[]): boolean =>
  campos.some((c) => cambio[c] !== undefined);

/** ¿Este cambio decide la venta? Sólo entonces se coercionan monto y fecha de cierre. */
export const tocaLaVenta = (cambio: CambioDeDesenlace): boolean => toca(cambio, DECIDEN_LA_VENTA);

/** ¿Este cambio decide el motivo de salida? Sólo entonces se borra fuera de perdido/descalificado. */
export const tocaElMotivo = (cambio: CambioDeDesenlace): boolean => toca(cambio, DECIDEN_EL_MOTIVO);

/**
 * El desenlace que se guarda: lo que había, lo que mandó el caller encima, y SÓLO las
 * coerciones que ese cambio decide. Tira si el cambio toca la venta y deja un ganado
 * con monto ≤ 0 (mismo mensaje que antes, lo leen los callers).
 *
 * `hoy` (YYYY-MM-DD) lo pasa el que llama: es la fecha de cierre por defecto, y puesta
 * acá adentro el test no la podría fijar.
 */
export function desenlaceAlGuardar(actual: Desenlace, cambio: CambioDeDesenlace, hoy: string): Desenlace {
  // El mismo merge que `updateLead` (`{ ...actual, ...input }`), acotado a estos cinco.
  const m: Desenlace = {
    estado_lead: actual.estado_lead,
    cerro: actual.cerro,
    motivo_perdida: actual.motivo_perdida,
    monto_cierre_usd: actual.monto_cierre_usd,
    fecha_cierre: actual.fecha_cierre,
  };
  for (const k of CAMPOS) {
    if (cambio[k] !== undefined) (m as Record<keyof Desenlace, unknown>)[k] = cambio[k];
  }

  // estado_lead <-> cerro. Ya estaba condicionado a lo que vino, y sigue igual.
  if (cambio.estado_lead !== undefined) {
    if (m.estado_lead === 'ganado') m.cerro = true;
    // perdido / descalificado / no_responde: desenlaces que NO cerraron venta.
    else if (m.estado_lead === 'perdido' || m.estado_lead === 'descalificado' || m.estado_lead === 'no_responde') m.cerro = false;
    else m.cerro = null; // abierto
  } else if (cambio.cerro !== undefined) {
    if (m.cerro === true) m.estado_lead = 'ganado';
    // cerro=false puede ser perdido o descalificado: se conserva descalificado si ya
    // estaba, si no, perdido.
    else if (m.cerro === false) m.estado_lead = actual.estado_lead === 'descalificado' ? 'descalificado' : 'perdido';
    else m.estado_lead = 'abierto';
  }

  // El motivo sólo tiene sentido en perdido / descalificado.
  if (tocaElMotivo(cambio) && m.estado_lead !== 'perdido' && m.estado_lead !== 'descalificado') {
    m.motivo_perdida = null;
  }

  // La venta sólo vive con cerro = true.
  if (tocaLaVenta(cambio)) {
    if (m.cerro !== true) {
      m.monto_cierre_usd = null;
      m.fecha_cierre = null;
    } else {
      // Monto OPCIONAL: mover una card a Ganado siempre sincroniza el estado; antes,
      // sin monto, lanzaba error y la card quedaba en Ganado con estado != ganado.
      if (m.monto_cierre_usd != null && m.monto_cierre_usd <= 0) {
        throw new Error('monto_cierre_usd debe ser positivo');
      }
      if (!m.fecha_cierre) m.fecha_cierre = hoy;
    }
  }

  return m;
}
