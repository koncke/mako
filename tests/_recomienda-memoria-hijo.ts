// =============================================================================
// Hijo de tests/mako-recomienda-memoria.test.ts — NO es un test (no termina en .test.ts)
// =============================================================================
// Corre `decidirRecomendacion` REAL (lib/recomendaciones.ts) contra una base de mentira. Siembra:
//   · 12 conversaciones de WhatsApp con leads, empezadas por la persona hace 5 días y sin respuesta: dan DOS señales
//     («respuesta-lenta» y «esperando-respuesta»);
//   · la redacción guardada de la IA, que las JUNTÓ en una sola recomendación (clave principal + las dos claves);
//   · una memoria GRANDE (80 decisiones viejas, ~16 KB): con el compare-and-set por valor, ese JSON iba en la URL.
// Anota cada PATCH a app_settings (su URL) para ver con qué compara la escritura.
// =============================================================================

import { crearPostgrest } from './_postgrest-de-mentira';

process.env.NEXT_PUBLIC_SUPABASE_URL = 'http://supa.test';
process.env.SUPABASE_SERVICE_ROLE_KEY = 'service-role-de-prueba';
process.env.CREDENCIALES_SECRET = 'secreto-de-prueba-de-32-caracteres-o-mas-para-el-test';
for (const k of ['ANTHROPIC_API_KEY', 'OPENAI_API_KEY', 'GEMINI_API_KEY', 'GROQ_API_KEY']) delete process.env[k];

let n = 0;
const pg = crearPostgrest({
  tablas: ['credenciales', 'workspaces', 'app_settings', 'wa_mensajes', 'leads', 'nutricion_secuencias', 'nutricion_envios', 'nutricion_inscripciones',
    'mako_knowledge', 'closing_analyses', 'ofertas', 'landing_visits', 'vsl_events', 'anthropic_usage', 'ia_cuotas', 'ia_pc_dispositivos'],
  defaults: (_t, f) => ({ id: ++n, created_at: new Date().toISOString(), ...f }),
});
let patches: string[] = [];
globalThis.fetch = (async (entrada: RequestInfo | URL, init: RequestInit = {}) => {
  const u = new URL(typeof entrada === 'string' ? entrada : entrada instanceof URL ? entrada.href : entrada.url);
  if (u.host === 'supa.test') {
    if ((init.method ?? 'GET').toUpperCase() === 'PATCH' && u.pathname.endsWith('/app_settings')) patches.push(decodeURIComponent(u.search));
    try { return await pg.responder(u, init); } catch (e) { return new Response(JSON.stringify({ message: String(e) }), { status: 400 }); }
  }
  return new Response(JSON.stringify({ error: { message: 'red de mentira' } }), { status: 500 });
}) as typeof fetch;

const WS = 13;
const DIA = 86_400_000;

async function main() {
  const { runWithWorkspace } = await import('../lib/workspace');
  const rec = await import('../lib/recomendaciones');
  const { CLAVE_MEMORIA } = await import('../lib/recomendaciones-reglas');
  pg.db.workspaces.push({ id: 9, capa: 'superadmin', nombre: 'MaKo' }, { id: WS, capa: 'cliente', nombre: 'ws13' });
  const ahora = Date.now();
  for (let i = 0; i < 12; i++) {
    pg.db.wa_mensajes.push({ id: ++n, workspace_id: WS, chat_jid: `54911000${i}@s.whatsapp.net`, wa_timestamp: new Date(ahora - 5 * DIA - i * 60_000).toISOString(), from_me: false, lead_id: 100 + i, tipo: 'text', texto: '¿y el precio?' });
  }
  // La redacción de la IA que juntó las dos señales en una sola recomendación.
  const redaccion = { huella: 'x', en: new Date().toISOString(), recs: [{ clave: 'respuesta-lenta|negocio', claves: ['respuesta-lenta|negocio', 'esperando-respuesta|negocio'], tipo: 'respuesta-lenta', superficie: 'ops-center', hacer: 'Contesta en el momento', cambia: 'Más conversaciones', porque: ['x'], fuentes: ['y'], origen: 'ia' }] };
  pg.db.app_settings.push({ workspace_id: WS, key: 'mako.recomendaciones.redaccion.ops-center', value: JSON.stringify(redaccion), updated_at: new Date().toISOString() });
  // Una memoria GRANDE: 80 decisiones viejas sobre otras claves, con motivo.
  const viejas = Array.from({ length: 80 }, (_, i) => ({ clave: `landing-no-convierte|landing:https://negocio-de-prueba.com/pagina-${i}`, tipo: 'landing-no-convierte', superficie: 'landing', d: 'ahora-no', en: new Date(ahora - 30 * DIA).toISOString(), valor: 0.004, quien: 'admin@negocio.com', motivo: 'esa página la estamos rehaciendo, no la midas todavía por favor' }));
  pg.db.app_settings.push({ workspace_id: WS, key: CLAVE_MEMORIA, value: JSON.stringify({ v: 1, decisiones: viejas }), updated_at: new Date(ahora - DIA).toISOString() });
  const memoria = () => JSON.parse(String(pg.db.app_settings.find((f) => f.key === CLAVE_MEMORIA)?.value ?? '{"decisiones":[]}')) as { decisiones: Array<{ clave: string; d: string }> };

  const out: Record<string, unknown> = { bytesAntes: JSON.stringify(memoria()).length };
  // 1. «No aplica» sobre la recomendación JUNTA, mandando sólo la clave principal (como la API): calla las DOS.
  patches = [];
  out.r1 = await runWithWorkspace(WS, () => rec.decidirRecomendacion({ superficie: 'ops-center', clave: 'respuesta-lenta|negocio', d: 'no-aplica', quien: 'admin@negocio.com' }));
  out.patches1 = patches;
  out.ultimas1 = memoria().decisiones.slice(-3).map((d) => `${d.clave}=${d.d}`);
  out.total1 = memoria().decisiones.length;
  // 2. La MISMA decisión otra vez (otra pestaña con la lista vieja): no escribe nada y contesta ok.
  patches = [];
  out.r2 = await runWithWorkspace(WS, () => rec.decidirRecomendacion({ superficie: 'ops-center', clave: 'respuesta-lenta|negocio', d: 'no-aplica', quien: 'admin@negocio.com' }));
  out.patches2 = patches.length;
  out.total2 = memoria().decisiones.length;
  process.stdout.write(`@@RESULTADO@@${JSON.stringify(out)}`);
}

main().then(() => process.exit(0), (e) => { process.stdout.write(`@@RESULTADO@@${JSON.stringify({ error: e instanceof Error ? e.stack : String(e) })}`); process.exit(0); });
