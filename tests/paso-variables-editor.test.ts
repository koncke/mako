// =============================================================================
// Lo que el EDITOR dibuja resuelto y lo que el MOTOR manda tienen que coincidir
// =============================================================================
// El lienzo de secuencias pinta la burbuja «como le llega a la persona», así que todo
// token que la previsualización reemplace tiene que estar en el catálogo que usa el
// envío (`lib/template-vars.ts`). Si no está, lo desconocido queda LITERAL y al lead le
// llegan las llaves puestas, con el editor mostrándolo perfecto.
//
// Medido el 05/10/2026 (investigación de ManyChat): `VistaMensaje` resolvía
// `{{negocio}}` con un replace propio y el catálogo del motor tenía cuatro claves,
// ninguna era ésa. Estaba latente — el generador de MaKo sólo usa variables del
// catálogo — así que esperaba a la primera persona que lo escribiera a mano.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { aplicarVariables, valoresVariablesLead, esVariableConocida, VARIABLES_NEGOCIO } from '../lib/template-vars';

test('el nombre del negocio lo pasa el EMISOR, y sin valor el token queda CRUDO', () => {
  const lead = { nombre: 'Daniela Rivas', empresa: 'Rivas Propiedades' };
  const con = aplicarVariables('Hola {{nombre}}, te escribo de {{negocio}}', valoresVariablesLead(lead, { negocio: 'Inmobiliaria del Valle' }));
  assert.equal(con, 'Hola Daniela, te escribo de Inmobiliaria del Valle');

  // Sin valor NO se reemplaza por vacío: un mensaje cojo no se ve, las llaves sí.
  const sin = aplicarVariables('Hola {{nombre}}, te escribo de {{negocio}}', valoresVariablesLead(lead));
  assert.equal(sin, 'Hola Daniela, te escribo de {{negocio}}');

  // Y un nombre de negocio en blanco es lo mismo que no tenerlo.
  const vacio = aplicarVariables('de {{negocio}}', valoresVariablesLead(lead, { negocio: '   ' }));
  assert.equal(vacio, 'de {{negocio}}');
});

test('`negocio` es una variable CONOCIDA: el validador de plantillas no la rechaza', () => {
  assert.equal(esVariableConocida('negocio'), true);
  assert.equal(esVariableConocida('inventada'), false);
  assert.ok(VARIABLES_NEGOCIO.length >= 1);
});

// ⚠️ REESCRITO EL 08/10/2026: la tarjeta del lienzo ya no resuelve `{{negocio}}` con un
// `replace` propio, sino con LA función del motor (`aplicarVariables`). Es más fuerte que el
// guard de antes: con la misma función, lo que la vista resuelve ES lo que el motor resuelve.
// Lo que queda por cuidar es (a) que no vuelva un `replace` de tokens a mano y (b) que las
// claves que la vista le pasa sean del catálogo. Probado rompiéndolo: un
// `.replace(/\{\{\s*negocio\s*\}\}/g, …)` de vuelta → 1 rojo; la vista pasándole una clave
// inventada (`{ marca: n }`) → 1 rojo.
test('todo token que el lienzo resuelve está en el catálogo del motor', () => {
  const src = readFileSync(new URL('../app/chatbot/FlujoLienzo.tsx', import.meta.url), 'utf8').replace(/\r\n/g, '\n')
    .replace(/^[ \t]*\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '');
  assert.doesNotMatch(src, /\.replace\(\s*\/\\\{\\\{/, 'volvió un replace de tokens a mano: la vista y el motor pueden separarse');
  // (Desde la tercera tanda importa también VARIABLES_LEAD: los datos que la tarjeta MAKO inserta.)
  assert.match(src, /import \{ aplicarVariables(, VARIABLES_LEAD)? \} from '@\/lib\/template-vars';/);
  const usos = [...src.matchAll(/aplicarVariables\([^,]+,\s*([^;]+?)\);/g)].map((m) => m[1]);
  assert.ok(usos.length >= 1, 'el lienzo dejó de resolver la vista con la función del motor');
  const claves = usos.flatMap((u) => [...u.matchAll(/\{\s*([a-z_]+)\s*:/g)].map((m) => m[1]));
  assert.ok(claves.length >= 1, 'no encontré las claves que la vista resuelve: ¿cambió la forma de escribirlo?');
  for (const t of claves) {
    assert.ok(esVariableConocida(t), `el lienzo resuelve {{${t}}} y el motor no lo conoce: al lead le llegaría literal`);
  }
});

// Probado rompiéndolo (05/10/2026) de dos formas:
//   · sacando `negocio` del catálogo de conocidas (volviendo `KEYS` a sólo
//     VARIABLES_LEAD): **2 fallos de 3**, y uno de los dos es el guard del lienzo —
//     o sea que ese guard es exactamente el que habría cazado el bug original.
//   · devolviendo `negocio` SIEMPRE (sin el `...(negocio ? …)`): **1 fallo**, el del
//     token crudo. Es el caso silencioso: el mensaje sale sin el nombre del negocio.
