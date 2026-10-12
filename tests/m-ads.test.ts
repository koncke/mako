// =============================================================================
// MaKo Mobile — las reglas puras de Ads Manager en el teléfono (app/m/ads/modelo.ts)
// =============================================================================
// Fija lo que se rompe sin un solo error:
//   · los períodos terminan AYER (la pauta llega por el cron del día siguiente: «hoy» sería US$0);
//   · la plata se escribe como el Dashboard (centavos sólo donde dicen algo) y en la moneda cruda
//     cuando el código no tiene tasa;
//   · el +/− del presupuesto: múltiplos del paso, nunca menos de 1, y «cambia» comparando lo
//     TIPEADO (500 MXN se ven como 29 y no abren un cambio a 502);
//   · la cascada de activar una campaña: sus conjuntos y anuncios que NO están activos, nunca lo
//     archivado, nunca lo de otra campaña;
//   · «Con problemas · N» hereda del anuncio a su campaña (el rollup de escritorio);
//   · el gasto por campaña se agrupa por NOMBRE, como la tabla de escritorio.
//
// Verificado ROMPIÉNDOLO (11/10/2026), cada rotura contra la base en verde (9/9), restaurando
// el archivo entero después de cada una (scratchpad/ads/romper.cjs):
//   · rangoAds('ayer') terminando HOY: 1 fallo, 8 pases.
//   · hijosParaActivar reescribiendo los conjuntos ya activos: 1 fallo, 8 pases.
//   · hijosParaActivar activando anuncios borrados: 1 fallo, 8 pases.
//   · pasoSiguiente bajando a 0: 1 fallo, 8 pases.
//   · cambioPresupuesto comparando en la moneda de la cuenta (500 MXN → «cambio» a 502): 1 fallo, 8 pases.
//   · el rollup contando el ámbar (en revisión) como «con problemas»: 1 fallo, 8 pases.
//   · estadoTexto diciendo «En pausa» para toda campaña apagada: 1 fallo, 8 pases.
//   · dinero siempre con centavos: 2 fallos, 7 pases.
// =============================================================================

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  agendasTexto, anunciosEnRojoPorCampana, avisoDeFallo, cambioPresupuesto, deshacerPausaLaCampana, dinero, estaArchivada, estadoTexto, hijosParaActivar,
  pasoDe, pasoSiguiente, perfPorCampana, periodoAdsDeParam, rangoAds, textoDiario, tipeado,
} from '../app/m/ads/modelo';

test('los períodos terminan ayer: Ayer, los 7 días completos y el mes hasta ayer', () => {
  assert.deepEqual(rangoAds('ayer', '2026-10-11'), { desde: '2026-10-10', hasta: '2026-10-10' });
  assert.deepEqual(rangoAds('7d', '2026-10-11'), { desde: '2026-10-04', hasta: '2026-10-10' });
  assert.deepEqual(rangoAds('mes', '2026-10-11'), { desde: '2026-10-01', hasta: '2026-10-10' });
  // El 1 del mes, «Este mes» es el mes que terminó ayer (el default de escritorio hace lo mismo).
  assert.deepEqual(rangoAds('mes', '2026-11-01'), { desde: '2026-10-01', hasta: '2026-10-31' });
  assert.equal(periodoAdsDeParam('7d').id, '7d');
  assert.equal(periodoAdsDeParam(['mes']).id, 'mes');
  assert.equal(periodoAdsDeParam('hoy').id, 'ayer', 'un período que la pantalla no ofrece cae al de entrada');
  assert.equal(periodoAdsDeParam(undefined).id, 'ayer');
});

test('la plata: centavos sólo donde dicen algo, y la moneda cruda sin tasa', () => {
  assert.equal(dinero(92.2, 'USD'), 'US$92,20');
  assert.equal(dinero(80, 'USD'), 'US$80');
  assert.equal(dinero(2480, 'USD'), 'US$2.480');
  assert.equal(dinero(50000, 'ARS'), '50.000 ARS');
  assert.equal(dinero(null, 'USD'), '—');
  assert.equal(agendasTexto(1), '1 agenda');
  assert.equal(agendasTexto(13), '13 agendas');
});

test('el +/− va en múltiplos del paso y nunca baja de 1', () => {
  assert.equal(pasoSiguiente(60, 5, 1), 65);
  assert.equal(pasoSiguiente(62, 5, 1), 65);
  assert.equal(pasoSiguiente(62, 5, -1), 60);
  assert.equal(pasoSiguiente(60, 5, -1), 55);
  assert.equal(pasoSiguiente(3, 5, -1), 1);
  assert.equal(pasoSiguiente(1, 5, -1), 1);
  assert.equal(pasoDe(60, 'USD'), 5);
  assert.equal(pasoDe(29, 'MXN'), 5, 'con tasa, el paso es en dólares');
  assert.equal(pasoDe(50000, 'ARS'), 3000, 'sin tasa, el 5 % redondeado a una cifra');
});

test('el presupuesto se tipea en dólares y viaja en la moneda de la cuenta', () => {
  // USD: lo tipeado es lo que viaja.
  const usd = cambioPresupuesto(70, 60, 'USD');
  assert.equal(usd.cambia, true);
  assert.equal(usd.nuevoCuenta, 70);
  assert.equal(usd.boton, 'Poner US$70/día');
  assert.equal(usd.consecuencia, 'Meta empieza a gastar el monto nuevo hoy.');
  // MXN: 500 MXN se ven como 29 dólares; dejar 29 NO es un cambio a 502.
  assert.equal(tipeado(500, 'MXN'), 29);
  assert.equal(cambioPresupuesto(29, 500, 'MXN').cambia, false);
  const mxn = cambioPresupuesto(30, 500, 'MXN');
  assert.equal(mxn.cambia, true);
  assert.equal(mxn.nuevoCuenta, 519);
  assert.match(mxn.consecuencia, /519 MXN al día/);
  // Sin tasa: el monto va crudo, en su moneda.
  assert.equal(cambioPresupuesto(52000, 50000, 'ARS').nuevoCuenta, 52000);
  assert.equal(textoDiario(50000, 'ARS'), '50.000 ARS/día');
  // El salto ×5, en las dos direcciones.
  assert.match(cambioPresupuesto(300, 60, 'USD').consecuencia, /Es 5 veces el actual\./);
  assert.match(cambioPresupuesto(10, 60, 'USD').consecuencia, /Es 6 veces menos que el actual\./);
  assert.doesNotMatch(cambioPresupuesto(65, 60, 'USD').consecuencia, /veces/);
});

const N = (id: string, parentId: string | null, extra: Partial<{ semaforo: 'verde' | 'rojo' | 'ambar' | 'gris'; effectiveStatus: string; configuredStatus: string | null }> = {}) => ({
  id, parentId, semaforo: 'verde' as const, effectiveStatus: 'ACTIVE', configuredStatus: 'ACTIVE', ...extra,
});

test('activar una campaña prende sus hijos apagados, y nada más', () => {
  const adsets = [
    N('s1', 'c1', { configuredStatus: 'PAUSED', effectiveStatus: 'PAUSED' }),
    N('s2', 'c1'),
    N('s3', 'c1', { configuredStatus: 'PAUSED', effectiveStatus: 'ARCHIVED' }),
    N('s9', 'c2', { configuredStatus: 'PAUSED', effectiveStatus: 'PAUSED' }),
  ];
  const ads = [
    N('a1', 's1', { configuredStatus: 'PAUSED', effectiveStatus: 'PAUSED' }),
    N('a2', 's2'),
    N('a3', 's2', { configuredStatus: null, effectiveStatus: 'CAMPAIGN_PAUSED' }),
    N('a4', 's2', { configuredStatus: 'PAUSED', effectiveStatus: 'DELETED' }),
    N('a9', 's9', { configuredStatus: 'PAUSED', effectiveStatus: 'PAUSED' }),
  ];
  assert.deepEqual(hijosParaActivar('c1', adsets, ads), [
    { nivel: 'adset', id: 's1' },
    { nivel: 'ad', id: 'a1' },
    { nivel: 'ad', id: 'a3' },
  ]);
  assert.deepEqual(hijosParaActivar('c3', adsets, ads), []);
});

test('«Con problemas · N» sube del anuncio a su campaña', () => {
  const adsets = [N('s1', 'c1'), N('s2', 'c1'), N('s3', 'c2')];
  const ads = [
    N('a1', 's1', { semaforo: 'rojo' }),
    N('a2', 's2', { semaforo: 'rojo' }),
    N('a3', 's2'),
    N('a4', 's3', { semaforo: 'ambar' }),
    N('a5', 'sX', { semaforo: 'rojo' }),
  ];
  const r = anunciosEnRojoPorCampana(adsets, ads);
  assert.deepEqual(r.get('c1')?.map((a) => a.id), ['a1', 'a2']);
  assert.equal(r.has('c2'), false, 'en revisión (ámbar) no es «con problemas»');
  assert.equal(r.size, 1, 'un anuncio de un conjunto que no está en el árbol no se le cuelga a nadie');
});

test('el gasto por campaña se agrupa por nombre, como la tabla de escritorio', () => {
  const m = perfPorCampana([
    { campana: 'Clase gratis', spend_usd: 10.5, agendas: 2 },
    { campana: 'Clase gratis', spend_usd: 4.5, agendas: 1 },
    { campana: 'Remarketing', spend_usd: 3, agendas: 0 },
    { campana: null, spend_usd: 1, agendas: 0 },
  ]);
  assert.deepEqual(m.get('Clase gratis'), { gasto: 15, agendas: 3 });
  assert.deepEqual(m.get('Remarketing'), { gasto: 3, agendas: 0 });
  assert.deepEqual(m.get('—'), { gasto: 1, agendas: 0 });
});

test('el aviso de una escritura rechazada es corto y dice de quién fue', () => {
  assert.equal(avisoDeFallo(403, { error_subcode: 4841013 }), 'Meta bloqueó el cambio');
  assert.equal(avisoDeFallo(403, { error: 'Ads Manager lo maneja quien administra…' }), 'Sin permiso para cambiarla');
  assert.equal(avisoDeFallo(409, {}), 'Meta no está conectado');
  assert.equal(avisoDeFallo(502, null), 'Meta lo rechazó');
  for (const a of ['Meta bloqueó el cambio', 'Sin permiso para cambiarla', 'Meta no está conectado', 'Meta lo rechazó']) {
    assert.ok(a.split(' ').length <= 4, `«${a}»: un toast tiene 3-4 palabras`);
  }
});

test('la línea de una campaña apagada dice cómo está, no «En pausa» para todo', () => {
  assert.equal(estadoTexto('PAUSED', 'Pausado'), 'En pausa');
  assert.equal(estadoTexto('IN_PROCESS', 'Procesando'), 'Procesando', 'una campaña procesándose no está en pausa');
  assert.equal(estadoTexto('ARCHIVED', 'Archivado'), 'Archivada');
  assert.equal(estaArchivada('ARCHIVED'), true);
  assert.equal(estaArchivada('DELETED'), true);
  assert.equal(estaArchivada('PAUSED'), false, 'una pausada se puede prender');
});

// ── «Deshacer» una activación (hallazgo del 12/10/2026) ─────────────────────────────────────────
// Una campaña en revisión (configuredStatus ACTIVE, effectiveStatus IN_PROCESS o WITH_ISSUES) sale con el
// interruptor APAGADO. Prenderla no le cambia nada a Meta; el «Deshacer» le mandaba PAUSED igual y la
// dejaba sin entregar cuando Meta terminara la revisión. Nada avisaba: Meta acepta el PAUSED.

const codigo = (r: string) => readFileSync(join(__dirname, '..', ...r.split('/')), 'utf8')
  .replace(/\r\n/g, '\n').replace(/^[ \t]*\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '');
const tramo = (src: string, desde: string, hasta: string) => {
  const i = src.indexOf(desde);
  assert.ok(i >= 0, `no está «${desde}»`);
  const j = src.indexOf(hasta, i + desde.length);
  assert.ok(j > i, `no está el cierre «${hasta}»`);
  return src.slice(i, j);
};

test('⚠️ «Deshacer» una activación pausa la campaña sólo si antes no estaba configurada activa', () => {
  // En revisión: el interruptor apagado, pero configurada ACTIVE → no se pausa.
  assert.equal(deshacerPausaLaCampana(true, undefined), false, 'pausa una campaña que ya estaba configurada activa');
  // Pausada de verdad → se pausa (vuelve a como estaba).
  assert.equal(deshacerPausaLaCampana(false, undefined), true);
  // Lo último que escribió ESTA pantalla manda sobre el árbol cargado, que puede ser de antes de esa escritura.
  assert.equal(deshacerPausaLaCampana(true, { valor: 0 }), true, 'la pausó esta pantalla: el árbol dice ACTIVE porque es viejo');
  assert.equal(deshacerPausaLaCampana(false, { valor: 1 }), false);
});

test('⚠️ el Deshacer de la pantalla usa esa regla, leída ANTES del toque, y sin pausarla no le escribe a la campaña', () => {
  const src = codigo('app/m/ads/AdsM.tsx');
  const cambiar = tramo(src, 'async function cambiarEstado(', 'async function apagarSoloHijos(');
  const iRegla = cambiar.indexOf('deshacerPausaLaCampana(c.configuradaActiva, previo)');
  assert.ok(iRegla > 0, 'el Deshacer no mira cómo estaba configurada');
  assert.ok(iRegla < cambiar.indexOf('escritosEstado.current.set(c.id, mio)'), '«antes del toque» se leyó después de anotar el toque');
  assert.match(cambiar, /else if \(pausarAlDeshacer\) void cambiarEstado\(c, false, hechos, false\);\s*else void apagarSoloHijos\(c, previo, hechos\);/);
  const solo = tramo(src, 'async function apagarSoloHijos(', 'async function ponerPresupuesto(');
  assert.doesNotMatch(solo, /level: 'campaign'/, 'el Deshacer sin pausa le escribe a la campaña');
  assert.match(solo, /status: 'PAUSED'/);
  // El dato baja del árbol de Meta: lo CONFIGURADO, no el estado efectivo.
  assert.match(codigo('app/m/ads/datos.ts'), /configuradaActiva: c\.configuredStatus === 'ACTIVE',/);
});
