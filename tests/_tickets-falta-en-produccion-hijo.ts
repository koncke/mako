// =============================================================================
// Hijo de tests/tickets-falta-en-produccion.test.ts — NO es un test (no termina en .test.ts)
// =============================================================================
// El cierre REAL del cron (`cerrarLosDesplegados` y `avisarPendientes`, lib/tickets-cierre.ts) sobre un PostgREST de mentira,
// con el caso del #93 de Mauricio (13/11/2026): el deploy trae el hito, pero al cliente le falta un paso en producción.
//   · el deploy NO cierra ni avisa el ticket con `falta`, deja UNA vez qué falta, y cierra los demás como siempre;
//   · marcado el paso hecho (el renglón que escribe `scripts/tickets.ts paso-hecho`), el cron siguiente lo cierra con su
//     duplicado y le avisa;
//   · sin poder leer el historial, no cierra (un «ya anda» falso no se deshace) ni repite el renglón.
// Escribe una línea `@@FALTA@@<json>` al final. Necesita `--conditions=react-server`.
// =============================================================================

import { crearPostgrest, type Fila } from './_postgrest-de-mentira';

process.env.NEXT_PUBLIC_SUPABASE_URL = 'http://supa.test';
process.env.SUPABASE_SERVICE_ROLE_KEY = 'service-role-de-prueba';

let n = 5000;
const pg = crearPostgrest({
  tablas: ['tickets', 'ticket_eventos', 'app_settings'],
  defaults: (t, f) => ({ id: ++n, ...(t === 'ticket_eventos' ? { at: new Date().toISOString() } : {}), ...f }),
  orCompleto: true,
});
let historialCaido = false;
globalThis.fetch = (async (entrada: RequestInfo | URL, init: RequestInit = {}) => {
  const u = new URL(typeof entrada === 'string' ? entrada : entrada instanceof URL ? entrada.href : entrada.url);
  if (u.host !== 'supa.test') return new Response(JSON.stringify({ error: 'red de mentira' }), { status: 500 });
  // Un 500 y no un 503: postgrest-js reintenta solo los 503 de un GET (docs/hallazgos-planes-y-cobro.md, 13/11).
  if (historialCaido && u.pathname.endsWith('/ticket_eventos') && (init.method ?? 'GET') === 'GET') {
    return new Response(JSON.stringify({ code: 'XX000', message: 'la base no contestó' }), { status: 500, headers: { 'content-type': 'application/json' } });
  }
  return pg.responder(u, init);
}) as typeof fetch;

const ticket = (id: number, estado: string, extra: Fila = {}): Fila => ({
  id, created_at: new Date().toISOString(), updated_at: new Date().toISOString(), workspace_id: 77, usuario_id: null, titulo: `ticket ${id}`,
  estado, canal: 'formulario', contexto: null, respuesta: null, duplicado_de: null, avisado_at: null, ...extra,
});

async function main() {
  const { cerrarLosDesplegados, avisarPendientes } = await import('../lib/tickets-cierre');
  const { TIPO_PASO_HECHO, TIPO_FALTA_EN_PRODUCCION } = await import('../lib/tickets-reglas');
  const fila = (id: number) => pg.db.tickets.find((t) => t.id === id)!;
  const eventos = (id: number) => pg.db.ticket_eventos.filter((e) => e.ticket_id === id).map((e) => e.tipo);
  const estados = () => Object.fromEntries([93, 94, 95].map((id) => [id, { estado: fila(id).estado, avisado: fila(id).avisado_at != null }]));

  // El #93 (con un paso en producción que falta), el #94 (sin nada que falte) y un duplicado del #93.
  pg.db.tickets.push(ticket(93, 'arreglado'), ticket(94, 'en_curso'), ticket(95, 'nuevo', { duplicado_de: 93 }));
  const desplegados = new Map([
    [93, { area: 'email', titulo: 'El freno de email ya no frena por un rebote', falta: 'prender su email, el tope y las columnas (con el sí de Martín)' }],
    [94, { area: 'mako-mobile', titulo: 'El Agency Dashboard vuelve al teléfono' }],
  ]);
  const out: Record<string, unknown> = {};

  // 1. El deploy: cierra el #94; el #93 no, y queda escrito qué le falta.
  out.primerCron = { cerrados: await cerrarLosDesplegados(desplegados), avisos: await avisarPendientes(), estados: estados(), eventos93: eventos(93) };
  out.textoFalta = pg.db.ticket_eventos.find((e) => e.ticket_id === 93 && e.tipo === TIPO_FALTA_EN_PRODUCCION)?.texto ?? null;
  // 2. Quince minutos después, sin el paso: igual, y el renglón no se repite.
  out.segundoCron = { cerrados: await cerrarLosDesplegados(desplegados), avisos: await avisarPendientes(), estados: estados(), eventos93: eventos(93) };
  // 3. Sin poder leer el historial: no se cierra a ciegas, ni se repite el renglón.
  pg.db.ticket_eventos.push({ id: ++n, ticket_id: 93, at: new Date().toISOString(), actor: 'cerebro', tipo: TIPO_PASO_HECHO, texto: 'Prendido su email, el tope y las columnas; se vio salir el primer envío.', datos: null });
  historialCaido = true;
  try {
    out.historialCaido = { cerrados: await cerrarLosDesplegados(desplegados), estados: estados(), eventos93: eventos(93) };
  } finally { historialCaido = false; }
  // 4. Con el paso hecho y el historial leído: se cierra con su duplicado, y se le avisa.
  out.conElPaso = { cerrados: await cerrarLosDesplegados(desplegados), avisos: await avisarPendientes(), estados: estados(), eventos93: eventos(93) };
  out.sinMock = [...pg.sinMock];
  process.stdout.write(`\n@@FALTA@@${JSON.stringify(out)}\n`);
}

main().catch((e) => { process.stdout.write(`\n@@FALTA@@${JSON.stringify({ error: e instanceof Error ? `${e.message}\n${e.stack}` : String(e) })}\n`); });
