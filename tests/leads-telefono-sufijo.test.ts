// =============================================================================
// El teléfono se compara igual en las CUATRO puertas, no en dos (#626)
// =============================================================================
// El criterio ya estaba tomado y escrito: «el mismo número con y sin código de país
// es el mismo número» (`telefonoComparable`, lib/leads-duplicados.ts). Lo aplicaban
// las dos puertas donde hay una PERSONA mirando —el alta manual, por
// `duplicadosDeLead`, que FRENA con eso; y el inbox de WhatsApp, por
// `matchLeadPorTelefono`— y NO las dos por las que el lead entra solo: el instant form
// de Meta y el webhook de Calendly comparaban con `.eq`.
//
// O sea que al lead que llega sin nadie mirando se le aplicaba el criterio MÁS
// ESTRICTO. Uno entra desde WhatsApp como `5219981234567` y el mismo número tipeado a
// mano es `9981234567`: para el webhook son dos personas. Y el resultado no es una
// ficha de más, son DOS leads inalcanzables — dos filas con el mismo
// `telefono_normalizado` rompen con PGRST116 el `.maybeSingle()` de la ingesta
// siguiente, así que la reunión que esa persona reserve después no entra al CRM y
// ninguna pantalla lo dice.
//
// ⚠️ Y UN PATRÓN DE SUFIJO TRAE DE MÁS A PROPÓSITO: un IGSID de Instagram también
// termina en diez dígitos. Por eso `elegirPorTelefono` es una función aparte y pura:
// el `like` trae CANDIDATOS y quién es quién lo decide una comparación exacta después.
// Con varios candidatos no se elige el primero — se desempata con el email del que
// entra, o no se elige ninguno. Crear una ficha de más es reversible (alguien las
// funde); escribirle la agenda y la atribución de Meta a la persona equivocada no lo
// es, y no deja una línea en el historial.
//
// ⚠️ PROBADO ROMPIÉNDOLO, las seis. Con el arreglo puesto: 10 pases, 0 fallos.
//   · `elegirPorTelefono` elige `porSufijo[0]` ante varios candidatos .... 3 FALLOS, 7 pases
//   · el sufijo opina aunque haya un exacto (se saca la salida temprana) . 3 FALLOS, 7 pases
//   · con dos exactos gana el más NUEVO (reduce al revés) ................ 1 FALLO, 9 pases
//   · `telefonoComparable` compara el número entero (sin `slice(-10)`) ... 3 FALLOS, 7 pases
//   · una ingesta vuelve a `primerLeadPor(…, 'telefono_normalizado', …)` . 1 FALLO, 9 pases
//   · `primerLeadPorTelefono` se queda sólo con la consulta exacta ....... 1 FALLO, 9 pases
// =============================================================================

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { elegirPorTelefono, telefonoComparable, type CandidatoPorTelefono } from '../lib/leads-duplicados';

const leer = (p: string) => readFileSync(join(import.meta.dirname, '..', p), 'utf8');

/** Un lead ya guardado, en lo mínimo que mira la decisión. */
const guardado = (id: number, tel: string | null, email: string | null = null): CandidatoPorTelefono =>
  ({ id, telefono_normalizado: tel, email });

// ─────────────────────────────────────────────────────────────────────────────
// La decisión, ejecutada
// ─────────────────────────────────────────────────────────────────────────────

test('el mismo número con y sin código de país es el mismo lead', () => {
  // Es el caso que el `.eq` no veía, y el más común: el lead entró por WhatsApp con
  // prefijo y el webhook de Calendly lo trae tipeado a mano, o al revés.
  const conPrefijo = elegirPorTelefono([guardado(7, '5219981234567')], '9981234567');
  assert.equal(conPrefijo.elegido?.id, 7, 'el guardado con prefijo tiene que matchear');
  assert.deepEqual(conPrefijo.ambiguos, []);

  const sinPrefijo = elegirPorTelefono([guardado(7, '9981234567')], '5219981234567');
  assert.equal(sinPrefijo.elegido?.id, 7, 'y al revés también: la comparación es simétrica');
});

test('el EXACTO manda: si hay, el sufijo no opina', () => {
  // La salida temprana es lo que hace que este cambio no pueda volver ambiguo ningún
  // match que antes era limpio. El exacto es el 9 (más nuevo) y el parecido el 2.
  const r = elegirPorTelefono([guardado(2, '5219981234567'), guardado(9, '9981234567')], '9981234567');
  assert.equal(r.elegido?.id, 9, 'con un exacto presente no se mira el sufijo');
  assert.deepEqual(r.ambiguos, [], 'y no hay ninguna ambigüedad que reportar');
});

test('con DOS exactos gana el más viejo, y los ids quedan reportados', () => {
  // Es la decisión que ya estaba tomada y escrita: la ficha original es la que viene
  // trabajando el equipo, y abstenerse acá es perder la reunión. Lo nuevo es sólo que
  // los ids salgan para que alguien pueda ir a mirar.
  const r = elegirPorTelefono([guardado(44, '9981234567'), guardado(12, '9981234567')], '9981234567');
  assert.equal(r.elegido?.id, 12, 'el más viejo es el de id más bajo, no el primero del array');
  assert.deepEqual(r.ambiguos, [44, 12], 'los dos ids se reportan');
});

test('UN solo candidato por sufijo entra; VARIOS sin desempate NO eligen a nadie', () => {
  const uno = elegirPorTelefono([guardado(3, '5219981234567'), guardado(8, '5550001111')], '9981234567');
  assert.equal(uno.elegido?.id, 3, 'con un solo parecido el sufijo es lo único que hay, y entra');

  const dos = [guardado(3, '5219981234567'), guardado(8, '19981234567')];
  const r = elegirPorTelefono(dos, '9981234567');
  assert.equal(r.elegido, null,
    'ELIGIÓ UNO DE DOS: con el teléfono de la recepción o un número reciclado, eso le '
    + 'escribe la agenda y la atribución de Meta a la persona equivocada, sin rastro');
  assert.deepEqual(r.ambiguos, [3, 8], 'y los dos ids quedan para ir a mirar');
});

test('el email DESEMPATA, y sólo cuando resuelve a uno', () => {
  const dos = [guardado(3, '5219981234567', 'ana@x.com'), guardado(8, '19981234567', 'juan@x.com')];
  assert.equal(elegirPorTelefono(dos, '9981234567', 'JUAN@x.com ')?.elegido?.id, 8,
    'el email del que entra es el único dato que dice cuál de los dos es');
  assert.equal(elegirPorTelefono(dos, '9981234567', 'otro@x.com').elegido, null,
    'un email que no es de ninguno de los dos no desempata nada');
  assert.equal(elegirPorTelefono(dos, '9981234567', '').elegido, null,
    'y sin email tampoco: no se elige');
  // Dos candidatos con el MISMO email tampoco desempatan: sigue habiendo dos.
  const mismoMail = [guardado(3, '5219981234567', 'ana@x.com'), guardado(8, '19981234567', 'ana@x.com')];
  assert.equal(elegirPorTelefono(mismoMail, '9981234567', 'ana@x.com').elegido, null);
});

test('un teléfono demasiado corto se compara SÓLO exacto', () => {
  // `telefonoComparable` exige 7 dígitos: por debajo de eso el sufijo no distingue
  // personas, así que sólo vale la igualdad.
  assert.equal(telefonoComparable('12345'), null, 'cinco dígitos no son un teléfono comparable');
  assert.equal(elegirPorTelefono([guardado(1, '12345')], '12345').elegido?.id, 1, 'el exacto sigue entrando');
  assert.equal(elegirPorTelefono([guardado(1, '99912345')], '12345').elegido, null,
    'y NO se engancha con uno que lo contiene al final');
});

test('sin teléfono y sin candidatos no se inventa nada', () => {
  assert.equal(elegirPorTelefono([guardado(1, '9981234567')], '').elegido, null);
  assert.equal(elegirPorTelefono([guardado(1, null)], '9981234567').elegido, null);
  assert.equal(elegirPorTelefono([], '9981234567').elegido, null);
});

test('un IGSID de Instagram que termina en los mismos dígitos no se cuela como el lead', () => {
  // 17 dígitos: el patrón `%9981234567` lo trae, y ahí el `[0]` lo elegiría. Con DOS
  // candidatos nadie gana; con uno solo el sufijo es lo único que hay y entra — es el
  // precio del criterio, el mismo que paga el alta manual, y es reversible.
  const r = elegirPorTelefono([guardado(5, '17421039981234567'), guardado(6, '529981234567')], '9981234567');
  assert.equal(r.elegido, null, 'con un parecido y un plausible no se adivina');
});

// ─────────────────────────────────────────────────────────────────────────────
// Y el CABLEADO: una decisión sin call site es una decisión que no corre
// ─────────────────────────────────────────────────────────────────────────────

/** Lo que un archivo EJECUTA, sin su prosa (los de línea ANTES que los de bloque). */
const soloCodigo = (src: string): string =>
  src.replace(/^[ \t]*\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '');

test('las TRES ingestas comparan el teléfono por `primerLeadPorTelefono`', () => {
  const codigo = soloCodigo(leer('lib/leads.ts'));
  assert.doesNotMatch(codigo, /primerLeadPor\([^)]*'telefono_normalizado'/,
    'VOLVIÓ EL `.eq` A UNA INGESTA: el lead que entra solo queda otra vez con un '
    + 'criterio más estricto que el que carga una persona');
  for (const donde of ['instant form de Meta', 'webhook de Calendly', 'findLeadByContacto']) {
    assert.ok(
      codigo.includes(`primerLeadPorTelefono(supabase, telNorm, '${donde}'`),
      `${donde} dejó de pasar por la puerta del teléfono`,
    );
  }
  // Y el email viaja: sin él la función no puede desempatar y se abstiene siempre.
  const sinEmail = codigo.match(/primerLeadPorTelefono\(supabase, telNorm, '[^']+'\)/);
  assert.equal(sinEmail, null, `una ingesta llama sin el email del desempate: ${sinEmail?.[0]}`);
});

test('la puerta del teléfono hace las DOS consultas: exacta y por sufijo', () => {
  const codigo = soloCodigo(leer('lib/leads.ts'));
  const i = codigo.indexOf('async function primerLeadPorTelefono');
  assert.ok(i > 0, 'no encontré `primerLeadPorTelefono`: ¿se renombró?');
  const cuerpo = codigo.slice(i, codigo.indexOf('\n}', i));
  assert.ok(cuerpo.length < 2000, `el recorte se fue de largo (${cuerpo.length}): está mirando otra función`);
  assert.match(cuerpo, /\.eq\('telefono_normalizado', digitos\)/,
    'sin la consulta exacta, el tope de la segunda puede esconder al exacto detrás de '
    + 'veinte parecidos — y un match que antes era limpio se vuelve ambiguo');
  assert.match(cuerpo, /\.like\('telefono_normalizado', `%\$\{suf\}`\)/,
    'SIN EL SUFIJO ESTO ES EL `.eq` DE ANTES con dos consultas: el número con código '
    + 'de país vuelve a ser otra persona');
  assert.match(cuerpo, /elegirPorTelefono\(candidatos, digitos, emailDelQueEntra\)/,
    'el patrón trae candidatos: quién es quién lo decide la comparación exacta');
});
