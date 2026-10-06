// =============================================================================
// Ads Manager: las credenciales son DEL WORKSPACE (tarea #170)
// =============================================================================
// Son asserts sobre el FUENTE, no sobre el comportamiento, y es a propósito:
// lib/meta-ads-create.ts y lib/workspace.ts llevan `server-only`, así que ningún
// test de node:test los puede importar. El precedente del repo es el mismo
// (tests/alerta-critica.test.ts).
//
// Cada assert fija una regresión que YA se puede escribir sin que nada falle:
// compila, pasa los otros 1924 tests, y deja el archivo cableado a la cuenta de
// Mauricio con el candado ya sacado. Ese es exactamente el peor estado posible.
// =============================================================================

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

const raiz = process.cwd();
const leer = (p: string) => readFileSync(join(raiz, p), 'utf8');
const CREATE = leer('lib/meta-ads-create.ts');
const GUARD = leer('lib/ads-guard.ts');

test('credWs va SIEMPRE con los dos argumentos', () => {
  // La forma de un argumento pasa por wsDefault (lib/credenciales.ts) y termina en
  // `?? OWNER_WS`, que es Mauricio — un CLIENTE. En un lib que solo LEE es feo; en
  // este, que CREA y BORRA con plata, es gastarle la cuenta a otro.
  assert.doesNotMatch(
    CREATE,
    /credWs\([^,)]*\)/,
    'credWs de un solo argumento cae a OWNER_WS = la cuenta de Mauricio',
  );
});

test('no se usa envCred: resuelve siempre contra el dueño', () => {
  // lib/meta-write.ts la usa y PARECE el precedente. No lo es: envCred resuelve
  // siempre contra OWNER_WS. Copiarla acá compila y pasa todos los tests.
  const codigo = CREATE.split('\n').filter((l) => !l.trim().startsWith('*') && !l.trim().startsWith('//'));
  assert.ok(
    !codigo.some((l) => l.includes('envCred')),
    'envCred resuelve contra el dueño: acá va credWs(clave, ws)',
  );
});

test('el único process.env que queda es META_API_VERSION', () => {
  // No es un secreto, la fija instrumentation y NO está en el catálogo BYOK
  // (lib/metodo-catalogo.ts): por credWs daría null y apagaría Ads Manager para
  // todos los clientes. El ternario es obligatorio, no cosmético.
  const usos = CREATE.split('\n')
    .filter((l) => !l.trim().startsWith('*') && !l.trim().startsWith('//'))
    .filter((l) => l.includes('process.env'));
  assert.equal(usos.length, 1, `process.env fuera de META_API_VERSION:\n${usos.join('\n')}`);
  assert.match(usos[0], /META_API_VERSION' \? process\.env/);
});

test('el page id del dueño solo aplica a OWNER_WS', () => {
  // El literal de lib/config.ts es la página de Mauricio. Usarlo sin la condición
  // publica el anuncio de un cliente en la página de otro, y Meta lo acepta.
  assert.match(
    CREATE,
    /credWs\('META_PAGE_ID', ws\)\) \?\? \(ws === OWNER_WS \? META_PAGE_ID : null\)/,
    'el fallback al page id del dueño tiene que estar acotado a OWNER_WS',
  );
});

test('sin estado mutable de módulo: cruzaría clientes', () => {
  // El memo del actor de Instagram era un `let` suelto, o sea un cubo compartido
  // por todos los clientes del proceso: el anuncio del B con el Instagram del A,
  // aceptado por Meta, sin error y con «listo» en la pantalla.
  assert.doesNotMatch(
    CREATE,
    /^(let|var) /m,
    'un memo de módulo en un lib per-workspace cruza clientes',
  );
});

test('el guard pregunta por ESTE workspace, y sigue exigiendo rol admin', () => {
  assert.ok(GUARD.includes('adminDeWorkspaceActual'), 'el gate va por adminDeWorkspaceActual');
  const codigo = GUARD.split('\n').filter((l) => !l.trim().startsWith('*') && !l.trim().startsWith('//'));
  // esWorkspaceDueno a secas no mira el ROL: con credenciales por workspace, el rol
  // es lo único que separa a un closer/setter de borrar campañas con plata.
  assert.ok(!codigo.some((l) => l.includes('esWorkspaceDueno')), 'esWorkspaceDueno no mira el rol');
});

test('las 14 rutas de Ads Manager pasan por el MISMO guard', () => {
  // El bug de la auditoría #167 fue justamente tener el chequeo del rol en UN solo
  // lugar y que las otras puertas se olvidaran de repetirlo.
  const dir = join(raiz, 'app/api/ads-manager');
  const rutas = readdirSync(dir);
  assert.ok(rutas.length >= 14, `esperaba al menos 14 rutas, encontré ${rutas.length}`);
  const sinGuard: string[] = [];
  for (const r of rutas) {
    const p = join(dir, r, 'route.ts');
    let src: string;
    try { src = readFileSync(p, 'utf8'); } catch { continue; }
    if (!src.includes('guardAdsWs')) sinGuard.push(r);
  }
  assert.deepEqual(sinGuard, [], `rutas de ads-manager sin guard: ${sinGuard.join(', ')}`);
});
