// El Media Buyer según el plan (el Cerebro, 25/10/2026): MaKo Esencial lo trae en «propone», con 2 recomendaciones por día y
// sin piloto automático; Pro, entero, con el piloto opcional y apagado de entrada. El número sale de la tabla de Planes
// (lib/topes-plan.ts), nunca escrito en el Media Buyer.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { cupoDelPlan, modoEfectivo, ordenDelCupo, recomendadasHoy } from '../lib/media-buyer/plan';
import { TOPES, topeDe } from '../lib/topes-plan';

const raiz = join(import.meta.dirname, '..');
const leer = (r: string) => readFileSync(join(raiz, r), 'utf8');

test('Esencial: 2 recomendaciones por día y sin piloto automático, leído de la tabla de topes', () => {
  assert.equal(topeDe('completo', 'ads.recomendaciones_dia'), 2);
  assert.deepEqual(cupoDelPlan(true), { recomendacionesDia: 2, piloto: false });
});

test('Pro, el ws1, la plataforma y los acuerdos a mano: sin tope y con el piloto disponible', () => {
  assert.equal(TOPES.agencia['ads.recomendaciones_dia'], null);
  assert.deepEqual(cupoDelPlan(false), { recomendacionesDia: null, piloto: true });
});

test('con un plan sin piloto, el modo que vale es «propone» aunque haya quedado guardado el piloto', () => {
  assert.equal(modoEfectivo('piloto', cupoDelPlan(true)), 'propone');
  assert.equal(modoEfectivo('piloto', cupoDelPlan(false)), 'piloto');
  assert.equal(modoEfectivo('propone', cupoDelPlan(false)), 'propone');
});

test('con el cupo, entra primero lo que cuida la plata y se descuenta lo ya recomendado hoy', () => {
  const nuevas = [{ tactica: 'surf' as const }, { tactica: 'ganador' as const }, { tactica: 'stop_loss' as const }];
  const { orden, lugares } = ordenDelCupo(nuevas, 1, 2);
  assert.deepEqual(orden.map((x) => x.tactica), ['stop_loss', 'surf', 'ganador']);
  assert.equal(lugares, 1);
  assert.equal(ordenDelCupo(nuevas, 5, 2).lugares, 0);
  assert.equal(ordenDelCupo(nuevas, 5, null).lugares, Infinity);
});

test('«recomendadas hoy» cuenta las claves del día del agente, no las de ayer ni las subidas a mano', () => {
  const hoy = '2026-10-25';
  assert.equal(recomendadasHoy([
    { clave: `surf:adset:1:${hoy}`, tactica: 'surf' },
    { clave: `stop_loss:ad:2:${hoy}`, tactica: 'stop_loss' },
    { clave: 'surf:adset:1:2026-10-24', tactica: 'surf' },
    { clave: `subir:123:${hoy}`, tactica: 'manual' },
  ], hoy), 2);
});

test('el cableado: la corrida lanza sólo con el modo que vale y mira el cupo ANTES de gastar IA en variaciones', () => {
  const corrida = leer('lib/media-buyer/corrida.ts');
  assert.match(corrida, /const enPiloto = modoEfectivo\(config\.modo, cupo\) === 'piloto'/);
  assert.doesNotMatch(corrida, /config\.modo === 'piloto'/, 'el piloto se decide con modoEfectivo, nunca con el modo guardado');
  const bucle = corrida.slice(corrida.indexOf('for (const p of orden)'));
  assert.ok(bucle.indexOf('if (quedan <= 0)') >= 0 && bucle.indexOf('if (quedan <= 0)') < bucle.indexOf('prepararVariaciones('),
    'lo que no entra en el cupo no llama a la IA');
});

test('el cableado: guardar la configuración es la puerta del piloto, y la pantalla y la API muestran el modo que vale', () => {
  const store = leer('lib/media-buyer/store.ts');
  assert.match(store, /if \(v\.fila\.modo === 'piloto' && !\(await cupoDe\(ws\)\)\.piloto\) throw new PlanSinPiloto\(\)/);
  for (const r of ['app/api/media-buyer/route.ts', 'app/ads-manager/page.tsx', 'app/m/ads/page.tsx', 'lib/api-mako/areas/ads.run.ts']) {
    assert.match(leer(r), /modoEfectivo(MB)?\(/, `${r} muestra el modo que vale`);
  }
  // El número no se escribe en el Media Buyer: sale de la tabla de topes de Planes.
  assert.doesNotMatch(leer('lib/media-buyer/plan.ts'), /recomendacionesDia:\s*\d/);
});
