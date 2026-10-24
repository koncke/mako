// =============================================================================
// Hijo de tests/ia-pc-varias.test.ts — NO es un test (no termina en .test.ts)
// =============================================================================
// Varias computadoras por persona (22/10/2026, Martín: «el usuario debería poder abrir y ejecutar su Claude en varios
// dispositivos... Y poder "Desconectar" dispositivos»). Corre lib/ia-pc.ts REAL contra un PostgREST de mentira: Mauricio (ws1)
// conecta la PC que Martín instaló y después la suya; a cuál va el turno; la lista del super admin; desconectar una.
// =============================================================================

import { crearPostgrest } from './_postgrest-de-mentira';

// La sesión del pedido, de mentira: la puerta de la PC (`encolarTurno`) la lee de lib/auth (la guarda del 23/10/2026).
let sesionFalsa: { email: string; nombre: string; sub: string } | null = null;
const Modulo = require('node:module') as { _load: (pedido: string, padre: unknown, esMain: boolean) => unknown };
const cargarOriginal = Modulo._load;
Modulo._load = function (this: unknown, pedido: string, padre: unknown, esMain: boolean) {
  if (pedido === './auth' || pedido === '@/lib/auth') return { getUsuarioActual: async () => sesionFalsa };
  return cargarOriginal.call(this, pedido, padre, esMain);
};

process.env.NEXT_PUBLIC_SUPABASE_URL = 'http://supa.test';
process.env.SUPABASE_SERVICE_ROLE_KEY = 'service-role-de-prueba';

const WS = 1;
const MAU = 'mauricio@negocio.com';
let ids = 0;
let idsTurno = 100;
const pg = crearPostgrest({
  tablas: ['workspaces', 'ia_pc_codigos', 'ia_pc_dispositivos', 'ia_pc_turnos', 'ia_pc_llamadas'],
  defaults: (tabla, f) => tabla === 'ia_pc_dispositivos'
    ? { id: ++ids, creado_at: new Date(Date.now() + ids * 1000).toISOString(), revocado_at: null, ultimo_latido: null, cuentas: [], confirmado_at: null, activa_at: null, claude_falta: false, version: null, ...f }
    : tabla === 'ia_pc_codigos' ? { usado_at: null, dispositivo_id: null, ...f }
    : tabla === 'ia_pc_turnos' ? { id: ++idsTurno, estado: 'esperando', creado_at: new Date().toISOString(), ...f } : f,
});
globalThis.fetch = (async (entrada: RequestInfo | URL, init: RequestInit = {}) => {
  const u = new URL(typeof entrada === 'string' ? entrada : entrada instanceof URL ? entrada.href : entrada.url);
  if (u.host === 'supa.test') return pg.responder(u, init);
  return new Response('{}', { status: 500 });
}) as typeof fetch;

const CON_SESION = [{ proveedor: 'claude', email: 'mau@x.com' }];

async function main() {
  const pc = await import('../lib/ia-pc');
  const { CONSENTIMIENTO_DE, TURNO_MS, VERSION_CONSENTIMIENTO, pcUsable } = await import('../lib/ia-pc-reglas');
  pg.db.workspaces.push({ id: WS, nombre: 'Mauricio Bustos' }, { id: 13, nombre: 'Código Inmobiliario' }, { id: 21, nombre: 'Leo' }, { id: 22, nombre: 'Lía' });
  const conectar = async (ws: number, persona: string, nombre: string, version: string, texto = VERSION_CONSENTIMIENTO, cuentas: unknown[] = CON_SESION) => {
    const c = await pc.crearCodigo(ws, persona, texto);
    const e = await pc.emparejar(c.codigo, nombre);
    const d0 = await pc.dispositivoDelToken(e!.token, { pendientesTambien: true });
    await pc.confirmar(d0!);
    const d = await pc.dispositivoDelToken(e!.token);
    await pc.latir(d!, { version, cuentas });
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
  // Por IA (la ola 3): la suya con sólo su ChatGPT. El turno de Claude va a la de Martín y el de ChatGPT, a la suya, aunque
  // la de Martín sea la del último turno; sin ninguna con ChatGPT, ninguna sirve para un turno de ChatGPT.
  filaSuya.cuentas = [{ proveedor: 'chatgpt', email: 'mau@x.com' }];
  // Conectada con el texto de Claude, su ChatGPT no sirve aunque el programa lo reporte (la guarda del 23/10).
  const chatgptConTextoDeClaude = pcUsable(await pc.pcDe(WS, MAU, 'chatgpt'), 'chatgpt');
  filaSuya.consentimiento = CONSENTIMIENTO_DE.chatgpt.version;
  out.porIA = {
    chatgptConTextoDeClaude,
    claude: (await pc.pcDe(WS, MAU))?.nombre,
    chatgpt: (await pc.pcDe(WS, MAU, 'chatgpt'))?.nombre,
    // La de Ana (sólo Claude): para un turno de ChatGPT vuelve la última, para el aviso, pero no sirve.
    anaParaChatgpt: pcUsable(await pc.pcDe(13, 'ana@codigo.com', 'chatgpt'), 'chatgpt'),
  };
  filaSuya.cuentas = CON_SESION;
  filaSuya.consentimiento = VERSION_CONSENTIMIENTO;
  // Por el texto aceptado, al guardar el latido (lo que la ACTIVA para D6b): la de Leo, conectada con el texto de Claude, reporta
  // sólo ChatGPT; la de Lía, conectada con el de ChatGPT, reporta las dos.
  const leo = await conectar(21, 'leo@x.com', 'PC de Leo', '0.5.0+windows', VERSION_CONSENTIMIENTO, [{ proveedor: 'chatgpt', email: 'leo@x.com' }]);
  const lia = await conectar(22, 'lia@x.com', 'PC de Lía', '0.5.0+windows', CONSENTIMIENTO_DE.chatgpt.version, [{ proveedor: 'chatgpt', email: 'lia@x.com' }, { proveedor: 'claude', email: 'lia@x.com' }]);
  const filaDe = (id: number) => pg.db.ia_pc_dispositivos.find((x) => x.id === id)!;
  out.porTexto = {
    leo: { cuentas: (filaDe(leo.id).cuentas as Array<{ proveedor: string }>).map((c) => c.proveedor), activa: filaDe(leo.id).activa_at != null, negocio: await pc.negocioConPc(21) },
    lia: { cuentas: (filaDe(lia.id).cuentas as Array<{ proveedor: string }>).map((c) => c.proveedor), activa: filaDe(lia.id).activa_at != null, negocio: await pc.negocioConPc(22) },
    liaParaClaude: pcUsable(await pc.pcDe(22, 'lia@x.com'), 'claude'),
    liaParaChatgpt: pcUsable(await pc.pcDe(22, 'lia@x.com', 'chatgpt'), 'chatgpt'),
  };
  // Fuera, para que la lista del super admin (abajo) sea la de siempre.
  for (const id of [leo.id, lia.id]) pg.db.ia_pc_dispositivos.splice(pg.db.ia_pc_dispositivos.findIndex((x) => x.id === id), 1);
  // El turno vence cuando el chat deja de esperarlo, nunca más tarde que TURNO_MS (un turno huérfano no se toma).
  const dMartin = (await pc.dispositivoDelToken(martin.token))!;
  const venceEn = async (esperaMs?: number) => {
    sesionFalsa = { email: MAU, nombre: 'Mauricio', sub: '1' };
    const id = await pc.encolarTurno(dMartin, 9, { system: 's', prompt: 'p', tools: [] }, esperaMs).finally(() => { sesionFalsa = null; });
    const t = pg.db.ia_pc_turnos.find((x) => x.id === id)!;
    pg.db.ia_pc_turnos.splice(pg.db.ia_pc_turnos.indexOf(t), 1);
    return Math.round((Date.parse(String(t.vence_at)) - Date.now()) / 1000);
  };
  out.vence = { conEspera: await venceEn(30_000), sinEspera: await venceEn(), larga: await venceEn(60 * 60_000), tope: Math.round(TURNO_MS / 1000) };
  // LA PUERTA MIRA LA SESIÓN: sin la de quien conectó la PC, no encola, aunque la llamen directo (un cron, un alias).
  const intentar = async (sesion: typeof sesionFalsa, o?: { pruebaSinSesion?: boolean }) => {
    sesionFalsa = sesion;
    try {
      await pc.encolarTurno(dMartin, 9, { system: 's', prompt: 'p', tools: [] }, 30_000, o);
      return 'encolado';
    } catch (e) {
      return e instanceof pc.SinLaPersona ? 'frenado' : `tiró: ${e instanceof Error ? e.message : String(e)}`;
    } finally {
      sesionFalsa = null;
      for (let i = pg.db.ia_pc_turnos.length - 1; i >= 0; i--) if (pg.db.ia_pc_turnos[i].sesion_id === 9) pg.db.ia_pc_turnos.splice(i, 1);
    }
  };
  out.puerta = {
    sinSesion: await intentar(null),
    otraPersona: await intentar({ email: 'otra@negocio.com', nombre: 'Otra', sub: '2' }),
    suSesion: await intentar({ email: MAU, nombre: 'Mauricio', sub: '1' }),
    pruebaFueraDelWs3: await intentar(null, { pruebaSinSesion: true }),
  };
  // Un turno de Claude vencido no se toma.
  pg.db.ia_pc_turnos.push({ id: 50, workspace_id: WS, dispositivo_id: martin.id, sesion_id: 9, estado: 'esperando', pedido: {}, vence_at: new Date(Date.now() - 1000).toISOString(), creado_at: new Date(Date.now() - 60_000).toISOString() });
  out.huerfanoTomado = !!(await pc.tomarTurno(dMartin, 0));
  pg.db.ia_pc_turnos.splice(pg.db.ia_pc_turnos.findIndex((x) => x.id === 50), 1);
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
