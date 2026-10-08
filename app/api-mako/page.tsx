// =============================================================================
// /api-mako — la tab de la API de MaKo
// =============================================================================
// Pedido de Martín (08/10/2026): «que MaKo tenga una API propia, con todas las acciones bien
// documentadas y moduladas…». El mismo día: «Me gusta como hace la API GitHub, con su
// diseño, permisos, presentación, etc… Copialo todo, tal cual». Decisiones: tokens
// detallados que escriben directo (lo que gasta plata sigue pasando por una pantalla),
// permisos por área con vencimiento, rutas REST como alias, y que se vea igual a GitHub.
// La ve todo admin de workspace: aquí se acuñan credenciales.
//
// El registro NO viaja al navegador: aquí se arma el índice (datos.ts) y, si hay una
// página de documentación abierta, la página entera. Cada vista lee SOLO lo suyo.
//
// Onboarding: esta tab ES la herramienta, así que su onboarding es su estado vacío (la
// regla del 05/10): sin ningún token abre en «Tokens», con el botón de generar a la vista.
// =============================================================================

import { requireRolWs } from '@/lib/tab-access';
import { getWorkspace, getWorkspaceActual } from '@/lib/workspace';
import { APP_BASE_URL } from '@/lib/app-url';
import { listarTokens } from '@/lib/api-mako/tokens';
import { TOPE_CUERPO_BYTES, TOPE_POR_MINUTO_IP, TOPE_POR_MINUTO_WS, VERSION_API } from '@/lib/api-mako/version';
import { EmptyState, Pagina } from '@/app/_ui';
import { indiceDocs, paginaDocs, usoDe, vistaDeLaTab, type AreaDocs } from './datos';
import { ApiMako, type TabApi } from './ApiMako';
import { Docs } from './Docs';
import type { DatosArticulos } from './Articulos';
import { esArticulo } from './articulos-meta';
import { Tokens, type VistaTokens } from './Tokens';
import { Registro } from './Registro';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

type Params = { tab?: string; area?: string; recurso?: string; art?: string; v?: string; t?: string; accion?: string; token?: string };

const TABS: readonly TabApi[] = ['docs', 'tokens', 'registro'];

/** Una lectura sin parámetros obligatorios, para el ejemplo del inicio rápido. */
function ejemploDe(indice: AreaDocs[]): DatosArticulos['ejemplo'] {
  for (const a of indice) for (const r of a.recursos) for (const e of r.endpoints) {
    if (e.metodo === 'GET' && !e.ruta.includes('{')) return { metodo: e.metodo, ruta: e.ruta, titulo: e.titulo };
  }
  return null;
}

export default async function ApiMakoPage({ searchParams }: { searchParams: Promise<Params> }) {
  await requireRolWs([], { nav: 'api-mako' });
  const ws = await getWorkspaceActual();
  if (ws == null) {
    return <Pagina><EmptyState titulo="Entra a un cliente" detalle="La API es de cada negocio: elige uno para ver la suya." /></Pagina>;
  }

  // La vista se lee AQUÍ y no con useSearchParams: ese hook saltea el render del server y
  // la primera pintura sale vacía (molde: app/admin/ui/page.tsx).
  const sp = await searchParams;
  const [vista, tokens, workspace] = await Promise.all([
    vistaDeLaTab(ws),
    listarTokens(ws).catch((e) => {
      console.error(`[api-mako] no pude leer los tokens del ws ${ws}: ${e instanceof Error ? e.message : String(e)}`);
      return null;
    }),
    getWorkspace(ws).catch(() => null),
  ]);
  const indice = indiceDocs(vista);
  const cuantos = tokens ? tokens.tokens.length + (tokens.principal ? 1 : 0) : 0;
  const pideDocs = !!(sp.area || sp.recurso || sp.art);
  const tab: TabApi = TABS.includes(sp.tab as TabApi) ? (sp.tab as TabApi) : pideDocs ? 'docs' : tokens && !cuantos ? 'tokens' : 'docs';

  let contenido: React.ReactNode;
  if (tab === 'tokens') {
    const vistaTokens: VistaTokens = sp.t
      ? { v: 'token', id: sp.t, accion: sp.accion === 'editar' || sp.accion === 'regenerar' ? sp.accion : 'ver' }
      : { v: sp.v === 'nuevo' || sp.v === 'clasicos' ? sp.v : 'detallados' };
    contenido = <Tokens tokens={tokens} vista={vistaTokens} indice={indice} workspace={workspace?.nombre ?? `Workspace ${ws}`} />;
  } else if (tab === 'registro') {
    const uso = await usoDe(ws, sp.token?.slice(0, 40) || null);
    const nombres = Object.fromEntries((tokens?.tokens ?? []).map((t) => [t.id, t.nombre]));
    contenido = <Registro uso={uso} nombres={nombres} />;
  } else {
    const datos: DatosArticulos = {
      base: APP_BASE_URL.replace(/\/+$/, ''),
      version: VERSION_API,
      limites: { ws: TOPE_POR_MINUTO_WS, ip: TOPE_POR_MINUTO_IP },
      topeCuerpoKb: Math.round(TOPE_CUERPO_BYTES / 1024),
      indice,
      ejemplo: ejemploDe(indice),
    };
    const pagina = sp.area && sp.recurso ? paginaDocs(indice, sp.area, sp.recurso, datos.base) : null;
    contenido = <Docs datos={datos} pagina={pagina} area={sp.area ?? null} recurso={sp.recurso ?? null} art={esArticulo(sp.art) ? sp.art : null} />;
  }

  return (
    <Pagina ancho="completo" densidad="compacta" style={{ padding: 0 }}>
      <ApiMako tab={tab} tokens={cuantos}>{contenido}</ApiMako>
    </Pagina>
  );
}
