'use client';

// =============================================================================
// HojaHooks — la hoja «Hooks y retención» con su DISEÑO PROPIO: la copia de Ondra, con los datos reales de MaKo
// =============================================================================
// Martín, 4/11/2026: «que sea primero la copia, es decir, que se vea exactamente igual que la copia, y después la adaptación con
// Maco... copiarlo todo, desde las animaciones de entrada, las animaciones de hover, las animaciones de clic» y «Después seguí con la
// segunda hoja, de a una». La copia y la adaptación (maquetas) están en docs/diseno/mockups-dashboard/hooks-ondra/; ésta es la
// adaptación con los datos de verdad (lib/hooks-diseno.ts arma lo que dibuja cada tarjeta, con test). La pregunta: «¿en qué parte
// del video se van, y qué gancho los retiene?».
//
// El movimiento sale de las RECETAS del INFORME de Ondra (docs/diseno/mockups-dashboard/demos/ondra/INFORME.txt): el embudo mide cada
// barra como max(.035, (el paso / el primero) ^ .42) y marca la caída más grande; el medidor es un arco de radio 86 con centro
// (110, 104), 21 marcas cada 9° (la mayor cada cinco) y la marca en −90 + 180 × la parte; la pastilla del selector y la de los números
// corren .35 s con su curva (.2, .8, .2, 1); al pasar, la fila de un avatar se pinta (.25 s) y los links del título se subrayan.
// ⚠️ SUPUESTO (el INFORME corta la receta de la página): la cabecera sube desde 12 px (.65 s); las tarjetas suben desde 18 px (.7 s,
// power3.out, desde .3 s, cada .06 s); la curva se dibuja en 1,2 s; las barras crecen en .9 s; los anillos en 1 s; la aguja gira
// desde la izquierda en 1,1 s; los números cuentan en .9 s.
//
// ⚠️ Mirando se dibuja esto; editando, la grilla con los mismos componentes (app/dashboard/EditorInforme.tsx).
// ⚠️ Lo que Ondra tiene y MaKo no mide no está (lib/hooks-diseno.ts): el rango de 7, 30 y 90 días, los lanzamientos sobre la curva, el
//    filtro por canal del embudo, el interruptor de cada campaña y el presupuesto del mes. La barra de la izquierda y la de arriba son
//    el armazón de Ondra: en MaKo las pone la app. El logo de Ondra tampoco: es su dibujo.
// =============================================================================

import { createContext, useContext, useEffect, useLayoutEffect, useRef, useState, type KeyboardEvent, type ReactNode } from 'react';
import Link from '@/app/_ui/Link';
import type { Grafico, Hoja } from '@/lib/graficos-catalogo';
import { conNombres } from '@/lib/graficos-analisis';
import type { VistaCaja } from '@/lib/graficos-ia-elemento';
import { entero } from '@/lib/marketing-diseno';
import { corto, curvaDe, tasa, type IdNumero, type NumeroHk, type VistaHooks } from '@/lib/hooks-diseno';
import { leerCaja } from '../ElementoIA';
import { CSS_HOOKS } from './hooks-css';

const Compartido = createContext(false);

// Los íconos son trazos propios (los de la copia, maquetas/ondra/copia.html).
const P = {
  cal: 'M2.5 3.5h11v10h-11zM2.5 6.5h11M5.5 2v3M10.5 2v3',
  grilla: 'M2 2h5v5H2zM9 2h5v5H9zM2 9h5v5H2zM9 9h5v5H9z',
  pluma: 'M3 13l.8-3.2L11 2.6a1.6 1.6 0 0 1 2.4 2.4L6.2 12.2zM9.8 3.8l2.4 2.4',
  gancho: 'M8 2.5v6.5a3 3 0 0 1-6 0V7.5M8 2.5 6 4.5M8 2.5l2 2',
  llamado: 'M3 8h7.5M8 5l3 3-3 3M13 3.5v9',
  play: 'M5 3.5v9l7-4.5z',
  guion: 'M4 2h5l3 3v9H4zM9 2v3h3M6 9h4M6 11.5h4',
  sube: 'M8 13V3M4 7l4-4 4 4',
  baja: 'M8 3v10M4 9l4 4 4-4',
  flecha: 'M6.5 4l4 4-4 4',
  chispa: 'M8 2.5l1.4 3.7 3.7 1.4-3.7 1.4L8 12.7 6.6 9 2.9 7.6l3.7-1.4zM12.5 2v2.5M13.8 3.2h-2.6',
} as const;
type IconoId = keyof typeof P;
function Icono({ id }: { id: IconoId }) {
  return <svg className="ond-i" viewBox="0 0 16 16" aria-hidden><path d={P[id]} /></svg>;
}

const P3 = 'cubic-bezier(.215, .61, .355, 1)', P2 = 'cubic-bezier(.25, .46, .45, .94)', P3IO = 'cubic-bezier(.645, .045, .355, 1)', ONDRA = 'cubic-bezier(.2, .8, .2, 1)';
const sinMovimiento = () => typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
const anim = (n: Element | null | undefined, kf: Keyframe[], o: KeyframeAnimationOptions) => { if (n && 'animate' in n) (n as HTMLElement).animate(kf, { fill: 'backwards', easing: P3, ...o }); };
const eP3 = (t: number) => 1 - Math.pow(1 - t, 3);

/** Cuenta el número de un texto desde cero («31.4%», «48.2k», «24»), con sus decimales, su prefijo y su sufijo (.9 s, power3.out). */
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

/** El tamaño de una caja (la curva se dibuja a su tamaño real, como en Ondra: un viewBox fijo deforma el texto). */
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
  if (useContext(Compartido)) return <span className={`${className ?? ''} ond-quieta`}>{children}</span>;
  return <Link href={href} className={className}>{children}</Link>;
}
function Vacio({ children }: { children: ReactNode }) {
  return <p className="ond-vacio">{children}</p>;
}
const accionDe = (fn: (() => void) | undefined) => (fn ? { role: 'button', tabIndex: 0, onClick: fn, onKeyDown: (e: KeyboardEvent) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); fn(); } } } : {});
const plural = (n: number, una: string, varias: string) => `${entero(n)} ${n === 1 ? una : varias}`;
const DIAS = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
const fechaLarga = (hoy: string) => { const d = new Date(`${hoy}T12:00:00Z`); return `${DIAS[d.getUTCDay()]} ${d.getUTCDate()} de ${MESES[d.getUTCMonth()]}`; };
const ICONO_NUMERO: Record<IdNumero, IconoId> = { hook: 'gancho', cta: 'llamado', thruplay: 'play', guiones: 'guion' };
const TONO_NUMERO: Record<IdNumero, string> = { hook: 'ember', cta: 'pine', thruplay: 'steel', guiones: 'gold' };

// ── La pastilla que corre (el selector y los cuatro números) ─────────────────────────────────────────────────────────
function usePastilla(clave: string, borde: number) {
  const caja = useRef<HTMLDivElement>(null), pastilla = useRef<HTMLSpanElement>(null), antes = useRef<number | null>(null);
  useLayoutEffect(() => {
    const c = caja.current, p = pastilla.current;
    const on = c?.querySelector<HTMLElement>('[aria-pressed="true"]');
    if (!c || !p || !on) return;
    const x = on.offsetLeft - borde;
    p.style.width = `${on.offsetWidth}px`;
    if (antes.current != null && antes.current !== x && !sinMovimiento()) p.animate([{ transform: `translateX(${antes.current}px)` }, { transform: `translateX(${x}px)` }], { duration: 350, easing: ONDRA });
    p.style.transform = `translateX(${x}px)`;
    antes.current = x;
  });
  return [caja, pastilla] as const;
}

// ── «Performance» → la curva del número elegido ─────────────────────────────────────────────────────────────────────
function Curva({ n }: { n: NumeroHk }) {
  const [ref, { w, h }] = useTam<HTMLDivElement>();
  const c = curvaDe(n);
  if (!c) return <div className="ond-chart" ref={ref} />;
  const tel = w < 520, x0 = tel ? 40 : 47, x1 = w - (tel ? 6 : 4), yT = 17, yB = Math.max(yT + 40, h - 40);
  const listo = w > 80 && h > 80;
  const X = (i: number) => x0 + (c.puntos.length > 1 ? (i / (c.puntos.length - 1)) * (x1 - x0) : (x1 - x0) / 2);
  const Y = (v: number) => yB - (v / c.tope) * (yB - yT);
  // Una curva monótona (Fritsch–Carlson), como la del demo: pasa por cada día sin pasarse de los picos. Un día sin dato la corta.
  const tramos: Array<Array<[number, number]>> = [];
  c.puntos.forEach((v, i) => { if (v == null) { tramos.push([]); return; } if (!tramos.length) tramos.push([]); tramos[tramos.length - 1].push([X(i), Y(v)]); });
  const liso = (pts: Array<[number, number]>) => {
    if (pts.length < 2) return pts.length ? `M${pts[0][0]},${pts[0][1]}` : '';
    const d = pts.slice(1).map((p, i) => (p[1] - pts[i][1]) / (p[0] - pts[i][0]));
    const m = pts.map((_, i) => (i === 0 ? d[0] : i === pts.length - 1 ? d[d.length - 1] : d[i - 1] * d[i] <= 0 ? 0 : (2 * d[i - 1] * d[i]) / (d[i - 1] + d[i])));
    return pts.map((p, i) => { if (!i) return `M${p[0].toFixed(1)},${p[1].toFixed(1)}`; const k = (p[0] - pts[i - 1][0]) / 3; return `C${(pts[i - 1][0] + k).toFixed(1)},${(pts[i - 1][1] + m[i - 1] * k).toFixed(1)} ${(p[0] - k).toFixed(1)},${(p[1] - m[i] * k).toFixed(1)} ${p[0].toFixed(1)},${p[1].toFixed(1)}`; }).join(' ');
  };
  const lineas = tramos.filter((t) => t.length).map(liso);
  const area = tramos.filter((t) => t.length > 1).map((t) => `${liso(t)} L${t[t.length - 1][0].toFixed(1)},${yB} L${t[0][0].toFixed(1)},${yB}Z`);
  const guias = [1, 0.75, 0.5, 0.25, 0].map((k) => c.tope * k);
  const rotulo = (v: number) => (n.esTasa ? `${Math.round(v)}%` : `${Math.round(v)}`);
  const marcas = tel ? c.marcas.filter((_, i) => i % 2 === 0) : c.marcas;
  return (
    <div className="ond-chart" ref={ref}>
      {listo && (
        <svg viewBox={`0 0 ${w} ${h}`} role="img" aria-label={`${n.nombre}, día por día`}>
          <defs><linearGradient id="ond-area" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="var(--ember)" stopOpacity=".2" /><stop offset="1" stopColor="var(--ember)" stopOpacity="0" /></linearGradient></defs>
          {guias.map((v) => <line key={v} x1={x0} x2={x1} y1={Y(v)} y2={Y(v)} stroke="var(--line-2)" strokeDasharray="1 5" strokeLinecap="round" />)}
          {[guias[0], guias[2], 0].map((v) => <text key={v} className="ond-chart__ax" x={x0 - 10} y={Y(v) + 4} textAnchor="end">{rotulo(v)}</text>)}
          <g className="ond-chart__rev">
            {area.map((d, i) => <path key={i} d={d} fill="url(#ond-area)" />)}
            {c.anterior != null && <line className="ond-chart__antes" x1={x0} x2={x1} y1={Y(c.anterior)} y2={Y(c.anterior)} stroke="var(--muted)" strokeWidth="2" strokeDasharray="6 5" />}
            {lineas.map((d, i) => <path key={i} className="ond-chart__line" d={d} fill="none" stroke="var(--ember)" strokeWidth="2.4" strokeLinejoin="round" />)}
          </g>
          {marcas.map((i) => <text key={i} className="ond-chart__x" x={X(i)} y={yB + 22} textAnchor={i === 0 ? 'start' : i === c.puntos.length - 1 ? 'end' : 'middle'}>{n.dias[i].rotulo}</text>)}
        </svg>
      )}
    </div>
  );
}

// ── «October budget» → tu gancho contra el bueno ────────────────────────────────────────────────────────────────────
function Medidor({ parte, marca }: { parte: number; marca: number }) {
  const p = (a: number, r = 86): [number, number] => [110 + r * Math.sin((a * Math.PI) / 180), 104 - r * Math.cos((a * Math.PI) / 180)];
  const [ax, ay] = p(-90), [bx, by] = p(90);
  const arco = `M${ax},${ay} A86,86 0 0 1 ${bx},${by}`, L = Math.PI * 86;
  const ang = -90 + 180 * parte, angMarca = -90 + 180 * marca;
  const [hx1, hy1] = p(angMarca, 78), [hx2, hy2] = p(angMarca, 98);
  return (
    <div className="ond-gauge">
      <svg viewBox="0 0 220 122" role="img" aria-label="Tu gancho contra el bueno">
        <path d={arco} fill="none" stroke="var(--well)" strokeWidth="14" strokeLinecap="round" />
        <path className="ond-gauge__fill" d={arco} fill="none" stroke="var(--ember)" strokeWidth="14" strokeLinecap="round" strokeDasharray={L} strokeDashoffset={L * (1 - parte)} />
        {Array.from({ length: 21 }, (_, t) => {
          const a = -90 + t * 9, [x1, y1] = p(a, 70), [x2, y2] = p(a, 86 - (t % 5 === 0 ? 26 : 21));
          return <line key={t} x1={x1.toFixed(1)} y1={y1.toFixed(1)} x2={x2.toFixed(1)} y2={y2.toFixed(1)} stroke={t % 5 === 0 ? 'var(--text)' : 'var(--line-2)'} strokeWidth={t % 5 === 0 ? 2 : 1.5} strokeLinecap="round" />;
        })}
        <line x1={hx1} y1={hy1} x2={hx2} y2={hy2} stroke="var(--text)" strokeWidth="3" strokeLinecap="round" />
        <g className="ond-gauge__needle" style={{ transformOrigin: '110px 104px', transform: `rotate(${ang}deg)` }}>
          <path d="M107.6,104 L109.2,34 L110.8,34 L112.4,104Z" fill="var(--text)" />
          <circle cx="110" cy="104" r="6.5" fill="var(--surface)" stroke="var(--text)" strokeWidth="4" />
        </g>
      </svg>
    </div>
  );
}

export function HojaHooks({ hoja, vista, titulo, hoy, periodo, onGrilla, onFila, compartido = false, quieta = false }: {
  hoja: Hoja;
  vista: VistaHooks;
  /** El nombre de la hoja («Hooks y retención»). */
  titulo: string;
  /** Hoy en el negocio (YYYY-MM-DD): la fecha de la cabecera. */
  hoy: string;
  /** El período de la hoja, como se lee en su control («Todo», «Últimos 30 días»). */
  periodo: string;
  onGrilla?: () => void;
  /** Abrir una fila de una pieza: su detalle de siempre, como al tocarla en la grilla (un guion abre su pop-up). */
  onFila?: (g: Grafico, clave: string) => void;
  compartido?: boolean;
  /** La miniatura de «Nueva hoja»: sin entrada, sin cifras que cuentan y sin leer la caja de IA. */
  quieta?: boolean;
}) {
  const { apertura, numeros, ganchos, guiones, caida, avatares, medidor, cargando, vacia } = vista;
  const p = hoja.diseno?.piezas ?? {};
  const pieza = (id: string | undefined) => hoja.componentes.find((c): c is Grafico => c.id === id && c.clase === 'grafico');
  const abrir = (id: string | undefined, clave: string) => { const g = pieza(id); return g && onFila && !quieta ? () => onFila(g, clave) : undefined; };
  const raiz = useRef<HTMLDivElement>(null);
  const [elegido, setElegido] = useState<IdNumero>('hook');
  const [metrica, setMetrica] = useState<'hook' | 'cta' | 'thru'>('hook');
  const [kpis, barra] = usePastilla(elegido, 6);
  const [seg, pastilla] = usePastilla(metrica, 3);
  const caja = useCaja(hoja.id, compartido || quieta ? undefined : p.ia);
  const numero = numeros.find((n) => n.id === elegido) ?? numeros[0];

  // ── La entrada (una vez, al montarse) ──────────────────────────────────────────────────────────────────────────────
  useLayoutEffect(() => {
    const el = raiz.current;
    if (!el || quieta || sinMovimiento()) return;
    Array.from(el.querySelectorAll('.ond-ov__head > div > *, .ond-ov__actions > *')).forEach((n, i) => anim(n, [{ opacity: 0, transform: 'translateY(12px)' }, { opacity: 1, transform: 'none' }], { duration: 650, delay: 120 + i * 50 }));
    Array.from(el.querySelectorAll('.ond-card')).forEach((c, i) => anim(c, [{ opacity: 0, transform: 'translateY(18px)' }, { opacity: 1, transform: 'none' }], { duration: 700, delay: 300 + i * 60 }));
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Los gráficos crecen y los números cuentan la PRIMERA vez que llegan los datos ───────────────────────────────────
  const firma = [apertura.tres, numeros.map((x) => x.texto).join(','), ganchos?.filas.length, guiones?.filas.length, caida?.pasos[0]?.valor, avatares?.length, medidor.valor].join('|');
  useEffect(() => {
    const el = raiz.current;
    if (!el || quieta || sinMovimiento()) return;
    const nuevos = (s: string) => Array.from(el.querySelectorAll<HTMLElement | SVGElement>(s)).filter((n) => { if (n.dataset.animado != null) return false; n.dataset.animado = ''; return true; });
    const base = 450;
    nuevos('[data-cuenta]').forEach((n) => contar(n as HTMLElement, base));
    nuevos('.ond-chart__line').forEach((l) => { const L = (l as SVGPathElement).getTotalLength?.() ?? 0; if (!L) return; l.style.strokeDasharray = `${L}`; anim(l, [{ strokeDashoffset: L }, { strokeDashoffset: 0 }], { duration: 1200, delay: base, easing: P3IO }); });
    nuevos('.ond-chart__rev path:not(.ond-chart__line)').forEach((a) => anim(a, [{ opacity: 0 }, { opacity: 1 }], { duration: 900, delay: base + 250, easing: P2 }));
    nuevos('.ond-mix__bar span, .ond-mix__track i, .ond-live__bud i span, .ond-fun__bar').forEach((b, i) => anim(b, [{ transform: 'scaleX(0)' }, { transform: 'none' }], { duration: 900, delay: base + 150 + (i % 8) * 60 }));
    nuevos('.ond-ring__arc').forEach((a, i) => { const C = Number(a.getAttribute('stroke-dasharray')); anim(a, [{ strokeDashoffset: C }, { strokeDashoffset: Number(a.getAttribute('stroke-dashoffset')) }], { duration: 1000, delay: base + 400 + i * 60 }); });
    nuevos('.ond-gauge__needle').forEach((g) => anim(g, [{ transform: 'rotate(-90deg)' }, { transform: (g as SVGGElement).style.transform }], { duration: 1100, delay: base + 200 }));
    nuevos('.ond-gauge__fill').forEach((f) => { const L = Number(f.getAttribute('stroke-dasharray')); anim(f, [{ strokeDashoffset: L }, { strokeDashoffset: Number(f.getAttribute('stroke-dashoffset')) }], { duration: 1100, delay: base + 200 }); });
  }, [firma, quieta]);

  const sinDatos = (x: unknown) => (cargando && x == null ? null : <Vacio>Todavía no hay datos en este período.</Vacio>);
  const valorGancho = (g: { hook: number | null; cta: number | null; thru: number | null }) => (metrica === 'hook' ? g.hook : metrica === 'cta' ? g.cta : g.thru);
  const maxGancho = Math.max(1e-9, ...(ganchos?.filas ?? []).map((g) => valorGancho(g) ?? 0));
  const totalGancho = ganchos ? valorGancho(ganchos) : null;
  const puntos = caja.vista?.ultimo?.salida.puntos ?? [];
  const nombres = caja.vista?.ultimo?.nombres ?? {};
  const R = 15, C = 2 * Math.PI * R;

  return (
    <Compartido.Provider value={compartido}>
    <div className="ond" ref={raiz} data-quieta={quieta ? '' : undefined}>
      <style href="dash-hoja-hooks" precedence="medium">{CSS_HOOKS}</style>
      <div className="ond-ov__head">
        <div>
          <div className="ond-ov__date"><Icono id="cal" />{fechaLarga(hoy)} · {periodo}</div>
          <h1 className="ond-ov__title">{titulo}</h1>
          <p className="ond-ov__lede">
            {apertura.tres != null ? <><b>{corto(apertura.tres)}</b> vieron los primeros 3 segundos, <b>{corto(apertura.mitad ?? 0)}</b> llegaron a la mitad y <b>{corto(apertura.entero ?? 0)}</b> lo vieron entero. </> : null}
            <Ir href="/ads-writer" className="ond-link">Ver tus guiones</Ir>
          </p>
        </div>
        <div className="ond-ov__actions">
          {onGrilla && !quieta && <button type="button" className="ond-btn ond-btn--ghost" onClick={onGrilla}><Icono id="grilla" />Ver la grilla</button>}
          <Ir href="/ads-writer" className="ond-btn ond-btn--primary"><Icono id="pluma" />Escribir un guion</Ir>
        </div>
      </div>

      {vacia ? (
        <section className="ond-card ond-c-vacia">
          <h2 className="ond-card__t">Todavía no hay anuncios con su guion analizado</h2>
          <p className="ond-card__s">Cuando MaKo analice los guiones de tus anuncios de Meta, aquí se ve en qué parte del video se va la gente y qué gancho la retiene.</p>
        </section>
      ) : (
      <>
      <div className="ond-ov__grid ond-ov__r1">
        {/* «Performance» → los cuatro números, con su curva */}
        <section className="ond-card ond-ov__hero">
          <div className="ond-card__h">
            <div><h2 className="ond-card__t">Cuánto ven tus anuncios</h2><p className="ond-card__s">Cada número contra el período anterior</p></div>
          </div>
          <div className="ond-kpis" ref={kpis}>
            <span className="ond-kpis__bar" ref={barra} />
            {numeros.map((n) => (
              <button key={n.id} type="button" className={`ond-kpi ond-kpi--${TONO_NUMERO[n.id]}`} aria-pressed={n.id === elegido} onClick={() => setElegido(n.id)}>
                <span className="ond-kpi__l"><span className="ond-kpi__i"><Icono id={ICONO_NUMERO[n.id]} /></span>{n.nombre}</span>
                {n.texto != null ? <span className="ond-kpi__v" data-cuenta>{n.texto}</span> : <span className="ond-kpi__v ond-sin">—</span>}
                <span className="ond-kpi__d">
                  {n.cambio && <span className={`ond-chg ${n.cambio.bueno ? 'ond-chg--up' : 'ond-chg--down'}`}><Icono id={n.cambio.sube ? 'sube' : 'baja'} />{n.cambio.texto}</span>}
                  {n.antes}
                </span>
              </button>
            ))}
          </div>
          {numero && numero.dias.length > 1 ? <Curva n={numero} /> : <div className="ond-chart">{sinDatos(numero?.texto ?? null)}</div>}
          <div className="ond-legend"><span><i />Este período</span>{numero?.anterior != null && <span><i className="ond-dash" />Promedio del período anterior</span>}</div>
        </section>

        {/* «Where it came from» → qué gancho retiene */}
        <section className="ond-card ond-ov__mix">
          <div><h2 className="ond-card__t">Qué gancho retiene</h2><p className="ond-card__s">Por tipo de gancho, en el período</p></div>
          <div className="ond-seg ond-seg--full" ref={seg}>
            <span className="ond-seg__pill" ref={pastilla} />
            {([['hook', 'Gancho'], ['cta', 'Al llamado'], ['thru', 'ThruPlay']] as const).map(([k, nombre]) => (
              <button key={k} type="button" className="ond-seg__btn" aria-pressed={metrica === k} onClick={() => setMetrica(k)}>{nombre}</button>
            ))}
          </div>
          {ganchos && ganchos.filas.length ? (
            <>
              <div className="ond-mix__bar" aria-hidden>{ganchos.filas.map((g) => <span key={g.clave} className={`ond-t-${g.tono}`} style={{ flex: g.guiones }} />)}</div>
              <div className="ond-mix__rows">
                {ganchos.filas.map((g) => {
                  const v = valorGancho(g);
                  return (
                    <div key={g.clave} className={`ond-mix__row ond-t-${g.tono}`}>
                      <span className="ond-mix__n">{g.nombre} <small>{plural(g.guiones, 'guion', 'guiones')}</small></span>
                      <span className="ond-mix__v">{v != null ? tasa(v) : '—'}</span>
                      <span className="ond-mix__p">{g.parte}%</span>
                      <span className="ond-mix__track"><i style={{ width: `${((v ?? 0) / maxGancho) * 100}%` }} /></span>
                    </div>
                  );
                })}
              </div>
              <p className="ond-mix__foot">
                {metrica === 'hook'
                  ? <>El buen gancho está en <b>28%</b>: {ganchos.pasan ? <><b>{plural(ganchos.pasan, 'tipo', 'tipos')}</b> de {ganchos.filas.length} lo pasan.</> : <>ninguno lo pasa todavía.</>}</>
                  : <>En todos tus guiones: <b>{totalGancho != null ? tasa(totalGancho) : '—'}</b> {metrica === 'cta' ? 'llegan al llamado' : 'de ThruPlay'}.</>}
              </p>
            </>
          ) : sinDatos(ganchos)}
        </section>
      </div>

      <div className="ond-ov__grid ond-ov__r2">
        {/* «Running now» → cada guion */}
        <section className="ond-card">
          <div className="ond-card__h">
            <div><h2 className="ond-card__t">Cada guion</h2><p className="ond-card__s">{guiones ? `${plural(guiones.total, 'guion', 'guiones')} · del que más retiene al que menos` : 'Del que más retiene al que menos'}</p></div>
            <Ir href="/ads-writer" className="ond-card__more">Todos los guiones</Ir>
          </div>
          {guiones && guiones.filas.length ? (
            <div className="ond-live">
              {guiones.filas.map((g) => (
                <div key={g.clave} className={`ond-live__row ond-t-${g.tono}`} {...accionDe(abrir(p.tabla, g.clave))}>
                  <span className="ond-live__ic"><Icono id="play" /></span>
                  <span className="ond-live__name"><b>{g.nombre}</b><small>{g.detalle || 'Sin tipo de gancho'}</small></span>
                  <span className="ond-live__bud"><i><span style={{ width: `${Math.min(100, ((g.hook ?? 0) / 56) * 100)}%` }} /></i><span><b>{g.hook != null ? tasa(g.hook) : '—'}</b> de gancho</span></span>
                  <span className="ond-live__fig"><b>{g.cta != null ? tasa(g.cta) : '—'}</b><small>al llamado</small></span>
                  <span className="ond-live__fig ond-live__fig--rev"><b>{g.thru != null ? tasa(g.thru) : '—'}</b><small>ThruPlay</small></span>
                  <span className="ond-live__ir" aria-hidden><Icono id="flecha" /></span>
                </div>
              ))}
            </div>
          ) : sinDatos(guiones)}
        </section>

        {/* «Checkout funnel» → en qué parte del video se van */}
        <section className="ond-card">
          <div className="ond-card__h"><div><h2 className="ond-card__t">En qué parte se van</h2><p className="ond-card__s">De los que vieron los 3 primeros segundos</p></div></div>
          {caida ? (
            <div className="ond-fun">
              {caida.pasos.map((s, i) => (
                <div key={s.nombre} className={`ond-fun__step${i === caida.fuga ? ' ond-is-leak' : ''}`} style={{ ['--k' as string]: i }}>
                  <span className="ond-fun__l">{s.nombre}{i === caida.fuga && <small>La caída más grande</small>}</span>
                  <span className="ond-fun__track"><span className="ond-fun__bar" style={{ width: `${s.ancho * 100}%` }} /></span>
                  <span className="ond-fun__v"><b>{corto(s.valor)}</b><small>{s.tasa == null ? (i ? '—' : 'el inicio') : `${s.tasa.toFixed(1)}%`}</small></span>
                </div>
              ))}
            </div>
          ) : sinDatos(caida)}
        </section>
      </div>

      <div className="ond-ov__grid ond-ov__r3">
        {/* «Hottest leads» → el hook rate por avatar */}
        <section className="ond-card">
          <div className="ond-card__h"><div><h2 className="ond-card__t">Hook rate por avatar</h2><p className="ond-card__s">A quién le habla cada guion</p></div></div>
          {avatares && avatares.length ? (
            <div className="ond-hot">
              {avatares.map((a) => (
                <div key={a.clave} className="ond-hot__row" {...accionDe(abrir(p.avatar, a.clave))}>
                  <span className={`ond-av ond-t-${a.tono}`}>{a.iniciales}</span>
                  <span className="ond-hot__n"><b>{a.nombre}</b><small>{a.cta != null ? `${tasa(a.cta)} llegan al llamado` : 'Sin dato del llamado'}</small></span>
                  <span className="ond-hot__v"><b>{plural(a.guiones, 'guion', 'guiones')}</b>{a.bueno && <span className="ond-tag">Gancho bueno</span>}</span>
                  <span className="ond-ring">
                    <svg viewBox="0 0 36 36" aria-hidden><circle cx="18" cy="18" r={R} fill="none" stroke="var(--well)" strokeWidth="3" />
                      <circle className="ond-ring__arc" cx="18" cy="18" r={R} fill="none" stroke={a.bueno ? 'var(--good)' : 'var(--gold)'} strokeWidth="3" strokeLinecap="round" strokeDasharray={C} strokeDashoffset={C * (1 - Math.min(1, (a.hook ?? 0) / 100))} /></svg>
                    {a.hook != null ? Math.round(a.hook) : '—'}
                  </span>
                </div>
              ))}
            </div>
          ) : sinDatos(avatares)}
        </section>

        {/* «October budget» → tu gancho contra el bueno */}
        <section className="ond-card">
          <div className="ond-card__h"><div><h2 className="ond-card__t">Tu gancho</h2><p className="ond-card__s">Contra el bueno, que está en 28%</p></div></div>
          {medidor.valor != null ? (
            <>
              <Medidor parte={medidor.parte} marca={medidor.marca} />
              <div className="ond-gauge__v" data-cuenta>{tasa(medidor.valor)}</div>
              <div className="ond-gauge__s">de los que lo ven pasan los 3 segundos</div>
              <p className="ond-pace__note">La marca es el buen gancho: <b>28%</b>. Arriba, el anuncio frena el dedo.</p>
              <ul className="ond-pace">
                {medidor.filas.map((f, i) => (
                  <li key={f.nombre} className={`ond-t-${['ember', 'pine', 'steel'][i]}`}><span>{f.nombre}</span><b className={f.estado === 'arriba' ? 'ond-ok' : f.estado === 'abajo' ? 'ond-over' : ''}>{f.nota ?? '—'}</b></li>
                ))}
              </ul>
            </>
          ) : sinDatos(medidor.valor)}
        </section>

        {/* «Team activity» → lo que escribió MaKo */}
        <section className="ond-card">
          <div className="ond-card__h"><div><h2 className="ond-card__t">Qué gancho funciona</h2><p className="ond-card__s">Lo que escribió MaKo sobre esta hoja</p></div></div>
          {puntos.length ? (
            <ul className="ond-feed">
              {puntos.slice(0, 6).map((pt, i) => (
                <li key={i}><span className="ond-av ond-t-ember"><Icono id="chispa" /></span><div><p>{conNombres(pt.titulo, nombres)}</p><small>{conNombres(pt.texto, nombres)}</small></div></li>
              ))}
            </ul>
          ) : <Vacio>{caja.cargando ? 'Leyendo lo que escribió MaKo…' : quieta ? 'Aquí van las conclusiones de MaKo sobre tus ganchos.' : 'MaKo todavía no escribió sus conclusiones de esta hoja: se piden desde la grilla.'}</Vacio>}
        </section>
      </div>
      </>
      )}
    </div>
    </Compartido.Provider>
  );
}
