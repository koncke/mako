// =============================================================================
// Dónde NO hace falta la estrella que monta la barra (1/11/2026)
// =============================================================================
// Sólo donde ya hay un chat de MaKo a la vista: otra estrella al lado abriría una segunda conversación encima de la que la
// persona ya tiene. Sin `server-only` para que lo mire un test.

import { esPublica } from './rutas-publicas';

export const CON_CHAT_A_LA_VISTA = [
  '/second-brain', '/mako', '/mako-doer', '/admin/operaciones', // el Ops Center: es el chat
  '/offer',                                                     // el Offer Coach
  '/copywriter', '/image-editor', '/video-editor', '/ai-avatar', // Create: el chat de MaKo fijo a la izquierda
  '/video-generator', '/web-generator',                         // sus estudios, con su chat
  '/automations',                                               // su chat en la lista
  '/onboarding',                                                // la conversación de arranque
  '/m',                                                         // el teléfono: su propia pantalla, sin esta barra
] as const;

export function llevaEstrellaDeLaApp(pathname: string): boolean {
  // Lo público (/privacidad, /planes y sus pantallas de pago): la barra se dibuja, pero un visitante no tiene con quién hablar.
  if (esPublica(pathname)) return false;
  return !CON_CHAT_A_LA_VISTA.some((r) => pathname === r || pathname.startsWith(`${r}/`));
}
