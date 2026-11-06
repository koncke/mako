// El RELEVO del Media Buyer (dentro de la táctica Ganador): cuando una variación le gana a su original, se propone pausar el
// original. Lo prometido a la agencia de Thiago (docs/promesas/2910-llamada-thiago.md, [33:00]). Corre el motor de verdad
// (`proponer`) sobre una cuenta armada a mano, como tests/media-buyer-motor.test.ts.
//
// Lo que fija: que propone cuando la variación gana con su semana entera, sus resultados, dentro del objetivo y con margen; que
// NO propone sin cada una de esas condiciones, con la variación apagada, con la táctica apagada, ni sobre un «no» de la persona;
// que Revive no vuelve a prender lo que pausó el Relevo; y que la corrida y el vigía le pasan al motor los anuncios creados.
//
// Probado rompiéndolo (6/11/2026), base 15/0, cada guarda de `relevos` (motor.ts) sacada por separado:
//   · la semana entera (`edad >= dias`) → 1 fallo, 14 pases;      · la variación prendida → 1 fallo, 14 pases;
//   · el margen (`kv <= ko * (1 - margen)`) → 2 fallos, 13 pases;  · dentro del objetivo (`kv <= obj`) → 1 fallo, 14 pases;
//   · los resultados mínimos → 1 fallo, 14 pases;                  · el «no» de la persona (`yaDecidido`) → 1 fallo, 14 pases;
//   · Revive sin saltear `ganador` → 1 fallo, 14 pases;            · Ganador sin mirar `tomadas` → 1 fallo, 14 pases.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { proponer, previaDeDecision, type EntradaMotor, type NodoMB, type SenalMB, type DecisionPrevia } from '../lib/media-buyer/motor';
import { resolverTacticas } from '../lib/media-buyer/tacticas';
import { CONFIG_POR_DEFECTO, type Decision } from '../lib/media-buyer/tipos';

const AHORA = Date.parse('2026-11-06T15:00:00Z');
const HOY = '2026-11-06';
const VIEJA = '2026-09-01T00:00:00Z';
const HACE = (dias: number) => new Date(AHORA - dias * 24 * 3600_000).toISOString();

const nodo = (id: string, nivel: NodoMB['nivel'], parentId: string | null, x: Partial<NodoMB> = {}): NodoMB => ({
  id, nombre: id, nivel, parentId, configurado: 'ACTIVE', entrega: 'ACTIVE', presupuestoDia: null, nivelPresupuesto: null, creada: VIEJA, ...x,
});
const senal = (adId: string, x: Partial<SenalMB> = {}): SenalMB => ({
  adId, gasto: 0, leadsMeta: 0, leadsCrm: 0, agendasMeta: 0, agendasCrm: 0, cierres: 0, caja: 0, impresiones: 1000, frecuencia: 1.2, diasCorriendo: 7, esVideo: false, miniatura: null, ...x,
});

/** Un conjunto con el original (orig) y la variación que salió de él (var1). */
const arbol = (x: { variacion?: Partial<NodoMB> } = {}): NodoMB[] => [
  nodo('c1', 'campaign', null, { nivelPresupuesto: 'adset' }),
  nodo('s1', 'adset', 'c1', { presupuestoDia: 50, nivelPresupuesto: 'adset' }),
  nodo('orig', 'ad', 's1'),
  nodo('var1', 'ad', 's1', { creada: HACE(9), ...(x.variacion ?? {}) }),
];

/** La decisión de variaciones que creó var1 a partir de orig, lanzada hace `dias`. */
const lanzada = (dias: number, x: Partial<DecisionPrevia> = {}): DecisionPrevia => ({
  tipo: 'variaciones_texto', tactica: 'ganador', nivel: 'ad', entidadId: 'orig', estado: 'aplicada',
  creada: HACE(dias + 1), aplicadaAt: HACE(dias), origen: 'persona', creados: ['var1'], anuncioBaseId: 'orig', ...x,
});

function entrada(x: Partial<EntradaMotor> = {}): EntradaMotor {
  return {
    ahora: AHORA,
    config: { ...CONFIG_POR_DEFECTO, encendido: true },
    objetivo: 15,
    arbol: arbol(),
    corta: [], crm: [],
    // El original: 5 leads a 20; la variación: 4 leads a 10 (le gana por 50%, dentro del objetivo de 15).
    larga: [senal('orig', { gasto: 100, leadsMeta: 5 }), senal('var1', { gasto: 40, leadsMeta: 4 })],
    historial: [lanzada(8)],
    aUnidad: (m) => m, fmt: (u) => `US$ ${u.toFixed(2)}`, presupuestoMinimo: 5,
    ...x,
  };
}

const relevo = (e: EntradaMotor) => proponer(e, HOY).find((p) => p.tipo === 'pausar' && p.tactica === 'ganador');

test('la variación le gana a su original con su semana entera: se propone pausar el ORIGINAL', () => {
  const p = relevo(entrada());
  assert.ok(p, 'propone el relevo');
  assert.equal(p.entidadId, 'orig');
  assert.equal(p.nivel, 'ad');
  assert.deepEqual(p.antes, { estado: 'ACTIVE' });
  assert.deepEqual(p.despues, { estado: 'PAUSED' });
  assert.match(p.titulo, /original «orig».*«var1» le gana/);
  assert.ok(p.numeros.some((n) => n.valor === 'US$ 20.00'), 'el costo del original');
  assert.ok(p.numeros.some((n) => n.valor === 'US$ 10.00'), 'el costo de la variación');
  assert.match(p.clave, /^ganador-relevo:ad:orig:2026-11-06$/, 'una clave propia: no choca con las variaciones del mismo anuncio');
});

test('con menos de 7 días desde que salió la variación, no se compara (la ventana todavía tiene días del original solo)', () => {
  assert.equal(relevo(entrada({ historial: [lanzada(5)] })), undefined);
});

test('la variación apagada no releva a nadie: pausar el original dejaría el conjunto sin nada que entregue', () => {
  assert.equal(relevo(entrada({ arbol: arbol({ variacion: { configurado: 'PAUSED' } }) })), undefined);
});

test('la variación tiene que estar dentro del objetivo: menos mala no alcanza', () => {
  // Las dos por encima de 15: la variación (18) es más barata que el original (40), pero no es buena.
  assert.equal(relevo(entrada({ larga: [senal('orig', { gasto: 200, leadsMeta: 5 }), senal('var1', { gasto: 72, leadsMeta: 4 })] })), undefined);
});

test('sin el margen no gana: 18 contra 20 es ruido con un objetivo de 30', () => {
  assert.equal(relevo(entrada({ objetivo: 30, larga: [senal('orig', { gasto: 100, leadsMeta: 5 }), senal('var1', { gasto: 72, leadsMeta: 4 })] })), undefined);
});

test('pocos resultados de la variación no alcanzan (2 leads pueden ser suerte)', () => {
  assert.equal(relevo(entrada({ larga: [senal('orig', { gasto: 100, leadsMeta: 5 }), senal('var1', { gasto: 16, leadsMeta: 2 })] })), undefined);
});

test('el original que gastó un objetivo entero sin resultados pierde contra una variación que convierte', () => {
  // 20 gastados: un objetivo entero, y menos que los 2 del Stop Loss (con 30 lo pausaría el Stop Loss primero, que gana el lugar).
  const p = relevo(entrada({ larga: [senal('orig', { gasto: 20, leadsMeta: 0 }), senal('var1', { gasto: 40, leadsMeta: 4 })] }));
  assert.ok(p, 'propone');
  assert.ok(p.numeros.some((n) => n.valor === 'sin leads'));
});

test('con la táctica Ganador apagada no hay relevo', () => {
  const e = entrada({ tacticas: resolverTacticas({ ganador: { estado: 'apagada' } }, { piloto: false, pilotoPermitido: true }) });
  assert.equal(relevo(e), undefined);
});

test('los umbrales del relevo se editan en la táctica: con 30% de margen, 25% no gana', () => {
  // orig 20, var1 15 → 25% más barato.
  const larga = [senal('orig', { gasto: 100, leadsMeta: 5 }), senal('var1', { gasto: 60, leadsMeta: 4 })];
  assert.ok(relevo(entrada({ larga })), 'con el 20% recomendado, gana');
  const e = entrada({ larga, tacticas: resolverTacticas({ ganador: { parametros: { relevoMargenPct: 30 } } }, { piloto: false, pilotoPermitido: true }) });
  assert.equal(relevo(e), undefined);
});

test('lo que la persona ya decidió sobre ese lanzamiento (descartado, deshecho) no se vuelve a proponer cada mañana', () => {
  const no = { tipo: 'pausar' as const, tactica: 'ganador' as const, nivel: 'ad' as const, entidadId: 'orig', creada: HACE(1), aplicadaAt: null, origen: null };
  assert.equal(relevo(entrada({ historial: [lanzada(8), { ...no, estado: 'descartada' }] })), undefined);
  assert.equal(relevo(entrada({ historial: [lanzada(8), { ...no, estado: 'deshecha', aplicadaAt: HACE(1) }] })), undefined);
  // Un «no» sobre un lanzamiento ANTERIOR no frena el de ahora.
  assert.ok(relevo(entrada({ historial: [lanzada(8), { ...no, estado: 'descartada', creada: HACE(20) }] })));
});

test('un creativo subido contra un anuncio (crear_anuncios con su original) también lo releva; sin original, no', () => {
  const subida = (x: Partial<DecisionPrevia>) => lanzada(8, { tipo: 'crear_anuncios', tactica: 'manual', nivel: 'adset', entidadId: 's1', ...x });
  assert.ok(relevo(entrada({ historial: [subida({ anuncioBaseId: 'orig' })] })), 'con el original');
  assert.equal(relevo(entrada({ historial: [subida({ anuncioBaseId: null })] })), undefined, 'una subida suelta no tiene contra quién');
});

test('Revive NO vuelve a prender lo que pausó el Relevo (Stop Loss sí: es el control)', () => {
  const pausa = (tactica: DecisionPrevia['tactica']): DecisionPrevia => ({
    tipo: 'pausar', tactica, nivel: 'ad', entidadId: 'orig', estado: 'aplicada', creada: HACE(3), aplicadaAt: HACE(2), origen: 'piloto',
  });
  const base = {
    arbol: arbol().map((n) => (n.id === 'orig' ? { ...n, configurado: 'PAUSED' } : n)),
    crm: [senal('orig', { gasto: 50, leadsCrm: 5 })], // 10 por lead: dentro del objetivo
    larga: [],
  };
  const prende = (tactica: DecisionPrevia['tactica']) => proponer(entrada({ ...base, historial: [pausa(tactica)] }), HOY)
    .some((p) => p.tipo === 'activar' && p.entidadId === 'orig');
  assert.equal(prende('stop_loss'), true, 'control: Revive prende lo que pausó el Stop Loss');
  assert.equal(prende('ganador'), false, 'lo que pausó el Relevo se queda pausado');
});

test('el mismo día no se piden variaciones nuevas del original que se propone pausar', () => {
  // El original con números de ganador (3 leads a 10) y su variación todavía mejor (4 a 5).
  const ps = proponer(entrada({ larga: [senal('orig', { gasto: 30, leadsMeta: 3 }), senal('var1', { gasto: 20, leadsMeta: 4 })] }), HOY);
  assert.ok(ps.some((p) => p.tipo === 'pausar' && p.entidadId === 'orig'), 'el relevo');
  assert.equal(ps.some((p) => p.tipo.startsWith('variaciones') && p.entidadId === 'orig'), false);
});

test('previaDeDecision le pasa al motor los anuncios creados y el original', () => {
  const d = {
    tipo: 'variaciones_hook', tactica: 'ganador', nivel: 'ad', entidadId: 'orig', estado: 'aplicada', creada: HACE(9), aplicadaAt: HACE(8),
    origen: 'persona', creados: ['var1', 'var2'], anuncioBase: { id: 'orig', esVideo: true, miniatura: null },
  } as unknown as Decision;
  const p = previaDeDecision(d);
  assert.deepEqual(p.creados, ['var1', 'var2']);
  assert.equal(p.anuncioBaseId, 'orig');
});

test('la corrida diaria y el vigía usan la MISMA función para armar el historial', async () => {
  const { readFileSync } = await import('node:fs');
  for (const f of ['lib/media-buyer/corrida.ts', 'lib/media-buyer/vigia.ts']) {
    const src = readFileSync(f, 'utf8').replace(/\r\n/g, '\n');
    assert.match(src, /const previa = previaDeDecision;/, `${f}: sin esto el Relevo no ve los anuncios creados`);
  }
});
