// =============================================================================
// vigia-grupos-estado — la marca del vigía y el título de su ticket (puro)
// =============================================================================
// Lo saca de `app/api/cron/vigia-grupos/route.ts` por dos razones, y las dos son reglas de
// la casa: un `route.ts` sólo exporta sus handlers y su config (lo demás se lo discute el
// validador de rutas de Next), y una condición que decide algo vive en un módulo SIN
// `server-only` para que un test la pueda importar.
//
// PURO: lo usan la ruta y tests/vigia-grupos-estado.test.ts.
// =============================================================================

import { ROTULO_INCIDENTE, type Incidente } from './vigia-mako-grupos';

/** Lo que el vigía recuerda entre vueltas. Antes vivía en `~/.claude/vigia-mako-grupos.json`. */
export type EstadoVigia = { marca: string; vistos: string[] };

/** La primera vuelta (sin marca guardada) mira la última hora, como el script original. */
export const VENTANA_INICIAL_MS = 60 * 60_000;

/** Lo ya contado que se recuerda. El `ref` del ticket es la garantía dura; esto evita el trabajo. */
export const TOPE_VISTOS = 2000;

/**
 * Lo guardado, saneado.
 *
 * ⚠️ `null` (no hay setting) y un JSON ROTO son LO MISMO acá —la primera vuelta— y eso es a
 * propósito: las dos cosas significan «no sé desde dónde mirar, mirá la última hora». Lo que
 * NO entra por esta puerta es «no pude leer»: un error de la base lo tira `getSettingEstricto`
 * y la ruta corta con 503 sin mover la marca, porque avanzarla pierde los incidentes de esa
 * ventana para siempre. Son tres respuestas distintas y sólo dos comparten camino.
 */
export function leerEstado(crudo: string | null, ahora: number): EstadoVigia {
  const vacio: EstadoVigia = { marca: new Date(ahora - VENTANA_INICIAL_MS).toISOString(), vistos: [] };
  if (!crudo) return vacio;
  try {
    const o = JSON.parse(crudo) as Partial<EstadoVigia>;
    const marca = typeof o.marca === 'string' && Number.isFinite(Date.parse(o.marca)) ? o.marca : vacio.marca;
    const vistos = Array.isArray(o.vistos) ? o.vistos.filter((x): x is string => typeof x === 'string') : [];
    return { marca, vistos };
  } catch {
    return vacio;
  }
}

/**
 * El título que lee una PERSONA en la Ticketera: el rótulo del tipo y el NOMBRE del negocio.
 * Nunca el `ws13` — un identificador interno en un título es un glosario que quien lo abre no
 * tiene (AGENTS.md: «el nombre interno de una cosa no es el nombre de la cosa»). El detalle, el
 * grupo y el ws van en la descripción y en el contexto del ticket.
 */
export function tituloDeTicket(i: Incidente, nombreWs: (ws: number) => string): string {
  const pasó = i.tipos.map((t) => ROTULO_INCIDENTE[t]).filter(Boolean).join(' · ') || 'algo para mirar';
  const dónde = i.ws > 0 ? ` — ${nombreWs(i.ws)}` : '';
  return `MaKo en WhatsApp: ${pasó}${dónde}`.slice(0, 140);
}

/**
 * Qué se recuerda al cerrar la vuelta: SÓLO lo que de verdad quedó asentado —lo que abrió su
 * ticket, y lo de `error-app`, que ya lo tenía por `lib/errores-app.ts`—. Un incidente cuyo
 * ticket falló NO entra: así la próxima vuelta lo vuelve a intentar, y el `ref` evita el duplicado.
 */
export function vistosTrasLaVuelta(previos: readonly string[], nuevos: readonly Incidente[], conTicket: readonly string[]): string[] {
  const asentados = new Set([...conTicket, ...nuevos.filter((i) => i.tipos.includes('error-app')).map((i) => i.clave)]);
  return [...previos, ...nuevos.filter((i) => asentados.has(i.clave)).map((i) => i.clave)].slice(-TOPE_VISTOS);
}
