// =============================================================================
// curso-modulos — los MÓDULOS del curso: cuáles son, en qué orden y cómo se reordenan (D1, 08/10/2026)
// =============================================================================
// Pedido de Martín (07/10/2026, items 6, 7, 11 y 12): «llamalo "Módulos"… que se editen en las etapas
// del kanban… arrastrarla para cambiar la posición… Y eso también debería cambiar las etapas… un
// editor para los módulos, para poder "desvincularlo" del kanban». Lo que se EJECUTA acá es
// lib/curso-modulos.ts entero (puro): la lista derivada, las anclas de los sueltos, el plan de un
// reorden con sus fases, la etapa nueva y los nombres. Y `normalizarEtapas` con `enCurso`.
//
// Las reglas que más cuestan si se rompen:
//   · LA PRIMERA ETAPA DEL KANBAN NO SE MUEVE (ni reordenando ni metiendo una nueva antes): los
//     clientes sin fila están en la primera, y moverla los pasaría a otra columna EN SILENCIO.
//   · UNA ETAPA QUE NO ES MÓDULO NO SE MUEVE al reordenar módulos.
//   · LA LISTA SE DERIVA: un suelto sigue a su ancla, en cadena, y un ancla perdida no lo pierde.
//
// PROBADO ROMPIÉNDOLO: la tabla con los números está al final del archivo.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  derivarModulos, nuevaClaveSuelto, nombreDeModulo, anclasDe, planReorden, planConEtapaNueva, etapaNuevaEn,
  etapaDeModulo, clavesDeModulos, CLAVE_MODULO_RE, ERROR_PRIMERA, type FilaModulo, type ModuloCurso,
} from '../lib/curso-modulos';
import { normalizarEtapas, TOPE_NOMBRE_ETAPA, type EtapaEntrega, type FaseEntrega } from '../lib/servicio-etapas';

// ── Fixtures ─────────────────────────────────────────────────────────────────

const et = (key: string, o: Partial<EtapaEntrega> = {}): EtapaEntrega => ({ key, label: key.toUpperCase(), tone: 'neutral', dot: '#000000', ...o });
const fase = (key: string): FaseEntrega => ({ key, label: key, tone: 'neutral', dot: '#111111' });
const suelto = (clave: string, despuesDe: string | null, id: number, o: Partial<FilaModulo> = {}): FilaModulo => ({
  clave, vinculado: false, nombre: clave.toUpperCase(), despuesDe, bloqueo: null, id, ...o,
});
const claves = (ms: readonly ModuloCurso[]) => ms.map((m) => m.clave);
const keys = (es: readonly EtapaEntrega[]) => es.map((e) => e.key);
/** Los módulos de un kanban sin sueltos (cada etapa con `enCurso !== false`). */
const soloEtapas = (etapas: EtapaEntrega[]) => derivarModulos(etapas, []);

// ── La lista: derivada, nunca guardada ───────────────────────────────────────

test('derivarModulos: las etapas del curso en el orden del kanban, y los sueltos detrás de su ancla EN CADENA', () => {
  const etapas = [et('onb', { enCurso: false }), et('arr', { fase: 'f1' }), et('rit')];
  const filas: FilaModulo[] = [
    suelto('m_inicio', null, 1),
    suelto('m_tras_arr', 'arr', 2),
    suelto('m_cadena', 'm_tras_arr', 3),
    suelto('m_tras_onb', 'onb', 4), // ancla: una etapa que NO es módulo → donde estaría (acá, al principio)
    suelto('m_perdido', 'borrada', 5), // ancla que ya no existe → al final
    { clave: 'arr', vinculado: true, nombre: null, despuesDe: null, bloqueo: { tipo: 'anterior' } },
    { clave: 'onb', vinculado: true, nombre: null, despuesDe: null, bloqueo: { tipo: 'manual' } }, // su etapa no es módulo
    suelto('rit', null, 6), // la clave de una etapa: gana la etapa, no se dibuja dos veces
  ];
  const m = derivarModulos(etapas, filas);
  assert.deepEqual(claves(m), ['m_inicio', 'm_tras_onb', 'arr', 'm_tras_arr', 'm_cadena', 'rit', 'm_perdido']);
  assert.deepEqual(m.map((x) => x.n), [1, 2, 3, 4, 5, 6, 7]);
  const arr = m.find((x) => x.clave === 'arr')!;
  assert.deepEqual([arr.vinculado, arr.nombre, arr.bloqueo, arr.etapa], [true, 'ARR', { tipo: 'anterior' }, { key: 'arr', label: 'ARR', fase: 'f1' }]);
  assert.equal(m.find((x) => x.clave === 'rit')!.vinculado, true);
  assert.ok(!claves(m).includes('onb'), 'una fila vinculada cuya etapa no es módulo NO crea un módulo');
});

test('derivarModulos: anclado a una etapa sacada del curso, sigue en su lugar (después del módulo de antes)', () => {
  const etapas = [et('a'), et('x', { enCurso: false }), et('b')];
  assert.deepEqual(claves(derivarModulos(etapas, [suelto('m_s', 'x', 1)])), ['a', 'm_s', 'b']);
});

test('derivarModulos: dos con la misma ancla van por antigüedad; un ciclo no pierde módulos; lo mal formado no entra', () => {
  const etapas = [et('a')];
  assert.deepEqual(claves(derivarModulos(etapas, [suelto('m_nuevo', 'a', 9), suelto('m_viejo', 'a', 2)])), ['a', 'm_viejo', 'm_nuevo']);
  // A después de B y B después de A: nada lo escribe, un jsonb editado a mano sí. Van al final, los dos.
  assert.deepEqual(claves(derivarModulos(etapas, [suelto('m_b', 'm_a', 2), suelto('m_a', 'm_b', 1)])), ['a', 'm_a', 'm_b']);
  const raros = derivarModulos(etapas, [suelto('M-1', null, 1), suelto('m_dup', null, 2), suelto('m_dup', 'a', 3), suelto('m_sin', null, 4, { nombre: '  ' })]);
  assert.deepEqual(claves(raros), ['m_dup', 'm_sin', 'a'], 'una clave inválida no entra; una repetida, una vez');
  assert.equal(raros.find((x) => x.clave === 'm_sin')!.nombre, 'Módulo');
  // Un candado roto en la fila vuelve null (el default), no «abierto».
  assert.equal(derivarModulos(etapas, [suelto('m_c', null, 1, { bloqueo: { tipo: 'dias', dias: -3 } })])[0].bloqueo, null);
});

test('normalizarEtapas: «no es módulo del curso» sobrevive al saneo (y sólo se guarda el false)', () => {
  const n = normalizarEtapas([{ key: 'a', label: 'A', enCurso: false }, { key: 'b', label: 'B', enCurso: true }, { key: 'c', label: 'C' }])!;
  assert.equal(n[0].enCurso, false);
  assert.ok(!('enCurso' in n[1]), 'true es el default: no se guarda');
  assert.ok(!('enCurso' in n[2]));
  assert.deepEqual(claves(soloEtapas(n)), ['b', 'c']);
});

// ── Las claves y los nombres ─────────────────────────────────────────────────

test('nuevaClaveSuelto: m_ + 8 al azar, nunca una existente, y con un azar roto sale por un contador', () => {
  const k = nuevaClaveSuelto([]);
  assert.match(k, /^m_[0-9a-z]{8}$/);
  assert.ok(CLAVE_MODULO_RE.test(k));
  assert.equal(nuevaClaveSuelto([], () => 0), 'm_00000000');
  let n = 0;
  const azar = () => (n++ === 0 ? 0 : 0.5);
  assert.notEqual(nuevaClaveSuelto(['m_00000000'], azar), 'm_00000000', 'un choque se reintenta');
  assert.equal(nuevaClaveSuelto(['m_00000000'], () => 0), 'm_2', 'cincuenta choques: el contador');
});

test('nombreDeModulo: espacios colapsados y el tope del kanban PARA TODOS (un suelto se puede vincular)', () => {
  assert.deepEqual(nombreDeModulo('  Mi    módulo  '), { ok: true, nombre: 'Mi módulo' });
  assert.deepEqual(nombreDeModulo('   '), { ok: false, error: 'Falta el nombre.' });
  assert.deepEqual(nombreDeModulo(42), { ok: false, error: 'Falta el nombre.' });
  assert.equal(nombreDeModulo('x'.repeat(TOPE_NOMBRE_ETAPA)).ok, true);
  assert.deepEqual(nombreDeModulo('x'.repeat(TOPE_NOMBRE_ETAPA + 1)), { ok: false, error: `El nombre pasa de ${TOPE_NOMBRE_ETAPA} letras.` });
});

test('anclasDe: cada suelto, detrás del que lo precede en la secuencia (null = el primero)', () => {
  const esS = (k: string) => k.startsWith('m_');
  assert.deepEqual(anclasDe(['m_a', 'e1', 'm_b', 'm_c', 'e2'], esS), [
    { clave: 'm_a', despuesDe: null }, { clave: 'm_b', despuesDe: 'e1' }, { clave: 'm_c', despuesDe: 'm_b' },
  ]);
  assert.deepEqual(clavesDeModulos([{ clave: 'x' }, { clave: 'y' }]), ['x', 'y']);
});

// ── El plan de un reorden ────────────────────────────────────────────────────

test('planReorden: los vinculados reordenan el kanban; los sueltos sólo cambian su ancla', () => {
  const etapas = [et('e1'), et('e2'), et('e3')];
  const modulos = derivarModulos(etapas, [suelto('m_s', 'e1', 1)]);
  assert.deepEqual(claves(modulos), ['e1', 'm_s', 'e2', 'e3']);
  const p = planReorden({ etapas, fases: [] }, modulos, ['e1', 'e3', 'm_s', 'e2']);
  assert.ok(p.ok);
  if (!p.ok) return;
  assert.deepEqual(keys(p.etapas), ['e1', 'e3', 'e2']);
  assert.equal(p.cambiaEntrega, true);
  assert.deepEqual(p.anclas, [{ clave: 'm_s', despuesDe: 'e3' }]);
  // Mover SÓLO el suelto no escribe el kanban.
  const q = planReorden({ etapas, fases: [] }, modulos, ['e1', 'e2', 'e3', 'm_s']);
  assert.ok(q.ok && !q.cambiaEntrega);
  assert.deepEqual(q.ok && q.anclas, [{ clave: 'm_s', despuesDe: 'e3' }]);
  // Un suelto sí puede ir antes de todo: no es una etapa y no mueve a nadie.
  const r = planReorden({ etapas, fases: [] }, modulos, ['m_s', 'e1', 'e2', 'e3']);
  assert.ok(r.ok);
  assert.deepEqual(r.ok && r.anclas, [{ clave: 'm_s', despuesDe: null }]);
});

test('⚠️ planReorden: la PRIMERA etapa del kanban no se mueve (los clientes sin fila están ahí)', () => {
  const etapas = [et('e1'), et('e2'), et('e3')];
  assert.deepEqual(planReorden({ etapas, fases: [] }, soloEtapas(etapas), ['e2', 'e1', 'e3']), { ok: false, error: ERROR_PRIMERA });
  // Si la primera del kanban NO es módulo (una «Onboarding» sin clases), los módulos se mueven libres.
  const conOnb = [et('onb', { enCurso: false }), et('e1'), et('e2')];
  const p = planReorden({ etapas: conOnb, fases: [] }, soloEtapas(conOnb), ['e2', 'e1']);
  assert.ok(p.ok);
  assert.deepEqual(p.ok && keys(p.etapas), ['onb', 'e2', 'e1']);
});

test('planReorden: una etapa que NO es módulo se queda en su lugar del kanban', () => {
  const etapas = [et('e1'), et('x', { enCurso: false }), et('e2'), et('e3')];
  const p = planReorden({ etapas, fases: [] }, soloEtapas(etapas), ['e1', 'e3', 'e2']);
  assert.ok(p.ok);
  assert.deepEqual(p.ok && keys(p.etapas), ['e1', 'x', 'e3', 'e2']);
});

test('planReorden: un orden que no son exactamente los módulos se rechaza', () => {
  const etapas = [et('e1'), et('e2')];
  const m = soloEtapas(etapas);
  for (const mal of [['e1'], ['e1', 'e2', 'e2'], ['e1', 'zz'], ['e1', 'e2', 'e3']]) {
    assert.deepEqual(planReorden({ etapas, fases: [] }, m, mal), { ok: false, error: 'El orden no coincide con los módulos.' }, mal.join(','));
  }
});

test('planReorden con FASES: la que se movió adopta la fase de la que queda antes, y los grupos quedan contiguos', () => {
  const fases = [fase('f1'), fase('f2')];
  const etapas = [et('e1', { fase: 'f1' }), et('e2', { fase: 'f1' }), et('e3', { fase: 'f2' }), et('e4', { fase: 'f2' })];
  // e4 al medio de f1: entra a f1.
  const p = planReorden({ etapas, fases }, soloEtapas(etapas), ['e1', 'e4', 'e2', 'e3']);
  assert.ok(p.ok);
  if (!p.ok) return;
  assert.deepEqual(p.etapas.map((e) => [e.key, e.fase]), [['e1', 'f1'], ['e4', 'f1'], ['e2', 'f1'], ['e3', 'f2']]);
  assert.deepEqual(p.fases.map((f) => f.key), ['f1', 'f2']);
  // Un intercambio de vecinos (e3 arriba de e2): «subió» la de abajo, que entra al grupo de arriba.
  const q = planReorden({ etapas: etapas.slice(0, 3), fases }, soloEtapas(etapas.slice(0, 3)), ['e1', 'e3', 'e2']);
  assert.ok(q.ok);
  assert.deepEqual(q.ok && q.etapas.map((e) => [e.key, e.fase]), [['e1', 'f1'], ['e3', 'f1'], ['e2', 'f1']]);
});

// ── Una etapa NUEVA (crear un módulo vinculado, vincular un suelto) ──────────

test('⚠️ planConEtapaNueva: un vinculado nuevo «al principio» NO le gana a la entrada', () => {
  const etapas = [et('e1'), et('e2')];
  const nueva = et('nueva');
  // Hasta el 08/10/2026 esto PASABA: el plan comparaba la nueva contra sí misma.
  assert.deepEqual(planConEtapaNueva({ etapas, fases: [] }, soloEtapas(etapas), ['nueva', 'e1', 'e2'], nueva), { ok: false, error: ERROR_PRIMERA });
  // Detrás de un suelto que va primero, tampoco: el lugar en el kanban sigue siendo antes de e1.
  const conSuelto = derivarModulos(etapas, [suelto('m_s', null, 1)]);
  assert.deepEqual(planConEtapaNueva({ etapas, fases: [] }, conSuelto, ['m_s', 'nueva', 'e1', 'e2'], nueva), { ok: false, error: ERROR_PRIMERA });
  // Después de la primera, sí.
  const p = planConEtapaNueva({ etapas, fases: [] }, soloEtapas(etapas), ['e1', 'nueva', 'e2'], nueva);
  assert.ok(p.ok);
  assert.deepEqual(p.ok && keys(p.etapas), ['e1', 'nueva', 'e2']);
  // Con una entrada que no es módulo, «al principio del curso» es después de ella.
  const conOnb = [et('onb', { enCurso: false }), et('e1')];
  const q = planConEtapaNueva({ etapas: conOnb, fases: [] }, soloEtapas(conOnb), ['nueva', 'e1'], nueva);
  assert.ok(q.ok);
  assert.deepEqual(q.ok && keys(q.etapas), ['onb', 'nueva', 'e1']);
});

test('planConEtapaNueva: entra con la fase de la que queda antes; vincular el último suelto la pone al final', () => {
  const fases = [fase('f1'), fase('f2')];
  const etapas = [et('e1', { fase: 'f1' }), et('e2', { fase: 'f2' })];
  const p = planConEtapaNueva({ etapas, fases }, soloEtapas(etapas), ['e1', 'nueva', 'e2'], et('nueva'));
  assert.ok(p.ok);
  assert.deepEqual(p.ok && p.etapas.map((e) => [e.key, e.fase ?? '']), [['e1', 'f1'], ['nueva', 'f1'], ['e2', 'f2']]);
  // Vincular: los módulos de hoy SIN el suelto, y la secuencia con la clave nueva en su lugar.
  const sinFases = [et('e1')];
  const q = planConEtapaNueva({ etapas: sinFases, fases: [] }, soloEtapas(sinFases), ['e1', 'bonus'], et('bonus'));
  assert.ok(q.ok);
  assert.deepEqual(q.ok && keys(q.etapas), ['e1', 'bonus']);
  // Una clave que ya es una etapa no es «nueva».
  assert.equal(planConEtapaNueva({ etapas: sinFases, fases: [] }, [], ['e1'], et('e1')).ok, false);
});

test('etapaNuevaEn / etapaDeModulo: el lugar de la etapa y una clave que no choca', () => {
  const etapas = [et('e1'), et('e2')];
  const v = (k: string) => k === 'e1' || k === 'e2';
  assert.deepEqual(keys(etapaNuevaEn(etapas, [], ['e1', 'm_s', 'n', 'e2'], 2, v, et('n'))), ['e1', 'n', 'e2'], 'detrás del vinculado de antes');
  assert.deepEqual(keys(etapaNuevaEn(etapas, [], ['n'], 0, () => false, et('n'))), ['e1', 'e2', 'n'], 'sin vinculados: al final');
  const e = etapaDeModulo('Bonus Track', ['bonus_track'], 2);
  assert.equal(e.key, 'bonus_track_2');
  assert.equal(e.label, 'Bonus Track');
  assert.ok(e.tone && e.dot);
});

// ── Probado ROMPIÉNDOLO (08/10/2026) ──────────────────────────────────────────
// Arnés que rompe UNA regla por vez y restaura de MEMORIA (scratchpad/nucleo/romper.mjs). Sin romper:
// 15 pass / 0 fail. Cada rotura, y lo que cayó:
//   · `planConEtapaNueva` comparando la primera contra el kanban CON la nueva — o sea el código como
//     estaba hasta que este test lo cazó                            → 14 / 1 «planConEtapaNueva… entrada»
//   · `planReorden` sin el chequeo de la primera                    → 13 / 2 (el reorden y la etapa nueva)
//   · una etapa que no es módulo entra en los lugares del reorden  → 12 / 3
//   · la que se movió no adopta la fase de su vecina               → 14 / 1 «con FASES»
//   · un ancla a una etapa sacada del curso → al final             → 13 / 2 (los dos de anclas)
//   · un suelto con la clave de una etapa se dibuja dos veces      → 14 / 1
//   · un ciclo de anclas pierde módulos                            → 14 / 1
//   · `normalizarEtapas` pierde `enCurso` (lib/servicio-etapas.ts)  → 14 / 1
//   · el nombre con otro tope que el del kanban                     → 14 / 1 (y 21 / 1 en curso-estilo)
