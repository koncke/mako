// =============================================================================
// La clave de generación es de la PLATAFORMA, no de la fila de un cliente (7/11/2026)
// =============================================================================
// ⚠️ ESTO EXISTE PORQUE LA TRAMPA ES INVISIBLE Y YA SE PAGÓ DOS VECES EN ESTE REPO.
//
// `envCred(clave)` resuelve contra `wsDelEntorno(clave)`, que devuelve `wsSuperAdmin()` **sólo si la clave es
// "de la plataforma"**; si no, devuelve `OWNER_WS`. Y `OWNER_WS` vale 1, y el workspace 1 es **Mauricio, un
// CLIENTE**. O sea: una clave de plataforma que no esté marcada como tal se lee de la fila de un cliente, sin
// error, sin log y sin que nada falle — hasta el día que ese cliente pega la suya y todo MaKo pasa a generar
// con su cuenta.
//
// Ya pasó con `RESEND_API_KEY` (4/11: los avisos de MaKo salían por la cuenta de Mauricio) y está escrito como
// aviso en `lib/elevenlabs.ts`. ApiMart es el tercer caso, y acá es plata directa: cada generación se cobra.
//
// Martín, 7/11: «muchos clientes no tienen Flow… quiero poder ofrecerles otra API» y «para que **nosotros**
// costeemos eso». A un negocio no se le puede pedir que saque una clave de un modelo de video: la pone MaKo.
//
// Correr: node --import tsx --test tests/apimart-clave-de-plataforma.test.ts
// =============================================================================

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { esClaveDeIA } from '../lib/ia-keys';
import { DEFS } from '../lib/integraciones-catalogo';

const RAIZ = join(import.meta.dirname, '..');
const CLAVE = 'APIMART_API_KEY';

test('la clave de ApiMart sale de la PLATAFORMA, no del workspace de un cliente', () => {
  // `wsDelEntorno` = `saleDeLaPlataforma(clave) ? wsSuperAdmin() : OWNER_WS`, y `saleDeLaPlataforma` es
  // `esClaveDeIA || esClaveDeCorreoDeLaPlataforma`. Marcarla acá es LO ÚNICO que la saca de la fila del ws1.
  assert.equal(esClaveDeIA(CLAVE), true,
    `${CLAVE} no está marcada como clave de plataforma: se leería de la fila del ws1, que es un cliente`);
});

test('el `env` del catálogo es EXACTAMENTE el que lee el código', () => {
  // El error clásico de este repo, y el peor porque no tira nada: si el catálogo dice `APIMART_KEY` y la lib
  // lee `APIMART_API_KEY`, la credencial se guarda, la pantalla la muestra conectada, y `credWs` devuelve
  // null en silencio. Se descubre cuando un cliente reporta que no genera.
  const enIntegraciones = DEFS.find((i) => i.key === 'apimart');
  assert.ok(enIntegraciones, 'ApiMart no está en integraciones-catalogo: no aparece en ninguna pantalla');
  assert.deepEqual(enIntegraciones.envs, [CLAVE], 'el env del catálogo de integraciones no coincide');

  // `metodo-catalogo` es `server-only` y los tests corren sin `--conditions react-server`, así que se lee
  // como texto. No es menos estricto: lo que se compara es la misma cadena.
  const metodo = readFileSync(join(RAIZ, 'lib/metodo-catalogo.ts'), 'utf8');
  assert.match(metodo, /key: 'apimart'/, 'ApiMart no está en metodo-catalogo: no hay dónde pegar la clave');
  assert.match(metodo, new RegExp(`env: '${CLAVE}'`), 'el env de metodo-catalogo no coincide con el que lee el código');
});

test('un NEGOCIO no puede escribir la clave de generación de la plataforma', () => {
  // ⚠️ Es un guard de plata, no de permisos. Si un negocio pegara SU clave de ApiMart, pagaría una generación
  // que MaKo ya le cobró en MaKo Tokens: cobrarle dos veces por la misma pieza.
  //
  // El flag tiene que ser `soloPlataforma` y NO `oculto`: `oculto` la esconde de TODOS, incluido el superadmin,
  // que es justo el único que tiene que pegarla. Y es `soloPlataforma` lo que lee el guard del endpoint
  // (app/api/integraciones/credencial: `if (s.soloPlataforma && !ctx.esPlataforma) return undefined`).
  const i = DEFS.find((x) => x.key === 'apimart');
  assert.equal(i?.soloPlataforma, true, 'ApiMart no está marcada como de plataforma: un negocio puede escribirla');
  assert.notEqual(i?.oculto, true, 'está `oculto`: el superadmin tampoco la ve, y es el único que la pega');

  // El guard del endpoint lee el catálogo de MÉTODO, así que el flag tiene que estar en los DOS.
  const metodo = readFileSync(join(RAIZ, 'lib/metodo-catalogo.ts'), 'utf8');
  const fila = metodo.slice(metodo.indexOf("key: 'apimart'"));
  assert.match(fila.slice(0, 900), /soloPlataforma: true/,
    'falta `soloPlataforma` en metodo-catalogo: el guard del endpoint no se activa y un negocio puede escribirla');
});

test('la lib lee ESA clave y no otra, y no se la pide a credWs', () => {
  // ⚠️ `credWs` cae al env sólo cuando el workspace es OWNER_WS: para cualquier otro devuelve null, así que
  // TODA generación de TODO cliente fallaría con «clave no configurada» — y las filas quedarían en
  // `status='error'`, que es reintentable, y el cron las levantaría a fallar para siempre. El corolario está
  // escrito en la memoria del BYOK y es el modo de falla más caro de esta familia.
  const reglas = readFileSync(join(RAIZ, 'lib/apimart-reglas.ts'), 'utf8');
  assert.ok(!/credWs\s*\(/.test(reglas), 'las reglas de ApiMart llaman a credWs: con eso ningún cliente genera');
  assert.match(reglas, /credWs/, 'las reglas no dejan dicho POR QUÉ no se usa credWs: el próximo lo va a cablear así');
});
