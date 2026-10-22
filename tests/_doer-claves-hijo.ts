// =============================================================================
// Hijo de tests/doer-claves.test.ts — NO es un test (no termina en .test.ts)
// =============================================================================
// lib/mako-doer-in.ts lleva `server-only`: esto corre en un node aparte con `--conditions=react-server` y le contesta al
// test con un JSON. Corre la entrada REAL del grupo (`manejarEntranteDoer`) contra un PostgREST de mentira donde el ws3
// tiene su grupo oficial de MaKo. Todo lo que sale a la red y no es la base se ANOTA (host, camino y cuerpo) y contesta 200:
// Evolution (las reacciones, el «escribiendo…» y lo que se manda al grupo) y cualquier IA.
//
// Dos mensajes: uno que es SÓLO una clave (se avisa y no se encola nada) y otro con texto y una clave (se encola tapado).
// El segundo se encola y la invocación se va sin ganar el candado del grupo (`reclamar` usa un `or=` que el PostgREST de
// mentira no entiende, y un error ahí es «no gané»): lo que importa es lo que quedó en la cola, que es de donde salen la
// memoria (`mako_doer_conv`) y el turno.
// =============================================================================

import { crearPostgrest } from './_postgrest-de-mentira';

process.env.NEXT_PUBLIC_SUPABASE_URL = 'http://supa.test';
process.env.SUPABASE_SERVICE_ROLE_KEY = 'service-role-de-prueba';
process.env.CREDENCIALES_SECRET = 'secreto-de-prueba-de-32-caracteres-o-mas-para-el-test';
process.env.EVOLUTION_BASE_URL = 'http://evolution.test';
process.env.EVOLUTION_API_KEY = 'evo-de-prueba';
process.env.NEXT_PUBLIC_APP_URL = 'https://hola-mako.com';

const JID = '120363000000000000@g.us';
const WS = 3;
let n = 0;
const pg = crearPostgrest({
  tablas: ['app_settings', 'workspaces', 'credenciales', 'mako_doer_buffer', 'mako_doer_lock', 'mako_doer_conv', 'mako_doer_enviados', 'anthropic_usage', 'errores_app'],
  defaults: (_t, f) => ({ id: ++n, created_at: new Date().toISOString(), ...f }),
});
const red: Array<{ host: string; camino: string; cuerpo: string }> = [];
globalThis.fetch = (async (entrada: RequestInfo | URL, init: RequestInit = {}) => {
  const u = new URL(typeof entrada === 'string' ? entrada : entrada instanceof URL ? entrada.href : entrada.url);
  if (u.host === 'supa.test') return pg.responder(u, init);
  red.push({ host: u.host, camino: u.pathname, cuerpo: typeof init.body === 'string' ? init.body : '' });
  return new Response(JSON.stringify({ key: { id: `env-${red.length}` } }), { status: 200, headers: { 'content-type': 'application/json' } });
}) as typeof fetch;

const CLAUDE = `sk-ant-api03-${'A1b2C3d4'.repeat(11)}AA`;
const OPENAI = `sk-proj-${'T3BlbkFJ'.repeat(4)}${'x9Y8z7W6'.repeat(5)}`;

async function main() {
  pg.db.workspaces.push({ id: 9, capa: 'superadmin', nombre: 'MaKo' }, { id: WS, capa: 'cliente', nombre: 'Prueba' }, { id: 1, capa: 'cliente', nombre: 'Dueño' });
  pg.db.app_settings.push({ workspace_id: WS, key: 'mako.grupo_jid', value: JID });
  const { manejarEntranteDoer } = await import('../lib/mako-doer-in');
  const out: Record<string, unknown> = {};

  // 1) Sólo la clave: se avisa con el link y no se encola nada.
  out.soloClave = await manejarEntranteDoer('mako-voz', { key: { remoteJid: JID, id: 'm1', participant: '5491100000000@s.whatsapp.net' }, message: { conversation: CLAUDE }, pushName: 'Prueba' });
  out.colaTrasSoloClave = pg.db.mako_doer_buffer.length;
  out.redSoloClave = red.splice(0);

  // 2) Texto, una clave en el caption de un documento y otra en un mensaje CITADO: se encola tapado (el texto y el payload).
  out.mixto = await manejarEntranteDoer('mako-voz', {
    key: { remoteJid: JID, id: 'm2', participant: '5491100000000@s.whatsapp.net' },
    message: {
      extendedTextMessage: {
        text: `Hola MaKo, esta es mi clave de OpenAI ${OPENAI} ¿la cargás?`,
        contextInfo: { quotedMessage: { conversation: `te paso la de claude: ${CLAUDE}` } },
      },
    },
    pushName: 'Prueba',
  });
  out.cola = pg.db.mako_doer_buffer.map((f) => ({ texto: f.texto, payload: JSON.stringify(f.payload) }));
  out.redMixto = red.splice(0);
  out.claves = { CLAUDE, OPENAI };
  process.stdout.write(`@@RESULTADO@@${JSON.stringify(out)}`);
}

main().then(() => process.exit(0), (e) => { process.stdout.write(`@@RESULTADO@@${JSON.stringify({ error: e instanceof Error ? e.stack : String(e) })}`); process.exit(0); });
