// =============================================================================
// Hijo de tests/transcripcion-por-video.test.ts — NO es un test (no termina en .test.ts)
// =============================================================================
// O9 (18/11/2026): corre `transcribirAnuncio` y `transcribeAd` de verdad (Meta, la bajada del video y la IA son de mentira)
// sobre el PostgREST de mentira:
//   · ws3 (con su OpenAI): el anuncio a1 trae el video v1 → se transcribe y queda en creative_transcripts;
//     el anuncio a2 trae el MISMO video → sale de lo guardado, sin bajar el video ni llamar a la IA;
//   · ws13 (sin IA) con un anuncio del mismo video v1: lo de ws3 no se ve (aislamiento), así que intenta y falla;
//   · con una instrucción (el «Re-generar»), transcribeAd no pregunta por lo guardado aunque se lo pasen.
// =============================================================================

import { crearPostgrest } from './_postgrest-de-mentira';

process.env.NEXT_PUBLIC_SUPABASE_URL = 'http://supa.test';
process.env.SUPABASE_SERVICE_ROLE_KEY = 'service-role-de-prueba';
process.env.CREDENCIALES_SECRET = 'secreto-de-prueba-de-32-caracteres-o-mas-para-el-test';
process.env.META_API_VERSION = 'v21.0';
process.env.META_ACCESS_TOKEN = 'meta-del-entorno';

let n = 0;
const pg = crearPostgrest({
  tablas: ['credenciales', 'workspaces', 'app_settings', 'anthropic_usage', 'ia_cuotas', 'ia_rebotes', 'ia_pc_dispositivos', 'creative_transcripts'],
  defaults: (_t, f) => ({ id: ++n, created_at: new Date().toISOString(), ...f }),
});
let red: string[] = [];
globalThis.fetch = (async (entrada: RequestInfo | URL, init: RequestInit = {}) => {
  const u = new URL(typeof entrada === 'string' ? entrada : entrada instanceof URL ? entrada.href : entrada.url);
  if (u.host === 'supa.test') return pg.responder(u, init);
  red.push(`${(init.method ?? 'GET').toUpperCase()} ${u.host}${u.pathname}`);
  const json = (b: unknown, s = 200) => new Response(JSON.stringify(b), { status: s, headers: { 'content-type': 'application/json' } });
  // Los tres anuncios usan el MISMO video (v1), como un video que se prueba con dos textos.
  if (u.host === 'graph.facebook.com' && /\/(a1|a2|a9)$/.test(u.pathname)) return json({ creative: { video_id: 'v1' } });
  if (u.host === 'graph.facebook.com' && u.pathname.endsWith('/v1')) return json({ source: 'https://video.test/v1.mp4' });
  if (u.host === 'video.test') return new Response(new Uint8Array(2048), { status: 200, headers: { 'content-length': '2048', 'content-type': 'video/mp4' } });
  if (u.host === 'api.openai.com' && u.pathname.endsWith('/audio/transcriptions')) return json({ text: 'Hola, soy Ana. Si tu negocio no vende, mira esto: te muestro cómo llenar tu agenda. Escríbeme hoy.' });
  if (u.host === 'api.openai.com' && u.pathname.endsWith('/chat/completions')) return json({ choices: [{ message: { content: JSON.stringify({ secciones: [{ titulo: 'Hook', texto: 'Hola, soy Ana.' }, { titulo: 'CTA', texto: 'Escríbeme hoy.' }] }) } }], usage: { prompt_tokens: 10, completion_tokens: 10 } });
  return json({ error: { message: 'red de mentira' } }, 500);
}) as typeof fetch;

async function main() {
  const { cifrarSecreto } = await import('../lib/credenciales');
  const { runWithWorkspace, getTenantDb } = await import('../lib/workspace');
  const { transcribirAnuncio } = await import('../lib/transcripcion-por-video');
  const { transcribeAd } = await import('../lib/transcribe');
  pg.db.workspaces.push({ id: 9, capa: 'superadmin', nombre: 'MaKo' }, { id: 3, capa: 'cliente', nombre: 'Prueba' }, { id: 13, capa: 'cliente', nombre: 'Sin IA' });
  pg.db.credenciales.push({ workspace_id: 3, clave: 'OPENAI_API_KEY', valor_enc: cifrarSecreto(`sk-proj-DEL-NEGOCIO-${'n'.repeat(40)}`, 3, 'OPENAI_API_KEY'), servicio: 'openai' });
  const corrida = async (ws: number, adId: string) => {
    red = [];
    const r = await runWithWorkspace(ws, async () => transcribirAnuncio(await getTenantDb(), adId, { metaToken: 'meta-del-negocio' }));
    return { r, red };
  };
  const out: Record<string, unknown> = {};
  out.a1 = await corrida(3, 'a1');
  out.guardadas = pg.db.creative_transcripts.map((f) => ({ ws: f.workspace_id, video: f.video_id, status: f.status, texto: f.transcript }));
  out.a2 = await corrida(3, 'a2');
  out.ws13 = await corrida(13, 'a9');
  // Con una instrucción, no se pregunta por lo guardado aunque se lo pasen: rehacerla es el pedido.
  red = [];
  let preguntada = false;
  const conInstruccion = await runWithWorkspace(3, () => transcribeAd('a1', {
    metaToken: 'meta-del-negocio', instruccion: 'Corrige el nombre: es Ana',
    guardada: async () => { preguntada = true; return { status: 'ok', transcript: 'GUARDADA', secciones: null, idioma: null, duracion_s: null, model: 'x', error: null }; },
  }));
  out.instruccion = { r: conInstruccion, red, preguntada };
  // Si la pregunta falla, se transcribe como siempre (no pude leer no es «no hay que hacerla»).
  red = [];
  const fallaLectura = await runWithWorkspace(3, () => transcribeAd('a1', { metaToken: 'meta-del-negocio', guardada: async () => { throw new Error('base caída'); } }));
  out.fallaLectura = { r: fallaLectura, red };
  process.stdout.write(`@@RESULTADO@@${JSON.stringify(out)}`);
}

main().then(() => process.exit(0), (e) => { process.stdout.write(`@@RESULTADO@@${JSON.stringify({ error: e instanceof Error ? e.stack : String(e) })}`); process.exit(0); });
