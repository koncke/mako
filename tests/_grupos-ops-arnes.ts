// =============================================================================
// El arnés de los hijos de tests/grupos-ops-*.test.ts — NO es un test
// =============================================================================
// Lo de mentira, en un solo lugar: la SESIÓN (lib/auth.ts, con un AsyncLocalStorage: quien escribe y quien corre sin sesión son dos cosas), la base (PostgREST), el storage, Evolution (anota y contesta lo que
// pida la escena), web-push (anota), `after` (junta y se corre al final, como después de responder), y los modelos: Claude es el clasificador (la clase que ponga la escena) y el GPT del negocio es el turno. Lo demás,
// EL CÓDIGO REAL: las rutas, la puerta, la copia, el doer. Necesita `--conditions=react-server` y `--experimental-test-module-mocks`.
//
// ⚠️ `_postgrest-de-mentira` devuelve la fila entera en `select`: se compara lo que devuelve la ruta campo por campo, no sólo que exista.

import { mock } from 'node:test';
import { AsyncLocalStorage } from 'node:async_hooks';
import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { crearPostgrest } from './_postgrest-de-mentira';

const RAIZ = join(import.meta.dirname, '..');
process.env.MAKO_DOER_VENTANA_MS = '0';
process.env.NEXT_PUBLIC_SUPABASE_URL = 'http://supa.test';
process.env.SUPABASE_URL = 'http://supa.test';
process.env.SUPABASE_SERVICE_ROLE_KEY = 'service-role-de-prueba';
process.env.SUPABASE_SERVICE_KEY = 'service-role-de-prueba';
process.env.AUTH_SECRET = 'secreto-de-firma-de-prueba-suficientemente-largo';
process.env.CREDENCIALES_SECRET = 'secreto-de-prueba-de-32-caracteres-o-mas-para-el-test';
process.env.EVOLUTION_BASE_URL = 'http://evolution.test';
process.env.EVOLUTION_API_KEY = 'evo-de-prueba';
process.env.EVOLUTION_WEBHOOK_SECRET = 'secreto-del-webhook';
process.env.NEXT_PUBLIC_APP_URL = 'https://hola-mako.com';
process.env.APP_BASE_URL = 'https://hola-mako.com';
process.env.CRON_SECRET = 'secreto-del-cron';
process.env.RESEND_API_KEY = 're_de_prueba';
process.env.GROQ_API_KEY = `gsk_${'p'.repeat(48)}`;
for (const k of ['GEMINI_API_KEY', 'OPENAI_API_KEY', 'ANTHROPIC_API_KEY', 'MAKO_EQUIPO_NOMBRES', 'ANTHROPIC_CREDITO_CUENTA1', 'ANTHROPIC_CREDITO_CUENTA2', 'ANTHROPIC_CREDITO_CUENTA3', 'ANTHROPIC_CREDITO_CUENTA4']) delete process.env[k];

export const PLATAFORMA = 9;
export const CREDITO2 = `sk-ant-api03-credito-cuenta2-${'d'.repeat(40)}`;
export const OPENAI_NEGOCIO = `sk-proj-${'T3BlbkFJ'.repeat(4)}${'x9Y8z7W6'.repeat(5)}`;

let n = 1000;
export const pg = crearPostgrest({
  tablas: ['app_settings', 'workspaces', 'credenciales', 'mako_doer_buffer', 'mako_doer_lock', 'mako_doer_conv', 'mako_doer_enviados', 'anthropic_usage', 'errores_app', 'tickets', 'ticket_eventos',
    'mako_acciones_pendientes', 'ia_cuotas', 'ia_rebotes', 'ia_pc_dispositivos', 'ia_pc_turnos', 'no_pude', 'mako_turnos', 'usuarios', 'agencia_clientes', 'agencias', 'grupo_mensajes', 'grupo_invitados', 'grupo_leidos',
    'notificaciones', 'push_suscripciones', 'insistencias', 'evolution_instancias', 'nutricion_secuencias', 'plan_propuestas', 'flujo_corridas', 'avisos_cola', 'objectives', 'mako_knowledge', 'experimentos', 'funnels', 'avisos_programados'],
  defaults: (t, f) => ({
    id: ++n, created_at: new Date().toISOString(),
    ...(t === 'mako_doer_buffer' ? { estado: 'pendiente' } : {}),
    ...(t === 'mako_acciones_pendientes' ? { estado: 'pendiente' } : {}),
    ...(t === 'insistencias' ? { enviadas: 0, cerrada_at: null } : {}),
    ...(t === 'tickets' ? { updated_at: new Date().toISOString() } : {}),
    ...(t === 'grupo_mensajes' ? { adjunto: null, responde_a: null, reaccion: null, aviso_tipo: null, wa_message_id: null, wa_at: null, cliente_id: null, usuario_id: null, texto: '', autor_nombre: '' } : {}),
    ...(t === 'grupo_invitados' ? { usuario_id: null, invitado_at: new Date().toISOString(), abrio_at: null, avisado_at: null, salio_at: null } : {}),
    ...(t === 'grupo_leidos' ? { updated_at: new Date().toISOString() } : {}),
    ...f,
  }),
  unicos: [
    { tabla: 'mako_doer_buffer', columnas: ['grupo_jid', 'wa_message_id'], donde: (f) => f.wa_message_id !== '', nombre: 'ux_doer_buffer_msg' },
    // La fila del candado es una por grupo: sin esto, el insert de `reclamar` dejaba otra fila libre y cualquiera ganaba.
    { tabla: 'mako_doer_lock', columnas: ['workspace_id', 'grupo_jid'], donde: () => true, nombre: 'mako_doer_lock_pkey' },
    { tabla: 'grupo_mensajes', columnas: ['workspace_id', 'wa_message_id'], donde: (f) => f.wa_message_id != null, nombre: 'ux_grupo_mensajes_wa' },
    { tabla: 'grupo_mensajes', columnas: ['workspace_id', 'usuario_id', 'cliente_id'], donde: (f) => f.cliente_id != null, nombre: 'ux_grupo_mensajes_cliente' },
    { tabla: 'grupo_leidos', columnas: ['workspace_id', 'usuario_id'], donde: () => true, nombre: 'grupo_leidos_pkey' },
    { tabla: 'app_settings', columnas: ['workspace_id', 'key'], donde: () => true, nombre: 'app_settings_uk' },
  ],
  candado: true,
  orCompleto: true,
});
export const db = pg.db as Record<string, Array<Record<string, unknown>>>;

// ── La sesión ─────────────────────────────────────────────────────────────────────────────────────────────────

export type Sesion = { sub: string; email: string; nombre: string; rol: string; ws: number | null; rolWs: string | null; exp: number; legacy?: boolean };
const sesionStore = new AsyncLocalStorage<Sesion | null>();
/** Cuántas veces el código pidió la sesión y qué le tocó: lo que el turno NO tiene que ver. */
export const pedidosDeSesion: Array<Sesion | null> = [];
export const comoPersona = <T>(s: Sesion | null, f: () => T): T => sesionStore.run(s, f);
/** Otra invocación, sin cookies: como el webhook y /api/cron/grupo-turno. */
export const sinSesion = <T>(f: () => T): T => sesionStore.run(null, f);

function stub(rel: string, propios: Record<string, unknown>): void {
  const src = readFileSync(join(RAIZ, rel), 'utf8');
  const nombres = [...src.matchAll(/^export (?:async )?(?:function\*? |const |let )(\w+)/gm)].map((m) => m[1]);
  const namedExports: Record<string, unknown> = {};
  for (const x of nombres) namedExports[x] = () => { throw new Error(`${rel}: ${x} sin mock`); };
  mock.module(pathToFileURL(join(RAIZ, rel)).href, { namedExports: { ...namedExports, ...propios } });
}
stub('lib/auth.ts', {
  getUsuarioActual: async () => { const s = sesionStore.getStore() ?? null; pedidosDeSesion.push(s); return s; },
  getSesionAdmin: async () => { const s = sesionStore.getStore() ?? null; return s?.rol === 'admin' ? s : null; },
});
mock.module('next/headers', {
  namedExports: {
    cookies: async () => { if (!sesionStore.getStore()) throw new Error('sin pedido: cookies() tira, como en un cron'); return { get: () => undefined, set: () => {} }; },
    headers: async () => ({ get: () => null }),
  },
});

// ── `after`: se junta, y corre cuando la escena lo pide (después de responder) ─────────────────────────────────

const despues: Array<() => unknown> = [];
const reqCjs = createRequire(pathToFileURL(join(RAIZ, 'package.json')).href);
const nextServer = reqCjs('next/server') as Record<string, unknown>;
mock.module('next/server', { namedExports: { ...nextServer, after: (f: () => unknown) => { despues.push(f); } }, defaultExport: nextServer });
/** Corre lo que quedó para después. Lo de una persona corre SIN su sesión sólo si es la otra invocación: el fetch al cron. */
export async function correrDespues(): Promise<void> {
  while (despues.length) await despues.shift()!();
}

// ── web-push ───────────────────────────────────────────────────────────────────────────────────────────────────

export const pushes: Array<{ endpoint: string; cuerpo: Record<string, unknown> }> = [];
mock.module('web-push', {
  defaultExport: { sendNotification: async (sub: { endpoint: string }, cuerpo: string) => { pushes.push({ endpoint: sub.endpoint, cuerpo: JSON.parse(cuerpo) as Record<string, unknown> }); return { statusCode: 201 }; } },
});
(globalThis as unknown as { __makoVapid?: unknown }).__makoVapid = { claves: { publicKey: 'x'.repeat(60), privateKey: 'y'.repeat(30) }, hasta: Number.POSITIVE_INFINITY };

// ── La red ─────────────────────────────────────────────────────────────────────────────────────────────────────

export const red: Array<{ host: string; camino: string; cuerpo: string }> = [];
export const storage = new Map<string, Buffer>();
/** Lo que hace la red en cada escena. */
export const escena: {
  evolution: 'ok' | 'cae'; clase: string | null; respuesta: string; herramienta: { nombre: string; args: Record<string, unknown> } | null; transcripcion: string; escucha: boolean; iaCaida: boolean;
  fallar: Set<string>; colgar: Set<string>; demoraTurnoMs: number; cron: ((req: Request) => Promise<Response>) | null;
} = { evolution: 'ok', clase: null, respuesta: 'Soy MaKo.', herramienta: null, transcripcion: '', escucha: true, iaCaida: false, fallar: new Set(), colgar: new Set(), demoraTurnoMs: 0, cron: null };
let llamadasAlTurno = 0;
export function escenaNueva(e: Partial<typeof escena> = {}): void {
  Object.assign(escena, { evolution: 'ok', clase: null, respuesta: 'Soy MaKo.', herramienta: null, transcripcion: '', escucha: true, iaCaida: false, fallar: new Set(), colgar: new Set(), demoraTurnoMs: 0 }, e);
  llamadasAlTurno = 0;
  red.splice(0); pushes.splice(0); pedidosDeSesion.splice(0);
}

const json = (status: number, body: unknown) => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });
globalThis.fetch = (async (entrada: RequestInfo | URL, init: RequestInit = {}) => {
  const u = new URL(typeof entrada === 'string' ? entrada : entrada instanceof URL ? entrada.href : entrada.url);
  const metodo = (init.method ?? 'GET').toUpperCase();
  if (u.host === 'supa.test') {
    if (u.pathname.startsWith('/storage/v1/object/')) {
      const r = u.pathname.replace('/storage/v1/object/', '');
      if (r.startsWith('sign/')) return json(200, { signedURL: `/object/${r}?token=firmado` });
      const path = r.replace(/^archivero\//, '');
      if (metodo === 'GET') { const b = storage.get(path); return b ? new Response(new Uint8Array(b), { status: 200, headers: { 'content-type': 'application/octet-stream' } }) : json(404, { error: 'no está' }); }
      if (metodo === 'DELETE') return json(200, []);
      const cuerpo = init.body as unknown;
      storage.set(path, typeof cuerpo === 'string' ? Buffer.from(cuerpo) : cuerpo instanceof Uint8Array ? Buffer.from(cuerpo) : Buffer.from('x'));
      return json(200, { Key: path, Id: path });
    }
    const tabla = u.pathname.replace('/rest/v1/', '');
    if (escena.colgar.has(`${tabla}:${metodo}`)) { setInterval(() => {}, 1000); return new Promise<Response>(() => {}); } // un intervalo vivo: con el tope `unref`, node saldría callado
    if (escena.fallar.has(`${tabla}:${metodo}`)) return json(500, { code: 'XX000', message: `se cayó ${tabla}` });
    return pg.responder(u, init);
  }
  red.push({ host: u.host, camino: u.pathname, cuerpo: typeof init.body === 'string' ? init.body : '' });
  if (u.host === 'evolution.test') {
    if (u.pathname.includes('getBase64FromMediaMessage')) return json(404, { error: 'no está' });
    if (u.pathname.includes('sendPresence')) return json(200, {});
    if (escena.evolution === 'cae') return json(400, { response: { message: ['la sesión está caída'] } });
    return json(200, { key: { id: `env-${red.length}` } });
  }
  if (u.host === 'hola-mako.com' && u.pathname === '/api/cron/grupo-turno') {
    if (!escena.cron) return json(500, { error: 'sin ruta' });
    // OTRA INVOCACIÓN: sin la sesión de quien escribió.
    return sinSesion(() => escena.cron!(new Request(u.href, init)));
  }
  if (u.host === 'api.resend.com') return json(200, { id: `mail-${red.length}` });
  if (u.pathname.endsWith('/audio/transcriptions')) return escena.escucha ? json(200, { text: escena.transcripcion, duration: 5 }) : json(500, { error: { message: 'se cayó' } });
  if (u.host === 'api.anthropic.com') {
    if (escena.clase == null) return json(500, { type: 'error', error: { type: 'api_error', message: 'Overloaded' } });
    return json(200, { id: 'msg_1', type: 'message', role: 'assistant', model: 'claude', stop_reason: 'end_turn', content: [{ type: 'text', text: escena.clase }], usage: { input_tokens: 9, output_tokens: 9 } });
  }
  if (u.host === 'api.openai.com' && u.pathname.endsWith('/chat/completions')) {
    if (escena.iaCaida) return json(503, { error: { message: 'The server is overloaded' } });
    if (escena.demoraTurnoMs) await new Promise((r) => setTimeout(r, escena.demoraTurnoMs));
    if (escena.herramienta && ++llamadasAlTurno === 1) {
      const call = { id: 'call_1', type: 'function', function: { name: escena.herramienta.nombre, arguments: JSON.stringify(escena.herramienta.args) } };
      return json(200, { id: 'c0', object: 'chat.completion', model: 'gpt-4o-mini', choices: [{ index: 0, message: { role: 'assistant', content: null, tool_calls: [call] }, finish_reason: 'tool_calls' }], usage: { prompt_tokens: 9, completion_tokens: 9, total_tokens: 18 } });
    }
    return json(200, { id: 'c1', object: 'chat.completion', model: 'gpt-4o-mini', choices: [{ index: 0, message: { role: 'assistant', content: escena.respuesta }, finish_reason: 'stop' }], usage: { prompt_tokens: 9, completion_tokens: 9, total_tokens: 18 } });
  }
  return json(500, { error: { message: `red de mentira: ${u.href}` } });
}) as typeof fetch;

/** Lo que llegó a Evolution, sin lo que sólo lee. */
export const aEvolution = () => red.filter((x) => x.host === 'evolution.test').map((x) => x.camino);
/** Las llamadas al turno: su system, los mensajes y las herramientas que viajaron. */
export const alModelo = () => red.filter((x) => x.host === 'api.openai.com' && x.camino.endsWith('/chat/completions')).map((x) => {
  const b = JSON.parse(x.cuerpo) as { messages: Array<{ role: string; content: unknown }>; tools?: Array<{ function?: { name?: string } }> };
  return {
    system: String(b.messages.find((m) => m.role === 'system')?.content ?? ''), tools: (b.tools ?? []).map((t) => t.function?.name ?? ''),
    mensajes: b.messages.filter((m) => m.role !== 'system').map((m) => (typeof m.content === 'string' ? m.content : JSON.stringify(m.content))).join('\n---\n'),
    deHerramientas: b.messages.filter((m) => m.role === 'tool').map((m) => String(m.content ?? '')),
  };
});

/** La sesión de una fila de `usuarios`. */
export const sesionDe = (u: Record<string, unknown>): Sesion => ({
  sub: String(u.id), email: String(u.email), nombre: String(u.nombre ?? ''), rol: String(u.rol ?? 'usuario'), ws: (u.workspace_id as number | null) ?? null, rolWs: (u.rol_ws as string | null) ?? null, exp: 0,
});
export const usuario = (id: number, email: string, nombre: string, ws: number | null, rolWs: string | null, extra: Record<string, unknown> = {}) =>
  ({ id, email, nombre, rol: 'usuario', estado: 'activo', workspace_id: ws, rol_ws: rolWs, perfil: {}, foto_url: null, ...extra });
export const decirResultado = (out: unknown) => `@@RESULTADO@@${JSON.stringify(out)}\n`;
