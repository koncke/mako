'use client';

// =============================================================================
// Grafico — dibuja UN componente del Dashboard a partir de lo que devolvió el server
// =============================================================================
// No sabe de fuentes ni de la base: recibe el `Resultado` de lib/graficos-agregar.ts y lo pinta
// según el tipo, con el ESTILO del gráfico (colores, etiquetas, leyenda, ejes, cuadrícula,
// formato). Llena la celda de la grilla: el alto lo pone react-grid-layout, así que la caja es
// flex en columna y el área estira con `flex: 1; min-height: 0` (AGENTS.md: `height: 100%`
// contra un alto de flex no resuelve en Safari).
//
// El EDITOR es de Looker; los GRÁFICOS son de MaKo. Martín, 11/10/2026: «Quiero que los
// graficos editables se parezcan más a esos que a los que me propusiste, tengan ese diseño» —
// «esos» son los de las tabs viejas de Marketing y Comercial: el número de 44 px con su rótulo
// en mono y mayúsculas, el chip contra el período anterior, el embudo de trapecios con la caída
// entre etapas, y los ejes, la grilla y los tooltips con los tokens de la app (que además se dan
// vuelta solos en el tema oscuro).
//
// INTERACTIVO (punto 5: «Los gráficos interactivos...»). Con `onDetalle`, un clic en una KPI, una barra,
// una porción, una fila de tabla, un punto de una serie o un escalón del embudo avisa QUÉ se clickeó
// (lib/graficos-acciones.ts, `SelDetalle`) y la pantalla abre el detalle (./Detalle.tsx). El cursor de
// mano sale sólo donde un clic hace algo: una KPI cuyo número no tiene filas atrás (las vistas del VSL)
// no se dibuja clickeable. Y la LEYENDA prende y apaga series (estado local, no se guarda; la última no
// se apaga): es lo que hacía el selector de métricas de la vieja Tendencias.

import { useState, type CSSProperties, type KeyboardEvent, type ReactElement, type ReactNode } from 'react';
import {
  ResponsiveContainer, LineChart, Line, BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis, ZAxis, Tooltip, CartesianGrid, Legend,
  AreaChart, Area, ComposedChart, ScatterChart, Scatter, Treemap, Sankey, FunnelChart, Funnel, LabelList,
} from 'recharts';
import { Spinner } from '@/app/_ui';
import { destinoDetalle, tipoDe, tonoDe, type Formato, type Grafico as G } from '@/lib/graficos-catalogo';
import { alternarSerie, serieOculta, type SelDetalle } from '@/lib/graficos-acciones';
import { colorDeTono, estiloEfectivo, type TemaHoja } from '@/lib/graficos-temas';
import dynamic from 'next/dynamic';

// El mapa baja su geometría (d3-geo + el GeoJSON): sólo se carga si la hoja tiene un mapa.
const MapaMexico = dynamic(() => import('./MapaMexico'), { ssr: false });
import { chipComparar, fmtValor, histograma, OTROS, type Resultado } from '@/lib/graficos-agregar';

export const MONO = "'Geist Mono', monospace";
const GRIS = 'var(--border-strong)';
const TIP = { background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 10, fontSize: 13, color: 'var(--ink)', boxShadow: '0 6px 20px rgba(18,21,27,.08)', padding: '8px 12px' };
const TIP_ETIQUETA = { color: 'var(--dim)', fontFamily: MONO, fontSize: 11.5, marginBottom: 4 };
const EJE = { fill: 'var(--faint)', fontSize: 11.5, fontFamily: MONO };
const GRILLA = { stroke: 'var(--border)', strokeDasharray: '3 3' };

export type EstadoDatos = { cargando: boolean; error?: string; resultado?: Resultado };

/** ¿Este tipo se dibuja como una tarjeta de número (rótulo en mono, filete arriba)? */
export const esTarjetaNumero = (tipo: string) => tipoDe(tipo)?.grupo === 'Cuadro de resultados';

function Mensaje({ children }: { children: ReactNode }) {
  return <div style={{ flex: 1, display: 'grid', placeItems: 'center', color: 'var(--faint)', fontSize: 13.5, textAlign: 'center', padding: 8 }}>{children}</div>;
}

/** El área del gráfico: estira con flex y le da a recharts una caja con medida. */
function Area0({ children }: { children: ReactElement }) {
  return (
    <div style={{ flex: 1, minHeight: 0, position: 'relative' }}>
      <div style={{ position: 'absolute', inset: 0 }}>
        <ResponsiveContainer>{children}</ResponsiveContainer>
      </div>
    </div>
  );
}

function vacio(r: Resultado): boolean {
  return !r.filas.length ? r.totales.every((v) => !v) : r.filas.every((f) => f.valores.every((v) => !v));
}

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
      r.cruce!.celdas[i].forEach((v, j) => { o[`c${j}`] = v; });
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

/**
 * El cuerpo de un gráfico. El estilo sale ENTERO del tema de la hoja (punto 8): el gráfico sólo aporta
 * su contenido (título, subtítulo, comparar, objetivo, total) y el color de una KPI sale de lo que
 * significa su métrica (`tonoDe`).
 *
 * `onDetalle` (opcional): con él, el gráfico es clickeable — ver la cabecera. Quien lo monta lo pasa sólo
 * mirando: editando, un clic selecciona la tarjeta.
 */
export function CuerpoGrafico({ g, estado, tema, onDetalle }: { g: G; estado: EstadoDatos; tema: TemaHoja; onDetalle?: (sel: SelDetalle) => void }) {
  // Las series apagadas desde la leyenda. Estado de la VISTA: no se guarda en el informe.
  // (Arriba de todo: un hook detrás de un `return` es la pantalla en blanco de AGENTS.md.)
  const [ocultas, setOcultas] = useState<ReadonlySet<string>>(() => new Set());
  const r = estado.resultado;
  if (!r) return <Mensaje>{estado.error ?? <Spinner size={20} />}</Mensaje>;
  if (estado.error) return <Mensaje>{estado.error}</Mensaje>;
  const e = estiloEfectivo(tema);
  const tono = colorDeTono(tonoDe(g.fuente, g.metricas[0]), tema);
  const c = (i: number, etiqueta?: string) => (etiqueta === OTROS ? GRIS : e.colores[i % e.colores.length]);
  const info = tipoDe(g.tipo);
  const fmt = (v: number | null, f: Formato) => fmtValor(v, f, e.compacto);
  const tick = (f: Formato) => (v: number) => fmtValor(v, f, true);
  const posLeyenda = {
    verticalAlign: e.leyenda === 'abajo' ? 'bottom' : e.leyenda === 'derecha' ? 'middle' : 'top',
    align: e.leyenda === 'derecha' ? 'right' : 'left',
    layout: e.leyenda === 'derecha' ? 'vertical' : 'horizontal',
  } as const;
  const estiloLeyenda: CSSProperties = { fontSize: 12.5, color: 'var(--dim)', paddingBottom: e.leyenda === 'arriba' ? 8 : 0 };
  const leyenda = e.leyenda === 'no' ? null : <Legend {...posLeyenda} iconType="circle" iconSize={8} wrapperStyle={estiloLeyenda} />;

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
  // La leyenda prende y apaga series; la última no se apaga (lib/graficos-acciones.ts, con test).
  const oculta = (k: string, claves: string[]) => serieOculta(ocultas, k, claves);
  const leyendaDe = (claves: string[]) => {
    if (e.leyenda === 'no') return null;
    if (claves.length < 2) return leyenda;
    return (
      <Legend {...posLeyenda} iconType="circle" iconSize={8} inactiveColor="var(--faint)" wrapperStyle={{ ...estiloLeyenda, cursor: 'pointer' }}
        // La leyenda vive adentro del gráfico: sin frenar el clic, también le llegaría al `onClick` del gráfico.
        onClick={(p, _i, ev) => { ev.stopPropagation(); setOcultas((prev) => alternarSerie(prev, String(p.dataKey ?? ''), claves)); }} />
    );
  };

  // ── Cuadros de resultados: la KPI de las tabs viejas ──
  if (info?.grupo === 'Cuadro de resultados' || g.tipo === 'serie_sparkline') {
    const col = r.columnas[0];
    const compacto = g.tipo === 'numero_compacto' || e.compacto;
    const v = r.totales[0];
    const texto = col ? fmtValor(v, col.formato, compacto) : '—';
    const tam = g.tipo === 'numero_compacto' ? 30 : g.tipo === 'serie_sparkline' ? 32 : e.kpiTamValor;
    // El número se achica para entrar en la tarjeta (unidades del contenedor), nunca se corta.
    const caracteres = Math.max(4, texto.length);
    const chip = g.comparar ? chipComparar(v, r.anterior?.[0] ?? null) : null;
    const centro = false;
    const grande = (
      <div style={{ containerType: 'inline-size', width: '100%' }}>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 12, flexWrap: 'wrap', justifyContent: centro ? 'center' : 'flex-start' }}>
          <span style={{
            fontWeight: 600, fontSize: `min(${tam}px, calc(100cqw / ${(caracteres * 0.6).toFixed(2)}))`, lineHeight: 0.9, letterSpacing: '-0.03em',
            // Como antes: el número toma el color del filete sólo cuando hay algo (un «US$0» no va en verde).
            color: v == null ? 'var(--faint)' : tono && v > 0 ? tono : 'var(--ink)', fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap',
          }}>{texto}</span>
          {chip && (
            <span title="Contra el período anterior" style={{ display: 'inline-flex', alignItems: 'center', fontFamily: MONO, fontSize: 13, fontWeight: 600, padding: '4px 10px', borderRadius: 8, background: 'var(--surface-2)', color: 'var(--dim)', whiteSpace: 'nowrap' }}>{chip}</span>
          )}
        </div>
      </div>
    );
    const sub = g.subtitulo ? (
      <div style={{ fontFamily: MONO, fontSize: 13, color: 'var(--faint)', marginTop: 16, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', textAlign: centro ? 'center' : 'left' }} title={g.subtitulo}>{g.subtitulo}</div>
    ) : null;
    // La KPI entera abre lo que hay atrás del número (el «Ad Spend · por anuncio» de la tab vieja).
    const alKpi = abrirMetrica(col?.id);
    if (g.tipo === 'numero_tendencia' || g.tipo === 'serie_sparkline') {
      const datos = g.tipo === 'serie_sparkline' ? r.filas.map((f) => ({ etiqueta: f.etiqueta, valor: f.valores[0] })) : (r.serie ?? []).map((s) => ({ etiqueta: s.etiqueta, valor: s.valor }));
      const gid = `spark-${g.id}`;
      return (
        <Clic al={alKpi} etiqueta="Ver detalle" estilo={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', gap: 10 }}>
          {grande}
          <Area0>
            <AreaChart data={datos} margin={{ top: 4, right: 2, bottom: 2, left: 2 }}>
              <defs>
                <linearGradient id={gid} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={c(0)} stopOpacity={0.28} />
                  <stop offset="100%" stopColor={c(0)} stopOpacity={0} />
                </linearGradient>
              </defs>
              <Area type="monotone" dataKey="valor" stroke={c(0)} strokeWidth={2.5} fill={`url(#${gid})`} dot={false} isAnimationActive={false} />
              <Tooltip contentStyle={TIP} labelStyle={TIP_ETIQUETA} formatter={(x) => [fmt(typeof x === 'number' ? x : null, col?.formato ?? 'numero'), col?.nombre ?? '']} labelFormatter={(l) => String(l)} />
            </AreaChart>
          </Area0>
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
      return (
        <Area0>
          <FunnelChart cursor={abreAlguno ? 'pointer' : undefined}>
            <Tooltip contentStyle={TIP} formatter={(v, n) => [fmt(typeof v === 'number' ? v : null, 'numero'), String(n)]} />
            <Funnel dataKey="valor" nameKey="nombre" data={pasos.map((p, i) => ({ ...p, fill: c(i) }))} isAnimationActive={false}
              onClick={abreAlguno ? (_d: unknown, i: number) => alPaso(i)?.() : undefined}>
              <LabelList position="right" fill="var(--dim)" stroke="none" dataKey="nombre" fontSize={12.5} />
              <LabelList position="center" fill="#fff" stroke="none" dataKey="valor" fontSize={13} fontWeight={600} formatter={(v: unknown) => fmtValor(Number(v), 'numero', true)} />
            </Funnel>
          </FunnelChart>
        </Area0>
      );
    }
    return <EmbudoBarras pasos={pasos} vertical={g.tipo === 'embudo_columnas'} color={c} compacto={e.compacto} alPaso={alPaso} />;
  }

  if (vacio(r)) return <Mensaje>Sin datos en este período</Mensaje>;

  // ── Mapa: la región ──
  if (g.tipo === 'mapa') {
    const col = r.columnas[0];
    return <MapaMexico regiones={r.filas.map((f) => ({ etiqueta: f.etiqueta, valor: f.valores[0] ?? 0 }))} color={c(0)} fmt={(v) => fmtValor(v, col?.formato ?? 'numero', true)} />;
  }

  // ── Tablas ──
  const alFila = grupoAbre ? (clave: string) => abrirGrupo(clave) : undefined;
  if (info?.grupo === 'Tabla') return <Tabla r={r} modo={g.tipo === 'tabla_barras' ? 'barras' : g.tipo === 'tabla_calor' ? 'calor' : 'plana'} color={c(0)} total={g.total} compacto={e.compacto} alFila={alFila} />;
  if (info?.grupo === 'Tabla dinámica') return <Dinamica r={r} modo={g.tipo === 'dinamica_barras' ? 'barras' : g.tipo === 'dinamica_calor' ? 'calor' : 'plana'} color={c(0)} total={g.total} compacto={e.compacto} alFila={alFila} />;

  // ── Circular ──
  if (info?.grupo === 'Circular') {
    const col = r.columnas[0];
    const datos = r.filas.map((f) => ({ etiqueta: f.etiqueta, valor: f.valores[0] ?? 0 }));
    const total = datos.reduce((s, d) => s + d.valor, 0);
    return (
      <Area0>
        <PieChart cursor={cursorGrupo}>
          <Pie data={datos} dataKey="valor" nameKey="etiqueta" innerRadius={g.tipo === 'anillo' ? '58%' : 0} outerRadius="85%" isAnimationActive={false} stroke="var(--surface)" strokeWidth={2}
            onClick={grupoAbre ? (_d: unknown, i: number) => abrirGrupo(r.filas[i]?.clave) : undefined}
            label={e.etiquetas ? (p: { value?: number }) => `${total ? Math.round(((p.value ?? 0) / total) * 100) : 0}%` : false} labelLine={false}>
            {datos.map((d, i) => <Cell key={i} fill={c(i, d.etiqueta)} />)}
          </Pie>
          <Tooltip contentStyle={TIP} formatter={(v, n) => [`${fmt(typeof v === 'number' ? v : null, col.formato)} · ${total ? Math.round(((Number(v) || 0) / total) * 100) : 0}%`, String(n)]} />
          {leyenda}
        </PieChart>
      </Area0>
    );
  }

  // ── Rectángulos ──
  if (g.tipo === 'rectangulos') {
    const col = r.columnas[0];
    const datos = r.filas.map((f, i) => ({ name: f.etiqueta, size: Math.max(0, f.valores[0] ?? 0), fill: c(i, f.etiqueta) }));
    return (
      <Area0>
        <Treemap data={datos} dataKey="size" nameKey="name" isAnimationActive={false} stroke="var(--surface)"
          onClick={grupoAbre ? (n) => abrirGrupo(n.name) : undefined} style={grupoAbre ? { cursor: 'pointer' } : undefined}
          content={<CeldaTreemap formato={col.formato} compacto={e.compacto} />} />
      </Area0>
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
    return (
      <Area0>
        <Sankey data={{ nodes, links }} nodePadding={14} nodeWidth={10} link={{ stroke: c(0), strokeOpacity: 0.22 }} node={<NodoSankey color={c(0)} />} margin={{ top: 8, right: 120, bottom: 8, left: 8 }}>
          <Tooltip contentStyle={TIP} />
        </Sankey>
      </Area0>
    );
  }

  // ── Dispersión y burbujas ──
  if (info?.grupo === 'Dispersión') {
    const [cx, cy, cz] = r.columnas;
    const datos = r.filas.map((f) => ({ etiqueta: f.etiqueta, x: f.valores[0] ?? 0, y: f.valores[1] ?? 0, z: f.valores[2] ?? 1 }));
    return (
      <Area0>
        <ScatterChart margin={{ top: 8, right: 12, bottom: 8, left: 4 }}>
          {e.cuadricula && <CartesianGrid {...GRILLA} />}
          <XAxis type="number" dataKey="x" name={cx.nombre} tick={EJE} tickFormatter={tick(cx.formato)} axisLine={false} tickLine={false} hide={!e.ejes} />
          <YAxis type="number" dataKey="y" name={cy.nombre} tick={EJE} tickFormatter={tick(cy.formato)} width={58} axisLine={false} tickLine={false} hide={!e.ejes} />
          {g.tipo === 'burbujas' && <ZAxis type="number" dataKey="z" range={[40, 900]} name={cz?.nombre} />}
          <Tooltip contentStyle={TIP} cursor={{ strokeDasharray: '3 3' }}
            formatter={(v, n) => { const col = [cx, cy, cz].find((x) => x?.nombre === n); return [fmt(typeof v === 'number' ? v : null, col?.formato ?? 'numero'), String(n)]; }}
            labelFormatter={() => ''} />
          <Scatter data={datos} fill={c(0)} fillOpacity={0.8} isAnimationActive={false}>
            {e.etiquetas && <LabelList dataKey="etiqueta" position="top" fontSize={11} fill="var(--dim)" />}
          </Scatter>
        </ScatterChart>
      </Area0>
    );
  }

  // ── Histograma ──
  if (g.tipo === 'histograma') {
    const col = r.columnas[0];
    const franjas = histograma(r.filas.map((f) => f.valores[0] ?? 0)).map((x) => ({ ...x, etiqueta: `${fmtValor(x.desde, col.formato, true)}–${fmtValor(x.hasta, col.formato, true)}` }));
    return (
      <Area0>
        <BarChart data={franjas} margin={{ top: 8, right: 8, bottom: 0, left: 0 }} barCategoryGap={2}>
          {e.cuadricula && <CartesianGrid {...GRILLA} vertical={false} />}
          <XAxis dataKey="etiqueta" tick={EJE} interval="preserveStartEnd" axisLine={false} tickLine={false} hide={!e.ejes} />
          <YAxis tick={EJE} allowDecimals={false} width={40} axisLine={false} tickLine={false} hide={!e.ejes} />
          <Tooltip contentStyle={TIP} cursor={{ fill: 'var(--surface-2)' }} formatter={(v) => [String(v), 'Cantidad']} />
          <Bar dataKey="cuantos" name="Cantidad" fill={c(0)} radius={[4, 4, 0, 0]} isAnimationActive={false}>
            {e.etiquetas && <LabelList dataKey="cuantos" position="top" fontSize={11} fill="var(--dim)" />}
          </Bar>
        </BarChart>
      </Area0>
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
      <Area0>
        <BarChart data={datos} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
          {e.cuadricula && <CartesianGrid {...GRILLA} vertical={false} />}
          <XAxis dataKey="etiqueta" tick={EJE} interval="preserveStartEnd" axisLine={false} tickLine={false} hide={!e.ejes} />
          <YAxis tick={EJE} tickFormatter={tick(col.formato)} width={58} axisLine={false} tickLine={false} hide={!e.ejes} />
          <Tooltip contentStyle={TIP} cursor={{ fill: 'var(--surface-2)' }} formatter={(_v, _n, it) => [fmt((it?.payload as { v?: number })?.v ?? null, col.formato), col.nombre]} />
          <Bar dataKey="base" stackId="c" fill="transparent" isAnimationActive={false} />
          <Bar dataKey="alto" stackId="c" radius={[3, 3, 0, 0]} isAnimationActive={false}>
            {datos.map((d, i) => <Cell key={i} fill={i === datos.length - 1 ? c(0) : d.sube ? 'var(--good)' : 'var(--bad)'} />)}
          </Bar>
        </BarChart>
      </Area0>
    );
  }

  // ── Cronología: cuándo empezó y terminó cada grupo ──
  if (g.tipo === 'cronologia') {
    const dia = (s?: string) => (s ? Math.round(Date.parse(`${s}T12:00:00Z`) / 86_400_000) : 0);
    const filas = r.filas.filter((f) => f.desde);
    if (!filas.length) return <Mensaje>Sin datos en este período</Mensaje>;
    const datos = filas.map((f) => ({ etiqueta: f.etiqueta, rango: [dia(f.desde), dia(f.hasta) + 1] as [number, number] }));
    const fecha = (n: number) => { const d = new Date(n * 86_400_000); return `${String(d.getUTCDate()).padStart(2, '0')}/${String(d.getUTCMonth() + 1).padStart(2, '0')}`; };
    return (
      <Area0>
        <BarChart data={datos} layout="vertical" margin={{ top: 8, right: 12, bottom: 0, left: 0 }}>
          {e.cuadricula && <CartesianGrid {...GRILLA} horizontal={false} />}
          <XAxis type="number" domain={['dataMin', 'dataMax']} tick={EJE} tickFormatter={fecha} axisLine={false} tickLine={false} hide={!e.ejes} />
          <YAxis type="category" dataKey="etiqueta" tick={{ ...EJE, fontFamily: 'inherit', fill: 'var(--dim)', fontSize: 12.5 }} width={130} axisLine={false} tickLine={false} tickFormatter={(v: string) => (v.length > 20 ? `${v.slice(0, 19)}…` : v)} />
          <Tooltip contentStyle={TIP} cursor={{ fill: 'var(--surface-2)' }} formatter={(v) => { const [a, b] = v as [number, number]; return [`${fecha(a)} → ${fecha(b - 1)}`, 'Del … al …']; }} />
          <Bar dataKey="rango" fill={c(0)} isAnimationActive={false} radius={4} />
        </BarChart>
      </Area0>
    );
  }

  // ── Ejes: series, líneas, áreas, columnas, barras y combinados ──
  const s = series(r);
  const formatos = [...new Set(s.formatos)].slice(0, 2);
  const eje = (f: Formato) => (formatos.indexOf(f) <= 0 ? 'a' : 'b');
  const ejesY = formatos.map((f, i) => (
    <YAxis key={f} yAxisId={i === 0 ? 'a' : 'b'} orientation={i === 0 ? 'left' : 'right'} tick={EJE} width={72} tickFormatter={tick(f)} axisLine={false} tickLine={false} hide={!e.ejes} />
  ));
  const fmtTip = (v: unknown, nombre: unknown) => {
    const i = s.nombres.indexOf(String(nombre));
    return [fmt(typeof v === 'number' ? v : null, s.formatos[Math.max(0, i)] ?? 'numero'), String(nombre)] as [string, string];
  };
  const etiquetas = (k: string, i: number) => (e.etiquetas ? <LabelList dataKey={k} position="top" fontSize={10.5} fontFamily={MONO} fill="var(--dim)" formatter={(v: unknown) => fmtValor(Number(v), s.formatos[i], true)} /> : null);
  const grilla = e.cuadricula ? <CartesianGrid {...GRILLA} vertical={false} /> : null;
  const ejeX = <XAxis dataKey="etiqueta" tick={EJE} interval="preserveStartEnd" minTickGap={24} axisLine={false} tickLine={false} hide={!e.ejes} />;
  const cien = g.tipo.endsWith('_100');
  const pct = (v: number) => `${Math.round(v * 100)}%`;
  const ejesY100 = <YAxis yAxisId="a" tick={EJE} width={44} tickFormatter={pct} axisLine={false} tickLine={false} hide={!e.ejes} />;
  const tip = <Tooltip contentStyle={TIP} labelStyle={TIP_ETIQUETA} formatter={fmtTip} cursor={{ stroke: 'var(--border-strong)', strokeDasharray: '3 3' }} />;
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

  if (info?.grupo === 'Serie temporal' || g.tipo === 'lineas' || g.tipo === 'lineas_suaves') {
    const curva = g.tipo === 'serie_suave' || g.tipo === 'lineas_suaves' ? 'monotone' : 'linear';
    return (
      <Area0>
        <LineChart data={s.datos} margin={{ top: 10, right: 8, bottom: 0, left: 0 }} onClick={alPunto} cursor={cursorGrupo}>
          {grilla}{ejeX}{ejesY}
          {tip}
          {ley}
          {s.claves.map((k, i) => (
            <Line key={k} yAxisId={eje(s.formatos[i])} type={curva} dataKey={k} name={s.nombres[i]} stroke={c(i, s.nombres[i])} strokeWidth={e.trazo} dot={false}
              hide={oculta(k, s.claves)} activeDot={{ r: 4, strokeWidth: 2, stroke: 'var(--surface)' }} isAnimationActive={false} connectNulls>
              {etiquetas(k, i)}
            </Line>
          ))}
        </LineChart>
      </Area0>
    );
  }

  if (info?.grupo === 'Áreas') {
    const apilada = g.tipo !== 'area';
    return (
      <Area0>
        <AreaChart data={s.datos} margin={{ top: 10, right: 8, bottom: 0, left: 0 }} stackOffset={cien ? 'expand' : 'none'} onClick={alPunto} cursor={cursorGrupo}>
          <defs>
            {s.claves.map((k, i) => (
              <linearGradient key={k} id={`ar-${g.id}-${i}`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={c(i, s.nombres[i])} stopOpacity={apilada ? 0.75 : 0.3} />
                <stop offset="100%" stopColor={c(i, s.nombres[i])} stopOpacity={apilada ? 0.45 : 0} />
              </linearGradient>
            ))}
          </defs>
          {grilla}{ejeX}{cien ? ejesY100 : ejesY}
          {tip}
          {ley}
          {s.claves.map((k, i) => (
            <Area key={k} yAxisId={cien ? 'a' : eje(s.formatos[i])} type="monotone" dataKey={k} name={s.nombres[i]} stackId={apilada ? 'a' : undefined}
              hide={oculta(k, s.claves)} stroke={c(i, s.nombres[i])} strokeWidth={e.trazo} fill={`url(#ar-${g.id}-${i})`} isAnimationActive={false} connectNulls />
          ))}
        </AreaChart>
      </Area0>
    );
  }

  if (g.tipo === 'combinado' || g.tipo === 'combinado_apilado') {
    // Las métricas en columnas y la última en línea (con su propio eje si es de otro formato).
    const nBarras = g.tipo === 'combinado' ? 1 : Math.max(1, s.claves.length - 1);
    return (
      <Area0>
        <ComposedChart data={s.datos} margin={{ top: 10, right: 8, bottom: 0, left: 0 }} onClick={alPunto} cursor={cursorGrupo}>
          {grilla}{ejeX}{ejesY}
          <Tooltip contentStyle={TIP} labelStyle={TIP_ETIQUETA} formatter={fmtTip} cursor={{ fill: 'var(--surface-2)' }} />
          {ley}
          {s.claves.map((k, i) => (i < nBarras ? (
            <Bar key={k} yAxisId={eje(s.formatos[i])} dataKey={k} name={s.nombres[i]} fill={c(i)} stackId={g.tipo === 'combinado_apilado' ? 'a' : undefined}
              hide={oculta(k, s.claves)} radius={g.tipo === 'combinado_apilado' ? 0 : [4, 4, 0, 0]} isAnimationActive={false} maxBarSize={40}>{etiquetas(k, i)}</Bar>
          ) : (
            <Line key={k} yAxisId={eje(s.formatos[i])} type="monotone" dataKey={k} name={s.nombres[i]} stroke={c(i)} strokeWidth={e.trazo} dot={false} hide={oculta(k, s.claves)} isAnimationActive={false}>{etiquetas(k, i)}</Line>
          )))}
        </ComposedChart>
      </Area0>
    );
  }

  // Columnas y barras (sueltas, apiladas o al 100%).
  const horizontal = g.tipo.startsWith('barras');
  const apilada = g.tipo.includes('apiladas') || cien;
  const unaSola = s.claves.length === 1 && !r.cruce;
  const radio: [number, number, number, number] | number = apilada ? 0 : horizontal ? [0, 4, 4, 0] : [4, 4, 0, 0];
  return (
    <Area0>
      <BarChart data={s.datos} layout={horizontal ? 'vertical' : 'horizontal'} margin={{ top: 10, right: 12, bottom: 0, left: 0 }} stackOffset={cien ? 'expand' : 'none'}>
        {e.cuadricula && <CartesianGrid {...GRILLA} horizontal={!horizontal} vertical={horizontal} />}
        {horizontal ? (
          <>
            <YAxis type="category" dataKey="etiqueta" tick={{ ...EJE, fontFamily: 'inherit', fill: 'var(--dim)', fontSize: 12.5 }} width={130} axisLine={false} tickLine={false} tickFormatter={(v: string) => (v.length > 20 ? `${v.slice(0, 19)}…` : v)} hide={!e.ejes} />
            <XAxis type="number" tick={EJE} tickFormatter={cien ? pct : tick(s.formatos[0])} axisLine={false} tickLine={false} hide={!e.ejes} />
          </>
        ) : (
          <>{ejeX}{cien ? ejesY100 : ejesY}</>
        )}
        <Tooltip contentStyle={TIP} labelStyle={TIP_ETIQUETA} formatter={fmtTip} cursor={{ fill: 'var(--surface-2)' }} />
        {!unaSola && ley}
        {s.claves.map((k, i) => (
          <Bar key={k} {...(horizontal ? {} : { yAxisId: cien ? 'a' : eje(s.formatos[i]) })} dataKey={k} name={s.nombres[i]} fill={c(i, s.nombres[i])} stackId={apilada ? 'a' : undefined}
            hide={oculta(k, s.claves)} cursor={cursorGrupo} onClick={grupoAbre ? (_d: unknown, j: number) => abrirGrupo(s.datos[j]?.__clave, k) : undefined}
            radius={radio} isAnimationActive={false} maxBarSize={horizontal ? 22 : 40}>
            {unaSola && s.datos.map((d, j) => <Cell key={j} fill={d.etiqueta === OTROS ? GRIS : c(0)} />)}
            {e.etiquetas && <LabelList dataKey={k} position={apilada ? 'center' : horizontal ? 'right' : 'top'} fontSize={10.5} fontFamily={MONO} fill={apilada ? '#fff' : 'var(--dim)'} formatter={(v: unknown) => (cien ? '' : fmtValor(Number(v), s.formatos[i], true))} />}
          </Bar>
        ))}
      </BarChart>
    </Area0>
  );
}

// ── Piezas propias ─────────────────────────────────────────────────────────────────────────

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

function Tabla({ r, modo, color, total, compacto, alFila }: { r: Resultado; modo: 'plana' | 'barras' | 'calor'; color: string; total: boolean; compacto: boolean; alFila?: (clave: string) => void }) {
  const max = r.columnas.map((_, i) => Math.max(0, ...r.filas.map((f) => Math.abs(f.valores[i] ?? 0))));
  return (
    <div className="lk-tabla">
      <table>
        <thead>
          <tr><th className="lk-tabla-izq" />{r.columnas.map((c) => <th key={c.id}>{c.nombre}</th>)}</tr>
        </thead>
        <tbody>
          {r.filas.map((f) => (
            <tr key={f.clave} {...propsFila(f.clave, alFila)}>
              <td className="lk-tabla-izq" title={f.etiqueta}>{f.etiqueta}</td>
              {f.valores.map((v, i) => {
                const p = max[i] ? Math.abs(v ?? 0) / max[i] : 0;
                if (modo === 'barras') {
                  // El número y, a su derecha, la barra. Encima del número no se lee.
                  return (
                    <td key={i} className="lk-tabla-barra">
                      <span className="lk-celda-barra">
                        <span className="lk-celda-num">{fmtValor(v, r.columnas[i].formato, compacto)}</span>
                        <span className="lk-celda-pista"><span style={{ width: `${Math.min(100, p * 100)}%`, background: color }} /></span>
                      </span>
                    </td>
                  );
                }
                return <td key={i} style={modo === 'calor' ? { background: `${color}${Math.round(p * 0.7 * 255).toString(16).padStart(2, '0')}` } : undefined}>{fmtValor(v, r.columnas[i].formato, compacto)}</td>;
              })}
            </tr>
          ))}
          {total && (
            <tr className="lk-tabla-total">
              <td className="lk-tabla-izq">Total</td>
              {r.totales.map((v, i) => <td key={i}>{fmtValor(v, r.columnas[i].formato, compacto)}</td>)}
            </tr>
          )}
        </tbody>
      </table>
      {r.fuera > 0 && <p className="lk-tabla-mas">+{r.fuera} más</p>}
    </div>
  );
}

function Dinamica({ r, modo, color, total, compacto, alFila }: { r: Resultado; modo: 'plana' | 'barras' | 'calor'; color: string; total: boolean; compacto: boolean; alFila?: (clave: string) => void }) {
  if (!r.cruce) return <Mensaje>Elige una dimensión de columna</Mensaje>;
  const f0 = r.columnas[0].formato;
  const todos = r.cruce.celdas.flat().map((v) => Math.abs(v ?? 0));
  const max = Math.max(0, ...todos);
  const totCol = r.cruce.claves.map((_, j) => r.cruce!.celdas.reduce((s, fila) => s + (fila[j] ?? 0), 0));
  return (
    <div className="lk-tabla">
      <table>
        <thead>
          <tr><th className="lk-tabla-izq">{r.columnas[0].nombre}</th>{r.cruce.claves.map((k) => <th key={k}>{k}</th>)}<th>Total</th></tr>
        </thead>
        <tbody>
          {r.filas.map((f, i) => (
            <tr key={f.clave} {...propsFila(f.clave, alFila)}>
              <td className="lk-tabla-izq" title={f.etiqueta}>{f.etiqueta}</td>
              {r.cruce!.celdas[i].map((v, j) => {
                const p = max ? Math.abs(v ?? 0) / max : 0;
                if (modo === 'barras') {
                  return <td key={j} className="lk-tabla-barra"><span className="lk-celda-barra"><span className="lk-celda-num">{v ? fmtValor(v, f0, compacto) : ''}</span><span className="lk-celda-pista"><span style={{ width: `${p * 100}%`, background: color }} /></span></span></td>;
                }
                return <td key={j} style={modo === 'calor' ? { background: `${color}${Math.round(p * 0.7 * 255).toString(16).padStart(2, '0')}` } : undefined}>{v ? fmtValor(v, f0, compacto) : ''}</td>;
              })}
              <td className="lk-tabla-fuerte">{fmtValor(f.valores[0], f0, compacto)}</td>
            </tr>
          ))}
          {total && (
            <tr className="lk-tabla-total">
              <td className="lk-tabla-izq">Total</td>
              {totCol.map((v, j) => <td key={j}>{fmtValor(v, f0, compacto)}</td>)}
              <td>{fmtValor(r.totales[0], f0, compacto)}</td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}

function Bala({ v, objetivo, max, color, texto, textoObj }: { v: number; objetivo: number | null; max: number; color: string; texto: string; textoObj: string | null }) {
  const p = (x: number) => `${Math.min(100, Math.max(0, (x / max) * 100))}%`;
  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: 10 }}>
      <div style={{ fontSize: 28, fontWeight: 600, letterSpacing: '-0.02em', color: 'var(--ink)', fontVariantNumeric: 'tabular-nums' }}>
        {texto}{textoObj && <span style={{ fontFamily: MONO, fontSize: 13, fontWeight: 500, color: 'var(--faint)', letterSpacing: 0 }}> de {textoObj}</span>}
      </div>
      <div style={{ position: 'relative', height: 18, background: 'var(--surface-2)', borderRadius: 6, overflow: 'hidden' }}>
        <div style={{ position: 'absolute', inset: '0 auto 0 0', width: p(max * 0.66), background: 'var(--border)' }} />
        <div style={{ position: 'absolute', left: 0, top: 5, height: 8, width: p(v), background: color, borderRadius: 4 }} />
        {objetivo != null && <div style={{ position: 'absolute', top: 1, bottom: 1, width: 3, left: p(objetivo), background: 'var(--ink)', borderRadius: 2 }} />}
      </div>
    </div>
  );
}

function Indicador({ v, max, objetivo, color, rangos, texto }: { v: number; max: number; objetivo: number | null; color: string; rangos: boolean; texto: string }) {
  const ang = (x: number) => Math.PI * (1 - Math.min(1, Math.max(0, x / max)));
  const pt = (a: number, rr: number) => [100 + rr * Math.cos(a), 100 - rr * Math.sin(a)];
  const arco = (a0: number, a1: number, rr: number) => { const [x0, y0] = pt(a0, rr); const [x1, y1] = pt(a1, rr); return `M ${x0} ${y0} A ${rr} ${rr} 0 0 1 ${x1} ${y1}`; };
  const [nx, ny] = pt(ang(v), 62);
  return (
    <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
      <svg viewBox="0 0 200 116" style={{ width: '100%', maxHeight: '100%' }} role="img" aria-label={texto}>
        {rangos ? (
          <>
            <path d={arco(Math.PI, Math.PI * 2 / 3, 80)} stroke="var(--bad)" strokeWidth={20} fill="none" />
            <path d={arco(Math.PI * 2 / 3, Math.PI / 3, 80)} stroke="var(--mako, #C8870C)" strokeWidth={20} fill="none" />
            <path d={arco(Math.PI / 3, 0, 80)} stroke="var(--good)" strokeWidth={20} fill="none" />
            <line x1={100} y1={100} x2={nx} y2={ny} stroke="var(--ink)" strokeWidth={3} strokeLinecap="round" />
            <circle cx={100} cy={100} r={5} fill="var(--ink)" />
          </>
        ) : (
          <>
            <path d={arco(Math.PI, 0, 80)} stroke="var(--surface-2)" strokeWidth={20} fill="none" strokeLinecap="round" />
            <path d={arco(Math.PI, ang(v), 80)} stroke={color} strokeWidth={20} fill="none" strokeLinecap="round" />
          </>
        )}
        {objetivo != null && (() => { const [a, b] = pt(ang(objetivo), 94); const [c2, d] = pt(ang(objetivo), 66); return <line x1={a} y1={b} x2={c2} y2={d} stroke="var(--ink)" strokeWidth={2.5} />; })()}
        <text x={100} y={rangos ? 86 : 96} textAnchor="middle" fontSize={22} fontWeight={600} fill="var(--ink)" style={{ fontVariantNumeric: 'tabular-nums' }}>{texto}</text>
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
                <span style={{ fontFamily: MONO, fontSize: 12, fontWeight: 600, color: 'var(--dim)', background: 'var(--surface-2)', padding: '2px 9px', borderRadius: 7 }}>
                  {pasa == null ? '—' : `↓ ${pasa.toLocaleString('es-AR', { maximumFractionDigits: pasa < 10 ? 1 : 0 })}%`}
                </span>
              </div>
            )}
            <Clic al={alPaso?.(i) ?? null} etiqueta={`Ver detalle: ${p.nombre}`} estilo={{ flex: '1 1 0', minHeight: 44, maxHeight: 92, background: base, clipPath: clip(i), padding: 2 }}>
              <div style={{ height: '100%', background: tono(i), clipPath: clip(i), display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', lineHeight: 1, minWidth: 0 }}>
                {/* Tinta fija: el relleno es claro también en el tema oscuro. */}
                <span style={{ fontSize: 13.5, fontWeight: 500, color: '#454C57', marginBottom: 5, whiteSpace: 'nowrap' }}>{p.nombre}</span>
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
        const tam = `${Math.max(2, (p.valor / max) * 100)}%`;
        const al = alPaso?.(i) ?? null;
        return vertical ? (
          <Clic key={p.nombre} al={al} etiqueta={`Ver detalle: ${p.nombre}`} estilo={{ flex: 1, height: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'flex-end', alignItems: 'center', gap: 6, minWidth: 0 }}>
            <span style={{ fontSize: 15, fontWeight: 600, color: 'var(--ink)', fontVariantNumeric: 'tabular-nums' }}>{fmtValor(p.valor, p.formato, compacto)}</span>
            <div style={{ width: '70%', height: tam, background: color(i), borderRadius: '6px 6px 0 0' }} />
            <span style={{ fontSize: 12.5, color: 'var(--dim)', textAlign: 'center' }}>{p.nombre}</span>
            {conv != null && <span style={{ fontFamily: MONO, fontSize: 11.5, fontWeight: 600, color: 'var(--dim)', background: 'var(--surface-2)', padding: '1px 7px', borderRadius: 6 }}>↓ {conv}%</span>}
          </Clic>
        ) : (
          <Clic key={p.nombre} al={al} etiqueta={`Ver detalle: ${p.nombre}`} estilo={{ display: 'grid', gridTemplateColumns: 'minmax(80px, 30%) 1fr', alignItems: 'center', gap: 12 }}>
            <span style={{ fontSize: 13, color: 'var(--dim)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.nombre}</span>
            <div style={{ display: 'flex', justifyContent: 'center' }}>
              <div style={{ width: tam, background: color(i), color: '#fff', fontSize: 13, fontWeight: 600, padding: '7px 10px', textAlign: 'center', borderRadius: 8, whiteSpace: 'nowrap', fontVariantNumeric: 'tabular-nums' }}>
                {fmtValor(p.valor, p.formato, compacto)}{conv != null ? ` · ${conv}%` : ''}
              </div>
            </div>
          </Clic>
        );
      })}
    </div>
  );
}

type CeldaProps = { x?: number; y?: number; width?: number; height?: number; name?: string; size?: number; fill?: string; formato: Formato; compacto: boolean };
function CeldaTreemap({ x = 0, y = 0, width = 0, height = 0, name, size, fill, formato, compacto }: CeldaProps) {
  return (
    <g>
      <rect x={x} y={y} width={width} height={height} fill={fill} stroke="var(--surface)" strokeWidth={3} rx={6} />
      {width > 60 && height > 28 && (
        <>
          <text x={x + 8} y={y + 18} fontSize={12.5} fontWeight={500} fill="#fff">{String(name ?? '').slice(0, Math.floor(width / 7.5))}</text>
          <text x={x + 8} y={y + 34} fontSize={12} fontFamily={MONO} fill="#fff" opacity={0.9}>{fmtValor(size ?? 0, formato, compacto || true)}</text>
        </>
      )}
    </g>
  );
}

type NodoProps = { x?: number; y?: number; width?: number; height?: number; payload?: { name?: string }; color: string };
function NodoSankey({ x = 0, y = 0, width = 0, height = 0, payload, color }: NodoProps) {
  return (
    <g>
      <rect x={x} y={y} width={width} height={height} fill={color} rx={2} />
      <text x={x + width + 6} y={y + height / 2 + 4} fontSize={12} fill="var(--dim)">{String(payload?.name ?? '').trim().slice(0, 24)}</text>
    </g>
  );
}
