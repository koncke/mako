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

  // ── La revisión del 28/10/2026 (C:/dev/revisiones/2810-mi-tandaA-y-base.md) ──────────────────────────────────────────
  const r: Record<string, unknown> = {};
  pg.db.workspaces.push({ id: 10, capa: 'cliente', nombre: 'Negocio 10' }, { id: 12, capa: 'cliente', nombre: 'Negocio 12' }, { id: 14, capa: 'cliente', nombre: 'Negocio 14' });
  const en = (ws: number, conv: string) => ({ ws, actor: `dueno${ws}@negocio-de-prueba.com`, nombre: 'Dueño', superficie: 'ops-center' as const, conv, pedido: 'algo' });
  const deWs = (ws: number) => pg.db.tickets.filter((t) => t.workspace_id === ws);
  // base 3: lo que falló ya dejó su ticket (registrarError) → la marca sale, sin un segundo ticket ni línea.
  r.yaRegistrado = await conTicketsDeMaKo('No pude crear la tarea.\n\n[[no-pude: crear la tarea]]', { yaRegistrado: true }, en(12, 'c1'));
  r.yaRegistradoTickets = deWs(12).length;
  // base 5: dos pedidos DISTINTOS en la misma conversación → dos tickets, cada uno con su línea.
  r.dos1 = await conTicketsDeMaKo('No existe.\n\n[[no-existe: un registro de cumpleaños]]', {}, en(12, 'c2'));
  r.dos2 = await conTicketsDeMaKo('No existe.\n\n[[no-existe: un tope de comentarios por canal]]', {}, en(12, 'c2'));
  // base 7: la negativa legítima explicada en la respuesta (la marca sólo dice el qué) no abre nada.
  r.regla = await conTicketsDeMaKo('No puedo borrarlo desde acá: el borrado se hace en tu pantalla de revisión.\n\n[[no-pude: borrar el lead de Juan]]', {}, en(12, 'c3'));
  // base 8: la configuración se cierra sólo si contesta la cuenta que falló.
  const conf = await ticketDeNoPude('configuracion', en(14, 'c4'), { error: 'sin crédito', herramienta: 'ia:openai' });
  r.confOtra = await cerrarSiVolvio(14, 'configuracion', 'ia:auto');
  r.confMisma = await cerrarSiVolvio(14, 'configuracion', 'ia:openai');
  r.confId = conf?.id ?? null;
  // base 9 (b): la configuración con error no va al Runner.
  r.confDespacho = (deWs(14).find((t) => t.id === conf?.id)?.despacho as string | null) ?? null;
  // base 9 (a): cerrar el proveedor no cierra otro automático más nuevo del negocio.
  const prov = await ticketDeNoPude('proveedor', en(10, 'c5'), { error: '503' });
  const texto = await ticketDeNoPude('texto', en(10, 'c6'), { queNoPudo: 'crear la tarea' });
  r.cerroProv = await cerrarSiVolvio(10, 'proveedor');
  r.provId = prov?.id ?? null;
  r.textoEstado = deWs(10).find((t) => t.id === texto?.id)?.estado ?? null;
  // base 9 (c): con el tope de los automáticos lleno, no hay línea.
  for (let i = 0; i < 6; i++) await ticketDeNoPude('texto', en(12, `tope-${i}`), { queNoPudo: `cosa ${i}` });
  r.topeLleno = await conTicketsDeMaKo('No pude.\n\n[[no-pude: una cosa más]]', {}, en(12, 'tope-x'));
  // base 10: un ticket del SISTEMA (un error de la app) en el ws 10 no entra por la regla de Leandro.
  const sis = await crearTicket({ identidad: await identidadDe(10, 'dueno10@negocio-de-prueba.com', 'Dueño'), tipo: 'bug', declaradoPor: 'sistema', sistema: true,
    titulo: 'MaKo no pudo «crear la tarea»', descripcion: 'x', canal: 'sistema', contexto: { error: 'boom', herramienta: 'crear_tarea' }, ref: 'error:prueba:primera' });
  const fila = sis.ok ? pg.db.tickets.find((t) => t.id === sis.id) : null;
  r.sistemaRegla = (fila?.triage as { regla?: string } | null)?.regla ?? null;
  out.revision = r;
  process.stdout.write(`@@RESULTADO@@${JSON.stringify(out)}`);
}

main().then(() => process.exit(0), (e) => { process.stdout.write(`@@RESULTADO@@${JSON.stringify({ error: e instanceof Error ? e.stack : String(e) })}`); process.exit(0); });
