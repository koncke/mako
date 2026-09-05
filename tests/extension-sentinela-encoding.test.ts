// =============================================================================
// La sentinela tiene que sobrevivir a cómo viaja el cuerpo, no a cómo se lee
// =============================================================================
// `codificacionDeLaSentinela` decide si MaKo aprendió a pedirle un video al Flow
// nuevo. Buscaba la FRASE entera, probando seis codificaciones.
//
// ⚠️ NINGUNA DE LAS SEIS CUBRE UN CUERPO `form-urlencoded`, que es justo como BOQ
// manda `f.req`. Ahí el espacio se escribe `+`, no `%20`, y la frase tiene seis
// espacios: la generación se capturaba perfecta y la respuesta era `null`, o sea
// «no aprendió» sobre un clip que la persona ya había pagado.
//
// Medido el 05/09/2026 construyendo el cuerpo con `URLSearchParams`: cero de seis.
//
// La cura no es agregar una séptima codificación —la próxima capa escribirá los
// espacios de una séptima forma— sino dejar de colgar la decisión de un carácter
// frágil. `mako7f3a9c` son diez alfanuméricos: url-encoding, form-encoding, el
// escapado de JSON y los tres anidados lo dejan idéntico.
//
// Es la misma familia que el `\s` del snippet del Pixel: el fuente y lo que viaja
// por el cable no son el mismo texto.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const src = readFileSync(
  resolve(import.meta.dirname, '..', 'extension', 'injected.js'), 'utf8',
);

/** La frase y el token, leídos del archivo y no copiados acá. */
function constantes() {
  const frase = /const SENTINELA = '([^']+)'/.exec(src);
  const token = /const TOKEN_SENTINELA = '([^']+)'/.exec(src);
  assert.ok(frase, 'no encontré SENTINELA');
  assert.ok(token, 'no encontré TOKEN_SENTINELA');
  return { frase: frase[1], token: token[1] };
}

test('el token es alfanumérico: ninguna codificación lo puede cambiar', () => {
  const { token } = constantes();
  assert.match(
    token, /^[A-Za-z0-9]+$/,
    'El token decide si aprendió, así que no puede tener un solo carácter que alguna\n'
    + 'capa escriba distinto. Sin espacios, sin acentos, sin puntuación: alfanumérico.',
  );
  // La prueba de que sobrevive, aplicada de verdad y no afirmada.
  const paso = [
    ['crudo', (t: string) => t],
    ['uri', encodeURIComponent],
    ['form', (t: string) => new URLSearchParams({ x: t }).toString()],
    ['json', (t: string) => JSON.stringify(t)],
    ['json+uri', (t: string) => encodeURIComponent(JSON.stringify(t))],
    ['json2+form', (t: string) => new URLSearchParams({ x: JSON.stringify(JSON.stringify(t)) }).toString()],
  ] as const;
  for (const [nombre, f] of paso) {
    assert.ok(f(token).includes(token), `el token no sobrevive a ${nombre}`);
  }
});

test('el token está DENTRO de la frase: se enseña una sola cosa', () => {
  const { frase, token } = constantes();
  assert.ok(
    frase.includes(token),
    'La frase que se le pide a la persona tiene que CONTENER el token, o estaríamos\n'
    + 'buscando algo que ella nunca escribió.',
  );
});

test('la frase entera NO se encuentra en un cuerpo form-urlencoded — por eso decide el token', () => {
  // El caso real, reconstruido: BOQ manda `f.req` como form-urlencoded.
  const { frase, token } = constantes();
  const cuerpo = new URLSearchParams({
    'f.req': JSON.stringify([[['YhhmEf', JSON.stringify([frase]), null, 'generic']]]),
  }).toString();

  assert.ok(
    !cuerpo.includes(frase),
    'Si la frase apareciera literal, este test perdió su motivo y hay que revisarlo.',
  );
  assert.ok(
    cuerpo.includes(frase.replace(/ /g, '+')),
    'La firma del problema: los espacios viajan como `+`.',
  );
  assert.ok(
    cuerpo.includes(token),
    'El token tiene que estar igual, que es toda la razón por la que decide él.',
  );
});

test('`codificacionDeLaSentinela` cae al token cuando ninguna codificación matchea', () => {
  // La rama que importa, fijada por su nombre: sin ella el `return null` de abajo
  // se lee como «no aprendió» sobre una generación buena.
  const cuerpo = /function codificacionDeLaSentinela[\s\S]*?\n  \}/.exec(src);
  assert.ok(cuerpo, 'no encontré la función');
  assert.ok(
    /TOKEN_SENTINELA/.test(cuerpo[0]),
    'La función no mira el token: volvió a colgar de la frase entera, y con eso un\n'
    + 'cuerpo form-urlencoded da `null` — «no aprendí» sobre un clip ya pagado.',
  );
});
