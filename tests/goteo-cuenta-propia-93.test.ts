// =============================================================================
// Ticket #93 (13/11/2026): el tope por día de UNA automatización (el goteo) sigue a la cuenta del negocio
// =============================================================================
// Decisión del Cerebro, después de «Email por día según la cuenta»: con SU clave de Resend y SU dominio, el tope por día del
// goteo llega a 2.000; con la de la plataforma, a 500. Sin esto, con el tope del negocio en 1.600, a «Sprint correos · Fríos»
// de Mauricio no se le podía poner más de 500 por día. La regla en lib/config-automatizacion.ts (`rangosGoteo`); quién la
// pasa: lib/config-automatizacion-db.ts (todo lo que guarda) y la API (`configurar_automatizacion`, antes del «sí»). El camino
// de la API con las dos cuentas, en tests/email-campana-columnas.test.ts.
// Correr: node --import tsx --test tests/goteo-cuenta-propia-93.test.ts
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { configParaGuardar, rangosGoteo, sanearConfigAutomatizacion, RANGOS_GOTEO } from '../lib/config-automatizacion';

const fuente = (rel: string): string => readFileSync(join(import.meta.dirname, '..', rel), 'utf8').replace(/\r\n/g, '\n');

test('1. el rango: 2.000 por día con cuenta propia, 500 con la de la plataforma; los minutos no cambian', () => {
  assert.deepEqual(rangosGoteo({ cuentaPropia: true }), { minutos: [1, 240], dia: [1, 2000] });
  assert.deepEqual(rangosGoteo(), { minutos: [1, 240], dia: [1, 500] });
  assert.deepEqual(rangosGoteo({ cuentaPropia: false }).dia, RANGOS_GOTEO.dia, 'la difusión sigue con el de la plataforma');
});

test('2. guardar: 1.200 por día para «Fríos» entra con su cuenta y no con la de la plataforma', () => {
  const propia = configParaGuardar({}, { goteo: { dia: 1200 } }, { cuentaPropia: true });
  assert.equal(propia.ok, true);
  assert.equal(propia.ok && propia.config.goteo?.dia, 1200);
  assert.deepEqual(configParaGuardar({}, { goteo: { dia: 1200 } }), { ok: false, error: 'El tope por día van de 1 a 500.' }, 'sin decir la cuenta: la de la plataforma');
  assert.deepEqual(configParaGuardar({}, { goteo: { dia: 2500 } }, { cuentaPropia: true }), { ok: false, error: 'El tope por día van de 1 a 2000.' });
  // El arranque gradual sube hasta el tope: también con el rango de la cuenta.
  const arranque = configParaGuardar({}, { goteo: { dia: 1200, arranque: { dia: 600, sube: 300 } } }, { cuentaPropia: true });
  assert.equal(arranque.ok, true);
  assert.deepEqual(configParaGuardar({}, { goteo: { dia: 400, arranque: { dia: 600, sube: 300 } } }), { ok: false, error: 'El arranque y lo que sube por día van de 1 a 500.' });
});

test('3. leer: lo guardado con su cuenta no se descarta (sin tope por día mandaría MÁS)', () => {
  const c = sanearConfigAutomatizacion(JSON.stringify({ goteo: { dia: 1200, arranque: { dia: 600, sube: 300 } } }));
  assert.deepEqual(c.goteo, { dia: 1200, arranque: { dia: 600, sube: 300 } });
  // Fuera de todo rango (una fila rota): ausente, como siempre.
  assert.equal(sanearConfigAutomatizacion(JSON.stringify({ goteo: { dia: 2500 } })).goteo, undefined);
});

test('4. quién pasa la cuenta: lo que guarda (todos los caminos), la API antes del «sí» y la pantalla', () => {
  assert.match(fuente('lib/config-automatizacion-db.ts'), /const r = configParaGuardar\(previo, cambio, await opcionesDeRango\(\)\);/);
  const run = fuente('lib/api-mako/areas/chatbot.run.ts');
  assert.match(run, /const prueba = configParaGuardar\(previo, cambio, cuenta\);/);
  assert.match(run, /cambioDeConfigDelInput\(input, await leerConfigAutomatizacion\(id\), columnas, await opcionesDeRango\(\)\)/);
  assert.match(fuente('app/automations/config-automatizacion-actions.ts'), /rangosGoteo: rangosGoteo\(cuenta\),/);
  const panel = fuente('app/automations/ConfigAutomatizacionPanel.tsx');
  assert.match(panel, /const rangos = d\?\.rangosGoteo \?\? RANGOS_GOTEO;/);
  assert.doesNotMatch(panel, /max=\{RANGOS_GOTEO/, 'las flechas del panel no pasan de 500 con la cuenta propia');
});
