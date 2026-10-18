// =============================================================================
// links-con-ws — el `?ws=` en los links a MaKo que escribe el MODELO (17/10/2026)
// =============================================================================
// `linkApp` (lib/app-url.ts) le pega el workspace a todo link que arma el CÓDIGO. Lo que no cubre es lo que
// escribe el modelo: MaKo en el grupo de WhatsApp de un negocio cita una pantalla («entra a
// hola-mako.com/crm/2742») acortando o reescribiendo el link que le dio una herramienta. Medido en producción
// el 17/10/2026 en `mako_doer_conv`, la última semana: en el ws1 33 links de 33 con su `?ws=`; en el ws13, 6 de
// 10 SIN él; en el ws15, 4 de 4; en el ws18, 1 de 1. Sin el parámetro, quien toca el link mirando OTRO
// workspace —el equipo de MaKo, una agencia— lo abre en el suyo: «este lead no es de esta cuenta» sobre un
// lead que sí es de ese negocio. Es el cruce «los links con ?ws=» del relevo de seguridad (§4.4).
//
// Se arregla en la SALIDA, sobre el texto entero, con `conWs` (la misma regla de las cinco formas de navegar):
// lo que el modelo escriba, sale con el workspace del grupo. Un link que ya trae su `ws` manda sobre el
// contexto, y la raíz (la portada) no es una pantalla del producto.
//
// SIN `server-only`: puro, con test (tests/links-con-ws.test.ts).
// =============================================================================

import { conWs } from './ws-tab';

/** Lo que cierra un link en un texto de chat: no es parte de la URL (punto final, coma, el `*` del negrita…). */
const COLA = /[.,;:!?)\]}*_>»"'`]+$/;

/**
 * Le pega `?ws=<ws>` a cada link a una pantalla de MaKo (`base`, p. ej. https://hola-mako.com) que no lo tenga.
 * `base` puede venir con o sin `https://` y con o sin `www.`: se reconoce el HOST.
 */
export function linksConWs(texto: string, ws: number | null, base: string): string {
  if (!texto || !ws) return texto;
  let host: string;
  try { host = new URL(base.includes('://') ? base : `https://${base}`).host.replace(/^www\./, ''); } catch { return texto; }
  const hostRe = host.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const re = new RegExp(`(https?:\\/\\/)?(www\\.)?${hostRe}(\\/[^\\s<>]*)`, 'gi');
  return texto.replace(re, (todo: string, esquema: string | undefined, www: string | undefined, camino: string) => {
    const cola = COLA.exec(camino)?.[0] ?? '';
    const ruta = cola ? camino.slice(0, -cola.length) : camino;
    // La portada sola no es una pantalla con datos de un negocio.
    if (!ruta || ruta === '/') return todo;
    const conElWs = conWs(ruta, ws);
    if (conElWs === ruta) return todo;
    return `${esquema ?? ''}${www ?? ''}${host}${conElWs}${cola}`;
  });
}
