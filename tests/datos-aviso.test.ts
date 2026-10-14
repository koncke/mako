import { test } from 'node:test';
import assert from 'node:assert/strict';
import { stepsForStage, pasosResueltos, type StageReqValues } from '../lib/stage-requirements';
import { avisables, partirDatos, conIgnorado, sanearApagados, sanearIds, NO_IGNORABLES, DATOS_AVISABLES, TAB_DE_DATO } from '../lib/datos-aviso';

/**
 * «Datos sin marcar» v2 (Martín, 13/10/2026): ignorar UN dato, apagar el aviso de un TIPO de
 * dato, y ver lo resuelto detrás de «Ver más». Se prueba EJECUTANDO las reglas.
 *
 * Verificado rompiéndolo (base 7/0): `pasosResueltos` sin saltear lo que falta, 1 fallo;
 * `avisables` sin dejar pasar lo no ignorable, 1 fallo; `partirDatos` sin el estado
 * «sin_aviso», 1 fallo; `conIgnorado` dejando ignorar la asistencia, 1 fallo.
 */

const HOY = '2026-10-13';
// Un lead en la R1 que ya pasó: asistió, sin Fathom, con setter, sin empresa.
const R1_PASADA: StageReqValues = {
  fechaJ1: '2026-10-10', asistioJ1: true, calificado: true, hasFathomUrl: false,
  closer: 'Ana', setter: 'Beto', empresa: '', telefono: '+5491100000000', hoyISO: HOY,
};

test('lo resuelto sale de la MISMA regla que lo que falta', () => {
  const faltan = stepsForStage('agenda', R1_PASADA).map((s) => s.id);
  const resueltos = pasosResueltos('agenda', R1_PASADA).map((s) => s.id);
  assert.deepEqual(faltan.sort(), ['empresa', 'fathomR1'].sort());
  for (const id of ['fechaJ1', 'asistenciaR1', 'calificado', 'closer', 'setter', 'telefono']) {
    assert.ok(resueltos.includes(id as never), `«${id}» está cargado y la etapa lo pide: es resuelto`);
  }
  assert.ok(!resueltos.some((r) => faltan.includes(r)), 'algo que falta salió como resuelto');
});

test('no se dice resuelto lo que no aplica: sin asistencia, ni Fathom ni calificado', () => {
  const noVino: StageReqValues = { ...R1_PASADA, asistioJ1: false, calificado: null };
  const resueltos = pasosResueltos('agenda', noVino).map((s) => s.id);
  assert.ok(!resueltos.includes('fathomR1'), '«✓ Link de Fathom» sobre alguien que no vino');
  assert.ok(!resueltos.includes('calificado'));
  // Y lo que el caller pasó undefined no se evalúa: no hay «✓ Empresa» en nutrición.
  const sinEmpresa = pasosResueltos('agenda', { ...R1_PASADA, empresa: undefined }).map((s) => s.id);
  assert.ok(!sinEmpresa.includes('empresa'));
});

test('lo ignorado y lo apagado no avisan; la asistencia de una reunión pasada, siempre', () => {
  const faltan = [
    { id: 'asistenciaR1' as const, label: 'Asistencia a la Reunión 1' },
    { id: 'fathomR1' as const, label: 'Link de Fathom (R1)' },
    { id: 'empresa' as const, label: 'Empresa' },
  ];
  assert.deepEqual(avisables(faltan, ['fathomR1', 'asistenciaR1'], ['empresa']).map((f) => f.id), ['asistenciaR1']);
  assert.deepEqual(avisables(faltan, null, null).map((f) => f.id), ['asistenciaR1', 'fathomR1', 'empresa']);
});

test('el desplegable: lo que avisa arriba, lo escondido detrás de «Ver más»', () => {
  const faltan = [
    { id: 'fathomR1' as const, label: 'Link de Fathom (R1)' },
    { id: 'empresa' as const, label: 'Empresa' },
    { id: 'telefono' as const, label: 'Teléfono de contacto' },
  ];
  const resueltos = [{ id: 'setter' as const, label: 'Setter asignado' }];
  const d = partirDatos(faltan, resueltos, ['empresa'], ['telefono']);
  assert.deepEqual(d.avisar.map((x) => x.id), ['fathomR1']);
  assert.deepEqual(d.ocultos.map((x) => [x.id, x.estado]), [['empresa', 'ignorado'], ['telefono', 'sin_aviso'], ['setter', 'resuelto']]);
});

test('ignorar no admite la asistencia, ni ids inventados', () => {
  assert.deepEqual(conIgnorado(['empresa'], 'asistenciaR1', true), ['empresa']);
  assert.deepEqual(conIgnorado(['empresa', 'x', 'empresa'], 'fathomR1', true), ['empresa', 'fathomR1']);
  assert.deepEqual(conIgnorado(['empresa', 'fathomR1'], 'empresa', false), ['fathomR1']);
  assert.deepEqual(sanearApagados(['asistenciaR2', 'monto', 'nada']), ['monto']);
  assert.deepEqual(sanearIds('monto'), []);
});

test('cada dato configurable tiene dónde completarse, y lo no ignorable está en la lista', () => {
  for (const d of DATOS_AVISABLES) assert.ok(TAB_DE_DATO[d.id], `«${d.label}» no tiene tab`);
  for (const id of NO_IGNORABLES) assert.ok(DATOS_AVISABLES.some((d) => d.id === id));
});

test('la etapa de cierre: monto y plan cargados son resueltos', () => {
  const venta: StageReqValues = { ...R1_PASADA, hasFathomUrl: true, fechaJ2: '2026-10-11', asistioJ2: true, monto: 1500, tienePlan: true };
  const resueltos = pasosResueltos('ganado', venta).map((s) => s.id);
  assert.ok(resueltos.includes('monto') && resueltos.includes('plan'));
  assert.ok(!resueltos.includes('comprobante'), 'sin cuotas pagadas no hay comprobante que dar por bueno');
});
