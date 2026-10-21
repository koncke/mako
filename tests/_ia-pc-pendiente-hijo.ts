// =============================================================================
// Hijo de tests/ia-pc-segunda-revision.test.ts — NO es un test (no termina en .test.ts)
// =============================================================================
// lib/ia-pc.ts lleva `server-only`: corre en un node aparte con `--conditions=react-server`. Recorre la vida REAL de una
// PC (mig 0322) contra un PostgREST de mentira (tests/_postgrest-de-mentira.ts): el código, emparejar (nace PENDIENTE),
// el «sí» (`confirmar`), el primer latido sin Claude y con una cuenta con sesión (recién ahí ACTIVA), el «no» (soltar), la
// abandonada en la pregunta (la purga) y el negocio sin nombre. Anota lo que ve cada función en cada momento.
// =============================================================================

import { crearPostgrest } from './_postgrest-de-mentira';

process.env.NEXT_PUBLIC_SUPABASE_URL = 'http://supa.test';
process.env.SUPABASE_SERVICE_ROLE_KEY = 'service-role-de-prueba';

const WS = 3;
const SIN_NOMBRE = 4;
const ANA = 'ana@negocio.com';

let ids = 0;
const pg = crearPostgrest({
  tablas: ['workspaces', 'ia_pc_codigos', 'ia_pc_dispositivos', 'ia_pc_turnos', 'ia_pc_llamadas'],
  // Los defaults de la tabla (mig 0320 y 0322): el id, la hora, y la PC sin confirmar ni activa.
  defaults: (tabla, f) => tabla === 'ia_pc_dispositivos'
    ? { id: ++ids, creado_at: new Date().toISOString(), revocado_at: null, ultimo_latido: null, cuentas: [], confirmado_at: null, activa_at: null, claude_falta: false, ...f }
    : tabla === 'ia_pc_codigos' ? { usado_at: null, dispositivo_id: null, ...f } : f,
});
globalThis.fetch = (async (entrada: RequestInfo | URL, init: RequestInit = {}) => {
  const u = new URL(typeof entrada === 'string' ? entrada : entrada instanceof URL ? entrada.href : entrada.url);
  if (u.host === 'supa.test') return pg.responder(u, init);
  return new Response('{}', { status: 500 });
}) as typeof fetch;

async function main() {
  const pc = await import('../lib/ia-pc');
  const { VERSION_CONSENTIMIENTO } = await import('../lib/ia-pc-reglas');
  pg.db.workspaces.push({ id: WS, nombre: 'Negocio de Prueba' }, { id: SIN_NOMBRE, nombre: '  ' });
  const filas = () => pg.db.ia_pc_dispositivos;
  const out: Record<string, unknown> = {};
  /** Lo que ven las demás funciones de la PC `token` en este momento. */
  const foto = async (token: string, codigo: string) => ({
    estadoDelCodigo: await pc.estadoDelCodigo(WS, ANA, codigo),
    delToken: !!(await pc.dispositivoDelToken(token)),
    delTokenPendiente: !!(await pc.dispositivoDelToken(token, { pendientesTambien: true })),
    pcDe: !!(await pc.pcDe(WS, ANA)),
    listadas: (await pc.listarDispositivos(WS, ANA, true)).length,
    negocioConPc: await pc.negocioConPc(WS),
  });

  // 1. El camino de siempre: código → emparejar (PENDIENTE) → «sí» → latido sin Claude → latido con sesión (ACTIVA).
  const a = await pc.crearCodigo(WS, ANA, VERSION_CONSENTIMIENTO);
  out.codigoVivo = await pc.estadoDelCodigo(WS, ANA, a.codigo);
  const e = await pc.emparejar(a.codigo, 'PC de Ana');
  if (!e) throw new Error('emparejar no devolvió nada');
  out.emparejado = { negocio: e.negocio, persona: e.persona, confirmado: filas()[0].confirmado_at ?? null, activa: filas()[0].activa_at ?? null };
  out.pendiente = await foto(e.token, a.codigo);
  const d0 = await pc.dispositivoDelToken(e.token, { pendientesTambien: true });
  out.confirmar = d0 ? await pc.confirmar(d0) : 'sin pc';
  out.confirmada = await foto(e.token, a.codigo);
  const d1 = await pc.dispositivoDelToken(e.token);
  if (!d1) throw new Error(`la confirmada no se lee: ${JSON.stringify({ out, filas: filas() })}`);
  await pc.latir(d1, { version: '0.3.1', cuentas: [], sinClaude: true });
  out.sinClaude = { ...(await foto(e.token, a.codigo)), claudeFalta: filas()[0].claude_falta, activa: filas()[0].activa_at ?? null };
  const d2 = await pc.dispositivoDelToken(e.token);
  if (!d2) throw new Error('la confirmada no se lee');
  await pc.latir(d2, { version: '0.3.1', cuentas: [{ proveedor: 'claude', email: 'ana@x.com', usadoSemana: 100, reponeSemana: '2026-10-25T10:00:00.000Z' }] });
  out.activa = { ...(await foto(e.token, a.codigo)), claudeFalta: filas()[0].claude_falta, activa: filas()[0].activa_at != null, cuentas: filas()[0].cuentas };
  out.confirmarDeNuevo = await pc.confirmar((await pc.dispositivoDelToken(e.token))!);

  // 2. «No es mi negocio»: el programa suelta la pendiente. El código queda gastado SIN conectar.
  const b = await pc.crearCodigo(WS, 'beto@negocio.com', VERSION_CONSENTIMIENTO);
  const eb = await pc.emparejar(b.codigo, 'PC de Beto');
  const db = await pc.dispositivoDelToken(eb!.token, { pendientesTambien: true });
  await pc.soltar(db!);
  out.dijoQueNo = { estadoDelCodigo: await pc.estadoDelCodigo(WS, 'beto@negocio.com', b.codigo), delTokenPendiente: !!(await pc.dispositivoDelToken(eb!.token, { pendientesTambien: true })) };

  // 3. Abandonada en la pregunta (cerró la ventana): pasados 15 minutos el código dice «cancelado» y la purga la revoca.
  const c = await pc.crearCodigo(WS, 'caro@negocio.com', VERSION_CONSENTIMIENTO);
  const ec = await pc.emparejar(c.codigo, 'PC de Caro');
  out.eligiendo = await pc.estadoDelCodigo(WS, 'caro@negocio.com', c.codigo);
  const hace20 = new Date(Date.now() - 20 * 60_000).toISOString();
  for (const f of pg.db.ia_pc_codigos) if (f.persona === 'caro@negocio.com') f.usado_at = hace20;
  for (const f of filas()) {
    f.creado_at = f.persona === 'caro@negocio.com' ? hace20 : new Date().toISOString();
  }
  out.abandonadaCodigo = await pc.estadoDelCodigo(WS, 'caro@negocio.com', c.codigo);
  out.purga = await pc.purgarTurnosViejos();
  out.abandonada = { revocada: filas().find((f) => f.persona === 'caro@negocio.com')?.revocado_at != null, delTokenPendiente: !!(await pc.dispositivoDelToken(ec!.token, { pendientesTambien: true })) };
  out.activaSigue = filas().find((f) => f.persona === ANA)?.revocado_at == null;

  // 4. Un negocio sin nombre: emparejar tira ANTES de gastar el código («¿es tu negocio?» no puede decir «tu negocio»).
  const s = await pc.crearCodigo(SIN_NOMBRE, ANA, VERSION_CONSENTIMIENTO);
  out.sinNombre = await pc.emparejar(s.codigo, 'PC').then(() => 'no tiró', (x: unknown) => (x instanceof Error ? x.message : String(x)));
  out.sinNombreCodigo = await pc.estadoDelCodigo(SIN_NOMBRE, ANA, s.codigo);
  out.sinNombrePcs = filas().filter((f) => f.workspace_id === SIN_NOMBRE).length;

  process.stdout.write(`@@RESULTADO@@${JSON.stringify(out)}`);
}

main().then(() => process.exit(0), (e) => { process.stdout.write(`@@RESULTADO@@${JSON.stringify({ error: e instanceof Error ? e.stack : String(e) })}`); process.exit(0); });
