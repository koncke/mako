// =============================================================================
// La revisión adversarial de b335f972c (Cerebro, 27/10/2026): un alto y dos medios de PLATA en Pagos
// =============================================================================
// Detalle (escenario, evidencia y veredicto de cada uno): C:/dev/revisiones/2710-crm-b335f972c.md. Lo aprendido, en
// docs/hallazgos-pagos.md («La revisión de b335f972c»).
//   1 (alto) · el plan libre (#13) volvía a pedir el inicial cobrado y dejaba las impagas protegidas al lado de las nuevas:
//     con el inicial y 3 de 6 cuotas cobradas, pasar a 8 dejaba US$5.000 de deuda en vez de US$2.500.
//   2 (medio) · `editarCuota` corregía una cuota COBRADA cuando quien llamaba creía que estaba impaga (MaKo confirmando
//     después del cobro, una pestaña vieja): el vencimiento nuevo se escribía como `fecha_pago`.
//   3 (medio) · editar sólo el monto con un recordatorio corriendo lo cortaba y el dedup lo dejaba afuera de la cobranza.
//   Y los bajos: la cobrada en otra moneda quedaba con la equivalencia vieja, y el Deshacer fallaba callado.
//
// El 1 se prueba con las funciones reales (`cuotasDelPlanLibre` + `reconciliarCuotas`, la misma cadena que
// `guardarCuotasAction`), con los casos A a D del refutador. Del 2 al 4, `editarCuota` lee y escribe la base: se corrió
// REAL contra una base en memoria (el arnés del refutador, adaptado, en el scratchpad del relevo de claude4) sobre
// b335f972c (los tres defectos aparecen) y con el arreglo (ninguno); acá se fija el código que lo hace.
//
// Probado rompiéndolo (27/10/2026), una rotura por vez, sobre los 10 tests de este archivo:
//   · `cuotasDelPlanLibre` sin restar las cobradas (`nuevas = cantidad`):   4 fallos (A, B, C/D y «la cantidad»)
//   · sin mirar el inicial cobrado (`conInicial = inicial > 0`):              2 fallos (A y B)
//   · las impagas sin id (`id: null` en todas):                               3 fallos (A, B y C/D)
//   · `editarCuota` sin la guarda de `espera`:                                1 fallo («editar una cobrada»)
//   · el olvido sin la cuota del recordatorio cortado:                        1 fallo («recordatorio cortado»)
//   · la cobrada sin limpiar la moneda:                                       1 fallo («otra moneda»)
//   · el Deshacer mandando `fecha` aunque no cambió:                          1 fallo («Deshacer»)
// =============================================================================

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { cuotasDelPlanLibre, fechasDelPlan, reconciliarCuotas, type CadaPlan, type CuotaExistente, type CuotaParaPlanLibre } from '../lib/pagos-campo';

const raiz = join(__dirname, '..');
const fuente = (r: string) => readFileSync(join(raiz, r), 'utf8').replace(/\r\n/g, '\n');
const bloque = (src: string, desde: string) => { const i = src.indexOf(desde); assert.ok(i >= 0, `no está ${desde}`); const j = src.indexOf('\n}\n', i); return src.slice(i, j + 2); };

// El lead del refutador: inicial de US$1.000 y las cuotas 1 a 3 de US$500 cobradas; las 4 a 6, impagas.
const LEAD: CuotaParaPlanLibre[] = [
  { id: 10, numero: 0, monto_usd: 1000, fecha_esperada: '2026-07-10', pagado: true },
  { id: 11, numero: 1, monto_usd: 500, fecha_esperada: '2026-08-10', pagado: true },
  { id: 12, numero: 2, monto_usd: 500, fecha_esperada: '2026-09-10', pagado: true },
  { id: 13, numero: 3, monto_usd: 500, fecha_esperada: '2026-10-10', pagado: true },
  { id: 14, numero: 4, monto_usd: 500, fecha_esperada: '2026-10-30', pagado: false },
  { id: 15, numero: 5, monto_usd: 500, fecha_esperada: '2026-11-30', pagado: false },
  { id: 16, numero: 6, monto_usd: 500, fecha_esperada: '2026-12-30', pagado: false },
];

/** Lo que guarda «Guardar el plan» en el libre: la lista de `cuotasDelPlanLibre`, reconciliada POR ID con `vistos`. */
function guardar(pagos: CuotaParaPlanLibre[], form: { inicial: number; cuota: number; cantidad: number; cada: CadaPlan; dias?: number[] }, protegidas: Record<number, Array<'link' | 'recordatorio'>> = {}) {
  const desde = '2026-10-27';
  const armado = cuotasDelPlanLibre({
    pagos, protegidas: new Set(Object.keys(protegidas).map(Number)), inicial: form.inicial, cuota: form.cuota, cantidad: form.cantidad, desde,
    fechas: (k) => fechasDelPlan({ desde, cantidad: k, cada: form.cada, dias: form.dias }),
  });
  if (!armado.ok) return { armado, deuda: null, plan: null };
  const existentes: CuotaExistente[] = pagos.map((q) => ({ id: q.id, numero: q.numero, monto_usd: Number(q.monto_usd), fecha_esperada: q.fecha_esperada, pagado: q.pagado, protegida: protegidas[q.id] ?? [] }));
  const plan = reconciliarCuotas(existentes, armado.cuotas.map((c) => ({ id: c.id, numero: c.numero, monto_usd: c.monto, fecha_esperada: c.fecha })), 'porId', { vistos: new Set(armado.vistos) });
  const borradas = new Set(plan.borrar.map((b) => b.id));
  const nuevoMonto = new Map(plan.actualizar.map((a) => [a.id, a.monto_usd]));
  const deuda = existentes.filter((q) => !q.pagado && !borradas.has(q.id)).reduce((s, q) => s + (nuevoMonto.get(q.id) ?? q.monto_usd), 0)
    + plan.insertar.reduce((s, q) => s + q.monto_usd, 0);
  return { armado, deuda, plan };
}

test('A: la deuda — de 6 a 8 cuotas con el inicial precargado: no se vuelve a pedir el inicial y las cobradas cuentan', () => {
  const { armado, deuda, plan } = guardar(LEAD, { inicial: 1000, cuota: 500, cantidad: 8, cada: 'mes', dias: [10] });
  assert.ok(armado.ok && plan);
  assert.equal(armado.inicialCobrado, true);
  assert.equal(armado.cobradas, 3);
  assert.equal(armado.nuevas, 5);
  assert.equal(deuda, 2500, 'la deuda impaga son las cuotas 4 a 8 (era 5000)');
  assert.ok(!plan.insertar.some((q) => q.monto_usd === 1000), 'el inicial cobrado volvió como una cuota que vence hoy');
  assert.equal(plan.insertar.length, 2, 'las 3 impagas toman su lugar por id: sólo entran 2');
  assert.equal(plan.borrar.length, 0);
});

test('B: cada quincena (10 y 25), cantidad 6 con 3 cobradas: se arman las 3 que faltan, en las impagas que había', () => {
  const { deuda, plan } = guardar(LEAD, { inicial: 1000, cuota: 500, cantidad: 6, cada: 'quincena', dias: [10, 25] });
  assert.ok(plan);
  assert.equal(deuda, 1500, 'era 4000');
  assert.equal(plan.insertar.length, 0);
  assert.deepEqual(plan.actualizar.map((a) => a.fecha_esperada).sort(), ['2026-11-10', '2026-11-25', '2026-12-10']);
});

test('C/D: protegida — una impaga con recordatorio o con link toma un lugar de la lista y no queda al lado de una nueva', () => {
  const c = guardar(LEAD, { inicial: 0, cuota: 500, cantidad: 6, cada: 'quincena', dias: [10, 25] }, { 14: ['recordatorio'] });
  assert.equal(c.deuda, 1500, 'con el recordatorio en la cuota 4 la deuda se contaba dos veces (era 2000)');
  assert.deepEqual(c.plan?.conservar.map((x) => [x.id, x.motivo]), [[14, 'recordatorio']], 'la protegida se conserva y la pantalla lo dice');
  const d = guardar(LEAD, { inicial: 0, cuota: 500, cantidad: 6, cada: 'quincena', dias: [10, 25] }, { 15: ['link'] });
  assert.equal(d.deuda, 1500, 'con el link en la cuota 5 (era 2000)');
  assert.equal(d.plan?.insertar.length, 0);
});

test('sin nada cobrado, el plan libre arma el inicial y todas; el inicial impago que existe vuelve a ser el inicial', () => {
  const nuevo = guardar([], { inicial: 300, cuota: 300, cantidad: 4, cada: 'quincena', dias: [1, 15] });
  assert.equal(nuevo.deuda, 1500);
  assert.deepEqual(nuevo.plan?.insertar.map((q) => q.numero), [0, 1, 2, 3, 4], 'el inicial nace como «Cobro inicial» (número 0)');
  const conInicial = guardar([{ id: 20, numero: 0, monto_usd: 200, fecha_esperada: '2026-10-27', pagado: false }], { inicial: 300, cuota: 300, cantidad: 2, cada: 'semana' });
  assert.deepEqual(conInicial.plan?.actualizar.map((a) => [a.id, a.monto_usd]), [[20, 300]], 'el inicial impago se actualiza por id, no se borra y reinserta');
  assert.equal(conInicial.deuda, 900);
});

test('una cantidad que no pasa las cobradas lo dice, en vez de armar de más', () => {
  const r = cuotasDelPlanLibre({ pagos: LEAD, protegidas: new Set(), inicial: 0, cuota: 500, cantidad: 3, desde: '2026-10-27', fechas: (k) => fechasDelPlan({ desde: '2026-10-27', cantidad: k, cada: 'mes', dias: [10] }) });
  assert.equal(r.ok, false);
  assert.match(r.ok ? '' : r.error, /Ya hay 3 cuotas cobradas y cuentan en la cantidad: pon más de 3\./);
});

test('la ficha arma el plan libre con `cuotasDelPlanLibre` y las protegidas que ya leyó, y dice lo ya cobrado', () => {
  const ui = fuente('app/crm/lead-view/ficha/pagos/bloques-cobro.tsx');
  assert.match(ui, /<ArmarPlan ctx=\{ctx\} protegidas=\{protegidas\} onListo=/);
  assert.match(ui, /const armado = libre \? cuotasDelPlanLibre\(\{/);
  assert.match(ui, /const \{ cuotas, vistos \} = armado;/, 'la lista y los vistos salen de la misma cuenta');
  assert.doesNotMatch(ui, /\.\.\.\(inicial > 0 \? \[\{ monto: inicial, fecha: plan\.desde \}\] : \[\]\)/, 'volvió la lista armada de cero');
  assert.match(ui, /Ya cobrado: /);
});

test('editar una cobrada es explícito: sin `espera: \'cobrada\'` tira, y la ficha manda el estado del renglón que dibujó', () => {
  const ed = bloque(fuente('lib/pagos.ts'), 'export async function editarCuota(');
  const iGuarda = ed.indexOf("if (q.pagado && espera !== 'cobrada') throw");
  const iRama = ed.indexOf('if (q.pagado) return editarCuotaCobrada(leadId, pagoId, q, cambio);');
  assert.ok(iGuarda > 0 && iRama > iGuarda, 'la rama cobrada se elige por lo que se leyó, sin preguntar qué vio quien llama');
  assert.match(ed, /const espera = cambio\.espera \?\? 'impaga';/, 'sin `espera`, una cuota cobrada se corrige');
  assert.match(ed, /if \(!q\.pagado && espera === 'cobrada'\) throw/);
  // MaKo (editar_cuota) edita impagas: nunca manda «cobrada».
  assert.doesNotMatch(fuente('lib/api-mako/areas/cobros.run.ts'), /espera: 'cobrada'/);
  const ui = fuente('app/crm/lead-view/ficha/pagos/bloques-cobro.tsx');
  assert.match(ui, /const espera = q\.pagado \? 'cobrada' as const : 'impaga' as const;\n\s+return editarCuotaAction\(lead\.id, q\.id, \{ \.\.\.cambio, espera \}\)/);
  const acc = fuente('app/crm/[id]/pagos-campo-actions.ts');
  assert.match(acc, /cambio\?\.espera !== undefined && cambio\.espera !== 'impaga' && cambio\.espera !== 'cobrada'\) return \{ ok: false/, 'una espera inventada pasa');
});

test('recordatorio cortado: vuelve a la cobranza aunque sólo cambie el monto, y la ficha lo dice', () => {
  const ed = bloque(fuente('lib/pagos.ts'), 'export async function editarCuota(');
  assert.match(ed, /recordatorioCortado = \(await cerrarCorridasDeCuota\(ws, pagoId\)\) > 0;/);
  assert.match(ed, /await olvidarAvisosDeCuotas\(recordatorioCortado && !reabrir\.includes\(pagoId\) \? \[\.\.\.reabrir, pagoId\] : reabrir\);/, 'el dedup lo deja afuera de la cobranza');
  assert.ok(ed.indexOf("from('pagos').update(") < ed.indexOf('await olvidarAvisosDeCuotas('), 'se olvida antes de escribir');
  assert.match(fuente('app/crm/lead-view/ficha/pagos/bloques-cobro.tsx'), /r\.recordatorioCortado \? 'Cuota cambiada · el recordatorio arranca de nuevo' : 'Cuota cambiada'/);
});

test('otra moneda: corregir el monto de una cobrada limpia la equivalencia vieja, y en la ficha no se edita como «$»', () => {
  const co = bloque(fuente('lib/pagos.ts'), 'async function editarCuotaCobrada(');
  assert.match(co, /if \(cambiaMonto && q\.moneda\) \{ upd\.moneda = null; upd\.monto_original = null; \}/);
  assert.match(fuente('app/crm/lead-view/ficha/pagos/bloques-cobro.tsx'), /const montoEditable = r\.editable \|\| \(cobradaAMano && !enOtraMoneda\);/);
});

test('Deshacer: manda sólo lo que cambió (una cobrada sin día del pago no se rompe) y dice si no se aplicó', () => {
  const ui = fuente('app/crm/lead-view/ficha/pagos/bloques-cobro.tsx');
  assert.match(ui, /\.\.\.\(r\.antes\.fecha !== r\.despues\.fecha \? \{ fecha: r\.antes\.fecha \} : \{\}\),/);
  assert.match(ui, /\.\.\.\(r\.antes\.monto !== r\.despues\.monto \? \{ monto: r\.antes\.monto \} : \{\}\),/);
  assert.match(ui, /if \(!d\.ok\) show\(`No se deshizo: \$\{d\.error\}`, undefined, 'bad'\);/, 'el Deshacer falla callado');
});
