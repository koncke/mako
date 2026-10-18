// =============================================================================
// El super admin sin un negocio elegido no opera la cuenta de Mauricio (17/10/2026)
// =============================================================================
// `wsQuePuedeOperar` (lib/ads-guard.ts) caía a `OWNER_WS` cuando el super admin no tenía un negocio
// resuelto: «la agencia sin workspace opera el ws1, como siempre». El ws1 es Mauricio, un CLIENTE con
// plata real: abrir /ads-manager sin el `?ws=` y pausar, represupuestar o borrar tocaba sus campañas.
// Ahora sin negocio no se opera nada: las rutas contestan 409 «Elige primero el negocio» y la página
// lo dice antes de leer Meta.
//
// Son asserts sobre el FUENTE: lib/ads-guard.ts lleva `server-only` y depende de la sesión (el
// precedente es tests/ads-manager-credenciales.test.ts).
//
// Probado rompiéndolo (17/10/2026; base en verde: 4 pasan, 0 fallan). Cada rotura se aplicó, se corrió
// este archivo y se restauró (pasan / fallan):
//   · ads-guard: `? SIN_NEGOCIO : null` vuelve a `? OWNER_WS : null` (con su import)        -> 3 / 1
//   · ads-guard: guardAdsWs sin la línea de SIN_NEGOCIO (deja pasar al super admin)      -> 3 / 1
//   · ads-guard: wsDeAdsManager sin la línea de SIN_NEGOCIO (devuelve el string como ws)  -> 3 / 1
//   · AdsManagerView: el `if (await adsSinNegocio())` movido después de getSenalesRecon     -> 3 / 1
// =============================================================================

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const RAIZ = join(import.meta.dirname, '..');
const sinComentarios = (s: string) => s.replace(/\r\n/g, '\n').split('\n')
  .filter((l) => !/^\s*(\/\/|\*|\/\*\*)/.test(l)).join('\n');
const GUARD = sinComentarios(readFileSync(join(RAIZ, 'lib/ads-guard.ts'), 'utf8'));
const VISTA = sinComentarios(readFileSync(join(RAIZ, 'app/ads-manager/AdsManagerView.tsx'), 'utf8'));

const cuerpo = (src: string, firma: string): string => {
  const i = src.indexOf(firma);
  assert.ok(i >= 0, `no encontré ${firma}`);
  const j = src.indexOf('\n}\n', i);
  return src.slice(i, j);
};

test('el guard no nombra OWNER_WS: sin negocio no hay una cuenta «por defecto»', () => {
  assert.doesNotMatch(GUARD, /OWNER_WS/);
  assert.match(cuerpo(GUARD, 'async function wsQuePuedeOperar('), /\(await getSesionAdmin\(\)\) != null \? SIN_NEGOCIO : null/);
});

test('guardAdsWs corta al super admin sin negocio, con el 409 que lo dice', () => {
  const g = cuerpo(GUARD, 'export async function guardAdsWs(');
  assert.match(g, /if \(ws === SIN_NEGOCIO\) return sinNegocio\(\);/);
  assert.match(cuerpo(GUARD, 'function sinNegocio('), /status: 409/);
});

test('wsDeAdsManager nunca devuelve un workspace cuando no hay negocio', () => {
  const w = cuerpo(GUARD, 'export async function wsDeAdsManager(');
  assert.match(w, /if \(ws === SIN_NEGOCIO\) return sinNegocio\(\);/);
});

test('la página pide elegir el negocio ANTES de leer el rendimiento', () => {
  const iAviso = VISTA.indexOf('if (await adsSinNegocio())');
  const iLectura = VISTA.indexOf('getSenalesRecon(rangoDesde');
  assert.ok(iAviso > 0, 'AdsManagerView no mira adsSinNegocio');
  assert.ok(iAviso < iLectura, 'el aviso tiene que ir antes de leer');
});
