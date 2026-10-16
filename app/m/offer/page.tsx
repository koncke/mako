// =============================================================================
// /m/offer — «Offer» en el teléfono: el chat con MaKo que arma la oferta de un funnel, y su PDF
// =============================================================================
// La tab de escritorio (app/offer) es Offer Analyst + Offer Generator en un chat con MaKo, atado a un funnel
// del CRM: arriba el selector en árbol (funnel → ofertas → conversaciones), el chat de WhatsApp de la casa,
// «Tu oferta» con sus piezas, y al armar, el Diagnóstico y la Oferta nueva con su PDF. Ésta la destila con la
// MISMA estructura y los mismos rótulos (app/m/offer/modelo.ts → ROTULOS), sin el riel ni el detalle largo.
//
// Referencia de app real: ChatGPT de iOS. Pantalla de TRABAJO (sin título grande ni barra de abajo: lo
// decide `esTrabajo`, app/m/_ui/cabecera.ts), arriba una píldora que abre en una hoja lo que en escritorio es
// el desplegable (como el selector de proyecto de ChatGPT), el hilo con el scroll del documento y el composer
// en la franja del pulgar. Lo que el chat PRODUCE se abre en una hoja alta con su descarga (como el canvas o
// un documento en ChatGPT), y el PDF de cada versión viaja en la burbuja de MaKo como un documento de WhatsApp.
//
// Lo que se hace acá, con las MISMAS acciones de escritorio (/api/offer, app/offer/offer-api.ts): elegir o
// empezar una conversación, escribir, mandar un link, adjuntar documentos (la vista previa de WhatsApp del
// teléfono), grabar una nota de voz, tocar una respuesta rápida, armar la oferta, descargar el PDF y guardarla
// en el funnel. Nada gasta IA por fuera de lo que escritorio ya gasta: son las mismas llamadas.
//
// Quién: la regla del Sidebar para `offer` (sólo el admin del negocio); /api/offer lo vuelve a mirar
// (`adminDeWorkspaceActual`). ⚠️ El workspace es el del request (lo resuelven las libs de offer); `?oferta=` y
// `?funnel=` son las claves de escritorio (`QUERY_DE_SECCION`): el «Analizar oferta →» del CRM abre ESA.
// ⚠️ LAS LECTURAS DEGRADAN, NO TIRAN (como escritorio): sin árbol abre igual con un aviso de una línea; sin la
//    conversación, abre en la bienvenida.
// =============================================================================

import './offer.css';
// La vista previa de adjuntos a pantalla completa es la del chat de MaKo (VistaAdjuntosM) y su capa vive en
// la hoja de esa carpeta (`.m-mako-vista`): sin esto, abrir Offer sin haber pasado por MaKo la dibujaba suelta.
import '../mako/mako.css';
import { requireMovil } from '@/lib/movil-guard';
import { arbolOffer, leerSesion } from '@/lib/offer-sesiones';
import { OPCION_ARMAR } from '@/lib/offer-reglas';
import type { ArbolOffer, OfferSesionVista } from '@/lib/offer-marco';
import { ARBOL_VACIO, arbolSeguro, entradaDelLink, idDeParametro, todasLasSesiones } from '@/app/offer/arbol';
import { ACTUALIZAR_PDF, masReciente } from '@/app/offer/ayudas';
import { PantallaM } from '@/app/m/_ui';
import { OfferM } from './OfferM';

export const dynamic = 'force-dynamic';

export default async function OfferMovilPagina({ searchParams }: {
  searchParams: Promise<{ oferta?: string | string[]; funnel?: string | string[] }>;
}) {
  await requireMovil({ navKey: 'offer' });
  const q = await searchParams;

  const leido = await arbolOffer().then(
    (v): { ok: true; arbol: ArbolOffer } => ({ ok: true, arbol: arbolSeguro(v) }),
    (e: unknown): { ok: false; arbol: ArbolOffer } => { console.error('[m/offer] no se pudo leer el árbol', e instanceof Error ? e.message : e); return { ok: false, arbol: ARBOL_VACIO }; },
  );

  // Como escritorio: un link que nombra una oferta abre ESA (su conversación más reciente, o una nueva para
  // analizarla, que la crea la pantalla al montar). Sin link, la más reciente.
  const pedido = entradaDelLink(leido.arbol, idDeParametro(q.oferta), idDeParametro(q.funnel));
  const ultima = pedido?.tipo === 'sesion' ? pedido : pedido ? null : masReciente(todasLasSesiones(leido.arbol));
  let sesion: OfferSesionVista | null = null;
  if (ultima) {
    try {
      sesion = await leerSesion(ultima.id);
    } catch (e) {
      console.error('[m/offer] no se pudo abrir la última conversación', e instanceof Error ? e.message : e);
    }
  }

  return (
    <PantallaM>
      <OfferM
        arbolInicial={leido.arbol}
        arbolFallo={!leido.ok}
        sesionInicial={sesion}
        opcionArmar={OPCION_ARMAR}
        opcionActualizar={ACTUALIZAR_PDF}
        analizarAlAbrir={pedido?.tipo === 'nueva' ? { funnelId: pedido.funnelId, ofertaBaseId: pedido.ofertaBaseId } : null}
      />
    </PantallaM>
  );
}
