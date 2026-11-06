// =============================================================================
// Hijo de tests/spy-guion-youtube.test.ts — NO es un test (no termina en .test.ts)
// =============================================================================
// Corre `guionDeYoutubeConGemini` (lib/ai-cheap.ts) REAL contra una base y un Gemini de mentira, y anota cada pedido a Google:
// el modelo, la clave, el video (`fileData.fileUri`), el tramo (`videoMetadata`) y la resolución. Los negocios: el ws13 con SU
// Gemini y el ws14 sin ninguna IA. El Gemini de mentira contesta según la vuelta: bien, «high demand» (503), un 400 (un video
// que no puede abrir), un guion cortado (MAX_TOKENS) o «(vacío)».
// =============================================================================

import { crearPostgrest } from './_postgrest-de-mentira';

process.env.NEXT_PUBLIC_SUPABASE_URL = 'http://supa.test';
process.env.SUPABASE_SERVICE_ROLE_KEY = 'service-role-de-prueba';
process.env.CREDENCIALES_SECRET = 'secreto-de-prueba-de-32-caracteres-o-mas-para-el-test';
for (const k of ['ANTHROPIC_API_KEY', 'OPENAI_API_KEY', 'GEMINI_API_KEY', 'GROQ_API_KEY', 'GEMINI_MODEL', 'GEMINI_STT_MODEL']) delete process.env[k];

let n = 0;
const pg = crearPostgrest({
  tablas: ['credenciales', 'workspaces', 'app_settings', 'anthropic_usage', 'ia_cuotas', 'ia_rebotes', 'ia_pc_dispositivos'],
  defaults: (_t, f) => ({ id: ++n, created_at: new Date().toISOString(), ...f }),
});

type Pedido = { modelo: string; clave: string; video: string | null; tramo: unknown; resolucion: string | null };
let pedidos: Array<Pedido> = [];
let otros: string[] = [];
/** Qué contesta cada modelo en esta vuelta. */
let contesta: Record<string, 'ok' | '503' | '400' | 'cortado' | 'vacio' | 'corto'> = {};

const json = (cuerpo: unknown, status = 200) => new Response(JSON.stringify(cuerpo), { status, headers: { 'content-type': 'application/json' } });
globalThis.fetch = (async (entrada: RequestInfo | URL, init: RequestInit = {}) => {
  const u = new URL(typeof entrada === 'string' ? entrada : entrada instanceof URL ? entrada.href : entrada.url);
  if (u.host === 'supa.test') return pg.responder(u, init);
  if (u.host !== 'generativelanguage.googleapis.com') { otros.push(u.host); return json({ error: { message: 'red de mentira' } }, 500); }
  const m = /\/v1beta\/models\/([^/:]+):generateContent$/.exec(u.pathname);
  const modelo = m ? decodeURIComponent(m[1]) : `?${u.pathname}`;
  const cuerpo = JSON.parse(String(init.body ?? '{}')) as {
    contents?: Array<{ parts?: Array<{ fileData?: { fileUri?: string }; videoMetadata?: unknown }> }>;
    generationConfig?: { mediaResolution?: string };
  };
  const video = cuerpo.contents?.[0]?.parts?.[0];
  pedidos.push({
    modelo, clave: new Headers(init.headers).get('x-goog-api-key') ?? '', video: video?.fileData?.fileUri ?? null,
    tramo: video?.videoMetadata ?? null, resolucion: cuerpo.generationConfig?.mediaResolution ?? null,
  });
  const que = contesta[modelo] ?? 'ok';
  if (que === '503') return json([{ error: { code: 503, message: 'This model is currently experiencing high demand. Spikes in demand are usually temporary. Please try again later.', status: 'UNAVAILABLE' } }], 503);
  if (que === '400') return json({ error: { code: 400, message: 'Request contains an invalid argument: the video is private.', status: 'INVALID_ARGUMENT' } }, 400);
  const usageMetadata = { promptTokenCount: 18_600, candidatesTokenCount: 900, totalTokenCount: 19_500 };
  if (que === 'cortado') return json({ candidates: [{ content: { parts: [{ text: 'Hola a todos, hoy' }] }, finishReason: 'MAX_TOKENS' }], usageMetadata });
  if (que === 'vacio') return json({ candidates: [{ content: { parts: [{ text: '(vacío)' }] }, finishReason: 'STOP' }], usageMetadata });
  // Lo que midió el 6/11: un tramo de 10 minutos que vuelve con dos frases y `finishReason=STOP`, sin error.
  if (que === 'corto') return json({ candidates: [{ content: { parts: [{ text: `Hola a todos, hoy les cuento (${modelo}).` }] }, finishReason: 'STOP' }], usageMetadata });
  // Un guion entero de 10 minutos (~7.000 caracteres: por encima del piso de 600 por minuto).
  return json({ candidates: [{ content: { parts: [{ text: `Hola a todos. Esto lo dijo el video (${modelo}). ${'Y siguió hablando de lo suyo. '.repeat(240)}` }] }, finishReason: 'STOP' }], usageMetadata });
}) as typeof fetch;

const CON_GEMINI = 13, SIN_IA = 14;
const URL_YT = 'https://www.youtube.com/watch?v=AbCdEfGhIj0';

async function main() {
  const { cifrarSecreto } = await import('../lib/credenciales');
  const { runWithWorkspace } = await import('../lib/workspace');
  const ai = await import('../lib/ai-cheap');
  const sat = await import('../lib/ia-saturacion');
  pg.db.workspaces.push({ id: CON_GEMINI, capa: 'cliente', nombre: 'ws13' }, { id: SIN_IA, capa: 'cliente', nombre: 'ws14' });
  pg.db.credenciales.push({ workspace_id: CON_GEMINI, clave: 'GEMINI_API_KEY', valor_enc: cifrarSecreto(`gemini-13-${'k'.repeat(40)}`, CON_GEMINI, 'GEMINI_API_KEY'), servicio: 'GEMINI_API_KEY' });

  const out: Record<string, unknown> = {};
  const vuelta = async (nombre: string, ws: number, url: string, tramo: { desdeS: number; hastaS: number } | null, que: typeof contesta, duracionS?: number) => {
    sat.olvidarSaturados();
    pedidos = []; otros = []; contesta = que;
    const usoAntes = (pg.db.anthropic_usage ?? []).length;
    const r = await runWithWorkspace(ws, () => ai.guionDeYoutubeConGemini(url, tramo, { feature: 'spy', motivo: 'Competitors Spy: el guion de un video de YouTube', duracionS }))
      .catch((e) => ({ tiro: e instanceof Error ? e.message : String(e) }));
    // `recordUsage` corre sin esperarlo (`void`): su fila llega un instante después.
    await new Promise((ok) => setTimeout(ok, 60));
    const uso = (pg.db.anthropic_usage ?? []).slice(usoAntes);
    out[nombre] = { r, pedidos, otros, uso, saturadoLatest: sat.estaSaturado('gemini', 'gemini-flash-latest') };
  };
  await vuelta('A', CON_GEMINI, URL_YT, { desdeS: 600, hastaS: 1200 }, {});
  await vuelta('B', CON_GEMINI, URL_YT, null, {});
  await vuelta('C', CON_GEMINI, URL_YT, null, { 'gemini-flash-latest': '503' });
  await vuelta('D', CON_GEMINI, URL_YT, null, { 'gemini-flash-latest': '503', 'gemini-flash-lite-latest': '503' });
  await vuelta('E', CON_GEMINI, URL_YT, null, { 'gemini-flash-latest': '400' });
  await vuelta('F', SIN_IA, URL_YT, null, {});
  await vuelta('G', CON_GEMINI, 'https://www.youtube.com/watch?v=AbCdEfGhIj0&list=x', null, {});
  await vuelta('H', CON_GEMINI, URL_YT, null, { 'gemini-flash-latest': 'cortado' });
  await vuelta('I', CON_GEMINI, URL_YT, null, { 'gemini-flash-latest': 'vacio' });
  // El piso (6/11/2026): un tramo de 10 minutos con dos frases va al otro modelo; si los dos vienen cortos, el más largo, marcado.
  await vuelta('J', CON_GEMINI, URL_YT, { desdeS: 0, hastaS: 600 }, { 'gemini-flash-latest': 'corto' });
  await vuelta('K', CON_GEMINI, URL_YT, { desdeS: 0, hastaS: 600 }, { 'gemini-flash-latest': 'corto', 'gemini-flash-lite-latest': 'corto' });
  await vuelta('L', CON_GEMINI, URL_YT, null, { 'gemini-flash-latest': 'corto' }, 240);
  await vuelta('M', CON_GEMINI, URL_YT, { desdeS: 0, hastaS: 600 }, { 'gemini-flash-latest': 'vacio' });
  process.stdout.write(`@@RESULTADO@@${JSON.stringify(out)}`);
}

const vivo = setInterval(() => {}, 1_000);
main().finally(() => clearInterval(vivo)).then(() => process.exit(0), (e) => { process.stdout.write(`@@RESULTADO@@${JSON.stringify({ error: e instanceof Error ? e.stack : String(e) })}`); process.exit(0); });
