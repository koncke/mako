'use client';

// =============================================================================
// HojaVelocidad — la hoja «Velocidad de llamada» con su DISEÑO PROPIO: la copia de Tend («Today»), con los datos reales de MaKo
// =============================================================================
// Martín, 10/11/2026: «se inventó cosas en lugar de copiar los templates que ya estábamos copiando… Tiene una cantidad de texto
// innecesario. Tiene un montón de cosas flotando sin sentido… con urgencia rehacer este dashboard. Y que quede como los otros que
// tenemos». La copia (maqueta) y sus capturas: docs/diseno/mockups-dashboard/velocidad-tend/ (copia.html con los textos de Tend,
// velocidad.html con los de MaKo); ésta es la adaptación con los datos de verdad (lib/velocidad-diseno.ts arma lo que dibuja cada
// tarjeta, con test). Cada tarjeta es la de Tend en el mismo lugar, con su dato de MaKo:
//   · el saludo y la fecha, y arriba a la derecha «Abrir el CRM» y «Grabar llamada» (la MISMA grabadora de la ficha del lead);
//   · los cuatro números; «Patient flow» → «Flujo de leads» (entraron, esperando con «Llamar», contactados y «Sin medir»);
//   · «WhatsApp» (los chats que esperan respuesta); «Clinicians today» → «Llamadas de hoy»; «Reminders» → «Cuánto tardaron»;
//     «Visits» → «Leads por día»; «Recalls due» → «Los que más esperan» con «Llamar»; «Clinician load» → «Carga por setter»;
//     «Team activity» → «Actividad del equipo».
//
// El movimiento: el INFORME de Tend (docs/diseno/mockups-dashboard/demos/tend/INFORME.txt) trae la entrada de la cabecera (la `R` de
// su librería: el título letra por letra, el renglón de arriba y los botones) y los hover del CSS. La de las tarjetas de «Today» vive en
// su chunk, que el INFORME no muestra: no se inventa, quedan quietas. El selector «2S · 30D» corre su píldora .3 s con la curva de la hoja.
//
// ⚠️ Lo que Tend tiene y MaKo no mide no está (lib/velocidad-diseno.ts): el reloj, los recordatorios de mañana, el texto de los mensajes.
// ⚠️ Ningún texto ni pieza que Tend no tenga (AGENTS.md, «PROHIBIDO INVENTAR»): sin datos, la tarjeta queda con sus números en «—» y
//    su lista vacía, como la copia; no se explica nada.
// =============================================================================

import { createContext, useContext, useLayoutEffect, useRef, useState, type KeyboardEvent, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import dynamic from 'next/dynamic';
import Link from '@/app/_ui/Link';
import { Modal } from '@/app/_ui/Modal';
import { Parte } from './parte';
import type { Grafico, Hoja } from '@/lib/graficos-catalogo';
import { corta, DIAS_CORTO, legible, pct, type CarrilVelocidad, type DiaVelocidad, type LeadVelocidad, type VistaVelocidad } from '@/lib/velocidad-diseno';
import { ROTULO_RESULTADO, SIN_MARCAR } from '@/lib/grabar-llamada-reglas';
import { CSS_VELOCIDAD } from './velocidad-css';

const GrabarEnFrio = dynamic(() => import('@/app/_components/grabar/GrabarEnFrio').then((m) => m.GrabarEnFrio), { ssr: false });

const Compartido = createContext(false);

// Los íconos son trazos propios (los de la copia, velocidad-tend/copia.html).
const P = {
  pulse: 'M1.5 8h3l1.5-3.5 3 7 1.5-3.5h4',
  cal: 'M2.5 3.5h11v10h-11zM2.5 6.5h11M5.5 2v3M10.5 2v3',
  door: 'M4 13.5V2.5h8v11M2.5 13.5h11M9.5 8h.01',
  wa: 'M8 2.2a5.8 5.8 0 0 0-5 8.8l-.8 2.8 2.9-.8A5.8 5.8 0 1 0 8 2.2zM6 5.6c.2-.3.5-.3.7-.1l.7 1.1c.1.2 0 .5-.2.7l-.4.3c.4.8 1.1 1.5 1.9 1.9l.3-.4c.2-.2.5-.3.7-.2l1.1.7c.2.2.2.5-.1.7-.5.6-1.3.8-2 .5A6 6 0 0 1 5.6 7.6c-.3-.7-.1-1.5.4-2z',
  users: 'M6 7.5a2.3 2.3 0 1 0 0-4.6 2.3 2.3 0 0 0 0 4.6zM1.8 13.2c.4-2.2 2.1-3.4 4.2-3.4s3.8 1.2 4.2 3.4M10.6 3.1a2.2 2.2 0 0 1 0 4.2M12 9.9c1.2.4 2 1.6 2.2 3.3',
  mic: 'M8 2.5a2 2 0 0 1 2 2v3.5a2 2 0 0 1-4 0V4.5a2 2 0 0 1 2-2zM4.5 7.5a3.5 3.5 0 0 0 7 0M8 11v2.5M6 13.5h4',
  telefono: 'M5.2 2.5l1.6 3.2-1.4 1.1a8 8 0 0 0 3.8 3.8l1.1-1.4 3.2 1.6-.5 2.2c-.1.5-.5.8-1 .8A10.5 10.5 0 0 1 2.2 3.5c0-.5.3-.9.8-1z',
  expand: 'M6 10l4.5-4.5M6.5 5.5h4v4',
  hour: 'M4.5 2.5h7M4.5 13.5h7M5 2.5c0 2.5 3 3.5 3 5.5s-3 3-3 5.5M11 2.5c0 2.5-3 3.5-3 5.5s3 3 3 5.5',
  clock: 'M8 2.4a5.6 5.6 0 1 0 0 11.2A5.6 5.6 0 0 0 8 2.4zM8 5v3.2l2 1.3',
  chev: 'M6 3.5L10.5 8 6 12.5',
  bell: 'M4 11.5V7.5a4 4 0 0 1 8 0v4l1 1H3zM6.5 13.5a1.6 1.6 0 0 0 3 0',
  trend: 'M2 11.5l4-4 2.5 2.5L14 4.5M10.5 4.5H14V8',
  refresh: 'M13 8a5 5 0 1 1-1.5-3.6M13 2.5v2.5h-2.5',
  steth: 'M4 2.5v3.5a3 3 0 0 0 6 0V2.5M7 9v1.5a3 3 0 0 0 6 0V9M13 9a1.2 1.2 0 1 0 0-.01',
  tray: 'M2.5 9.5h3.2l.8 1.5h3l.8-1.5h3.2M3.5 3.5h9l1 6v4h-11v-4z',
} as const;
type IconoId = keyof typeof P;
function Icono({ id }: { id: IconoId }) {
  return <svg className="vt-i" viewBox="0 0 16 16" aria-hidden><path d={P[id]} /></svg>;
}

/** Un link de la app, o quieto si la hoja está compartida (un link compartido no tiene sesión). */
function Ir({ href, className, children, etiqueta }: { href: string; className?: string; children: ReactNode; etiqueta?: string }) {
  if (useContext(Compartido)) return <span className={`${className ?? ''} vt-quieta`} aria-label={etiqueta}>{children}</span>;
  return <Link href={href} className={className} aria-label={etiqueta}>{children}</Link>;
}
const accionDe = (fn: (() => void) | undefined) => (fn ? { role: 'button', tabIndex: 0, onClick: fn, onKeyDown: (e: KeyboardEvent) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); fn(); } } } : {});
const ent = (n: number | null | undefined) => (n == null ? '—' : Math.round(n).toLocaleString('en-US'));
const DIAS_SEMANA = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
const fechaLarga = (hoy: string) => { const d = new Date(`${hoy}T12:00:00Z`); return `${DIAS_SEMANA[d.getUTCDay()]} ${d.getUTCDate()} de ${MESES[d.getUTCMonth()]}`; };
/** Los colores de los avatares de la copia, repartidos por el nombre (siempre el mismo para la misma persona). */
const AVATARES = ['mint', 'sky', 'apricot', 'sand', 'lilac', 'teal'] as const;
const avDe = (s: string) => AVATARES[[...s].reduce((a, c) => a + c.charCodeAt(0), 0) % AVATARES.length];
/** «14:00» → «14 h»; la hora y los minutos de ahora → «9:02». */
const horaTxt = (h: number) => `${Math.floor(h)}:${String(Math.round((h % 1) * 60)).padStart(2, '0')}`;

/** El tamaño de una caja (el gráfico se dibuja a su tamaño real, como en Tend: un viewBox fijo deforma el texto). */
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

/** La entrada de la cabecera de Tend (la `R` de su librería, el INFORME): el título letra por letra, lo de arriba y los botones. */
function useEntradaCabecera(quieta: boolean) {
  const ref = useRef<HTMLElement>(null);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el || quieta || typeof el.animate !== 'function' || matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const P4 = 'cubic-bezier(.165, .84, .44, 1)', P3 = 'cubic-bezier(.215, .61, .355, 1)';
    el.querySelectorAll<HTMLElement>('.vt-ch').forEach((s, i) => s.animate([{ transform: 'translateY(115%) rotate(6deg)' }, { transform: 'none' }], { duration: 850, delay: i * 22, easing: P4, fill: 'backwards' }));
    el.querySelectorAll<HTMLElement>('.vt-head__eyebrow').forEach((s) => s.animate([{ opacity: 0, transform: 'translateY(8px)' }, { opacity: 1, transform: 'none' }], { duration: 550, easing: P3, fill: 'backwards' }));
    el.querySelectorAll<HTMLElement>('.vt-head__actions > *').forEach((s, i) => s.animate([{ opacity: 0, transform: 'translateY(14px)' }, { opacity: 1, transform: 'none' }], { duration: 550, delay: 120 + i * 70, easing: P3, fill: 'backwards' }));
  }, [quieta]);
  return ref;
}

/** Una curva suave por los puntos (Catmull-Rom → Bézier), la de la copia. */
const curva = (pts: Array<[number, number]>) => pts.map((p, i) => {
  if (!i) return `M${p[0].toFixed(1)},${p[1].toFixed(1)}`;
  const a = pts[i - 2] ?? pts[i - 1], b = pts[i - 1], d = pts[i + 1] ?? p;
  return `C${(b[0] + (p[0] - a[0]) / 6).toFixed(1)},${(b[1] + (p[1] - a[1]) / 6).toFixed(1)} ${(p[0] - (d[0] - b[0]) / 6).toFixed(1)},${(p[1] - (d[1] - b[1]) / 6).toFixed(1)} ${p[0].toFixed(1)},${p[1].toFixed(1)}`;
}).join('');

// ── «Visits» → leads por día ─────────────────────────────────────────────────────────────────────────────────────────────
function Curva({ dias }: { dias: DiaVelocidad[] }) {
  const [ref, { w, h }] = useTam<HTMLDivElement>();
  if (w < 120 || dias.length < 2) return <div className="vt-td-chart" ref={ref} />;
  const H = Math.max(150, h), x0 = 34, x1 = w - 6, y0 = 8, y1 = H - 26;
  const max = Math.max(1, ...dias.map((d) => Math.max(d.contactados, d.sinContactar)));
  const PASOS = [2, 4, 10, 20, 40, 50, 100, 200, 500, 1000, 2000, 5000];
  const tope = PASOS.find((p) => p >= max) ?? Math.ceil(max);
  const px = (i: number) => x0 + 4 + ((x1 - x0 - 8) * i) / (dias.length - 1);
  const py = (v: number) => y1 - ((y1 - y0) * v) / tope;
  const a = curva(dias.map((d, i) => [px(i), py(d.contactados)]));
  const b = curva(dias.map((d, i) => [px(i), py(d.sinContactar)]));
  const cada = Math.max(1, Math.ceil(dias.length / (w < 420 ? 4 : 12)));
  return (
    <div className="vt-td-chart" ref={ref}>
      <svg viewBox={`0 0 ${w} ${H}`} role="img" aria-label="Contactados y sin contactar, día por día">
        <defs><linearGradient id="vt-area" x1="0" x2="0" y1="0" y2="1"><stop offset="0" stopColor="var(--teal)" stopOpacity=".22" /><stop offset="1" stopColor="var(--teal)" stopOpacity="0" /></linearGradient></defs>
        {[0, 0.5, 1].map((k) => { const y = y1 - (y1 - y0) * k; return <g key={k}><line className="vt-grid-l" x1={x0} x2={x1} y1={y} y2={y} /><text x={x0 - 10} y={y + 4} textAnchor="end">{Math.round(tope * k)}</text></g>; })}
        <path d={`${a}L${px(dias.length - 1)},${y1}L${px(0)},${y1}Z`} fill="url(#vt-area)" />
        <path d={a} fill="none" stroke="var(--teal)" strokeWidth="2.2" strokeLinecap="round" />
        <path d={b} fill="none" stroke="var(--coral)" strokeWidth="2" strokeLinecap="round" />
        {dias.map((d, i) => {
          const ult = i === dias.length - 1;
          if (!ult && (i % cada || dias.length - 1 - i < cada / 2)) return null;
          return <text key={d.clave} x={px(i)} y={H - 4} textAnchor={i === 0 ? 'start' : ult ? 'end' : 'middle'}>{d.rotulo}</text>;
        })}
      </svg>
    </div>
  );
}

/** El selector de Tend: la píldora corre a la opción elegida (.3 s, la curva de la hoja); la primera vez se pone sin moverse. */
function Selector<T extends string>({ opciones, valor, onCambio, etiqueta }: { opciones: ReadonlyArray<{ id: T; nombre: string }>; valor: T; onCambio: (v: T) => void; etiqueta: string }) {
  const caja = useRef<HTMLDivElement>(null), pill = useRef<HTMLSpanElement>(null), puesta = useRef(false);
  useLayoutEffect(() => {
    const c = caja.current, pl = pill.current, on = c?.querySelector<HTMLElement>('[aria-pressed="true"]');
    if (!c || !pl || !on) return;
    if (!puesta.current) pl.style.transition = 'none';
    pl.style.width = `${on.offsetWidth}px`; pl.style.translate = `${on.offsetLeft}px 0`;
    if (!puesta.current) { void pl.offsetWidth; pl.style.transition = ''; puesta.current = true; }
  });
  return (
    <div className="vt-td-seg" ref={caja} role="group" aria-label={etiqueta}>
      <span className="vt-td-seg__pill" ref={pill} />
      {opciones.map((o) => <button key={o.id} type="button" aria-pressed={o.id === valor} onClick={() => onCambio(o.id)}>{o.nombre}</button>)}
    </div>
  );
}

// ── «Clinicians today» → las llamadas de hoy ─────────────────────────────────────────────────────────────────────────────
function Linea({ linea, ahora, onLead }: { linea: NonNullable<VistaVelocidad['linea']>; ahora: number | null; onLead: (lead: string) => (() => void) | undefined }) {
  const [ref, { w }] = useTam<HTMLDivElement>();
  // En una tarjeta angosta (el teléfono de la copia) la línea muestra una ventana de unas 2 h 40 min alrededor de ahora.
  const angosta = w > 0 && w < 520 && ahora != null;
  const desde = angosta ? Math.max(linea.desde, Math.floor(ahora - 1) + 0.75) : linea.desde;
  const hasta = angosta ? desde + 2.65 : linea.hasta;
  const pos = (h: number) => `${((h - desde) / (hasta - desde)) * 100}%`;
  const horas: number[] = [];
  for (let h = Math.ceil(desde); h <= Math.floor(hasta); h += angosta ? 2 : 1) horas.push(h);
  const hay = new Set(linea.filas.flatMap((f) => f.bloques.map((b) => b.resultado ?? SIN_MARCAR)));
  const LEYENDA: ReadonlyArray<[string, string]> = [
    [ROTULO_RESULTADO.agendo, 'teal'], [ROTULO_RESULTADO.hablo, 'mint'], [ROTULO_RESULTADO.no_contesto, 'sky'], [ROTULO_RESULTADO.no_interesa, 'coral'], [SIN_MARCAR, 'sand'],
  ];
  return (
    <div className="vt-td-tl" ref={ref}>
      <div className="vt-td-tl__hours">{horas.map((h) => <span key={h} style={{ left: pos(h) }}>{h}</span>)}</div>
      <div className="vt-td-tl__names" style={{ gridColumn: 1, gridRow: 2 }}>
        {linea.filas.map((f) => <div key={f.quien} className="vt-td-tl__who"><span className={`vt-av vt-av--${avDe(f.quien)}`}>{f.iniciales}</span><span><b>{f.quien}</b><small title={f.llamadas ? `${pct((f.contestaron / f.llamadas) * 100)} contestan` : undefined}>{f.llamadas === 1 ? '1 llamada' : `${f.llamadas} llamadas`}</small></span></div>)}
      </div>
      <div className="vt-td-tl__body" style={{ gridRow: 2 }}>
        {linea.filas.map((f) => (
          <div key={f.quien} className="vt-td-tl__track">
            {f.bloques.filter((b) => b.desde + b.dura > desde && b.desde < hasta).map((b, i) => {
              const ini = Math.max(b.desde, desde), fin = Math.min(b.desde + b.dura, hasta);
              return (
                <span key={`${b.lead}-${i}`} className={`vt-td-blk vt-td-blk--${b.color}`} style={{ left: pos(ini), width: `calc(${((fin - ini) / (hasta - desde)) * 100}% - 2px)` }}
                  title={`${b.nombre} · ${b.hora} h${b.resultado ? ` · ${b.resultado}` : ''}`} {...accionDe(onLead(b.lead))} />
              );
            })}
          </div>
        ))}
        {ahora != null && ahora >= desde && ahora <= hasta && <div className="vt-td-tl__now" style={{ left: pos(ahora) }}><b>{horaTxt(ahora)}</b></div>}
      </div>
      <div className="vt-td-legend">{LEYENDA.filter(([k]) => hay.has(k)).map(([k, c]) => <span key={k} style={{ ['--c' as string]: `var(--${c})` }}><i />{k}</span>)}</div>
    </div>
  );
}

/** Una tarjeta de un carril de «Flujo de leads». */
function Tarjeta({ c, l, onAbrir, onLlamar }: { c: CarrilVelocidad['id']; l: LeadVelocidad; onAbrir?: () => void; onLlamar?: () => void }) {
  const clase = c === 'entraron' ? 'upcoming' : c === 'esperando' ? 'arrived' : c === 'contactados' ? 'in-consult' : 'done';
  // «9:20 AM · Dr. Silva» → cuándo entró · quién lo tiene (o su funnel): en «Entraron», hace cuánto (es menos de una hora); en los
  // demás, el día; y en el último carril, primero por qué no se mide (ya hablaban antes, o no se sabe).
  const cuando = c === 'entraron' ? (l.minutos != null ? `hace ${corta(l.minutos)}` : null) : l.dia;
  const meta = (c === 'otros' ? [l.tramo, cuando, l.quien] : [cuando, l.quien]).filter(Boolean).join(' · ');
  const llamar = (estilo: 'soft' | 'primary') => onLlamar
    ? <button type="button" className={`vt-btn vt-btn--xs vt-btn--${estilo}`} onClick={onLlamar}><Icono id="telefono" />Llamar</button>
    : <span className={`vt-btn vt-btn--xs vt-btn--${estilo} vt-quieta`}><Icono id="telefono" />Llamar</span>;
  return (
    <article className={`vt-td-card vt-td-card--${clase}`}>
      {onAbrir && <button type="button" className="vt-td-card__open" aria-label={l.nombre} onClick={onAbrir} />}
      <div className="vt-td-card__who"><span className={`vt-av vt-av--${avDe(l.nombre)}`}>{l.iniciales}</span><span><b className="vt-td-card__name">{l.nombre}</b><span className="vt-td-card__meta"><i /><span>{meta || '—'}</span></span></span></div>
      {/* El ícono solo, como el ✓ de «Expected» en la copia: el tiempo va en el renglón de arriba. */}
      {c === 'entraron' && <div className="vt-td-card__foot"><span className="vt-td-ok" aria-hidden><Icono id="hour" /></span>{llamar('soft')}</div>}
      {c === 'esperando' && <div className="vt-td-card__foot"><span className="vt-td-wait" title={legible(l.minutos) ?? undefined}><Icono id="clock" />{corta(l.minutos) ?? '—'}</span>{llamar('primary')}</div>}
      {c === 'contactados' && <div className="vt-td-card__foot"><span className="vt-td-room"><span>{[l.canal, corta(l.minutos)].filter(Boolean).join(' · ') || '—'}</span></span></div>}
    </article>
  );
}

export function HojaVelocidad({ hoja, vista, saludo, negocio, hoy, periodo, ahora = null, onFila, onCambio, compartido = false, quieta = false }: {
  hoja: Hoja;
  vista: VistaVelocidad;
  /** «Buenos días, Ana» (sin quien mira, el nombre de la hoja). */
  saludo: string;
  /** El nombre del negocio, para la fecha de arriba. */
  negocio: string | null;
  /** Hoy en el negocio (YYYY-MM-DD). */
  hoy: string;
  /** El período de la hoja, como se lee en su control («Últimos 30 días»). */
  periodo: string;
  /** La hora de ahora (9.03 = 9:02), en la misma zona que las horas de las llamadas: la raya roja de «Llamadas de hoy». */
  ahora?: number | null;
  /** Abrir una fila de una pieza: su detalle de siempre (la ficha del lead). */
  onFila?: (g: Grafico, clave: string) => void;
  /** Se grabó una llamada: la hoja vuelve a pedir sus números. */
  onCambio?: () => void;
  compartido?: boolean;
  /** La miniatura de «Nueva hoja»: sin nada que se toque ni se mueva. */
  quieta?: boolean;
}) {
  const v = vista;
  const p = hoja.diseno?.piezas ?? {};
  const pieza = (id: string | undefined) => hoja.componentes.find((c): c is Grafico => c.id === id && c.clase === 'grafico');
  const abrir = (id: string | undefined, clave: string) => { const g = pieza(id); return g && onFila && !quieta && !compartido ? () => onFila(g, clave) : undefined; };
  const [rango, setRango] = useState<'corto' | 'todo'>('corto');
  const [grabando, setGrabando] = useState<{ id: number; nombre: string } | null | false>(false);
  const puedeGrabar = !compartido && !quieta;
  const llamar = (l: { ref: string | null; nombre: string }) => (puedeGrabar ? () => setGrabando(l.ref && Number.isFinite(Number(l.ref)) ? { id: Number(l.ref), nombre: l.nombre } : null) : undefined);
  const cabecera = useEntradaCabecera(quieta);

  const r = v.resumen;
  const esperandoN = r.sinContactar ?? 0;
  const dias = v.dias ? (rango === 'corto' ? v.dias.slice(-DIAS_CORTO) : v.dias) : [];
  const contactadosDias = dias.reduce((a, d) => a + d.contactados, 0), sinDias = dias.reduce((a, d) => a + d.sinContactar, 0);
  const PIEZA_CARRIL: Record<CarrilVelocidad['id'], string | undefined> = { entraron: p.recien, esperando: p.recien, contactados: p.contactados, otros: p.antes };

  return (
    <Compartido.Provider value={compartido}>
    <div className="vt" data-quieta={quieta ? '' : undefined}>
      <style href="dash-hoja-velocidad" precedence="medium">{CSS_VELOCIDAD}</style>
      <div className="vt-cuerpo">
      <Parte id="cabecera">
      <header className="vt-head" ref={cabecera}>
        <div>
          <p className="vt-head__eyebrow">{fechaLarga(hoy)}{negocio ? ` · ${negocio}` : ''}</p>
          {/* Letra por letra (la entrada de Tend), con cada palabra entera en su caja: si no entra, baja entre palabras («Buenos días, An a» no). */}
          <h1 className="vt-head__title" aria-label={saludo}>{saludo.split(' ').map((pal, k) => (
            <span key={k}>{k ? ' ' : ''}<span className="vt-pal" aria-hidden>{[...pal].map((ch, i) => <span key={i} className="vt-ch">{ch}</span>)}</span></span>
          ))}</h1>
        </div>
        <div className="vt-head__actions">
          <Ir href="/crm" className="vt-btn vt-btn--ghost"><Icono id="users" />Abrir el CRM</Ir>
          {puedeGrabar
            ? <button type="button" className="vt-btn vt-btn--wa" onClick={() => setGrabando(null)}><Icono id="mic" />Grabar llamada{esperandoN ? ` · ${ent(esperandoN)}` : ''}</button>
            : <span className="vt-btn vt-btn--wa vt-quieta"><Icono id="mic" />Grabar llamada{esperandoN ? ` · ${ent(esperandoN)}` : ''}</span>}
        </div>
      </header>
      </Parte>

      <Parte id="numeros">
      <div className="vt-stats">
        {v.numeros.map((n) => (
          <div key={n.id} className="vt-stat">
            <div className="vt-stat__top"><span className="vt-stat__ico"><Icono id={n.icono} /></span><span className="vt-stat__l">{n.nombre}</span></div>
            <div className="vt-stat__v"><b className={n.texto == null ? 'vt-sin' : undefined}>{n.texto ?? '—'}</b>{n.pill && <span className={`vt-pill${n.bueno ? ' vt-pill--good' : ''}`}>{n.pill}</span>}</div>
          </div>
        ))}
      </div>
      </Parte>

      <div className="vt-grid">
        {/* «Patient flow» → los leads por cómo va su primer contacto */}
        <Parte id="flujo">
        <section className="vt-card vt-td-flow">
          <div className="vt-card__h">
            <h2 className="vt-card__t"><Icono id="pulse" />Flujo de leads</h2>
            <span className="vt-card__aside">{ent(r.esperando)} esperando · {ent(r.contactados)} contactados</span>
            <Ir href="/crm" className="vt-ibtn" etiqueta="Abrir el CRM"><Icono id="expand" /></Ir>
          </div>
          <div className="vt-td-lanes">
            {v.carriles.map((c) => (
              <section key={c.id} className={`vt-td-lane vt-td-lane--${c.id === 'entraron' ? 'upcoming' : c.id === 'esperando' ? 'arrived' : c.id === 'contactados' ? 'in-consult' : 'done'}`}>
                <div className="vt-td-lane__h"><i className="vt-td-lane__dot" />{c.nombre}<span className="vt-td-lane__n">{ent(c.n)}</span></div>
                {c.leads.map((l) => <Tarjeta key={l.clave} c={c.id} l={l} onAbrir={abrir(PIEZA_CARRIL[c.id], l.clave)} onLlamar={c.id === 'entraron' || c.id === 'esperando' ? llamar(l) : undefined} />)}
                {c.mas > 0 && <Ir href="/crm" className="vt-td-more">+{ent(c.mas)} más</Ir>}
              </section>
            ))}
          </div>
        </section>
        </Parte>

        {/* «WhatsApp · waiting on us» → los chats que esperan respuesta */}
        <Parte id="chats">
        <section className="vt-card vt-td-inbox">
          <div className="vt-card__h"><h2 className="vt-card__t"><Icono id="wa" />WhatsApp</h2>{v.chats && <span className="vt-card__aside">{ent(v.chats.total)} esperan respuesta</span>}</div>
          <div className="vt-td-chats">
            {(v.chats?.filas ?? []).map((c) => (
              <div key={c.clave} className={`vt-td-chat vt-is-unread${c.urgente ? ' vt-is-urgent' : ''}`} {...accionDe(abrir(p.chats, c.clave))}>
                <span className={`vt-av vt-av--${avDe(c.nombre)}`}>{c.iniciales}</span>
                <span className="vt-td-chat__body">
                  <span className="vt-td-chat__row"><b className="vt-td-chat__name">{c.nombre}</b><span className="vt-td-chat__time">hace {corta(c.minutos)}</span></span>
                  <span className="vt-td-chat__row"><span className="vt-td-chat__msg">{c.etapa ?? '—'}</span></span>
                  {c.urgente && <span className="vt-td-tag">Urgente</span>}
                </span>
              </div>
            ))}
          </div>
          <Ir href="/chats" className="vt-btn vt-btn--soft vt-td-inbox__all">Abrir los chats <Icono id="chev" /></Ir>
        </section>
        </Parte>

        {/* «Reminders · Tomorrow» → cuánto tardaron los contactados */}
        <Parte id="tardaron">
        <section className="vt-card vt-td-rem">
          <div className="vt-card__h"><h2 className="vt-card__t"><Icono id="bell" />Cuánto tardaron</h2></div>
          <p className="vt-td-big"><b className={r.contactados == null ? 'vt-sin' : undefined}>{ent(r.contactados)}</b><span>leads contactados</span></p>
          {(v.tramos?.filas ?? []).map((t) => (
            <div key={t.clave} className="vt-td-meter" {...accionDe(abrir(p.tramos, t.clave))}>
              <span>{t.rotulo}</span>
              <span className="vt-td-meter__track"><i style={{ width: `${v.tramos!.total ? (t.valor / v.tramos!.total) * 100 : 0}%`, ['--c' as string]: `var(--${t.color})` }} /></span>
              <b>{ent(t.valor)}</b>
            </div>
          ))}
          <div className="vt-td-rem__foot"><small>{ent(r.sinContactar)} sin contactar</small></div>
        </section>
        </Parte>

        {/* «Clinicians today» → las llamadas de hoy, por quién llama */}
        <Parte id="llamadas">
        <section className="vt-card vt-td-line">
          <div className="vt-card__h"><h2 className="vt-card__t"><Icono id="cal" />Llamadas de hoy</h2><Ir href="/crm" className="vt-ibtn" etiqueta="Abrir el CRM"><Icono id="expand" /></Ir></div>
          {v.linea ? <Linea linea={v.linea} ahora={quieta ? null : ahora} onLead={(lead) => abrir(p.hoy, lead)} /> : null}
        </section>
        </Parte>

        {/* «Visits» → contactados y sin contactar, día por día */}
        <Parte id="dias">
        <section className="vt-card vt-td-trend">
          <div className="vt-card__h">
            <h2 className="vt-card__t"><Icono id="trend" />Leads por día</h2>
            <Selector opciones={[{ id: 'corto', nombre: '2S' }, { id: 'todo', nombre: '30D' }] as const} valor={rango} onCambio={setRango} etiqueta="Cuántos días" />
            <Ir href="/crm" className="vt-ibtn" etiqueta="Abrir el CRM"><Icono id="expand" /></Ir>
          </div>
          <p className="vt-td-trend__big"><b>{v.dias ? ent(contactadosDias) : '—'}</b><span>contactados {rango === 'corto' ? `en los últimos ${DIAS_CORTO} días` : periodo.trim().toLowerCase()}{contactadosDias + sinDias ? ` · ${pct((sinDias / (contactadosDias + sinDias)) * 100)} sin contactar` : ''}</span></p>
          <div className="vt-td-keys"><span style={{ ['--c' as string]: 'var(--teal)' }}><i />Contactados</span><span style={{ ['--c' as string]: 'var(--coral)' }}><i />Sin contactar</span></div>
          <Curva dias={dias} />
        </section>
        </Parte>

        {/* «Recalls due» → los que más esperan, con «Llamar» */}
        <Parte id="esperan">
        <section className="vt-card vt-td-recall">
          <div className="vt-card__h"><h2 className="vt-card__t"><Icono id="refresh" />Los que más esperan</h2><span className="vt-card__aside">{ent(r.sinContactar)} sin contactar</span><Ir href="/crm" className="vt-ibtn" etiqueta="Abrir el CRM"><Icono id="expand" /></Ir></div>
          <div className="vt-td-rows">
            {(v.esperan ?? []).map((l) => {
              const fn = llamar(l);
              return (
                <div key={l.clave} className="vt-td-row">
                  <span className={`vt-av vt-av--${avDe(l.nombre)}`}>{l.iniciales}</span>
                  <span className="vt-td-row__txt" {...accionDe(abrir(p.esperan, l.clave))}><b>{l.nombre}</b><small>{l.quien ? `${l.quien} · ` : ''}<em>{corta(l.minutos) ?? '—'} esperando</em></small></span>
                  {fn ? <button type="button" className="vt-btn vt-btn--xs vt-btn--soft" onClick={fn}><Icono id="telefono" />Llamar</button> : <span className="vt-btn vt-btn--xs vt-btn--soft vt-quieta"><Icono id="telefono" />Llamar</span>}
                </div>
              );
            })}
          </div>
        </section>
        </Parte>

        {/* «Clinician load» → la carga de cada setter */}
        <Parte id="carga">
        <section className="vt-card vt-td-docs">
          <div className="vt-card__h"><h2 className="vt-card__t"><Icono id="steth" />Carga por setter</h2></div>
          <div className="vt-td-load">
            {(v.carga ?? []).map((c) => (
              <div key={c.clave} className="vt-td-load__row" {...accionDe(abrir(p.carga, c.clave))}>
                <span className={`vt-av vt-av--${avDe(c.nombre)}`}>{c.iniciales}</span>
                <span className="vt-td-load__txt">
                  <span className="vt-td-load__top"><b>{c.nombre}</b>{c.sinContactar > 0 && <span>{ent(c.sinContactar)} esperando</span>}</span>
                  <span className="vt-td-load__bar"><i style={{ width: `${c.ancho * 100}%` }} /></span>
                  <small>{pct(c.ancho * 100)} contactados · {c.mediana != null ? `mediana ${corta(c.mediana)}` : `${ent(c.leads)} leads`}</small>
                </span>
              </div>
            ))}
          </div>
        </section>
        </Parte>

        {/* «Team activity» → las llamadas de hoy, de la más tarde a la más temprano */}
        <Parte id="actividad">
        <section className="vt-card vt-td-act">
          <div className="vt-card__h"><h2 className="vt-card__t"><Icono id="tray" />Actividad del equipo</h2></div>
          <ul className="vt-td-feed">
            {(v.actividad ?? []).map((a, i) => (
              <li key={`${a.lead}-${i}`} {...accionDe(abrir(p.hoy, a.lead))}>
                <span className="vt-td-feed__ic"><Icono id="telefono" /></span>
                <p><b>{a.quien ?? 'Alguien'}</b> llamó a {a.nombre}{a.resultado && a.resultado !== SIN_MARCAR ? ` · ${a.resultado}` : ''}<small>hoy, {a.hora} h</small></p>
              </li>
            ))}
          </ul>
        </section>
        </Parte>
      </div>
      </div>
      {grabando !== false && typeof document !== 'undefined' && createPortal(
        <Modal titulo="Grabar llamada" anidada onCerrar={() => { setGrabando(false); onCambio?.(); }} ancho={520}>
          <GrabarEnFrio inicial={grabando} />
        </Modal>,
        document.body,
      )}
    </div>
    </Compartido.Provider>
  );
}

