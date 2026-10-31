// =============================================================================
// Hijo de tests/plan-a-mano-recorrido.test.ts — NO es un test (no termina en .test.ts)
// =============================================================================
// Los 6 meses gratis sobre un PostgREST de mentira. Corren REALES `/api/admin/workspaces` (lo que dispara el diálogo),
// lib/plan-a-mano.ts, lib/prueba-uso.ts (los frenos que usa cada pantalla) y lib/settings.ts. Sólo la sesión, el workspace del
// pedido y el envío de mails van de mentira. Necesita `--conditions=react-server` y `--experimental-test-module-mocks`.

import { mock } from 'node:test';
import { AsyncLocalStorage } from 'node:async_hooks';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { crearPostgrest } from './_postgrest-de-mentira';

const RAIZ = join(import.meta.dirname, '..');
process.env.SUPABASE_URL = 'https://supa.test';
process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://supa.test';
process.env.SUPABASE_SERVICE_ROLE_KEY = 'clave-de-prueba';
process.env.SUPABASE_SERVICE_KEY = 'clave-de-prueba';

const DIA = 86_400_000;
const AHORA = Date.now();
const enDias = (d: number) => new Date(AHORA + d * DIA).toISOString();
const PLATAFORMA = 9;
const CLAVE = 'plan.a_mano';

const pg = crearPostgrest({ tablas: ['workspaces', 'app_settings', 'cobros', 'usuarios', 'landing_docs', 'webhook_routing'], orCompleto: true } as Parameters<typeof crearPostgrest>[0]);
const db = pg.db;
const negocio = (id: number, nombre: string) => ({ id, nombre, capa: 'agencia', estado: 'activo' });
db.workspaces = [
  negocio(PLATAFORMA, 'MaKo'),
  negocio(20, 'Gabi'), negocio(21, 'Ya paga'), negocio(23, 'Prueba de 30'), negocio(24, 'Prueba con su tarjeta'),
  negocio(30, 'Termina pronto'), negocio(31, 'Falta mucho'), negocio(32, 'Termina y paga'), negocio(33, 'Ya avisado'),
  negocio(34, 'Terminó'), negocio(35, 'Martín sin mail'), negocio(36, 'Sin dueño'), negocio(37, 'En seco'),
];
const cobroPagado = (alta_ws: number) => ({ id: alta_ws, workspace_id: PLATAFORMA, alta_ws, tipo: 'suscripcion', estado: 'pagado', suscripcion_estado: 'activa', creado_por: 'planes:pro', alta_capa: 'agencia', pagado_at: enDias(-3), monto: 97, moneda: 'USD', concepto: 'MaKo Pro · mensual', inicio_at: null });
db.cobros = [
  cobroPagado(21), cobroPagado(32),
  // Una prueba con su tarjeta, en curso: dar los 6 meses encima no frena el cobro del día 8.
  { ...cobroPagado(24), estado: 'pendiente', creado_por: 'planes:pro:prueba', pagado_at: null, inicio_at: enDias(5) },
];
db.usuarios = [];
const setting = (ws: number, key: string, v: unknown) => db.app_settings.push({ workspace_id: ws, key, value: typeof v === 'string' ? v : JSON.stringify(v) });
const regalo = (hasta: string, extra: Record<string, unknown> = {}) => ({ desde: enDias(-170), hasta, avisadoAt: null, regalo: true, ...extra });
const USO_LLENO = { 'prueba.videos': 99, 'prueba.tomas': 999, 'prueba.avatares': 99, 'prueba.imagenes': 999 };
setting(20, 'prueba.uso', USO_LLENO);
setting(23, 'prueba.uso', USO_LLENO);
setting(30, CLAVE, regalo(enDias(10)));
setting(31, CLAVE, regalo(enDias(100)));
setting(32, CLAVE, regalo(enDias(10)));
setting(33, CLAVE, regalo(enDias(10), { avisoPrevioAt: enDias(-4) }));
setting(34, CLAVE, regalo(enDias(-1)));
setting(36, CLAVE, regalo(enDias(10)));

globalThis.fetch = (async (entrada: RequestInfo | URL, init: RequestInit = {}) => {
  const u = new URL(typeof entrada === 'string' ? entrada : entrada instanceof URL ? entrada.href : entrada.url);
  if (u.host === 'supa.test') return pg.responder(u, init);
  throw new Error(`fetch sin mock: ${u.href}`);
}) as typeof fetch;

/** Todo lo que el módulo exporta, de mentira; arriba, lo que este arnés necesita. Un nombre que falta no carga el módulo. */
function stub(rel: string, propios: Record<string, unknown>): void {
  const src = readFileSync(join(RAIZ, rel), 'utf8');
  const nombres = [...src.matchAll(/^export (?:async )?(?:function\*? |const |let )(\w+)/gm)].map((m) => m[1]);
  const namedExports: Record<string, unknown> = {};
  for (const n of nombres) namedExports[n] = () => { throw new Error(`${rel}: ${n} sin mock`); };
  mock.module(pathToFileURL(join(RAIZ, rel)).href, { namedExports: { ...namedExports, ...propios } });
}

const pedido = new AsyncLocalStorage<number>();
const mails: Array<{ to: string; tag: string; asunto: string; cuerpo: string }> = [];
let sinMailAMartin = false;
stub('lib/invitaciones.ts', {
  avisarDePlataforma: async (m: { to: string; tag: string; asunto: string; cuerpo: string }) => {
    if (sinMailAMartin && m.to === 'equipo@hola-mako.com') return { enviado: false, error: 'el correo no salió' };
    mails.push(m);
    return { enviado: true };
  },
});
stub('lib/auth.ts', { getSesionAdmin: async () => ({ email: 'martin@ejemplo.com' }), getUsuarioActual: async () => null });
stub('lib/usuarios.ts', {
  emailDuenoWorkspace: async (ws: number) => (ws === 36 ? '' : `dueno${ws}@ejemplo.com`),
  listarUsuarios: async () => [],
});
stub('lib/workspace.ts', {
  runWithWorkspace: (ws: number, f: () => unknown) => pedido.run(ws, f),
  getWorkspaceActual: async () => pedido.getStore() ?? PLATAFORMA,
  wsObligatorio: async () => pedido.getStore() ?? PLATAFORMA,
  WS_NINGUNO: -1,
  wsSuperAdmin: async () => PLATAFORMA,
  getWorkspace: async (ws: number) => db.workspaces.find((w) => w.id === ws) ?? null,
  listarWorkspaces: async () => db.workspaces,
  getTenantDb: async () => { throw new Error('sin tenant'); },
});

async function main() {
  const { POST, GET } = await import('../app/api/admin/workspaces/route');
  const { avisarPlanesAManoVencidos, gratisHastaDe } = await import('../lib/plan-a-mano');
  const { frenoDePrueba, resumenDePrueba, sumarUsoDePrueba } = await import('../lib/prueba-uso');
  const { EMAIL_MAKO } = await import('../lib/app-url');
  const out: Record<string, unknown> = { EMAIL_MAKO };
  const postWs = async (b: Record<string, unknown>) => {
    const r = await POST(new Request('https://mako.test/api/admin/workspaces', { method: 'POST', body: JSON.stringify(b), headers: { 'content-type': 'application/json' } }) as never);
    return { status: r.status, body: await r.json() as Record<string, unknown> };
  };
  const TOPES = ['prueba.videos', 'prueba.tomas', 'prueba.avatares', 'prueba.imagenes', 'prueba.exportar', 'web.landings_publicadas'] as const;
  const frenos = async (ws: number) => Object.fromEntries(await Promise.all(TOPES.map(async (t) => [t, (await frenoDePrueba(ws, t, t === 'web.landings_publicadas' ? { usadas: 99 } : t === 'prueba.exportar' ? { usadas: 0 } : {})).ok])));

  // ── Lo que dispara el diálogo: «6 meses gratis» a quien ya gastó todo lo de la prueba ──
  out.darRegalo = await postWs({ action: 'plan_a_mano', id: 20, dias: 183 });
  out.frenosRegalo = await frenos(20);
  await sumarUsoDePrueba(20, 'prueba.videos');
  out.usoRegalo = JSON.parse(db.app_settings.find((f) => f.workspace_id === 20 && f.key === 'prueba.uso')!.value as string)['prueba.videos'];
  out.resumenRegalo = await resumenDePrueba(20);
  out.gratisHasta = await gratisHastaDe(20);
  // El control: la MISMA cuenta con 30 días sí frena. Sin esto, «todo pasa» no probaría nada.
  out.dar30 = await postWs({ action: 'plan_a_mano', id: 23, dias: 30 });
  out.frenos30 = await frenos(23);
  out.gratisHastaPrueba = await gratisHastaDe(23);
  // Vencidos sin resolver, vuelven los topes.
  setting(34, 'prueba.uso', USO_LLENO);
  out.frenosVencido = await frenos(34);

  // ── A quien ya paga, no ──
  out.aQuienPaga = await postWs({ action: 'plan_a_mano', id: 21, dias: 183 });
  out.aQuienPrueba = await postWs({ action: 'plan_a_mano', id: 24, dias: 183 });
  out.quedoSetting = db.app_settings.filter((f) => [21, 24].includes(f.workspace_id as number) && f.key === CLAVE).length;
  out.pruebaAQuienPaga = await postWs({ action: 'plan_a_mano', id: 21, dias: 7 });
  db.app_settings = db.app_settings.filter((f) => !(f.workspace_id === 21 && f.key === CLAVE));

  // ── La fecha a la vista ──
  const lista = await (await GET()).json() as { workspaces: Array<{ id: number; planAManoTxt: string | null }> };
  out.textos = Object.fromEntries(lista.workspaces.map((w) => [w.id, w.planAManoTxt]));

  // ── El cron ──
  const leer = (ws: number) => JSON.parse(db.app_settings.find((f) => f.workspace_id === ws && f.key === CLAVE)!.value as string);
  const quitar = (ws: number) => { db.app_settings = db.app_settings.filter((f) => !(f.workspace_id === ws && f.key === CLAVE)); };
  setting(37, CLAVE, regalo(enDias(3)));
  quitar(20); quitar(23);
  const ahora = AHORA;
  out.seco = await avisarPlanesAManoVencidos({ ahoraMs: ahora, enSeco: true });
  out.mailsEnSeco = mails.length;
  quitar(37);
  sinMailAMartin = true;
  setting(35, CLAVE, regalo(enDias(10)));
  out.vueltaSinMartin = await avisarPlanesAManoVencidos({ ahoraMs: ahora });
  out.marcas35SinMartin = leer(35).avisoPrevioAt ?? null;
  sinMailAMartin = false;
  mails.length = 0;
  db.app_settings.forEach((f) => {
    if (f.key !== CLAVE) return;
    const p = JSON.parse(f.value as string);
    delete p.avisoPrevioAt; delete p.avisadoAt;
    if (f.workspace_id === 33) p.avisoPrevioAt = enDias(-4);
    f.value = JSON.stringify(p);
  });
  out.vuelta = await avisarPlanesAManoVencidos({ ahoraMs: ahora });
  out.mails = mails.map((m) => ({ to: m.to, tag: m.tag, asunto: m.asunto, cuerpo: m.cuerpo }));
  out.marcas = Object.fromEntries([30, 31, 32, 33, 34, 35, 36].map((ws) => {
    const p = leer(ws);
    return [ws, { previo: !!p.avisoPrevioAt, vencido: !!p.avisadoAt, regalo: p.regalo === true }];
  }));
  mails.length = 0;
  out.segundaVuelta = await avisarPlanesAManoVencidos({ ahoraMs: ahora });
  out.mailsSegunda = mails.length;
  // Y al llegar la fecha, el del fin igual sale: el aviso previo no lo consume.
  mails.length = 0;
  // `estadoDePrueba` lee el reloj de verdad, no `ahoraMs`: se corre la fecha guardada, como si hubieran pasado los días.
  const fila30 = db.app_settings.find((f) => f.workspace_id === 30 && f.key === CLAVE)!;
  fila30.value = JSON.stringify({ ...JSON.parse(fila30.value as string), hasta: enDias(-1) });
  await avisarPlanesAManoVencidos({ ahoraMs: AHORA });
  out.alVencerAsuntos = mails.map((m) => m.asunto);

  console.log(`@@RESULTADO@@${JSON.stringify(out)}`);
}

main().then(() => process.exit(0), (e) => { console.error(e); process.exit(1); });
