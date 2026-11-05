// =============================================================================
// Hijo de tests/creem-moderacion.test.ts — NO es un test (no termina en .test.ts)
// =============================================================================
// Corre `encolar` y `moderarPrompt` REALES (lib/flow-cola.ts y lib/creem-moderacion.ts, con `server-only`, en un node aparte
// con `--conditions=react-server`) contra un PostgREST de mentira y un Creem de mentira, y le contesta al test con un JSON:
//   · HOY (5/11/2026, sin proveedor): un pedido de imagen o de video se encola aunque la plataforma tenga una clave de Creem
//     vieja guardada, y no sale ningún pedido a Creem, ni una fila de uso, ni un error de la app, ni un ticket;
//   · lo que no genera (`creditos`) no pasa por la moderación, y un trabajo que genera sin `prompt` al tope no se encola;
//   · con un moderador enchufado (el molde de Creem, pasado a mano) y SIN su clave: se genera en silencio;
//   · con su clave: deny frena, allow pasa, el mismo prompt no se vuelve a pagar, el proveedor caído deja generar, la clave
//     que viaja es la de la PLATAFORMA (ws 9) y cada llamada queda medida a su nombre, sin el prompt;
//   · con la clave rechazada (401): se genera, y queda como error de la app (es nuestro).
// =============================================================================

import { crearPostgrest } from './_postgrest-de-mentira';

export {};

process.env.NEXT_PUBLIC_SUPABASE_URL = 'http://supa.test';
process.env.SUPABASE_SERVICE_ROLE_KEY = 'service-role-de-prueba';
process.env.CREDENCIALES_SECRET = 'secreto-de-prueba-de-32-caracteres-o-mas-para-el-test';
delete process.env.CREEM_API_KEY;

let n = 0;
const pg = crearPostgrest({
  tablas: ['credenciales', 'workspaces', 'flow_trabajos', 'anthropic_usage', 'errores_app', 'tickets', 'ticket_eventos', 'app_settings'],
  defaults: (_t, f) => ({ id: ++n, created_at: new Date().toISOString(), ...f }),
});

const CLAVE_PLATAFORMA = `creem_${'p'.repeat(30)}`;
const CLAVE_DEL_NEGOCIO = `creem_${'n'.repeat(30)}`;
let respuesta: { status: number; body: unknown } = { status: 200, body: {} };
const pedidosACreem: Array<{ url: string; clave: string; cuerpo: Record<string, unknown> }> = [];

globalThis.fetch = (async (entrada: RequestInfo | URL, init: RequestInit = {}) => {
  const u = new URL(typeof entrada === 'string' ? entrada : entrada instanceof URL ? entrada.href : entrada.url);
  if (u.host === 'supa.test') return pg.responder(u, init);
  if (u.host === 'api.creem.io' || u.host === 'test-api.creem.io') {
    const h = new Headers(init.headers);
    let cuerpo: Record<string, unknown> = {};
    try { cuerpo = JSON.parse(String(init.body ?? '{}')); } catch { /* nada */ }
    pedidosACreem.push({ url: u.href, clave: h.get('x-api-key') ?? '', cuerpo });
    return new Response(JSON.stringify(respuesta.body), { status: respuesta.status, headers: { 'content-type': 'application/json' } });
  }
  return new Response('{}', { status: 500 });
}) as typeof fetch;

const okCreem = (decision: string) => ({
  status: 200,
  body: { id: `mod_${decision}`, object: 'moderation', prompt: 'x', external_id: 'x', decision, usage: { units: 1 } },
});

async function main() {
  const { cifrarSecreto } = await import('../lib/credenciales');
  const { runWithWorkspace } = await import('../lib/workspace');
  const { encolar } = await import('../lib/flow-cola');
  const { moderarPrompt } = await import('../lib/creem-moderacion');
  const { CREEM } = await import('../lib/creem-moderacion-reglas');
  pg.db.workspaces.push({ id: 9, capa: 'superadmin', nombre: 'MaKo' }, { id: 13, capa: 'completo', nombre: 'Un negocio' });
  const filaPlataforma = { workspace_id: 9, clave: 'CREEM_API_KEY', valor_enc: cifrarSecreto(CLAVE_PLATAFORMA, 9, 'CREEM_API_KEY'), servicio: 'creem' };
  pg.db.credenciales.push(
    // Una clave de Creem VIEJA de la plataforma, por si quedó guardada: hoy no se lee.
    filaPlataforma,
    // El negocio que genera también tiene SU Creem (para cobrarles a sus clientes): nunca es la que modera.
    { workspace_id: 13, clave: 'CREEM_API_KEY', valor_enc: cifrarSecreto(CLAVE_DEL_NEGOCIO, 13, 'CREEM_API_KEY'), servicio: 'creem' },
  );
  const en13 = <T,>(fn: () => Promise<T>) => runWithWorkspace(13, fn);
  const trabajos = () => pg.db.flow_trabajos.length;
  const cuenta = () => ({ llamadas: pedidosACreem.length, usos: pg.db.anthropic_usage.length, errores: pg.db.errores_app.length, tickets: pg.db.tickets.length });
  const out: Record<string, unknown> = {};

  // ── HOY: sin proveedor. Creem contestaría deny, y no importa: no se le pregunta. ──
  respuesta = okCreem('deny');
  const imagen = await en13(() => encolar('generar_imagen', { motor: 'interfaz', prompt: 'un prompt que un moderador negaría', referencias: [] }));
  const clip = await en13(() => encolar('generar_clip', { motor: 'interfaz', prompt: 'una toma de un auto rojo al atardecer', referencias: ['m1'] }));
  out.hoy = { imagen: typeof imagen === 'number' ? 'number' : imagen, clip: typeof clip === 'number' ? 'number' : clip, trabajos: trabajos(), ...cuenta() };

  const antesCreditos = pedidosACreem.length;
  await en13(() => encolar('creditos', { path: '/v1/credits', body: {} }));
  out.creditos = { llamadas: pedidosACreem.length - antesCreditos };

  const antesSinPrompt = trabajos();
  const sinPrompt = await en13(() => encolar('generar_imagen', { path: '/v1/x', parches: [] }));
  out.sinPrompt = { r: sinPrompt, nuevos: trabajos() - antesSinPrompt };

  // ── Con un moderador enchufado (el molde de Creem) y SIN la clave de la plataforma. ──
  pg.db.credenciales.splice(pg.db.credenciales.indexOf(filaPlataforma), 1);
  const a0 = cuenta();
  const vSin = await en13(() => moderarPrompt('lo que se niega, sin clave', 'generar_imagen', { proveedor: CREEM }));
  const a1 = cuenta();
  out.sinClave = { v: vSin, llamadas: a1.llamadas - a0.llamadas, usos: a1.usos - a0.usos, errores: a1.errores - a0.errores, tickets: a1.tickets - a0.tickets };

  // ── Con la clave de la plataforma de vuelta. ──
  pg.db.credenciales.push(filaPlataforma);
  const conClave: Record<string, unknown> = {};
  respuesta = okCreem('deny');
  conClave.deny = await en13(() => moderarPrompt('lo que se niega', 'generar_imagen', { proveedor: CREEM }));
  respuesta = okCreem('allow');
  conClave.allow = await en13(() => moderarPrompt('una toma de un auto rojo al atardecer', 'generar_imagen', { proveedor: CREEM }));
  const antes = pedidosACreem.length;
  await en13(() => moderarPrompt('una toma de un auto rojo al atardecer', 'generar_imagen', { proveedor: CREEM }));
  conClave.recordado = { llamadas: pedidosACreem.length - antes };
  respuesta = { status: 500, body: { error: 'caído', eco: 'una casa en la playa' } };
  conClave.caido = await en13(() => moderarPrompt('una casa en la playa', 'generar_imagen', { proveedor: CREEM }));
  out.conClave = conClave;
  out.claves = [...new Set(pedidosACreem.map((p) => p.clave === CLAVE_PLATAFORMA ? 'plataforma' : p.clave === CLAVE_DEL_NEGOCIO ? 'negocio' : 'otra'))];
  out.usos = pg.db.anthropic_usage.map((f) => ({ ws: f.workspace_id, provider: f.provider, feature: f.feature, motivo: String(f.motivo ?? '') }));

  // ── La clave rechazada: es nuestra. ──
  respuesta = { status: 401, body: { message: 'bad key' } };
  const e0 = pg.db.errores_app.length;
  const vRech = await en13(() => moderarPrompt('otro pedido', 'generar_imagen', { proveedor: CREEM }));
  out.rechazada = { v: vRech, errores: pg.db.errores_app.length - e0 };

  out.sinMock = [...pg.sinMock];
  process.stdout.write(JSON.stringify(out));
}

main().catch((e) => { process.stdout.write(JSON.stringify({ error: e instanceof Error ? `${e.message}\n${e.stack}` : String(e) })); });
