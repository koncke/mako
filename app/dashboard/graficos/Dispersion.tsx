'use client';

// =============================================================================
// Dispersion — dispersión y burbujas, con ejes fijos, cuadrantes y color por categoría
// =============================================================================
// Lo que hace falta para reemplazar los dos bloques que eran un SVG propio (v5): la matriz Impacto × Esfuerzo
// de Productividad (ejes 0-100, cruz en 50/50, «Quick wins / Apuestas / Relleno / Trampas», color por
// cuadrante) y el cuadrante de retención de Ads Analyst (0-55 × 0-30, cortes en 28 y 10, color por ángulo).
//
//   · EJES FIJOS (`g.ejes`): con un mínimo y un máximo, el eje no se mueve con los datos (y lo que cae afuera
//     se recorta, no estira el eje). Sin ellos, automáticos.
//   · REFERENCIAS (`g.referencias`): una línea punteada en X y otra en Y, y con las dos, los 4 rótulos de
//     cuadrante en ORDEN DE LECTURA (arriba-izq, arriba-der, abajo-izq, abajo-der: `ORDEN_ROTULOS`,
//     lib/graficos-gordo.ts).
//   · COLOR POR (`g.colorPor`): el valor de esa dimensión en cada punto lo trae el agregador en
//     `FilaResultado.extra`; el color, el que declara la dimensión (`Dimension.colores`) o la paleta, y el
//     orden de la leyenda, el fijo de la dimensión (`Dimension.valores`).
//   · Un punto sin X o sin Y NO se dibuja en (0, 0): los proyectos sin evaluar caían ahí.
//   · Sin etiquetas en los puntos (se pisarían): el nombre sale al pasar el cursor, y el clic abre el detalle.
//   · EL NOMBRE DE CADA EJE, en HTML: el de Y arriba a la izquierda y el de X abajo a la derecha (con burbujas, a la
//     izquierda, qué mide el tamaño). Sin ellos, «Hook rate y Retención al llamado» no decía cuál era cuál.
//   · Con ejes automáticos, aire en las puntas y marcas REDONDAS (`ejeLindo`, ./eje-lindo.ts): una burbuja grande en
//     el mínimo o el máximo tapaba la marca del eje y se cortaba contra el borde, y con el dominio corrido a mano
//     recharts dejaba de redondear («14%, 19%, 24%, 29%, 32%»). Un eje fijo (`g.ejes`) manda igual que antes.

import { ReferenceLine, Scatter, ScatterChart, Tooltip, XAxis, YAxis, ZAxis, usePlotArea } from 'recharts';
import { fmtValor, type Resultado } from '@/lib/graficos-agregar';
import { anchoEjeY, LETRA, MARGEN, ORDEN_ROTULOS } from '@/lib/graficos-gordo';
import { AreaMedida } from './medida';
import { ejeLindo } from './eje-lindo';
import { extraDe } from './Tabla';

type Punto = { clave: string; etiqueta: string; x: number; y: number; z: number; cat: string };
type Ejes = { xMin?: number; xMax?: number; yMin?: number; yMax?: number } | null | undefined;
type Referencias = { x?: number; y?: number; rotulos?: readonly string[] } | null | undefined;

const fin = (v: number | null | undefined): v is number => v != null && Number.isFinite(v);

/** Los 4 rótulos de los cuadrantes, en las esquinas del área de dibujo (sólo con las dos referencias). */
function Rotulos({ rotulos }: { rotulos: readonly string[] }) {
  const area = usePlotArea();
  if (!area) return null;
  const x0 = area.x + 8, x1 = area.x + area.width - 8, y0 = area.y + 16, y1 = area.y + area.height - 8;
  const lugar: Record<(typeof ORDEN_ROTULOS)[number], [number, number, 'start' | 'end']> = {
    'arriba-izquierda': [x0, y0, 'start'], 'arriba-derecha': [x1, y0, 'end'], 'abajo-izquierda': [x0, y1, 'start'], 'abajo-derecha': [x1, y1, 'end'],
  };
  return (
    <g pointerEvents="none" aria-hidden="true">
      {ORDEN_ROTULOS.map((k, i) => {
        const t = rotulos[i];
        if (!t) return null;
        const [x, y, ancla] = lugar[k];
        return (
          <text key={k} x={x} y={y} textAnchor={ancla} fontSize={LETRA.cuadrante} fontWeight={600}
            style={{ fill: 'var(--dim)', textTransform: 'uppercase', letterSpacing: '.04em' }}>{t}</text>
        );
      })}
    </g>
  );
}

export function Dispersion({ r, idGrafico, burbujas, ejes, referencias, colorPor, ordenCategorias, colorDeCategoria, color, compacto, halo, alGrupo }: {
  r: Resultado; idGrafico: string; burbujas: boolean;
  ejes: Ejes; referencias: Referencias;
  colorPor: string | null;
  /** El orden fijo de las categorías del color (`Dimension.valores`), si lo hay. */
  ordenCategorias?: readonly string[];
  colorDeCategoria: (cat: string, i: number) => string;
  color: string; compacto: boolean; halo: string;
  alGrupo?: (clave: string) => void;
}) {
  const [cx, cy, cz] = r.columnas;
  const puntos: Punto[] = r.filas
    .filter((f) => fin(f.valores[0]) && fin(f.valores[1]))
    .map((f) => ({ clave: f.clave, etiqueta: f.etiqueta, x: f.valores[0] as number, y: f.valores[1] as number, z: fin(f.valores[2]) ? Math.max(0, f.valores[2] as number) : 1, cat: colorPor ? extraDe(f, colorPor) : '' }));
  if (!puntos.length) return <div style={{ flex: 1, display: 'grid', placeItems: 'center', color: 'var(--faint)', fontSize: LETRA.tick }}>Sin datos en este período</div>;
  // Las categorías del color: el orden fijo de la dimensión primero, después las que vinieron.
  const vistas = [...new Set(puntos.map((p) => p.cat))];
  const cats = colorPor && vistas.some(Boolean)
    ? [...(ordenCategorias ?? []).filter((c) => vistas.includes(c)), ...vistas.filter((c) => !(ordenCategorias ?? []).includes(c))]
    : [''];
  const grupos = cats.map((cat, i) => ({ cat, color: cat ? colorDeCategoria(cat, i) : color, puntos: puntos.filter((p) => (cats.length === 1 ? true : p.cat === cat)) })).filter((g) => g.puntos.length);
  // Un eje fijo (con mínimo Y máximo) manda; uno automático sale de ejeLindo, contando también las referencias (una
  // línea fuera del dominio lo estiraría y las marcas dejarían de ser redondas).
  const aire = burbujas ? 0.14 : 0.08;
  const autoX = ejeLindo([...puntos.map((p) => p.x), ...[referencias?.x, ejes?.xMin, ejes?.xMax].filter(fin)], 4, aire, puntos.every((p) => p.x >= 0));
  const autoY = ejeLindo([...puntos.map((p) => p.y), ...[referencias?.y, ejes?.yMin, ejes?.yMax].filter(fin)], 2, aire, puntos.every((p) => p.y >= 0));
  const fijoX = fin(ejes?.xMin) && fin(ejes?.xMax);
  const fijoY = fin(ejes?.yMin) && fin(ejes?.yMax);
  const textosY = (fijoY ? [ejes!.yMax, ejes!.yMin, ...puntos.map((p) => p.y)] : autoY.marcas).filter(fin).map((v) => fmtValor(v, cy.formato, true));
  const conRotulos = fin(referencias?.x) && fin(referencias?.y) && !!referencias?.rotulos?.some(Boolean);
  const clic = alGrupo ? (p: unknown) => {
    const o = p as { payload?: { clave?: unknown }; clave?: unknown } | null;
    const clave = o?.payload?.clave ?? o?.clave;
    if (typeof clave === 'string' && clave) alGrupo(clave);
  } : undefined;
  const Tip = ({ active, payload }: { active?: boolean; payload?: ReadonlyArray<{ payload?: Punto }> }) => {
    const p = active ? payload?.[0]?.payload : undefined;
    if (!p) return null;
    return (
      <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 10, padding: '8px 12px', fontSize: LETRA.tooltip, color: 'var(--ink)', boxShadow: '0 6px 20px rgba(18,21,27,.08)', maxWidth: 280 }}>
        <div style={{ fontWeight: 600, marginBottom: 4, overflowWrap: 'anywhere' }}>{p.etiqueta}</div>
        {p.cat && <div style={{ color: 'var(--dim)', fontSize: LETRA.tooltipRotulo, marginBottom: 2 }}>{p.cat}</div>}
        <div>{cx.nombre}: <b>{fmtValor(p.x, cx.formato, compacto)}</b></div>
        <div>{cy.nombre}: <b>{fmtValor(p.y, cy.formato, compacto)}</b></div>
        {burbujas && cz && <div>{cz.nombre}: <b>{fmtValor(p.z, cz.formato, compacto)}</b></div>}
      </div>
    );
  };
  return (
    <>
      {grupos.length > 1 && (
        <div className="gr-barras-leyenda" style={{ flex: 'none' }}>
          {grupos.map((gq) => <span key={gq.cat}><span className="gr-punto" style={{ background: gq.color }} />{gq.cat}</span>)}
        </div>
      )}
      <div className="gr-disp-y" title={cy.nombre}>{cy.nombre}</div>
      <AreaMedida minAlto={80}>
        {(tam) => {
          const conEjes = tam.h >= 120;
          return (
            <ScatterChart width={tam.w} height={tam.h} margin={{ ...MARGEN, top: 12, bottom: conEjes ? 4 : 0 }}>
              <XAxis type="number" dataKey="x" name={cx.nombre} domain={fijoX ? [ejes!.xMin!, ejes!.xMax!] : autoX.dominio} allowDataOverflow={fijoX}
                tick={{ fontSize: LETRA.tick, style: { fill: 'var(--dim)' } }} tickFormatter={(v: number) => fmtValor(v, cx.formato, true)}
                {...(fijoX ? { tickCount: 5 } : { ticks: autoX.marcas })} tickMargin={10}
                axisLine={false} tickLine={false} hide={!conEjes} />
              <YAxis type="number" dataKey="y" name={cy.nombre} domain={fijoY ? [ejes!.yMin!, ejes!.yMax!] : autoY.dominio} allowDataOverflow={fijoY}
                tick={{ fontSize: LETRA.tick, style: { fill: 'var(--dim)' } }} tickFormatter={(v: number) => fmtValor(v, cy.formato, true)}
                {...(fijoY ? { tickCount: 3 } : { ticks: autoY.marcas })}
                width={anchoEjeY(textosY)} axisLine={false} tickLine={false} hide={!conEjes} />
              <ZAxis type="number" dataKey="z" range={burbujas ? [80, 1400] : [140, 140]} name={cz?.nombre} />
              {fin(referencias?.x) && <ReferenceLine x={referencias!.x} stroke="var(--border-strong)" strokeWidth={1.5} strokeDasharray="6 5" ifOverflow="extendDomain" />}
              {fin(referencias?.y) && <ReferenceLine y={referencias!.y} stroke="var(--border-strong)" strokeWidth={1.5} strokeDasharray="6 5" ifOverflow="extendDomain" />}
              {conRotulos && <Rotulos rotulos={referencias!.rotulos!} />}
              <Tooltip content={<Tip />} cursor={{ strokeDasharray: '3 3' }} />
              {grupos.map((gq) => (
                <Scatter key={`${idGrafico}-${gq.cat}`} name={gq.cat || cy.nombre} data={gq.puntos} fill={gq.color} fillOpacity={0.82}
                  stroke={halo} strokeWidth={1.5} isAnimationActive={false} onClick={clic} cursor={alGrupo ? 'pointer' : undefined} />
              ))}
            </ScatterChart>
          );
        }}
      </AreaMedida>
      <div className="gr-disp-x">
        {burbujas && cz && <span title={`El tamaño es ${cz.nombre}`}>Tamaño: {cz.nombre}</span>}
        <span title={cx.nombre}>{cx.nombre}</span>
      </div>
    </>
  );
}
