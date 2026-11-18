// =============================================================================
// Hijo de tests/prueba-topes.test.ts y tests/planes-sin-pasarela.test.ts — NO es un test
// =============================================================================
// Dibuja sin navegador la pantalla ENTERA de «Tu plan» (app/configuraciones/plan/page.tsx → PlanPanel) y cuenta qué quedó
// dibujado y QUÉ ACCIÓN corre cada fila al tocarla. Existe porque las aserciones de fuente sobre esta pantalla no medían nada
// (ronda 3, 15/11/2026): clavaban el PREFIJO de la línea que decide (`const porLlamada = pro && enPrueba`) o el NOMBRE del
// envoltorio del `onClick`, así que la fila de Pro podía desaparecer en la prueba —o pasar a COBRAR en la pasarela— con el
// archivo en verde.
//
// Cómo: la página es un componente async, así que se la LLAMA y lo que devuelve (ya con sus `await` resueltos) se dibuja con
// `renderToStaticMarkup` (el molde es tests/_plan-tramos-hijo.ts). Sus bordes van de mentira con `mock.module`, igual que
// 'server-only': la base, la sesión, los planes y la cartera de agencias. Lo que NO es de mentira: la decisión de la página
// (`pro`, `subir`, `porLlamada`, `deAgencia`), el panel (`PlanPanel`), y el molde de Settings que dibuja cada fila
// (`FilaAjustes`: con `href` sale un `<a>`, con `onClick` un `<button>` — así se mide «¿va a algún lado o pide acá?»).
//
// Uso: node --experimental-test-module-mocks --import tsx tests/_plan-pedir-pro-hijo.ts
// Imprime UN JSON con una escena por caso. Nada de esto toca la red ni la base.
// =============================================================================

import { mock } from 'node:test';
import { pathToFileURL } from 'node:url';
import { join } from 'node:path';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { AppRouterContext } from 'next/dist/shared/lib/app-router-context.shared-runtime';

const url = (r: string) => pathToFileURL(join(__dirname, '..', r)).href;
const router = { refresh() {}, push() {}, replace() {}, back() {}, forward() {}, prefetch() {} };

/** Lo que la escena le hace creer a la pantalla. */
type Escena = {
  capa: string;
  /** La suscripción de MaKo del negocio, como la devuelve `suscripcionDeMakoDe` (null = plan a mano). */
  sus: Record<string, unknown> | null;
  /** `esClienteDeAgencia`: sí / no / no sé. */
  agencia: boolean | null;
  /** `pagaUnPlanDe` (si paga un plan de MaKo: el `rige` del nombre del plan). Sin decirlo, sí cuando hay suscripción. */
  rige?: boolean | null;
  /** `?empezar=1`: vino de un tope de la PRUEBA. */
  empezar?: boolean;
};

/** Una fila dibujada: lo que el molde de Settings recibió. */
type Fila = { titulo: string; detalle: string; como: 'link' | 'boton' | 'quieta'; href: string | null };

const PLANES = [
  { id: 'esencial', nombre: 'MaKo Essential', activo: true, capa: 'completo', precioUsd: 47, preciosLocales: {}, precioAnualUsd: null },
  { id: 'pro', nombre: 'MaKo Pro', activo: true, capa: 'agencia', precioUsd: 97, preciosLocales: {}, precioAnualUsd: 970 },
];
/** La prueba gratis que «Tu plan» reconoce (`esPruebaDePlan`: suscripción, con `alta_capa`, `creado_por` «planes:…:prueba»). */
const PRUEBA = {
  tipo: 'suscripcion', alta_capa: 'completo', proveedor: 'stripe', monto: 47, moneda: 'USD', estado: 'pendiente',
  creado_por: 'planes:esencial:prueba', suscripcion_estado: 'activa', motivo: null, inicio_at: '2026-11-22T00:00:00.000Z',
  concepto: 'MaKo Essential · mensual',
};
const PAGADA = { ...PRUEBA, estado: 'pagado', creado_por: 'planes:esencial', inicio_at: null };

const estado: Escena = { capa: 'completo', sus: PRUEBA, agencia: false };
/** Qué acción de servidor corrió (la fila la llama de verdad; acá sólo se anota el nombre). */
const corridas: string[] = [];
/** Cada fila que el molde de Settings dibujó, en el orden en que se dibujó. */
let filas: Array<Fila & { onClick?: () => void }> = [];

const texto = (v: unknown): string => (typeof v === 'string' ? v : v == null ? '' : String(v));
const accion = (nombre: string, r: Record<string, unknown>) => async () => { corridas.push(nombre); return r; };

async function main() {
  mock.module('server-only', { namedExports: {} });
  // ── LOS BORDES ────────────────────────────────────────────────────────────────────────────────────────────────────────
  mock.module(url('lib/tab-access.ts'), { namedExports: { requireRolWs: async () => ({ rol: 'admin' }) } });
  mock.module(url('lib/ajustes-negocio.ts'), { namedExports: { gruposDeAjustes: async () => [] } });
  mock.module(url('lib/workspace.ts'), { namedExports: {
    getWorkspaceActual: async () => 10, wsSuperAdmin: async () => 1, getCapaActual: async () => estado.capa,
    adminDeWorkspaceActual: async () => 10, estaImpersonando: async () => false, wsObligatorio: async () => 10,
    runWithWorkspace: (_ws: number | null, fn: () => unknown) => fn(), getWorkspace: async () => ({ id: 10, nombre: 'Casa Luna' }),
  } });
  mock.module(url('lib/cobros.ts'), { namedExports: {
    suscripcionDeMakoDe: async () => estado.sus, inicioDeLaPrueba: async () => estado.sus?.inicio_at ?? null,
  } });
  mock.module(url('lib/plan-a-mano.ts'), { namedExports: { gratisHastaDe: async () => null } });
  mock.module(url('lib/retencion-plan.ts'), { namedExports: { ofertaDeRetencion: async () => null, estadoDeRetencion: async () => null } });
  mock.module(url('lib/agencia.ts'), { namedExports: { esClienteDeAgencia: async () => estado.agencia } });
  mock.module(url('lib/plan-esencial.ts'), { namedExports: {
    pagaUnPlanDe: async () => { if (estado.rige === null) throw new Error('la base no contesta'); return estado.rige ?? estado.sus != null; },
  } });
  mock.module(url('lib/compra-plan.ts'), { namedExports: { planesMako: async () => PLANES } });
  // Las acciones de servidor: la fila las llama de verdad, y acá sólo queda anotado el nombre de la que corrió. Todas
  // contestan «no pude» para que ningún camino se vaya a `window.location` (no hay navegador).
  mock.module(url('app/configuraciones/plan/actions.ts'), { namedExports: {
    aceptarRetencionAction: accion('aceptarRetencionAction', { ok: false, resumen: 'de mentira' }),
    darmeDeBajaAction: accion('darmeDeBajaAction', { ok: false, resumen: 'de mentira' }),
    empezarPlanYaAction: accion('empezarPlanYaAction', { ok: false, resumen: 'de mentira' }),
    pasarAProAction: accion('pasarAProAction', { ok: false, resumen: 'de mentira' }),
    pedirProAction: accion('pedirProAction', { ok: false, resumen: 'de mentira' }),
  } });
  // ── EL MOLDE DE SETTINGS, EL DE VERDAD, CON UN APUNTE ─────────────────────────────────────────────────────────────────
  // Se importa ANTES de taparlo, así el reemplazo DELEGA en el real: el `<a>`/`<button>` del HTML sigue siendo el de la casa
  // y, además, queda a mano el `onClick` que la fila recibió (en un dibujo estático el handler no sale en el HTML).
  const Ajustes = await import('../app/_ui/Ajustes');
  mock.module(url('app/_ui/Ajustes.tsx'), { namedExports: {
    ...Ajustes,
    FilaAjustes: (p: Record<string, unknown>) => {
      filas.push({
        titulo: texto(p.titulo), detalle: texto(p.detalle), href: typeof p.href === 'string' ? p.href : null,
        como: p.href ? 'link' : p.onClick ? 'boton' : 'quieta', onClick: p.onClick as (() => void) | undefined,
      });
      return createElement(Ajustes.FilaAjustes, p as never);
    },
  } });

  const { default: PlanPage } = await import('../app/configuraciones/plan/page');

  /** Dibuja la pantalla con esta escena y devuelve lo que quedó dibujado. */
  const dibujar = async (e: Escena) => {
    Object.assign(estado, { empezar: false, rige: undefined }, e);
    filas = [];
    const pantalla = await PlanPage({ searchParams: Promise.resolve(estado.empezar ? { empezar: '1' } : {}) });
    const html = renderToStaticMarkup(createElement(AppRouterContext.Provider, { value: router as never }, pantalla));
    return {
      filas: filas.map(({ onClick: _o, ...f }) => f),
      /** CADA destino al que se puede ir desde la pantalla: así se ve si alguna fila volvió a ser un link. */
      enlaces: [...html.matchAll(/href="([^"]*)"/g)].map((m) => m[1]),
      botones: (html.match(/<button/g) ?? []).length,
      /** El nombre del plan, como lo lee el cliente (el título grande de «Tu plan»), sin la pastilla del estado. */
      plan: /<span class="aj-plan__nombre">([^<]*)/.exec(html)?.[1] ?? null,
    };
  };

  const salida: Record<string, unknown> = {};
  salida.enPrueba = await dibujar({ capa: 'completo', sus: PRUEBA, agencia: false });
  const filasEnPrueba = [...filas];
  salida.enPruebaDesdeElTope = await dibujar({ capa: 'completo', sus: PRUEBA, agencia: false, empezar: true });
  salida.pagando = await dibujar({ capa: 'completo', sus: PAGADA, agencia: false });
  salida.clienteDeAgencia = await dibujar({ capa: 'completo', sus: PRUEBA, agencia: true });
  salida.noSeSiEsDeAgencia = await dibujar({ capa: 'completo', sus: PRUEBA, agencia: null });
  salida.yaEsPro = await dibujar({ capa: 'agencia', sus: PRUEBA, agencia: false });

  // ── EL NOMBRE DEL PLAN (18/11/2026): el que se vende, nunca la capa (lib/plan-visible-reglas.ts) ──────────────────
  // Decía «Agencia» a quien paga MaKo Pro y «Completo» a quien paga Essential. Lo lee tests/plan-visible.test.ts.
  const nombre = async (e: Escena) => (await dibujar(e)).plan;
  const PAGA_PRO = { ...PAGADA, alta_capa: 'agencia', creado_por: 'planes:pro', monto: 97, concepto: 'MaKo Pro · mensual' };
  salida.nombres = {
    pruebaEssential: await nombre({ capa: 'completo', sus: PRUEBA, agencia: false }),
    pagaPro: await nombre({ capa: 'agencia', sus: PAGA_PRO, agencia: false }),
    deAgenciaConPlan: await nombre({ capa: 'completo', sus: null, agencia: true, rige: true }),
    deAgenciaSinPlan: await nombre({ capa: 'completo', sus: null, agencia: true, rige: false }),
    aMano: await nombre({ capa: 'agencia', sus: null, agencia: false, rige: false }),
    otraCapa: await nombre({ capa: 'pm', sus: null, agencia: false }),
    sinLeerRige: await nombre({ capa: 'agencia', sus: PRUEBA, agencia: false, rige: null }),
  };

  // ── QUÉ ACCIÓN CORRE CADA FILA DE LA ESCENA «en prueba» ───────────────────────────────────────────────────────────────
  // El handler es el del componente de verdad. Un dibujo estático no vuelve a dibujar (los `useState` no avanzan), así que
  // lo que se mide acá es QUÉ SE LLAMA, que es justo donde «pedir» podía convertirse en «cobrar» sin que nada se pusiera rojo.
  const tocar = async (titulo: string) => {
    corridas.length = 0;
    const f = filasEnPrueba.find((x) => x.titulo === titulo);
    if (!f) return { existe: false, corrio: [] as string[] };
    f.onClick?.();
    await new Promise((r) => setTimeout(r, 0));
    return { existe: true, corrio: [...corridas] };
  };
  salida.tocarPro = await tocar('Pasar a MaKo Pro');
  salida.tocarEmpezar = await tocar('Empezar mi plan ya');
  salida.tocarBaja = await tocar('Darme de baja');

  // ── ¿QUÉ ACCIÓN ESCONDE «DARME DE BAJA» (Y «EMPEZAR MI PLAN YA»)? ─────────────────────────────────────────────────────
  // La decisión sale a una función pura porque un dibujo estático no se vuelve a dibujar después del clic: acá se corre con el
  // aviso de CADA acción de la pantalla, y la lista entera es el conjunto que el test compara.
  const { sigueOfreciendoLaBaja, TOCAN_EL_COBRO } = await import('../app/configuraciones/plan/PlanPanel');
  const enPruebaVisible = { proveedor: 'stripe' as const, monto: 'US$ 47', cancelada: false, baja: null, prueba: { hasta: 'el domingo 22 de noviembre' }, primerMes: null };
  const porCadaAccion = (ok: boolean) => Object.fromEntries((Object.keys(TOCAN_EL_COBRO) as Array<keyof typeof TOCAN_EL_COBRO>)
    .map((de) => [de, sigueOfreciendoLaBaja(enPruebaVisible, { ok, texto: 'lo que diga', de })]));
  salida.laBajaDespuesDe = porCadaAccion(true);
  salida.laBajaConUnError = porCadaAccion(false);
  salida.laBajaSinAviso = {
    conSuscripcion: sigueOfreciendoLaBaja(enPruebaVisible, null),
    sinSuscripcion: sigueOfreciendoLaBaja(null, null),
    cancelada: sigueOfreciendoLaBaja({ ...enPruebaVisible, cancelada: true }, null),
    bajaYaPedida: sigueOfreciendoLaBaja({ ...enPruebaVisible, baja: 'Baja pedida el 1 de noviembre (código AB12).' }, null),
  };

  process.stdout.write(JSON.stringify(salida));
}

main().then(() => process.exit(0), (e) => { console.error(e); process.exit(1); });
