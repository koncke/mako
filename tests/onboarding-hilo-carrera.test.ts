// =============================================================================
// El chat «Onboarding» sin carrera, sin copias a medias y para su dueño (20/10/2026)
// =============================================================================
// La revisión adversarial del Cerebro (20/10, tarde) midió sobre el módulo real y una base de mentira:
//   · «Entrar a MaKo» o un F5 mientras el POST armaba el chat → dos «Onboarding» y dos principales vacíos, o se entraba a
//     uno a medio copiar;
//   · un insert que fallaba a la mitad, `leerSesion` tragado o el estado releído tolerante → una copia incompleta que se
//     adoptaba para siempre (por el título);
//   · otro admin que entraba primero se llevaba el chat con la conversación de la dueña;
//   · un chat propio que se llamara «Onboarding» se adoptaba como el del onboarding.
// Este test corre lo mismo en un node aparte (`--experimental-test-module-mocks`, como tests/meta-lead-nuevo.test.ts):
// se reemplaza sólo lo que toca la base y la sesión. lib/onboarding-arranque-server.ts → hiloDelOnboarding.
//
// ROTURAS (20/10/2026, arnés romper.js + roturas-carrera.json del scratchpad; base 2/0): sin la reserva → 1/1 · la copia
// que falla queda suelta → 1/1 · lecturas tolerantes (sin tirar) → 1/1 · sin el dueño → 0/2 · por título y no por la
// marca → 1/1 · sin la regla del modo → 1/1.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { join } from 'node:path';
import { execFileSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';
import { decisionDelHilo, contextoDelHilo, RESERVA_HILO_MS } from '../lib/onboarding-arranque';

const RAIZ = join(import.meta.dirname, '..');
const url = (rel: string): string => JSON.stringify(pathToFileURL(join(RAIZ, rel)).href);

test('la decisión: listo, de otro, ocupado o crear', () => {
  const ahora = Date.parse('2026-10-20T21:00:00Z');
  const o = { ahora, unSoloAdmin: false };
  assert.equal(decisionDelHilo({ hiloChat: 7 }, 'u7', o), 'listo');
  assert.equal(decisionDelHilo({ dueno: 'u7' }, 'u8', o), 'otro', 'otro admin no se lleva el chat de la dueña');
  assert.equal(decisionDelHilo({}, 'u8', o), 'otro', 'sin dueño anotado y con dos admins, nadie');
  assert.equal(decisionDelHilo({}, 'u7', { ahora, unSoloAdmin: true }), 'crear', 'sin dueño anotado y con un admin, ése');
  assert.equal(decisionDelHilo({ dueno: 'u7', hiloCreando: { at: new Date(ahora - 5_000).toISOString(), por: 'u7' } }, 'u7', o), 'ocupado');
  assert.equal(decisionDelHilo({ dueno: 'u7', hiloCreando: { at: new Date(ahora - RESERVA_HILO_MS - 1).toISOString(), por: 'u7' } }, 'u7', o), 'crear', 'una reserva abandonada no traba para siempre');
  assert.match(contextoDelHilo(14), /\(onboarding:14\)\.$/);
});

const HIJO = `
import { mock } from 'node:test';
const dormir = (ms) => new Promise((r) => setTimeout(r, ms));
const db = { settings: new Map(), sesiones: [], chats: [], nextId: 100, persona: null, impersonando: false, capa: 'completo', admins: 1,
  falla: { leerSesion: false, insert: false }, lat: { setting: 10, list: 30, create: 30, insert: 40, sesion: 150 } };
const OFFER = Array.from({ length: 30 }, (_, i) => ({ id: 'm' + i, de: i % 2 ? 'yo' : 'mako', texto: 'mensaje ' + i + ' de lo que vende', at: '2026-10-18T22:00:00Z' }));
const SESION = { id: 14, titulo: 'Lo que vendes', estado: 'conversando', mensajes: OFFER,
  piezas: { entregables: { valor: 'Mentoría', fuente: 'chat', at: '' }, cliente: { valor: 'Tesistas', fuente: 'chat', at: '' }, precio: { valor: '6 cuotas', fuente: 'chat', at: '' } },
  docs: [], conclusion: null, versiones: 0, ofertaId: null, puedeConcluir: true, updatedAt: '', funnelId: 5, funnelNombre: 'Funnel', ofertaBase: null };
mock.module(${url('lib/settings.ts')}, { namedExports: {
  getSetting: async (k) => { await dormir(db.lat.setting); return db.settings.get(k) ?? null; },
  getSettingEstricto: async (k) => { await dormir(db.lat.setting); return db.settings.get(k) ?? null; },
  setSetting: async (k, v) => { await dormir(db.lat.setting); db.settings.set(k, v); },
  cambiarSettingSi: async (k, esperado, nuevo) => { await dormir(db.lat.setting); if ((db.settings.get(k) ?? null) !== esperado) return false; db.settings.set(k, nuevo); return true; },
} });
const tenant = { from: (t) => ({
  insert: async (filas) => { await dormir(db.lat.insert); if (db.falla.insert) return { error: { message: 'fetch failed' } }; for (const f of filas) db.chats.push(f); return { error: null }; },
  update: () => ({ eq: async () => ({ error: null }) }),
}) };
mock.module(${url('lib/workspace.ts')}, { namedExports: {
  estaImpersonando: async () => db.impersonando, getCapaActual: async () => db.capa, getTenantDb: async () => tenant,
  getWorkspace: async () => ({ id: 21, nombre: 'Consultora Argentina' }), getWorkspaceActual: async () => 21, actualizarWorkspace: async () => {},
} });
mock.module(${url('lib/auth.ts')}, { namedExports: { getSesionAdmin: async () => null, getUsuarioActual: async () => db.persona } });
mock.module(${url('lib/onboarding-guard.ts')}, { namedExports: { wsDelOnboarding: async () => ({ ws: 21 }) } });
mock.module(${url('lib/usuarios.ts')}, { namedExports: { contarAdminsClienteActivos: async () => db.admins } });
mock.module(${url('lib/perfil.ts')}, { namedExports: { getPerfil: async () => ({ nombre: 'Florencia' }), setPerfil: async () => {}, getContactoReportes: async () => null } });
mock.module(${url('lib/fase-store.ts')}, { namedExports: { getDiagnosticoFase: async () => ({ canal: 'llamadas', respuestas: [0, 0, 0, 0, 0, 0] }) } });
mock.module(${url('lib/onboarding-state.ts')}, { namedExports: { getEstadoOnboarding: async () => ({ version: 1, status: 'done', step: 'listo', steps: {} }), cerrarPasosOnboarding: async () => ({}) } });
mock.module(${url('lib/mako-grupo.ts')}, { namedExports: { getEstadoVerificacionContacto: async () => null } });
mock.module(${url('lib/credenciales.ts')}, { namedExports: { integracionConectada: async () => false } });
mock.module(${url('lib/offer-sesiones.ts')}, { namedExports: {
  leerSesion: async (id) => { await dormir(db.lat.sesion); if (db.falla.leerSesion) throw new Error('fetch failed'); return id === 14 ? SESION : null; },
  leerFila: async () => null, guardarComoOferta: async () => ({}),
} });
mock.module(${url('lib/chart-chats.ts')}, { namedExports: {
  listSessions: async (k, archivadas) => { await dormir(db.lat.list); return db.sesiones.filter((s) => s.chart_key === k && (archivadas || !s.archived)).map((s) => ({ ...s })); },
  createSession: async (k, titulo, contexto) => { await dormir(db.lat.create); const s = { id: db.nextId++, chart_key: k, titulo, contexto, pinned: false, archived: false, created_at: '', updated_at: '' }; db.sesiones.push(s); return { ...s }; },
  deleteSession: async (id) => { db.sesiones = db.sesiones.filter((s) => s.id !== id); db.chats = db.chats.filter((c) => c.session_id !== id); },
} });
mock.module(${url('lib/funnels.ts')}, { namedExports: { crearFunnel: async () => 1, getFunnelDefault: async () => ({}), idDelFunnelDefault: async () => 5, renombrarFunnel: async () => {}, saveFunnelDefault: async () => {} } });
mock.module(${url('lib/productos.ts')}, { namedExports: { listProductos: async () => [], upsertProducto: async () => ({}) } });
mock.module(${url('lib/onboarding.ts')}, { namedExports: { ANSWERS_KEY: 'mako.onboarding.answers', saveAnswers: async () => {} } });
mock.module(${url('lib/archivero.ts')}, { namedExports: { borrarBinario: async () => {}, insertFile: async () => ({}), listFiles: async () => [], mapaParaEscribir: async () => ({}), subirBinario: async () => ({}) } });
mock.module(${url('lib/archivero-registro.ts')}, { namedExports: { idDeContenido: () => 'x' } });
mock.module(${url('lib/lo-que-vendes-pdf.ts')}, { namedExports: { nombreArchivoLoQueVendes: () => 'x.pdf', pdfDeLoQueVendes: () => new Uint8Array() } });
mock.module(${url('lib/timezone.ts')}, { namedExports: { tzDeWorkspace: async () => 'America/Argentina/Buenos_Aires' } });
mock.module(${url('lib/reset-workspace.ts')}, { namedExports: { NOMBRE_WS_PRUEBA: 'Cliente de Prueba' } });
const srv = await import(${url('lib/onboarding-arranque-server.ts')});

const FLOR = { sub: '7', email: 'flor@x.com' };
const SOCIO = { sub: '8', email: 'socio@x.com' };
const ESTADO = { nombre: 'Florencia', negocio: 'Florencia Carballo', sesionId: 14, pdfOk: 'si', canal: 'llamadas', crmTipo: 'llamada',
  origen: 'Instagram', interes: 'ventas', telefono: 'verificado', telefonoNumero: '+54 9 11 5555 5555', dueno: 'mako-movil:u7' };
const reset = (e = ESTADO) => { db.settings = new Map([['onboarding.arranque', JSON.stringify(e)]]); db.sesiones = []; db.chats = [];
  db.nextId = 100; db.persona = FLOR; db.impersonando = false; db.capa = 'completo'; db.admins = 1; db.falla = { leerSesion: false, insert: false }; };
const marca = 'Este chat guarda el onboarding del negocio: lo que contó al empezar en MaKo (onboarding:14).';
const onb = () => db.sesiones.filter((s) => s.contexto === marca);
const vacios = () => db.sesiones.filter((s) => s.titulo === null).length;
const n = (id) => db.chats.filter((c) => c.session_id === id).length;
const estado = () => JSON.parse(db.settings.get('onboarding.arranque') ?? '{}');
const r = {};

reset();
r.control = await (async () => { const id = await srv.hiloDelOnboarding(); return { onb: onb().length, n: n(id), hiloChat: estado().hiloChat === id, hiloDe: estado().hiloDe, vacios: vacios() }; })();

reset();
r.carrera = await (async () => { const [a, b] = await Promise.all([srv.hiloDelOnboarding(), srv.hiloParaQuienYaTermino()]); return { onb: onb().length, vacios: vacios(), ids: [a, b] }; })();

reset();
r.desfase = await (async () => {
  const p1 = srv.hiloDelOnboarding(); await dormir(250);
  const id2 = await srv.hiloParaQuienYaTermino(); const enEseMomento = id2 ? n(id2) : -1;
  const id1 = await p1; return { id2, enEseMomento, total: n(id1), onb: onb().length };
})();

reset();
r.cortada = await (async () => {
  db.falla.insert = true; let tiro = false;
  try { await srv.hiloDelOnboarding(); } catch { tiro = true; }
  const despues = { onb: onb().length, hiloChat: estado().hiloChat ?? null, reserva: estado().hiloCreando ?? null };
  db.falla.insert = false; const id = await srv.hiloParaQuienYaTermino();
  return { tiro, despues, rehecho: id ? n(id) : 0, onbFinal: onb().length };
})();

reset();
r.caida = await (async () => {
  db.falla.leerSesion = true; let tiro = false;
  try { await srv.hiloDelOnboarding(); } catch { tiro = true; }
  return { tiro, onb: onb().length, sesiones: db.sesiones.length, hiloChat: estado().hiloChat ?? null };
})();

reset();
r.dosAdmins = await (async () => {
  db.persona = SOCIO; const socio = await srv.hiloParaQuienYaTermino();
  db.persona = FLOR; const flor = await srv.hiloParaQuienYaTermino();
  const chartKey = db.sesiones.find((s) => s.contexto === marca)?.chart_key ?? null;
  const sinDueno = { ...ESTADO }; delete sinDueno.dueno; reset(sinDueno); db.admins = 2;
  const nadie = await srv.hiloParaQuienYaTermino();
  return { socio, flor: !!flor, chartKey, nadie };
})();

reset();
r.propio = await (async () => {
  db.sesiones.push({ id: 50, chart_key: 'mako-movil:u7', titulo: 'Onboarding', contexto: null, pinned: false, archived: false, created_at: '', updated_at: '' });
  db.chats.push({ session_id: 50, role: 'user', content: '¿cómo armo el onboarding de mis alumnas?' });
  const id = await srv.hiloParaQuienYaTermino(); return { id, intacto: n(50) === 1 };
})();

reset();
r.plan = await (async () => { db.capa = 'pm'; return { id: await srv.hiloParaQuienYaTermino(), sesiones: db.sesiones.length }; })();

reset();
r.mirando = await (async () => { db.impersonando = true; return { id: await srv.hiloDelOnboarding(), sesiones: db.sesiones.length }; })();

console.log(JSON.stringify(r));
`;

function hijo(): Record<string, Record<string, unknown>> {
  const out = execFileSync(process.execPath, [
    '--conditions=react-server', '--experimental-test-module-mocks', '--no-warnings', '--import', 'tsx', '--input-type=module', '-e', HIJO,
  ], { cwd: RAIZ, encoding: 'utf8', maxBuffer: 16 * 1024 * 1024, stdio: ['ignore', 'pipe', 'pipe'] });
  const lineas = out.trim().split('\n');
  return JSON.parse(lineas[lineas.length - 1]!) as Record<string, Record<string, unknown>>;
}

test('con la base de mentira: un solo chat, nunca a medias, y para su dueño', () => {
  const r = hijo();
  // Una llamada sola: UN «Onboarding» con la conversación entera, anotado con su dueño.
  assert.equal(r.control.onb, 1);
  assert.ok((r.control.n as number) > 30, `copió ${r.control.n} mensajes`);
  assert.equal(r.control.hiloChat, true);
  assert.equal(r.control.hiloDe, 'mako-movil:u7');
  // El POST y el Ops Center a la vez: uno solo, y un solo principal vacío.
  assert.equal(r.carrera.onb, 1, `quedaron ${r.carrera.onb} «Onboarding»`);
  assert.ok((r.carrera.vacios as number) <= 1, `quedaron ${r.carrera.vacios} principales vacíos`);
  // El segundo llega mientras el primero copia: no entra a uno a medias.
  assert.ok(r.desfase.id2 == null || r.desfase.enEseMomento === r.desfase.total, `entró a ?chat=${r.desfase.id2} con ${r.desfase.enEseMomento} de ${r.desfase.total}`);
  assert.equal(r.desfase.onb, 1);
  // Una copia que falla no queda anotada ni suelta, y la próxima visita la rehace entera.
  assert.equal(r.cortada.tiro, true);
  assert.deepEqual(r.cortada.despues, { onb: 0, hiloChat: null, reserva: null });
  assert.ok((r.cortada.rehecho as number) > 30);
  assert.equal(r.cortada.onbFinal, 1);
  // Una lectura caída no escribe nada.
  assert.deepEqual(r.caida, { tiro: true, onb: 0, sesiones: 0, hiloChat: null });
  // Otro admin no se lleva el chat de la dueña; sin dueño anotado y con dos admins, nadie.
  assert.equal(r.dosAdmins.socio, null);
  assert.equal(r.dosAdmins.flor, true);
  assert.equal(r.dosAdmins.chartKey, 'mako-movil:u7');
  assert.equal(r.dosAdmins.nadie, null);
  // Un chat propio que se llama «Onboarding» no se adopta ni se toca.
  assert.notEqual(r.propio.id, 50);
  assert.equal(r.propio.intacto, true);
  // El Project Manager no recibe el chat (va a /plan), ni lo arma el super admin mirando.
  assert.deepEqual(r.plan, { id: null, sesiones: 0 });
  assert.deepEqual(r.mirando, { id: null, sesiones: 0 });
});
