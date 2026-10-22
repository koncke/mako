// =============================================================================
// Hijo de tests/ia16-gemini-pago.test.ts — NO es un test (no termina en .test.ts)
// =============================================================================
// IA16 (22/10/2026). Martín: «Groq sólo para las notas de voz» y, del pago de Gemini, «Sí, sin tope». Corre la capa REAL
// contra un PostgREST de mentira y anota a qué hosts sale cada llamada (y con qué clave):
//   · el ws12 tiene SÓLO su Groq; el ws13, sólo su Gemini; el ws14, nada; la plataforma (ws9), Gemini y Groq;
//   · con y sin la marca del Gemini PAGO de la plataforma (`ia.gemini.plataforma_paga`).
// Todo lo que no es la base contesta un error (así la cascada recorre todo lo permitido), salvo el embedding de Gemini,
// que contesta un vector de 768.
// =============================================================================

import { crearPostgrest } from './_postgrest-de-mentira';

process.env.NEXT_PUBLIC_SUPABASE_URL = 'http://supa.test';
process.env.SUPABASE_SERVICE_ROLE_KEY = 'service-role-de-prueba';
process.env.CREDENCIALES_SECRET = 'secreto-de-prueba-de-32-caracteres-o-mas-para-el-test';
for (const k of ['ANTHROPIC_API_KEY', 'OPENAI_API_KEY', 'GROQ_API_KEY']) delete process.env[k];
// El `.env.local` de una PC puede traer OTRA clave de Gemini (gratis): el embedding no la tiene que usar.
process.env.GEMINI_API_KEY = `AQ.ENTORNO-gratis-${'e'.repeat(30)}`;

let n = 0;
const pg = crearPostgrest({
  tablas: ['credenciales', 'workspaces', 'app_settings', 'anthropic_usage', 'ia_cuotas', 'ia_rebotes', 'ia_pc_dispositivos', 'mako_knowledge'],
  defaults: (_t, f) => ({ id: ++n, created_at: new Date().toISOString(), ...f }),
});
let red: Array<{ host: string; camino: string; clave: string }> = [];
globalThis.fetch = (async (entrada: RequestInfo | URL, init: RequestInit = {}) => {
  const u = new URL(typeof entrada === 'string' ? entrada : entrada instanceof URL ? entrada.href : entrada.url);
  if (u.host === 'supa.test') return pg.responder(u, init);
  const h = new Headers(init.headers);
  red.push({ host: u.host, camino: u.pathname, clave: (h.get('x-goog-api-key') ?? h.get('authorization') ?? '').replace(/^Bearer /, '').slice(0, 20) });
  if (u.pathname.endsWith(':embedContent')) return new Response(JSON.stringify({ embedding: { values: Array.from({ length: 768 }, (_, i) => (i % 7) / 7) } }), { status: 200, headers: { 'content-type': 'application/json' } });
  return new Response(JSON.stringify({ error: { message: 'red de mentira' } }), { status: 500, headers: { 'content-type': 'application/json' } });
}) as typeof fetch;

const PLATAFORMA = 9;

async function main() {
  const { cifrarSecreto } = await import('../lib/credenciales');
  const { runWithWorkspace } = await import('../lib/workspace');
  const ai = await import('../lib/ai-cheap');
  const { olvidarGeminiPago } = await import('../lib/gemini-pago');
  const { olvidarD6b } = await import('../lib/solo-su-ia');
  const { embed } = await import('../lib/embeddings');
  const { searchKnowledge } = await import('../lib/mako-knowledge');
  pg.db.workspaces.push({ id: PLATAFORMA, capa: 'superadmin', nombre: 'MaKo' }, ...[1, 12, 13, 14].map((id) => ({ id, capa: 'cliente', nombre: `ws${id}` })));
  const poner = (ws: number, clave: string, valor = `${ws}-${clave}-${'k'.repeat(30)}`) => pg.db.credenciales.push({ workspace_id: ws, clave, valor_enc: cifrarSecreto(valor, ws, clave), servicio: clave.split('_')[0].toLowerCase() });
  poner(12, 'GROQ_API_KEY');
  poner(13, 'GEMINI_API_KEY');
  poner(PLATAFORMA, 'GEMINI_API_KEY', `AQ.PLATAFORMA-paga-${'p'.repeat(30)}`);
  poner(PLATAFORMA, 'GROQ_API_KEY');
  const audio = Buffer.from('audio de prueba').toString('base64');
  const correr = async (ws: number, f: () => Promise<unknown>) => { red = []; await runWithWorkspace(ws, async () => { try { await f(); } catch { /* el error de mentira */ } }); return red.map((x) => x.host); };
  const texto = (feature: string, extra: Record<string, unknown> = {}) => () => ai.chatCheapCascade({ system: 's', user: 'la reunión con Juan', feature, redDePlataforma: true, ...extra });
  const out: Record<string, unknown> = {};

  // ── Sin la marca del Gemini pago (hoy) ─────────────────────────────────────────────────────────────────────────────
  out.sinMarca = {
    ws12Texto: await correr(12, texto('landing-analyst')),
    ws12TextoPedidoAGroq: await correr(12, texto('landing-analyst', { provs: ['groq'] })),
    ws12ChatCheapGroq: await correr(12, () => ai.chatCheap({ system: 's', user: 'x', feature: 'ia-barata', provider: 'groq', model: 'openai/gpt-oss-20b' })),
    ws12NotaDeVoz: await correr(12, () => ai.transcribirAudio(audio, 'audio/ogg', { feature: 'MaKo · nota de voz', pii: true })),
    ws12Anuncio: await correr(12, () => ai.transcribirAudio(audio, 'audio/ogg', { feature: 'transcribir-anuncio', pii: true, sinGroq: true })),
    ws14TextoConPII: await correr(14, texto('lead_insights', { pii: true })),
    ws14NotaDeVozConPII: await correr(14, () => ai.transcribirAudio(audio, 'audio/ogg', { feature: 'MaKo · nota de voz', pii: true })),
    ws14TextoSinPII: await correr(14, texto('ads-rename')),
  };
  out.embedSinMarca = await runWithWorkspace(1, () => embed('hola').then(() => 'embebió', (e) => `tiró: ${e instanceof Error ? e.message : String(e)}`));
  // Cada capa sola (la de `proveedor` tapa a las otras dos): la cascada ni PRUEBA a Groq pedido a mano (sus errores no lo
  // nombran), y la red de la plataforma no lo trae para texto (sí para audio).
  const errores: string[] = [];
  await runWithWorkspace(12, () => ai.chatCheapCascade({ system: 's', user: 'x', feature: 'landing-analyst', provs: ['groq'], erroresOut: errores }).catch(() => ''));
  out.erroresConGroqPedido = errores;
  out.redTexto = await runWithWorkspace(14, () => ai.provsGratisDePlataforma()).then((l) => [...new Set(l.map((x) => x.provider))]);
  out.redAudio = await runWithWorkspace(14, () => ai.provsGratisDePlataforma('audio')).then((l) => [...new Set(l.map((x) => x.provider))]);

  // ── Con la marca del Gemini pago ───────────────────────────────────────────────────────────────────────────────────
  pg.db.app_settings.push({ workspace_id: PLATAFORMA, key: 'ia.gemini.plataforma_paga', value: '1' });
  olvidarGeminiPago(); olvidarD6b();
  out.conMarca = {
    ws14TextoConPII: await correr(14, texto('lead_insights', { pii: true })),
    ws14NotaDeVozConPII: await correr(14, () => ai.transcribirAudio(audio, 'audio/ogg', { feature: 'MaKo · nota de voz', pii: true })),
    ws14AnuncioConPII: await correr(14, () => ai.transcribirAudio(audio, 'audio/ogg', { feature: 'transcribir-anuncio', pii: true, sinGroq: true })),
  };
  red = [];
  out.embedConMarca = await runWithWorkspace(1, () => embed('hola', 'consulta').then((v) => `vector de ${v.length}`, (e) => `tiró: ${e instanceof Error ? e.message : String(e)}`));
  out.embedRed = [...red];
  // El buscador: una fila vieja (OpenAI, 1536) y una nueva (Gemini, 768). Sólo la del mismo largo puede aparecer.
  pg.db.mako_knowledge.push(
    { id: 901, workspace_id: 1, titulo: 'vieja', categoria: null, cuerpo: 'algo', area: 'general', fuente: 'manual', activo: true, estado: 'indexado', embedding: Array.from({ length: 1536 }, () => 0.5) },
    { id: 902, workspace_id: 1, titulo: 'nueva', categoria: null, cuerpo: 'algo', area: 'general', fuente: 'manual', activo: true, estado: 'indexado', embedding: Array.from({ length: 768 }, (_, i) => (i % 7) / 7) },
  );
  out.busqueda = await runWithWorkspace(1, () => searchKnowledge('hola', 5)).then((r) => r.map((x) => x.titulo));
  out.claveEmbed = (out.embedRed as Array<{ clave: string }>).map((x) => x.clave);
  process.stdout.write(`@@IA16@@${JSON.stringify(out)}\n`);
}

main().then(() => process.exit(0), (e) => { process.stdout.write(`@@IA16@@${JSON.stringify({ error: e instanceof Error ? e.stack : String(e) })}\n`); process.exit(0); });
