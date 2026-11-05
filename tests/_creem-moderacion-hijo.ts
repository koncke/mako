// =============================================================================
// Hijo de tests/creem-moderacion.test.ts — NO es un test (no termina en .test.ts)
// =============================================================================
// Corre `encolar` REAL (lib/flow-cola.ts, con `server-only`, en un node aparte con `--conditions=react-server`) contra un
// PostgREST de mentira y un Creem de mentira, y le contesta al test con un JSON. Mide lo que le importa a Creem y a quien
// genera, en el camino de verdad:
//   · deny / flag → no se encola NADA y vuelve el rechazo con su texto;
//   · allow → se encola, y la llamada queda MEDIDA (una fila de anthropic_usage, a nombre de la plataforma, sin el prompt);
//   · Creem caído (500) → se encola igual (lo pedido) y la llamada también queda medida;
//   · el mismo prompt otra vez → no se vuelve a llamar a Creem;
//   · lo que no genera (`creditos`) no pasa por Creem;
//   · un trabajo que genera sin `prompt` al tope no se encola;
//   · la clave que viaja es la de la PLATAFORMA (ws 9), nunca la del negocio que genera.
// =============================================================================

import { crearPostgrest } from './_postgrest-de-mentira';

export {};

process.env.NEXT_PUBLIC_SUPABASE_URL = 'http://supa.test';
process.env.SUPABASE_SERVICE_ROLE_KEY = 'service-role-de-prueba';
process.env.CREDENCIALES_SECRET = 'secreto-de-prueba-de-32-caracteres-o-mas-para-el-test';
delete process.env.CREEM_API_KEY;

let n = 0;
const pg = crearPostgrest({
  tablas: ['credenciales', 'workspaces', 'flow_trabajos', 'anthropic_usage', 'errores_app', 'tickets'],
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
  pg.db.workspaces.push({ id: 9, capa: 'superadmin', nombre: 'MaKo' }, { id: 13, capa: 'completo', nombre: 'Un negocio' });
  pg.db.credenciales.push(
    { workspace_id: 9, clave: 'CREEM_API_KEY', valor_enc: cifrarSecreto(CLAVE_PLATAFORMA, 9, 'CREEM_API_KEY'), servicio: 'creem' },
    // El negocio que genera también tiene SU Creem (para cobrarles a sus clientes): no es la que modera.
    { workspace_id: 13, clave: 'CREEM_API_KEY', valor_enc: cifrarSecreto(CLAVE_DEL_NEGOCIO, 13, 'CREEM_API_KEY'), servicio: 'creem' },
  );
  const en13 = <T,>(fn: () => Promise<T>) => runWithWorkspace(13, fn);
  const trabajos = () => pg.db.flow_trabajos.length;
  const usos = () => pg.db.anthropic_usage.map((f) => ({ ws: f.workspace_id, provider: f.provider, feature: f.feature, motivo: String(f.motivo ?? '') }));
  const out: Record<string, unknown> = {};

  respuesta = okCreem('deny');
  const deny = await en13(() => encolar('generar_imagen', { motor: 'interfaz', prompt: 'un prompt que Creem niega', referencias: [] }));
  out.deny = { r: deny, trabajos: trabajos(), creem: pedidosACreem.length };

  respuesta = okCreem('flag');
  const flag = await en13(() => encolar('generar_clip', { motor: 'interfaz', prompt: 'un prompt que Creem marca', referencias: ['m1'] }));
  out.flag = { r: flag, trabajos: trabajos() };

  respuesta = okCreem('allow');
  const allow = await en13(() => encolar('generar_clip', { motor: 'interfaz', prompt: 'una toma de un auto rojo al atardecer', referencias: ['m1'] }));
  out.allow = { r: allow, trabajos: trabajos(), workspace: pg.db.flow_trabajos.at(-1)?.workspace_id };

  const antes = pedidosACreem.length;
  const otraVez = await en13(() => encolar('generar_clip', { motor: 'interfaz', prompt: 'una toma de un auto rojo al atardecer', referencias: ['m1'] }));
  out.recordado = { r: typeof otraVez, llamadas: pedidosACreem.length - antes, trabajos: trabajos() };

  respuesta = { status: 500, body: { error: 'caído', eco: 'una casa en la playa' } };
  const caido = await en13(() => encolar('generar_imagen', { motor: 'interfaz', prompt: 'una casa en la playa', referencias: [] }));
  out.caido = { r: typeof caido, trabajos: trabajos() };

  const antesCreditos = pedidosACreem.length;
  await en13(() => encolar('creditos', { path: '/v1/credits', body: {} }));
  out.creditos = { llamadas: pedidosACreem.length - antesCreditos, trabajos: trabajos() };

  const antesSinPrompt = trabajos();
  const sinPrompt = await en13(() => encolar('generar_imagen', { path: '/v1/x', parches: [] }));
  out.sinPrompt = { r: sinPrompt, nuevos: trabajos() - antesSinPrompt };

  out.claves = [...new Set(pedidosACreem.map((p) => p.clave === CLAVE_PLATAFORMA ? 'plataforma' : p.clave === CLAVE_DEL_NEGOCIO ? 'negocio' : 'otra'))];
  out.hosts = [...new Set(pedidosACreem.map((p) => new URL(p.url).host + new URL(p.url).pathname))];
  out.cuerpo = pedidosACreem[0]?.cuerpo ?? null;
  out.usos = usos();
  out.sinMock = [...pg.sinMock];
  process.stdout.write(JSON.stringify(out));
}

main().catch((e) => { process.stdout.write(JSON.stringify({ error: e instanceof Error ? `${e.message}\n${e.stack}` : String(e) })); });
