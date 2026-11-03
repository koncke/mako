// =============================================================================
// Hijo de tests/altas-en-grupos.test.ts — NO es un test (no termina en .test.ts)
// =============================================================================
// Corren REALES todos los caminos que crean grupos o suman gente, sobre un PostgREST de mentira y un Evolution en memoria que anota lo
// que se le pide. Lo que importa es qué le llegó a WhatsApp. Necesita `--conditions=react-server`.

import { crearPostgrest } from './_postgrest-de-mentira';

process.env.SUPABASE_URL = 'http://supa.test';
process.env.NEXT_PUBLIC_SUPABASE_URL = 'http://supa.test';
process.env.SUPABASE_SERVICE_ROLE_KEY = 'clave-de-prueba';
process.env.SUPABASE_SERVICE_KEY = 'clave-de-prueba';
process.env.AUTH_SECRET = 'secreto-de-firma-de-prueba-suficientemente-largo';
process.env.EVOLUTION_BASE_URL = 'http://evo.test';
process.env.EVOLUTION_API_KEY = 'clave-evo';

const PLATAFORMA = 9, AGENCIA = 13, CLIENTE = 17, SIN_GRUPO = 23;
const JOAN = '5492230000684', OTRO = '5491130000111';

const pg = crearPostgrest({
  tablas: ['app_settings', 'workspaces', 'agencia_clientes', 'usuarios', 'agencias'],
  unicos: [{ tabla: 'app_settings', columnas: ['workspace_id', 'key'], donde: () => true, nombre: 'app_settings_uk' }],
});
const db = pg.db as Record<string, Array<Record<string, unknown>>>;
const negocio = (id: number, nombre: string, capa = 'completo') => ({ id, nombre, capa, estado: 'activo' });
db.workspaces = [negocio(PLATAFORMA, 'MaKo', 'superadmin'), negocio(AGENCIA, 'Agencia Uno', 'agencia'), negocio(CLIENTE, 'Giselle'), negocio(SIN_GRUPO, 'Marcela')];
db.agencia_clientes = [{ agencia_ws: AGENCIA, cliente_ws: CLIENTE, estado: 'aprobado' }, { agencia_ws: AGENCIA, cliente_ws: SIN_GRUPO, estado: 'aprobado' }];
db.usuarios = [{ workspace_id: AGENCIA, rol_ws: 'admin', estado: 'activo', nombre: 'x', email: 'x@x.test', perfil: { telefono: OTRO } }];
const arrancar = () => {
  db.app_settings = [
    { workspace_id: AGENCIA, key: 'mako.numero_dueno', value: JOAN },
    { workspace_id: CLIENTE, key: 'mako.grupo_jid', value: 'grupo-cliente@g.us' },
    { workspace_id: 1, key: 'mako.voz.instancia', value: 'mako_superadmin_x' },
  ];
};

let pedidos: string[] = [];
let baseCaida = false;
globalThis.fetch = (async (entrada: RequestInfo | URL, init: RequestInit = {}) => {
  const u = new URL(typeof entrada === 'string' ? entrada : entrada instanceof URL ? entrada.href : (entrada as Request).url);
  const json = (status: number, b: unknown) => new Response(JSON.stringify(b), { status, headers: { 'content-type': 'application/json' } });
  if (u.host === 'supa.test') {
    if (baseCaida && u.pathname.endsWith('/app_settings') && u.search.includes('mako.grupos.altas')) return json(500, { message: 'base caída' });
    return pg.responder(u, init);
  }
  if (u.host !== 'evo.test') throw new Error(`fetch sin mock: ${u.href}`);
  const body = typeof init.body === 'string' ? JSON.parse(init.body) as Record<string, unknown> : null;
  if (u.pathname.startsWith('/chat/whatsappNumbers')) return json(200, [{ exists: true, jid: `${String((body?.numbers as string[])[0])}@s.whatsapp.net` }]);
  if (u.pathname.startsWith('/group/participants')) return json(200, { participants: [] });
  if (u.pathname.startsWith('/group/inviteCode')) return json(200, { inviteUrl: 'https://chat.whatsapp.com/LINK' });
  pedidos.push(u.pathname.split('/').slice(1, 3).join('/'));
  if (u.pathname.startsWith('/group/create')) return json(200, { id: 'nuevo@g.us' });
  if (u.pathname.startsWith('/group/updateParticipant')) {
    const quien = String((body?.participants as string[])[0]).split('@')[0];
    return json(200, { updateParticipants: [{ status: quien === OTRO ? '403' : '200', jid: `${quien}@s.whatsapp.net` }] });
  }
  return json(200, { key: { id: 'm1' } });
}) as typeof fetch;

async function main() {
  const g = await import('../lib/mako-grupo');
  const chat = await import('../lib/mako-chat');
  const { runWithWorkspace } = await import('../lib/workspace');
  const out: Record<string, unknown> = {};

  const caminos: Array<[string, () => Promise<unknown>]> = [
    ['crearGrupo', () => g.asegurarGrupoMaKo(SIN_GRUPO, { nombre: 'Marcela', participantes: [JOAN] })],
    ['grupoSuelto', () => g.crearGrupoSuelto('Pruebas', [JOAN])],
    ['agregar', () => g.agregarParticipanteGrupo(CLIENTE, OTRO)],
    ['invitar', () => g.enviarInvitacionGrupo(CLIENTE, OTRO)],
    ['equipoDeLaAgencia', () => g.sumarEquipoDeAgenciaAlGrupo(CLIENTE, 'grupo-cliente@g.us', { adentro: [], cliente: 'Giselle' })],
    ['aplicarEquipo', () => g.aplicarEquipoDeAgencia(CLIENTE)],
    ['dueñoSinGrupo', () => g.setNumeroDuenoYSync(SIN_GRUPO, JOAN, 'Marcela')],
    ['dueñoConGrupo', () => g.setNumeroDuenoYSync(CLIENTE, OTRO, 'Giselle')],
    ['agregarDesdeElDetalle', () => chat.agregarParticipantesMaKo('grupo-cliente@g.us', [OTRO])],
  ];
  const correr = async () => {
    const r: Record<string, unknown> = {};
    for (const [nombre, f] of caminos) {
      arrancar();
      pedidos = [];
      const res = await f();
      r[nombre] = { res, pedidos };
    }
    return r;
  };

  out.apagado = await correr();
  arrancar();
  pedidos = [];
  await g.setNumeroDuenoYSync(SIN_GRUPO, JOAN, 'Marcela');
  out.numeroGuardadoApagado = db.app_settings.find((f) => f.workspace_id === SIN_GRUPO && f.key === 'mako.numero_dueno')?.value ?? null;

  // El código correcto deja verificado aunque el grupo no se cree: si no, un cliente nuevo se traba en el onboarding.
  arrancar();
  db.app_settings.push({ workspace_id: SIN_GRUPO, key: 'mako.contacto.verificacion', value: JSON.stringify({ telefono: JOAN, destino: JOAN, codigo: '123456', expira: Date.now() + 60_000, verificado: false, nombre: 'Marcela' }) });
  pedidos = [];
  out.verificarApagado = await g.verificarCodigoContacto(SIN_GRUPO, '123456');
  out.verificarPedidos = pedidos;

  // Sin poder leer el interruptor, apagado.
  baseCaida = true;
  arrancar();
  db.app_settings.push({ workspace_id: PLATAFORMA, key: 'mako.grupos.altas', value: 'si' });
  pedidos = [];
  out.baseCaida = { res: await g.agregarParticipanteGrupo(CLIENTE, OTRO), pedidos };
  baseCaida = false;

  // Otro valor no lo prende, y en el workspace de otro negocio tampoco.
  arrancar();
  db.app_settings.push({ workspace_id: PLATAFORMA, key: 'mako.grupos.altas', value: 'true' });
  pedidos = [];
  await g.agregarParticipanteGrupo(CLIENTE, OTRO);
  out.otroValor = pedidos;
  arrancar();
  db.app_settings.push({ workspace_id: CLIENTE, key: 'mako.grupos.altas', value: 'si' });
  pedidos = [];
  await runWithWorkspace(CLIENTE, () => g.agregarParticipanteGrupo(CLIENTE, OTRO));
  out.otroNegocio = pedidos;

  // Prendido: la puerta no es un callejón sin salida.
  const correrPrendido = async () => {
    const r: Record<string, unknown> = {};
    for (const [nombre, f] of caminos) {
      arrancar();
      db.app_settings.push({ workspace_id: PLATAFORMA, key: 'mako.grupos.altas', value: 'si' });
      pedidos = [];
      await f();
      r[nombre] = pedidos;
    }
    return r;
  };
  out.prendido = await correrPrendido();

  process.stdout.write(`@@RESULTADO@@${JSON.stringify(out)}`);
}

main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
