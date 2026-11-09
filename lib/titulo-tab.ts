// =============================================================================
// titulo-tab — de una ruta al título de la pestaña del navegador
// =============================================================================
// "MaKo - CRM" en vez de "MaKo" a secas en las 45 pantallas: con varias pestañas
// abiertas eran todas iguales y había que entrar a cada una para encontrar la
// buena.
//
// Los nombres NO se escriben acá: salen de nav.ts, el mismo lugar del que sale el
// sidebar. Si mañana una tab se renombra en el menú, la pestaña la sigue sola.
//
// Lógica pura y aparte del componente para poder probarla (tests/titulo-tab).

import { TODOS_LOS_ITEMS, ADMIN_NAV, USER_NAV, type NavItem } from '@/app/_components/nav';
import { DESTINOS_MOVIL, HOME_MOVIL, RUTA_INBOX, SECCIONES_MAS, TITULO_HOME_MOVIL, TITULO_INBOX, rutaEscritorio, tituloSeccion } from './movil-rutas';
import { TITULO_CUENTA } from './ajustes-secciones';

export const MARCA = 'MaKo';

// Rutas que nav.ts no nombra bien por sí solo. Se consultan ANTES que los
// matchers: /metodo, por ejemplo, matchea con "Configuraciones" (es su sub-tab)
// pero en el sidebar se llama Integraciones, que es lo que se espera leer en la
// pestaña. Se prueban de la clave más larga a la más corta, así /marketing/salud
// gana sobre /marketing.
const EXTRA: Record<string, string> = {
  '/marketing/salud': 'Salud de Meta',
  '/martinkoncke': 'Plan',
  '/integraciones': 'Integraciones',
  '/comercial': 'Dashboard',
  '/marketing': 'Dashboard',
  '/graficos': 'Dashboard',
  '/setting': 'Automations',
  '/metodo': 'Integraciones',
  '/anuncio': 'Anuncio',
  '/equipo': 'Equipo',
  '/inicio': 'Inicio',
  // El canal de MaKo dejó de ser sección de Chats el 24/10/2026 (es una línea del chip «Canales»), pero /agencia sigue
  // respondiendo para sus links (`?canal=1`): conserva su nombre, que ya trae la marca.
  '/agencia': 'MaKo WhatsApp',
  // El wizard del primer ingreso: desde el 15/10/2026 no tiene ítem en el menú (el hub se fue a Second Brain).
  '/onboarding': 'Configuración inicial',
  // La Ticketera del super admin vive bajo /tickets, que en el menú es «Reportar problema».
  '/tickets/decisiones': 'Ticketera',
  // MaKo Mobile: los nombres de SU barra (lib/movil-rutas.ts), no los de escritorio
  // (desde la v3, /m/hoy es «General» como en escritorio). Sin estas entradas, `desdeLaRuta` titulaba
  // todo /m como «MaKo - M». `/m` atrapa el resto (una subpantalla sin nombre).
  ...Object.fromEntries(DESTINOS_MOVIL.map((d) => [d.href, d.label])),
  // Y las secciones de More (v2): sin ellas /m/dashboard, /m/ads… quedaban «MaKo» a secas. Con el
  // nombre de la PANTALLA, el de la cabecera: /m/copywriting es «Ads Writer», como /ads-writer.
  ...Object.fromEntries(SECCIONES_MAS.map((s) => [s.href, tituloSeccion(s)])),
  '/m/cuenta': TITULO_CUENTA, // el mismo nombre que en la computadora («My Profile» desde el 17/10/2026 noche)
  // El Dashboard dejó la barra el 20/10/2026 (el Ops Center tomó su lugar) y no es una sección: su nombre va a mano.
  [HOME_MOVIL]: TITULO_HOME_MOVIL,
  // La campana de General (v3: Inbox dejó la barra; desde el 15/10/2026 se titula Avisos, como la cabecera).
  [RUTA_INBOX]: TITULO_INBOX,
  '/m': 'MaKo',
};
const EXTRA_KEYS = Object.keys(EXTRA).sort((a, b) => b.length - a.length);

// Donde dos entradas matchean la misma ruta gana la primera, así que van antes
// las del menú principal.
//
// ADMIN_NAV sigue yendo ANTES que USER_NAV. El motivo original ya no aplica
// —USER_NAV tenía un item 'admin' con `starts('/admin')` que se tragaba las
// sub-rutas, y ese item se eliminó el 8/8— pero el orden se queda: adentro de
// ADMIN_NAV el item de Clientes EXCLUYE a mano /admin/ui,
// /admin/docs y /admin/dev para que cada una lea su propio nombre, y ese trabajo
// solo sirve si nada más general se evalúa primero.
const TODOS: NavItem[] = [
  // Las cuatro familias de producto (Operate · Analyze · Sales Machine ·
  // Content Machine) más la zona de MaKo.
  ...TODOS_LOS_ITEMS,
  // Las dos del super admin: Admin y Dev.
  ...ADMIN_NAV,
  ...USER_NAV,
];

/** "ads-manager" → "Ads manager". Red de seguridad para una ruta sin entrada. */
function desdeLaRuta(pathname: string): string | null {
  const seg = pathname.split('/').filter(Boolean)[0];
  if (!seg) return null;
  const limpio = seg.replace(/-/g, ' ');
  return limpio.charAt(0).toUpperCase() + limpio.slice(1);
}

/**
 * Antepone la marca, salvo que el nombre de la sección ya la traiga: hay dos que
 * la tienen adentro ("Preguntale a MaKo", "WhatsApp de MaKo") y quedaban como
 * "MaKo - WhatsApp de MaKo". El producto se nombra una vez.
 *
 * ⚠️ Y EL NOMBRE SALE COMO LO VA A DEVOLVER `document.title` (revisión del 12/10/2026):
 * sin espacios en las puntas ni repetidos. El navegador los saca al leerlo, y
 * TituloTab compara lo que lee con esto para decidir si reescribe: con «/reportes-»
 * (un link roto) el título era «MaKo - Reportes », la comparación no daba igual
 * NUNCA y su MutationObserver reescribía sin fin, con la pestaña congelada.
 */
function conMarca(label: string): string {
  const limpio = label.replace(/\s+/g, ' ').trim();
  if (!limpio) return MARCA;
  return /\bmako\b/i.test(limpio) ? limpio : `${MARCA} - ${limpio}`;
}

/**
 * EL TÍTULO DE LA PESTAÑA EN UN 404 (9/11/2026).
 *
 * ⚠️ NO sale de `tituloDe`, y ése es todo el punto. `desdeLaRuta` existe como red de seguridad para una ruta
 * sin entrada en el nav, y en una ruta que NO EXISTE esa red INVENTA: `hola-mako.com/esta-ruta-no-existe-7nov`
 * titulaba «MaKo - Esta ruta no existe 7nov», que se lee como el nombre de una pantalla real. Lo dejó anotado
 * la pantalla que arregló el 404 (`app/not-found.tsx`, 7/11) como «otro ítem», porque arreglarlo toca el
 * camino de TODAS las rutas y no se cuelga de una pantalla.
 *
 * Y un título no es decoración: es lo que queda en el historial, en la lista de pestañas y en lo que alguien
 * manda por WhatsApp cuando dice «no me anda esto». Un nombre inventado ahí se guarda como si el lugar
 * existiera, y después nadie puede decir si la dirección estaba mal o si la pantalla se cayó.
 */
export const TITULO_NO_ENCONTRADO = conMarca('Esta dirección no existe');

/**
 * Pantallas del teléfono que se titulan como SU URL de escritorio (17/10/2026, «Mobile 2»): una «Coming soon»
 * (/m/pronto/closing-script es «Closing Script») y cada sección de «Configuración del negocio» (/m/configuraciones/equipo
 * es «Equipo», como /equipo). Sin esto caían en el prefijo de su dueño (`/m` → «MaKo» a secas).
 */
const COMO_ESCRITORIO = /^\/m\/(?:pronto|configuraciones)\/[^/]+$/;

export function tituloDe(pathname: string): string {
  if (pathname === '/login') return MARCA;
  if (COMO_ESCRITORIO.test(pathname)) {
    const escritorio = rutaEscritorio(pathname).split('?')[0];
    if (escritorio !== pathname) return tituloDe(escritorio);
  }
  for (const k of EXTRA_KEYS) if (pathname === k || pathname.startsWith(k + '/')) return conMarca(EXTRA[k]);
  // Una sub-ruta de /admin lee el nombre de SU herramienta antes que el de la pantalla de producto que la marca en la
  // barra. Desde el 29/10/2026 Strategy y Offer Playbook viven al pie de Offer: dejaron de ser secciones, que ganaban
  // por ir antes. La tab sigue marcándose (su `match` las incluye),
  // pero el título es de la herramienta. Una sub-ruta sin ítem propio sigue cayendo en «Admin» (tests/notificaciones).
  const deAdmin = pathname.startsWith('/admin/') ? ADMIN_NAV.find((i) => i.match(pathname)) : undefined;
  const item = deAdmin ?? TODOS.find((i) => i.match(pathname));
  const label = item?.label ?? desdeLaRuta(pathname);
  return label ? conMarca(label) : MARCA;
}
