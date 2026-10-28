// =============================================================================
// Hijo de tests/no-existe-revision.test.ts — NO es un test (no termina en .test.ts)
// =============================================================================
// Corre `conPedidoDeNoExiste` y `crearTicket` REALES contra una base de mentira. Usa sólo lo que también existía en 34b0687f0,
// para que el test se ponga ROJO sobre esa punta por lo que HACE (no por un import que falta). Lo de `lib/no-pude-server.ts`
// va aparte y, si el módulo no está, deja su error en `ruteo`.
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

async function main() {
  const { conPedidoDeNoExiste } = await import('../lib/no-existe-server');
  const { crearTicket, identidadDe } = await import('../lib/tickets-db');
  pg.db.workspaces.push({ id: 10, capa: 'cliente', nombre: 'Negocio de prueba 10' }, { id: 11, capa: 'cliente', nombre: 'Negocio de prueba 11' }, { id: 12, capa: 'cliente', nombre: 'Negocio de prueba 12' });
  const out: Record<string, unknown> = {};
  const fila = (t: Record<string, unknown>) => ({ ws: t.workspace_id, estado: t.estado, despacho: t.despacho ?? null, regla: (t.triage as { regla?: string } | null)?.regla ?? null });

  // 1. ws 10 (la regla de Leandro): un «no existe» que marcó MaKo, sin que nadie lo confirme.
  // Un pedido neutro: «borrar» o «enviar» ya los frena la zona delicada (y el test no mediría la regla).
  await conPedidoDeNoExiste('Eso todavía no existe en MaKo.\n\n[[no-existe: un tablero con el ranking de los vendedores]]', {
    ws: 10, actor: 'dueno10@negocio-de-prueba.com', nombre: 'Dueño', chat: 'ops-center', ruta: '/crm', pedido: '¿me armas un ranking de los vendedores?',
  });
  out.uno = pg.db.tickets.filter((t) => t.workspace_id === 10).map(fila);

  // 3. ws 11: cuatro tickets a mano, diez «no existe» distintos en un día (en conversaciones distintas: `conv`, que 34b0687f0 no
  //    conocía), y después la persona levanta otro a mano en Soporte. Con los automáticos contados serían 14: rebotaría.
  const EMAIL = 'duena11@negocio-de-prueba.com';
  const identidad = await identidadDe(11, EMAIL, 'Dueña');
  for (let i = 0; i < 4; i++) await crearTicket({ identidad, tipo: 'bug', declaradoPor: 'persona', titulo: `Algo ${i + 1}`, descripcion: 'x', canal: 'formulario', contexto: {} });
  for (let i = 0; i < 10; i++) {
    await conPedidoDeNoExiste(`Eso todavía no existe.\n\n[[no-existe: una cosa distinta número ${i + 1}]]`, { ws: 11, actor: EMAIL, nombre: 'Dueña', chat: 'ops-center', conv: `conversacion-${i + 1}`, pedido: `pedido ${i + 1}` } as Parameters<typeof conPedidoDeNoExiste>[1]);
  }
  const aMano = await crearTicket({ identidad, tipo: 'bug', declaradoPor: 'persona', titulo: 'No me carga la ficha', descripcion: 'Desde ayer.', canal: 'formulario', contexto: {} });
  // Con el tope de los automáticos lleno, lo que sigue no se pierde: se anota en el último.
  const automaticos = pg.db.tickets.filter((t) => t.workspace_id === 11 && String(t.ref ?? '').startsWith('np:'));
  const otros = pg.db.ticket_eventos.filter((e) => String(e.texto ?? '').startsWith('Otro más, con el tope del día lleno')).length;
  out.tres = { aMano: aMano.ok, error: aMano.ok ? null : aMano.error, automaticos: automaticos.length, otros };

  // 2. Ruteo: MaKo marcó «no existe» pero el turno llamó una operación que existe y no viajó. En otro negocio (el 11 ya tiene
  //    el tope de los automáticos lleno, y lo nuevo se anotaría en el último).
  try {
    const { conTicketsDeMaKo } = await import('../lib/no-pude-server');
    const r = await conTicketsDeMaKo('Eso todavía no existe en MaKo.\n\n[[no-existe: editar las cuotas de un lead]]', { ruteo: true }, {
      ws: 12, actor: 'duena12@negocio-de-prueba.com', nombre: 'Dueña', superficie: 'analyst', conv: 'sesion-300', pedido: 'No me deja editar sus cuotas',
    }, { operacion: 'Editar una cuota' });
    const t = pg.db.tickets.find((x) => x.id === r.ticket?.id) as Record<string, unknown> | undefined;
    out.ruteo = { causa: r.causa, tipo: t?.tipo ?? null, titulo: t?.titulo ?? null, respuestaMako: (t?.contexto as { respuestaMako?: string } | null)?.respuestaMako ?? null };
  } catch (e) {
    out.ruteo = { error: e instanceof Error ? e.message : String(e) };
  }
  process.stdout.write(`@@RESULTADO@@${JSON.stringify(out)}`);
}

main().then(() => process.exit(0), (e) => { process.stdout.write(`@@RESULTADO@@${JSON.stringify({ error: e instanceof Error ? e.stack : String(e) })}`); process.exit(0); });
