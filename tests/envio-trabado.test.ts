// =============================================================================
// Un envío trabado por un ajuste del negocio SE AVISA, y el resto no (9/11/2026)
// =============================================================================
// Tickets #63 y #64 de Leandro: nueve días con los envíos trabados por `not_thread_owner` y el
// único que lo notó fue el cliente. El motor reintentaba —bien— pero en silencio, y mientras tanto
// se vencía la ventana de 24 h de cada lead. 17 de 19 quedaron inalcanzables.
//
// Lo que se prueba acá es el criterio, que es donde está el riesgo: avisar de MÁS es peor que no
// avisar —el negocio apaga la notificación— y la clave de dedup decide si son 1 aviso o 100.
//
// Correr: node --import tsx --test tests/envio-trabado.test.ts
// ROTURAS (9/11/2026, una por vez y restaurada; base 7 / 0):
//   · avisar también cuando la causa es null (todo fallo avisa)   → 6 / 1
//   · meter el lead en la dedupKey                                → 6 / 1
//   · dejar la dedupKey sin el canal                              → 6 / 1
//   · devolver el id crudo de Meta en el contexto                 → 6 / 1
//   · TTL en 0 (sin espaciado: un aviso por intento)              → 6 / 1
//   · el aviso no está en el catálogo                             → 6 / 1
//   · sacar `causaDelNegocio` del catch del DM                    → 8 / 1
//   · no emitir el aviso en el motor                              → 8 / 1
//   · el envoltorio sin `catch` (un aviso roto tumba la corrida)  → 8 / 1
// =============================================================================

import test from 'node:test';
import assert from 'node:assert/strict';
import { avisoDeEnvioTrabado, TTL_AVISO_TRABADO_MIN } from '../lib/envio-trabado';
import { CATALOGO_AVISOS } from '../lib/avisos-catalogo';
import { readFileSync } from 'node:fs';

const leer = (f: string): string => readFileSync(new URL(`../${f}`, import.meta.url), 'utf8');

test('la causa del negocio avisa', () => {
  const a = avisoDeEnvioTrabado('otra_app', 'Instagram');
  assert.ok(a, 'otra_app tiene que avisar: es lo único que el negocio puede destrabar');
  assert.equal(a.id, 'envio-trabado-otra-app');
});

test('lo que el negocio no puede arreglar NO avisa', () => {
  // La ventana cerrada, la respuesta privada gastada, el lead que nunca escribió: llegan sin causa.
  assert.equal(avisoDeEnvioTrabado(null, 'Instagram'), null);
  assert.equal(avisoDeEnvioTrabado(undefined, 'Instagram'), null);
});

test('el aviso existe en el catálogo', () => {
  const a = avisoDeEnvioTrabado('otra_app', 'Instagram')!;
  const enCatalogo = CATALOGO_AVISOS.find((c) => c.id === a.id);
  assert.ok(enCatalogo, `el id ${a.id} tiene que estar en CATALOGO_AVISOS o el aviso muere sin salir`);
  assert.equal(enCatalogo.semaforo, 'rojo', 'un envío que no sale es rojo: se están perdiendo leads');
});

test('la clave de dedup NO lleva el lead: cien leads trabados son UN aviso', () => {
  const uno = avisoDeEnvioTrabado('otra_app', 'Instagram')!;
  const otro = avisoDeEnvioTrabado('otra_app', 'Instagram')!;
  assert.equal(uno.dedupKey, otro.dedupKey, 'dos leads del mismo canal comparten la clave');
  assert.ok(!/\d{3,}/.test(uno.dedupKey), `la clave no lleva ids de lead: ${uno.dedupKey}`);
});

test('pero cada canal avisa por su cuenta', () => {
  const ig = avisoDeEnvioTrabado('otra_app', 'Instagram')!;
  const fb = avisoDeEnvioTrabado('otra_app', 'Messenger')!;
  assert.notEqual(ig.dedupKey, fb.dedupKey, 'Instagram trabado y Messenger trabado son dos problemas');
});

test('se espacia: si el ajuste sigue mal, se repite al otro día, no a cada intento', () => {
  const a = avisoDeEnvioTrabado('otra_app', 'Instagram')!;
  assert.equal(a.dedupTtlMin, TTL_AVISO_TRABADO_MIN);
  assert.ok(a.dedupTtlMin >= 60, 'un TTL corto convierte el aviso en spam y el negocio lo apaga');
});

test('el contexto está en castellano y dice qué tocar, sin jerga de Meta', () => {
  const a = avisoDeEnvioTrabado('otra_app', 'Instagram')!;
  assert.ok(a.contexto.includes('Instagram'), 'nombra el canal que ve la persona');
  assert.ok(/configuración de la Página/i.test(a.contexto), 'dice DÓNDE se arregla');
  assert.ok(/24 h/.test(a.contexto), 'dice por qué corre el reloj: la ventana de 24 h');
  assert.ok(!/not_thread_owner|2534037/.test(a.contexto), 'el código de Meta no le dice nada a quien lo lee');
});

// ── Y que esté CABLEADO: lo puro de arriba no sirve si nadie lo llama ───────────────────────────

test('el envío marca la causa cuando Meta dice que otra app es la dueña', () => {
  const c = leer('lib/canal-zernio.ts');
  assert.ok(c.includes('esDeOtraApp'), 'canal-zernio tiene que importar el reconocedor de la causa');
  const marcas = c.match(/causaDelNegocio: 'otra_app'/g) ?? [];
  assert.ok(marcas.length >= 3, `los tres catch del envío marcan la causa, hay ${marcas.length}`);
});

test('y el motor emite el aviso al grupo del negocio', () => {
  // ⚠️ El motor llama al ENVOLTORIO, no al decisor: la rama social de `nutricion.ts` tiene un tope de
  // 3.000 caracteres (`tests/canal-social.test.ts`) y el bloque inline lo pasaba. Se sigue la cadena.
  const n = leer('lib/nutricion.ts');
  assert.ok(n.includes('avisarEnvioTrabado'), 'nutricion no avisa: el fallo vuelve a ser silencioso');
  const a = leer('lib/envio-trabado-aviso.ts');
  assert.ok(a.includes('avisoDeEnvioTrabado'), 'el envoltorio no consulta el criterio: avisaría de todo');
  assert.ok(a.includes('emitirDelCatalogo'), 'decide el aviso pero no lo manda');
  assert.ok(a.includes('dedupKey'), 'sin la clave de dedup son cien avisos por cien leads');
  assert.ok(/catch\s*\(/.test(a), 'un aviso que falla no puede tumbar la corrida del motor');
});
