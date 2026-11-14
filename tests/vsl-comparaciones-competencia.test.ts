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
  assert.match(src, /x\.style\.display=j>=i&&j<i\+k\?'':'none'/, 'las flechas muestran la página siguiente de apps, enteras');
  assert.match(css, /\.s-mx-t thead th\{position:sticky;top:var\(--s-barra-alto,76px\)/, 'la cabecera no queda fija');
  assert.ok(existsSync(join(RAIZ, 'app/vsl/comparaciones/[slug]/page.tsx')), 'sin la página «MaKo vs X»');
});
