'use client';

// =============================================================================
// Grafico — dibuja UN componente del Dashboard a partir de lo que devolvió el server
// =============================================================================
// No sabe de fuentes ni de la base: recibe el `Resultado` de lib/graficos-agregar.ts y lo pinta
// según el tipo, con el ESTILO de la hoja (colores, etiquetas, leyenda, ejes, cuadrícula, formato).
// Llena la celda de la grilla: el alto lo pone react-grid-layout, así que la caja es flex en columna
// y el área estira con `flex: 1; min-height: 0` (AGENTS.md: `height: 100%` contra un alto de flex no
// resuelve en Safari).
//
// El EDITOR es de Looker; los GRÁFICOS son de MaKo. Martín, 11/10/2026: «Quiero que los
// graficos editables se parezcan más a esos que a los que me propusiste, tengan ese diseño» —
// «esos» son los de las tabs viejas de Marketing y Comercial: el número de 44 px con su rótulo
// en mono y mayúsculas, el chip contra el período anterior, el embudo de trapecios con la caída
// entre etapas, y los ejes, la grilla y los tooltips con los tokens de la app (que además se dan
// vuelta solos en el tema oscuro).
//
// GORDOS (v5, punto 13): el grosor, la letra y las etiquetas salen de lib/graficos-gordo.ts, con pisos
// que ninguna plantilla de estilo baja: trazos de 3,5 a 5 px redondeados, barras anchas con el radio del
// tema, puntos grandes, nada por debajo de 13 px, ejes con pocas marcas y NUNCA dos ejes Y (con dos
// formatos o tres métricas, paneles). Las etiquetas de valor son las que ENTRAN sin pisarse
// (./graficos/Etiquetas.tsx), no una por punto. Lo nuevo de la v5 vive en ./graficos/ (Paneles, Tabla,
// BarrasGordas, BarraProporcion, Tramos, Tarjetas, Dispersion) y el mapa de cualquier país en ./MapaGeo.tsx.
//
// INTERACTIVO (punto 5: «Los gráficos interactivos...»). Con `onDetalle`, un clic en una KPI, una barra,
// una porción, una fila de tabla, un punto de una serie o un escalón del embudo avisa QUÉ se clickeó
// (lib/graficos-acciones.ts, `SelDetalle`) y la pantalla abre el detalle (./Detalle.tsx). El cursor de
// mano sale sólo donde un clic hace algo: una KPI cuyo número no tiene filas atrás (las vistas del VSL)
// no se dibuja clickeable. Y la LEYENDA prende y apaga series (estado local, no se guarda; la última no
// se apaga): es lo que hacía el selector de métricas de la vieja Tendencias.

import { useState, type CSSProperties, type KeyboardEvent, type ReactNode } from 'react';
import {
  LineChart, Line, BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis, Tooltip, CartesianGrid, Legend,
  AreaChart, Area, ComposedChart, Treemap, Sankey, FunnelChart, Funnel, LabelList,
} from 'recharts';
import { Spinner } from '@/app/_ui';
import { destinoDetalle, dimensionDe, fuenteDe, metricaDe, tipoDe, tonoDe, type Efectivo, type Formato, type Grafico as G } from '@/lib/graficos-catalogo';
import { alternarSerie, serieOculta, type SelDetalle } from '@/lib/graficos-acciones';
import { colorDeTono, estiloEfectivo, fondoDeTarjeta, type TemaHoja } from '@/lib/graficos-temas';
import {
  anchoEjeY, anchoTexto, BARRA, colorDeCategoria, columnaConBarra, EJES, intervaloPorAncho, LETRA, LETRA_MINIMA, MARGEN, modoPorAlto, ocultoPorCero,
  ordenarPorValores, textoConMuestra, usaPaneles,
} from '@/lib/graficos-gordo';
import dynamic from 'next/dynamic';
import { chipComparar, fmtValor, histograma, OTROS, sinDatos, type FilaResultado, type Resultado } from '@/lib/graficos-agregar';
import { EstilosGraficos } from './graficos/estilos';
import { AreaMedida, useMedida, type Tam } from './graficos/medida';
import { CapaEtiquetas, type SerieEtiqueta } from './graficos/Etiquetas';
import { Paneles } from './graficos/Paneles';
import { Tabla, extraDe } from './graficos/Tabla';
import { BarrasGordas } from './graficos/BarrasGordas';
import { BarraProporcion } from './graficos/BarraProporcion';
import { Tramos } from './graficos/Tramos';
import { Tarjetas } from './graficos/Tarjetas';
import { Dispersion } from './graficos/Dispersion';
import { puntoActivo, puntosDe } from './graficos/puntos';
import { DIBUJOS_PROPIOS, TIPOS_CON_DIBUJO_PROPIO } from './graficos/registro';

// El mapa baja su geometría (d3-geo + /geo/v1): sólo se carga si la hoja tiene un mapa.
const MapaGeo = dynamic(() => import('./MapaGeo'), { ssr: false });

export const MONO = "'Geist Mono', monospace";
const GRIS = 'var(--border-strong)';
const TIP = { background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 10, fontSize: LETRA.tooltip, color: 'var(--ink)', boxShadow: '0 6px 20px rgba(18,21,27,.08)', padding: '8px 12px' };
const TIP_ETIQUETA = { color: 'var(--dim)', fontSize: LETRA.tooltipRotulo, marginBottom: 4 };
/** Los ticks: 13 px en la letra de la hoja, var(--dim) (no mono ni gris tenue). El color va en `style`. */
const EJE = { fontSize: LETRA.tick, style: { fill: 'var(--dim)' } };
const EJE_CATEGORIA = { fontSize: LETRA.categoria, style: { fill: 'var(--ink)' } };
/** La cuadrícula: sólo horizontal, sólida, en las marcas del eje Y. */
const GRILLA = { stroke: 'var(--border)', strokeWidth: 1 };

export type EstadoDatos = { cargando: boolean; error?: string; resultado?: Resultado };

/**
 * ¿Este tipo se dibuja como una tarjeta de número (rótulo en mono, filete arriba)? La barra de proporción y
 * la línea de tiempo están en el grupo «Cuadro de resultados» del catálogo pero son GRÁFICOS: van con la
 * tarjeta de cualquier gráfico.
 */
export const esTarjetaNumero = (tipo: string) => tipoDe(tipo)?.grupo === 'Cuadro de resultados' && tipo !== 'barra_proporcion' && tipo !== 'tramos';

/**
 * ¿La tarjeta se esconde? (`Grafico.ocultarSiCero`: la fila de MRR que el bloque Revenue mostraba sólo con
 * suscripciones activas). Lo decide quien dibuja la TARJETA (la grilla del editor), mirando y no editando:
 * el cuerpo no puede esconder la caja que lo contiene.
 */
export const ocultaSiCero = (g: G, estado: EstadoDatos): boolean => !!estado.resultado && !estado.error && ocultoPorCero(g, estado.resultado.totales[0]);

function Mensaje({ children }: { children: ReactNode }) {
  return <div style={{ flex: 1, display: 'grid', placeItems: 'center', color: 'var(--faint)', fontSize: 'var(--fs-md)', textAlign: 'center', padding: 8 }}>{children}</div>;
}

/** «Sin datos en este período»: la MISMA regla con que una plantilla se arma sin gráficos vacíos (lib/graficos-agregar.ts). */
const vacio = sinDatos;

/** Una caja que abre algo al clic (y con Enter o espacio). Sin `al`, la misma caja muda: nada de mano. */
function Clic({ al, etiqueta, estilo, children }: { al: (() => void) | null; etiqueta: string; estilo: CSSProperties; children: ReactNode }) {
  if (!al) return <div style={estilo}>{children}</div>;
  const teclas = (ev: KeyboardEvent<HTMLDivElement>) => { if (ev.key === 'Enter' || ev.key === ' ') { ev.preventDefault(); al(); } };
  return <div role="button" tabIndex={0} aria-label={etiqueta} title={etiqueta} onClick={al} onKeyDown={teclas} style={{ ...estilo, cursor: 'pointer' }}>{children}</div>;
}

/** Un color del estilo aclarado hacia el fondo: `t` = 1 es el color tal cual, 0 es blanco. */
function aclarar(hex: string, t: number): string {
  const m = /^#([0-9a-f]{6})$/i.exec(hex);
  if (!m) return hex;
  const n = parseInt(m[1], 16);
  const canal = (c: number) => Math.round(255 - (255 - c) * t).toString(16).padStart(2, '0');
  return `#${canal((n >> 16) & 255)}${canal((n >> 8) & 255)}${canal(n & 255)}`;
}

/** Las series de un gráfico de ejes: las métricas, o las columnas del desglose si lo hay. */
function series(r: Resultado): { claves: string[]; nombres: string[]; formatos: Formato[]; datos: Array<Record<string, string | number | null>> } {
  if (r.cruce) {
    const claves = r.cruce.claves.map((_, j) => `c${j}`);
    const datos = r.filas.map((f, i) => {
      // `__clave`: el grupo que abre el detalle al clic (la etiqueta del tiempo, «03/10», no se puede volver a leer).
      const o: Record<string, string | number | null> = { etiqueta: f.etiqueta, __clave: f.clave };
      r.cruce!.celdas[i]?.forEach((v, j) => { o[`c${j}`] = v; });
      return o;
    });
    return { claves, nombres: r.cruce.claves, formatos: claves.map(() => r.columnas[0].formato), datos };
  }
  const claves = r.columnas.map((c) => c.id);
  const datos = r.filas.map((f) => {
    const o: Record<string, string | number | null> = { etiqueta: f.etiqueta, __clave: f.clave };
    r.columnas.forEach((c, i) => { o[c.id] = f.valores[i]; });
    return o;
  });
  return { claves, nombres: r.columnas.map((c) => c.nombre), formatos: r.columnas.map((c) => c.formato), datos };
}

/** «Cierres» → «cierres» (el «14 cierres» de la KPI), sin tocar una sigla («MRR»). */
const enMinuscula = (s: string) => (s.length > 1 && s[1] === s[1].toLowerCase() ? s[0].toLowerCase() + s.slice(1) : s);

/** El número grande cuando el área no alcanza para ejes: el total de la primera métrica. */
function SoloNumero({ r, compacto }: { r: Resultado; compacto: boolean }) {
  const col = r.columnas[0];
  return (
    <div className="gr-solo-numero">
      <b>{col ? fmtValor(r.totales[0] ?? null, col.formato, compacto) : '—'}</b>
      {col && <span>{col.nombre}</span>}
    </div>
  );
}

/**
 * El cuerpo de un gráfico. El estilo sale ENTERO del tema de la hoja (punto 8): el gráfico sólo aporta
 * su contenido (título, subtítulo, comparar, objetivo, total) y el color de una KPI sale de lo que
 * significa su métrica (`tonoDe`).
 *
 * `onDetalle` (opcional): con él, el gráfico es clickeable — ver la cabecera. Quien lo monta lo pasa sólo
 * mirando: editando, un clic selecciona la tarjeta.
 */
export function CuerpoGrafico({ g, estado, tema, onDetalle, efectivo }: { g: G; estado: EstadoDatos; tema: TemaHoja; onDetalle?: (sel: SelDetalle) => void; efectivo?: Efectivo }) {
  // Las series apagadas desde la leyenda. Estado de la VISTA: no se guarda en el informe.
  // (Arriba de todo: un hook detrás de un `return` es la pantalla en blanco de AGENTS.md.)
  const [ocultas, setOcultas] = useState<ReadonlySet<string>>(() => new Set());

  // El hueco de la ola 2: un tipo con dibujo propio (el mapa de calor de página) recibe todo y dibuja él.
  const Propio = DIBUJOS_PROPIOS[g.tipo];
  const cuerpo = ((): ReactNode => {
    if (Propio) return <Propio g={g} estado={estado} tema={tema} onDetalle={onDetalle} efectivo={efectivo} />;
    if (TIPOS_CON_DIBUJO_PROPIO.includes(g.tipo)) return <Mensaje>Este gráfico todavía no se puede dibujar</Mensaje>;
    const r0 = estado.resultado;
    if (!r0) return <Mensaje>{estado.error ?? <Spinner size={20} />}</Mensaje>;
    if (estado.error) return <Mensaje>{estado.error}</Mensaje>;
    const e = estiloEfectivo(tema);
    const halo = fondoDeTarjeta(tema);
    const fuente = fuenteDe(g.fuente);
    const dim = fuente ? dimensionDe(fuente, g.dimension) : undefined;
    const met = (id: string | undefined) => (fuente && id ? metricaDe(fuente, id) : undefined);
    const menosEsMejor = (id: string) => met(id)?.mejor === 'menos';
    // Las categorías de una dimensión con orden FIJO (`Dimension.valores`: «Alta, Media, Baja, A futuro») salen en
    // ese orden, y las que no trajeron filas, en cero.
    const r: Resultado = dim?.clase === 'categoria' && dim.valores?.length && !r0.cruce
      ? { ...r0, filas: ordenarPorValores(r0.filas, dim.valores, r0.columnas.length) as FilaResultado[] }
      : r0;
    const tono = colorDeTono(tonoDe(g.fuente, g.metricas[0]), tema);
    const c = (i: number, etiqueta?: string) => (etiqueta === OTROS ? GRIS : e.colores[i % e.colores.length]);
    /** El color de una categoría: el que declara su dimensión (`Dimension.colores`), o null. */
    const colorFijo = (etiqueta: string): string | null => (etiqueta === OTROS ? GRIS : dim?.colores?.[etiqueta] ?? null);
    const info = tipoDe(g.tipo);
    const fmt = (v: number | null, f: Formato) => fmtValor(v, f, e.compacto);
    const tick = (f: Formato) => (v: number) => fmtValor(v, f, true);
    const estiloLeyenda: CSSProperties = { fontSize: LETRA.leyenda, color: 'var(--ink)', paddingBottom: 8 };

    // ── La interacción: qué abre un clic, y la leyenda que prende y apaga series ──
    const destinoDe = (metrica: string | undefined) => destinoDetalle(g.fuente, g.fecha, metrica);
    /** ¿Un clic en esta métrica (una KPI, un escalón del embudo) abre una lista? */
    const metricaAbre = (metrica: string | undefined) => !!onDetalle && !!destinoDe(metrica);
    const abrirMetrica = (metrica: string | undefined) => (metricaAbre(metrica) ? () => onDetalle!({ dimension: null, valor: null, ...(metrica ? { metrica } : {}) }) : null);
    // Un grupo de categoría abre siempre (al menos «Filtrar la página por esto»); uno de tiempo, sólo si hay filas atrás.
    const grupoAbre = !!onDetalle && !!g.dimension && (r.clase === 'categoria' || (r.clase === 'tiempo' && !!destinoDe(g.metricas[0])));
    const cursorGrupo = grupoAbre ? 'pointer' : undefined;
    const abrirGrupo = (clave: unknown, serie?: string) => {
      if (!onDetalle || !grupoAbre || typeof clave !== 'string' || !clave || clave === OTROS) return;
      const metrica = serie && g.metricas.includes(serie) ? serie : g.metricas[0];
      if (r.clase === 'tiempo' && !destinoDe(metrica)) return;
      onDetalle({ dimension: g.dimension, valor: clave, metrica });
    };
    // La leyenda (arriba a la izquierda, con dos series o más) prende y apaga series; la última no se apaga.
    const oculta = (k: string, claves: string[]) => serieOculta(ocultas, k, claves);
    const leyendaDe = (claves: string[]) => {
      if (e.leyenda === 'no' || claves.length < 2) return null;
      return (
        <Legend verticalAlign="top" align="left" layout="horizontal" iconType="circle" iconSize={12} itemSorter={null} inactiveColor="var(--faint)" wrapperStyle={{ ...estiloLeyenda, cursor: 'pointer' }}
          // La leyenda vive adentro del gráfico: sin frenar el clic, también le llegaría al `onClick` del gráfico.
          onClick={(p, _i, ev) => { ev.stopPropagation(); setOcultas((prev) => alternarSerie(prev, String(p.dataKey ?? ''), claves)); }} />
      );
    };

    // ── Los tipos nuevos de la v5 sin dimensión: la barra de proporción y la línea de tiempo ──
    if (g.tipo === 'barra_proporcion') {
      const colorDe = (i: number) => colorDeTono(tonoDe(g.fuente, r.columnas[i]?.id), tema) ?? c(i);
      return <BarraProporcion r={r} colorDe={colorDe} compacto={e.compacto} alMetrica={(i) => abrirMetrica(r.columnas[i]?.id)} />;
    }
    if (g.tipo === 'tramos') return <Tramos r={r} color={c(0)} compacto={e.compacto} alMetrica={(i) => abrirMetrica(r.columnas[i]?.id)} />;

    // ── Cuadros de resultados: la KPI de las tabs viejas ──
    if (info?.grupo === 'Cuadro de resultados' || g.tipo === 'serie_sparkline') {
      const col = r.columnas[0];
      const compacto = g.tipo === 'numero_compacto' || e.compacto;
      const v = r.totales[0];
      const texto = col ? textoConMuestra(v, r.muestraChica?.[0], col.formato, (x) => fmtValor(x, col.formato, compacto)) : '—';
      const tam = g.tipo === 'numero_compacto' ? 30 : g.tipo === 'serie_sparkline' ? 32 : e.kpiTamValor;
      const chip = g.comparar ? chipComparar(v, r.anterior?.[0] ?? null) : null;
      // La métrica chica de abajo («14 cierres»): el agregador la trae aparte (`Resultado.secundaria`).
      const secundaria = r.secundaria ? `${fmtValor(r.secundaria.valor, r.secundaria.formato, compacto)} ${enMinuscula(r.secundaria.nombre)}` : null;
      const grande = (
        <NumeroGrande texto={texto} tam={tam} chip={chip} monoChip={e.kpiEtiqueta === 'mono'} secundaria={secundaria}
          // Como antes: el número toma el color del filete sólo cuando hay algo (un «US$0» no va en verde).
          color={v == null ? 'var(--faint)' : tono && v > 0 ? tono : 'var(--ink)'} />
      );
      const sub = g.subtitulo ? (
        <div style={{ fontFamily: MONO, fontSize: LETRA.tick, color: 'var(--faint)', marginTop: 16, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }} title={g.subtitulo}>{g.subtitulo}</div>
      ) : null;
      // La KPI entera abre lo que hay atrás del número (el «Ad Spend · por anuncio» de la tab vieja).
      const alKpi = abrirMetrica(col?.id);
      if (g.tipo === 'numero_tendencia' || g.tipo === 'serie_sparkline') {
        const datos = g.tipo === 'serie_sparkline' ? r.filas.map((f) => ({ etiqueta: f.etiqueta, valor: f.valores[0] })) : (r.serie ?? []).map((s) => ({ etiqueta: s.etiqueta, valor: s.valor }));
        const gid = `spark-${g.id}`;
        const linea = (t: { w: number; h: number }) => (
          <AreaChart width={t.w} height={t.h} data={datos} margin={{ top: 6, right: 4, bottom: 4, left: 4 }}>
            <defs>
              <linearGradient id={gid} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={c(0)} stopOpacity={0.28} />
                <stop offset="100%" stopColor={c(0)} stopOpacity={0} />
              </linearGradient>
            </defs>
            <Area type="monotone" dataKey="valor" stroke={c(0)} strokeWidth={e.trazo} strokeLinecap="round" strokeLinejoin="round" fill={`url(#${gid})`} dot={false} isAnimationActive={false} />
            <Tooltip contentStyle={TIP} labelStyle={TIP_ETIQUETA} formatter={(x) => [fmt(typeof x === 'number' ? x : null, col?.formato ?? 'numero'), col?.nombre ?? '']} labelFormatter={(l) => String(l)} />
          </AreaChart>
        );
        return (
          <Clic al={alKpi} etiqueta="Ver detalle" estilo={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column' }}>
            {/* El minigráfico es una fila (el número y la línea al lado): a su tamaño de nacimiento (4 × 3) la línea debajo
                del número no tenía alto y no se dibujaba. La tendencia va debajo, con un alto mínimo. */}
            <KpiConLinea arriba={grande} linea={linea} enFila={g.tipo === 'serie_sparkline'} />
            {sub}
          </Clic>
        );
      }
      return <Clic al={alKpi} etiqueta="Ver detalle" estilo={{ flex: 'none', display: 'flex', flexDirection: 'column', minHeight: 0 }}>{grande}{sub}</Clic>;
    }

    // ── Bala e indicador: un total contra un objetivo ──
    if (g.tipo === 'bala' || info?.grupo === 'Indicador') {
      const col = r.columnas[0];
      const v = r.totales[0] ?? 0;
      const objetivo = g.objetivo;
      const max = g.maximo ?? (objetivo ? Math.max(objetivo, v) * 1.2 : v ? v * 1.5 : 1);
      const estiloCaja: CSSProperties = { flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column' };
      if (g.tipo === 'bala') return <Clic al={abrirMetrica(col?.id)} etiqueta="Ver detalle" estilo={estiloCaja}><Bala v={v} objetivo={objetivo} max={max} color={c(0)} texto={col ? fmtValor(v, col.formato, e.compacto) : '—'} textoObj={objetivo != null && col ? fmtValor(objetivo, col.formato, true) : null} /></Clic>;
      return <Clic al={abrirMetrica(col?.id)} etiqueta="Ver detalle" estilo={estiloCaja}><Indicador v={v} max={max} objetivo={objetivo} color={c(0)} rangos={g.tipo === 'indicador_rangos'} texto={col ? fmtValor(v, col.formato, e.compacto) : '—'} /></Clic>;
    }

    // ── Embudo: cada métrica es un escalón ──
    if (info?.grupo === 'Embudo de conversión') {
      const pasos = r.columnas.map((col, i) => ({ nombre: col.nombre, valor: r.totales[i] ?? 0, formato: col.formato }));
      if (!pasos.some((p) => p.valor)) return <Mensaje>Sin datos en este período</Mensaje>;
      // Cada escalón es una métrica: su clic abre lo que hay atrás de ESA métrica (las impresiones, los clics…).
      const alPaso = (i: number) => abrirMetrica(r.columnas[i]?.id);
      // El relleno de los trapecios es el primer color del tema ACLARADO (el azul claro de la tab vieja).
      if (g.tipo === 'embudo_vertical') return <EmbudoVertical pasos={pasos} base={aclarar(c(0), 0.5)} compacto={e.compacto} alPaso={alPaso} />;
      if (g.tipo === 'embudo') {
        const abreAlguno = r.columnas.some((col) => metricaAbre(col.id));
        const maxPaso = Math.max(1, ...pasos.map((p) => p.valor));
        const anchoRotulo = Math.max(...pasos.map((p) => anchoTexto(p.valor >= maxPaso * 0.22 ? p.nombre : `${p.nombre} · ${fmtValor(p.valor, p.formato, true)}`, LETRA.leyenda)));
        return (
          <AreaMedida>
            {(t) => (
              // El margen derecho es el lugar de los nombres: sin él, el escalón más ancho los empujaba fuera de la tarjeta («Impresi»).
              <FunnelChart width={t.w} height={t.h} cursor={abreAlguno ? 'pointer' : undefined}
                margin={{ top: 4, bottom: 4, left: 4, right: Math.min(t.w * 0.4, anchoRotulo + 16) }}>
                <Tooltip contentStyle={TIP} formatter={(v, n) => [fmt(typeof v === 'number' ? v : null, 'numero'), String(n)]} />
                {/* El número va ADENTRO del escalón sólo si el escalón es ancho (un 22 % del primero); si no, al lado del nombre:
                    en la punta del embudo, «33» en blanco salía cortado sobre un triángulo de 10 px. */}
                <Funnel dataKey="valor" nameKey="nombre" isAnimationActive={false}
                  data={pasos.map((p, i) => {
                    const adentro = p.valor >= maxPaso * 0.22;
                    return { ...p, fill: c(i), adentro: adentro ? fmtValor(p.valor, p.formato, true) : '', rotulo: adentro ? p.nombre : `${p.nombre} · ${fmtValor(p.valor, p.formato, true)}` };
                  })}
                  onClick={abreAlguno ? (_d: unknown, i: number) => alPaso(i)?.() : undefined}>
                  <LabelList position="right" fill="var(--dim)" stroke="none" dataKey="rotulo" fontSize={LETRA.leyenda} />
                  <LabelList position="center" fill="#fff" stroke="none" dataKey="adentro" fontSize={LETRA.etiqueta} fontWeight={600} />
                </Funnel>
              </FunnelChart>
            )}
          </AreaMedida>
        );
      }
      return <EmbudoBarras pasos={pasos} vertical={g.tipo === 'embudo_columnas'} color={c} compacto={e.compacto} alPaso={alPaso} />;
    }

    if (vacio(r)) return <Mensaje>Sin datos en este período</Mensaje>;

    // ── Mapa: cualquier país, por país, región o ciudad (./MapaGeo.tsx) ──
    if (g.tipo === 'mapa') {
      const col = r.columnas[0];
      const nivel = g.mapa?.nivel ?? 'region';
      // Una ciudad trae dónde queda (`FilaResultado.geo`, el promedio de sus visitas) y, si el gráfico la pide como
      // columna extra, de qué país es.
      const regiones = r.filas.map((f) => ({
        etiqueta: f.etiqueta, valor: f.valores[0] ?? 0,
        ...(nivel === 'ciudad' && f.geo ? { lat: f.geo.lat, lon: f.geo.lon, pais: extraDe(f, 'pais') || undefined } : {}),
      }));
      // El país de la cuenta, si el server lo mandó (`Resultado.pais`, pedido de P3 a P2): con 'auto' manda él.
      const paisDetectado = (r as Resultado & { pais?: string | null }).pais ?? null;
      const etiquetaAClave = new Map(r.filas.map((f) => [f.etiqueta, f.clave]));
      return (
        <MapaGeo regiones={regiones} color={c(0)} fmt={(v) => fmtValor(v, col?.formato ?? 'numero', true)}
          pais={g.mapa?.pais ?? 'auto'} nivel={nivel} paisDetectado={paisDetectado}
          alClic={grupoAbre ? (etq) => abrirGrupo(etiquetaAClave.get(etq) ?? etq) : undefined} />
      );
    }

    // ── Tarjetas y tablas ──
    const alFila = grupoAbre ? (clave: string) => abrirGrupo(clave) : undefined;
    // Las columnas extra: las que el agregador trajo (`columnasExtra`, con su nombre), en el orden del gráfico.
    const extras = (g.tabla?.columnas ?? []).map((id) => ({ id, nombre: r.columnasExtra?.find((x) => x.id === id)?.nombre ?? (fuente && dimensionDe(fuente, id)?.nombre) ?? id }));
    const conBarra = columnaConBarra(g, menosEsMejor);
    const barraEn = conBarra ? r.columnas.findIndex((x) => x.id === conBarra) : -1;
    if (g.tipo === 'tarjetas') return <Tarjetas r={r} barraEn={barraEn} chips={g.tabla?.columnas ?? []} color={c(0)} compacto={e.compacto} alFila={alFila} />;
    if (info?.grupo === 'Tabla') {
      const modo = g.tipo === 'tabla_barras' ? 'barras' : g.tipo === 'tabla_calor' ? 'calor' : 'plana';
      return <Tabla r={r} modo={modo} barraEn={barraEn} color={c(0)} menosEsMejor={(i) => menosEsMejor(r.columnas[i]?.id ?? '')} extras={extras} total={g.total} compacto={e.compacto} alFila={alFila} />;
    }
    if (info?.grupo === 'Tabla dinámica') return <Dinamica r={r} rotulo={dim?.nombre ?? r.columnas[0].nombre} modo={g.tipo === 'dinamica_barras' ? 'barras' : g.tipo === 'dinamica_calor' ? 'calor' : 'plana'} color={c(0)} total={g.total} compacto={e.compacto} alFila={alFila} />;

    // ── Circular: el anillo con el total al centro; el % adentro sólo si la porción pasa del 7 % ──
    if (info?.grupo === 'Circular') {
      const col = r.columnas[0];
      const datos = r.filas.map((f, i) => ({ etiqueta: f.etiqueta, valor: f.valores[0] ?? 0, color: colorFijo(f.etiqueta) ?? c(i, f.etiqueta) }));
      return (
        <Torta datos={datos} anillo={g.tipo === 'anillo'} etiquetas={e.etiquetas} leyenda={e.leyenda !== 'no'} halo={fondoDeTarjeta(tema)} cursor={cursorGrupo}
          fmtTotal={(v) => fmtValor(v, col.formato, true)} fmt={(v) => fmt(v, col.formato)}
          alClic={grupoAbre ? (i) => abrirGrupo(r.filas[i]?.clave) : undefined} />
      );
    }

    // ── Rectángulos ──
    if (g.tipo === 'rectangulos') {
      const col = r.columnas[0];
      const datos = r.filas.map((f, i) => ({ name: f.etiqueta, size: Math.max(0, f.valores[0] ?? 0), fill: colorFijo(f.etiqueta) ?? c(i, f.etiqueta) }));
      return (
        <AreaMedida>
          {(t) => (
            <Treemap width={t.w} height={t.h} data={datos} dataKey="size" nameKey="name" isAnimationActive={false} stroke={fondoDeTarjeta(tema)}
              onClick={grupoAbre ? (n) => abrirGrupo(n.name) : undefined} style={grupoAbre ? { cursor: 'pointer' } : undefined}
              content={<CeldaTreemap formato={col.formato} compacto={e.compacto} halo={halo} />} />
          )}
        </AreaMedida>
      );
    }

    // ── Sankey: de la dimensión al desglose ──
    if (g.tipo === 'sankey') {
      if (!r.cruce) return <Mensaje>Elige una dimensión de desglose</Mensaje>;
      const izq = r.filas.map((f) => f.etiqueta);
      const der = r.cruce.claves.map((k) => `${k} `);
      const nodes = [...izq, ...der].map((name) => ({ name }));
      const links: Array<{ source: number; target: number; value: number }> = [];
      r.cruce.celdas.forEach((fila, i) => fila.forEach((v, j) => { if (v && v > 0) links.push({ source: i, target: izq.length + j, value: v }); }));
      if (!links.length) return <Mensaje>Sin datos en este período</Mensaje>;
      // Los nombres van AFUERA de las columnas (los de la izquierda a la izquierda) y cada flujo lleva el color de donde sale:
      // con todo del mismo azul y los nombres de la izquierda escritos encima de los flujos, no se podía seguir ninguno.
      const colorIzq = new Map(izq.map((n, i) => [n, colorFijo(n) ?? c(i, n)]));
      return (
        <AreaMedida>
          {(t) => {
            const margen = (nombres: string[]) => Math.round(Math.min(t.w * 0.28, 150, Math.max(40, ...nombres.map((n) => anchoTexto(n.trim(), LETRA.leyenda))) + 14));
            const mIzq = margen(izq); const mDer = margen(der);
            return (
              <Sankey width={t.w} height={t.h} data={{ nodes, links }} nodePadding={14} nodeWidth={14}
                link={<EnlaceSankey colorDe={(n) => colorIzq.get(n) ?? c(0)} />}
                node={<NodoSankey medio={t.w / 2} colorDe={(n) => colorIzq.get(n) ?? null} letras={(lado) => Math.max(4, Math.floor(((lado === 'izq' ? mIzq : mDer) - 12) / (0.6 * LETRA.leyenda)))} />}
                margin={{ top: 8, right: mDer, bottom: 8, left: mIzq }}>
                <Tooltip contentStyle={TIP} />
              </Sankey>
            );
          }}
        </AreaMedida>
      );
    }

    // ── Dispersión y burbujas: ejes fijos, cuadrantes y color por categoría (./graficos/Dispersion.tsx) ──
    if (info?.grupo === 'Dispersión') {
      const dimColor = fuente && g.colorPor ? dimensionDe(fuente, g.colorPor) : undefined;
      return (
        <Dispersion r={r} idGrafico={g.id} burbujas={g.tipo === 'burbujas'} ejes={g.ejes} referencias={g.referencias} colorPor={g.colorPor ?? null}
          ordenCategorias={dimColor?.valores} colorDeCategoria={(cat, i) => colorDeCategoria(cat, dimColor?.colores, i, e.colores)}
          color={c(0)} compacto={e.compacto} halo={halo} alGrupo={grupoAbre ? (clave) => abrirGrupo(clave) : undefined} />
      );
    }

    // ── Histograma ──
    if (g.tipo === 'histograma') {
      const col = r.columnas[0];
      // «US$59–97»: la moneda una sola vez (con las dos, «US$59–US$97» no entraba debajo de su barra ni en escritorio).
      const sinMoneda = (t: string) => t.replace(/^[^\d-]+/, '');
      const franjas = histograma(r.filas.map((f) => f.valores[0] ?? 0)).map((x) => ({ ...x, etiqueta: `${fmtValor(x.desde, col.formato, true)}–${sinMoneda(fmtValor(x.hasta, col.formato, true))}` }));
      return (
        <AreaMedida>
          {(t) => {
            const ejes = e.ejes && modoPorAlto(t.h) === 'completo';
            return (
              <BarChart width={t.w} height={t.h} data={franjas} margin={MARGEN} barCategoryGap={2}>
                {e.cuadricula && ejes && <CartesianGrid {...GRILLA} vertical={false} />}
                <XAxis dataKey="etiqueta" tick={EJE} interval={intervaloPorAncho(franjas.map((x) => x.etiqueta), t.w - 40, null)} tickMargin={8} axisLine={false} tickLine={false} hide={!ejes} />
                <YAxis yAxisId="a" tick={EJE} allowDecimals={false} tickCount={EJES.marcasY} width={anchoEjeY([String(Math.max(0, ...franjas.map((f) => f.cuantos)))])} axisLine={false} tickLine={false} hide={!ejes} />
                <Tooltip contentStyle={TIP} cursor={{ fill: 'var(--surface-2)' }} formatter={(v) => [String(v), 'Cantidad']} />
                <Bar yAxisId="a" dataKey="cuantos" name="Cantidad" fill={c(0)} radius={[e.radioBarra, e.radioBarra, 0, 0]} isAnimationActive={false} />
                {e.etiquetas && ejes && <CapaEtiquetas datos={franjas} series={[{ key: 'cuantos', formato: 'numero', eje: 'a' }]} modo="columnas" fmt={(v) => String(v)} halo={halo} />}
              </BarChart>
            );
          }}
        </AreaMedida>
      );
    }

    // ── Cascada ──
    if (g.tipo === 'cascada') {
      const col = r.columnas[0];
      let acum = 0;
      const datos = r.filas.map((f) => {
        const v = f.valores[0] ?? 0;
        const base = v >= 0 ? acum : acum + v;
        acum += v;
        return { etiqueta: f.etiqueta, base, alto: Math.abs(v), v, sube: v >= 0 };
      });
      datos.push({ etiqueta: 'Total', base: 0, alto: Math.abs(acum), v: acum, sube: acum >= 0 });
      return (
        <AreaMedida>
          {(t) => {
            const ejes = e.ejes && modoPorAlto(t.h) === 'completo';
            return (
              <BarChart width={t.w} height={t.h} data={datos} margin={MARGEN}>
                {e.cuadricula && ejes && <CartesianGrid {...GRILLA} vertical={false} />}
                <XAxis dataKey="etiqueta" tick={EJE} interval={intervaloPorAncho(datos.map((d) => d.etiqueta), t.w - 80, null)} tickMargin={8} axisLine={false} tickLine={false} hide={!ejes} />
                <YAxis tick={EJE} tickFormatter={tick(col.formato)} tickCount={EJES.marcasY} width={anchoEjeY(datos.map((d) => fmtValor(d.base + d.alto, col.formato, true)))} axisLine={false} tickLine={false} hide={!ejes} />
                <Tooltip contentStyle={TIP} cursor={{ fill: 'var(--surface-2)' }} formatter={(_v, _n, it) => [fmt((it?.payload as { v?: number })?.v ?? null, col.formato), col.nombre]} />
                <Bar dataKey="base" stackId="c" fill="transparent" isAnimationActive={false} />
                <Bar dataKey="alto" stackId="c" radius={[e.radioBarra, e.radioBarra, 0, 0]} maxBarSize={BARRA.maxVertical} isAnimationActive={false}>
                  {datos.map((d, i) => <Cell key={i} fill={i === datos.length - 1 ? c(0) : d.sube ? 'var(--good)' : 'var(--bad)'} />)}
                </Bar>
              </BarChart>
            );
          }}
        </AreaMedida>
      );
    }

    // ── Cronología: cuándo empezó y terminó cada grupo ──
    if (g.tipo === 'cronologia') {
      const dia = (s?: string) => (s ? Math.round(Date.parse(`${s}T12:00:00Z`) / 86_400_000) : 0);
      const filas = r.filas.filter((f) => f.desde);
      if (!filas.length) return <Mensaje>Sin datos en este período</Mensaje>;
      const datos = filas.map((f) => ({ etiqueta: f.etiqueta, rango: [dia(f.desde), dia(f.hasta) + 1] as [number, number] }));
      const fecha = (n: number) => { const d = new Date(n * 86_400_000); return `${String(d.getUTCDate()).padStart(2, '0')}/${String(d.getUTCMonth() + 1).padStart(2, '0')}`; };
      const corto = (v: string) => (v.length > 20 ? `${v.slice(0, 19)}…` : v);
      return (
        <AreaMedida>
          {(t) => (
            <BarChart width={t.w} height={t.h} data={datos} layout="vertical" margin={MARGEN} barSize={Math.min(BARRA.horizontal, Math.max(8, (t.h / Math.max(1, datos.length)) * 0.6))}>
              {e.cuadricula && <CartesianGrid {...GRILLA} horizontal={false} />}
              <XAxis type="number" domain={['dataMin', 'dataMax']} tick={EJE} tickFormatter={fecha} tickCount={EJES.maxMarcasX} axisLine={false} tickLine={false} hide={!e.ejes} />
              <YAxis type="category" dataKey="etiqueta" tick={EJE_CATEGORIA} width={Math.min(180, Math.ceil(Math.max(...datos.map((d) => anchoTexto(corto(d.etiqueta), LETRA.categoria)))) + 10)} axisLine={false} tickLine={false} tickFormatter={corto} />
              <Tooltip contentStyle={TIP} cursor={{ fill: 'var(--surface-2)' }} formatter={(v) => { const [a, b] = v as [number, number]; return [`${fecha(a)} → ${fecha(b - 1)}`, 'Del … al …']; }} />
              <Bar dataKey="rango" fill={c(0)} isAnimationActive={false} radius={e.radioBarra} />
            </BarChart>
          )}
        </AreaMedida>
      );
    }

    // ── Ejes: series, líneas, áreas, columnas, barras y combinados ──
    const s = series(r);
    const horizontal = g.tipo.startsWith('barras');
    const cien = g.tipo.endsWith('_100');
    const apilada = g.tipo.includes('apilad') || cien;
    const combinado = g.tipo === 'combinado' || g.tipo === 'combinado_apilado';

    // BARRAS GORDAS: horizontales de una o dos métricas, con el valor al final (las piezas de /admin/dev/pricing).
    if (horizontal && !apilada && !r.cruce && s.claves.length <= 2) {
      return (
        <BarrasGordas filas={r.filas} columnas={r.columnas} colorDeFila={(etq) => colorFijo(etq)} colorDeMetrica={(j) => c(j)} compacto={e.compacto}
          alFila={grupoAbre ? (clave) => abrirGrupo(clave) : undefined} />
      );
    }

    // PANELES: dos formatos o tres métricas en una serie (una métrica por gráfico chico, como la Tendencias vieja).
    if (!apilada && !combinado && usaPaneles(g.tipo, s.formatos, !!r.cruce)) {
      const enColumnas = info?.grupo === 'Barras';
      return (
        <Paneles r={r} s={s} color={(i) => c(i)} comparar={g.comparar} compacto={e.compacto} trazo={e.trazo} radio={e.radioBarra} halo={halo}
          columnas={enColumnas} idGrafico={g.id} alPunto={grupoAbre ? (clave, metrica) => abrirGrupo(clave, metrica) : undefined} />
      );
    }
    // UN solo eje Y (el del primer formato). En un combinado, la línea de otro formato va contra un eje ESCONDIDO
    // y con su etiqueta en el último punto: nunca dos ejes Y a la vista.
    const f0 = s.formatos[0] ?? 'numero';
    const eje = (f: Formato): 'a' | 'b' => (combinado && f !== f0 ? 'b' : 'a');
    const visibles = s.claves.filter((k) => !oculta(k, s.claves));
    const fmtTip = (v: unknown, nombre: unknown) => {
      const i = s.nombres.indexOf(String(nombre));
      return [fmt(typeof v === 'number' ? v : null, s.formatos[Math.max(0, i)] ?? 'numero'), String(nombre)] as [string, string];
    };
    const pct = (v: number) => `${Math.round(v * 100)}%`;
    // Un punto de una serie (o una columna de un combinado): el clic cae en el gráfico, que sabe qué índice
    // y qué serie estaba bajo el cursor. ⚠️ Fuera del área de dibujo el índice viene null, y `Number(null)`
    // es 0: sin la guarda, un clic en el margen abriría el primer día.
    const alPunto = grupoAbre
      ? (st: { isTooltipActive?: boolean; activeTooltipIndex?: number | string | null; activeDataKey?: unknown }) => {
        const i = typeof st.activeTooltipIndex === 'number' ? st.activeTooltipIndex : typeof st.activeTooltipIndex === 'string' && st.activeTooltipIndex !== '' ? Number(st.activeTooltipIndex) : NaN;
        if (!st.isTooltipActive || !Number.isInteger(i)) return;
        abrirGrupo(s.datos[i]?.__clave, typeof st.activeDataKey === 'string' ? st.activeDataKey : undefined);
      }
      : undefined;
    const ley = leyendaDe(s.claves);
    /** Los textos del eje Y, para medir su ancho: el máximo y el mínimo de lo que se ve (apilado, la pila). */
    const textosY = (() => {
      const vals: number[] = [];
      for (const d of s.datos) {
        let pila = 0;
        for (const k of visibles) { const v = d[k]; if (typeof v === 'number' && Number.isFinite(v)) { vals.push(v); pila += v; } }
        if (apilada) vals.push(pila);
      }
      if (!vals.length) return ['0'];
      return [fmtValor(Math.max(...vals), f0, true), fmtValor(Math.min(0, ...vals), f0, true)];
    })();
    const seriesEtq = (claves: string[]): SerieEtiqueta[] => claves.filter((k) => !oculta(k, s.claves)).map((k) => ({ key: k, formato: s.formatos[s.claves.indexOf(k)] ?? f0, eje: eje(s.formatos[s.claves.indexOf(k)] ?? f0) }));
    const fmtEtq = (v: number, f: Formato) => fmtValor(v, f, true);

    return (
      <AreaMedida minAlto={60}>
        {(t) => {
          const modo = modoPorAlto(t.h);
          if (modo === 'soloNumero' && !r.cruce) return <SoloNumero r={r} compacto={e.compacto} />;
          const ejes = e.ejes && modo === 'completo';
          const grilla = e.cuadricula && ejes ? <CartesianGrid {...GRILLA} vertical={false} /> : null;
          // El eje X: las etiquetas que ENTRAN (lib/graficos-gordo.ts, `intervaloPorAncho`). En el tiempo, como mucho cinco; en
          // categorías, todas: si no entran derechas (y son 16 o menos), van inclinadas y cortas, porque una barra sin nombre no
          // se sabe qué es. `tickMargin` separa la primera fecha del «0» del eje Y, que antes se encimaban.
          const anchoY = anchoEjeY(cien ? ['100%'] : textosY);
          const etiquetasX = s.datos.map((d) => String(d.etiqueta));
          const enCategorias = r.clase === 'categoria';
          const intervalo = intervaloPorAncho(etiquetasX, t.w - anchoY - MARGEN.left - MARGEN.right, enCategorias || etiquetasX.length <= 6 ? null : EJES.maxMarcasX);
          const inclinar = enCategorias && intervalo > 0 && etiquetasX.length <= 16;
          const corta = (v: string) => (v.length > 14 ? `${v.slice(0, 13)}…` : v);
          const altoInclinado = Math.min(96, Math.ceil(0.58 * Math.max(0, ...etiquetasX.map((x) => anchoTexto(corta(x)))) + 22));
          const ejeX = inclinar
            ? <XAxis dataKey="etiqueta" tick={EJE} interval={0} angle={-35} textAnchor="end" height={altoInclinado} tickFormatter={corta} tickMargin={4} axisLine={false} tickLine={false} hide={!ejes} />
            : <XAxis dataKey="etiqueta" tick={EJE} interval={intervalo} tickMargin={8} axisLine={false} tickLine={false} hide={!ejes} />;
          const ejeY = <YAxis yAxisId="a" tick={EJE} tickCount={EJES.marcasY} width={anchoY} tickFormatter={cien ? pct : tick(f0)} axisLine={false} tickLine={false} hide={!ejes} />;
          // El eje de la línea de otro formato en un combinado: existe para escalarla, nunca se dibuja.
          const ejeB = combinado && s.formatos.some((f) => f !== f0) ? <YAxis yAxisId="b" hide /> : null;
          const tip = <Tooltip contentStyle={TIP} labelStyle={TIP_ETIQUETA} formatter={fmtTip} cursor={{ stroke: 'var(--border-strong)', strokeWidth: 1.5 }} />;
          const comun = { width: t.w, height: t.h, data: s.datos, margin: MARGEN, onClick: alPunto, cursor: cursorGrupo };

          if (info?.grupo === 'Serie temporal' || g.tipo === 'lineas' || g.tipo === 'lineas_suaves') {
            const curva = g.tipo === 'serie_suave' || g.tipo === 'lineas_suaves' ? 'monotone' : 'linear';
            return (
              <LineChart {...comun}>
                {grilla}{ejeX}{ejeY}
                {tip}
                {ley}
                {s.claves.map((k, i) => (
                  <Line key={k} yAxisId="a" type={curva} dataKey={k} name={s.nombres[i]} stroke={c(i, s.nombres[i])} strokeWidth={e.trazo} strokeLinecap="round" strokeLinejoin="round"
                    dot={puntosDe(s.datos, k, c(i, s.nombres[i]), halo)} activeDot={puntoActivo(c(i, s.nombres[i]), halo)}
                    hide={oculta(k, s.claves)} isAnimationActive={false} connectNulls />
                ))}
                {e.etiquetas && ejes && <CapaEtiquetas datos={s.datos} series={seriesEtq(s.claves)} modo="series" fmt={fmtEtq} halo={halo} />}
              </LineChart>
            );
          }

          if (info?.grupo === 'Áreas') {
            return (
              <AreaChart {...comun} stackOffset={cien ? 'expand' : 'none'}>
                <defs>
                  {s.claves.map((k, i) => (
                    <linearGradient key={k} id={`ar-${g.id}-${i}`} x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor={c(i, s.nombres[i])} stopOpacity={apilada ? 0.75 : 0.28} />
                      <stop offset="100%" stopColor={c(i, s.nombres[i])} stopOpacity={apilada ? 0.45 : 0} />
                    </linearGradient>
                  ))}
                </defs>
                {grilla}{ejeX}{ejeY}
                {tip}
                {ley}
                {s.claves.map((k, i) => (
                  <Area key={k} yAxisId="a" type="monotone" dataKey={k} name={s.nombres[i]} stackId={apilada ? 'a' : undefined}
                    hide={oculta(k, s.claves)} stroke={c(i, s.nombres[i])} strokeWidth={e.trazo} strokeLinecap="round" strokeLinejoin="round" fill={`url(#ar-${g.id}-${i})`}
                    dot={apilada ? false : puntosDe(s.datos, k, c(i, s.nombres[i]), halo)} activeDot={puntoActivo(c(i, s.nombres[i]), halo)} isAnimationActive={false} connectNulls />
                ))}
                {e.etiquetas && ejes && !apilada && <CapaEtiquetas datos={s.datos} series={seriesEtq(s.claves)} modo="series" fmt={fmtEtq} halo={halo} />}
              </AreaChart>
            );
          }

          if (combinado) {
            // Las métricas en columnas y la última en línea.
            const nBarras = g.tipo === 'combinado' ? 1 : Math.max(1, s.claves.length - 1);
            const ultimaBarra = s.claves.slice(0, nBarras).filter((k) => !oculta(k, s.claves)).pop();
            return (
              <ComposedChart {...comun} barCategoryGap={BARRA.separacion}>
                {grilla}{ejeX}{ejeY}{ejeB}
                <Tooltip contentStyle={TIP} labelStyle={TIP_ETIQUETA} formatter={fmtTip} cursor={{ fill: 'var(--surface-2)' }} />
                {ley}
                {s.claves.map((k, i) => (i < nBarras ? (
                  <Bar key={k} yAxisId={eje(s.formatos[i])} dataKey={k} name={s.nombres[i]} fill={c(i)} stackId={g.tipo === 'combinado_apilado' ? 'a' : undefined}
                    hide={oculta(k, s.claves)} radius={g.tipo === 'combinado_apilado' && k !== ultimaBarra ? 0 : [e.radioBarra, e.radioBarra, 0, 0]} isAnimationActive={false} maxBarSize={BARRA.maxVertical} />
                ) : (
                  <Line key={k} yAxisId={eje(s.formatos[i])} type="monotone" dataKey={k} name={s.nombres[i]} stroke={c(i)} strokeWidth={e.trazo} strokeLinecap="round" strokeLinejoin="round"
                    dot={puntosDe(s.datos, k, c(i), halo)} activeDot={puntoActivo(c(i), halo)} hide={oculta(k, s.claves)} isAnimationActive={false} />
                )))}
                {/* La línea lleva su etiqueta en el último punto SIEMPRE si va contra el eje escondido: si no, su escala no se lee. */}
                {(e.etiquetas || !!ejeB) && ejes && <CapaEtiquetas datos={s.datos} series={seriesEtq(s.claves.slice(nBarras))} modo="series" fmt={fmtEtq} halo={halo} />}
              </ComposedChart>
            );
          }

          // Columnas y barras (sueltas de 3-4 métricas, apiladas o al 100 %).
          const unaSola = s.claves.length === 1 && !r.cruce;
          const ultimaVisible = visibles[visibles.length - 1];
          const radio = (k: string): [number, number, number, number] | number => {
            if (apilada && k !== ultimaVisible) return 0;
            return horizontal ? [0, e.radioBarra, e.radioBarra, 0] : [e.radioBarra, e.radioBarra, 0, 0];
          };
          const corto = (v: string) => (v.length > 20 ? `${v.slice(0, 19)}…` : v);
          const anchoCat = Math.min(180, Math.ceil(Math.max(0, ...s.datos.map((d) => anchoTexto(corto(String(d.etiqueta)), LETRA.categoria)))) + 10);
          return (
            <BarChart {...comun} layout={horizontal ? 'vertical' : 'horizontal'} stackOffset={cien ? 'expand' : 'none'} barCategoryGap={BARRA.separacion} onClick={undefined}>
              {e.cuadricula && ejes && <CartesianGrid {...GRILLA} horizontal={!horizontal} vertical={horizontal} />}
              {horizontal ? (
                <>
                  <YAxis yAxisId="a" type="category" dataKey="etiqueta" tick={EJE_CATEGORIA} width={anchoCat} axisLine={false} tickLine={false} tickFormatter={corto} hide={!e.ejes} />
                  <XAxis type="number" tick={EJE} tickCount={EJES.maxMarcasX} tickFormatter={cien ? pct : tick(f0)} axisLine={false} tickLine={false} hide={!ejes} />
                </>
              ) : (
                <>{ejeX}{ejeY}</>
              )}
              <Tooltip contentStyle={TIP} labelStyle={TIP_ETIQUETA} formatter={fmtTip} cursor={{ fill: 'var(--surface-2)' }} />
              {!unaSola && ley}
              {s.claves.map((k, i) => (
                <Bar key={k} yAxisId="a" dataKey={k} name={s.nombres[i]} fill={c(i, s.nombres[i])} stackId={apilada ? 'a' : undefined}
                  hide={oculta(k, s.claves)} cursor={cursorGrupo} onClick={grupoAbre ? (_d: unknown, j: number) => abrirGrupo(s.datos[j]?.__clave, k) : undefined}
                  radius={radio(k)} isAnimationActive={false} {...(horizontal ? { barSize: BARRA.horizontal } : { maxBarSize: BARRA.maxVertical })}>
                  {/* Una sola métrica: cada categoría con el color que declara su dimensión, «Otros» en gris, y si no, uno solo. */}
                  {unaSola && s.datos.map((d, j) => <Cell key={j} fill={colorFijo(String(d.etiqueta)) ?? c(0)} />)}
                </Bar>
              ))}
              {e.etiquetas && ejes && !cien && (unaSola || apilada) && (
                <CapaEtiquetas datos={s.datos} series={seriesEtq(s.claves)} modo={apilada ? (horizontal ? 'pilasH' : 'pilas') : 'columnas'} fmt={fmtEtq} halo={halo} />
              )}
            </BarChart>
          );
        }}
      </AreaMedida>
    );
  })();
  return <><EstilosGraficos />{cuerpo}</>;
}

// ── Piezas propias ─────────────────────────────────────────────────────────────────────────

/** Lo que separa el número de su chip cuando van en la misma línea. */
const ENTRE_NUMERO_Y_CHIP = 10;

/**
 * El número grande de una KPI y su chip de comparación («↑ 1,3×»). El número se achica para entrar (nunca se corta), y
 * el chip va AL LADO si cabe sin achicar el número más de un 20 %; si no, abajo. Se decide MIDIENDO el ancho: antes iba
 * con `flex-wrap`, y en la tarjeta del celular (176 px) el chip bajaba siempre, aun al lado de un «22» que dejaba aire, y
 * se comía el alto de la línea de la tendencia, que desaparecía.
 */
function NumeroGrande({ texto, tam, color, chip, monoChip, secundaria }: { texto: string; tam: number; color: string; chip: string | null; monoChip: boolean; secundaria: string | null }) {
  const [ref, medida] = useMedida<HTMLDivElement>();
  const w = medida?.w ?? 0;
  const k = Math.max(2, [...texto].length) * 0.6;
  const anchoChip = chip ? anchoTexto(chip, LETRA.tick) + 20 + ENTRE_NUMERO_Y_CHIP : 0;
  const solo = w ? Math.min(tam, w / k) : 0;
  const alLado = w ? Math.min(tam, (w - anchoChip) / k) : 0;
  const enLinea = !chip || (w > 0 && alLado >= solo * 0.8);
  // Hasta la primera medida, el tamaño sale de las unidades del contenedor (lo mismo, sin el chip al lado).
  const tamano = !w ? `min(${tam}px, calc(100cqw / ${k.toFixed(2)}))` : `${Math.floor(chip && enLinea ? alLado : solo)}px`;
  return (
    <div ref={ref} style={{ containerType: 'inline-size', width: '100%', minWidth: 0 }}>
      <div style={{ display: 'flex', flexDirection: enLinea ? 'row' : 'column', alignItems: enLinea ? 'center' : 'flex-start', gap: enLinea ? ENTRE_NUMERO_Y_CHIP : 8 }}>
        <span style={{ fontWeight: 600, fontSize: tamano, lineHeight: 0.95, letterSpacing: '-0.03em', color, fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }}>{texto}</span>
        {chip && (
          // La comparación habla en la letra de la etiqueta del tema: en mono sólo si la etiqueta va en mono (en el tema
          // «General», que es para leer de una pasada, «↑ 1,3×» en mono se leía como un dato técnico).
          <span title="Contra el período anterior" style={{ flex: 'none', display: 'inline-flex', alignItems: 'center', fontFamily: monoChip ? MONO : 'inherit', fontSize: LETRA.tick, fontWeight: 600, padding: '4px 10px', borderRadius: 8, background: 'var(--surface-2)', color: 'var(--dim)', whiteSpace: 'nowrap' }}>{chip}</span>
        )}
      </div>
      {secundaria && <div className="gr-numero-sec" title={secundaria}>{secundaria}</div>}
    </div>
  );
}

/**
 * Una KPI con su línea. En fila (el minigráfico, si hay 240 px o más): el número a la izquierda y la línea a la derecha,
 * con todo el alto de la tarjeta. En columna (la tendencia, o un minigráfico angosto): la línea debajo, con un alto
 * MÍNIMO — si el número y su chip ocupan todo, la línea se come el aire de abajo de la tarjeta en vez de desaparecer.
 */
function KpiConLinea({ arriba, linea, enFila }: { arriba: ReactNode; linea: (t: Tam) => ReactNode; enFila: boolean }) {
  const [ref, medida] = useMedida<HTMLDivElement>();
  const lado = enFila && (medida?.w ?? 0) >= 240;
  return (
    <div ref={ref} style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: lado ? 'row' : 'column', alignItems: lado ? 'center' : 'stretch', gap: lado ? 18 : 10 }}>
      <div style={lado ? { flex: '0 0 44%', minWidth: 0 } : { flex: 'none' }}>{arriba}</div>
      <div style={{ flex: 1, minWidth: 0, minHeight: lado ? 0 : 36, alignSelf: 'stretch', display: 'flex', flexDirection: 'column' }}>
        <AreaMedida>{linea}</AreaMedida>
      </div>
    </div>
  );
}

/**
 * Lo que hace clickeable a una fila de tabla: el clic, Enter y la mano. «Otros» no es una cosa: no abre nada.
 * Sin `role`: la fila sigue siendo una fila para el lector de pantalla; el foco con Tab alcanza.
 */
function propsFila(clave: string, alFila?: (clave: string) => void) {
  if (!alFila || clave === OTROS) return {};
  return {
    tabIndex: 0, style: { cursor: 'pointer' } as CSSProperties, onClick: () => alFila(clave),
    onKeyDown: (ev: KeyboardEvent<HTMLTableRowElement>) => { if (ev.key === 'Enter') { ev.preventDefault(); alFila(clave); } },
  };
}

function Dinamica({ r, rotulo, modo, color, total, compacto, alFila }: { r: Resultado; rotulo: string; modo: 'plana' | 'barras' | 'calor'; color: string; total: boolean; compacto: boolean; alFila?: (clave: string) => void }) {
  if (!r.cruce) return <Mensaje>Elige una dimensión de columna</Mensaje>;
  const f0 = r.columnas[0].formato;
  const todos = r.cruce.celdas.flat().map((v) => Math.abs(v ?? 0));
  const max = Math.max(0, ...todos);
  const totCol = r.cruce.claves.map((_, j) => r.cruce!.celdas.reduce((s, fila) => s + (fila[j] ?? 0), 0));
  return (
    <div className="gr-tabla gr-dinamica">
      <table>
        {/* La columna de los nombres, más ancha que las de números: con columnas iguales, en el celular las filas decían «Nu…». */}
        <colgroup><col className="gr-col-nombre" style={{ width: `${Math.max(26, Math.min(40, 100 / (r.cruce.claves.length + 2) * 1.6)).toFixed(0)}%` }} /></colgroup>
        <thead>
          {/* La esquina nombra lo que son las FILAS (la etapa), no la métrica: «Leads» arriba de «Nuevo, Agendó…» se leía mal. */}
          <tr><th className="gr-izq">{rotulo}</th>{r.cruce.claves.map((k) => <th key={k} title={k}>{k}</th>)}<th className="gr-col-total">Total</th></tr>
        </thead>
        <tbody>
          {r.filas.map((f, i) => (
            <tr key={f.clave} {...propsFila(f.clave, alFila)}>
              <td className="gr-izq gr-nombre" title={f.etiqueta}>{f.etiqueta}</td>
              {r.cruce!.celdas[i].map((v, j) => {
                const p = max ? Math.abs(v ?? 0) / max : 0;
                if (modo === 'barras') {
                  return <td key={j}><span className="gr-celda-barra"><span className="gr-num">{v ? fmtValor(v, f0, compacto) : ''}</span><span className="gr-pista">{p > 0 && <span style={{ width: `${Math.min(100, p * 100)}%`, background: color }} />}</span></span></td>;
                }
                return <td key={j} style={modo === 'calor' ? { background: `color-mix(in srgb, ${color} ${Math.round(p * 55)}%, transparent)`, color: 'var(--ink)' } : undefined}>{v ? fmtValor(v, f0, compacto) : ''}</td>;
              })}
              <td className="gr-fuerte gr-col-total">{fmtValor(f.valores[0], f0, compacto)}</td>
            </tr>
          ))}
          {total && (
            <tr className="gr-total">
              <td className="gr-izq">Total</td>
              {totCol.map((v, j) => <td key={j}>{fmtValor(v, f0, compacto)}</td>)}
              <td className="gr-col-total">{fmtValor(r.totales[0], f0, compacto)}</td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}

/**
 * La bala: el total, «de» su objetivo, y la barra con la marca del objetivo. Con lugar (420 px o más) van en UNA fila,
 * el número a la izquierda y la barra a la derecha; si no, apilados y más chicos. Antes iban siempre apilados con 28 px +
 * 12 + 24, y a su tamaño de nacimiento (6 × 3) la barra quedaba cortada por la mitad.
 */
function Bala({ v, objetivo, max, color, texto, textoObj }: { v: number; objetivo: number | null; max: number; color: string; texto: string; textoObj: string | null }) {
  const [ref, medida] = useMedida<HTMLDivElement>();
  const enFila = (medida?.w ?? 0) >= 420;
  const p = (x: number) => `${Math.min(100, Math.max(0, (x / max) * 100))}%`;
  return (
    <div ref={ref} style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: enFila ? 'row' : 'column', alignItems: enFila ? 'center' : 'stretch', justifyContent: 'center', gap: enFila ? 20 : 8 }}>
      <div style={{ flex: 'none', fontSize: enFila ? 28 : 24, lineHeight: 1.05, fontWeight: 600, letterSpacing: '-0.02em', color: 'var(--ink)', fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }}>
        {texto}{textoObj && <span style={{ fontSize: LETRA.leyenda, fontWeight: 500, color: 'var(--dim)', letterSpacing: 0 }}> de {textoObj}</span>}
      </div>
      <div style={{ position: 'relative', flex: enFila ? 1 : 'none', minWidth: 0, height: enFila ? 22 : 16, background: 'var(--surface-2)', borderRadius: 8, overflow: 'hidden' }}>
        <div style={{ position: 'absolute', inset: '0 auto 0 0', width: p(max * 0.66), background: 'var(--border)' }} />
        <div style={{ position: 'absolute', left: 0, top: '22%', bottom: '22%', width: p(v), background: color, borderRadius: 7 }} />
        {objetivo != null && <div style={{ position: 'absolute', top: 1, bottom: 1, width: 4, left: p(objetivo), background: 'var(--ink)', borderRadius: 2 }} />}
      </div>
    </div>
  );
}

function Indicador({ v, max, objetivo, color, rangos, texto }: { v: number; max: number; objetivo: number | null; color: string; rangos: boolean; texto: string }) {
  const ang = (x: number) => Math.PI * (1 - Math.min(1, Math.max(0, x / max)));
  const pt = (a: number, rr: number) => [100 + rr * Math.cos(a), 100 - rr * Math.sin(a)];
  const arco = (a0: number, a1: number, rr: number) => { const [x0, y0] = pt(a0, rr); const [x1, y1] = pt(a1, rr); return `M ${x0} ${y0} A ${rr} ${rr} 0 0 1 ${x1} ${y1}`; };
  const [nx, ny] = pt(ang(v), rangos ? 76 : 62);
  const [ax, ay] = pt(ang(v), 46);
  return (
    <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
      <svg viewBox="0 0 200 116" style={{ width: '100%', maxHeight: '100%' }} role="img" aria-label={texto}>
        {rangos ? (
          <>
            <path d={arco(Math.PI, Math.PI * 2 / 3, 80)} strokeWidth={20} fill="none" style={{ stroke: 'var(--bad)' }} />
            <path d={arco(Math.PI * 2 / 3, Math.PI / 3, 80)} strokeWidth={20} fill="none" style={{ stroke: 'var(--mako, #C8870C)' }} />
            <path d={arco(Math.PI / 3, 0, 80)} strokeWidth={20} fill="none" style={{ stroke: 'var(--good)' }} />
            {/* La aguja es un TRAMO que apunta al arco, no una línea desde el centro: desde el centro cruzaba el número. */}
            <line x1={ax} y1={ay} x2={nx} y2={ny} strokeWidth={5} strokeLinecap="round" style={{ stroke: 'var(--ink)' }} />
          </>
        ) : (
          <>
            <path d={arco(Math.PI, 0, 80)} strokeWidth={20} fill="none" strokeLinecap="round" style={{ stroke: 'var(--surface-2)' }} />
            <path d={arco(Math.PI, ang(v), 80)} strokeWidth={20} fill="none" strokeLinecap="round" style={{ stroke: color }} />
          </>
        )}
        {objetivo != null && (() => { const [a, b] = pt(ang(objetivo), 94); const [c2, d] = pt(ang(objetivo), 66); return <line x1={a} y1={b} x2={c2} y2={d} strokeWidth={3.5} style={{ stroke: 'var(--ink)' }} />; })()}
        <text x={100} y={96} textAnchor="middle" fontSize={24} fontWeight={600} style={{ fill: 'var(--ink)', fontVariantNumeric: 'tabular-nums' }}>{texto}</text>
      </svg>
    </div>
  );
}

/**
 * El embudo de las tabs viejas: trapecios de arriba a abajo, cada uno con su borde del color
 * base y el relleno aclarándose hacia arriba, y entre etapa y etapa el chip con cuánto pasa. Con
 * cuatro etapas, los cortes son los de antes; con otra cantidad, la misma curva.
 */
const CORTES_4 = [0, 16, 26, 35, 42];
const corte = (k: number, n: number) => (n === 4 ? CORTES_4[k] : 42 * (1 - Math.pow(1 - k / n, 1.6)));
/** Un escalón del embudo es una métrica: `alPaso(i)` es su clic, o null si esa métrica no tiene filas atrás. */
type AlPaso = (i: number) => (() => void) | null;

function EmbudoVertical({ pasos, base, compacto, alPaso }: { pasos: Array<{ nombre: string; valor: number; formato: Formato }>; base: string; compacto: boolean; alPaso?: AlPaso }) {
  const n = pasos.length;
  const clip = (i: number) => { const a = corte(i, n); const b = corte(i + 1, n); return `polygon(${a}% 0, ${100 - a}% 0, ${100 - b}% 100%, ${b}% 100%)`; };
  const tono = (i: number) => aclarar(base, n === 1 ? 1 : 0.21 + 0.79 * Math.pow(i / (n - 1), 1.3));
  return (
    <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', justifyContent: 'center', overflow: 'hidden' }}>
      {pasos.map((p, i) => {
        const pasa = i > 0 && pasos[i - 1].valor ? (p.valor / pasos[i - 1].valor) * 100 : null;
        return (
          <div key={p.nombre} style={{ display: 'contents' }}>
            {i > 0 && (
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '5px 0', flex: 'none' }}>
                <span style={{ fontFamily: MONO, fontSize: LETRA.tick, fontWeight: 600, color: 'var(--dim)', background: 'var(--surface-2)', padding: '2px 9px', borderRadius: 7 }}>
                  {pasa == null ? '—' : `↓ ${pasa.toLocaleString('es-AR', { maximumFractionDigits: pasa < 10 ? 1 : 0 })}%`}
                </span>
              </div>
            )}
            <Clic al={alPaso?.(i) ?? null} etiqueta={`Ver detalle: ${p.nombre}`} estilo={{ flex: '1 1 0', minHeight: 44, maxHeight: 92, background: base, clipPath: clip(i), padding: 2 }}>
              <div style={{ height: '100%', background: tono(i), clipPath: clip(i), display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', lineHeight: 1, minWidth: 0 }}>
                {/* Tinta fija: el relleno es claro también en el tema oscuro. */}
                <span style={{ fontSize: LETRA.leyenda, fontWeight: 500, color: '#454C57', marginBottom: 5, whiteSpace: 'nowrap' }}>{p.nombre}</span>
                <span style={{ fontWeight: 600, fontSize: 27, letterSpacing: '-0.02em', color: '#12151B', fontVariantNumeric: 'tabular-nums' }}>{fmtValor(p.valor, p.formato, compacto)}</span>
              </div>
            </Clic>
          </div>
        );
      })}
    </div>
  );
}

function EmbudoBarras({ pasos, vertical, color, compacto, alPaso }: { pasos: Array<{ nombre: string; valor: number; formato: Formato }>; vertical: boolean; color: (i: number) => string; compacto: boolean; alPaso?: AlPaso }) {
  const max = Math.max(1, ...pasos.map((p) => p.valor));
  return (
    <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: vertical ? 'row' : 'column', gap: 8, justifyContent: 'center', alignItems: vertical ? 'flex-end' : 'stretch', overflow: 'hidden' }}>
      {pasos.map((p, i) => {
        const conv = i > 0 && pasos[i - 1].valor ? Math.round((p.valor / pasos[i - 1].valor) * 100) : null;
        const tam = `${Math.min(100, Math.max(2, (p.valor / max) * 100))}%`;
        const al = alPaso?.(i) ?? null;
        return vertical ? (
          <Clic key={p.nombre} al={al} etiqueta={`Ver detalle: ${p.nombre}`} estilo={{ flex: 1, height: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'flex-end', alignItems: 'center', gap: 6, minWidth: 0 }}>
            <span style={{ fontSize: LETRA.etiqueta, fontWeight: 600, color: 'var(--ink)', fontVariantNumeric: 'tabular-nums' }}>{fmtValor(p.valor, p.formato, compacto)}</span>
            <div style={{ width: '70%', height: tam, background: color(i), borderRadius: '8px 8px 0 0' }} />
            <span style={{ fontSize: LETRA.tick, color: 'var(--dim)', textAlign: 'center' }}>{p.nombre}</span>
            {/* El primer escalón no tiene de dónde pasar: lleva el chip invisible, así su nombre queda a la altura de los otros. */}
            <span style={{ fontFamily: MONO, fontSize: LETRA.tick, fontWeight: 600, color: 'var(--dim)', background: 'var(--surface-2)', padding: '1px 7px', borderRadius: 6, visibility: conv == null ? 'hidden' : undefined }}>↓ {conv ?? 0}%</span>
          </Clic>
        ) : (
          <Clic key={p.nombre} al={al} etiqueta={`Ver detalle: ${p.nombre}`} estilo={{ display: 'grid', gridTemplateColumns: 'minmax(80px, 30%) 1fr', alignItems: 'center', gap: 12 }}>
            <span style={{ fontSize: LETRA.leyenda, color: 'var(--dim)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.nombre}</span>
            <div style={{ display: 'flex', justifyContent: 'center' }}>
              {/* minWidth: el número entra siempre; un escalón chico se estira lo justo en vez de cortar «42 · 45%» por la mitad. */}
              <div style={{ width: tam, minWidth: 'max-content', background: color(i), color: '#fff', fontSize: LETRA.leyenda, fontWeight: 600, padding: '7px 10px', textAlign: 'center', borderRadius: 8, whiteSpace: 'nowrap', fontVariantNumeric: 'tabular-nums' }}>
                {fmtValor(p.valor, p.formato, compacto)}{conv != null ? ` · ${conv}%` : ''}
              </div>
            </div>
          </Clic>
        );
      })}
    </div>
  );
}

/** Un texto cortado a `n` letras con «…» (un nombre cortado sin la marca se lee como otro nombre: «Prueba de anun»). */
const conTope = (s: string, n: number) => (s.length > n ? `${s.slice(0, Math.max(1, n - 1))}…` : s);
type CeldaProps = { x?: number; y?: number; width?: number; height?: number; name?: string; size?: number; fill?: string; formato: Formato; compacto: boolean; halo: string };
function CeldaTreemap({ x = 0, y = 0, width = 0, height = 0, name, size, fill, formato, compacto, halo }: CeldaProps) {
  return (
    <g>
      <rect x={x} y={y} width={width} height={height} strokeWidth={3} rx={8} style={{ fill, stroke: halo }} />
      {width >= 90 && height >= 44 && (
        <>
          <text x={x + 10} y={y + 22} fontSize={LETRA.etiqueta} fontWeight={600} style={{ fill: '#fff' }}>{conTope(String(name ?? ''), Math.floor((width - 16) / (LETRA.etiqueta * 0.6)))}</text>
          <text x={x + 10} y={y + 40} fontSize={LETRA.leyenda} style={{ fill: '#fff', fontVariantNumeric: 'tabular-nums' }} opacity={0.92}>{fmtValor(size ?? 0, formato, compacto || true)}</text>
        </>
      )}
    </g>
  );
}

type NodoProps = { x?: number; y?: number; width?: number; height?: number; payload?: { name?: string }; medio: number; colorDe: (nombre: string) => string | null; letras: (lado: 'izq' | 'der') => number };
/** Un nodo del sankey: los de la izquierda con su color y el nombre a su izquierda; los de la derecha, neutros y con el nombre a la derecha. */
function NodoSankey({ x = 0, y = 0, width = 0, height = 0, payload, medio, colorDe, letras }: NodoProps) {
  const nombre = String(payload?.name ?? '');
  const izq = x + width / 2 < medio;
  const tope = letras(izq ? 'izq' : 'der');
  const texto = nombre.trim().length > tope ? `${nombre.trim().slice(0, tope - 1)}…` : nombre.trim();
  return (
    <g>
      <rect x={x} y={y} width={width} height={height} rx={4} style={{ fill: (izq ? colorDe(nombre) : null) ?? 'var(--border-strong)' }} />
      <text x={izq ? x - 8 : x + width + 8} y={y + height / 2} textAnchor={izq ? 'end' : 'start'} dominantBaseline="central" fontSize={LETRA.leyenda} style={{ fill: 'var(--ink)' }}>
        <title>{nombre.trim()}</title>{texto}
      </text>
    </g>
  );
}

type EnlaceProps = { sourceX?: number; targetX?: number; sourceY?: number; targetY?: number; sourceControlX?: number; targetControlX?: number; linkWidth?: number; payload?: { source?: { name?: string } }; colorDe: (nombre: string) => string };
/** Un flujo del sankey, del color del nodo de donde sale. */
function EnlaceSankey({ sourceX = 0, targetX = 0, sourceY = 0, targetY = 0, sourceControlX = 0, targetControlX = 0, linkWidth = 0, payload, colorDe }: EnlaceProps) {
  const d = `M${sourceX},${sourceY} C${sourceControlX},${sourceY} ${targetControlX},${targetY} ${targetX},${targetY}`;
  return <path d={d} fill="none" strokeWidth={Math.max(1, linkWidth)} style={{ stroke: colorDe(String(payload?.source?.name ?? '')), strokeOpacity: 0.28 }} />;
}

/**
 * La torta y el anillo, con la leyenda en HTML: una línea por porción, el nombre cortado con «…» y su %. La de recharts
 * vivía ADENTRO del SVG: con nombres largos se comía la mitad del alto, el anillo quedaba del tamaño de una moneda y el
 * total del centro (que la daba por una línea) se dibujaba encima de la leyenda. Con lugar al costado (380 px o más y
 * bastante más ancho que alto) la leyenda va a la derecha; si no, debajo, con como mucho cinco líneas y «+ N más».
 */
function Torta({ datos, anillo, etiquetas, leyenda, halo, cursor, fmtTotal, fmt, alClic }: {
  datos: Array<{ etiqueta: string; valor: number; color: string }>; anillo: boolean; etiquetas: boolean; leyenda: boolean; halo: string; cursor?: string;
  fmtTotal: (v: number) => string; fmt: (v: number) => string; alClic?: (i: number) => void;
}) {
  const [ref, medida] = useMedida<HTMLDivElement>();
  const w = medida?.w ?? 0;
  const h = medida?.h ?? 0;
  const alLado = w >= 380 && w >= h * 1.35;
  const total = datos.reduce((s, d) => s + d.valor, 0);
  const pct = (v: number) => (total ? Math.round((v / total) * 100) : 0);
  const tope = alLado ? 8 : 5;
  const vistas = datos.length > tope ? datos.slice(0, tope - 1) : datos;
  return (
    <div ref={ref} style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: alLado ? 'row' : 'column', gap: 14 }}>
      <div style={{ flex: 1, minWidth: 0, minHeight: 0, display: 'flex', flexDirection: 'column' }}>
        <AreaMedida>
          {(t) => (
            <PieChart width={t.w} height={t.h} cursor={cursor}>
              <Pie data={datos} dataKey="valor" nameKey="etiqueta" innerRadius={anillo ? '64%' : 0} outerRadius="92%" paddingAngle={anillo ? 2 : 0} cornerRadius={anillo ? 6 : 0}
                isAnimationActive={false} stroke={halo} strokeWidth={2}
                onClick={alClic ? (_d: unknown, i: number) => alClic(i) : undefined}
                label={etiquetas ? (p: { value?: number; cx?: number; cy?: number; midAngle?: number; innerRadius?: number; outerRadius?: number }) => {
                  const v = p.value ?? 0;
                  if (pct(v) < 7 || p.cx == null || p.cy == null || p.midAngle == null) return null;
                  const rr = ((p.innerRadius ?? 0) + (p.outerRadius ?? 0)) / 2;
                  const a = (-p.midAngle * Math.PI) / 180;
                  return <text x={p.cx + rr * Math.cos(a)} y={p.cy + rr * Math.sin(a)} textAnchor="middle" dominantBaseline="central" fontSize={LETRA.tick} fontWeight={600} style={{ fill: '#fff' }}>{pct(v)}%</text>;
                } : false} labelLine={false}>
                {datos.map((d, i) => <Cell key={i} fill={d.color} />)}
              </Pie>
              {anillo && Math.min(t.w, t.h) >= 110 && (() => {
                // El total entra en el HUECO del anillo (64 % del radio de 92 %): la letra sale de ese ancho, no de un número fijo.
                const texto = fmtTotal(total);
                const hueco = Math.min(t.w, t.h) * 0.92 * 0.64 * 0.86;
                const tam = Math.min(LETRA.panelNumero, Math.floor(hueco / (0.6 * Math.max(3, [...texto].length))));
                return tam >= LETRA_MINIMA ? (
                  <text x={t.w / 2} y={t.h / 2} textAnchor="middle" dominantBaseline="central" fontSize={tam} fontWeight={600}
                    style={{ fill: 'var(--ink)', fontVariantNumeric: 'tabular-nums' }}>{texto}</text>
                ) : null;
              })()}
              <Tooltip contentStyle={TIP} formatter={(v, n) => [`${fmt(Number(v) || 0)} · ${pct(Number(v) || 0)}%`, String(n)]} />
            </PieChart>
          )}
        </AreaMedida>
      </div>
      {leyenda && (
        <ul className="gr-leyenda" data-lado={alLado ? '' : undefined}>
          {vistas.map((d) => (
            <li key={d.etiqueta}><span className="gr-punto" style={{ background: d.color }} /><span className="gr-leyenda-nombre" title={d.etiqueta}>{d.etiqueta}</span><b>{pct(d.valor)}%</b></li>
          ))}
          {vistas.length < datos.length && <li className="gr-leyenda-mas">+ {datos.length - vistas.length} más</li>}
        </ul>
      )}
    </div>
  );
}
