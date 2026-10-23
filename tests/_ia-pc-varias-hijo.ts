// =============================================================================
// Hijo de tests/ia-pc-varias.test.ts — NO es un test (no termina en .test.ts)
// =============================================================================
// Varias computadoras por persona (22/10/2026, Martín: «el usuario debería poder abrir y ejecutar su Claude en varios
// dispositivos... Y poder "Desconectar" dispositivos»). Corre lib/ia-pc.ts REAL contra un PostgREST de mentira: Mauricio (ws1)
// conecta la PC que Martín instaló y después la suya; a cuál va el turno; la lista del super admin; desconectar una.
// =============================================================================

import { crearPostgrest } from './_postgrest-de-mentira';

process.env.NEXT_PUBLIC_SUPABASE_URL = 'http://supa.test';
process.env.SUPABASE_SERVICE_ROLE_KEY = 'service-role-de-prueba';

const WS = 1;
const MAU = 'mauricio@negocio.com';
let ids = 0;
const pg = crearPostgrest({
  tablas: ['workspaces', 'ia_pc_codigos', 'ia_pc_dispositivos', 'ia_pc_turnos', 'ia_pc_llamadas'],
  defaults: (tabla, f) => tabla === 'ia_pc_dispositivos'
    ? { id: ++ids, creado_at: new Date(Date.now() + ids * 1000).toISOString(), revocado_at: null, ultimo_latido: null, cuentas: [], confirmado_at: null, activa_at: null, claude_falta: false, version: null, ...f }
    : tabla === 'ia_pc_codigos' ? { usado_at: null, dispositivo_id: null, ...f } : f,
});
globalThis.fetch = (async (entrada: RequestInfo | URL, init: RequestInit = {}) => {
  const u = new URL(typeof entrada === 'string' ? entrada : entrada instanceof URL ? entrada.href : entrada.url);
  if (u.host === 'supa.test') return pg.responder(u, init);
  return new Response('{}', { status: 500 });
}) as typeof fetch;

const CON_SESION = [{ proveedor: 'claude', email: 'mau@x.com' }];

async function main() {
  const pc = await import('../lib/ia-pc');
  const { VERSION_CONSENTIMIENTO } = await import('../lib/ia-pc-reglas');
  pg.db.workspaces.push({ id: WS, nombre: 'Mauricio Bustos' }, { id: 13, nombre: 'Código Inmobiliario' });
  const conectar = async (ws: number, persona: string, nombre: string, version: string) => {
    const c = await pc.crearCodigo(ws, persona, VERSION_CONSENTIMIENTO);
    const e = await pc.emparejar(c.codigo, nombre);
    const d0 = await pc.dispositivoDelToken(e!.token, { pendientesTambien: true });
    await pc.confirmar(d0!);
    const d = await pc.dispositivoDelToken(e!.token);
    await pc.latir(d!, { version, cuentas: CON_SESION });
    return { token: e!.token, id: d!.id };
  };
  const out: Record<string, unknown> = {};

  // 1. La que instaló Martín en la cuenta de Mauricio, y después la de Mauricio: las dos quedan.
  const martin = await conectar(WS, MAU, 'PC de Martín', '0.3.2');
  const suya = await conectar(WS, MAU, 'PC de Mauricio', '0.4.0+windows');
  const delCodigo = await conectar(13, 'ana@codigo.com', 'MacBook de Ana', '0.4.0+mac');
  out.listadas = (await pc.listarDispositivos(WS, MAU, false)).map((d) => ({ nombre: d.nombre, sistema: d.sistema, conectada: !!d.conectadaAt, enLinea: d.enLinea }));
  // 2. A cuál va el turno: las dos en línea; sin turnos, la última conectada (la suya).
  out.sinTurnos = (await pc.pcDe(WS, MAU))?.nombre;
  // Contestó un turno la de Martín: ésa es la que está usando.
  pg.db.ia_pc_turnos.push({ id: 1, workspace_id: WS, dispositivo_id: martin.id, sesion_id: 1, estado: 'listo', pedido: {}, vence_at: new Date().toISOString(), listo_at: new Date().toISOString(), creado_at: new Date().toISOString() });
  out.conTurno = (await pc.pcDe(WS, MAU))?.nombre;
  // La de Martín se apaga (sin latido hace 10 minutos): va a la que está en línea.
  const fila = pg.db.ia_pc_dispositivos.find((f) => f.id === martin.id)!;
  fila.ultimo_latido = new Date(Date.now() - 10 * 60_000).toISOString();
  out.apagada = (await pc.pcDe(WS, MAU))?.nombre;
  // La de Martín vuelve, pero su último turno FALLÓ (tope, colgada): va a la suya, aunque la de Martín sea «la del último
  // turno» (revisión adversarial). Y con la suya agotada (100% de la semana), a la de Martín.
  fila.ultimo_latido = new Date().toISOString();
  pg.db.ia_pc_turnos.push({ id: 2, workspace_id: WS, dispositivo_id: martin.id, sesion_id: 1, estado: 'error', pedido: {}, vence_at: new Date().toISOString(), creado_at: new Date(Date.now() + 1000).toISOString() });
  out.fallo = (await pc.pcDe(WS, MAU))?.nombre;
  const filaSuya = pg.db.ia_pc_dispositivos.find((f) => f.id === suya.id)!;
  // La de Martín se repuso (contestó bien después del error) y la suya llegó al 100% de la semana.
  pg.db.ia_pc_turnos.push({ id: 4, workspace_id: WS, dispositivo_id: martin.id, sesion_id: 1, estado: 'listo', pedido: {}, vence_at: new Date().toISOString(), listo_at: new Date().toISOString(), creado_at: new Date(Date.now() + 2000).toISOString() });
  // La suya contestó DESPUÉS (sin mirar el 100%, ganaría ella).
  pg.db.ia_pc_turnos.push({ id: 6, workspace_id: WS, dispositivo_id: suya.id, sesion_id: 1, estado: 'listo', pedido: {}, vence_at: new Date().toISOString(), listo_at: new Date().toISOString(), creado_at: new Date(Date.now() + 3000).toISOString() });
  filaSuya.cuentas = [{ proveedor: 'claude', email: 'mau@x.com', usadoSemana: 100 }];
  out.agotada = (await pc.pcDe(WS, MAU))?.nombre;
  filaSuya.cuentas = CON_SESION;
  // Un turno que la PC toma justo cuando la desconectan no se le da; y una herramienta de una PC desconectada no se pide.
  const otra = await conectar(WS, 'otra@negocio.com', 'PC de Otra', '0.4.0+windows');
  pg.db.ia_pc_turnos.push({ id: 3, workspace_id: WS, dispositivo_id: otra.id, sesion_id: 2, estado: 'esperando', pedido: {}, vence_at: new Date(Date.now() + 60_000).toISOString(), creado_at: new Date().toISOString() });
  const dOtra = (await pc.dispositivoDelToken(otra.token))!;
  pg.db.ia_pc_dispositivos.find((f) => f.id === otra.id)!.revocado_at = new Date().toISOString();
  out.tomadaRevocada = await pc.tomarTurno(dOtra, 0);
  out.turnoRevocado = pg.db.ia_pc_turnos.find((f) => f.id === 3)!.estado;
  pg.db.ia_pc_turnos.find((f) => f.id === 3)!.estado = 'tomado';
  out.llamadaRevocada = await pc.pedirLlamada(3, 'leer', {}, 0);
  // Una herramienta que ya estaba en la fila de una PC desconectada no corre.
  pg.db.ia_pc_llamadas.push({ id: 1, turno_id: 3, nombre: 'leer', entrada: {}, estado: 'esperando' });
  let corrio = false;
  await pc.esperarALaPc(3, WS, otra.id, async () => { corrio = true; return 'hecho'; }, 50);
  out.herramientaRevocada = { corrio, salida: pg.db.ia_pc_llamadas.find((f) => f.id === 1)!.salida };
  // 3. La lista del super admin: de todos los negocios, sin secretos.
  const todas = await pc.listarTodasLasPc();
  out.todas = todas.map((p) => ({ ws: p.ws, negocio: p.negocio, persona: p.persona, nombre: p.nombre, sistema: p.sistema, enLinea: p.enLinea, conClaude: p.conClaude }));
  out.secretos = JSON.stringify(todas).match(/token|hash/i)?.[0] ?? null;
  // 4. Desconectar la suya: deja de estar en la lista y en el turno, y su token ya no sirve. La de Martín sigue.
  await pc.desconectar(WS, suya.id);
  out.despues = {
    listadas: (await pc.listarDispositivos(WS, MAU, false)).map((d) => d.nombre),
    turno: (await pc.pcDe(WS, MAU))?.nombre ?? null,
    tokenSirve: !!(await pc.dispositivoDelToken(suya.token)),
    todas: (await pc.listarTodasLasPc()).map((p) => p.nombre),
  };
  // 5. Desconectar con el ws equivocado no toca nada (la del ws13 sigue).
  await pc.desconectar(WS, delCodigo.id);
  out.otroWs = (await pc.listarTodasLasPc()).some((p) => p.id === delCodigo.id);
  process.stdout.write(`@@VARIAS@@${JSON.stringify(out)}\n`);
}

main().then(() => process.exit(0), (e) => { process.stdout.write(`@@VARIAS@@${JSON.stringify({ error: e instanceof Error ? e.stack : String(e) })}\n`); process.exit(0); });
