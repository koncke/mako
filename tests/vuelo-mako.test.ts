// =============================================================================
// Al terminar de cargar, la criatura de MaKo vuela a SU lugar en la pantalla, con el movimiento del Ops Center (23/10/2026)
// =============================================================================
// Martín, 23/10/2026: «Todos los loaders que tengan la figura de MaKo, luego de terminar de cargar, la figura de MaKo se debe ir
// a su lugar, como lo hace en ops center... En Automations se puede ir a su chat, lo mismo que en CRM a su botón de abajo».
// Fija:
//   · el movimiento es UNO (app/_ui/vuelo-mako.ts) y lo usan las tres entradas: el teléfono, el Ops Center y las tabs;
//   · adónde va en cada pantalla (`DESTINOS_CASA`, en orden) y que esos lugares sigan existiendo donde viven;
//   · cuándo NO vuela (carga corta, sin lugar, movimiento reducido, una entrada propia);
//   · la copia que vuela no toma clics.
// Verificado en producción (23/10, /crm, inyectado en la pestaña): aterriza en el centro de la estrella de abajo, con su ancho,
// y `elementFromPoint` debajo de la copia da la página.
// ROTURAS (23/10/2026, una por vez y restaurada; base 6 / 0): el último cuadro sin fundirse → 5 / 1; `casaVisible` sin saltear
// lo que está adentro del loader → 5 / 1; `motivoSinVuelo` sin el chequeo de movimiento reducido → 5 / 1; la copia sin
// `pointer-events:none` → 5 / 1; EntradaOps con su propio `.animate(` → 5 / 1.
// Correr: node --import tsx --test tests/vuelo-mako.test.ts
// =============================================================================
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { MS_SALIDA, MS_SALIDA_QUIETA, cuadrosDelVuelo, trayecto, volar } from '../app/_ui/vuelo-mako';
import { DESTINOS_CASA, casaVisible, motivoSinVuelo } from '../app/_ui/VueloDeCarga';

const RAIZ = join(dirname(fileURLToPath(import.meta.url)), '..');
const leer = (rel: string) => readFileSync(join(RAIZ, rel), 'utf8').replace(/\r\n/g, '\n');
const sinComentarios = (src: string) => src.replace(/^[ \t]*\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '').replace(/\{\/\*[\s\S]*?\*\/\}/g, '');

test('el movimiento es el del Ops Center: a su lugar con su tamaño, y en el último 15 % se funde', () => {
  const capa = { left: 700, top: 300, width: 60, height: 60 };
  const t = trayecto({ left: 700, top: 300, width: 60, height: 60 }, { left: 260, top: 598, width: 56, height: 56 }, capa)!;
  assert.equal(t.origen, '30px 30px');
  assert.equal(t.fin, `translate(${288 - 730}px, ${626 - 330}px) scale(${56 / 60})`);
  assert.deepEqual(cuadrosDelVuelo(t, false), [{ transform: 'none', opacity: 1 }, { transform: t.fin, opacity: 1, offset: 0.85 }, { transform: t.fin, opacity: 0 }]);
  // Sin lugar, se achica y se funde; quieta, sólo se funde.
  assert.deepEqual(cuadrosDelVuelo(null, false), [{ transform: 'none', opacity: 1 }, { transform: 'scale(.85)', opacity: 0 }]);
  assert.deepEqual(cuadrosDelVuelo(null, true), [{ transform: 'none', opacity: 1 }, { transform: 'none', opacity: 0 }]);
  const pedidos: Array<{ k: unknown; o: KeyframeAnimationOptions }> = [];
  const el = { style: {} as Record<string, string>, animate: (k: unknown, o: KeyframeAnimationOptions) => { pedidos.push({ k, o }); } } as unknown as HTMLElement;
  assert.equal(volar(el, t, false), MS_SALIDA);
  assert.equal(MS_SALIDA, 420);
  assert.deepEqual(pedidos[0].o, { duration: 420, easing: 'cubic-bezier(.16,.84,.34,1)', fill: 'forwards' });
  assert.equal((el.style as unknown as Record<string, string>).transformOrigin, '30px 30px');
  assert.equal(volar(el, null, true), MS_SALIDA_QUIETA);
});

/** Un elemento de mentira: su caja y si está adentro de un loader. */
function el(nombre: string, caja: { x: number; y: number; w: number; h: number }, enLoader = false) {
  return {
    nombre,
    closest: (s: string) => (s === '.cm-carga' && enLoader ? {} : null),
    getBoundingClientRect: () => ({ left: caja.x, top: caja.y, width: caja.w, height: caja.h, right: caja.x + caja.w, bottom: caja.y + caja.h }),
  };
}
function doc(porSelector: Record<string, ReturnType<typeof el>[]>) {
  return { querySelectorAll: (s: string) => (porSelector[s] ?? []) } as unknown as Document;
}

test('adónde va: el primer lugar que SE VE, en orden; nunca uno escondido, fuera de pantalla o adentro del loader', () => {
  // Lo marcado a mano gana; si está escondido (0×0), se saltea y sigue la lista.
  const [selCasa, selCab] = DESTINOS_CASA;
  const cab = el('cabecera', { x: 900, y: 20, w: 30, h: 30 });
  assert.equal((casaVisible(doc({ [selCasa]: [el('casa', { x: 300, y: 20, w: 26, h: 26 })], [selCab]: [cab] }), 670, 1536) as unknown as { nombre: string }).nombre, 'casa');
  assert.equal((casaVisible(doc({ [selCasa]: [el('casa escondida', { x: 0, y: 0, w: 0, h: 0 })], [selCab]: [cab] }), 670, 1536) as unknown as { nombre: string }).nombre, 'cabecera');
  const estrella = el('estrella', { x: 260, y: 598, w: 56, h: 56 });
  const chat = el('chat', { x: 40, y: 80, w: 30, h: 30 });
  const chatEscondido = el('chat escondido', { x: 0, y: 0, w: 0, h: 0 });
  const [, , selChat, selEstrella, selBarra] = DESTINOS_CASA;
  // El chat de Automations le gana a la estrella; escondido (la lista está arriba), va a la estrella.
  assert.equal((casaVisible(doc({ [selChat]: [chat], [selEstrella]: [estrella] }), 670, 1536) as unknown as { nombre: string }).nombre, 'chat');
  assert.equal((casaVisible(doc({ [selChat]: [chatEscondido], [selEstrella]: [estrella] }), 670, 1536) as unknown as { nombre: string }).nombre, 'estrella');
  // Fuera de la pantalla (la estrella debajo del pliegue de una ventana chica), no.
  assert.equal(casaVisible(doc({ [selEstrella]: [el('abajo', { x: 260, y: 900, w: 56, h: 56 })] }), 670, 1536), null);
  // La criatura del propio loader no es su lugar.
  assert.equal(casaVisible(doc({ [selBarra]: [el('del loader', { x: 10, y: 10, w: 24, h: 24 }, true)] }), 670, 1536), null);
  // Sin ningún lugar (Chats, Calendario…): null, y se va como siempre.
  assert.equal(casaVisible(doc({}), 670, 1536), null);
});

test('cuándo NO vuela: carga corta, sin de dónde, entrada propia, movimiento reducido', () => {
  const desde = { left: 700, top: 300, width: 60, height: 60 };
  assert.equal(motivoSinVuelo({ desde, visibleMs: 900, entradaPropia: false, quieta: false }), null);
  assert.equal(motivoSinVuelo({ desde, visibleMs: 200, entradaPropia: false, quieta: false }), 'no llegó a verse');
  assert.equal(motivoSinVuelo({ desde: null, visibleMs: 900, entradaPropia: false, quieta: false }), 'no hay de dónde');
  assert.equal(motivoSinVuelo({ desde, visibleMs: 900, entradaPropia: true, quieta: false }), 'la pantalla tiene su entrada');
  assert.equal(motivoSinVuelo({ desde, visibleMs: 900, entradaPropia: false, quieta: true }), 'movimiento reducido');
});

test('los lugares de la lista existen donde viven (si uno se renombra, la criatura deja de llegar)', () => {
  assert.deepEqual([...DESTINOS_CASA], ['[data-mako-casa]', '.co-cab__muneco', '[data-chat-sidebar] [role="img"][aria-label="MaKo"]', '.ch-tab-mako', '[data-mako-foto-barra]']);
  // La cabecera de un chat del Ops Center (y la del chat del grafo del Second Brain, que usa la misma).
  assert.match(leer('app/second-brain/EntradaOps.tsx'), /export const DESTINO_ENTRADA_OPS = '\.co-cab__muneco';/);
  assert.match(leer('app/_chat/MakoEnLaTab.tsx'), /<button type="button" className="ch-tab-mako"/);
  assert.match(leer('app/automations/SecuenciaPerfil.tsx'), /data-chat-sidebar=""/);
  assert.match(leer('app/automations/ChatMako.tsx'), /<span role="img" aria-label="MaKo"[^>]*><Muneco titulo="MaKo"/);
  assert.match(leer('app/m/_ui/ShellM.tsx'), /const DESTINO_ENTRADA = 'data-mako-foto-barra';/);
});

test('la copia que vuela no toma clics, y el loader monta el vigía', () => {
  const v = sinComentarios(leer('app/_ui/VueloDeCarga.tsx'));
  assert.match(v, /capa\.style\.cssText = `position:fixed;[^`]*pointer-events:none;[^`]*`;/);
  assert.match(v, /capa\.setAttribute\('aria-hidden', 'true'\);/);
  assert.match(sinComentarios(leer('app/_ui/CargandoMako.tsx')), /<VigiaVuelo \/>\n\s*<\/div>\n\s*\);/);
});

test('el movimiento es UNO: el teléfono y el Ops Center vuelan con la misma pieza, sin una copia propia', () => {
  for (const f of ['app/m/_ui/EntradaApp.tsx', 'app/second-brain/EntradaOps.tsx']) {
    const src = sinComentarios(leer(f));
    assert.match(src, /const ms = volar\(v, t, quieta\);/, `${f} no vuela con volar()`);
    assert.doesNotMatch(src, /\.animate\(/, `${f} volvió a tener su propia animación`);
  }
});
