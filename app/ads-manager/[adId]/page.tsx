// =============================================================================
// /ads-manager/<ad_id> — el link viejo a un anuncio
// =============================================================================
// Lo lleva a /anuncio/<ad_id> el layout de /ads-manager (app/ads-manager/layout.tsx), antes del loader. Esta página sólo
// se dibuja si el id no es un número (un link roto): dice dónde está ahora lo que buscaba.
// =============================================================================

import { Pagina } from '@/app/_ui/Pagina';
import { EmptyState } from '@/app/_ui/Estados';

export const dynamic = 'force-dynamic';

export default function AnuncioViejoPage() {
  return (
    <Pagina>
      <EmptyState titulo="Ese anuncio no existe" detalle="El Media Buyer reemplazó al Ads Manager. Los anuncios se abren desde sus decisiones."
        accion={{ label: 'Ir al Media Buyer', href: '/ads-manager' }} />
    </Pagina>
  );
}
