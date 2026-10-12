// =============================================================================
// La cabecera POR DEFECTO de cada ruta de /m (lógica pura, con test)
// =============================================================================
// El header vive en el layout y el layout no sabe en qué página está: no se re-ejecuta al
// navegar. Así que el header (cliente) lee el pathname y pregunta acá qué dibujar. Una página
// que necesite otra cosa (el nombre de un lead, una acción propia, ser pantalla de trabajo) lo
// pisa con <CabeceraM>.
//
// La regla (docs/diseno-mako-mobile-v2.md, «El encabezado»):
//   · en la RAÍZ de cada lugar de la barra: el nombre, en grande, sin «volver»;
//   · una sección de More (Dashboard, Ads Manager…) vuelve a More; su subpantalla, a la
//     sección; la cuenta vuelve a More (es la primera fila de More);
//   · «‹ Padre» con destino FIJO, nunca `router.back()`. El destino de «Volver» es una
//     propiedad de la PANTALLA, no del camino (AGENTS.md): en iOS standalone el gesto de
//     volver no está garantizado, y un link que llegó por push no tiene historial detrás;
//   · pantallas de TRABAJO (el chat de MaKo, el editor de un video, el de una landing): sin
//     título grande, el nombre en la barra desde el principio y SIN la barra de abajo.
//
// Los nombres salen de lib/movil-rutas.ts (DESTINOS_MOVIL y SECCIONES_MAS): una cosa, un lugar.
// `barra` es la barra del rol (`barraMovil`): una sección que subió a la barra es una raíz.
// =============================================================================

import {
  DESTINOS_MOVIL, HOME_MOVIL, RUTA_MAS, SECCIONES_MAS, esRutaMovil, seccionDeRuta,
} from '@/lib/movil-rutas';

export type PadreM = { href: string; label: string };
export type CabeceraPorDefecto = {
  /** El nombre de la pantalla. '' = la página lo pone (<CabeceraM titulo=…>). */
  titulo: string;
  padre: PadreM | null;
  /** Pantalla de trabajo: sin título grande; el nombre va en la barra desde el principio. */
  trabajo: boolean;
  /** ¿Lleva la barra de abajo? No en /m/configurar ni en una pantalla de trabajo que no es raíz. */
  conBarra: boolean;
};

type LugarBarra = { href: string; label: string };

/** La cuenta de /m: avisos, apariencia y la salida. Mismo nombre que en escritorio. */
export const RUTA_CUENTA = '/m/cuenta';
export const TITULO_CUENTA = 'Perfil';
/** La pantalla de onboarding pendiente: sin barra y sin «volver». */
export const RUTA_CONFIGURAR = '/m/configurar';

const HOY = DESTINOS_MOVIL.find((d) => d.href === HOME_MOVIL)!;
const MAS: PadreM = { href: RUTA_MAS, label: DESTINOS_MOVIL.find((d) => d.href === RUTA_MAS)!.label };

function limpia(pathname: string | null | undefined): string {
  return (pathname ?? '').split(/[?#]/)[0].replace(/\/+$/, '') || '/';
}
const dentro = (p: string, base: string) => p === base || p.startsWith(base + '/');
const segmentos = (p: string) => p.split('/').filter(Boolean).length;

/** El chat de WhatsApp de un lead: `/m/crm/<id>/chat`. */
const CHAT_LEAD = /^\/m\/crm\/([^/]+)\/chat$/;

/**
 * ¿Es una pantalla de trabajo por defecto? El chat de MaKo (y sus subpantallas), el chat de
 * WhatsApp de un lead (`/m/crm/<id>/chat`), y el editor de UN video o de UNA landing
 * (`/m/video/<id>`, `/m/landing/<id>`). Las listas de Video y Landing no: son secciones normales.
 *
 * ⚠️ El chat del lead va ACÁ y no sólo en su <CabeceraM trabajo>: el HTML del server sale con
 * esta regla, y sin ella la barra de abajo se dibujaba hasta hidratar (un salto visible).
 */
export function esTrabajo(pathname: string | null | undefined): boolean {
  const p = limpia(pathname);
  return dentro(p, '/m/mako') || /^\/m\/(video|landing)\/[^/]+/.test(p) || CHAT_LEAD.test(p) || p === RUTA_CONFIGURAR;
}

/** El lugar de la barra cuya raíz es esta ruta (o null). */
function raizDeBarra(p: string, barra: readonly LugarBarra[]): LugarBarra | null {
  return barra.find((b) => b.href === p) ?? null;
}

/** La raíz (de la barra, de More o la cuenta) que es dueña de esta ruta. */
function duenoDe(p: string, barra: readonly LugarBarra[]): LugarBarra | null {
  const deBarra = barra.find((b) => dentro(p, b.href));
  if (deBarra) return deBarra;
  const s = seccionDeRuta(p);
  if (s) return { href: s.href, label: s.label };
  if (dentro(p, RUTA_CUENTA)) return { href: RUTA_CUENTA, label: TITULO_CUENTA };
  return null;
}

export function cabeceraPorRuta(
  pathname: string | null | undefined,
  barra: readonly LugarBarra[] = DESTINOS_MOVIL,
): CabeceraPorDefecto {
  const p = limpia(pathname);
  if (!esRutaMovil(p)) return { titulo: 'MaKo', padre: null, trabajo: false, conBarra: true };
  if (p === RUTA_CONFIGURAR) return { titulo: 'MaKo', padre: null, trabajo: true, conBarra: false };

  const trabajo = esTrabajo(p);

  // Una raíz de la barra (incluida una sección de More que subió a ocupar un hueco): sin
  // «volver». Si además es de trabajo (el chat subido a la barra), la barra de abajo se queda:
  // sin ella no hay forma de salir de un destino raíz.
  const raiz = raizDeBarra(p, barra);
  if (raiz) return { titulo: raiz.label, padre: null, trabajo, conBarra: true };

  // La raíz de una sección de More: vuelve a More.
  const seccion = SECCIONES_MAS.find((s) => s.href === p);
  if (seccion) return { titulo: seccion.label, padre: MAS, trabajo, conBarra: !trabajo };

  if (p === RUTA_CUENTA) return { titulo: TITULO_CUENTA, padre: MAS, trabajo: false, conBarra: true };

  // El chat de un lead vuelve a SU ficha, no a la lista del CRM (la página lo pisa igual con
  // el nombre del lead; acá queda bien desde el HTML del server).
  const chat = CHAT_LEAD.exec(p);
  if (chat) return { titulo: '', padre: { href: `/m/crm/${chat[1]}`, label: 'Ficha' }, trabajo: true, conBarra: false };

  // Una subpantalla (/m/crm/12, /m/ads/123, /m/video/9, /m/cuenta/instalar): vuelve a la raíz
  // que es su dueña. El título lo pone la página.
  const dueno = duenoDe(p, barra);
  if (dueno) return { titulo: '', padre: { href: dueno.href, label: dueno.label }, trabajo, conBarra: !trabajo };

  // Una ruta de /m que nadie declaró: vuelve a la home, que siempre existe.
  return { titulo: '', padre: { href: HOY.href, label: HOY.label }, trabajo, conBarra: !trabajo };
}

/** ¿Hay barra inferior en esta ruta? */
export function llevaBarra(pathname: string | null | undefined, barra: readonly LugarBarra[] = DESTINOS_MOVIL): boolean {
  return cabeceraPorRuta(pathname, barra).conBarra;
}

/**
 * Qué tan adentro está una pantalla en el árbol de navegación: 0 las raíces de la barra, 1 una
 * sección de More, la cuenta o la ficha de un lead, y uno más por cada nivel debajo. Ir a una
 * MÁS adentro desliza desde la derecha; cambiar de tab (0 → 0) y volver, no.
 */
export function nivel(pathname: string | null | undefined, barra: readonly LugarBarra[] = DESTINOS_MOVIL): number {
  const p = limpia(pathname);
  if (!esRutaMovil(p) || p === '/m' || p === RUTA_CONFIGURAR) return 0;
  if (raizDeBarra(p, barra)) return 0;
  const dueno = duenoDe(p, barra);
  if (!dueno) return 1;
  const base = raizDeBarra(dueno.href, barra) ? 0 : 1;
  return base + (segmentos(p) - segmentos(dueno.href));
}

/**
 * Lo que dice el «‹ volver» a la vista. Con el nombre chico centrado (tope: 100vw − 200 px),
 * a cada lado quedan ~94 px a 390 de ancho: entran «More», «CRM», «Today», «Perfil», «Ficha»
 * (≤ 6 letras a 17 px); uno más largo («‹ Dashboard») se come el título y, como iOS, pasa a
 * «Atrás». El nombre entero queda en el `aria-label` («Volver a Dashboard»).
 */
export function rotuloVolver(label: string): string {
  return label.length <= 6 ? label : 'Atrás';
}
