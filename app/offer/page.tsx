// =============================================================================
// /offer — la tab Offer: Offer Analyst y Offer Generator en un solo chat con MaKo
// =============================================================================
// Pedido de Martín (11/10/2026): las dos tabs en una que se llame «Offer», «muy de
// IA», un chat donde se escribe, se dicta o se adjunta, y al final un PDF con la
// conclusión que también se ve aquí. La pantalla es app/offer/OfferApp.tsx; aquí se
// arma la primera pintada en el server, así abre llena y sin un giro de espera.
//
// SIN ONBOARDING DELANTE, a propósito: en esta tab el chat ES el onboarding. La
// bienvenida es el primer mensaje de MaKo (la semilla), que ya sabe lo que el
// negocio cargó en el Archivero y pregunta sólo lo que falta.
//
// ⚠️ LAS LECTURAS DEGRADAN, NO TIRAN. Si falla el historial, la pantalla abre igual
// en la bienvenida (con un aviso de una línea); si falla la semilla, MaKo arranca
// con la primera pregunta del marco (PREGUNTAS_GUIA) y las piezas vacías. Una tab
// que se rompe al dibujarse por una lectura caída es peor que una que pregunta de
// más. Cada falla queda en el log del server con su prefijo.

import { Pagina } from '@/app/_ui';
import { requireRolWs } from '@/lib/tab-access';
import { leerSesion, listarSesionesOffer, semillaOffer } from '@/lib/offer-sesiones';
import { OPCION_ARMAR } from '@/lib/offer-reglas';
import { PREGUNTAS_GUIA, type OfferSesionResumen, type OfferSesionVista } from '@/lib/offer-marco';
import { OfferApp, type SemillaOffer } from './OfferApp';
import { masReciente } from './ayudas';

export const dynamic = 'force-dynamic';

export default async function Page() {
  await requireRolWs([], { nav: 'offer' });

  const [lista, semillaLeida] = await Promise.all([
    listarSesionesOffer().then(
      (v): { ok: true; sesiones: OfferSesionResumen[] } => ({ ok: true, sesiones: Array.isArray(v) ? v : [] }),
      (e: unknown): { ok: false; sesiones: OfferSesionResumen[] } => { console.error('[offer] no se pudo leer el historial', e); return { ok: false, sesiones: [] }; },
    ),
    semillaOffer().then(
      (v): SemillaOffer | null => v,
      (e: unknown): SemillaOffer | null => { console.error('[offer] no se pudo armar la semilla', e); return null; },
    ),
  ]);

  // La más reciente abre sola (no se confía en el orden con que llega la lista).
  const ultima = masReciente(lista.sesiones);
  let sesion: OfferSesionVista | null = null;
  if (ultima) {
    try {
      sesion = await leerSesion(ultima.id);
    } catch (e) {
      console.error('[offer] no se pudo abrir la última sesión', e);
    }
  }

  const semilla: SemillaOffer = semillaLeida ?? {
    piezas: {},
    primerMensaje: { id: 'semilla', de: 'mako', texto: PREGUNTAS_GUIA[0]?.pregunta ?? '¿Qué vendes hoy?', at: new Date().toISOString() },
  };

  return (
    // ⚠️ `flex: 'none'` + el alto + `overflow: hidden`, LOS TRES (molde: app/dashboard/page.tsx).
    // Pagina trae `flex: 1`, que en la columna del layout anula el `height`: el <main>
    // crecería con la conversación y el que scrollearía sería el documento, con el
    // composer yéndose para abajo. Con esto scrollea la lista de mensajes y el
    // composer queda pegado abajo. `dvh` y no `vh`: en el celular, 100vh incluye la
    // barra del navegador y el composer quedaría debajo de ella.
    <Pagina densidad="compacta" style={{ flex: 'none', height: '100dvh', overflow: 'hidden', display: 'flex', flexDirection: 'column', paddingBottom: 14 }}>
      <OfferApp
        sesionesIniciales={lista.sesiones}
        sesionInicial={sesion}
        semilla={semilla}
        historialFallo={!lista.ok}
        opcionArmar={OPCION_ARMAR}
      />
    </Pagina>
  );
}
