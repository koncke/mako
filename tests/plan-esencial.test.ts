// =============================================================================
// MaKo Esencial: las tabs de Pro con candado y «Pasar a Pro», y el tope de automatizaciones al activar (23/10/2026)
// =============================================================================
// Las ofertas: docs/ofertas-mako.md; la tabla: lib/topes-plan.ts. Fija:
//   1. QUIÉN es Esencial: sólo quien MaKo le cobra el Esencial por la pasarela (el plan vendido, `alta_capa`, y la capa de hoy
//      `completo`); nunca el ws1, la plataforma, un acuerdo a mano ni un Pro, y ante la duda, nadie;
//   2. QUÉ tabs: las de TABS_SOLO_PRO como claves de la barra que existen (Closing Analyst es una hoja del Dashboard: aparte);
//   3. DÓNDE: la puerta de la página (computadora y teléfono) manda al cartel con «Pasar a Pro», y la barra y More lo dicen;
//   4. EL TOPE: las tres puertas que prenden una automatización preguntan `topeAlActivar` ANTES de `setSecuenciaActiva`, sin
//      tocar lib/nutricion.ts (del chat «Automations»).
//
// Correr: node --import tsx --test tests/plan-esencial.test.ts
//
// ⚠️ PROBADO ROMPIENDOLO (23/10/2026): ver el pie del archivo.
// =============================================================================

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { NAV_SOLO_PRO, SOLO_PRO_FUERA_DE_LA_BARRA, esEsencialPorPasarela, esNavSoloPro } from '../lib/plan-esencial-reglas';
import { TABS_SOLO_PRO, cabeOtra, topeDe } from '../lib/topes-plan';

const leer = (f: string) => readFileSync(f, 'utf8').replace(/\r\n/g, '\n');
const sinComentarios = (s: string) => s.replace(/^[ \t]*\/\/.*$/gm, '').replace(/\{\/\*[\s\S]*?\*\/\}/g, '');

test('1. Esencial = el Esencial vendido por la pasarela y la capa de hoy; nunca el ws1, la plataforma, un Pro ni un acuerdo a mano', () => {
  const base = { ws: 30, wsPlataforma: 9, capa: 'completo', capaVendida: 'completo' };
  assert.equal(esEsencialPorPasarela(base), true);
  assert.equal(esEsencialPorPasarela({ ...base, ws: 1 }), false, 'el ws1 (Mauricio, acuerdo a mano)');
  assert.equal(esEsencialPorPasarela({ ...base, ws: 9 }), false, 'la plataforma');
  assert.equal(esEsencialPorPasarela({ ...base, capaVendida: 'agencia' }), false, 'un Pro, aunque su capa todavía diga completo');
  assert.equal(esEsencialPorPasarela({ ...base, capaVendida: null }), false, 'sin suscripción de la pasarela');
  assert.equal(esEsencialPorPasarela({ ...base, capa: 'agencia' }), false, 'pasado a mano a otra capa');
  assert.equal(esEsencialPorPasarela({ ...base, ws: null }), false);
  // Ante la duda, nadie: la lectura de la base no saca tabs ni frena activaciones si falla.
  const lectura = sinComentarios(leer('lib/plan-esencial.ts'));
  assert.match(lectura, /catch \(e\) \{\n\s*console\.warn\([\s\S]*?\);\n\s*return false;/, 'un error de lectura tiene que dar «no es Esencial»');
});

test('2. las tabs de Pro son claves que existen en la barra; Closing Analyst va aparte', () => {
  // Se lee del archivo: AI Avatar (sólo del super admin por ahora) no está en las listas de los negocios.
  const nav = leer('app/_components/nav.ts');
  for (const k of NAV_SOLO_PRO) assert.ok(nav.includes(`key: '${k}'`), `«${k}» no es una clave de app/_components/nav.ts`);
  for (const t of TABS_SOLO_PRO) assert.ok(NAV_SOLO_PRO.has(t) || SOLO_PRO_FUERA_DE_LA_BARRA.has(t), `«${t}» de TABS_SOLO_PRO sin candado`);
  assert.equal(esNavSoloPro('crm'), false);
});

test('3. la puerta de la página manda al cartel con «Pasar a Pro», y la barra y More lo dicen', () => {
  const acceso = sinComentarios(leer('lib/tab-access.ts'));
  assert.match(acceso, /if \(!tabEnCapa\(nav, capa\)\)[^\n]*\n\s*if \(esNavSoloPro\(nav\) && \(await esEsencialDeLaSesion\(\)\)\) redirect\(await rutaConWs\(`\/no-esta-en-tu-plan\?tab=\$\{encodeURIComponent\(nav\)\}&pro=1`\)\);/);
  assert.match(sinComentarios(leer('lib/movil-guard.ts')), /if \(opts\.navKey && esNavSoloPro\(opts\.navKey\) && \(await esEsencialDeLaSesion\(\)\)\) redirect\(/);
  assert.match(sinComentarios(leer('app/no-esta-en-tu-plan/page.tsx')), /label: pro \? ROTULO_PASAR_A_PRO : 'Ver mi plan'/);
  assert.match(sinComentarios(leer('app/api/auth/me/route.ts')), /planEsencial: await esEsencialDeLaSesion\(\),/);
  const barra = sinComentarios(leer('app/_components/Sidebar.tsx'));
  assert.match(barra, /const esPro = \(key: string\) => planEsencial && esNavSoloPro\(key\);/);
  assert.equal((barra.match(/pro=\{esPro\(it\.key\)\}/g) ?? []).length, 3, 'las tres filas de la barra (suelta, en familia y en el desplegable)');
  assert.match(barra, /\{expanded && pro && <Candado \/>\}/);
  assert.match(sinComentarios(leer('app/m/mas/page.tsx')), /esencial && esNavSoloPro\(f\.key\) \? \{ segunda: `De MaKo Pro · \$\{ROTULO_PASAR_A_PRO\}` \}/);
});

test('4. el tope de automatizaciones: 3 en el Esencial, preguntado en cada puerta ANTES de prender, sin tocar el motor', () => {
  assert.equal(topeDe('completo', 'automations.activas'), 3);
  assert.equal(cabeOtra('completo', 'automations.activas', 2), true);
  assert.equal(cabeOtra('completo', 'automations.activas', 3), false);
  assert.equal(topeDe('agencia', 'automations.activas'), null, 'el Pro, sin tope');
  for (const f of ['app/api/email/secuencias/route.ts', 'app/api/whatsapp/secuencias/route.ts', 'lib/mako-doer-acciones.ts']) {
    const src = sinComentarios(leer(f));
    const i = src.indexOf('topeAlActivar(id');
    const j = src.indexOf('setSecuenciaActiva(id');
    assert.ok(i > 0 && j > i, `${f}: el tope tiene que preguntarse ANTES de prender`);
  }
  const tope = sinComentarios(leer('lib/tope-automations.ts'));
  assert.match(tope, /if \(ws == null \|\| !\(await esEsencialDe\(ws\)\)\) return null;/, 'sólo al Esencial de la pasarela');
  assert.match(tope, /\?\.activa === true\) return null;/, 'volver a prender una prendida no cuenta');
  assert.doesNotMatch(leer('lib/nutricion.ts'), /tope-automations|topeAlActivar/, 'el motor es de Automations: no se toca');
});

// PROBADO ROMPIÉNDOLO (23/10/2026, base 4/0, de a una; cada una → 3/1):
//   · un Pro (vendido `agencia`) con capa `completo` y candado        → 1
//   · el ws1 sin exención                                             → 1
//   · requireCapa sin el candado                                      → 3
//   · el desplegable de la barra sin el candado                       → 3
//   · /api/email/secuencias sin preguntar el tope                     → 4
//   · una automatización YA prendida contando como otra más           → 4
