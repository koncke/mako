// =============================================================================
// La tarjeta de un cliente de Clients: NADA de la cuenta de MaKo (desde el 17/10/2026)
// =============================================================================
// Martín, 17/10/2026: «crear una tab de "Agencia"... "MaKo Partners"... ahí deberían vivir los clientes de agencia,
// que no son los mismos que "client": podrían serlo como no» (docs/diseno-clients.md, D8). Hasta ese día la tarjeta de
// Clients dibujaba, en una agencia, el plan de la cuenta de MaKo del cliente, «Inspeccionar», «Reenviar el acceso»,
// «Ver su equipo» y «Nadie puede entrar todavía», colgados de `cuentas.visible` (05/10/2026). Todo eso se mudó a MaKo
// Partners, y este archivo fija las dos mitades:
//   1. la tarjeta de Clients no vuelve a dibujar nada de la cuenta (ni un flag dormido que lo prenda);
//   2. lo que hacía no se perdió: «Reenviar el acceso» y «Nadie puede entrar» viven en Partners, en la computadora y
//      en el teléfono.
//
// ⚠️ ES UN GUARD DE CABLEADO Y NO UN RENDER: se pregunta sobre el código sin comentarios (el archivo explica en prosa lo
// que se sacó, y un `doesNotMatch` sobre la prosa se acusa a sí mismo).
//
// PROBADO ROMPIÉNDOLO (17/10/2026), cada rotura sola, restaurada de una copia (nunca con `git checkout`, que se lleva
// lo que no está commiteado):
//   1. la tarjeta vuelve a pintar el chip del plan (`cl-plan`)                        → 1 fallo (1)
//   2. vuelve «Reenviar el acceso» al menú de la tarjeta (`reinvitar`)                 → 1 fallo (1)
//   3. Partners dice «Nadie puede entrar» con `!== 1` en vez de `=== 0`               → 1 fallo (2), y otro en
//      tests/perfil-vista-de-otro.test.ts («MaKo Partners dice…»)
//   4. el teléfono pierde «Reenviar a …»                                              → 1 fallo (2)
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

test('la tarjeta de Clients no dibuja nada de la cuenta de MaKo, ni guarda un flag que lo prenda', () => {
  assert.ok(CUERPO.length > 1_000 && CUERPO.length < 6_000, `el cuerpo mide ${CUERPO.length}`);
  for (const [rotulo, re] of [
    ['la vista de agencia', /cuentas\??\.visible|conCuentas/],
    ['el control de la cuenta', /CuentaDeMaKo/],
    ['el chip del plan', /cl-plan|planPorWs/],
    ['el equipo', /equipoPorWs|value: 'equipo'/],
    ['«Reenviar el acceso»', /reinvitar/],
    ['«Nadie puede entrar»', /Nadie puede entrar/],
  ] as const) assert.doesNotMatch(CARD, re, `volvió ${rotulo} a la tarjeta de Clients`);
  // La fila de acciones queda para lo del curso (o lo que ponga la pantalla): sin ninguna, no hay fila.
  assert.match(CUERPO, /acciones=\{accionExtra \|\| opciones\.length > 0 \? \(/);
});

test('lo que hacía no se perdió: «Reenviar el acceso» y «Nadie puede entrar» viven en MaKo Partners', () => {
  const app = sinComentarios(leer('app/partners/PartnersApp.tsx'));
  // `[]` es «leí y no hay nadie»; `null`, «no pude leer»: sólo el primero afirma que nadie entra.
  assert.match(app, /if \(c\.estado === 'aprobado' && c\.equipo\?\.length === 0\) return \{ texto: 'Nadie puede entrar', tono: 'warn' \};/);
  assert.match(app, /fetch\('\/api\/agencia\/reinvitar'/);
  assert.match(app, /Reenviar el acceso a \$\{quienManeja\.nombre\}/);
  // En el teléfono, la cartera es AgencyM (PartnersM no lo montaba nadie y se borró el 3/11/2026).
  const movil = sinComentarios(leer('app/m/agency/AgencyM.tsx'));
  assert.match(movil, /if \(c\.estado === 'aprobado' && c\.equipo\?\.length === 0\) return \{ texto: 'Nadie puede entrar', tono: 'warn' \};/);
  assert.match(movil, /fetch\('\/api\/agencia\/reinvitar'/);
  assert.match(movil, /Reenviar a \$\{quien\.nombre\}/);
});
