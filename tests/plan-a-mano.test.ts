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
import { avisosPlanAManoVencido, CLAVE_PLAN_A_MANO, DIAS_PLAN_A_MANO, DIAS_REGALO, leerPlanAMano, llevaTopesDePrueba, planAManoNuevo, rotuloDeDias, tocaAvisarPlanAMano } from '../lib/plan-a-mano-reglas';
import { cambiosDelNegocio, opcionesDePlanAMano } from '../app/admin/_polar/datos/cliente';

const RAIZ = join(import.meta.dirname, '..');
const fuente = (rel: string) => readFileSync(join(RAIZ, rel), 'utf8').replace(/\r\n/g, '\n');
const sinComentarios = (src: string) => src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^[ \t]*\/\/.*$/gm, '');
const DIA = 86_400_000;
const AHORA = Date.parse('2026-10-28T12:00:00.000Z');

test('los 6 meses gratis NO son una prueba: su plan entero mientras duran, y al vencer avisan con su propio texto (30/10/2026)', () => {
  assert.equal(rotuloDeDias(DIAS_REGALO), '6 meses gratis');
  assert.equal(rotuloDeDias(7), '7 días');
  const r = planAManoNuevo(DIAS_REGALO, AHORA);
  assert.equal(r.regalo, true);
  assert.ok(Date.parse(r.hasta) >= Date.parse('2027-04-28T12:00:00.000Z'), 'nunca cortos de los seis meses');
  assert.deepEqual(leerPlanAMano(JSON.stringify(r)), r, 'el rótulo sobrevive a la ida y vuelta');
  assert.equal(planAManoNuevo(30, AHORA).regalo, undefined, 'las pruebas no lo llevan');
  assert.equal(llevaTopesDePrueba(r, AHORA), false, 'mientras dura, sin los topes de la prueba');
  assert.equal(llevaTopesDePrueba(r, Date.parse(r.hasta) + DIA), true, 'vencido sin resolver, como una prueba vencida');
  assert.equal(llevaTopesDePrueba(planAManoNuevo(30, AHORA), AHORA), true, 'una prueba lleva topes');
  assert.equal(tocaAvisarPlanAMano(r, AHORA), false);
  assert.equal(tocaAvisarPlanAMano(r, Date.parse(r.hasta)), true, 'avisa al vencer, como cualquiera');
  const a = avisosPlanAManoVencido({ negocio: 'Gabi', plan: 'MaKo Pro', hasta: r.hasta, linkPlan: 'L', linkCustomers: 'C', regalo: true });
  assert.match(a.persona.asunto, /6 meses gratis/);
  assert.doesNotMatch(a.persona.cuerpo, /prueba/i);
  assert.match(a.martin.cuerpo, /desde hoy sigue con los topes de la prueba/);
  const uso = sinComentarios(readFileSync(join(RAIZ, 'lib/prueba-uso.ts'), 'utf8').replace(/\r\n/g, '\n'));
  assert.ok(uso.indexOf('if (!llevaTopesDePrueba(p, Date.now())) return nada;') > 0, 'estadoDePrueba no lo da «en prueba» mientras dura');
  const mano = sinComentarios(readFileSync(join(RAIZ, 'lib/plan-a-mano.ts'), 'utf8').replace(/\r\n/g, '\n'));
  assert.match(mano, /avisosPlanAManoVencido\(\{ \.\.\.datos, regalo: p\.regalo \}\)/, 'el cron usa el texto de los 6 meses');
  assert.match(mano, /linkCustomers: linkApp\(`\/admin\/customers\/\$\{ws\}`, plataforma\)/, 'lleva a la ficha del negocio en Admin, donde se resuelve');
  // En Admin (la copia de Polar, 6/11/2026: «Editar» en la ficha del negocio) los 6 meses se ofrecen con su rótulo.
  assert.ok(opcionesDePlanAMano(false).some((o) => o.value === String(DIAS_REGALO) && o.label === rotuloDeDias(DIAS_REGALO)), 'los 6 meses, con su rótulo');
});

test('el vencimiento se arma con los días elegidos y se lee tolerante', () => {
  assert.equal(CLAVE_PLAN_A_MANO, 'plan.a_mano');
  assert.deepEqual([...DIAS_PLAN_A_MANO], [7, 14, 30, 183]);
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
  assert.match(v, /if \(!antes && !tocaAvisarPlanAMano\(p, ahoraMs\)\) continue;/);
  assert.ok(v.indexOf('to: duenio') > 0 && v.indexOf('to: EMAIL_MAKO') > 0, 'a la persona y a Martín');
  assert.ok(v.indexOf('{ ...p, avisadoAt: marca }') > v.indexOf('to: EMAIL_MAKO'), 'se marca después de avisar');
  // Si el de Martín no salió, NO se marca: se intenta en la próxima vuelta (marcar igual era perder el aviso para siempre).
  const sinMartin = v.indexOf('if (!aMartin.enviado) { errores++;');
  assert.ok(sinMartin > 0 && v.slice(sinMartin, v.indexOf('\n', sinMartin)).includes('continue; }'), 'sin el aviso a Martín, sigue de largo sin marcar');
  assert.ok(sinMartin < v.indexOf('{ ...p, avisadoAt: marca }'));
  assert.doesNotMatch(s, /estado: 'pausado'|actualizarWorkspace|pausar/, 'un plan a mano vencido no pausa a nadie');
  assert.match(fuente('app/api/cron/aviso-fin-de-prueba/route.ts'), /await avisarPlanesAManoVencidos\(/, 'el cron diario de las pruebas lo corre');
});

test('ya pagó con su email (`ya_tenia_cuenta`, sin atar): sin topes y sin «Terminó tu prueba» (la verificación del 29/10)', () => {
  const e = sinComentarios(fuente('lib/prueba-uso.ts'));
  const aMano = e.slice(e.indexOf('async function deUnPlanAMano('));
  const pago = aMano.indexOf('if (await pagoConElEmailDeSusAdmins(ws)) return nada;');
  assert.ok(pago > 0 && pago < aMano.indexOf('return { enPrueba: true'), 'antes de poner los topes, mira si ya pagó con su email');
  const f = e.slice(e.indexOf('async function pagoConElEmailDeSusAdmins('));
  assert.match(f, /\.from\('usuarios'\)\.select\('email, rol_ws'\)\.eq\('workspace_id', ws\)/);
  assert.match(f, /u\.rol_ws === 'admin' \|\| u\.rol_ws == null/, 'sólo los admins: un closer no paga el plan');
  assert.match(f, /\.eq\('workspace_id', await wsSuperAdmin\(\)\)\s*\.eq\('estado', 'pagado'\)\.eq\('alta_estado', 'ya_tenia_cuenta'\)\.is\('alta_ws', null\)/);
  // El email SÓLO quita topes: no ata el cobro ni toca el negocio (atarlo solo es lo que lib/plan-acceso.ts no hace, a propósito).
  assert.doesNotMatch(f, /update\(|alta_ws: ws|actualizar/);
  // Y el aviso al vencer se saltea a quien ya no está en prueba (pagó por la pasarela, o con su email).
  const s = sinComentarios(fuente('lib/plan-a-mano.ts'));
  const v = s.slice(s.indexOf('export async function avisarPlanesAManoVencidos('));
  const salta = v.indexOf('if (antes ? await pagaSuPlan(ws) : !(await estadoDePrueba(ws)).enPrueba) continue;');
  assert.ok(salta > 0 && salta < v.indexOf('to: duenio'), 'antes de mandar nada');
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
  // La pantalla: «Editar» en la ficha del negocio (la copia de Polar, 6/11/2026; antes, la grilla vieja de AdminView). Los días
  // se eligen de la lista (`opcionesDePlanAMano`) y el pedido va a la ruta de arriba.
  assert.deepEqual(opcionesDePlanAMano(true).filter((o) => o.value !== 'igual' && o.value !== '0').map((o) => Number(o.value)), [...DIAS_PLAN_A_MANO], 'los días se eligen de la lista, no se escriben');
  const n = { ws: 41, nombre: 'Estudio Norte', capa: 'completo' as const };
  for (const d of DIAS_PLAN_A_MANO) assert.deepEqual(cambiosDelNegocio(n, { nombre: n.nombre, capa: n.capa, planAMano: String(d) }), [{ action: 'plan_a_mano', id: 41, dias: d }]);
  assert.deepEqual(cambiosDelNegocio(n, { nombre: n.nombre, capa: n.capa, planAMano: '0' }), [{ action: 'plan_a_mano', id: 41, dias: 0 }], '0 lo quita');
  const modal = fuente('app/admin/_polar/web/Customer/EditCustomerModal.tsx');
  assert.match(modal, /const cambios = cambiosDelNegocio\(negocio, valores\)/);
  assert.match(modal, /await enOrden\(cambios, accionDelNegocio\)/);
  assert.match(fuente('app/admin/_polar/web/Customer/CustomerPage/acciones.ts'), /export const accionDelNegocio = \(a: AccionNegocio\) => post\('\/api\/admin\/workspaces', a\)/);
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
// Y el 29/10/2026 (la verificación de ddfa645d4), sobre 7 pases y 0 fallos:
//   · el plan a mano no mira el pago con su email (`ya_tenia_cuenta`)                    → 6 / 1
//   · el aviso al vencer le llega a quien ya paga                                       → 6 / 1
//   El comportamiento, medido con el guion del refutador (scratch-ddfa/plan-a-mano/p1-plan-a-mano.ts) sobre este árbol: sólo
//   cambian los casos C (pagó con su email) y B al vencer (ya paga por la pasarela).
// Lo que NO corre acá: el envío de los mails y la lectura de la base (se miran en el fuente). El primer vencimiento real en
// producción hay que mirarlo en el log del cron (`[cron:aviso-fin-de-prueba] planes a mano: …`).
//
// Los 6 meses gratis (30/10/2026; base 8 / 0), cada una restaurada (pasan / fallan):
//   · llevan los topes de la prueba (la regla)     -> 7 / 1
//   · `estadoDePrueba` no los mira                 -> 7 / 1
//   · el rótulo no se guarda                       -> 7 / 1
//   · el rótulo no se lee                          -> 7 / 1
//   · vencidos siguen sin topes                    -> 7 / 1
//   · el cron usa el texto de la prueba            -> 7 / 1
//   · la pantalla no los ofrece                    -> 7 / 1
//   · menos de seis meses (90 días)                -> 6 / 2
