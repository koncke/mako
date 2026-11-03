// =============================================================================
// Hijo de tests/agencia-grupos.test.ts — NO es un test (no termina en .test.ts)
// =============================================================================
// La agencia parada en la cuenta de un cliente, con el código REAL de la puerta: lib/workspace.ts, lib/agencia.ts, la cookie firmada
// de lib/auth-session.ts, /api/perfil/destinatarios, lib/notif-destinatarios.ts y lib/mako-grupo.ts. De mentira: la SESIÓN
// (lib/auth.ts), next/headers, la base (PostgREST) y Evolution, que anota lo que se le pide y contesta lo que WhatsApp contestaría.
// Necesita `--conditions=react-server` y `--experimental-test-module-mocks`.

import { mock } from 'node:test';
import { AsyncLocalStorage } from 'node:async_hooks';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { crearPostgrest } from './_postgrest-de-mentira';

const RAIZ = join(import.meta.dirname, '..');
process.env.SUPABASE_URL = 'http://supa.test';
process.env.NEXT_PUBLIC_SUPABASE_URL = 'http://supa.test';
process.env.SUPABASE_SERVICE_ROLE_KEY = 'clave-de-prueba';
process.env.SUPABASE_SERVICE_KEY = 'clave-de-prueba';
process.env.AUTH_SECRET = 'secreto-de-firma-de-prueba-suficientemente-largo';
process.env.EVOLUTION_BASE_URL = 'http://evo.test';
process.env.EVOLUTION_API_KEY = 'clave-evo';

const AGENCIA = 13, OTRA_AGENCIA = 14, CLIENTE = 19, CLIENTE_DE_OTRA = 21, REVOCADO = 3, PLATAFORMA = 9;
const JOAN = '5492230000684', CLIENTA = '5491130000190', AJENO = '5491130000999', PRIVADO = '5491130000403';
const jid = (ws: number) => `grupo-${ws}@g.us`;

type Pedido = { rol: 'admin' | 'usuario'; ws: number | null; rolWs: string | null; agencia?: string | null; pestana?: number | null };
const pedido = new AsyncLocalStorage<Pedido>();
const actual = (): Pedido => {
  const p = pedido.getStore();
  if (!p) throw new Error('fuera de un pedido');
  return p;
};

const pg = crearPostgrest({
  tablas: ['app_settings', 'workspaces', 'agencia_clientes', 'usuarios', 'agencias'],
  unicos: [{ tabla: 'app_settings', columnas: ['workspace_id', 'key'], donde: () => true, nombre: 'app_settings_uk' }],
});
const db = pg.db as Record<string, Array<Record<string, unknown>>>;
const negocio = (id: number, nombre: string, capa = 'completo') => ({ id, nombre, capa, estado: 'activo' });
db.workspaces = [negocio(PLATAFORMA, 'MaKo', 'superadmin'), negocio(AGENCIA, 'Agencia Uno', 'agencia'), negocio(OTRA_AGENCIA, 'Agencia Dos', 'agencia'), negocio(CLIENTE, 'Natalia'), negocio(CLIENTE_DE_OTRA, 'Cliente de Dos'), negocio(REVOCADO, 'Se Fue')];
db.agencias = [{ ws: AGENCIA }, { ws: OTRA_AGENCIA }];
db.agencia_clientes = [
  { agencia_ws: AGENCIA, cliente_ws: CLIENTE, estado: 'aprobado' },
  { agencia_ws: AGENCIA, cliente_ws: REVOCADO, estado: 'revocado' },
  { agencia_ws: OTRA_AGENCIA, cliente_ws: CLIENTE_DE_OTRA, estado: 'aprobado' },
];
const ajustes = (ws: number, t: string[], grupo = true) => [
  { workspace_id: ws, key: 'notif_telefonos', value: JSON.stringify(t) },
  { workspace_id: ws, key: 'mako.numero_dueno', value: t[0] ?? '' },
  ...(grupo ? [{ workspace_id: ws, key: 'mako.grupo_jid', value: jid(ws) }] : []),
];
db.app_settings = [...ajustes(CLIENTE, [CLIENTA]), ...ajustes(CLIENTE_DE_OTRA, ['5491130000210']), ...ajustes(REVOCADO, ['5491130000030']),
  // Este hijo prueba la puerta de la agencia, no lo automático (tests/altas-en-grupos.test.ts).
  { workspace_id: PLATAFORMA, key: 'mako.grupos.automatico', value: 'si' }];

type Llamada = { ruta: string; body: Record<string, unknown> | null };
let evolution: Llamada[] = [];
globalThis.fetch = (async (entrada: RequestInfo | URL, init: RequestInit = {}) => {
  const u = new URL(typeof entrada === 'string' ? entrada : entrada instanceof URL ? entrada.href : (entrada as Request).url);
  // Este hijo no prueba el tope de la línea (tests/altas-en-grupos.test.ts): cada paso arranca con el cupo entero.
  if (u.host === 'supa.test') db.app_settings = db.app_settings.filter((f) => !String(f.key).startsWith('mako.aviso.last.linea-altas'));
  if (u.host === 'supa.test') return pg.responder(u, init);
  if (u.host !== 'evo.test') throw new Error(`fetch sin mock: ${u.href}`);
  const body = typeof init.body === 'string' ? JSON.parse(init.body) as Record<string, unknown> : null;
  const json = (status: number, b: unknown) => new Response(JSON.stringify(b), { status, headers: { 'content-type': 'application/json' } });
  // whatsappNumbers es una CONSULTA: no toca a nadie, así que no se anota.
  if (u.pathname.startsWith('/chat/whatsappNumbers')) {
    const n = String((body?.numbers as string[])[0]);
    return json(200, [{ exists: true, jid: `${n}@s.whatsapp.net` }]);
  }
  evolution.push({ ruta: u.pathname + (u.search ? `${u.search}` : ''), body });
  if (u.pathname.startsWith('/group/updateParticipant')) {
    const quien = String((body?.participants as string[])[0]);
    return json(200, { updateParticipants: [{ status: quien.startsWith(PRIVADO) ? '403' : '200', jid: quien }] });
  }
  if (u.pathname.startsWith('/group/inviteCode')) return json(200, { inviteUrl: 'https://chat.whatsapp.com/LINKDEPRUEBA' });
  return json(200, { key: { id: 'm1' } });
}) as typeof fetch;

/** Todo lo que el módulo exporta, de mentira; arriba, lo que este arnés necesita. Un nombre que falta no carga el módulo. */
function stub(rel: string, propios: Record<string, unknown>): void {
  const src = readFileSync(join(RAIZ, rel), 'utf8');
  const nombres = [...src.matchAll(/^export (?:async )?(?:function\*? |const |let )(\w+)/gm)].map((m) => m[1]);
  const namedExports: Record<string, unknown> = {};
  for (const n of nombres) namedExports[n] = () => { throw new Error(`${rel}: ${n} sin mock`); };
  mock.module(pathToFileURL(join(RAIZ, rel)).href, { namedExports: { ...namedExports, ...propios } });
}

stub('lib/auth.ts', {
  getUsuarioActual: async () => {
    const p = actual();
    return { sub: 'u', email: 'quien@mira.test', nombre: 'Quien mira', rol: p.rol, ws: p.ws, rolWs: p.rolWs, exp: 0 };
  },
  getSesionAdmin: async () => (actual().rol === 'admin' ? { email: 'quien@mira.test' } : null),
});

async function main() {
  const { AGENCIA_COOKIE, firmarAgencia } = await import('../lib/auth-session');
  const { WS_HEADER } = await import('../lib/ws-tab');
  mock.module('next/headers', {
    namedExports: {
      cookies: async () => ({ get: (n: string) => (n === AGENCIA_COOKIE && actual().agencia ? { value: actual().agencia } : undefined) }),
      headers: async () => ({ get: (n: string) => (n === WS_HEADER && actual().pestana ? String(actual().pestana) : null) }),
    },
  });

  const { gruposDeAjustes } = await import('../lib/ajustes-negocio');
  const { GET, POST } = await import('../app/api/perfil/destinatarios/route');
  const { getWorkspaceActual, getRolWsEfectivo } = await import('../lib/workspace');

  const entrando = (cliente: number, extra: Partial<Pedido> = {}): Pedido => ({ rol: 'usuario', ws: AGENCIA, rolWs: 'admin', agencia: firmarAgencia(AGENCIA, cliente), ...extra });
  const guardar = async (p: Pedido, telefonos: string[]) => {
    evolution = [];
    const r = await pedido.run(p, () => POST(new Request('http://x.test/api/perfil/destinatarios', { method: 'POST', body: JSON.stringify({ telefonos, emails: [] }) }) as never));
    return { status: r.status, cuerpo: (await r.json()) as Record<string, unknown>, evolution };
  };
  const leerLista = (ws: number) => {
    const fila = db.app_settings.find((f) => f.workspace_id === ws && f.key === 'notif_telefonos');
    return JSON.parse(String(fila?.value ?? '[]')) as string[];
  };
  const indice = (p: Pedido, activa = 'info') => pedido.run(p, async () => (await gruposDeAjustes(undefined, activa)).map((g) => ({ titulo: g.titulo, keys: g.secciones.map((s) => s.key) })));
  const quien = (p: Pedido) => pedido.run(p, async () => ({ ws: await getWorkspaceActual(), rol: await getRolWsEfectivo() }));

  const out: Record<string, unknown> = {};
  // 1. El índice de Settings: lo primero que ve Joan al entrar a la cuenta de un cliente.
  out.indiceAgencia = await indice(entrando(CLIENTE));
  out.indiceCloserDeAgencia = await indice(entrando(CLIENTE, { rolWs: 'closer' }));
  out.indiceEnSuCuenta = await indice({ rol: 'usuario', ws: AGENCIA, rolWs: 'admin' });
  out.indiceSuperAdmin = await indice({ rol: 'admin', ws: PLATAFORMA, rolWs: null, pestana: CLIENTE });

  // 2. La puerta del servidor.
  out.quienAgencia = await quien(entrando(CLIENTE));
  out.getAgencia = await pedido.run(entrando(CLIENTE), async () => { const r = await GET(); return { status: r.status, cuerpo: await r.json() }; });
  out.getCloser = await pedido.run(entrando(CLIENTE, { rolWs: 'closer' }), async () => (await GET()).status);

  // 3. Agregarse: entra directo, y el cliente no pierde a nadie de su lista.
  out.alta = await guardar(entrando(CLIENTE), [CLIENTA, JOAN]);
  out.listaTrasAlta = leerLista(CLIENTE);

  // 4. WhatsApp no deja: se manda el link de verdad, y la pantalla recibe qué pasó y el link.
  out.privado = await guardar(entrando(CLIENTE), [CLIENTA, JOAN, PRIVADO]);

  // 5. AISLAMIENTO. La cookie la firmó la agencia uno para el cliente de la otra (la puerta de /api/agencia/entrar nunca la acuñaría,
  //    pero la cartera se revalida en CADA pedido): no abre nada, y el pedido cae en la cuenta PROPIA de la agencia.
  const antesOtra = leerLista(CLIENTE_DE_OTRA);
  out.quienCookieAjena = await quien(entrando(CLIENTE_DE_OTRA));
  out.ajena = await guardar(entrando(CLIENTE_DE_OTRA), [AJENO]);
  out.ajenaTocoAlDeLaOtra = JSON.stringify(leerLista(CLIENTE_DE_OTRA)) !== JSON.stringify(antesOtra);
  out.ajenaGrupos = (out.ajena as { evolution: Llamada[] }).evolution.filter((l) => l.ruta.includes(encodeURIComponent(jid(CLIENTE_DE_OTRA))));
  const antesRevocado = leerLista(REVOCADO);
  out.quienRevocado = await quien(entrando(REVOCADO));
  await guardar(entrando(REVOCADO), [AJENO]);
  out.revocadoTocado = JSON.stringify(leerLista(REVOCADO)) !== JSON.stringify(antesRevocado);
  // 6. LA PESTAÑA VIEJA: la lista se leyó del cliente y la cookie de 8 horas ya no está: el pedido cae en la cuenta de la agencia.
  db.app_settings.push(...ajustes(AGENCIA, [JOAN]));
  const antesAgencia = leerLista(AGENCIA);
  evolution = [];
  const vieja = await pedido.run({ rol: 'usuario', ws: AGENCIA, rolWs: 'admin' }, () => POST(new Request('http://x.test/api/perfil/destinatarios', { method: 'POST', body: JSON.stringify({ telefonos: [CLIENTA], emails: [], ws: CLIENTE }) }) as never));
  out.pestanaVieja = { status: vieja.status, cuerpo: await vieja.json(), evolution };
  out.pestanaViejaPiso = JSON.stringify(leerLista(AGENCIA)) !== JSON.stringify(antesAgencia);
  // Y la cookie de una agencia en la sesión de OTRA: no es portable.
  out.quienCookieRobada = await quien({ rol: 'usuario', ws: OTRA_AGENCIA, rolWs: 'admin', agencia: firmarAgencia(AGENCIA, CLIENTE) });
  // El closer de la agencia, por la API: nunca escribe.
  out.closer = await guardar(entrando(CLIENTE, { rolWs: 'closer' }), [AJENO]);

  process.stdout.write(`@@RESULTADO@@${JSON.stringify(out)}`);
}

main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
