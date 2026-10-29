// =============================================================================
// Hijo de tests/guarda-por-defecto.test.ts — NO es un test (no termina en .test.ts)
// =============================================================================
// confirmar_accion y cancelar_accion REALES (lib/api-mako/areas/mako.run.ts → lib/api-mako/acciones.ts) contra un PostgREST de
// mentira: lo que no se confirma es una REGLA y tiene que salir con la marca de guarda (la verificación de 692368a60, P3/T3: un
// «sí» tardío, con la pendiente vencida, abría ticket y le pegaba «Quedó el ticket #N» al grupo del cliente).
// =============================================================================

import { crearPostgrest } from './_postgrest-de-mentira';

process.env.NEXT_PUBLIC_SUPABASE_URL = 'http://supa.test';
process.env.SUPABASE_SERVICE_ROLE_KEY = 'service-role-de-prueba';
process.env.CREDENCIALES_SECRET = 'secreto-de-prueba-de-32-caracteres-o-mas-para-el-test';

let n = 0;
const pg = crearPostgrest({
  tablas: ['mako_acciones_pendientes', 'workspaces', 'app_settings', 'credenciales'],
  defaults: (tabla, f) => (tabla === 'mako_acciones_pendientes' ? { id: ++n, created_at: new Date().toISOString(), ...f } : f),
});
globalThis.fetch = (async (entrada: RequestInfo | URL, init: RequestInit = {}) => {
  const u = new URL(typeof entrada === 'string' ? entrada : entrada instanceof URL ? entrada.href : entrada.url);
  if (u.host === 'supa.test') return pg.responder(u, init);
  return new Response(JSON.stringify({ error: { message: 'red de mentira' } }), { status: 500, headers: { 'content-type': 'application/json' } });
}) as typeof fetch;

const WS = 5;
const JID = '120363000000000001@g.us';

async function main() {
  const { runWithWorkspace } = await import('../lib/workspace');
  // Por runners.ts, como la app: importar el área sola choca con el ciclo de los runners.
  const { runnerDe } = await import('../lib/api-mako/runners');
  const { esGuardaDeHerramienta } = await import('../lib/no-pude');
  pg.db.workspaces.push({ id: 9, capa: 'superadmin', nombre: 'MaKo' }, { id: WS, capa: 'cliente', nombre: 'Juan' });
  const ctx = { ws: WS, canal: 'whatsapp', canalKey: JID, alcance: 'ejecutar', rol: 'admin', turnStart: Date.now(), mensajeUsuario: 'sí', actor: 'Ana' } as never;
  const correr = async (nombre: 'confirmar_accion' | 'cancelar_accion', input: Record<string, unknown> = {}) => {
    const r = runnerDe(nombre) as unknown as { correr: (i: Record<string, unknown>, c: never) => Promise<string | { content: string }> };
    const out = await runWithWorkspace(WS, () => r.correr(input, ctx)).catch((e) => `tiró: ${e instanceof Error ? e.message : String(e)}`);
    return { out: typeof out === 'string' ? out : out.content, guarda: esGuardaDeHerramienta(out) };
  };
  const res: Record<string, unknown> = {};
  // Sin pendientes: el «sí» tardío.
  res.confirmarSinNada = await correr('confirmar_accion');
  res.cancelarSinNada = await correr('cancelar_accion');
  // Una pendiente propuesta en ESTE turno: no se confirma en él.
  pg.db.mako_acciones_pendientes.push({ id: 50, workspace_id: WS, grupo_jid: JID, tipo: 'agendar_reunion', payload: {}, resumen: 'Agendar con Juan', estado: 'pendiente', vence_at: new Date(Date.now() + 3_600_000).toISOString(), origen: 'whatsapp', created_at: new Date().toISOString() });
  res.recienPropuesta = await correr('confirmar_accion', { id: 50 });
  // Un id que no está.
  res.otroId = await correr('confirmar_accion', { id: 999 });
  process.stdout.write(`@@GUARDA@@${JSON.stringify(res)}\n`);
}

main().then(() => process.exit(0), (e) => { process.stdout.write(`@@GUARDA@@${JSON.stringify({ error: e instanceof Error ? e.stack : String(e) })}\n`); process.exit(0); });
