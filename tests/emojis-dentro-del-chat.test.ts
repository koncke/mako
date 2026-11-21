// =============================================================================
// EL PANEL DE EMOJIS SIEMPRE ADENTRO DE LA PANTALLA Y DEL RECUADRO DEL CHAT (20/11/2026)
// =============================================================================
// Martín, probando el onboarding en producción (ws 3): el desplegable de emojis se abría a la izquierda del botón y quedaba recortado
// contra el borde del chat: media columna de caritas y la grilla cortada. El panel era `position: absolute` con `left: -46px` fijo
// (app/admin/operaciones/centro.css): con la carita cerca del borde, el recuadro del chat (su `overflow`) lo cortaba, y a 375 la
// pantalla. Ahora, al abrirse, se mide: el botón, y lo que lo recorta (cada antepasado con `overflow` y la pantalla), y el panel se
// acomoda adentro (`lugarDelPanel`, puro). Vale para todas las cajas: es la misma (app/_chat/CajaChat.tsx → BotonEmojis).
//
// ⚠️ PROBADO ROMPIÉNDOLO: ver al pie.
// =============================================================================

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { ALTO_PANEL, ANCHO_PANEL, MARGEN_PANEL, lugarDelPanel } from '../app/admin/operaciones/Emojis';

const fuente = (r: string) => readFileSync(new URL(`../${r}`, import.meta.url), 'utf8').replace(/\r\n/g, '\n');
type Caja = { left: number; top: number; right: number; bottom: number };
/** Dónde queda el panel en la pantalla, con lo que devuelve `lugarDelPanel` (su `left` es relativo al botón; abre hacia arriba). */
const enPantalla = (boton: Caja, limite: Caja) => {
  const l = lugarDelPanel({ boton, limite });
  return { izq: boton.left + l.left, der: boton.left + l.left + l.ancho, arriba: boton.top - 8 - l.altoMax, ...l };
};
const adentro = (p: ReturnType<typeof enPantalla>, limite: Caja, nombre: string) => {
  assert.ok(p.izq >= limite.left + MARGEN_PANEL - 0.001, `${nombre}: se sale por la izquierda (${p.izq} < ${limite.left + MARGEN_PANEL})`);
  assert.ok(p.der <= limite.right - MARGEN_PANEL + 0.001, `${nombre}: se sale por la derecha (${p.der} > ${limite.right - MARGEN_PANEL})`);
  assert.ok(p.arriba >= limite.top + MARGEN_PANEL - 0.001, `${nombre}: se sale por arriba`);
};

test('1. a 1440: con la carita pegada al borde izquierdo del chat (lo que vio Martín), el panel entra entero, sin recortar', () => {
  // El chat del onboarding: una columna de 360 a 1080, la caja abajo; la carita es lo primero de la fila.
  const limite = { left: 360, top: 64, right: 1080, bottom: 900 };
  const boton = { left: 368, top: 836, right: 408, bottom: 876 };
  const p = enPantalla(boton, limite);
  adentro(p, limite, '1440');
  assert.equal(p.ancho, ANCHO_PANEL, 'con lugar, su ancho de siempre');
  assert.equal(p.altoMax, ALTO_PANEL, 'con lugar, su alto de siempre');
  // Con lugar a la izquierda, como antes: 46 px antes del botón.
  const holgado = lugarDelPanel({ boton: { left: 600, top: 836, right: 640, bottom: 876 }, limite });
  assert.equal(holgado.left, -46);
});

test('2. a 375: entra en la pantalla con su margen, y en un recuadro angosto se achica al recuadro', () => {
  const pantalla = { left: 0, top: 0, right: 375, bottom: 812 };
  const p = enPantalla({ left: 2, top: 748, right: 46, bottom: 792 }, pantalla);
  adentro(p, pantalla, '375');
  assert.equal(p.ancho, ANCHO_PANEL, '340 entran en 375 con sus márgenes');
  // Un panel lateral de 300 de ancho: el panel no pasa del recuadro.
  const angosto = { left: 1100, top: 64, right: 1400, bottom: 900 };
  const q = enPantalla({ left: 1108, top: 836, right: 1148, bottom: 876 }, angosto);
  adentro(q, angosto, 'recuadro de 300');
  assert.equal(q.ancho, 300 - 2 * MARGEN_PANEL);
});

test('3. con la carita a la derecha, o poco lugar arriba, tampoco se sale: se corre y se acorta', () => {
  const limite = { left: 0, top: 0, right: 1440, bottom: 900 };
  adentro(enPantalla({ left: 1420, top: 836, right: 1460, bottom: 876 }, limite), limite, 'pegada a la derecha');
  const bajo = { left: 0, top: 600, right: 1440, bottom: 900 };
  const p = enPantalla({ left: 400, top: 836, right: 440, bottom: 876 }, bajo);
  adentro(p, bajo, 'poco lugar arriba');
  assert.ok(p.altoMax < ALTO_PANEL && p.altoMax > 0);
  // Barrido: en cualquier lugar del recuadro, adentro.
  for (const ancho of [320, 375, 768, 1440]) {
    const l = { left: 0, top: 0, right: ancho, bottom: 800 };
    for (let x = 0; x <= ancho - 40; x += 7) adentro(enPantalla({ left: x, top: 740, right: x + 40, bottom: 780 }, l), l, `${ancho} @ ${x}`);
  }
});

test('4. el botón mide al abrirse (y al cambiar el tamaño) y le pone al panel su lugar; la grilla se achica con él', () => {
  const e = fuente('app/admin/operaciones/Emojis.tsx');
  assert.match(e, /const l = lugarDelPanel\(\{ boton: w\.getBoundingClientRect\(\), limite: limiteDe\(w\) \}\);\n\s*setLugar\(\{ left: l\.left, width: l\.ancho, maxHeight: l\.altoMax \}\);/);
  assert.match(e, /window\.addEventListener\('resize', medir\);/);
  assert.match(e, /<div className="co-emojis__panel" role="dialog" aria-label="Emojis" style=\{lugar\}>/);
  // Lo que recorta: cada antepasado con `overflow` que no es `visible`, y la pantalla.
  assert.match(e, /if \(s\.overflowX === 'visible' && s\.overflowY === 'visible'\) continue;/);
  const css = fuente('app/admin/operaciones/centro.css');
  assert.match(css, /\.co-emojis__grilla \{[^}]*flex: 1 1 auto; min-height: 0;/, 'la grilla se achica cuando el panel tiene poco alto');
});

// ⚠️ PROBADO ROMPIÉNDOLO (20/11/2026, base 4/0; al restaurar, 4/0). Cada rotura, de a una, cae:
//   - `lugarDelPanel` con el `left: -46` fijo de antes (sin acomodarse) → 1, 2 y 3
//   - sin achicar el ancho al recuadro → 2
//   - sin acortar el alto cuando no hay lugar arriba → 3
//   - el panel sin su `style={lugar}` (se mide y no se usa) → 4
