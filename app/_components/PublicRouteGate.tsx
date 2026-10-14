'use client';

// =============================================================================
// PublicRouteGate — oculta el "chrome" de la app en la landing pública /vsl
// =============================================================================
// /vsl (y /vsl/<slug>) es una landing de venta PÚBLICA que se renderiza como una
// capa fija a pantalla completa. El chrome de la app (toast de gasto de IA,
// notificaciones de WhatsApp, banner de impersonación) NO debe aparecer ahí bajo
// ningún concepto: son avisos internos del dueño/admin. Este gate desmonta esos
// componentes en rutas públicas para que ni se rendericen ni polleen.

import { usePathname } from 'next/navigation';
import type { ReactNode } from 'react';
import { RUTA_ALUMNO } from '@/lib/rutas-publicas';
import { esRutaMovil } from '@/lib/movil-rutas';

/** ¿La ruta es una landing pública? (no debe mostrar chrome de la app). */
export function isPublicLandingPath(pathname: string | null | undefined): boolean {
  const p = pathname ?? '';
  // '/' es la landing de venta. Solo la renderiza quien NO tiene sesión: a los
  // logueados app/page.tsx los redirige a su home según el rol, así que acá
  // nunca hay que mostrarles chrome.
  // '/compartido' es material que se le pasa a alguien de afuera: sin sesión no
  // debe ver el sidebar (con los nombres de las tabs internas) ni disparar los
  // pollers de la app, que además le devolverían 401 en bucle.
  // `/mi-curso` es el cliente de un negocio mirando SU curso con la cookie de alumno
  // (lib/alumno-sesion.ts): no tiene `mako_session`, así que es «alguien de afuera» igual
  // que un link de /compartido — sin sidebar y sin los pollers del WhatsApp del negocio.
  // `/pagar/<token>` es el comprador volviendo de Stripe o Mercado Pago (la página de retorno de un
  // cobro, app/pagar): no tiene sesión, y los pollers de la app le darían 401 en bucle.
  return p === '/' || p === '/vsl' || p.startsWith('/vsl/') || p === '/compartido' || p.startsWith('/compartido/') || p === RUTA_ALUMNO || p.startsWith('/pagar/');
}

/**
 * ¿Esta pantalla se muestra SIN el chrome de la app (sidebar, banners, toasts)?
 *
 * Son dos cosas distintas y por eso hay dos predicados: `isPublicLandingPath`
 * responde «¿la puede ver alguien de afuera?» —y es lo que gobierna los pollers,
 * que sin sesión devolverían 401 en bucle—; éste responde «¿esta pantalla se
 * dibuja sola?». Toda landing pública cumple las dos, pero al revés no: el
 * resumen del lead exige sesión y aun así va limpio.
 *
 * El caso que lo trajo: el link que MaKo manda por WhatsApp antes y después de
 * cada reunión se abre EN EL CELULAR, con la reunión por empezar. Ahí el sidebar
 * se come el ancho (no tiene tratamiento móvil: el riel es fijo) y, peor,
 * `MakoConfirmGate` tapaba `/crm*` entero con un modal bloqueante — así que la
 * pantalla que existe para leerse de un vistazo arrancaba tapada. Ese modal ya no
 * bloquea (25/09), pero su tarjeta tampoco pinta acá: esta vista es para leer.
 */
export function esVistaSinChrome(pathname: string | null | undefined): boolean {
  const p = pathname ?? '';
  return isPublicLandingPath(p)
    || /^\/crm\/\d+\/resumen\/?$/.test(p)
    // La ventana de prueba que se abre ENCIMA de la landing mientras se prueba el
    // tracking. Mide 440 px: el riel del sidebar es fijo y se come un cuarto del
    // ancho para navegar a lugares a los que nadie va a ir desde acá — lo único
    // que se hace en esta ventana es mirar entrar eventos y cerrarla.
    || /^\/integraciones\/escuchando\/?$/.test(p)
    // ⚠️ El Video Editor YA NO está acá. Iba a pantalla completa como CapCut (diseño
    // §9) y Martín pidió lo contrario el 12/10 («que la barra lateral no desaparezca
    // del todo mientras se edita», validado el 13/10): el editor se dibuja adentro
    // del chrome de MaKo, con la barra lateral y la de secciones. Pantalla completa
    // sigue existiendo, pero a pedido (el botón del reproductor).
    // MaKo Mobile (/m) dibuja SU cromo (header y barra inferior, app/m/layout.tsx):
    // el Sidebar, los banners y la esquina de avisos de escritorio no van. NO entra
    // en `isPublicLandingPath`: /m exige sesión, y esa lista significa «público».
    // Por `esRutaMovil` y nunca `startsWith('/m')`, que atrapa /mako, /marketing y
    // la ruta PÚBLICA /m.js del Pixel.
    || esRutaMovil(p);
}

/** Renderiza a sus hijos SOLO en las pantallas que sí llevan el chrome de la app. */
export function HideOnPublicLanding({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  if (esVistaSinChrome(pathname)) return null;
  return <>{children}</>;
}
