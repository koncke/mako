// =============================================================================
// Hijo de tests/corregir-campo-perfil.test.ts — NO es un test (no termina en .test.ts)
// =============================================================================
// Corre el runner REAL de `corregir_campo_perfil` (área negocio, O21) —preparar(), faltaParaConfirmar() y ejecutar()— y, de
// punta a punta, `ejecutarOperacion` + `confirmarPendiente` (el «sí» de WhatsApp), contra un PostgREST de mentira
// (tests/_postgrest-de-mentira.ts), en un node aparte con `--conditions=react-server` (los runners traen `server-only`). Dos
// negocios (el 3 y el 9; nunca el 1). Imprime un JSON con lo que devolvió cada paso y lo que quedó en la base. Nada sale a la red.
// =============================================================================

import { crearPostgrest } from './_postgrest-de-mentira';

const TABLAS = ['workspaces', 'app_settings', 'archivero_files', 'mako_acciones_pendientes', 'flujo_corridas', 'usuarios'] as const;
const ahoraIso = () => new Date().toISOString();
let siguienteId = 7000;
const pg = crearPostgrest({
  tablas: TABLAS,
  defaults: (tabla, f) => {
    // Creada hace un minuto: el «sí» llega en otro mensaje (el candado anti auto-confirm de `confirmarPendiente`).
    if (tabla === 'mako_acciones_pendientes') return { id: siguienteId++, estado: 'pendiente', created_at: new Date(Date.now() - 60_000).toISOString(), ...f };
    return { ...f };
  },
});

/** `caida`: la base no contesta app_settings (un 5xx de Supabase). */
let caida = false;
const red: string[] = [];
globalThis.fetch = (async (entrada: RequestInfo | URL, init: RequestInit = {}) => {
  const u = new URL(typeof entrada === 'string' ? entrada : entrada instanceof URL ? entrada.href : entrada.url);
  if (u.host === 'supa.test') {
    if (caida && u.pathname.endsWith('/app_settings')) return new Response(JSON.stringify({ message: 'upstream caído' }), { status: 503, headers: { 'content-type': 'application/json' } });
    return pg.responder(u, init);
  }
  red.push(u.host + u.pathname);
  return new Response(JSON.stringify({ error: 'red de mentira' }), { status: 500 });
}) as typeof fetch;

process.env.NEXT_PUBLIC_SUPABASE_URL = 'http://supa.test';
process.env.SUPABASE_SERVICE_ROLE_KEY = 'service-role-de-prueba';

const WS_A = 3; // el negocio que opera (el de prueba)
const WS_B = 9; // otro: su perfil no existe para A

async function main() {
  const { runWithWorkspace } = await import('../lib/workspace');
  const negocio = (await import('../lib/api-mako/areas/negocio.run')).RUNNERS;
  const db = pg.db;
  const out: Record<string, unknown> = {};
  const settingDe = (ws: number, key: string): Record<string, string> => {
    const f = db.app_settings.find((s) => s.workspace_id === ws && s.key === key);
    return f ? (JSON.parse(String(f.value)) as Record<string, string>) : {};
  };

  const reset = () => {
    pg.vaciar(); red.length = 0; caida = false;
    db.workspaces.push({ id: WS_A, nombre: 'A', slug: 'a', estado: 'activo', capa: 'completo', created_at: ahoraIso() });
    db.workspaces.push({ id: WS_B, nombre: 'B', slug: 'b', estado: 'activo', capa: 'completo', created_at: ahoraIso() });
    // Lo que sacó MaKo de un documento (lo que incluye la oferta) y lo que contestó el wizard (el objetivo), datos inventados.
    db.archivero_files.push({ id: 'doc-1', workspace_id: WS_A, nombre: 'Programa.pdf', mime: 'application/pdf', tamano: 10, storage_path: 'x', razonamiento: '', campos: { oferta_incluye: 'Clases en vivo los martes', oferta_nombre: 'Programa Norte' }, created_at: '2026-10-01T00:00:00Z' });
    db.app_settings.push({ workspace_id: WS_A, key: 'mako.onboarding.answers', value: JSON.stringify({ oferta_incluye: 'Clases en vivo los martes', oferta_nombre: 'Programa Norte', negocio_objetivo: 'Cerrar 10 clientes', marca_tono: 'Cercano' }), updated_at: '2026-10-01T00:00:00Z' });
    // El otro negocio: SU garantía. Para A, ese campo está vacío.
    db.app_settings.push({ workspace_id: WS_B, key: 'mako.onboarding.answers', value: JSON.stringify({ oferta_garantia: '60 días' }), updated_at: '2026-10-01T00:00:00Z' });
  };
  const ctx = (ws: number) => ({ ws, canal: 'app' as const, canalKey: 'app:prueba', alcance: 'proponer' as const, rol: 'admin' as const, actor: 'Ana' });
  type R = {
    preparar: (i: Record<string, unknown>, c: ReturnType<typeof ctx>) => Promise<Record<string, unknown>>;
    ejecutar: (p: Record<string, unknown>, c: ReturnType<typeof ctx>) => Promise<Record<string, unknown>>;
    faltaParaConfirmar: (p: Record<string, unknown>, c: ReturnType<typeof ctx>) => Promise<string | { yaNoVale: string } | null>;
  };
  const r = negocio.corregir_campo_perfil as unknown as R;
  const enA = <T,>(fn: () => Promise<T>) => runWithWorkspace(WS_A, fn);

  // 1) Un dato que salió de un DOCUMENTO: va a lo manual (gana sobre el documento) y el brief se recalcula sin perder lo del wizard.
  {
    reset();
    const prep = await enA(() => r.preparar({ key: 'oferta_incluye', valor: 'Clases en vivo de 7:30 a 9:30' }, ctx(WS_A)));
    const falta = 'payload' in prep ? await enA(() => r.faltaParaConfirmar(prep.payload as Record<string, unknown>, ctx(WS_A))) : 'sin payload';
    const ejec = 'payload' in prep ? await enA(() => r.ejecutar(prep.payload as Record<string, unknown>, ctx(WS_A))) : null;
    out.documento = { prep, falta, ejec, manual: settingDe(WS_A, 'mako.archivero.manual'), answers: settingDe(WS_A, 'mako.onboarding.answers') };
  }
  // 2) Un dato del WIZARD (no es del Archivero): va directo a las answers; lo manual no se toca.
  {
    reset();
    const prep = await enA(() => r.preparar({ key: 'negocio_objetivo', valor: 'Cerrar 20 clientes' }, ctx(WS_A)));
    const ejec = 'payload' in prep ? await enA(() => r.ejecutar(prep.payload as Record<string, unknown>, ctx(WS_A))) : null;
    out.wizard = { prep, ejec, manual: settingDe(WS_A, 'mako.archivero.manual'), answers: settingDe(WS_A, 'mako.onboarding.answers') };
  }
  // 3) Los rechazos de preparar: un campo vacío (es de guardar_campo_perfil), «ya dice eso», un campo que no existe, sin valor.
  //    El vacío de A es la garantía, que sí tiene el negocio B: para A no existe.
  {
    reset();
    const vacio = await enA(() => r.preparar({ key: 'oferta_garantia', valor: '30 días' }, ctx(WS_A)));
    const igual = await enA(() => r.preparar({ key: 'oferta_nombre', valor: '  Programa   Norte ' }, ctx(WS_A)));
    const mayuscula = await enA(() => r.preparar({ key: 'oferta_nombre', valor: 'Programa NORTE' }, ctx(WS_A)));
    const noExiste = await enA(() => r.preparar({ key: 'oferta_horario', valor: 'de 9 a 18' }, ctx(WS_A)));
    const sinValor = await enA(() => r.preparar({ key: 'oferta_nombre', valor: '   ' }, ctx(WS_A)));
    out.rechazos = { vacio, igual, mayuscula: 'payload' in mayuscula, noExiste, sinValor, answers: settingDe(WS_A, 'mako.onboarding.answers'), manual: settingDe(WS_A, 'mako.archivero.manual') };
  }
  // 4) El «sí» llega cuando el dato ya cambió (otra corrección, la pantalla): faltaParaConfirmar la cierra y ejecutar no escribe.
  {
    reset();
    const prep = await enA(() => r.preparar({ key: 'oferta_incluye', valor: 'Clases en vivo de 7:30 a 9:30' }, ctx(WS_A)));
    db.app_settings.push({ workspace_id: WS_A, key: 'mako.archivero.manual', value: JSON.stringify({ oferta_incluye: 'Clases grabadas' }), updated_at: ahoraIso() });
    const payload = (prep as { payload: Record<string, unknown> }).payload;
    const falta = await enA(() => r.faltaParaConfirmar(payload, ctx(WS_A)));
    const ejec = await enA(() => r.ejecutar(payload, ctx(WS_A)));
    out.cambio = { falta, ejec, manual: settingDe(WS_A, 'mako.archivero.manual') };
  }
  // 5) La base no contesta al confirmar: «no pude leer» deja la pendiente viva (un texto, no un yaNoVale), y preparar no tira.
  {
    reset();
    const prep = await enA(() => r.preparar({ key: 'oferta_incluye', valor: 'Clases en vivo de 7:30 a 9:30' }, ctx(WS_A)));
    caida = true;
    const falta = await enA(() => r.faltaParaConfirmar((prep as { payload: Record<string, unknown> }).payload, ctx(WS_A)));
    const prepCaido = await enA(() => r.preparar({ key: 'oferta_incluye', valor: 'otra cosa' }, ctx(WS_A)));
    caida = false;
    out.caida = { falta, prepCaido };
  }
  // 6) De punta a punta por WhatsApp: la propuesta queda pendiente con lo de antes y el «sí» la aplica.
  {
    reset();
    const { ejecutarOperacion } = await import('../lib/api-mako/ejecutar');
    const { confirmarPendiente } = await import('../lib/api-mako/acciones');
    const ctxWa = { ws: WS_A, canal: 'whatsapp' as const, canalKey: 'wa:5215500000000', alcance: 'ejecutar' as const, rol: 'admin' as const, actor: 'Ana', mensajeUsuario: 'sí' };
    const propuesta = await enA(() => ejecutarOperacion('corregir_campo_perfil', { key: 'oferta_incluye', valor: 'Clases en vivo de 7:30 a 9:30' }, ctxWa as never, 'json'));
    const pendiente = db.mako_acciones_pendientes.map((p) => ({ tipo: p.tipo, estado: p.estado, payload: p.payload, resumen: p.resumen }));
    const si = await enA(() => confirmarPendiente(ctxWa as never, null));
    out.whatsapp = { propuesta, pendiente, si, estados: db.mako_acciones_pendientes.map((p) => p.estado), manual: settingDe(WS_A, 'mako.archivero.manual') };
  }
  out.red = red;
  process.stdout.write(JSON.stringify(out));
}

main().then(() => process.exit(0), (e) => { console.error(e); process.exit(1); });
