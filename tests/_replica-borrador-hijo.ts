// =============================================================================
// Hijo de tests/replica-borrador.test.ts — NO es un test (no termina en .test.ts)
// =============================================================================
// Corren REALES, con la sesión de mentira y un PostgREST de mentira: la ruta de lectura (/replicar/leer, con texto pegado: sin
// red y sin IA), la de borradores (/replicar/borrador) y la de replicar (/replicar) con `replicar()` de mentira (la copia sale
// bien sin IA) para ver que borra el borrador. Ticket #54.
// Necesita `--conditions=react-server` y `--experimental-test-module-mocks`.
// =============================================================================

import { mock } from 'node:test';
import { AsyncLocalStorage } from 'node:async_hooks';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { crearPostgrest } from './_postgrest-de-mentira';

const RAIZ = join(import.meta.dirname, '..');
process.env.SUPABASE_URL = 'http://supa.test';
process.env.NEXT_PUBLIC_SUPABASE_URL = 'http://supa.test';
process.env.SUPABASE_SERVICE_ROLE_KEY = 'clave-de-prueba';
process.env.SUPABASE_SERVICE_KEY = 'clave-de-prueba';
process.env.AUTH_SECRET = 'secreto-de-firma-de-prueba-suficientemente-largo';
process.env.APP_BASE_URL = 'https://mako.test';

const NEGOCIO = 30, OTRO = 31, PLATAFORMA = 9;
type Pedido = { ws: number; rolWs: string };
const pedido = new AsyncLocalStorage<Pedido>();
const actual = (): Pedido => { const p = pedido.getStore(); if (!p) throw new Error('fuera de un pedido'); return p; };

const pg = crearPostgrest({
  tablas: ['app_settings', 'workspaces', 'usuarios', 'credenciales', 'landing_docs'],
  unicos: [{ tabla: 'app_settings', columnas: ['workspace_id', 'key'], donde: () => true, nombre: 'app_settings_uk' }],
});
const db = pg.db as Record<string, Array<Record<string, unknown>>>;
db.workspaces = [
  { id: PLATAFORMA, nombre: 'MaKo', capa: 'superadmin', estado: 'activo' },
  { id: NEGOCIO, nombre: 'Estudio Luna', capa: 'completo', estado: 'activo' },
  { id: OTRO, nombre: 'Otro', capa: 'completo', estado: 'activo' },
];
const red: string[] = [];
globalThis.fetch = (async (entrada: RequestInfo | URL, init: RequestInit = {}) => {
  const u = new URL(typeof entrada === 'string' ? entrada : entrada instanceof URL ? entrada.href : (entrada as Request).url);
  if (u.host === 'supa.test') return pg.responder(u, init);
  red.push(u.host);
  return new Response(JSON.stringify({ error: `red de mentira: ${u.host}` }), { status: 500 });
}) as typeof fetch;

/** Todo lo que el módulo exporta, de mentira; arriba, lo que este arnés necesita. */
function stub(rel: string, propios: Record<string, unknown>): void {
  const src = readFileSync(join(RAIZ, rel), 'utf8');
  const nombres = [...src.matchAll(/^export (?:async )?(?:function\*? |const |let )(\w+)/gm)].map((m) => m[1]);
  const namedExports: Record<string, unknown> = {};
  for (const n of nombres) namedExports[n] = () => { throw new Error(`${rel}: ${n} sin mock`); };
  mock.module(pathToFileURL(join(RAIZ, rel)).href, { namedExports: { ...namedExports, ...propios } });
}

stub('lib/auth.ts', {
  getUsuarioActual: async () => {
    const p = actual();
    return { sub: 'u', email: `admin${p.ws}@luna.test`, nombre: 'Quien mira', rol: 'usuario', ws: p.ws, rolWs: p.rolWs, exp: 0 };
  },
  getSesionAdmin: async () => null,
});
// La copia sale bien sin IA (lo de replicar se prueba en sus tests): acá se mira que la ruta borre el borrador.
let replicadas = 0;
stub('lib/editor-landing/replicar.ts', {
  replicar: async () => { replicadas++; return { ok: true, status: 200, id: 500 + replicadas, titulo: 'Copia', secciones: 3, formato: 'landing' }; },
});

const URL_PAGINA = 'leandro-ejemplo.com/curso';
const TEXTO = '# Aprende a vender\nUn curso para vender más.\n\n# Lo que vas a lograr\n• Más clientes\n• Más ventas\n\n# Precio\nUS$97\n[BOTÓN] Quiero entrar';

async function main() {
  mock.module('next/headers', {
    namedExports: {
      cookies: async () => ({ get: () => undefined }),
      headers: async () => ({ get: () => null }),
    },
  });
  const leerRuta = await import('../app/api/landing-generator/replicar/leer/route');
  const borradorRuta = await import('../app/api/landing-generator/replicar/borrador/route');
  const replicarRuta = await import('../app/api/landing-generator/replicar/route');

  const como = <T>(p: Pedido, fn: () => Promise<T>) => pedido.run(p, fn);
  const admin = { ws: NEGOCIO, rolWs: 'admin' };
  const json = async (r: Response) => ({ status: r.status, cuerpo: await r.json().catch(() => null) as Record<string, unknown> | null });
  const borradorUrl = (u: string) => `https://mako.test/api/landing-generator/replicar/borrador?url=${encodeURIComponent(u)}`;
  const R: Record<string, unknown> = {};

  // 1. Leer guarda el borrador, con lo elegido.
  const eleccion = { partes: ['diseno', 'estructura', 'angulos'], formato: 'landing', oferta: 'Mentoría de 8 semanas', tema: null, adaptar: true };
  R.leer = await como(admin, async () => json(await leerRuta.POST(new Request('https://mako.test/x', {
    method: 'POST', body: JSON.stringify({ url: URL_PAGINA, texto: TEXTO, angulos: false, eleccion }),
  }))));
  R.filas = db.app_settings.filter((f) => String(f.key).startsWith('landing.replica_borrador:')).map((f) => ({ ws: f.workspace_id, key: f.key }));

  // 2. Al volver, se retoma con lo leído y lo elegido (la dirección como la escribió, con o sin https).
  R.retomar = await como(admin, async () => json(await borradorRuta.GET(new Request(borradorUrl(`https://${URL_PAGINA}`)))));
  R.lista = await como(admin, async () => json(await borradorRuta.GET(new Request('https://mako.test/api/landing-generator/replicar/borrador'))));

  // 3. Lo que va eligiendo se guarda.
  R.cambiar = await como(admin, async () => json(await borradorRuta.POST(new Request('https://mako.test/x', {
    method: 'POST', body: JSON.stringify({ url: URL_PAGINA, eleccion: { ...eleccion, oferta: 'Mentoría de 12 semanas', formato: 'presentacion' } }),
  }))));
  R.trasCambiar = await como(admin, async () => json(await borradorRuta.GET(new Request(borradorUrl(URL_PAGINA)))));
  // Cambiar lo elegido de una página sin borrador no crea nada.
  R.cambiarSinBorrador = await como(admin, async () => json(await borradorRuta.POST(new Request('https://mako.test/x', {
    method: 'POST', body: JSON.stringify({ url: 'otra-pagina.com', eleccion }),
  }))));

  // 4. Aislamiento: otro negocio no lo ve, y un closer no entra.
  R.otroNegocio = await como({ ws: OTRO, rolWs: 'admin' }, async () => json(await borradorRuta.GET(new Request(borradorUrl(URL_PAGINA)))));
  R.otroLista = await como({ ws: OTRO, rolWs: 'admin' }, async () => json(await borradorRuta.GET(new Request('https://mako.test/api/landing-generator/replicar/borrador'))));
  R.closer = await como({ ws: NEGOCIO, rolWs: 'closer' }, async () => (await borradorRuta.GET(new Request(borradorUrl(URL_PAGINA)))).status);

  // 5. Descartar lo borra.
  R.descartar = await como(admin, async () => json(await borradorRuta.DELETE(new Request(borradorUrl(URL_PAGINA), { method: 'DELETE' }))));
  R.trasDescartar = await como(admin, async () => json(await borradorRuta.GET(new Request(borradorUrl(URL_PAGINA)))));

  // 6. La réplica que sale bien borra su borrador (con y sin «en vivo»).
  for (const enVivo of [false, true]) {
    await como(admin, async () => leerRuta.POST(new Request('https://mako.test/x', { method: 'POST', body: JSON.stringify({ url: URL_PAGINA, texto: TEXTO, angulos: false, eleccion }) })));
    const antes = db.app_settings.filter((f) => String(f.key).startsWith('landing.replica_borrador:')).length;
    const r = await como(admin, async () => replicarRuta.POST(new Request('https://mako.test/x', {
      method: 'POST', body: JSON.stringify({ url: `https://${URL_PAGINA}`, formato: 'landing', texto: TEXTO, enVivo }),
    })));
    await r.text();
    const despues = db.app_settings.filter((f) => String(f.key).startsWith('landing.replica_borrador:')).length;
    R[enVivo ? 'replicarEnVivo' : 'replicar'] = { antes, despues, status: r.status };
  }

  // 7. El tope: con nueve páginas leídas quedan las ocho más nuevas.
  for (let i = 0; i < 9; i++) {
    await como(admin, async () => leerRuta.POST(new Request('https://mako.test/x', { method: 'POST', body: JSON.stringify({ url: `pagina-${i}.com`, texto: TEXTO, angulos: false }) })));
    await new Promise((r) => setTimeout(r, 5));
  }
  const tope = await como(admin, async () => json(await borradorRuta.GET(new Request('https://mako.test/api/landing-generator/replicar/borrador'))));
  R.tope = ((tope.cuerpo?.borradores ?? []) as Array<{ host: string }>).map((b) => b.host);

  R.red = red;
  process.stdout.write(`@@RESULTADO@@${JSON.stringify(R)}`);
}

main().catch((e) => { process.stdout.write(`@@RESULTADO@@${JSON.stringify({ error: e instanceof Error ? `${e.message}\n${e.stack}` : String(e) })}`); });
