// =============================================================================
// Hijo de tests/no-pude-server.test.ts — NO es un test (no termina en .test.ts)
// =============================================================================
// Corre `conTicketsDeMaKo`, `ticketDeNoPude`, `cerrarSiVolvio` y `crearTicket` REALES (lib/no-pude-server.ts → lib/tickets-db.ts)
// contra una base de mentira (tests/_postgrest-de-mentira.ts) y devuelve lo que quedó escrito.
// =============================================================================

import { crearPostgrest } from './_postgrest-de-mentira';

process.env.NEXT_PUBLIC_SUPABASE_URL = 'http://supa.test';
process.env.SUPABASE_SERVICE_ROLE_KEY = 'service-role-de-prueba';
process.env.CREDENCIALES_SECRET = 'secreto-de-prueba-de-32-caracteres-o-mas-para-el-test';

let n = 0;
const pg = crearPostgrest({
  tablas: ['tickets', 'ticket_eventos', 'workspaces', 'app_settings', 'usuarios'],
  defaults: (_t, f) => ({ id: ++n, created_at: new Date().toISOString(), ...f }),
});
globalThis.fetch = (async (entrada: RequestInfo | URL, init: RequestInit = {}) => {
  const u = new URL(typeof entrada === 'string' ? entrada : entrada instanceof URL ? entrada.href : entrada.url);
  if (u.host === 'supa.test') {
    try { return await pg.responder(u, init); } catch (e) { return new Response(JSON.stringify({ message: String(e) }), { status: 400 }); }
  }
  return new Response('{}', { status: 500 });
}) as typeof fetch;

/** Leila: el negocio con la regla de aprobación (lib/tickets-reglas.ts → APROBADOS_POR_REGLA). */
const WS = 11;
const EMAIL = 'duena@negocio-de-prueba.com';

async function main() {
  const { conTicketsDeMaKo, ticketDeNoPude, cerrarSiVolvio } = await import('../lib/no-pude-server');
  const { crearTicket, identidadDe } = await import('../lib/tickets-db');
  pg.db.workspaces.push({ id: WS, capa: 'cliente', nombre: 'Negocio de prueba' });
  const donde = { ws: WS, actor: EMAIL, nombre: 'Dueña', superficie: 'ops-center' as const, conv: 'sesion-300', pedido: 'creá la tarea de llamar a Ana' };
  const out: Record<string, unknown> = {};
  const tk = () => pg.db.tickets.map((t) => ({ id: t.id, ref: t.ref, titulo: t.titulo, tipo: t.tipo, estado: t.estado, despacho: t.despacho, regla: (t.triage as { regla?: string } | null)?.regla ?? null, causa: (t.contexto as { causa?: string } | null)?.causa ?? null }));

  // g. tres «no pude» iguales en la misma conversación: UN ticket y dos notas «Volvió a pasar».
  const resp = 'No pude crear la tarea: el plan no respondió.\n\n[[no-pude: crear la tarea en el plan]]';
  out.g1 = await conTicketsDeMaKo(resp, {}, donde);
  out.g2 = await conTicketsDeMaKo(resp, {}, donde);
  out.g3 = await conTicketsDeMaKo(resp, {}, donde);
  out.gTickets = tk();
  out.gNotas = pg.db.ticket_eventos.filter((e) => e.tipo === 'nota' && String(e.texto).startsWith('Volvió a pasar')).length;
  // Una regla no abre nada.
  out.regla = await conTicketsDeMaKo('Eso lo confirmas tú.\n\n[[no-pude: confirmarla: la persona la confirma en su tarjeta]]', {}, { ...donde, conv: 'sesion-301' });

  // j. el proveedor con un error no va al arreglo automático, es uno por negocio, y se cierra solo.
  out.j1 = await ticketDeNoPude('proveedor', { ...donde, conv: 'sesion-302' }, { error: '503 overloaded' });
  out.j2 = await ticketDeNoPude('proveedor', { ...donde, superficie: 'whatsapp', conv: 'grupo' }, { error: '503 overloaded' });
  out.jCerrado = await cerrarSiVolvio(WS, 'proveedor');
  out.j3 = await ticketDeNoPude('proveedor', { ...donde, conv: 'sesion-303' }, { error: '503 overloaded' });
  out.jTickets = tk().filter((t) => t.causa === 'proveedor');

  // h. el tope de los automáticos (6 por negocio y día) no deja pasar el 7.º, y la persona igual levanta uno a mano.
  const antes = pg.db.tickets.length;
  for (let i = 0; i < 6; i++) await ticketDeNoPude('texto', { ...donde, conv: `tope-${i}` }, { queNoPudo: `cosa ${i}` });
  out.hAutomaticos = pg.db.tickets.length - antes;
  const identidad = await identidadDe(WS, EMAIL, 'Dueña');
  // Cuatro a mano antes: con los 6 automáticos contados, serían 10 y el de abajo no entraría.
  for (let i = 0; i < 4; i++) await crearTicket({ identidad, tipo: 'bug', declaradoPor: 'persona', titulo: `Algo ${i}`, descripcion: 'x', canal: 'formulario', contexto: {} });
  const aMano = await crearTicket({ identidad, tipo: 'bug', declaradoPor: 'persona', titulo: 'No me carga la ficha', descripcion: 'Desde ayer.', canal: 'formulario', contexto: {} });
  out.hAMano = aMano.ok;
  process.stdout.write(`@@RESULTADO@@${JSON.stringify(out)}`);
}

main().then(() => process.exit(0), (e) => { process.stdout.write(`@@RESULTADO@@${JSON.stringify({ error: e instanceof Error ? e.stack : String(e) })}`); process.exit(0); });
