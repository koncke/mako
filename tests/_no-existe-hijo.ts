// =============================================================================
// Hijo de tests/mako-no-existe.test.ts — NO es un test (no termina en .test.ts)
// =============================================================================
// Corre `conPedidoDeNoExiste` REAL (lib/no-existe-server.ts → crearTicket, lib/tickets-db.ts) contra una base de mentira:
// una respuesta con la marca levanta UN pedido (y repetirla no levanta otro), y una sin marca no escribe nada.
// =============================================================================

import { crearPostgrest } from './_postgrest-de-mentira';

process.env.NEXT_PUBLIC_SUPABASE_URL = 'http://supa.test';
process.env.SUPABASE_SERVICE_ROLE_KEY = 'service-role-de-prueba';
process.env.CREDENCIALES_SECRET = 'secreto-de-prueba-de-32-caracteres-o-mas-para-el-test';

let n = 0;
const pg = crearPostgrest({
  tablas: ['tickets', 'workspaces', 'app_settings', 'usuarios'],
  defaults: (_t, f) => ({ id: ++n, created_at: new Date().toISOString(), ...f }),
});
globalThis.fetch = (async (entrada: RequestInfo | URL, init: RequestInit = {}) => {
  const u = new URL(typeof entrada === 'string' ? entrada : entrada instanceof URL ? entrada.href : entrada.url);
  if (u.host === 'supa.test') {
    try { return await pg.responder(u, init); } catch (e) { return new Response(JSON.stringify({ message: String(e) }), { status: 400 }); }
  }
  return new Response('{}', { status: 500 });
}) as typeof fetch;

const WS = 13;

async function main() {
  const { conPedidoDeNoExiste } = await import('../lib/no-existe-server');
  pg.db.workspaces.push({ id: WS, capa: 'cliente', nombre: 'Negocio de prueba' });
  const donde = { ws: WS, actor: 'dueno@negocio-de-prueba.com', nombre: 'Dueño', chat: 'ops-center', pedido: 'ponme un bloque de Instagram con tope de comentarios' };
  const respuesta = 'Eso todavía no existe en MaKo: el goteo es uno solo para todos los canales.\n\n[[no-existe: un tope de comentarios por día sólo para Instagram]]';
  const out: Record<string, unknown> = {};
  out.r1 = await conPedidoDeNoExiste(respuesta, donde);
  out.tickets1 = pg.db.tickets.map((t) => ({ tipo: t.tipo, titulo: t.titulo, canal: t.canal, ref: t.ref, ws: t.workspace_id, email: t.usuario_email }));
  out.r2 = await conPedidoDeNoExiste(respuesta, donde);
  out.tickets2 = pg.db.tickets.length;
  out.r3 = await conPedidoDeNoExiste('Listo: te cambié el horario.', donde);
  out.tickets3 = pg.db.tickets.length;
  process.stdout.write(`@@RESULTADO@@${JSON.stringify(out)}`);
}

main().then(() => process.exit(0), (e) => { process.stdout.write(`@@RESULTADO@@${JSON.stringify({ error: e instanceof Error ? e.stack : String(e) })}`); process.exit(0); });
