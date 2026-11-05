'use client';

// =============================================================================
// HojaAnuncio — la hoja «Anuncio ganador» con su DISEÑO PROPIO: la copia de Prism, con los datos reales de MaKo
// =============================================================================
// Martín, 4/11/2026: «que sea primero la copia, es decir, que se vea exactamente igual que la copia, y después la adaptación con
// Maco... copiarlo todo, desde las animaciones de entrada, las animaciones de hover, las animaciones de clic» y «Después seguí con la
// segunda hoja, de a una». La copia y la adaptación (maquetas) están en docs/diseno/mockups-dashboard/anuncio-prism/; ésta es la
// adaptación con los datos de verdad (lib/anuncio-diseno.ts arma lo que dibuja cada tarjeta, con test). La pregunta: «¿cuál
// creativo gana, y con cuánta confianza?».
//
// El movimiento sale de las RECETAS del INFORME de Prism (docs/diseno/mockups-dashboard/demos/prism/INFORME.txt): la cabecera baja
// desde −10 px (.6 s, power3.out); cada tarjeta sube desde 16 px (.75 s, power3.out) y sus esquinas aparecen desde escala 1.08 (.7 s,
// power2.out, .05 s después); las barras de las agendas crecen de izquierda a derecha (1,5 s, lineal) y su línea se dibuja .35 s
// después (1,3 s, power2.inOut); el gancho se revela de izquierda a derecha (1,3 s, power2.inOut); los números cuentan .9 s
// (power3.out); el guion que más agendó entra desde abajo (.45 s, .1 s después). Al pasar, los botones toman el borde del acento
// (.2 s). ⚠️ SUPUESTO (el INFORME no lo trae): a qué tiempo entra cada tarjeta (desde .35 s, cada .06 s) y cómo crecen los anillos,
// las barras de los guiones, el medidor y las columnas (.9 s, power3.out, cada .06 s).
//
// ⚠️ Mirando se dibuja esto; editando, la grilla con los mismos componentes (app/dashboard/EditorInforme.tsx).
// ⚠️ Lo que Prism tiene y MaKo no mide no está (lib/anuncio-diseno.ts): el «Live», el pronóstico, las regiones, la salud de la
//    plataforma y la latencia. El logo de Prism tampoco: es su dibujo.
// =============================================================================

import { createContext, useContext, useEffect, useLayoutEffect, useRef, useState, type KeyboardEvent, type ReactNode } from 'react';
import Link from '@/app/_ui/Link';
import type { Grafico, Hoja } from '@/lib/graficos-catalogo';
import { entero, plata, plataEntera } from '@/lib/marketing-diseno';
import { pct, uno, type Gajo, type NumeroAn, type VistaAnuncio } from '@/lib/anuncio-diseno';
import { CSS_ANUNCIO } from './anuncio-css';

const Compartido = createContext(false);

// Los íconos son trazos propios (los de la copia, maquetas/prism/copia.html).
const P = {
  trofeo: 'M5.5 3.5h5v3a2.5 2.5 0 0 1-5 0zM5.5 4.5H3.5v1a2 2 0 0 0 2 2M10.5 4.5h2v1a2 2 0 0 1-2 2M8 9v2.5M5.5 13h5M6.5 11.5h3',
  grilla: 'M2.5 2.5h4.5v4.5H2.5zM9 2.5h4.5v4.5H9zM2.5 9h4.5v4.5H2.5zM9 9h4.5v4.5H9z',
  salir: 'M6 10l6-6M7.5 4H12v4.5M11 9.5V12H4V5h2.5',
  check: 'm4.6 7.2 1.6 1.6 3.2-3.4',
  sube: 'M6 10V2M2.5 5.5 6 2l3.5 3.5',
  baja: 'M6 2v8M2.5 6.5 6 10l3.5-3.5',
  meta: 'M3.5 13.5V3M3.5 3.5h7.5l-1.8 2.5 1.8 2.5H3.5',
  pluma: 'M3 13l.8-3.2L11 2.6a1.6 1.6 0 0 1 2.4 2.4L6.2 12.2zM9.8 3.8l2.4 2.4',
  gancho: 'M8 2.5v6.5a3 3 0 0 1-6 0V7.5M8 2.5 6 4.5M8 2.5l2 2',
} as const;
type IconoId = keyof typeof P;
function Icono({ id, chico }: { id: IconoId; chico?: boolean }) {
  return <svg className="prs-i" viewBox={chico ? '0 0 12 12' : '0 0 16 16'} aria-hidden><path d={P[id]} /></svg>;
}

const P3 = 'cubic-bezier(.215, .61, .355, 1)', P2 = 'cubic-bezier(.25, .46, .45, .94)', P2IO = 'cubic-bezier(.455, .03, .515, .955)';
const sinMovimiento = () => typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
const anim = (n: Element | null | undefined, kf: Keyframe[], o: KeyframeAnimationOptions) => { if (n && 'animate' in n) (n as HTMLElement).animate(kf, { fill: 'backwards', easing: P3, ...o }); };
const eP3 = (t: number) => 1 - Math.pow(1 - t, 3);

/** Cuenta el número de un texto desde cero («118», «US$54.92», «32%»), con sus decimales, su prefijo y su sufijo (.9 s, power3.out). */
function contar(n: HTMLElement, demora: number) {
  const fin = n.textContent ?? '';
  const m = fin.match(/^(\D*?)(\d[\d,]*)(\.\d+)?(.*)$/);
  if (!m) return;
  const [, pre, cifra, dec = '', suf] = m, valor = Number(cifra.replace(/,/g, '') + dec), d = Math.max(0, dec.length - 1);
  const fmt = (v: number) => `${pre}${v.toLocaleString('en-US', { minimumFractionDigits: d, maximumFractionDigits: d })}${suf}`;
  const t0 = performance.now() + demora;
  n.textContent = fmt(0);
  const paso = (ahora: number) => {
    if (!n.isConnected) return;
    const t = Math.min(1, Math.max(0, (ahora - t0) / 900));
    n.textContent = t < 1 ? fmt(valor * eP3(t)) : fin;
    if (t < 1) requestAnimationFrame(paso);
  };
  requestAnimationFrame(paso);
}

/** El tamaño de una caja (los gráficos se dibujan a su tamaño real, como en Prism: un viewBox fijo deforma el texto). */
function useTam<T extends HTMLElement>() {
  const ref = useRef<T>(null);
  const [tam, setTam] = useState({ w: 0, h: 0 });
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const medir = () => setTam((t) => (t.w === el.clientWidth && t.h === el.clientHeight ? t : { w: el.clientWidth, h: el.clientHeight }));
    medir();
    if (typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver(medir);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  return [ref, tam] as const;
}

/** Un link de la app, o el texto quieto si la hoja está compartida (un link compartido no tiene sesión). */
function Ir({ href, className, etiqueta, children }: { href: string; className?: string; etiqueta?: string; children: ReactNode }) {
  if (useContext(Compartido)) return <span className={`${className ?? ''} prs-quieta`} aria-label={etiqueta}>{children}</span>;
  return <Link href={href} className={className} aria-label={etiqueta}>{children}</Link>;
}
function Vacio({ children }: { children: ReactNode }) {
  return <p className="prs-vacio">{children}</p>;
}
const accionDe = (fn: (() => void) | undefined) => (fn ? { role: 'button', tabIndex: 0, onClick: fn, onKeyDown: (e: KeyboardEvent) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); fn(); } } } : {});
const plural = (n: number, una: string, varias: string) => `${entero(n)} ${n === 1 ? una : varias}`;
/** «US$4.9k»: lo invertido en una columna chica. */
const miles = (n: number) => (Math.abs(n) >= 1000 ? `US$${(n / 1000).toFixed(1)}k` : `US$${Math.round(n)}`);
/** El paso «redondo» de las líneas guía: el más chico (1, 2, 2.5 o 5 por una potencia de 10) que deja 5 líneas o menos. */
export function pasoGuia(tope: number): number {
  if (tope <= 0) return 1;
  const p = Math.pow(10, Math.floor(Math.log10(tope / 5)));
  for (const k of [1, 2, 2.5, 5, 10]) if (tope / (k * p) <= 5) return k * p;
  return 10 * p;
}
const Hud = () => <div className="prs-hud" aria-hidden><i /><i /><i /><i /></div>;

function Cambio({ c, texto }: { c: NonNullable<NumeroAn['cambio']>; texto?: string }) {
  return (
    <span className={`prs-delta ${c.bueno ? 'prs-up' : 'prs-down'}`}>
      <Icono id={c.sube ? 'sube' : 'baja'} chico />{texto ?? c.texto}
    </span>
  );
}

// ── «Revenue» → las agendas por día ─────────────────────────────────────────────────────────────────────────────────────
function GraficoAgendas({ a }: { a: NonNullable<VistaAnuncio['agendas']> }) {
  const [ref, { w, h }] = useTam<HTMLDivElement>();
  const x0 = 34, x1 = w - 10, y0 = 14, y1 = h - 24, n = a.dias.length;
  const listo = w > 60 && h > 60 && n > 0;
  const paso = listo ? (x1 - x0) / n : 0, ancho = Math.min(24, Math.max(2, paso * 0.64)), k = listo ? (y1 - y0) / Math.max(1e-9, a.tope) : 0;
  const guia = pasoGuia(a.tope), lineas: number[] = [];
  for (let t = guia; t <= a.tope + 1e-9; t += guia) lineas.push(t);
  const xDe = (i: number) => x0 + (i + 0.5) * paso;
  let d = '', abierto = false;
  a.ritmo.forEach((v, i) => { if (v == null) { abierto = false; return; } d += `${abierto ? 'L' : 'M'}${xDe(i).toFixed(1)} ${(y1 - v * k).toFixed(1)} `; abierto = true; });
  const ult = n ? a.dias[n - 1] : null;
  return (
    <div className="prs-plot" ref={ref}>
      {listo && (
        <svg viewBox={`0 0 ${w} ${h}`} aria-hidden>
          <defs><linearGradient id="prs-g-rev" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#2ee6d6" /><stop offset="1" stopColor="#2ee6d6" stopOpacity=".25" /></linearGradient></defs>
          {lineas.map((t) => { const y = Math.round(y1 - t * k) + 0.5; return <g key={t}><line className="prs-gridln" x1={x0} x2={x1} y1={y} y2={y} /><text className="prs-ax" x={x0 - 8} y={y + 4} textAnchor="end">{entero(t)}</text></g>; })}
          <text className="prs-ax" x={x0 - 8} y={y1 + 4} textAnchor="end">0</text>
          <line x1={x0} x2={x1} y1={y1 + 0.5} y2={y1 + 0.5} stroke="var(--axis)" />
          {a.dias.map((x, i) => (
            <rect key={x.clave} className="prs-bar" x={x0 + i * paso + (paso - ancho) / 2} y={y1 - x.valor * k} width={ancho} height={Math.max(0, x.valor * k)} rx={Math.min(4, ancho / 2)} fill="url(#prs-g-rev)">
              <title>{`${x.rotulo}: ${plural(x.valor, 'agenda', 'agendas')}`}</title>
            </rect>
          ))}
          {a.marcas.map((i) => <text key={i} className="prs-ax" x={xDe(i)} y={h - 6} textAnchor="middle">{a.dias[i].rotulo}</text>)}
          {d && <path className="prs-ritmo" d={d} fill="none" stroke="var(--s2)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />}
          {ult && <circle cx={xDe(n - 1)} cy={y1 - ult.valor * k} r="3.5" fill="var(--s1)" stroke="#071222" strokeWidth="1.5" />}
        </svg>
      )}
      {listo && ult && <span className="prs-tag" style={{ left: xDe(n - 1) + 12, top: y1 - ult.valor * k }}>{`${ult.rotulo}: ${entero(ult.valor)}`}</span>}
    </div>
  );
}

// ── los anillos ───────────────────────────────────────────────────────────────────────────────────────────────────────
/** Un anillo con su lista (los «Traffic sources» y «Revenue by region» de Prism). `cuenta`: la lista dice cuántos en lugar de la parte. */
function Anillo({ gajos, centro, sub, conRegla, cuenta, abrir }: { gajos: Gajo[]; centro: string; sub: string; conRegla?: boolean; cuenta?: boolean; abrir: (clave: string) => (() => void) | undefined }) {
  const r = 61, C = 2 * Math.PI * r, hueco = 2.2;
  let acum = 0;
  return (
    <div className="prs-donut">
      <div className="prs-donut__g">
        <svg viewBox="0 0 144 144" aria-hidden>
          <circle cx="72" cy="72" r={r} fill="none" stroke="var(--well)" strokeWidth="14" />
          {Array.from({ length: 60 }, (_, i) => { const t = (i / 60) * 2 * Math.PI; return <line key={i} x1={72 + 74 * Math.cos(t)} y1={72 + 74 * Math.sin(t)} x2={72 + 77.5 * Math.cos(t)} y2={72 + 77.5 * Math.sin(t)} stroke="var(--axis)" strokeWidth="1" />; })}
          {gajos.map((g) => { const largo = (g.parte / 100) * C, off = acum; acum += largo; return <circle key={g.clave} className="prs-arco" cx="72" cy="72" r={r} fill="none" stroke={g.tono === 'sm' ? 'var(--s-muted)' : `var(--${g.tono})`} strokeWidth="14" strokeDasharray={`${Math.max(0, largo - hueco)} ${C}`} strokeDashoffset={-off} />; })}
        </svg>
        <div className="prs-donut__c"><b data-cuenta>{centro}</b><span>{sub}</span></div>
      </div>
      <ul className={`prs-dlist${conRegla ? ' prs-dlist--d' : ''}`}>
        {gajos.map((g) => (
          <li key={g.clave} {...accionDe(abrir(g.clave))}>
            <i className={`prs-${g.tono}`} /><span title={g.nombre}>{g.nombre}</span><b>{cuenta ? entero(g.n) : `${Math.round(g.parte)}%`}</b>{conRegla && <em>{g.regla}</em>}
          </li>
        ))}
      </ul>
    </div>
  );
}

// ── «Key metrics» → la curva chica ────────────────────────────────────────────────────────────────────────────────────
function Chispa({ v, tono }: { v: Array<number | null>; tono: string }) {
  const [ref, { w, h }] = useTam<HTMLDivElement>();
  const listo = w > 10 && h > 10;
  const pts = listo ? v.map((y, i) => (y == null ? null : [(i / Math.max(1, v.length - 1)) * (w - 6) + 3, h - 4 - y * (h - 10)] as const)).filter((p): p is readonly [number, number] => p != null) : [];
  const curva = (ps: ReadonlyArray<readonly [number, number]>) => {
    if (!ps.length) return '';
    let d = `M${ps[0][0].toFixed(1)} ${ps[0][1].toFixed(1)}`;
    for (let i = 0; i < ps.length - 1; i++) {
      const p0 = ps[Math.max(0, i - 1)], p1 = ps[i], p2 = ps[i + 1], p3 = ps[Math.min(ps.length - 1, i + 2)];
      d += ` C${(p1[0] + (p2[0] - p0[0]) / 6).toFixed(1)} ${(p1[1] + (p2[1] - p0[1]) / 6).toFixed(1)} ${(p2[0] - (p3[0] - p1[0]) / 6).toFixed(1)} ${(p2[1] - (p3[1] - p1[1]) / 6).toFixed(1)} ${p2[0].toFixed(1)} ${p2[1].toFixed(1)}`;
    }
    return d;
  };
  const d = curva(pts), u = pts[pts.length - 1];
  return (
    <div className="prs-kpi__sp" ref={ref}>
      {listo && pts.length >= 2 && (
        <svg viewBox={`0 0 ${w} ${h}`} aria-hidden>
          <path d={`${d} L${u[0]} ${h} L${pts[0][0]} ${h} Z`} fill={`color-mix(in oklab, var(--${tono}) 22%, transparent)`} />
          <path className="prs-chispa" d={d} fill="none" stroke="var(--spark)" strokeWidth="1.6" />
          <path className="prs-chispa" d={curva(pts.slice(-2))} fill="none" stroke={`var(--${tono})`} strokeWidth="1.8" />
          <circle cx={u[0]} cy={u[1]} r="3" fill={`var(--${tono})`} stroke="#071222" strokeWidth="1.5" />
        </svg>
      )}
    </div>
  );
}

// ── «Platform health» → el medidor ────────────────────────────────────────────────────────────────────────────────────
function Medidor({ valor }: { valor: number }) {
  const cx = 90, cy = 96, r = 76, a0 = -120;
  const punto = (ang: number, rr = r) => { const t = ((ang - 90) * Math.PI) / 180; return [cx + rr * Math.cos(t), cy + rr * Math.sin(t)] as const; };
  const [ax, ay] = punto(a0), [bx, by] = punto(120);
  const arco = `M${ax.toFixed(1)} ${ay.toFixed(1)} A${r} ${r} 0 1 1 ${bx.toFixed(1)} ${by.toFixed(1)}`;
  return (
    <svg viewBox="0 0 180 140" aria-hidden>
      <path d={arco} fill="none" stroke="#2ee6d633" strokeWidth="10" strokeLinecap="round" />
      <path className="prs-medidor" d={arco} fill="none" stroke="var(--s1)" strokeWidth="10" strokeLinecap="round" pathLength={100} strokeDasharray={`${Math.max(0.01, valor)} 100`} />
      {Array.from({ length: 21 }, (_, i) => { const ang = a0 + (i / 20) * 240, [x0, y0] = punto(ang, r - 12), [x1, y1] = punto(ang, r - (i % 5 === 0 ? 20 : 16)); return <line key={i} x1={x0} y1={y0} x2={x1} y2={y1} stroke={i % 5 === 0 ? 'var(--dim)' : 'var(--axis)'} strokeWidth="1.2" />; })}
      {[[25, -60], [50, 0], [75, 60]].map(([t, ang]) => { const [x, y] = punto(ang, r - 26); return <text key={t} className="prs-gauge__tk" x={x} y={y + 3} textAnchor="middle">{t}</text>; })}
      <g className="prs-aguja" style={{ transformOrigin: `${cx}px ${cy}px`, transform: `rotate(${a0 + (Math.min(100, Math.max(0, valor)) / 100) * 240}deg)` }}>
        <path d={`M${cx - 2.4} ${cy} L${cx} ${cy - r + 22} L${cx + 2.4} ${cy} Z`} fill="var(--ink)" />
      </g>
      <circle cx={cx} cy={cy} r="4.5" fill="var(--card)" stroke="var(--ink)" strokeWidth="2" />
    </svg>
  );
}

// ── «Quarterly revenue» → las agendas de los seis meses cerrados, con su flecha ─────────────────────────────────────────
function GraficoMeses({ m }: { m: NonNullable<VistaAnuncio['meses']> }) {
  const [ref, { w, h }] = useTam<HTMLDivElement>();
  const x0 = 46, x1 = w - 8, y1 = h - 22, n = m.meses.length, listo = w > 60 && h > 50 && n > 0;
  const max = Math.max(1, ...m.meses.map((x) => x.agendas)), tope = max * 2, k = listo ? (y1 - 20) / tope : 0;
  const paso = listo ? (x1 - x0) / n : 0, guia = pasoGuia(tope);
  const xa = x0 + paso / 2 - 14, xb = x0 + (n - 0.5) * paso + 4, ya = y1 - Math.max(10, (m.meses[0]?.agendas ?? 0) * k + 9), yb = y1 - Math.max(20, (m.meses[n - 1]?.agendas ?? 0) * k + 17);
  const d = `M${xa} ${ya} C${xa + (xb - xa) * 0.5} ${ya + 4} ${xa + (xb - xa) * 0.78} ${ya - 2} ${xb} ${yb}`;
  return (
    <div className="prs-vb" ref={ref}>
      {listo && (
        <svg viewBox={`0 0 ${w} ${h}`} aria-hidden>
          <defs>
            <linearGradient id="prs-g-q" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#c6f432" /><stop offset="1" stopColor="#7d9a1c" /></linearGradient>
            <filter id="prs-f-glow" x="-20%" y="-60%" width="140%" height="220%"><feGaussianBlur stdDeviation="3" /></filter>
          </defs>
          {[guia * 2, guia].filter((t) => t <= tope).map((t) => { const y = Math.round(y1 - t * k) + 0.5; return <g key={t}><line className="prs-gridln" x1={x0} x2={x1} y1={y} y2={y} /><text className="prs-ax" x={38} y={y + 4} textAnchor="end">{entero(t)}</text></g>; })}
          <text className="prs-ax" x={38} y={y1 + 4} textAnchor="end">0</text>
          <line x1={x0} x2={x1} y1={y1 + 0.5} y2={y1 + 0.5} stroke="var(--axis)" />
          {m.meses.map((x, i) => {
            const cx = x0 + i * paso + paso / 2;
            return (
              <g key={x.clave}>
                <rect className="prs-col" x={cx - 12} y={y1 - x.agendas * k} width="24" height={Math.max(0, x.agendas * k)} rx="3" fill="url(#prs-g-q)"><title>{`${x.rotulo}: ${plural(x.agendas, 'agenda', 'agendas')}`}</title></rect>
                <text className="prs-ax" x={cx} y={h - 4} textAnchor="middle">{paso < 58 ? x.rotulo.split(' ')[0] : x.rotulo}</text>
              </g>
            );
          })}
          {m.cambioAgendas && n >= 2 && <>
            <path d={d} fill="none" stroke="#c6f43266" strokeWidth="7" strokeLinecap="round" filter="url(#prs-f-glow)" />
            <path className="prs-flecha" d={d} fill="none" stroke="var(--s3)" strokeWidth="3.2" strokeLinecap="round" />
            <path d={`M${xb - 11} ${yb - 2} L${xb} ${yb} L${xb - 5} ${yb + 9}`} fill="none" stroke="var(--s3)" strokeWidth="3.2" strokeLinecap="round" strokeLinejoin="round" />
          </>}
        </svg>
      )}
      {listo && m.cambioAgendas && n >= 2 && <span className="prs-vb__ann" style={{ right: Math.max(0, w - xb - 2), top: yb - 17 }}>{m.cambioAgendas}</span>}
    </div>
  );
}

// ── «Signups & activations» → agendas y cierres por semana ──────────────────────────────────────────────────────────────
function GraficoSemanas({ s }: { s: NonNullable<VistaAnuncio['semanas']> }) {
  const [ref, { w, h }] = useTam<HTMLDivElement>();
  const x0 = 46, x1 = w - 8, y1 = h - 22, n = s.semanas.length, listo = w > 60 && h > 40 && n > 0;
  const k = listo ? (y1 - 6) / Math.max(1e-9, s.tope) : 0, paso = listo ? (x1 - x0) / n : 0;
  return (
    <div className="prs-vb" ref={ref}>
      {listo && (
        <svg viewBox={`0 0 ${w} ${h}`} aria-hidden>
          <defs>
            {[['prs-g-s1', '#2ee6d6'], ['prs-g-s2', '#ff5cc8']].map(([id, c]) => <linearGradient key={id} id={id} x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor={c} /><stop offset="1" stopColor={c} stopOpacity=".45" /></linearGradient>)}
          </defs>
          {[s.tope, s.tope / 2, 0].map((t) => <text key={t} className="prs-ax" x={38} y={y1 - t * k + 4} textAnchor="end">{entero(t)}</text>)}
          <line x1={x0} x2={x1} y1={y1 + 0.5} y2={y1 + 0.5} stroke="var(--axis)" />
          {s.semanas.map((x, i) => {
            const cx = x0 + i * paso + paso / 2;
            return (
              <g key={x.clave}>
                <rect className="prs-col" x={cx - 15} y={y1 - x.agendas * k} width="14" height={Math.max(0, x.agendas * k)} rx="2.5" fill="url(#prs-g-s1)"><title>{`Semana del ${x.rotulo}: ${plural(x.agendas, 'agenda', 'agendas')}`}</title></rect>
                <rect className="prs-col" x={cx + 1} y={y1 - x.cierres * k} width="13" height={Math.max(0, x.cierres * k)} rx="2.5" fill="url(#prs-g-s2)"><title>{`Semana del ${x.rotulo}: ${plural(x.cierres, 'cierre', 'cierres')}`}</title></rect>
                {(paso >= 48 || (n - 1 - i) % 2 === 0) && <text className="prs-ax" x={cx} y={h - 4} textAnchor="middle">{x.rotulo}</text>}
              </g>
            );
          })}
        </svg>
      )}
    </div>
  );
}

// ── «Checkout latency» → el gancho en el tiempo ─────────────────────────────────────────────────────────────────────────
function GraficoGancho({ g }: { g: NonNullable<VistaAnuncio['gancho']> }) {
  const [ref, { w, h }] = useTam<HTMLDivElement>();
  const x0 = 46, x1 = w - 10, y1 = h - 11, n = g.dias.length, listo = w > 60 && h > 30 && n > 1;
  const k = listo ? (y1 - 14) / Math.max(1e-9, g.tope) : 0, yMeta = y1 - g.meta * k;
  const xDe = (i: number) => x0 + (i / (n - 1)) * (x1 - x0);
  return (
    <div className="prs-vb" ref={ref}>
      {listo && (
        <svg viewBox={`0 0 ${w} ${h}`} aria-hidden>
          <text className="prs-ax" x={38} y={yMeta + 4} textAnchor="end">{g.meta}%</text>
          <text className="prs-ax" x={38} y={y1 + 4} textAnchor="end">0</text>
          <line x1={x0} x2={x1} y1={yMeta + 0.5} y2={yMeta + 0.5} stroke="var(--s5)" strokeOpacity=".55" />
          <text className="prs-slo" x={x1 - 4} y={yMeta - 6} textAnchor="end">{`Buen gancho ${g.meta}%`}</text>
          <g className="prs-lineas">
            {g.lineas.map((l) => {
              let d = '', abierto = false, ult: readonly [number, number] | null = null;
              l.valores.forEach((v, i) => { if (v == null) { abierto = false; return; } const p = [xDe(i), y1 - v * k] as const; d += `${abierto ? 'L' : 'M'}${p[0].toFixed(1)} ${p[1].toFixed(1)} `; abierto = true; ult = p; });
              const u = ult as readonly [number, number] | null;
              return d ? (
                <g key={l.id}>
                  <path d={d} fill="none" stroke={`var(--${l.tono})`} strokeWidth="1.6" strokeLinejoin="round" style={{ filter: `drop-shadow(0 0 3px color-mix(in oklab, var(--${l.tono}) 55%, transparent))` }} />
                  {u && <circle cx={u[0]} cy={u[1]} r="3" fill={`var(--${l.tono})`} />}
                </g>
              ) : null;
            })}
          </g>
        </svg>
      )}
    </div>
  );
}

export function HojaAnuncio({ hoja, vista, titulo, periodo, onGrilla, onFila, compartido = false, quieta = false }: {
  hoja: Hoja;
  vista: VistaAnuncio;
  /** El nombre de la hoja («Anuncio ganador»). */
  titulo: string;
  /** El período de la hoja, como se lee en su control («Todo», «Últimos 30 días»). */
  periodo: string;
  onGrilla?: () => void;
  /** Abrir una fila de una pieza: su detalle de siempre, como al tocarla en la grilla (un guion abre su pop-up). */
  onFila?: (g: Grafico, clave: string) => void;
  compartido?: boolean;
  /** La miniatura de «Nueva hoja». */
  quieta?: boolean;
}) {
  const { agendas, veredictos, muestra, ganadores, numeros, escalar, meses, semanas, gancho, ganador, cargando, vacia } = vista;
  const p = hoja.diseno?.piezas ?? {};
  const pieza = (id: string | undefined) => hoja.componentes.find((c): c is Grafico => c.id === id && c.clase === 'grafico');
  const abrir = (id: string | undefined, clave: string) => { const g = pieza(id); return g && onFila && !quieta ? () => onFila(g, clave) : undefined; };
  const raiz = useRef<HTMLDivElement>(null);

  // ── La entrada (una vez, al montarse) ──────────────────────────────────────────────────────────────────────────────
  useLayoutEffect(() => {
    const el = raiz.current;
    if (!el || quieta || sinMovimiento()) return;
    const todos = (s: string) => Array.from(el.querySelectorAll(s));
    anim(el.querySelector('.prs-top'), [{ opacity: 0, transform: 'translateY(-10px)' }, { opacity: 1, transform: 'none' }], { duration: 600 });
    todos('.prs-card').forEach((c, i) => {
      const t = 350 + i * 60;
      anim(c, [{ opacity: 0, transform: 'translateY(16px)' }, { opacity: 1, transform: 'none' }], { duration: 750, delay: t });
      anim(c.querySelector('.prs-hud'), [{ opacity: 0, transform: 'scale(1.08)' }, { opacity: 0.55, transform: 'none' }], { duration: 700, delay: t + 50, easing: P2 });
    });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Los gráficos crecen y los números cuentan la PRIMERA vez que llegan los datos ───────────────────────────────────
  const firma = [agendas?.total, agendas?.dias.length, veredictos?.total, muestra?.total, ganadores?.filas.length, numeros.map((x) => x.texto).join(','), escalar.parte, meses?.meses.length, semanas?.semanas.length, gancho?.dias.length, ganador?.clave].join('|');
  useEffect(() => {
    const el = raiz.current;
    if (!el || quieta || sinMovimiento()) return;
    const nuevos = (s: string) => Array.from(el.querySelectorAll<HTMLElement | SVGElement>(s)).filter((n) => { if (n.dataset.animado != null) return false; n.dataset.animado = ''; return true; });
    const base = 470;
    nuevos('[data-cuenta]').forEach((n) => contar(n as HTMLElement, base));
    const barras = nuevos('.prs-c-rev .prs-bar');
    barras.forEach((b, i) => { b.style.transformBox = 'fill-box'; b.style.transformOrigin = '50% 100%'; anim(b, [{ transform: 'scaleY(0)' }, { transform: 'none' }], { duration: 300, delay: base + (i / Math.max(1, barras.length)) * 1500, easing: P2 }); });
    nuevos('.prs-ritmo, .prs-chispa, .prs-flecha').forEach((l, i) => {
      const L = (l as SVGPathElement).getTotalLength?.() ?? 0;
      if (!L) return;
      l.style.strokeDasharray = `${L}`;
      anim(l, [{ strokeDashoffset: L }, { strokeDashoffset: 0 }], { duration: l.classList.contains('prs-ritmo') ? 1300 : 900, delay: l.classList.contains('prs-ritmo') ? base + 350 : base + 240 + i * 60, easing: P2IO });
    });
    nuevos('.prs-arco').forEach((a, i) => { const da = a.getAttribute('stroke-dasharray') ?? ''; anim(a, [{ strokeDasharray: `0 ${da.split(' ')[1] ?? 400}` }, { strokeDasharray: da }], { duration: 900, delay: base + 60 + i * 60 }); });
    nuevos('.prs-hb__fill').forEach((f, i) => anim(f, [{ transform: 'scaleX(0)' }, { transform: 'none' }], { duration: 900, delay: base + 180 + i * 60 }));
    nuevos('.prs-medidor').forEach((m) => anim(m, [{ strokeDasharray: '0 100' }, { strokeDasharray: m.getAttribute('stroke-dasharray') ?? '0 100' }], { duration: 1300, delay: base + 300, easing: 'cubic-bezier(.645, .045, .355, 1)' }));
    nuevos('.prs-aguja').forEach((g) => anim(g, [{ transform: 'rotate(-120deg)' }, { transform: g.style.transform }], { duration: 1300, delay: base + 300, easing: 'cubic-bezier(.645, .045, .355, 1)' }));
    nuevos('.prs-col, .prs-cust__bar').forEach((b, i) => { b.style.transformBox = 'fill-box'; b.style.transformOrigin = '50% 100%'; anim(b, [{ transform: 'scaleY(0)' }, { transform: 'none' }], { duration: 900, delay: base + 360 + (i % 14) * 40 }); });
    nuevos('.prs-lineas').forEach((g) => anim(g, [{ clipPath: 'inset(0 100% 0 0)' }, { clipPath: 'inset(0 0 0 0)' }], { duration: 1300, delay: base + 540, easing: P2IO }));
    nuevos('.prs-ticker__v > *').forEach((t) => anim(t, [{ transform: 'translateY(100%)', opacity: 0 }, { transform: 'none', opacity: 1 }], { duration: 450, delay: base + 700 }));
  }, [firma, quieta]);

  const sinDatos = (x: unknown) => (cargando && x == null ? null : <Vacio>Todavía no hay datos en este período.</Vacio>);

  return (
    <Compartido.Provider value={compartido}>
    <div className="prs" ref={raiz} data-quieta={quieta ? '' : undefined}>
      <style href="dash-hoja-anuncio" precedence="medium">{CSS_ANUNCIO}</style>
      <header className="prs-top">
        <span className="prs-brand"><span className="prs-brand__i"><Icono id="trofeo" /></span>{titulo}</span>
        <span className="prs-org">Los guiones de tus anuncios <span className="prs-env">{periodo}</span></span>
        <div className="prs-top__r">
          {onGrilla && !quieta && <button type="button" className="prs-btn" onClick={onGrilla}><Icono id="grilla" /><span>Ver la grilla</span></button>}
          <Ir href="/ads-manager" className="prs-icon-btn" etiqueta="Abrir el Ads Manager"><Icono id="salir" /></Ir>
        </div>
      </header>

      {vacia ? (
        <main className="prs-view">
          <section className="prs-card prs-c-vacia"><Hud />
            <h2 className="prs-card__t">Todavía no hay anuncios con su guion analizado</h2>
            <p className="prs-card__s">Cuando MaKo analice los guiones de tus anuncios de Meta, aquí se ve cuál gana y con cuánta muestra.</p>
          </section>
        </main>
      ) : (
      <main className="prs-view">
        <div className="prs-row prs-row--1">
          {/* «Revenue» → las agendas que trajeron tus anuncios, por día */}
          <section className="prs-card prs-c-rev"><Hud />
            <div className="prs-card__h">
              <div><h2 className="prs-card__t">Agendas de tus anuncios</h2><p className="prs-card__s">Por día{agendas?.recortado ? ' · los últimos 42 días' : ''}</p></div>
              <div className="prs-card__r"><span className="prs-leg"><i className="prs-s1" />Agendas</span><span className="prs-leg"><i className="prs-ln prs-s2" />Promedio de 7 días</span></div>
            </div>
            <div className="prs-rev__big">
              {agendas?.total != null ? <b data-cuenta>{entero(agendas.total)}</b> : <b className="prs-sin">—</b>}
              {agendas?.cambio && <Cambio c={agendas.cambio} />}
              {agendas?.cambio && <span className="prs-vs">contra el período anterior</span>}
            </div>
            {agendas && agendas.dias.length ? <GraficoAgendas a={agendas} /> : sinDatos(agendas)}
          </section>

          {/* «Traffic sources» → qué hacer con cada guion */}
          <section className="prs-card prs-c-traffic"><Hud />
            <div className="prs-card__h"><div><h2 className="prs-card__t">Qué hacer con cada uno</h2><p className="prs-card__s">El veredicto de cada guion</p></div></div>
            {veredictos && veredictos.gajos.length
              ? <Anillo gajos={veredictos.gajos} centro={entero(veredictos.total)} sub={veredictos.total === 1 ? 'guion' : 'guiones'} cuenta abrir={(k) => abrir(p.veredicto, k)} />
              : sinDatos(veredictos)}
          </section>

          {/* «Revenue by region» → con cuánta muestra */}
          <section className="prs-card prs-c-region"><Hud />
            <div className="prs-card__h"><div><h2 className="prs-card__t">Con cuánta muestra</h2><p className="prs-card__s">Las impresiones de cada guion</p></div></div>
            {muestra && muestra.gajos.length
              ? <Anillo gajos={muestra.gajos} centro={`${muestra.conMuestra ?? 0}%`} sub="con muestra" conRegla abrir={(k) => abrir(p.confianza, k)} />
              : sinDatos(muestra)}
          </section>
        </div>

        <div className="prs-row prs-row--2">
          {/* «Campaign ROAS» → qué guion rinde más */}
          <section className="prs-card prs-c-camp"><Hud />
            <div className="prs-card__h">
              <div><h2 className="prs-card__t">Qué guion rinde más</h2><p className="prs-card__s">Agendas por US$1.000 · con muestra</p></div>
              {ganadores?.promedio != null && <div className="prs-card__r"><span className="prs-hb__tgt">Promedio {uno(ganadores.promedio)}</span></div>}
            </div>
            {ganadores && ganadores.filas.length ? (
              <ul className="prs-hb">
                {ganadores.filas.map((f) => (
                  <li key={f.clave} {...accionDe(abrir(p.ganadores, f.clave))} title={`${f.nombre}: ${uno(f.valor)} agendas por cada US$1.000${f.sobre ? ', por encima del promedio' : ''}`}>
                    <span className="prs-hb__name">{f.nombre}</span>
                    <span className="prs-hb__track" aria-hidden><i className={`prs-hb__fill prs-${f.sobre ? 's1' : 'sm'}`} style={{ width: `${f.ancho}%` }} />{ganadores.meta != null && <i className="prs-hb__target" style={{ left: `${ganadores.meta}%` }} />}</span>
                    <span className="prs-hb__val">{uno(f.valor)}</span>
                  </li>
                ))}
              </ul>
            ) : ganadores ? <Vacio>Ningún guion juntó 8 mil impresiones todavía: con menos, no se puede juzgar.</Vacio> : sinDatos(ganadores)}
          </section>

          {/* «Key metrics» → los tres costos */}
          <section className="prs-card prs-c-kpi"><Hud />
            <div className="prs-card__h"><div><h2 className="prs-card__t">Cuánto cuesta</h2><p className="prs-card__s">Contra el período anterior · su evolución</p></div></div>
            <div className="prs-kpis">
              {numeros.map((x) => (
                <article key={x.id} className="prs-kpi">
                  <span className="prs-kpi__l">{x.titulo}</span>
                  {x.texto ? <b className="prs-kpi__n" data-cuenta>{x.texto}</b> : <b className="prs-kpi__n prs-sin">—</b>}
                  {x.cambio ? <Cambio c={x.cambio} /> : <span className="prs-delta prs-sin">{x.texto ? 'sin el anterior' : ''}</span>}
                  {x.chispa ? <Chispa v={x.chispa} tono={x.tono} /> : <div className="prs-kpi__sp" />}
                </article>
              ))}
            </div>
          </section>

          {/* «Platform health» → listos para escalar */}
          <section className="prs-card prs-c-health"><Hud />
            <div className="prs-card__h">
              <div><h2 className="prs-card__t">Listos para escalar</h2><p className="prs-card__s">Qué parte de lo invertido va a ellos</p></div>
              {escalar.n != null && (
                <div className="prs-card__r"><span className={`prs-badge${escalar.n ? '' : ' prs-badge--cero'}`}><svg className="prs-i" viewBox="0 0 14 14" aria-hidden><circle cx="7" cy="7" r="5.5" /><path d={P.check} /></svg>{escalar.n ? plural(escalar.n, 'guion', 'guiones') : 'Ninguno todavía'}</span></div>
              )}
            </div>
            <div className="prs-health">
              <div className="prs-gauge">
                <Medidor valor={escalar.parte ?? 0} />
                <div className="prs-gauge__c">{escalar.parte != null ? <b data-cuenta>{`${escalar.parte}%`}</b> : <b className="prs-sin">—</b>}<span>de lo invertido</span></div>
              </div>
              <div className="prs-hstats">
                <div><span>Invertido</span><b>{escalar.invertido != null ? plataEntera(escalar.invertido) : '—'}</b></div>
                <div><span>Agendas por US$1.000</span><b>{escalar.porMil != null ? uno(escalar.porMil) : '—'}</b></div>
                <div><span>Cierres</span><b>{escalar.cierres != null ? entero(escalar.cierres) : '—'}</b></div>
              </div>
            </div>
          </section>
        </div>

        <div className="prs-row prs-row--3">
          {/* «Quarterly revenue» → las agendas de los seis meses cerrados */}
          <section className="prs-card prs-c-growth"><Hud />
            <div className="prs-card__h"><div><h2 className="prs-card__t">Agendas por mes</h2><p className="prs-card__s">Vista larga · seis meses cerrados, sin el período</p></div></div>
            {meses && meses.meses.length ? <GraficoMeses m={meses} /> : sinDatos(meses)}
          </section>

          {/* «Signups & activations» → agendas y cierres por semana */}
          <section className="prs-card prs-c-signup"><Hud />
            <div className="prs-card__h">
              <div><h2 className="prs-card__t">Agendas y cierres</h2><p className="prs-card__s">Por semana</p></div>
              <div className="prs-card__r"><span className="prs-leg"><i className="prs-s1" />Agendas</span><span className="prs-leg"><i className="prs-s2" />Cierres</span></div>
            </div>
            <div className="prs-sg__big">
              <span>{semanas?.tasa != null ? <b data-cuenta>{pct(semanas.tasa)}</b> : <b className="prs-sin">—</b>}<em>cerraron</em></span>
              <span>{semanas?.agendas != null ? <b data-cuenta>{entero(semanas.agendas)}</b> : <b className="prs-sin">—</b>}<em>agendas</em></span>
            </div>
            {semanas && semanas.semanas.length ? <GraficoSemanas s={semanas} /> : sinDatos(semanas)}
          </section>

          {/* «Active customers» → lo invertido de los seis meses cerrados */}
          <section className="prs-card prs-c-cust"><Hud />
            <div className="prs-card__h"><div><h2 className="prs-card__t">Lo invertido por mes</h2><p className="prs-card__s">Vista larga · seis meses cerrados</p></div></div>
            {meses && meses.meses.length ? (
              <ul className="prs-cust">
                {meses.meses.map((m, i, xs) => {
                  const max = Math.max(1, ...xs.map((x) => x.gasto));
                  return (
                    <li key={m.clave} className={i === xs.length - 1 ? 'prs-is-now' : undefined} title={`${m.rotulo}: ${plataEntera(m.gasto)}`}>
                      <b>{miles(m.gasto)}</b>
                      <span className="prs-cust__bar" style={{ height: Math.max(2, Math.round((m.gasto / max) * 32)) }} />
                      <span className="prs-cust__l">{m.rotulo.split(' ')[0]}</span>
                      <span className="prs-cust__d">{m.cambioGasto ?? ' '}</span>
                    </li>
                  );
                })}
              </ul>
            ) : sinDatos(meses)}
          </section>
        </div>

        <div className="prs-row prs-row--4">
          {/* «Checkout latency» → el gancho en el tiempo */}
          <section className="prs-card prs-c-lat"><Hud />
            <div className="prs-card__h">
              <div><h2 className="prs-card__t">El gancho en el tiempo</h2><p className="prs-card__s">Por día · de los anuncios con video</p></div>
              <div className="prs-card__r prs-lat__leg">
                {(gancho?.lineas ?? []).map((l) => <span key={l.id} className="prs-leg"><i className={`prs-ln prs-${l.tono}`} />{l.nombre} <b>{l.total != null ? pct(l.total) : '—'}</b></span>)}
              </div>
            </div>
            {gancho && gancho.dias.length > 1 ? <GraficoGancho g={gancho} /> : sinDatos(gancho)}
          </section>

          {/* «Feed» → el guion que más agendó, y los atajos */}
          <section className="prs-card prs-c-dock"><Hud />
            <div className="prs-card__h"><div><h2 className="prs-card__t">El que más agendó</h2></div><div className="prs-card__r"><span className="prs-card__s">En el período</span></div></div>
            <div className="prs-ticker" {...accionDe(ganador ? abrir(p.guiones, ganador.clave) : undefined)}>
              <Icono id="trofeo" /><span className="prs-ticker__k">Más agendas</span>
              <span className="prs-ticker__v">
                {ganador ? <span><b>{plural(ganador.agendas, 'agenda', 'agendas')}</b><span className="prs-ticker__n">{ganador.nombre}</span>{ganador.cpa != null && <span className="prs-ticker__c">{plata(ganador.cpa)} cada una</span>}</span>
                  : <span>{cargando ? '' : 'Ningún guion agendó en este período.'}</span>}
              </span>
            </div>
            <nav className="prs-dock" aria-label="Atajos">
              <Ir href="/ads-manager" className="prs-dock__btn"><span className="prs-dock__ring"><Icono id="salir" /></span>Ads Manager</Ir>
              <Ir href="/ads-writer" className="prs-dock__btn"><span className="prs-dock__ring"><Icono id="pluma" /></span>Escribir otro</Ir>
              <Ir href="/dashboard?hoja=hooks-retencion" className="prs-dock__btn"><span className="prs-dock__ring"><Icono id="gancho" /></span>Hooks</Ir>
              {onGrilla && !quieta
                ? <button type="button" className="prs-dock__btn" onClick={onGrilla}><span className="prs-dock__ring"><Icono id="grilla" /></span>La grilla</button>
                : <span className="prs-dock__btn"><span className="prs-dock__ring"><Icono id="grilla" /></span>La grilla</span>}
            </nav>
          </section>
        </div>
      </main>
      )}
    </div>
    </Compartido.Provider>
  );
}
