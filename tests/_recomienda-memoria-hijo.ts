// =============================================================================
// Hijo de tests/mako-recomienda-memoria.test.ts — NO es un test (no termina en .test.ts)
// =============================================================================
// Corre `decidirRecomendacion` REAL (lib/recomendaciones.ts) contra una base de mentira. Siembra:
//   · 12 conversaciones de WhatsApp con leads, empezadas por la persona hace 5 días y sin respuesta: dan DOS señales
//     («respuesta-lenta» y «esperando-respuesta»);
//   · 6.100 mensajes de GRUPOS de ayer: sin el filtro de personas en la consulta, llenan el tope de lectura y las charlas con
//     leads quedan afuera (verificación del tren-m, hallazgo 11);
//   · una redacción guardada de la IA VIEJA (otra huella) que juntaba las dos señales;
//   · una memoria GRANDE (80 decisiones viejas, ~16 KB): con el compare-and-set por valor, ese JSON iba en la URL.
// El negocio tiene SU IA (su Gemini): la redacción vigente es la que se muestra. Anota cada PATCH a app_settings (su URL).
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
const S1 = 'respuesta-lenta|negocio', S2 = 'esperando-respuesta|negocio';

async function main() {
  const { runWithWorkspace } = await import('../lib/workspace');
  const { cifrarSecreto } = await import('../lib/credenciales');
  const rec = await import('../lib/recomendaciones');
  const reglas = await import('../lib/recomendaciones-reglas');
  pg.db.workspaces.push({ id: 9, capa: 'superadmin', nombre: 'MaKo' }, { id: WS, capa: 'cliente', nombre: 'ws13' });
  pg.db.credenciales.push({ workspace_id: WS, clave: 'GEMINI_API_KEY', valor_enc: cifrarSecreto(`gemini-${WS}-${'k'.repeat(40)}`, WS, 'GEMINI_API_KEY'), servicio: 'GEMINI_API_KEY' });
  const ahora = Date.now();
  for (let i = 0; i < 12; i++) {
    pg.db.wa_mensajes.push({ id: ++n, workspace_id: WS, chat_jid: `54911000${i}@s.whatsapp.net`, wa_timestamp: new Date(ahora - 5 * DIA - i * 60_000).toISOString(), from_me: false, lead_id: 100 + i, tipo: 'text', texto: '¿y el precio?' });
  }
  for (let i = 0; i < 6_100; i++) {
    pg.db.wa_mensajes.push({ id: ++n, workspace_id: WS, chat_jid: `120363${i % 20}@g.us`, wa_timestamp: new Date(ahora - DIA - i * 1_000).toISOString(), from_me: false, lead_id: null, tipo: 'text', texto: 'en el grupo' });
  }
  const redaccion = (huella: string) => JSON.stringify({ huella, en: new Date().toISOString(), recs: [{ clave: S1, claves: [S1, S2], tipo: 'respuesta-lenta', superficie: 'ops-center', hacer: 'Contesta en el momento', cambia: 'Más conversaciones', porque: ['x'], fuentes: ['y'], origen: 'ia' }] });
  const CLAVE_REDACCION = 'mako.recomendaciones.redaccion.ops-center';
  pg.db.app_settings.push({ workspace_id: WS, key: CLAVE_REDACCION, value: redaccion('una-huella-vieja'), updated_at: new Date().toISOString() });
  // Una memoria GRANDE: 80 decisiones viejas sobre otras claves, con motivo.
  const viejas = Array.from({ length: 80 }, (_, i) => ({ clave: `landing-no-convierte|landing:https://negocio-de-prueba.com/pagina-${i}`, tipo: 'landing-no-convierte', superficie: 'landing', d: 'ahora-no', en: new Date(ahora - 30 * DIA).toISOString(), valor: 0.004, quien: 'admin@negocio.com', motivo: 'esa página la estamos rehaciendo, no la midas todavía por favor' }));
  pg.db.app_settings.push({ workspace_id: WS, key: reglas.CLAVE_MEMORIA, value: JSON.stringify({ v: 1, decisiones: viejas }), updated_at: new Date(ahora - DIA).toISOString() });
  const memoria = () => JSON.parse(String(pg.db.app_settings.find((f) => f.key === reglas.CLAVE_MEMORIA)?.value ?? '{"decisiones":[]}')) as { decisiones: Array<{ clave: string; d: string }> };
  const ultimas = (k: number) => memoria().decisiones.slice(-k).map((d) => `${d.clave}=${d.d}`);
  const decidir = (o: { d: 'ahora-no' | 'no-aplica' | 'hecha'; claves?: string[] }) => runWithWorkspace(WS, () => rec.decidirRecomendacion({ superficie: 'ops-center', clave: S1, ...o, quien: 'admin@negocio.com' }));

  const out: Record<string, unknown> = { bytesAntes: JSON.stringify(memoria()).length };
  const lectura = await runWithWorkspace(WS, () => rec.senalesDelNegocio('ops-center'));
  out.senalesTipos = lectura.senales.map((s) => s.tipo);
  /** La redacción que SE MUESTRA hoy: la misma huella que calcula el motor con la memoria de ahora. */
  const refrescar = () => {
    const m = reglas.leerMemoria(JSON.stringify(memoria()));
    const huella = reglas.huellaDe('ops-center', reglas.senalesQueHablan(lectura.senales, m, 'ops-center', new Date()), m);
    pg.db.app_settings.find((f) => f.key === CLAVE_REDACCION)!.value = redaccion(huella);
  };
  // 1. Por la API (sin claves), con la redacción VIEJA que juntaba S1 y S2 (la pantalla muestra las reglas: una señal por
  //    tarjeta): se anota S1 y NADA sobre S2. Y la escritura compara `updated_at` (la memoria es grande).
  patches = [];
  out.r1 = await decidir({ d: 'ahora-no' });
  out.patches1 = [...patches];
  out.ultimas1 = ultimas(2);
  out.total1 = memoria().decisiones.length;
  // 2. La PANTALLA manda las claves de la tarjeta que se vio (sólo S1), aunque la redacción vigente junte S1 y S2: se usan las
  //    de la pantalla.
  refrescar();
  out.r2 = await decidir({ d: 'hecha', claves: [S1] });
  out.ultimas2 = ultimas(2);
  out.total2 = memoria().decisiones.length;
  // 3. Por la API, con la redacción que SE MUESTRA hoy: se decide sobre las dos.
  refrescar();
  patches = [];
  out.r3 = await decidir({ d: 'no-aplica' });
  out.patches3 = patches.length;
  out.ultimas3 = ultimas(2);
  out.total3 = memoria().decisiones.length;
  // 4. La MISMA decisión otra vez (otra pestaña con la lista vieja): no escribe nada y contesta ok.
  patches = [];
  out.r4 = await decidir({ d: 'no-aplica' });
  out.patches4 = patches.length;
  out.total4 = memoria().decisiones.length;
  process.stdout.write(`@@RESULTADO@@${JSON.stringify(out)}`);
}

main().then(() => process.exit(0), (e) => { process.stdout.write(`@@RESULTADO@@${JSON.stringify({ error: e instanceof Error ? e.stack : String(e) })}`); process.exit(0); });
