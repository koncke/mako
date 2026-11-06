'use client';

// =============================================================================
// HojaInmobiliaria — la hoja «Inmobiliaria» con su DISEÑO PROPIO: la copia de Torque, con los datos reales de MaKo
// =============================================================================
// Martín, 4/11/2026: «que sea primero la copia, es decir, que se vea exactamente igual que la copia, y después la adaptación con
// Maco... copiarlo todo, desde las animaciones de entrada, las animaciones de hover, las animaciones de clic». La copia (maqueta) y sus
// capturas están en docs/diseno/mockups-dashboard/inmobiliaria-torque/; ésta es la adaptación con los datos de verdad
// (lib/inmobiliaria-diseno.ts arma lo que dibuja cada tarjeta, con test). La pregunta: «¿cuántos interesados visitan, cuántos compran y
// en qué proyecto?».
//
// El movimiento sale de las RECETAS del INFORME de Torque (docs/diseno/mockups-dashboard/demos/torque/INFORME.txt): las tarjetas suben
// 34 px con escala .985 (.9 s, power3.out, cada .07 s); el título entra palabra por palabra desde abajo con un giro de 6° (.85 s,
// power4.out, cada .022 s); lo chico sube 12 px (.55 s, cada .045 s); los avatares saltan desde escala .6 (back.out(3)); lo que tiene
// data-lift sube 4 px al pasar (.45 s) y vuelve en .5 s; los números cuentan 1,2 s. Lo medido al pasar: el botón fantasma se pinta, el
// suave sube su tinte del 20 al 24%, el oscuro se aclara (brightness 1.25), la píldora del selector corre .35 s.
// ⚠️ Lo SUPUESTO: las barras crecen 1,2 s, las líneas se dibujan 1,2 s (power3.inOut) y la aguja gira 1,2 s desde el inicio del arco.
//
// ⚠️ Mirando se dibuja esto; editando, la grilla con los mismos componentes (app/dashboard/EditorInforme.tsx).
// ⚠️ Lo que Torque tiene y MaKo no mide no está (lib/inmobiliaria-diseno.ts): la hora, el cronómetro de cada bahía, los repuestos y la
//    actividad de un equipo. La barra de la izquierda y la de arriba son el armazón de Torque: en MaKo las pone la app.
// =============================================================================

import { createContext, useContext, useEffect, useLayoutEffect, useRef, useState, type KeyboardEvent, type ReactNode } from 'react';
import Link from '@/app/_ui/Link';
import { Parte } from './parte';
import type { Grafico, Hoja } from '@/lib/graficos-catalogo';
import { entero, enElPeriodo, plata } from '@/lib/marketing-diseno';
import { acumulado, pct, type ProyectoInmo, type SemanaInmo, type VistaInmo } from '@/lib/inmobiliaria-diseno';
import { CSS_INMOBILIARIA } from './inmobiliaria-css';

const Compartido = createContext(false);

// Los íconos son trazos propios (los de la copia, inmobiliaria-torque/copia.html).
const P = {
  casa: 'M2.5 7.5L8 3l5.5 4.5M4 6.5v7h8v-7M6.8 13.5v-3.5h2.4v3.5',
  edificio: 'M3.5 13.5V3h6v10.5M9.5 6.5h3v7M2 13.5h12M5.5 5h.1M7.5 5h.1M5.5 7.5h.1M7.5 7.5h.1M5.5 10h.1M7.5 10h.1',
  tablero: 'M4 3.5h8v10H4zM6 3.5V2.5h4v1M6 7h4M6 9.5h4',
  cal: 'M2.5 3.5h11v10h-11zM2.5 6.5h11M5.5 2v3M10.5 2v3',
  usuarios: 'M6 7.5a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5zM1.8 13.5c.5-2.2 2.2-3.5 4.2-3.5s3.7 1.3 4.2 3.5M10.8 7.3a2.2 2.2 0 1 0-.4-4.3M11.8 10.2c1.3.4 2.2 1.6 2.5 3.3',
  bandera: 'M4 13.5V2.5M4 3h8l-1.5 3L12 9H4',
  dinero: 'M8 2.4a5.6 5.6 0 1 0 0 11.2A5.6 5.6 0 0 0 8 2.4zM9.8 6.2c-.3-.7-1-1-1.8-1-1 0-1.7.5-1.7 1.3 0 1.8 3.6.9 3.6 2.8 0 .8-.8 1.4-1.9 1.4-.9 0-1.6-.4-1.9-1.1M8 4.4v.8M8 10.7v.8',
  reloj: 'M8 2.4a5.6 5.6 0 1 0 0 11.2A5.6 5.6 0 0 0 8 2.4zM8 5v3.2l2 1.3',
  play: 'M5 3.5v9l7-4.5z',
  ojo: 'M1.8 8s2.3-4.3 6.2-4.3S14.2 8 14.2 8 11.9 12.3 8 12.3 1.8 8 1.8 8zM8 6.2a1.8 1.8 0 1 0 0 3.6 1.8 1.8 0 0 0 0-3.6z',
  check: 'M3.5 8.3l3 3 6-6.6',
  mas: 'M8 3v10M3 8h10',
  flecha: 'M5 11l6-6M6 5h5v5',
  tendencia: 'M2.5 11.5l4-4 2.5 2.5 4.5-5M10 5h3.5v3.5',
  llave: 'M5.5 8.2a2.7 2.7 0 1 0 0 .1zM7.8 7.3l5.7-3.8M11.3 5l1.3 1.6M9.6 6.1l1 1.3',
  medidor: 'M2.5 11a5.5 5.5 0 1 1 11 0M8 11l2.3-3.3',
  pin: 'M8 14s4.5-4.2 4.5-7.5a4.5 4.5 0 0 0-9 0C3.5 9.8 8 14 8 14zM8 8.3a1.8 1.8 0 1 0 0-3.6 1.8 1.8 0 0 0 0 3.6z',
  caja: 'M2.5 5L8 2.5 13.5 5v6L8 13.5 2.5 11zM2.5 5L8 7.5l5.5-2.5M8 7.5v6',
  rayo: 'M9 2L4 9h4l-1 5 5-7H8z',
  grilla: 'M2 2h5v5H2zM9 2h5v5H9zM2 9h5v5H2zM9 9h5v5H9z',
  persona: 'M8 7.5a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5zM3.5 13.5c.5-2.4 2.3-3.8 4.5-3.8s4 1.4 4.5 3.8',
} as const;
type IconoId = keyof typeof P;
function Icono({ id, tam }: { id: IconoId; tam?: number }) {
  return <svg className="tq-i" viewBox="0 0 16 16" aria-hidden style={tam ? { width: tam, height: tam } : undefined}><path d={P[id]} /></svg>;
}

const P3 = 'cubic-bezier(.215, .61, .355, 1)', P4 = 'cubic-bezier(.165, .84, .44, 1)', P3IO = 'cubic-bezier(.645, .045, .355, 1)', BACK3 = 'cubic-bezier(.34, 1.85, .64, 1)';
const sinMovimiento = () => typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
const anim = (n: Element | null | undefined, kf: Keyframe[], o: KeyframeAnimationOptions) => { if (n && 'animate' in n) (n as HTMLElement).animate(kf, { fill: 'backwards', easing: P3, ...o }); };
const eP3 = (t: number) => 1 - Math.pow(1 - t, 3);

/** Cuenta el número de un texto desde cero («1,234», «72%», «US$48,200»), con sus decimales, su prefijo y su sufijo (1,2 s, power3.out). */
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
    const t = Math.min(1, Math.max(0, (ahora - t0) / 1200));
    n.textContent = t < 1 ? fmt(valor * eP3(t)) : fin;
    if (t < 1) requestAnimationFrame(paso);
  };
  requestAnimationFrame(paso);
}

/** El tamaño de una caja (el gráfico se dibuja a su tamaño real, como en Torque: un viewBox fijo deforma el texto). */
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
function Ir({ href, className, children }: { href: string; className?: string; children: ReactNode }) {
  if (useContext(Compartido)) return <span className={`${className ?? ''} tq-quieta`}>{children}</span>;
  return <Link href={href} className={className}>{children}</Link>;
}
function Vacio({ children }: { children: ReactNode }) {
  return <p className="tq-vacio">{children}</p>;
}
const accionDe = (fn: (() => void) | undefined) => (fn ? { role: 'button', tabIndex: 0, onClick: fn, onKeyDown: (e: KeyboardEvent) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); fn(); } } } : {});
const plural = (n: number, una: string, varias: string) => `${entero(n)} ${n === 1 ? una : varias}`;
const DIAS = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
const fechaLarga = (hoy: string) => { const d = new Date(`${hoy}T12:00:00Z`); return `${DIAS[d.getUTCDay()]} ${d.getUTCDate()} de ${MESES[d.getUTCMonth()]}`; };

// Cada proyecto con su color de fachada (los de los autos de Torque) y su tono del estado (los de las bahías).
const FACHADA = ['#6b6e75', '#141518', '#b9bbbf', '#d9d4c8', '#c8252c', '#3a86d4'];
// Los tonos son los de las bahías de Torque: en reparación (azul), esperando aprobación (ámbar), en diagnóstico (violeta).
const ESTADO: Readonly<Record<ProyectoInmo['estado'], { texto: string; cls: string }>> = {
  vende: { texto: 'Vende', cls: 'repair' }, visitas: { texto: 'Con visitas', cls: 'approval' }, quieto: { texto: 'Sin visitas', cls: 'diagnosis' },
};
// Y los de las columnas del tablero de Torque, en su orden (la primera, gris).
const TONO_CARRIL = ['', 'diag', 'appr', 'repair', 'ready'] as const;
const TONO_AV = ['in', 'cr', 'ta', 'lb', 'jk'] as const;
const TONO_BARRA = ['orange', 'sky', 'teal', 'violet', 'lime'] as const;

/** La fachada de un proyecto: dos torres y su piso, un dibujo propio en el lugar del auto del elevador de Torque. */
function Fachada({ color, n }: { color: string; n: number }) {
  const alto = 30 + ((n * 7) % 14), ancho = 34 + ((n * 5) % 10);
  const ventanas: ReactNode[] = [];
  for (let f = 0; f < 4; f++) for (let c = 0; c < 3; c++) ventanas.push(<rect key={`a${f}${c}`} x={49 + c * 9} y={72 - alto - 6 + 8 + f * 9} width="5" height="5" rx="1" fill="#fff" opacity={f * 9 + 14 > alto ? 0 : 0.78} />);
  for (let f = 0; f < 2; f++) for (let c = 0; c < 3; c++) ventanas.push(<rect key={`b${f}${c}`} x={88 + c * 9} y={48 + f * 9} width="5" height="5" rx="1" fill="#fff" opacity=".78" />);
  return (
    <svg viewBox="0 0 149 92" preserveAspectRatio="none" aria-hidden>
      <rect x="10" y="6" width="6" height="80" rx="3" fill="var(--post)" /><rect x="133" y="6" width="6" height="80" rx="3" fill="var(--post)" />
      <rect x="44" y={72 - alto - 6} width={ancho} height={alto + 6} rx="2" fill={color} />
      <rect x="84" y="42" width="34" height="30" rx="2" fill={color} opacity=".82" />
      {ventanas}
      <rect x="16" y="72" width="117" height="4" fill="#8a3a1c" />
    </svg>
  );
}

function Anillo({ p }: { p: number | null }) {
  const r = 14, L = 2 * Math.PI * r, v = p == null ? 0 : Math.max(0, Math.min(100, p));
  return (
    <span className="tq-ring" title="Compran, de los que visitan">
      <svg viewBox="0 0 34 34"><circle cx="17" cy="17" r={r} fill="none" stroke="var(--well)" strokeWidth="3.5" /><circle className="tq-ring__v" cx="17" cy="17" r={r} fill="none" stroke="var(--sky)" strokeWidth="3.5" strokeLinecap="round" strokeDasharray={`${(L * v) / 100} ${L}`} /></svg>
      <span>{p == null ? '—' : `${Math.round(v)}%`}</span>
    </span>
  );
}

// ── «Sales» → interesados y visitas, por semana ─────────────────────────────────────────────────────────────────────
function Lineas({ filas }: { filas: SemanaInmo[] }) {
  const [ref, { w, h }] = useTam<HTMLDivElement>();
  if (w < 120 || h < 120 || filas.length < 2) return <div className="tq-chart" ref={ref}>{filas.length < 2 && w > 0 ? <Vacio>Con dos semanas de datos aparece la curva.</Vacio> : null}</div>;
  const x0 = 44, x1 = w - 14, yT = 10, yB = Math.min(172, h - 23);
  const max = Math.max(1, ...filas.map((f) => Math.max(f.leads, f.agendas)));
  const paso = max <= 5 ? 1 : max <= 10 ? 2 : max <= 25 ? 5 : max <= 50 ? 10 : max <= 100 ? 20 : max <= 250 ? 50 : max <= 500 ? 100 : 250;
  const tope = Math.ceil((max * 1.1) / (paso * 2)) * paso * 2, k = (yB - yT) / tope;
  const x = (i: number) => x0 + (i * (x1 - x0)) / (filas.length - 1);
  const linea = (vs: number[]) => vs.map((v, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)},${(yB - v * k).toFixed(1)}`).join('');
  const l = linea(filas.map((f) => f.leads)), a = linea(filas.map((f) => f.agendas));
  const cada = Math.max(1, Math.ceil(filas.length / (w < 400 ? 4 : 6)));
  return (
    <div className="tq-chart" ref={ref}>
      <svg viewBox={`0 0 ${w} ${h}`} role="img" aria-label="Interesados y visitas, por semana">
        <defs><linearGradient id="tq-area" x1="0" x2="0" y1="0" y2="1"><stop offset="0" stopColor="#e2611b" stopOpacity=".22" /><stop offset="1" stopColor="#e2611b" stopOpacity="0" /></linearGradient></defs>
        {[tope, tope / 2, 0].map((v) => <g key={v}><line className="tq-chart__grid" x1={x0} x2={x1} y1={yB - v * k} y2={yB - v * k} /><text className="tq-chart__ax" x={x0 - 6} y={yB - v * k + 4} textAnchor="end">{entero(v)}</text></g>)}
        <path className="tq-chart__fill" d={`${l}L${x1},${yB}L${x0},${yB}Z`} fill="url(#tq-area)" />
        <path className="tq-chart__line" d={l} fill="none" stroke="#e2611b" strokeWidth="2.4" strokeLinejoin="round" strokeLinecap="round" />
        <path className="tq-chart__line" d={a} fill="none" stroke="#3a86d4" strokeWidth="2.4" strokeLinejoin="round" strokeLinecap="round" />
        {filas.map((f, i) => (i % cada === 0 || i === filas.length - 1) && (i === filas.length - 1 || filas.length - 1 - i >= cada / 2) ? <text key={f.clave} className="tq-chart__x" x={x(i)} y={yB + 22} textAnchor="middle">{f.rotulo}</text> : null)}
      </svg>
    </div>
  );
}

// ── «Shop load» → cuántos agendan una visita: un arco de 240°, la parte en naranja, marcas adentro y la aguja ─────────────
function Medidor({ p }: { p: number }) {
  const cx = 105, cy = 98, r = 88, A0 = -120, A1 = 120, v = Math.max(0, Math.min(100, p));
  const pt = (a: number, rr: number): [number, number] => [cx + rr * Math.sin((a * Math.PI) / 180), cy - rr * Math.cos((a * Math.PI) / 180)];
  const arco = (a: number, b: number) => { const [x1, y1] = pt(a, r), [x2, y2] = pt(b, r); return `M${x1.toFixed(1)},${y1.toFixed(1)}A${r},${r} 0 ${b - a > 180 ? 1 : 0} 1 ${x2.toFixed(1)},${y2.toFixed(1)}`; };
  const aguja = A0 + ((A1 - A0) * v) / 100, [nx, ny] = pt(aguja, 58);
  return (
    <svg viewBox="0 0 210 180" aria-hidden>
      <path d={arco(A0, A1)} fill="none" stroke="var(--well)" strokeWidth="16" strokeLinecap="round" />
      {v > 0.5 && <path className="tq-gauge__v" d={arco(A0, aguja)} fill="none" stroke="var(--orange)" strokeWidth="16" strokeLinecap="round" />}
      {Array.from({ length: 11 }, (_, i) => { const a = A0 + i * 24, [x1, y1] = pt(a, i % 5 ? 70 : 66), [x2, y2] = pt(a, 76); return <line key={i} x1={x1.toFixed(1)} y1={y1.toFixed(1)} x2={x2.toFixed(1)} y2={y2.toFixed(1)} stroke={i % 5 ? '#c9c7c0' : '#3a3b3f'} strokeWidth={i % 5 ? 1.4 : 2.2} strokeLinecap="round" />; })}
      <g className="tq-gauge__needle" style={{ transformOrigin: `${cx}px ${cy}px` }} data-giro={aguja - A0}><path d={`M${cx - 3},${cy} L${nx.toFixed(1)},${ny.toFixed(1)} L${cx + 3},${cy}Z`} fill="var(--text)" /></g>
      <circle cx={cx} cy={cy} r="7" fill="var(--text)" /><circle cx={cx} cy={cy} r="3" fill="var(--surface)" />
    </svg>
  );
}

export function HojaInmobiliaria({ hoja, vista, titulo, hoy, periodo, onGrilla, onFila, compartido = false, quieta = false }: {
  hoja: Hoja;
  vista: VistaInmo;
  /** El nombre de la hoja («Inmobiliaria»). */
  titulo: string;
  /** Hoy en el negocio (YYYY-MM-DD): la fecha de la cabecera. */
  hoy: string;
  /** El período de la hoja, como se lee en su control («Últimos 90 días»). */
  periodo: string;
  onGrilla?: () => void;
  /** Abrir una fila de una pieza: su detalle de siempre, como al tocarla en la grilla. */
  onFila?: (g: Grafico, clave: string) => void;
  compartido?: boolean;
  /** La miniatura de «Nueva hoja»: sin entrada, sin cifras que cuentan y sin nada que se toque. */
  quieta?: boolean;
}) {
  const v = vista;
  const p = hoja.diseno?.piezas ?? {};
  const pieza = (id: string | undefined) => hoja.componentes.find((c): c is Grafico => c.id === id && c.clase === 'grafico');
  const abrir = (id: string | undefined, clave: string) => { const g = pieza(id); return g && onFila && !quieta ? () => onFila(g, clave) : undefined; };
  const raiz = useRef<HTMLDivElement>(null);
  const [modo, setModo] = useState<'semana' | 'acumulado'>('semana');
  const seg = useRef<HTMLDivElement>(null), segPill = useRef<HTMLSpanElement>(null), segAntes = useRef<boolean>(false);

  // La píldora del selector corre .35 s con la curva de la página (lo medido de Torque); la primera vez se pone sin moverse.
  useLayoutEffect(() => {
    const c = seg.current, pl = segPill.current, on = c?.querySelector<HTMLElement>('[aria-pressed="true"]');
    if (!c || !pl || !on) return;
    pl.style.width = `${on.offsetWidth}px`;
    if (!segAntes.current) { pl.style.transition = 'none'; pl.style.transform = `translateX(${on.offsetLeft - 3}px)`; void pl.offsetWidth; pl.style.transition = ''; segAntes.current = true; }
    else pl.style.transform = `translateX(${on.offsetLeft - 3}px)`;
  });

  // ── La entrada (una vez, al montarse) ──────────────────────────────────────────────────────────────────────────────
  useLayoutEffect(() => {
    const el = raiz.current;
    if (!el || quieta || sinMovimiento()) return;
    el.querySelectorAll('.tq-head__title > span > span').forEach((w, i) => anim(w, [{ transform: 'translateY(115%) rotate(6deg)' }, { transform: 'none' }], { duration: 850, delay: 120 + i * 22, easing: P4 }));
    anim(el.querySelector('.tq-head__eyebrow'), [{ opacity: 0, transform: 'translateY(8px)' }, { opacity: 1, transform: 'none' }], { duration: 550, delay: 120 });
    el.querySelectorAll('.tq-head__actions > *').forEach((n, i) => anim(n, [{ opacity: 0, transform: 'translateY(14px)' }, { opacity: 1, transform: 'none' }], { duration: 550, delay: 240 + i * 70 }));
    el.querySelectorAll('.tq-stat, .tq-card').forEach((c, i) => anim(c, [{ opacity: 0, transform: 'translateY(34px) scale(.985)' }, { opacity: 1, transform: 'none' }], { duration: 900, delay: 200 + i * 70 }));
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Lo que sube al pasar (data-lift: −4 px, .45 s; vuelve en .5 s), sólo con un puntero que pasa ─────────────────────
  useEffect(() => {
    const el = raiz.current;
    if (!el || quieta || sinMovimiento() || typeof matchMedia !== 'function' || !matchMedia('(hover: hover)').matches) return;
    const quitar: Array<() => void> = [];
    el.querySelectorAll<HTMLElement>('[data-lift]').forEach((e) => {
      const entra = () => e.animate([{ transform: 'none' }, { transform: 'translateY(-4px)' }], { duration: 450, easing: P3, fill: 'forwards' });
      const sale = () => e.animate([{ transform: 'translateY(-4px)' }, { transform: 'none' }], { duration: 500, easing: P3, fill: 'forwards' });
      e.addEventListener('pointerenter', entra); e.addEventListener('pointerleave', sale);
      quitar.push(() => { e.removeEventListener('pointerenter', entra); e.removeEventListener('pointerleave', sale); });
    });
    return () => quitar.forEach((q) => q());
  });

  // ── Lo de adentro crece y cuenta la PRIMERA vez que llegan los datos ───────────────────────────────────────────────
  const firma = [v.medidor.leads, v.proyectos?.filas.length, v.tablero?.enTablero, v.semanas?.filas.length, v.asesores?.length, v.motivos?.filas.length, v.avances?.length, v.origen?.filas.length].join('|');
  useEffect(() => {
    const el = raiz.current;
    if (!el || quieta || sinMovimiento()) return;
    const nuevos = (s: string) => Array.from(el.querySelectorAll<HTMLElement | SVGElement>(s)).filter((n) => { if (n.dataset.animado != null) return false; n.dataset.animado = ''; return true; });
    const base = 450;
    nuevos('[data-cuenta]').forEach((n) => contar(n as HTMLElement, base - 150));
    nuevos('.tq-bay').forEach((b, i) => anim(b, [{ opacity: 0, transform: 'translateY(12px)' }, { opacity: 1, transform: 'none' }], { duration: 550, delay: base - 30 + i * 45 }));
    nuevos('.tq-jc').forEach((b, i) => anim(b, [{ opacity: 0, transform: 'translateY(12px)' }, { opacity: 1, transform: 'none' }], { duration: 550, delay: base + 70 + i * 45 }));
    nuevos('.tq-av').forEach((a, i) => anim(a, [{ opacity: 0, transform: 'scale(.6)' }, { opacity: 1, transform: 'none' }], { duration: 600, delay: base + 250 + (i % 12) * 50, easing: BACK3 }));
    nuevos('.tq-tech__bar span, .tq-stock__bar span').forEach((b, i) => anim(b, [{ transform: 'scaleX(0)' }, { transform: 'none' }], { duration: 1200, delay: base + 200 + i * 50 }));
    nuevos('.tq-chart__line').forEach((pth) => { const L = (pth as SVGPathElement).getTotalLength?.() ?? 0; if (!L) return; pth.style.strokeDasharray = `${L}`; anim(pth, [{ strokeDashoffset: L }, { strokeDashoffset: 0 }], { duration: 1200, delay: base + 200, easing: P3IO }); });
    nuevos('.tq-chart__fill').forEach((f) => anim(f, [{ opacity: 0 }, { opacity: 1 }], { duration: 900, delay: base + 650 }));
    nuevos('.tq-gauge__v').forEach((g) => { const L = (g as SVGPathElement).getTotalLength?.() ?? 0; if (!L) return; g.style.strokeDasharray = `${L}`; anim(g, [{ strokeDashoffset: L }, { strokeDashoffset: 0 }], { duration: 1200, delay: base + 250 }); });
    nuevos('.tq-gauge__needle').forEach((n) => anim(n, [{ transform: `rotate(-${Number(n.dataset.giro ?? 0)}deg)` }, { transform: 'none' }], { duration: 1200, delay: base + 250 }));
    nuevos('.tq-ring__v').forEach((r) => { const d = (r.getAttribute('stroke-dasharray') ?? '0 0').split(' '); anim(r, [{ strokeDasharray: `0 ${d[1]}` }, { strokeDasharray: d.join(' ') }], { duration: 1200, delay: base + 200 }); });
  }, [firma, quieta]);

  const sinDatos = (x: unknown) => (v.cargando && x == null ? null : <Vacio>Todavía no hay datos en este período.</Vacio>);
  const proyectos = v.proyectos?.filas ?? [];
  const libres = Math.max(0, 6 - proyectos.length);
  const semanas = v.semanas ? (modo === 'acumulado' ? acumulado(v.semanas.filas) : v.semanas.filas) : [];
  const ICONO_N: Readonly<Record<string, IconoId>> = { asistencia: 'persona', cierre: 'bandera', ticket: 'dinero', ciclo: 'reloj' };
  const tituloEnPalabras = titulo.split(' ').map((w, i) => <span key={i} style={{ display: 'inline-block', overflow: 'hidden', verticalAlign: 'top' }}><span style={{ display: 'inline-block' }}>{w}</span>{' '}</span>);

  return (
    <Compartido.Provider value={compartido}>
    <div className="tq" ref={raiz} data-quieta={quieta ? '' : undefined}>
      <style href="dash-hoja-inmobiliaria" precedence="medium">{CSS_INMOBILIARIA}</style>
      <div className="tq-cuerpo">
      <Parte id="cabecera">
      <section className="tq-head">
        <div>
          <div className="tq-head__eyebrow">{fechaLarga(hoy)} · {periodo}</div>
          <h1 className="tq-head__title">{tituloEnPalabras}</h1>
        </div>
        <div className="tq-head__actions">
          {onGrilla && !quieta && <button type="button" className="tq-btn tq-btn--ghost" onClick={onGrilla}><Icono id="grilla" />Ver la grilla</button>}
          <Ir href="/crm" className="tq-btn tq-btn--primary"><Icono id="usuarios" />Abrir el CRM</Ir>
        </div>
      </section>
      </Parte>

      <Parte id="numeros">
      <div className="tq-stats">
        {v.numeros.map((n) => (
          <div key={n.id} className="tq-stat" data-lift>
            <div className="tq-stat__h"><span className="tq-ic"><Icono id={ICONO_N[n.id]} /></span>{n.nombre}</div>
            <div className="tq-stat__v">{n.texto != null ? <><span data-cuenta>{n.texto}</span>{n.unidad && <small>{n.unidad}</small>}</> : <span className="tq-sin">—</span>}</div>
            {n.chip ? <span className={`tq-chip${n.chip.tono === 'bueno' ? ' tq-chip--good' : n.chip.tono === 'malo' ? ' tq-chip--warn' : ''}`}>{n.chip.texto}</span> : <span className="tq-chip tq-chip--nada">{v.cargando ? '' : 'sin dato en el período'}</span>}
          </div>
        ))}
      </div>
      </Parte>

      {v.vacia ? (
        <Parte id="vacia">
      <section className="tq-card tq-c-vacia">
          <h2 className="tq-card__t">Todavía no entró ningún interesado en este período</h2>
          <p className="tq-vacio">Cuando entren interesados a tu CRM, aquí ves tus proyectos, quién visita, quién compra y por qué no.</p>
        </section>
      </Parte>
      ) : (
      <>
      {/* «The floor» → tus proyectos */}
      <Parte id="proyectos">
      <section className="tq-card tq-fl-bays">
        <div className="tq-card__h"><span className="tq-ic"><Icono id="edificio" /></span><h2 className="tq-card__t">Tus proyectos</h2>
          <span className="tq-card__aside">{v.proyectos ? `${entero(v.proyectos.conVisitas)} de ${entero(v.proyectos.total)} con visitas` : ''}</span></div>
        {v.proyectos ? (
          <div className="tq-bays">
            {proyectos.map((pr, i) => {
              const e = ESTADO[pr.estado], ir = abrir(p.proyectos, pr.clave);
              return (
                <article key={pr.clave} className={`tq-bay tq-bay--${e.cls}`} data-lift>
                  <div className="tq-bay__h"><span className="tq-bay__n">N.º {pr.n}</span><span className="tq-pill"><i />{e.texto}</span></div>
                  <div className="tq-bay__stage"><Fachada color={FACHADA[i % FACHADA.length]} n={pr.n} /></div>
                  <span className="tq-bay__car" title={pr.nombre} {...accionDe(ir)}>{pr.nombre}</span>
                  <div className="tq-bay__who"><span className="tq-plate">{entero(pr.leads)}</span>{pr.leads === 1 ? 'interesado' : 'interesados'}</div>
                  {pr.agendas > 0 ? (
                    <div className="tq-bay__time"><Icono id="play" /><b>{entero(pr.agendas)}</b><span className="tq-bay__u">{pr.agendas === 1 ? 'visita' : 'visitas'}</span><Anillo p={pr.compra} /></div>
                  ) : <div className="tq-bay__wait"><Icono id="reloj" tam={13} />Sin visitas aún</div>}
                  <div className="tq-bay__act">
                    {ir ? <button type="button" className={`tq-btn tq-btn--sm ${pr.estado === 'quieto' ? 'tq-btn--soft' : 'tq-btn--primary'}`} onClick={ir}><Icono id="usuarios" />Ver interesados</button>
                      : <Ir href="/crm" className={`tq-btn tq-btn--sm ${pr.estado === 'quieto' ? 'tq-btn--soft' : 'tq-btn--primary'}`}><Icono id="usuarios" />Ver interesados</Ir>}
                  </div>
                </article>
              );
            })}
            {Array.from({ length: libres }, (_, i) => (
              <article key={`libre-${i}`} className="tq-bay tq-bay--free">
                <div className="tq-bay__h"><span className="tq-bay__n">N.º {proyectos.length + i + 1}</span><small>Otro proyecto</small></div>
                <div className="tq-bay__stage tq-is-free"><svg viewBox="0 0 149 92" preserveAspectRatio="none" aria-hidden><rect x="10" y="6" width="6" height="80" rx="3" fill="var(--post)" /><rect x="133" y="6" width="6" height="80" rx="3" fill="var(--post)" />{[40, 60, 80, 100, 120].map((x) => <line key={x} x1={x} x2={x} y1="10" y2="74" stroke="#1c1a1614" />)}<rect x="16" y="74" width="117" height="4" rx="2" fill="#dcdad3" /></svg><span>Libre</span></div>
                <p className="tq-bay__note">{i === 0 ? 'Un proyecto nuevo del CRM aparece aquí.' : ''}</p>
                {i === 0 && <div className="tq-bay__act"><Ir href="/crm" className="tq-btn tq-btn--sm tq-btn--soft"><Icono id="mas" />Crear un proyecto</Ir></div>}
              </article>
            ))}
          </div>
        ) : sinDatos(v.proyectos)}
      </section>
      </Parte>

      {/* «Job board» → tus interesados, por etapa */}
      <Parte id="tablero">
      <section className="tq-card tq-fl-board">
        <div className="tq-card__h"><span className="tq-ic"><Icono id="tablero" /></span><h2 className="tq-card__t">Tus interesados, por etapa</h2>
          <span className="tq-card__aside">{v.tablero && v.medidor.leads != null ? `${plural(v.medidor.leads, 'interesado', 'interesados')} en el período · se mueven en el CRM` : ''}</span>
          <Ir href="/crm" className="tq-ibtn"><Icono id="flecha" /></Ir></div>
        {v.tablero && v.tablero.carriles.length ? (
          <div className="tq-lanes">
            {v.tablero.carriles.map((c, i) => (
              <section key={c.etapa} className={`tq-lane${TONO_CARRIL[i % TONO_CARRIL.length] ? ` tq-lane--${TONO_CARRIL[i % TONO_CARRIL.length]}` : ''}`}>
                <div className="tq-lane__h"><i /><span className="tq-lane__n" title={c.etapa}>{c.etapa}</span><b>{entero(c.total)}</b></div>
                {c.tarjetas.map((t) => {
                  const ir = abrir(p.tablero, t.clave);
                  return (
                    <article key={t.clave} className="tq-jc" data-lift {...accionDe(ir)}>
                      <div className="tq-jc__top">
                        {t.compro ? <span className="tq-jc__tag tq-jc__tag--ok"><Icono id="check" /></span> : t.agendo ? <span className="tq-jc__tag tq-jc__tag--walk"><Icono id="cal" /></span> : <span className="tq-jc__tag tq-jc__tag--rush"><Icono id="rayo" /></span>}
                        {t.nProyecto != null && <span className="tq-jc__bay">P{t.nProyecto}</span>}
                      </div>
                      <div className="tq-jc__name">{t.nombre}</div>
                      <div className="tq-jc__own">{t.proyecto ?? 'Sin proyecto'}</div>
                      <div className={`tq-jc__st${t.compro ? ' tq-jc__st--good' : t.agendo ? ' tq-jc__st--warn' : ''}`}><Icono id={t.compro ? 'check' : t.agendo ? 'cal' : 'reloj'} />{t.compro ? 'Compró' : t.agendo ? 'Agendó una visita' : 'Sin visita'}</div>
                      <div className="tq-jc__foot">
                        {t.iniciales ? <span className={`tq-av tq-t-${TONO_AV[t.iniciales.charCodeAt(0) % TONO_AV.length]}`} title={t.asesor ?? undefined}>{t.iniciales}</span> : <span className="tq-jc__empty" title="Sin asesor" />}
                        <span className={`tq-btn tq-btn--xs ${t.compro ? 'tq-btn--dark' : 'tq-btn--soft'}`}>Abrir</span>
                      </div>
                    </article>
                  );
                })}
                {!c.tarjetas.length && <p className="tq-lane__nada">Sus interesados no entraron en el tablero (trae los primeros 50 del período).</p>}
              </section>
            ))}
          </div>
        ) : sinDatos(v.tablero)}
      </section>
      </Parte>

      <div className="tq-fl-r3">
        {/* «Arriving today» → de dónde llegan */}
        <Parte id="origen">
      <section className="tq-card tq-fl-arr">
          <div className="tq-card__h"><span className="tq-ic"><Icono id="pin" /></span><h2 className="tq-card__t">De dónde llegan</h2><Ir href="/crm" className="tq-btn tq-btn--sm tq-btn--ghost tq-card__btn">En el CRM</Ir></div>
          {v.origen && v.origen.filas.length ? (
            <ul className="tq-arr">
              {v.origen.filas.map((o) => {
                const ir = abrir(p.origen, o.clave);
                return (
                  <li key={o.clave}>
                    <span className="tq-arr__t" data-cuenta>{entero(o.valor)}</span>
                    <span className="tq-arr__who"><b>{o.nombre}</b><span><span className="tq-plate">{pct(o.parte)}</span>de los interesados</span></span>
                    {ir ? <button type="button" className="tq-btn tq-btn--xs tq-btn--soft" onClick={ir}><Icono id="ojo" />Ver</button> : <span className="tq-btn tq-btn--xs tq-btn--soft tq-quieta"><Icono id="ojo" />Ver</span>}
                  </li>
                );
              })}
            </ul>
          ) : sinDatos(v.origen)}
        </section>
      </Parte>

        {/* «Sales» → interesados y visitas, por semana */}
        <Parte id="semanas">
      <section className="tq-card tq-fl-sales">
          <div className="tq-card__h"><span className="tq-ic"><Icono id="tendencia" /></span><h2 className="tq-card__t">Interesados</h2>
            <div className="tq-seg" ref={seg}><span className="tq-seg__pill" ref={segPill} />
              <button type="button" className="tq-seg__btn" aria-pressed={modo === 'semana'} onClick={() => setModo('semana')}>Semanal</button>
              <button type="button" className="tq-seg__btn" aria-pressed={modo === 'acumulado'} onClick={() => setModo('acumulado')}>Total</button>
            </div></div>
          {v.semanas ? (
            <>
              <div className="tq-sales__v" data-cuenta>{entero(v.semanas.leads)}</div>
              <p className="tq-sales__sub">interesados {enElPeriodo(periodo)} · {plural(v.semanas.agendas, 'agendó una visita', 'agendaron una visita')}{v.semanas.leads ? ` · ${pct((v.semanas.agendas / v.semanas.leads) * 100)} agenda` : ''}</p>
              <div className="tq-leg"><span><i className="tq-tone-orange" />Interesados</span><span><i className="tq-tone-sky" />Visitas</span></div>
              <Lineas filas={semanas} />
            </>
          ) : sinDatos(v.semanas)}
        </section>
      </Parte>

        {/* «Technicians» → quién vende */}
        <Parte id="asesores">
      <section className="tq-card tq-fl-techs">
          <div className="tq-card__h"><span className="tq-ic"><Icono id="usuarios" /></span><h2 className="tq-card__t">Quién vende</h2></div>
          {v.asesores && v.asesores.length ? (
            <div className="tq-techs">
              {v.asesores.map((a, i) => (
                <div key={a.clave} className="tq-tech" {...accionDe(abrir(p.asesores, a.clave))}>
                  <span className={`tq-av tq-t-${TONO_AV[i % TONO_AV.length]}`}>{a.iniciales}</span>
                  <div>
                    <div className="tq-tech__h"><b>{a.nombre}</b><span className={`tq-tech__state${a.mejor ? ' tq-tech__state--ok' : ''}`}><Icono id={a.mejor ? 'check' : 'bandera'} />{a.tasa != null ? `${pct(a.tasa)} cierra` : 'sin visitas'}</span></div>
                    <div className="tq-tech__bar"><span className={`tq-tone-${TONO_BARRA[i % TONO_BARRA.length]}`} style={{ width: `${Math.max(2, a.ancho * 100)}%` }} /></div>
                    <small>{plural(a.visitas, 'visita', 'visitas')} · {plural(a.cierres, 'compra', 'compras')} · {plata(a.vendido)}</small>
                  </div>
                </div>
              ))}
            </div>
          ) : sinDatos(v.asesores)}
        </section>
      </Parte>
      </div>

      <div className="tq-fl-r4">
        {/* «Running low» → por qué no compraron */}
        <Parte id="motivos">
      <section className="tq-card tq-fl-stock">
          <div className="tq-card__h"><span className="tq-ic"><Icono id="caja" /></span><h2 className="tq-card__t">Por qué no compran</h2><Ir href="/crm" className="tq-btn tq-btn--sm tq-btn--soft tq-card__btn">En el CRM</Ir></div>
          {v.motivos && v.motivos.filas.length ? (
            <ul className="tq-stock">
              {v.motivos.filas.map((m, i) => (
                <li key={m.clave} {...accionDe(abrir(p.motivos, m.clave))}>
                  <div><b>{m.nombre}</b><code>{pct(m.parte)} de los que se perdieron</code><div className="tq-stock__bar"><span className={i ? 'tq-tone-amber' : 'tq-tone-bad'} style={{ width: `${Math.max(4, m.parte)}%` }} /></div></div>
                  <span className={`tq-stock__n ${i ? 'tq-is-warn' : 'tq-is-bad'}`}>{entero(m.valor)}<small>/{entero(v.motivos!.total)}</small></span>
                </li>
              ))}
            </ul>
          ) : v.cargando && v.motivos == null ? null : <Vacio>Nadie marcó por qué no compró en este período: se marca al pasar un interesado a perdido.</Vacio>}
        </section>
      </Parte>

        {/* «Shop load» → cuántos agendan una visita */}
        <Parte id="medidor">
      <section className="tq-card tq-fl-load">
          <div className="tq-card__h"><span className="tq-ic"><Icono id="medidor" /></span><h2 className="tq-card__t">Agendan una visita</h2></div>
          {v.medidor.pct != null ? (
            <div className="tq-gauge"><Medidor p={v.medidor.pct} /><div className="tq-gauge__mid"><b data-cuenta>{pct(v.medidor.pct)}</b><span>de los interesados agendan</span></div></div>
          ) : sinDatos(v.medidor.leads)}
          <div className="tq-load__tiles">
            <div><span>Interesados</span><b>{v.medidor.leads != null ? entero(v.medidor.leads) : '—'}</b></div>
            <div><span>Agendaron una visita</span><b>{v.medidor.agendas != null ? entero(v.medidor.agendas) : '—'}</b></div>
            <div><span>Ya compraron</span><b>{v.medidor.cierres != null ? entero(v.medidor.cierres) : '—'}</b></div>
          </div>
        </section>
      </Parte>

        {/* «Team activity» → los que avanzan (compraron o agendaron una visita), sacados del tablero */}
        <Parte id="avances">
      <section className="tq-card tq-fl-feed">
          <div className="tq-card__h"><span className="tq-ic"><Icono id="llave" /></span><h2 className="tq-card__t">Los que avanzan</h2>{v.medidor.cierres != null ? <span className="tq-card__aside">{plural(v.medidor.cierres, 'compró', 'compraron')}</span> : null}</div>
          {v.avances && v.avances.length ? (
            <ul className="tq-feed">
              {v.avances.map((t) => (
                <li key={t.clave} {...accionDe(abrir(p.tablero, t.clave))}>
                  <span className="tq-feed__ic"><Icono id={t.compro ? 'llave' : 'cal'} /></span>
                  <div><p><b>{t.nombre}</b> {t.compro ? 'compró' : 'agendó una visita'}{t.proyecto ? <> · <code>{t.proyecto}</code></> : null}</p><small>{t.asesor ? `Lo atiende ${t.asesor}` : 'Sin asesor asignado'}</small></div>
                </li>
              ))}
            </ul>
          ) : v.cargando && v.avances == null ? null : <Vacio>Nadie compró ni agendó una visita todavía en este período.</Vacio>}
        </section>
      </Parte>
      </div>
      </>
      )}
      </div>
    </div>
    </Compartido.Provider>
  );
}
