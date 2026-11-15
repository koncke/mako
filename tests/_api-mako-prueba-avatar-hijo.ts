// =============================================================================
// Hijo de tests/api-mako-prueba-avatar.test.ts — NO es un test (no termina en .test.ts)
// =============================================================================
// Corre REAL `resumenDePrueba` y `frenoDePrueba` (lib/prueba-uso.ts, con `server-only`) y REAL `esEsencialDe`
// (lib/plan-esencial.ts) sobre un PostgREST de mentira (tests/_postgrest-de-mentira.ts): nada de base ni de red. De mentira
// van sólo el workspace del pedido y la sesión, como en tests/_plan-a-mano-hijo.ts, de donde sale este molde.
// Necesita `--conditions=react-server` y `--experimental-test-module-mocks`.
//
// LO QUE SE MIDE: qué filas trae `usos` para cada clase de negocio en prueba. Es la lista que la API sirve en
// `ver_mi_prueba` y la que dibujan el cartel y la franja, o sea lo que el dueño LEE como «lo que incluye mi prueba».
//
// Y desde el 15/11/2026, el CANDADO DEL AVATAR en la API: corre de verdad `ver_avatares` y `ver_plantillas_avatar`
// (lib/api-mako/areas/video.run.ts, los RUNNERS reales) para un Esencial en prueba, un Esencial que ya paga, un Pro en prueba
// y el ws1 sin candado. Lo que se mide es la RESPUESTA, no el fuente: si la galería viaja, si viene `cerrado_por_su_plan` y si
// las plantillas contestan el texto de Pro.

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

const pg = crearPostgrest({ tablas: ['workspaces', 'app_settings', 'cobros', 'usuarios', 'landing_docs', 'agencia_clientes'], orCompleto: true } as Parameters<typeof crearPostgrest>[0]);
const db = pg.db;
const negocio = (id: number, nombre: string, capa: string) => ({ id, nombre, capa, estado: 'activo' });
// El ws1 es el de Mauricio (acuerdo a mano): `WS_SIN_PLAN_DE_PASARELA` lo deja fuera del candado aunque su capa sea `completo`.
db.workspaces = [
  negocio(PLATAFORMA, 'MaKo', 'superadmin'),
  negocio(1, 'Mauricio (ws1)', 'completo'),
  negocio(40, 'Esencial en prueba', 'completo'),
  negocio(41, 'Pro en prueba', 'agencia'),
  negocio(42, 'Subio a Pro en la prueba', 'agencia'),
  negocio(43, 'Esencial que ya paga', 'completo'),
];
/** La suscripción que `FILTRO_SUSCRIPCION_DE_MAKO` reconoce como PRUEBA autorizada y sin cobrar. */
const prueba = (alta_ws: number, capa: 'completo' | 'agencia') => ({
  id: 100 + alta_ws, workspace_id: PLATAFORMA, alta_ws, tipo: 'suscripcion', estado: 'pendiente',
  suscripcion_estado: 'autorizada', creado_por: capa === 'agencia' ? 'planes:pro:prueba' : 'planes:esencial:prueba',
  alta_capa: capa, pagado_at: null, inicio_at: enDias(5),
  monto: capa === 'agencia' ? 97 : 47, moneda: 'USD', concepto: `MaKo ${capa === 'agencia' ? 'Pro' : 'Esencial'} · mensual`,
});
db.cobros = [
  prueba(1, 'completo'), prueba(40, 'completo'), prueba(41, 'agencia'),
  // EL QUE SUBIÓ A PRO DURANTE SU PRUEBA: capa `agencia` hoy, `alta_capa` todavía `completo`. Es el caso que distingue
  // «la capa que tiene hoy» de «la que se le vendió»: con la vendida parecería un Esencial y se le escondería su tope.
  prueba(42, 'completo'),
  // El control fuera de la prueba: una suscripción PAGADA (ya no está en prueba, y los topes se van solos).
  { ...prueba(43, 'completo'), estado: 'pagado', pagado_at: enDias(-3), inicio_at: null },
];
db.usuarios = [];
const setting = (ws: number, key: string, v: unknown) => db.app_settings.push({ workspace_id: ws, key, value: typeof v === 'string' ? v : JSON.stringify(v) });
// Algo usado de cada cosa, para que `usado` no sea 0 en todas y un cero no pueda pasar por «no está».
for (const ws of [1, 40, 41, 42, 43]) setting(ws, 'prueba.uso', { 'prueba.videos': 1, 'prueba.tomas': 2, 'prueba.avatares': 0, 'prueba.imagenes': 3 });
// ⚠️ EL CASO REAL DEL ESENCIAL CON LOOKS: entre el 29/10 y el 14/11/2026 'ai-avatar' estuvo abierta en los tres planes, así que
// hay Esenciales con looks hechos y guardados (`KEY_LOOKS`, app/ai-avatar/looks.ts). Por eso el candado NO puede ser «no tenés
// nada»: lo que ya es suyo se le devuelve igual. Uno listo y uno que falló, para que `looks` no venga vacío en ningún plan.
const LOOKS = JSON.stringify([
  { id: 'lk1', plantillaId: 'oficina', fotoId: 'f1', trabajoId: null, mediaId: 'm1', url: 'https://x/1.png', error: '', detalle: 'con saco', creadoEn: '2026-11-02T10:00:00.000Z' },
  { id: 'lk2', plantillaId: 'auto', fotoId: 'f1', trabajoId: 7, mediaId: '', url: '', error: 'Flow se quedó sin créditos', detalle: '', creadoEn: '2026-11-03T10:00:00.000Z' },
]);
for (const ws of [1, 40, 41, 43]) setting(ws, 'ai-avatar.looks', LOOKS);

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
  // ⚠️ Y LAS CLASES QUE EXPORTA, COMO CLASES DE VERDAD (15/11/2026): otros módulos del grafo las importan sólo para un
  // `e instanceof X` de un catch (`MediaBuyerSinTabla` en lib/media-buyer/corrida.ts), y un nombre que falta rompe el LINK
  // del módulo que lo importa, aunque nadie lo llame. Una flecha tampoco sirve de lado derecho de un `instanceof`.
  for (const [, n] of src.matchAll(/^export class (\w+)/gm)) namedExports[n] = class extends Error {};
  mock.module(pathToFileURL(join(RAIZ, rel)).href, { namedExports: { ...namedExports, ...propios } });
}

const pedido = new AsyncLocalStorage<number>();
stub('lib/workspace.ts', {
  runWithWorkspace: (ws: number, f: () => unknown) => pedido.run(ws, f),
  getWorkspaceActual: async () => pedido.getStore() ?? PLATAFORMA,
  wsObligatorio: async () => pedido.getStore() ?? PLATAFORMA,
  WS_NINGUNO: -1,
  wsSuperAdmin: async () => PLATAFORMA,
  getWorkspace: async (ws: number) => db.workspaces.find((w) => w.id === ws) ?? null,
  listarWorkspaces: async () => db.workspaces,
  getTenantDb: async () => { throw new Error('sin tenant'); },
  // Sólo las usa `esEsencialDeLaSesion`, que acá no corre (por la API no hay sesión: se pregunta por el ws del pedido).
  getCapaActual: async () => { throw new Error('la sesión no se mira acá'); },
});

// ── LOS DOS BORDES QUE ESCRIBEN DEL `ejecutar` DE `hooks_al_video_media_buyer` (15/11/2026) ────────────────────────────────
// De mentira van la decisión del Media Buyer que se lee y el «llevar los hooks al Video Generator»: lo que se mide es el TEXTO
// QUE LE VUELVE AL NEGOCIO (el `resumen`), que es donde quedó viva la promesa de AI Avatar después de sacarla de la descripción.
// El candado (`esEsencialDe`) corre DE VERDAD, con el ws del pedido, igual que en los runners de video.
stub('lib/media-buyer/store.ts', {
  leerDecision: async (_ws: number, id: string) => ({
    id, tipo: 'variaciones_hook', entidadNombre: 'Video ganador',
    variaciones: [{ id: 'v1', elegida: true }, { id: 'v2', elegida: true }],
  }),
});
stub('lib/media-buyer/hooks-video.ts', { llevarHooksAlVideo: async () => ({ ok: true, cargados: 2, salteados: 0 }) });

async function main() {
  const { frenoDePrueba, resumenDePrueba } = await import('../lib/prueba-uso');
  const { esEsencialDe } = await import('../lib/plan-esencial');
  const out: Record<string, unknown> = {};
  /** Lo que el dueño LEE: qué topes le cuenta su prueba, en orden, con el número. */
  const topes = async (ws: number) => {
    const r = await resumenDePrueba(ws);
    return r.enPrueba ? { plan: r.plan, usos: r.usos.map((u) => `${u.tope} ${u.usado}/${u.de}`) } : { enPrueba: false as const };
  };
  for (const ws of [1, 40, 41, 42, 43]) out[`ws${ws}`] = await topes(ws);
  out.esEsencial = Object.fromEntries(await Promise.all([1, 40, 41, 42, 43].map(async (ws) => [ws, await esEsencialDe(ws)])));
  // EL TOPE NO SE TOCÓ: sigue siendo el techo de quien sí tiene la función (y su candado propio es el de /ai-avatar).
  out.frenoAvatar = Object.fromEntries(await Promise.all([40, 41].map(async (ws) => [ws, {
    primero: (await frenoDePrueba(ws, 'prueba.avatares', { usadas: 0 })).ok,
    segundo: (await frenoDePrueba(ws, 'prueba.avatares', { usadas: 1 })).ok,
  }])));

  // ── EL CANDADO DEL AVATAR, CORRIENDO (15/11/2026) ──────────────────────────────────────────────────────────────────────
  // Los RUNNERS reales, como los llama lib/api-mako/ejecutar.ts: adentro de `runWithWorkspace(ctx.ws)` y con el ctx del pedido.
  const { RUNNERS } = await import('../lib/api-mako/areas/video.run');
  const { runWithWorkspace } = await import('../lib/workspace');
  const ctxDe = (ws: number, alcance: 'lectura' | 'ejecutar' = 'lectura') => ({ ws, canal: 'whatsapp' as const, canalKey: `api:${ws}`, alcance, rol: 'admin' as const });
  /** Lo que la operación le CONTESTA al negocio: el json ya parseado, o el texto del error. */
  const correr = async (id: 'ver_avatares' | 'ver_plantillas_avatar', ws: number) => {
    const r = RUNNERS[id];
    if (!r || !('leer' in r)) throw new Error(`${id} no es una lectura`);
    const salida = await runWithWorkspace(ws, () => r.leer({}, ctxDe(ws)));
    if (typeof salida !== 'string') return { error: salida.content, esError: salida.isError === true };
    return { json: JSON.parse(salida) as Record<string, unknown> };
  };
  out.verAvatares = Object.fromEntries(await Promise.all([1, 40, 41, 43].map(async (ws) => {
    const r = await correr('ver_avatares', ws);
    return [ws, 'error' in r ? r : {
      // ⚠️ LAS CLAVES DE LA RESPUESTA ENTERA, ORDENADAS, Y NO «¿ESTÁ ESTA CLAVE?» (15/11/2026): mirar sólo si viene
      // `temas_de_la_galeria` medía EL NOMBRE DE LA CLAVE, no que la oferta no viaje — renombrándola a `temas_sugeridos` el
      // test quedaba verde con los 33 temas viajando a un Esencial (medido con estos mismos runners). Con el conjunto exacto,
      // cualquier clave nueva que se le agregue a la respuesta de un negocio con la función cerrada da rojo y se decide.
      claves: Object.keys(r.json).sort(),
      // Cuántos looks le llegan (lo que YA es suyo), cuántos temas (la OFERTA) y el texto del candado.
      looks: (r.json.looks as unknown[]).length,
      galeria: Array.isArray(r.json.temas_de_la_galeria) ? (r.json.temas_de_la_galeria as unknown[]).length : null,
      cerradoPorSuPlan: (r.json.cerrado_por_su_plan as string | undefined) ?? null,
      notas: r.json.notas as string[],
    }];
  })));
  out.verPlantillasAvatar = Object.fromEntries(await Promise.all([1, 40, 41, 43].map(async (ws) => {
    const r = await correr('ver_plantillas_avatar', ws);
    return [ws, 'error' in r ? r : { claves: Object.keys(r.json).sort(), plantillas: (r.json.plantillas as unknown[]).length }];
  })));

  // ── EL `resumen` DE `hooks_al_video_media_buyer`, CORRIDO (15/11/2026) ────────────────────────────────────────────────────
  // El `ejecutar` REAL de lib/api-mako/areas/ads.run.ts, como lo llama ejecutar.ts. Ahí la promesa de la ronda uno no se había
  // ido: se había MUDADO al texto que vuelve al negocio, igual para los dos planes. Se mide el texto, no el fuente.
  const { RUNNERS: ADS } = await import('../lib/api-mako/areas/ads.run');
  const hooks = ADS.hooks_al_video_media_buyer;
  if (!hooks || !('ejecutar' in hooks)) throw new Error('hooks_al_video_media_buyer dejó de ser una acción');
  out.hooksAlVideo = Object.fromEntries(await Promise.all([1, 40, 41, 43].map(async (ws) => {
    const e = await runWithWorkspace(ws, () => hooks.ejecutar({ decisionId: 'dec-1', variaciones: null }, ctxDe(ws, 'ejecutar')));
    return [ws, { ok: e.ok, resumen: e.resumen }];
  })));

  console.log(`@@RESULTADO@@${JSON.stringify(out)}`);
}

main().then(() => process.exit(0), (e) => { console.error(e); process.exit(1); });
