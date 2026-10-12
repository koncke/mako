// Tests de la migración de los BLOQUES (v5, 12/10/2026; contrato docs/relevo/dashboard-v5.md, «Los bloques se
// van»): cada bloque de antes se convierte EN EL SANEO en gráficos y elementos del catálogo, adentro de su
// rectángulo, con ids `<idDelBloque>-<parte>`, conservando título, subtítulo y período (como control fijo).
// La lógica es lib/graficos-migrar-v5.ts (pura); la llama `sanearHoja` (lib/graficos-catalogo.ts).
// Correr: npx tsx --test tests/graficos-migrar-v5.test.ts
//
// ⚠️ El informe de abajo es la FORMA del único informe guardado (ws1, medido el 11/10: los mismos ids, bloques y
//    rectángulos, que son los de las plantillas), sin un dato de ningún cliente. El informe REAL se verificó
//    aparte, sólo leyendo y en memoria (scratchpad del paquete P1: p1v5-verificar-migracion.mts): 60 de 60
//    componentes que no son bloques siguen, los 17 bloques se reemplazan, determinístico e idempotente.
//
// Probado ROMPIÉNDOLO (12/10/2026, base 12 / 0; arnés del scratchpad del paquete P1, cada rotura restaurada DE
// MEMORIA y verificada por hash; los números, abajo de cada test que la caza).

import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  MAX_COMPONENTES, fuenteDe, sanearHoja, sanearTablero,
  type Componente, type ControlVista, type Elemento, type Grafico, type Hoja,
} from '../lib/graficos-catalogo';
import { ACCION_SINCRONIZAR_LLAMADAS, BLOQUES_MIGRADOS, PIEZA_COMPLETA, idDeParte, migrarBloquesV5 } from '../lib/graficos-migrar-v5';
import { PLANTILLAS_HOJA, instanciarPlantilla, tableroInicial } from '../lib/graficos-plantillas';

type Crudo = Record<string, unknown>;
const bloque = (id: string, b: string, x: number, y: number, w: number, h: number, extra: Crudo = {}): Crudo => ({ id, clase: 'bloque', bloque: b, x, y, w, h, ...extra });
const kpi = (id: string, fuente: string, metrica: string, x: number, y: number, extra: Crudo = {}): Crudo =>
  ({ id, clase: 'grafico', tipo: 'numero', fuente, metricas: [metrica], x, y, w: 3, h: 4, ...extra });

/** La forma del informe guardado de v4: las hojas de las plantillas con sus bloques y algo de lo que no es bloque. */
function informeV4(): Crudo {
  return {
    v: 3, nombre: 'Dashboard',
    hojas: [
      {
        id: 'comercial', nombre: 'Comercial', controles: [{ id: 'co-periodo', tipo: 'periodo', preset: 'ult30' }],
        componentes: [
          bloque('co-revenue', 'revenue', 0, 0, 12, 9),
          bloque('co-cobranza', 'cobranza', 0, 9, 12, 8),
          { id: 'co-tendencia', clase: 'grafico', tipo: 'serie', fuente: 'negocio', dimension: 'mes', metricas: ['vendido', 'cobrado'], titulo: 'Tendencia', periodo: 'ult12m', x: 0, y: 17, w: 12, h: 10 },
          bloque('co-funnel', 'funnel_maduro', 0, 27, 12, 12, { periodo: 'todo' }),
          bloque('co-scl', 'scl', 0, 39, 12, 8),
          bloque('co-cohortes-mes', 'cohortes_mes', 0, 47, 12, 10, { periodo: 'todo' }),
          bloque('co-cohortes-semana', 'cohortes_semana', 0, 57, 12, 10, { periodo: 'todo' }),
        ],
      },
      {
        id: 'ads-analyst', nombre: 'Ads Analyst', controles: [{ id: 'ad-periodo', tipo: 'periodo', preset: 'todo' }],
        componentes: [
          kpi('ad-sin-retorno', 'guiones', 'gasto', 9, 0, { controles: [{ id: 'ad-sin-retorno-c', tipo: 'lista', campo: 'guiones.resultado', valores: ['Sin agendas'] }] }),
          bloque('ad-patrones', 'patrones_guiones', 0, 4, 12, 14),
          bloque('ad-cuadrante', 'cuadrante_retencion', 0, 18, 12, 13),
        ],
      },
      {
        id: 'landing', nombre: 'Landing', controles: [],
        componentes: [
          bloque('la-mapa', 'mapa_calor', 0, 25, 12, 24),
          bloque('la-curva', 'curva_vsl', 0, 49, 8, 12),
          { id: 'la-video', clase: 'grafico', tipo: 'embudo_vertical', fuente: 'retencion_vsl', metricas: ['arrancaron', 'medidos'], x: 8, y: 49, w: 4, h: 12 },
        ],
      },
      {
        id: 'closing', nombre: 'Closing', controles: [{ id: 'cl-closer', tipo: 'lista', campo: 'closer' }],
        componentes: [
          kpi('cl-r1', 'llamadas_venta', 'puntaje', 3, 0, { w: 2, controles: [{ id: 'cl-r1-c', tipo: 'lista', campo: 'llamadas_venta.reunion', valores: ['R1'] }] }),
          bloque('cl-embudo', 'embudo_cierre', 0, 4, 6, 10),
          { id: 'cl-tendencia', clase: 'grafico', tipo: 'serie', fuente: 'llamadas_venta', dimension: 'mes', metricas: ['puntaje'], periodo: 'ult12m', x: 6, y: 4, w: 6, h: 10 },
          bloque('cl-factores', 'factores_cierre', 0, 14, 12, 14),
          bloque('cl-closers', 'closers_cierre', 0, 28, 12, 10),
          bloque('cl-llamadas', 'llamadas_cierre', 0, 48, 12, 18),
        ],
      },
      {
        id: 'productividad', nombre: 'Productividad', controles: [],
        componentes: [
          bloque('pr-matriz', 'matriz_proyectos', 0, 4, 7, 14),
          bloque('pr-piramide', 'piramide_prioridad', 7, 4, 5, 14),
          { id: 'pr-texto', clase: 'elemento', tipo: 'texto', texto: 'Lo que huele mal', x: 0, y: 34, w: 12, h: 2 },
          bloque('pr-atencion', 'tareas_atencion', 0, 36, 12, 12),
        ],
      },
    ],
  };
}

const hojasCrudas = () => (informeV4().hojas as Crudo[]);
const crudaDe = (id: string) => hojasCrudas().find((h) => h.id === id)!;
const migrada = (id: string) => migrarBloquesV5(crudaDe(id)).hoja.componentes as Crudo[];
const saneada = (id: string) => sanearHoja(crudaDe(id), 0)!;
const parte = (lista: readonly (Crudo | Componente)[], id: string) => lista.find((c) => c.id === id) as Crudo;
const pisan = (a: Crudo, b: Crudo) => (a.x as number) < (b.x as number) + (b.w as number) && (b.x as number) < (a.x as number) + (a.w as number)
  && (a.y as number) < (b.y as number) + (b.h as number) && (b.y as number) < (a.y as number) + (a.h as number);

/** Las piezas de cada bloque (la tabla «Los bloques se van» del contrato). */
const PIEZAS: Record<string, string[]> = {
  revenue: ['barra', 'vendido', 'cobrado', 'pendiente', 'mrr'],
  cobranza: ['seccion', 'tabla', 'cierre'],
  funnel_maduro: ['embudo', 'tasa', 'noshow', 'cierres'],
  scl: ['ciclo', 'p90', 'tramos'],
  cohortes_mes: ['tabla'], cohortes_semana: ['tabla'],
  matriz_proyectos: ['burbujas'], piramide_prioridad: ['barras', 'alta'], tareas_atencion: ['estancadas', 'alta', 'corridos'],
  patrones_guiones: ['ia'], cuadrante_retencion: ['dispersion'],
  mapa_calor: ['mapa'], curva_vsl: ['curva'],
  embudo_cierre: ['embudo'], factores_cierre: ['barras', 'ia'], closers_cierre: ['tabla'], llamadas_cierre: ['sync', 'tabla'],
};

// Rotura: `colocar` sin sumar el lugar del bloque (`x: x0, y: y0`) → 9 / 3 (éste, «una hoja llena…» y «el informe
// inicial…»). La receta de Revenue sin el MRR → 9 / 3 (éste, «Comercial y Ads» y «una hoja llena…»).
test('cada bloque se convierte en sus piezas: ids <bloque>-<parte>, adentro de su rectángulo y sin pisarse', () => {
  assert.deepEqual([...BLOQUES_MIGRADOS].sort(), Object.keys(PIEZAS).sort(), 'los 17 bloques de antes, todos con receta');
  let vistos = 0;
  for (const h of hojasCrudas()) {
    const out = migrarBloquesV5(h).hoja.componentes as Crudo[];
    assert.ok(!out.some((c) => c.clase === 'bloque'), `${String(h.id)}: no queda ningún bloque`);
    for (const b of (h.componentes as Crudo[]).filter((c) => c.clase === 'bloque')) {
      vistos++;
      const piezas = out.filter((c) => String(c.id).startsWith(`${String(b.id)}-`));
      assert.deepEqual(piezas.map((p) => p.id), PIEZAS[String(b.bloque)].map((p) => `${String(b.id)}-${p}`), String(b.bloque));
      for (const p of piezas) {
        assert.ok((p.x as number) >= (b.x as number) && (p.y as number) >= (b.y as number)
          && (p.x as number) + (p.w as number) <= (b.x as number) + (b.w as number) && (p.y as number) + (p.h as number) <= (b.y as number) + (b.h as number),
        `${String(p.id)} fuera del rectángulo de ${String(b.id)}`);
      }
      for (let i = 0; i < piezas.length; i++) for (let j = i + 1; j < piezas.length; j++) assert.ok(!pisan(piezas[i], piezas[j]), `${String(piezas[i].id)} pisa ${String(piezas[j].id)}`);
    }
  }
  assert.equal(vistos, 17);
});

// Rotura: la cobranza sin la sección que cierra el grupo → 10 / 2 (éste y «cada bloque…»). El cuadrante con `hook` en
// vez de `hook_rate` → 10 / 2 (éste y «con los conjuntos…»: el saneo la cambiaba en silencio).
test('Comercial y Ads: las piezas de la tabla del contrato', () => {
  const co = migrada('comercial');
  assert.deepEqual([parte(co, 'co-revenue-barra').tipo, parte(co, 'co-revenue-barra').fuente, parte(co, 'co-revenue-barra').metricas], ['barra_proporcion', 'revenue', ['cobrado', 'pendiente']]);
  assert.deepEqual(['vendido', 'cobrado', 'pendiente'].map((m) => (parte(co, `co-revenue-${m}`).metricas as string[])[0]), ['vendido', 'cobrado', 'pendiente']);
  assert.equal(parte(co, 'co-revenue-vendido').secundaria, 'cierres');
  assert.deepEqual([parte(co, 'co-revenue-mrr').fuente, parte(co, 'co-revenue-mrr').metricas, parte(co, 'co-revenue-mrr').ocultarSiCero], ['suscripciones', ['mrr'], true]);
  // «A quién cobrarle»: la sección plegada, la tabla, y una sección sin título que CIERRA el grupo (si no,
  // plegarla escondía todo lo de abajo de Comercial).
  assert.deepEqual([parte(co, 'co-cobranza-seccion').tipo, parte(co, 'co-cobranza-seccion').texto, parte(co, 'co-cobranza-seccion').seccion], ['seccion', 'A quién cobrarle', { fondo: null, plegable: true, abierto: false }]);
  const tabla = parte(co, 'co-cobranza-tabla');
  assert.deepEqual([tabla.tipo, tabla.fuente, tabla.dimension, tabla.metricas, tabla.ordenMetrica, tabla.ordenAsc, tabla.tabla],
    ['tabla', 'cobranza', 'cliente', ['vendido', 'cobrado_total', 'pendiente', 'proxima_monto', 'dias'], 'dias', true, { acciones: true, columnas: ['urgencia'] }]);
  assert.deepEqual([parte(co, 'co-cobranza-cierre').tipo, parte(co, 'co-cobranza-cierre').texto, (parte(co, 'co-cobranza-cierre').seccion as Crudo).plegable], ['seccion', '', false]);
  // La salud del funnel: el embudo y 3 KPI, TODOS sobre las cohortes maduras (un filtro de definición).
  assert.deepEqual([parte(co, 'co-funnel-embudo').tipo, parte(co, 'co-funnel-embudo').fecha, parte(co, 'co-funnel-embudo').metricas], ['embudo_vertical', 'agenda', ['agendas', 'asistencias', 'limpias', 'cierres']]);
  assert.deepEqual(['tasa', 'noshow', 'cierres'].map((p) => (parte(co, `co-funnel-${p}`).metricas as string[])[0]), ['tasa_cierre_calificadas', 'tasa_no_show', 'cierres']);
  for (const p of PIEZAS.funnel_maduro) {
    const fijo = (parte(co, `co-funnel-${p}`).controles as Crudo[]).find((k) => k.tipo === 'lista');
    assert.deepEqual([fijo?.campo, fijo?.valores, fijo?.fijo], ['leads.madurez_semana', ['Madura'], true], p);
  }
  // El SCL: el promedio (con su mínimo de 3 en el catálogo), el P90 y los cinco tramos.
  assert.deepEqual(['ciclo', 'p90'].map((p) => (parte(co, `co-scl-${p}`).metricas as string[])[0]), ['ciclo', 'p90_ciclo']);
  assert.deepEqual([parte(co, 'co-scl-tramos').tipo, parte(co, 'co-scl-tramos').metricas], ['tramos', ['tramo_1', 'tramo_2', 'tramo_3', 'tramo_4', 'tramo_5']]);
  // Las cohortes: la tabla del más nuevo al más viejo, sin vacías, con la madurez de columna.
  const mes = parte(co, 'co-cohortes-mes-tabla'), sem = parte(co, 'co-cohortes-semana-tabla');
  assert.deepEqual([mes.dimension, mes.limite, mes.tabla], ['mes', 6, { columnas: ['madurez_mes'], sinVacios: true, descendente: true }]);
  assert.deepEqual([sem.dimension, sem.limite, sem.tabla], ['semana', 8, { columnas: ['madurez_semana'], sinVacios: true, descendente: true }]);
  assert.deepEqual(mes.metricas, ['agendas', 'asistencias', 'tasa_no_show', 'limpias', 'cierres', 'tasa_cierre_calificadas', 'ciclo_cierre', 'vendido']);

  const ad = migrada('ads-analyst');
  const ia = parte(ad, 'ad-patrones-ia');
  assert.deepEqual([ia.clase, ia.tipo, (ia.ia as Crudo).vista, (ia.ia as Crudo).pedido], ['elemento', 'ia', 'hallazgos', 'Qué patrones separan a los guiones que agendan de los que no']);
  const disp = parte(ad, 'ad-cuadrante-dispersion');
  assert.deepEqual([disp.tipo, disp.fuente, disp.metricas, disp.colorPor, disp.ejes, disp.referencias, disp.alClic],
    ['dispersion', 'guiones', ['hook_rate', 'ret_cta'], 'angulo', { xMin: 0, xMax: 55, yMin: 0, yMax: 30 },
      { x: 28, y: 10, rotulos: ['Mejorar gancho', 'Escalar', 'Repensar', 'Reescribir cuerpo'] }, 'popup']);
  const ficha = ((disp.popup as Crudo).componentes as Crudo[])[0];
  assert.deepEqual([(disp.popup as Crudo).titulo, ficha.tipo, ficha.entidad], ['Anuncio', 'entidad', { tipo: 'anuncio', pieza: PIEZA_COMPLETA }]);
});

// Rotura: los factores con la caja de IA sin leer las barras (`fuentes: null`) → 11 / 1 (éste). La pirámide sin
// `objetivo: 18` → 11 / 1 (éste). La curva con `pasan` en vez de `siguen` → 10 / 2 (éste y «con los conjuntos…»).
test('Landing, Closing y Productividad: las piezas de la tabla del contrato', () => {
  const la = migrada('landing');
  assert.deepEqual([parte(la, 'la-mapa-mapa').tipo, parte(la, 'la-mapa-mapa').fuente], ['mapa_calor', 'toques']);
  assert.deepEqual([parte(la, 'la-curva-curva').tipo, parte(la, 'la-curva-curva').fuente, parte(la, 'la-curva-curva').dimension, parte(la, 'la-curva-curva').metricas], ['area', 'retencion_vsl', 'corte', ['siguen']]);

  const cl = migrada('closing');
  assert.deepEqual([parte(cl, 'cl-embudo-embudo').tipo, parte(cl, 'cl-embudo-embudo').metricas], ['embudo_vertical', ['r1', 'r2', 'ganadas_r2']]);
  assert.deepEqual([parte(cl, 'cl-factores-barras').fuente, parte(cl, 'cl-factores-barras').dimension, parte(cl, 'cl-factores-barras').desglose, parte(cl, 'cl-factores-barras').metricas], ['llamadas_dimensiones', 'dimension', 'tono', ['puntaje']]);
  const caja = parte(cl, 'cl-factores-ia').ia as Crudo;
  assert.deepEqual([caja.vista, caja.pedido, caja.fuentes], ['hallazgos', 'Qué decide los cierres', ['cl-factores-barras']]);
  assert.deepEqual([parte(cl, 'cl-closers-tabla').dimension, parte(cl, 'cl-closers-tabla').metricas], ['closer', ['llamadas', 'puntaje', 'ganadas', 'tasa_cierre']]);
  const ll = parte(cl, 'cl-llamadas-tabla');
  assert.deepEqual([ll.dimension, ll.metricas, ll.tabla, ll.alClic], ['llamada', ['puntaje', 'duracion'], { buscar: true, columnas: ['closer', 'reunion', 'dia'] }, 'popup']);
  assert.deepEqual(((ll.popup as Crudo).componentes as Crudo[])[0].entidad, { tipo: 'llamada', pieza: PIEZA_COMPLETA });
  assert.deepEqual((parte(cl, 'cl-llamadas-sync').accion as Crudo), { id: ACCION_SINCRONIZAR_LLAMADAS, rotulo: 'Sincronizar llamadas' });

  const pr = migrada('productividad');
  const burbujas = parte(pr, 'pr-matriz-burbujas');
  assert.deepEqual([burbujas.tipo, burbujas.fuente, burbujas.dimension, burbujas.metricas, burbujas.colorPor, burbujas.ejes, (burbujas.referencias as Crudo).x, (burbujas.referencias as Crudo).y],
    ['burbujas', 'proyectos', 'proyecto', ['esfuerzo', 'impacto', 'tareas'], 'cuadrante', { xMin: 0, xMax: 100, yMin: 0, yMax: 100 }, 50, 50]);
  assert.deepEqual([parte(pr, 'pr-piramide-barras').dimension, parte(pr, 'pr-piramide-barras').metricas], ['prioridad', ['activas']]);
  assert.deepEqual([(parte(pr, 'pr-piramide-alta').metricas as string[])[0], parte(pr, 'pr-piramide-alta').objetivo], ['pct_alta', 18]);
  const fijos = (id: string) => (parte(pr, id).controles as Crudo[]).map((k) => `${String(k.campo)}=${(k.valores as string[]).join()}${k.fijo ? '' : '(¡no fijo!)'}`);
  assert.deepEqual(fijos('pr-atencion-estancadas'), ['ejecucion.estancada=Sí']);
  assert.deepEqual(fijos('pr-atencion-alta'), ['ejecucion.prioridad=Alta', 'ejecucion.con_deadline=No', 'ejecucion.estado=Activa']);
  assert.deepEqual(fijos('pr-atencion-corridos'), ['ejecucion.deadline_corrido=Sí']);
  assert.deepEqual(['estancadas', 'alta', 'corridos'].map((p) => [(parte(pr, `pr-atencion-${p}`).metricas as string[])[0], parte(pr, `pr-atencion-${p}`).limite]),
    [['dias_quieta', 12], ['activas', 12], ['movidas_deadline', 6]]);
});

const periodoDe = (c: Componente | undefined): ControlVista | undefined => (c && c.clase === 'grafico' ? c.controles.find((k) => k.tipo === 'periodo') : undefined);

// Rotura: sin el período natural del SCL → 11 / 1 (éste). El control de período del bloque copiado sin cambiarle el
// id (tres piezas con el mismo) → 11 / 1 (éste). La matriz heredando el período → 11 / 1 (éste).
test('el período del bloque viaja como control FIJO; el que miraba sin pedirlo también; lo de «hoy» no lleva', () => {
  const co = saneada('comercial');
  for (const p of PIEZAS.funnel_maduro) {
    const k = periodoDe(co.componentes.find((c) => c.id === `co-funnel-${p}`));
    assert.deepEqual([k?.id, k?.preset, k?.fijo], [idDeParte(`co-funnel-${p}`, 'fecha'), 'todo', true], p);
  }
  for (const p of ['ciclo', 'p90', 'tramos']) assert.deepEqual([periodoDe(co.componentes.find((c) => c.id === `co-scl-${p}`))?.preset, periodoDe(co.componentes.find((c) => c.id === `co-scl-${p}`))?.fijo], ['todo', true], `el SCL leía todo el histórico: ${p}`);
  assert.equal(periodoDe(co.componentes.find((c) => c.id === 'co-revenue-barra')), undefined, 'Revenue sigue al período de la hoja');
  assert.equal(periodoDe(co.componentes.find((c) => c.id === 'co-cohortes-mes-tabla'))?.preset, 'todo');
  // Un bloque con período propio que no es el natural, y otro con un control de período para MIRAR.
  const h = sanearHoja({
    id: 'h', componentes: [
      bloque('rv', 'revenue', 0, 0, 12, 9, { periodo: 'personalizado', desde: '2026-09-01', hasta: '2026-09-30' }),
      bloque('mz', 'matriz_proyectos', 0, 9, 7, 14, { periodo: 'ult7' }),
      bloque('sc', 'scl', 0, 23, 12, 8, { controles: [{ id: 'mio', tipo: 'periodo', preset: 'ult90' }] }),
    ],
  }, 0)!;
  const rv = periodoDe(h.componentes.find((c) => c.id === 'rv-barra'))!;
  assert.deepEqual([rv.preset, rv.desde, rv.hasta, rv.fijo], ['personalizado', '2026-09-01', '2026-09-30', true]);
  assert.equal(periodoDe(h.componentes.find((c) => c.id === 'rv-mrr')), undefined, 'el MRR es la foto de hoy');
  assert.equal(periodoDe(h.componentes.find((c) => c.id === 'mz-burbujas')), undefined, 'el tablero de tareas es de hoy');
  const ids = ['ciclo', 'p90', 'tramos'].map((p) => periodoDe(h.componentes.find((c) => c.id === `sc-${p}`)));
  assert.deepEqual(ids.map((k) => [k?.id, k?.preset, k?.fijo]), ['ciclo', 'p90', 'tramos'].map((p) => [`sc-${p}-fecha`, 'ult90', undefined]), 'el control para mirar sigue siendo para mirar, uno por pieza');
  for (const c of h.componentes) if (c.clase === 'grafico') assert.equal(c.periodo, 'auto', c.id);
});

// Rotura: el título propio a todas las piezas (no sólo a la principal) → 11 / 1 (éste).
test('el título y el subtítulo propios del bloque van a su pieza principal', () => {
  const h = sanearHoja({
    id: 'h', componentes: [
      bloque('rv', 'revenue', 0, 0, 12, 9, { titulo: 'Plata', subtitulo: 'Del mes' }),
      bloque('cb', 'cobranza', 0, 9, 12, 8, { titulo: 'Cobrar', subtitulo: 'Lo pendiente' }),
      bloque('pt', 'patrones_guiones', 0, 17, 12, 14, { titulo: 'Qué funciona' }),
    ],
  }, 0)!;
  const c = (id: string) => h.componentes.find((x) => x.id === id) as unknown as Partial<Pick<Grafico, 'titulo' | 'subtitulo'> & Pick<Elemento, 'texto'>>;
  assert.deepEqual([c('rv-barra').titulo, c('rv-barra').subtitulo], ['Plata', 'Del mes']);
  assert.deepEqual([c('rv-vendido').titulo, c('rv-vendido').subtitulo], ['Sold Revenue', ''], 'las demás conservan el suyo');
  assert.equal(c('cb-seccion').texto, 'Cobrar', 'el título de una sección es su texto');
  assert.equal(c('cb-tabla').subtitulo, 'Lo pendiente', 'un elemento no tiene subtítulo: va al primer gráfico');
  assert.equal(c('pt-ia').texto, 'Qué funciona');
});

// Rotura: la migración pisando los componentes que no son bloques (`componentes.push(c)` → `push({ ...c, x: 0 })`)
// → 11 / 1 (éste; la verificación del informe real del scratchpad también lo caza).
test('nada que no sea un bloque se toca, y un bloque que nunca existió se descarta como antes', () => {
  for (const h of hojasCrudas()) {
    const s = sanearHoja(h, 0)!;
    for (const c of (h.componentes as Crudo[]).filter((x) => x.clase !== 'bloque')) {
      const antes = sanearHoja({ ...h, componentes: [c] }, 0)!.componentes[0];
      assert.deepEqual(s.componentes.find((x) => x.id === c.id), antes, `${String(h.id)}/${String(c.id)}`);
    }
  }
  const h = sanearHoja({ id: 'h', componentes: [bloque('nunca', 'inventado', 0, 0, 12, 4), kpi('k', 'leads', 'leads', 0, 4)] }, 0)!;
  assert.deepEqual(h.componentes.map((c) => c.id), ['k']);
});

// Rotura: un id con azar en `idDeParte` → 2 / 10 (éste y casi todos: los ids son el contrato con la pantalla).
test('determinística e idempotente: dos lecturas dan el mismo informe, y sanear lo saneado no cambia nada', () => {
  const a = sanearTablero(informeV4())!, b = sanearTablero(informeV4())!;
  assert.equal(JSON.stringify(a), JSON.stringify(b));
  assert.equal(JSON.stringify(sanearTablero(JSON.parse(JSON.stringify(a)))), JSON.stringify(a));
  for (const h of a.hojas) {
    const m = migrarBloquesV5(h as unknown as Crudo);
    assert.equal(m.hoja, h as unknown as Crudo, `${h.id}: sin bloques no hay nada que migrar`);
    assert.equal(m.extra, 0);
    assert.ok(!h.componentes.some((c) => c.clase === 'bloque'));
  }
});

// Rotura: `idLibre` que devuelve el id tal cual → 11 / 1 (éste).
test('un id que ya existe en la hoja no se pisa: se busca el siguiente libre, sin azar; y los ids entran en 40', () => {
  const h = { id: 'h', componentes: [kpi('rv-barra', 'leads', 'leads', 0, 20), bloque('rv', 'revenue', 0, 0, 12, 9)] };
  const s = sanearHoja(h, 0)!;
  assert.deepEqual(s.componentes.map((c) => c.id).filter((id) => id.startsWith('rv-barra')), ['rv-barra', 'rv-barra-2']);
  assert.equal(JSON.stringify(sanearHoja(h, 0)), JSON.stringify(s));
  const largo = 'b'.repeat(40);
  const l = sanearHoja({ id: 'h', componentes: [bloque(largo, 'funnel_maduro', 0, 0, 12, 12, { periodo: 'todo' })] }, 0)!;
  for (const c of l.componentes) {
    assert.ok(c.id.length <= 40 && c.id.startsWith('b'.repeat(20)), c.id);
    if (c.clase === 'grafico') for (const k of c.controles) assert.ok(k.id.length <= 40, k.id);
  }
  assert.equal(new Set(l.componentes.map((c) => c.id)).size, 4, 'cuatro piezas, cuatro ids');
});

// Rotura: el tope de la hoja sin correrse (`tope = MAX_COMPONENTES`) → 11 / 1 (éste). `colocar` sin escalar (`sx = sy = 1`)
// → 11 / 1 (éste).
test('una hoja llena no pierde nada por migrarse, y un bloque agrandado escala sus piezas adentro de su lugar', () => {
  const llenos = Array.from({ length: MAX_COMPONENTES - 1 }, (_, i) => kpi(`k${i}`, 'leads', 'leads', (i % 4) * 3, 100 + Math.floor(i / 4) * 4));
  const h = sanearHoja({ id: 'h', componentes: [...llenos, bloque('rv', 'revenue', 0, 0, 12, 9)] }, 0)!;
  assert.equal(h.componentes.length, MAX_COMPONENTES - 1 + 5);
  // Revenue a la mitad del ancho y el doble de alto.
  const b = { x: 6, y: 10, w: 6, h: 18 };
  const out = migrarBloquesV5({ id: 'h', componentes: [bloque('rv', 'revenue', b.x, b.y, b.w, b.h)] }).hoja.componentes as Crudo[];
  for (const p of out) {
    assert.ok((p.x as number) >= b.x && (p.y as number) >= b.y && (p.x as number) + (p.w as number) <= b.x + b.w && (p.y as number) + (p.h as number) <= b.y + b.h, `${String(p.id)}: ${JSON.stringify([p.x, p.y, p.w, p.h])}`);
  }
  assert.deepEqual([parte(out, 'rv-barra').w, parte(out, 'rv-barra').h], [6, 6]);
});

// Rotura: sin estampar la plantilla (`plantilla: null` siempre) → 11 / 1 (éste).
test('la hoja guarda de qué plantilla nació: la FIRMA que delataban sus bloques', () => {
  const t = sanearTablero(informeV4())!;
  const p = Object.fromEntries(t.hojas.map((h) => [h.id, h.plantilla ?? null]));
  assert.deepEqual(p, { comercial: null, 'ads-analyst': 'ads-analyst', landing: 'landing', closing: 'closing', productividad: 'productividad' });
  const propia = sanearHoja({ id: 'h', plantilla: 'mia', componentes: [bloque('e', 'embudo_cierre', 0, 0, 6, 10)] }, 0)!;
  assert.equal(propia.plantilla, 'mia', 'no pisa la que ya tenía');
});

// Con los conjuntos del contrato (los declara el paquete de DATOS en lib/graficos-fuentes-extra.ts): ninguna pieza
// se cae al sanear, y el saneo no le cambia en silencio lo que la receta pidió (un id que no existe se reemplaza
// sin error). Se saltea, diciendo cuáles faltan, mientras algún conjunto no exista.
const NECESARIOS = ['revenue', 'suscripciones', 'cobranza', 'leads', 'guiones', 'toques', 'retencion_vsl', 'llamadas_venta', 'llamadas_dimensiones', 'proyectos', 'ejecucion'];
const faltan = NECESARIOS.filter((f) => !fuenteDe(f));
// Rotura: la receta de la curva con `pasan` en vez de `siguen` → 10 / 2 (éste y «Landing, Closing…»: el saneo la
// cambiaba en silencio). Sacar la migración de `sanearHoja` → 6 / 6 (éste, el período, el título, el id, la hoja llena
// y la plantilla).
test('con los conjuntos del contrato, ninguna pieza se cae ni cambia al sanear', { skip: faltan.length ? `faltan los conjuntos ${faltan.join(', ')}` : false }, () => {
  const canon = (v: unknown): string => JSON.stringify(v, (_k, x) => (x && typeof x === 'object' && !Array.isArray(x) ? Object.fromEntries(Object.entries(x).sort(([a], [b]) => a.localeCompare(b))) : x));
  for (const h of hojasCrudas()) {
    const crudas = migrarBloquesV5(h).hoja.componentes as Crudo[];
    const s: Hoja = sanearHoja(h, 0)!;
    for (const p of crudas.filter((c) => (h.componentes as Crudo[]).every((x) => x.id !== c.id))) {
      const q = s.componentes.find((c) => c.id === p.id) as unknown as Crudo | undefined;
      assert.ok(q, `${String(p.id)} se cayó al sanear`);
      for (const k of ['tipo', 'fuente', 'dimension', 'desglose', 'fecha', 'metricas', 'colorPor', 'secundaria', 'alClic', 'ordenMetrica', 'limite', 'ejes', 'referencias', 'tabla', 'seccion']) {
        if (p[k] !== undefined) assert.equal(canon(q![k]), canon(p[k]), `${String(p.id)}.${k}`);
      }
      for (const k of ((p.controles as Crudo[] | undefined) ?? []).filter((x) => x.fijo)) {
        assert.ok((q!.controles as ControlVista[]).some((x) => x.id === k.id && x.fijo && x.campo === (k.campo ?? null)), `${String(p.id)}: se cayó el filtro fijo ${String(k.campo)}`);
      }
      if (p.popup) assert.ok(((q!.popup as Crudo | undefined)?.componentes as unknown[] | undefined)?.length, `${String(p.id)}: se cayó la ficha del pop-up`);
    }
  }
});

// Rotura: `colocar` sin sumar el lugar del bloque → 9 / 3 (éste: las piezas de Comercial se pisaban). La mitad «ningún
// bloque» no tiene una línea propia que romper: `sanearComponente` tira la clase 'bloque' y BLOQUES está vacío (con la
// migración afuera, igual da 0 bloques). Queda como guarda de las plantillas.
test('el informe inicial y las plantillas de «Nueva hoja»: ninguna hoja trae bloques después de sanear', () => {
  for (const h of tableroInicial().hojas) assert.ok(!h.componentes.some((c) => c.clase === 'bloque'), h.id);
  for (const p of PLANTILLAS_HOJA) assert.ok(!instanciarPlantilla(p).componentes.some((c) => c.clase === 'bloque'), p.id);
  const co = tableroInicial().hojas.find((h) => h.id === 'comercial')!;
  for (let i = 0; i < co.componentes.length; i++) for (let j = i + 1; j < co.componentes.length; j++) {
    const a = co.componentes[i] as unknown as Crudo, b = co.componentes[j] as unknown as Crudo;
    assert.ok(!pisan(a, b), `se pisan ${String(a.id)} y ${String(b.id)}`);
  }
});
