// =============================================================================
// Hijo de tests/agente-token-equivocado.test.ts — NO es un test (no termina en .test.ts)
// =============================================================================
// El ticket #60 de punta a punta (9/11/2026). La revisión de b5f621c6f encontró que el test sólo probaba la regla pura y
// buscaba texto en los fuentes: seis mutaciones REALES quedaban en verde (que `rechazoAgente` volviera a decir «token
// inválido o revocado», que contestara 200, que no mirara la cabecera, que `bearerDe` devolviera siempre '', que una ruta
// rechazara siempre). Lo que une la regla con las rutas no lo probaba nadie.
//
// Este hijo corre el código REAL (lib/agente-token.ts, lib/api-mako/tokens.ts y las siete rutas de app/api/agente) con
// pedidos de verdad, contra un PostgREST de mentira, en un node aparte con `--conditions=react-server`. Acuña un token
// clásico (`mkoag_`) y uno detallado (`mako_pat_`) en el mismo negocio, y le pega a cada ruta con cada cabecera.
// Nada sale a la red: lo que no es la base se anota en `red`.
//
// Corre con: node --conditions=react-server --import tsx tests/_agente-token-equivocado-hijo.ts
// Imprime el resultado después de la marca @@RESULTADO@@.
// =============================================================================

import { crearPostgrest } from './_postgrest-de-mentira';

let siguienteId = 9000;
const ahoraIso = () => new Date().toISOString();
const pg = crearPostgrest({
  tablas: ['workspaces', 'usuarios', 'app_settings', 'webhook_routing', 'api_llamadas'],
  defaults: (tabla, f) => (tabla === 'app_settings' ? { updated_at: ahoraIso(), ...f } : { id: siguienteId++, created_at: ahoraIso(), ...f }),
  unicos: [{ tabla: 'app_settings', nombre: 'app_settings_pkey', columnas: ['workspace_id', 'key'], donde: () => true }],
});

const red: string[] = [];
globalThis.fetch = (async (entrada: RequestInfo | URL, init: RequestInit = {}) => {
  const u = new URL(typeof entrada === 'string' ? entrada : entrada instanceof URL ? entrada.href : entrada.url);
  if (u.host === 'supa.test') return pg.responder(u, init);
  red.push(u.host + u.pathname);
  return new Response(JSON.stringify({ error: 'red de mentira' }), { status: 500 });
}) as typeof fetch;

process.env.NEXT_PUBLIC_SUPABASE_URL = 'http://supa.test';
process.env.SUPABASE_URL = 'http://supa.test';
process.env.SUPABASE_SERVICE_ROLE_KEY = 'service-role-de-prueba';

const WS = 3;
pg.db.workspaces.push({ id: WS, nombre: 'Cliente de Prueba', capa: 'completo', estado: 'activo' });

/** Las cabeceras que se le mandan a `bearerDe`: el test las compara con la regla de main, una por una. */
const MATRIZ_BEARER = [
  null, '', '   ', 'Bearer abc', 'bearer abc', 'BEARER   abc  ', 'Bearer\tabc', 'Bearer', 'Bearer ',
  'token abc', 'Token abc', 'TOKEN   abc', 'token Bearer abc', 'Basic abc', 'abc', 'Bearer a b',
];

async function main() {
  const { bearerDe, rechazoAgente, rotarAgenteToken } = await import('../lib/agente-token');
  const { crearToken } = await import('../lib/api-mako/tokens');
  const { NextRequest } = await import('next/server');

  const clasico = (await rotarAgenteToken(WS, 'proponer', '')).token;
  const det = await crearToken(WS, { nombre: 'Para Codex', descripcion: '', permisos: { plan: 'lectura' }, expiracion: '30', actor: '' });
  if ('error' in det) throw new Error(`crearToken: ${det.error}`);
  const detallado = det.token;

  const rutas = {
    consultar: (await import('../app/api/agente/consultar/route')).GET,
    contexto: (await import('../app/api/agente/contexto/route')).GET,
    lead: (await import('../app/api/agente/lead/route')).POST,
    metricas: (await import('../app/api/agente/metricas/route')).GET,
    planGET: (await import('../app/api/agente/plan/route')).GET,
    planPOST: (await import('../app/api/agente/plan/route')).POST,
    skill: (await import('../app/api/agente/skill/route')).GET,
    telemetria: (await import('../app/api/agente/telemetria/route')).POST,
  } as const;
  const POST = new Set(['lead', 'planPOST', 'telemetria']);

  const cabeceras: Record<string, string | null> = {
    vigente: `Bearer ${clasico}`,
    detallado: `Bearer ${detallado}`,
    sinCabecera: null,
    esquemaToken: `token ${clasico}`,
    inventado: 'Bearer mkoag_e_0000000000000000000000000000000000000000',
    pelado: clasico,
  };

  type Salida = { status: number; error: string | null } | { tiro: string };
  const pedir = async (nombre: keyof typeof rutas, cab: string | null): Promise<Salida> => {
    const headers: Record<string, string> = { 'user-agent': 'prueba', 'content-type': 'application/json' };
    if (cab !== null) headers.authorization = cab;
    const req = new NextRequest(`https://hola-mako.test/api/agente/${nombre}`, {
      method: POST.has(nombre) ? 'POST' : 'GET', headers, ...(POST.has(nombre) ? { body: '{}' } : {}),
    });
    try {
      const r = await Promise.race([
        (rutas[nombre] as (q: InstanceType<typeof NextRequest>) => Promise<Response>)(req),
        new Promise<never>((_, no) => setTimeout(() => no(new Error('tardó más de 20 s')), 20_000)),
      ]);
      let error: string | null = null;
      try { error = ((await r.clone().json()) as { error?: string }).error ?? null; } catch { /* no es JSON (la skill) */ }
      return { status: r.status, error };
    } catch (e) {
      // Una ruta que TIRA con el token vigente ya pasó la autorización: eso es lo único que se mira con él.
      return { tiro: e instanceof Error ? e.message : String(e) };
    }
  };

  const porRuta: Record<string, Record<string, Salida>> = {};
  for (const nombre of Object.keys(rutas) as Array<keyof typeof rutas>) {
    porRuta[nombre] = {};
    for (const [caso, cab] of Object.entries(cabeceras)) porRuta[nombre][caso] = await pedir(nombre, cab);
  }

  // rechazoAgente y bearerDe solos, con pedidos de verdad.
  const directo: Record<string, { status: number; error: string | null }> = {};
  for (const [caso, cab] of Object.entries(cabeceras)) {
    const r = rechazoAgente(new Request('https://hola-mako.test/api/agente/contexto', { headers: cab === null ? {} : { authorization: cab } }));
    directo[caso] = { status: r.status, error: ((await r.json()) as { error?: string }).error ?? null };
  }
  const bearer = MATRIZ_BEARER.map((h) => bearerDe(new Request('https://hola-mako.test/x', { headers: h === null ? {} : { authorization: h } })));

  // Los tokens viajan para que el test mire que ningún mensaje repita un pedazo. Son de la base de mentira: no valen nada.
  const tokens = { clasico, detallado };
  process.stdout.write('@@RESULTADO@@' + JSON.stringify({ porRuta, directo, matriz: MATRIZ_BEARER, bearer, tokens, red }));
}

main().then(() => process.exit(0), (e) => { console.error(e); process.exit(1); });
