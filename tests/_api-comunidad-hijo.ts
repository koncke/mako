// =============================================================================
// Hijo de tests/api-mako-comunidad-firma.test.ts — NO es un test (no termina en .test.ts)
// =============================================================================
// Corre el runner REAL de `publicar_post_comunidad` (lib/api-mako/areas/comunidad.run.ts, `server-only`) en un node aparte
// con `--conditions=react-server`, contra un PostgREST de mentira (tests/_postgrest-de-mentira.ts) con DOS negocios.
// Lo que se mira es QUIÉN FIRMA: lo que se publica en la comunidad sale con el nombre de una persona del equipo de ESTE
// negocio o no sale, y no se escribe nada cuando no hay quién firme. Se importa por el registro (`runnerDe`): un
// `.run.ts` suelto cae en un ciclo con runners.ts.
// =============================================================================

import { crearPostgrest } from './_postgrest-de-mentira';

// eslint-disable-next-line @typescript-eslint/no-require-imports
const Modulo = require('node:module') as { _load: (pedido: string, padre: unknown, esMain: boolean) => unknown };
const cargarOriginal = Modulo._load;
Modulo._load = function (this: unknown, pedido: string, padre: unknown, esMain: boolean) {
  if (pedido === 'next/server') {
    const real = cargarOriginal.call(this, pedido, padre, esMain) as Record<string, unknown>;
    return { ...real, after: () => undefined };
  }
  return cargarOriginal.call(this, pedido, padre, esMain);
};

const TABLAS = ['workspaces', 'productos', 'usuarios', 'comunidad_categorias', 'comunidad_posts', 'comunidad_ajustes', 'leads'] as const;
const pg = crearPostgrest({ tablas: TABLAS });
const ia: string[] = [];
globalThis.fetch = (async (entrada: RequestInfo | URL, init: RequestInit = {}) => {
  const u = new URL(typeof entrada === 'string' ? entrada : entrada instanceof URL ? entrada.href : entrada.url);
  if (u.host === 'supa.test') return pg.responder(u, init);
  ia.push(u.host + u.pathname);
  return new Response(JSON.stringify({ error: 'red de mentira' }), { status: 500 });
}) as typeof fetch;
process.env.NEXT_PUBLIC_SUPABASE_URL = 'http://supa.test';
process.env.SUPABASE_SERVICE_ROLE_KEY = 'service-role-de-prueba';

const WS_A = 3;
const WS_B = 9;

async function main() {
  const { runWithWorkspace } = await import('../lib/workspace');
  const { runnerDe } = await import('../lib/api-mako/runners');
  const db = pg.db;
  type Ctx = {
    ws: number; canal: 'http'; canalKey: string; alcance: 'ejecutar'; rol: 'admin'; actor?: string;
    token?: { id: string; nombre: string }; persona?: string; bandeja?: true;
  };
  type R = {
    preparar: (i: Record<string, unknown>, c: Ctx) => Promise<Record<string, unknown>>;
    ejecutar: (p: Record<string, unknown>, c: Ctx) => Promise<Record<string, unknown>>;
  };
  const publicar = runnerDe('publicar_post_comunidad') as unknown as R;
  const base: Ctx = { ws: WS_A, canal: 'http', canalKey: 'api:3', alcance: 'ejecutar', rol: 'admin' };
  const conToken: Ctx = { ...base, token: { id: 't1', nombre: 'ci' }, actor: 'API · token «ci»' };
  const enA = <T,>(fn: () => Promise<T>) => runWithWorkspace(WS_A, fn);
  const post = { productoId: 5, titulo: 'Bienvenidos', cuerpo: 'Hola a todos' };

  db.workspaces.push({ id: WS_A, nombre: 'A', slug: 'a', estado: 'activo', capa: 'completo', created_at: new Date().toISOString() });
  db.workspaces.push({ id: WS_B, nombre: 'B', slug: 'b', estado: 'activo', capa: 'completo', created_at: new Date().toISOString() });
  db.productos.push({ id: 5, workspace_id: WS_A, nombre: 'Mentoría' });
  db.productos.push({ id: 6, workspace_id: WS_B, nombre: 'De B' });
  db.usuarios.push({ id: 7, email: 'ana@a.com', nombre: 'Ana', estado: 'activo', workspace_id: WS_A, rol: 'admin_ws' });
  db.usuarios.push({ id: 8, email: 'beto@b.com', nombre: 'Beto', estado: 'activo', workspace_id: WS_B, rol: 'admin_ws' });
  db.usuarios.push({ id: 9, email: 'susp@a.com', nombre: 'Susp', estado: 'suspendido', workspace_id: WS_A, rol: 'miembro' });
  db.usuarios.push({ id: 10, email: 'root@mako.com', nombre: 'Root', estado: 'activo', workspace_id: null, rol: 'admin' });

  const out: Record<string, unknown> = {};
  out.tokenSinPersona = await enA(() => publicar.preparar(post, conToken));
  out.personaDeOtroNegocio = await enA(() => publicar.preparar(post, { ...conToken, persona: 'beto@b.com' }));
  out.personaSuspendida = await enA(() => publicar.preparar(post, { ...conToken, persona: 'susp@a.com' }));
  out.personaInexistente = await enA(() => publicar.preparar(post, { ...conToken, persona: 'nadie@a.com' }));
  out.personaDelEquipo = await enA(() => publicar.preparar(post, { ...conToken, persona: 'Ana@A.com' }));
  out.adminDePlataforma = await enA(() => publicar.preparar(post, { ...conToken, persona: 'root@mako.com' }));
  // Un actor que es un EMAIL pero no está en la bandeja no firma: por HTTP el actor es «API · token …», y un flujo o WhatsApp traen otra cosa.
  out.actorSinBandeja = await enA(() => publicar.preparar(post, { ...conToken, actor: 'ana@a.com' }));
  out.productoAjeno = await enA(() => publicar.preparar({ ...post, productoId: 6 }, { ...conToken, persona: 'ana@a.com' }));
  // El token CLÁSICO propone: quien firma es quien confirma en la bandeja.
  out.clasicoPropone = await enA(() => publicar.preparar(post, base));
  // …y si lo ejecutan sin persona (nadie confirmó en la bandeja), no se escribe.
  out.ejecutarSinPersona = await enA(() => publicar.ejecutar({ ...post }, base));
  out.ejecutarConTokenSinPersona = await enA(() => publicar.ejecutar({ ...post }, conToken));
  out.postsEscritos = db.comunidad_posts.length;
  out.ia = [...ia];
  process.stdout.write(`\n@@JSON@@${JSON.stringify(out)}@@FIN@@\n`);
}

main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
