// =============================================================================
// El plan dado A MANO con vencimiento: tiene los topes de la prueba y, al vencer, avisa (28/10/2026)
// =============================================================================
// Lo que Martín le prometió a Teo (C:/dev/revisiones/2810-promesas-teo.md, 01:03:00): «te puedo dar 7 días de prueba sin
// problema». Sin pasarela, la única forma era darle el plan a mano en Customers, y un plan a mano no vencía ni tenía los topes
// de la prueba. LA DECISIÓN (el Cerebro, 28/10, de una de Martín): mientras el corte de acceso general siga apagado
// (`CORTE_DE_ACCESO_PRENDIDO = false`), al vencer NO se pausa al negocio: se le avisa a Martín y a la persona. El día que se
// prenda el corte, ese plan cae en el corte como cualquier otro, sin una regla aparte.
//
// LO QUE SE CUIDA ACÁ:
//   · el vencimiento se guarda como un setting del negocio (`plan.a_mano`), sin migración, y se lee tolerante;
//   · mientras lo tiene (vigente o vencido sin resolver), el negocio está «en prueba»: los topes de la prueba valen;
//   · al vencer, UN aviso a la persona y otro a Martín, una sola vez; NUNCA una pausa;
//   · en Customers se da junto con el plan, y la plataforma nunca lo recibe.
//
// Probado rompiéndolo (28/10/2026): al pie del archivo.
// Correr: node --import tsx --test tests/plan-a-mano.test.ts
// =============================================================================

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { avisosPlanAManoVencido, CLAVE_PLAN_A_MANO, DIAS_PLAN_A_MANO, leerPlanAMano, planAManoNuevo, tocaAvisarPlanAMano } from '../lib/plan-a-mano-reglas';

const RAIZ = join(import.meta.dirname, '..');
const fuente = (rel: string) => readFileSync(join(RAIZ, rel), 'utf8').replace(/\r\n/g, '\n');
const sinComentarios = (src: string) => src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^[ \t]*\/\/.*$/gm, '');
const DIA = 86_400_000;
const AHORA = Date.parse('2026-10-28T12:00:00.000Z');

test('el vencimiento se arma con los días elegidos y se lee tolerante', () => {
  assert.equal(CLAVE_PLAN_A_MANO, 'plan.a_mano');
  assert.deepEqual([...DIAS_PLAN_A_MANO], [7, 14, 30]);
  const p = planAManoNuevo(7, AHORA);
  assert.deepEqual(p, { desde: new Date(AHORA).toISOString(), hasta: new Date(AHORA + 7 * DIA).toISOString(), avisadoAt: null });
  assert.deepEqual(leerPlanAMano(JSON.stringify(p)), p, 'ida y vuelta');
  for (const malo of [0, -3, 2.5, 61, Number.NaN]) assert.throws(() => planAManoNuevo(malo, AHORA), /días/, String(malo));
  for (const crudo of [null, '', 'no es json', '[]', '{"hasta":"cualquier cosa"}', '{"desde":"2026-10-28T12:00:00.000Z"}']) {
    assert.equal(leerPlanAMano(crudo), null, String(crudo));
  }
});

test('al vencer toca avisar UNA vez; antes de vencer y ya avisado, no', () => {
  const p = planAManoNuevo(7, AHORA);
  assert.equal(tocaAvisarPlanAMano(p, AHORA + 6 * DIA), false, 'todavía no vence');
  assert.equal(tocaAvisarPlanAMano(p, AHORA + 7 * DIA), true, 'vence el día 7');
  assert.equal(tocaAvisarPlanAMano({ ...p, avisadoAt: new Date(AHORA + 7 * DIA).toISOString() }, AHORA + 8 * DIA), false, 'ya se avisó');
});

test('los dos avisos: a la persona (sin pausa, qué sigue) y a Martín (qué hacer en Customers), en español neutro', () => {
  const a = avisosPlanAManoVencido({ negocio: 'Estudio Sur', plan: 'MaKo Pro', hasta: '2026-11-04T12:00:00.000Z', linkPlan: 'https://hola-mako.com/configuraciones/plan', linkCustomers: 'https://hola-mako.com/admin' });
  assert.match(a.persona.asunto, /prueba/i);
  assert.match(a.persona.cuerpo, /Estudio Sur/);
  assert.match(a.persona.cuerpo, /MaKo Pro/);
  assert.match(a.persona.cuerpo, /https:\/\/hola-mako\.com\/configuraciones\/plan/);
  assert.doesNotMatch(a.persona.cuerpo, /paus|cort|suspend|bloque/i, 'no se le dice que se corta: no se corta');
  assert.match(a.martin.asunto, /Estudio Sur/);
  assert.match(a.martin.cuerpo, /https:\/\/hola-mako\.com\/admin/);
  assert.match(a.martin.cuerpo, /no se paus/i, 'Martín sabe que no se pausó nada');
  for (const t of [a.persona.asunto, a.persona.cuerpo, a.martin.asunto, a.martin.cuerpo]) {
    assert.doesNotMatch(t, /\b(?:tenés|podés|querés|mirá|fijate|entrá|elegí|escribinos|avisanos|pasá)\b/i, `voseo: ${t}`);
  }
});

test('mientras lo tiene, el negocio está «en prueba» (los topes valen); sin él, como antes', () => {
  const e = sinComentarios(fuente('lib/prueba-uso.ts'));
  const est = e.slice(e.indexOf('export const estadoDePrueba = cache('));
  const cobro = est.indexOf('if (!c) return await deUnPlanAMano(ws, nada);');
  assert.ok(cobro > 0, 'sin ninguna suscripción de MaKo, mira el plan a mano');
  // Con una suscripción PAGADA, nunca: un vencimiento a mano viejo no le vuelve a poner los topes a quien ya paga.
  assert.ok(est.indexOf("if (!esPruebaDePlan(c) || c.estado !== 'pendiente') return nada;") > cobro, 'con un cobro, como siempre');
  const aMano = e.slice(e.indexOf('async function deUnPlanAMano('));
  assert.match(aMano, /const p = leerPlanAMano\(await runWithWorkspace\(ws, \(\) => getSetting\(CLAVE_PLAN_A_MANO\)\)\);/);
  assert.match(aMano, /if \(!p\) return nada;/);
  assert.match(aMano, /return \{ enPrueba: true, capa, hasta: p\.hasta, despues: null, plan: nombreDePlan\(capa\), dias: diasQueQuedan\(p\.hasta, Date\.now\(\)\) \};/);
});

test('al vencer: avisa y marca, y NUNCA pausa (el corte general está apagado: decisión del 28/10)', () => {
  const s = sinComentarios(fuente('lib/plan-a-mano.ts'));
  const v = s.slice(s.indexOf('export async function avisarPlanesAManoVencidos('));
  assert.match(v, /\.from\('app_settings'\)\.select\('workspace_id, value'\)\.eq\('key', CLAVE_PLAN_A_MANO\)/);
  assert.match(v, /if \(!p \|\| !tocaAvisarPlanAMano\(p, ahoraMs\)\) continue;/);
  assert.ok(v.indexOf('to: duenio') > 0 && v.indexOf('to: EMAIL_MAKO') > 0, 'a la persona y a Martín');
  assert.ok(v.indexOf('avisadoAt: new Date(ahoraMs).toISOString()') > v.indexOf('to: EMAIL_MAKO'), 'se marca después de avisar');
  // Si el de Martín no salió, NO se marca: se intenta en la próxima vuelta (marcar igual era perder el aviso para siempre).
  const sinMartin = v.indexOf('if (!aMartin.enviado) { errores++;');
  assert.ok(sinMartin > 0 && v.slice(sinMartin, v.indexOf('\n', sinMartin)).includes('continue; }'), 'sin el aviso a Martín, sigue de largo sin marcar');
  assert.ok(sinMartin < v.indexOf('avisadoAt: new Date(ahoraMs).toISOString()'));
  assert.doesNotMatch(s, /estado: 'pausado'|actualizarWorkspace|pausar/, 'un plan a mano vencido no pausa a nadie');
  assert.match(fuente('app/api/cron/aviso-fin-de-prueba/route.ts'), /await avisarPlanesAManoVencidos\(/, 'el cron diario de las pruebas lo corre');
});

test('en Customers se da junto con el plan; la plataforma nunca; 0 lo quita', () => {
  const r = sinComentarios(fuente('app/api/admin/workspaces/route.ts'));
  const caso = r.slice(r.indexOf("case 'plan_a_mano': {"));
  assert.ok(caso.length > 20, 'la acción existe');
  assert.match(caso, /if \(body\.id === \(await wsSuperAdmin\(\)\)\)/, 'la plataforma no');
  assert.match(caso, /const dias = Number\(body\.dias\);/);
  assert.match(caso, /await ponerPlanAMano\(body\.id, dias\)/);
  const m = sinComentarios(fuente('lib/plan-a-mano.ts'));
  assert.match(m.slice(m.indexOf('export async function ponerPlanAMano(')), /if \(dias === 0\)/, '0 = sin vencimiento');
  const ui = fuente('app/admin/AdminView.tsx');
  assert.match(ui, /postWs\(\{ action: 'plan_a_mano', id: w\.id, dias \}\)/);
  assert.match(ui, /DIAS_PLAN_A_MANO\.map\(/, 'los días se eligen de la lista, no se escriben');
});

// Probado rompiéndolo (28/10/2026), una rotura por vez sobre la base en verde (6 pases, 0 fallos), restaurando el archivo desde
// una copia (nunca git). Rota (pases / fallos):
//   · se lee un setting sin fecha de fin                                                → 5 / 1
//   · avisa aunque ya avisó                                                             → 5 / 1
//   · el aviso le dice a la persona que se pausa                                        → 5 / 1
//   · `estadoDePrueba` no mira el plan a mano (sin los topes de la prueba)              → 5 / 1
//   · el cron diario no avisa                                                           → 5 / 1
//   · Customers se lo da a la plataforma                                                → 5 / 1
//   · se marca «avisado» aunque el aviso a Martín no salió                              → 5 / 1
//   · el plan a mano vale también con una suscripción PAGADA (la encontró prueba-topes)  → 5 / 1
// Lo que NO corre acá: el envío de los mails y la lectura de la base (se miran en el fuente). El primer vencimiento real en
// producción hay que mirarlo en el log del cron (`[cron:aviso-fin-de-prueba] planes a mano: …`).
