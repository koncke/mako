'use client';

// =============================================================================
// HojaComercial — la hoja Comercial con su DISEÑO PROPIO: la copia de Selvar, con los datos reales de MaKo
// =============================================================================
// Martín, 4/11/2026, al rechazar las 20 hojas iguales: «que sea primero la copia, es decir, que se vea exactamente igual
// que la copia, y después la adaptación con Maco». La copia y la adaptación (maquetas) están en
// docs/diseno/mockups-dashboard/comercial-selvar/; ésta es la adaptación con los datos de verdad (lib/comercial-diseno.ts arma
// lo que dibuja cada bloque, con test). La pregunta de la hoja es «¿convierte, y a qué costo?».
//
// El movimiento: el INFORME de Selvar (docs/diseno/mockups-dashboard/demos/selvar/INFORME.txt) trae la entrada del ARMAZÓN y los
// hover del CSS; la entrada de la página «Overview» vive en un chunk que el INFORME no muestra. No se inventa: las tarjetas
// quedan quietas y los hover son los del CSS (./comercial-css.ts).
//
// ⚠️ Mirando se dibuja esto; editando, la grilla con los mismos componentes (app/dashboard/EditorInforme.tsx).
// ⚠️ Lo que Selvar tiene y MaKo no hace no está: el «Pace today», el «Forecast» y la cuota (MaKo no tiene una cuota ni un
//    pronóstico de ventas), los botones de IA de cada señal, su cruz y la caja para preguntarle.
// =============================================================================

import { createContext, useContext, useLayoutEffect, useRef, useState, type CSSProperties, type KeyboardEvent, type ReactNode } from 'react';
import Link from '@/app/_ui/Link';
import type { Grafico, Hoja } from '@/lib/graficos-catalogo';
import { escalaVentas, plata, type NumeroCm, type SerieVentas, type VistaComercial } from '@/lib/comercial-diseno';
import { CSS_COMERCIAL } from './comercial-css';
import { Parte } from './parte';

const Compartido = createContext(false);

const P = {
  sun: 'M12 8.5a3.5 3.5 0 1 0 0 7a3.5 3.5 0 1 0 0-7M12 3.5v1.8M12 18.7v1.8M3.5 12h1.8M18.7 12h1.8M6 6l1.3 1.3M16.7 16.7L18 18M6 18l1.3-1.3M16.7 7.3L18 6',
  grid: 'M4.5 4.5h6v6h-6zM13.5 4.5h6v6h-6zM4.5 13.5h6v6h-6zM13.5 13.5h6v6h-6z',
  board: 'M5 5h4v14H5zM10 5h4v9h-4zM15 5h4v6h-4z',
  out: 'M8 16L16 8M9 8h7v7',
  cal: 'M4 5.5h16v14H4zM4 10h16M8 3.5v4M16 3.5v4',
  up: 'M4 16.5l5.5-5.5 3.5 3.5 7-7M15 7.5h5v5',
  dn: 'M4 7.5L9.5 13l3.5-3.5 7 7M15 16.5h5v-5',
  warn: 'M12 4.5L20 19H4zM12 10v4M12 16.6v.1',
  trophy: 'M8 4.5h8v4.5a4 4 0 0 1-8 0zM8 6.5H5.5c0 2.2 1 3.5 2.6 3.8M16 6.5h2.5c0 2.2-1 3.5-2.6 3.8M12 13v3.5M8.5 19.5h7M10 16.5h4v3h-4z',
  dollar: 'M12 4a8 8 0 1 0 0 16a8 8 0 1 0 0-16M14.5 9.5c-.4-1-1.4-1.5-2.5-1.5-1.5 0-2.5.8-2.5 2s1 1.7 2.5 2 2.5.8 2.5 2-1 2-2.5 2c-1.2 0-2.2-.5-2.6-1.5M12 6.5V8M12 16v1.5',
  hour: 'M7 4h10M7 20h10M8 4c0 4 8 4.5 8 8s-8 4-8 8M16 4c0 3-2 4-4 5.5',
  layers: 'M12 4l8 4.2-8 4.2-8-4.2zM4 12.2l8 4.2 8-4.2M4 16l8 4.2 8-4.2',
  down: 'M7 10l5 5 5-5',
  info: 'M12 4a8 8 0 1 0 0 16a8 8 0 1 0 0-16M12 11v5M12 8v.1',
} as const;
function Icono({ id, className, style }: { id: keyof typeof P; className?: string; style?: CSSProperties }) {
  return <svg className={`cm-i${className ? ` ${className}` : ''}`} style={style} viewBox="0 0 24 24" aria-hidden><path d={P[id]} /></svg>;
}

/** Un link de la app, o un texto si la hoja está compartida (un link compartido no tiene sesión). */
function Ir({ href, className, children, label }: { href: string; className?: string; children: ReactNode; label?: string }) {
  if (useContext(Compartido)) return <span className={className}>{children}</span>;
  return <Link href={href} className={className} aria-label={label}>{children}</Link>;
}

function useAncho<T extends HTMLElement>() {
  const ref = useRef<T>(null);
  const [w, setW] = useState(0);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const medir = () => setW(el.clientWidth);
    medir();
    const ro = new ResizeObserver(medir);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  return [ref, w] as const;
}

const iniciales = (s: string) => [...s.trim().split(/\s+/).slice(0, 2).map((p) => [...p][0] ?? '')].join('').toUpperCase() || '·';
/** Los colores de las iniciales de Selvar, por orden. */
const AV: Array<[string, string]> = [['--av-cobalt', '--av-cobalt-t'], ['--av-teal', '--av-teal-t'], ['--av-amber', '--av-amber-t'], ['--av-coral', '--av-coral-t'], ['--av-sand', '--av-sand-t'], ['--av-sky', '--av-sky-t'], ['--av-slate', '--av-slate-t']];
const colorAv = (s: string) => { let h = 0; for (const c of s) h = (h * 31 + c.charCodeAt(0)) >>> 0; const [b, t] = AV[h % AV.length]; return { '--b': `var(${b})`, '--t': `var(${t})` } as CSSProperties; };
const SERIES = ['var(--c-cobalt)', 'var(--c-amber)', 'var(--c-sky)', 'var(--c-teal)', 'var(--c-coral)', 'var(--c-slate)'];
/** «US$20k». */
const corta = (n: number) => (n >= 1_000_000 ? `US$${(n / 1_000_000).toFixed(n % 1_000_000 ? 1 : 0)}M` : n >= 1000 ? `US$${(n / 1000).toFixed(n % 1000 ? 1 : 0)}k` : `US$${Math.round(n)}`);

/** La línea de cada número: sólo el trazo, de punta a punta de su caja. */
function Linea({ v }: { v: number[] }) {
  const [ref, W] = useAncho<HTMLDivElement>();
  const H = 26, max = Math.max(...v), min = Math.min(...v);
  const pts = v.map((n, i) => [+(W * i / (v.length - 1)).toFixed(1), +(H - 2 - (H - 4) * ((n - min) / (max - min || 1))).toFixed(1)] as [number, number]);
  let d = '';
  if (W > 0) {
    d = `M${pts[0][0]},${pts[0][1]}`;
    for (let i = 0; i < pts.length - 1; i++) {
      const p0 = pts[i - 1] ?? pts[i], p1 = pts[i], p2 = pts[i + 1], p3 = pts[i + 2] ?? p2;
      d += ` C${(p1[0] + (p2[0] - p0[0]) / 6).toFixed(1)},${(p1[1] + (p2[1] - p0[1]) / 6).toFixed(1)} ${(p2[0] - (p3[0] - p1[0]) / 6).toFixed(1)},${(p2[1] - (p3[1] - p1[1]) / 6).toFixed(1)} ${p2[0]},${p2[1]}`;
    }
  }
  return <div ref={ref}><svg className="cm-tile__spark" aria-hidden>{d && <path d={d} />}</svg></div>;
}

/** «Lo vendido»: columnas apiladas por funnel y la línea punteada del promedio (la de «Weekly pace» de Selvar). */
function Ventas({ s }: { s: SerieVentas }) {
  const [ref, W] = useAncho<HTMLDivElement>();
  const H = 245, izq = 52, abajo = 26, arriba = 6, alto = H - abajo - arriba;
  const porX = s.x.map((_, i) => s.series.reduce((a, se) => a + se.valores[i], 0));
  const { tope, paso } = escalaVentas(Math.max(...porX));
  const y = (v: number) => arriba + alto - (alto * v) / tope;
  const col = (W - izq) / Math.max(1, s.x.length), ancho = Math.min(34, col * 0.42);
  return (
    <div className="cm-chart" ref={ref} role="img" aria-label={`Lo vendido: ${plata(s.total)} en total`}>
      {W > 0 && (
        <svg viewBox={`0 0 ${W} ${H}`} aria-hidden>
          {[0, 1, 2, 3].map((k) => (
            <g key={k}><line className="cm-gl" x1={izq} x2={W} y1={y(paso * k)} y2={y(paso * k)} /><text className="cm-yl" x={0} y={y(paso * k) + 4}>{k ? corta(paso * k) : 'US$0'}</text></g>
          ))}
          {s.x.map((x, i) => {
            const cx = izq + col * (i + 0.5);
            let base = 0;
            const ultima = s.series.reduce((u, se, k) => (se.valores[i] > 0 ? k : u), -1);
            return (
              <g key={x.clave} className="cm-col">
                <title>{`${x.rotulo}: ${plata(porX[i])}`}</title>
                {s.series.map((se, k) => {
                  const v = se.valores[i];
                  if (!(v > 0)) return null;
                  const top = y(base + v), fondo = y(base), r = k === ultima ? Math.min(6, (fondo - top) / 2) : 0, l = cx - ancho / 2, d = cx + ancho / 2;
                  const sep = base > 0;
                  base += v;
                  return (
                    <g key={se.nombre}>
                      <path fill={SERIES[k % SERIES.length]} d={`M${l},${fondo} V${top + r} Q${l},${top} ${l + r},${top} H${d - r} Q${d},${top} ${d},${top + r} V${fondo} Z`} />
                      {sep && <line x1={l} x2={d} y1={fondo} y2={fondo} stroke="var(--card)" strokeWidth={1.5} />}
                    </g>
                  );
                })}
                {(col >= 50 || i % 2 === 0) && <text className="cm-xl" x={cx} y={H - 6}>{x.rotulo}</text>}
              </g>
            );
          })}
          {s.promedio > 0 && <line className="cm-pace" x1={izq} x2={W} y1={y(s.promedio)} y2={y(s.promedio)} />}
        </svg>
      )}
    </div>
  );
}

// `data-parte` lo pone <Parte> (./parte.tsx) sobre este elemento: va a la tarjeta, que es lo que se dibuja sola en un bloque.
function Tile({ n, feature, className, ...resto }: { n: NumeroCm; feature?: boolean; className: string; 'data-parte'?: string }) {
  const ico = n.id === 'tasa' ? 'trophy' : n.id === 'ticket' ? 'dollar' : n.id === 'ciclo' ? 'hour' : 'layers';
  return (
    <article className={`cm-tile ${className}${feature ? ' cm-tile--feature' : ''}`} {...resto}>
      <div className="cm-tile__k"><span className="cm-tile__ico"><Icono id={ico} /></span>{n.titulo}</div>
      <div className="cm-tile__v">{n.valor ?? '—'}</div>
      {(n.cambio || (feature && n.pie)) && (
        <div className="cm-tile__d">
          {n.cambio && <b className={feature ? undefined : n.bueno == null ? undefined : n.bueno ? 'cm-up' : 'cm-down'}><Icono id={n.baja ? 'dn' : 'up'} />{n.cambio}</b>}
          {feature && n.pie}
        </div>
      )}
      {!feature && n.pie && <div className="cm-tile__p">{n.pie}</div>}
      {n.serie && <Linea v={n.serie} />}
    </article>
  );
}

export function HojaComercial({ hoja, vista, titulo, fecha, periodo, onGrilla, onFila, compartido = false, quieta = false }: {
  hoja: Hoja;
  vista: VistaComercial;
  /** «Buenos días, Ana» (quién mira); sin nombre, el de la hoja. */
  titulo: string;
  /** «miércoles 4 de noviembre»: null = no llegó. */
  fecha: string | null;
  /** El nombre del período elegido («Últimos 30 días»): el de la barra de controles de la hoja. */
  periodo: string;
  onGrilla?: () => void;
  /** Abrir una fila de una pieza: su detalle de siempre, como al tocarla en la grilla. */
  onFila?: (g: Grafico, clave: string) => void;
  compartido?: boolean;
  /** La miniatura de «Nueva hoja». */
  quieta?: boolean;
}) {
  const [vistaVentas, setVistaVentas] = useState<'semanas' | 'meses'>('semanas');
  const { frase, vendido, inversion, desenlace, numeros, motivos, ventas, embudo, hoy, origenes, closers } = vista;
  const p = hoja.diseno?.piezas ?? {};
  const pieza = (id: string | undefined) => hoja.componentes.find((c): c is Grafico => c.id === id && c.clase === 'grafico');
  const abrir = (id: string | undefined, clave: string) => { const g = pieza(id); return g && onFila && !quieta ? () => onFila(g, clave) : undefined; };
  const serie = ventas[vistaVentas] ?? (vistaVentas === 'semanas' ? ventas.meses : ventas.semanas);
  const queVentas = ventas[vistaVentas] ? vistaVentas : vistaVentas === 'semanas' ? 'meses' : 'semanas';
  const maxEmbudo = embudo ? Math.max(1, embudo[0].n) : 1;
  const colorEmbudo = ['var(--c-slate)', 'var(--c-sky)', 'var(--c-cobalt)', 'var(--c-amber)'];
  const fila = (fn: (() => void) | undefined) => (fn ? { role: 'button', tabIndex: 0, onClick: fn, onKeyDown: (e: KeyboardEvent) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); fn(); } } } : {});

  return (
    <Compartido.Provider value={compartido}>
    <div className="cm" data-quieta={quieta ? '' : undefined}>
      <style href="dash-hoja-comercial" precedence="medium">{CSS_COMERCIAL}</style>
      {/* La letra de Selvar (Urbanist), sólo para esta hoja. */}
      <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Urbanist:wght@400..800&display=swap" precedence="default" />
      <div className="cm-page">
        {/* LA CABECERA: la fecha con el período, el saludo y la frase, con dos botones. */}
        <Parte id="cabecera">
        <section className="cm-hero">
          <div className="cm-hero__txt">
            <div className="cm-hero__date"><Icono id="sun" />{[fecha ? fecha.charAt(0).toUpperCase() + fecha.slice(1) : null, periodo].filter(Boolean).join(' · ')}</div>
            <h1>{titulo}</h1>
            {frase.length > 0 && <p>{frase.map((t, i) => (t.tipo === 'fuerte' ? <b key={i}>{t.s}</b> : <span key={i}>{t.s}</span>))}</p>}
          </div>
          <div className="cm-hero__btns">
            {onGrilla && <button type="button" className="cm-btn" onClick={onGrilla}><Icono id="grid" />Ver la grilla</button>}
            {!compartido && <Link className="cm-btn cm-btn--primary" href="/crm"><Icono id="board" />Abrir el CRM</Link>}
          </div>
        </section>
        </Parte>

        <div className="cm-grid">
          {/* VENDIDO (el «Closed-won» de Selvar): lo vendido, lo invertido y qué pasó con las agendas. */}
          <Parte id="vendido">
          <section className="cm-card cm-runway">
            <div className="cm-runway__top">
              <div>
                <div className="cm-runway__k">
                  Vendido · {periodo}
                  {vendido.sube != null && <span className={`cm-chip cm-chip--dot cm-chip--lg ${vendido.sube ? 'cm-chip--good' : 'cm-chip--bad'}`}>{vendido.sube ? 'Más que el período anterior' : 'Menos que el período anterior'}</span>}
                </div>
                <div className="cm-runway__big">
                  <strong>{vendido.valor == null ? '—' : plata(vendido.valor)}</strong>
                  {vendido.cambio && <span className="cm-runway__vs"><Icono id={vendido.sube ? 'up' : 'dn'} className={vendido.sube ? 'cm-up' : 'cm-down'} /><b className={vendido.sube ? 'cm-up' : 'cm-down'}>{vendido.cambio}</b> contra el período anterior</span>}
                </div>
              </div>
              {inversion.gasto != null && (
                <div className="cm-runway__quota">Invertido en anuncios<strong>{plata(inversion.gasto)}</strong>{inversion.cpa != null ? `${plata(inversion.cpa)} por agenda` : ''}</div>
              )}
            </div>
            {desenlace ? (
              <>
                <div className="cm-track">
                  <div className="cm-track__bar" role="img" aria-label={desenlace.segmentos.map((s) => `${s.nombre}: ${s.n}`).join(', ')}>
                    {desenlace.segmentos.slice(0, 3).map((s) => s.n > 0 && (
                      <span key={s.id} className={`cm-track__seg cm-track__seg--${s.id === 'cerraron' ? 'won' : s.id === 'vinieron' ? 'commit' : 'best'}`} style={{ width: `${s.pct}%` }} />
                    ))}
                  </div>
                </div>
                <div className="cm-legend">
                  {desenlace.segmentos.map((s) => (
                    <span key={s.id}>
                      <i className={`cm-sw${s.id === 'sin-marcar' ? ' cm-sw--hatch' : ''}`} style={s.id === 'vinieron' ? ({ '--c': 'var(--c-amber)' } as CSSProperties) : s.id === 'no-vino' ? ({ '--c': 'var(--best)' } as CSSProperties) : undefined} />
                      {s.nombre} <b>{s.n.toLocaleString('es-MX')}</b>
                    </span>
                  ))}
                </div>
              </>
            ) : <p className="cm-vacio">Sin agendas en este período.</p>}
            <dl className="cm-stats">
              <div><dt>Agendas</dt><dd>{desenlace ? desenlace.agendas.toLocaleString('es-MX') : '—'}</dd></div>
              <div><dt>Vinieron</dt><dd>{desenlace ? desenlace.vinieron.toLocaleString('es-MX') : '—'}{desenlace && desenlace.agendas > 0 && <small>el {Math.round((desenlace.vinieron / desenlace.agendas) * 100)}%</small>}</dd></div>
              <div><dt>Retorno de los anuncios</dt><dd>{inversion.roas != null ? `${Math.round(inversion.roas * 10) / 10}×` : '—'}{inversion.roas != null && <small>lo vendido ÷ lo invertido</small>}</dd></div>
            </dl>
          </section>
          </Parte>

          {/* POR QUÉ NO SE CERRÓ (el «Copilot» de Selvar): los motivos de pérdida más repetidos. */}
          <Parte id="motivos">
          <section className="cm-card cm-copilot">
            <div className="cm-copilot__h">
              <svg className="cm-copilot__orb" viewBox="0 0 40 40" aria-hidden><circle cx="20" cy="20" r="18" fill="none" stroke="#2f56d6" strokeWidth="2" strokeDasharray="9 5" /><circle cx="20" cy="20" r="13" fill="none" stroke="#e3952a" strokeWidth="2" strokeDasharray="12 6" /><circle cx="20" cy="20" r="7.5" fill="#2f56d6" /></svg>
              <div><h2>Por qué no se cerró</h2><div className="cm-card__sub">{motivos && motivos.total ? `${motivos.total.toLocaleString('es-MX')} ${motivos.total === 1 ? 'perdido' : 'perdidos'} con motivo` : 'Los motivos de pérdida'}</div></div>
              <Ir className="cm-ibtn" href="/crm" label="Abrir el CRM"><Icono id="out" /></Ir>
            </div>
            {motivos && motivos.filas.length ? (
              <>
                <p className="cm-copilot__say">Lo que más se repite es «{motivos.filas[0].nombre}»: {motivos.filas[0].n.toLocaleString('es-MX')} de los {motivos.total.toLocaleString('es-MX')} que no cerraron.</p>
                <ul className="cm-sigs">
                  {motivos.filas.map((m) => {
                    const ver = abrir(p.motivos, m.clave);
                    return (
                      <li key={m.clave} className="cm-sig">
                        <span className="cm-sig__ico cm-sig__ico--bad"><Icono id="warn" /></span>
                        <div className="cm-sig__b">
                          <div className="cm-sig__t">{m.nombre}</div>
                          <div className="cm-sig__m"><span className="cm-chip cm-chip--bad">{m.n.toLocaleString('es-MX')} {m.n === 1 ? 'lead' : 'leads'}</span>el {m.pct}% de los perdidos</div>
                          {ver && <div className="cm-sig__a"><button type="button" className="cm-btn cm-btn--ink cm-btn--sm" onClick={ver}><Icono id="board" />Ver los leads</button></div>}
                        </div>
                      </li>
                    );
                  })}
                </ul>
              </>
            ) : <p className="cm-vacio">{motivos ? 'Todavía no hay motivos de pérdida marcados. Se marcan al perder un lead en el CRM.' : 'No pude leer los motivos de pérdida.'}</p>}
          </section>
          </Parte>

          {numeros[0] && <Parte id="tasa-cierre"><Tile n={numeros[0]} feature className="cm-t1" /></Parte>}
          {numeros[1] && <Parte id="ticket"><Tile n={numeros[1]} className="cm-t2" /></Parte>}
          {numeros[2] && <Parte id="ciclo"><Tile n={numeros[2]} className="cm-t3" /></Parte>}
          {numeros[3] && <Parte id="costo"><Tile n={numeros[3]} className="cm-t4" /></Parte>}

          {/* LO VENDIDO (el «Bookings» de Selvar): por semana o por mes, apilado por funnel. */}
          <Parte id="ventas">
          <section className="cm-card cm-book">
            <div className="cm-card__h">
              <div><h2>Lo vendido</h2><div className="cm-card__sub">{serie ? `${queVentas === 'semanas' ? 'Por semana' : 'Por mes'} · ${plata(serie.total)} en ${queVentas === 'semanas' ? 'los últimos 90 días' : 'los últimos 12 meses'}` : 'Por semana y por mes'}</div></div>
              <div className="cm-seg" role="group" aria-label="Por semana o por mes">
                <button type="button" className="cm-seg__opt" aria-pressed={vistaVentas === 'semanas'} onClick={() => setVistaVentas('semanas')}>Semanas</button>
                <button type="button" className="cm-seg__opt" aria-pressed={vistaVentas === 'meses'} onClick={() => setVistaVentas('meses')}>Meses</button>
              </div>
            </div>
            {serie && serie.total > 0 ? (
              <>
                <div className="cm-legend">
                  {serie.series.map((se, k) => <span key={se.nombre}><i className="cm-sw" style={{ width: 10, height: 10, '--c': SERIES[k % SERIES.length] } as CSSProperties} />{se.nombre}</span>)}
                  <span><i className="cm-sw cm-sw--dash" />Promedio por {queVentas === 'semanas' ? 'semana' : 'mes'} {plata(serie.promedio)}</span>
                </div>
                <Ventas s={serie} />
              </>
            ) : <p className="cm-vacio">{serie ? 'Sin ventas en este tiempo.' : 'No pude leer lo vendido.'}</p>}
          </section>
          </Parte>

          {/* DE AGENDA A CIERRE (el «Where deals sit» de Selvar): las cohortes maduras, paso por paso. */}
          <Parte id="embudo">
          <section className="cm-card cm-where">
            <div className="cm-card__h"><div><h2>De agenda a cierre</h2><div className="cm-card__sub">Las cohortes maduras, de todo el historial</div></div><Ir className="cm-ibtn" href="/crm" label="Abrir el CRM"><Icono id="out" /></Ir></div>
            {embudo ? (
              <ul className="cm-stages">
                {embudo.map((e, i) => (
                  <li key={e.nombre} style={{ display: 'contents' }}>
                    <div className="cm-stage"><div className="cm-stage__n">{e.nombre}<small>leads</small></div><div className="cm-stage__bar"><i style={{ width: `${(e.n / maxEmbudo) * 100}%`, '--c': colorEmbudo[i] } as CSSProperties} /></div><div className="cm-stage__v">{e.n.toLocaleString('es-MX')}</div></div>
                    {e.pasa && <div className="cm-stage__mv"><Icono id="down" />{e.pasa}</div>}
                  </li>
                ))}
              </ul>
            ) : <p className="cm-vacio">Todavía no hay cohortes maduras: se ven cuando las agendas tuvieron tiempo de cerrar.</p>}
            {motivos && motivos.total > 0 && <div className="cm-where__foot"><Icono id="info" />{motivos.total.toLocaleString('es-MX')} se perdieron con motivo; el más común, «{motivos.filas[0].nombre}».</div>}
          </section>
          </Parte>
        </div>

        <div className="cm-row4">
          {/* HOY (el «Today» de Selvar): las llamadas de venta de hoy, con la línea de «Ahora». */}
          <Parte id="hoy">
          <section className="cm-card cm-today">
            <div className="cm-card__h">
              <div><h2>Hoy</h2><div className="cm-card__sub">{[fecha ? fecha.charAt(0).toUpperCase() + fecha.slice(1) : null, hoy ? `${hoy.llamadas.length} ${hoy.llamadas.length === 1 ? 'llamada' : 'llamadas'} de venta` : null].filter(Boolean).join(' · ')}</div></div>
              <Ir className="cm-ibtn" href="/calendario" label="Abrir el Calendario"><Icono id="cal" /></Ir>
            </div>
            {hoy && hoy.llamadas.length ? (
              <ul className="cm-ag">
                {hoy.llamadas.map((l, i) => (
                  <li key={l.id} style={{ display: 'contents' }}>
                    {i === hoy.ahora && <div className="cm-ag__now">Ahora · {hoy.hora}</div>}
                    <Ir href={`/crm/${l.leadId}`} className={`cm-ag__row cm-fila${l.estado === 'paso' ? ' cm-is-past' : ''}`}>
                      <div className="cm-ag__t">{l.hora}<small>{l.cual}</small></div>
                      <i className="cm-ag__bar" style={{ '--c': l.estado === 'paso' ? 'var(--c-slate)' : l.cual === 'R2' ? 'var(--c-amber)' : 'var(--c-cobalt)' } as CSSProperties} />
                      <div className="cm-ag__w"><b>{l.nombre}</b><small>{l.detalle}</small></div>
                      {l.closer ? <span className="cm-av" style={colorAv(l.closer)}>{iniciales(l.closer)}</span> : <span />}
                    </Ir>
                  </li>
                ))}
                {hoy.ahora === hoy.llamadas.length && <li className="cm-ag__now">Ahora · {hoy.hora}</li>}
              </ul>
            ) : <p className="cm-vacio">{hoy ? 'Hoy no hay llamadas de venta agendadas.' : 'Las llamadas de hoy se ven en el Calendario.'}</p>}
          </section>
          </Parte>

          {/* DE DÓNDE VIENEN LOS QUE CIERRAN (el «Deals that need you» de Selvar): cada origen con su tasa y lo vendido. */}
          <Parte id="origen">
          <section className="cm-card cm-deals">
            <div className="cm-card__h"><div><h2>De dónde vienen los que cierran</h2><div className="cm-card__sub">Por origen del lead · {periodo}</div></div><Ir className="cm-ibtn" href="/crm" label="Abrir el CRM"><Icono id="out" /></Ir></div>
            {origenes && origenes.length ? (
              <ul className="cm-dl">
                {origenes.map((o) => (
                  <li key={o.clave} className={`cm-dl__row${abrir(p.origen, o.clave) ? ' cm-fila' : ''}`} {...fila(abrir(p.origen, o.clave))}>
                    <div className="cm-dl__n"><b>{o.nombre}</b><small>{o.agendas.toLocaleString('es-MX')} {o.agendas === 1 ? 'agenda' : 'agendas'}</small></div>
                    {o.tasa != null ? <span className={`cm-chip cm-chip--dot ${o.bueno === false ? 'cm-chip--bad' : 'cm-chip--good'}`}>{Math.round(o.tasa)}% cierra</span> : <span />}
                    <div className="cm-dl__v">{o.vendido != null ? plata(o.vendido) : '—'}<small>{o.cierres.toLocaleString('es-MX')} {o.cierres === 1 ? 'cierre' : 'cierres'}</small></div>
                    <span className="cm-av" style={colorAv(o.nombre)}>{iniciales(o.nombre)}</span>
                  </li>
                ))}
              </ul>
            ) : <p className="cm-vacio">{origenes ? 'Sin agendas con origen en este período.' : 'No pude leer los orígenes.'}</p>}
          </section>
          </Parte>

          {/* QUIÉN CIERRA (el «Quota race» de Selvar): la tasa de cierre de cada closer. */}
          <Parte id="closers">
          <section className="cm-card cm-race">
            <div className="cm-card__h"><div><h2>Quién cierra</h2><div className="cm-card__sub">La tasa de cierre de cada closer</div></div><Ir className="cm-ibtn" href="/crm" label="Abrir el CRM"><Icono id="out" /></Ir></div>
            {closers && closers.length ? (
              <ul className="cm-rc">
                {closers.map((c, i) => (
                  <li key={c.clave} className={`cm-rc__row${abrir(p.closers, c.clave) ? ' cm-fila' : ''}`} {...fila(abrir(p.closers, c.clave))}>
                    <span className="cm-rc__pos">{i === 0 ? <Icono id="trophy" /> : i + 1}</span>
                    <span className="cm-av cm-av--lg" style={colorAv(c.nombre)}>{iniciales(c.nombre)}</span>
                    <div className="cm-rc__n">{c.nombre}<div className="cm-rc__bar"><i style={{ width: `${Math.min(100, c.tasa)}%`, ...(c.bueno === false ? { '--c': 'var(--c-amber)' } : {}) } as CSSProperties} /></div></div>
                    <span className="cm-rc__v">{Math.round(c.tasa)}%</span>
                  </li>
                ))}
              </ul>
            ) : <p className="cm-vacio">{closers ? 'Todavía no hay closers con llamadas en este período.' : 'No pude leer a los closers.'}</p>}
          </section>
          </Parte>
        </div>
      </div>
    </div>
    </Compartido.Provider>
  );
}
