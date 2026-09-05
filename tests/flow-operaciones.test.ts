// =============================================================================
// El catálogo de operaciones del puente: lo que no puede estar mal
// =============================================================================
// Cada entrada de `lib/flow-operaciones.ts` decide si una generación PAGADA se
// reconoce. Un token mal elegido o duplicado no da error: hace que la persona
// genere un clip, se le cobre, y el puente diga que no aprendió — o peor, que diga
// que aprendió a generar VIDEO cuando lo que generó fue una imagen, y eso se
// descubre recién cuando el pedido sale y Google contesta 400.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  OPERACIONES, A_ENSENAR, CUANTAS_PAGADAS,
  operacionDe, dondeAparece, operacionDelCuerpo,
} from '../lib/flow-operaciones';

test('todo token es alfanumérico: ninguna codificación lo puede cambiar', () => {
  // La razón está medida: en un cuerpo form-urlencoded el espacio viaja como `+`,
  // así que un ancla con espacios no se encuentra nunca. Alfanumérico sobrevive a
  // url-encoding, form-encoding y a los tres anidados de JSON.
  for (const o of OPERACIONES) {
    if (!o.token) continue;
    assert.match(o.token, /^[A-Za-z0-9]+$/, `el token de ${o.op} no es alfanumérico`);
    assert.ok(o.token.length >= 8, `el token de ${o.op} es muy corto: puede aparecer por casualidad`);
  }
});

test('los tokens son únicos: dos operaciones no pueden confundirse', () => {
  // Con un token compartido, `operacionDelCuerpo` devuelve la primera del catálogo
  // y el sistema cree que aprendió la otra.
  const tokens = OPERACIONES.map((o) => o.token).filter(Boolean);
  assert.equal(new Set(tokens).size, tokens.length, 'hay un token repetido');
});

test('la frase CONTIENE su token', () => {
  // Si no, se le pide a la persona que escriba algo que el espejo no busca.
  for (const o of OPERACIONES) {
    if (o.como !== 'ancla') continue;
    assert.ok(o.frase, `${o.op} se aprende por ancla y no tiene frase`);
    assert.ok(o.token, `${o.op} se aprende por ancla y no tiene token`);
    assert.ok(
      String(o.frase).includes(String(o.token)),
      `la frase de ${o.op} no contiene su token`,
    );
  }
});

test('cuesta créditos exactamente cuando se aprende por ancla', () => {
  // Es la invariante que hace honesto el «cuántas generaciones pagadas faltan».
  // Una operación marcada `trafico` que en realidad cobre le cobraría al cliente sin
  // decirlo; una `ancla` marcada gratis le prometería algo que no se puede.
  for (const o of OPERACIONES) {
    assert.equal(
      o.cuesta, o.como === 'ancla',
      `${o.op}: como='${o.como}' y cuesta=${o.cuesta} no se corresponden`,
    );
  }
});

test('una operación que no se enseña no pide nada', () => {
  for (const o of OPERACIONES) {
    if (o.como !== 'ninguna') continue;
    assert.equal(o.token, null, `${o.op} no se enseña pero tiene token`);
    assert.equal(o.frase, null, `${o.op} no se enseña pero tiene frase`);
    assert.equal(o.cuesta, false, `${o.op} no se enseña y dice que cuesta`);
  }
});

test('el catálogo cubre las seis operaciones del producto', () => {
  // Si aparece un TipoTrabajo nuevo en flow-cola.ts y nadie lo suma acá, el puente
  // no lo va a poder aprender nunca — y el síntoma sería «genera uno a mano» para
  // siempre, sin error.
  const tipos = OPERACIONES.map((o) => o.tipo).sort();
  assert.deepEqual(tipos, [
    'creditos', 'enlace_clip', 'estado_clips', 'generar_clip', 'generar_imagen', 'subir_imagen',
  ], 'el catálogo y los TipoTrabajo de lib/flow-cola.ts se separaron');
  assert.equal(new Set(tipos).size, tipos.length, 'dos entradas para el mismo tipo');
});

test('dos generaciones pagadas dejan el puente completo', () => {
  // El número que se le promete a la persona. Si sube, hay que decirlo en el copy
  // antes de que lo descubra pagando.
  assert.equal(CUANTAS_PAGADAS, 2);
  assert.equal(A_ENSENAR.length, 5, 'las que hay que enseñar son cinco: tres gratis y dos pagas');
});

test('`dondeAparece` encuentra el ancla en un cuerpo form-urlencoded real', () => {
  const clip = OPERACIONES.find((o) => o.op === 'generar_clip');
  assert.ok(clip && clip.frase);
  const cuerpo = new URLSearchParams({
    'f.req': JSON.stringify([[['YhhmEf', JSON.stringify([clip.frase]), null, 'generic']]]),
  }).toString();
  assert.ok(dondeAparece(cuerpo, String(clip.token)), 'no encontró el token en un cuerpo real');
  // Y la frase entera NO aparece: es exactamente por qué el ancla es el token.
  assert.ok(!cuerpo.includes(String(clip.frase)), 'el test perdió su motivo');
});

test('`operacionDelCuerpo` distingue clip de imagen, y no inventa sobre un sondeo', () => {
  const clip = operacionDe('generar_clip');
  const img = operacionDe('generar_imagen');
  assert.ok(clip && img);
  const form = (t: string) => new URLSearchParams({ 'f.req': JSON.stringify([[t]]) }).toString();

  assert.equal(operacionDelCuerpo(form(String(clip.frase)))?.op, 'generar_clip');
  assert.equal(operacionDelCuerpo(form(String(img.frase)))?.op, 'generar_imagen');
  // Un sondeo no lleva ninguna frase: tiene que dar null, no la primera del catálogo.
  assert.equal(operacionDelCuerpo('f.req=%5B%5B%22ngNC2%22%5D%5D'), null);
  assert.equal(operacionDelCuerpo(null), null);
  assert.equal(operacionDelCuerpo(''), null);
});
