// =============================================================================
// El token de la vista de agencia dice QUIÉN, y vence
// =============================================================================
// Las dos propiedades que lo separan del de impersonación, y las dos existen
// por un modo de falla concreto:
//
//   · `firmarImpersonacion` firma SÓLO el número del workspace
//     (`w1.<wsId>.<firma>`), así que esa cookie es **portable entre sesiones**.
//     Hoy no importa porque únicamente la honra un admin global, que ya podía
//     entrar a cualquier lado. Acá sí importa: sin el sujeto adentro, la cookie
//     de la agencia pegada en otro navegador abriría los datos de su cliente.
//   · Sin `exp` firmado, el vencimiento lo promete la COOKIE (12 h en el de
//     impersonación) — y eso es una promesa del navegador, no del servidor: una
//     cookie copiada a mano, sin `max-age`, vale para siempre.
//
// ⚠️ Probado ROMPIÉNDOLO, dos veces, en lib/auth-session.ts. De 12/12:
//   (a) firmando sólo el cliente (`const body = String(clienteWs)`, leyendo con
//       `partes.length !== 3` y devolviendo la agencia cableada) — o sea,
//       copiando el token viejo — quedan 7 pases y **5 FALLOS**: «el token
//       nombra a la agencia…», «un token vencido no vale», los dos de cambiar
//       el cliente y la agencia a mano, y el de la basura.
//   (b) sacando sólo el `vence * 1000 < Date.now()` quedan 11 pases y **1
//       FALLO**: «un token vencido no vale». Uno solo, y alcanza: es la única
//       aserción del archivo que puede distinguir un token que caduca de uno
//       que no.

import test from 'node:test';
import assert from 'node:assert/strict';

import {
  firmarAgencia, leerAgencia, AGENCIA_COOKIE, AGENCIA_HORAS, firmarImpersonacion,
} from '../lib/auth-session';

// ⚠️ EL SECRETO SE FIJA ACÁ Y NO ANTES DEL IMPORT, y funciona porque `secret()`
// lee `process.env.AUTH_SECRET` **en cada llamada**, no al cargar el módulo. El
// import no se puede mover después: `tsx` transpila los tests a CJS y ahí no hay
// top-level await, así que `await import(...)` ni siquiera compila (medido: el
// archivo entero cuenta como 1 test fallado, sin correr ninguno). Es la misma
// familia que ya está en AGENTS.md sobre el `import()` dinámico bajo tsx.
//
// Y se fija explícito para que el archivo no dependa del .env de quien lo corra.
process.env.AUTH_SECRET = 'secreto-de-prueba-para-el-token-de-agencia';

const AGENCIA = 13, CLIENTE = 101, OTRA_AGENCIA = 77;

test('un token recién firmado se lee de vuelta entero', () => {
  const t = firmarAgencia(AGENCIA, CLIENTE);
  assert.ok(t, 'debería firmar con AUTH_SECRET puesto');
  assert.deepEqual(leerAgencia(t), { agenciaWs: AGENCIA, clienteWs: CLIENTE });
});

test('EL TOKEN NOMBRA A LA AGENCIA, no sólo al cliente', () => {
  // Es la propiedad entera: dos tokens al mismo cliente, desde agencias
  // distintas, tienen que ser distinguibles al leerlos.
  const deA = leerAgencia(firmarAgencia(AGENCIA, CLIENTE));
  const deB = leerAgencia(firmarAgencia(OTRA_AGENCIA, CLIENTE));
  assert.equal(deA?.agenciaWs, AGENCIA);
  assert.equal(deB?.agenciaWs, OTRA_AGENCIA);
  assert.notEqual(deA?.agenciaWs, deB?.agenciaWs);
});

test('un token de otra agencia no se puede reusar: el sujeto viaja firmado', () => {
  // El escenario real: la cookie de Juanfran pegada en otro navegador. El que
  // la descarta es `resolverDesdeCookies` comparando contra `sesion.ws`, y esto
  // es lo que le da con qué compararla.
  const robado = firmarAgencia(AGENCIA, CLIENTE);
  const leido = leerAgencia(robado);
  assert.equal(leido?.agenciaWs, AGENCIA);
  assert.notEqual(leido?.agenciaWs, OTRA_AGENCIA, 'el token no puede pasar por el de otra agencia');
});

test('un token vencido no vale', () => {
  const vencido = firmarAgencia(AGENCIA, CLIENTE, -1); // venció hace una hora
  assert.ok(vencido, 'se firma igual: lo que falla es leerlo');
  assert.equal(leerAgencia(vencido), null);
});

test('el vencimiento va FIRMADO: estirarlo a mano invalida el token', () => {
  const t = firmarAgencia(AGENCIA, CLIENTE)!;
  const p = t.split('.');
  p[3] = String(Number(p[3]) + 86_400);            // +1 día
  assert.equal(leerAgencia(p.join('.')), null);
});

test('cambiar el cliente a mano invalida el token', () => {
  const t = firmarAgencia(AGENCIA, CLIENTE)!;
  const p = t.split('.');
  p[2] = '999';
  assert.equal(leerAgencia(p.join('.')), null);
});

test('cambiar la agencia a mano invalida el token', () => {
  const t = firmarAgencia(AGENCIA, CLIENTE)!;
  const p = t.split('.');
  p[1] = String(OTRA_AGENCIA);
  assert.equal(leerAgencia(p.join('.')), null);
});

test('el token de impersonación NO se cuela por esta puerta', () => {
  // Son dos formatos y dos cookies. Si `leerAgencia` aceptara el viejo, la
  // agencia heredaría un token que no dice quién — que es justo lo que se vino
  // a arreglar.
  const viejo = firmarImpersonacion(CLIENTE);
  assert.ok(viejo);
  assert.equal(leerAgencia(viejo), null);
});

test('basura, vacío y prefijos ajenos dan null', () => {
  for (const v of ['', null, undefined, 'a1', 'a1.13.101', 'a1.13.101.999.x', 'w1.101.abc', 'a2.13.101.999.abc']) {
    assert.equal(leerAgencia(v as string), null, `«${String(v)}» no debería valer`);
  }
});

test('una agencia no puede firmarse un token hacia sí misma', () => {
  assert.equal(firmarAgencia(AGENCIA, AGENCIA), null);
});

test('ids inválidos no se firman', () => {
  for (const [a, c] of [[0, 101], [13, 0], [-1, 101], [1.5, 101], [13, -2]] as const) {
    assert.equal(firmarAgencia(a, c), null, `(${a}, ${c}) no debería firmarse`);
  }
});

test('la cookie y la ventana están declaradas y son las esperadas', () => {
  assert.equal(AGENCIA_COOKIE, 'mako_agencia');
  assert.notEqual(AGENCIA_COOKIE, 'mako_ws', 'no comparte cookie con la impersonación vieja');
  assert.ok(AGENCIA_HORAS > 0 && AGENCIA_HORAS <= 24);
});
