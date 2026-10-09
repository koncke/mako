// =============================================================================
// El desplegable de la casa en la sexta tanda: buscador, íconos, el PRINCIPAL, el PLACEHOLDER y el tacho
// =============================================================================
// Pedidos de Martín (09/10/2026), textuales:
//   · general 9: «Cambia el botón de BORRAR con ese ícono de basura que no se ve... Y que siempre el
//     ícono de borrar sea rojo»;
//   · general 10: «pon íconos en todos los desplegable, en todas las opciones»;
//   · general 11 / CONDITION 2: «Agrega la barra de busqueda en todos los desplegables... Al menos que
//     por defecto tenga muy pocas opciones»;
//   · CONDITION 3: «Se tiene que diferenciar el desplegable principal del resto»;
//   · CONDITION 4: «siempre que puedas usa ese diseño tipo placeholder».
//
// Lo que se EJECUTA: app/components/dropdown-reglas.ts (umbral y variantes), app/_ui/iconos-menu.tsx (el
// set por nombre), app/_ui/BotonBorrar.tsx y el `Dropdown` dibujado con renderToStaticMarkup (el botón;
// el menú vive en un portal que sólo existe abierto). Lo que se LEE del fuente (sin comentarios, CRLF
// normalizado): que el Dropdown use esas funciones y no un número propio.
//
// ── Roturas (09/10/2026) ── al final.
// =============================================================================

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { conBuscador, estiloDeVariante, anchoPorDefecto, UMBRAL_BUSCADOR, ALTO_PRINCIPAL, ALTO_PLACEHOLDER } from '../app/components/dropdown-reglas';
import { Dropdown, type DropdownOption } from '../app/components/Dropdown';
import { IconoMenu, esIconoMenu, NOMBRES_ICONO_MENU, TRAZOS_BORRAR } from '../app/_ui/iconos-menu';
import { BotonBorrar, IconoBorrar } from '../app/_ui/BotonBorrar';
import { ALTO_CAMPO_GRANDE, botonGrande } from '../app/_components/Lienzo';

const leer = (r: string) => readFileSync(new URL(`../${r}`, import.meta.url), 'utf8').replace(/\r\n/g, '\n');
const sinComentarios = (s: string) => s.replace(/^[ \t]*\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '');
const DD = sinComentarios(leer('app/components/Dropdown.tsx'));
const dibujar = (p: Partial<Parameters<typeof Dropdown>[0]>) =>
  renderToStaticMarkup(createElement(Dropdown, { value: '', onChange: () => {}, options: [], ...p }));
/** El BOTÓN dibujado (sin el contenedor): hasta que cierra el primer <button>. */
const boton = (html: string) => html.slice(html.indexOf('<button'), html.indexOf('</button>') + 9);

test('⚠️ el buscador sale solo pasadas las 7 opciones; `search` explícito manda', () => {
  assert.equal(UMBRAL_BUSCADOR, 7);
  assert.equal(conBuscador(7), false, 'con siete se ven todas: el buscador sería un campo para nada');
  assert.equal(conBuscador(8), true, 'con ocho, el noveno renglón ya se esconde: hace falta');
  assert.equal(conBuscador(40, false), false, 'un `search={false}` lo apaga aunque crezca');
  assert.equal(conBuscador(2, true), true, 'y un `search` lo fuerza');
  // El Dropdown cuenta TODAS las opciones (las de adentro de cada sección también: buscar aplana).
  assert.match(DD, /const conBusqueda = conBuscador\(flat\.length, search\);/, 'el Dropdown volvió a un número propio');
  assert.match(DD, /const flat = secciones \? secciones\.flatMap\(opcionesDe\)/);
});

test('⚠️ el PRINCIPAL se distingue de los de abajo: más alto, más letra, negrita, borde y ancho completo', () => {
  const p = estiloDeVariante('principal');
  assert.equal(ALTO_PRINCIPAL, 56);
  assert.ok(Number(p.minHeight) > ALTO_CAMPO_GRANDE && Number(p.minHeight) > Number(botonGrande.minHeight), 'el principal mide lo mismo que el campo grande de al lado');
  assert.ok(Number(p.fontSize) > Number(botonGrande.fontSize), 'la letra del principal no es más grande');
  assert.equal(p.fontWeight, 700);
  assert.match(String(p.border), /^1\.5px solid/);
  assert.equal(anchoPorDefecto('principal'), '100%');
  assert.equal(anchoPorDefecto(undefined), undefined, 'los de siempre siguen midiendo lo suyo');
  assert.deepEqual(estiloDeVariante(undefined), {}, 'sin variante, la cara de siempre');
  // Dibujado: el botón trae los 56 y el ancho completo; uno sin variante, no.
  const html = boton(dibujar({ variante: 'principal', placeholder: 'Elige una acción' }));
  assert.match(html, /min-height:56px/);
  assert.match(html, /width:100%/);
  assert.match(html, /font-weight:700/);
  const comun = boton(dibujar({ placeholder: 'Elige' }));
  assert.doesNotMatch(comun, /min-height:56px|dashed/, 'una pantalla de antes cambió de cara sin pedirlo');
  assert.match(comun, /▾/, 'una pantalla de antes perdió la flecha');
});

test('⚠️ el PLACEHOLDER: borde punteado, centrado, apagado, sin flecha, y se enciende al pasar el cursor', () => {
  const apagado = estiloDeVariante('placeholder');
  assert.match(String(apagado.border), /dashed var\(--border-strong\)/);
  assert.equal(apagado.justifyContent, 'center');
  assert.equal(apagado.background, 'transparent');
  assert.equal(apagado.color, 'var(--dim)');
  assert.equal(apagado.minHeight, ALTO_PLACEHOLDER);
  const encendido = estiloDeVariante('placeholder', true);
  assert.match(String(encendido.border), /dashed var\(--primary\)/);
  assert.equal(encendido.color, 'var(--primary)');
  const html = boton(dibujar({ variante: 'placeholder', placeholder: '＋ Otra etiqueta', resetAfterSelect: true }));
  assert.match(html, /dashed/);
  assert.doesNotMatch(html, /▾/, 'el placeholder agrega algo: no lleva la flecha de «acá se elige»');
  // El cableado: la variante va entre lo de siempre y lo de quien llama, y el hover sólo para el placeholder.
  assert.match(DD, /\.\.\.estiloDeVariante\(variante, encima && !disabled\), \.\.\.buttonStyle,/, '`buttonStyle` dejó de mandar sobre la variante');
  assert.match(DD, /const sinFlecha = sinFlechaPedida \|\| variante === 'placeholder';/);
  assert.match(DD, /const conHover = variante === 'placeholder';/);
});

test('⚠️ UN campo `icono`: un nombre del set, una URL, o un dibujo; y el elegido va también en el botón', () => {
  // El set: los nombres nunca se confunden con una URL (no traen `:`, `/` ni `.`).
  assert.ok(NOMBRES_ICONO_MENU.length >= 40, `el set tiene ${NOMBRES_ICONO_MENU.length}`);
  for (const n of NOMBRES_ICONO_MENU) assert.doesNotMatch(n, /[:/.]/, n);
  assert.equal(esIconoMenu('duplicar'), true);
  assert.equal(esIconoMenu('data:image/svg+xml,%3Csvg%3E'), false);
  assert.equal(esIconoMenu('https://x.test/logo.png'), false);
  assert.equal(esIconoMenu('toString'), false, 'una clave heredada del objeto no es un ícono');
  // Dibujados en el botón de lo elegido: el nombre como SVG, la URL como imagen.
  const opciones: DropdownOption[] = [
    { value: 'a', label: 'Duplicar', icono: 'duplicar' },
    { value: 'b', label: 'Logo', icono: 'data:image/svg+xml,%3Csvg%3E%3C/svg%3E' },
  ];
  assert.match(boton(dibujar({ value: 'a', options: opciones })), /<svg[^>]*viewBox="0 0 24 24"/, 'el ícono por nombre no se dibuja');
  assert.match(boton(dibujar({ value: 'b', options: opciones })), /<img src="data:image\/svg\+xml/, 'el ícono por URL dejó de ser una imagen');
  assert.doesNotMatch(boton(dibujar({ value: 'a', options: opciones, botonLabel: '⚡' })), /<svg/, 'con `botonLabel`, quien llama dibuja el botón entero');
  // Los cuatro lugares que lo dibujan pasan por la MISMA pieza.
  assert.match(DD, /\{o\.icono && <IconoOpcion icono=\{o\.icono\} \/>\}/, 'el renglón');
  assert.match(DD, /\{g\.icono && <IconoOpcion icono=\{g\.icono\} \/>\}/, 'la fila que abre una sección');
  assert.match(DD, /\{!botonLabel && selected\?\.icono && <IconoOpcion icono=\{selected\.icono\}/, 'el botón');
  assert.doesNotMatch(DD, /<img src=\{o\.icono\}/, 'volvió la imagen suelta del renglón');
});

test('⚠️ BORRAR es UN dibujo y SIEMPRE rojo: en el menú, en el ícono suelto y en el botón', () => {
  const enMenu = renderToStaticMarkup(createElement(IconoMenu, { nombre: 'borrar' }));
  assert.match(enMenu, /color:var\(--bad\)/, 'el «borrar» del menú no es rojo');
  assert.doesNotMatch(renderToStaticMarkup(createElement(IconoMenu, { nombre: 'duplicar' })), /var\(--bad\)/, 'otro ícono salió rojo');
  assert.equal(renderToStaticMarkup(createElement(IconoMenu, { nombre: 'inventado' as never })), '', 'un nombre que no existe no dibuja un punto');
  const suelto = renderToStaticMarkup(createElement(IconoBorrar, {}));
  assert.match(suelto, /color:var\(--bad\)/);
  // El mismo dibujo en los dos (la tapa, la manija, el cuerpo relleno y las dos ranuras).
  const trazos = renderToStaticMarkup(createElement('svg', null, TRAZOS_BORRAR));
  const cuerpo = trazos.slice('<svg>'.length, trazos.length - '</svg>'.length);
  assert.ok(cuerpo.length > 100 && enMenu.includes(cuerpo) && suelto.includes(cuerpo), 'el menú y el botón dibujan tachos distintos');
  assert.match(cuerpo, /fill-opacity="0\.16"/, 'el cuerpo sin relleno: a 16 px se lee como cuatro rayas');
  // El botón: rojo, con su frase, y el color no se puede pisar desde afuera.
  const b = renderToStaticMarkup(createElement(BotonBorrar, { onClick: () => {}, title: 'Borrar esta tarjeta', style: { color: 'gray' } as never }));
  assert.match(b, /aria-label="Borrar esta tarjeta"/);
  assert.match(b, /title="Borrar esta tarjeta"/);
  assert.match(b, /color:var\(--bad\)/);
  assert.doesNotMatch(b, /color:gray/, 'el rojo se pudo cambiar desde afuera');
  assert.match(renderToStaticMarkup(createElement(BotonBorrar, { onClick: () => {}, texto: 'Eliminar' })), />Eliminar</);
});

// ── Roturas (09/10/2026) ─────────────────────────────────────────────────────────────────────
// Arnés en el scratchpad (editores-v6/romper.mjs): UNA rotura por vez, corre este archivo y restaura
// DE MEMORIA (nunca `git checkout --`). Base: 5 / 0. Pasan / fallan con cada una:
//   (se completa al correr el arnés; ver el pie definitivo)
