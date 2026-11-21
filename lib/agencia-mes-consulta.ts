// =============================================================================
// agencia-mes-consulta — lee lo que hace falta para contestar «¿cuánto hay que pagar para activar la cuenta de X?» (20/11/2026)
// =============================================================================
// Las reglas y el texto viven en lib/agencia-mes-consulta-reglas.ts (puro). Esto sólo lee: la mensualidad de la agencia
// (`mensualidadDeAgencia`, con lo que debe cada cuenta) y a dónde se paga (`leerDatosDePagoDirecto`, el ajuste de cobro de la plataforma).
// Lo llama el turno del grupo (lib/mako-doer-in.ts, `procesarDoer`) ANTES del modelo. null = sigue el turno de siempre: no era una pregunta
// por lo que se paga, la mensualidad no está prendida, no se pudo leer, o no nombra a ningún cliente de la agencia. Nunca tira.
// =============================================================================

import 'server-only';
import { pidePagoDeLaMensualidad, respuestaDePago } from './agencia-mes-consulta-reglas';
import { MEDIO_POR_DEFECTO } from './agencia-mes-reglas';

export async function respuestaDelPagoDeLaAgencia(ws: number, texto: string): Promise<string | null> {
  const pedido = pidePagoDeLaMensualidad(texto);
  if (!pedido) return null;
  try {
    const { mensualidadDeAgencia } = await import('./agencia-mes');
    const m = await mensualidadDeAgencia(ws);
    if (!m.ok || !m.config) return null;
    const { leerDatosDePagoDirecto } = await import('./pago-directo');
    const d = await leerDatosDePagoDirecto();
    return respuestaDePago({ pedido, texto, m, donde: { medio: m.config.medio || MEDIO_POR_DEFECTO, binancePayId: d.binancePayId, linkBinance: d.linkBinance } });
  } catch (e) {
    console.error(`[agencia-mes] ws${ws}: no pude contestar lo que se paga: ${e instanceof Error ? e.message : String(e)}`);
    return null;
  }
}
