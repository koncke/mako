// =============================================================================
// Los números de la barra inferior de /m — UNA fuente por destino
// =============================================================================
// El layout de /m los pide una vez por render (y se vuelven a pedir con cada
// `router.refresh()`: el pull-to-refresh y la vuelta al frente pasados 60 s), y
// los pinta arriba del ícono de cada destino.
//
// CÓMO SE ENCHUFA UNA FUENTE: una línea en `FUENTES`, con una función server que
// devuelve cuántas cosas BLOQUEAN en ese destino. Ejemplo (el que viene):
//
//   import { contarParaDecidir } from '@/lib/inbox-movil';
//   const FUENTES = {
//     inbox: async (ctx) => (await contarParaDecidir({ rol: ctx.rol, capa: ctx.capa })).total,
//   };
//
// (`contarParaDecidir` devuelve `{ total, porTipo }`, y `total: null` cuando alguna
// bandeja no se pudo leer: eso es justo el «no se dibuja nada» de abajo.)
//
// Reglas, y las tres son a propósito:
//   · cuenta SÓLO lo que bloquea (aprobaciones, decisiones): «si todo tiene badge,
//     nada tiene badge» (app/_ui/LEEME.md);
//   · `null` = no se pudo leer → no se dibuja nada. Un 0 inventado o un número
//     viejo mienten igual de convincentes que uno bueno;
//   · una fuente que tira NO tumba la barra: se registra y ese destino queda sin
//     número.
// =============================================================================

import 'server-only';
import type { DestinoMovil, RolMovil } from '@/lib/movil-rutas';
import type { CapaId } from '@/lib/capas';
import { contarParaDecidir } from '@/lib/inbox-movil';

export type ContextoBadges = { rol: RolMovil; capa: CapaId; ws: number | null };
export type FuenteBadge = (ctx: ContextoBadges) => Promise<number | null>;

const FUENTES: Partial<Record<DestinoMovil, FuenteBadge>> = {
  // `total: null` (alguna bandeja no se pudo leer) = sin número, nunca un 0 inventado.
  inbox: async (ctx) => (await contarParaDecidir({ rol: ctx.rol, capa: ctx.capa })).total,
};

/** Los números de los destinos VISIBLES (los otros ni se consultan). */
export async function contarBadges(
  ctx: ContextoBadges,
  visibles: DestinoMovil[],
): Promise<Partial<Record<DestinoMovil, number>>> {
  const out: Partial<Record<DestinoMovil, number>> = {};
  await Promise.all(visibles.map(async (d) => {
    const fuente = FUENTES[d];
    if (!fuente) return;
    try {
      const n = await fuente(ctx);
      if (typeof n === 'number' && Number.isFinite(n) && n > 0) out[d] = Math.floor(n);
    } catch (e) {
      console.error(`[m/badges] la fuente de «${d}» falló; queda sin número:`, e);
    }
  }));
  return out;
}
