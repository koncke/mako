// =============================================================================
// La tarjeta de un cliente: nada de la cuenta de MaKo sin `cuentas.visible`
// =============================================================================
// «En el detail de un cliente, la tab de "Equipo" y en general todo lo que tenga que ver
// con invitar a MaKo, debería solo verse si la cuenta es AGENCIA, sino, no deberían estar
// esas opciones» (Martín, 05/10/2026). Quién es agencia lo decide el SERVER
// (`cuentas.visible`, app/customer-success/page.tsx); la TARJETA lo aplica en un solo
// lugar, y eso es lo que este archivo fija.
//
// Lo que había antes y por qué esto existe: el menú «Acciones» y el control de la cuenta
// miraban `cuentas.visible`, pero el chip del PLAN y el equipo se leían de
// `planPorWs`/`equipoPorWs` sin mirarlo. No se veía porque esos mapas llegan vacíos cuando
// no hay cartera aprobada — o sea por cómo los arma el server, no por una regla de la
// tarjeta. Que «se vea bien hoy» no protegía nada.
//
// ⚠️ ES UN GUARD DE CABLEADO Y NO UN RENDER, y no por gusto: la tarjeta no se puede montar
// desde node — `CuentaDeMaKo` arrastra un módulo con `server-only` (medido: «This module
// cannot be imported from a Client Component module», desde lib/workspace.ts). Por eso
// cada afirmación extrae su bloque antes de preguntar, y se pregunta sobre el código sin
// comentarios: el archivo explica en prosa lo que se sacó, y un `doesNotMatch` sobre la
// prosa se acusa a sí mismo.
//
// PROBADO ROMPIÉNDOLO: ver el pie, con los números.
// =============================================================================

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const leer = (p: string) => readFileSync(p, 'utf8').replace(/\r\n/g, '\n');
const sinComentarios = (src: string) => src
  .replace(/^[ \t]*\/\/.*$/gm, '')
  .replace(/\/\*[\s\S]*?\*\//g, '');

function bloque(src: string, abre: string, cierra: string): string {
  const i = src.indexOf(abre);
  assert.notEqual(i, -1, `no encontré el ancla de apertura: ${abre}`);
  const j = src.indexOf(cierra, i + abre.length);
  assert.notEqual(j, -1, `no encontré el ancla de cierre: ${cierra}`);
  return src.slice(i, j);
}

const CARD = sinComentarios(leer('app/customer-success/ClienteCard.tsx'));
const CUERPO = bloque(CARD, 'export function ClienteCard(', '\n}\n');

test('la condición se lee UNA vez, y de ahí cuelga el cliente que se mira', () => {
  assert.ok(CUERPO.length > 1_500 && CUERPO.length < 6_000, `el cuerpo mide ${CUERPO.length}`);
  assert.match(CUERPO, /const conCuentas = cuentas\?\.visible === true;/);
  // Una sola lectura: una segunda es la que se queda vieja el día que cambie la regla.
  assert.equal((CUERPO.match(/cuentas\?\.visible/g) ?? []).length, 1, 'la regla se escribe en UN lugar');
  // Sin `visible`, no hay cliente de MaKo que mirar: ni plan, ni equipo, ni reenviar.
  assert.match(CUERPO, /const ws = conCuentas \? \(c\.clienteWs \?\? null\) : null;/);
  assert.match(CUERPO, /const plan = ws \? cuentas\?\.planPorWs\?\.\[ws\] : undefined;/);
  assert.match(CUERPO, /const equipo = ws \? cuentas\?\.equipoPorWs\?\.\[ws\] : undefined;/);
});

test('los controles de la cuenta se dibujan sólo con la condición puesta', () => {
  const acciones = bloque(CUERPO, 'acciones={', '/>\n  );');
  assert.match(acciones, /acciones=\{conCuentas \|\| accionExtra \? \(/);
  assert.match(acciones, /\{conCuentas && cuentas && <CuentaDeMaKo /, 'el control de la cuenta (abrir, entrar)');
  assert.match(acciones, /\{conCuentas && opciones\.length > 0 && \(/, '«Reenviar el acceso» y «Ver su equipo»');
  // Y «Ver su equipo» sale de `equipo`, que sin la condición es undefined.
  assert.match(CUERPO, /\.\.\.\(equipo\?\.length \? \[\{ value: 'equipo'/);
  assert.match(CUERPO, /\.\.\.\(ws && admin \? \[\{ value: 'reinvitar'/);
});

// PROBADO ROMPIÉNDOLO (05/10/2026), con un arnés que muta en memoria y restaura de memoria:
//   1. `const ws = c.clienteWs ?? null;` (el chip del plan vuelve a leerse sin mirar
//      `visible`, que es el bug que había) → 1 pass / 1 fail, cae «la condición…».
//   2. `{cuentas && <CuentaDeMaKo …` sin `conCuentas` → 1 pass / 1 fail, cae «los controles…».
//   3. el Dropdown con su propia lectura `cuentas?.visible &&` → 0 pass / 2 fail: caen los
//      DOS, y es correcto — es a la vez la regla escrita en dos lugares y un control que ya
//      no cuelga de la condición única.
//   Restaurado (de memoria, nunca con `git checkout`): 2 pass / 0 fail.
