// =============================================================================
// Hijo de tests/agencia-dos-negocios.test.ts — NO es un test (no termina en .test.ts)
// =============================================================================
// Dos agencias, sus clientes y negocios directos, sobre un PostgREST de mentira. Corren REALES `/api/auth/me`,
// lib/vista-de-otro.ts, lib/agencia.ts, `cuentasDePartner`, la baja y el cambio de plan; sólo la SESIÓN va de mentira
// (lib/auth.ts y lib/workspace.ts, por pedido, con AsyncLocalStorage: dos pedidos a la vez no comparten nada).
// Necesita `--conditions=react-server` y `--experimental-test-module-mocks`.

import { mock } from 'node:test';
import { AsyncLocalStorage } from 'node:async_hooks';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { crearPostgrest } from './_postgrest-de-mentira';

const RAIZ = join(import.meta.dirname, '..');
process.env.SUPABASE_URL = 'https://supa.test';
process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://supa.test';
process.env.SUPABASE_SERVICE_ROLE_KEY = 'clave-de-prueba';
process.env.SUPABASE_SERVICE_KEY = 'clave-de-prueba';

type Pedido = { ws: number | null; rol: 'admin' | 'cliente'; impersonando: boolean };
const pedido = new AsyncLocalStorage<Pedido>();
const actual = (): Pedido => {
  const p = pedido.getStore();
  if (!p) throw new Error('fuera de un pedido');
  return p;
};

const pg = crearPostgrest({ tablas: ['workspaces', 'agencia_clientes', 'app_settings', 'cobros', 'pagos', 'agencia_altas', 'usuarios', 'usuario_workspaces', 'agencias'] });
const db = pg.db;
const KEY = 'agency.plan_cambiado';
const marca = (ws: number, plan: string) => ({ workspace_id: ws, key: KEY, value: JSON.stringify({ at: '2026-10-29T00:00:00Z', plan, pendiente: false }) });
db.workspaces = [
  { id: 1, nombre: 'Plataforma', capa: 'agencia', estado: 'activo' },
  { id: 10, nombre: 'Agencia Uno', capa: 'agencia', estado: 'activo' },
  { id: 11, nombre: 'Agencia Dos', capa: 'agencia', estado: 'activo' },
  { id: 20, nombre: 'Cliente de Uno', capa: 'completo', estado: 'activo' },
  { id: 21, nombre: 'Cliente de Dos', capa: 'agencia', estado: 'activo' },
  { id: 22, nombre: 'Cuenta vieja de Uno', capa: 'completo', estado: 'activo' },
  { id: 30, nombre: 'Negocio directo', capa: 'agencia', estado: 'activo' },
  { id: 40, nombre: 'Dos agencias', capa: 'completo', estado: 'activo' },
  { id: 50, nombre: 'Ex cliente de Uno', capa: 'agencia', estado: 'activo' },
  { id: 60, nombre: 'Por pagar de Uno', capa: 'agencia', estado: 'activo' },
  { id: 61, nombre: 'Pedida sin plan', capa: 'agencia', estado: 'activo' },
];
const fila = (agencia_ws: number, cliente_ws: number, estado: string) => ({ agencia_ws, cliente_ws, estado, decidido_por: null, decidido_at: null, motivo: null, created_at: '2026-10-01T00:00:00Z' });
db.agencias = [{ ws: 10, habilitada_at: '2026-10-01T00:00:00Z' }, { ws: 11, habilitada_at: '2026-10-01T00:00:00Z' }];
db.agencia_clientes = [
  fila(10, 20, 'aprobado'), fila(10, 22, 'aprobado'), fila(10, 40, 'aprobado'), fila(10, 50, 'revocado'), fila(10, 60, 'pendiente'), fila(10, 61, 'pendiente'),
  fila(11, 21, 'aprobado'), fila(11, 40, 'aprobado'),
];
// La marca de la ex: su ex agencia no puede leer ni eso. La de la pendiente dice Esencial y su capa dice Pro: se ve de dónde sale.
db.app_settings = [marca(20, 'esencial'), marca(21, 'pro'), marca(50, 'pro'), marca(60, 'esencial')];

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

stub('lib/auth.ts', {
  getUsuarioActual: async () => { const p = actual(); return { sub: 'u', email: 'x@y.z', nombre: 'Quien mira', rol: p.rol }; },
  getSesionAdmin: async () => (actual().rol === 'admin' ? { email: 'x@y.z' } : null),
});
stub('lib/workspace.ts', {
  getWorkspaceActual: async () => actual().ws,
  estaImpersonando: async () => actual().impersonando,
  getWorkspace: async (ws: number) => db.workspaces.find((w) => w.id === ws) ?? null,
  getRolWsEfectivo: async () => 'admin',
  getCapaActual: async () => 'agencia',
  wsSuperAdmin: async () => 1,
  listarWorkspaces: async () => db.workspaces,
  getTenantDb: async () => { throw new Error('sin tenant'); },
});
stub('lib/plan-esencial.ts', { esEsencialDeLaSesion: async () => false });
stub('lib/ultimo-uso.ts', { marcarUso: () => {} });

async function main() {
  const { GET } = await import('../app/api/auth/me/route');
  const { cuentasDePartner } = await import('../lib/partners');
  const { darDeBajaClienteDeAgencia } = await import('../lib/agencia-baja');
  const { cambiarPlanDeCliente } = await import('../lib/agencia-plan');

  const me = (p: Pedido) => pedido.run(p, async () => {
    const r = await GET();
    return (await r.json()) as Record<string, unknown>;
  });
  const cliente = (ws: number): Pedido => ({ ws, rol: 'cliente', impersonando: false });
  const agenciaMirando = (ws: number): Pedido => ({ ws, rol: 'cliente', impersonando: true });
  const superMirando = (ws: number): Pedido => ({ ws, rol: 'admin', impersonando: true });

  const out: Record<string, unknown> = {};
  out.enSuCuenta = { c20: await me(cliente(20)), c21: await me(cliente(21)), d30: await me(cliente(30)), dos40: await me(cliente(40)), ex50: await me(cliente(50)), ag10: await me(cliente(10)) };
  out.agenciaMirando = { a20: await me(agenciaMirando(20)), a21: await me(agenciaMirando(21)) };
  out.superMirando = { s21: await me(superMirando(21)), s30: await me(superMirando(30)), s40: await me(superMirando(40)) };
  // A LA VEZ: cuarenta pedidos intercalados, de dos clientes y un negocio directo.
  const quienes = Array.from({ length: 40 }, (_, i) => [agenciaMirando(20), agenciaMirando(21), cliente(30)][i % 3]);
  const juntos = await Promise.all(quienes.map(me));
  out.aLaVez = juntos.map((r, i) => ({ pedido: quienes[i].ws, ws: r.ws, clienteWs: r.clienteWs, clienteNombre: r.clienteNombre, clienteDeAgencia: r.clienteDeAgencia }));

  const cartera = await pedido.run(cliente(10), () => cuentasDePartner(10));
  out.cartera = cartera.ok ? cartera.cuentas.map((c) => ({ ws: c.ws, estado: c.estado, plan: c.plan, planId: c.planId, planElegido: c.planElegido })) : cartera;
  const carteraDos = await pedido.run(cliente(11), () => cuentasDePartner(11));
  out.carteraDos = carteraDos.ok ? carteraDos.cuentas.map((c) => c.ws) : carteraDos;

  // Una agencia sobre la cuenta de la otra: no pasa, y no escribe nada.
  const antes = JSON.stringify(db);
  out.bajaAjena = await pedido.run(cliente(11), () => darDeBajaClienteDeAgencia({ agenciaWs: 11, clienteWs: 20, autor: 'otra' }));
  out.planAjeno = await pedido.run(cliente(11), () => cambiarPlanDeCliente({ agenciaWs: 11, clienteWs: 20, plan: 'pro', autor: 'otra' }));
  out.noEscribio = JSON.stringify(db) === antes;

  process.stdout.write(`@@RESULTADO@@${JSON.stringify(out)}`);
}

main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
