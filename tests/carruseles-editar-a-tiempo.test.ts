// «Editar» un carrusel termina A TIEMPO y no pierde lo escrito (19/11/2026, ticket 119).
//
// Leila (ws 11) leyó «Tu IA tardó más de 4 minutos en escribir la versión y se cortó: es la demora del proveedor». Medido en
// `anthropic_usage`: su Claude sin crédito, su `gemini-flash-latest` cortado a los 120 s, su GPT-4o escribiendo 5.400 tokens en
// 98 s y después el segundo pedido (uno por lámina) otra vez por la misma cascada; cada paso con su plazo entero, sumados más de
// los 285 s de la ruta. El diseño se guardó 3½ minutos DESPUÉS del aviso y lo volvió a pedir. Y la causa grande era nuestra: con
// el mismo pedido de 12 láminas, `gemini-flash-latest` tarda 184 s (con el pensar al mínimo; sin terminar en 240 s con el de
// siempre) y `gemini-flash-lite-latest` 27 s. Con el plazo de 120 s, el de por defecto no llegaba NUNCA.
//
// Fija:
//   1. la cascada de visión (`leerDocumentoIA`, lib/ai-cheap.ts) prueba PRIMERO el modelo que se le pide (`modelos`), y sin
//      pedirlo, el de por defecto (la causa, de testigo);
//   2. con `hastaMs`, no arranca un intento que no entra y ACOTA el que arranca a lo que queda (16 s, no 120);
//   3. los plazos de la corrida (lib/carruseles/replica-stream.ts) terminan antes del aviso de la ruta, y el segundo pedido se
//      saltea cuando no alcanza;
//   4. «sin tiempo» se avisa como demora (no como «tu Claude no tiene crédito», que también venía en la lista) y no se reintenta;
//   5. «Editar» lo usa: los tres pedidos de visión y la escritura sin láminas van con `MODELOS_REPLICA` (flash-lite), la IA
//      principal y el segundo pedido con su plazo, y la ruta pasa `hastaMs`.
//
// El 1 y el 2 corren la cascada REAL en un hijo (tests/_editar-a-tiempo-hijo.ts) contra una base y una red de mentira.
// Correr: node --import tsx --test tests/carruseles-editar-a-tiempo.test.ts

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import {
  MARGEN_DEL_AVISO_MS, MIN_SEGUNDO_PEDIDO_MS, RESERVA_PARA_ARMAR_MS, RESERVA_PARA_GUARDAR_MS,
  alcanzaParaElSegundoPedido, hastaDeLaReplica, plazosDeLaReplica,
} from '../lib/carruseles/replica-stream';
import { avisoSinIA, vuelveASinVer } from '../lib/carruseles/replica';

type Caso = { pedidos: string[]; ms: number; de?: string; tiro?: string };
let cache: Record<string, Caso> | null = null;
function hijo(): Record<string, Caso> {
  if (cache) return cache;
  const r = spawnSync(process.execPath, ['--import', 'tsx', '--conditions=react-server', fileURLToPath(new URL('./_editar-a-tiempo-hijo.ts', import.meta.url))], { encoding: 'utf8', maxBuffer: 16 * 1024 * 1024, timeout: 120_000 });
  const linea = (r.stdout ?? '').split('\n').find((l) => l.startsWith('@@A_TIEMPO@@'));
  assert.ok(linea, `el hijo no contestó (status ${r.status}): ${(r.stderr ?? '').slice(-1500)}`);
  const out = JSON.parse(linea.slice('@@A_TIEMPO@@'.length));
  assert.ok(!out.error, `el hijo tiró: ${out.error}`);
  return (cache = out);
}

test('1 · la cascada de visión prueba primero el modelo que se le pide (y sin pedirlo, el que no llegaba)', () => {
  const { conElModeloDeLaReplica: con, sinPedirModelo: sin } = hijo();
  assert.deepEqual(con.pedidos, ['gemini:gemini-flash-lite-latest'], 'con el de «Editar», un solo pedido y al rápido');
  assert.match(con.de ?? '', /flash-lite/);
  assert.ok(con.ms < 5_000, `sin esperar a nadie (${con.ms} ms)`);
  // El testigo de la causa: sin pedir modelo, el de por defecto va primero y hay que esperar su plazo entero.
  assert.deepEqual(sin.pedidos, ['gemini:gemini-flash-latest', 'gemini:gemini-flash-lite-latest']);
  assert.ok(sin.ms >= 1_400, `esperó el plazo del que no contesta (${sin.ms} ms)`);
});

test('2 · con el plazo de la corrida, no arranca lo que no entra y corta lo que arrancó', () => {
  const { sinTiempoParaArrancar: ya, elPlazoAcotaElIntento: acota } = hijo();
  assert.deepEqual(ya.pedidos, [], 'con 5 s no se arranca ningún intento (gasta la cuota y vuelve con un timeout)');
  assert.match(ya.tiro ?? '', /sin tiempo/);
  assert.deepEqual(acota.pedidos, ['gemini:gemini-flash-latest'], 'después del corte no queda para otro');
  assert.ok(acota.ms >= 15_000 && acota.ms < 30_000, `cortado por el plazo de la corrida (~16 s), no por los 120 s del intento (${acota.ms} ms)`);
  assert.match(acota.tiro ?? '', /sin tiempo/);
});

test('3 · los plazos de la corrida terminan antes del aviso de la ruta, y el segundo pedido se saltea si no alcanza', () => {
  const inicio = 1_000_000;
  const AVISO = 285_000; // app/api/image-editor/carruseles/replicar/route.ts: 15 s antes de su maxDuration de 300
  const hasta = hastaDeLaReplica(inicio, AVISO);
  assert.equal(hasta, inicio + AVISO - MARGEN_DEL_AVISO_MS);
  const p = plazosDeLaReplica(hasta);
  assert.ok(p.escribir < p.completar && p.completar < hasta && hasta < inicio + AVISO, 'escribir < segundo pedido < guardar < aviso');
  assert.equal(p.escribir, hasta - RESERVA_PARA_ARMAR_MS);
  assert.equal(p.completar, hasta - RESERVA_PARA_GUARDAR_MS);
  assert.ok(p.escribir - inicio >= 200_000, `a la IA principal le quedan más de 3 minutos (${(p.escribir - inicio) / 1000} s)`);
  assert.equal(alcanzaParaElSegundoPedido(p.completar, p.completar - MIN_SEGUNDO_PEDIDO_MS), true);
  assert.equal(alcanzaParaElSegundoPedido(p.completar, p.completar - MIN_SEGUNDO_PEDIDO_MS + 1), false);
});

test('4 · «sin tiempo» se avisa como demora y no se vuelve a pedir', () => {
  // Lo que tira la cascada de Leila con el plazo: su Claude sin crédito ANTES, y después el corte.
  const error = 'No se pudo leer el documento con ninguna IA. anthropic/ANTHROPIC_API_KEY: Your credit balance is too low · gemini · cuenta 1: The operation was aborted due to timeout · sin tiempo: el plazo del pedido vence en 3 s';
  const a = avisoSinIA(error);
  assert.match(a.aviso, /^Tu IA no alcanzó a escribir tu versión a tiempo/);
  assert.match(a.aviso, /Vuelve a intentar/);
  assert.doesNotMatch(a.aviso, /no tiene cuota/);
  assert.match(avisoSinIA(error, 'Leila').aviso, /^La IA de Leila no alcanzó a escribir su versión/);
  assert.equal(vuelveASinVer(error), false, 'otro pedido no entra en el plazo');
  // Lo de antes sigue igual.
  assert.match(avisoSinIA('anthropic: HTTP 429 rate_limit_error').aviso, /no tiene cuota/);
});

test('5 · «Editar» va con el modelo rápido y con el plazo de la corrida', () => {
  const servidor = readFileSync(new URL('../lib/carruseles/replica-servidor.ts', import.meta.url), 'utf8');
  assert.match(servidor, /const MODELOS_REPLICA = \{ gemini: GEMINI_FLASH_LITE \} as const;/);
  // Los cuatro pedidos de visión (la IA principal, la lámina que faltó, el segundo pedido, la lectura del guiado) y la escritura
  // sin láminas.
  assert.equal((servidor.match(/leerDocumentoIA\(\{/g) ?? []).length, 4, 'son cuatro pedidos de visión');
  assert.equal((servidor.match(/modelos: MODELOS_REPLICA/g) ?? []).length, 5, 'los cinco pedidos de «Editar» con flash-lite');
  assert.equal((servidor.match(/hastaMs: plazos\.escribir/g) ?? []).length, 3, 'la IA principal (con y sin láminas) y la lámina que faltó, con su plazo');
  assert.match(servidor, /hastaMs: plazos\.completar/);
  assert.match(servidor, /if \(plazos && !alcanzaParaElSegundoPedido\(plazos\.completar\)\)/);
  const ruta = readFileSync(new URL('../app/api/image-editor/carruseles/replicar/route.ts', import.meta.url), 'utf8');
  assert.match(ruta, /const hastaMs = hastaDeLaReplica\(Date\.now\(\), AVISO_ANTES_DEL_TOPE_MS\);/);
  assert.match(ruta, /replicarEjemplo\(p\.ws, p\.quien, ejemplo, \{[^}]*hastaMs \}\)/);
});
