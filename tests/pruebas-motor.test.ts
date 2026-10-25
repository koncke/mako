// =============================================================================
// El motor de las pruebas A/B, pieza por pieza: las cuentas, el reparto, el juez, el volumen y las métricas (25/10/2026)
// =============================================================================
// Tanda A1 del Cerebro (docs/diseno-pruebas-ab.md, con la crítica que manda). El test A/A del juez está aparte
// (tests/pruebas-juez-aa.test.ts); acá, lo que cada pieza tiene que cumplir sola:
//   · estadistica: las integrales sobre la grilla contra la fórmula cerrada de Evan Miller (≤ 1e-4);
//   · asignar: determinista, pegajoso, salado con el id de la prueba (dos pruebas a la vez no se correlacionan), los
//     pesos, la época, «desconocido», la rama cortada y «sin prueba corriendo, todo a A»;
//   · juez: antes del horizonte sólo corta por daño y con la mitad del plan; cortar la única variante NO es «no funciona»;
//     al tope no hay verdad; el ejemplo de la crítica (2/20 contra 8/20) no gana; el guardrail frena; «da lo mismo»
//     cruza el cero; Bonferroni;
//   · volumen: el n del plan y su inversa, y el plan en palabras;
//   · metricas: sólo cuentan las personas maduras, el éxito dentro de su ventana, lo que ya estaba al asignar no cuenta,
//     y una lectura incompleta NO es «0 éxitos».
// Correr: node --import tsx --test tests/pruebas-motor.test.ts
// ROTURAS (25/10/2026, una por vez y restaurada): ver el pie.
// =============================================================================
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { grilla, lnBeta, lnGamma, perdidaEsperada, phi, phiInv, probMejor, probMenorQue, cuantilLift } from '../lib/pruebas/estadistica';
import { asignar, problemasDeRamas, ramaParaServir, type RamaReparto } from '../lib/pruebas/asignar';
import { juzgar, umbralGana, type ConteoRama, type Regla } from '../lib/pruebas/juez';
import { efectoQueSeNota, nPorRama, planDePrueba } from '../lib/pruebas/volumen';
import { conteosPorRama, problemasDeMetrica, type Asignacion, type Resultado } from '../lib/pruebas/metricas';

// ── estadistica ──────────────────────────────────────────────────────────────────────────────────────────────────────
// Evan Miller: P(θB > θA) exacta con α_B entero.
const exacta = (aA: number, bA: number, aB: number, bB: number): number => {
  let s = 0;
  for (let i = 0; i < aB; i++) s += Math.exp(lnBeta(aA + i, bA + bB) - Math.log(bB + i) - lnBeta(1 + i, bB) - lnBeta(aA, bA));
  return s;
};

test('las cuentas: lnΓ, Φ y Φ⁻¹, y P(B > A) sobre la grilla contra la fórmula exacta (≤ 1e-4)', () => {
  assert.ok(Math.abs(lnGamma(5) - Math.log(24)) < 1e-12);
  assert.ok(Math.abs(lnGamma(0.5) - 0.5 * Math.log(Math.PI)) < 1e-12);
  assert.ok(Math.abs(phi(1.959964) - 0.975) < 1e-6);
  assert.ok(Math.abs(phiInv(0.975) - 1.959964) < 1e-5);
  assert.ok(Math.abs(phiInv(0.02) + 2.053749) < 1e-5);
  const casos: Array<[number, number, number, number]> = [[3, 19, 9, 13], [31, 285, 45, 271], [1, 1, 2, 1], [2, 400, 5, 397], [150, 1350, 170, 1330], [3, 3000, 9, 2994], [2, 3000, 1500, 1500]];
  for (const [aA, bA, aB, bB] of casos) {
    const g = grilla([{ alfa: aA, beta: bA }, { alfa: aB, beta: bB }]);
    const p = probMenorQue(g, 0, 1);
    assert.ok(Math.abs(p - exacta(aA, bA, aB, bB)) < 1e-4, `Beta(${aA},${bA}) vs Beta(${aB},${bB}): ${p} contra ${exacta(aA, bA, aB, bB)}`);
    const pm = probMejor(g);
    assert.ok(Math.abs(pm[0] + pm[1] - 1) < 1e-4 && Math.abs(pm[1] - p) < 1e-4);
  }
  // Dos angostas cerca y una lejos: la grilla se agranda (16 puntos por desvío) y la comparación de las cercanas sigue exacta.
  const lejos = grilla([{ alfa: 30000, beta: 70000 }, { alfa: 30300, beta: 69700 }, { alfa: 9000, beta: 1000 }]);
  assert.ok(Math.abs(probMenorQue(lejos, 0, 1) - exacta(30000, 70000, 30300, 69700)) < 1e-4, 'la grilla no se agrandó');
  // Tres iguales: un tercio cada una.
  const tres = probMejor(grilla([{ alfa: 20, beta: 180 }, { alfa: 20, beta: 180 }, { alfa: 20, beta: 180 }]));
  for (const x of tres) assert.ok(Math.abs(x - 1 / 3) < 1e-3, String(tres));
});

test('las cuentas: la pérdida esperada y el intervalo del lift, contra la normal (n grande)', () => {
  const A = { alfa: 3000, beta: 7000 };
  const B = { alfa: 3100, beta: 6900 };
  const g = grilla([A, B]);
  const m = (p: typeof A) => p.alfa / (p.alfa + p.beta);
  const v = (p: typeof A) => (p.alfa * p.beta) / ((p.alfa + p.beta) ** 2 * (p.alfa + p.beta + 1));
  // E[max(θA − θB, 0)] con D ~ N(μ, σ²): σφ(μ/σ) + μΦ(μ/σ).
  const mu = m(A) - m(B);
  const sd = Math.sqrt(v(A) + v(B));
  const dens = Math.exp(-0.5 * (mu / sd) ** 2) / Math.sqrt(2 * Math.PI);
  const esperada = sd * dens + mu * phi(mu / sd);
  assert.ok(Math.abs(perdidaEsperada(g, 1, 0) - esperada) < 2e-5, `${perdidaEsperada(g, 1, 0)} contra ${esperada}`);
  // El lift de B sobre A ≈ 0,31/0,30 − 1 = 3,3 %, con el delta: sd ≈ (0,31/0,30)·√(vA/mA² + vB/mB²).
  const centro = m(B) / m(A) - 1;
  const sdLift = (m(B) / m(A)) * Math.sqrt(v(A) / m(A) ** 2 + v(B) / m(B) ** 2);
  assert.ok(Math.abs(cuantilLift(g, 1, 0, 0.05) - (centro - 1.6449 * sdLift)) < 2e-3);
  assert.ok(Math.abs(cuantilLift(g, 1, 0, 0.95) - (centro + 1.6449 * sdLift)) < 2e-3);
});

// ── asignar ──────────────────────────────────────────────────────────────────────────────────────────────────────────
const AB: RamaReparto[] = [{ clave: 'A', peso: 50, control: true }, { clave: 'B', peso: 50 }];

test('asignar: determinista, 50/50 y 70/30 con lead_id seguidos, y salado: dos pruebas a la vez no se correlacionan', () => {
  assert.equal(asignar(7, 1, '123', AB), asignar(7, 1, '123', AB));
  const cuenta = (ramas: RamaReparto[], prueba = 7) => {
    const c: Record<string, number> = {};
    for (let i = 1; i <= 20_000; i++) { const r = asignar(prueba, 1, String(i), ramas)!; c[r] = (c[r] ?? 0) + 1; }
    return c;
  };
  const c = cuenta(AB);
  assert.ok(Math.abs(c.A / 20_000 - 0.5) < 0.02, JSON.stringify(c));
  const c73 = cuenta([{ clave: 'A', peso: 70, control: true }, { clave: 'B', peso: 30 }]);
  assert.ok(Math.abs(c73.B / 20_000 - 0.3) < 0.02, JSON.stringify(c73));
  // Dos pruebas a la vez sobre la misma gente: cada combinación ~25 %.
  const cruz: Record<string, number> = {};
  for (let i = 1; i <= 20_000; i++) { const k = `${asignar(7, 1, String(i), AB)}${asignar(8, 1, String(i), AB)}`; cruz[k] = (cruz[k] ?? 0) + 1; }
  for (const k of ['AA', 'AB', 'BA', 'BB']) assert.ok(Math.abs((cruz[k] ?? 0) / 20_000 - 0.25) < 0.02, `${k}: ${JSON.stringify(cruz)}`);
  // La época vuelve a sortear (a los que entran después).
  let cambian = 0;
  for (let i = 1; i <= 2000; i++) if (asignar(7, 1, String(i), AB) !== asignar(7, 2, String(i), AB)) cambian++;
  assert.ok(cambian > 800 && cambian < 1200, `cambian ${cambian}`);
  // «desconocido» y vacío no se asignan; una rama cortada no recibe a nadie.
  assert.equal(asignar(7, 1, 'desconocido', AB), null);
  assert.equal(asignar(7, 1, ' ', AB), null);
  for (let i = 1; i <= 200; i++) assert.equal(asignar(7, 1, String(i), [AB[0], { ...AB[1], activa: false }]), 'A');
});

test('servir: pegajoso, «sirviendo» manda, la rama cortada vuelve al control, y sin prueba corriendo todo a A sin escribir', () => {
  const p = { id: 7, estado: 'corriendo', epoca: 1, ramas: AB };
  const nueva = ramaParaServir(p, '123');
  assert.equal(nueva.escribir, true);
  assert.equal(nueva.clave, asignar(7, 1, '123', AB));
  // Ya tiene rama: ésa, siempre, aunque la huella diga otra; sin escribir.
  const otra = nueva.clave === 'A' ? 'B' : 'A';
  assert.deepEqual(ramaParaServir(p, '123', otra), { clave: otra, escribir: false });
  assert.deepEqual(ramaParaServir({ ...p, ramas: [AB[0], { ...AB[1], activa: false }] }, '123', 'B'), { clave: 'A', escribir: false });
  assert.deepEqual(ramaParaServir({ ...p, sirviendo: 'B' }, '123'), { clave: 'B', escribir: false });
  for (const estado of ['propuesta', 'detenida', 'concluida']) assert.deepEqual(ramaParaServir({ ...p, estado }, '123'), { clave: 'A', escribir: false });
  assert.deepEqual(ramaParaServir(null, '123'), { clave: 'A', escribir: false });
  assert.deepEqual(ramaParaServir(p, 'desconocido'), { clave: 'A', escribir: false });
});

test('las ramas de una prueba: de 2 a 4, un control, 10 % o más cada una, suman 100', () => {
  assert.deepEqual(problemasDeRamas(AB), []);
  assert.match(problemasDeRamas([AB[0]]).join(' '), /de 2 a 4 ramas/);
  assert.match(problemasDeRamas([{ ...AB[0], peso: 95 }, { ...AB[1], peso: 5 }]).join(' '), /10 % o más/);
  assert.match(problemasDeRamas([{ ...AB[0], peso: 60 }, AB[1]]).join(' '), /suman 110/);
  assert.match(problemasDeRamas([{ ...AB[0], control: false }, AB[1]]).join(' '), /UN control/);
});

// ── juez ─────────────────────────────────────────────────────────────────────────────────────────────────────────────
const REGLA: Regla = { nPorRama: 300, minDias: 7, maxDias: 60, mdeRel: 0.8 };
const ramas = (a: [number, number], b: [number, number], activaB = true): ConteoRama[] => [
  { clave: 'A', control: true, n: a[0], x: a[1] }, { clave: 'B', n: b[0], x: b[1], activa: activaB },
];

test('juez antes del horizonte: sigue aunque B vaya muy adelante; corta por daño sólo con la mitad del plan, y eso NO es «no funciona»', () => {
  const adelante = juzgar({ dia: 20, ramas: ramas([200, 20], [200, 60]) }, REGLA);
  assert.equal(adelante.accion, 'seguir', 'decidió antes del horizonte: eso es mirar todos los días');
  // Daño claro, pero con menos de la mitad del plan: sigue.
  assert.equal(juzgar({ dia: 10, ramas: ramas([140, 30], [140, 2]) }, REGLA).accion, 'seguir');
  // Con la mitad (150): se corta la única variante, y el veredicto es no_concluyente, sin verdad.
  const j = juzgar({ dia: 15, ramas: ramas([150, 32], [150, 3]) }, REGLA);
  assert.ok(j.accion === 'concluir' && j.veredicto === 'no_concluyente' && !j.esVerdad && j.sirviendo === 'A', JSON.stringify(j.accion === 'concluir' ? j.veredicto : j.accion));
  // Con 3 ramas, se corta esa y la prueba sigue.
  const tres = juzgar({ dia: 15, ramas: [...ramas([150, 32], [150, 3]), { clave: 'C', n: 150, x: 30 }] }, REGLA);
  assert.ok(tres.accion === 'cortar' && tres.cortar.join() === 'B');
});

test('juez en el horizonte: gana B, gana el control con daño, «da lo mismo» cruza el cero, y el ejemplo de la crítica no gana', () => {
  const gana = juzgar({ dia: 30, ramas: ramas([300, 30], [300, 60]) }, REGLA);
  assert.ok(gana.accion === 'concluir' && gana.veredicto === 'gana_variante' && gana.esVerdad && gana.sirviendo === 'B');
  assert.match(gana.porque, /^B ganó: 20 % contra 10 % \(300 y 300 personas\), con el lift entre/);
  const pierde = juzgar({ dia: 30, ramas: ramas([300, 40], [300, 15]) }, REGLA);
  assert.ok(pierde.accion === 'concluir' && pierde.veredicto === 'gana_control' && pierde.esVerdad);
  const igual = juzgar({ dia: 30, ramas: ramas([300, 30], [300, 31]) }, REGLA);
  assert.ok(igual.accion === 'concluir' && igual.veredicto === 'da_lo_mismo' && !igual.esVerdad, igual.accion === 'concluir' ? igual.veredicto : '');
  assert.match(igual.porque, /No se vio una diferencia mayor a 80 %/);
  // B peor sin llegar al umbral: el intervalo no cruza el cero → no es un empate.
  const peorSinUmbral = juzgar({ dia: 30, ramas: ramas([300, 30], [300, 18]) }, REGLA);
  assert.ok(peorSinUmbral.accion === 'concluir' && peorSinUmbral.veredicto === 'no_concluyente', peorSinUmbral.accion === 'concluir' ? peorSinUmbral.veredicto : '');
  // La crítica (A.3): 2/20 contra 8/20 da P alta, pero la pérdida pasa el 1 %: no gana.
  const critica = juzgar({ dia: 10, ramas: ramas([20, 2], [20, 8]) }, { ...REGLA, nPorRama: 20 });
  assert.ok(critica.accion === 'concluir' && critica.veredicto !== 'gana_variante', critica.accion === 'concluir' ? critica.veredicto : '');
  // Sin control no hay juicio.
  assert.throws(() => juzgar({ dia: 1, ramas: [{ clave: 'A', n: 1, x: 0 }] }, REGLA), /no tiene control/);
});

test('juez: al tope no hay verdad (se sirve la que va adelante con 80 %, sin afirmarlo), el guardrail frena y Bonferroni', () => {
  const tope = juzgar({ dia: 60, ramas: ramas([100, 10], [100, 22]) }, REGLA);
  assert.ok(tope.accion === 'concluir' && tope.veredicto === 'no_concluyente' && !tope.esVerdad && tope.ganadora === null);
  assert.equal(tope.accion === 'concluir' && tope.sirviendo, 'B', 'al tope se sirve la que va adelante con 80 %');
  assert.match(tope.porque, /Llegó al tope de 60 días sin el volumen del plan: todavía no se sabe\. Queda B, que iba adelante, sin afirmarlo\./);
  // Al tope, 85 % de ser la mejor con poca gente (1/10 contra 4/10) no alcanza: lo que se pierde pasa el 1 % de A.
  const chico = juzgar({ dia: 60, ramas: ramas([10, 1], [10, 4]) }, REGLA);
  assert.ok(chico.accion === 'concluir' && chico.sirviendo === 'A' && chico.ramas[1].pMejor > 0.8, chico.accion === 'concluir' ? chico.sirviendo : '');
  // El guardrail: B sube la métrica cercana pero baja las agendas: no gana.
  const g = { metrica: 'agendo', toleranciaRel: 0.1, ramas: ramas([300, 30], [300, 10]) };
  const frenada = juzgar({ dia: 30, ramas: ramas([300, 30], [300, 60]), guardrails: [g] }, REGLA);
  assert.ok(frenada.accion === 'concluir' && frenada.veredicto !== 'gana_variante', frenada.accion === 'concluir' ? frenada.veredicto : '');
  // Con menos de 5 eventos el guardrail no tiene dato y no frena.
  const sinDato = juzgar({ dia: 30, ramas: ramas([300, 30], [300, 60]), guardrails: [{ ...g, ramas: ramas([300, 2], [300, 1]) }] }, REGLA);
  assert.ok(sinDato.accion === 'concluir' && sinDato.veredicto === 'gana_variante');
  assert.equal(umbralGana(2), 0.98);
  assert.ok(Math.abs(umbralGana(3) - 0.99) < 1e-12 && Math.abs(umbralGana(4) - (1 - 0.02 / 3)) < 1e-12);
});

// ── volumen ──────────────────────────────────────────────────────────────────────────────────────────────────────────
test('volumen: el n del plan, su inversa, más ramas piden más gente, y el plan en palabras', () => {
  assert.equal(nPorRama({ base: 0.1, mdeRel: 0.8 }), 315);
  assert.ok(nPorRama({ base: 0.1, mdeRel: 0.8, ramas: 3 }) > 315);
  assert.ok(nPorRama({ base: 0.1, mdeRel: 0.2 }) > 4000);
  assert.equal(nPorRama({ base: 0.5, mdeRel: 1.5 }), 20, 'nunca menos de 20');
  const mde = efectoQueSeNota({ base: 0.1, n: 315 });
  assert.ok(Math.abs(mde - 0.8) < 0.01, String(mde));
  assert.throws(() => nPorRama({ base: 0, mdeRel: 0.5 }), /entre 0 y 1/);
  const llega = planDePrueba({ base: 0.1, mdeRel: 0.8, ramas: 2, ritmoPorDia: 25, ventanaDias: 7, minDias: 7, maxDias: 60 });
  assert.ok(llega.llega && llega.dias === Math.ceil(315 / 12.5) + 7, String(llega.dias));
  assert.equal(llega.texto, `Con tu ritmo (≈25 por día) esta prueba distingue un salto de 10 % a 18 % en ~${llega.dias} días.`);
  const no = planDePrueba({ base: 0.1, mdeRel: 0.2, ramas: 2, ritmoPorDia: 25, ventanaDias: 7, minDias: 7, maxDias: 60 });
  assert.ok(!no.llega && no.mdeQueLlega != null && no.mdeQueLlega > 0.2);
  assert.match(no.texto, /^No llega en 60 días \(necesita \d+ por rama para ver un salto de 10 % a 12 %\)\. En 60 días sólo se nota un salto de 10 % a \d+(\.\d)? %: prueba un cambio más grande\.$/);
});

// ── metricas ─────────────────────────────────────────────────────────────────────────────────────────────────────────
const RAMAS_M = [{ clave: 'A', control: true }, { clave: 'B' }];
const HASTA = '2026-11-20T03:00:00.000Z';
const dia = (d: number) => new Date(Date.parse(HASTA) - d * 86_400_000).toISOString();

test('métricas: sólo las maduras, el éxito dentro de su ventana, lo que ya estaba no cuenta, y lo incompleto no es 0', () => {
  const asig: Asignacion[] = [
    { unidad: '1', rama: 'A', asignadaAt: dia(10) },              // madura, logró
    { unidad: '2', rama: 'A', asignadaAt: dia(10) },              // madura, logró FUERA de la ventana
    { unidad: '3', rama: 'B', asignadaAt: dia(9), previo: true }, // madura, ya había agendado
    { unidad: '4', rama: 'B', asignadaAt: dia(8) },               // madura, no logró
    { unidad: '5', rama: 'B', asignadaAt: dia(3) },               // NO madura (ventana de 7): no cuenta
    { unidad: '6', rama: 'B', asignadaAt: dia(9) },               // madura, logró 30 s ANTES de la asignación (tolerancia)
    { unidad: 'desconocido', rama: 'A', asignadaAt: dia(10) },
  ];
  const res = new Map<string, Resultado>([
    ['1', { logro: true, at: dia(8) }], ['2', { logro: true, at: dia(1) }], ['3', { logro: true, at: dia(8) }],
    ['4', { logro: false }], ['5', { logro: true, at: dia(2) }], ['6', { logro: true, at: new Date(Date.parse(dia(9)) - 30_000).toISOString() }],
  ]);
  const c = conteosPorRama(asig, res, { ramas: RAMAS_M, ventanaDias: 7, hasta: HASTA });
  assert.ok(c.ok, c.ok ? '' : c.error);
  assert.deepEqual(c.ok && c.ramas.map((r) => [r.clave, r.n, r.x]), [['A', 2, 1], ['B', 3, 1]]);
  assert.deepEqual(c.ok && c.asignados, { A: 2, B: 4 });
  // El medidor no devolvió a una madura: la lectura falla, no cuenta como 0.
  const sin4 = new Map(res);
  sin4.delete('4');
  const mal = conteosPorRama(asig, sin4, { ramas: RAMAS_M, ventanaDias: 7, hasta: HASTA });
  assert.ok(!mal.ok && /no devolvió a 1 persona/.test(mal.error));
  // A la no madura no hace falta medirla.
  const sin5 = new Map(res);
  sin5.delete('5');
  assert.ok(conteosPorRama(asig, sin5, { ramas: RAMAS_M, ventanaDias: 7, hasta: HASTA }).ok);
});

test('métricas: el catálogo y lo que cada una pide al crear la prueba', () => {
  assert.deepEqual(problemasDeMetrica('respondio', 'automatizacion'), []);
  assert.match(problemasDeMetrica('clic_conversion', 'landing').join(' '), /necesita la lista de destinos/);
  assert.deepEqual(problemasDeMetrica('clic_conversion', 'landing', { destinos: ['/api/landing-generator/pagar'] }), []);
  assert.match(problemasDeMetrica('pago', 'automatizacion').join(' '), /va como guardrail/);
  assert.deepEqual(problemasDeMetrica('pago', 'automatizacion', {}, true), []);
  assert.match(problemasDeMetrica('optin', 'automatizacion').join(' '), /no se mide en automatizacion/);
  assert.match(problemasDeMetrica('leyo', 'automatizacion').join(' '), /no es una métrica/, '«leyó» por WhatsApp no entra');
});

// ROTURAS (25/10/2026, harness del scratchpad `roturas-a1.cjs`, una por vez y restaurada; base 11 / 0), cada una 10 / 1:
//   asignar sin la sal · no pegajoso · sortea sin prueba corriendo · corta sin la mitad del plan · el corte es «no funciona»
//   (gana_control) · el tope es verdad · al tope sin la pérdida · el guardrail no frena · «da lo mismo» sin cruzar el cero ·
//   cuenta las no maduras · lo que ya estaba al asignar cuenta · lo incompleto es 0 · un éxito fuera de la ventana cuenta ·
//   sin la tolerancia de 1 minuto · la grilla gruesa (2 puntos por desvío) · el volumen con otro umbral que el juez.
//   Sin Bonferroni → 9 / 2.
// ⚠️ QUEDA VERDE, A PROPÓSITO: sacar la pérdida esperada de «gana». Con 98 % no ata nunca: el caso más extremo (0/6 contra
// 6/6) pierde 0,00115 con un techo de 0,0033 (medido). Se queda como guarda por si el umbral baja; donde sí decide es al
// tope (arriba, 1/10 contra 4/10).
