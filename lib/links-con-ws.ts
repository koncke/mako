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

/** Distancia de edición (inserción, borrado, cambio de una letra). Sólo para hosts: cortos. */
function distancia(a: string, b: string): number {
  let fila = Array.from({ length: b.length + 1 }, (_, j) => j);
  for (let i = 1; i <= a.length; i++) {
    const nueva = [i];
    for (let j = 1; j <= b.length; j++) nueva[j] = Math.min(fila[j] + 1, nueva[j - 1] + 1, fila[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    fila = nueva;
  }
  return fila[b.length];
}

/**
 * EL DOMINIO QUE EL MODELO INVENTA (28/10/2026, el relevamiento de pedidos perdidos: a Código Inmobiliario le salió
 * «hola-malo.com/crm/2761», conv 1502). El modelo reescribe el link de una herramienta y le cambia una letra al dominio; el
 * link lleva a otro sitio. Un host a una o dos letras del de MaKo (`base`), y que no es el de MaKo, se corrige al de MaKo
 * (`hola-malo.com`, `holamako.com`, `hola-mako.co`). Uno distinto de verdad (google.com, el sitio del negocio) no se toca, ni
 * los otros dominios propios (`otros`, p. ej. makodigital.app). Va ANTES de `linksConWs`, que sólo reconoce el host exacto.
 */
export function conElDominioDeMaKo(texto: string, base: string, otros: readonly string[] = []): string {
  if (!texto) return texto;
  let host: string;
  try { host = new URL(base.includes('://') ? base : `https://${base}`).host.replace(/^www\./, '').toLowerCase(); } catch { return texto; }
  const propios = new Set([host, ...otros.map((o) => o.toLowerCase())]);
  return texto.replace(/(https?:\/\/)?(www\.)?((?:[a-z0-9-]+\.)+[a-z]{2,})(?=[/\s]|$)/gi, (todo: string, esquema: string | undefined, www: string | undefined, h: string) => {
    const bajo = h.toLowerCase();
    if (propios.has(bajo)) return todo;
    const d = distancia(bajo, host);
    if (d === 0 || d > 2) return todo;
    return `${esquema ?? ''}${www ?? ''}${host}`;
  });
}

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

/**
 * LO MISMO, PARA TODO LO QUE VA AL GRUPO DE UN NEGOCIO (27/10/2026, Leila, ws11: reenvió «Mira el resumen del lead:
 * hola-mako.com/crm/482/resumen» y al abrirlo, «Este lead no es de esta cuenta»). `linkApp` ya pegaba el `ws` a lo que arma
 * el código; un aviso cuyo texto escribió una persona en su tarjeta («MaKo en WhatsApp», «Avisar al equipo») podía traer el
 * link pelado. Se completa en la SALIDA al grupo (lib/mako-grupo.ts): el texto y el pie de un archivo. Puro.
 */
export function partesConLinksDeWs<T extends { tipo: string; texto?: string; caption?: string }>(partes: readonly T[], ws: number | null, base: string): T[] {
  return partes.map((p) => {
    if (p.tipo === 'texto' && typeof p.texto === 'string') return { ...p, texto: linksConWs(p.texto, ws, base) };
    if (typeof p.caption === 'string') return { ...p, caption: linksConWs(p.caption, ws, base) };
    return p;
  });
}
