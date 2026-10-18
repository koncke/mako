// =============================================================================
// Mirando a un cliente, el super admin NUNCA ve el Centro (sus chats) en la cuenta del cliente (18/10/2026)
// =============================================================================
// Martín, punto 13 (Cliente de Prueba): «Cuando ingresé a la app me saltaron todos los chats míos del Ops Center, de
// SuperAdmin, eso está terriblemente mal». La causa: `quienOpera()` miraba sólo la sesión (`getSesionAdmin`), cuyo `ws`
// es el PROPIO del super admin, no el que está mirando; inspeccionando el ws 3 seguía «operando» y /second-brain lo
// llevaba al Centro de la plataforma. Un cliente de verdad no lo veía (no es admin): era la vista «como el cliente».
//
// ROTURAS (18/10/2026, arnés romper-centro.js del scratchpad; base 2/0): sin mirar si inspecciona → 1/1 · el Centro se
// lee aunque no opere → 1/1.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const leer = (rel: string) => readFileSync(join(__dirname, '..', rel), 'utf8').replace(/\r\n/g, '\n');

test('quienOpera dice que no mientras se mira a un cliente', () => {
  const src = leer('app/second-brain/pagina.tsx');
  const i = src.indexOf('export async function quienOpera()');
  assert.match(src.slice(i, i + 300), /if \(await estaImpersonando\(\)\) return false;\s*return puedeOperar\(await getSesionAdmin\(\), await wsSuperAdmin\(\)\);/,
    'el super admin que inspecciona a un cliente vuelve a ver el Centro de la plataforma');
});

test('la página no lee el Centro si quien mira no opera', () => {
  assert.match(leer('app/second-brain/page.tsx'), /const centro = \(await quienOpera\(\)\) \? await datosDelCentroSiOpera\(\)\.catch\(\(\) => null\) : null;/,
    'los chats del super admin se leen aunque esté mirando a un cliente');
});
