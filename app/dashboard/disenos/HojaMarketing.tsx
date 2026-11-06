'use client';

// =============================================================================
// HojaMarketing — la hoja Marketing con su DISEÑO PROPIO: la copia de Kestrel, con los datos reales de MaKo
// =============================================================================
// Martín, 4/11/2026: «que sea primero la copia, es decir, que se vea exactamente igual que la copia, y después la adaptación con
// Maco... copiarlo todo, desde las animaciones de entrada, las animaciones de hover, las animaciones de clic». La copia y la
// adaptación (maquetas) están en docs/diseno/mockups-dashboard/marketing-kestrel/; ésta es la adaptación con los datos de verdad
// (lib/marketing-diseno.ts arma lo que dibuja cada bloque, con test). La pregunta: «¿cuánto cuesta una agenda y de qué anuncio vino?».
//
// El movimiento sale del INFORME de Kestrel (docs/diseno/mockups-dashboard/demos/kestrel/INFORME.txt), que esta vez trae la entrada
// de la página: el encabezado y las tarjetas suben (y 22, escala .985, .85 s, cada .07 s); los números cuentan desde cero (1,1 s,
// power3.out); las líneas se dibujan (1,4 s, desde .1 s + .12 s por línea) y su punto y su número aparecen (1 s, desde .6 s + .12 s);
// la tinta de las pestañas corre (.45 s) y las filas entran de a una (y 6, .4 s, cada .02 s). Lo que el INFORME no dice y se supone
// (anotado en el relevo): la demora de cada número al contar (la de su tarjeta) y la del anillo (la del medidor: 1,1 s desde .2 s).
//
// ⚠️ Mirando se dibuja esto; editando, la grilla con los mismos componentes (app/dashboard/EditorInforme.tsx).
// ⚠️ Lo que Kestrel tiene y MaKo no hace no está: el «Live», la calidad del lead, las búsquedas y palabras clave, los seguidores
//    y el menú de cada tarjeta. En su lugar, un link al Ads Manager.
// =============================================================================

import { createContext, useContext, useEffect, useLayoutEffect, useRef, useState, type CSSProperties, type KeyboardEvent, type PointerEvent, type ReactNode } from 'react';
import Link from '@/app/_ui/Link';
import type { Grafico, Hoja } from '@/lib/graficos-catalogo';
import { entero, plata, plataEntera, type FilaCosto, type Pestana, type Tendencias, type VistaMarketing } from '@/lib/marketing-diseno';
import { CSS_MARKETING } from './marketing-css';
import { Parte } from './parte';

const Compartido = createContext(false);

const P = {
  cal: 'M4 5.5h16v14H4zM4 10h16M8 3.5v4M16 3.5v4',
  grid: 'M4.5 4.5h6v6h-6zM13.5 4.5h6v6h-6zM4.5 13.5h6v6h-6zM13.5 13.5h6v6h-6z',
  out: 'M14 5h5v5M19 5l-8 8M18 14v5H5V6h5',
  aup: 'M12 19V5M6 11l6-6 6 6',
  adown: 'M12 5v14M6 13l6 6 6-6',
  table: 'M4 5h16v14H4zM4 10h16M4 14.5h16M10 10v9',
  warn: 'M12 4.5l8.5 15h-17zM12 10v4.5M12 17.2v.1',
  check: 'M5 12.5l4.5 4.5L19 7.5',
  dash: 'M6 12h12',
  down: 'M7 9.5l5 5 5-5',
  ads: 'M4.5 10v4h3l7 4V6l-7 4zM18 9.5c1 1.4 1 3.6 0 5',
  net: 'M7 9.5a2.5 2.5 0 1 0 0 5a2.5 2.5 0 1 0 0-5M17 4a2.5 2.5 0 1 0 0 5a2.5 2.5 0 1 0 0-5M17 15a2.5 2.5 0 1 0 0 5a2.5 2.5 0 1 0 0-5M9.2 10.8l5.6-3.1M9.2 13.2l5.6 3.1',
} as const;
function Icono({ id, className, style }: { id: keyof typeof P; className?: string; style?: CSSProperties }) {
  return <svg className={`kt-i${className ? ` ${className}` : ''}`} style={style} viewBox="0 0 24 24" aria-hidden><path d={P[id]} /></svg>;
}

/** Un link de la app, o un texto si la hoja está compartida (un link compartido no tiene sesión). */
function Ir({ href, className, children, label }: { href: string; className?: string; children: ReactNode; label?: string }) {
  if (useContext(Compartido)) return null;
  return <Link href={href} className={className} aria-label={label}>{children}</Link>;
}

function useCaja<T extends HTMLElement>() {
  const ref = useRef<T>(null);
  const [tam, setTam] = useState({ w: 0, h: 0 });
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const medir = () => setTam((t) => (t.w === el.clientWidth && t.h === el.clientHeight ? t : { w: el.clientWidth, h: el.clientHeight }));
    medir();
    const ro = new ResizeObserver(medir);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  return [ref, tam] as const;
}

const W = 'cubic-bezier(.22, 1, .36, 1)', P3 = 'cubic-bezier(.215, .61, .355, 1)', P2IO = 'cubic-bezier(.455, .03, .515, .955)', P2IN = 'cubic-bezier(.55, .085, .68, .53)';
const sinMovimiento = () => typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
const COLOR = { s1: 'var(--s1)', s2: 'var(--s2)', s3: 'var(--s3)' } as const;
const conSigno = (v: number) => `${v > 0 ? '+' : v < 0 ? '−' : ''}${Math.abs(Math.round(v * 10) / 10).toFixed(1)}%`;

/** Un número que cuenta desde cero: lee el texto ya formateado («US$2,460», «3.4×») y lo recorre con su formato. */
function contar(n: HTMLElement, demora: number) {
  const fin = n.textContent ?? '';
  const m = fin.match(/^(\D*?)(\d[\d,]*(?:\.\d+)?)(.*)$/);
  if (!m) return;
  const [, pre, cifra, suf] = m, dec = cifra.includes('.') ? cifra.split('.')[1].length : 0, valor = Number(cifra.replace(/,/g, ''));
  const fmt = (v: number) => `${pre}${v.toLocaleString('en-US', { minimumFractionDigits: dec, maximumFractionDigits: dec })}${suf}`;
  const t0 = performance.now() + demora, dur = 1100;
  n.textContent = fmt(0);
  const paso = (ahora: number) => {
    if (!n.isConnected) return;
    const t = Math.min(1, Math.max(0, (ahora - t0) / dur));
    n.textContent = t < 1 ? fmt(valor * (1 - Math.pow(1 - t, 3))) : fin;
    if (t < 1) requestAnimationFrame(paso);
  };
  requestAnimationFrame(paso);
}

// ── Trends ─────────────────────────────────────────────────────────────────────────────────────────────────────
function Tendencia({ t, quieta, demora }: { t: Tendencias; quieta: boolean; demora: number }) {
  const [ref, { w, h }] = useCaja<HTMLDivElement>();
  const [i, setI] = useState<number | null>(null);
  const dibujado = useRef(false);
  const svg = useRef<SVGSVGElement>(null);
  const n = t.x.length, izq = 44, der = Math.max(izq + 10, w - 62), arriba = 21, abajo = Math.max(arriba + 10, h - 29);
  const x = (k: number) => izq + (der - izq) * (n > 1 ? k / (n - 1) : 0.5);
  const y = (v: number) => arriba + (abajo - arriba) * (1 - (v + t.tope) / (2 * t.tope));
  const desde = t.ventana - 1;
  const camino = (pct: Array<number | null>) => pct.map((v, k) => (v == null ? '' : `${k === desde ? 'M' : 'L'}${x(k).toFixed(1)},${y(v).toFixed(1)}`)).join(' ');
  // Los rótulos de abajo: cuatro, repartidos (los meses de Kestrel; acá el período es de días); tres si el gráfico es angosto.
  const fr = der - izq < 360 ? [0.1, 0.5, 0.9] : [0.08, 0.36, 0.64, 0.92];
  const marcas = n > 1 ? [...new Set(fr.map((f) => Math.round(desde + (n - 1 - desde) * f)))] : [];
  // El número del final de cada línea: separados 14 px como mínimo, para que dos parecidos no se pisen (el punto queda en su lugar).
  const rotuloY = new Map<string, number>();
  [...t.series].filter((s) => s.fin != null).sort((a, b) => y(a.fin!) - y(b.fin!)).forEach((s, k, arr) => {
    const previo = k ? rotuloY.get(arr[k - 1].id)! : -Infinity;
    rotuloY.set(s.id, Math.max(y(s.fin!), previo + 14));
  });

  useLayoutEffect(() => {
    const s = svg.current;
    if (!s || !w || dibujado.current || quieta || !t.series.length) return;
    dibujado.current = true;
    if (sinMovimiento()) return;
    s.querySelectorAll<SVGPathElement>('.kt-ln').forEach((p, k) => {
      const L = p.getTotalLength();
      p.style.strokeDasharray = `${L}`;
      const a = p.animate([{ strokeDashoffset: L }, { strokeDashoffset: 0 }], { duration: 1400, delay: demora + 100 + k * 120, easing: P2IO, fill: 'both' });
      a.onfinish = () => { a.cancel(); p.style.strokeDasharray = ''; };
    });
    s.querySelectorAll<SVGGElement>('.kt-fin').forEach((g, k) => g.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 1000, delay: demora + 600 + k * 120, fill: 'backwards' }));
  }, [w, quieta, t.series.length, demora]);

  const mover = (e: PointerEvent<SVGRectElement>) => {
    const r = (e.currentTarget.ownerSVGElement ?? e.currentTarget).getBoundingClientRect();
    const k = Math.round(((e.clientX - r.left - izq) / (der - izq)) * (n - 1));
    setI(Math.max(desde, Math.min(n - 1, k)));
  };
  return (
    <div className="kt-chart__plot" ref={ref}>
      {w > 0 && (
        <svg ref={svg} viewBox={`0 0 ${w} ${h}`} role="img" aria-label={`Cómo se movieron ${t.series.map((s) => `${s.nombre} ${s.fin != null ? conSigno(s.fin) : ''}`).join(', ')}`}>
          {[t.tope, t.tope / 2, 0, -t.tope / 2, -t.tope].map((v) => (
            <g key={v}>
              <line className={`kt-gl${v === -t.tope ? ' kt-gl0' : ''}`} x1={izq} x2={der} y1={y(v)} y2={y(v)} />
              <text className="kt-yl" x={36} y={y(v) + 4} textAnchor="end">{v === 0 ? '0%' : `${v > 0 ? '+' : '−'}${Math.abs(v)}%`}</text>
            </g>
          ))}
          {marcas.map((k) => (
            <g key={k}>
              <line className="kt-xt" x1={x(k)} x2={x(k)} y1={abajo} y2={abajo + 5} />
              <text className="kt-xl" x={x(k)} y={abajo + 22} textAnchor="middle">{t.x[k].rotulo}</text>
            </g>
          ))}
          {t.series.map((s) => <path key={s.id} className="kt-ln" stroke={COLOR[s.color]} d={camino(s.pct)} />)}
          {t.series.map((s) => (s.fin == null ? null : (
            <g key={s.id} className="kt-fin">
              <circle cx={x(n - 1)} cy={y(s.fin)} r={3.5} fill={COLOR[s.color]} />
              <text className="kt-end" x={x(n - 1) + 10} y={(rotuloY.get(s.id) ?? y(s.fin)) + 4}>{conSigno(s.fin)}</text>
            </g>
          )))}
          {i != null && (
            <g>
              <line className="kt-cross" x1={x(i)} x2={x(i)} y1={arriba} y2={abajo} />
              {t.series.map((s) => (s.pct[i] == null ? null : <circle key={s.id} cx={x(i)} cy={y(s.pct[i]!)} r={4} fill={COLOR[s.color]} style={{ stroke: 'var(--card)' }} strokeWidth={2} />))}
            </g>
          )}
          {!quieta && <rect x={izq} y={0} width={der - izq} height={h} fill="transparent" onPointerMove={mover} onPointerLeave={() => setI(null)} />}
        </svg>
      )}
      {i != null && (
        <div className="kt-chart__tip" style={{ left: x(i), top: Math.min(...t.series.map((s) => y(s.pct[i] ?? 0))) }}>
          <b>{t.x[i].rotulo}</b>
          {t.series.map((s) => <span key={s.id} className="kt-chart__tip-row"><i style={{ '--c': COLOR[s.color] } as CSSProperties} />{s.nombre}<strong>{s.pct[i] != null ? conSigno(s.pct[i]!) : '—'}</strong></span>)}
        </div>
      )}
    </div>
  );
}

// ── las columnas por red ───────────────────────────────────────────────────────────────────────────────────────────
function Columnas({ redes }: { redes: Array<{ clave: string; nombre: string; agendas: number }> }) {
  const [ref, { w }] = useCaja<HTMLDivElement>();
  const base = 86, tope = Math.max(1, ...redes.map((r) => r.agendas)) * 1.08, paso = redes.length ? w / redes.length : 0, b = Math.min(23, paso * 0.62);
  return (
    <div className="kt-bars" ref={ref}>
      {w > 0 && (
        <svg viewBox={`0 0 ${w} 112`} role="img" aria-label={redes.map((r) => `${r.nombre}: ${r.agendas}`).join(', ')}>
          {[0, 43, 86].map((y0) => <line key={y0} className="kt-gl" x1={0} x2={w} y1={y0} y2={y0} />)}
          {redes.map((r, k) => {
            const cx = paso * (k + 0.5), hh = (base * r.agendas) / tope, rr = Math.min(3, hh / 2);
            return (
              <g key={r.clave}>
                {hh > 0 && <path className="kt-b" d={`M${cx - b / 2},${base} V${base - hh + rr} Q${cx - b / 2},${base - hh} ${cx - b / 2 + rr},${base - hh} H${cx + b / 2 - rr} Q${cx + b / 2},${base - hh} ${cx + b / 2},${base - hh + rr} V${base} Z`}><title>{`${r.nombre}: ${r.agendas} agendas`}</title></path>}
                <text className="kt-xl" x={cx} y={base + 19}>{r.nombre.length > 12 ? `${r.nombre.slice(0, 11)}…` : r.nombre}</text>
              </g>
            );
          })}
        </svg>
      )}
    </div>
  );
}

const CHIP: Record<NonNullable<FilaCosto['veredicto']>, { tono: string; icono: keyof typeof P }> = {
  barata: { tono: 'good', icono: 'check' }, media: { tono: 'warn', icono: 'dash' }, cara: { tono: 'bad', icono: 'warn' }, 'sin-agendas': { tono: 'bad', icono: 'warn' },
};

export function HojaMarketing({ hoja, vista, titulo, fecha, periodo, onGrilla, onPeriodo, onFila, compartido = false, quieta = false }: {
  hoja: Hoja;
  vista: VistaMarketing;
  /** «Buenos días, Ana» (quién mira); sin nombre, el de la hoja. */
  titulo: string;
  /** «miércoles 4 de noviembre»: null = no llegó. */
  fecha: string | null;
  /** El nombre del período elegido («Últimos 30 días»): el de la barra de controles de la hoja. */
  periodo: string;
  onGrilla?: () => void;
  /** Tocar el período abre el de la hoja (el «Filtro» de arriba). Sin esto, el período se lee y no se toca. */
  onPeriodo?: () => void;
  /** Abrir una fila de una pieza: su detalle de siempre, como al tocarla en la grilla. */
  onFila?: (g: Grafico, clave: string) => void;
  compartido?: boolean;
  /** La miniatura de «Nueva hoja». */
  quieta?: boolean;
}) {
  const { frase, numeros, tendencias, pestanas, embudo, redes, fallos } = vista;
  const p = hoja.diseno?.piezas ?? {};
  const pieza = (id: string | undefined) => hoja.componentes.find((c): c is Grafico => c.id === id && c.clase === 'grafico');
  const abrir = (id: string | undefined, clave: string) => { const g = pieza(id); return g && onFila && !quieta ? () => onFila(g, clave) : undefined; };
  const fila = (fn: (() => void) | undefined) => (fn ? { role: 'button', tabIndex: 0, onClick: fn, onKeyDown: (e: KeyboardEvent) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); fn(); } } } : {});
  const raiz = useRef<HTMLDivElement>(null);
  const [tab, setTab] = useState<Pestana['id']>('anuncios');
  const [verTabla, setVerTabla] = useState(false);
  const lista = useRef<HTMLDivElement>(null), tinta = useRef<HTMLSpanElement>(null), cuerpo = useRef<HTMLTableSectionElement>(null);
  const anillo = useRef<SVGCircleElement>(null);
  const tabAntes = useRef<Pestana['id'] | null>(null);
  const activa = pestanas.find((x) => x.id === tab) ?? pestanas[0];

  // ── La entrada de Kestrel (`lo`): el encabezado y las tarjetas suben, una vez, al montarse ──────────────────────
  useLayoutEffect(() => {
    const el = raiz.current;
    if (!el || quieta || sinMovimiento()) return;
    el.querySelectorAll<HTMLElement>('.kt-pagehead, .kt-card').forEach((n, i) =>
      n.animate([{ opacity: 0, transform: 'translateY(22px) scale(.985)' }, { opacity: 1, transform: 'none' }], { duration: 850, delay: i * 70, easing: W, fill: 'backwards' }));
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Los números cuentan desde cero la PRIMERA vez que llegan (los datos llegan después de montar) ──────────────────
  const firmaNumeros = [...numeros.map((x) => x.texto), embudo?.impresiones.valor, embudo?.clics.valor, redes?.agendas].join('|');
  useEffect(() => {
    const el = raiz.current;
    if (!el || quieta || sinMovimiento()) return;
    const tarjetas = [...el.querySelectorAll<HTMLElement>('.kt-pagehead, .kt-card')];
    el.querySelectorAll<HTMLElement>('[data-cuenta]:not([data-contado])').forEach((n) => {
      if (!/\d/.test(n.textContent ?? '')) return;
      n.dataset.contado = '';
      contar(n, Math.max(0, tarjetas.indexOf(n.closest('.kt-card') as HTMLElement)) * 70);
    });
  }, [firmaNumeros, quieta]);

  // ── El anillo (lo que llega a la página): se llena la primera vez que hay número ────────────────────────────────
  const llega = embudo?.llega ?? null, C = 2 * Math.PI * 21.5, fraccion = llega == null ? 0 : Math.min(1, llega / 100);
  useEffect(() => {
    const a = anillo.current;
    if (!a || llega == null || quieta || sinMovimiento() || a.dataset.lleno != null) return;
    a.dataset.lleno = '';
    a.animate([{ strokeDashoffset: C }, { strokeDashoffset: C * (1 - fraccion) }], { duration: 1100, delay: 200, easing: P3, fill: 'backwards' });
  }, [llega, quieta, C, fraccion]);

  // ── La tinta de las pestañas: corre hasta la elegida (.45 s); al cambiar, las filas entran de a una ────────────────
  useLayoutEffect(() => {
    const l = lista.current, t = tinta.current;
    if (!l || !t) return;
    const ubicar = (suave: boolean) => {
      const b = l.querySelector<HTMLElement>('[aria-selected="true"]');
      if (!b) return;
      const base = (t.parentElement as HTMLElement).getBoundingClientRect(), r = b.getBoundingClientRect();
      const antes = { transform: t.style.transform || 'translateX(0px)', width: t.style.width || '0px' };
      t.style.transform = `translateX(${r.left - base.left}px)`; t.style.width = `${r.width}px`;
      if (suave && !sinMovimiento()) t.animate([antes, { transform: t.style.transform, width: t.style.width }], { duration: 450, easing: W });
    };
    const suave = tabAntes.current != null && tabAntes.current !== tab;
    ubicar(suave);
    if (suave && cuerpo.current && !sinMovimiento()) {
      cuerpo.current.querySelectorAll<HTMLElement>('tr').forEach((f, k) => f.animate([{ opacity: 0, transform: 'translateY(6px)' }, { opacity: 1, transform: 'none' }], { duration: 400, delay: 180 + k * 20, easing: W, fill: 'backwards' }));
    }
    tabAntes.current = tab;
    const ro = new ResizeObserver(() => ubicar(false));
    ro.observe(l);
    return () => ro.disconnect();
  }, [tab]);
  const elegir = (id: Pestana['id']) => {
    if (id === tab) return;
    const c = cuerpo.current;
    if (!c || sinMovimiento() || quieta) { setTab(id); return; }
    c.animate([{ opacity: 1, transform: 'none' }, { opacity: 0, transform: 'translateY(-6px)' }], { duration: 180, easing: P2IN }).onfinish = () => setTab(id);
  };

  const idPieza = activa.id === 'anuncios' ? p.anuncios : activa.id === 'campanas' ? p.campanas : undefined;

  return (
    <Compartido.Provider value={compartido}>
    <div className="kt" ref={raiz} data-quieta={quieta ? '' : undefined}>
      <style href="dash-hoja-marketing" precedence="medium">{CSS_MARKETING}</style>
      <div className="kt-pagina">
        <div className="kt-page">
          {/* LA CABECERA: el saludo, la fecha en lugar del «Live» (los datos de Meta no son en tiempo real) y la frase. */}
          <Parte id="cabecera">
          <div className="kt-pagehead">
            <div>
              <div className="kt-pagehead__row"><h1 className="kt-pagehead__title">{titulo}</h1>{fecha && <span className="kt-pagehead__fecha">{fecha.charAt(0).toUpperCase() + fecha.slice(1)}</span>}</div>
              {frase.length > 0 && <p className="kt-pagehead__sub">{frase.map((t, i) => (t.tipo === 'fuerte' ? <b key={i}>{t.s}</b> : <span key={i}>{t.s}</span>))}</p>}
            </div>
            <span className="kt-pagehead__acts">
              {onPeriodo && !quieta ? <button type="button" className="kt-pill kt-pill--range" onClick={onPeriodo} title="Cambiar el período"><Icono id="cal" />{periodo}</button> : <span className="kt-pill kt-pill--range kt-pill--quieta"><Icono id="cal" />{periodo}</span>}
              {onGrilla && <button type="button" className="kt-pill kt-pill--range" onClick={onGrilla}><Icono id="grid" />Ver la grilla</button>}
            </span>
          </div>
          </Parte>

          <div className="kt-col">
            {/* LOS SEIS NÚMEROS de Kestrel, con su cambio contra el período anterior. */}
            <Parte id="kpis">
            <section className="kt-card kt-kpis" aria-label="Los números de la pauta">
              {numeros.map((x) => (
                <div key={x.id} className="kt-kpi">
                  <span className="kt-kpi__label">{x.titulo}</span>
                  <strong className="kt-kpi__value" data-cuenta="">{x.texto ?? '—'}</strong>
                  {x.cambio ? (
                    <span className={`kt-kpi__delta${x.bueno === true ? ' kt-up' : x.bueno === false ? ' kt-down' : ''}`} title={`Contra el período anterior${x.bueno == null ? '' : x.bueno ? ': mejor' : ': peor'}`}>
                      {x.sube != null && <Icono id={x.sube ? 'aup' : 'adown'} />}{x.cambio}
                    </span>
                  ) : <span className="kt-kpi__delta">&nbsp;</span>}
                </div>
              ))}
            </section>
            </Parte>

            {/* TRENDS: cómo se movieron el gasto, los leads y las agendas contra la primera semana. */}
            <Parte id="tendencias">
            <section className="kt-card kt-trends">
              <div className="kt-card__h">
                <h2 className="kt-card__t">Tendencias</h2>
                <Ir href="/ads-manager" className="kt-iconbtn kt-iconbtn--dots" label="Abrir el Ads Manager"><Icono id="out" /></Ir>
                {tendencias && tendencias.series.length > 0 && !quieta && (
                  <span className="kt-card__end">
                    <button type="button" className="kt-pill" aria-pressed={verTabla} onClick={() => setVerTabla((v) => !v)}><Icono id="table" style={{ width: 14, height: 14 }} />Tabla</button>
                  </span>
                )}
              </div>
              {tendencias && tendencias.series.length > 0 ? (
                <>
                  <div className="kt-legend">
                    {tendencias.series.map((s) => <span key={s.id} className="kt-legend__item"><i style={{ '--c': COLOR[s.color] } as CSSProperties} />{s.nombre}</span>)}
                    <span className="kt-legend__nota">{tendencias.ventana > 1 ? 'contra la primera semana, de a 7 días' : `contra ${tendencias.paso === 'mes' ? 'el primer mes' : tendencias.paso === 'semana' ? 'la primera semana' : 'el primer día'}`}{tendencias.sinBase.length ? ` · sin base: ${tendencias.sinBase.join(', ')}` : ''}</span>
                  </div>
                  <div className="kt-chart">
                    {verTabla ? (
                      <div className="kt-chart__table">
                        <table>
                          <thead><tr><th>{tendencias.paso === 'mes' ? 'Mes' : tendencias.paso === 'semana' ? 'Semana' : 'Día'}</th><th>Gasto</th><th>Leads</th><th>Agendas</th></tr></thead>
                          <tbody>{[...tendencias.filas].reverse().map((f) => <tr key={f.clave}><td>{f.rotulo}</td><td>{f.gasto != null ? plataEntera(f.gasto) : '—'}</td><td>{f.leads ?? '—'}</td><td>{f.agendas ?? '—'}</td></tr>)}</tbody>
                        </table>
                      </div>
                    ) : <Tendencia t={tendencias} quieta={quieta} demora={2 * 70} />}
                  </div>
                </>
              ) : (
                <div className="kt-vacio">{fallos.tendencias ?? (tendencias?.sinBase.length ? 'La primera semana no tuvo pauta: no hay contra qué comparar.' : 'Todavía no hay pauta en este período.')}</div>
              )}
            </section>
            </Parte>

            {/* LA TABLA CON PESTAÑAS («Lead quality» de Kestrel): por anuncio, por campaña y día por día, con el costo marcado. */}
            <Parte id="tabla">
            <section className="kt-card kt-leads">
              <div className="kt-tabs">
                <div className="kt-tabs__list" role="tablist" ref={lista}>
                  {pestanas.map((x) => <button key={x.id} type="button" role="tab" aria-selected={x.id === activa.id} onClick={() => elegir(x.id)}>{x.nombre}</button>)}
                </div>
                <span className="kt-tabs__ink" ref={tinta} />
                <Ir href="/ads-manager" className="kt-iconbtn" label="Abrir el Ads Manager"><Icono id="out" /></Ir>
              </div>
              <table className="kt-tbl">
                <colgroup><col style={{ width: 190 }} /><col className="kt-t-emp" style={{ width: 140 }} /><col className="kt-t-mail" style={{ width: 96 }} /><col className="kt-t-utm" style={{ width: 70 }} /><col style={{ width: 148 }} /><col className="kt-t-pais" style={{ width: 80 }} /><col /></colgroup>
                <thead><tr><th>{activa.columna}</th><th className="kt-t-emp">{activa.segunda === 'Leads' ? '' : activa.segunda}</th><th className="kt-t-mail kt-num">Gasto</th><th className="kt-t-utm kt-num">Leads</th><th>Costo por agenda</th><th className="kt-t-pais kt-num">Agendas</th><th /></tr></thead>
                <tbody ref={cuerpo}>
                  {activa.filas.length ? activa.filas.map((f) => {
                    const fn = f.abre || activa.id === 'campanas' ? abrir(idPieza, f.clave) : undefined;
                    const chip = f.veredicto ? CHIP[f.veredicto] : null;
                    return (
                      <tr key={f.clave} className={`kt-lead${fn ? ' kt-fila' : ' kt-lead--quieta'}`} {...fila(fn)}>
                        <td><span className={`kt-lead__fecha kt-lead__anuncio${f.hoy ? ' kt-lead__fecha--hoy' : ''}`} title={f.nombre}>{f.nombre}</span></td>
                        <td className="kt-t-emp kt-lead__emp" title={f.segunda ?? undefined}>{f.segunda ?? (activa.id === 'tiempo' ? '' : '–')}</td>
                        <td className="kt-t-mail kt-lead__mail kt-num">{f.gasto != null ? plataEntera(f.gasto) : '—'}</td>
                        <td className="kt-t-utm kt-num">{f.leads != null ? entero(f.leads) : '—'}</td>
                        <td>{chip ? <span className={`kt-chip kt-chip--${chip.tono}`} title={f.porque ?? undefined}><Icono id={chip.icono} />{f.veredicto === 'sin-agendas' ? 'Sin agendas' : plata(f.cpa!)}</span> : <span className="kt-lead__mail">—</span>}</td>
                        <td className="kt-t-pais kt-num">{f.agendas != null ? entero(f.agendas) : '—'}</td>
                        <td className="kt-lead__acc">{fn && <span><Icono id="down" className="kt-lead__chev" /></span>}</td>
                      </tr>
                    );
                  }) : <tr className="kt-vacio-fila"><td colSpan={7}>{activa.vacio}</td></tr>}
                </tbody>
              </table>
            </section>
            </Parte>
          </div>

          <div className="kt-col">
            {/* EL BLOQUE DE INSTAGRAM: lo que trae la pauta, del anuncio a la agenda, y los anuncios que más agendas trajeron. */}
            <Parte id="pauta">
            <section className="kt-card kt-social">
              <div className="kt-card__h">
                <h2 className="kt-card__t"><Icono id="ads" />Lo que trae la pauta</h2>
                <span className="kt-card__end"><Ir href="/ads-manager" className="kt-iconbtn kt-iconbtn--dots" label="Abrir el Ads Manager"><Icono id="out" /></Ir></span>
              </div>
              {embudo ? (
                <>
                  <div className="kt-tiles">
                    <div className="kt-tile"><span className="kt-tile__k">Impresiones</span><span className="kt-tile__v"><b data-cuenta="">{embudo.impresiones.valor != null ? entero(embudo.impresiones.valor) : '—'}</b>{embudo.impresiones.cambio && <small className={embudo.impresiones.sube ? 'kt-up' : embudo.impresiones.sube === false ? 'kt-down' : undefined}>{embudo.impresiones.cambio}</small>}</span></div>
                    <div className="kt-tile kt-tile--ring">
                      <span className="kt-tile__k">Clics</span>
                      <span className="kt-tile__v">
                        <b data-cuenta="">{embudo.clics.valor != null ? entero(embudo.clics.valor) : '—'}</b>
                        {embudo.clics.cambio && <small className={embudo.clics.sube ? 'kt-up' : embudo.clics.sube === false ? 'kt-down' : undefined}>{embudo.clics.cambio}</small>}
                        {llega != null && (
                          <>
                            <svg className="kt-ring" viewBox="0 0 48 48" aria-hidden><circle className="kt-ring__track" cx="24" cy="24" r="21.5" /><circle ref={anillo} className="kt-ring__arc" cx="24" cy="24" r="21.5" strokeDasharray={C.toFixed(2)} strokeDashoffset={(C * (1 - fraccion)).toFixed(2)} /></svg>
                            <span className="kt-ring__txt"><b>{llega}%</b> llega a la página</span>
                          </>
                        )}
                      </span>
                    </div>
                  </div>
                  <div className="kt-list">
                    {embudo.filas.map((f) => <div key={f.nombre} className="kt-list__row"><span>{f.nombre}</span><b>{f.valor != null ? entero(f.valor) : '—'}</b></div>)}
                  </div>
                  {embudo.mosaico.length > 0 && (
                    <>
                      <h3 className="kt-posts__t">Los que más agendas trajeron</h3>
                      <div className="kt-posts">
                        {embudo.mosaico.map((m, k) => {
                          const fn = abrir(p.anuncios, m.clave);
                          const fondo = ['linear-gradient(160deg,#c9d8f6,#8eaae6)', 'linear-gradient(160deg,#f3dcb3,#d9a554)', 'linear-gradient(160deg,#f2cbd8,#d4789a)', 'linear-gradient(160deg,#d7e2ec,#97a8bb)'][k % 4];
                          return (
                            <div key={m.clave} className="kt-post">
                              <button type="button" className="kt-post__btn" onClick={fn} disabled={!fn} aria-label={`${m.nombre}: ${m.agendas} agendas`}>
                                <span className={`kt-post__img${m.imagen ? '' : ' kt-post__img--ini'}`} style={{ '--g': fondo } as CSSProperties}>
                                  {m.imagen ? <img src={m.imagen} alt="" loading="lazy" /> : m.iniciales}
                                </span>
                                <span className="kt-post__n"><Icono id="cal" />{m.agendas}</span>
                              </button>
                              <small title={m.nombre}>{m.nombre}</small>
                            </div>
                          );
                        })}
                      </div>
                    </>
                  )}
                </>
              ) : <div className="kt-vacio">{fallos.embudo ?? 'Todavía no hay pauta en este período.'}</div>}
            </section>
            </Parte>

            {/* EL BLOQUE DE X.COM: qué red trae agendas, en vivo de Meta. */}
            <Parte id="redes">
            <section className="kt-card kt-social">
              <div className="kt-card__h">
                <h2 className="kt-card__t"><Icono id="net" />Qué red trae agendas</h2>
                <span className="kt-card__end"><Ir href="/ads-manager" className="kt-iconbtn kt-iconbtn--dots" label="Abrir el Ads Manager"><Icono id="out" /></Ir></span>
              </div>
              {redes && redes.redes.length > 0 ? (
                <>
                  <div className="kt-tiles">
                    <div className="kt-tile"><span className="kt-tile__k">Agendas, según Meta</span><span className="kt-tile__v"><b data-cuenta="">{redes.agendas != null ? entero(redes.agendas) : '—'}</b><small className="kt-nota">en vivo de Meta</small></span></div>
                  </div>
                  <Columnas redes={redes.redes} />
                  <div className="kt-list">
                    {redes.filas.map((f) => <div key={f.nombre} className="kt-list__row"><span>{f.nombre}</span><b>{f.texto ?? '—'}</b></div>)}
                  </div>
                </>
              ) : <div className="kt-vacio">{fallos.redes ?? 'Meta no devolvió las redes de este período.'}</div>}
            </section>
            </Parte>
          </div>
        </div>
      </div>
    </div>
    </Compartido.Provider>
  );
}
