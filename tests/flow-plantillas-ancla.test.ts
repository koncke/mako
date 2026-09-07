// =============================================================================
// El respaldo protege el cuerpo que ENSEÑA, y dice qué descarta
// =============================================================================
// ⚠️ MEDIDO EN PRODUCCIÓN (06/09/2026): el respaldo de un workspace tenía CERO
// plantillas de BOQ —sólo las cinco del protocolo viejo— y `estado_detalle` decía
// `SIN_ANCLA(generar_clip)` con la sentinela intacta al lado.
//
// Dos causas, las dos del lado del server:
//
// ① `fundirPlantillas` conservaba `op` y `sentinela` y dejaba ganar por FECHA al
//    cuerpo: la siguiente generación de la misma clase, sin la frase, pisaba la
//    única que se podía parchear. La sentinela decía «esta clase enseñó» y el cuerpo
//    ya no enseñaba nada.
// ② `sanearPlantillas` descartaba por cuatro motivos distintos SIN DEJAR RASTRO.
//    Una url relativa (`/_/AiSandbox…`, que es como BOQ abre sus XHR) cae en
//    `esOrigenDeFlow` → `new URL` tira → `false` → `continue`. Nada lo dice.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  sanearPlantillas, fundirPlantillas, tieneAncla, type PlantillaEspejo,
} from '../lib/flow-plantillas';
import { codificar } from '../lib/flow-boq-patch';
import { A_PEDIR } from '../lib/flow-operaciones';

const CLIP = A_PEDIR.find((o) => o.op === 'generar_clip')!;
const BOQ = 'https://flow.google.com/_/AiSandboxAngularFrontend/data/batchexecute?rpcids=YhhmEf';

/** Un cuerpo de BOQ con la frase adentro, como lo captura el espejo. */
const conAncla = () => `f.req=%5B%5B%22${codificar(CLIP.frase!, 'form')}%22%5D%5D&at=__MAKO_AT__`;
/** El mismo pedido, con OTRO prompt: lo que manda la siguiente generación. */
const sinAncla = () => `f.req=%5B%5B%22${codificar('un perro corriendo en la playa', 'form')}%22%5D%5D&at=__MAKO_AT__`;

const plantilla = (extra: Partial<PlantillaEspejo> = {}): PlantillaEspejo => ({
  clase: 'boq:YhhmEf', url: BOQ, metodo: 'POST', headers: {},
  cuerpo: conAncla(), op: 'generar_clip', sentinela: 'form', cuando: 10,
  ...extra,
});

test('`tieneAncla` reconoce el cuerpo que enseña y rechaza el que no', () => {
  assert.equal(tieneAncla(plantilla()), true);
  assert.equal(tieneAncla(plantilla({ cuerpo: sinAncla() })), false);
  assert.equal(tieneAncla(plantilla({ cuerpo: null })), false);
  assert.equal(tieneAncla(plantilla({ op: 'creditos' })), false, 'una op sin frase no tiene ancla');
});

test('al fundir, un cuerpo CON ancla no lo pisa uno MÁS NUEVO sin ancla', () => {
  // ⚠️ ES EL CASO MEDIDO. La regla vieja era «la más nueva gana» y la nueva era la
  // generación siguiente del cliente, sin la frase.
  const vieja = plantilla({ cuando: 10 });
  const nueva = plantilla({ cuerpo: sinAncla(), sentinela: null, cuando: 99 });
  const out = fundirPlantillas([vieja], [nueva]);
  assert.equal(out.length, 1);
  assert.equal(tieneAncla(out[0]), true, 'el respaldo perdió el único cuerpo que se puede parchear');
  assert.equal(out[0].sentinela, 'form');
});

test('…y al revés, la que TRAE el ancla le gana a una vieja sin ancla', () => {
  // Es lo que repara un respaldo que quedó roto antes de esta regla: la persona
  // vuelve a generar la frase una vez, y esa entra aunque la guardada sea más nueva.
  const vieja = plantilla({ cuerpo: sinAncla(), sentinela: null, cuando: 99 });
  const nueva = plantilla({ cuando: 10 });
  const out = fundirPlantillas([vieja], [nueva]);
  assert.equal(tieneAncla(out[0]), true);
});

test('con las dos sin ancla, sigue ganando la más nueva', () => {
  const a = plantilla({ cuerpo: sinAncla(), sentinela: null, cuando: 10, url: `${BOQ}&v=a` });
  const b = plantilla({ cuerpo: sinAncla(), sentinela: null, cuando: 20, url: `${BOQ}&v=b` });
  assert.equal(fundirPlantillas([a], [b])[0].url, `${BOQ}&v=b`);
});

test('una url RELATIVA se descarta, y queda escrito POR QUÉ', () => {
  // Es como BOQ abre sus XHR. Al navegador le sirve igual; al respaldo no le llegaba
  // nunca, y nada lo decía.
  const descartes: string[] = [];
  const out = sanearPlantillas([plantilla({ url: '/_/AiSandboxAngularFrontend/data/batchexecute?rpcids=YhhmEf' })], descartes);
  assert.equal(out.length, 0);
  assert.equal(descartes.length, 1);
  assert.match(descartes[0], /^origen\(boq:YhhmEf\) \/_\/AiSandbox/);
});

test('cada motivo de descarte se nombra distinto', () => {
  const descartes: string[] = [];
  sanearPlantillas([
    plantilla({ op: undefined, clase: 'boq:YhhmEf' }),                    // sin rol
    plantilla({ url: 'https://evil.tld/x' }),                              // otro origen
    plantilla({ url: 'https://flow.google.com/otra/cosa?rpcids=YhhmEf' }), // no es batchexecute
    'basura' as unknown as PlantillaEspejo,                                // ni objeto
  ], descartes);
  assert.deepEqual(
    descartes.map((d) => d.split('(')[0]),
    ['sin_rol', 'origen', 'no_batchexecute', 'no_es_objeto'],
  );
});

test('sin colector, `sanearPlantillas` se comporta igual que antes', () => {
  // Compatibilidad: el segundo parámetro es opcional y los llamadores viejos no lo pasan.
  assert.equal(sanearPlantillas([plantilla()]).length, 1);
  assert.equal(sanearPlantillas('no' as unknown).length, 0);
});
