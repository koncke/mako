// =============================================================================
// Hijo de tests/agencia-grupos-auto.test.ts — NO es un test (no termina en .test.ts)
// =============================================================================
// Corren REALES `asegurarGrupoMaKo`, `planEquipoDeAgencia`, `aplicarEquipoDeAgencia` y la lectura de la cartera, sobre un PostgREST de
// mentira y un Evolution en memoria. Mira lo único que importa: a quién se agregó a qué grupo y qué se dijo en él.
// Necesita `--conditions=react-server`.

import { crearPostgrest } from './_postgrest-de-mentira';

process.env.SUPABASE_URL = 'http://supa.test';
process.env.NEXT_PUBLIC_SUPABASE_URL = 'http://supa.test';
process.env.SUPABASE_SERVICE_ROLE_KEY = 'clave-de-prueba';
process.env.SUPABASE_SERVICE_KEY = 'clave-de-prueba';
process.env.AUTH_SECRET = 'secreto-de-firma-de-prueba-suficientemente-largo';
process.env.EVOLUTION_BASE_URL = 'http://evo.test';
process.env.EVOLUTION_API_KEY = 'clave-evo';

const PLATAFORMA = 9, AGENCIA = 13, OTRA = 14, SIN_TEL = 16, CLIENTE = 19, DIRECTO = 30, PENDIENTE = 31, REVOCADO = 32, DE_DOS = 33, PRIVADO_WS = 34, EXISTENTE = 35, DE_SIN_TEL = 36, CARTERA_CAIDA = 37, MUCHOS_WS = 38, SIN_LECTURA = 39, AGENCIA_GRANDE = 17;
const DUENO_AGENCIA = '5492230000684', ADMIN_PERFIL = '5491130000111', CLOSER = '5491130000222', SETTER = '5491130000333', SUSPENDIDO = '5491130000444', DUENO_OTRA = '5491130000555', PRIVADO = '5491130000403', CLIENTA = '5491130000190';

const pg = crearPostgrest({
  tablas: ['app_settings', 'workspaces', 'agencia_clientes', 'usuarios', 'agencias'],
  unicos: [{ tabla: 'app_settings', columnas: ['workspace_id', 'key'], donde: () => true, nombre: 'app_settings_uk' }],
});
const db = pg.db as Record<string, Array<Record<string, unknown>>>;
const negocio = (id: number, nombre: string, capa = 'completo') => ({ id, nombre, capa, estado: 'activo' });
db.workspaces = [
  negocio(PLATAFORMA, 'MaKo', 'superadmin'), negocio(AGENCIA, 'Agencia Uno', 'agencia'), negocio(OTRA, 'Agencia Dos', 'agencia'), negocio(SIN_TEL, 'Agencia Muda', 'agencia'), negocio(AGENCIA_GRANDE, 'Agencia Grande', 'agencia'),
  negocio(CLIENTE, 'Natalia'), negocio(DIRECTO, 'Directo'), negocio(PENDIENTE, 'Sin Firmar'), negocio(REVOCADO, 'Se Fue'), negocio(DE_DOS, 'De Dos'), negocio(PRIVADO_WS, 'Con Privado'), negocio(EXISTENTE, 'Ya Tiene Grupo'), negocio(DE_SIN_TEL, 'De La Muda'), negocio(CARTERA_CAIDA, 'Cartera Caída'), negocio(MUCHOS_WS, 'De La Grande'), negocio(SIN_LECTURA, 'Sin Lectura'),
];
const fila = (agencia_ws: number, cliente_ws: number, estado = 'aprobado') => ({ agencia_ws, cliente_ws, estado });
db.agencia_clientes = [fila(AGENCIA, CLIENTE), fila(AGENCIA, PENDIENTE, 'pendiente'), fila(AGENCIA, REVOCADO, 'revocado'), fila(AGENCIA, DE_DOS), fila(OTRA, DE_DOS), fila(AGENCIA, EXISTENTE), fila(SIN_TEL, DE_SIN_TEL), fila(AGENCIA_GRANDE, MUCHOS_WS), fila(AGENCIA, SIN_LECTURA)];
const usuario = (workspace_id: number, rol_ws: string | null, telefono: string, estado = 'activo') => ({ workspace_id, rol_ws, estado, nombre: 'x', email: `${workspace_id}-${telefono}@x.test`, perfil: { telefono } });
db.usuarios = [
  // El de producción: admin y con el perfil VACÍO; su número vive en `mako.numero_dueno`.
  usuario(AGENCIA, 'admin', ''),
  // Otro admin, tipeado como se tipea, y su dueño tipeado distinto: no se invita dos veces.
  usuario(AGENCIA, null, '+54 9 11 3000-0111'),
  usuario(AGENCIA, 'admin', '+54 223 000 0684'),
  usuario(AGENCIA, 'closer', CLOSER),
  usuario(AGENCIA, 'setter', SETTER),
  usuario(AGENCIA, 'admin', SUSPENDIDO, 'suspendido'),
  usuario(OTRA, 'admin', ''),
  usuario(SIN_TEL, 'admin', ''),
  ...Array.from({ length: 7 }, (_, i) => usuario(AGENCIA_GRANDE, 'admin', `549113000070${i}`)),
  // El equipo del cliente no es de la agencia.
  usuario(CLIENTE, 'admin', CLIENTA),
];
db.app_settings = [
  // Este hijo prueba a quién se agrega, no lo automático (tests/altas-en-grupos.test.ts).
  { workspace_id: PLATAFORMA, key: 'mako.grupos.automatico', value: 'si' },
  { workspace_id: AGENCIA, key: 'mako.numero_dueno', value: DUENO_AGENCIA },
  { workspace_id: OTRA, key: 'mako.numero_dueno', value: DUENO_OTRA },
  { workspace_id: EXISTENTE, key: 'mako.grupo_jid', value: `grupo-${EXISTENTE}@g.us` },
  { workspace_id: SIN_LECTURA, key: 'mako.grupo_jid', value: `grupo-${SIN_LECTURA}@g.us` },
];

type Llamada = { ruta: string; body: Record<string, unknown> | null };
let evolution: Llamada[] = [];
let carteraCaida = false;
const enGrupo = new Map<string, string[]>([[`grupo-${EXISTENTE}@g.us`, [CLIENTA, ADMIN_PERFIL]]]);
let creados = 0;

globalThis.fetch = (async (entrada: RequestInfo | URL, init: RequestInit = {}) => {
  const u = new URL(typeof entrada === 'string' ? entrada : entrada instanceof URL ? entrada.href : (entrada as Request).url);
  // Este hijo no prueba el tope de la línea (tests/altas-en-grupos.test.ts): cada paso arranca con el cupo entero.
  if (u.host === 'supa.test') db.app_settings = db.app_settings.filter((f) => !String(f.key).startsWith('mako.aviso.last.linea-altas'));
  const json = (status: number, b: unknown) => new Response(JSON.stringify(b), { status, headers: { 'content-type': 'application/json' } });
  if (u.host === 'supa.test') {
    if (carteraCaida && u.pathname.endsWith('/agencia_clientes')) return json(500, { message: 'base caída' });
    return pg.responder(u, init);
  }
  if (u.host !== 'evo.test') throw new Error(`fetch sin mock: ${u.href}`);
  const body = typeof init.body === 'string' ? JSON.parse(init.body) as Record<string, unknown> : null;
  // Las dos CONSULTAS no le escriben a nadie: no se anotan en `evolution`.
  if (u.pathname.startsWith('/chat/whatsappNumbers')) return json(200, [{ exists: true, jid: `${String((body?.numbers as string[])[0])}@s.whatsapp.net` }]);
  if (u.pathname.startsWith('/group/participants')) {
    const jid = u.searchParams.get('groupJid') ?? '';
    if (jid === `grupo-${SIN_LECTURA}@g.us`) return json(500, { error: 'caído' });
    return json(200, { participants: (enGrupo.get(jid) ?? []).map((t, i) => ({ id: `${i}@lid`, phoneNumber: `${t}@s.whatsapp.net`, admin: null })) });
  }
  evolution.push({ ruta: u.pathname + u.search, body });
  if (u.pathname.startsWith('/group/create')) {
    creados++;
    const jid = `nuevo-${creados}@g.us`;
    enGrupo.set(jid, ((body?.participants as string[]) ?? []).slice());
    return json(200, { id: jid });
  }
  if (u.pathname.startsWith('/group/updateParticipant')) {
    const jid = u.searchParams.get('groupJid') ?? '';
    const quien = String((body?.participants as string[])[0]).split('@')[0];
    if (quien === PRIVADO) return json(200, { updateParticipants: [{ status: '403', jid: `${quien}@s.whatsapp.net` }] });
    enGrupo.set(jid, [...(enGrupo.get(jid) ?? []), quien]);
    return json(200, { updateParticipants: [{ status: '200', jid: `${quien}@s.whatsapp.net` }] });
  }
  if (u.pathname.startsWith('/group/inviteCode')) return json(200, { inviteUrl: 'https://chat.whatsapp.com/LINK' });
  return json(200, { key: { id: `m${evolution.length}` } });
}) as typeof fetch;

async function main() {
  const { asegurarGrupoMaKo, planEquipoDeAgencia, aplicarEquipoDeAgencia } = await import('../lib/mako-grupo');
  const dibujo = () => evolution.map((l) => {
    if (l.ruta.startsWith('/group/create')) return { paso: 'crear', quien: l.body?.participants };
    if (l.ruta.startsWith('/group/updateParticipant')) return { paso: 'agregar', quien: (l.body?.participants as string[])[0], grupo: decodeURIComponent(l.ruta.split('groupJid=')[1] ?? '') };
    if (l.ruta.startsWith('/group/sendInvite')) return { paso: 'invitar', quien: (l.body?.numbers as string[])[0], texto: l.body?.description };
    if (l.ruta.startsWith('/message/sendText')) return { paso: 'mensaje', a: l.body?.number, texto: l.body?.text };
    return { paso: 'otro', ruta: l.ruta.split('/')[2] };
  }).filter((x) => x.paso !== 'otro');
  const crear = async (ws: number, nombre: string, participantes = [CLIENTA]) => {
    evolution = [];
    const r = await asegurarGrupoMaKo(ws, { nombre, participantes });
    return { r, pasos: dibujo() };
  };

  const out: Record<string, unknown> = {};
  out.cliente = await crear(CLIENTE, 'Natalia');
  out.directo = await crear(DIRECTO, 'Directo');
  out.pendiente = await crear(PENDIENTE, 'Sin Firmar');
  out.revocado = await crear(REVOCADO, 'Se Fue');
  out.deDos = await crear(DE_DOS, 'De Dos');
  out.deMuda = await crear(DE_SIN_TEL, 'De La Muda');
  // El dueño del cliente es el mismo número del dueño de la agencia (una agencia probando): no se agrega dos veces.
  out.grande = await crear(MUCHOS_WS, 'De La Grande');
  carteraCaida = true;
  out.carteraCaida = await crear(CARTERA_CAIDA, 'Cartera Caída');
  carteraCaida = false;
  // La lista del cliente no se toca: el equipo entra al grupo y nada más.
  out.notifCliente = db.app_settings.filter((f) => f.workspace_id === CLIENTE && f.key === 'notif_telefonos');
  out.grupoCliente = db.app_settings.find((f) => f.workspace_id === CLIENTE && f.key === 'mako.grupo_jid')?.value;

  // Un grupo que YA EXISTE. El plan no escribe nada.
  const antes = JSON.stringify(db);
  evolution = [];
  out.plan = await planEquipoDeAgencia(EXISTENTE);
  out.planLlamadas = evolution.length;
  out.planNoEscribio = JSON.stringify(db) === antes;
  evolution = [];
  out.aplicar = await aplicarEquipoDeAgencia(EXISTENTE);
  out.aplicarPasos = dibujo();
  evolution = [];
  out.aplicarOtraVez = await aplicarEquipoDeAgencia(EXISTENTE);
  out.aplicarOtraVezPasos = dibujo();
  evolution = [];
  out.sinLectura = await aplicarEquipoDeAgencia(SIN_LECTURA);
  out.sinLecturaPasos = dibujo();
  evolution = [];
  out.sinGrupo = await aplicarEquipoDeAgencia(DE_SIN_TEL + 1000);
  out.sinGrupoPasos = dibujo();

  // WhatsApp no deja a uno de la agencia: sale la invitación con el texto de quien la recibe, y el grupo dice «invité», no «sumé».
  db.usuarios.push(usuario(OTRA, 'admin', PRIVADO));
  db.app_settings.find((f) => f.workspace_id === OTRA && f.key === 'mako.numero_dueno')!.value = '';
  db.agencia_clientes.push(fila(OTRA, PRIVADO_WS));
  out.privado = await crear(PRIVADO_WS, 'Con Privado');

  process.stdout.write(`@@RESULTADO@@${JSON.stringify(out)}`);
}

main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
