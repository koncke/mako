// El Stop Loss del día (lib/media-buyer/del-dia.ts) y «lánzame una campaña» (lib/media-buyer/campana-reglas.ts), lo prometido a
// la agencia de Thiago el 29/10/2026. Lo que fija: el vigía pausa lo que HOY gastó 2 veces el objetivo sin un resultado, y no
// lo que viene rindiendo, ni lo que MaKo tocó hace menos de un día, ni con la táctica apagada; la campaña nueva pide lo que su
// objetivo necesita, viaja con el presupuesto en UNIDADES, nace toda en pausa cuando se pide, y su resumen muestra el texto
// ENTERO. Correr: node --import tsx --test tests/media-buyer-del-dia-y-campana.test.ts
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { stopLossDelDia, claveDelDia, type EntradaDelDia } from '../lib/media-buyer/del-dia';
import { resolverTacticas } from '../lib/media-buyer/tacticas';
import type { NodoMB, SenalMB } from '../lib/media-buyer/motor';
import { validarCampana, cuerpoCampana, resumenCampana, type EntradaCampana } from '../lib/media-buyer/campana-reglas';
import type { LugarZona } from '../lib/media-buyer/zona';

const AHORA = Date.parse('2026-11-05T18:00:00Z');
const HOY = '2026-11-05';
const nodo = (id: string, nivel: NodoMB['nivel'], parentId: string | null, x: Partial<NodoMB> = {}): NodoMB => ({
  id, nombre: id, nivel, parentId, configurado: 'ACTIVE', entrega: 'ACTIVE', presupuestoDia: null, nivelPresupuesto: null, creada: '2026-09-01T00:00:00Z', ...x,
});
const senal = (adId: string, x: Partial<SenalMB> = {}): SenalMB => ({
  adId, gasto: 0, leadsMeta: 0, leadsCrm: 0, agendasMeta: 0, agendasCrm: 0, cierres: 0, caja: 0, impresiones: 1000, frecuencia: 1, diasCorriendo: 1, esVideo: false, miniatura: null, ...x,
});
const arbol = (): NodoMB[] => [nodo('c1', 'campaign', null), nodo('s1', 'adset', 'c1', { presupuestoDia: 100 }), nodo('a1', 'ad', 's1'), nodo('a2', 'ad', 's1')];
function entrada(x: Partial<EntradaDelDia> = {}): EntradaDelDia {
  return {
    ahora: AHORA, hoy: HOY, kpi: 'lead', objetivo: 10, arbol: arbol(),
    delDia: [senal('a1', { gasto: 25 }), senal('a2', { gasto: 25, leadsMeta: 1 })], semana: [], historial: [],
    fmt: (u) => `US$ ${u.toFixed(2)}`, ...x,
  };
}

test('Stop Loss del día: hoy 2,5 veces el objetivo sin un lead → pausar; con un lead, no', () => {
  const ps = stopLossDelDia(entrada());
  assert.deepEqual(ps.map((p) => p.entidadId), ['a1']);
  assert.equal(ps[0].tipo, 'pausar');
  assert.equal(ps[0].tactica, 'stop_loss');
  assert.equal(ps[0].clave, claveDelDia('a1', HOY));
  assert.equal(ps[0].clave, 'stop_loss_hoy:ad:a1:2026-11-05', 'una por anuncio y por día del negocio');
});

test('Stop Loss del día: debajo de 2 veces el objetivo, no; un lead del CRM de hoy también cuenta', () => {
  assert.deepEqual(stopLossDelDia(entrada({ delDia: [senal('a1', { gasto: 19 })] })), []);
  assert.deepEqual(stopLossDelDia(entrada({ delDia: [senal('a1', { gasto: 40, leadsCrm: 1 })] })), []);
});

test('Stop Loss del día: lo que viene rindiendo (la semana dentro del objetivo) no se pausa por una mañana mala', () => {
  assert.deepEqual(stopLossDelDia(entrada({ semana: [senal('a1', { gasto: 70, leadsMeta: 10 })] })), [], 'US$7 por lead la semana pasada');
  assert.equal(stopLossDelDia(entrada({ semana: [senal('a1', { gasto: 200, leadsMeta: 10 })] })).length, 1, 'a US$20 por lead sí');
});

test('Stop Loss del día: lo apagado, lo que no está prendido y lo que MaKo tocó hace menos de un día, no', () => {
  const apagada = resolverTacticas({ stop_loss: { estado: 'apagada' } }, { piloto: false, pilotoPermitido: true });
  assert.deepEqual(stopLossDelDia(entrada({ tacticas: apagada })), []);
  assert.deepEqual(stopLossDelDia(entrada({ arbol: arbol().map((n) => (n.id === 's1' ? { ...n, configurado: 'PAUSED' } : n)) })), [], 'su conjunto está pausado');
  assert.deepEqual(stopLossDelDia(entrada({ arbol: arbol().filter((n) => n.id !== 's1') })), [], 'un padre que no vino es «no está prendido»');
  const revivido = { tipo: 'activar' as const, tactica: 'revive' as const, nivel: 'ad' as const, entidadId: 'a1', estado: 'aplicada' as const, creada: '2026-11-05T10:00:00Z', aplicadaAt: '2026-11-05T10:00:00Z', origen: 'piloto' as const };
  assert.deepEqual(stopLossDelDia(entrada({ historial: [revivido] })), [], 'Revive lo prendió hoy');
  assert.deepEqual(stopLossDelDia(entrada({ objetivo: null })), [], 'sin objetivo no hay vara');
});

test('Stop Loss del día: respeta las campañas que cubre la táctica y su umbral', () => {
  const otra = resolverTacticas({ stop_loss: { campanas: ['c9'] } }, { piloto: false, pilotoPermitido: true });
  assert.deepEqual(stopLossDelDia(entrada({ tacticas: otra })), []);
  const tres = resolverTacticas({ stop_loss: { parametros: { gastoVeces: 3 } } }, { piloto: false, pilotoPermitido: true });
  assert.deepEqual(stopLossDelDia(entrada({ tacticas: tres })), [], 'con 3 veces, US$25 no alcanza');
});

// ── «Lánzame una campaña» ────────────────────────────────────────────────────

const MADRID: LugarZona = { tipo: 'city', key: '777', nombre: 'Madrid', pais: 'ES', regionId: '1234' };
const base = {
  nombre: 'Lanzamiento noviembre', objetivo: 'formulario', presupuestoDia: 30, formularioId: '555',
  creativo: { tipo: 'imagen', url: 'https://cdn.ejemplo.com/a.jpg' }, texto: 'Agenda tu llamada', hasta: '2026-11-30',
};
const valida = (x: Record<string, unknown>): EntradaCampana => {
  const v = validarCampana(x, [MADRID]);
  if (!v.ok) throw new Error(v.error);
  return v.valor;
};

test('campaña: cada objetivo pide lo suyo (formulario, píxel, página con https, creativo, texto)', () => {
  assert.doesNotThrow(() => valida(base));
  assert.equal(validarCampana({ ...base, formularioId: '' }, [MADRID]).ok, false, 'formulario sin formulario');
  assert.equal(validarCampana({ ...base, objetivo: 'web', formularioId: null }, [MADRID]).ok, false, 'web sin píxel');
  assert.equal(validarCampana({ ...base, objetivo: 'web', pixelId: '9', url: 'http://sin-s.com' }, [MADRID]).ok, false, 'web sin https');
  assert.equal(validarCampana({ ...base, creativo: { tipo: 'imagen', url: 'ftp://x' } }, [MADRID]).ok, false);
  assert.equal(validarCampana({ ...base, texto: '' }, [MADRID]).ok, false, 'sin texto');
  assert.doesNotThrow(() => valida({ ...base, texto: '', creativo: { tipo: 'anuncio', adId: '123' } }), 'reusar un anuncio no pide texto');
  assert.equal(validarCampana({ ...base, presupuestoDia: 0 }, [MADRID]).ok, false);
  assert.equal(validarCampana({ ...base, creativo: { tipo: 'archivo', path: '../otro/x.jpg' } }, [MADRID]).ok, false, 'sólo un path del staging');
  assert.equal(valida({ ...base, objetivo: 'web', pixelId: '9', url: 'https://x.com', evento: 'schedule' }).evento, 'SCHEDULE');
  assert.equal(validarCampana({ ...base, objetivo: 'web', pixelId: '9', url: 'https://x.com', evento: 'PURCHASE' }).ok, false, 'compras no es un evento de registros');
});

test('campaña: el cuerpo de Zernio lleva el presupuesto en UNIDADES, la fecha, los lugares y el formulario', () => {
  const c = cuerpoCampana(valida(base), { conexion: { accountId: 'z1', adAccountId: 'act_1' }, hasta: '2026-11-30' });
  assert.equal(c.budgetAmount, 30, 'unidades de la moneda, nunca centavos');
  assert.equal(c.budgetType, 'daily');
  assert.equal(c.goal, 'lead_generation');
  assert.equal(c.leadGenFormId, '555');
  assert.equal(c.endDate, '2026-11-30');
  assert.deepEqual(c.targeting, { cities: [{ key: '777' }] });
  assert.equal(c.imageUrl, 'https://cdn.ejemplo.com/a.jpg');
  assert.equal(c.status, 'ACTIVE');
  assert.equal(c.campaignName, 'Lanzamiento noviembre');
});

test('campaña: «en pausa» pausa los TRES niveles (status PAUSED sólo pausa el de arriba)', () => {
  const c = cuerpoCampana(valida({ ...base, enPausa: true }), { conexion: { accountId: 'z1', adAccountId: 'act_1' }, hasta: null });
  assert.equal(c.campaignStatus, 'PAUSED');
  assert.equal(c.adSetStatus, 'PAUSED');
  assert.equal(c.adStatus, 'PAUSED');
  assert.equal(c.status, 'PAUSED', 'y también el único que se midió');
  assert.equal(c.endDate, undefined, 'sin fecha, sin endDate');
});

test('campaña: compras y web van con el píxel y su evento; reusar un anuncio manda su creativo', () => {
  const w = cuerpoCampana(valida({ ...base, objetivo: 'compras', pixelId: '9', url: 'https://tienda.com' }), { conexion: { accountId: 'z1', adAccountId: 'act_1' }, hasta: null });
  assert.equal(w.goal, 'conversions');
  assert.deepEqual(w.promotedObject, { pixelId: '9', customEventType: 'PURCHASE' });
  assert.equal(w.leadGenFormId, undefined);
  const r = cuerpoCampana(valida({ ...base, texto: '', creativo: { tipo: 'anuncio', adId: '123' } }), { conexion: { accountId: 'z1', adAccountId: 'act_1' }, hasta: null, creativoReusado: { id: '999', texto: 'El de siempre', link: null } });
  assert.equal(r.existingCreativeId, '999');
  assert.equal(r.imageUrl, undefined);
  assert.throws(() => cuerpoCampana(valida({ ...base, creativo: { tipo: 'anuncio', adId: '123' } }), { conexion: { accountId: 'z1', adAccountId: 'act_1' }, hasta: null }), /reusar/);
});

test('campaña: el resumen que se confirma muestra el texto ENTERO, el monto, los lugares y la fecha', () => {
  const largo = 'x'.repeat(1500);
  const r = resumenCampana(valida({ ...base, texto: largo }), { moneda: 'EUR', hasta: '2026-11-30', fmt: (n) => `€${n}` });
  assert.ok(r.includes(largo), 'sin cortar');
  assert.ok(r.includes('€30 por día'));
  assert.ok(r.includes('Madrid'));
  assert.ok(r.includes('30/11/2026'));
});
