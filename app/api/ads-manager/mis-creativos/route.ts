// =============================================================================
// /api/ads-manager/mis-creativos — los videos que MaKo ya generó (tarea #797)
// =============================================================================
// GET → { ok, montados: CreativoMako[], tomas: CreativoMako[] }
//   Lo que el modal del anuncio ofrece además de «Subir creativo»: los anuncios
//   montados y las tomas sueltas que viven en el bucket propio. La lista trae la url
//   para la VISTA PREVIA; para usar uno, el navegador manda sólo su `ref` a
//   creative-upload y el server lo vuelve a resolver (lib/creativo-mako.ts).
//
// ⚠️ El workspace se FIJA con runWithWorkspace(wsDeAdsManager()): es el mismo que
// después usa cred() para escribir en Meta. Sin eso, un admin de agencia sin
// workspace leía con el id imposible -1 (lista vacía) y subía al ws1.
//
// ⚠️ «No pude leer» es un 500 con su mensaje, nunca `[]`: la pantalla diría «todavía
// no hay videos» sobre un workspace que los tiene.
// =============================================================================

import { guardAdsWs, wsDeAdsManager } from '@/lib/ads-guard';
import { runWithWorkspace } from '@/lib/workspace';
import { montadosDelWorkspace, tomasDelWorkspace } from '@/lib/creativo-mako-fuentes';

export const dynamic = 'force-dynamic';

export async function GET() {
  const no = await guardAdsWs(); if (no) return no;
  const ws = await wsDeAdsManager();
  if (ws instanceof Response) return ws;
  return runWithWorkspace(ws, async () => {
    try {
      const [montados, tomas] = await Promise.all([montadosDelWorkspace(), tomasDelWorkspace()]);
      return Response.json({ ok: true, montados, tomas });
    } catch (e) {
      console.error('[ads-manager:mis-creativos] no se pudo leer', e instanceof Error ? e.message : e);
      return Response.json({ ok: false, error: 'No pude leer tus videos de MaKo. Vuelve a intentar.' }, { status: 500 });
    }
  });
}
