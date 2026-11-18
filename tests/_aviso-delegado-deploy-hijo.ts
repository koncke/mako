// =============================================================================
// Hijo de tests/aviso-delegado-deploy.test.ts — NO es un test (no termina en .test.ts)
// =============================================================================
// El cierre REAL del cron (`cerrarLosDesplegados`, lib/tickets-cierre.ts) sobre un PostgREST de mentira, con el caso del #110 de Marcela
// (18/11/2026): un PEDIDO DELEGADO esperando la decisión, con su hito `tickets: [n]` en el build. El deploy lo cierra solo y sin
// decisión; lo que llegó fue la CAPACIDAD. Se mira la fila que queda (la marca en su contexto) y el aviso que sale de ESA fila
// (`textoDelAviso`, lo mismo que usa `avisarUno`). Datos inventados. Escribe una línea `@@DEPLOY@@<json>`. Necesita `--conditions=react-server`.
// =============================================================================

import { crearPostgrest, type Fila } from './_postgrest-de-mentira';

process.env.NEXT_PUBLIC_SUPABASE_URL = 'http://supa.test';
process.env.SUPABASE_SERVICE_ROLE_KEY = 'service-role-de-prueba';

let n = 7000;
const pg = crearPostgrest({
  tablas: ['tickets', 'ticket_eventos', 'app_settings', 'workspaces', 'grupo_mensajes', 'usuarios', 'agencia_clientes', 'grupo_invitados'],
  defaults: (t, f) => ({ id: ++n, ...(t === 'ticket_eventos' ? { at: new Date().toISOString() } : {}), ...f }),
  orCompleto: true,
});
globalThis.fetch = (async (entrada: RequestInfo | URL, init: RequestInit = {}) => {
  const u = new URL(typeof entrada === 'string' ? entrada : entrada instanceof URL ? entrada.href : entrada.url);
  if (u.host !== 'supa.test') return new Response(JSON.stringify({ error: 'red de mentira' }), { status: 500 });
  return pg.responder(u, init);
}) as typeof fetch;

const DELEGADO = { delegado: true, pedido: 'agrega una nota al lead Valery: agendar llamarla en dos semanas', hecho: ['agregar_nota_lead'] };
const ticket = (id: number, estado: string, extra: Fila = {}): Fila => ({
  id, created_at: new Date().toISOString(), updated_at: new Date().toISOString(), workspace_id: 23, usuario_id: null,
  titulo: 'Lo que faltó de: agendar la llamada a Valery', estado, canal: 'whatsapp', contexto: null, respuesta: null, duplicado_de: null,
  avisado_at: null, decision: null, ...extra,
});

async function main() {
  const { cerrarLosDesplegados, avisarPendientes } = await import('../lib/tickets-cierre');
  const { textoDelAviso } = await import('../lib/tickets-reglas');
  const fila = (id: number) => pg.db.tickets.find((t) => t.id === id)!;
  const aviso = (id: number) => textoDelAviso(fila(id) as never);

  pg.db.workspaces.push({ id: 9, capa: 'superadmin', nombre: 'MaKo', estado: 'activo' }, { id: 23, capa: 'completo', nombre: 'Inmobiliaria de prueba', estado: 'activo' });
  pg.db.tickets.push(
    // El #110 tal cual: delegado, esperando la decisión, nadie lo contestó.
    ticket(110, 'esperando_decision', { contexto: { ...DELEGADO } }),
    // Lo que hizo el Cerebro a mano para el #110: `responder` con la respuesta, y el ticket abierto. El deploy conserva las dos.
    ticket(111, 'esperando_decision', { contexto: { ...DELEGADO }, decision: 'responder', respuesta: 'Ya está: MaKo agenda la llamada en tu Calendario. Pídeselo de nuevo aquí en el grupo.' }),
    // Un ticket que NO es un pedido delegado: su aviso y su contexto, como siempre.
    ticket(112, 'en_curso', { canal: 'formulario', titulo: 'La etapa no se guardaba', contexto: { pagina: '/crm' } }),
  );
  const desplegados = new Map([
    [110, { area: 'mako-doer', titulo: 'MaKo te agenda la llamada a un lead en el Calendario, además de dejarle la nota' }],
    [111, { area: 'mako-doer', titulo: 'MaKo te agenda la llamada a un lead en el Calendario, además de dejarle la nota' }],
    [112, { area: 'crm', titulo: 'La etapa se guarda' }],
  ]);
  const cerrados = await cerrarLosDesplegados(desplegados);
  const out = {
    cerrados,
    filas: Object.fromEntries([110, 111, 112].map((id) => [id, { estado: fila(id).estado, decision: fila(id).decision, contexto: fila(id).contexto, respuesta: fila(id).respuesta }])),
    avisos: Object.fromEntries([110, 111, 112].map((id) => [id, aviso(id)])),
    // Y el cron que avisa no se cae con la marca (lee la misma fila).
    avisar: await avisarPendientes(),
    sinMock: [...pg.sinMock],
  };
  process.stdout.write(`\n@@DEPLOY@@${JSON.stringify(out)}\n`);
}

main().catch((e) => { process.stdout.write(`\n@@DEPLOY@@${JSON.stringify({ error: e instanceof Error ? `${e.message}\n${e.stack}` : String(e) })}\n`); });
