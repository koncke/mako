// =============================================================================
// Hijo de tests/voz-coach.test.ts — NO es un test (no termina en .test.ts)
// =============================================================================
// `audioDelCoach` (lib/voz-coach.ts) REAL sobre un PostgREST de mentira, un Storage de mentira y un ElevenLabs de mentira (cuenta
// las llamadas y devuelve bytes). Sin red. Escribe una línea `@@VOZ@@<json>` por escena. Corre con `--conditions=react-server`.
// =============================================================================

import { crearPostgrest } from './_postgrest-de-mentira';

process.env.NEXT_PUBLIC_SUPABASE_URL = 'http://supa.test';
process.env.SUPABASE_SERVICE_ROLE_KEY = 'service-role-de-prueba';
delete process.env.MAKO_ELEVENLABS_API_KEY;

let n = 300;
const pg = crearPostgrest({
  tablas: ['workspaces', 'app_settings', 'anthropic_usage'],
  defaults: (_t, f) => ({ id: ++n, ...f }),
});
const storage = new Map<string, Uint8Array>();
let llamadasEleven = 0;
let subidas = 0;
const red: string[] = [];
globalThis.fetch = (async (entrada: RequestInfo | URL, init: RequestInit = {}) => {
  const u = new URL(typeof entrada === 'string' ? entrada : entrada instanceof URL ? entrada.href : entrada.url);
  if (u.host === 'supa.test' && u.pathname.startsWith('/storage/v1/object/')) {
    const ruta = decodeURIComponent(u.pathname.replace(/^\/storage\/v1\/object\/(?:authenticated\/|public\/)?/, ''));
    const metodo = (init.method ?? 'GET').toUpperCase();
    if (metodo === 'GET') {
      const b = storage.get(ruta);
      return b ? new Response(b as BodyInit, { status: 200, headers: { 'content-type': 'audio/mpeg' } }) : new Response(JSON.stringify({ statusCode: '404', error: 'not_found', message: 'Object not found' }), { status: 400, headers: { 'content-type': 'application/json' } });
    }
    subidas++;
    const cuerpo = init.body instanceof Uint8Array ? init.body : new Uint8Array(await new Response(init.body as BodyInit).arrayBuffer());
    storage.set(ruta, cuerpo);
    return new Response(JSON.stringify({ Key: ruta }), { status: 200, headers: { 'content-type': 'application/json' } });
  }
  if (u.host === 'supa.test') return pg.responder(u, init);
  if (u.host === 'api.elevenlabs.io') {
    llamadasEleven++;
    const b = JSON.parse(String(init.body ?? '{}')) as { text?: string; model_id?: string };
    red.push(`${u.pathname}|${b.model_id}|${b.text}`);
    return new Response(new Uint8Array(4096).fill(0xff), { status: 200, headers: { 'content-type': 'audio/mpeg' } });
  }
  red.push(`OTRA ${u.host}${u.pathname}`);
  return new Response(JSON.stringify({ error: 'red de mentira' }), { status: 500 });
}) as typeof fetch;

const WS = 3;
const salida = (nombre: string, datos: unknown) => console.log(`@@VOZ@@${JSON.stringify({ nombre, ...(datos as object) })}`);
const bytes = async (c: ReadableStream<Uint8Array> | Uint8Array) => (c instanceof Uint8Array ? c.length : (await new Response(c).arrayBuffer()).byteLength);

async function main() {
  pg.db.workspaces.push({ id: WS, nombre: 'Cliente de prueba', capa: 'completo', estado: 'activo' });
  const { audioDelCoach, vozCoachDisponible } = await import('../lib/voz-coach');
  const { claveDelMesVozCoach, TOPE_VOZ_COACH_MES } = await import('../lib/voz-coach-reglas');
  const { runWithWorkspace } = await import('../lib/workspace');
  const en = <T,>(f: () => Promise<T>) => runWithWorkspace(WS, f);
  const usado = () => pg.db.app_settings.find((s) => s.workspace_id === WS && s.key === claveDelMesVozCoach())?.value ?? null;
  const PREGUNTA = '¿Qué resultado concreto consigue tu cliente cuando termina de trabajar contigo?';

  // 1. Sin la key de la plataforma: nada, y ElevenLabs no se llama.
  salida('sinKey', { disponible: vozCoachDisponible(), r: await en(() => audioDelCoach(PREGUNTA, { fija: true, ws: WS })), llamadas: llamadasEleven });

  process.env.MAKO_ELEVENLABS_API_KEY = 'sk_de_prueba_de_la_plataforma';
  // 2. Una FIJA: la primera vez se pide y se guarda; la segunda sale guardada, sin llamar a ElevenLabs.
  const f1 = await en(() => audioDelCoach(PREGUNTA, { fija: true, ws: WS }));
  const tras1 = { llamadas: llamadasEleven, subidas, usado: usado() };
  const f2 = await en(() => audioDelCoach(`**${PREGUNTA}** 🙂`, { fija: true, ws: WS }));
  salida('fija', {
    disponible: vozCoachDisponible(),
    primera: f1.ok ? { guardado: f1.guardado, bytes: await bytes(f1.cuerpo) } : f1,
    tras1,
    segunda: f2.ok ? { guardado: f2.guardado, bytes: await bytes(f2.cuerpo) } : f2,
    llamadas: llamadasEleven, usado: usado(), rutas: [...storage.keys()], pedido: red[red.length - 1],
  });

  // 3. Lo PERSONALIZADO: se pide con streaming, no se guarda, y suma al mes.
  const antes = { llamadas: llamadasEleven, subidas };
  const RESP = 'Eso es oro: bajar de cien a ochenta kilos en cuatro meses es un resultado medible. Cuéntame qué incluye hoy tu programa.';
  const p1 = await en(() => audioDelCoach(RESP, { fija: false, ws: WS }));
  salida('personalizado', {
    ok: p1.ok, stream: p1.ok && !(p1.cuerpo instanceof Uint8Array), bytes: p1.ok ? await bytes(p1.cuerpo) : 0,
    llamadas: llamadasEleven - antes.llamadas, subidas: subidas - antes.subidas, usado: usado(), largo: RESP.length,
    uso: pg.db.anthropic_usage.filter((f) => f.feature === 'voz-coach').length,
  });

  // 4. El tope del mes: lleno, no se pide nada.
  const fila = pg.db.app_settings.find((s) => s.workspace_id === WS && s.key === claveDelMesVozCoach());
  if (fila) fila.value = String(TOPE_VOZ_COACH_MES - 10);
  const antesTope = llamadasEleven;
  const t = await en(() => audioDelCoach(RESP, { fija: false, ws: WS }));
  salida('tope', { r: t.ok ? { ok: true } : t, llamadas: llamadasEleven - antesTope });

  // 5. Lo que no se lee: sin letras (un emoji, un link), o más largo que el tope de un audio.
  salida('vacio', {
    emoji: await en(() => audioDelCoach('🙂🙂', { fija: false, ws: WS })),
    link: await en(() => audioDelCoach('https://hola-mako.com/oferta', { fija: false, ws: WS })),
    largo: await en(() => audioDelCoach('a'.repeat(2000), { fija: false, ws: WS })),
  });
  salida('red', { otras: red.filter((x) => x.startsWith('OTRA')) });
}

main().then(() => process.exit(0), (e) => { console.error(e); process.exit(1); });
