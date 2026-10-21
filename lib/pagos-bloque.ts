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

/**
 * El estado de cuenta de un lead para el chat (la 2.28). El comprobante es el archivo del MISMO mensaje, si vino UNO
 * solo: con dos o más no se adivina cuál es (la persona lo sube en el modal, como en la ficha).
 */
export function bloqueEstadoDeCuenta(lead: { id: number; nombre: string | null }, adjuntos: readonly Adjunto[] | undefined): BloqueEstadoCuenta {
  const uno = adjuntos?.length === 1 ? adjuntos[0] : null;
  return {
    t: 'estado_cuenta', leadId: lead.id, nombre: (lead.nombre ?? '').trim() || `Lead ${lead.id}`,
    ...(uno ? { comprobante: { ref: uno.ref, nombre: uno.nombre, tipo: uno.tipo } } : {}),
  };
}

/** El rótulo de una lista pedida por vencimiento, al lado del título («vencen del 20/10 al 26/10»). */
export function rotuloVentana(v: { desde: string; hasta: string } | undefined | null): string | null {
  if (!v) return null;
  const dm = (f: string) => `${f.slice(8, 10)}/${f.slice(5, 7)}`;
  return `vencen del ${dm(v.desde)} al ${dm(v.hasta)}`;
}
