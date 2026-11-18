// =============================================================================
// Hijo de tests/general-periodo-de-la-hoja.test.ts — NO es un test (no termina en .test.ts)
// =============================================================================
// Dibuja un bloque «El mes» de verdad (app/dashboard/ElementoGeneral.tsx → `dibujarBloque`, app/general/ProveedorGeneral.tsx
// → app/general/MesDelPeriodo.tsx → app/general/bloques/Negocio.tsx) adentro de una hoja, con `renderToStaticMarkup`, y
// imprime el HTML de cada escena después de `@@RESULTADO@@`. Va en un node APARTE porque cambia `Module._load`: el
// `server-only` que traen los bloques (la cobranza importa sus server actions) se reemplaza por nada, y nada del server
// corre (no hay `fetch`: lo que se dibuja sale de lo que «trajo la página», `mesDelPeriodo`).
// =============================================================================

// eslint-disable-next-line @typescript-eslint/no-require-imports
const Modulo = require('node:module') as { _load: (pedido: string, padre: unknown, esMain: boolean) => unknown };
const cargarOriginal = Modulo._load;
Modulo._load = function (this: unknown, pedido: string, padre: unknown, esMain: boolean) {
  if (pedido === 'server-only') return {};
  return cargarOriginal.call(this, pedido, padre, esMain);
};

/* eslint-disable @typescript-eslint/no-require-imports */
const { createElement: h } = require('react') as typeof import('react');
const { renderToStaticMarkup } = require('react-dom/server') as typeof import('react-dom/server');
const { ProveedorGeneral } = require('../app/general/ProveedorGeneral') as typeof import('../app/general/ProveedorGeneral');
const { ElementoGeneral } = require('../app/dashboard/ElementoGeneral') as typeof import('../app/dashboard/ElementoGeneral');
const { hojaVacia, sanearElemento } = require('../lib/graficos-catalogo') as typeof import('../lib/graficos-catalogo');
/* eslint-enable @typescript-eslint/no-require-imports */
import type { DatosGeneral } from '../app/general/datos-tipos';
import type { MesDeGeneral } from '../app/general/mes-del-periodo';
import type { Elemento, Hoja, VistaValores } from '../lib/graficos-catalogo';

const HOY = '2026-11-18';
const fallo = { ok: false as const, error: 'No pude leer.' };
const resumen = (cash: number, etiqueta: string): MesDeGeneral => ({
  comparativo: {
    inversion_usd: { actual: 0, anterior: 0, proyeccion: 0 },
    agendas: { actual: 0, anterior: 0, proyeccion: 0 },
    cierres: { actual: 0, anterior: 0, proyeccion: 0 },
    cash_usd: { actual: cash, anterior: 100, proyeccion: 0 },
    etiqueta_anterior: etiqueta,
  },
  desgloses: {},
});

/** Los datos de General con el mes a la fecha (cobrado 111) y, si se da, «El mes» de un período ya leído (cobrado 777). */
function datos(mesDelPeriodo: DatosGeneral['mesDelPeriodo']): DatosGeneral {
  return {
    cabecera: fallo, okrs: fallo, kpis: fallo, semaforo: fallo, pendientes: fallo, plan: fallo, calendario: fallo,
    funnels: { ok: true, d: [] }, cobranza: fallo,
    mes: { ok: true, d: resumen(111, 'mismo período de octubre') },
    mesDelPeriodo,
  };
}

const elementoMes = (): Elemento => sanearElemento({ id: 'mes1', tipo: 'general', texto: '', general: { pieza: 'mes' }, x: 0, y: 0, w: 12, h: 5 })!;
const hojaCon = (controles: unknown[]): Hoja => hojaVacia('Prueba', { controles } as unknown as Partial<Hoja>);

const ULT30 = { desde: '2026-10-20', hasta: HOY };
/** Lo que dibujó el bloque, como DATOS (el título, lo de al lado, los números, si espera): el test compara eso. */
type Dibujo = { escena: string; titulo: string | null; extra: string | null; numeros: string[]; cargando: boolean };
function escena(nombre: string, d: DatosGeneral, hoja: Hoja | null, vista: VistaValores | null, hoy: string | undefined): Dibujo {
  const html = renderToStaticMarkup(h(ProveedorGeneral, {
    datos: d, variables: { saludo: '', nombre: '', negocio: '', fecha: '', trimestre: '' }, hoy,
    children: h(ElementoGeneral, { e: elementoMes(), hoja, vista }),
  }));
  const bloque = html.slice(html.indexOf('data-pieza="mes"'));
  const uno = (re: RegExp) => re.exec(bloque)?.[1] ?? null;
  return {
    escena: nombre,
    titulo: uno(/<h2 class="gb-tit">([^<]*)<\/h2>/),
    extra: uno(/<span class="gb-cab-extra">([^<]*)<\/span>/),
    numeros: [...bloque.matchAll(/<span class="gb-num"[^>]*>([^<]*)<\/span>/g)].map((m) => m[1]),
    cargando: bloque.includes('aria-busy'),
  };
}

const conPeriodo = hojaCon([{ id: 'p', tipo: 'periodo', preset: 'ult30' }]);
const sinPeriodo = hojaCon([]);
const salida = [
  // 1. La hoja en «Últimos 30 días» y la página trajo ese período: el bloque dibuja ESE período, no el mes a la fecha.
  escena('periodo', datos({ ...ULT30, mes: resumen(777, '20/09 – 19/10') }), conPeriodo, {}, HOY),
  // 2. La hoja sin control de período: el mes a la fecha de siempre, aunque la página traiga otro.
  escena('sin-periodo', datos({ ...ULT30, mes: resumen(777, '20/09 – 19/10') }), sinPeriodo, {}, HOY),
  // 3. La vista eligió otro período (todavía no leído): el bloque espera ese, no dibuja el que trajo la página.
  escena('vista-otra', datos({ ...ULT30, mes: resumen(777, '20/09 – 19/10') }), conPeriodo, { p: { preset: 'mes_pasado' } }, HOY),
  // 4. Sin el «hoy» del editor (el teléfono): ningún bloque sigue un período.
  escena('sin-hoy', datos({ ...ULT30, mes: resumen(777, '20/09 – 19/10') }), conPeriodo, {}, undefined),
];
process.stdout.write(`@@RESULTADO@@${JSON.stringify(salida)}\n`);
