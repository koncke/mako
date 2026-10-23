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
import { ARBOL_VACIO, arbolSeguro, entradaDelLink, idDeParametro, todasLasSesiones } from './arbol';
import { masReciente } from './ayudas';

export const dynamic = 'force-dynamic';

export default async function Page({ searchParams }: { searchParams: Promise<{ oferta?: string | string[]; funnel?: string | string[]; sesion?: string | string[] }> }) {
  await requireRolWs([], { nav: 'offer' });
  const q = await searchParams;

  const leido = await arbolOffer().then(
    (v): { ok: true; arbol: ArbolOffer } => ({ ok: true, arbol: arbolSeguro(v) }),
    (e: unknown): { ok: false; arbol: ArbolOffer } => { console.error('[offer] no se pudo leer el árbol', e); return { ok: false, arbol: ARBOL_VACIO }; },
  );

  // Un link que nombra una oferta (el «Analizar oferta →» del CRM) abre ESA: su conversación más
  // reciente, o una nueva para analizarla, que la crea la pantalla al montar. Sin link, la más reciente
  // abre sola (no se confía en el orden con que llega cada rama).
  // ?sesion=<id> (20/10/2026): «Seguir en Offer» desde el Ops Center abre ESA conversación, si es de este negocio (el árbol
  // es del workspace). Si no está, lo de siempre.
  const pedidaSesion = idDeParametro(q.sesion);
  const pedido = pedidaSesion != null && todasLasSesiones(leido.arbol).some((s) => s.id === pedidaSesion)
    ? { tipo: 'sesion' as const, id: pedidaSesion }
    : entradaDelLink(leido.arbol, idDeParametro(q.oferta), idDeParametro(q.funnel));
  const ultima = pedido?.tipo === 'sesion' ? pedido : pedido ? null : masReciente(todasLasSesiones(leido.arbol));
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
    // Menos la barra de secciones (app/_components/SeccionesTab.tsx): el super admin la ve desde el 17/10/2026 (Strategy y
    // Playbook son secciones de Offer).
    // Y menos la barra de ARRIBA (`--barra-agencia`: la de «Estás viendo el dashboard de…», 50 px, o la alerta de la voz de MaKo
    // caída, 64 px, que ve también un cliente). La regla global de app/globals.css sólo corrige un estilo que EMPIEZA con
    // `height: 100dvh`, y éste empieza con `calc(`: medido el 22/10/2026 (caso de uso de OF4), la página quedaba 50 px más
    // alta que la ventana y la caja de escribir, debajo del borde.
    <Pagina densidad="compacta" style={{ flex: 'none', height: 'calc(100dvh - var(--alto-secciones, 0px) - var(--barra-agencia, 0px))', overflow: 'hidden', display: 'flex', flexDirection: 'column', paddingBottom: 14 }}>
      <OfferApp
        arbolInicial={leido.arbol}
        sesionInicial={sesion}
        arbolFallo={!leido.ok}
        opcionArmar={OPCION_ARMAR}
        analizarAlAbrir={pedido?.tipo === 'nueva' ? { funnelId: pedido.funnelId, ofertaBaseId: pedido.ofertaBaseId } : null}
      />
    </Pagina>
  );
}
