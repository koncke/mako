'use client';

// =============================================================================
// HojaServicio — la hoja «Agencia o servicio» con su DISEÑO PROPIO: la copia de Sunrow, con los datos reales de MaKo
// =============================================================================
// Martín, 4/11/2026: «que sea primero la copia, es decir, que se vea exactamente igual que la copia, y después la adaptación con
// Maco... copiarlo todo, desde las animaciones de entrada, las animaciones de hover, las animaciones de clic» y «Después seguí con la
// segunda hoja, de a una». La copia y la adaptación (maquetas) están en docs/diseno/mockups-dashboard/servicio-sunrow/; ésta es la
// adaptación con los datos de verdad (lib/servicio-diseno.ts arma lo que dibuja cada bloque, con test). La pregunta: «¿cada cliente
// va en fecha?».
//
// El movimiento sale del INFORME de Sunrow (docs/diseno/mockups-dashboard/demos/sunrow/INFORME.txt, la línea de tiempo de la página):
// la tarjeta de arriba sube desde 24 px (.9 s, power3.out); a los .05 s el saludo sube por palabra con un giro de 6° (115 % → 0,
// .85 s, power4.out, 22 ms); a los .15 s la fecha, el texto y las píldoras entran desde 10 px (.55 s, 60 ms); a los .2 s la tarjeta
// oscura entra desde 30 px a la derecha y .97 (.8 s); a los .25 s los seis números suben desde 22 px (.9 s, 60 ms); a los .4 s las
// tarjetas suben desde 30 px (.9 s, 70 ms); a los .7 s las barras crecen (1 s, 80 ms); a los .75 s las filas entran desde 10 px
// (.55 s, 25 ms); a los .8 s los días del mes crecen desde .4 (.6 s, back.out(3), 12 ms, de hoy hacia afuera). Los números cuentan
// 1,2 s (power3.out). Al pasar, un número sube 4 px (.45 s; baja en .5 s). ⚠️ Cómo entran la curva y el anillo no está en lo
// medido: la curva se dibuja de izquierda a derecha y el anillo crece desde cero, a los .7 s (anotado en el relevo).
//
// ⚠️ Mirando se dibuja esto; editando, la grilla con los mismos componentes (app/dashboard/EditorInforme.tsx).
// ⚠️ Lo que Sunrow tiene y MaKo no mide no está (lib/servicio-diseno.ts): el clima, el viento, la luz del día, el plan contra lo real,
//    el presupuesto comprometido, el pronóstico de la IA y su botón «Ask Sunrow AI» (en MaKo está la estrella de cada tab).
// =============================================================================

import { createContext, Fragment, useContext, useEffect, useId, useLayoutEffect, useRef, type CSSProperties, type KeyboardEvent, type ReactNode } from 'react';
import Link from '@/app/_ui/Link';
import type { Grafico, Hoja } from '@/lib/graficos-catalogo';
import { marcasDelEje } from '@/lib/curso-diseno';
import { plata } from '@/lib/cobranza-diseno';
import { entero } from '@/lib/marketing-diseno';
import { textoDeContacto, type AvanceServicio, type DiaServicio, type VistaServicio } from '@/lib/servicio-diseno';
import { CSS_SERVICIO } from './servicio-css';
import { Parte } from './parte';

const Compartido = createContext(false);

// Los íconos son trazos propios (los de la copia, maquetas/sunrow/copia.html).
const P = {
  cal: 'M7 5.5h10a3 3 0 0 1 3 3v8a3 3 0 0 1-3 3H7a3 3 0 0 1-3-3v-8a3 3 0 0 1 3-3zM4 10h16M8.5 3.5v4M15.5 3.5v4',
  spark: 'M12 4l1.8 4.6L18.5 10l-4.7 1.6L12 16l-1.8-4.4L5.5 10l4.7-1.4zM18 15.5l.7 1.8 1.8.7-1.8.7-.7 1.8-.7-1.8-1.8-.7 1.8-.7z',
  bolt: 'M13 3.5L6 13h5l-1 7.5L17 11h-5z',
  arrow: 'M5 12h13M13 7l5 5-5 5',
  out: 'M8 16L16 8M9.5 8H16v6.5',
  people: 'M9 6a3 3 0 1 0 0 6a3 3 0 1 0 0-6M4 18a5 5 0 0 1 10 0M15.5 6.5a3 3 0 0 1 0 5.5M17 18a5 5 0 0 0-2-4',
  check: 'M6.5 12.5l3.5 3.5 7.5-8',
  alert: 'M12 4.5l8.5 15h-17zM12 10v4M12 16.8v.01',
  list: 'M5 5v14h14M9 9h6M9 12.5h8M9 16h4',
  wallet: 'M7 6h10a3 3 0 0 1 3 3v6a3 3 0 0 1-3 3H7a3 3 0 0 1-3-3V9a3 3 0 0 1 3-3zM4 10h16M15.5 14h1.5',
  coin: 'M12 4.5a7.5 7.5 0 1 0 0 15a7.5 7.5 0 1 0 0-15M14.5 9.5c-.5-1-1.5-1.5-2.5-1.5-1.6 0-2.8.9-2.8 2.1 0 2.8 5.6 1.4 5.6 4 0 1.2-1.2 2.1-2.8 2.1-1.1 0-2.1-.6-2.6-1.5M12 6.5v11',
  trend: 'M4.5 16.5l5-5 3.5 3.5 6.5-6.5M15 8.5h4.5V13',
  down: 'M4.5 7.5l5 5 3.5-3.5 6.5 6.5M15 15.5h4.5V11',
  clock: 'M12 4.5a7.5 7.5 0 1 0 0 15a7.5 7.5 0 1 0 0-15M12 8v4.5l3 1.8',
  pin: 'M12 20s-6-5.5-6-10a6 6 0 0 1 12 0c0 4.5-6 10-6 10zM12 7.8a2.2 2.2 0 1 0 0 4.4a2.2 2.2 0 1 0 0-4.4',
  flag: 'M6.5 20V4.5M6.5 5h10l-2 3.5 2 3.5h-10',
  plus: 'M12 5v14M5 12h14',
  bell: 'M6.5 16.5V11a5.5 5.5 0 0 1 11 0v5.5l1.5 1.5h-14zM10 20.5a2 2 0 0 0 4 0',
  shield: 'M12 4l6.5 2.5V12c0 4-3 6.5-6.5 8-3.5-1.5-6.5-4-6.5-8V6.5zM9.5 12l2 2 3.5-4',
  doc: 'M7 4h7l4 4v12H7zM14 4v4h4M9.5 12h5M9.5 15.5h5',
  chat: 'M5 6.5h14v9H10l-4 3v-3H5z',
  flow: 'M6 6.5a1.8 1.8 0 1 0 0 .01M18 17.5a1.8 1.8 0 1 0 0 .01M7.8 6.5H13a3 3 0 0 1 3 3v6.2',
  grid: 'M4 4h6.5v6.5H4zM13.5 4H20v6.5h-6.5zM4 13.5h6.5V20H4zM13.5 13.5H20V20h-6.5z',
  sheet: 'M6 4.5h12v15H6zM9 8.5h6M9 12h6M9 15.5h4',
  layers: 'M12 4.5l8 4-8 4-8-4zM4 12.5l8 4 8-4M4 16.5l8 4 8-4',
} as const;
type IconoId = keyof typeof P;
function Icono({ id }: { id: IconoId }) {
  return <svg className="srw-i" viewBox="0 0 24 24" aria-hidden><path d={P[id]} /></svg>;
}

const P3 = 'cubic-bezier(.215, .61, .355, 1)', P4 = 'cubic-bezier(.165, .84, .44, 1)', P2IO = 'cubic-bezier(.455, .03, .515, .955)', BACK3 = 'cubic-bezier(.34, 2.2, .64, 1)';
const sinMovimiento = () => typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
const anim = (n: Element | null | undefined, kf: Keyframe[], o: KeyframeAnimationOptions) => { if (n && 'animate' in n) (n as HTMLElement).animate(kf, { fill: 'backwards', easing: P3, ...o }); };
const eP3 = (t: number) => 1 - Math.pow(1 - t, 3);

/** Cuenta el número de un texto desde cero («US$14,250», «62%», «148»), con sus decimales, su prefijo y su sufijo. */
function contar(n: HTMLElement, demora: number, dur: number) {
  const fin = n.textContent ?? '';
  const m = fin.match(/^(\D*?)(\d[\d,]*)(\.\d+)?(.*)$/);
  if (!m) return;
  const [, pre, cifra, dec = '', suf] = m, valor = Number(cifra.replace(/,/g, '') + dec), d = Math.max(0, dec.length - 1);
  const fmt = (v: number) => `${pre}${v.toLocaleString('en-US', { minimumFractionDigits: d, maximumFractionDigits: d })}${suf}`;
  const t0 = performance.now() + demora;
  n.textContent = fmt(0);
  const paso = (ahora: number) => {
    if (!n.isConnected) return;
    const t = Math.min(1, Math.max(0, (ahora - t0) / dur));
    n.textContent = t < 1 ? fmt(valor * eP3(t)) : fin;
    if (t < 1) requestAnimationFrame(paso);
  };
  requestAnimationFrame(paso);
}

/** Un link de la app, o el texto quieto si la hoja está compartida (un link compartido no tiene sesión). */
function Ir({ href, className, etiqueta, children }: { href: string | null; className?: string; etiqueta?: string; children: ReactNode }) {
  if (useContext(Compartido) || !href) return <span className={`${className ?? ''}${href ? ' srw-quieta' : ''}`} aria-label={etiqueta}>{children}</span>;
  return <Link href={href} className={className} aria-label={etiqueta}>{children}</Link>;
}
function Vacio({ titulo, texto }: { titulo: string; texto?: string }) {
  return <div className="srw-vacio"><b>{titulo}</b>{texto}</div>;
}
const accionDe = (fn: (() => void) | undefined) => (fn ? { role: 'button', tabIndex: 0, onClick: fn, onKeyDown: (e: KeyboardEvent) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); fn(); } } } : {});
const ancho = (p: number | null) => ({ width: `${Math.max(0, Math.min(100, p ?? 0)).toFixed(1)}%` }) as CSSProperties;
const plural = (n: number, uno: string, varios: string) => `${entero(n)} ${n === 1 ? uno : varios}`;

// ── el arco de lo que queda de tu agenda ─────────────────────────────────────────────────────────────────────────────
/** La curva del arco de Sunrow (viewBox 274 × 80): la misma que dibuja el tramo de puntos. */
const ARCO: Array<[number, number]> = [[2, 78], [40, -4], [234, -4], [272, 78]];
const bez = (t: number, q = ARCO): [number, number] => {
  const u = 1 - t;
  return [0, 1].map((k) => u * u * u * q[0][k] + 3 * u * u * t * q[1][k] + 3 * u * t * t * q[2][k] + t * t * t * q[3][k]) as [number, number];
};
/** El parámetro de la curva que corresponde a una FRACCIÓN de su largo (así el punto va parejo, no rápido en las puntas). */
function tDeFraccion(f: number): number {
  const N = 120, largos = [0];
  let prev = bez(0);
  for (let i = 1; i <= N; i++) { const p = bez(i / N); largos.push(largos[i - 1] + Math.hypot(p[0] - prev[0], p[1] - prev[1])); prev = p; }
  const meta = f * largos[N];
  for (let i = 1; i <= N; i++) if (largos[i] >= meta) return (i - 1 + (meta - largos[i - 1]) / Math.max(1e-9, largos[i] - largos[i - 1])) / N;
  return 1;
}
/** El tramo hecho del arco: la curva cortada en `t` (de Casteljau). */
function arcoHasta(t: number): string {
  const [a, b, c, d] = ARCO;
  const l = (p: number[], q: number[]) => [p[0] + (q[0] - p[0]) * t, p[1] + (q[1] - p[1]) * t];
  const ab = l(a, b), bc = l(b, c), cd = l(c, d), abc = l(ab, bc), bcd = l(bc, cd), fin = l(abc, bcd);
  return `M${a[0]} ${a[1]} C${ab[0].toFixed(1)} ${ab[1].toFixed(1)} ${abc[0].toFixed(1)} ${abc[1].toFixed(1)} ${fin[0].toFixed(1)} ${fin[1].toFixed(1)}`;
}
function Dia({ dia, problema }: { dia: DiaServicio | null; problema?: string }) {
  if (problema || !dia || dia.estado === 'vacio') {
    return (
      <div className="srw-day">
        <svg className="srw-day__arc" viewBox="0 0 274 80" preserveAspectRatio="none" aria-hidden><path className="srw-day__track" d="M2 78 C40 -4 234 -4 272 78" /></svg>
        <div className="srw-day__vacio"><span>Tu agenda de hoy</span><b>{problema ?? 'Nada con hora'}</b><span>{problema ? '' : 'en tu Calendario'}</span></div>
      </div>
    );
  }
  const t = tDeFraccion(dia.fraccion), [x, y] = bez(t);
  return (
    <div className="srw-day">
      <svg className="srw-day__arc" viewBox="0 0 274 80" preserveAspectRatio="none" aria-hidden>
        <path className="srw-day__track" d="M2 78 C40 -4 234 -4 272 78" />
        {dia.fraccion > 0 && <path className="srw-day__done" d={arcoHasta(t)} />}
      </svg>
      <i className="srw-day__sunp" style={{ left: `calc(4px + ${(x / 274).toFixed(4)} * (100% - 8px))`, top: `${(y + 2).toFixed(1)}px` }} />
      <span className="srw-day__a">{dia.desde}</span><span className="srw-day__b">{dia.hasta}</span>
      <div className="srw-day__mid">
        <span>{dia.queda ? 'Le queda a tu agenda' : 'Tu agenda de hoy'}</span>
        <b>{dia.queda ?? `${plural(dia.n, 'cosa', 'cosas')} hoy`}</b>
        <span>{dia.pie}</span>
      </div>
    </div>
  );
}

// ── el medidor de la tarjeta oscura ─────────────────────────────────────────────────────────────────────────────────
const TICKS = 'M29.8 82.2L27.7 84.3M24.0 74.5L21.4 76.0M20.3 65.6L17.4 66.4M19.0 56.0L16.0 56.0M20.3 46.4L17.4 45.6M24.0 37.5L21.4 36.0M29.8 29.8L27.7 27.7M37.5 24.0L36.0 21.4M46.4 20.3L45.6 17.4M56.0 19.0L56.0 16.0M65.6 20.3L66.4 17.4M74.5 24.0L76.0 21.4M82.2 29.8L84.3 27.7M88.0 37.5L90.6 36.0M91.7 46.4L94.6 45.6M93.0 56.0L96.0 56.0M91.7 65.6L94.6 66.4M88.0 74.5L90.6 76.0M82.2 82.2L84.3 84.3';
/** El arco del medidor hasta `pct` (0..100): un círculo de radio 46 con centro en 56,56 que va de 135° a 405°. */
function medidor(pct: number) {
  const a = ((135 + 270 * pct / 100) * Math.PI) / 180;
  const x = 56 + 46 * Math.cos(a), y = 56 + 46 * Math.sin(a);
  return {
    fill: `M23.5 88.5 A46 46 0 ${270 * pct / 100 > 180 ? 1 : 0} 1 ${x.toFixed(1)} ${y.toFixed(1)}`,
    aguja: `M${(56 - 7 * Math.cos(a)).toFixed(1)} ${(56 - 7 * Math.sin(a)).toFixed(1)} L${(56 + 33 * Math.cos(a)).toFixed(1)} ${(56 + 33 * Math.sin(a)).toFixed(1)}`,
  };
}

// ── la curva de los que avanzaron ───────────────────────────────────────────────────────────────────────────────────
function curva(pts: Array<[number, number]>) {
  if (pts.length === 1) return `M${pts[0][0]},${pts[0][1]}`;
  let d = `M${pts[0][0].toFixed(1)},${pts[0][1].toFixed(1)}`;
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[i - 1] ?? pts[i], p1 = pts[i], p2 = pts[i + 1], p3 = pts[i + 2] ?? p2;
    const c1 = [p1[0] + (p2[0] - p0[0]) / 6, p1[1] + (p2[1] - p0[1]) / 6], c2 = [p2[0] - (p3[0] - p1[0]) / 6, p2[1] - (p3[1] - p1[1]) / 6];
    d += ` C${c1[0].toFixed(1)},${c1[1].toFixed(1)} ${c2[0].toFixed(1)},${c2[1].toFixed(1)} ${p2[0].toFixed(1)},${p2[1].toFixed(1)}`;
  }
  return d;
}
const W = 888, H = 168;
const rotuloEje = (v: number) => (v >= 1000 ? `${Number((v / 1000).toFixed(1))}K` : `${Number(v.toFixed(1))}`);
function Curva({ avance, grad }: { avance: AvanceServicio; grad: string }) {
  const n = avance.puntos.length;
  const pts = avance.puntos.map((q, i): [number, number] => [n > 1 ? (i * W) / (n - 1) : W / 2, H - (q.suma / avance.tope) * H]);
  const d = curva(pts);
  // El eje de abajo: doce rótulos en la computadora y cuatro en el teléfono (como la copia), cada juego repartido parejo.
  const esc = new Set(marcasDelEje(n, 12)), tel = new Set(marcasDelEje(n, 4));
  const eje = [...new Set([...esc, ...tel])].sort((a, b) => a - b);
  return (
    <div className="srw-chart">
      <div className="srw-chart__y">{avance.marcas.map((m, i) => <span key={i}>{rotuloEje(m)}</span>)}</div>
      <svg className="srw-chart__svg" viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" aria-hidden>
        <defs><linearGradient id={grad} x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#1993aa" stopOpacity=".26" /><stop offset="1" stopColor="#1993aa" stopOpacity=".02" /></linearGradient></defs>
        <path className="srw-chart__grid" d={`M0 .5H${W}M0 42.5H${W}M0 84.5H${W}M0 126.5H${W}M0 167.5H${W}`} />
        {n > 1 && <path d={`${d} L${W} ${H} L0 ${H} Z`} fill={`url(#${grad})`} />}
        <path className="srw-chart__act" d={d} pathLength={1} />
      </svg>
      <span className="srw-chart__today srw-chart__today--fin" style={{ left: '100%' }}><i>Hoy</i></span>
      <div className="srw-chart__x">{eje.map((i) => (
        <span key={i} className={`${tel.has(i) ? '' : 'srw-x--fuera'}${esc.has(i) ? '' : ' srw-x--tel'}`.trim() || undefined}
          style={{ left: n > 1 ? `${(i / (n - 1)) * 100}%` : '50%' }}>{avance.puntos[i].rotulo}</span>
      ))}</div>
    </div>
  );
}

const ICONO_NUMERO: Record<VistaServicio['numeros'][number]['id'], IconoId> = { clientes: 'people', avanzaron: 'check', atencion: 'alert', sesiones: 'list', deuda: 'wallet', cobrado: 'coin' };
const TONO_FILA = ['jade', 'cobalt', 'sun', 'ember', 'slate'] as const;
const SALUD = { rojo: { tic: 'rose', pill: 'bad', rotulo: 'Urgente', i: 'alert' }, ambar: { tic: 'ember', pill: 'warn', rotulo: 'Atención', i: 'clock' }, verde: { tic: 'jade', pill: 'good', rotulo: 'Bien', i: 'shield' } } as const;
const CAPA: Record<string, { tic: string; i: IconoId }> = {
  publicaciones: { tic: 'sun', i: 'spark' }, llamadas: { tic: 'cobalt', i: 'people' }, entregas: { tic: 'jade', i: 'check' }, bloques: { tic: 'jade', i: 'clock' },
  plan: { tic: 'ember', i: 'flag' }, recurrentes: { tic: 'ember', i: 'list' }, cobros: { tic: 'jade', i: 'wallet' },
};
const ATAJOS: Array<{ href: string; texto: string; i: IconoId; ia?: true }> = [
  { href: '/clients', texto: 'Clients', i: 'people' }, { href: '/crm', texto: 'CRM', i: 'layers' }, { href: '/calendario', texto: 'Calendario', i: 'cal' },
  { href: '/plan', texto: 'Plan', i: 'flag' }, { href: '/chats', texto: 'Chats', i: 'chat' }, { href: '/automations', texto: 'Automations', i: 'flow' },
  { href: '/classroom', texto: 'Classroom', i: 'sheet' }, { href: '/second-brain', texto: 'Ops Center', i: 'spark', ia: true },
];
const SEMANA = ['Lu', 'Ma', 'Mi', 'Ju', 'Vi', 'Sá', 'Do'];

export function HojaServicio({ hoja, vista, titulo, fecha, hechas, onCompletar, onGrilla, onFila, compartido = false, quieta = false, pie }: {
  hoja: Hoja;
  vista: VistaServicio;
  /** El saludo («Buenos días, Ana»), o el nombre de la hoja. */
  titulo: string;
  /** «Miércoles 5 de noviembre»: la fecha del negocio. */
  fecha: string | null;
  /** Las tareas que se acaban de tildar (se tachan en el acto). */
  hechas?: ReadonlySet<string>;
  /** Tildar una tarea del Plan (la MISMA escritura que en los bloques de General). Sin esto, la casilla no se toca. */
  onCompletar?: (id: string) => void;
  onGrilla?: () => void;
  /** Abrir una fila de una pieza: su detalle de siempre, como al tocarla en la grilla. */
  onFila?: (g: Grafico, clave: string) => void;
  compartido?: boolean;
  /** La miniatura de «Nueva hoja». */
  quieta?: boolean;
  /** Lo que va al pie (el aviso de «Tarea completada»). */
  pie?: ReactNode;
}) {
  const { frase, chips, dia, cartera, numeros, avance, deben, quien, etapas, salud, vence, calendario, tareas, viene, problemas } = vista;
  const p = hoja.diseno?.piezas ?? {};
  const pieza = (id: string | undefined) => hoja.componentes.find((c): c is Grafico => c.id === id && c.clase === 'grafico');
  const abrir = (id: string | undefined, clave: string) => { const g = pieza(id); return g && onFila && !quieta ? () => onFila(g, clave) : undefined; };
  const raiz = useRef<HTMLDivElement>(null);
  const grad = `srw-g-${useId().replace(/:/g, '')}`;

  // ── La entrada (una vez, al montarse) ──────────────────────────────────────────────────────────────────────────────
  useLayoutEffect(() => {
    const el = raiz.current;
    if (!el || quieta || sinMovimiento()) return;
    const todos = (s: string) => Array.from(el.querySelectorAll(s));
    todos('.srw-hero').forEach((n) => anim(n, [{ opacity: 0, transform: 'translateY(24px) scale(.985)' }, { opacity: 1, transform: 'none' }], { duration: 900 }));
    todos('.srw-hero__title .srw-w__i').forEach((n, i) => anim(n, [{ transform: 'translateY(115%) rotate(6deg)' }, { transform: 'none' }], { duration: 850, delay: 50 + i * 22, easing: P4 }));
    todos('.srw-hero__eyebrow, .srw-hero__sub, .srw-hchip').forEach((n, i) => anim(n, [{ opacity: 0, transform: 'translateY(10px)' }, { opacity: 1, transform: 'none' }], { duration: 550, delay: 150 + i * 60 }));
    todos('.srw-ai-card').forEach((n) => anim(n, [{ opacity: 0, transform: 'translateX(30px) scale(.97)' }, { opacity: 1, transform: 'none' }], { duration: 800, delay: 200 }));
    const sube = (s: string, y: number, d0: number, paso: number) => todos(s).forEach((n, i) => anim(n, [{ opacity: 0, transform: `translateY(${y}px) scale(.985)` }, { opacity: 1, transform: 'none' }], { duration: 900, delay: d0 + i * paso }));
    sube('.srw-kpi', 22, 250, 60);
    sube('.srw-dash__main > .srw-card, .srw-dash__row3 > .srw-card, .srw-dash__aside > .srw-card', 30, 400, 70);
    todos('.srw-sites .srw-meter__fill').forEach((n, i) => anim(n, [{ transform: 'scaleX(0)' }, { transform: getComputedStyle(n).transform }], { duration: 1000, delay: 700 + i * 80 }));
    todos('.srw-bar2 > i').forEach((n, i) => anim(n, [{ transform: 'scaleX(0)' }, { transform: 'none' }], { duration: 1000, delay: 700 + i * 50 }));
    todos('.srw-chart__act').forEach((n) => { (n as SVGPathElement).style.strokeDasharray = '1 1'; anim(n, [{ strokeDashoffset: 1 }, { strokeDashoffset: 0 }], { duration: 1100, delay: 700, easing: P2IO }); });
    todos('.srw-donut__seg').forEach((n) => anim(n, [{ strokeDasharray: '0 100' }, { strokeDasharray: n.getAttribute('stroke-dasharray') ?? '0 100' }], { duration: 1000, delay: 700 }));
    todos('.srw-sites .srw-site, .srw-list .srw-list__row, .srw-todo, .srw-notes .srw-list__row, .srw-quick__a').forEach((n, i) => anim(n, [{ opacity: 0, transform: 'translateY(10px)' }, { opacity: 1, transform: 'none' }], { duration: 550, delay: 750 + i * 25 }));
    const dias = todos('.srw-cal__d:not(.srw-is-pad)'), i0 = Math.max(0, dias.findIndex((d) => d.classList.contains('srw-is-today')));
    dias.map((d, i) => ({ d, k: Math.abs(i - i0) })).sort((a, b) => a.k - b.k)
      .forEach((x, i) => anim(x.d, [{ opacity: 0, transform: 'scale(.4)' }, { opacity: 1, transform: 'none' }], { duration: 600, delay: 800 + i * 12, easing: BACK3 }));
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Los números cuentan desde cero la PRIMERA vez que llegan los datos ──────────────────────────────────────────────
  const firma = [...numeros.map((x) => x.valor), cartera.pct, deben?.pct, avance?.total, quien?.lista.map((c) => c.deuda).join(',')].join('|');
  useEffect(() => {
    const el = raiz.current;
    if (!el || quieta || sinMovimiento()) return;
    el.querySelectorAll<HTMLElement>('[data-cuenta]').forEach((n) => { if (n.dataset.animado != null) return; n.dataset.animado = ''; contar(n, 250, 1200); });
  }, [firma, quieta]);

  const anillo = deben?.anillo;
  const primero = cartera.primero;
  const pendientes = tareas ? tareas.filter((t) => !hechas?.has(t.id)).length : 0;

  return (
    <Compartido.Provider value={compartido}>
    <div className="srw" ref={raiz} data-quieta={quieta ? '' : undefined}>
      <style href="dash-hoja-servicio" precedence="medium">{CSS_SERVICIO}</style>
      <main className="srw-dash">
        <div className="srw-dash__main">
          {/* ARRIBA: el saludo con lo que tienes hoy (en lugar de las obras, el clima y el viento) y lo que queda de tu agenda (en lugar de
              la luz del día), y la tarjeta oscura con tu cartera (en lugar del pronóstico de la IA). */}
          <Parte id="cabecera">
          <section className="srw-hero">
            <div className="srw-hero__l">
              <div className="srw-hero__txt">
                {fecha && <p className="srw-hero__eyebrow"><Icono id="cal" />{fecha[0].toUpperCase() + fecha.slice(1)}</p>}
                <h1 className="srw-hero__title">{titulo.split(/\s+/).map((w, i) => <Fragment key={i}>{i > 0 && ' '}<span className="srw-w"><span className="srw-w__i">{w}</span></span></Fragment>)}</h1>
                {frase ? <p className="srw-hero__sub">{frase}</p> : problemas.numeros && <p className="srw-hero__sub">{problemas.numeros}</p>}
                <div className="srw-hchips">
                  {chips.reuniones != null && <span className="srw-hchip"><Icono id="people" /><b>{entero(chips.reuniones)}</b>{chips.reuniones === 1 ? 'reunión hoy' : 'reuniones hoy'}</span>}
                  {chips.sesiones != null && <span className="srw-hchip"><Icono id="list" /><b>{entero(chips.sesiones)}</b>{chips.sesiones === 1 ? 'sesión dada' : 'sesiones dadas'}</span>}
                  {chips.funnels != null && chips.funnels > 0 && <span className="srw-hchip srw-hchip--live"><i className="srw-live-dot" />Clientes en {plural(chips.funnels, 'funnel', 'funnels')}</span>}
                </div>
              </div>
              <Dia dia={dia} problema={problemas.calendario} />
            </div>
            <div className="srw-ai-card">
              <div className="srw-ai-card__h"><span className="srw-ai-card__ico"><Icono id="spark" /></span><b>Tu cartera hoy</b></div>
              {cartera.pct == null ? <Vacio titulo={problemas.numeros ?? 'Todavía no hay clientes en tu cartera'} /> : (
                <div className="srw-ai-card__mid">
                  <div className="srw-gauge">
                    <svg viewBox="0 0 112 100" aria-hidden>
                      <path className="srw-gauge__track" d="M23.5 88.5 A46 46 0 1 1 88.5 88.5" />
                      {cartera.pct > 0 && <path className="srw-gauge__fill" d={medidor(cartera.pct).fill} />}
                      <path className="srw-gauge__ticks" d={TICKS} />
                      <path className="srw-gauge__needle" d={medidor(cartera.pct).aguja} />
                    </svg>
                    <b className="srw-gauge__n" data-cuenta>{entero(cartera.pct)}</b><span className="srw-gauge__l">de cada 100</span>
                  </div>
                  <div className="srw-ai-card__t"><b>Clientes sin alertas</b><p>{entero(cartera.bien ?? 0)} de {plural(cartera.clientes ?? 0, 'cliente', 'clientes')} no {cartera.bien === 1 ? 'pide' : 'piden'} atención.</p></div>
                </div>
              )}
              <Ir href="/clients" className="srw-ai-card__tip">
                <Icono id="bolt" />
                <span><b>{primero ? 'Primero te necesita' : 'Quién te necesita'}</b>{primero ? `${primero.nombre}${textoDeContacto(primero.contacto) ? ` · ${textoDeContacto(primero.contacto)!.toLowerCase()}` : ''}` : problemas.quien ?? 'Ningún cliente pide atención hoy.'}</span>
              </Ir>
              <Ir href="/clients" className="srw-btn srw-btn--primary srw-btn--sm">Ver tus clientes<Icono id="arrow" /></Ir>
            </div>
          </section>
          </Parte>

          {/* LOS SEIS NÚMEROS (en lugar de los proyectos, las obras, las aprobaciones y la asistencia). */}
          <Parte id="numeros">
          <div className="srw-kpis">
            {numeros.map((x) => (
              <div key={x.id} className={`srw-kpi${x.tile ? ` srw-tile--${x.tile}` : ''}`} data-lift>
                <div className="srw-kpi__h"><span className="srw-kpi__ico"><Icono id={ICONO_NUMERO[x.id]} /></span><span className="srw-kpi__l">{x.titulo}</span></div>
                <b className="srw-kpi__n" data-cuenta={x.valor ? '' : undefined}>{x.valor ?? '—'}</b>
                {x.valor == null ? problemas.numeros && <span className="srw-kpi__d srw-kpi__d--flat">No pude leerlo</span> : x.pie && (
                  <span className={`srw-kpi__d${x.pie.tono === 'info' || x.pie.tono === 'igual' ? ' srw-kpi__d--flat' : x.pie.tono === 'baja' ? ' srw-kpi__d--malo' : ''}`}>
                    {x.pie.tono === 'sube' && <Icono id="trend" />}{x.pie.tono === 'baja' && <Icono id="down" />}{x.pie.texto}
                  </span>
                )}
              </div>
            ))}
          </div>
          </Parte>

          {/* AVANZARON DE ETAPA («Timeline progress»): los que llegaron a una etapa cada semana, sumados. Sin plan ni pronóstico. */}
          <Parte id="etapas-semana">
          <section className="srw-card srw-dash-time">
            <div className="srw-card__h"><span className="srw-card__ico"><Icono id="trend" /></span><h2 className="srw-card__t">Avanzaron de etapa</h2>
              <div className="srw-card__tools"><span className="srw-select srw-select--quieto"><span>Últimos 90 días</span></span>
                <Ir href="/clients" className="srw-ibtn srw-ibtn--sm srw-card__expand" etiqueta="Abrir Clients"><Icono id="out" /></Ir></div></div>
            <p className="srw-legend"><span><i className="srw-lg srw-lg--ink" />Clientes que llegaron a una etapa, sumados semana a semana</span></p>
            {problemas.avance ? <Vacio titulo={problemas.avance} /> : !avance || !avance.total ? <Vacio titulo="Nadie avanzó de etapa en los últimos 90 días" /> : (
              <>
                <Curva avance={avance} grad={grad} />
                <div className="srw-read">
                  <div><span>Esta semana</span><b data-cuenta>{entero(avance.ultima)}</b></div>
                  <div><span>En 90 días</span><b data-cuenta>{entero(avance.total)}</b></div>
                  <div><span>Por semana</span><b>{avance.promedio.toLocaleString('es-MX', { maximumFractionDigits: 1 })}</b></div>
                </div>
              </>
            )}
          </section>
          </Parte>

          <div className="srw-dash__row3">
            {/* LO QUE TE DEBEN («Budget utilization»): lo que falta cobrar por días de atraso, y los que más deben. */}
            <Parte id="deben">
            <section className="srw-card srw-dash-budget">
              <div className="srw-card__h"><span className="srw-card__ico"><Icono id="wallet" /></span><h2 className="srw-card__t">Lo que te deben</h2></div>
              {problemas.deben ? <Vacio titulo={problemas.deben} /> : !deben || !deben.total ? <Vacio titulo="No te deben nada" texto="Todas las cuotas están cobradas." /> : (
                <>
                  <div className="srw-bud">
                    <div className="srw-donut">
                      <svg viewBox="0 0 120 120" aria-hidden>
                        <circle className="srw-donut__bg" cx="60" cy="60" r="50" />
                        {anillo && anillo.a > 0 && <circle className="srw-donut__seg srw-donut__seg--sun" cx="60" cy="60" r="50" pathLength={100} strokeDasharray={`${anillo.a.toFixed(1)} ${(100 - anillo.a).toFixed(1)}`} strokeDashoffset="0" />}
                        {anillo && anillo.b > 0 && <circle className="srw-donut__seg srw-donut__seg--cobalt" cx="60" cy="60" r="50" pathLength={100} strokeDasharray={`${anillo.b.toFixed(1)} ${(100 - anillo.b).toFixed(1)}`} strokeDashoffset={`${-(anillo.a + (anillo.a > 0 ? 1 : 0)).toFixed(1)}`} />}
                      </svg>
                      <span className="srw-donut__c"><b data-cuenta>{`${entero(deben.pct ?? 0)}%`}</b>vencido</span>
                    </div>
                    <ul className="srw-bud__leg">{deben.renglones.map((r) => <li key={r.id}><i className={`srw-sq srw-sq--${r.color}`} />{r.nombre}<b>{plata(r.monto)}</b></li>)}</ul>
                  </div>
                  <p className="srw-bud__trend"><em className={`srw-pill ${deben.vencidas ? 'srw-pill--bad' : 'srw-pill--good'}`}>{deben.vencidas ? plural(deben.vencidas, 'cuota vencida', 'cuotas vencidas') : 'Nada vencido'}</em>de {plural(deben.cuotas, 'cuota', 'cuotas')} por cobrar</p>
                  {deben.quienes && deben.quienes.lista.length > 0 && (
                    <div className="srw-bud__top">
                      <p className="srw-eyebrow">Los que más te deben</p>
                      <ul className="srw-bars2">
                        {deben.quienes.lista.map((x) => (
                          <li key={x.clave} {...accionDe(abrir(p.deudores, x.clave))}>
                            <span>{x.nombre}</span><em>{plata(x.monto)} de {plata(deben.total)}</em>
                            <i className="srw-bar2"><i className="srw-bar2__a" style={ancho(x.parte)} /></i>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </>
              )}
              <Ir href="/crm" className="srw-card__more srw-card__more--block">Ver las cuotas en el CRM<Icono id="arrow" /></Ir>
            </section>
            </Parte>

            {/* QUIÉN TE NECESITA («Site-wise performance»): cada cliente con su señal, hace cuánto no hablan y lo que debe. */}
            <Parte id="necesita">
            <section className="srw-card srw-dash-sites">
              <div className="srw-card__h"><span className="srw-card__ico"><Icono id="pin" /></span><h2 className="srw-card__t">Quién te necesita</h2><Ir href="/clients" className="srw-card__more">Ver todos<Icono id="arrow" /></Ir></div>
              {problemas.quien ? <Vacio titulo={problemas.quien} /> : !quien || !quien.lista.length ? <Vacio titulo="Todavía no hay clientes en tu cartera" /> : (
                <ul className="srw-sites">
                  {quien.lista.map((c) => (
                    <li key={c.clave}>
                      <div className="srw-list__row srw-site" {...accionDe(abrir(p.quien, c.clave))}>
                        <span className={`srw-tic srw-tic--${c.tono === 'bad' ? 'rose' : c.tono === 'good' ? 'jade' : 'slate'}`}><Icono id={c.tono === 'bad' ? 'alert' : c.tono === 'good' ? 'check' : 'people'} /></span>
                        <span className="srw-site__m">
                          <b>{c.nombre}</b>
                          <span>{[textoDeContacto(c.contacto), c.sesiones != null ? plural(c.sesiones, 'sesión', 'sesiones') : null].filter(Boolean).join(' · ') || 'Sin datos de contacto'}</span>
                          <i className="srw-meter"><i className={`srw-meter__fill srw-meter__fill--${c.tono === 'bad' ? 'bad' : 'good'}`} style={{ '--v': (c.barra / 100).toFixed(3) } as CSSProperties} /></i>
                        </span>
                        <span className="srw-site__r">
                          {c.deuda ? <strong data-cuenta>{plata(c.deuda)}</strong> : <strong className="srw-al-dia">Al día</strong>}
                          <em className={`srw-pill srw-pill--${c.tono === 'neutral' ? 'neutral' : c.tono}`}>{c.senal ?? 'Sin datos'}</em>
                        </span>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </section>
            </Parte>
          </div>

          {/* LOS ATAJOS («Quick links»): las pantallas de MaKo donde se trabaja esto. */}
          <Parte id="atajos">
          <section className="srw-card srw-quick">
            <b className="srw-quick__t">Atajos</b>
            <div className="srw-quick__l">
              {onGrilla && <button type="button" className="srw-quick__a" onClick={onGrilla}><span className="srw-quick__i"><Icono id="grid" /></span>Ver la grilla</button>}
              {ATAJOS.map((a) => <Ir key={a.href} href={a.href} className="srw-quick__a"><span className={`srw-quick__i${a.ia ? ' srw-quick__i--ai' : ''}`}><Icono id={a.i} /></span>{a.texto}</Ir>)}
            </div>
          </section>
          </Parte>

          <div className="srw-dash__row3 srw-dash__row3--lists">
            {/* CLIENTES POR ETAPA («Recent project updates»): cuántos hay en cada etapa de la entrega, y qué parte son. */}
            <Parte id="por-etapa">
            <section className="srw-card">
              <div className="srw-card__h"><span className="srw-card__ico"><Icono id="layers" /></span><h2 className="srw-card__t">Clientes por etapa</h2><Ir href="/clients" className="srw-card__more">Ver el tablero<Icono id="arrow" /></Ir></div>
              {problemas.etapas ? <Vacio titulo={problemas.etapas} /> : !etapas || !etapas.lista.length ? <Vacio titulo="Todavía no hay clientes en la entrega" /> : (
                <ul className="srw-list">
                  {etapas.lista.map((e, i) => (
                    <li key={e.clave}>
                      <div className="srw-list__row" {...accionDe(abrir(p.etapas, e.clave))}>
                        <span className={`srw-tic srw-tic--${TONO_FILA[i % TONO_FILA.length]}`}><Icono id="layers" /></span>
                        <span className="srw-list__m"><b>{e.nombre}</b><span>{plural(e.n, 'cliente', 'clientes')}</span></span>
                        <span className="srw-list__r">{e.parte == null ? '' : `${Math.round(e.parte)}%`}</span>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </section>
            </Parte>
            {/* SALUD DEL NEGOCIO («Critical issue alerts»): las alertas del Semáforo de General. */}
            <Parte id="salud">
            <section className="srw-card srw-dash-alerts">
              <div className="srw-card__h"><span className="srw-card__ico"><Icono id="alert" /></span><h2 className="srw-card__t">Salud del negocio</h2></div>
              {problemas.salud ? <Vacio titulo={problemas.salud} /> : !salud || !salud.length ? <Vacio titulo="Todo en orden" texto="No hay alertas." /> : (
                <ul className="srw-list">
                  {salud.map((a, i) => (
                    <li key={i} className="srw-list__row">
                      <span className={`srw-tic srw-tic--${SALUD[a.nivel].tic}`}><Icono id={SALUD[a.nivel].i} /></span>
                      <Ir href={a.href} className="srw-grow"><b>{a.titulo}</b><span>{a.link}</span></Ir>
                      <em className={`srw-pill srw-pill--${SALUD[a.nivel].pill}`}>{SALUD[a.nivel].rotulo}</em>
                      <Ir href={a.href} className="srw-ibtn srw-ibtn--sm srw-ibtn--plain" etiqueta={a.link}><Icono id="out" /></Ir>
                    </li>
                  ))}
                </ul>
              )}
            </section>
            </Parte>
            {/* LO QUE VENCE («Upcoming deadlines»): las tareas del Plan con fecha, lo vencido primero. */}
            <Parte id="vence">
            <section className="srw-card srw-dash-dead">
              <div className="srw-card__h"><span className="srw-card__ico"><Icono id="flag" /></span><h2 className="srw-card__t">Lo que vence</h2><Ir href="/plan" className="srw-card__more">Ver el Plan<Icono id="arrow" /></Ir></div>
              {problemas.plan ? <Vacio titulo={problemas.plan} /> : !vence || !vence.lista.length ? <Vacio titulo="Nada vence en los próximos 30 días" /> : (
                <ul className="srw-list">
                  {vence.lista.map((t) => (
                    <li key={t.id}>
                      <Ir href={t.href} className="srw-list__row">
                        <span className="srw-date"><small>{t.mes}</small><b>{t.dia}</b></span>
                        <span className="srw-list__m"><b>{t.titulo}</b><span>{t.detalle}</span></span>
                        <span className={`srw-list__r${t.vencida ? ' srw-list__r--malo' : ''}`}>{t.cuando}</span>
                      </Ir>
                    </li>
                  ))}
                </ul>
              )}
            </section>
            </Parte>
          </div>
        </div>

        <aside className="srw-dash__aside" aria-label="Tu día">
          {/* EL CALENDARIO: el mes con lo agendado y lo de hoy. */}
          <Parte id="calendario">
          <section className="srw-card srw-cal">
            <div className="srw-card__h"><span className="srw-card__ico"><Icono id="cal" /></span><h2 className="srw-card__t">Calendario</h2></div>
            {problemas.calendario || !calendario ? <Vacio titulo={problemas.calendario ?? 'No pude leer tu Calendario.'} /> : (
              <>
                <div className="srw-cal__m"><b>{calendario.titulo}</b><span><Ir href="/calendario" className="srw-ibtn srw-ibtn--sm" etiqueta="Abrir el Calendario"><Icono id="out" /></Ir></span></div>
                <div className="srw-cal__grid">
                  {SEMANA.map((d) => <span key={d} className="srw-cal__w">{d}</span>)}
                  {calendario.semanas.flat().map((d, i) => d == null ? <i key={`p${i}`} className="srw-cal__d srw-is-pad" /> : (
                    <span key={d.dia} className={`srw-cal__d${d.paso ? ' srw-is-past' : ''}${d.hoy ? ' srw-is-today' : ''}`}>
                      {Number(d.dia.slice(8, 10))}
                      {d.colores.length > 0 && <i className="srw-dots">{d.colores.map((c, k) => <i key={k} style={d.hoy ? undefined : { background: c }} />)}</i>}
                    </span>
                  ))}
                </div>
                <div className="srw-cal__day">
                  <p><b>Hoy</b><span>{calendario.totalHoy ? plural(calendario.totalHoy, 'evento', 'eventos') : 'Nada agendado'}</span></p>
                  {calendario.hoy.map((x) => <Ir key={x.id} href={x.href} className="srw-cal__ev"><i style={{ background: x.color }} /><b>{x.hora}</b><span>{x.titulo}</span></Ir>)}
                </div>
              </>
            )}
          </section>
          </Parte>

          {/* PRIORIDADES («My tasks»): las de la vista Prioridades del Plan, para tildar. */}
          <Parte id="prioridades">
          <section className="srw-card">
            <div className="srw-card__h"><span className="srw-card__ico"><Icono id="check" /></span><h2 className="srw-card__t">Prioridades</h2>
              <Ir href="/plan" className="srw-ibtn srw-ibtn--sm" etiqueta="Agregar una tarea en el Plan"><Icono id="plus" /></Ir>
              <Ir href="/plan" className="srw-card__more">Ver todas<Icono id="arrow" /></Ir></div>
            {problemas.plan ? <Vacio titulo={problemas.plan} /> : !tareas || !tareas.length ? <Vacio titulo="No hay prioridades en tu Plan" /> : (
              <ul className="srw-todos" aria-label={plural(pendientes, 'abierta', 'abiertas')}>
                {tareas.map((t) => {
                  const hecha = !!hechas?.has(t.id);
                  return (
                    <li key={t.id} className={`srw-todo${hecha ? ' srw-is-done' : ''}`}>
                      <button type="button" className="srw-check" role="checkbox" aria-checked={hecha} aria-label={`Marcar «${t.titulo}» como hecha`}
                        disabled={hecha || !onCompletar || compartido || quieta} onClick={() => onCompletar?.(t.id)}>{hecha && <Icono id="check" />}</button>
                      <span className="srw-todo__t"><b>{t.titulo}</b><span>{t.detalle}</span></span>
                      <em className={`srw-pill srw-pill--${t.tono}`}>{t.prioridad}</em>
                    </li>
                  );
                })}
              </ul>
            )}
          </section>
          </Parte>

          {/* LO QUE VIENE («Notifications»): lo de los próximos días en el Calendario. */}
          <Parte id="viene">
          <section className="srw-card">
            <div className="srw-card__h"><span className="srw-card__ico"><Icono id="bell" /></span><h2 className="srw-card__t">Lo que viene</h2><Ir href="/calendario" className="srw-card__more">Ver todo<Icono id="arrow" /></Ir></div>
            {problemas.calendario ? <Vacio titulo={problemas.calendario} /> : !viene || !viene.lista.length ? <Vacio titulo="Nada agendado en los próximos días" /> : (
              <ul className="srw-notes">
                {viene.lista.map((x) => (
                  <li key={x.id}>
                    <Ir href={x.href} className="srw-list__row">
                      <span className={`srw-tic srw-tic--${CAPA[x.capa]?.tic ?? 'slate'} srw-tic--sm`}><Icono id={CAPA[x.capa]?.i ?? 'cal'} /></span>
                      <span className="srw-note__m"><b>{x.titulo}</b><span>{[x.cuando, x.detalle].filter(Boolean).join(' · ')}</span></span>
                    </Ir>
                  </li>
                ))}
              </ul>
            )}
          </section>
          </Parte>
        </aside>
      </main>
      {pie}
    </div>
    </Compartido.Provider>
  );
}
