// =============================================================================
// Hijo de tests/whatsapp-anti-ban.test.ts — NO es un test (no termina en .test.ts)
// =============================================================================
// Corren REALES la verificación entrante del onboarding, la regla de no escribirle primero a nadie, el mismo texto a muchos chats, el
// tope diario de altas y el freno de una línea, sobre un PostgREST de mentira y un Evolution en memoria que anota lo que se le pide.
// Lo que importa es qué le llegó a WhatsApp, qué quedó guardado y qué salió por mail. Necesita `--conditions=react-server`.

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

const PLATAFORMA = 9, CLIENTE = 17, NUEVO = 25;
const LINEA_MAKO = 'mako_ws9', NUMERO_MAKO = '5493410000999';
const LINEA_CLIENTE = 'mako_ws17';
const DUENO = '5491130000111';       // El número que da quien hace el onboarding.
const OTRO = '5491130000222';        // Otro número.
const ESCRIBIO = '5491130000333';    // Le escribió a la línea de MaKo alguna vez.
const LEAD = '5491130000444';

const pg = crearPostgrest({
  tablas: ['app_settings', 'workspaces', 'usuarios', 'evolution_instancias', 'notificaciones', 'agencia_clientes', 'agencias'],
  unicos: [{ tabla: 'app_settings', columnas: ['workspace_id', 'key'], donde: () => true, nombre: 'app_settings_uk' }],
});
const db = pg.db as Record<string, Array<Record<string, unknown>>>;
db.workspaces = [
  { id: PLATAFORMA, nombre: 'MaKo', capa: 'superadmin', estado: 'activo' },
  { id: CLIENTE, nombre: 'Giselle', capa: 'completo', estado: 'activo' },
  { id: NUEVO, nombre: 'Nueva', capa: 'completo', estado: 'activo' },
];
db.evolution_instancias = [{ id: 1, workspace_id: CLIENTE, instance_name: LINEA_CLIENTE, estado: 'conectado', numero: '5491130000900', es_default: true, etiqueta: null }];
const arrancar = () => {
  db.app_settings = [
    { workspace_id: 1, key: 'mako.voz.instancia', value: LINEA_MAKO },
    { workspace_id: CLIENTE, key: 'notif_emails', value: JSON.stringify(['equipo@cliente.test']) },
  ];
};

let pedidos: Array<{ ruta: string; linea: string; a: string; subject?: string }> = [];
let grupoRoto = false;
let mails: Array<{ to: unknown; subject: string }> = [];
/** Lo que contesta Evolution al mandar, por línea: 'ok', 'rate' (500 rate-overlimit) o '403'. */
const modo: Record<string, 'ok' | 'rate' | '403'> = {};
let lineaConectada = true;

globalThis.fetch = (async (entrada: RequestInfo | URL, init: RequestInit = {}) => {
  const u = new URL(typeof entrada === 'string' ? entrada : entrada instanceof URL ? entrada.href : (entrada as Request).url);
  const json = (status: number, b: unknown) => new Response(JSON.stringify(b), { status, headers: { 'content-type': 'application/json' } });
  if (u.host === 'supa.test') return pg.responder(u, init);
  if (u.host === 'api.resend.com') { mails.push(JSON.parse(String(init.body))); return json(200, { id: 'mail-1' }); }
  if (u.host !== 'evo.test') throw new Error(`fetch sin mock: ${u.href}`);
  const body = typeof init.body === 'string' ? JSON.parse(init.body) as Record<string, unknown> : null;
  if (u.pathname.startsWith('/instance/fetchInstances')) {
    return json(200, [{ name: LINEA_MAKO, connectionStatus: lineaConectada ? 'open' : 'close', ownerJid: `${NUMERO_MAKO}@s.whatsapp.net` }]);
  }
  if (u.pathname.startsWith('/chat/findMessages')) {
    const jid = String((body?.where as { key?: { remoteJid?: string } })?.key?.remoteJid ?? '');
    const records = jid.startsWith(ESCRIBIO) || jid.startsWith(DUENO) ? [{ key: { remoteJid: jid, fromMe: false } }] : [];
    return json(200, { messages: { total: records.length, records } });
  }
  if (u.pathname.startsWith('/chat/whatsappNumbers')) return json(200, [{ exists: true, jid: `${String((body?.numbers as string[])[0])}@s.whatsapp.net` }]);
  const partes = u.pathname.split('/').filter(Boolean);
  const linea = decodeURIComponent(partes[partes.length - 1] ?? '');
  const a = String(body?.number ?? (body?.participants as string[] | undefined)?.[0] ?? u.searchParams.get('groupJid') ?? '');
  pedidos.push({ ruta: `${partes[0]}/${partes[1]}`, linea, a, ...(typeof body?.subject === 'string' ? { subject: body.subject } : {}) });
  if (u.pathname.startsWith('/message/')) {
    if (modo[linea] === 'rate') return json(500, { status: 500, error: 'Internal Server Error', response: { message: ['rate-overlimit'] } });
    if (modo[linea] === '403') return json(403, { status: 403, error: 'Forbidden', response: { message: ['forbidden'] } });
  }
  if (u.pathname.startsWith('/group/create')) return grupoRoto ? json(500, { message: 'no pude crear el grupo' }) : json(200, { id: 'nuevo@g.us' });
  if (u.pathname.startsWith('/group/updateParticipant')) return json(200, { updateParticipants: [{ status: '200', jid: a }] });
  return json(201, { key: { id: `m${pedidos.length}`, remoteJid: a } });
}) as typeof fetch;

/** El mensaje que llega al webhook: una persona le escribe a la línea de MaKo. */
const llega = (de: string, texto: string, extra: Record<string, unknown> = {}) => ({
  key: { remoteJid: `${de}@s.whatsapp.net`, fromMe: false, id: `in-${Math.random()}` , ...extra },
  message: { conversation: texto },
  messageTimestamp: Math.floor(Date.now() / 1000),
});

async function main() {
  const g = await import('../lib/mako-grupo');
  const evo = await import('../lib/evolution');
  const { runWithWorkspace } = await import('../lib/workspace');
  const { textoParaMandar } = await import('../lib/verificacion-entrante');
  const out: Record<string, unknown> = {};
  const verif = (ws: number) => {
    const raw = db.app_settings.find((f) => f.workspace_id === ws && f.key === 'mako.contacto.verificacion')?.value;
    return raw ? JSON.parse(String(raw)) as Record<string, unknown> : null;
  };
  const codigoDe = (ws: number) => String(verif(ws)?.codigo ?? '');

  // ── 1. El onboarding: la persona escribe primero ─────────────────────────
  arrancar(); pedidos = [];
  const pedido = await g.pedirMensajeDeVerificacion(NUEVO, DUENO, 'Nueva');
  out.pedido = { res: pedido, pedidos: [...pedidos], estado: verif(NUEVO) };
  // Escribir el código en la app no lo confirma: lo que prueba es el número que lo manda.
  out.tipeado = await g.verificarCodigoContacto(NUEVO, codigoDe(NUEVO));
  // Desde otro número: no se confirma, y queda dicho.
  pedidos = [];
  out.otroNumero = { res: await g.confirmarPorMensajeEntrante(LINEA_MAKO, llega(OTRO, textoParaMandar(codigoDe(NUEVO)))), estado: verif(NUEVO), pedidos: [...pedidos] };
  // A otra línea (un cliente que tiene el mismo texto por casualidad): no.
  out.otraLinea = { res: await g.confirmarPorMensajeEntrante(LINEA_CLIENTE, llega(DUENO, textoParaMandar(codigoDe(NUEVO)))), verificado: verif(NUEVO)?.verificado };
  // Un mensaje sin código no toca la base.
  out.sinCodigo = await g.confirmarPorMensajeEntrante(LINEA_MAKO, llega(DUENO, 'Hola, ¿cómo estás?'));
  // Desde su número, con el texto tocado (minúsculas): se confirma, y recién ahí entra al grupo.
  pedidos = [];
  const bien = await g.confirmarPorMensajeEntrante(LINEA_MAKO, llega(DUENO, `hola mako ${codigoDe(NUEVO).toLowerCase()}`));
  const antesDelGrupo = [...pedidos];
  if (bien?.sumarAlGrupo) await bien.sumarAlGrupo();
  out.confirmado = { resultado: bien?.resultado, estado: verif(NUEVO), antesDelGrupo, pedidos: [...pedidos], vista: await g.estadoVerificacionEntrante(NUEVO) };
  // La misma llegada otra vez (dos líneas de la misma cuenta): no vuelve a sumar a nadie.
  pedidos = [];
  const otraVez = await g.confirmarPorMensajeEntrante(LINEA_MAKO, llega(DUENO, textoParaMandar(String(verif(NUEVO)?.codigo))));
  out.otraVez = { resultado: otraVez?.resultado, conGrupo: !!otraVez?.sumarAlGrupo, pedidos: [...pedidos] };
  // Vencido.
  arrancar();
  await g.pedirMensajeDeVerificacion(NUEVO, DUENO, 'Nueva');
  const vencida: Record<string, unknown> = { ...verif(NUEVO)!, expira: Date.now() - 1000 };
  db.app_settings.find((f) => f.workspace_id === NUEVO && f.key === 'mako.contacto.verificacion')!.value = JSON.stringify(vencida);
  out.vencido = { res: await g.confirmarPorMensajeEntrante(LINEA_MAKO, llega(DUENO, textoParaMandar(String(vencida.codigo)))), verificado: verif(NUEVO)?.verificado };
  // Con la línea de MaKo desconectada, no hay link: lo dice y no inventa un número.
  arrancar(); lineaConectada = false;
  out.sinLinea = await g.pedirMensajeDeVerificacion(NUEVO, DUENO, 'Nueva');
  lineaConectada = true;
  // Un pedido de antes del 4/11 (MaKo le mandó el código): el código tipeado sigue sirviendo.
  arrancar();
  db.app_settings.push({ workspace_id: NUEVO, key: 'mako.contacto.verificacion', value: JSON.stringify({ telefono: DUENO, destino: DUENO, codigo: '123456', expira: Date.now() + 60_000, verificado: false, nombre: 'Nueva' }) });
  out.deAntes = await g.verificarCodigoContacto(NUEVO, '123456');
  // El de antes, si el grupo no sale: no queda verificado (el mismo código sirve para reintentar).
  arrancar(); grupoRoto = true;
  db.app_settings.push({ workspace_id: NUEVO, key: 'mako.contacto.verificacion', value: JSON.stringify({ telefono: DUENO, destino: DUENO, codigo: '123456', expira: Date.now() + 60_000, verificado: false, nombre: 'Nueva' }) });
  out.deAntesSinGrupo = { res: await g.verificarCodigoContacto(NUEVO, '123456'), verificado: verif(NUEVO)?.verificado };
  grupoRoto = false;
  // Sin el nombre del negocio todavía (el WhatsApp va primero): el grupo nace con el nombre del workspace, no «MaKo <> tu negocio».
  arrancar(); pedidos = [];
  await g.pedirMensajeDeVerificacion(NUEVO, DUENO, '');
  const sinNombre = await g.confirmarPorMensajeEntrante(LINEA_MAKO, llega(DUENO, textoParaMandar(codigoDe(NUEVO))));
  if (sinNombre?.sumarAlGrupo) await sinNombre.sumarAlGrupo();
  out.sinNombre = pedidos.find((p) => p.ruta === 'group/create')?.subject ?? null;

  // ── 2. Regla 1: la línea de MaKo no le escribe primero a nadie ───────────
  arrancar(); pedidos = [];
  out.aDesconocido = { res: await g.enviarAPersonaMaKo(OTRO, 'Te dejo tus tareas de la reunión de hoy, ya están en tu plan.'), pedidos: [...pedidos] };
  pedidos = [];
  out.aQuienEscribio = { res: await g.enviarAPersonaMaKo(ESCRIBIO, 'Te dejo tus tareas de la reunión de hoy, ya están en tu plan.'), pedidos: [...pedidos] };
  pedidos = [];
  out.invitacionAutomatica = { res: await (async () => {
    db.app_settings.push({ workspace_id: PLATAFORMA, key: 'mako.grupos.automatico', value: 'si' }, { workspace_id: CLIENTE, key: 'mako.grupo_jid', value: 'grupo-cliente@g.us' });
    return g.enviarInvitacionGrupo(CLIENTE, OTRO);
  })(), pedidos: [...pedidos] };

  // ── 3. El mismo texto a muchos chats ────────────────────────────────────
  arrancar(); pedidos = [];
  const repetido = 'Recordatorio: mañana a las 10 tenemos la revisión del mes con todo el equipo.';
  const mismo: unknown[] = [];
  for (let i = 1; i <= 7; i++) mismo.push((await g.enviarAGrupoJid(`grupo-${i}@g.us`, repetido)).ok);
  out.mismoTexto = { resultados: mismo, salieron: pedidos.filter((p) => p.ruta === 'message/sendText').length };
  // Lo mismo por los avisos al grupo de cada negocio (`enviarAlGrupoMaKo`): el sexto no sale y queda marcado para que vaya por mail.
  const avisoIgual = 'Tu reporte de la semana ya está listo: entra a MaKo para verlo completo.';
  const porAviso: unknown[] = [];
  for (let w = 31; w <= 36; w++) {
    db.app_settings.push({ workspace_id: w, key: 'mako.grupo_jid', value: `grupo-negocio-${w}@g.us` });
    const r = await g.enviarAlGrupoMaKo(w, avisoIgual, null);
    porAviso.push(r.ok ? 'ok' : (r as { fallaElEnvio?: boolean }).fallaElEnvio ? 'por-mail' : 'no');
  }
  out.mismoAviso = porAviso;
  // Al mismo grupo otra vez no gasta, y un texto distinto sale.
  out.mismoGrupo = (await g.enviarAGrupoJid('grupo-1@g.us', repetido)).ok;
  out.otroTexto = (await g.enviarAGrupoJid('grupo-7@g.us', 'Otro aviso, con otras palabras, para el grupo siete.')).ok;

  // ── 4. El tope diario de altas de la línea ──────────────────────────────
  arrancar();
  const altas: boolean[] = [];
  for (let i = 0; i < 12; i++) {
    altas.push((await g.cupoAltaDeLinea(`54911400000${String(i).padStart(2, '0')}`)).ok);
    // Pasa la ventana de 10 minutos, no la del día.
    const haceRato = new Date(Date.now() - 11 * 60_000).toISOString();
    for (const f of db.app_settings) if (/linea-altas:/.test(String(f.key))) f.value = haceRato;
  }
  out.altasDelDia = altas;

  // ── 5. El freno de una línea ────────────────────────────────────────────
  arrancar(); pedidos = []; mails = [];
  modo[LINEA_CLIENTE] = 'rate';
  const r1 = await runWithWorkspace(CLIENTE, () => evo.enviarTexto(LEAD, 'Hola, ¿te quedó alguna duda de lo que hablamos?', LINEA_CLIENTE));
  const tras1 = pedidos.length;
  const r2 = await runWithWorkspace(CLIENTE, () => evo.enviarTexto(LEAD, 'Hola de nuevo', LINEA_CLIENTE));
  out.frenoCliente = {
    r1, r2, pedidosTras1: tras1, pedidosTras2: pedidos.length, mails: mails.map((m) => ({ to: m.to, subject: m.subject })),
    freno: db.app_settings.find((f) => f.workspace_id === PLATAFORMA && f.key === `linea.freno.${LINEA_CLIENTE}`)?.value ?? null,
  };
  // Otra línea sigue andando.
  pedidos = [];
  out.otraLineaAnda = (await g.enviarAGrupoJid('grupo-x@g.us', 'Aviso para el grupo x, que sale por la línea de MaKo.')).ok;
  // Leer sigue andando con la línea frenada (no es una escritura).
  out.leerFrenada = await (await import('../lib/linea-freno')).antesDeEscribir(`/chat/findMessages/${LINEA_CLIENTE}`);
  // Un 403 al mandar por la línea de MaKo también frena, y avisa una vez.
  mails = [];
  modo[LINEA_MAKO] = '403';
  const m1 = await g.enviarAGrupoJid('grupo-y@g.us', 'Aviso para el grupo y, por la línea de MaKo.');
  const m2 = await g.enviarAGrupoJid('grupo-z@g.us', 'Aviso para el grupo z, por la línea de MaKo.');
  out.frenoMaKo = { m1: m1.ok, m2: m2.ok, mails: mails.length, freno: db.app_settings.find((f) => f.key === `linea.freno.${LINEA_MAKO}`)?.value ?? null };
  // Que el freno vence a su hora lo prueba `frenoVigente` (tests/whatsapp-anti-ban.test.ts): acá el memo de 20 s lo taparía.

  process.stdout.write(`@@RESULTADO@@${JSON.stringify(out)}`);
}

main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
