// =============================================================================
// La guía: los huecos del velo y dónde va la frase (29/10/2026, G1 de docs/mako-iniciativa/guia.md §2.3 y §2.4)
// =============================================================================
// El velo «un poco opaco» deja a la vista lo que se señala Y el chat: con la guía puesta se usa la tab y se le escribe a MaKo.
//   1. los huecos: el ancla (con su aire) y cada chat; un ancla adentro del chat no suma hueco; dos chats que se pisan, uno;
//   2. la frase nunca va encima de un chat (se lo taparía a quien le escribe);
//   4. con la pregunta ADENTRO del chat (11/11/2026, Image): la frase no tapa la caja de escribir del chat. El velo le pasa esa
//      caja (`CAJA_DE_ESCRIBIR`, app/_ui/guia/VeloGuia.tsx); antes no le pasaba nada y la frase caía encima de «Escríbele a MaKo».
//   3. el velo, por fuente: máscara SVG con el `--scrim` de la casa, sin `color-mix`, sin comerse un clic, fuera de la pila de
//      modales (el piso de los recorridos), y Escape pausa sólo sin un modal.
//
// Correr: node --import tsx --test tests/guia-huecos.test.ts
// PROBADO ROMPIÉNDOLO (base 3/0), ver la cosecha (docs/hallazgos-ui.md).
// =============================================================================
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { esAngosta, huecosDelVelo, posicionFrase } from '../lib/guia/huecos';

const RAIZ = join(dirname(fileURLToPath(import.meta.url)), '..');
const leer = (r: string) => readFileSync(join(RAIZ, r), 'utf8').replace(/\r\n/g, '\n');
const V = { ancho: 1440, alto: 900 };
const CHAT = { x: 80, y: 12, ancho: 440, alto: 876 };
const seTocan = (a: { x: number; y: number; ancho: number; alto: number }, b: typeof a) => a.x < b.x + b.ancho && b.x < a.x + a.ancho && a.y < b.y + b.alto && b.y < a.y + a.alto;

test('1. los huecos: el ancla con su aire y el chat; adentro del chat, sólo el aro; dos chats que se pisan, uno', () => {
  const ancla = { x: 900, y: 300, ancho: 120, alto: 36 };
  const h = huecosDelVelo(ancla, [CHAT], V);
  assert.equal(h.length, 2, 'el chat y el ancla');
  const delAncla = h.find((x) => x.ancla)!;
  assert.ok(delAncla.x < ancla.x && delAncla.ancho > ancla.ancho, 'el recorte lleva aire, como el de los recorridos');
  assert.equal(huecosDelVelo({ x: 120, y: 800, ancho: 100, alto: 40 }, [CHAT], V).length, 1, 'el ancla adentro del chat no suma hueco');
  assert.equal(huecosDelVelo(null, [CHAT, { x: 500, y: 100, ancho: 300, alto: 300 }], V).length, 1, 'dos chats que se pisan: uno');
  assert.equal(huecosDelVelo(null, [CHAT, { x: 1000, y: 100, ancho: 300, alto: 300 }], V).length, 2);
  assert.equal(huecosDelVelo(null, [{ x: 0, y: 0, ancho: 0, alto: 0 }], V).length, 0, 'un chat escondido no deja hueco');
  assert.equal(esAngosta(700), true);
  assert.equal(esAngosta(1024), false);
});

test('2. la frase va al lado del ancla y NUNCA encima de un chat', () => {
  const frase = { ancho: 260, alto: 40 };
  // Un ancla pegada al chat por la derecha: la frase no puede ir a la izquierda (taparía el chat).
  const ancla = { x: 530, y: 400, ancho: 120, alto: 36 };
  const p = posicionFrase({ ancla, frase, ventana: V, chats: [CHAT] });
  assert.ok(!seTocan({ x: p.x, y: p.y, ...frase }, CHAT), `la frase pisa el chat (${p.lado})`);
  assert.ok(!seTocan({ x: p.x, y: p.y, ...frase }, ancla), 'ni el ancla');
  // Sin chat: abajo, que es por donde se lee.
  assert.equal(posicionFrase({ ancla: { x: 900, y: 200, ancho: 100, alto: 30 }, frase, ventana: V, chats: [] }).lado, 'abajo');
});

test('3. el velo, por fuente: máscara con huecos, el --scrim, sin color-mix, sin comerse un clic, fuera de la pila', () => {
  const v = leer('app/_ui/guia/VeloGuia.tsx');
  assert.match(v, /<mask id="mk-guia-mascara">/);
  assert.match(v, /style=\{\{ fill: 'var\(--scrim\)' \}\}/, 'el velo de la casa (40%), no --sidebar (en true-north aclararía)');
  const hoja = v.slice(v.indexOf('const CSS = `'));
  assert.doesNotMatch(hoja, /color-mix/, 'en Safari < 16.2 color-mix borra la capa entera');
  assert.match(hoja, /\.mk-guia \{ position: fixed; inset: 0; pointer-events: none; \}/, 'no se come ningún clic');
  assert.match(hoja, /@media \(prefers-reduced-motion: reduce\)/);
  assert.equal((hoja.match(/`/g) ?? []).length, 2, 'la hoja es un template literal: ni un backtick adentro');
  assert.match(v, /style=\{\{ zIndex: Z_PISO_RECORRIDO \}\}/, 'el piso de los recorridos, debajo del toast');
  assert.doesNotMatch(v, /useCapaModal|aria-modal/, 'fuera de la pila de modales: la estrella y «¿hay un modal?» se leerían mal');
  assert.match(v, /if \(ev\.key !== 'Escape' \|\| profundidadModales\(\) > 0\) return;/, 'Escape pausa sólo sin un modal (que es el que cierra)');
  assert.match(v, /if \(que === 'pausa'\) \{ pausar\(\); return; \}/, 'tocar la tab pausa, el toque llega igual');
  assert.doesNotMatch(v, /preventDefault\(\)/, 'nunca frena el toque');
  assert.match(v, /if \(n\.scroll && !ancla\?\.sinScroll\) el\.scrollIntoView/, 'scroll sólo si no se ve, y nunca en un lienzo');
  assert.match(v, /if \(performance\.now\(\) - \(tocoAntes \|\| inicio\) > espera\) noEsta\(/, 'nunca un velo sobre la nada');
});

// PROBADO ROMPIÉNDOLO (29/10/2026, base 3/0):
//   · el ancla adentro del chat suma hueco          → 2/1 (1)
//   · la frase encima del chat                      → 2/1 (2)
//   · el velo se come los clics                     → 2/1 (3)

test('4. con la pregunta adentro del chat, la frase no tapa la caja de escribir (Image, 551 px)', () => {
  // La captura del 10/11 (docs/pruebas/image-10-11/12-guiado-listo-para-generar.jpg): la pregunta termina justo arriba de la caja.
  const ventana = { ancho: 551, alto: 688 };
  const frase = { ancho: 170, alto: 30 };
  const pregunta = { x: 90, y: 230, ancho: 440, alto: 330 };
  const caja = { x: 90, y: 585, ancho: 440, alto: 52 };
  const p = posicionFrase({ ancla: pregunta, frase, ventana, chats: [caja] });
  assert.ok(!seTocan({ x: p.x, y: p.y, ...frase }, caja), `la frase tapa la caja de escribir (${p.lado}, y=${p.y})`);
  // Sin la caja (lo de antes), cae abajo de la pregunta: encima de la caja.
  const antes = posicionFrase({ ancla: pregunta, frase, ventana, chats: [] });
  assert.ok(seTocan({ x: antes.x, y: antes.y, ...frase }, caja), 'el caso ya no reproduce lo que se vio: revisá la geometría');
});
