// =============================================================================
// El Media Buyer de AdAmigo: los agentes (los de MaKo y los propios) y Protect (25/10/2026)
// =============================================================================
// Lo que fija: un agente prende o pausa TODAS sus tácticas sin tocar sus umbrales; lo que propone un agente propio sólo
// toca entidades que existen, con cambios acotados, y siempre con la táctica `manual` (el piloto no la lanza); los semanales
// miran los lunes; y Protect avisa de lo roto sin inventar (un pico es contra la semana, y «no llegan al CRM» pide al
// menos 5 leads de Meta).
// Correr: node --import tsx --test tests/media-buyer-agentes-protect.test.ts
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { agenteDeClave, leerAgentes, propuestasDeAgente, tocaHoy, validarAgente } from '../lib/media-buyer/agentes-propios';
import { alertasProtect } from '../lib/media-buyer/protect';
import { cambiarAgente, estadoDeAgente } from '../app/ads-manager/mb-modelo';
import { resolverTacticas, type ConfigTacticas } from '../lib/media-buyer/tacticas';
import type { NodoMB, SenalMB } from '../lib/media-buyer/motor';

const N = (x: Partial<NodoMB> & Pick<NodoMB, 'id' | 'nivel'>): NodoMB => ({ nombre: x.id, parentId: null, configurado: 'ACTIVE', entrega: 'ACTIVE', presupuestoDia: null, nivelPresupuesto: 'adset', creada: null, ...x } as NodoMB);
const arbol = [
  N({ id: '1', nivel: 'campaign', nombre: 'Campaña A' }),
  N({ id: '11', nivel: 'adset', parentId: '1', nombre: 'Conjunto caro', presupuestoDia: 20 }),
  N({ id: '111', nivel: 'ad', parentId: '11', nombre: 'Video 1' }),
  N({ id: '112', nivel: 'ad', parentId: '11', nombre: 'Video 2', configurado: 'PAUSED' }),
  N({ id: '113', nivel: 'ad', parentId: '11', nombre: 'Borrado', configurado: 'DELETED' }),
];

test('un agente prende, pausa o automatiza TODAS sus tácticas, sin tocar sus umbrales ni sus campañas', () => {
  const cfg = { surf: { parametros: { subidaPct: 15 }, campanas: ['1'] } };
  const pausado = cambiarAgente(cfg, 'media_buyer', 'apagada');
  assert.deepEqual(pausado.surf, { parametros: { subidaPct: 15 }, campanas: ['1'], estado: 'apagada' });
  assert.equal(pausado.sunsetting?.estado, 'apagada');
  assert.equal(pausado.stop_loss, undefined, 'no toca las tácticas de otro agente');
  const r = (c: ConfigTacticas) => resolverTacticas(c, { piloto: false, pilotoPermitido: true });
  assert.equal(estadoDeAgente('media_buyer', r(pausado)), 'pausado');
  assert.equal(estadoDeAgente('media_buyer', r(cambiarAgente(cfg, 'media_buyer', 'automatica'))), 'automatico');
  assert.equal(estadoDeAgente('protect', r(cfg)), 'propone');
});

test('un agente propio se valida y se guarda saneado; los semanales miran sólo los lunes; pausado no mira', () => {
  assert.equal(validarAgente({ id: 'ag-1234', nombre: 'X', regla: 'pausa todo' }).ok, false);
  const v = validarAgente({ id: 'ag-1234', nombre: '  Cuida el costo ', regla: 'Pausa todo conjunto que pase de $15 por lead\nen 3 días', cada: 'semana', estado: 'raro' });
  assert.ok(v.ok);
  assert.equal(v.valor.nombre, 'Cuida el costo');
  assert.equal(v.valor.regla.includes('\n'), false);
  assert.equal(v.valor.estado, 'activo');
  assert.deepEqual(leerAgentes('{roto'), []);
  assert.equal(tocaHoy({ estado: 'activo', cada: 'semana' }, '2026-10-26'), true, 'el 26/10/2026 es lunes');
  assert.equal(tocaHoy({ estado: 'activo', cada: 'semana' }, '2026-10-25'), false);
  assert.equal(tocaHoy({ estado: 'pausado', cada: 'dia' }, '2026-10-26'), false);
});

test('lo que propone un agente propio: sólo entidades que existen, cambios acotados, siempre «manual» (el piloto no lo lanza)', () => {
  const a = { id: 'ag-1234', nombre: 'Cuida el costo', regla: 'Pausa lo caro' };
  const crudo = JSON.stringify({ acciones: [
    { tipo: 'pausar', nivel: 'ad', entidadId: '111', porque: 'Gastó $40 sin leads.' },
    { tipo: 'pausar', nivel: 'ad', entidadId: '999', porque: 'inventado' },
    { tipo: 'pausar', nivel: 'adset', entidadId: '111', porque: 'nivel mal' },
    { tipo: 'activar', nivel: 'ad', entidadId: '113', porque: 'borrado' },
    { tipo: 'subir_presupuesto', nivel: 'adset', entidadId: '11', presupuesto: 100, porque: 'subir' },
    { tipo: 'borrar_todo', nivel: 'campaign', entidadId: '1' },
  ] });
  const ps = propuestasDeAgente(crudo, a, arbol, '2026-10-26');
  assert.deepEqual(ps.map((p) => [p.tipo, p.entidadId]), [['pausar', '111'], ['subir_presupuesto', '11']]);
  assert.ok(ps.every((p) => p.tactica === 'manual'));
  assert.deepEqual(ps[1].despues, { presupuesto: 30 }, 'nunca más de 50% en un paso');
  assert.equal(ps[0].campanaNombre, 'Campaña A');
  assert.equal(agenteDeClave(ps[0].clave), 'ag-1234');
  assert.deepEqual(propuestasDeAgente('no es json', a, arbol, '2026-10-26'), []);
  // Y la corrida no lanza lo `manual` con el piloto (corrida.ts → `automaticas`). Lo único que sale solo sin ser una táctica
  // automática es la fecha de fin (`hasta`, la regla de la persona: zona.ts), nunca lo `manual`.
  const corrida = readFileSync(join(import.meta.dirname, '..', 'lib', 'media-buyer', 'corrida.ts'), 'utf8');
  assert.match(corrida, /nuevasMotor\.filter\(\(d\) => d\.tactica !== 'manual' && d\.tactica !== 'hasta' && tacticas\[d\.tactica\]\.estado === 'automatica'\)/);
});

const S = (adId: string, x: Partial<SenalMB>): SenalMB => ({ adId, gasto: 0, leadsMeta: 0, leadsCrm: 0, agendasMeta: 0, agendasCrm: 0, cierres: 0, caja: 0, impresiones: 0, frecuencia: null, diasCorriendo: 3, esVideo: false, miniatura: null, ...x });
const base = { arbol, totalActivo: 20, presupuestoMaxDia: null, fmt: (u: number) => `$${Math.round(u)}` };

test('Protect: rechazados prendidos, el gasto disparado contra la semana, leads que no llegan al CRM, y lo prendido sobre el tope', () => {
  assert.deepEqual(alertasProtect({ ...base, corta: [], larga: [] }), [], 'una cuenta sana no tiene alertas');
  const rechazado = alertasProtect({ ...base, arbol: [...arbol.slice(0, 2), { ...arbol[2], entrega: 'DISAPPROVED' }], corta: [], larga: [] });
  assert.equal(rechazado[0].tipo, 'rechazado');
  assert.equal(rechazado[0].gravedad, 'alta', 'rechazado y con todo lo de arriba prendido');
  const pico = alertasProtect({ ...base, corta: [S('111', { gasto: 360 })], larga: [S('111', { gasto: 420 })] });
  assert.equal(pico[0]?.tipo, 'gasto', '120 por día contra 60 de promedio');
  assert.equal(alertasProtect({ ...base, corta: [S('111', { gasto: 300 })], larga: [S('111', { gasto: 420 })] }).length, 0, '100 contra 60 no llega a 1,8 veces');
  assert.equal(alertasProtect({ ...base, corta: [S('111', { gasto: 30 })], larga: [S('111', { gasto: 42 })] }).length, 0, 'con poco gasto no es un pico');
  const crm = alertasProtect({ ...base, corta: [], larga: [S('111', { gasto: 50, leadsMeta: 6, leadsCrm: 0 })] });
  assert.deepEqual(crm.map((a) => [a.tipo, a.gravedad]), [['seguimiento', 'alta']]);
  assert.equal(alertasProtect({ ...base, corta: [], larga: [S('111', { leadsMeta: 4, leadsCrm: 0 })] }).length, 0, 'con menos de 5 no es una falla');
  assert.equal(alertasProtect({ ...base, totalActivo: 50, presupuestoMaxDia: 40, corta: [], larga: [] })[0].tipo, 'tope');
});
