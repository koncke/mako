// =============================================================================
// Hijo de tests/chat-ia.test.ts — NO es un test (no termina en .test.ts)
// =============================================================================
// Con qué IA corre un chat (8b, 23/10/2026), con lib/chat-ia.ts y lib/anthropic.ts REALES contra una base y unas APIs de
// mentira: qué cuentas se ofrecen en cada negocio, qué elección pasa, y que lo elegido llegue a la llamada (el modelo y la
// clave), sin caer a otra cuenta. Escribe el resultado como JSON.
// =============================================================================

import { crearPostgrest } from './_postgrest-de-mentira';

process.env.NEXT_PUBLIC_SUPABASE_URL = 'http://supa.test';
process.env.SUPABASE_SERVICE_ROLE_KEY = 'service-role-de-prueba';
process.env.CREDENCIALES_SECRET = 'secreto-de-prueba-de-32-caracteres-o-mas-para-el-test';
for (const k of ['ANTHROPIC_API_KEY', 'OPENAI_API_KEY', 'GEMINI_API_KEY', 'GROQ_API_KEY', 'ANTHROPIC_CREDITO_CUENTA1', 'ANTHROPIC_CREDITO_CUENTA2']) delete process.env[k];

let n = 0;
const pg = crearPostgrest({
  tablas: ['credenciales', 'workspaces', 'app_settings', 'anthropic_usage', 'ia_cuotas', 'ia_rebotes', 'ia_pc_dispositivos', 'ia_pc_turnos'],
  defaults: (tabla, f) => (tabla === 'anthropic_usage' ? { id: ++n, created_at: new Date(Date.now() + n).toISOString(), ...f } : f),
});
const PLATAFORMA = 9;
const CLAUDE_MAKO = `sk-ant-api03-plataforma-${'p'.repeat(40)}`;
const CREDITO1 = `sk-ant-api03-credito-cuenta1-${'c'.repeat(40)}`;
const PROPIA = `sk-ant-api03-propia-de-ana-${'a'.repeat(40)}`;
const OPENAI_PROPIA = `sk-proj-propia-de-ana-${'A'.repeat(40)}`;

let llamadas: Array<{ a: string; clave: string; modelo: string; campos?: string[] }> = [];
globalThis.fetch = (async (entrada: RequestInfo | URL, init: RequestInit = {}) => {
  const u = new URL(typeof entrada === 'string' ? entrada : entrada instanceof URL ? entrada.href : entrada.url);
  if (u.host === 'supa.test') return pg.responder(u, init);
  const r = (status: number, body: unknown) => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });
  const h = new Headers(init.headers);
  let modelo = '';
  try { modelo = String(JSON.parse(String(init.body ?? '{}')).model ?? ''); } catch { /* sin cuerpo */ }
  if (u.host === 'api.anthropic.com') {
    const clave = h.get('x-api-key') ?? '';
    llamadas.push({ a: 'anthropic', clave: clave.slice(0, 28), modelo });
    if (clave !== CREDITO1 && clave !== PROPIA) return r(401, { type: 'error', error: { type: 'authentication_error', message: 'invalid x-api-key' } });
    return r(200, { id: 'msg_1', type: 'message', role: 'assistant', model: modelo, stop_reason: 'end_turn', content: [{ type: 'text', text: 'hola desde Claude' }], usage: { input_tokens: 100, output_tokens: 20 } });
  }
  if (u.host === 'api.openai.com') {
    const clave = (h.get('authorization') ?? '').replace(/^Bearer /, '');
    // Los campos de salida que viajan: un modelo con razonamiento rechaza `max_tokens` y `temperature` (lib/ai-cheap-techo.ts).
    let campos: string[] = [];
    try { campos = Object.keys(JSON.parse(String(init.body ?? '{}'))).filter((k) => /^(max_tokens|max_completion_tokens|temperature)$/.test(k)).sort(); } catch { /* sin cuerpo */ }
    llamadas.push({ a: 'openai', clave: clave.slice(0, 22), modelo, campos });
    if (clave !== OPENAI_PROPIA) return r(401, { error: { message: 'Incorrect API key provided' } });
    return r(200, { id: 'c1', object: 'chat.completion', model: modelo, choices: [{ index: 0, message: { role: 'assistant', content: 'hola desde OpenAI' }, finish_reason: 'stop' }], usage: { prompt_tokens: 100, completion_tokens: 20 } });
  }
  return r(500, { error: { message: 'red de mentira' } });
}) as typeof fetch;

async function main() {
  const { cifrarSecreto } = await import('../lib/credenciales');
  const { runWithWorkspace } = await import('../lib/workspace');
  const { chatClaudeTools } = await import('../lib/anthropic');
  const { cuentasDeIA, eleccionDelPedido } = await import('../lib/chat-ia');
  pg.db.workspaces.push({ id: PLATAFORMA, capa: 'superadmin', nombre: 'MaKo' }, { id: 1, capa: 'completo', nombre: 'Mauricio' }, { id: 20, capa: 'cliente', nombre: 'Ana' }, { id: 21, capa: 'cliente', nombre: 'Sin nada' });
  const poner = (ws: number, clave: string, valor: string) => pg.db.credenciales.push({ workspace_id: ws, clave, valor_enc: cifrarSecreto(valor, ws, clave), servicio: clave.split('_')[0].toLowerCase() });
  poner(PLATAFORMA, 'ANTHROPIC_API_KEY', CLAUDE_MAKO);
  poner(PLATAFORMA, 'ANTHROPIC_CREDITO_CUENTA1', CREDITO1);
  // El ws1 con la copia de la clave de MaKo (el crédito asignado entra por la puerta 2); el ws20 con las suyas.
  poner(1, 'ANTHROPIC_API_KEY', CLAUDE_MAKO);
  poner(20, 'ANTHROPIC_API_KEY', PROPIA);
  poner(20, 'OPENAI_API_KEY', OPENAI_PROPIA);
  // La computadora de Ana (en línea, con su Claude con sesión).
  pg.db.ia_pc_dispositivos.push({ id: 5, workspace_id: 20, persona: 'ana@negocio.com', nombre: 'Oficina', ultimo_latido: new Date().toISOString(), cuentas: [{ proveedor: 'claude', email: 'ana@gmail.com' }], confirmado_at: new Date().toISOString(), activa_at: new Date().toISOString(), revocado_at: null, claude_falta: false, creado_at: new Date().toISOString() });
  // El super admin con SU computadora: igual no elige nada (en su workspace contesta la IA de la plataforma).
  pg.db.ia_pc_dispositivos.push({ id: 6, workspace_id: PLATAFORMA, persona: 'martin@mako.com', nombre: 'MSI', ultimo_latido: new Date().toISOString(), cuentas: [{ proveedor: 'claude', email: 'martin@gmail.com' }], confirmado_at: new Date().toISOString(), activa_at: new Date().toISOString(), revocado_at: null, claude_falta: false, creado_at: new Date().toISOString() });
  const ana = { ws: 20, actor: 'ana@negocio.com', rol: 'admin' as const };
  const beto = { ws: 20, actor: 'beto@negocio.com', rol: 'miembro' as const };
  const out: Record<string, unknown> = {};
  out.cuentasAna = await cuentasDeIA(ana);
  out.cuentasOtraPersona = (await cuentasDeIA(beto)).map((c) => c.cuenta);
  out.modelosDelMiembro = (await cuentasDeIA(beto)).find((c) => c.cuenta === 'anthropic')?.modelos;
  out.openaiDelMiembro = (await cuentasDeIA(beto)).find((c) => c.cuenta === 'openai');
  out.cuentasMauricio = await cuentasDeIA({ ws: 1, actor: 'mauricio@negocio.com', rol: 'admin' });
  out.cuentasSinNada = await cuentasDeIA({ ws: 21, actor: 'x@y.com' });
  out.cuentasSuperAdmin = await cuentasDeIA({ ws: PLATAFORMA, actor: 'martin@mako.com' });
  // Lo que pasa la validación.
  out.eleccion = {
    sonnet: await eleccionDelPedido(ana, { cuenta: 'anthropic', modelo: 'sonnet' }),
    pcOpus: await eleccionDelPedido(ana, JSON.stringify({ cuenta: 'pc', modelo: 'opus' })),
    openaiConModelo: await eleccionDelPedido(ana, { cuenta: 'openai', modelo: 'gpt-6.1-sol' }),
    openaiModeloViejo: await eleccionDelPedido(ana, { cuenta: 'openai', modelo: 'gpt-4o-mini' }),
    openaiModeloDelMiembro: await eleccionDelPedido(beto, { cuenta: 'openai', modelo: 'gpt-6.1-sol' }),
    pcDeOtro: await eleccionDelPedido(beto, { cuenta: 'pc' }),
    sonnetDelMiembro: await eleccionDelPedido(beto, { cuenta: 'anthropic', modelo: 'sonnet' }),
    sonnetConElCredito: await eleccionDelPedido({ ws: 1, actor: 'mauricio@negocio.com', rol: 'admin' }, { cuenta: 'anthropic', modelo: 'sonnet' }),
    openaiSinClave: await eleccionDelPedido({ ws: 1, actor: 'mauricio@negocio.com' }, { cuenta: 'openai' }),
    basura: await eleccionDelPedido(ana, { cuenta: 'constructor' }),
    nada: await eleccionDelPedido(ana, undefined),
  };
  // Lo elegido llega a la llamada.
  const correr = async (ws: number, opts: Record<string, unknown>) => {
    llamadas = [];
    const r = await runWithWorkspace(ws, () => chatClaudeTools('sos MaKo', [{ role: 'user', content: 'hola' }], [], async () => 'ok', { feature: 'mako-doer', maxSteps: 2, sinFallbackClaude: true, ...opts }))
      .then((x) => x.text, (e) => `TIRÓ: ${e instanceof Error ? e.message : String(e)}`);
    return { r, llamadas };
  };
  out.suClaudeSonnet = await correr(20, { soloSuClaude: true, modeloSuClaude: 'sonnet' });
  out.suClaudeSinElegir = await correr(20, { soloSuClaude: true });
  out.creditoConSonnet = await correr(1, { soloSuClaude: true, modeloSuClaude: 'sonnet' });
  out.suOpenAI = await correr(20, { soloSuOpenAI: true });
  out.suOpenAIConModelo = await correr(20, { soloSuOpenAI: true, modeloSuOpenAI: 'gpt-6.1-sol' });
  out.suOpenAISinClave = await correr(1, { soloSuOpenAI: true });
  // La ola 3 (23/10): una SEGUNDA computadora de Ana que reporta su ChatGPT. Recién ahí se ofrece «Tu computadora · ChatGPT»;
  // la de Claude sigue siendo «Oficina» (la de ChatGPT no tiene cuenta de Claude).
  out.cuentasAnaSinGpt = (await cuentasDeIA(ana)).map((c) => c.cuenta);
  pg.db.ia_pc_dispositivos.push({ id: 7, workspace_id: 20, persona: 'ana@negocio.com', nombre: 'Casa', ultimo_latido: new Date().toISOString(), cuentas: [{ proveedor: 'chatgpt', email: 'ana@gmail.com' }], confirmado_at: new Date().toISOString(), activa_at: new Date().toISOString(), revocado_at: null, claude_falta: false, creado_at: new Date().toISOString() });
  out.cuentasAnaConGpt = await cuentasDeIA(ana);
  out.eleccionPcGpt = await eleccionDelPedido(ana, { cuenta: 'pc-chatgpt', modelo: 'gpt-6.1-sol' });
  out.eleccionPcGptDeBeto = await eleccionDelPedido(beto, { cuenta: 'pc-chatgpt' });
  process.stdout.write(`@@CHATIA@@${JSON.stringify(out)}\n`);
}

main().then(() => process.exit(0), (e) => { process.stdout.write(`@@CHATIA@@${JSON.stringify({ error: e instanceof Error ? e.stack : String(e) })}\n`); process.exit(0); });
