// =============================================================================
// El link de la reunión, con o sin la vista previa (17/10/2026, tarjeta #869, lo que faltaba)
// =============================================================================
// 951d52db3 le puso a cada WhatsApp su interruptor «Vista previa del link» (`sin_vista_previa` del paso → Evolution con
// `linkPreview: false`), pero dejó afuera a propósito el «Recordatorio de la reunión»: el lienzo no lo dibujaba ahí
// (`noOficial && !recordatorio`) y su emisor (lib/reunion-recordatorio.ts) mandaba sin la opción. Y los tres textos de
// fábrica de ese recordatorio llevan `{{link}}`: el link de la reunión salía SIEMPRE con la tarjeta, sin poder elegir.
// Lo que fija:
//   · el toque lleva el interruptor de SU tarjeta (`toquesDeLaAutomatizacion`), y el emisor se lo pasa al envío;
//   · el lienzo lo ofrece en el recordatorio también con la tarjeta vacía (sale el texto de fábrica, con link) o con
//     `{{link}}` escrito; fuera del recordatorio, como antes (un link en el texto, o ya apagado).
//
// PROBADO ROMPIÉNDOLO (17/10/2026, arnés `romper.py` + `roturas-869.json`; base 3 / 0). Pasan / fallan:
//   1. el toque no lleva el interruptor                      -> 2 / 1
//   2. el emisor manda sin la opción                         -> 2 / 1
//   3. el lienzo vuelve a dejar afuera al recordatorio       -> 2 / 1
//   4. la tarjeta vacía del recordatorio no lo ofrece        -> 2 / 1
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { toquesDeLaAutomatizacion, pasosDeLaConfig, ofreceVistaPrevia } from '../lib/recordatorio-automatizacion';
import { configDeRecordatorio } from '../lib/recordatorio-lead';
import type { PasoGrafo } from '../lib/flujo-grafo';

const leer = (rel: string): string => readFileSync(join(import.meta.dirname, '..', rel), 'utf8').replace(/\r\n/g, '\n');
const fabrica = (): PasoGrafo[] => pasosDeLaConfig(configDeRecordatorio(null));

test('el toque lleva el interruptor de SU tarjeta, y el emisor se lo pasa al envío', () => {
  const pasos = fabrica().map((p) => (p.id === 'toque-60' ? { ...p, sin_vista_previa: true } as PasoGrafo : p));
  const { toques, problema } = toquesDeLaAutomatizacion(pasos);
  assert.equal(problema, null);
  assert.equal(toques.find((t) => t.min === 60)?.sinVistaPrevia, true, 'el toque de 1 h perdió su interruptor');
  assert.equal(toques.find((t) => t.min === 15)?.sinVistaPrevia, undefined, 'los otros salen con la tarjeta, como siempre');
  const emisor = leer('lib/reunion-recordatorio.ts');
  // Desde el 23/10/2026, lo de la tarjeta O lo de la automatización (Configuraciones › WhatsApp, `sinVistaPreviaDe`).
  assert.match(emisor, /porMin\.set\(t\.min, \{ min: t\.min, texto: t\.texto, linea: t\.linea, sinVistaPrevia: sinVistaPreviaDe\(t\.sinVistaPrevia === true, configs\.get\(Number\(f\.id\)\)\) \}\)/);
  assert.match(emisor, /enviarYEspejar\(\{ telefono, texto, leadId: lead\.id, linea: toque\.linea, sinVistaPrevia: toque\.sinVistaPrevia === true \}\)/);
});

test('el lienzo lo ofrece en el recordatorio con la tarjeta vacía o con {{link}}; fuera, como antes', () => {
  const [toque] = fabrica().filter((p) => p.id === 'toque-1440');
  const con = (cuerpo: string): PasoGrafo => ({ ...toque, cuerpo } as PasoGrafo);
  assert.equal(ofreceVistaPrevia(con(''), true), true, 'la vacía sale con el texto de fábrica, que trae el link');
  assert.equal(ofreceVistaPrevia(con('Hola {{nombre}}, entra acá: {{ link }}'), true), true);
  assert.equal(ofreceVistaPrevia(con('Hola {{nombre}}, nos vemos {{cuando}}.'), true), false, 'sin link no hay vista previa que apagar');
  assert.equal(ofreceVistaPrevia(con(''), false), false, 'fuera del recordatorio una vacía no lleva link');
  assert.equal(ofreceVistaPrevia(con('Mira https://hola-mako.com'), false), true);
  assert.equal(ofreceVistaPrevia({ ...con('sin link'), sin_vista_previa: true } as PasoGrafo, false), true, 'apagado, que se pueda volver a prender');
});

test('la tarjeta del lienzo ya no tiene el interruptor (23/10/2026, revisión de las tarjetas, punto 7); lo guardado sigue valiendo', () => {
  const lienzo = leer('app/automations/FlujoLienzo.tsx');
  assert.doesNotMatch(lienzo, /data-vista-previa|label="Vista previa del link"/, 'volvió el interruptor suelto a la tarjeta');
});
