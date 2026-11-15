// =============================================================================
// Hijo de tests/agency-aviso-falta-pagar.test.ts — NO es un test (no termina en .test.ts)
// =============================================================================
// Corre la ruta REAL /api/agencia/entrar (la puerta de «Inspeccionar») sobre un PostgREST de mentira: la cartera, los cortes
// guardados (`plan.corte_por_pago`) y lib/plan-acceso.ts son los de verdad. Sólo la SESIÓN y `getWorkspace` van de mentira.
// Necesita `--conditions=react-server` y `--experimental-test-module-mocks`.

import { mock } from 'node:test';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { crearPostgrest } from './_postgrest-de-mentira';

const RAIZ = join(import.meta.dirname, '..');
process.env.SUPABASE_URL = 'https://supa.test';
process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://supa.test';
process.env.SUPABASE_SERVICE_ROLE_KEY = 'clave-de-prueba';
process.env.SUPABASE_SERVICE_KEY = 'clave-de-prueba';
process.env.AUTH_SECRET = 'secreto-de-prueba-de-cuarenta-caracteres-xx';

const AGENCIA = 13;
const pg = crearPostgrest({ tablas: ['workspaces', 'agencia_clientes', 'app_settings'] });
const db = pg.db;
db.workspaces = [
  { id: AGENCIA, nombre: 'Código Inmobiliario', capa: 'agencia', estado: 'activo' },
  { id: 17, nombre: 'Giselle Belanti', capa: 'agencia', estado: 'pausado' },   // en pausa por la mensualidad de ESTA agencia
  { id: 18, nombre: 'Al día', capa: 'agencia', estado: 'activo' },
  { id: 19, nombre: 'De dos agencias', capa: 'agencia', estado: 'pausado' },   // en pausa por la mensualidad de OTRA
  { id: 20, nombre: 'Pausa por la pasarela', capa: 'agencia', estado: 'pausado' },
  { id: 21, nombre: 'Ya reabierta', capa: 'agencia', estado: 'activo' },       // el corte quedó vigente pero la cuenta ya está activa
  { id: 99, nombre: 'Ajena en pausa', capa: 'agencia', estado: 'pausado' },   // no es de su cartera
];
const fila = (cliente_ws: number, agencia_ws = AGENCIA) => ({ agencia_ws, cliente_ws, estado: 'aprobado', decidido_por: null, decidido_at: null, motivo: null, created_at: '2026-10-01T00:00:00Z' });
db.agencia_clientes = [fila(17), fila(18), fila(19), fila(20), fila(21), fila(99, 14)];
const corte = (ws: number, c: Record<string, unknown>) => ({ workspace_id: ws, key: 'plan.corte_por_pago', value: JSON.stringify({ cobroId: 0, hasta: '2026-11-12', desde: '2026-11-12T03:00:00Z', vigente: true, ...c }) });
const deMensualidad = (agenciaWs: number) => ({ motivo: 'paga-para-entrar', mensualidad: { agenciaWs, rol: 'cliente', causas: ['entrada'], perdonadas: [] } });
db.app_settings = [
  corte(17, deMensualidad(AGENCIA)),
  corte(19, deMensualidad(14)),
  corte(20, { motivo: 'impago', cobroId: 5 }),
  corte(21, deMensualidad(AGENCIA)),
  corte(99, deMensualidad(14)),
];

globalThis.fetch = (async (entrada: RequestInfo | URL, init: RequestInit = {}) => {
  const u = new URL(typeof entrada === 'string' ? entrada : entrada instanceof URL ? entrada.href : entrada.url);
  if (u.host === 'supa.test') return pg.responder(u, init);
  throw new Error(`fetch sin mock: ${u.href}`);
}) as typeof fetch;

/** Todo lo que el módulo exporta, de mentira; arriba, lo que este arnés necesita. Un nombre que falta no carga el módulo. */
function stub(rel: string, propios: Record<string, unknown>): void {
  const src = readFileSync(join(RAIZ, rel), 'utf8');
  const nombres = [...src.matchAll(/^export (?:async )?(?:function\*? |const |let )(\w+)/gm)].map((m) => m[1]);
  const namedExports: Record<string, unknown> = {};
  for (const n of nombres) namedExports[n] = () => { throw new Error(`${rel}: ${n} sin mock`); };
  mock.module(pathToFileURL(join(RAIZ, rel)).href, { namedExports: { ...namedExports, ...propios } });
}

// La sesión: el admin de la agencia 13 (no el super admin, que no entra por esta ruta).
stub('lib/auth.ts', { getUsuarioActual: async () => ({ sub: 'joan', email: 'joan@x.test', nombre: 'Joan', rol: 'usuario', ws: AGENCIA, mfa: null }) });
stub('lib/workspace.ts', {
  getWorkspace: async (ws: number) => db.workspaces.find((w) => w.id === ws) ?? null,
  wsSuperAdmin: async () => 1,
});
mock.module('next/headers', { namedExports: { cookies: async () => ({ get: () => undefined }), headers: async () => new Headers() } });

async function main() {
  const { POST } = await import('../app/api/agencia/entrar/route');
  const entrar = async (ws: number) => {
    const r = await POST(new Request('http://x.test/api/agencia/entrar', { method: 'POST', body: JSON.stringify({ ws }) }) as never);
    return { status: r.status, cuerpo: (await r.json()) as Record<string, unknown>, cookie: r.headers.get('set-cookie') ?? '' };
  };
  const out: Record<string, unknown> = {};
  for (const ws of [17, 18, 19, 20, 21, 99]) out[ws] = await entrar(ws);
  process.stdout.write(`@@RESULTADO@@${JSON.stringify(out)}`);
}

main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
