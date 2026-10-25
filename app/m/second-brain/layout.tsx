// =============================================================================
// /m/second-brain — lo que REDIRIGE va acá, ANTES del loader (25/10/2026, React #310)
// =============================================================================
// El caso de los tickets #7 y #9 (docs/hallazgos-infra.md): `./loading.tsx` envuelve al chat Y al Mapa, y un `redirect()` de la
// página va en el stream (200 + meta refresh, no 307), en carrera con la hidratación. La página redirige en una carga directa:
// el super admin a su Centro (la app del teléfono ENTRA por acá: `ENTRADA_MOVIL`) y un link con `?area=` o `?panel=mapa` al Mapa.
// Este layout queda AFUERA del loader y decide lo mismo antes (307), con la ruta y la query que recibe la página (el proxy sirve
// /second-brain con /m/second-brain: `pedidoMovilActual`). Las condiciones y los destinos son LOS DE LA PÁGINA, copiados: un
// test exige que estén iguales en los dos (tests/redirige-antes-del-loader.test.ts). La página conserva los suyos para cuando se
// llega navegando.
// =============================================================================

import type { ReactNode } from 'react';
import { redirect } from 'next/navigation';
import { requireMovil } from '@/lib/movil-guard';
import { esAdminDeTab } from '@/lib/puerta-admin-tab';
import { rutaConWs } from '@/lib/workspace';
import { RUTA_CENTRO_M, RUTA_OPS_CENTER_M } from '@/lib/movil-rutas';
import { pedidoMovilActual } from '@/lib/pedido-actual';

const uno = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);

export default async function SecondBrainMLayout({ children }: { children: ReactNode }) {
  const pedido = await pedidoMovilActual();
  if (pedido?.ruta === RUTA_OPS_CENTER_M) {
    const ctx = await requireMovil({ navKey: 'mako' });
    const veMapa = await esAdminDeTab('second-brain');
    const sp = pedido.query;
    if (veMapa && (uno(sp.panel) === 'mapa' || uno(sp.area))) {
      const q = new URLSearchParams();
      for (const k of ['area', 'vista'] as const) { const v = uno(sp[k]); if (v) q.set(k, v); }
      redirect(await rutaConWs(`/m/second-brain/mapa${q.size ? `?${q}` : ''}`));
    }
    if (ctx.sesion.rol === 'admin' && !ctx.impersonando) redirect(await rutaConWs(RUTA_CENTRO_M));
  }
  return children;
}
