'use client';

// =============================================================================
// VueloDeCarga — cuando un loader de tab termina, la criatura de MaKo vuela a SU lugar en esa pantalla (23/10/2026)
// =============================================================================
// Martín, 23/10/2026: «Todos los loaders que tengan la figura de MaKo, luego de terminar de cargar, la figura de MaKo se debe ir
// a su lugar, como lo hace en ops center... En Automations se puede ir a su chat, lo mismo que en CRM a su botón de abajo».
//
// Cómo: CargandoMako (./CargandoMako.tsx) monta este vigía, que la PRIMERA vez instala un observador del documento y queda
// vivo (no se desmonta con el loader: el loader se va justo cuando llega la página). Mientras haya un loader con la criatura,
// anota cada cuadro dónde está. Cuando el último se va (Next reemplazó el loading.tsx por la página, o la página dejó su
// propio CargandoMako), busca el lugar de la criatura en la pantalla nueva (`DESTINOS_CASA`) y hace volar una copia desde
// donde estaba, con el movimiento EXACTO del Ops Center (./vuelo-mako.ts). La copia no toma clics: la pantalla ya se usa
// mientras vuela.
//
// No vuela (y se va como siempre, de golpe) si: la carga fue tan corta que la criatura no llegó a verse; la pantalla nueva no
// tiene un lugar para ella (Chats, Calendario, Web Generator, Ads Manager, Video, Image, Copywriting, Offer); pide movimiento
// reducido; o la pantalla tiene su propia entrada que ya vuela (la del Ops Center, `.eo-capa`, y la del teléfono, `.ea-capa`).
// =============================================================================

import { useEffect } from 'react';
import { MS_APARECE } from './cargando-mako-reglas';
import { movimientoReducido, trayecto, volar } from './vuelo-mako';

/**
 * Dónde vive la criatura en cada pantalla, en orden: el primero que se VE gana.
 *   · `[data-mako-casa]`: el lugar que una pantalla marca a mano (lo nuevo entra por acá, sin tocar esta lista). Automations
 *     lo pone en la figura de MaKo de la cabecera de su lista, que abre el chat (acordado con su chat el 23/10/2026);
 *   · la criatura de la cabecera de un chat del Ops Center (`.co-cab__muneco`): la misma del Ops Center y la del chat de MaKo
 *     del grafo del Second Brain (acordado con el chat del Ops Center el 23/10/2026; con menos de 1100 px esa columna está
 *     plegada y no se ve: se funde);
 *   · la criatura del chat de Automations (la sidebar del lienzo, app/automations/ChatMako.tsx);
 *   · la estrella de abajo de cada tab, «Escríbele a MaKo» (app/_chat/MakoEnLaTab.tsx): CRM, Plan, General, Clients…;
 *   · en el teléfono, la criatura del Ops Center en la barra de abajo (app/m/_ui/ShellM.tsx, la misma de EntradaApp).
 */
export const DESTINOS_CASA = [
  '[data-mako-casa]',
  '.co-cab__muneco',
  '[data-chat-sidebar] [role="img"][aria-label="MaKo"]',
  '.ch-tab-mako',
  '[data-mako-foto-barra]',
] as const;

/** Las entradas que ya vuelan solas: con una de éstas en pantalla, el vigía no hace nada. */
export const ENTRADAS_PROPIAS = '.eo-capa, .ea-capa';

/** Cuánto se espera a que aparezca el lugar en la pantalla nueva (la estrella de abajo se monta después de la página). */
export const MS_BUSCAR_CASA = 800;
/** Un loader que se va y otro que aparece enseguida (el loading.tsx y el de la página) son UNA carga: no vuela entre ellos. */
export const MS_SIGUE_CARGANDO = 120;

type Caja = { left: number; top: number; width: number; height: number };
type Doc = Pick<Document, 'querySelectorAll'>;

/** El lugar de la criatura que se VE en la pantalla, o null. Nunca uno que esté adentro de un loader. */
export function casaVisible(doc: Doc, alto: number, ancho: number): Element | null {
  for (const sel of DESTINOS_CASA) {
    for (const el of Array.from(doc.querySelectorAll(sel))) {
      if (el.closest('.cm-carga')) continue;
      const r = el.getBoundingClientRect();
      if (r.width > 0 && r.height > 0 && r.bottom > 0 && r.right > 0 && r.top < alto && r.left < ancho) return el;
    }
  }
  return null;
}

/** ¿Vuela? `null` = sí; si no, por qué no (se va como siempre). */
export function motivoSinVuelo(p: { desde: Caja | null; visibleMs: number; entradaPropia: boolean; quieta: boolean }): string | null {
  if (!p.desde || p.desde.width <= 0) return 'no hay de dónde';
  // La criatura aparece a los 150 ms y tarda 200 en verse entera: antes de eso no se vio, y volar sería aparecer de la nada.
  if (p.visibleMs < MS_APARECE + 200) return 'no llegó a verse';
  if (p.entradaPropia) return 'la pantalla tiene su entrada';
  if (p.quieta) return 'movimiento reducido';
  return null;
}

let instalado = false;

/** Instala el vigía del documento (una vez). Lo llama VigiaVuelo; exportada para probarla sin React. */
export function instalarVigiaVuelo(): void {
  if (instalado || typeof document === 'undefined' || typeof MutationObserver === 'undefined') return;
  instalado = true;
  let cria: Element | null = null;
  let caja: Caja | null = null;
  let html = '';
  let desdeMs = 0;
  let cuadro = 0;
  let espera = 0;

  const seguir = () => {
    if (cria && cria.isConnected) {
      const r = cria.getBoundingClientRect();
      if (r.width > 0) caja = { left: r.left, top: r.top, width: r.width, height: r.height };
      cuadro = requestAnimationFrame(seguir);
    } else cuadro = 0;
  };

  const despegar = () => {
    espera = 0;
    if (document.querySelector('.cm-carga .cm-carga__cria')) { revisar(); return; }
    const desde = caja;
    const arte = html;
    const visibleMs = performance.now() - desdeMs;
    cria = null; caja = null; html = '';
    if (motivoSinVuelo({ desde, visibleMs, entradaPropia: !!document.querySelector(ENTRADAS_PROPIAS), quieta: movimientoReducido() }) || !desde) return;
    const t0 = performance.now();
    const buscar = () => {
      const casa = casaVisible(document, window.innerHeight, window.innerWidth);
      if (casa) { lanzar(desde, arte, casa); return; }
      if (performance.now() - t0 < MS_BUSCAR_CASA) window.setTimeout(buscar, 50);
    };
    buscar();
  };

  const revisar = () => {
    const c = document.querySelector('.cm-carga .cm-carga__cria');
    if (c) {
      if (!cria) desdeMs = performance.now();
      if (c !== cria) { cria = c; html = c.innerHTML; }
      // También acá y no sólo por cuadro: con la pestaña de fondo `requestAnimationFrame` no corre (medido el 23/10).
      const r = c.getBoundingClientRect();
      if (r.width > 0) caja = { left: r.left, top: r.top, width: r.width, height: r.height };
      if (!cuadro) cuadro = requestAnimationFrame(seguir);
      if (espera) { window.clearTimeout(espera); espera = 0; }
      return;
    }
    if (cria && !espera) espera = window.setTimeout(despegar, MS_SIGUE_CARGANDO);
  };

  new MutationObserver(revisar).observe(document.body, { childList: true, subtree: true });
  revisar();
}

/** La copia que vuela: arriba de todo y SIN tomar clics. */
function lanzar(desde: Caja, arte: string, casa: Element): void {
  const capa = document.createElement('div');
  capa.className = 'cm-vuelo';
  capa.setAttribute('aria-hidden', 'true');
  capa.style.cssText = `position:fixed;left:${desde.left}px;top:${desde.top}px;width:${desde.width}px;height:${desde.height}px;display:flex;pointer-events:none;z-index:2147483000;`;
  capa.innerHTML = arte;
  document.body.appendChild(capa);
  const r = capa.getBoundingClientRect();
  const t = trayecto(desde, casa.getBoundingClientRect(), { left: r.left, top: r.top, width: r.width, height: r.height });
  const ms = volar(capa, t, false);
  window.setTimeout(() => capa.remove(), ms + 30);
}

/** Lo monta CargandoMako. No dibuja nada: la primera vez instala el vigía del documento, que queda vivo. */
export function VigiaVuelo(): null {
  useEffect(() => { instalarVigiaVuelo(); }, []);
  return null;
}
