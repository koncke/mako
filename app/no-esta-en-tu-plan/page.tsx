// =============================================================================
// /no-esta-en-tu-plan — el cartel de una tab que el plan del negocio no incluye (17/10/2026)
// =============================================================================
// Hasta este día, entrar a una tab que el plan no compró era un REDIRECT MUDO a la casa del plan, que se leía como
// «la app está rota» (docs/hallazgos-planes-y-cobro.md, «`requireCapa` no puede renderizar nada»). El diagnóstico de
// entonces decía que el cartel eran 56 call-sites: no hace falta tocar ninguno. `requireCapa` (lib/tab-access.ts) es
// el ÚNICO lugar que decide «no está en tu plan», y ahora redirige ACÁ con la tab, en vez de a la casa. El componente
// que lo dice existía desde agosto sin un solo emisor: `PermissionState` con `motivo="plan"` (app/_ui/Estados.tsx).

import { requireSesion } from '@/lib/tab-access';
import { getWorkspaceActual, rutaConWs } from '@/lib/workspace';
import { TODOS_LOS_ITEMS, USER_NAV } from '@/app/_components/nav';
import { PermissionState } from '@/app/_ui/Estados';
import { esClienteDeAgencia } from '@/lib/agencia';
import { ROTULO_PASAR_A_PRO } from '@/lib/plan-esencial-reglas';
import { RUTA_CAMBIAR_PLAN } from '@/lib/topes-plan';
import { headers } from 'next/headers';
import { esTelefono } from '@/lib/telefono';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

/** El nombre de la tab para el cartel («el Ads Manager» no: el rótulo de la barra). Sin uno conocido, genérico. */
function nombreDeTab(key: string | undefined): string {
  if (!key) return 'esta sección';
  const it = [...TODOS_LOS_ITEMS, ...USER_NAV].flatMap((i) => [i, ...(i.secciones ?? [])]).find((i) => i.key === key);
  return it ? it.label : 'esta sección';
}

export default async function NoEstaEnTuPlanPage({ searchParams }: { searchParams: Promise<{ tab?: string | string[]; pro?: string | string[] }> }) {
  await requireSesion();
  const q = await searchParams;
  const tab = q.tab;
  // `pro=1` (23/10/2026): la tab es de MaKo Pro y el negocio paga el Esencial (lib/tab-access.ts → requireCapa).
  const pro = q.pro === '1';
  const key = typeof tab === 'string' ? tab.slice(0, 60) : undefined;
  // «Ir al inicio» va al REPARTIDOR, como el login (21/10/2026): en la computadora, el Ops Center del negocio, que está en
  // todos los planes (lib/ops-center-ruta.ts → casaEnLaComputadora). Iba a la casa del plan (/crm o /plan).
  const [inicio, plan] = await Promise.all([rutaConWs('/inicio'), rutaConWs(RUTA_CAMBIAR_PLAN)]);
  // El cliente de una agencia (29/10/2026): «Ver mi plan», no «Pasar a Pro» (su plan lo cambia su agencia; «Tu plan» lo dice).
  const ws = pro ? await getWorkspaceActual() : null;
  // ⚠️ `!== false` (P15, 30/10/2026): con el «no sé» de `esClienteDeAgencia` va «Ver mi plan», no «Pasar a Pro».
  const deAgencia = (await esClienteDeAgencia(ws)) !== false;
  // El teléfono no vende (T5, docs/tiendas-play-appstore.md): «Ver mi plan», y su pantalla no tiene cómo comprar.
  const telefono = esTelefono((await headers()).get('user-agent'));
  return (
    <main style={{ flex: 1, minWidth: 0, padding: '34px 16px 60px', display: 'grid', placeItems: 'start center' }}>
      <div style={{ width: '100%', maxWidth: 520 }}>
        <PermissionState motivo="plan" que={nombreDeTab(key)}
          accion={{ label: pro && !deAgencia && !telefono ? ROTULO_PASAR_A_PRO : 'Ver mi plan', href: plan }} secundaria={{ label: 'Ir al inicio', href: inicio }} />
      </div>
    </main>
  );
}
