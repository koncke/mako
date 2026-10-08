// =============================================================================
// /api-mako — la tab de la API de MaKo
// =============================================================================
// Pedido de Martín (08/10/2026): «que MaKo tenga una API propia, con todas las
// acciones bien documentadas y moduladas… y así nos podemos ahorrar muchos tokens…
// podemos configurar acciones en el chatbot y en otros lugares». La API ya existía
// (lib/api-mako, /api/v1); lo que faltaba era una pantalla para verla, darle
// credenciales a cada integración y saber qué se pidió. Decisiones del mismo día:
// tokens VARIOS y con nombre, y la tab la ve todo admin de workspace (menú de la
// foto, al lado de Integraciones). Closers y setters no: acá se acuñan credenciales.
//
// El registro NO viaja al navegador: acá se arma el índice (datos.ts) y el detalle
// de cada operación se pide al abrirla.
//
// Onboarding: esta tab ES la herramienta, así que su onboarding es su estado vacío
// (la regla del 05/10): sin tokens abre en «Tokens», con el formulario a la vista.
// =============================================================================

import { requireRolWs } from '@/lib/tab-access';
import { getWorkspaceActual } from '@/lib/workspace';
import { APP_BASE_URL } from '@/lib/app-url';
import { listarTokens } from '@/lib/api-mako/tokens';
import { EmptyState, Pagina } from '@/app/_ui';
import { indiceDe, usoDe, vistaDeLaTab } from './datos';
import { ApiMako, type TabApi } from './ApiMako';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

const TABS: readonly TabApi[] = ['operaciones', 'tokens', 'uso', 'como'];

export default async function ApiMakoPage({ searchParams }: { searchParams: Promise<{ tab?: string; op?: string }> }) {
  await requireRolWs([], { nav: 'api-mako' });
  const ws = await getWorkspaceActual();
  if (ws == null) {
    return <Pagina><EmptyState titulo="Entra a un cliente" detalle="La API es de cada negocio: elige uno para ver la suya." /></Pagina>;
  }

  // La vista se lee ACÁ y no con useSearchParams: ese hook saltea el render del
  // server y la primera pintura sale vacía (molde: app/admin/ui/page.tsx).
  const { tab, op } = await searchParams;
  const vista = await vistaDeLaTab(ws);
  const [tokens, uso] = await Promise.all([
    listarTokens(ws).catch((e) => {
      console.error(`[api-mako] no pude leer los tokens del ws ${ws}: ${e instanceof Error ? e.message : String(e)}`);
      return null;
    }),
    usoDe(ws),
  ]);
  const { areas, operaciones } = indiceDe(vista);

  const sinTokens = !!tokens && !tokens.principal && !tokens.tokens.length;
  const tabInicial: TabApi = TABS.includes(tab as TabApi) ? (tab as TabApi) : op ? 'operaciones' : sinTokens ? 'tokens' : 'operaciones';

  return (
    <ApiMako
      tabInicial={tabInicial}
      opInicial={op}
      areas={areas}
      operaciones={operaciones}
      tokens={tokens}
      uso={uso}
      base={APP_BASE_URL}
    />
  );
}
