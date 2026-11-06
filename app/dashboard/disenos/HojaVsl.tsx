'use client';

// =============================================================================
// HojaVsl — la hoja «VSL y YouTube» con su DISEÑO PROPIO: la copia de Pelago, con los datos reales de MaKo
// =============================================================================
// Martín, 4/11/2026: «que sea primero la copia, es decir, que se vea exactamente igual que la copia, y después la adaptación con
// Maco... copiarlo todo, desde las animaciones de entrada, las animaciones de hover, las animaciones de clic». La copia (maqueta) y sus
// capturas están en docs/diseno/mockups-dashboard/vsl-pelago/; ésta es la adaptación con los datos de verdad (lib/vsl-diseno.ts arma lo
// que dibuja cada tarjeta, con test). La pregunta: «¿quién llega al final, y ésos compran más?».
//
// El movimiento sale de lo MEDIDO de Pelago (docs/diseno/mockups-dashboard/demos/pelago/INFORME.txt y los estados): la pastilla del riel
// corre .35 s con la curva de la página (.2, .8, .2, 1); el rayo marcado late (dial-pulse: un aro que se abre de 3 px a .5 px); al pasar
// por una columna del gráfico, su relleno de puntos se vuelve sólido (.2 s); las filas de la tabla se pintan al pasar (.15 s); un link de
// la actividad se subraya. ⚠️ SUPUESTO (el INFORME corta la receta de la página «Overview»): la cabecera sube desde 12 px (.65 s); las
// tarjetas suben desde 16 px (.7 s, desde .25 s, cada .06 s); las barras crecen desde abajo (.9 s, cada .02 s); los rayos se dibujan
// desde adentro (.8 s, cada .025 s); las columnas suben (.9 s, cada .04 s); las barras finas crecen desde la izquierda (.9 s); los números
// cuentan (.9 s). Lo mismo que la copia (vsl-pelago/pelago.js).
//
// ⚠️ Mirando se dibuja esto; editando, la grilla con los mismos componentes (app/dashboard/EditorInforme.tsx).
// ⚠️ Lo que Pelago tiene y MaKo no mide no está (lib/vsl-diseno.ts): el rango de días y el mes, el año pasado y el ritmo del mes, el
//    cambio del número grande contra antes, las fotos de producto y la actividad de un equipo. La barra de la izquierda y la de arriba son
//    el armazón de Pelago: en MaKo las pone la app. El logo de Pelago tampoco: es su dibujo.
// =============================================================================

import { createContext, useContext, useEffect, useLayoutEffect, useRef, useState, type KeyboardEvent, type ReactNode } from 'react';
import Link from '@/app/_ui/Link';
import type { Grafico, Hoja } from '@/lib/graficos-catalogo';
import { conNombres } from '@/lib/graficos-analisis';
import type { VistaCaja } from '@/lib/graficos-ia-elemento';
import { topeDe } from '@/lib/curso-diseno';
import { entero, enElPeriodo } from '@/lib/marketing-diseno';
import { contraTodos, enteros, haceCuanto, largoRayo, pct, pilaDe, type TramoVsl, type VistaVsl } from '@/lib/vsl-diseno';
import { leerCaja } from '../ElementoIA';
import { CSS_VSL } from './vsl-css';

const Compartido = createContext(false);

// Los íconos son trazos propios (los de la copia, vsl-pelago/copia.html).
const P = {
  cal: 'M2.5 3.5h11v10h-11zM2.5 6.5h11M5.5 2v3M10.5 2v3',
  grilla: 'M2 2h5v5H2zM9 2h5v5H9zM2 9h5v5H2zM9 9h5v5H9z',
  pagina: 'M2.5 3h11v10h-11zM2.5 6h11M5 4.5h.1M7 4.5h.1',
  reloj: 'M8 2.4a5.6 5.6 0 1 0 0 11.2A5.6 5.6 0 0 0 8 2.4zM8 5v3.2l2 1.3',
  play: 'M5 3.5v9l7-4.5z',
  barras: 'M3 13.5V8M6.3 13.5V4.5M9.6 13.5V7M12.9 13.5V2.5',
  dia: 'M2.5 5l5.5-2.5L13.5 5v6L8 13.5 2.5 11zM2.5 5L8 7.5l5.5-2.5M8 7.5v6',
  fuga: 'M8 2.5v8M4.5 7L8 10.5 11.5 7M3 13.5h10',
  cien: 'M8 2.5a5.5 5.5 0 1 0 5.5 5.5H8zM10 1.8v4.2h4.2A4.2 4.2 0 0 0 10 1.8z',
  chispa: 'M8 2.5l1.4 3.7 3.7 1.4-3.7 1.4L8 12.7 6.6 9 2.9 7.6l3.7-1.4zM12.5 2v2.5M13.8 3.2h-2.6',
  todos: 'M8 2.5l5.5 3L8 8.5l-5.5-3zM2.5 8L8 11l5.5-3M2.5 10.5L8 13.5l5.5-3',
  ojo: 'M1.8 8s2.3-4.3 6.2-4.3S14.2 8 14.2 8 11.9 12.3 8 12.3 1.8 8 1.8 8zM8 6.2a1.8 1.8 0 1 0 0 3.6 1.8 1.8 0 0 0 0-3.6z',
  nada: 'M2.5 2.5l11 11M6.2 4C6.8 3.8 7.4 3.7 8 3.7c3.9 0 6.2 4.3 6.2 4.3a11 11 0 0 1-1.9 2.4M10.4 11.8c-.7.3-1.5.5-2.4.5-3.9 0-6.2-4.3-6.2-4.3a11 11 0 0 1 2.4-2.8',
  sube: 'M8 13V3M4 7l4-4 4 4',
  baja: 'M8 3v10M4 9l4 4 4-4',
  flecha: 'M6.5 4l4 4-4 4',
} as const;
type IconoId = keyof typeof P;
function Icono({ id, chico }: { id: IconoId; chico?: boolean }) {
  return <svg className="pel-i" viewBox="0 0 16 16" aria-hidden style={chico ? { width: 14, height: 14 } : undefined}><path d={P[id]} /></svg>;
}

const P3 = 'cubic-bezier(.215, .61, .355, 1)', P3IO = 'cubic-bezier(.645, .045, .355, 1)';
const sinMovimiento = () => typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
const anim = (n: Element | null | undefined, kf: Keyframe[], o: KeyframeAnimationOptions) => { if (n && 'animate' in n) (n as HTMLElement).animate(kf, { fill: 'backwards', easing: P3, ...o }); };
const eP3 = (t: number) => 1 - Math.pow(1 - t, 3);

/** Cuenta el número de un texto desde cero («1,234», «22%», «US$0.12»), con sus decimales, su prefijo y su sufijo (.9 s, power3.out). */
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

/** El tamaño de una caja (el gráfico se dibuja a su tamaño real, como en Pelago: un viewBox fijo deforma el texto). */
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

/** Lo que escribió MaKo: la caja de IA de la hoja, leída con su GET de siempre (nunca genera al abrir). */
function useCaja(hojaId: string, elementoId: string | undefined): { vista: VistaCaja | null; cargando: boolean } {
  const [vista, setVista] = useState<VistaCaja | null>(null);
  const [cargando, setCargando] = useState(!!elementoId);
  useEffect(() => {
    if (!elementoId) { setCargando(false); return; }
    let vivo = true;
    leerCaja({ hojaId, elementoId, popupDe: null, ref: null })
      .then((v) => { if (vivo) setVista(v); })
      .catch(() => { if (vivo) setVista(null); })
      .finally(() => { if (vivo) setCargando(false); });
    return () => { vivo = false; };
  }, [hojaId, elementoId]);
  return { vista, cargando };
}

/** Un link de la app, o el texto quieto si la hoja está compartida (un link compartido no tiene sesión). */
function Ir({ href, className, children }: { href: string; className?: string; children: ReactNode }) {
  if (useContext(Compartido)) return <span className={`${className ?? ''} pel-quieta`}>{children}</span>;
  return <Link href={href} className={className}>{children}</Link>;
}
function Vacio({ children }: { children: ReactNode }) {
  return <p className="pel-vacio">{children}</p>;
}
const accionDe = (fn: (() => void) | undefined) => (fn ? { role: 'button', tabIndex: 0, onClick: fn, onKeyDown: (e: KeyboardEvent) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); fn(); } } } : {});
const plural = (n: number, una: string, varias: string) => `${entero(n)} ${n === 1 ? una : varias}`;
const DIAS = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
const fechaLarga = (hoy: string) => { const d = new Date(`${hoy}T12:00:00Z`); return `${DIAS[d.getUTCDay()]} ${d.getUTCDate()} de ${MESES[d.getUTCMonth()]}`; };
const diaDelMes = (clave: string) => String(Number(clave.slice(8, 10)));
// Las miniaturas vidriadas de Pelago (sus fotos de producto no se copian: van degradados propios), en orden.
const VIDRIOS = ['tide', 'celadon', 'tenmoku', 'stone', 'oat', 'tide'] as const;
const TONO_AV = ['rose', 'ochre', 'sea'] as const;
// Cada tramo con su ícono y su tinta del riel (los colores de las categorías de Pelago).
const RIEL: Readonly<Record<string, { ic: IconoId; tono: string; fondo: string }>> = {
  todos: { ic: 'todos', tono: '#136469', fondo: '#efede8' },
  '75-100%': { ic: 'play', tono: '#136469', fondo: '#d9e9ea' },
  '50-75%': { ic: 'ojo', tono: '#5a8a2c', fondo: '#e6eedd' },
  '25-50%': { ic: 'ojo', tono: '#c88e1c', fondo: '#f7ebd3' },
  '0-25%': { ic: 'ojo', tono: '#9a7b4f', fondo: '#efe6dc' },
  'Sin medir': { ic: 'play', tono: '#b85a36', fondo: '#f4e3dc' },
  'No lo vio': { ic: 'nada', tono: '#c4425a', fondo: '#f6e0e4' },
};
const COLOR = { clay: '#b85a36', ochre: '#c88e1c', petrol: '#136469' } as const;
type Tono = keyof typeof COLOR;

// ── «Today, by the hour» → dónde se van (un reloj: arriba el inicio y el final, a la derecha el 25%, abajo la mitad) ───────────────
function Reloj({ v, onRayo }: { v: VistaVsl; onRayo: (i: number | null) => void }) {
  const W = 280, H = 250, cx = W / 2, cy = 130, r0 = 64, rLab = 117;
  const p = (a: number, r: number): [number, number] => [cx + r * Math.sin((a * Math.PI) / 180), cy - r * Math.cos((a * Math.PI) / 180)];
  const cortes = v.curva?.cortes ?? [];
  return (
    <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Cuántos siguen viendo en cada parte del video">
      <circle className="pel-dial__ring" cx={cx} cy={cy} r="58" />
      {cortes.map((c, i) => {
        const a = c.corte * 3.6;
        if (c.siguen == null) { const [x, y] = p(a, 67); return <circle key={c.corte} className="pel-dial__dot" cx={x.toFixed(1)} cy={y.toFixed(1)} r="2" />; }
        const [x1, y1] = p(a, r0), [x2, y2] = p(a, r0 + largoRayo(c.siguen));
        return (
          <line key={c.corte} className={`pel-dial__sp${i === v.curva!.fuga ? ' pel-is-now' : ''}`} x1={x1.toFixed(1)} y1={y1.toFixed(1)} x2={x2.toFixed(1)} y2={y2.toFixed(1)}
            onPointerEnter={() => onRayo(i)} onPointerLeave={() => onRayo(null)} />
        );
      })}
      {v.curva && v.curva.fuga >= 0 && cortes[v.curva.fuga]?.siguen != null && (() => {
        const c = cortes[v.curva!.fuga], [x, y] = p(c.corte * 3.6, r0 + largoRayo(c.siguen!));
        return <circle className="pel-dial__pulse" cx={x.toFixed(1)} cy={y.toFixed(1)} r="7" />;
      })()}
      {([['Inicio', 0], ['25%', 90], ['La mitad', 180], ['75%', 270]] as const).map(([t, a]) => { const [x, y] = p(a, rLab); return <text key={t} className="pel-dial__lab" x={x.toFixed(1)} y={(y + 4).toFixed(1)} textAnchor="middle">{t}</text>; })}
    </svg>
  );
}

// ── «Demand by category» → ¿los que más ven, más agendan? ────────────────────────────────────────────────────────────────────────
// En la computadora el gráfico entra entero; en el teléfono, como en la copia, cada columna ocupa un ancho fijo (64 px: los rótulos de
// los tramos son más largos que los meses de Pelago), el gráfico se corre de costado y arranca mostrando el final, con el eje quieto encima.
const PASO_TEL = 64;
function Columnas({ tramos, elegido, onElegir }: { tramos: TramoVsl[]; elegido: string | null; onElegir: (k: string) => void }) {
  const [ref, { w, h }] = useTam<HTMLDivElement>();
  const sc = useRef<HTMLDivElement>(null);
  const listo = w > 120 && h > 120;
  const tel = w < 420;
  const yT = tel ? 45 : 34, yB = tel ? Math.max(yT + 80, h - 39) : Math.max(yT + 80, h - 25);
  const tope = topeDe(Math.max(1, ...tramos.map((t) => t.leads)) * 1.15);
  const n = Math.max(1, tramos.length), corre = tel && (w - 52) / n < PASO_TEL;
  const paso = corre ? PASO_TEL : (w - 52) / n, W = corre ? 52 + n * paso : w;
  const k = (yB - yT) / tope, x0 = 52 + paso / 2, ancho = Math.min(34, paso * 0.61);
  const sel = tramos.findIndex((t) => t.clave === elegido);
  const marca = (v: number) => (v >= 10 ? entero(v) : String(Math.round(v * 10) / 10));
  // Arranca mostrando el final (el tramo de los que lo vieron casi entero). Se repite en el cuadro siguiente: la hoja de estilos de la
  // hoja entra con la primera pintada y, antes, el contenedor todavía no se corre (medido: scrollLeft 0 con 442 de ancho).
  useLayoutEffect(() => {
    const el = sc.current;
    if (!el) return;
    const alFinal = () => { el.scrollLeft = el.scrollWidth; };
    alFinal();
    const r = requestAnimationFrame(alFinal);
    return () => cancelAnimationFrame(r);
  }, [listo, corre, W]); // `listo`: con el ancho todavía en 0 ya da «se corre» y el mismo W, y el efecto no volvía a correr
  if (!listo) return <div className="pel-chart" ref={ref} />;
  const ejes = [tope, tope / 2, 0];
  const svg = (
    <svg width={W} height={h} viewBox={`0 0 ${W} ${h}`} role="img" aria-label="Leads por cuánto vieron del video">
      <defs>
        {(Object.keys(COLOR) as Tono[]).map((t) => (
          <pattern key={t} id={`pel-pd-${t}`} width="6" height="6" patternUnits="userSpaceOnUse"><rect width="6" height="6" fill={COLOR[t]} fillOpacity=".16" /><circle cx="3" cy="3" r=".95" fill={COLOR[t]} fillOpacity=".62" /></pattern>
        ))}
      </defs>
      {ejes.map((v) => <g key={v}><line className="pel-chart__grid" x1="52" x2={W} y1={yB - v * k} y2={yB - v * k} />{!corre && <text className="pel-chart__ax" x="44" y={yB - v * k + 4} textAnchor="end">{marca(v)}</text>}</g>)}
      {tramos.map((t, i) => {
        const pila = pilaDe(t), cx = x0 + i * paso, segs: Array<[number, Tono]> = [[pila.nada, 'clay'], [pila.agendo, 'ochre'], [pila.compro, 'petrol']];
        let y = yB;
        return (
          <g key={t.clave} className={`pel-chart__col${i === sel ? ' pel-is-hi' : ''}`} onClick={() => onElegir(t.clave)}>
            <rect x={cx - paso / 2} y={yT} width={paso} height={yB - yT} fill="transparent" />
            {segs.map(([v, tono]) => {
              const alto = v * k;
              if (alto <= 0.5) return null;
              const r = Math.min(10, alto / 2), top = y - alto;
              y = top - 3;
              return (
                <g key={tono} className="pel-chart__bar" style={{ transformOrigin: `${cx}px ${yB}px` }}>
                  <rect className="pel-seg-dot" x={cx - ancho / 2} y={top} width={ancho} height={alto} rx={r} fill={`url(#pel-pd-${tono})`} />
                  <rect className="pel-seg-solid" x={cx - ancho / 2} y={top} width={ancho} height={alto} rx={r} fill={COLOR[tono]} />
                </g>
              );
            })}
            <text className={`pel-chart__x${i === sel ? ' pel-is-hi' : ''}`} x={cx} y={yB + 22} textAnchor="middle">{t.corto}</text>
          </g>
        );
      })}
    </svg>
  );
  // Como la copia: el total de la columna, arriba de su pila (los huecos de 3 px entre pisos, y 8 px de aire).
  const tip = sel >= 0 && (() => {
    const t = tramos[sel], cx = x0 + sel * paso, pisos = Object.values(pilaDe(t)).filter((x) => x * k > 0.5).length;
    return <span className="pel-chart__tip" style={{ left: cx, top: yB - t.leads * k - 3 * Math.max(0, pisos - 1) - 6 - 8 }}>{plural(t.leads, 'lead', 'leads')}</span>;
  })();
  return (
    <div className="pel-chart" ref={ref}>
      {corre ? (
        <>
          <div className="pel-chart__sc" ref={sc}>{svg}{tip}</div>
          <svg className="pel-chart__axis" viewBox={`0 0 52 ${h}`} aria-hidden>{ejes.map((v) => <text key={v} className="pel-chart__ax" x="44" y={yB - v * k + 4} textAnchor="end">{marca(v)}</text>)}</svg>
        </>
      ) : <>{svg}{tip}</>}
    </div>
  );
}

export function HojaVsl({ hoja, vista, titulo, hoy, periodo, onGrilla, onFila, compartido = false, quieta = false }: {
  hoja: Hoja;
  vista: VistaVsl;
  /** El nombre de la hoja («VSL y YouTube»). */
  titulo: string;
  /** Hoy en el negocio (YYYY-MM-DD): la fecha de la cabecera y de la tabla de los días. */
  hoy: string;
  /** El período de la hoja, como se lee en su control («Últimos 30 días»). */
  periodo: string;
  onGrilla?: () => void;
  /** Abrir una fila de una pieza: su detalle de siempre, como al tocarla en la grilla. */
  onFila?: (g: Grafico, clave: string) => void;
  compartido?: boolean;
  /** La miniatura de «Nueva hoja»: sin entrada, sin cifras que cuentan y sin leer la caja de IA. */
  quieta?: boolean;
}) {
  const v = vista;
  const p = hoja.diseno?.piezas ?? {};
  const pieza = (id: string | undefined) => hoja.componentes.find((c): c is Grafico => c.id === id && c.clase === 'grafico');
  const abrir = (id: string | undefined, clave: string) => { const g = pieza(id); return g && onFila && !quieta ? () => onFila(g, clave) : undefined; };
  const raiz = useRef<HTMLDivElement>(null);
  const caja = useCaja(hoja.id, compartido || quieta ? undefined : p.ia);
  const [rayo, setRayo] = useState<number | null>(null);
  const tramos = v.tramos?.tramos ?? [];
  const inicial = tramos.find((t) => t.clave === '75-100%' && t.leads > 0) ? '75-100%' : v.tramos?.mejor?.clave ?? null;
  const [elegido, setElegido] = useState<string | null>(inicial);
  useEffect(() => { setElegido((e) => (e == null || e === 'todos' || tramos.some((t) => t.clave === e) ? e ?? inicial : inicial)); }, [inicial]); // eslint-disable-line react-hooks/exhaustive-deps
  const riel = useRef<HTMLDivElement>(null), pastilla = useRef<HTMLSpanElement>(null), antes = useRef<number | null>(null);

  // La pastilla del riel corre .35 s con la curva de la página (lo medido de Pelago).
  useLayoutEffect(() => {
    const c = riel.current, pl = pastilla.current;
    const on = c?.querySelector<HTMLElement>('[aria-selected="true"]');
    if (!c || !pl || !on) return;
    const y = on.offsetTop;
    if (antes.current === y) return;
    if (antes.current == null) { pl.style.transition = 'none'; pl.style.transform = `translateY(${y}px)`; void pl.offsetWidth; pl.style.transition = ''; }
    else pl.style.transform = `translateY(${y}px)`;
    antes.current = y;
  });

  // ── La entrada (una vez, al montarse) ──────────────────────────────────────────────────────────────────────────────
  useLayoutEffect(() => {
    const el = raiz.current;
    if (!el || quieta || sinMovimiento()) return;
    Array.from(el.querySelectorAll('.pel-head > div > *, .pel-head__actions > *')).forEach((n, i) => anim(n, [{ opacity: 0, transform: 'translateY(12px)' }, { opacity: 1, transform: 'none' }], { duration: 650, delay: 120 + i * 50 }));
    Array.from(el.querySelectorAll('.pel-card')).forEach((c, i) => anim(c, [{ opacity: 0, transform: 'translateY(16px)' }, { opacity: 1, transform: 'none' }], { duration: 700, delay: 250 + i * 60 }));
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Los gráficos crecen y los números cuentan la PRIMERA vez que llegan los datos ───────────────────────────────────
  const firma = [v.apertura.play, v.play.dias.length, v.curva?.cortes.filter((c) => c.siguen != null).length, tramos.map((t) => t.leads).join(','), v.videos?.filas.length, v.ultimos.length, v.fugas?.length, v.cien?.final].join('|');
  useEffect(() => {
    const el = raiz.current;
    if (!el || quieta || sinMovimiento()) return;
    const nuevos = (s: string) => Array.from(el.querySelectorAll<HTMLElement | SVGElement>(s)).filter((n) => { if (n.dataset.animado != null) return false; n.dataset.animado = ''; return true; });
    const base = 450;
    nuevos('[data-cuenta]').forEach((n) => contar(n as HTMLElement, base));
    nuevos('.pel-rev__bars i').forEach((b, i) => anim(b, [{ transform: 'scaleY(0)' }, { transform: 'none' }], { duration: 900, delay: base + i * 20 }));
    nuevos('.pel-dial__sp').forEach((l, i) => {
      const a = l as SVGLineElement, L = Math.hypot(a.x2.baseVal.value - a.x1.baseVal.value, a.y2.baseVal.value - a.y1.baseVal.value);
      a.style.strokeDasharray = `${L} ${L + 20}`;
      anim(a, [{ strokeDashoffset: L }, { strokeDashoffset: 0 }], { duration: 800, delay: base + 100 + i * 25 });
    });
    nuevos('.pel-chart__bar').forEach((b, i) => anim(b, [{ transform: 'scaleY(0)' }, { transform: 'none' }], { duration: 900, delay: base + 150 + Math.floor(i / 3) * 40 }));
    nuevos('.pel-rev__mix span, .pel-mg__bar span, .pel-meter span').forEach((b, i) => anim(b, [{ transform: 'scaleX(0)' }, { transform: 'none' }], { duration: 900, delay: base + 200 + (i % 8) * 50 }));
    nuevos('.pel-rail__sp path.pel-rail__fill').forEach((pth, i) => { const L = (pth as SVGPathElement).getTotalLength?.() ?? 0; if (!L) return; pth.style.strokeDasharray = `${L}`; anim(pth, [{ strokeDashoffset: L }, { strokeDashoffset: 0 }], { duration: 1100, delay: base + 250 + i * 40, easing: P3IO }); });
  }, [firma, quieta]);

  const sinDatos = (x: unknown) => (v.cargando && x == null ? null : <Vacio>Todavía no hay datos en este período.</Vacio>);
  const puntos = caja.vista?.ultimo?.salida.puntos ?? [];
  const nombres = caja.vista?.ultimo?.nombres ?? {};
  const resp = v.respuesta;
  const tramoSel = elegido === 'todos' ? null : tramos.find((t) => t.clave === elegido) ?? null;
  const panel = tramoSel ?? (v.tramos ? { clave: 'todos', nombre: 'Todos los leads', corto: 'Todos', ...v.tramos.todos } : null);
  const chg = tramoSel && v.tramos ? contraTodos(tramoSel, v.tramos.todos) : null;
  const rielItems = v.tramos ? [{ clave: 'todos', nombre: 'Todos los leads', leads: v.tramos.todos.leads, tasa: v.tramos.todos.tasa }, ...[...tramos].reverse()] : [];
  const maxTasa = Math.max(1e-9, ...rielItems.map((t) => t.tasa ?? 0));
  const fugaCorte = v.curva && v.curva.fuga >= 0 ? v.curva.cortes[v.curva.fuga] : null;
  const rayoCorte = rayo != null ? v.curva?.cortes[rayo] ?? null : null;
  const cien = v.cien, cienN = cien ? enteros(cien.trozos.map((t) => t.valor)) : [];
  const TONO_CIEN = ['ochre', 'rose', 'sand', 'sky', 'keep'] as const;
  const videos = v.videos?.filas ?? [];

  return (
    <Compartido.Provider value={compartido}>
    <div className="pel" ref={raiz} data-quieta={quieta ? '' : undefined}>
      <style href="dash-hoja-vsl" precedence="medium">{CSS_VSL}</style>
      <section className="pel-head">
        <div>
          <div className="pel-head__date">{fechaLarga(hoy)} · {periodo}</div>
          <h1 className="pel-head__title">{titulo}</h1>
          <p className="pel-head__lede">
            {v.apertura.play != null ? <><b>{plural(v.apertura.play, 'persona', 'personas')}</b> le dieron play a tu video {enElPeriodo(periodo)} y <b>{entero(v.apertura.final ?? 0)}</b> lo vieron entero. </> : null}
            {resp?.mitad != null ? <>De los que vieron más de la mitad, <b>{pct(resp.mitad)} agendó</b>{resp.nada != null ? <> (de los que no lo vieron, <b>{pct(resp.nada)}</b>)</> : null}.</> : null}
          </p>
        </div>
        <div className="pel-head__actions">
          {onGrilla && !quieta && <button type="button" className="pel-btn pel-btn--ghost" onClick={onGrilla}><Icono id="grilla" />Ver la grilla</button>}
          <Ir href="/web-generator" className="pel-btn pel-btn--primary"><Icono id="pagina" />Tu página</Ir>
        </div>
      </section>

      {v.vacia ? (
        <section className="pel-card pel-c-vacia">
          <h2 className="pel-card__t">Todavía nadie le dio play a tu video</h2>
          <p className="pel-vacio">Cuando tu página tenga el Pixel de MaKo y alguien le dé play al video, aquí se ve hasta dónde llega cada uno y si los que lo ven más agendan más.</p>
        </section>
      ) : (
      <div className="pel-ov">
        <div className="pel-ov__r1">
          {/* «Revenue» → le dieron play */}
          <section className="pel-card pel-glazed pel-ov-rev">
            <div className="pel-rev__h"><h2 className="pel-rev__t">Le dieron play</h2><span className="pel-rev__p">{periodo}</span></div>
            <div className="pel-rev__big">
              {v.play.total != null ? <span className="pel-rev__v" data-cuenta>{entero(v.play.total)}</span> : <span className="pel-rev__v pel-sin">—</span>}
              {v.play.tasaFinal != null && <span className="pel-rev__chg"><Icono id="play" chico />{pct(v.play.tasaFinal)} al final</span>}
            </div>
            <p className="pel-rev__vs">personas, {enElPeriodo(periodo)}</p>
            {v.play.dias.length ? (
              <div className="pel-rev__bars" aria-label="Le dieron play, día por día">
                {v.play.dias.map((d, i) => <i key={d.clave} title={`${d.rotulo}: ${entero(d.play ?? 0)}`} className={i === v.play.dias.length - 1 ? 'pel-is-hi' : undefined} style={{ height: `${((d.play ?? 0) / v.play.tope) * 100}%` }} />)}
              </div>
            ) : <div className="pel-rev__bars">{v.cargando ? null : <span className="pel-rev__nada">Sin play en este período</span>}</div>}
            {v.play.mezcla && (
              <>
                <div className="pel-rev__mix"><span className="pel-t-sea" style={{ flex: Math.max(0.5, v.play.mezcla.final) }} /><span className="pel-t-gold" style={{ flex: Math.max(0.5, v.play.mezcla.mitad) }} /><span className="pel-t-salmon" style={{ flex: Math.max(0.5, v.play.mezcla.antes) }} /></div>
                <div className="pel-rev__leg"><span><i className="pel-t-sea" />Al final<b>{pct(v.play.mezcla.final)}</b></span><span><i className="pel-t-gold" />La mitad<b>{pct(v.play.mezcla.mitad)}</b></span><span><i className="pel-t-salmon" />Se van antes<b>{pct(v.play.mezcla.antes)}</b></span></div>
              </>
            )}
            <div className="pel-rev__stats">
              {v.numeros.map((n) => <div key={n.id}><span>{n.nombre}</span>{n.texto != null ? <b data-cuenta>{n.texto}</b> : <b className="pel-sin">—</b>}</div>)}
            </div>
          </section>

          {/* «Today, by the hour» → dónde se van */}
          <section className="pel-card pel-ov-today">
            <div className="pel-card__h"><span className="pel-card__ic"><Icono id="reloj" /></span><h2 className="pel-card__t">Dónde se van</h2><Ir href="/web-generator" className="pel-btn pel-btn--xs pel-btn--ghost pel-card__aside"><Icono id="play" chico />Tu video</Ir></div>
            {v.curva ? (
              <>
                <div className="pel-dial">
                  <Reloj v={v} onRayo={setRayo} />
                  <div className="pel-dial__mid" style={{ top: 5, bottom: -5 }}>
                    {rayoCorte?.siguen != null
                      ? <><b>{pct(rayoCorte.siguen)}</b><span>siguen en el {rayoCorte.corte}%</span></>
                      : v.tasaFinal != null ? <><b data-cuenta>{pct(v.tasaFinal)}</b><span>llegan al final</span></> : <><b className="pel-sin">—</b><span>llegan al final</span></>}
                  </div>
                </div>
                <p className="pel-today__foot">{fugaCorte?.caida ? <>Donde más se van: <b>entre el {fugaCorte.corte - 5}% y el {fugaCorte.corte}%</b> del video. Pasa el cursor por un rayo para leerlo.</> : 'Pasa el cursor por un rayo para leerlo.'}</p>
              </>
            ) : sinDatos(v.curva)}
          </section>

          {/* «From the kiln» → tus videos */}
          <section className="pel-card pel-ov-kiln">
            <div className="pel-card__h"><span className="pel-card__ic"><Icono id="play" /></span><h2 className="pel-card__t">Tus videos</h2>{onGrilla && !quieta && <button type="button" className="pel-btn pel-btn--xs pel-btn--ghost pel-card__aside" onClick={onGrilla}>Todos</button>}</div>
            {videos.length ? (
              <>
                {[videos.slice(0, 3), videos.slice(3)].map((grupo, g) => grupo.length ? (
                  <div key={g}>
                    <div className={`pel-kiln__lab${g ? ' pel-kiln__lab--2' : ''}`}>{g ? 'Los demás' : 'Los más vistos'}</div>
                    <div className="pel-kiln__list">
                      {grupo.map((x, i) => {
                        const ir = abrir(p.videos, x.clave);
                        return (
                          <div key={x.clave}>
                            <span className="pel-kiln__row" {...accionDe(ir)}><span className={`pel-kiln__th pel-gl-${VIDRIOS[(g * 3 + i) % VIDRIOS.length]}`} /><span className="pel-kiln__tx"><b>{x.nombre}</b><small>{plural(x.play, 'play', 'play')}{x.tFinal != null ? ` · ${pct(x.tFinal)} al final` : ''}</small></span></span>
                            {ir ? <button type="button" className="pel-ibtn pel-ibtn--add" aria-label={`Abrir ${x.nombre}`} onClick={ir}><Icono id="flecha" chico /></button> : <span className="pel-ibtn pel-ibtn--add" aria-hidden><Icono id="flecha" chico /></span>}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ) : null)}
              </>
            ) : sinDatos(v.videos)}
          </section>
        </div>

        {/* «Demand by category» → ¿los que más ven, más agendan? */}
        <section className="pel-card pel-ov-demand">
          <div className="pel-dem__h">
            <span className="pel-card__ic"><Icono id="barras" /></span><h2 className="pel-card__t">¿Los que más ven, más agendan?</h2>
            <div className="pel-dem__leg"><span><i className="pel-tone-petrol" />Compraron</span><span><i className="pel-tone-ochre" />Agendaron</span><span><i className="pel-tone-clay" />No agendaron</span></div>
            <Ir href="/crm" className="pel-btn pel-btn--xs pel-btn--ghost">En el CRM <Icono id="flecha" chico /></Ir>
          </div>
          {v.tramos && v.tramos.todos.leads > 0 ? (
            <div className="pel-dem__body">
              <div className="pel-rail" ref={riel} role="tablist" aria-label="Cuánto vieron del video">
                <span className="pel-rail__pill" ref={pastilla} />
                {rielItems.map((t) => {
                  const r = RIEL[t.clave] ?? RIEL.todos, ancho = ((t.tasa ?? 0) / maxTasa) * 50;
                  return (
                    <button key={t.clave} type="button" className="pel-rail__item" role="tab" aria-selected={(elegido ?? 'todos') === t.clave} onClick={() => setElegido(t.clave)}>
                      <span className="pel-rail__ic" style={{ background: r.fondo, color: r.tono }}><Icono id={r.ic} /></span>
                      <span className="pel-rail__tx"><b>{t.nombre}</b><small>{plural(t.leads, 'lead', 'leads')}{t.tasa != null ? ` · ${pct(t.tasa)} agendó` : ''}</small></span>
                      <svg className="pel-rail__sp" viewBox="0 0 56 22" aria-hidden><path d="M3 11H53" stroke="#201c1612" strokeWidth="4" strokeLinecap="round" fill="none" />{ancho > 0 && <path className="pel-rail__fill" d={`M3 11H${(3 + ancho).toFixed(1)}`} stroke={r.tono} strokeWidth="4" strokeLinecap="round" fill="none" />}</svg>
                    </button>
                  );
                })}
              </div>
              <Columnas tramos={tramos} elegido={elegido === 'todos' ? null : elegido} onElegir={setElegido} />
              {panel && (
                <aside className="pel-mp">
                  <div className="pel-mp__h">{panel.nombre} <span className="pel-mp__soft">{plural(panel.leads, 'lead', 'leads')}</span></div>
                  <div className="pel-mp__cat">Agendaron, de los que entraron</div>
                  <div className="pel-mp__v">{panel.tasa != null ? pct(panel.tasa) : '—'}</div>
                  {chg && <span className={`pel-mp__chg${chg.bueno ? ' pel-mp__chg--up' : ''}`}><Icono id={chg.bueno ? 'sube' : 'baja'} />{chg.texto}</span>}
                  <div className="pel-mp__ch">
                    {([['petrol', 'Compraron', pilaDe(panel).compro], ['ochre', 'Agendaron sin comprar', pilaDe(panel).agendo], ['clay', 'No agendaron', pilaDe(panel).nada]] as const).map(([tono, nombre, n]) => (
                      <div key={nombre} className="pel-mp__row"><i className={`pel-tone-${tono}`} /><span>{nombre}</span><b>{entero(n)}</b><span className="pel-meter"><span className={`pel-tone-${tono}`} style={{ width: `${panel.leads ? (n / panel.leads) * 100 : 0}%` }} /></span></div>
                    ))}
                  </div>
                  {v.tramos.mejor && v.tramos.mejor.tasa != null && (
                    <div className="pel-mp__stub"><span className="pel-mp__lab">El que más agenda</span><span className="pel-mp__who"><span className="pel-av">{Math.round(v.tramos.mejor.tasa)}%</span><span><b>{v.tramos.mejor.nombre}</b><small>{entero(v.tramos.mejor.agendas)} de {plural(v.tramos.mejor.leads, 'lead', 'leads')}</small></span></span></div>
                  )}
                  {videos[0] && (
                    <div className="pel-mp__stub"><span className="pel-mp__lab">Tu video más visto</span><span className="pel-mp__who"><span className="pel-kiln__th pel-gl-tide" /><span className="pel-mp__txt"><b>{videos[0].nombre}</b><small>{plural(videos[0].play, 'play', 'play')}{videos[0].tFinal != null ? ` · ${pct(videos[0].tFinal)} al final` : ''}</small></span></span></div>
                  )}
                </aside>
              )}
            </div>
          ) : sinDatos(v.tramos)}
        </section>

        <div className="pel-ov__r3">
          {/* «Latest orders» → los últimos días */}
          <section className="pel-card pel-ov-orders">
            <div className="pel-card__h"><span className="pel-card__ic"><Icono id="dia" /></span><h2 className="pel-card__t">Los últimos días</h2>
              {onGrilla && !quieta && <span className="pel-card__aside"><button type="button" className="pel-btn pel-btn--xs pel-btn--ghost" onClick={onGrilla}>Todos</button></span>}</div>
            {v.ultimos.length ? (
              <table className="pel-table">
                <thead><tr><th style={{ width: 158 }}>Día</th><th style={{ width: 143 }}>Play</th><th style={{ width: 145 }}>Un cuarto</th><th>La mitad</th><th>Al final</th></tr></thead>
                <tbody>
                  {v.ultimos.map((d, i) => (
                    <tr key={d.clave} {...accionDe(abrir(p.dia, d.clave))}>
                      <td><span className="pel-ord"><span className={`pel-av pel-t-${TONO_AV[i % TONO_AV.length]}`}>{diaDelMes(d.clave)}</span><span><code>{d.rotulo}</code><small>{haceCuanto(d.clave, hoy)}</small></span></span></td>
                      <td>{entero(d.play)}<span className="pel-tel"> play</span></td>
                      <td><span className="pel-chan"><Icono id="ojo" chico />{d.t25 != null ? pct(d.t25) : '—'}</span></td>
                      <td>{d.t50 != null ? <span className="pel-paid"><i />{pct(d.t50)}<span className="pel-tel"> la mitad</span></span> : '—'}</td>
                      <td className="pel-td-total">{d.tFinal != null ? <>{pct(d.tFinal)}<span className="pel-tel"> al final</span></> : '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : sinDatos(null)}
          </section>

          {/* «Best sellers» → dónde más se van */}
          <section className="pel-card pel-ov-best">
            <div className="pel-card__h"><span className="pel-card__ic"><Icono id="fuga" /></span><h2 className="pel-card__t">Dónde más se van</h2><span className="pel-card__sub">De cada 100</span></div>
            {v.fugas && v.fugas.length ? (
              <div className="pel-best">
                {v.fugas.map((f, i) => (
                  <div key={f.hasta} className="pel-best__row">
                    <span className="pel-best__n">{i + 1}</span>
                    <span className="pel-kiln__th pel-best__th">{f.hasta}%</span>
                    <span className="pel-best__m"><b>Entre el {f.desde}% y el {f.hasta}%</b><em>−{Math.round(f.caida)}</em><span className="pel-meter"><span style={{ width: `${f.ancho * 100}%` }} /></span><small>Siguen {Math.round(f.siguen)} de cada 100</small></span>
                  </div>
                ))}
              </div>
            ) : sinDatos(v.fugas)}
          </section>
        </div>

        <div className="pel-ov__r4">
          {/* «Where each $100 goes» → de cada 100 que le dan play */}
          <section className="pel-card pel-ov-margin">
            <div className="pel-card__h"><span className="pel-card__ic"><Icono id="cien" /></span><h2 className="pel-card__t">De cada 100 que le dan play</h2></div>
            {cien ? (
              <>
                <div className="pel-mg__big"><b data-cuenta>{cienN[4]}</b><span>de cada 100 que le dan play llegan al final del video</span></div>
                <div className="pel-mg__bar">{cien.trozos.map((t, i) => <span key={t.id} className={TONO_CIEN[i] === 'keep' ? 'pel-keep' : `pel-tone-${TONO_CIEN[i]}`} style={{ flex: Math.max(0.6, t.valor) }} />)}</div>
                <ul className="pel-mg__leg">
                  {cien.trozos.map((t, i) => <li key={t.id}><i className={TONO_CIEN[i] === 'keep' ? 'pel-keep' : `pel-tone-${TONO_CIEN[i]}`} />{t.nombre}<b>{cienN[i]}</b></li>)}
                </ul>
              </>
            ) : sinDatos(cien)}
          </section>

          {/* «Activity» → lo que escribió MaKo */}
          <section className="pel-card pel-ov-feed">
            <div className="pel-card__h"><span className="pel-card__ic"><Icono id="chispa" /></span><h2 className="pel-card__t">Qué dice tu video</h2></div>
            {puntos.length ? (
              <ul className="pel-feed">
                {puntos.slice(0, 6).map((pt, i) => (
                  <li key={i}><span className="pel-feed__ic"><Icono id="chispa" chico /></span><div><span className="pel-feed__t">{conNombres(pt.titulo, nombres)}</span><small>{conNombres(pt.texto, nombres)}</small></div></li>
                ))}
              </ul>
            ) : <Vacio>{caja.cargando ? 'Leyendo lo que escribió MaKo…' : quieta ? 'Aquí van las conclusiones de MaKo sobre tu video.' : 'MaKo todavía no escribió sus conclusiones de esta hoja: se piden desde la grilla.'}</Vacio>}
          </section>
        </div>
      </div>
      )}
    </div>
    </Compartido.Provider>
  );
}
