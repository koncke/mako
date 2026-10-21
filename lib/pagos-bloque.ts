// =============================================================================
// Los bloques de Pagos en el chat con MaKo (20/10/2026, «Ops Center = lo principal», la 2.27)
// =============================================================================
// Puro. Arma «A quién cobrar» (el bloque `cobranza` de lib/chat-bloques.ts) con las MISMAS piezas que la tab General y
// el teléfono: `armarCobranza` (el orden, la próxima cuota y las suscripciones, lib/datos-comercial.ts) y `cobroDeFila`
// (el renglón, app/m/dashboard/modelo.ts). Así la lista del chat no puede decir otra cosa que la de General.
// Y el estado de cuenta de un lead (`estado_cuenta`, la 2.28): sólo a quién mira y el comprobante del mensaje; lo
// demás lo lee al dibujarse la pieza de la tab Pagos.
//
// ⚠️ LO QUE SE GUARDA ES LA FOTO DEL MOMENTO. Al dibujarse, la lista se vuelve a leer (app/_chat/bloques/CobranzaHilo.tsx):
//    marcar una fila vieja reescribiría la fecha de un cobro que ya entró.

import { armarCobranza, type FilaCobro } from './datos-comercial';
import { fmtValor } from './graficos-agregar';
import { MAX_FILAS_COBRANZA, type BloqueCobranza, type BloqueEstadoCuenta } from './chat-bloques';
import type { ItemPorCobrar } from './suscripciones-por-cobrar';
import { cobroDeFila, type CobroM } from '@/app/m/dashboard/modelo';

/** El renglón de cada fila, el de General (el monto en dólares, como allá). Una fila sin nada que cobrar no va. */
export const cobrosDeFilas = (filas: readonly FilaCobro[]): CobroM[] =>
  filas.flatMap((f) => { const c = cobroDeFila(f, (n) => fmtValor(n, 'usd')); return c ? [c] : []; });

/** «A quién cobrar» para el chat: lo que lee `a_quien_cobrar` (`getPorCobrar`, cuotas y suscripciones), en filas. */
export function bloqueACobrar(
  items: readonly ItemPorCobrar[], hoy: string, tz: string, ventana: { desde: string; hasta: string } | null = null,
): BloqueCobranza {
  const filas = cobrosDeFilas(armarCobranza(items, hoy).filas);
  return { t: 'cobranza', filas: filas.slice(0, MAX_FILAS_COBRANZA), total: filas.length, tz, al: hoy, ...(ventana ? { ventana } : {}) };
}

/** Un archivo del mensaje de la persona (`AdjuntoVisible`, lib/chat-mako-bloques.ts). */
type Adjunto = { ref: string; nombre: string; tipo: 'image' | 'document' };

/** El comprobante que va en el bloque: el archivo y la ÚNICA cuota a la que va. */
export type ComprobanteDelBloque = NonNullable<BloqueEstadoCuenta['comprobante']>;

/** El estado de cuenta de un lead para el chat (la 2.28), con el comprobante que decidió `comprobanteDelPedido`. */
export function bloqueEstadoDeCuenta(lead: { id: number; nombre: string | null }, comprobante: ComprobanteDelBloque | null): BloqueEstadoCuenta {
  return {
    t: 'estado_cuenta', leadId: lead.id, nombre: (lead.nombre ?? '').trim() || `Lead ${lead.id}`,
    ...(comprobante ? { comprobante } : {}),
  };
}

/** Por qué el archivo del mensaje no quedó como comprobante de este lead (`null`: quedó, o no hay archivo). */
export type SinComprobante = 'varios' | 'no-es-suyo' | 'no-es-cobrar' | 'de-otro-lead';

/** De quién es el comprobante de cada mensaje: la lista de archivos del turno (`ctx.adjuntos`, una por turno) → el lead
 *  que lo tomó. Un turno que se re-arranca corre las lecturas otra vez con el mismo `ctx`: el mismo lead lo vuelve a tomar. */
const DUENO = new WeakMap<object, { leadId: number; nombre: string }>();

/**
 * ⚠️ EL COMPROBANTE DEL CHAT VA ATADO AL LEAD Y A LA CUOTA (21/10/2026, revisión adversarial, tres medios).
 * El único archivo del mensaje se pegaba a TODO estado de cuenta del turno («Juan pagó, acá el comprobante. ¿Y Pedro?»:
 * el recibo de Juan quedaba en la cuota de Pedro; un contrato quedaba como comprobante), volvía del historial y se subía
 * a la cuota SIGUIENTE con la fecha vieja, y se prometía aunque el botón no fuera cobrar una cuota. Ahora va sólo si:
 * - vino UN archivo (con dos o más no se adivina cuál es: se sube en el modal, como en la ficha);
 * - el modelo dice que es el comprobante de ESTE lead (`esSuyo`, el parámetro `comprobante` de `cobranza_lead`); si no
 *   se sabe de quién es, pregunta;
 * - lo que toca es COBRAR UNA CUOTA, y va atado a ésa (`pagoId`): cobrada, no se ofrece para otra;
 * - ningún otro lead del mismo mensaje lo tomó antes.
 */
export function comprobanteDelPedido(o: {
  adjuntos: readonly Adjunto[] | undefined;
  lead: { id: number; nombre: string | null };
  esSuyo: boolean;
  accion: { tipo: string; pagoId?: number } | null;
}): { comprobante: ComprobanteDelBloque | null; sin: SinComprobante | null; de?: string } {
  const lista = o.adjuntos ?? [];
  if (!lista.length) return { comprobante: null, sin: null };
  if (lista.length > 1) return { comprobante: null, sin: 'varios' };
  if (!o.esSuyo) return { comprobante: null, sin: 'no-es-suyo' };
  if (o.accion?.tipo !== 'cobrar-cuota' || !o.accion.pagoId) return { comprobante: null, sin: 'no-es-cobrar' };
  const dueno = DUENO.get(lista);
  if (dueno && dueno.leadId !== o.lead.id) return { comprobante: null, sin: 'de-otro-lead', de: dueno.nombre };
  DUENO.set(lista, { leadId: o.lead.id, nombre: (o.lead.nombre ?? '').trim() || `Lead ${o.lead.id}` });
  const a = lista[0];
  return { comprobante: { ref: a.ref, nombre: a.nombre, tipo: a.tipo, pagoId: o.accion.pagoId }, sin: null };
}

/** Lo que `cobranza_lead` le dice al modelo del estado de cuenta que se dibuja, según qué pasó con el archivo. */
export function notaEnPantalla(r: { comprobante: ComprobanteDelBloque | null; sin: SinComprobante | null; de?: string }): string {
  const base = 'En este chat el estado de cuenta YA SE DIBUJA debajo de tu respuesta, con el botón de lo que toca hacer: no lo copies. Di en una o dos líneas qué debe, qué pagó y qué toca.';
  if (r.comprobante) return `En este chat el estado de cuenta YA SE DIBUJA debajo de tu respuesta, y el comprobante que adjuntó la persona quedó para la cuota que toca cobrar: el botón de cobrarla lo lee (monto, fecha y hora) y deja la marca lista para revisar y guardar. NO propongas marcar_pago_cobrado: dile en una línea qué debe y que revise y guarde el cobro ahí.`;
  if (r.sin === 'no-es-suyo') return `${base} La persona adjuntó un archivo que NO quedó como comprobante de este lead (no pasaste comprobante: true). Si no está claro de quién es o si es un comprobante de pago, pregúntale antes de marcar nada.`;
  if (r.sin === 'de-otro-lead') return `${base} El archivo que adjuntó ya quedó como comprobante de ${r.de ?? 'otro lead'} en este mismo mensaje: un comprobante es de UN solo lead. Si también era de éste, pregúntale.`;
  return base;
}

/** El rótulo de una lista pedida por vencimiento, al lado del título («vencen del 20/10 al 26/10»). */
export function rotuloVentana(v: { desde: string; hasta: string } | undefined | null): string | null {
  if (!v) return null;
  const dm = (f: string) => `${f.slice(8, 10)}/${f.slice(5, 7)}`;
  return `vencen del ${dm(v.desde)} al ${dm(v.hasta)}`;
}
