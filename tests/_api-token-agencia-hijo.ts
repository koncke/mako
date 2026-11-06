// =============================================================================
// Hijo de tests/api-mako-token-agencia.test.ts — NO es un test (no termina en .test.ts)
// =============================================================================
// El token de AGENCIA (6/11/2026, lib/api-mako/tokens-cartera.ts) con DOS agencias y sus clientes, sobre el código REAL:
// `crearToken` (lib/api-mako/tokens.ts) los acuña y `autenticar` (lib/api-mako/http.ts) los resuelve con pedidos HTTP de
// verdad, contra un PostgREST de mentira, en un node aparte con `--conditions=react-server`. Nada sale a la red.
//
// Con UNA agencia sola, un permiso cableado a su número pasaría todo (AGENTS.md, «Se prueba con DOS sujetos»): por eso
// hay dos, un cliente compartido, uno revocado, uno pendiente y un negocio que no es de nadie.
// =============================================================================

import { crearPostgrest } from './_postgrest-de-mentira';

let siguienteId = 9000;
const ahoraIso = () => new Date().toISOString();
const pg = crearPostgrest({
  tablas: ['workspaces', 'agencias', 'agencia_clientes', 'usuarios', 'app_settings', 'webhook_routing', 'api_llamadas', 'plan_suscripciones'],
  defaults: (tabla, f) => (tabla === 'app_settings' ? { updated_at: ahoraIso(), ...f } : { id: siguienteId++, created_at: ahoraIso(), ...f }),
  unicos: [{ tabla: 'app_settings', nombre: 'app_settings_pkey', columnas: ['workspace_id', 'key'], donde: () => true }],
});

let baseCaida = false;
const red: string[] = [];
globalThis.fetch = (async (entrada: RequestInfo | URL, init: RequestInit = {}) => {
  const u = new URL(typeof entrada === 'string' ? entrada : entrada instanceof URL ? entrada.href : entrada.url);
  if (u.host === 'supa.test') {
    if (baseCaida && u.pathname.includes('agencia_clientes')) return new Response(JSON.stringify({ message: 'se cayó' }), { status: 503 });
    return pg.responder(u, init);
  }
  red.push(u.host + u.pathname);
  return new Response(JSON.stringify({ error: 'red de mentira' }), { status: 500 });
}) as typeof fetch;

process.env.NEXT_PUBLIC_SUPABASE_URL = 'http://supa.test';
process.env.SUPABASE_URL = 'http://supa.test';
process.env.SUPABASE_SERVICE_ROLE_KEY = 'service-role-de-prueba';

const db = pg.db;
db.workspaces.push(
  { id: 10, nombre: 'Agencia Uno', capa: 'agencia', estado: 'activo' },
  { id: 11, nombre: 'Agencia Dos', capa: 'agencia', estado: 'activo' },
  { id: 20, nombre: 'Cliente de Uno', capa: 'completo', estado: 'activo' },
  { id: 21, nombre: 'Cliente de Dos', capa: 'completo', estado: 'activo' },
  { id: 40, nombre: 'Cliente de las dos', capa: 'completo', estado: 'activo' },
  { id: 50, nombre: 'Ex cliente de Uno', capa: 'completo', estado: 'activo' },
  { id: 60, nombre: 'Pendiente de Uno', capa: 'completo', estado: 'activo' },
  { id: 70, nombre: 'Negocio directo', capa: 'completo', estado: 'activo' },
);
db.agencias.push({ ws: 10, habilitada_at: '2026-10-01T00:00:00Z' }, { ws: 11, habilitada_at: '2026-10-01T00:00:00Z' });
const fila = (agencia_ws: number, cliente_ws: number, estado: string) => ({ agencia_ws, cliente_ws, estado, decidido_por: null, decidido_at: null, motivo: null, created_at: '2026-10-01T00:00:00Z' });
db.agencia_clientes.push(fila(10, 20, 'aprobado'), fila(10, 40, 'aprobado'), fila(10, 50, 'revocado'), fila(10, 60, 'pendiente'), fila(11, 21, 'aprobado'), fila(11, 40, 'aprobado'));
db.usuarios.push(
  { id: 1, email: 'admin@uno.test', nombre: 'Admin Uno', rol: 'cliente', rol_ws: 'admin', workspace_id: 10, estado: 'activo' },
  { id: 2, email: 'admin@dos.test', nombre: 'Admin Dos', rol: 'cliente', rol_ws: 'admin', workspace_id: 11, estado: 'activo' },
  { id: 3, email: 'closer@uno.test', nombre: 'Closer Uno', rol: 'cliente', rol_ws: 'closer', workspace_id: 10, estado: 'activo' },
);

async function main() {
  const { crearToken } = await import('../lib/api-mako/tokens');
  const { autenticar, esRespuesta } = await import('../lib/api-mako/http');
  const permisos = { crm: 'escritura' };
  const acunar = async (ws: number, actor: string, cartera: boolean, nombre: string) => {
    const r = await crearToken(ws, { nombre, descripcion: '', permisos, expiracion: '30', actor, cartera });
    if ('error' in r) throw new Error(`crearToken ${ws}: ${r.error}`);
    return r.token;
  };
  const tUno = await acunar(10, 'admin@uno.test', true, 'Migración Uno');
  const tDos = await acunar(11, 'admin@dos.test', true, 'Migración Dos');
  const tCuenta = await acunar(10, 'admin@uno.test', false, 'De la cuenta');
  const tCloser = await acunar(10, 'closer@uno.test', true, 'Del closer');

  const pedir = async (token: string, cliente?: string, ruta = '/api/v1/crm/leads') => {
    const headers: Record<string, string> = { authorization: `Bearer ${token}`, 'user-agent': 'prueba' };
    if (cliente !== undefined) headers['X-MaKo-Cliente'] = cliente;
    const a = await autenticar(new Request(`https://hola-mako.test${ruta}`, { headers }));
    if (esRespuesta(a)) {
      const cuerpo = (await a.json()) as { error?: string; disponibles?: Array<{ cliente: number }> };
      return { status: a.status, error: cuerpo.error ?? null, disponibles: (cuerpo.disponibles ?? []).map((d) => d.cliente) };
    }
    return { status: 200, ws: a.ctx.ws, actor: a.ctx.actor, permisos: a.ctx.permisos ?? null, agencia: a.token.ws };
  };

  const out: Record<string, unknown> = {
    prefijos: { uno: tUno.slice(0, 9), cuenta: tCuenta.slice(0, 9) },
    uno: {
      c20: await pedir(tUno, '20'),
      c40: await pedir(tUno, '40'),
      c21: await pedir(tUno, '21'),
      c50: await pedir(tUno, '50'),
      c60: await pedir(tUno, '60'),
      c70: await pedir(tUno, '70'),
      c10: await pedir(tUno, '10'),
      sin: await pedir(tUno),
      raro: await pedir(tUno, '20 or 1=1'),
      porQuery: await pedir(tUno, undefined, '/api/v1/crm/leads?cliente=20'),
    },
    dos: { c21: await pedir(tDos, '21'), c40: await pedir(tDos, '40'), c20: await pedir(tDos, '20') },
    // Un token de CUENTA con el header de otro cliente: el header no lo hace saltar.
    cuentaConHeader: await pedir(tCuenta, '20'),
    // Uno de agencia acuñado por quien no administra la agencia (un closer): no vale.
    delCloser: await pedir(tCloser, '20'),
  };

  // El super admin revoca al cliente 20 después de acuñar el token: el pedido siguiente ya no entra.
  const f20 = db.agencia_clientes.find((f) => f.agencia_ws === 10 && f.cliente_ws === 20);
  if (f20) f20.estado = 'revocado';
  out.trasRevocar = await pedir(tUno, '20');
  if (f20) f20.estado = 'aprobado';

  // La agencia deja de serlo (baja de plan): su token no llega a ningún cliente.
  const w10 = db.workspaces.find((w) => w.id === 10);
  if (w10) w10.capa = 'completo';
  out.yaNoEsAgencia = await pedir(tUno, '20');
  if (w10) w10.capa = 'agencia';

  // Un cliente pausado: 403, como cualquier negocio pausado.
  baseCaida = true;
  out.baseCaida = await pedir(tUno, '20');
  baseCaida = false;

  // Una lista tocada a mano: la marca de cartera en un token de cuenta no lo vuelve de agencia (el prefijo manda).
  const lista = db.app_settings.find((s) => s.workspace_id === 10 && s.key === 'api_tokens');
  if (lista) {
    const arr = JSON.parse(String(lista.value)) as Array<Record<string, unknown>>;
    for (const t of arr) if (t.nombre === 'De la cuenta') t.cartera = true;
    lista.value = JSON.stringify(arr);
  }
  out.cuentaMarcadaAMano = await pedir(tCuenta, '20');

  out.red = red;
  process.stdout.write('@@RESULTADO@@' + JSON.stringify(out));
}

main().then(() => process.exit(0), (e) => { console.error(e); process.exit(1); });
