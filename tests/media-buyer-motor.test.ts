// El motor del Media Buyer: las tácticas de Madgicx (Surf, Sunsetting, Stop Loss, Revive) y las dos de MaKo
// (Calidad y Ganador) sobre una cuenta armada a mano. Lo que fija: cuándo propone y cuándo NO (el enfriamiento
// de 72 h, un cambio por día, lo apagado, el interruptor), y que nunca propone dos cosas sobre la misma entidad.
// Verificado rompiéndolo (25/10/2026): sin el enfriamiento en Surf/Sunsetting, 2 fallos y 18 pases; con el Stop Loss sin
// mirar si está prendido, 1 fallo y 19 pases. Restaurado, 21 de 21.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { proponer, objetivoRecomendado, resultados, type EntradaMotor, type NodoMB, type SenalMB, type DecisionPrevia } from '../lib/media-buyer/motor';
import { CONFIG_POR_DEFECTO, type ConfigMediaBuyer } from '../lib/media-buyer/tipos';

const AHORA = Date.parse('2026-10-25T15:00:00Z');
const HOY = '2026-10-25';
const VIEJA = '2026-09-01T00:00:00Z';

const nodo = (id: string, nivel: NodoMB['nivel'], parentId: string | null, x: Partial<NodoMB> = {}): NodoMB => ({
  id, nombre: id, nivel, parentId, configurado: 'ACTIVE', entrega: 'ACTIVE', presupuestoDia: null, nivelPresupuesto: null, creada: VIEJA, ...x,
});
const senal = (adId: string, x: Partial<SenalMB> = {}): SenalMB => ({
  adId, gasto: 0, leadsMeta: 0, leadsCrm: 0, agendasMeta: 0, agendasCrm: 0, cierres: 0, caja: 0, impresiones: 1000, frecuencia: 1.2, diasCorriendo: 7, esVideo: false, miniatura: null, ...x,
});

// Una campaña ABO con dos conjuntos de un anuncio cada uno. Presupuestos en la moneda de la cuenta = USD.
function cuenta(): NodoMB[] {
  return [
    nodo('c1', 'campaign', null, { nivelPresupuesto: 'adset' }),
    nodo('s1', 'adset', 'c1', { presupuestoDia: 50, nivelPresupuesto: 'adset' }),
    nodo('a1', 'ad', 's1'),
    nodo('s2', 'adset', 'c1', { presupuestoDia: 40, nivelPresupuesto: 'adset' }),
    nodo('a2', 'ad', 's2'),
  ];
}

function entrada(x: Omit<Partial<EntradaMotor>, 'config'> & { config?: Partial<ConfigMediaBuyer> } = {}): EntradaMotor {
  const { config, ...resto } = x;
  return {
    ahora: AHORA,
    config: { ...CONFIG_POR_DEFECTO, ...(config ?? {}) },
    objetivo: 10,
    arbol: cuenta(),
    corta: [], larga: [], crm: [], historial: [],
    aUnidad: (m) => m, fmt: (u) => `US$ ${u.toFixed(2)}`, presupuestoMinimo: 5,
    ...resto,
  };
}

test('Surf: un conjunto que trae leads baratos y gasta todo su presupuesto sube 20%', () => {
  const ps = proponer(entrada({
    corta: [senal('a1', { gasto: 150, leadsMeta: 20 })], // 7,5 por lead, 100% del presupuesto de 3 días
    larga: [senal('a1', { gasto: 350, leadsMeta: 45 })],
  }), HOY);
  const p = ps.find((x) => x.entidadId === 's1');
  assert.ok(p, 'propone sobre s1');
  assert.equal(p.tipo, 'subir_presupuesto');
  assert.equal(p.tactica, 'surf');
  assert.deepEqual(p.antes, { presupuesto: 50 });
  assert.deepEqual(p.despues, { presupuesto: 60 });
  assert.ok(p.numeros.length >= 3, 'trae la tabla de números');
  assert.ok(p.porque.length >= 2, 'trae el porqué');
});

test('Surf respeta el tope del negocio: con 10% por día sube 10%, no 20%', () => {
  const ps = proponer(entrada({
    config: { subidaMaxPctDia: 10 },
    corta: [senal('a1', { gasto: 150, leadsMeta: 20 })],
  }), HOY);
  assert.deepEqual(ps.find((x) => x.entidadId === 's1')?.despues, { presupuesto: 55 });
});

test('Surf NO sube lo que no gasta su presupuesto: el presupuesto no lo frena', () => {
  const ps = proponer(entrada({ corta: [senal('a1', { gasto: 60, leadsMeta: 10 })] }), HOY); // 40% del presupuesto
  assert.equal(ps.find((x) => x.entidadId === 's1'), undefined);
});

test('Surf NO toca un conjunto creado hace menos de 72 h', () => {
  const arbol = cuenta().map((n) => n.id === 's1' ? { ...n, creada: '2026-10-24T00:00:00Z' } : n);
  const ps = proponer(entrada({ arbol, corta: [senal('a1', { gasto: 150, leadsMeta: 20 })] }), HOY);
  assert.equal(ps.find((x) => x.entidadId === 's1'), undefined);
});

test('Un cambio de presupuesto por día: lo que MaKo subió hace 5 h no se vuelve a tocar', () => {
  const historial: DecisionPrevia[] = [{ tipo: 'subir_presupuesto', tactica: 'surf', nivel: 'adset', entidadId: 's1', estado: 'aplicada', creada: '2026-10-25T09:00:00Z', aplicadaAt: '2026-10-25T10:00:00Z', origen: 'piloto' }];
  const ps = proponer(entrada({ historial, corta: [senal('a1', { gasto: 150, leadsMeta: 20 })] }), HOY);
  assert.equal(ps.find((x) => x.entidadId === 's1'), undefined);
});

test('Sunsetting: un conjunto caro baja 20%; uno que no se recupera se pausa', () => {
  const ps = proponer(entrada({
    larga: [
      senal('a1', { gasto: 300, leadsMeta: 18 }), // 16,7 por lead = 167% → bajar
      senal('a2', { gasto: 300, leadsMeta: 5 }),  // 60 por lead = 600% → apagar
    ],
  }), HOY);
  const s1 = ps.find((x) => x.entidadId === 's1');
  const s2 = ps.find((x) => x.entidadId === 's2');
  assert.equal(s1?.tipo, 'bajar_presupuesto');
  assert.deepEqual(s1?.despues, { presupuesto: 40 });
  assert.equal(s2?.tipo, 'pausar');
  assert.equal(s2?.tactica, 'sunsetting');
});

test('Sunsetting no baja de presupuesto mínimo', () => {
  const arbol = cuenta().map((n) => n.id === 's1' ? { ...n, presupuestoDia: 5 } : n);
  const ps = proponer(entrada({ arbol, larga: [senal('a1', { gasto: 300, leadsMeta: 18 })] }), HOY);
  assert.equal(ps.find((x) => x.entidadId === 's1' && x.tipo === 'bajar_presupuesto'), undefined);
});

test('Stop Loss: un anuncio con 2 objetivos gastados y cero resultados en 3+ días se pausa', () => {
  const ps = proponer(entrada({ larga: [senal('a1', { gasto: 25, diasCorriendo: 4 })] }), HOY);
  const p = ps.find((x) => x.entidadId === 'a1');
  assert.equal(p?.tipo, 'pausar');
  assert.equal(p?.tactica, 'stop_loss');
});

test('Stop Loss NO pausa un anuncio de 2 días: todavía no tuvo su oportunidad', () => {
  const ps = proponer(entrada({ larga: [senal('a1', { gasto: 25, diasCorriendo: 2 })] }), HOY);
  assert.equal(ps.find((x) => x.entidadId === 'a1'), undefined);
});

test('Nada se propone sobre lo que ya está apagado (tampoco sus hijos)', () => {
  const arbol = cuenta().map((n) => n.id === 'c1' ? { ...n, configurado: 'PAUSED' } : n);
  const ps = proponer(entrada({ arbol, larga: [senal('a1', { gasto: 25, diasCorriendo: 4 })], corta: [senal('a2', { gasto: 120, leadsMeta: 20 })] }), HOY);
  assert.deepEqual(ps, []);
});

test('Si la lectura vino sin la campaña (parcial), sus conjuntos y anuncios son «no sé» y no se tocan', () => {
  const arbol = cuenta().filter((n) => n.id !== 'c1');
  const ps = proponer(entrada({ arbol, corta: [senal('a1', { gasto: 150, leadsMeta: 20 })], larga: [senal('a2', { gasto: 25, diasCorriendo: 4 })] }), HOY);
  assert.deepEqual(ps, []);
});

test('Con el interruptor apagado no propone nada', () => {
  const ps = proponer(entrada({ config: { encendido: false }, larga: [senal('a1', { gasto: 25, diasCorriendo: 4 })] }), HOY);
  assert.deepEqual(ps, []);
});

test('Revive: lo que pausó MaKo hace 2 días y con el CRM al día cuesta menos que el objetivo, se vuelve a prender', () => {
  const arbol = cuenta().map((n) => n.id === 'a1' ? { ...n, configurado: 'PAUSED' } : n);
  const historial: DecisionPrevia[] = [{ tipo: 'pausar', tactica: 'stop_loss', nivel: 'ad', entidadId: 'a1', estado: 'aplicada', creada: '2026-10-23T12:00:00Z', aplicadaAt: '2026-10-23T12:00:00Z', origen: 'piloto' }];
  const ps = proponer(entrada({ arbol, historial, crm: [senal('a1', { gasto: 40, leadsCrm: 5 })] }), HOY);
  const p = ps.find((x) => x.entidadId === 'a1');
  assert.equal(p?.tipo, 'activar');
  assert.equal(p?.tactica, 'revive');
});

test('Revive NO prende lo que una persona volvió a tocar después', () => {
  const arbol = cuenta().map((n) => n.id === 'a1' ? { ...n, configurado: 'PAUSED' } : n);
  const historial: DecisionPrevia[] = [
    { tipo: 'pausar', tactica: 'stop_loss', nivel: 'ad', entidadId: 'a1', estado: 'aplicada', creada: '2026-10-22T12:00:00Z', aplicadaAt: '2026-10-22T12:00:00Z', origen: 'piloto' },
    { tipo: 'pausar', tactica: 'calidad', nivel: 'ad', entidadId: 'a1', estado: 'aplicada', creada: '2026-10-23T12:00:00Z', aplicadaAt: '2026-10-23T12:00:00Z', origen: 'persona' },
  ];
  // La última aplicada es la de la persona (más nueva): el Revive sólo mira la suya si es la última.
  const ps = proponer(entrada({ arbol, historial, crm: [senal('a1', { gasto: 40, leadsCrm: 5 })] }), HOY);
  assert.equal(ps.filter((x) => x.entidadId === 'a1').length, 1, 'propone una sola vez, sobre la pausa más nueva');
});

test('Calidad (sólo MaKo): un anuncio con 8+ leads del CRM y ninguna agenda se pausa cuando la cuenta sí agenda', () => {
  const ps = proponer(entrada({
    config: { kpi: 'agenda' },
    crm: [senal('a1', { leadsCrm: 10, agendasCrm: 0, gasto: 50 }), senal('a2', { leadsCrm: 20, agendasCrm: 6, gasto: 80 })],
  }), HOY);
  const p = ps.find((x) => x.entidadId === 'a1');
  assert.equal(p?.tactica, 'calidad');
  assert.equal(p?.tipo, 'pausar');
});

test('Ganador: el mejor anuncio pide variaciones de texto (o hooks si es video), una vez por semana', () => {
  const larga = [senal('a1', { gasto: 40, leadsMeta: 8 }), senal('a2', { gasto: 30, leadsMeta: 4, esVideo: true })];
  const ps = proponer(entrada({ larga }), HOY);
  assert.equal(ps.find((x) => x.entidadId === 'a1')?.tipo, 'variaciones_texto');
  assert.equal(ps.find((x) => x.entidadId === 'a2')?.tipo, 'variaciones_hook');
  const historial: DecisionPrevia[] = [{ tipo: 'variaciones_texto', tactica: 'ganador', nivel: 'ad', entidadId: 'a1', estado: 'aplicada', creada: '2026-10-22T12:00:00Z', aplicadaAt: '2026-10-22T13:00:00Z', origen: 'persona' }];
  const ps2 = proponer(entrada({ larga, historial }), HOY);
  assert.equal(ps2.find((x) => x.entidadId === 'a1'), undefined, 'ya hubo variaciones hace 3 días');
});

test('Una propuesta por entidad: si se pausa, no se baja también', () => {
  const ps = proponer(entrada({ larga: [senal('a2', { gasto: 300, leadsMeta: 5 })] }), HOY);
  assert.equal(ps.filter((x) => x.entidadId === 's2').length, 1);
});

test('CBO: el presupuesto se mueve en la campaña, nunca en sus conjuntos', () => {
  const arbol: NodoMB[] = [
    nodo('c1', 'campaign', null, { presupuestoDia: 100, nivelPresupuesto: 'campaign' }),
    nodo('s1', 'adset', 'c1', { nivelPresupuesto: 'campaign' }),
    nodo('a1', 'ad', 's1'),
  ];
  const ps = proponer(entrada({ arbol, corta: [senal('a1', { gasto: 300, leadsMeta: 40 })] }), HOY);
  assert.equal(ps.find((x) => x.tipo === 'subir_presupuesto')?.entidadId, 'c1');
});

test('Lead y agenda toman el MAYOR entre Meta y el CRM (la misma persona, no se suma); la venta, sólo el CRM', () => {
  assert.equal(resultados({ leadsMeta: 5, leadsCrm: 7, agendasMeta: 0, agendasCrm: 0, cierres: 0 }, 'lead'), 7);
  assert.equal(resultados({ leadsMeta: 5, leadsCrm: 7, agendasMeta: 3, agendasCrm: 1, cierres: 2 }, 'agenda'), 3);
  assert.equal(resultados({ leadsMeta: 5, leadsCrm: 7, agendasMeta: 3, agendasCrm: 1, cierres: 2 }, 'venta'), 2);
});

test('El objetivo recomendado es el costo por resultado de la cuenta; sin resultados, no hay', () => {
  assert.equal(objetivoRecomendado([senal('a1', { gasto: 100, leadsMeta: 8 }), senal('a2', { gasto: 50, leadsMeta: 2 })], 'lead'), 15);
  assert.equal(objetivoRecomendado([senal('a1', { gasto: 100 })], 'lead'), null);
});

test('Sin objetivo (cuenta sin resultados), las tácticas que lo necesitan no corren', () => {
  const ps = proponer(entrada({ objetivo: null, larga: [senal('a1', { gasto: 500, diasCorriendo: 9 })] }), HOY);
  assert.deepEqual(ps, []);
});
