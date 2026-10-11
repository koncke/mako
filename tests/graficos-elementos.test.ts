// =============================================================================
// Los elementos que se insertan en el Dashboard (punto 18 del feedback del 11/10/2026): texto, imagen,
// rectángulo, círculo, línea y flecha — app/dashboard/Elemento.tsx y app/api/graficos/imagen/route.ts.
// =============================================================================
//   · La GEOMETRÍA de las formas sale de una función pura: la punta de la flecha apunta a donde dice
//     su dirección, y nada se sale de la caja contando el trazo (un borde cortado por la celda se lee
//     como un dibujo roto).
//   · El COLOR sale de la paleta del TEMA de la hoja (o es la tinta, un token): nunca un hex fijo.
//   · El texto, la imagen y el panel de propiedades, renderizados.
//   · La subida: el tope de la pantalla y el de la ruta son el MISMO número, y la ruta tiene la puerta
//     de /api/graficos y no acepta SVG. ⚠️ Eso último es un guard de CABLEADO (lee el fuente de la
//     ruta): contesta «¿está escrita la puerta?», no «¿la ruta rechaza a un closer?» — eso no lo puede
//     ejecutar un test sin base ni sesión.
// Correr: npx tsx --test tests/graficos-elementos.test.ts
//
// PROBADO ROMPIÉNDOLO (11/10/2026, base en verde: 12 pass / 0 fail; cada rotura con Edit y restaurada de
// memoria, nunca con git; al final, otra vez 12 / 0):
//   1. la punta de la flecha al revés (`haciaElFin` con 'izquierda' en vez de 'derecha') → 1 fail (la
//      dirección de la punta), 11 pass. La caja con trazo sigue en verde: una flecha al revés NO se sale
//      de la caja, y por eso la dirección tiene su propio test.
//   2. el rectángulo sin meterse medio trazo (x = 0) → 2 fail (la caja con trazo y el medio trazo), 10 pass.
//   3. `colorDeElemento` devolviendo siempre la tinta → 3 fail (paleta, SVG y texto), 9 pass.
//   4. `colorDeElemento` sin el respaldo (un índice fuera de la paleta devuelve undefined) → 1 fail, 11 pass.
//   5. un tamaño del texto corrido (l = 22 px) → 1 fail (el texto renderizado), 11 pass.
//   6. `MAX` de la ruta en 6 MB → 1 fail (la subida), 11 pass.
//   7. 'image/svg+xml' agregado al EXT_DE de la ruta → 1 fail (la subida), 11 pass.
//   8. un hex de la paleta de MaKo escrito en el borde del recuadro de la imagen → 1 fail (sin hex), 11 pass.
//   9. `parcheDeDireccion` agrandando SIEMPRE al pasar a vertical (sin mirar si la caja es chata) → 1 fail.
//  10. la imagen pintando `e.url` sin volver a pasarla por `urlDeImagen` → 1 fail (el `javascript:`), 11 pass.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { sanearElemento, type Elemento } from '../lib/graficos-catalogo';
import { paletaDe, PLANTILLAS_TEMA } from '../lib/graficos-temas';
import {
  CuerpoElemento, PropsElemento, SvgElemento, colorDeElemento, geometriaElemento, parcheDeDireccion, problemaDeArchivo,
  MAX_IMAGEN, TAMANOS_TEXTO, TINTA, TRAZO, type FormaSvg,
} from '../app/dashboard/Elemento';

const leer = (r: string): string => readFileSync(new URL(`../${r}`, import.meta.url), 'utf8').replace(/\r\n/g, '\n');
// Las líneas primero y los bloques después (AGENTS.md: un `/*` adentro de un comentario de línea).
const sinComentarios = (s: string): string => s.replace(/^[ \t]*\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '');

const el = (o: Record<string, unknown>): Elemento => sanearElemento({ id: 'e1', ...o })!;
const DIRS = ['derecha', 'izquierda', 'arriba', 'abajo'] as const;
const GROSORES = [1, 2, 3, 4] as const;
const TIPOS_FORMA = ['rectangulo', 'circulo', 'linea', 'flecha'] as const;
const CAJAS: Array<[number, number]> = [[260, 76], [80, 260], [550, 30], [30, 30], [12, 12], [400, 400]];
const TEMA = { plantilla: 'mako', acento: '#aa3366', fuente: null };
const PALETA = paletaDe(TEMA);

/** Cuánto ocupa una forma contando el trazo `s`: [minX, minY, maxX, maxY]. */
function extension(f: FormaSvg, s: number): [number, number, number, number] {
  if (f.f === 'rect') return [f.x - s / 2, f.y - s / 2, f.x + f.w + s / 2, f.y + f.h + s / 2];
  if (f.f === 'elipse') return [f.cx - f.rx - s / 2, f.cy - f.ry - s / 2, f.cx + f.rx + s / 2, f.cy + f.ry + s / 2];
  if (f.f === 'linea') {
    // La punta redondeada sobresale medio trazo en todas direcciones desde cada extremo.
    return [Math.min(f.x1, f.x2) - s / 2, Math.min(f.y1, f.y2) - s / 2, Math.max(f.x1, f.x2) + s / 2, Math.max(f.y1, f.y2) + s / 2];
  }
  const xs = f.puntos.map((p) => p[0]), ys = f.puntos.map((p) => p[1]);
  return [Math.min(...xs), Math.min(...ys), Math.max(...xs), Math.max(...ys)];
}

test('la flecha apunta a donde dice su dirección: la punta está en ESE borde y el tallo sale del opuesto', () => {
  const [W, H] = [260, 76];
  for (const d of DIRS) {
    const formas = geometriaElemento('flecha', d, 2, W, H);
    assert.equal(formas.length, 2, `${d}: tallo + punta`);
    const tallo = formas.find((f) => f.f === 'linea')!;
    const punta = formas.find((f) => f.f === 'punta')!;
    assert.ok(tallo && punta && tallo.f === 'linea' && punta.f === 'punta');
    const [tip] = punta.puntos;
    const otros = punta.puntos.slice(1);
    if (d === 'derecha') { assert.ok(tip[0] > W - 3 && Math.abs(tip[1] - H / 2) < 0.01, `derecha: ${tip}`); assert.ok(otros.every((p) => p[0] < tip[0])); assert.ok(tallo.x1 < tallo.x2); }
    if (d === 'izquierda') { assert.ok(tip[0] < 3 && Math.abs(tip[1] - H / 2) < 0.01, `izquierda: ${tip}`); assert.ok(otros.every((p) => p[0] > tip[0])); assert.ok(tallo.x1 > tallo.x2); }
    if (d === 'arriba') { assert.ok(tip[1] < 3 && Math.abs(tip[0] - W / 2) < 0.01, `arriba: ${tip}`); assert.ok(otros.every((p) => p[1] > tip[1])); assert.ok(tallo.y1 > tallo.y2); }
    if (d === 'abajo') { assert.ok(tip[1] > H - 3 && Math.abs(tip[0] - W / 2) < 0.01, `abajo: ${tip}`); assert.ok(otros.every((p) => p[1] < tip[1])); assert.ok(tallo.y1 < tallo.y2); }
    // El tallo termina ADENTRO de la punta (un píxel): no queda un hueco entre los dos.
    const base = otros[0];
    if (d === 'derecha') assert.ok(tallo.x2 > base[0]);
    if (d === 'izquierda') assert.ok(tallo.x2 < base[0]);
    if (d === 'arriba') assert.ok(tallo.y2 < base[1]);
    if (d === 'abajo') assert.ok(tallo.y2 > base[1]);
  }
});

test('ninguna forma se sale de la caja contando el trazo, en ningún tamaño, dirección ni grosor', () => {
  for (const tipo of TIPOS_FORMA) for (const d of DIRS) for (const g of GROSORES) for (const [W, H] of CAJAS) {
    const s = TRAZO[g];
    for (const f of geometriaElemento(tipo, d, g, W, H)) {
      const [x0, y0, x1, y1] = extension(f, s);
      const donde = `${tipo} ${d} grosor ${g} en ${W}×${H}: ${JSON.stringify(f)}`;
      assert.ok([x0, y0, x1, y1].every(Number.isFinite), `sin NaN: ${donde}`);
      assert.ok(x0 >= -0.01 && y0 >= -0.01 && x1 <= W + 0.01 && y1 <= H + 0.01, `adentro: ${donde}`);
    }
  }
});

test('el rectángulo y la elipse se meten medio trazo; la línea va por el medio, horizontal o vertical', () => {
  for (const g of GROSORES) {
    const s = TRAZO[g];
    const [r] = geometriaElemento('rectangulo', 'derecha', g, 200, 100);
    assert.ok(r.f === 'rect');
    assert.equal(r.x, Math.round((s / 2) * 100) / 100);
    assert.equal(r.w, Math.round((200 - s) * 100) / 100);
    const [c] = geometriaElemento('circulo', 'derecha', g, 200, 100);
    assert.ok(c.f === 'elipse');
    assert.deepEqual([c.cx, c.cy], [100, 50]);
    assert.equal(c.rx, Math.round((100 - s / 2) * 100) / 100, 'la elipse llena la caja: no es un círculo chico en el medio');
  }
  const [h] = geometriaElemento('linea', 'derecha', 2, 300, 30);
  assert.ok(h.f === 'linea' && h.y1 === 15 && h.y2 === 15 && h.x1 < h.x2);
  const [v] = geometriaElemento('linea', 'abajo', 2, 80, 260);
  assert.ok(v.f === 'linea' && v.x1 === 40 && v.x2 === 40 && v.y1 < v.y2);
  // La línea NO tiene punta: dar vuelta la dirección sólo cambia el eje.
  assert.deepEqual(geometriaElemento('linea', 'izquierda', 2, 300, 30), geometriaElemento('linea', 'derecha', 2, 300, 30));
});

test('lo que no es una forma, o una caja sin medir, no dibuja nada (y no da NaN)', () => {
  assert.deepEqual(geometriaElemento('texto', 'derecha', 2, 200, 100), []);
  assert.deepEqual(geometriaElemento('imagen', 'derecha', 2, 200, 100), []);
  for (const tipo of TIPOS_FORMA) {
    assert.deepEqual(geometriaElemento(tipo, 'derecha', 2, 0, 0), [], `${tipo} sin medir`);
    assert.deepEqual(geometriaElemento(tipo, 'derecha', 4, 3, 3), [], `${tipo} en una caja más chica que el trazo`);
  }
});

test('el color sale de la PALETA DEL TEMA de la hoja; sin color, o con un índice que no existe, es la tinta', () => {
  assert.equal(PALETA[0], '#aa3366', 'el acento del tema va primero');
  for (let i = 0; i < 8; i++) assert.equal(colorDeElemento({ color: i }, PALETA), PALETA[i]);
  assert.equal(colorDeElemento({ color: null }, PALETA), TINTA);
  assert.equal(TINTA, 'var(--ink)', 'la tinta es un TOKEN: se da vuelta sola en el modo oscuro');
  assert.equal(colorDeElemento({ color: 5 }, PALETA.slice(0, 3)), TINTA, 'una paleta más corta no deja el color en undefined');
  // Cambiar la plantilla de la hoja cambia el color del elemento (el mismo índice, otra paleta).
  const otra = paletaDe({ plantilla: PLANTILLAS_TEMA[2].id, acento: null, fuente: null });
  assert.equal(colorDeElemento({ color: 1 }, otra), otra[1]);
});

test('el SVG de una forma se pinta con el color de la paleta, rellena al 18 % o sólo el contorno', () => {
  const r = el({ tipo: 'rectangulo', color: 3, relleno: true });
  const html = renderToStaticMarkup(createElement(SvgElemento, { e: r, colores: PALETA, ancho: 200, alto: 100 }));
  assert.match(html, new RegExp(`color:${PALETA[3]}`), html);
  assert.match(html, /<rect[^>]*fill="currentColor"[^>]*fill-opacity="0.18"/);
  const sinRelleno = renderToStaticMarkup(createElement(SvgElemento, { e: { ...r, relleno: false }, colores: PALETA, ancho: 200, alto: 100 }));
  assert.match(sinRelleno, /<rect[^>]*fill="none"/);
  const flecha = renderToStaticMarkup(createElement(SvgElemento, { e: el({ tipo: 'flecha', color: null }), colores: PALETA, ancho: 200, alto: 60 }));
  assert.match(flecha, /color:var\(--ink\)/);
  assert.match(flecha, /<line /);
  assert.match(flecha, /<polygon /);
});

test('el texto: la letra de la hoja, el tamaño y el peso según el tamaño, la alineación y un párrafo por renglón', () => {
  for (const [k, t] of Object.entries(TAMANOS_TEXTO)) {
    const html = renderToStaticMarkup(createElement(CuerpoElemento, { e: el({ tipo: 'texto', texto: 'Uno\nDos\n\nTres', tamano: k, alinear: 'centro', color: 2 }), colores: PALETA, editando: false, onCambiar: () => {} }));
    assert.match(html, new RegExp(`font-size:${t.px}px`), `${k}: ${html}`);
    assert.match(html, new RegExp(`font-weight:${t.peso}`));
    assert.match(html, /text-align:center/);
    assert.match(html, /font-family:var\(--dash-letra, inherit\)/);
    assert.match(html, new RegExp(`color:${PALETA[2]}`));
    assert.equal((html.match(/<p /g) ?? []).length, 4, 'cuatro renglones, cuatro párrafos (el vacío también)');
  }
  assert.deepEqual([14, 18, 26, 36], ['s', 'm', 'l', 'xl'].map((k) => TAMANOS_TEXTO[k as 's'].px));
  const vacioEditando = renderToStaticMarkup(createElement(CuerpoElemento, { e: el({ tipo: 'texto', texto: '' }), colores: PALETA, editando: true, onCambiar: () => {} }));
  assert.match(vacioEditando, /Doble clic para escribir/);
  const vacioMirando = renderToStaticMarkup(createElement(CuerpoElemento, { e: el({ tipo: 'texto', texto: '' }), colores: PALETA, editando: false, onCambiar: () => {} }));
  assert.doesNotMatch(vacioMirando, /Doble clic/, 'mirando, un texto vacío no le pide nada a nadie');
});

test('la imagen: el recuadro «Agrega una imagen» sólo editando; con URL, la foto con su ajuste y sin referer', () => {
  const sinUrl = el({ tipo: 'imagen' });
  assert.match(renderToStaticMarkup(createElement(CuerpoElemento, { e: sinUrl, colores: PALETA, editando: true, onCambiar: () => {} })), /Agrega una imagen/);
  assert.doesNotMatch(renderToStaticMarkup(createElement(CuerpoElemento, { e: sinUrl, colores: PALETA, editando: false, onCambiar: () => {} })), /Agrega una imagen|<img/);
  const url = 'https://ejemplo.supabase.co/storage/v1/object/public/portadas/ws3/dashboard/a.png';
  for (const [ajuste, fit] of [['cubrir', 'cover'], ['contener', 'contain']] as const) {
    const html = renderToStaticMarkup(createElement(CuerpoElemento, { e: el({ tipo: 'imagen', url, ajuste, texto: 'El logo' }), colores: PALETA, editando: false, onCambiar: () => {} }));
    assert.match(html, new RegExp(`<img[^>]*src="${url.replace(/[.?]/g, '\\$&')}"`));
    assert.match(html, new RegExp(`object-fit:${fit}`));
    assert.match(html, /referrerPolicy="no-referrer"|referrerpolicy="no-referrer"/i);
    assert.match(html, /alt="El logo"/);
  }
  // Un `javascript:` no llega nunca a un src (lo frena el saneo del modelo, y el render vuelve a mirar).
  const mala = renderToStaticMarkup(createElement(CuerpoElemento, { e: { ...sinUrl, url: 'javascript:alert(1)' }, colores: PALETA, editando: false, onCambiar: () => {} }));
  assert.doesNotMatch(mala, /<img/);
});

test('el panel muestra lo que cada tipo tiene, la tinta y las ocho muestras de la paleta, y Duplicar y Eliminar', () => {
  const panel = (o: Record<string, unknown>) => renderToStaticMarkup(createElement(PropsElemento, { e: el(o), colores: PALETA, onCambiar: () => {}, onDuplicar: () => {}, onBorrar: () => {} }));
  const texto = panel({ tipo: 'texto', texto: 'Hola' });
  for (const s of ['Tamaño', 'Alineación', 'Color', 'Duplicar', 'Eliminar']) assert.ok(texto.includes(s), `texto: falta «${s}»`);
  assert.ok(!texto.includes('Grosor') && !texto.includes('Dirección'));
  const imagen = panel({ tipo: 'imagen' });
  for (const s of ['Subir imagen', 'O pega un enlace', 'Ajuste', 'Descripción']) assert.ok(imagen.includes(s), `imagen: falta «${s}»`);
  assert.ok(!imagen.includes('Grosor') && !imagen.includes('aria-label="Color"'), 'la imagen no tiene color');
  const rect = panel({ tipo: 'rectangulo', color: 4 });
  for (const s of ['Relleno', 'Grosor', 'Color']) assert.ok(rect.includes(s), `rectángulo: falta «${s}»`);
  for (let i = 0; i < 8; i++) assert.ok(rect.includes(`background:${PALETA[i]}`), `falta la muestra ${i + 1} de la paleta`);
  assert.ok(rect.includes('Tinta'));
  assert.match(rect, /aria-pressed="true"[^>]*title="Color 5"/, 'la muestra elegida es la del índice guardado');
  assert.ok(panel({ tipo: 'flecha' }).includes('Dirección'));
  const linea = panel({ tipo: 'linea' });
  assert.ok(linea.includes('Horizontal') && linea.includes('Vertical') && !linea.includes('Relleno'));
});

test('dar vuelta el EJE de una línea o flecha chata le da la forma del eje nuevo; si ya era suya, la respeta', () => {
  const linea = el({ tipo: 'linea', w: 6, h: 1 });
  assert.deepEqual(parcheDeDireccion(linea, 'abajo'), { direccion: 'abajo', w: 1, h: 6 });
  assert.deepEqual(parcheDeDireccion({ ...linea, direccion: 'abajo', w: 1, h: 6 }, 'derecha'), { direccion: 'derecha', w: 6, h: 1 });
  assert.deepEqual(parcheDeDireccion({ ...linea, w: 6, h: 8 }, 'abajo'), { direccion: 'abajo' }, 'una caja alta ya sirve vertical');
  const flecha = el({ tipo: 'flecha', w: 3, h: 2 });
  assert.deepEqual(parcheDeDireccion(flecha, 'izquierda'), { direccion: 'izquierda' }, 'mismo eje: sólo la dirección');
  assert.deepEqual(parcheDeDireccion(flecha, 'arriba'), { direccion: 'arriba', w: 2, h: 4 });
});

test('la subida: el tope de la pantalla y el de la ruta son el mismo; sólo raster; la puerta es la de /api/graficos', () => {
  assert.equal(problemaDeArchivo({ size: 1000, type: 'image/png' }), null);
  assert.equal(problemaDeArchivo({ size: 1000, type: '' }), null, 'sin tipo lo decide el server, que mira los bytes');
  assert.match(problemaDeArchivo({ size: 1000, type: 'image/svg+xml' }) ?? '', /JPG, PNG, WEBP o GIF/);
  assert.match(problemaDeArchivo({ size: MAX_IMAGEN + 1, type: 'image/jpeg' }) ?? '', /4 MB/);

  const ruta = sinComentarios(leer('app/api/graficos/imagen/route.ts'));
  const m = ruta.match(/const MAX = ([\d\s*]+);/);
  assert.ok(m, 'no encontré el tope de la ruta');
  assert.equal(Function(`return ${m![1]}`)(), MAX_IMAGEN, 'la pantalla y la ruta topean distinto');
  assert.ok(MAX_IMAGEN < 4.5 * 1024 * 1024, 'el tope tiene que quedar abajo del corte de 4,5 MB de Vercel');
  const ext = ruta.match(/const EXT_DE[^{]*\{([^}]*)\}/);
  assert.ok(ext, 'no encontré los tipos de la ruta');
  assert.doesNotMatch(ext![1], /svg/i, 'un SVG en un bucket público es un documento activo');
  assert.match(ruta, /getRolWsEfectivo\(\)/);
  assert.match(ruta, /rol !== 'admin'/);
  assert.match(ruta, /tabEnCapa\('graphics', await getCapaActual\(\)\)/);
  assert.match(ruta, /const BUCKET = 'portadas'/);
  assert.match(ruta, /sniffImagen\(buf\)/, 'el tipo se decide por los bytes, no por lo que dice el navegador');
});

test('Elemento.tsx no escribe un solo color en hex: todo sale de la paleta o de un token', () => {
  const src = sinComentarios(leer('app/dashboard/Elemento.tsx'));
  const hex = src.match(/#[0-9a-f]{3,8}\b/gi) ?? [];
  assert.deepEqual(hex, [], `colores fijos: ${hex.join(', ')}`);
  // Y no usa `height: 100%` en la caja que llena la celda (en Safari da cero contra un alto de flex):
  // el único 100 % de alto es el de la foto, que va absoluta adentro de una caja que estira con flex.
  const alturas = src.match(/height: '100%'/g) ?? [];
  assert.equal(alturas.length, 1, 'sólo la <img> absoluta lleva height 100 %');
});
