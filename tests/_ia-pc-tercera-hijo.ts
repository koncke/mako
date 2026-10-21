// =============================================================================
// Hijo de tests/ia-pc-tercera-revision.test.ts — NO es un test (no termina en .test.ts)
// =============================================================================
// lib/ia-del-negocio.ts y lib/ia-pc.ts llevan `server-only`: corren en un node aparte con `--conditions=react-server`,
// contra un PostgREST de mentira (tests/_postgrest-de-mentira.ts). Lo que la tercera revisión del Cerebro encontró, CORRIDO:
//   · «su IA» con las claves COPIADAS de la plataforma (el ws1), con una clave ilegible, con la de la plataforma ilegible;
//   · la base SIN la mig 0322 (la columna no existe: PostgREST contesta 42703), con y sin una PC registrada;
//   · reinstalar: confirmar la nueva con el token de la de antes le pasa la activación ANTES de soltar la vieja;
//   · la purga y la lista con una PC confirmada que todavía no latió; el código recién usado sin su PC anotada.
// =============================================================================

import { crearPostgrest } from './_postgrest-de-mentira';

process.env.NEXT_PUBLIC_SUPABASE_URL = 'http://supa.test';
process.env.SUPABASE_SERVICE_ROLE_KEY = 'service-role-de-prueba';
process.env.CREDENCIALES_SECRET = 'secreto-de-prueba-de-32-caracteres-o-mas-para-el-test';
for (const k of ['ANTHROPIC_API_KEY', 'OPENAI_API_KEY', 'GEMINI_API_KEY']) delete process.env[k];

const PLATAFORMA = 9;
let ids = 0;
const pg = crearPostgrest({
  tablas: ['credenciales', 'workspaces', 'app_settings', 'ia_pc_codigos', 'ia_pc_dispositivos', 'ia_pc_turnos', 'ia_pc_llamadas'],
  defaults: (tabla, f) => tabla === 'ia_pc_dispositivos'
    ? { id: ++ids, creado_at: new Date().toISOString(), revocado_at: null, ultimo_latido: null, cuentas: [], confirmado_at: null, activa_at: null, claude_falta: false, ...f }
    : tabla === 'ia_pc_codigos' ? { usado_at: null, dispositivo_id: null, ...f } : f,
});
/** Sin la mig 0322: cualquier pedido a ia_pc_dispositivos que nombra una columna nueva contesta como Postgres. */
let sin0322 = false;
globalThis.fetch = (async (entrada: RequestInfo | URL, init: RequestInit = {}) => {
  const u = new URL(typeof entrada === 'string' ? entrada : entrada instanceof URL ? entrada.href : entrada.url);
  if (u.host !== 'supa.test') return new Response('{}', { status: 500 });
  if (sin0322 && u.pathname.endsWith('/ia_pc_dispositivos') && /activa_at|confirmado_at|claude_falta/.test(decodeURIComponent(u.search))) {
    return new Response(JSON.stringify({ code: '42703', message: 'column ia_pc_dispositivos.activa_at does not exist', details: null, hint: null }), { status: 400, headers: { 'content-type': 'application/json' } });
  }
  return pg.responder(u, init);
}) as typeof fetch;

async function main() {
  const { cifrarSecreto } = await import('../lib/credenciales');
  const { negocioConSuIA } = await import('../lib/ia-del-negocio');
  const pc = await import('../lib/ia-pc');
  const { VERSION_CONSENTIMIENTO } = await import('../lib/ia-pc-reglas');
  const out: Record<string, unknown> = {};
  pg.db.workspaces.push({ id: PLATAFORMA, capa: 'superadmin', nombre: 'MaKo' });
  for (const id of [1, 3, 4, 5, 6, 7, 8]) pg.db.workspaces.push({ id, capa: 'cliente', nombre: `Negocio ${id}` });
  const fila = (ws: number, clave: string, valor: string) => ({ workspace_id: ws, clave, valor_enc: cifrarSecreto(valor, ws, clave), servicio: clave.split('_')[0].toLowerCase() });
  const OPENAI_MAKO = `sk-proj-MaKo${'A1'.repeat(30)}`;
  const OPENAI_MAKO_2 = `sk-proj-MaKoDos${'B2'.repeat(30)}`;
  pg.db.credenciales.push(fila(PLATAFORMA, 'OPENAI_API_KEY', OPENAI_MAKO), fila(PLATAFORMA, 'OPENAI_API_KEY_2', OPENAI_MAKO_2), fila(PLATAFORMA, 'GEMINI_API_KEY', `AIza-mako-${'g'.repeat(30)}`));

  // ── 1. Su IA: copias, ilegibles y propias ──────────────────────────────────
  pg.db.credenciales.push(fila(1, 'OPENAI_API_KEY', OPENAI_MAKO), fila(1, 'GEMINI_API_KEY', `AIza-mako-${'g'.repeat(30)}`));
  pg.db.credenciales.push(fila(8, 'OPENAI_API_KEY', ` ${OPENAI_MAKO_2} `));
  pg.db.credenciales.push({ workspace_id: 4, clave: 'ANTHROPIC_API_KEY', valor_enc: 'gcm2.AAAA.BBBB.CCCC.DDDD', servicio: 'anthropic' });
  pg.db.credenciales.push(fila(5, 'OPENAI_API_KEY', `sk-proj-Propia${'C3'.repeat(30)}`));
  pg.db.credenciales.push(fila(7, 'ANTHROPIC_API_KEY', 'PENDING_CARGAR'));
  out.claves = {
    copiaDelWs1: await negocioConSuIA(1),
    copiaDeLaSegundaCuenta: await negocioConSuIA(8),
    ilegible: await negocioConSuIA(4),
    propia: await negocioConSuIA(5),
    placeholder: await negocioConSuIA(7),
    plataforma: await negocioConSuIA(PLATAFORMA),
  };
  // La de la plataforma ilegible: no se sabe si la del negocio es una copia → falla cerrada. Con el ws8 (copia de la
  // SEGUNDA cuenta, que sí se lee): saltear la ilegible lo daría por «copia» (no) en vez de «no sé» (sí).
  const orig = pg.db.credenciales.find((f) => f.workspace_id === PLATAFORMA && f.clave === 'OPENAI_API_KEY')!;
  const guardado = orig.valor_enc;
  orig.valor_enc = 'gcm2.AAAA.BBBB.CCCC.DDDD';
  out.plataformaIlegible = await negocioConSuIA(8);
  orig.valor_enc = guardado;

  // ── 2. Sin la mig 0322 ─────────────────────────────────────────────────────
  pg.db.ia_pc_dispositivos.push({ workspace_id: 6, persona: 'x@negocio.com', nombre: 'PC vieja', token_hash: 'h', revocado_at: null });
  sin0322 = true;
  out.sin0322 = {
    sinPcNiClave: await negocioConSuIA(3),
    conPcRegistrada: await negocioConSuIA(6),
    conSuOpenAI: await negocioConSuIA(5),
    pcDe: await pc.pcDe(3, 'ana@negocio.com').then((d) => (d ? 'una' : null), (e: unknown) => `tiró: ${e instanceof Error ? e.message : String(e)}`),
  };
  sin0322 = false;
  pg.db.ia_pc_dispositivos.length = 0;

  // ── 3. Reinstalar: la activación pasa a la nueva ANTES de soltar la vieja ─────
  const instalar = async (persona: string, ws = 3) => {
    const c = await pc.crearCodigo(ws, persona, VERSION_CONSENTIMIENTO);
    const e = await pc.emparejar(c.codigo, 'PC');
    return { token: e!.token, codigo: c.codigo };
  };
  const activar = async (token: string) => {
    const d = await pc.dispositivoDelToken(token, { pendientesTambien: true });
    await pc.confirmar(d!);
    await pc.latir((await pc.dispositivoDelToken(token))!, { version: '0.3.2', cuentas: [{ proveedor: 'claude', email: 'ana@x.com' }] });
  };
  const reinstalar = async (anterior: string | undefined, persona = 'ana@negocio.com', ws = 3) => {
    const nueva = await instalar(persona, ws);
    const pasos: boolean[] = [await pc.negocioConPc(3)];
    await pc.confirmar((await pc.dispositivoDelToken(nueva.token, { pendientesTambien: true }))!, anterior);
    pasos.push(await pc.negocioConPc(3));
    // El programa suelta la de antes (la que reemplaza).
    if (anterior) { const v = await pc.dispositivoDelToken(anterior); if (v) await pc.soltar(v); }
    pasos.push(await pc.negocioConPc(3));
    return { pasos, nueva };
  };
  const vieja = await instalar('ana@negocio.com');
  await activar(vieja.token);
  out.conAnterior = (await reinstalar(vieja.token)).pasos;
  // Control: sin pasar la de antes (lo de af8f42baf), el negocio sale de «sólo su IA» entre soltar y el primer latido.
  pg.db.ia_pc_dispositivos.length = 0;
  const v2 = await instalar('ana@negocio.com');
  await activar(v2.token);
  const sinPasar = await instalar('ana@negocio.com');
  await pc.confirmar((await pc.dispositivoDelToken(sinPasar.token, { pendientesTambien: true }))!);
  await pc.soltar((await pc.dispositivoDelToken(v2.token))!);
  out.sinAnterior = await pc.negocioConPc(3);
  // La de antes de OTRA persona, de OTRO negocio, o que no estaba activa: no pasa nada.
  const ajena = async (anteriorDe: { persona: string; ws: number; activa: boolean }) => {
    pg.db.ia_pc_dispositivos.length = 0;
    const a = await instalar(anteriorDe.persona, anteriorDe.ws);
    if (anteriorDe.activa) await activar(a.token); else await pc.confirmar((await pc.dispositivoDelToken(a.token, { pendientesTambien: true }))!);
    const n = await instalar('ana@negocio.com');
    await pc.confirmar((await pc.dispositivoDelToken(n.token, { pendientesTambien: true }))!, a.token);
    return pg.db.ia_pc_dispositivos.find((f) => f.token_hash !== undefined && f.persona === 'ana@negocio.com' && f.workspace_id === 3 && f.id !== pg.db.ia_pc_dispositivos[0].id)?.activa_at != null;
  };
  out.anteriorAjena = {
    deOtraPersona: await ajena({ persona: 'beto@negocio.com', ws: 3, activa: true }),
    deOtroNegocio: await ajena({ persona: 'ana@negocio.com', ws: 5, activa: true }),
    noActiva: await ajena({ persona: 'ana@negocio.com', ws: 3, activa: false }),
  };

  // ── 4. La purga y la lista: la confirmada que no latió se queda ──────────────
  pg.db.ia_pc_dispositivos.length = 0;
  const confirmada = await instalar('caro@negocio.com');
  await pc.confirmar((await pc.dispositivoDelToken(confirmada.token, { pendientesTambien: true }))!);
  await instalar('dani@negocio.com');
  const hace20 = new Date(Date.now() - 20 * 60_000).toISOString();
  for (const f of pg.db.ia_pc_dispositivos) f.creado_at = hace20;
  out.purga = await pc.purgarTurnosViejos();
  out.trasLaPurga = {
    confirmadaSigue: pg.db.ia_pc_dispositivos.find((f) => f.persona === 'caro@negocio.com')?.revocado_at == null,
    pendienteRevocada: pg.db.ia_pc_dispositivos.find((f) => f.persona === 'dani@negocio.com')?.revocado_at != null,
    listada: (await pc.listarDispositivos(3, 'caro@negocio.com', false)).length,
  };

  // ── 5. El código recién usado sin su PC anotada todavía ──────────────────────
  const r = await pc.crearCodigo(3, 'eva@negocio.com', VERSION_CONSENTIMIENTO);
  const fc = pg.db.ia_pc_codigos.find((f) => f.persona === 'eva@negocio.com' && f.usado_at == null)!;
  fc.usado_at = new Date().toISOString();
  out.recienUsado = await pc.estadoDelCodigo(3, 'eva@negocio.com', r.codigo);
  fc.usado_at = new Date(Date.now() - 2 * 60_000).toISOString();
  out.usadoHaceDos = await pc.estadoDelCodigo(3, 'eva@negocio.com', r.codigo);

  process.stdout.write(`@@RESULTADO@@${JSON.stringify(out)}`);
}

main().then(() => process.exit(0), (e) => { process.stdout.write(`@@RESULTADO@@${JSON.stringify({ error: e instanceof Error ? e.stack : String(e) })}`); process.exit(0); });
