// =============================================================================
// «Conectar a una tarjeta»: conectar una flecha sin arrastrar (15/10/2026)
// =============================================================================
// Martín, mirando el lienzo con un cliente: «Tuvo el mismo problema que Mauricio, no sabía como conectar la flecha.
// Estoy viendo que fue dificil para 2... Revisa como lo hace Manychat u otros flujos para hacerlo simple».
//
// Lo medido en el código: el ARRASTRE del círculo ya copiaba a ManyChat (soltar en cualquier punto de una tarjeta,
// atenuar el resto, el menú al soltar en el vacío). Lo que faltaba era el CLIC: tocar el círculo ofrecía sólo tarjetas
// NUEVAS. La ayuda de ManyChat («How to build a Manychat automation», help.manychat.com) dice que se conecta «haciendo
// clic en el punto de conexión y eligiendo otro paso»; la app pide cuenta y no hay capturas. Make (Make Academy,
// «Connecting Modules») suma arrastrar el MÓDULO entero hasta otro: acá NO, porque arrastrar una tarjeta es moverla para
// ordenar, y conectarla sin querer es peor que no poder.
//
// Los tests de la casa no tienen DOM (y el gesto usa `elementFromPoint`): se fija sobre el FUENTE sin comentarios.
// PROBADO ROMPIÉNDOLO: ver `ROTURAS` al pie.
// =============================================================================
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const leer = (r: string) => readFileSync(new URL(`../${r}`, import.meta.url), 'utf8').replace(/\r\n/g, '\n');
const sinComentarios = (s: string) => s.replace(/^[ \t]*\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '').replace(/\{\/\*[\s\S]*?\*\/\}/g, '');
const LIENZO = sinComentarios(leer('app/_components/Lienzo.tsx'));
const tramo = (desde: string, hasta: string) => {
  const i = LIENZO.indexOf(desde);
  assert.ok(i >= 0, `no encontré «${desde}»`);
  return LIENZO.slice(i, LIENZO.indexOf(hasta, i + desde.length));
};

test('el clic en el círculo ofrece «Conectar a una tarjeta» PRIMERO, y entonces ya no se agrega solo', () => {
  const clic = tramo('function soltarCirculo(', 'function empezarAElegir(');
  assert.match(clic, /\[\{ id: '__conectar', label: 'Conectar a una tarjeta', grupo: -1,/);
  assert.match(clic, /onElegir: \(\) => \{ setFantasma\(null\); empezarAElegir\(n\.id, g\.fila, g\.sx, g\.sy\); \}/);
  // Con una sola opción de tarjeta nueva se agregaba directo: con «Conectar» hay dos, y se pregunta.
  assert.match(clic, /if \(opciones\.length === 1 && !conectarA\.length\) \{ elegir\(opciones\[0\]\.value\); return; \}/);
  assert.match(clic, /items: \[\.\.\.conectarA, \.\.\.comoItems\(opciones, elegir\)\]/);
});

test('el modo: el toque en una tarjeta conecta, fuera cancela, Esc cancela, y el clic que sigue no abre el editor', () => {
  const modo = tramo('useEffect(() => {\n    if (!eligiendo) return;', '}, [eligiendo]);');
  // En CAPTURA: antes que la tarjeta, que si no se seleccionaría o se arrastraría.
  assert.match(modo, /window\.addEventListener\('pointerdown', tocar, true\);/);
  assert.match(modo, /const sobre = tarjetaBajo\(e\.clientX, e\.clientY, desde\);\n\s*terminar\(\);/);
  assert.match(modo, /if \(sobre\) onConectar\?\.\(desde, fila, sobre\);/);
  assert.match(modo, /if \(e\.key === 'Escape'\) \{ e\.preventDefault\(\); terminar\(\); \}/);
  assert.match(modo, /window\.addEventListener\('click', tragar, \{ capture: true, once: true \}\);/);
  assert.match(modo, /setTimeout\(\(\) => window\.removeEventListener\('click', tragar, true\), 500\);/);
  // Y se desarma: un modo que queda escuchando le roba el próximo clic a cualquier pantalla.
  for (const ev of ["'pointermove', mover", "'pointerdown', tocar, true", "'keydown', tecla"]) {
    assert.ok(modo.includes(`window.removeEventListener(${ev});`), `no se desarma: ${ev}`);
  }
});

test('mientras se elige, las tarjetas NO se atenúan (en el teléfono no hay «pasar por encima») y el aviso dice qué hacer', () => {
  assert.match(LIENZO, /arrastreFlecha && !eligiendo && n\.id !== arrastreFlecha\.desde && n\.id !== sobreFlecha/);
  assert.match(LIENZO, /\{eligiendo && \(\s*<div data-eligiendo-destino role="status"/);
  assert.match(LIENZO, /Toca la tarjeta de destino/);
  assert.match(LIENZO, />Cancelar<\/button>/);
});

test('el círculo: el dibujo de siempre, adentro de un área de toque más grande que no tapa la salida de al lado', () => {
  assert.match(LIENZO, /const TOQUE_CIRCULO = 28;/);
  assert.match(LIENZO, /const toque = Math\.min\(ALTO_PUERTO - 2, Math\.max\(CIRCULO, \(TOQUE_CIRCULO \* 100\) \/ zoomTxt\)\);/);
  assert.match(LIENZO, /left: n\.x \+ n\.ancho - toque \/ 2,/, 'el centro dejó de estar en el borde de la tarjeta');
  assert.match(LIENZO, /width: toque, height: toque, padding: 0, border: 'none', background: 'transparent',/);
  assert.match(LIENZO, /<span data-circulo aria-hidden style=\{\{\s*width: CIRCULO, height: CIRCULO,/);
});

// ── ROTURAS (15/10/2026) ────────────────────────────────────────────────────────────────────────
// Con el arnés del scratchpad (rompe UNA, corre este archivo, restaura DE MEMORIA; nunca git). Base: 4 / 0. Cada una dio
// 3 / 1: sin «Conectar a una tarjeta» en el menú · con una sola opción se agrega directo igual · el toque sin captura · sin
// Esc · el clic de después abre el editor · el modo que no se desarma · las tarjetas atenuadas mientras se elige · el
// círculo sin más área. Restaurado: 4 / 0.
