// =============================================================================
// landing-gracias-reglas — quien llega a la página de GRACIAS pasa a Ganado (puro)
// =============================================================================
// Pedido de Martín (07/10/2026, por la sesión de Customer Success): «automatice mediante el
// pixel de MaKo que si alguien cae en una TKY Page, se pueda automatizar pasar al lead a Ganado
// directamente, así por ejemplo, si alguien tiene compra carrito o lo que sea, y cae en esa TKY
// Page, se pase automático a ganado».
//
// Acá están las reglas, sin base, para que un test las EJECUTE
// (tests/landing-gracias.test.ts). La lectura y la escritura viven en lib/landing-gracias.ts.
// =============================================================================

import type { ProductoDelLead } from './lead-funnel-reglas';
import type { LandingConfig } from './landing-config';
import { normalizarUrl } from './landing-paginas';

const sinParametros = (u: string): string => {
  const i = u.indexOf('?');
  return i < 0 ? u : u.slice(0, i);
};

/**
 * La página de gracias que es esta visita, o null.
 *
 * ⚠️ SE COMPARA POR LA RUTA, SIN LOS PARÁMETROS. `normalizarUrl` saca los de medición (UTM,
 * click-ids) y deja el resto, que para una página cualquiera está bien: `?plan=pro` puede ser otra
 * página. Para la de gracias no: la plataforma de pago redirige con SU orden (`?transaction=…`,
 * `?order_id=…`), distinta en cada compra, así que comparando la URL entera no coincidiría NUNCA
 * con la que se guardó. Medido sobre el código el 08/10/2026 (lo señaló el relevo de Customer
 * Success), con la función ya desplegada y apagada para todos.
 */
export function paginaDeGracias(configs: readonly LandingConfig[], url: string | null | undefined): LandingConfig | null {
  const u = url ? normalizarUrl(url) : null;
  if (!u) return null;
  const ruta = sinParametros(u);
  return configs.find((c) => c.gracias === true && sinParametros(c.url) === ruta) ?? null;
}

/** Un lead candidato: los que tienen el `visitor_id` de la visita. */
export type CandidatoGracias = { id: number | string };

/** Por qué una visita a la página de gracias NO movió a nadie. */
export type PorQueNoGana = 'sin_lead' | 'varios_leads';

/**
 * A quién es la visita. Se piden DOS filas a propósito: alcanza para saber si hay más de una.
 *
 * ⚠️ SIN LEAD NO SE CREA UNO. Quien llega a la página de gracias sin haber dejado sus datos
 * antes (un link compartido, la pestaña abierta en otro navegador) no tiene ficha, y crearle una
 * «ganada» sin nombre ni email inventaría una venta que no se puede atribuir a nadie.
 *
 * ⚠️ CON DOS LEADS NO SE ELIGE. El `visitor_id` es la cookie del NAVEGADOR, no de la persona:
 * dos opt-ins desde la misma computadora (una pareja, una prueba del dueño) quedan con el mismo.
 * Darle la venta al más nuevo sería adivinar, y lo que se adivina acá es a quién se le manda el
 * curso.
 */
export function quienLlegoALaGracias(filas: readonly CandidatoGracias[]): { leadId: number } | { motivo: PorQueNoGana } {
  const ids = [...new Set(filas.map((f) => Number(f.id)).filter((n) => Number.isSafeInteger(n) && n > 0))];
  if (!ids.length) return { motivo: 'sin_lead' };
  if (ids.length > 1) return { motivo: 'varios_leads' };
  return { leadId: ids[0] };
}

/** Qué hacer en UN producto destino. */
export type PasoGracias =
  | { tipo: 'casa'; funnelId: number }      // es su casa: setPipelineStage (toca estado_lead)
  | { tipo: 'fila'; funnelId: number }      // ya está agregado: mover su fila
  | { tipo: 'agregar'; funnelId: number };  // no está: agregarlo y moverlo

/**
 * Los pasos para dejarlo Ganado en los productos de la página. Lo que YA está ganado no se toca.
 *
 * ⚠️ LA CASA SE MIRA POR `estado_lead`, NO POR LA COLUMNA. Es el desenlace canónico —lo que
 * cuentan Revenue y Customer Success—, y un lead ganado arrastrado a otra columna sigue
 * contándose como venta: moverlo de nuevo dispararía otra vez todo lo que cuelga de ganar.
 * Las filas no tienen `estado_lead`: su etapa ES su estado.
 *
 * ⚠️ SON TODOS LOS PRODUCTOS DE LA PÁGINA, igual que el opt-in («el lead entra a TODOS»,
 * lib/landing-config.ts): la página dice qué vende, y la regla de a cuáles entra no puede ser
 * una al dejar los datos y otra al pagar.
 */
export function pasosDeGracias(p: {
  destinos: readonly number[];
  productos: readonly ProductoDelLead[];
  casaGanada: boolean;
  ganado: string;
}): PasoGracias[] {
  const out: PasoGracias[] = [];
  for (const funnelId of [...new Set(p.destinos)]) {
    const ya = p.productos.find((x) => x.funnelId === funnelId);
    if (!ya) { out.push({ tipo: 'agregar', funnelId }); continue; }
    if (ya.esCasa) { if (!p.casaGanada) out.push({ tipo: 'casa', funnelId }); continue; }
    if (ya.etapa !== p.ganado) out.push({ tipo: 'fila', funnelId });
  }
  return out;
}

/** Una visita que no movió a nadie, para que la pantalla pueda decir que pasó. Sin datos de la persona. */
export type RechazoGracias = { at: string; url: string; motivo: PorQueNoGana };

export const RECHAZOS_GRACIAS_KEY = 'landing.gracias_rechazos';
const MAX_RECHAZOS = 20;

export function parsearRechazos(crudo: string | null | undefined): RechazoGracias[] {
  if (!crudo?.trim()) return [];
  let lista: unknown;
  try { lista = JSON.parse(crudo); } catch { return []; }
  const out: RechazoGracias[] = [];
  for (const x of Array.isArray(lista) ? lista : []) {
    const r = x as Record<string, unknown>;
    if (typeof r?.at !== 'string' || typeof r.url !== 'string') continue;
    if (r.motivo !== 'sin_lead' && r.motivo !== 'varios_leads') continue;
    out.push({ at: r.at, url: r.url, motivo: r.motivo });
  }
  return out.slice(0, MAX_RECHAZOS);
}

/**
 * Suma un rechazo arriba de todo, con tope.
 *
 * ⚠️ UNA VISITA SE RECARGA. La misma persona que refresca la página de gracias manda un pageview
 * por recarga, y contarlos como diez visitas sin ficha sería un número que miente. El mismo
 * motivo en la misma página dentro de un minuto es la MISMA visita: no se suma.
 */
export function conRechazo(actuales: readonly RechazoGracias[], nuevo: RechazoGracias): RechazoGracias[] {
  const previo = actuales[0];
  if (previo && previo.url === nuevo.url && previo.motivo === nuevo.motivo
    && Math.abs(Date.parse(nuevo.at) - Date.parse(previo.at)) < 60_000) return [...actuales];
  return [nuevo, ...actuales].slice(0, MAX_RECHAZOS);
}

/** Los rechazos de UNA página, para la pantalla. */
export const rechazosDe = (lista: readonly RechazoGracias[], url: string): RechazoGracias[] =>
  lista.filter((r) => r.url === url);
