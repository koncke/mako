import { test } from 'node:test';
import assert from 'node:assert/strict';
import { agregarMetricas, serieDiaria, type FilaEnvio, type FilaInsc } from '../lib/setting-metricas';

test('métricas: agrega por secuencia — canales, respuestas, opens', () => {
  const envios: FilaEnvio[] = [
    { secuencia_id: 1, canal: 'whatsapp', estado: 'enviado', abierto_at: null, clic_at: null },
    { secuencia_id: 1, canal: 'email', estado: 'enviado', abierto_at: '2026-07-30', clic_at: null },
    { secuencia_id: 1, canal: 'email', estado: 'fallo', abierto_at: null, clic_at: null }, // fallo no cuenta como enviado
    { secuencia_id: 2, canal: 'email', estado: 'enviado', abierto_at: '2026-07-30', clic_at: '2026-07-30' },
    { secuencia_id: null, canal: 'email', estado: 'enviado', abierto_at: null, clic_at: null }, // sin secuencia → afuera
  ];
  const inscs: FilaInsc[] = [
    { secuencia_id: 1, estado: 'activa' },
    { secuencia_id: 1, estado: 'respondio' },
    { secuencia_id: 2, estado: 'completada' },
  ];
  const m = agregarMetricas(envios, inscs);
  assert.deepEqual(m.get(1), { enviadosWa: 1, enviadosEmail: 1, respuestas: 1, abiertos: 1, clics: 0, inscriptosActivos: 1, completados: 0 });
  assert.deepEqual(m.get(2), { enviadosWa: 0, enviadosEmail: 1, respuestas: 0, abiertos: 1, clics: 1, inscriptosActivos: 0, completados: 1 });
});

test('métricas: sin filas → mapa vacío', () => {
  assert.equal(agregarMetricas([], []).size, 0);
});

test('serie diaria: bucket por día, ventana exacta, fuera de rango afuera', () => {
  const envios: FilaEnvio[] = [
    { secuencia_id: 1, canal: 'whatsapp', estado: 'enviado', abierto_at: null, clic_at: null, created_at: '2026-07-30T15:00:00Z' },
    { secuencia_id: 1, canal: 'email', estado: 'enviado', abierto_at: '2026-07-31T09:00:00Z', clic_at: null, created_at: '2026-07-30T16:00:00Z' },
    { secuencia_id: 1, canal: 'email', estado: 'fallo', abierto_at: null, clic_at: null, created_at: '2026-07-30T17:00:00Z' }, // fallo no suma envío
    { secuencia_id: 1, canal: 'email', estado: 'enviado', abierto_at: null, clic_at: null, created_at: '2026-06-01T10:00:00Z' }, // fuera de ventana
  ];
  const inscs: FilaInsc[] = [
    { secuencia_id: 1, estado: 'respondio', updated_at: '2026-07-31T10:00:00Z' },
    { secuencia_id: 1, estado: 'activa', updated_at: '2026-07-31T10:00:00Z' }, // activa no cuenta como respuesta
  ];
  const serie = serieDiaria(envios, inscs, '2026-07-31', 7);
  assert.equal(serie.length, 7);
  assert.equal(serie[0].dia, '2026-07-25');
  assert.equal(serie[6].dia, '2026-07-31');
  const d30 = serie.find((p) => p.dia === '2026-07-30')!;
  assert.deepEqual(d30, { dia: '2026-07-30', enviadosWa: 1, enviadosEmail: 1, respuestas: 0, abiertos: 0 });
  const d31 = serie.find((p) => p.dia === '2026-07-31')!;
  assert.deepEqual(d31, { dia: '2026-07-31', enviadosWa: 0, enviadosEmail: 0, respuestas: 1, abiertos: 1 });
});
