// =============================================================================
// Las cajas de chat de MaKo, en UN lugar: qué ofrece cada una, y la excepción con su porqué (28/10/2026)
// =============================================================================
// Martín (28/10): «Revisa... que esté unificado, que se pueda utilizar el chat de la misma manera en todos lados». Toda caja de
// chat (la compartida, app/_chat/CajaChat.tsx) ofrece lo mismo: adjuntar archivos, capturas y documentos (`adjuntos`), la nota
// de voz que sale en el acto con la transcripción por detrás (`voz`, o `onGrabada` con app/_chat/useNotaEnElActo.ts), emojis
// (los da la caja siempre), el envío optimista y los tres puntos de «escribiendo» (el hilo, HiloMako → Trabajando.tsx). Lo
// que una caja NO ofrece se escribe ACÁ con su porqué, y tests/cajas-de-chat-unificadas.test.ts barre el repo: una caja nueva
// que no esté en esta lista, o una que pierda lo suyo, da rojo. Lo que se aprendió: docs/hallazgos-chat.md.
// =============================================================================

/** Lo que el test mira en el código (`adjuntos`, `voz`) y lo que sólo se documenta (`puntos`: lo dibuja el hilo, no la caja). */
export type Falta = 'adjuntos' | 'voz' | 'puntos';

export type CajaDeChat = {
  /** El archivo que renderiza la caja (`<CajaChat`, o una caja propia). */
  archivo: string;
  /** Dónde se arman sus props, si no es el mismo archivo (un `{...caja}`). */
  props?: string;
  /** Qué chat es, para quien lee la lista. */
  chat: string;
  /** Lo que no ofrece, y por qué. «pendiente: …» = todavía no se hizo; lo demás, no corresponde. Vacío = la caja entera. */
  falta?: Partial<Record<Falta, string>>;
};

export const CAJAS_DE_CHAT: readonly CajaDeChat[] = [
  { archivo: 'app/admin/operaciones/Conversacion.tsx', chat: 'Ops Center, computadora' },
  { archivo: 'app/m/operaciones/ChatsMovil.tsx', chat: 'Ops Center, teléfono' },
  {
    archivo: 'app/admin/operaciones/CajaChatNuevo.tsx',
    chat: 'Ops Center, el chat nuevo (el primer mensaje decide dónde va; los archivos van con él, y a un chat nuevo los baja el cartero 1.22.0)',
  },
  { archivo: 'app/second-brain/PiezasCliente.tsx', chat: 'MaKo de cada tab y el Cerebro del cliente (CajaDelCliente)' },
  { archivo: 'app/_chat/grupo/CajaDelGrupo.tsx', chat: 'El grupo de un negocio, computadora y teléfono (3/11/2026)' },
  { archivo: 'app/crm/lead-view/MakoAnalystLead.tsx', chat: 'CRM, MaKo Analyst del lead' },
  { archivo: 'app/automations/ChatMakoVista.tsx', props: 'app/automations/ChatMako.tsx', chat: 'Automations' },
  {
    archivo: 'app/offer/ChatOffer.tsx', props: 'app/offer/OfferApp.tsx',
    chat: 'Offer, computadora (en el onboarding pide un nombre o un código: sin archivos ni voz, a propósito)',
    falta: { puntos: 'no corresponde: Offer dibuja los suyos («Analizando…», la decisión del 18/10/2026)' },
  },
  { archivo: 'app/m/offer/ComposerOfferM.tsx', chat: 'Offer, teléfono', falta: { puntos: 'no corresponde: «Analizando…», nunca «escribiendo» (offer.css)' } },
  {
    archivo: 'app/chats/Composer.tsx', chat: 'Chats: lo que se le manda a un lead (los archivos y la nota de voz, según lo que acepte el canal)',
    falta: { puntos: 'no corresponde: del otro lado contesta una persona, por WhatsApp o por email' },
  },
  { archivo: 'app/web-generator/editor/paneles/ChatAgente.tsx', props: 'app/web-generator/editor/paneles/PanelAgente.tsx', chat: 'Web Generator, el agente' },
  {
    archivo: 'app/tickets/soporte/PiezasSoporte.tsx', chat: 'Soporte (la Ticketera), computadora y teléfono',
    falta: { puntos: 'no corresponde: en un ticket contesta el equipo, horas después (en la conversación nueva, MaKo escribe sus 3 puntos)' },
  },
  { archivo: 'app/_components/MakoChat.tsx', chat: 'MaKo con sesiones (ChartIA, Diagnóstico; los archivos los lee /api/chart-insights)' },
  { archivo: 'app/whatsapp/WhatsAppAdvisor.tsx', chat: 'el asesor de WhatsApp de un lead (los archivos los lee el servidor: lib/adjuntos-del-chat.ts)' },
  { archivo: 'app/dashboard/PanelEditarMako.tsx', chat: 'Editar con MaKo (Dashboard; la lectura de los archivos va al prompt como dato)' },
  { archivo: 'app/image-editor/mako/chat/PanelMakoIA.tsx', chat: 'Image Editor (la lectura de los archivos va aparte de la instrucción)' },
  { archivo: 'app/video-editor/_opencut/chat/PanelChat.tsx', chat: 'Video Editor (la lectura de los archivos va aparte de la instrucción)' },
  {
    archivo: 'app/ads-manager/PrimeraEntrada.tsx', chat: 'la primera entrada de Marketing CoPilot',
    falta: { adjuntos: 'no corresponde: cada respuesta es el dato de un paso; los archivos se le pasan al chat de la tab', voz: 'no corresponde: la nota se transcribe y responde el paso como texto' },
  },
  {
    archivo: 'app/ads-manager/ArranqueMediaBuyer.tsx', chat: 'el arranque del Media Buyer',
    falta: { adjuntos: 'no corresponde: es un arranque guionado, el texto es la respuesta del paso', voz: 'no corresponde: ídem' },
  },
  {
    archivo: 'app/newsletters/NewslettersApp.tsx', chat: 'la apertura del Newsletter (cada cuánto sale y de qué trata; sólo de la plataforma mientras esté en PRONTO)',
    falta: {
      adjuntos: 'no corresponde: es una apertura guiada de dos preguntas, el texto es la respuesta del paso (como el arranque del Media Buyer)',
      voz: 'no corresponde: ídem',
    },
  },
  {
    archivo: 'app/ads-manager/Hoy.tsx', chat: 'la orden de una línea del Media Buyer',
    falta: {
      adjuntos: 'no corresponde: la orden va al MaKo de la tab, que tiene la caja entera', voz: 'no corresponde: ídem',
      puntos: 'no corresponde: ídem (contesta el MaKo de la tab, con sus puntos)',
    },
  },
];

/** Las cajas que NO son CajaChat y graban una nota (`useNotaQueSeManda`): también se barren. Ninguna desde el 28/10/2026: la
 *  última, la del chat nuevo del Ops Center, pasó a ser la caja única (CajaChatNuevo.tsx). */
export const CAJAS_PROPIAS: readonly CajaDeChat[] = [];
