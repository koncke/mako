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
import { getSesionAdmin } from '@/lib/auth';
import { ESTILO_PAGINA_CREAR } from '@/app/_crear/reglas';
import { ARBOL_VACIO, arbolSeguro, entradaDelLink, idDeParametro, todasLasSesiones } from './arbol';
import { masReciente } from './ayudas';

export const dynamic = 'force-dynamic';

export default async function Page({ searchParams }: { searchParams: Promise<{ oferta?: string | string[]; funnel?: string | string[]; sesion?: string | string[] }> }) {
  await requireRolWs([], { nav: 'offer' });
  const q = await searchParams;
  // Strategy y Offer Playbook ya no son pestañas (29/10/2026, «sin otras tabs, incluso en SuperAdmin»): van al pie de la
  // lista de ofertas, sólo para el super admin.
  const superAdmin = (await getSesionAdmin()) != null;

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
    // La pantalla de Create (29/10/2026, app/_crear/PantallaCrear.tsx): de borde a borde y del alto de la ventana.
    // `ESTILO_PAGINA_CREAR` trae lo que esta página medía desde el 22/10 (`flex: 'none'` + el alto + `overflow: hidden`, los
    // tres; `dvh`; menos `--barra-agencia`). Sin barra de secciones: Offer no tiene pestañas.
    <Pagina ancho="completo" densidad="compacta" style={ESTILO_PAGINA_CREAR}>
      <OfferApp
        arbolInicial={leido.arbol}
        sesionInicial={sesion}
        arbolFallo={!leido.ok}
        opcionArmar={OPCION_ARMAR}
        analizarAlAbrir={pedido?.tipo === 'nueva' ? { funnelId: pedido.funnelId, ofertaBaseId: pedido.ofertaBaseId } : null}
        superAdmin={superAdmin}
      />
    </Pagina>
  );
}
