// =============================================================================
// conversacion-resumen — el resumidor de las conversaciones de MaKo, fuera del turno (12/11/2026; las reglas: lib/conversacion-resumen-reglas.ts)
// =============================================================================
// Lo que quedó afuera del tope de un chat (`porResumir` de `conversacionDelTurno`, lib/conversacion.ts) se resume con un modelo
// barato y queda en `KEY_RESUMEN(clave)`. Corre en `after()`: el turno nunca lo espera. Con candado por conversación (dos turnos
// seguidos no pagan dos resúmenes) y con compare-and-set al guardar (si otro lo actualizó, éste pierde y no lo pisa).
// QUIÉN PAGA: el que llama pasa `pedir`, con la IA de SU chat. La app, con la del turno (`mako-doer`: en el espacio de MaKo el
// crédito, en un negocio su IA); Offer, con su cascada (las keys del negocio y la red gratis: Offer nunca paga). Un resumen que el
// validador descarta (perdió un monto o un nombre) no se guarda: el turno sigue con lo de antes y se vuelve a intentar.
// =============================================================================

import 'server-only';
import { after } from 'next/server';
import { borrarSettingSi, cambiarSettingSi, getSetting } from './settings';
import { runWithWorkspace } from './workspace';
import { tzDeWorkspace, TZ_DEFAULT } from './timezone';
import type { EntradaDelHilo } from './conversacion-reglas';
import {
  candadoVencido, datosQueQuedan, guardarResumen, KEY_RESUMEN, leerResumen, parseResumen, promptDelResumen, tocaResumir, tramoParaResumir, validarResumen,
} from './conversacion-resumen-reglas';

/** El candado de una conversación mientras se resume. */
export const KEY_CANDADO_RESUMEN = (clave: string): string => `mako.conversacion.resumiendo.${clave}`;

/** Lo que pide el resumen al modelo de cada chat: el texto crudo que contestó, o null. */
export type PedirResumen = (p: { system: string; user: string; motivo: string }) => Promise<string | null>;

export type ResultadoDelResumen = 'hecho' | 'no-toca' | 'ocupado' | 'sin-respuesta' | 'descartado' | 'perdio';

async function tomarCandado(clave: string, marca: string, ahoraMs: number): Promise<boolean> {
  const k = KEY_CANDADO_RESUMEN(clave);
  if (await cambiarSettingSi(k, null, marca)) return true;
  const hay = await getSetting(k);
  // Sin fila (se soltó entre las dos lecturas): otro terminó recién; el próximo turno vuelve a mirar.
  if (hay == null || !candadoVencido(hay, ahoraMs)) return false;
  return cambiarSettingSi(k, hay, marca);
}

/**
 * Resume lo que toca y lo guarda. En el workspace en curso (quien llama lo envuelve: `resumirDespues`). Tira sólo si la base tira.
 */
export async function resumirConversacion(p: {
  clave: string; porResumir: readonly EntradaDelHilo[]; pedir: PedirResumen; tz?: string; ahoraMs?: number;
}): Promise<{ r: ResultadoDelResumen; razon?: string }> {
  if (!tocaResumir(p.porResumir)) return { r: 'no-toca' };
  const ahora = p.ahoraMs ?? Date.now();
  const marca = JSON.stringify({ at: ahora, n: Math.random().toString(36).slice(2, 10) });
  if (!(await tomarCandado(p.clave, marca, ahora))) return { r: 'ocupado' };
  try {
    // Releído con el candado: otra corrida pudo cubrir una parte.
    const crudo = await getSetting(KEY_RESUMEN(p.clave));
    const previo = leerResumen(crudo);
    const tramo = tramoParaResumir(p.porResumir, previo);
    if (!tocaResumir(tramo)) return { r: 'no-toca' };
    const datos = datosQueQuedan(tramo, previo?.texto ?? null);
    const pedido = promptDelResumen({ previo: previo?.texto ?? null, tramo, datos, tz: p.tz });
    const raw = await p.pedir({ ...pedido, motivo: `MaKo: resumir lo viejo de la conversación (${tramo.length} mensajes)` })
      .catch((e: unknown) => { console.warn(`[conversacion-resumen] ${p.clave}: el modelo no contestó: ${e instanceof Error ? e.message.slice(0, 200) : String(e)}`); return null; });
    if (!raw) return { r: 'sin-respuesta' };
    const v = validarResumen(parseResumen(raw), datos);
    if (!v.ok) return { r: 'descartado', razon: v.razon };
    const ultimo = tramo[tramo.length - 1];
    const nuevo = guardarResumen({ v: 1, texto: v.texto, hastaAt: ultimo.at, hastaId: ultimo.id ?? null, at: ahora });
    // Compare-and-set contra lo que se leyó: si «no pude leer» dio null y la fila existe, no se pisa (el upsert sólo inserta).
    return { r: (await cambiarSettingSi(KEY_RESUMEN(p.clave), crudo, nuevo)) ? 'hecho' : 'perdio' };
  } finally {
    await borrarSettingSi(KEY_CANDADO_RESUMEN(p.clave), marca).catch(() => false);
  }
}

/**
 * Si toca, resume DESPUÉS de contestar (`after()`; fuera de un pedido, en el momento y sin esperarlo). Devuelve si lo dejó andando.
 * Nunca tira: un resumen que no se pudo hacer se vuelve a intentar en el turno siguiente.
 */
export function resumirDespues(p: { ws: number; clave: string; porResumir: readonly EntradaDelHilo[]; pedir: PedirResumen }): boolean {
  if (!tocaResumir(p.porResumir)) return false;
  const trabajo = () => runWithWorkspace(p.ws, async () => {
    const tz = await tzDeWorkspace(p.ws).catch(() => TZ_DEFAULT);
    const { r, razon } = await resumirConversacion({ clave: p.clave, porResumir: p.porResumir, pedir: p.pedir, tz });
    if (r !== 'hecho' && r !== 'no-toca' && r !== 'ocupado') console.warn(`[conversacion-resumen] ws=${p.ws} ${p.clave}: ${r}${razon ? ` (${razon})` : ''}`);
  }).catch((e: unknown) => console.error(`[conversacion-resumen] ws=${p.ws} ${p.clave}:`, e instanceof Error ? e.message : String(e)));
  try { after(trabajo); } catch { void trabajo(); }
  return true;
}
