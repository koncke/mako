// =============================================================================
// /anuncio/nuevo — «Usar en un anuncio»: una pieza de Create o del AI Avatar, armada como campaña y PROPUESTA
// =============================================================================
// Lo prometido a la agencia de Thiago (docs/promesas/2910-llamada-thiago.md, [30:17] y [31:25]). Llegan los editores (Video,
// Image, Copywriter) y el AI Avatar con la pieza en la dirección (lib/anuncio-desde-pieza.ts → rutaUsarEnAnuncio). La página
// la resuelve en el negocio de la sesión (/api/anuncio-desde-pieza → preparar) y la propone con `proponer_crear_campana`;
// lanzarla la confirma una persona en /mako/revisar. Es la estructura de «Nueva campaña» del Media Buyer
// (app/ads-manager/NuevaCampana.tsx, copiada del «Quick creation» de Meta), con la pieza ya puesta.
//
// Las mismas guardas que /ads-manager/nueva (la tab, el negocio elegido, el admin del negocio): lanzar anuncios es de quien
// tiene el Media Buyer.
// =============================================================================

import '@/app/ads-manager/mb-paleta.css';
import '@/app/ads-manager/mb.css';
import { requireRolWs } from '@/lib/tab-access';
import { adsSinNegocio, wsDeAdsManager } from '@/lib/ads-guard';
import { Pagina } from '@/app/_ui/Pagina';
import { EmptyState, PermissionState } from '@/app/_ui/Estados';
import { UsarEnAnuncio } from './UsarEnAnuncio';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

const CLAVES = ['origen', 'titulo', 'texto', 'archivo', 'media', 'ref', 'plan', 'toma'] as const;

export default async function AnuncioNuevoPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  await requireRolWs([], { nav: 'ads-manager' });
  if (await adsSinNegocio()) {
    return (
      <Pagina>
        <EmptyState titulo="Elige un negocio" detalle="Los anuncios salen de la cuenta de Meta de un negocio. Entra a uno desde el panel y vuelve aquí."
          accion={{ label: 'Ir al panel', href: '/admin' }} />
      </Pagina>
    );
  }
  const ws = await wsDeAdsManager();
  if (ws instanceof Response) return <Pagina><PermissionState motivo="rol" /></Pagina>;
  const sp = await searchParams;
  // Sólo las claves de la pieza, como texto: la página no decide nada con ellas (las vuelve a leer el servidor al preparar).
  const pieza: Record<string, string> = {};
  for (const k of CLAVES) {
    const v = sp[k];
    const s = Array.isArray(v) ? v[0] : v;
    if (typeof s === 'string' && s) pieza[k] = s.slice(0, 2400);
  }
  return (
    <Pagina ancho="completo" style={{ padding: 0 }}>
      <UsarEnAnuncio pieza={pieza} />
    </Pagina>
  );
}
