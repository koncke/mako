// =============================================================================
// Hijo de tests/ia16-cada-uno-su-ia.test.ts — NO es un test (no termina en .test.ts)
// =============================================================================
// IA16 (22/10/2026). Martín, textual: «Cada usuario debe poder pagar su token, su propia IA de gemini» y «Groq sólo para
// las notas de voz». Corre la capa REAL contra un PostgREST de mentira y anota a qué hosts sale cada llamada (y con qué
// clave):
//   · el ws12 tiene SÓLO su Groq; el ws13, su Gemini (dos cuentas); el ws14, nada; el ws1, una COPIA de la Gemini de la
//     plataforma; la plataforma (ws9), Gemini y Groq.
// Todo lo que no es la base contesta un error (así la cascada recorre todo lo permitido), salvo el embedding de Gemini, que
// contesta un vector de 768 — menos el primer pedido del ws13, que contesta un 429 (para ver que prueba la otra cuenta).
// =============================================================================

import { crearPostgrest } from './_postgrest-de-mentira';

process.env.NEXT_PUBLIC_SUPABASE_URL = 'http://supa.test';
process.env.SUPABASE_SERVICE_ROLE_KEY = 'service-role-de-prueba';
process.env.CREDENCIALES_SECRET = 'secreto-de-prueba-de-32-caracteres-o-mas-para-el-test';
for (const k of ['ANTHROPIC_API_KEY', 'OPENAI_API_KEY', 'GROQ_API_KEY']) delete process.env[k];
// El `.env.local` de una PC trae la clave de Gemini de la plataforma: ningún negocio la tiene que usar.
process.env.GEMINI_API_KEY = `AQ.ENTORNO-de-la-pc-${'e'.repeat(30)}`;

let n = 0;
const pg = crearPostgrest({
  tablas: ['credenciales', 'workspaces', 'app_settings', 'anthropic_usage', 'ia_cuotas', 'ia_rebotes', 'ia_pc_dispositivos', 'mako_knowledge'],
  defaults: (_t, f) => ({ id: ++n, created_at: new Date().toISOString(), ...f }),
});
let red: Array<{ host: string; camino: string; clave: string }> = [];
let embebioWs13 = 0;
const json = (o: unknown, status = 200) => new Response(JSON.stringify(o), { status, headers: { 'content-type': 'application/json' } });
globalThis.fetch = (async (entrada: RequestInfo | URL, init: RequestInit = {}) => {
  const u = new URL(typeof entrada === 'string' ? entrada : entrada instanceof URL ? entrada.href : entrada.url);
  if (u.host === 'supa.test') return pg.responder(u, init);
  const h = new Headers(init.headers);
  const clave = (h.get('x-goog-api-key') ?? h.get('authorization') ?? '').replace(/^Bearer /, '').slice(0, 20);
  red.push({ host: u.host, camino: u.pathname, clave });
  if (u.pathname.endsWith(':embedContent')) {
    // La PRIMERA cuenta del ws13 que se prueba (cuál va primero lo decide el orden por cuota) contesta un 429.
    if (clave.startsWith('13-GEMINI') && !embebioWs13++) return json({ error: { message: 'Resource has been exhausted' } }, 429);
    return json({ embedding: { values: Array.from({ length: 768 }, (_, i) => (i % 7) / 7) } });
  }
  return json({ error: { message: 'red de mentira' } }, 500);
}) as typeof fetch;

const PLATAFORMA = 9;
const DE_LA_PLATAFORMA = `AQ.PLATAFORMA-gemini-${'p'.repeat(30)}`;

async function main() {
  const { cifrarSecreto } = await import('../lib/credenciales');
  const { runWithWorkspace } = await import('../lib/workspace');
  const ai = await import('../lib/ai-cheap');
  const { embed, SIN_SU_GEMINI } = await import('../lib/embeddings');
  const { searchKnowledge } = await import('../lib/mako-knowledge');
  pg.db.workspaces.push({ id: PLATAFORMA, capa: 'superadmin', nombre: 'MaKo' }, ...[1, 12, 13, 14].map((id) => ({ id, capa: 'cliente', nombre: `ws${id}` })));
  const poner = (ws: number, clave: string, valor = `${ws}-${clave}-${'k'.repeat(30)}`) => pg.db.credenciales.push({ workspace_id: ws, clave, valor_enc: cifrarSecreto(valor, ws, clave), servicio: clave.split('_')[0].toLowerCase() });
  poner(12, 'GROQ_API_KEY');
  poner(13, 'GEMINI_API_KEY');
  poner(13, 'GEMINI_API_KEY_2');
  poner(1, 'GEMINI_API_KEY', DE_LA_PLATAFORMA);
  poner(PLATAFORMA, 'GEMINI_API_KEY', DE_LA_PLATAFORMA);
  poner(PLATAFORMA, 'GROQ_API_KEY');
  const audio = Buffer.from('audio de prueba').toString('base64');
  const correr = async (ws: number, f: () => Promise<unknown>) => { red = []; await runWithWorkspace(ws, async () => { try { await f(); } catch { /* el error de mentira */ } }); return [...red]; };
  const hosts = (r: Array<{ host: string }>) => r.map((x) => x.host);
  const texto = (feature: string, extra: Record<string, unknown> = {}) => () => ai.chatCheapCascade({ system: 's', user: 'la reunión con Juan', feature, redDePlataforma: true, ...extra });
  const nota = () => ai.transcribirAudio(audio, 'audio/ogg', { feature: 'MaKo · nota de voz', pii: true });
  const out: Record<string, unknown> = {};

  // ── Groq: sólo escucha ─────────────────────────────────────────────────────────────────────────────────────────────
  out.groq = {
    ws12Texto: hosts(await correr(12, texto('landing-analyst'))),
    ws12TextoPedidoAGroq: hosts(await correr(12, texto('landing-analyst', { provs: ['groq'] }))),
    ws12ChatCheapGroq: hosts(await correr(12, () => ai.chatCheap({ system: 's', user: 'x', feature: 'ia-barata', provider: 'groq', model: 'openai/gpt-oss-20b' }))),
    ws12NotaDeVoz: await correr(12, nota),
    ws12Anuncio: hosts(await correr(12, () => ai.transcribirAudio(audio, 'audio/ogg', { feature: 'transcribir-anuncio', pii: true, sinGroq: true }))),
  };
  const errores: string[] = [];
  await runWithWorkspace(12, () => ai.chatCheapCascade({ system: 's', user: 'x', feature: 'landing-analyst', provs: ['groq'], erroresOut: errores }).catch(() => ''));
  out.erroresConGroqPedido = errores;

  // ── Sin su IA: nada de la plataforma, con o sin datos de clientes ─────────────────────────────────────────────────
  out.sinSuIA = {
    ws14TextoConPII: hosts(await correr(14, texto('lead_insights', { pii: true }))),
    ws14TextoSinPII: hosts(await correr(14, texto('ads-rename'))),
    ws14NotaDeVoz: hosts(await correr(14, nota)),
    ws14Anuncio: hosts(await correr(14, () => ai.transcribirAudio(audio, 'audio/ogg', { feature: 'transcribir-anuncio', sinGroq: true }))),
    // La copia de la clave de la plataforma no es suya.
    ws1Texto: hosts(await correr(1, texto('ads-rename'))),
  };
  out.redCliente = {
    texto: await runWithWorkspace(14, () => ai.provsGratisDePlataforma()).then((l) => l.map((x) => x.provider)),
    audio: await runWithWorkspace(14, () => ai.provsGratisDePlataforma('audio')).then((l) => l.map((x) => x.provider)),
  };
  // Lo interno de MaKo (el ws9) sí tiene la suya.
  out.redPlataforma = {
    texto: await runWithWorkspace(PLATAFORMA, () => ai.provsGratisDePlataforma()).then((l) => [...new Set(l.map((x) => x.provider))]),
    audio: await runWithWorkspace(PLATAFORMA, () => ai.provsGratisDePlataforma('audio')).then((l) => [...new Set(l.map((x) => x.provider))].sort()),
  };

  // ── Con su Gemini: todo con la suya ───────────────────────────────────────────────────────────────────────────────
  out.suGemini = {
    texto: await correr(13, texto('lead_insights', { pii: true })),
    nota: await correr(13, nota),
  };

  // ── El buscador de conocimiento ───────────────────────────────────────────────────────────────────────────────────
  const embeber = (ws: number) => async () => { red = []; const r = await runWithWorkspace(ws, () => embed('hola', 'consulta').then((v) => `vector de ${v.length}`, (e) => `tiró: ${e instanceof Error ? e.message : String(e)}`)); return { r, claves: red.map((x) => x.clave) }; };
  out.embed = { ws13: await embeber(13)(), ws14: await embeber(14)(), ws1: await embeber(1)(), ws9: await embeber(PLATAFORMA)() };
  out.SIN_SU_GEMINI = SIN_SU_GEMINI;
  // Una fila vieja (OpenAI, 1536) del ws13 y una nueva (Gemini, 768) del método de la plataforma: la consulta del ws13, con
  // su Gemini, encuentra la de la plataforma (el vector sale del modelo, no de la cuenta) y no la vieja.
  pg.db.mako_knowledge.push(
    { id: 901, workspace_id: 13, titulo: 'vieja', categoria: null, cuerpo: 'algo', area: 'general', fuente: 'manual', activo: true, estado: 'indexado', embedding: Array.from({ length: 1536 }, () => 0.5) },
    { id: 902, workspace_id: PLATAFORMA, titulo: 'del método', categoria: null, cuerpo: 'algo', area: 'general', fuente: 'mako', activo: true, estado: 'indexado', embedding: Array.from({ length: 768 }, (_, i) => (i % 7) / 7) },
  );
  out.busqueda = await runWithWorkspace(13, () => searchKnowledge('hola', 5)).then((r) => r.map((x) => x.titulo));
  out.busquedaSinSuGemini = await runWithWorkspace(14, () => searchKnowledge('hola', 5)).then((r) => r.map((x) => x.titulo));

  // ── El método de MaKo vive en el ws1 (un cliente, sin su Gemini): se embebe con la de la plataforma; lo suyo, no ──────
  const { reindexKnowledge, reembeberLoQueFalta } = await import('../lib/mako-knowledge');
  pg.db.mako_knowledge.push(
    { id: 903, workspace_id: 1, titulo: 'método en el ws1', categoria: null, cuerpo: 'el método', area: 'general', fuente: 'mako', activo: true, estado: 'pendiente', embedding: null },
    { id: 904, workspace_id: 1, titulo: 'nota de Mauricio', categoria: null, cuerpo: 'lo suyo', area: 'general', fuente: 'manual', activo: true, estado: 'pendiente', embedding: null },
  );
  const reindexar = async (ws: number, id: number) => { red = []; const fila = await runWithWorkspace(ws, () => reindexKnowledge(id)); return { estado: fila?.estado, error: fila?.error ?? null, claves: red.map((x) => x.clave) }; };
  out.metodoWs1 = await reindexar(1, 903);
  out.notaWs1 = await reindexar(1, 904);
  // ── Al conectar su Gemini, lo que quedó sin buscador se embebe con su cuenta (y lo que ya está en Gemini, no) ─────────
  pg.db.mako_knowledge.push(
    { id: 905, workspace_id: 13, titulo: 'sin vector', categoria: null, cuerpo: 'a', area: 'general', fuente: 'manual', activo: true, estado: 'error', embedding: null },
    { id: 906, workspace_id: 13, titulo: 'ya en Gemini', categoria: null, cuerpo: 'b', area: 'general', fuente: 'manual', activo: true, estado: 'indexado', embedding: Array.from({ length: 768 }, () => 0.1) },
  );
  red = [];
  const n = await runWithWorkspace(13, () => reembeberLoQueFalta());
  out.alConectar = {
    n,
    claves: [...new Set(red.map((x) => x.clave))],
    largos: pg.db.mako_knowledge.filter((f) => f.workspace_id === 13).map((f) => [f.titulo, Array.isArray(f.embedding) ? (f.embedding as unknown[]).length : 0]),
  };
  process.stdout.write(`@@IA16@@${JSON.stringify(out)}\n`);
}

main().then(() => process.exit(0), (e) => { process.stdout.write(`@@IA16@@${JSON.stringify({ error: e instanceof Error ? e.stack : String(e) })}\n`); process.exit(0); });
