// =============================================================================
// Los outliers de landings: las CAPTURAS LARGAS y el relevo que sale de ellas (11/11/2026)
// =============================================================================
// Aparte de ./landing-outliers.ts (lo liviano: tipos y reglas, que usa la pantalla del navegador) para que el manifiesto
// (./landing-outliers-capturas.json, decenas de landings con su titular y por qué funcionan) NO viaje en el JavaScript de la
// portada: lo leen el server (./landing-outliers-servidor.ts) y los tests. Puro (sin `server-only`).
//
// LAS CAPTURAS LARGAS (11/11/2026, Martín: «Me parece muy poco 22 páginas… La tarjeta de una web tiene que ser mucho más grande,
// y si paso el cursor por arriba poder scrollearla»). Cada landing que entra a la portada tiene su captura de la página ENTERA
// (scripts/capturas-outliers-landings.mjs: Chrome por CDP, por tramos, con los carteles de cookies y los chats escondidos), MIRADA
// antes de entrar; las que quedaron afuera, con su motivo, en docs/web-generator/outliers-capturas-afuera.md. Salen de tres lados:
//   · `relevo`: las landings de gurús y referentes del nicho (docs/web-generator/outliers-landings.md);
//   · `documento`: las de la competencia de cada función de MaKo (docs/competencia/landings-por-funcion.md);
//   · `spy`: las de los competidores que siguen los negocios en Competitors Spy (páginas públicas; no se dice quién las sigue).
// Sin una captura que se vea, una landing NO entra («viralidad.com, un recuadro negro con un logo» era la tarjeta vieja, su imagen
// para compartir: la captura larga muestra su VSL). Una entrada nueva del script llega con `revisar` hasta que alguien la mira y le
// escribe por qué funciona: hasta entonces no se muestra.
// =============================================================================

import CAPTURAS_JSON from './landing-outliers-capturas.json';
import { clavePagina, type OutlierLanding, type TipoLanding } from './landing-outliers';

export type CapturaLarga = {
  id: string; url: string; fuente: 'relevo' | 'documento' | 'spy';
  nombre: string; nicho: string; tipo: TipoLanding; idioma: 'es' | 'en'; titulo: string; porque: string;
  /** Alto de la imagen guardada (640 de ancho). */
  alto: number;
  kb?: number;
  /** Recién capturada por el script, sin mirar: no se muestra. */
  revisar?: boolean;
};
export const CAPTURAS: readonly CapturaLarga[] = (CAPTURAS_JSON as CapturaLarga[]).filter((c) => !c.revisar && c.porque.trim());
/** La captura larga: public/web-generator/outliers/largas/<id>.webp. */
export const imagenLarga = (id: string): string => `/web-generator/outliers/largas/${id}.webp`;

const POR_URL = new Map(CAPTURAS.map((c) => [clavePagina(c.url), c] as const));
/** La captura larga de una página por su dirección (una de la competencia del negocio en Spy), o null si no hay. */
export const capturaDe = (url: string): CapturaLarga | null => POR_URL.get(clavePagina(url)) ?? null;

const ORDEN_FUENTE: Record<CapturaLarga['fuente'], number> = { relevo: 0, spy: 1, documento: 2 };
/** En español primero (la mayoría de los negocios de MaKo vende en español); dentro, el relevo, Spy y el documento. */
export const RELEVO_LANDINGS: readonly OutlierLanding[] = [...CAPTURAS]
  .sort((a, b) => (a.idioma === b.idioma ? 0 : a.idioma === 'es' ? -1 : 1) || ORDEN_FUENTE[a.fuente] - ORDEN_FUENTE[b.fuente])
  .map((c) => ({
    id: `relevo:${c.id}`, fuente: 'relevo', url: c.url, titulo: c.titulo, quien: { nombre: c.nombre, nicho: c.nicho, competidorId: null },
    tipo: c.tipo, porque: c.porque, imagen: imagenLarga(c.id), alto: c.alto, idioma: c.idioma,
  }));
