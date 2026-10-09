// =============================================================================
// El CRON se vuelve a sembrar cuando el server cambia el disparador (app/chatbot/SecuenciaPerfil.tsx)
// =============================================================================
// Revisión de la segunda tanda del Chatbot (09/10/2026). «Crear con IA» crea la automatización con
// `trigger_tipo: 'manual'` (`crearSecuenciaVacia`) y después guarda el disparador que eligió el
// modelo (`setTriggerSecuencia`, app/api/chat-agent/secuencias/ia/route.ts). El lienzo no se remonta
// (SimuladorWhatsApp lo monta con `key={sel.id}` y el id es el mismo), y `disparo` era un `useState`
// sembrado UNA vez: la tarjeta CRON seguía diciendo «A mano», el desplegable marcaba lo de antes y
// «Probar» recibía el `trigger_tipo` viejo. La cura es comparar la FIRMA del disparador de la prop
// en el render y volver a sembrar cuando cambia.
//
// No hay DOM en los tests de esta casa (sin jsdom): un `renderToStaticMarkup` siembra siempre de la
// prop y no puede ver una prop que cambia entre dos renders. Por eso son dos capas: la función pura
// que decide si cambió (`firmaDisparo`) y el guard del cableado en el render.
//
// PROBADO ROMPIÉNDOLO (09/10/2026): quitando el bloque `if (firmaProp !== firmaVista) {…}` del
// componente dio 1 fallo y 4 pases (cae el guard del cableado); haciendo que `firmaDisparo` ignore
// `trigger_tipo` dio 1 fallo y 4 pases (cae el de «manual» contra un disparador por evento, que deja
// la etapa igual — con sólo el caso de la etapa cambiada esa rotura pasaba en VERDE).

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { disparoDeSecuencia, firmaDisparo } from '../app/chatbot/SecuenciaPerfil';

const leer = (r: string) => readFileSync(new URL(`../${r}`, import.meta.url), 'utf8').replace(/\r\n/g, '\n');
const sinComentarios = (s: string) => s.replace(/^[ \t]*\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '');

/** El cuerpo del componente: desde su firma hasta el `return (` que dibuja. */
function cuerpoDelComponente(): string {
  const src = sinComentarios(leer('app/chatbot/SecuenciaPerfil.tsx'));
  const ini = src.indexOf('export function SecuenciaPerfil(');
  assert.ok(ini >= 0, 'no está el componente');
  const fin = src.indexOf('\n  return (', ini);
  assert.ok(fin > ini, 'no está el return del componente');
  return src.slice(ini, fin);
}

test('«manual» (crear_vacia) y el disparador que eligió la IA tienen firmas distintas', () => {
  const vacia = disparoDeSecuencia({ trigger_tipo: 'manual', etapa: 'nuevo' });
  const conIA = disparoDeSecuencia({ trigger_tipo: 'etapa_actual', etapa: 'agendado', funnel_id: 3 });
  assert.notEqual(firmaDisparo(vacia), firmaDisparo(conIA));
  // Un disparador por EVENTO deja la etapa como estaba: sólo cambia `trigger_tipo`.
  assert.notEqual(firmaDisparo(vacia), firmaDisparo(disparoDeSecuencia({ trigger_tipo: 'agendo', etapa: 'nuevo' })));
  // Y cambiar sólo la etiqueta (dos «Se le puso…») también es otro disparador.
  assert.notEqual(
    firmaDisparo(disparoDeSecuencia({ trigger_tipo: 'etiqueta_puesta', etapa: 'nuevo', etiqueta_id: 1 })),
    firmaDisparo(disparoDeSecuencia({ trigger_tipo: 'etiqueta_puesta', etapa: 'nuevo', etiqueta_id: 2 })),
  );
});

test('ausente y null son lo mismo: una relectura con los campos en null no re-siembra de gusto', () => {
  assert.equal(
    firmaDisparo(disparoDeSecuencia({ trigger_tipo: 'etapa', etapa: 'nuevo' })),
    firmaDisparo(disparoDeSecuencia({ trigger_tipo: 'etapa', etapa: 'nuevo', funnel_id: null, producto_id: null, etiqueta_id: null })),
  );
});

test('disparoDeSecuencia copia los cinco campos que lee el CRON', () => {
  assert.deepEqual(
    disparoDeSecuencia({ trigger_tipo: 'entrega_actual', etapa: 'onboarding', funnel_id: null, producto_id: 9, etiqueta_id: null }),
    { trigger_tipo: 'entrega_actual', etapa: 'onboarding', funnel_id: null, producto_id: 9, etiqueta_id: null },
  );
});

test('el render compara la firma de la PROP y vuelve a sembrar `disparo` cuando cambia', () => {
  const cuerpo = cuerpoDelComponente();
  assert.match(cuerpo, /const firmaProp = firmaDisparo\(disparoDeSecuencia\(secuencia\)\);/);
  assert.match(cuerpo, /useState\(firmaProp\)/);
  // A nivel del componente (dos espacios), no adentro de un efecto: un efecto pintaría primero lo viejo.
  assert.match(cuerpo, /\n {2}if \(firmaProp !== firmaVista\) \{\n {4}setFirmaVista\(firmaProp\);\n {4}setDisparo\(disparoDeSecuencia\(secuencia\)\);\n {2}\}/);
});

test('lo que dibuja la tarjeta CRON y lo que recibe «Probar» salen de `disparo`, el que se re-siembra', () => {
  const cuerpo = cuerpoDelComponente();
  assert.match(cuerpo, /trigger_tipo: disparo\.trigger_tipo/);
  assert.match(cuerpo, /value=\{valorDisparo\(disparo\)\}/);
  assert.match(cuerpo, /useState<DisparoActual>\(\(\) => disparoDeSecuencia\(secuencia\)\)/);
});
