// =============================================================================
// Lo que costó un clip pagado no se des-aprende solo
// =============================================================================
// Dos invariantes del guardado de plantillas, los dos encontrados por la auditoría
// del 05/09/2026 y los dos con la misma firma: `aprendioGenerar` en false para
// siempre, sin una línea de error, con la plantilla buena al lado.
//
// ① LA SENTINELA SE FUNDE, NO SE PISA.
//    El espejo reescribe la entrada de una clase en CADA pedido. La generación
//    siguiente no lleva la frase, así que trae `sentinela: null` — y un
//    `mapa[p.clase] = { ...p }` reemplaza el objeto ENTERO. Lo aprendido se
//    borraba con el próximo pedido de la misma clase. La sentinela se descubre una
//    vez y no cambia: es un dato, no un estado.
//
// ② NO SE PREGUNTA POR UN rpcid ADIVINADO.
//    Era `guardadas['boq:YhhmEf']`, un rpcid medido contra el bundle de un día.
//    Google despliega bundles nuevos y BOQ puede batchear varios rpcids en un
//    pedido (`rpcids=YhhmEf,ngNC2`): en los dos casos el lookup exacto contesta
//    `undefined`, que no se queja y se lee como «no aprendió». La sentinela solo la
//    puede tener el pedido que llevaba la frase — se pregunta por eso.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const src = readFileSync(
  resolve(import.meta.dirname, '..', 'extension', 'background.js'), 'utf8',
);

const sinComentarios = src
  .replace(/^[ \t]*\/\/.*$/gm, '')
  .replace(/\/\*[\s\S]*?\*\//g, '');

test('`guardarPlantillas` conserva la sentinela que ya tenía', () => {
  const f = /async function guardarPlantillas[\s\S]*?\n\}/.exec(sinComentarios);
  assert.ok(f, 'no encontré guardarPlantillas');
  const cuerpo = f[0];

  assert.ok(
    /antes\s*&&\s*antes\.sentinela/.test(cuerpo),
    'No conserva la sentinela previa: la primera generación que no lleve la frase la\n'
    + 'borra, y el popup vuelve a pedir el clip de prueba — cobrándoselo al cliente.',
  );
  assert.ok(
    !/mapa\[p\.clase\]\s*=\s*\{\s*\.\.\.p\s*,\s*cuando/.test(cuerpo),
    'Volvió a reemplazar el objeto entero. Eso pisa `sentinela` con el `null` del\n'
    + 'pedido de ahora. Hay que fundir campo por campo.',
  );
});

test('la sentinela se puede derivar del cuerpo acá, sin depender del espejo', () => {
  // Es lo que salva a una pestaña de Flow que quedó con el `injected.js` viejo: la
  // marca `window.__makoEspejo` vive en el mundo de la PAGINA y sobrevive a que la
  // extensión se actualice, así que un campo nuevo del espejo puede no llegar nunca.
  // El service worker sí se actualiza. Un dato que se puede LEER no se pide prestado.
  assert.ok(
    /operacionDelCuerpo/.test(sinComentarios),
    'Sin la derivación local, una pestaña con el espejo viejo no aprende nunca — que\n'
    + 'es exactamente por qué el arreglo de v0.49.0 no movió el síntoma.',
  );
  assert.ok(
    /operacionDelCuerpo\(p\.cuerpo\)/.test(sinComentarios),
    'La función existe y nadie la llama al guardar: escribir la salida no es ofrecerla.',
  );
});

test('el estado de las operaciones no cuelga de un rpcid escrito a mano', () => {
  // ⚠️ ESTE TEST CAMBIÓ DE SUJETO: el booleano `aprendioGenerar` murió (con cinco
  // operaciones, «aprendió» sin decir QUÉ no es una respuesta) y lo reemplazó el mapa
  // `ops`. Pero la invariante que protegía sigue viva y es la misma:
  //
  // preguntar por una clave literal `boq:<rpcid>` es preguntar por un id de un bundle
  // de Google. Ese id ROTA, y un batchexecute con dos rpcids da otra clave. El lookup
  // exacto contesta `undefined`, que no se queja y se lee igual que «no aprendió».
  assert.ok(
    !/guardadas\[['"]boq:[A-Za-z0-9]+['"]\]/.test(sinComentarios),
    'Volvió a preguntar por una clave literal `boq:<rpcid>`.\n\n'
    + 'Se pregunta por la PROPIEDAD (la sentinela sólo la tiene el pedido que generó)\n'
    + 'o por el rpcid a través del catálogo, que declara cuáles puede usar y por qué.',
  );
  // Y el cálculo tiene que mirar de verdad algo de cada plantilla.
  const bloque = /let ops[\s\S]*?siguiente = falta/.exec(sinComentarios);
  assert.ok(bloque, 'no encontré el cálculo de `ops`');
  assert.ok(
    /p\.op/.test(bloque[0]),
    'El cálculo no mira la operación de ninguna plantilla.',
  );
});

test('lo que el ESTADO escribe sobre el aprendizaje, el popup lo lee', () => {
  // El booleano `aprendioGenerar` murio: con cinco operaciones, «aprendio» sin decir
  // QUE no es una respuesta. Lo reemplazan `ops` (que sabe) y `siguiente` (que falta).
  //
  // Se fija que el consumidor exista, que es el defecto que este puente pago dos veces
  // en un dia: un campo que viaja y nadie lee no da error, da un estado invisible.
  assert.ok(/siguiente,/.test(src), 'el ESTADO no devuelve `siguiente`');
  assert.ok(/ops,/.test(src), 'el ESTADO no devuelve `ops`');
  const popup = readFileSync(
    resolve(import.meta.dirname, '..', 'extension', 'popup.js'), 'utf8',
  );
  assert.ok(
    /v\.siguiente/.test(popup),
    'El ESTADO calcula `siguiente` y el popup no lo lee: la pantalla del aprendizaje\n'
    + 'quedaría mostrando el estado de otra cosa.',
  );
  assert.ok(/v\.cuantasOps|v\.cuantasListas/.test(popup), 'el popup no muestra el N de M');
});
