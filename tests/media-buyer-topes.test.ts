// Los topes del negocio (Martín, 25/10/2026: «cuánto puede subir el presupuesto por día, el gasto máximo, y un
// interruptor que lo apaga todo»). Se miran al ESCRIBIR, con el estado en vivo.
// Verificado rompiéndolo (25/10/2026): contando el tope del día desde el presupuesto ACTUAL y no el de la mañana, 1 fallo y
// 9 pases. Restaurado, 10 de 10.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { aplicarTopes, type ContextoTopes } from '../lib/media-buyer/topes';
import { CONFIG_POR_DEFECTO, type ConfigMediaBuyer } from '../lib/media-buyer/tipos';

const ctx = (x: Omit<Partial<ContextoTopes>, 'config'> & { config?: Partial<ConfigMediaBuyer> } = {}): ContextoTopes => {
  const { config, ...resto } = x;
  return {
    config: { ...CONFIG_POR_DEFECTO, encendido: true, ...(config ?? {}) },
    actual: { estado: 'ACTIVE', presupuesto: 50 },
    inicioDelDia: null,
    totalActivo: 200,
    presupuestoQueSuma: null,
    aUnidad: (m) => m, deUnidad: (u) => u, fmt: (u) => `US$ ${u}`,
    ...resto,
  };
};

test('El interruptor apagado frena todo lo que se lanza', () => {
  const r = aplicarTopes('bajar_presupuesto', { presupuesto: 40 }, ctx({ config: { encendido: false } }));
  assert.equal(r.ok, false);
});

test('…pero un Deshacer pasa igual: volver atrás nunca es lo peligroso', () => {
  const r = aplicarTopes('bajar_presupuesto', { presupuesto: 40 }, ctx({ config: { encendido: false } }), { deshacer: true });
  assert.equal(r.ok, true);
});

test('Subir dentro del tope del día pasa tal cual', () => {
  const r = aplicarTopes('subir_presupuesto', { presupuesto: 60 }, ctx());
  assert.deepEqual(r, { ok: true, despues: { presupuesto: 60 }, ajuste: null });
});

test('Subir más que el tope del día se RECORTA al tope, con el porqué', () => {
  const r = aplicarTopes('subir_presupuesto', { presupuesto: 80 }, ctx({ config: { subidaMaxPctDia: 20 } }));
  assert.equal(r.ok, true);
  if (r.ok) { assert.equal(r.despues.presupuesto, 60); assert.ok(r.ajuste); }
});

test('El tope del día se cuenta desde el presupuesto de la MAÑANA: dos subidas en el día no suman 44%', () => {
  // Empezó en 50, ya subió a 60 (20%): otra subida hoy no entra.
  const r = aplicarTopes('subir_presupuesto', { presupuesto: 72 }, ctx({ actual: { estado: 'ACTIVE', presupuesto: 60 }, inicioDelDia: 50 }));
  assert.equal(r.ok, false);
});

test('El presupuesto máximo de la cuenta recorta la subida', () => {
  // La cuenta suma 200 con este conjunto en 50; el tope es 205 → el conjunto puede ir hasta 55.
  const r = aplicarTopes('subir_presupuesto', { presupuesto: 60 }, ctx({ config: { presupuestoMaxDia: 205 } }));
  assert.equal(r.ok, true);
  if (r.ok) assert.equal(r.despues.presupuesto, 55);
});

test('Con la cuenta ya en su tope, no sube nada', () => {
  const r = aplicarTopes('subir_presupuesto', { presupuesto: 60 }, ctx({ config: { presupuestoMaxDia: 200 } }));
  assert.equal(r.ok, false);
});

test('Prender algo que pasaría el tope de la cuenta no se puede', () => {
  const r = aplicarTopes('activar', { estado: 'ACTIVE' }, ctx({ config: { presupuestoMaxDia: 220 }, actual: { estado: 'PAUSED' }, presupuestoQueSuma: 30 }));
  assert.equal(r.ok, false);
  const r2 = aplicarTopes('activar', { estado: 'ACTIVE' }, ctx({ config: { presupuestoMaxDia: 240 }, actual: { estado: 'PAUSED' }, presupuestoQueSuma: 30 }));
  assert.equal(r2.ok, true);
});

test('Un Deshacer que SUBE el gasto mira el tope de la cuenta igual', () => {
  const r = aplicarTopes('bajar_presupuesto', { presupuesto: 60 }, ctx({ config: { presupuestoMaxDia: 200 } }), { deshacer: true });
  assert.equal(r.ok, false);
});

test('Bajar y pausar nunca pasan por el tope de subida', () => {
  assert.equal(aplicarTopes('bajar_presupuesto', { presupuesto: 10 }, ctx({ config: { presupuestoMaxDia: 1 } })).ok, true);
  assert.equal(aplicarTopes('pausar', { estado: 'PAUSED' }, ctx({ config: { presupuestoMaxDia: 1 } })).ok, true);
});
