// =============================================================================
// /integraciones/zernio-vuelta — adonde termina la VENTANA del login de Zernio
// =============================================================================
// Es el `redirect_url` del login de una red (Facebook, Instagram, anuncios de Meta) cuando se abrió en una ventana emergente
// (lib/zernio-conectar.ts, modo `ventana`). Zernio vuelve acá con `connected=<red>&accountId&username`, o con `error=<código>`.
// La página le avisa a la pantalla que la abrió y se cierra sola; la pantalla MIDE con GET /v1/accounts (lo que trae esta URL
// es una pista). Sin chrome: es una ventana de ~560 px que vive unos segundos (`esVistaSinChrome`, como /integraciones/escuchando).
//
// Sin datos de nadie: no lee la sesión ni la base, sólo lo que trae la URL, y lo muestra como TEXTO.

import VueltaDeZernio from './VueltaDeZernio';

export const dynamic = 'force-dynamic';

export default function ZernioVueltaPage() {
  return <VueltaDeZernio />;
}
