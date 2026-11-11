// =============================================================================
// Hijo de tests/mako-responde-siempre.test.ts — NO es un test (no termina en .test.ts)
// =============================================================================
// Corre REAL la salida de la línea de MaKo (lib/mako-grupo.ts → `ev` → lib/linea-freno.ts) sobre un PostgREST de mentira y un Evolution
// en memoria que anota lo que se le pide. Lo que importa: con la línea FRENADA, ¿le llega a WhatsApp la respuesta al grupo donde una
// persona acaba de escribir, y no lo demás? Necesita `--conditions=react-server`.

import { crearPostgrest } from './_postgrest-de-mentira';

process.env.SUPABASE_URL = 'http://supa.test';
process.env.NEXT_PUBLIC_SUPABASE_URL = 'http://supa.test';
process.env.SUPABASE_SERVICE_ROLE_KEY = 'clave-de-prueba';
process.env.SUPABASE_SERVICE_KEY = 'clave-de-prueba';
process.env.AUTH_SECRET = 'secreto-de-firma-de-prueba-suficientemente-largo';
process.env.EVOLUTION_BASE_URL = 'http://evo.test';
process.env.EVOLUTION_API_KEY = 'clave-evo';
process.env.RESEND_API_KEY = 're_de_prueba';
process.env.CREDENCIALES_SECRET = 'secreto-de-cifrado-de-prueba-suficientemente-largo';

const PLATAFORMA = 9;
const LINEA_MAKO = 'mako_ws9';
const GRUPO = 'grupo-del-dueno@g.us';
const OTRO_GRUPO = 'grupo-de-otro@g.us';

const pg = crearPostgrest({
  tablas: ['app_settings', 'workspaces', 'usuarios', 'evolution_instancias', 'notificaciones'],
  unicos: [{ tabla: 'app_settings', columnas: ['workspace_id', 'key'], donde: () => true, nombre: 'app_settings_uk' }],
});
const db = pg.db as Record<string, Array<Record<string, unknown>>>;
db.workspaces = [{ id: PLATAFORMA, nombre: 'MaKo', capa: 'superadmin', estado: 'activo' }];
db.evolution_instancias = [];

/** Un freno vigente de 6 horas sobre la línea de MaKo, como el que deja un 403 al mandar. */
const frenoVigente = () => JSON.stringify({ tipo: 'bloqueo', desde: new Date().toISOString(), hasta: new Date(Date.now() + 6 * 3600_000).toISOString(), ruta: `/message/sendText/${LINEA_MAKO}` });
const arrancar = (frenada: boolean) => {
  db.app_settings = [{ workspace_id: 1, key: 'mako.voz.instancia', value: LINEA_MAKO }];
  if (frenada) db.app_settings.push({ workspace_id: PLATAFORMA, key: `linea.freno.${LINEA_MAKO}`, value: frenoVigente() });
};

let pedidos: Array<{ ruta: string; a: string }> = [];
let mails = 0;
/** Lo que contesta Evolution al mandar: bien, un 403 (cuenta que no puede escribir) o un 463 (cuenta restringida). */
let contesta: 'ok' | '403' | '463' = 'ok';

globalThis.fetch = (async (entrada: RequestInfo | URL, init: RequestInit = {}) => {
  const u = new URL(typeof entrada === 'string' ? entrada : entrada instanceof URL ? entrada.href : (entrada as Request).url);
  const json = (status: number, b: unknown) => new Response(JSON.stringify(b), { status, headers: { 'content-type': 'application/json' } });
  if (u.host === 'supa.test') return pg.responder(u, init);
  if (u.host === 'api.resend.com') { mails++; return json(200, { id: 'mail-1' }); }
  if (u.host !== 'evo.test') throw new Error(`fetch sin mock: ${u.href}`);
  const body = typeof init.body === 'string' ? JSON.parse(init.body) as Record<string, unknown> : null;
  const partes = u.pathname.split('/').filter(Boolean);
  const a = String(body?.number ?? (body?.key as { remoteJid?: string } | undefined)?.remoteJid ?? '');
  pedidos.push({ ruta: `${partes[0]}/${partes[1]}`, a });
  if (contesta === '403' && u.pathname.startsWith('/message/')) return json(403, { status: 403, error: 'Forbidden', response: { message: ['forbidden'] } });
  if (contesta === '463' && u.pathname.startsWith('/message/')) return json(400, { status: 400, error: 'Bad Request', response: { message: ['Error 463'] } });
  return json(201, { key: { id: `m${pedidos.length}`, remoteJid: a } });
}) as typeof fetch;

async function main() {
  const g = await import('../lib/mako-grupo');
  const { conRespuestaA, comoRespuesta } = await import('../lib/respuesta-en-curso');
  /** Lo que hace el turno del doer: abre el grupo al entrar, y su respuesta sale por la puerta de la respuesta. */
  const responde = <T>(jid: string, fn: () => Promise<T>) => conRespuestaA(jid, () => comoRespuesta(fn));
  const out: Record<string, unknown> = {};
  const llegaron = () => pedidos.map((p) => `${p.ruta} → ${p.a}`);

  // ── 1. La línea frenada: un aviso cualquiera no sale, y el motivo es el del freno ──
  arrancar(true); pedidos = [];
  const aviso = await g.enviarAGrupoJid(GRUPO, 'Tu reporte de la semana ya está listo.');
  out.avisoFrenado = { res: aviso, llegaron: llegaron() };

  // ── 2. La respuesta al grupo donde alguien acaba de escribir: sale igual ──
  pedidos = [];
  const respuesta = await responde(GRUPO, () => g.enviarAGrupoJid(GRUPO, 'Listo, ya te cargué la tarea en el plan.'));
  const reaccion = await responde(GRUPO, () => g.reaccionarMensaje(GRUPO, { id: 'in-1', remoteJid: GRUPO, fromMe: false }, '👍'));
  out.respuesta = { res: respuesta, reaccion, llegaron: llegaron() };

  // ── 3. Durante ese turno, a OTRO grupo no: no es la respuesta a nadie ──
  pedidos = [];
  const aOtro = await responde(GRUPO, () => g.enviarAGrupoJid(OTRO_GRUPO, 'Aviso para otro negocio.'));
  out.aOtroGrupo = { res: aOtro, llegaron: llegaron() };

  // ── 3b. Durante ese turno, un AVISO al mismo grupo (la tarjeta «MaKo en WhatsApp» de un flujo que corrió porque la persona movió un
  //        lead): no salió por la puerta de la respuesta, así que sigue frenado (la revisión del 11/11/2026) ──
  pedidos = [];
  db.app_settings.push({ workspace_id: PLATAFORMA, key: 'mako.grupo_jid', value: GRUPO });
  const avisoEnElTurno = await conRespuestaA(GRUPO, () => g.enviarAlGrupoMaKo(PLATAFORMA, 'Un lead pasó a Agendado.', null));
  out.avisoEnElTurno = { res: avisoEnElTurno, llegaron: llegaron() };

  // ── 4. La reacción sin turno abierto, con la línea frenada: no sale ──
  pedidos = [];
  out.reaccionSinTurno = { res: await g.reaccionarMensaje(GRUPO, { id: 'in-2', remoteJid: GRUPO, fromMe: false }, '👍'), llegaron: llegaron() };

  // ── 5. El mismo cartel a siete grupos, cada uno contestándole a quien escribió: salen los siete ──
  arrancar(false); pedidos = [];
  const cartel = 'Ahora no te puedo contestar: tu IA no respondió. Ya lo estoy viendo.';
  const mismos: boolean[] = [];
  for (let i = 1; i <= 7; i++) {
    const jid = `grupo-${i}@g.us`;
    mismos.push((await responde(jid, () => g.enviarAGrupoJid(jid, cartel))).ok);
  }
  out.mismoCartel = { resultados: mismos, salieron: pedidos.filter((p) => p.ruta === 'message/sendText').length };

  // ── 6. Un 403 a la respuesta frena la línea (y avisa una vez); la respuesta siguiente lo vuelve a intentar ──
  const freno = () => db.app_settings.find((f) => f.key === `linea.freno.${LINEA_MAKO}`)?.value ?? null;
  arrancar(false); pedidos = []; mails = 0; contesta = '403';
  const r1 = await responde(GRUPO, () => g.enviarAGrupoJid(GRUPO, 'Primera respuesta del turno.'));
  const r2 = await responde(GRUPO, () => g.enviarAGrupoJid(GRUPO, 'Segunda respuesta, con la línea ya frenada.'));
  const aviso2 = await g.enviarAGrupoJid(OTRO_GRUPO, 'Un aviso, con la línea frenada.');
  out.tras403 = { r1: r1.ok, r2: r2.ok, aviso: aviso2, mails, intentos: pedidos.filter((p) => p.ruta === 'message/sendText').map((p) => p.a), freno: freno() };

  // ── 7. Con la línea frenada por 6 h, una respuesta recibe un 463 (cuenta restringida): el freno sube a 24 h y avisa otra vez ──
  mails = 0; contesta = '463';
  await responde(GRUPO, () => g.enviarAGrupoJid(GRUPO, 'Tercera respuesta, y WhatsApp ahora restringe la cuenta.'));
  const tras463 = freno();
  await responde(GRUPO, () => g.enviarAGrupoJid(GRUPO, 'Cuarta respuesta, otro 463.'));
  out.tras463 = { mails, freno: tras463, frenoDespues: freno() };
  contesta = 'ok';

  process.stdout.write(`@@RESULTADO@@${JSON.stringify(out)}`);
}

main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
