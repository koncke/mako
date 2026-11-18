// =============================================================================
// pruebas/medidores-landing-reglas — lo PURO de medir una prueba A/B de una landing (O18, L2; 18/11/2026)
// =============================================================================
// docs/diseno-pruebas-ab.md 2.6 y la crítica B (8 y 9). La unidad es el `visitor_id`. Lo que decide, con test
// (tests/pruebas-landing.test.ts):
//   · EL DENOMINADOR son los asignados que VIERON la página: una visita del Pixel (`landing_visits`, sin la marca del
//     probador) de ESA landing desde que se asignó. El servidor asigna antes de que corra el Pixel, así que un bot o la
//     vista previa de WhatsApp reciben rama y nunca la ven: van `cuenta: false` (no son un «no»).
//   · UN ÉXITO es el PRIMER evento de la métrica desde la asignación (con el minuto de tolerancia de `TOLERANCIA_ASIGNACION_MS`:
//     la asignación se escribe en el pedido y el Pixel puede adelantarse) y hasta el fin de ayer. Los eventos no se
//     reescriben, así que no hace falta congelar nada (a diferencia de «agendó»).
//   · `clic_conversion` cuenta SÓLO un clic a uno de los destinos que la prueba congeló al crearse (crítica 8): el mismo
//     destino, o el mismo con su query, su ancla o una subruta (un checkout prellenado llega con parámetros).
// =============================================================================

import { unidadValida } from './asignar';
import { TOLERANCIA_ASIGNACION_MS, type Asignacion, type Resultado } from './metricas';

/** Algo que hizo una unidad, y cuándo. */
export type EventoUnidad = { unidad: string; at: string };

/** ¿Este clic (`vsl_events.detalle` de un 'click') va a uno de los destinos congelados? */
export function destinoCuenta(detalle: string | null | undefined, destinos: readonly string[]): boolean {
  const d = String(detalle ?? '').trim();
  if (!d) return false;
  return destinos.some((raw) => {
    const x = String(raw ?? '').trim();
    if (!x) return false;
    if (d === x) return true;
    if (!d.startsWith(x)) return false;
    // «https://pago.com/x» no cuenta «https://pago.com/xyz»: lo que sigue tiene que empezar otra parte de la dirección.
    return x.endsWith('/') || '?#/'.includes(d.charAt(x.length));
  });
}

/** El resultado de CADA asignación de unidad válida (`conteosPorRama` falla si falta una madura). */
export function resultadosDeLanding(asignaciones: readonly Asignacion[], visitas: readonly EventoUnidad[], logros: readonly EventoUnidad[], hasta: string): Map<string, Resultado> {
  const tope = Date.parse(hasta);
  const porUnidad = (lista: readonly EventoUnidad[]) => {
    const m = new Map<string, number[]>();
    for (const e of lista) {
      const t = Date.parse(e.at);
      if (!Number.isFinite(t) || (Number.isFinite(tope) && t > tope)) continue;
      const v = m.get(e.unidad);
      if (v) v.push(t); else m.set(e.unidad, [t]);
    }
    return m;
  };
  const vis = porUnidad(visitas);
  const log = porUnidad(logros);
  const out = new Map<string, Resultado>();
  for (const a of asignaciones) {
    if (!unidadValida(a.unidad)) continue;
    const desde = Date.parse(a.asignadaAt) - TOLERANCIA_ASIGNACION_MS;
    const vio = (vis.get(a.unidad) ?? []).some((t) => t >= desde);
    if (!vio) { out.set(a.unidad, { logro: false, cuenta: false }); continue; }
    const primero = (log.get(a.unidad) ?? []).filter((t) => t >= desde).sort((x, y) => x - y)[0];
    out.set(a.unidad, primero === undefined ? { logro: false } : { logro: true, at: new Date(primero).toISOString() });
  }
  return out;
}
