// =============================================================================
// Las apps que MaKo reemplaza (app/vsl/_sitio/reemplaza.ts): cada una con su logo de verdad, y el número que se dice es el de la lista
// =============================================================================
// Martín (12/11/2026): «te quedaste muy corto con esas 8. Pero fíjate que siempre los logos sean los logos reales originales».
// Lo que se cuida: cada app tiene su archivo en public/vsl-assets/logos/apps/ (un logo que no está se ve como un recuadro blanco
// vacío), ninguna se repite, no entran las apps con las que MaKo se CONECTA (ésas no se reemplazan) y el titular de la comparación,
// y la tira de la portada dicen el mismo número («MaKo, en números» se fue el 12/11/2026).
// PROBADO ROMPIÉNDOLO (12/11/2026): un logo con el nombre mal escrito → 0 / 1; «Calendly» sumada a la lista → 0 / 1; el video de
// una tarjeta con el nombre mal escrito → 0 / 1.
// Correr: node --import tsx --test tests/vsl-sitio-reemplaza.test.ts
// =============================================================================
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { STACK_QUE_REEMPLAZA, appsQueReemplaza, appsDeLaTira } from '../app/vsl/_sitio/reemplaza';
import { PLANES_MAKO_DEFAULT } from '../lib/planes-mako';
import { GRUPOS_DEL_AHORRO, STACK_TIPICO } from '../app/vsl/_sitio/reemplaza';
import { LOGO_INTEGRACION, TARJETAS_PORTADA, filasDeComparacion, nAppsQueReemplaza } from '../app/vsl/_sitio/datos';

const RAIZ = join(import.meta.dirname, '..');
const CONECTA = /calendly|cal\.com|fathom|stripe|mercado pago|zoom|whatsapp|meta ads|google/i;

test('cada app con su logo en disco, una sola vez, y ninguna de las que se conectan', () => {
  const todas = STACK_QUE_REEMPLAZA.flatMap((t) => t.apps);
  for (const a of todas) {
    assert.ok(existsSync(join(RAIZ, 'public', a.logo)), `${a.nombre}: falta ${a.logo}`);
    assert.doesNotMatch(a.nombre, CONECTA, `${a.nombre}: MaKo se conecta con ella, no la reemplaza`);
  }
  assert.equal(new Set(todas.map((a) => a.nombre)).size, todas.length, 'una app repetida');
  assert.ok(appsQueReemplaza().length >= 40, 'eran 8 y Martín pidió todas');
});

test('el número de la comparación es el de la lista, y cada trabajo lleva a su landing', () => {
  const n = nAppsQueReemplaza();
  assert.equal(n, appsQueReemplaza().length);
  for (const f of filasDeComparacion()) {
    assert.ok(f.apps.length > 0, `${f.trabajo}: sin apps`);
    assert.ok(f.href.startsWith('/vsl/') || f.href.startsWith('#fila-'), `${f.trabajo}: ${f.href}`);
  }
});

test('las grabaciones de «Todo lo que necesitas» y los logos de «Funciona con las apps que ya usas» están en disco', () => {
  for (const t of TARJETAS_PORTADA) {
    if (typeof t.visual !== 'object' || !('video' in t.visual)) continue;
    for (const f of [t.visual.video, t.visual.poster]) assert.ok(existsSync(join(RAIZ, 'public', f)), `${t.slug}: falta ${f}`);
  }
  for (const [id, f] of Object.entries(LOGO_INTEGRACION)) assert.ok(existsSync(join(RAIZ, 'public', 'vsl-assets', 'logos', 'integraciones', f)), `${id}: falta ${f}`);
});

// Martín, 13/11/2026: «no pongas 54 en ningún lado, porque es un número muy ambiguo… nadie estaría pagando las 54».
test('la cantidad de apps que MaKo reemplaza no se dice en ningún lado del sitio', () => {
  const fuentes = ['app/vsl/_sitio/Portada.tsx', 'app/vsl/_sitio/Comparaciones.tsx', 'app/vsl/comparaciones/page.tsx', 'app/vsl/_sitio/datos.ts'];
  for (const f of fuentes) {
    const s = readFileSync(join(RAIZ, f), 'utf8');
    assert.doesNotMatch(s, /\{(apps\.length|n)\} apps|\$\{(n|appsQueReemplaza\(\)\.length|nAppsQueReemplaza\(\))\}( apps)?/, `${f}: dice cuántas apps reemplaza`);
    assert.doesNotMatch(s, /String\(nAppsQueReemplaza\(\)\)/, `${f}: lo muestra como cifra`);
  }
});

test('el ahorro de la portada es el de un stack típico con su precio, y sale a favor de MaKo Pro', () => {
  const pro = PLANES_MAKO_DEFAULT.find((p) => p.id === 'pro');
  assert.ok(pro, 'sin plan Pro');
  // 13 como tope: la llamada con Leila (13/11/2026) sumó HeyGen y OpusClip a las 9, y Martín (14/11/2026) Zapier y Metricool; sigue
  // siendo un stack, no las 54.
  assert.ok(STACK_TIPICO.length >= 3 && STACK_TIPICO.length <= 13, 'un stack realista, no las 54');
  // Martín, 14/11/2026: «todas las que están en la lista de los precios… deberían estar también ahí en el carrusel».
  const tira = new Set(appsDeLaTira().map((a) => a.nombre));
  for (const x of STACK_TIPICO) assert.ok(tira.has(x.app.nombre), `${x.app.nombre}: está en el ahorro y no en la tira`);
  for (const x of STACK_TIPICO) {
    assert.ok(x.precioUsd > 0 && /^https:\/\//.test(x.fuente), `${x.app.nombre}: sin precio o sin fuente`);
    assert.ok(existsSync(join(RAIZ, 'public', x.app.logo)), `${x.app.nombre}: falta su logo`);
  }
  assert.ok(STACK_TIPICO.reduce((s, x) => s + x.precioUsd, 0) > pro!.precioUsd, 'el ahorro saldría negativo');
});

// Martín, 14/11/2026, de la lista en dos columnas: «está todo muy junto y no se llega a entender muy bien de quién es el precio». Cada
// app va en un grupo (para qué sirve), cada fila lleva logo, nombre y precio juntos, y es UNA sección para la portada y Comparaciones.
test('lo que pagas hoy: cada app en su grupo, una fila por app y la misma sección en la portada y en Comparaciones', () => {
  for (const x of STACK_TIPICO) assert.ok((GRUPOS_DEL_AHORRO as readonly string[]).includes(x.grupo), `${x.app.nombre}: sin grupo`);
  for (const g of GRUPOS_DEL_AHORRO) assert.ok(STACK_TIPICO.some((x) => x.grupo === g), `${g}: un grupo vacío`);
  const lqp = readFileSync(join(RAIZ, 'app/vsl/_sitio/LoQuePagas.tsx'), 'utf8');
  assert.match(lqp, /<li [^>]*className="s-ah-f"[\s\S]{0,400}<img [\s\S]{0,200}"s-ah-n"[\s\S]{0,120}"s-ah-guia"[\s\S]{0,120}"s-ah-p"/, 'la fila no tiene logo, nombre y precio juntos');
  assert.match(readFileSync(join(RAIZ, 'app/vsl/_sitio/Portada.tsx'), 'utf8'), /<SeccionReemplaza ver=\{RUTA_COMPARACIONES\} \/>/, 'la portada sin la sección');
  assert.match(readFileSync(join(RAIZ, 'app/vsl/_sitio/Comparaciones.tsx'), 'utf8'), /<SeccionReemplaza claro \/>/, 'Comparaciones sin la sección');
});
