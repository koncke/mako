// =============================================================================
// Hijo de tests/altas-en-grupos.test.ts — NO es un test (no termina en .test.ts)
// =============================================================================
// Corren REALES todos los caminos que crean grupos o suman gente, y `emitirAviso`, sobre un PostgREST de mentira y un Evolution en memoria que
// anota lo que se le pide. Lo que importa es qué le llegó a WhatsApp y qué salió por mail. Necesita `--conditions=react-server`.

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

const PLATAFORMA = 9, AGENCIA = 13, CLIENTE = 17, OTRO_CLIENTE = 23, SIN_GRUPO = 25;
const JOAN = '5492230000684';
const ENTRA = '5491130000111';       // WhatsApp deja agregarlo.
const NO_DEJA = '5491130000222';     // WhatsApp no deja agregarlo, y nunca le escribió a la línea.
const ESCRIBIO = '5491130000333';    // WhatsApp no deja agregarlo, pero le escribió a la línea.
const SOLO_SALIO = '5491130000444';  // WhatsApp no deja agregarlo, y sólo le escribió MaKo a él.
const LECTURA_ROTA = '5491130000555';// WhatsApp no deja agregarlo, y no se puede leer si escribió.
const OTRO = '5491130000666', TERCERO = '5491130000777';

const pg = crearPostgrest({
  tablas: ['app_settings', 'workspaces', 'agencia_clientes', 'usuarios', 'agencias', 'notificaciones'],
  unicos: [{ tabla: 'app_settings', columnas: ['workspace_id', 'key'], donde: () => true, nombre: 'app_settings_uk' }],
});
const db = pg.db as Record<string, Array<Record<string, unknown>>>;
const negocio = (id: number, nombre: string, capa = 'completo') => ({ id, nombre, capa, estado: 'activo' });
db.workspaces = [negocio(PLATAFORMA, 'MaKo', 'superadmin'), negocio(AGENCIA, 'Agencia Uno', 'agencia'), negocio(CLIENTE, 'Giselle'), negocio(OTRO_CLIENTE, 'Marcela'), negocio(SIN_GRUPO, 'Nueva')];
db.agencia_clientes = [CLIENTE, OTRO_CLIENTE, SIN_GRUPO].map((cliente_ws) => ({ agencia_ws: AGENCIA, cliente_ws, estado: 'aprobado' }));
db.usuarios = [{ workspace_id: AGENCIA, rol_ws: 'admin', estado: 'activo', nombre: 'x', email: 'x@x.test', perfil: { telefono: OTRO } }];
const arrancar = (extra: Array<{ workspace_id: number; key: string; value: string }> = []) => {
  db.app_settings = [
    { workspace_id: AGENCIA, key: 'mako.numero_dueno', value: JOAN },
    { workspace_id: CLIENTE, key: 'mako.grupo_jid', value: 'grupo-cliente@g.us' },
    { workspace_id: CLIENTE, key: 'notif_emails', value: JSON.stringify(['equipo@cliente.test']) },
    { workspace_id: OTRO_CLIENTE, key: 'mako.grupo_jid', value: 'grupo-otro@g.us' },
    { workspace_id: 1, key: 'mako.voz.instancia', value: 'mako_ws9' },
    ...extra,
  ];
};

let pedidos: string[] = [];
let mails: Array<{ to: unknown; subject: string }> = [];
let lecturaRota: string | null = null;
let grupoRoto = false;
globalThis.fetch = (async (entrada: RequestInfo | URL, init: RequestInit = {}) => {
  const u = new URL(typeof entrada === 'string' ? entrada : entrada instanceof URL ? entrada.href : (entrada as Request).url);
  const json = (status: number, b: unknown) => new Response(JSON.stringify(b), { status, headers: { 'content-type': 'application/json' } });
  if (u.host === 'supa.test') {
    if (lecturaRota && u.pathname.endsWith('/app_settings') && (u.search.includes(lecturaRota) || String(init.body ?? '').includes(lecturaRota))) return json(500, { message: 'base caída' });
    return pg.responder(u, init);
  }
  if (u.host === 'api.resend.com') { mails.push(JSON.parse(String(init.body))); return json(200, { id: 'mail-1' }); }
  if (u.host !== 'evo.test') throw new Error(`fetch sin mock: ${u.href}`);
  const body = typeof init.body === 'string' ? JSON.parse(init.body) as Record<string, unknown> : null;
  if (u.pathname.startsWith('/chat/whatsappNumbers')) return json(200, [{ exists: true, jid: `${String((body?.numbers as string[])[0])}@s.whatsapp.net` }]);
  if (u.pathname.startsWith('/group/participants')) return json(200, { participants: [] });
  if (u.pathname.startsWith('/group/inviteCode')) return json(200, { inviteUrl: 'https://chat.whatsapp.com/LINK' });
  // La línea de MaKo, conectada: de acá sale el número del link `wa.me` de la verificación (lee la base de Evolution, no le habla a WhatsApp).
  if (u.pathname.startsWith('/instance/fetchInstances')) return json(200, [{ name: 'mako_ws9', connectionStatus: 'open', ownerJid: '5493410000999@s.whatsapp.net' }]);
  if (u.pathname.startsWith('/chat/findMessages')) {
    const jid = String((body?.where as { key?: { remoteJid?: string } })?.key?.remoteJid ?? '');
    if (jid.startsWith(LECTURA_ROTA)) return json(500, { message: 'caído' });
    const records = jid.startsWith(ESCRIBIO) ? [{ key: { remoteJid: jid, fromMe: false } }]
      : jid.startsWith(SOLO_SALIO) ? [{ key: { remoteJid: jid, fromMe: true } }] : [];
    return json(200, { messages: { total: records.length, records } });
  }
  pedidos.push(u.pathname.split('/').slice(1, 3).join('/'));
  if (u.pathname.startsWith('/group/create')) return json(200, { id: 'nuevo@g.us' });
  if (u.pathname.startsWith('/group/updateParticipant')) {
    const quien = String((body?.participants as string[])[0]).split('@')[0];
    const noDeja = [NO_DEJA, ESCRIBIO, SOLO_SALIO, LECTURA_ROTA].includes(quien);
    return json(200, { updateParticipants: [{ status: noDeja ? '403' : '200', jid: `${quien}@s.whatsapp.net` }] });
  }
  if (u.pathname.startsWith('/message/sendText') && grupoRoto && String(body?.number).endsWith('@g.us')) return json(500, { response: { message: ['Error: Connection Closed'] } });
  return json(201, { key: { id: 'm1' } });
}) as typeof fetch;

async function main() {
  const g = await import('../lib/mako-grupo');
  const chat = await import('../lib/mako-chat');
  const { setDestinatarios } = await import('../lib/notif-destinatarios');
  const { runWithWorkspace } = await import('../lib/workspace');
  const { emitirAviso } = await import('../lib/avisos');
  const out: Record<string, unknown> = {};

  const medir = async (extra: Array<{ workspace_id: number; key: string; value: string }>, f: () => Promise<unknown>) => {
    arrancar(extra);
    pedidos = [];
    const res = await f();
    return { res, pedidos };
  };
  const FRENO = [{ workspace_id: PLATAFORMA, key: 'mako.grupos.altas', value: 'no' }];
  const AUTOMATICO = [{ workspace_id: PLATAFORMA, key: 'mako.grupos.automatico', value: 'si' }];

  const pedidoPorUnaPersona: Array<[string, () => Promise<unknown>]> = [
    ['grupoNuevo', () => g.asegurarGrupoMaKo(SIN_GRUPO, { nombre: 'Nueva', participantes: [JOAN] })],
    ['grupoSuelto', () => g.crearGrupoSuelto('Pruebas', [JOAN])],
    ['notificaciones', () => g.agregarParticipanteGrupo(CLIENTE, ENTRA)],
    ['duenoSinGrupo', () => g.setNumeroDuenoYSync(SIN_GRUPO, JOAN, 'Nueva')],
    ['duenoConGrupo', () => g.setNumeroDuenoYSync(CLIENTE, ENTRA, 'Giselle')],
    ['detalleDelGrupo', () => chat.agregarParticipantesMaKo('grupo-cliente@g.us', [ENTRA])],
  ];

  // Sin ningún setting.
  const porDefecto: Record<string, unknown> = {};
  for (const [nombre, f] of pedidoPorUnaPersona) porDefecto[nombre] = await medir([], f);
  out.porDefecto = porDefecto;

  // Lo automático, apagado por defecto.
  out.equipoApagado = await medir([], () => g.sumarEquipoDeAgenciaAlGrupo(CLIENTE, 'grupo-cliente@g.us', { adentro: [], cliente: 'Giselle' }));
  out.comandoApagado = await medir([], () => g.aplicarEquipoDeAgencia(CLIENTE));
  out.grupoNuevoSinEquipo = await medir([], () => g.asegurarGrupoMaKo(SIN_GRUPO, { nombre: 'Nueva', participantes: [JOAN] }));
  out.nuncaEscribio = await medir([], () => g.agregarParticipanteGrupo(CLIENTE, NO_DEJA));
  out.escribio = await medir([], () => g.agregarParticipanteGrupo(CLIENTE, ESCRIBIO));
  out.soloSalio = await medir([], () => g.agregarParticipanteGrupo(CLIENTE, SOLO_SALIO));
  out.lecturaRota = await medir([], () => g.agregarParticipanteGrupo(CLIENTE, LECTURA_ROTA));
  // El mismo camino del 3/11: la pantalla de Notificaciones recibe el link.
  arrancar();
  pedidos = [];
  out.pantalla = {
    res: await runWithWorkspace(CLIENTE, () => setDestinatarios({ telefonos: [JOAN, NO_DEJA], emails: [] }, 'Giselle')),
    pedidos,
  };

  // Lo automático, prendido.
  out.equipoPrendido = await medir(AUTOMATICO, () => g.sumarEquipoDeAgenciaAlGrupo(CLIENTE, 'grupo-cliente@g.us', { adentro: [], cliente: 'Giselle' }));
  out.invitacionPrendida = await medir(AUTOMATICO, () => g.agregarParticipanteGrupo(CLIENTE, NO_DEJA));
  lecturaRota = 'mako.grupos.automatico';
  out.automaticoSinLeer = await medir(AUTOMATICO, () => g.sumarEquipoDeAgenciaAlGrupo(CLIENTE, 'grupo-cliente@g.us', { adentro: [], cliente: 'Giselle' }));
  lecturaRota = null;
  out.automaticoDeOtroNegocio = await medir([{ workspace_id: CLIENTE, key: 'mako.grupos.automatico', value: 'si' }], () => runWithWorkspace(CLIENTE, () => g.sumarEquipoDeAgenciaAlGrupo(CLIENTE, 'grupo-cliente@g.us', { adentro: [] })));

  // El freno de emergencia.
  const frenado: Record<string, unknown> = {};
  for (const [nombre, f] of [
    ...pedidoPorUnaPersona,
    ['invitar', () => g.enviarInvitacionGrupo(CLIENTE, ESCRIBIO)] as [string, () => Promise<unknown>],
    ['equipo', () => g.sumarEquipoDeAgenciaAlGrupo(CLIENTE, 'grupo-cliente@g.us', { adentro: [] })] as [string, () => Promise<unknown>],
  ]) frenado[nombre] = await medir([...FRENO, ...AUTOMATICO], f);
  out.frenado = frenado;
  arrancar(FRENO);
  await g.setNumeroDuenoYSync(SIN_GRUPO, JOAN, 'Nueva');
  out.numeroGuardadoFrenado = db.app_settings.find((f) => f.workspace_id === SIN_GRUPO && f.key === 'mako.numero_dueno')?.value ?? null;
  arrancar([...FRENO, { workspace_id: SIN_GRUPO, key: 'mako.contacto.verificacion', value: JSON.stringify({ telefono: JOAN, destino: JOAN, codigo: '123456', expira: Date.now() + 60_000, verificado: false, nombre: 'Nueva' }) }]);
  out.verificarFrenado = await g.verificarCodigoContacto(SIN_GRUPO, '123456');
  // Sólo `no` frena: sin poder leerlo, u otro valor, o en otro negocio, anda.
  lecturaRota = 'mako.grupos.altas';
  out.frenoSinLeer = await medir(FRENO, () => g.agregarParticipanteGrupo(CLIENTE, ENTRA));
  lecturaRota = null;
  out.frenoOtroValor = await medir([{ workspace_id: PLATAFORMA, key: 'mako.grupos.altas', value: 'si' }], () => g.agregarParticipanteGrupo(CLIENTE, ENTRA));
  out.frenoDeOtroNegocio = await medir([{ workspace_id: CLIENTE, key: 'mako.grupos.altas', value: 'no' }], () => runWithWorkspace(CLIENTE, () => g.agregarParticipanteGrupo(CLIENTE, ENTRA)));

  // El tope por LÍNEA: 3 números en 3 minutos, de dos negocios, como el 3/11.
  arrancar();
  pedidos = [];
  const a1 = await g.agregarParticipanteGrupo(CLIENTE, ENTRA);
  const a2 = await g.agregarParticipanteGrupo(OTRO_CLIENTE, OTRO);
  const antes = pedidos.length;
  const a3 = await g.agregarParticipanteGrupo(OTRO_CLIENTE, TERCERO);
  out.tope = { a1, a2, a3, pedidosDelTercero: pedidos.slice(antes) };
  // El mismo número en otro grupo no gasta: es la mudanza a un número nuevo.
  pedidos = [];
  out.topeMismoNumero = { res: await g.agregarParticipanteGrupo(OTRO_CLIENTE, ENTRA), pedidos };
  // El grupo nuevo y el detalle también cuentan.
  out.topeGrupoNuevo = await g.asegurarGrupoMaKo(SIN_GRUPO, { nombre: 'Nueva', participantes: [TERCERO] });
  out.topeDetalle = await chat.agregarParticipantesMaKo('grupo-otro@g.us', [TERCERO]);
  // Otra línea tiene su propio cupo.
  out.topeOtraLinea = await g.cupoAltaDeLinea(TERCERO, 'mako_otra');
  // La verificación no gasta en la línea, y desde el 4/11/2026 no le escribe a nadie: devuelve el link para que la persona escriba.
  pedidos = [];
  out.topeCodigo = { res: await g.pedirMensajeDeVerificacion(SIN_GRUPO, TERCERO, 'Nueva'), pedidos };
  // Pasada la ventana, vuelve.
  const haceRato = new Date(Date.now() - 11 * 60_000).toISOString();
  for (const f of db.app_settings) if (String(f.key).includes('linea-altas')) f.value = haceRato;
  pedidos = [];
  out.topeDespues = { res: await g.agregarParticipanteGrupo(OTRO_CLIENTE, TERCERO), pedidos };
  // Sin poder contar, no sale.
  arrancar();
  pedidos = [];
  lecturaRota = 'linea-altas';
  out.topeSinContar = { res: await g.cupoAltaDeLinea(TERCERO), pedidos };
  lecturaRota = null;

  // El puente por mail.
  const SOLO_WA = { activo: true, wa: true, email: false } as Parameters<typeof emitirAviso>[0]['estado'];
  const aviso = (extra: Partial<Parameters<typeof emitirAviso>[0]> = {}) => emitirAviso({ tipo: 'prueba', titulo: 'Título', texto: 'Texto', ws: CLIENTE, push: false, estado: SOLO_WA, ...extra });
  const mailDe = async (roto: boolean, extra: Partial<Parameters<typeof emitirAviso>[0]> = {}) => {
    arrancar();
    mails = [];
    grupoRoto = roto;
    const r = await aviso(extra);
    grupoRoto = false;
    return { wa: r.wa, email: r.email ?? false, mails: mails.length, para: mails[0]?.to ?? null };
  };
  out.puenteFalla = await mailDe(true);
  out.puenteAnda = await mailDe(false);
  out.puenteSinGrupo = await mailDe(true, { ws: SIN_GRUPO });
  lecturaRota = 'mako.grupo_jid';
  out.puenteSinLeerElGrupo = await mailDe(false);
  lecturaRota = null;
  out.puenteYaPrendido = await mailDe(true, { estado: { activo: true, wa: true, email: true } as typeof SOLO_WA });
  out.puenteSoloMail = await mailDe(true, { estado: { activo: true, wa: false, email: true } as typeof SOLO_WA });

  process.stdout.write(`@@RESULTADO@@${JSON.stringify(out)}`);
}

main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
