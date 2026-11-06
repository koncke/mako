// =============================================================================
// Los topes del plan en el CRM: leads y CRMs (23/10/2026)
// =============================================================================
// Pedido del Cerebro: MaKo Esencial (US$47) tiene 1 CRM y 2.000 leads (lib/topes-plan.ts). Al llegar al tope, un cartel
// corto y «Pasar a Pro», sin borrar ni esconder nada; SÓLO a quien MaKo cobra por la pasarela (nunca al ws1 ni a un
// acuerdo a mano); un lead que entra solo (anuncio, webhook) nunca se pierde: entra y se avisa.
// La decisión (lib/topes-crm-reglas.ts) se EJECUTA; la lectura, los frenos y la pantalla se leen como fuente.
//
// PROBADO ROMPIÉNDOLO (23/10/2026), con el archivo en 6 / 0, una rotura por vez y restaurada:
//   · `pasaElTope` que deja entrar uno de más (sin el `- 1`)                                → 5 / 1
//   · el tope aplicado sin mirar si MaKo le cobra el plan (`suscripcionDeMakoDe`)          → 5 / 1
//   · el freno en `createLead` (lo que entra solo se perdería)                              → 5 / 1
//   · el alta del tablero sin frenar                                                         → 5 / 1
//   · crear un CRM sin frenar                                                                → 5 / 1
//   · importar sin contar las filas que se crean                                             → 5 / 1
//   · el tablero sin el cartel                                                               → 5 / 1
//   · el error del tope sin «Pasar a Pro» en el alta                                         → 5 / 1
// Correr: node --import tsx --test tests/crm-topes-plan-23-10.test.ts
// =============================================================================

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { join } from 'node:path';
import { enElTope, pasaElTope } from '../lib/topes-crm-reglas';

const RAIZ = join(import.meta.dirname, '..');
const leer = (r: string) => readFileSync(join(RAIZ, r), 'utf8').replace(/\r\n/g, '\n');
const sinComentarios = (src: string) => src
  .replace(/^[ \t]*\/\/.*$/gm, '')
  .replace(/\{\/\*[\s\S]*?\*\/\}/g, '')
  .replace(/\/\*[\s\S]*?\*\//g, '');

test('la decisión: Esencial frena el alta 2.001 y el segundo CRM; Pro y quien no paga por la pasarela, nunca', () => {
  const esencial = (usadas: number) => ({ capa: 'completo', tope: 2000, usadas });
  assert.equal(pasaElTope(esencial(1999), 'crm.leads'), false, 'el 2.000 entra');
  assert.equal(pasaElTope(esencial(2000), 'crm.leads'), true, 'el 2.001, no');
  // Una importación: con 1.996 usados entran 4, no 5.
  assert.equal(pasaElTope(esencial(1996), 'crm.leads', 4), false);
  assert.equal(pasaElTope(esencial(1996), 'crm.leads', 5), true);
  assert.equal(pasaElTope(esencial(2500), 'crm.leads', 0), false, 'sin nada que crear, nada que frenar');
  assert.equal(pasaElTope({ capa: 'completo', tope: 1, usadas: 1 }, 'crm.funnels'), true, 'el segundo CRM');
  // Pro no tiene tope de leads, y null es «no se le aplica» (sin plan por la pasarela, o no se pudo leer).
  assert.equal(pasaElTope({ capa: 'agencia', tope: 0, usadas: 99999 }, 'crm.leads'), false);
  assert.equal(pasaElTope(null, 'crm.leads'), false);
  // El cartel: al llegar (lo que entró solo pudo pasarlo).
  assert.equal(enElTope(esencial(2000), 'crm.leads'), true);
  assert.equal(enElTope(esencial(2350), 'crm.leads'), true);
  assert.equal(enElTope(esencial(1999), 'crm.leads'), false);
  assert.equal(enElTope(null, 'crm.leads'), false);
});

test('sólo a quien MaKo cobra por la pasarela; un error nuestro no le corta el trabajo a nadie', () => {
  const t = sinComentarios(leer('lib/topes-crm.ts'));
  assert.match(t, /if \(!\(await aplicanTopes\(ws\)\)\) return null;/, 'el ws1 y los acuerdos a mano también son `completo` (aplicanTopes: la pasarela o una cuenta de agencia)');
  assert.match(t, /\} catch \(e\) \{[\s\S]*?return null;\s*\}/);
  assert.match(t, /select\('id', \{ count: 'exact', head: true \}\)/, 'contar sin traer: PostgREST corta en 1.000');
});

test('lo que entra solo nunca se pierde: el freno vive en las altas A MANO, no en createLead ni en los webhooks', () => {
  assert.doesNotMatch(leer('lib/leads.ts'), /topes-crm|frenarAltaPorTope/);
  const conFreno = execFileSync('git', ['grep', '--untracked', '-l', 'frenarAltaPorTope', '--', 'app', 'lib'], { cwd: RAIZ, encoding: 'utf8' }).trim().split('\n').sort();
  assert.deepEqual(conFreno, [
    'app/crm/actions.ts', 'app/crm/nuevo-crm-actions.ts', 'lib/api-mako/areas/chats.run.ts', 'lib/api-mako/areas/crm.run.ts',
    // (23/10/2026) crear_alumno_curso: un alumno nuevo es un lead que se crea a mano por la API, como el alta del CRM.
    'lib/api-mako/areas/curso.run.ts',
    // (6/11/2026) migrar_contactos: una migración la pide el dueño por la API, contacto por contacto; no entra sola.
    'lib/migracion-leads-server.ts',
    'lib/topes-crm.ts',
  ], 'un freno nuevo (o en un webhook) se decide a propósito');
});

test('los frenos: el alta del tablero y la de WhatsApp, importar (las que se crean), crear un CRM y MaKo', () => {
  const a = sinComentarios(leer('app/crm/actions.ts'));
  const alta = a.slice(a.indexOf('async function altaDeLead('), a.indexOf('await createLead(', a.indexOf('async function altaDeLead(')));
  assert.match(alta, /if \(ws != null\) await frenarAltaPorTope\(ws, 'crm\.leads'\);/);
  assert.match(a, /if \(wsAlta != null\) await frenarAltaPorTope\(wsAlta, 'crm\.leads'\);/);
  assert.match(a, /await frenarAltaPorTope\(wsImport, 'crm\.leads', validadas\.filter\(\(f\) => entra\(f\)\)\.length\);/);
  assert.match(a, /if \(e instanceof TopeDelPlanError\) return \{ error: e\.message, coincidencias: \[\], pasarAPro: true \};/);
  const c = sinComentarios(leer('app/crm/nuevo-crm-actions.ts'));
  const iFreno = c.indexOf("if (ws != null) await frenarAltaPorTope(ws, 'crm.funnels');");
  assert.ok(iFreno > 0 && iFreno < c.indexOf('await crearCrm('), 'el CRM se frena antes de crearse');
  assert.match(c, /if \(e instanceof TopeDelPlanError\) return \{ error: e\.message, pasarAPro: true \};/);
  const run = sinComentarios(leer('lib/api-mako/areas/crm.run.ts'));
  assert.match(run, /if \(tope && enElTope\(tope, 'crm\.funnels'\)\) return \{ error:/, 'MaKo no propone un CRM que va a fallar');
  assert.match(sinComentarios(leer('lib/api-mako/areas/chats.run.ts')), /if \(err instanceof TopeDelPlanError\) return \{ ok: false, resumen:/);
});

test('la pantalla: el cartel en el tablero y «Pasar a Pro» al lado del error, sin borrar ni esconder nada', () => {
  const p = sinComentarios(leer('app/crm/page.tsx'));
  assert.match(p, /topeLeads=\{tope && enElTope\(tope, 'crm\.leads'\) \? tope\.tope : null\}/);
  const b = sinComentarios(leer('app/crm/CrmBoard.tsx'));
  assert.match(b, /\{topeLeads != null && <div style=\{\{ flex: 'none' \}\}><CartelTope tope=\{topeLeads\} \/><\/div>\}/);
  const v = sinComentarios(leer('app/crm/PasarAPro.tsx'));
  assert.match(v, /<span style=\{\{ flex: '1 1 260px' \}\}>\{textoTope\(tope\)\}<\/span>\s*<PasarAPro \/>/);
  // La ruta de «Pasar a Pro» es UNA, la de lib/topes-plan.ts (Planes, 23/10/2026): el panel del plan, no `/planes`.
  assert.match(v, /<Link href=\{RUTA_CAMBIAR_PLAN\} /);
  assert.doesNotMatch(v, /href=['"]\//, 'una ruta escrita a mano');
  assert.match(sinComentarios(leer('app/crm/new/NewLeadForm.tsx')), /setTope\(r\.pasarAPro === true\);[\s\S]*\{err\}<\/span>\{tope && <PasarAPro \/>\}/);
  assert.match(sinComentarios(leer('app/crm/CrmToolbar.tsx')), /setTope\(r\.pasarAPro === true\);[\s\S]*\{err\}<\/span>\{tope && <PasarAPro \/>\}/);
});

test('el texto del cartel es el de la tabla del Cerebro (lib/topes-plan.ts), no uno propio', () => {
  const t = sinComentarios(leer('lib/topes-crm.ts'));
  assert.match(t, /super\(textoTope\(tope\)\);/);
});
