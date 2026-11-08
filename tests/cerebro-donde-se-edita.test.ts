// =============================================================================
// El dato del cerebro dice DÓNDE SE EDITA, o MaKo contesta «no sé» (Leila, 3/11/2026)
// =============================================================================
// Leila Fittipaldi (ws 11, plan Completo) levantó TRES tickets en treinta minutos —#46, #47 y #48—
// y los tres son el mismo hueco. El peor, el #48: preguntó «¿y dónde actualizo mis datos?, porque
// hay varios datos que se modificaron, como por ejemplo el 7 a 9 es 7.30 a 9.30pm» y MaKo contestó
// «la ruta exacta para editar esos datos no la tengo confirmada, y prefiero no inventarte un menú
// que no existe».
//
// El dato ESTABA. `NodoCerebro` trae `href` y `abrirEn` desde siempre (lib/cerebro-modelo.ts:193)
// y la barra lateral del grafo los usa para su «Abrir en <abrirEn>». Lo que fallaba eran las dos
// proyecciones por las que MaKo lee el cerebro, que los tiraban: la búsqueda
// (lib/api-mako/areas/negocio.run.ts) y el vault (lib/vault-modelo.ts). MaKo veía el valor del dato
// y no la pantalla que lo edita, así que sólo le quedaban dos salidas y las dos son malas:
// inventar una ruta, o decir que no sabe.
//
// Fija: que las dos proyecciones lleven el campo, y que salga del nodo y no de una constante.
// Correr: node --import tsx --test tests/cerebro-donde-se-edita.test.ts
// ROTURAS (8/11/2026, una por vez y restaurada; base 3 / 0): sacar `se_edita_en` de la búsqueda
// → 2 / 1; sacarlo del vault → 2 / 1; cablearlo a un string fijo en vez de `n.href` → 2 / 1.
// =============================================================================
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const leer = (p: string) => readFileSync(join(process.cwd(), p), 'utf8');

test('la búsqueda de MaKo en el cerebro dice dónde se edita cada dato', () => {
  const s = leer('lib/api-mako/areas/negocio.run.ts');
  const i = s.indexOf('buscar_en_segundo_cerebro');
  assert.ok(i > 0, 'no existe la herramienta buscar_en_segundo_cerebro');
  const bloque = s.slice(i, i + 3000);
  assert.match(bloque, /se_edita_en:/, 'la proyección tiene que llevar se_edita_en: sin eso MaKo dice «no sé» (ticket #48)');
  // Del nodo, no de una constante: si se cablea, miente en todos los nodos menos uno.
  assert.match(bloque, /se_edita_en:\s*n\.href\s*\?/, 'se_edita_en sale de n.href, no de un valor fijo');
  assert.match(bloque, /n\.abrirEn/, 'y lleva el nombre de la pantalla (abrirEn), no sólo la url');
});

test('el vault que MaKo lee como archivos también lo dice', () => {
  const s = leer('lib/vault-modelo.ts');
  assert.match(s, /se_edita_en:/, 'el frontmatter de cada archivo tiene que decir dónde se edita');
  assert.match(s, /se_edita_en:\s*n\.abrirEn\s*\|\|/, 'sale del nodo (abrirEn, y si no el href)');
});

test('⚠️ el nodo SIEMPRE tuvo el dato: el hueco estaba en quien lo proyecta', () => {
  const m = leer('lib/cerebro-modelo.ts');
  assert.match(m, /href\?:\s*string;/, 'NodoCerebro declara href');
  assert.match(m, /abrirEn\?:\s*string;/, 'NodoCerebro declara abrirEn');
  // Quien los puebla: si nadie lo hace, el campo nuevo sale siempre vacío y no arregla nada.
  const vivo = leer('lib/cerebro-vivo.ts');
  assert.ok((vivo.match(/abrirEn:/g) ?? []).length >= 8,
    'lib/cerebro-vivo.ts tiene que poblar abrirEn en varios nodos, o se_edita_en viaja vacío');
});
