// =============================================================================
// Los elementos que se insertan en el Dashboard (punto 18 del feedback del 11/10/2026): texto, imagen,
// rectángulo, círculo, línea y flecha — app/dashboard/Elemento.tsx y app/api/graficos/imagen/route.ts — y desde
// la decisión 6 de Martín (Closing al Dashboard), el Enlace, el Video y el Insertar (app/dashboard/ElementoInsertado.tsx).
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
//
// ENLACE, VIDEO E INSERTAR (11/10/2026, decisión 6 de Martín; app/dashboard/ElementoInsertado.tsx, el saneo por
// tipo de lib/graficos-catalogo.ts y lo que reconoce lib/embeds.ts). Base 20 pass / 0 fail. Arnés del paquete P1
// (scratchpad p1/romper.mjs): una rotura por vez, restaurada DE MEMORIA (nunca con git) y verificada por hash.
// Todas cayeron; con este archivo solo, 19 / 1 salvo donde se dice otra cosa:
//   · urlDeEnlace sin mirar espacios ni controles (`/` tab `/evil.tld`)         → 18 / 2 (el Enlace · lo que se guarda)
//   · RE_CAMINO sin `(?![/\\])` (un `//evil.tld` pasa por camino)            → el Enlace
//   · urlDeEnlace sin mirar usuario y clave                                   → el Enlace
//   · un link a MaKo misma no pasa a camino                                   → el Enlace
//   · RE_CAMINO sin la exclusión de /api y /_next                             → el Enlace
//   · urlDeInsertado sin `esHostPropio`                                       → lo que se guarda
//   · el saneo sin el mínimo de video/insertado (vuelve a 1×1)                → lo que se guarda
//   · un texto o una forma guardando una URL (urlDeImagen en el default)      → lo que se guarda
//   · sin el tope de texto por tipo                                           → lo que se guarda
//   · un enlace nuevo en la tinta (sin el acento)                             → lo que se guarda
//   · Marco sin `sandbox`                                                     → 17 / 3 (Video dibujado · Insertar dibujado · el PDF)
//   · Marco sin `pointer-events: none` editando                               → 18 / 2 (Video dibujado · Insertar dibujado)
//   · el enlace de afuera sin `rel="noopener noreferrer"`                     → el Enlace dibujado
//   · el enlace pintando `e.url` sin volver a sanearla                        → el Enlace dibujado
//   · el «Ver el video ↗» de un link no reconocido con `e.url` crudo          → el Video dibujado (el bug que encontró
//     este test la primera vez que corrió: un `javascript:` llegaba al href)
//   · Fathom sin la miniatura y el clic (el reproductor de entrada)          → el Video dibujado
//   · lo insertado con la dirección guardada en vez del src de la lista       → Insertar dibujado
//   · el panel con color para video e insertado                               → el panel de Enlace, Video e Insertar
//   · sin la regla de impresión que esconde iframe y video                    → el PDF
//   · `.lk-imp-caja` con display fuera de la impresión (se vería en pantalla) → el PDF
//   · «Insertar» sin los separadores de grupo                                 → «Insertar»
//   · un segundo height 100 % en ElementoInsertado.tsx                        → sin hex / un solo 100 %
//   · un hex en ElementoInsertado.tsx                                         → sin hex / un solo 100 %
//   · IconoElemento sin el dibujo de «insertado» · el set sin «insertar»      → «Insertar» (cada uno)
//   · el enlace sin su dirección para el PDF                                  → el Enlace dibujado
// Y desde lib/embeds.ts, corriendo este archivo con tests/embeds.test.ts (base 35 / 0): Insertar sin mirar
// nuestro host → 33 / 2; el Video aceptando una agenda → 33 / 2; Fathom sin miniatura → 32 / 3; el «Abrir ↗» de
// Fathom al link con el minuto → 33 / 2. Al final, 20 / 0.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import {
  TIPOS_ELEMENTO, minimoDeElemento, nuevoElemento, sanearElemento, urlDeElemento, urlDeEnlace, urlHttps, type Elemento, type TipoElemento,
} from '../lib/graficos-catalogo';
import { paletaDe, PLANTILLAS_TEMA } from '../lib/graficos-temas';
import { ALLOW_EMBED, SANDBOX_EMBED } from '../lib/embeds';
import {
  CuerpoElemento, IconoElemento, PropsElemento, SvgElemento, colorDeElemento, enlaceImpreso, geometriaElemento, parcheDeDireccion, problemaDeArchivo,
  MAX_IMAGEN, TAMANOS_TEXTO, TINTA, TRAZO, type FormaSvg,
} from '../app/dashboard/Elemento';
import { srcAlReproducir } from '../app/dashboard/ElementoInsertado';
import { MenuInsertar } from '../app/dashboard/Galeria';
import { CSS } from '../app/dashboard/editor-css';

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

test('Elemento.tsx y ElementoInsertado.tsx no escriben un solo color en hex: todo sale de la paleta o de un token', () => {
  for (const archivo of ['app/dashboard/Elemento.tsx', 'app/dashboard/ElementoInsertado.tsx']) {
    const src = sinComentarios(leer(archivo));
    const hex = src.match(/#[0-9a-f]{3,8}\b/gi) ?? [];
    assert.deepEqual(hex, [], `${archivo}, colores fijos: ${hex.join(', ')}`);
    // Y no usan `height: 100%` en la caja que llena la celda (en Safari da cero contra un alto de flex):
    // el único 100 % de alto de cada uno es el de lo que va ABSOLUTO adentro de una caja que estira con
    // flex (la foto en uno; `LLENO`, el iframe, el video y la miniatura, en el otro).
    const alturas = src.match(/height: '100%'/g) ?? [];
    assert.equal(alturas.length, 1, `${archivo}: sólo lo absoluto lleva height 100 %`);
  }
  assert.match(sinComentarios(leer('app/dashboard/ElementoInsertado.tsx')), /const LLENO: CSSProperties = \{ position: 'absolute', inset: 0, width: '100%', height: '100%'/);
});

// ── Enlace, Video e Insertar (decisión 6 de Martín, 11/10/2026: «Closing Analyst va COMPLETO al Dashboard,
//    sumando los elementos Enlace, Video e Insertar») ─────────────────────────────────────────────────────

const render = (e: Elemento, editando = false) => renderToStaticMarkup(createElement(CuerpoElemento, { e, colores: PALETA, editando, onCambiar: () => {} }));
/** Un elemento SIN pasar por el saneo: lo que dibujaría la pantalla si el guardado lo dejara pasar. */
const crudo = (e: Elemento, o: Partial<Elemento>): Elemento => ({ ...e, ...o });
const YT = 'dQw4w9WgXcQ';
const FATHOM = 'qGEmdURy3JdNPfo9CseUvfNfjYMGzQ5D';

test('el Enlace: sólo un camino de MaKo o un link http/https con dominio; nada que el navegador lea como otro host', () => {
  const BIEN: Array<[string, string]> = [
    ['/crm', '/crm'], ['  /dashboard?hoja=closing&llamada=55  ', '/dashboard?hoja=closing&llamada=55'], ['/', '/'],
    ['https://ejemplo.com/a?b=1#c', 'https://ejemplo.com/a?b=1#c'], ['http://ejemplo.com', 'http://ejemplo.com/'],
    ['ejemplo.com/precios', 'https://ejemplo.com/precios'],
    // MaKo misma se guarda como su CAMINO: abierta afuera, perdería el cliente que se está mirando.
    ['https://hola-mako.com/crm?x=1', '/crm?x=1'], ['https://www.hola-mako.com/', '/'], ['https://makodigital.app/plan', '/plan'],
    // Un subdominio no es la app: es otro servicio, y se abre afuera.
    ['https://send.hola-mako.com/x', 'https://send.hola-mako.com/x'],
  ];
  for (const [entra, sale] of BIEN) {
    assert.equal(urlDeEnlace(entra), sale, entra);
    assert.equal(urlDeEnlace(sale), sale, `idempotente: ${sale}`);
  }
  const MAL = [
    'javascript:alert(1)', 'JaVaScRiPt:alert(1)', ' javascript:alert(1)', 'data:text/html,hola', 'vbscript:x', 'mailto:a@b.com', 'ftp://ejemplo.com',
    // `//x` y `/\x` son OTRO host; un tab o un salto adentro el navegador los BORRA (`/` tab `/x` es `//x`).
    '//evil.tld/x', '/\\evil.tld', '/\t/evil.tld', '/\n/evil.tld', '/a b',
    'https://banco.com@evil.tld/', 'https://a:b@ejemplo.com', 'http://localhost:3000/crm', 'https://127.0.0.1/',
    // Un link no dispara un GET a una API con la sesión de quien lo toca.
    '/api/auth/logout', '/api', '/API/x', '/_next/static/x.js', 'https://hola-mako.com/api/x',
    '/' + 'a'.repeat(600), 'https://ejemplo.com/' + 'a'.repeat(2100), '', '   ', 'crm', null, 42,
  ];
  for (const m of MAL) assert.equal(urlDeEnlace(m), '', JSON.stringify(m)?.slice(0, 60));
});

test('lo que se GUARDA: cada tipo con su vara; un código <iframe> nunca; un texto o una forma no guardan dirección', () => {
  assert.equal(urlDeElemento('enlace', 'javascript:alert(1)'), '');
  assert.equal(urlDeElemento('video', `http://www.youtube.com/watch?v=${YT}`), '', 'video: sólo https');
  assert.equal(urlDeElemento('video', `https://www.youtube.com/watch?v=${YT}`), `https://www.youtube.com/watch?v=${YT}`);
  assert.equal(urlDeElemento('insertado', '<iframe src="https://ejemplo.com/a"></iframe>'), '', 'el código no se guarda: sólo la dirección que le saca la pantalla');
  assert.equal(urlDeElemento('insertado', 'https://hola-mako.com/crm'), '', 'MaKo adentro de MaKo, nunca');
  assert.equal(urlDeElemento('insertado', 'https://www.hola-mako.com/crm'), '');
  assert.equal(urlDeElemento('insertado', 'https://lookerstudio.google.com/embed/reporting/x'), 'https://lookerstudio.google.com/embed/reporting/x');
  for (const malo of ['https://a:b@ejemplo.com/', 'https://ejemplo.com:8443/', 'https://localhost/', 'https://10.0.0.1/', 'https://ejemplo.com/ a']) {
    assert.equal(urlHttps(malo), '', malo);
  }
  for (const t of ['texto', 'rectangulo', 'flecha'] as const) assert.equal(sanearElemento({ tipo: t, url: 'https://ejemplo.com/a.png' })!.url, '', t);
  assert.equal(sanearElemento({ tipo: 'imagen', url: 'https://ejemplo.com/a.png' })!.url, 'https://ejemplo.com/a.png', 'la imagen, como siempre');

  // Lo que se lee de cada uno, con su tope.
  const largo = 'x'.repeat(3000);
  assert.deepEqual((['texto', 'enlace', 'video', 'insertado'] as const).map((t) => sanearElemento({ tipo: t, texto: largo })!.texto.length), [2000, 300, 120, 120]);
  // Los tamaños del contrato, y lo más chico que se puede achicar (un video de 1×1 no se ve).
  const info = (t: TipoElemento) => TIPOS_ELEMENTO.find((x) => x.id === t)!;
  assert.deepEqual([info('enlace'), info('video'), info('insertado')].map((x) => [x.w, x.h]), [[4, 2], [6, 7], [12, 12]]);
  assert.deepEqual(minimoDeElemento('video'), { w: 3, h: 4 });
  assert.deepEqual(minimoDeElemento('insertado'), { w: 3, h: 4 });
  assert.deepEqual(minimoDeElemento('texto'), { w: 1, h: 1 });
  assert.deepEqual(minimoDeElemento('no-existe'), { w: 1, h: 1 });
  const chico = sanearElemento({ tipo: 'video', w: 1, h: 1 })!;
  assert.deepEqual([chico.w, chico.h], [3, 4], 'el saneo no deja guardar menos que el mínimo');
  // Un enlace nace con el acento del tema (un link en la tinta del texto no se distingue de un texto).
  const nuevo = nuevoElemento('enlace', []);
  assert.deepEqual([nuevo.color, nuevo.texto, nuevo.url, nuevo.w, nuevo.h], [0, 'Texto del enlace', '', 4, 2]);
  // El saneo es idempotente: lo guardado vuelve igual.
  for (const o of [{ tipo: 'enlace', url: 'hola-mako.com/crm', texto: 'CRM' }, { tipo: 'video', url: `https://youtu.be/${YT}` }, { tipo: 'insertado', url: 'https://www.typeform.com/to/abc' }]) {
    const a = sanearElemento({ id: 'e1', ...o })!;
    assert.deepEqual(sanearElemento(a), a, o.tipo);
  }
});

test('el Enlace dibujado: adentro con el Link de la casa; afuera en otra pestaña con noopener y ↗; en el PDF, la dirección', () => {
  const afuera = render(el({ tipo: 'enlace', texto: 'Precios', url: 'https://ejemplo.com/precios', color: 0, tamano: 'm' }));
  assert.match(afuera, /<a href="https:\/\/ejemplo\.com\/precios" target="_blank" rel="noopener noreferrer"/);
  assert.match(afuera, />Precios<span aria-hidden="true"> ↗<\/span><\/a>/);
  assert.match(afuera, new RegExp(`color:${PALETA[0]}`), 'el color de la paleta');
  assert.match(afuera, /class="lk-solo-imprimir lk-imp-enlace">ejemplo\.com\/precios</);

  const adentro = render(el({ tipo: 'enlace', texto: 'Ver el CRM', url: '/crm?x=1' }));
  assert.match(adentro, /<a [^>]*href="\/crm\?x=1"/);
  assert.doesNotMatch(adentro, /target=/, 'una pantalla de MaKo se abre en la misma pestaña');
  assert.doesNotMatch(adentro, /↗/);
  assert.match(adentro, />hola-mako\.com\/crm\?x=1</, 'en el papel, con su dominio');
  assert.equal(enlaceImpreso('/plan'), 'hola-mako.com/plan');

  // Lo que llega a un href se vuelve a sanear al dibujar: un `javascript:` que se salteó el guardado no llega.
  const malo = render(crudo(el({ tipo: 'enlace', texto: 'Clic' }), { url: 'javascript:alert(1)' }));
  assert.doesNotMatch(malo, /href=|javascript/i);
  assert.match(malo, />Clic</);
  // Editando, sin texto ni dirección, pide el doble clic; con texto y sin dirección, lo avisa.
  assert.match(render(el({ tipo: 'enlace', texto: '' }), true), /Doble clic para escribir/);
  const sinUrl = render(el({ tipo: 'enlace', texto: 'Algo' }), true);
  assert.match(sinUrl, /Sin enlace/);
  assert.doesNotMatch(sinUrl, /<a /);
  assert.doesNotMatch(render(el({ tipo: 'enlace', texto: '' })), /Doble clic/, 'mirando, no le pide nada a nadie');
});

test('el Video dibujado: el reproductor con el sandbox de la lista; Fathom con su miniatura y un clic; un archivo con <video>', () => {
  const yt = el({ tipo: 'video', url: `https://www.youtube.com/watch?v=${YT}`, texto: 'La demo' });
  const html = render(yt);
  assert.match(html, new RegExp(`<iframe src="https://www\\.youtube-nocookie\\.com/embed/${YT}\\?rel=0" title="La demo" sandbox="${SANDBOX_EMBED}" allow="${ALLOW_EMBED}" loading="lazy" referrerPolicy="strict-origin-when-cross-origin"`, 'i'));
  assert.doesNotMatch(html, /pointer-events/, 'mirando, el reproductor se toca');
  assert.match(render(yt, true), /<iframe [^>]*style="[^"]*pointer-events:none/, 'editando, no se traga el clic de seleccionar ni el arrastre');
  assert.match(html, new RegExp(`<a href="https://www\\.youtube\\.com/watch\\?v=${YT}" target="_blank" rel="noopener noreferrer" class="lk-sin-imprimir"[^>]*>Abrir ↗</a>`));
  // El PDF: la miniatura, no el reproductor (el iframe va .lk-sin-imprimir).
  assert.match(html, new RegExp(`class="lk-solo-imprimir"[^>]*><img src="https://i\\.ytimg\\.com/vi/${YT}/hqdefault\\.jpg"`));
  assert.match(html, /class="lk-sin-imprimir" style="[^"]*"><iframe/);

  const fathom = render(el({ tipo: 'video', url: `https://fathom.video/share/${FATHOM}?timestamp=12` }));
  assert.doesNotMatch(fathom, /<iframe/, 'Fathom: la miniatura y un clic, no el reproductor de entrada');
  assert.match(fathom, /<button type="button" aria-label="Reproducir Fathom"/);
  assert.match(fathom, new RegExp(`<img src="https://fathom\\.video/share/${FATHOM}/thumbnail"`));
  assert.match(fathom, new RegExp(`<a href="https://fathom\\.video/share/${FATHOM}" target="_blank"`), '«Abrir ↗» al link de Compartir, sin el minuto');
  assert.equal(srcAlReproducir(`https://fathom.video/embed/${FATHOM}`), `https://fathom.video/embed/${FATHOM}?autoplay=1`);

  const mp4 = render(el({ tipo: 'video', url: 'https://cdn.ejemplo.com/a.mp4' }));
  assert.match(mp4, /<video src="https:\/\/cdn\.ejemplo\.com\/a\.mp4" controls="" preload="metadata" playsInline=""/i);
  assert.match(mp4, /class="lk-solo-imprimir lk-imp-caja">/, 'sin miniatura, el PDF imprime un recuadro');

  // Sin link, o con uno que no es un video: editando lo dice; mirando, nada que le pida algo a nadie.
  assert.match(render(el({ tipo: 'video' }), true), /Pega el link del video/);
  assert.doesNotMatch(render(el({ tipo: 'video' })), /Pega|<iframe|<video/);
  assert.match(render(crudo(el({ tipo: 'video' }), { url: 'https://calendly.com/juan/30min' }), true), /Es una agenda: usa Insertar\./);
  assert.doesNotMatch(render(crudo(el({ tipo: 'video' }), { url: 'javascript:alert(1)' })), /href=|javascript/i);
  // Un https guardado que la lista no reconoce (la API lo deja guardar): mirando, se puede abrir igual.
  const otro = render(el({ tipo: 'video', url: 'https://ejemplo.com/pagina' }));
  assert.match(otro, /<a href="https:\/\/ejemplo\.com\/pagina" target="_blank" rel="noopener noreferrer"[^>]*>Ver el video ↗<\/a>/);
  assert.doesNotMatch(otro, /<iframe/);
});

test('Insertar dibujado: un iframe con el sandbox fijo; lo desconocido tal cual; nunca MaKo; en el PDF, un recuadro con título y proveedor', () => {
  const looker = el({ tipo: 'insertado', url: 'https://lookerstudio.google.com/embed/reporting/0a1b/page/p_xyz', texto: 'Ventas' });
  const html = render(looker);
  assert.match(html, new RegExp(`<iframe src="https://lookerstudio\\.google\\.com/embed/reporting/0a1b/page/p_xyz" title="Ventas" sandbox="${SANDBOX_EMBED}" allow="${ALLOW_EMBED}" loading="lazy" referrerPolicy="strict-origin-when-cross-origin"`, 'i'));
  assert.doesNotMatch(SANDBOX_EMBED, /allow-top-navigation/);
  assert.match(html, /class="lk-solo-imprimir lk-imp-caja">.*<span class="lk-imp-tit">Ventas<\/span><span>lookerstudio\.google\.com<\/span>/);
  assert.match(render(looker, true), /<iframe [^>]*style="[^"]*pointer-events:none/);
  // Lo de la lista: el src lo arma lib/embeds.ts, no el que se guardó.
  assert.match(render(el({ tipo: 'insertado', url: `https://youtu.be/${YT}` })), new RegExp(`<iframe src="https://www\\.youtube-nocookie\\.com/embed/${YT}\\?rel=0" title="YouTube"`));
  // MaKo adentro de MaKo: aunque se haya salteado el guardado, no se dibuja.
  const propio = crudo(el({ tipo: 'insertado' }), { url: 'https://hola-mako.com/crm' });
  assert.doesNotMatch(render(propio), /<iframe/);
  assert.match(render(propio, true), /Para una pantalla de MaKo usa Enlace\./);
  assert.match(render(el({ tipo: 'insertado' }), true), /Pega un link o un código/);
  assert.doesNotMatch(render(el({ tipo: 'insertado' })), /Pega|<iframe/);
});

test('el panel de Enlace, Video e Insertar: lo suyo, sin color los que traen el suyo; Duplicar y Eliminar en todos', () => {
  const panel = (o: Record<string, unknown>) => renderToStaticMarkup(createElement(PropsElemento, { e: el(o), colores: PALETA, onCambiar: () => {}, onDuplicar: () => {}, onBorrar: () => {} }));
  const enlace = panel({ tipo: 'enlace', texto: 'Ver', url: '/crm' });
  for (const s of ['>Texto<', '>Enlace<', 'Tamaño', 'Alineación', 'aria-label="Color"', 'Pantalla de MaKo', 'Duplicar', 'Eliminar']) assert.ok(enlace.includes(s), `enlace: falta «${s}»`);
  assert.match(panel({ tipo: 'enlace', url: 'https://ejemplo.com' }), /Se abre en otra pestaña/);
  const video = panel({ tipo: 'video', url: `https://youtu.be/${YT}` });
  for (const s of ['Pega el link del video', 'Título', '>YouTube<', 'Duplicar', 'Eliminar']) assert.ok(video.includes(s), `video: falta «${s}»`);
  const insertado = panel({ tipo: 'insertado', url: 'https://lookerstudio.google.com/embed/x' });
  for (const s of ['Link o código', 'Título', '>lookerstudio.google.com<', 'Duplicar', 'Eliminar']) assert.ok(insertado.includes(s), `insertado: falta «${s}»`);
  for (const [n, h] of [['video', video], ['insertado', insertado]]) {
    assert.ok(!h.includes('aria-label="Color"') && !h.includes('Tamaño') && !h.includes('Grosor'), `${n}: trae su propio color`);
  }
  // La cabecera lleva el dibujo y el nombre del tipo.
  assert.match(insertado, /class="lk-props-nombre">Insertar</);
});

test('«Insertar»: los nueve, en tres grupos (lo que se lee, lo que se mira, las formas), cada uno con su dibujo', () => {
  const menu = renderToStaticMarkup(createElement(MenuInsertar, { onElegir: () => {} }));
  const nombres = [...menu.matchAll(/<span>([^<]+)<\/span><\/button>/g)].map((m) => m[1]);
  assert.deepEqual(nombres, ['Texto', 'Enlace', 'Imagen', 'Video', 'Insertar', 'Rectángulo', 'Círculo', 'Línea', 'Flecha']);
  assert.equal((menu.match(/role="separator"/g) ?? []).length, 2);
  assert.equal((menu.match(/role="menuitem"/g) ?? []).length, TIPOS_ELEMENTO.length);
  for (const t of TIPOS_ELEMENTO) {
    const svg = renderToStaticMarkup(createElement(IconoElemento, { tipo: t.id }));
    assert.match(svg, /^<svg[^>]*>.*<(path|rect|circle)/, `${t.id} sin dibujo`);
  }
});

test('el PDF: lo de otro sitio no se imprime (un iframe sale en blanco); su recuadro sí', () => {
  const imprimir = CSS.slice(CSS.indexOf('@media print'));
  assert.match(imprimir, /\.lk-comp--elemento iframe, \.lk-comp--elemento video \{ display: none !important; \}/);
  assert.match(imprimir, /\.lk-solo-imprimir\.lk-imp-caja \{ display: flex !important; \}/);
  // Fuera de la impresión, el recuadro NO declara display (si lo hiciera, le ganaría al display: none y se vería en pantalla).
  const caja = CSS.slice(CSS.indexOf('.lk-imp-caja {'), CSS.indexOf('}', CSS.indexOf('.lk-imp-caja {')));
  assert.ok(caja.length > 20 && !/display:/.test(caja), caja);
  // Y el iframe del elemento sale SOLO del componente que le pone el sandbox.
  const insertado = sinComentarios(leer('app/dashboard/ElementoInsertado.tsx'));
  assert.equal((insertado.match(/<iframe\b/g) ?? []).length, 1, 'un solo <iframe>: el de `Marco`');
  assert.match(insertado, /<iframe\s+src=\{src\}\s+title=\{titulo\}\s+sandbox=\{SANDBOX_EMBED\}\s+allow=\{ALLOW_EMBED\}\s+loading="lazy"\s+referrerPolicy=\{REFERRER_EMBED\}/);
  // (En Elemento.tsx «<iframe …>» aparece sólo como el ejemplo del campo de Insertar, un texto: un TAG no.)
  assert.doesNotMatch(sinComentarios(leer('app/dashboard/Elemento.tsx')), /<iframe[\s\S]{0,60}?src=\{/);
});
