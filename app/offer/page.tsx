// =============================================================================
// /offer — la tab Offer: Offer Analyst y Offer Generator en un chat con MaKo, por funnel
// =============================================================================
// Pedido de Martín (11/10/2026): las dos tabs en una que se llame «Offer», «muy de IA», un chat
// donde se escribe, se dicta o se adjunta, y al final un PDF con la conclusión que también se ve
// aquí. En la v2 (el mismo día) la oferta queda atada a un FUNNEL del CRM: arriba se elige el funnel
// y, adentro, se crea una oferta nueva o se analiza una que ya existe. La pantalla es
// app/offer/OfferApp.tsx; aquí se arma la primera pintada en el server, así abre llena y sin un
// giro de espera: el árbol del selector y la conversación más reciente, abierta.
//
// SIN ONBOARDING DELANTE, a propósito: en esta tab el chat ES el onboarding. El primer mensaje de
// MaKo lo escribe el servidor al crear la conversación ('nueva'), con lo que ya sabe del negocio.
//
// ⚠️ LAS LECTURAS DEGRADAN, NO TIRAN. Si falla el árbol, la pantalla abre igual (con un aviso de una
// línea) y la conversación más reciente no se puede elegir; si falla abrirla, abre en la
// bienvenida. Una tab que se rompe al dibujarse por una lectura caída es peor que una que pide
// elegir de nuevo. Cada falla queda en el log del server con su prefijo.

import { Pagina } from '@/app/_ui';
import { requireRolWs } from '@/lib/tab-access';
import { arbolOffer, leerSesion } from '@/lib/offer-sesiones';
import { OPCION_ARMAR } from '@/lib/offer-reglas';
import type { ArbolOffer, OfferSesionVista } from '@/lib/offer-marco';
import { OfferApp } from './OfferApp';
import { ARBOL_VACIO, arbolSeguro, todasLasSesiones } from './arbol';
import { masReciente } from './ayudas';

export const dynamic = 'force-dynamic';

export default async function Page() {
  await requireRolWs([], { nav: 'offer' });

  const leido = await arbolOffer().then(
    (v): { ok: true; arbol: ArbolOffer } => ({ ok: true, arbol: arbolSeguro(v) }),
    (e: unknown): { ok: false; arbol: ArbolOffer } => { console.error('[offer] no se pudo leer el árbol', e); return { ok: false, arbol: ARBOL_VACIO }; },
  );

  // La más reciente abre sola (no se confía en el orden con que llega cada rama).
  const ultima = masReciente(todasLasSesiones(leido.arbol));
  let sesion: OfferSesionVista | null = null;
  if (ultima) {
    try {
      sesion = await leerSesion(ultima.id);
    } catch (e) {
      console.error('[offer] no se pudo abrir la última conversación', e);
    }
  }

  return (
    // ⚠️ `flex: 'none'` + el alto + `overflow: hidden`, LOS TRES (molde: app/dashboard/page.tsx).
    // Pagina trae `flex: 1`, que en la columna del layout anula el `height`: el <main> crecería con
    // la conversación y el que scrollearía sería el documento, con la barra de escribir yéndose para
    // abajo. Con esto scrollea el hilo y la barra queda pegada abajo. `dvh` y no `vh`: en el celular,
    // 100vh incluye la barra del navegador y la de escribir quedaría debajo de ella.
    <Pagina densidad="compacta" style={{ flex: 'none', height: '100dvh', overflow: 'hidden', display: 'flex', flexDirection: 'column', paddingBottom: 14 }}>
      <OfferApp
        arbolInicial={leido.arbol}
        sesionInicial={sesion}
        arbolFallo={!leido.ok}
        opcionArmar={OPCION_ARMAR}
      />
    </Pagina>
  );
}
