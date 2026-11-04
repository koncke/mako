// =============================================================================
// grabadores/catalogo — qué es cada grabador y qué da de verdad (PURO: lo lee la pantalla y lo leen los tests)
// =============================================================================
// Lo que cada grabador da por API se MIDIÓ el 26/10/2026 contra su documentación oficial y contra su API real (cómo
// contesta un pedido sin credencial): docs/hallazgos-integraciones.md → «Los grabadores de reuniones». Lo que no da, la
// tarjeta lo dice y MaKo no lo finge: un grabador sin transcripción por API no aparece como «lee tus reuniones».
// =============================================================================

import { GRABADORES, type GrabadorId } from './reunion';

export type QueDa = {
  /** ¿MaKo puede leer lo que se HABLÓ (la transcripción) por su API? Es lo que usan el Plan y el Closing. */
  transcripcion: boolean;
  /** ¿Avisa al terminar (webhook)? Sin aviso, la reunión entra en la próxima vuelta del cron (cada hora). */
  aviso: boolean;
  /** ¿Trae su propio resumen? */
  resumen: boolean;
  /** ¿Dice el email de los invitados de afuera? Sin email, el CRM no puede saber solo de qué lead es la llamada. */
  emails: boolean;
};

export type Grabador = {
  id: GrabadorId;
  nombre: string;
  /** Los dominios de sus links de grabación: el CRM acepta un link de cualquiera de éstos. */
  dominios: readonly string[];
  /** ¿Se conecta HOY desde MaKo? `false` = la tarjeta explica por qué y no pide nada. */
  conectable: boolean;
  queDa: QueDa;
  /** Lo que la tarjeta dice de lo que el grabador NO da (o de por qué no se conecta). Una o dos líneas, sin vueltas. */
  aviso?: string;
  /** La palabra del chip de una tarjeta que no se conecta («Sin API», «Próximamente»). */
  chip?: string;
};

export const CATALOGO_GRABADORES: Readonly<Record<GrabadorId, Grabador>> = {
  fathom: {
    id: 'fathom', nombre: 'Fathom', dominios: ['fathom.video'], conectable: true,
    queDa: { transcripcion: true, aviso: true, resumen: true, emails: true },
  },
  // «Loom does not offer a open API at this time» (support.atlassian.com/loom, medido el 26/10/2026): ni listado, ni
  // transcripción, ni webhooks. El oEmbed sólo da título, duración y miniatura de un video público cuyo link ya tenés.
  loom: {
    id: 'loom', nombre: 'Loom', dominios: ['loom.com'], conectable: false, chip: 'Sin API',
    queDa: { transcripcion: false, aviso: false, resumen: false, emails: false },
    aviso: 'Loom no tiene API (lo dice Loom): pega el link del Loom en el lead y sube su transcripción en el Plan → Importar.',
  },
  tldv: {
    id: 'tldv', nombre: 'tl;dv', dominios: ['tldv.io'], conectable: true,
    queDa: { transcripcion: true, aviso: true, resumen: true, emails: true },
    aviso: 'La API de tl;dv es del plan Pro o Business de quien organiza la reunión.',
  },
  fireflies: {
    id: 'fireflies', nombre: 'Fireflies.ai', dominios: ['fireflies.ai'], conectable: true,
    queDa: { transcripcion: true, aviso: true, resumen: true, emails: true },
  },
  zoom: {
    id: 'zoom', nombre: 'Zoom', dominios: ['zoom.us'], conectable: true,
    queDa: { transcripcion: true, aviso: true, resumen: true, emails: false },
    aviso: 'Zoom transcribe sólo las grabaciones en la nube (plan Pro o superior, con la transcripción de audio prendida) y no da el correo de los invitados de afuera: el CRM no sabe solo de qué lead es la llamada.',
  },
  otter: {
    id: 'otter', nombre: 'Otter.ai', dominios: ['otter.ai'], conectable: true,
    queDa: { transcripcion: true, aviso: false, resumen: true, emails: true },
    aviso: 'La API de Otter es sólo del plan Enterprise, y no avisa al terminar: tus reuniones entran en la vuelta de cada hora.',
  },
  // Read AI da todo por API, pero se conecta con OAuth 2.1 (registro dinámico, token de 10 minutos que rota en cada uso)
  // y no está documentado si acepta la vuelta a MaKo: hay que probarlo antes de dibujar el botón (docs/pendientes.md).
  'readai': {
    id: 'readai', nombre: 'Read AI', dominios: ['read.ai'], conectable: false, chip: 'Próximamente',
    queDa: { transcripcion: true, aviso: true, resumen: true, emails: true },
    aviso: 'Read AI se conecta con tu cuenta (con su botón de inicio de sesión), y ese botón todavía no está en MaKo.',
  },
  // Meet da la transcripción por su API, con un permiso de Google «sensible» (meetings.space.readonly) que la app de MaKo
  // no tiene aprobado, sólo en Workspace Business Standard o superior, sin el correo de los participantes y por 30 días.
  'meet': {
    id: 'meet', nombre: 'Google Meet', dominios: ['meet.google.com'], conectable: false, chip: 'Próximamente',
    queDa: { transcripcion: true, aviso: false, resumen: false, emails: false },
    aviso: 'Leer las transcripciones de Meet pide un permiso de Google que MaKo todavía no tiene aprobado (y sólo anda con Google Workspace Business Standard o superior).',
  },
  // La grabación que se hace DESDE MaKo (04/11/2026, el botón «Grabar» de la ficha del lead y de Cold Calling). No es una
  // integración: no se conecta, no tiene tarjeta en Integraciones y los crons no la listan (sin lector en `LECTORES`). Lo que el
  // Closing pide por su clave lo contesta lib/grabadores/grabadora.ts, con la tabla `llamadas_grabadas`. Sin emails: el lead
  // ya viene de la ficha.
  grabadora: {
    id: 'grabadora', nombre: 'Grabadora de MaKo', dominios: [], conectable: false,
    queDa: { transcripcion: true, aviso: false, resumen: false, emails: false },
  },
};

export const nombreDeGrabador = (g: GrabadorId): string => CATALOGO_GRABADORES[g]?.nombre ?? g;

/**
 * La credencial con el CORREO de la cuenta que graba, por grabador. Es de la casa (el Closing la cuenta como interna) y,
 * en tl;dv como en Fathom, es lo que rutea el aviso al negocio (lib/webhook-routing.ts).
 */
export const CLAVES_CUENTA_GRABADOR: Readonly<Partial<Record<GrabadorId, string>>> = {
  fathom: 'FATHOM_HOST_EMAIL',
  tldv: 'TLDV_HOST_EMAIL',
  fireflies: 'FIREFLIES_HOST_EMAIL',
};

/**
 * Las claves que hacen falta para LEER reuniones de cada grabador (las que usa su lector). Es menos que «conectado»
 * (`integracionConectada`, que pide todos los campos obligatorios de la tarjeta): antes de los otros grabadores, el Plan,
 * el Closing y el CRM leían Fathom con su API key y nada más, y un negocio sin el secreto del webhook leía igual.
 * Deprecar no es romper: para leer, sigue alcanzando la clave.
 */
export const CLAVES_DE_LECTURA: Readonly<Partial<Record<GrabadorId, readonly string[]>>> = {
  fathom: ['FATHOM_API_KEY'],
  tldv: ['TLDV_API_KEY'],
  fireflies: ['FIREFLIES_API_KEY'],
  zoom: ['ZOOM_ACCOUNT_ID', 'ZOOM_CLIENT_ID', 'ZOOM_CLIENT_SECRET'],
  otter: ['OTTER_API_KEY'],
};

/** ¿El link es de una grabación de algún grabador? Devuelve cuál (lo que el CRM acepta en «Link de la reunión»). */
export function grabadorDelLink(url: string | null | undefined): GrabadorId | null {
  let u: URL;
  try { u = new URL(String(url ?? '').trim()); } catch { return null; }
  if (u.protocol !== 'https:') return null;
  const host = u.hostname.toLowerCase();
  for (const g of GRABADORES) {
    if (CATALOGO_GRABADORES[g].dominios.some((d) => host === d || host.endsWith(`.${d}`))) return g;
  }
  return null;
}

/** Los nombres para una lista en un texto: «Fathom, Loom, tl;dv, Fireflies.ai, Zoom, Otter.ai, Read AI y Google Meet». */
export function listaDeGrabadores(soloConectables = false): string {
  // La Grabadora de MaKo no es un grabador de afuera: la lista nombra lo que se CONECTA.
  const n = GRABADORES.filter((g) => g !== 'grabadora' && (!soloConectables || CATALOGO_GRABADORES[g].conectable)).map(nombreDeGrabador);
  return n.length > 1 ? `${n.slice(0, -1).join(', ')} y ${n.at(-1)}` : (n[0] ?? '');
}
