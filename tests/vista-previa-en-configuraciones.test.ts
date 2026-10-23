// =============================================================================
// «Vista previa del link» en Configuraciones › WhatsApp de cada automatización, no en la tarjeta (23/10/2026)
// =============================================================================
// El interruptor estaba suelto debajo del chat de cada WhatsApp (#869, lo pidió Mauricio: «es más discreto») y aparecía y
// desaparecía según hubiera un link. Martín: una tarjeta no gana controles. El Cerebro: «si lo pidió Mauricio, no se lo
// sacamos»: pasa a Configuraciones, como un interruptor más, y lo guardado en cada mensaje sigue valiendo.
// =============================================================================
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { configParaGuardar, sanearConfigAutomatizacion, sinVistaPreviaDe, tieneConfigPropia } from '../lib/config-automatizacion';

const leer = (r: string) => readFileSync(new URL(`../${r}`, import.meta.url), 'utf8').replace(/\r\n/g, '\n');

test('el dato: apagarla guarda `sinVistaPrevia: true`, prenderla lo saca, y vuelve igual del saneo', () => {
  const off = configParaGuardar({}, { sinVistaPrevia: true });
  assert.ok(off.ok);
  assert.deepEqual(off.ok && off.config, { sinVistaPrevia: true });
  assert.ok(off.ok && !off.vacia && tieneConfigPropia(off.config), 'apagada quedaba como «nada propio» y la clave se borraba');
  assert.deepEqual(sanearConfigAutomatizacion(off.ok ? off.valor : ''), { sinVistaPrevia: true });
  const on = configParaGuardar({ sinVistaPrevia: true, goteo: { minutos: 5 } }, { sinVistaPrevia: null });
  assert.deepEqual(on.ok && on.config, { goteo: { minutos: 5 } }, 'prenderla tocaba lo demás');
  assert.equal(configParaGuardar({}, { sinVistaPrevia: 'x' }).ok, false);
  // Lo que no es `true` no se lee como apagada.
  assert.deepEqual(sanearConfigAutomatizacion('{"sinVistaPrevia":"si"}'), {});
});

test('lo del mensaje sigue valiendo: sale sin la tarjeta si lo dice el mensaje O la automatización', () => {
  assert.equal(sinVistaPreviaDe(false, {}), false);
  assert.equal(sinVistaPreviaDe(false, null), false);
  assert.equal(sinVistaPreviaDe(true, {}), true, 'se perdía lo guardado en el mensaje');
  assert.equal(sinVistaPreviaDe(false, { sinVistaPrevia: true }), true);
});

test('el motor lo suma en los tres caminos que mandan: la cola, «Si responde» y el recordatorio de la reunión', () => {
  const motor = leer('lib/nutricion.ts');
  assert.match(motor, /const sinTarjeta = sinVistaPreviaDe\(sinVistaPrevia\(paso\), configsCorrida\.get\(insc\.secuencia_id\)\);/);
  assert.match(motor, /const sinTarjeta = sinVistaPreviaDe\(sinVistaPrevia\(p\), await leerConfigAutomatizacion\(secuencia\.id\)\.catch\(\(\) => null\)\);/);
  // En «Si responde» no queda ningún envío que mire sólo lo del mensaje.
  const resp = motor.slice(motor.indexOf('async function mandarMensajeDeRespuesta('), motor.indexOf('\n}\n', motor.indexOf('async function mandarMensajeDeRespuesta(')));
  assert.doesNotMatch(resp, /sinVistaPrevia: sinVistaPrevia\(p\)/, 'un envío de «Si responde» ignora lo de la automatización');
  assert.match(leer('lib/reunion-recordatorio.ts'), /sinVistaPrevia: sinVistaPreviaDe\(t\.sinVistaPrevia === true, configs\.get\(Number\(f\.id\)\)\)/);
});

test('la pantalla: una fila más del bloque WhatsApp, con el interruptor de la casa; la tarjeta ya no la tiene', () => {
  const panel = leer('app/automations/ConfigAutomatizacionPanel.tsx');
  assert.match(panel, /<FilaOpcion key="vista-previa" nombre="Vista previa del link" info="[^"]+" datos=\{\{ 'data-vista-previa-config': '' \}\}\n\s+interruptor=\{<Interruptor on=\{on\}/);
  assert.match(panel, /saveConfigAutomatizacionAction\(secuenciaId, \{ sinVistaPrevia: x \? null : true \}\)/);
  assert.doesNotMatch(leer('app/automations/FlujoLienzo.tsx'), /data-vista-previa[^-]|label="Vista previa del link"/);
});
