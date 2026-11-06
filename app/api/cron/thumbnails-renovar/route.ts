// =============================================================================
// Cron: relee y poda la biblioteca de miniaturas de YouTube antes de que venza (semanal)
// =============================================================================
// vercel.json: `53 6 * * 0` (domingos 06:53 UTC — 23:53 del sábado en Tijuana, la hora más muerta).
//
// Por qué existe: sin la enmienda III.L de YouTube, lo que se guarda de su API (títulos, vistas) vence a los 30 días. La
// pantalla no muestra lo leído hace más (`vigente`, lib/thumbnails/explorar.ts) y la regla obliga a borrarlo. El documento lo
// dejaba como un paso a mano («cada mes: `leer` de nuevo y `podar --de-verdad`») y nadie lo corría nunca: la galería se vaciaba
// sola y el primero en enterarse era un cliente abriendo la pestaña.
//
// ⚠️ SEMANAL, NO MENSUAL, aunque el vencimiento sea de 30 días. Un cron mensual el día 1 deja 31 días entre enero y febrero:
//    lo leído el 1 de enero vence el 31 y la galería queda vacía un día antes de que el cron la salve. Y con una sola
//    oportunidad por vencimiento, cualquier corrida que falle (cuota, 403, deploy caído) la vacía igual. El porqué y el test
//    que lo fija: lib/thumbnails/renovar.ts y tests/thumbnails-renovar.test.ts.
//
// ⚠️ NO VA POR `correrPorWorkspace`: las tablas de la 0409 son GLOBALES (sin `workspace_id`, a propósito, como la biblioteca
//    de carruseles), así que hay UN trabajo y no uno por negocio. La clave de YouTube es la de la plataforma, nunca la de un
//    cliente: su cuota no paga la vidriera de todos. Mismo caso que /api/cron/spy-poda.
//
// ⚠️ NO DESCUBRE CANALES NUEVOS. Eso usa `search.list`, que tiene un balde de 100 llamadas por día para TODA la app (de ahí
//    salen también las de Competitors Spy). `descubrir` sigue siendo a mano desde la PC; releer va por el camino barato
//    (~3 unidades de las 10.000 diarias por canal, unas 240 por corrida con los 79 canales de hoy).

import type { NextRequest } from 'next/server';
import { checkCronAuth } from '@/lib/cron-auth';
import { renovarBiblioteca } from '@/lib/thumbnails/renovar';

export const dynamic = 'force-dynamic';
export const maxDuration = 300;

export async function GET(req: NextRequest) {
  const denied = checkCronAuth(req);
  if (denied) return denied;

  const r = await renovarBiblioteca();
  if (!r.ok) {
    console.warn('[thumbnails-renovar] no pude renovar la biblioteca:', r.error);
    return Response.json({ ok: false, error: r.error }, { status: 500 });
  }
  // `corto` = cortó por presupuesto o por cuota: no es un fallo (los que faltaron son los de lectura más vieja y van primero
  // la próxima), pero se devuelve para que se vea en el log si pasa todas las semanas.
  return Response.json({
    ok: true,
    canales: r.releido.canales,
    videos: r.releido.videos,
    corto: r.releido.corto,
    fallas: r.releido.fallas,
    podados: r.podado.borrados,
    vaciados: r.podado.vaciados,
  });
}
