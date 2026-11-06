// =============================================================================
// Las LECTURAS del Ops Center van por GET, no por server action (23/10/2026)
// =============================================================================
// Martín, 23/10/2026: «Second Brain tarda muchísimo… lo mismo si abro "USO de IA", no hay un loader». Next corre las server
// actions de a una por cliente: `pushesCentroAction` (hasta 8 s esperando a Vercel) y el refresco del Centro cada 2,5-8 s
// dejaban en la cola a la Ticketera y al Uso. Por GET (app/api/operaciones/lectura) van en paralelo.
//
// Este test fija: la lista de lecturas y la ruta dicen lo mismo; la ruta usa las MISMAS acciones (que chequean al super
// admin con su segundo factor); quien lee ya no llama a la acción; y `leerCentro` tira con un no-200 como tiraba la acción.
// ROTURAS (23/10/2026, una por vez y restaurada; base 4 / 0): useCentro con `pushesCentroAction()` de vuelta → 3 / 1; una
// lectura nueva en LECTURAS_CENTRO sin su entrada en la ruta → 3 / 1; `leerCentro` sin el `if (!r.ok)` → 3 / 1.
// Correr: node --import tsx --test tests/ops-center-lecturas-get.test.ts
// =============================================================================
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { LECTURAS_CENTRO, leerCentro } from '../app/admin/operaciones/lectura-centro';

const RAIZ = join(dirname(fileURLToPath(import.meta.url)), '..');
const leer = (rel: string) => readFileSync(join(RAIZ, rel), 'utf8').replace(/\r\n/g, '\n');
const sinComentarios = (src: string) => src.replace(/^[ \t]*\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '');

test('la ruta tiene una entrada por cada lectura de la lista, y cada una es la acción de siempre', () => {
  const ruta = sinComentarios(leer('app/api/operaciones/lectura/route.ts'));
  const bloque = ruta.slice(ruta.indexOf('const LEER'), ruta.indexOf('};', ruta.indexOf('const LEER')));
  const claves = [...bloque.matchAll(/^\s+(\w+): \(/gm)].map((m) => m[1]);
  assert.deepEqual(claves.sort(), [...LECTURAS_CENTRO].sort());
  for (const a of ['pushesCentroAction()', 'fotoCentroAction()', 'creditoApiAction()', "computadorasDelNegocioAction(Number(req.nextUrl.searchParams.get('ws')))", "leerBandejaAction(req.nextUrl.searchParams.get('vista') === '1')",
    "turnosCentroAction(req.nextUrl.searchParams.getAll('l'), req.nextUrl.searchParams.get('dir') ?? undefined)"]) {
    assert.ok(bloque.includes(a), `la lectura ya no pasa por ${a}: la acción es la que chequea al super admin`);
  }
  assert.match(ruta, /status: 400/, 'una lectura que no existe tiene que dar 400, no tirar');
});

test('quien lee ya no llama a la acción (volvería a la cola)', () => {
  const centro = sinComentarios(leer('app/admin/operaciones/useCentro.ts'));
  for (const a of ['pushesCentroAction', 'fotoCentroAction', 'creditoApiAction', 'computadorasDelNegocioAction', 'turnosCentroAction']) {
    assert.doesNotMatch(centro, new RegExp(`\\b${a}\\(`), `useCentro volvió a leer con ${a}`);
  }
  for (const q of ['foto', 'pushes', 'credito']) assert.ok(centro.includes(`leerCentro<`) && centro.includes(`('${q}')`), `falta leerCentro('${q}')`);
  // Las computadoras ya no son del Centro (23/10/2026): las lee la ficha de UN cliente. Desde el 6/11/2026 (la copia de Polar)
  // esa ficha las lee en el SERVER, con su negocio (`listarPcDelNegocio(ws)`), y no llama a la acción (haría cola).
  const ficha = sinComentarios(leer('app/admin/_polar/datos/cliente-server.ts'));
  assert.match(ficha, /listarPcDelNegocio\(ws\)/);
  assert.doesNotMatch(ficha, /\bcomputadorasDelNegocioAction\(/, 'la ficha volvió a leer con la acción (haría cola)');
  assert.match(centro, />\('turnos', \{ l: locales, dir: claveParaUrl\(c\) \}\)\.catch\(\(\) => null\);/);
  const bandeja = sinComentarios(leer('app/tickets/bandeja/BandejaTickets.tsx'));
  assert.doesNotMatch(bandeja, /leerBandejaAction/);
  assert.match(bandeja, /leerCentro<LecturaBandeja>\('bandeja', conVista \? \{ vista: '1' \} : \{\}\)/);
});

test('leerCentro arma el pedido y tira con un no-200, como tiraba la acción con un 503', async () => {
  const fetchReal = globalThis.fetch;
  const pedidos: string[] = [];
  try {
    globalThis.fetch = (async (u: string) => { pedidos.push(u); return new Response(JSON.stringify({ ok: true, n: 1 }), { status: 200 }); }) as typeof fetch;
    assert.deepEqual(await leerCentro('bandeja', { vista: '1' }), { ok: true, n: 1 });
    assert.equal(pedidos[0], '/api/operaciones/lectura?que=bandeja&vista=1');
    // Una lista va repetida: la ruta la lee con getAll('l').
    await leerCentro('turnos', { l: ['local_a', 'local_b'], dir: 'local_a' });
    assert.equal(pedidos[1], '/api/operaciones/lectura?que=turnos&l=local_a&l=local_b&dir=local_a');
    globalThis.fetch = (async () => new Response('caído', { status: 503 })) as unknown as typeof fetch;
    await assert.rejects(leerCentro('foto'), /«foto» contestó 503/);
  } finally {
    globalThis.fetch = fetchReal;
  }
});

test('la ruta es PRIVADA: no está en la lista de rutas públicas (la de cartero sí, y es otra)', () => {
  const pub = leer('lib/rutas-publicas.ts');
  assert.doesNotMatch(pub, /'\/api\/operaciones\/lectura'|'\/api\/operaciones'/);
});
