// =============================================================================
// /vsl/comparaciones contra la competencia, app por app (14/11/2026)
// =============================================================================
// Martín (14/11/2026): «no es como la referencia» (beehiiv.com/comparisons): scrolleable, una tabla de lo que la competencia tiene
// o no tiene, comentarios y las tarjetas «MaKo vs X» abajo. Lo que se fija acá:
//   · cada app tiene su logo en disco, su página, su comentario y sus tres «Elige X si»;
//   · cada celda es «si», «no», «?» (sin dato: nunca se muestra como un «no») o un valor corto;
//   · la columna de MaKo sale del CÓDIGO: lo que es sólo de Pro (lib/topes-plan.ts) dice «En Pro» y el precio es el de Esencial;
//   · la página tiene la tabla que se desliza (con sus flechas), las tarjetas y, en cada «MaKo vs X», la tabla de las dos.
// =============================================================================

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { COMPETIDORES, ELIGE_MAKO_SI, GRUPOS_MATRIZ, celdaDeMaKo, rutaVs } from '../app/vsl/_sitio/competencia';
import { PLANES_MAKO_DEFAULT } from '../lib/planes-mako';
import { FUNCIONES_SOLO_PRO } from '../lib/topes-plan';

const RAIZ = join(import.meta.dirname, '..');

test('cada app: logo en disco, slug de URL, comentario corto y tres «Elige X si»', () => {
  const slugs = new Set<string>();
  for (const c of COMPETIDORES) {
    assert.ok(existsSync(join(RAIZ, 'public', c.logo)), `${c.nombre}: falta ${c.logo}`);
    assert.match(c.slug, /^[a-z0-9-]+$/, `${c.nombre}: slug «${c.slug}»`);
    assert.ok(!slugs.has(c.slug), `${c.slug} repetido`); slugs.add(c.slug);
    assert.equal(rutaVs(c), `/vsl/comparaciones/${c.slug}`);
    assert.ok(c.comentario.length > 20 && c.comentario.split(/\s+/).length <= 22, `${c.nombre}: comentario «${c.comentario}»`);
    assert.equal(c.eligeSi.length, 3, `${c.nombre}: «Elige X si» no tiene tres`);
  }
});

test('cada celda es sí, no, sin dato o un valor corto; los «sí» y «no» de las apps grandes llevan su fuente', () => {
  const claves = GRUPOS_MATRIZ.flatMap((g) => g.filas.map((f) => f.clave));
  for (const c of COMPETIDORES) {
    for (const k of claves) {
      const v = c.celdas[k]?.v;
      if (v == null) continue;
      assert.ok(v === 'si' || v === 'no' || v === '?' || (v.length > 0 && v.length <= 24), `${c.nombre} / ${k}: «${v}»`);
    }
    // Una app de todo en uno (CRM, landings y automatizaciones a la vez) tiene la fuente de lo que se le afirma.
    const todoEnUno = ['crm', 'landings', 'automatizaciones'].every((k) => c.celdas[k as 'crm']?.v === 'si');
    if (todoEnUno) {
      const conFuente = claves.filter((k) => c.celdas[k]?.fuente).length;
      assert.ok(conFuente >= 3, `${c.nombre}: casi sin fuentes (${conFuente})`);
    }
  }
});

test('la columna de MaKo sale del código: el precio de Esencial y «En Pro» en lo que es de Pro', () => {
  assert.equal(celdaDeMaKo('precio').v, `US$ ${PLANES_MAKO_DEFAULT.find((p) => p.id === 'esencial')!.precioUsd}`);
  const pro = (f: string) => (FUNCIONES_SOLO_PRO as readonly string[]).includes(f);
  assert.equal(celdaDeMaKo('copiar_landing').v, pro('replicar-landing') ? 'En Pro' : 'si');
  assert.equal(celdaDeMaKo('comunidad').v, pro('comunidad') ? 'En Pro' : 'si');
  assert.equal(celdaDeMaKo('crm').v, 'si');
  assert.equal(ELIGE_MAKO_SI.length, 5);
});

test('la página: la tabla que se desliza con sus flechas, las tarjetas «MaKo vs X» y la página de cada una', () => {
  const src = readFileSync(join(RAIZ, 'app/vsl/_sitio/Comparaciones.tsx'), 'utf8');
  assert.match(src, /<TablaCompetencia competidores=\{COMPETIDORES\} \/>/, 'el índice muestra todas las apps');
  assert.match(src, /data-mx-ir="1"/, 'sin las flechas');
  assert.match(src, /<script data-visor="" dangerouslySetInnerHTML=\{\{ __html: SCRIPT_FLECHAS \}\} \/>/, 'las flechas sin su script');
  assert.match(src, /<TarjetasVs \/>/, 'sin las tarjetas «MaKo vs X»');
  assert.match(src, /<TablaCompetencia competidores=\{\[c\]\} \/>/, 'la página de cada app sin su tabla');
  const css = readFileSync(join(RAIZ, 'app/vsl/_sitio/estilos.ts'), 'utf8');
  assert.match(css, /\.s-mx-caja\{overflow:clip;/, 'la tabla, entera y sin caja con scroll (14/11, noche: sin barras ni scroll de costado)');
  // Martín, 14/11: las flechas ya no esconden y muestran columnas (`display`): las DESLIZAN («tiene que verse una animación de
  // desplazamiento… si no, no se entiende»). El script corre --mx-x una página entera; el CSS lo anima en 300 ms, y con «menos
  // movimiento» no anima.
  assert.match(src, /c\.style\.setProperty\('--mx-x',\(-i\*w\)\+'px'\)/, 'las flechas no corren las columnas una página');
  assert.match(css, /\.s-mx:not\(\[data-una\]\) \[data-c\]\{transform:translateX\(var\(--mx-x,0px\)\);transition:transform \.3s /, 'las columnas no se deslizan en 300 ms');
  const quieto = css.split('@media (prefers-reduced-motion:reduce){').slice(1).some((b) => b.slice(0, b.search(/\r?\n\}/)).includes('.s-mx:not([data-una]) [data-c]{transition:none}'));
  assert.ok(quieto, 'con «menos movimiento» las columnas se deslizan igual');
  assert.match(css, /\.s-mx-t thead th\{position:sticky;top:var\(--s-barra-alto,76px\)/, 'la cabecera no queda fija');
  assert.ok(existsSync(join(RAIZ, 'app/vsl/comparaciones/[slug]/page.tsx')), 'sin la página «MaKo vs X»');
});

test('Martín, 14/11: lo que pagas hoy al principio, la tarjeta abre su panel ahí mismo, sin la nota de las fuentes y el ícono según el modo', () => {
  const src = readFileSync(join(RAIZ, 'app/vsl/_sitio/Comparaciones.tsx'), 'utf8');
  const css = readFileSync(join(RAIZ, 'app/vsl/_sitio/estilos.ts'), 'utf8');
  const indice = src.slice(src.indexOf('export function ComparacionesSitio'));
  // Martín, 14/11 (más tarde): sin el hero de arriba; la página EMPIEZA con el ticket (su titular es el h1).
  const seccion = indice.indexOf('<SeccionReemplaza claro principal />');
  assert.ok(seccion > 0 && seccion < indice.indexOf('id="comparar"'), 'lo que pagas hoy no va al principio, antes de la tabla');
  assert.doesNotMatch(indice.slice(0, indice.indexOf('<Pie />')), /className="s-ch"/, 'volvió el hero «MaKo contra las apps que ya pagas»');
  // La tarjeta: un label con su casilla adentro y su panel como hermano (anda sin JavaScript y en el visor). Nunca un link a otra página.
  const tarjetas = src.slice(src.indexOf('export function TarjetasVs'), src.indexOf('const CSS = '));
  assert.match(tarjetas, /<label className="s-vs">\s*<input type="checkbox" id=\{idCasilla\(c\)\}/, 'la tarjeta no tiene su casilla adentro');
  assert.match(tarjetas, /<\/label>\s*<PanelVs c=\{c\} \/>/, 'el panel no sigue a su tarjeta');
  assert.doesNotMatch(tarjetas, /href=/, 'la tarjeta vuelve a llevar a otra página');
  assert.match(css, /\.s-vs:has\(> \.s-vs-ck:checked\) \+ \.s-vs-panel/, 'el panel no se abre con la casilla');
  assert.match(css, /\.s-cv-grilla\{[^}]*grid-auto-flow:row dense/, 'el panel no cae debajo de la fila de su tarjeta');
  assert.doesNotMatch(src, /<p className="s-mx-nota">/, 'volvió la nota de las fuentes («Lo de cada app sale de su web oficial…»)');
  // El ícono de MaKo: fijo para el sol y la luna, negro de base y blanco en el modo oscuro.
  assert.ok((src.match(/s-mk-ico" data-tema-fijo=""/g) ?? []).length >= 3, 'un ícono de MaKo sin `.s-mk-ico` y `data-tema-fijo`');
  assert.match(css, /\.s-mk-ico\{background:#1A1712\}\r?\nhtml\[data-sitio-modo="oscuro"\] \.s-mk-ico\{background:#fff\}/, 'el ícono no cambia con el modo');
});
