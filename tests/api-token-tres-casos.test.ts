// =============================================================================
// Un 401 de la API dice CUÁL de los cuatro problemas es (ticket #60, 7/11/2026)
// =============================================================================
// Mauricio escribió desde el móvil que su token «no funciona para conectar Claude», después de probar DOS tokens recién
// generados. Lo que lo destrabó fue darse cuenta SOLO de que el mensaje salía idéntico sin mandar ningún token:
// `autenticar()` contestaba «Token inválido o revocado.» para no mandar la cabecera, mandarla con otro esquema, mandar
// el token pelado sin «Bearer», y mandar un token que no existe. Con los cuatro diciendo lo mismo, el camino natural es
// REGENERAR EL TOKEN, que es lo único que NO arregla tres de los cuatro casos.
//
// Prueba la CONDUCTA, no el texto: pide que los cuatro se distingan entre sí y que el consejo de regenerar salga SÓLO
// en el caso que lo merece. Si mañana alguien reescribe los mensajes, sigue en verde mientras eso se cumpla.
//
// ⚠️ Importa `autorizacion-reglas` y NO `http.ts`: éste hace `import 'server-only'` y el corredor de tests usa
// `node --import tsx --test` SIN `--conditions react-server`, así que importarlo rompe la corrida al cargar.
//
// PROBADO ROMPIÉNDOLO (7/11/2026, romper-autorizacion.mjs; base verde, 4 de 4 cazadas): el mismo texto para
// 'sin-cabecera' y 'sin-esquema' → rojo; el caso 'bearer' ignorando `tokenDesconocido` → rojo; el mensaje del token
// desconocido devolviendo `c.token` → rojo; el caso 'otro-esquema' dejando de nombrar el esquema → rojo.
//
// ⚠️ Dos de esas cuatro NO las cazaba la primera versión de este test, y vale saber por qué:
//   · `regenera(mensaje)` buscaba «revocad», y el texto viejo que había que desterrar («Token inválido o revocado.»)
//     YA decía «revocado»: volver atrás pasaba el test. Ahora se pide que el mensaje del token desconocido sea
//     DISTINTO del genérico y diga dónde regenerarlo.
//   · La mutación «devuelve el token» estaba mal escrita por mí, no floja el test: el caso 'sin-esquema' no lleva la
//     cabecera cruda adentro, así que no puede filtrarla. El único caso que tiene el secreto a mano es 'bearer'.
// Correr: node --import tsx --test tests/api-token-tres-casos.test.ts
// =============================================================================

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { casoDeAutorizacion, mensajeDeAutorizacion, type CasoAutorizacion } from '../lib/api-mako/autorizacion-reglas';

const SECRETO = 'mako_pat_secretoquenodebevolver';

test('la cabecera se clasifica en los cuatro casos, no en uno solo', () => {
  assert.equal(casoDeAutorizacion(null).caso, 'sin-cabecera');
  assert.equal(casoDeAutorizacion('   ').caso, 'sin-cabecera', 'una cabecera en blanco es no mandarla');
  assert.equal(casoDeAutorizacion(SECRETO).caso, 'sin-esquema', 'el token pelado NO es un token inválido: es una cabecera mal armada');
  assert.equal(casoDeAutorizacion(`Basic ${SECRETO}`).caso, 'otro-esquema');

  const bien = casoDeAutorizacion(`Bearer ${SECRETO}`);
  assert.equal(bien.caso, 'bearer');
  assert.equal(bien.caso === 'bearer' && bien.token, SECRETO, 'el token tiene que salir limpio');
  assert.equal(casoDeAutorizacion(`  token   ${SECRETO}  `).caso, 'bearer', '«token» también se acepta, y los espacios no cuentan');
});

test('los cuatro mensajes son DISTINTOS entre sí (es el ticket #60)', () => {
  const dichos = [
    mensajeDeAutorizacion({ caso: 'sin-cabecera' }),
    mensajeDeAutorizacion({ caso: 'sin-esquema' }),
    mensajeDeAutorizacion({ caso: 'otro-esquema', esquema: 'Basic' }),
    mensajeDeAutorizacion({ caso: 'bearer', token: SECRETO }, true),
  ];
  for (const d of dichos) assert.ok(d.trim().length > 0, 'un caso contestó sin explicación');
  assert.equal(new Set(dichos).size, dichos.length, 'dos casos distintos dicen lo mismo: volvimos al ticket #60');
});

test('mandar a REGENERAR el token sale sólo cuando regenerarlo sirve', () => {
  const regenera = (m: string) => /regenera|genera uno nuevo|revocad|no existe/i.test(m);

  // ⚠️ El mensaje del token desconocido tiene que ser DISTINTO del genérico, y decir DÓNDE se regenera. Sin estas dos
  // cosas, volver al texto de antes («Token inválido o revocado.») pasaba el test: esa frase ya decía «revocado», así
  // que un `regenera(...)` solo no cazaba nada. Lo encontré rompiéndolo (7/11/2026).
  const desconocido = mensajeDeAutorizacion({ caso: 'bearer', token: SECRETO }, true);
  const generico = mensajeDeAutorizacion({ caso: 'bearer', token: SECRETO }, false);
  assert.notEqual(desconocido, generico, 'saber que el token no existe no cambió el mensaje: el que pregunta no se entera de nada');
  assert.match(desconocido, /MaKo|Tokens|API/i, 'no dice DÓNDE regenerarlo, que es lo único que lo destraba');
  assert.ok(regenera(desconocido), 'con un token desconocido hay que decir que lo regenere');

  // En los otros tres, el token puede estar perfecto: mandar a regenerarlo es lo que le costó horas a Mauricio.
  for (const c of [{ caso: 'sin-cabecera' }, { caso: 'sin-esquema' }, { caso: 'otro-esquema', esquema: 'Basic' }] as CasoAutorizacion[]) {
    const m = mensajeDeAutorizacion(c);
    assert.ok(!regenera(m), `«${c.caso}» manda a regenerar un token que puede estar bien: «${m}»`);
    assert.match(m, /Authorization/i, `«${c.caso}» no nombra la cabecera, que es lo que hay que arreglar`);
  }
});

test('el mensaje NUNCA devuelve el token que llegó', () => {
  // Si alguien manda el token pelado, lo primero de la cabecera ES el secreto: no puede volver en el error ni quedar
  // escrito en los registros de todo el camino.
  for (const cruda of [SECRETO, `Basic ${SECRETO}`, `Portador ${SECRETO}`, `Bearer ${SECRETO}`]) {
    const m = mensajeDeAutorizacion(casoDeAutorizacion(cruda), true);
    assert.ok(!m.includes(SECRETO), `el error devolvió el token entero: «${m}»`);
    assert.ok(!m.includes(SECRETO.slice(0, 14)), `el error devolvió un pedazo del token: «${m}»`);
  }
  // El esquema sí se puede nombrar: no es secreto, y es el dato que destraba.
  assert.match(mensajeDeAutorizacion(casoDeAutorizacion(`Portador ${SECRETO}`)), /Portador/, 'nombrar el esquema es lo que le dice a la persona qué cambiar');
});
