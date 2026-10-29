// =============================================================================
// Hijo de tests/audio-citado.test.ts — NO es un test (no termina en .test.ts)
// =============================================================================
// `escucharElAudioCitado` REAL (lib/mako-doer-in.ts) con el payload de Leandro (ws10, 28/10/2026): «No me respondiste lo de este
// audio» citando su nota de voz de 94 s, con el audio en `contextInfo.quotedMessage.audioMessage` del nivel de arriba (Evolution
// v2). Evolution (la media) y Groq (la escucha) son de mentira; la base, un PostgREST de mentira.
// =============================================================================

import { crearPostgrest } from './_postgrest-de-mentira';

process.env.NEXT_PUBLIC_SUPABASE_URL = 'http://supa.test';
process.env.SUPABASE_SERVICE_ROLE_KEY = 'service-role-de-prueba';
process.env.CREDENCIALES_SECRET = 'secreto-de-prueba-de-32-caracteres-o-mas-para-el-test';
process.env.EVOLUTION_BASE_URL = 'http://evolution.test';
process.env.EVOLUTION_API_KEY = 'evo-de-prueba';
process.env.GROQ_API_KEY = `gsk_${'p'.repeat(48)}`;
for (const k of ['GEMINI_API_KEY', 'OPENAI_API_KEY', 'ANTHROPIC_API_KEY']) delete process.env[k];

const pg = crearPostgrest({ tablas: ['app_settings', 'workspaces', 'credenciales', 'anthropic_usage', 'ia_cuotas', 'ia_rebotes', 'ia_pc_dispositivos'] });
let evolucionDa: 'audio' | 'nada' = 'audio';
let groqDa: 'texto' | 'error' = 'texto';
const pedidos: Array<{ host: string; camino: string; cuerpo: string }> = [];
globalThis.fetch = (async (entrada: RequestInfo | URL, init: RequestInit = {}) => {
  const u = new URL(typeof entrada === 'string' ? entrada : entrada instanceof URL ? entrada.href : entrada.url);
  if (u.host === 'supa.test') return pg.responder(u, init);
  pedidos.push({ host: u.host, camino: u.pathname, cuerpo: typeof init.body === 'string' ? init.body : '' });
  const r = (status: number, body: unknown) => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });
  if (u.host === 'evolution.test') return evolucionDa === 'audio' ? r(200, { base64: 'T2dnUwACAAAAAAAA', mimetype: 'audio/ogg; codecs=opus' }) : r(404, { error: 'no está' });
  if (u.host === 'api.groq.com') return groqDa === 'texto' ? r(200, { text: 'Quiero que cuando comenten fiesta respondas el comentario en público y mandes el recurso por DM, como ManyChat.' }) : r(503, { error: { message: 'over capacity' } });
  return r(500, { error: { message: 'red de mentira' } });
}) as typeof fetch;

const JID = '120363000000000010@g.us';
const LEANDRO = '5491100000010@s.whatsapp.net';
const mensaje = {
  key: { remoteJid: JID, id: '2A84FEBE22DE84119659', participant: LEANDRO },
  message: { conversation: 'No me respondiste lo de este audio' },
  contextInfo: { stanzaId: '2A81E060BE438F478D26', participant: LEANDRO, quotedMessage: { audioMessage: { mimetype: 'audio/ogg; codecs=opus', seconds: 94, ptt: true } } },
  pushName: 'Leandro',
};

async function main() {
  pg.db.workspaces.push({ id: 9, capa: 'superadmin', nombre: 'MaKo' }, { id: 10, capa: 'cliente', nombre: 'Leandro' });
  const { runWithWorkspace } = await import('../lib/workspace');
  const { escucharElAudioCitado } = await import('../lib/mako-doer-in');
  const out: Record<string, unknown> = {};
  out.bien = await runWithWorkspace(10, () => escucharElAudioCitado('mako-voz', JID, mensaje as never));
  out.bienPedidos = pedidos.splice(0).map((p) => `${p.host}${p.camino}${p.host === 'evolution.test' ? ` ${p.cuerpo}` : ''}`);
  groqDa = 'error';
  out.sinEscucha = await runWithWorkspace(10, () => escucharElAudioCitado('mako-voz', JID, mensaje as never)).then((r) => (r && 'fallo' in r ? 'fallo' : r));
  groqDa = 'texto';
  evolucionDa = 'nada';
  out.sinMedia = await runWithWorkspace(10, () => escucharElAudioCitado('mako-voz', JID, mensaje as never));
  out.sinMediaPedidos = pedidos.splice(0).filter((p) => p.host === 'evolution.test').length;
  out.sinCita = await runWithWorkspace(10, () => escucharElAudioCitado('mako-voz', JID, { ...mensaje, contextInfo: undefined } as never));
  process.stdout.write(`@@CITADO@@${JSON.stringify(out)}\n`);
}

main().then(() => process.exit(0), (e) => { process.stdout.write(`@@CITADO@@${JSON.stringify({ error: e instanceof Error ? e.stack : String(e) })}\n`); process.exit(0); });
