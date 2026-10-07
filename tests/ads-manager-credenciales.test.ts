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
  // lib/meta-write.ts la usó hasta el 07/10/2026 y PARECÍA el precedente. No lo es:
  // envCred resuelve siempre contra OWNER_WS. Copiarla acá compila y pasa todos los tests.
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

// =============================================================================
// Y las escrituras por metaWrite (pausar, presupuesto, renombrar, borrar) — 07/10/2026
// =============================================================================
// Hasta esa fecha lib/meta-write.ts leía el token con envCred, o sea la cuenta de
// Meta del ws1 para todos, y por eso estaba cerrada al ws1 en TRES puertas (el 403 de
// /api/meta-write, `soloWs1` en la def del doer y un `ctx.ws !== OWNER_WS` en cada
// runner). Abrir las puertas sin cambiar la credencial es el peor estado posible: un
// cliente pausa «su» campaña con el token de otro. Estos asserts fijan las dos mitades
// juntas: el ws viaja explícito Y es el mismo para el token y para el rename.
//
// Verificado rompiéndolo (07/10/2026), nueve roturas de a una, restaurando de memoria;
// cada una dio 1 fallo y 11 pases:
//   · volver a `envCred('META_ACCESS_TOKEN')` en meta-write
//   · `runWithWorkspace(OWNER_WS, …)` en propagarRename
//   · un call site `metaWrite(body)` sin el ws (ads.run)
//   · un call site `metaWrite(body, OWNER_WS)` (mako-doer-acciones)
//   · la ruta con `esDuenoAdmin()` en vez del guard
//   · `rolMinimo: 'admin'` fuera de G_META_ADMIN
//   · un `soloWs1` adentro de G_META_ADMIN
//   · estadoVivoMeta con envCred
//   · estadoVivoMeta llamado con OWNER_WS en vez de ctx.ws

const sinComentarios = (src: string) => src
  .replace(/\r\n/g, '\n')
  .replace(/^[ \t]*\/\/.*$/gm, '')
  .replace(/\/\*[\s\S]*?\*\//g, '');

const WRITE = sinComentarios(leer('lib/meta-write.ts'));

test('meta-write: el token sale de credWs con el ws que le pasan, nunca de envCred', () => {
  assert.ok(!WRITE.includes('envCred'), 'envCred resuelve siempre el ws1: un cliente escribiría en la cuenta de otro');
  assert.match(WRITE, /credWs\('META_ACCESS_TOKEN', ws\)/, 'el token tiene que salir del ws explícito');
  assert.match(WRITE, /export async function metaWrite\(body: MetaWriteBody, ws: number\)/, 'el ws es obligatorio en la firma');
});

test('meta-write: el rename se propaga en el MISMO ws del token', () => {
  // Token de un cliente y rename propagado a otro es el bug con la mitad arreglada.
  assert.ok(!/runWithWorkspace\(OWNER_WS/.test(WRITE), 'propagarRename no puede quedar clavado al ws1');
  assert.match(WRITE, /runWithWorkspace\(ws,/);
  assert.match(WRITE, /propagarRename\(ws,/);
});

test('todo call site de metaWrite pasa un ws, y nunca OWNER_WS a mano', () => {
  const archivos = [
    'app/api/meta-write/route.ts',
    'lib/api-mako/areas/ads.run.ts',
    'lib/mako-doer-acciones.ts',
  ];
  const malos: string[] = [];
  let llamadas = 0;
  for (const a of archivos) {
    const src = sinComentarios(leer(a));
    for (const m of src.matchAll(/(?<!function )metaWrite\(([^)]*)\)/g)) {
      llamadas++;
      const args = m[1].split(',').map((x) => x.trim()).filter(Boolean);
      if (args.length !== 2 || args[1] === 'OWNER_WS') malos.push(`${a}: metaWrite(${m[1]})`);
    }
  }
  assert.ok(llamadas >= 3, `esperaba al menos 3 llamadas, encontré ${llamadas}: ¿se mudó un call site?`);
  assert.deepEqual(malos, []);
});

test('/api/meta-write pasa por el guard de Ads Manager, no por el del ws1', () => {
  const RUTA = sinComentarios(leer('app/api/meta-write/route.ts'));
  assert.ok(!RUTA.includes('esDuenoAdmin'), 'esDuenoAdmin cierra la ruta al ws1');
  assert.match(RUTA, /wsDeAdsManager\(\)/, 'el ws sale del mismo guard que /api/ads-manager');
  assert.match(RUTA, /metaWrite\(body, ws\)/);
});

test('el doer: ninguna escritura a Meta queda cerrada al ws1, y todas exigen admin', () => {
  const DEF = sinComentarios(leer('lib/api-mako/areas/ads.def.ts'));
  assert.ok(!DEF.includes('soloWs1'), 'soloWs1 cierra la escritura a los clientes');
  // Sacar soloWs1 sacó también el chequeo de admin que traía: lo único que separa a un
  // closer de pausar o borrar campañas con plata es este rolMinimo.
  assert.match(DEF, /const G_META_ADMIN: Gating = \{[^}]*rolMinimo: 'admin'[^}]*\}/);
  const RUN = sinComentarios(leer('lib/api-mako/areas/ads.run.ts'));
  assert.ok(!RUN.includes('OWNER_WS'), 'un ctx.ws !== OWNER_WS en un runner vuelve a cerrar la escritura');
  assert.match(RUN, /estadoVivoMeta\(String\(p\.id\), ctx\.ws\)/, 'el estado que decide un borrado se lee en la cuenta que borra');
  const HELP = sinComentarios(leer('lib/api-mako/areas/ads.helpers.ts'));
  assert.ok(!HELP.includes('envCred'), 'estadoVivoMeta con envCred lee la cuenta del ws1');
});
