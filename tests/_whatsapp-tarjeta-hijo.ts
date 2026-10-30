// =============================================================================
// Hijo de tests/whatsapp-tarjeta.test.ts — NO es un test (no termina en .test.ts)
// =============================================================================
// La tarjeta de WhatsApp de /integraciones (29/10/2026): `getIntegracion('whatsapp')` REAL (`server-only`, `--conditions=react-server`)
// sobre el PostgREST de mentira, con líneas del negocio y la de MaKo. Imprime el estado y el detalle de la tarjeta.
// =============================================================================

import { crearPostgrest } from './_postgrest-de-mentira';

const pg = crearPostgrest({ tablas: ['workspaces', 'app_settings', 'evolution_instancias', 'credenciales'] });
const db = pg.db;
const red: string[] = [];
const json = (status: number, body: unknown) => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });
globalThis.fetch = (async (entrada: RequestInfo | URL, init: RequestInit = {}) => {
  const u = new URL(typeof entrada === 'string' ? entrada : entrada instanceof URL ? entrada.href : entrada.url);
  if (u.host === 'supa.test') return pg.responder(u, init);
  red.push(`${u.host}${u.pathname}`);
  return json(500, { error: 'red de mentira' });
}) as typeof fetch;

process.env.NEXT_PUBLIC_SUPABASE_URL = 'http://supa.test';
process.env.SUPABASE_SERVICE_ROLE_KEY = 'service-role-de-prueba';

const WS = 3;
const linea = (id: number, nombre: string, estado: string, extra: Record<string, unknown> = {}) => ({
  id, workspace_id: WS, instance_name: nombre, instance_id: null, estado, numero: '5491100000000', perfil_nombre: null, ultima_conexion_at: null,
  etiqueta: null, es_default: id === 1, ...extra,
});

async function main() {
  const { runWithWorkspace } = await import('../lib/workspace');
  const { getIntegracion } = await import('../lib/integraciones');
  const reset = () => {
    pg.vaciar();
    db.workspaces.push({ id: WS, nombre: 'Prueba', capa: 'cliente' }, { id: 9, nombre: 'MaKo', capa: 'superadmin' });
  };
  const tarjeta = async () => {
    const i = await runWithWorkspace(WS, () => getIntegracion('whatsapp'));
    return i ? { estado: i.estado, detalle: i.detalle, soloServidor: i.soloServidor, categoria: i.categoria } : null;
  };
  const out: Record<string, unknown> = {};

  reset();
  out.sinLineas = await tarjeta();

  // Dos del negocio conectadas, una caída y la de MaKo conectada (no cuenta).
  reset();
  db.evolution_instancias.push(
    linea(1, 'mako_ws3', 'conectado'), linea(2, 'mako_ws3_l2', 'conectado', { etiqueta: 'Setter Ana' }), linea(3, 'mako_ws3_l3', 'desconectado'),
    linea(4, 'mako_superadmin', 'conectado'),
  );
  out.dosConectadas = await tarjeta();

  // Sólo la de MaKo conectada: la tarjeta NO está conectada.
  reset();
  db.evolution_instancias.push(linea(1, 'mako_ws3', 'desconectado'), linea(4, 'mako_superadmin_2', 'conectado'));
  out.soloLaDeMaKo = await tarjeta();

  out.red = [...red];
  process.stdout.write(`\n@@RESULTADO@@${JSON.stringify(out)}`, () => process.exit(0));
}

void main().catch((e) => { process.stdout.write(`\n@@RESULTADO@@${JSON.stringify({ tiro: e instanceof Error ? e.stack : String(e) })}`, () => process.exit(0)); });

export {};
