'use client';

// =============================================================================
// HojaColdCalling — la hoja «Cold Calling» con su DISEÑO PROPIO: la copia de Corvane, con los datos reales de MaKo
// =============================================================================
// Martín, 4/11/2026: «que sea primero la copia, es decir, que se vea exactamente igual que la copia, y después la adaptación con
// Maco... copiarlo todo, desde las animaciones de entrada, las animaciones de hover, las animaciones de clic». La copia (maqueta) y sus
// capturas están en docs/diseno/mockups-dashboard/cold-calling-corvane/; ésta es la adaptación con los datos de verdad
// (lib/cold-calling-diseno.ts arma lo que dibuja cada tarjeta, con test). La pregunta: «¿cuántas llamadas hice, cuántas contestaron y
// cuántas agendaron?». Y arriba, el botón «Grabar llamada»: la MISMA grabadora de la ficha del lead (app/_components/grabar/GrabarEnFrio).
//
// El movimiento: el INFORME de Corvane (docs/diseno/mockups-dashboard/demos/corvane/INFORME.txt) trae la entrada del ARMAZÓN (la barra
// lateral y la de arriba, que en MaKo pone la app) y los hover del CSS; la entrada de la página «Overview» vive en un chunk que el INFORME
// no muestra. No se inventa: las tarjetas quedan quietas. Lo medido que sí está: el punto vivo late («breathe»), la píldora del selector
// corre .28 s con rebote (cubic-bezier(.3, 1.4, .5, 1)), las tarjetas de «Lo que sigue» marcan su borde al pasar, los botones se
// pintan (el oscuro tira al acento) y el link se subraya.
//
// ⚠️ Mirando se dibuja esto; editando, la grilla con los mismos componentes (app/dashboard/EditorInforme.tsx).
// ⚠️ Lo que Corvane tiene y MaKo no mide no está (lib/cold-calling-diseno.ts): el reloj, el ticker en vivo y las tarjetas de pago.
// =============================================================================

import { createContext, useContext, useLayoutEffect, useRef, useState, type KeyboardEvent, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import dynamic from 'next/dynamic';
import Link from '@/app/_ui/Link';
import { Modal } from '@/app/_ui/Modal';
import type { Grafico, Hoja } from '@/lib/graficos-catalogo';
import { entero, enElPeriodo } from '@/lib/marketing-diseno';
import { SIN_MARCAR, ROTULO_RESULTADO } from '@/lib/grabar-llamada-reglas';
import { acumuladoCold, pct, quienDe, type DiaCold, type PendienteCold, type VistaCold } from '@/lib/cold-calling-diseno';
import { CSS_COLD_CALLING } from './cold-calling-css';

const GrabarEnFrio = dynamic(() => import('@/app/_components/grabar/GrabarEnFrio').then((m) => m.GrabarEnFrio), { ssr: false });

const Compartido = createContext(false);

// Los íconos son trazos propios (los de la copia, cold-calling-corvane/copia.html).
const P = {
  grilla: 'M2.5 2.5h4.5v6H2.5zM9 2.5h4.5v3.5H9zM9 8h4.5v5.5H9zM2.5 10.5h4.5v3H2.5z',
  mic: 'M8 2.5a2 2 0 0 1 2 2v3.5a2 2 0 0 1-4 0V4.5a2 2 0 0 1 2-2zM4.5 7.5a3.5 3.5 0 0 0 7 0M8 11v2.5M6 13.5h4',
  bajo: 'M8 3v10M4 9l4 4 4-4',
  sube: 'M8 13V3M4 7l4-4 4 4',
  chev: 'M6 3.5L10.5 8 6 12.5',
  flecha: 'M3 8h10M9 4l4 4-4 4',
  marcar: 'M13.3 8a5.3 5.3 0 1 1-2-4.2M10.5 8a2.5 2.5 0 1 1-1-2M8 8l5-5',
  telefono: 'M5.2 2.5l1.6 3.2-1.4 1.1a8 8 0 0 0 3.8 3.8l1.1-1.4 3.2 1.6-.5 2.2c-.1.5-.5.8-1 .8A10.5 10.5 0 0 1 2.2 3.5c0-.5.3-.9.8-1z',
  cal: 'M2.5 3.5h11v10h-11zM2.5 6.5h11M5.5 2v3M10.5 2v3',
  no: 'M8 2.2a5.8 5.8 0 1 0 0 11.6A5.8 5.8 0 0 0 8 2.2zM3.9 3.9l8.2 8.2',
} as const;
type IconoId = keyof typeof P;
function Icono({ id }: { id: IconoId }) {
  return <svg className="cv-i" viewBox="0 0 16 16" aria-hidden><path d={P[id]} /></svg>;
}

/** El tamaño de una caja (el gráfico se dibuja a su tamaño real, como en Corvane: un viewBox fijo deforma el texto). */
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
  if (useContext(Compartido)) return <span className={`${className ?? ''} cv-quieta`}>{children}</span>;
  return <Link href={href} className={className}>{children}</Link>;
}
function Vacio({ children }: { children: ReactNode }) {
  return <p className="cv-vacio">{children}</p>;
}
const accionDe = (fn: (() => void) | undefined) => (fn ? { role: 'button', tabIndex: 0, onClick: fn, onKeyDown: (e: KeyboardEvent) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); fn(); } } } : {});
const plural = (n: number, una: string, varias: string) => `${entero(n)} ${n === 1 ? una : varias}`;
const DIAS_SEMANA = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
const fechaLarga = (hoy: string) => { const d = new Date(`${hoy}T12:00:00Z`); return `${DIAS_SEMANA[d.getUTCDay()]} ${d.getUTCDate()} de ${MESES[d.getUTCMonth()]}`; };

/** Una curva suave por los puntos (Catmull-Rom → Bézier), la de la copia. */
const curva = (pts: Array<[number, number]>) => pts.map((p, i) => {
  if (!i) return `M${p[0].toFixed(1)},${p[1].toFixed(1)}`;
  const a = pts[i - 2] ?? pts[i - 1], b = pts[i - 1], d = pts[i + 1] ?? p;
  return `C${(b[0] + (p[0] - a[0]) / 6).toFixed(1)},${(b[1] + (p[1] - a[1]) / 6).toFixed(1)} ${(p[0] - (d[0] - b[0]) / 6).toFixed(1)},${(p[1] - (d[1] - b[1]) / 6).toFixed(1)} ${p[0].toFixed(1)},${p[1].toFixed(1)}`;
}).join('');

// El chip de cada lead, con los colores de las tarjetas de pago de Corvane, uno por cómo terminó.
const CHIP: Readonly<Record<string, string>> = {
  [ROTULO_RESULTADO.agendo]: 'pay', [ROTULO_RESULTADO.hablo]: 'mc', [ROTULO_RESULTADO.no_interesa]: 'mc', [ROTULO_RESULTADO.no_contesto]: 'amex', [SIN_MARCAR]: 'visa',
};
const ICONO_PEND: Readonly<Record<PendienteCold['icono'], IconoId>> = { marcar: 'marcar', telefono: 'telefono', cal: 'cal', no: 'no' };
type Metrica = 'llamadas' | 'contestaron' | 'agendaron';
const METRICAS: ReadonlyArray<{ id: Metrica; nombre: string }> = [{ id: 'llamadas', nombre: 'Llamadas' }, { id: 'contestaron', nombre: 'Contestaron' }, { id: 'agendaron', nombre: 'Agendaron' }];

// ── «Captured today» → las llamadas día por día: el área con su línea, cuatro escalones y las fechas abajo ───────────────────
function Grafico({ filas, metrica }: { filas: DiaCold[]; metrica: Metrica }) {
  const [ref, { w }] = useTam<HTMLDivElement>();
  if (w < 160 || filas.length < 2) return <div className="cv-chart" ref={ref}>{filas.length < 2 && w > 0 ? <Vacio>Con dos días de llamadas aparece la curva.</Vacio> : null}</div>;
  const H = 248, x0 = 56, x1 = w - 13, y0 = 13, y1 = 223;
  const max = Math.max(1, ...filas.map((f) => f[metrica]));
  const PASOS = [1, 2, 5, 10, 20, 25, 50, 100, 200, 250, 500, 1000, 2000, 2500, 5000];
  const paso = PASOS.find((p) => p * 4 >= max * 1.05) ?? Math.ceil((max * 1.05) / 4);
  const tope = paso * 4;
  const pts = filas.map((f, i): [number, number] => [x0 + ((x1 - x0) * i) / (filas.length - 1), y1 - ((y1 - y0) * f[metrica]) / tope]);
  const d = curva(pts);
  const cada = Math.max(1, Math.ceil(filas.length / (w < 400 ? 4 : 8)));
  return (
    <div className="cv-chart" ref={ref}>
      <svg viewBox={`0 0 ${w} ${H}`} role="img" aria-label={`${METRICAS.find((m) => m.id === metrica)?.nombre}, día por día`}>
        <defs><linearGradient id="cv-area" x1="0" x2="0" y1="0" y2="1"><stop offset="0" stopColor="#b0521f" stopOpacity=".24" /><stop offset="1" stopColor="#b0521f" stopOpacity="0" /></linearGradient></defs>
        {[0, 1, 2, 3, 4].map((k) => { const y = y0 + ((y1 - y0) * k) / 4; return <g key={k}><line className="cv-grid" x1={x0} x2={x1} y1={y} y2={y} /><text x={x0 - 11} y={y + 4} textAnchor="end">{entero(tope - paso * k)}</text></g>; })}
        <path d={`${d}L${x1},${y1}L${x0},${y1}Z`} fill="url(#cv-area)" />
        <path d={d} fill="none" stroke="#b0521f" strokeWidth="2.2" strokeLinecap="round" />
        {filas.map((f, i) => {
          const ult = i === filas.length - 1;
          if (!ult && (i % cada !== 0 || filas.length - 1 - i < cada / 2)) return null;
          return <text key={f.clave} x={pts[i][0]} y={H - 4} textAnchor={i === 0 ? 'start' : ult ? 'end' : 'middle'}>{f.rotulo}</text>;
        })}
      </svg>
    </div>
  );
}

/** La línea chica de un número (la de los cuatro de Corvane): 80 × 26, sin ejes. */
function Linea({ vs }: { vs: number[] }) {
  const W = 80, H = 26, mx = Math.max(...vs), mn = Math.min(...vs);
  return <svg className="cv-kpi__spark" viewBox={`0 0 ${W} ${H}`} aria-hidden><path d={curva(vs.map((y, i) => [2 + ((W - 4) * i) / (vs.length - 1), H - 3 - ((H - 6) * (y - mn)) / (mx - mn || 1)]))} /></svg>;
}

/** El selector de Corvane: la píldora corre a la opción elegida (.28 s con rebote, lo medido); la primera vez se pone sin moverse. */
function Selector<T extends string>({ opciones, valor, onCambio, etiqueta }: { opciones: ReadonlyArray<{ id: T; nombre: string }>; valor: T; onCambio: (v: T) => void; etiqueta: string }) {
  const caja = useRef<HTMLDivElement>(null), pill = useRef<HTMLSpanElement>(null), puesta = useRef(false);
  useLayoutEffect(() => {
    const c = caja.current, pl = pill.current, on = c?.querySelector<HTMLElement>('[aria-pressed="true"]');
    if (!c || !pl || !on) return;
    pl.style.width = `${on.offsetWidth}px`;
    if (!puesta.current) { pl.style.transition = 'none'; pl.style.translate = `${on.offsetLeft - 3}px 0`; void pl.offsetWidth; pl.style.transition = ''; puesta.current = true; }
    else pl.style.translate = `${on.offsetLeft - 3}px 0`;
  });
  return (
    <div className="cv-seg" ref={caja} role="group" aria-label={etiqueta}>
      <span className="cv-seg__pill" ref={pill} />
      {opciones.map((o) => <button key={o.id} type="button" className="cv-seg__opt" aria-pressed={o.id === valor} onClick={() => onCambio(o.id)}>{o.nombre}</button>)}
    </div>
  );
}

export function HojaColdCalling({ hoja, vista, titulo, hoy, periodo, onGrilla, onFila, onCambio, compartido = false, quieta = false }: {
  hoja: Hoja;
  vista: VistaCold;
  /** El nombre de la hoja («Cold Calling»). */
  titulo: string;
  /** Hoy en el negocio (YYYY-MM-DD): la fecha de la cabecera. */
  hoy: string;
  /** El período de la hoja, como se lee en su control («Últimos 7 días»). */
  periodo: string;
  onGrilla?: () => void;
  /** Abrir una fila de una pieza: su detalle de siempre, como al tocarla en la grilla. */
  onFila?: (g: Grafico, clave: string) => void;
  /** Se grabó una llamada: la hoja vuelve a pedir sus números. */
  onCambio?: () => void;
  compartido?: boolean;
  /** La miniatura de «Nueva hoja»: sin nada que se toque. */
  quieta?: boolean;
}) {
  const v = vista;
  const p = hoja.diseno?.piezas ?? {};
  const pieza = (id: string | undefined) => hoja.componentes.find((c): c is Grafico => c.id === id && c.clase === 'grafico');
  const abrir = (id: string | undefined, clave: string) => { const g = pieza(id); return g && onFila && !quieta ? () => onFila(g, clave) : undefined; };
  const [metrica, setMetrica] = useState<Metrica>('llamadas');
  const [modo, setModo] = useState<'dia' | 'acumulado'>('dia');
  const [porQuien, setPorQuien] = useState<'llamadas' | 'agendaron'>('llamadas');
  const [grabando, setGrabando] = useState(false);
  const puedeGrabar = !compartido && !quieta;

  const sinDatos = (x: unknown) => (v.cargando && x == null ? null : <Vacio>Todavía no hay datos en este período.</Vacio>);
  const dias = v.dias ? (modo === 'acumulado' ? acumuladoCold(v.dias.filas) : v.dias.filas) : [];
  const quien = quienDe(v.quien, porQuien);
  const sinMarcar = v.terminan?.sinMarcar ?? 0;
  const sub = v.llamadas == null ? null : (
    <>{plural(v.llamadas, 'llamada', 'llamadas')} {enElPeriodo(periodo)}{v.contestaron != null && <>, <b>{entero(v.contestaron)}</b> contestaron</>}{v.agendaron != null && <> y <b>{entero(v.agendaron)}</b> agendaron</>}{sinMarcar > 0 && <>; <b>{entero(sinMarcar)}</b> sin marcar</>}.</>
  );
  const botonGrabar = puedeGrabar
    ? <button type="button" className="cv-btn cv-btn--primary" onClick={() => setGrabando(true)}><Icono id="mic" />Grabar llamada</button>
    : <span className="cv-btn cv-btn--primary cv-quieta"><Icono id="mic" />Grabar llamada</span>;

  return (
    <Compartido.Provider value={compartido}>
    <div className="cv" data-quieta={quieta ? '' : undefined}>
      <style href="dash-hoja-cold-calling" precedence="medium">{CSS_COLD_CALLING}</style>
      <div className="cv-cuerpo">
      <div className="cv-head">
        <div>
          <p className="cv-head__eyebrow">{fechaLarga(hoy)} · {periodo}</p>
          <h1 className="cv-head__title">{titulo}</h1>
          {sub && <p className="cv-head__sub">{sub}</p>}
        </div>
        <div className="cv-head__actions">
          {onGrilla && !quieta && <button type="button" className="cv-btn" onClick={onGrilla}><Icono id="grilla" />Ver la grilla</button>}
          {botonGrabar}
        </div>
      </div>

      {v.vacia ? (
        <section className="cv-card cv-c-vacia">
          <h2 className="cv-card__t">Todavía no grabaste llamadas en este período</h2>
          <p className="cv-vacio">Toca «Grabar llamada», elige el lead y graba: aquí ves cuántas contestan, cuántas agendan y quién llama más.</p>
        </section>
      ) : (
      <>
      <div className="cv-r1">
        {/* «Captured today» → las llamadas */}
        <section className="cv-card cv-ov__hero">
          <div className="cv-hero__head">
            <div>
              <h2 className="cv-card__t">Llamadas</h2>
              <div className="cv-hero__big">
                {v.llamadas != null ? <b>{entero(v.llamadas)}</b> : <b className="cv-sin">—</b>}
                {v.cambio && <span className={`cv-chg cv-chg--${v.cambio.tono === 'malo' ? 'bad' : 'good'}`}><Icono id={v.cambio.sube ? 'sube' : 'bajo'} />{v.cambio.texto}</span>}
                {v.cambio && <span className="cv-hero__vs">vs. el período anterior</span>}
              </div>
              <p className="cv-hero__stats">
                <span><b>{v.contestaron != null ? entero(v.contestaron) : '—'}</b> contestaron</span>
                <span><b>{v.agendaron != null ? entero(v.agendaron) : '—'}</b> agendaron</span>
                <span><b>{entero(sinMarcar)}</b> sin marcar</span>
              </p>
            </div>
            <div className="cv-hero__segs">
              <Selector opciones={METRICAS} valor={metrica} onCambio={setMetrica} etiqueta="Qué contar" />
              <Selector opciones={[{ id: 'dia', nombre: 'Por día' }, { id: 'acumulado', nombre: 'Acumulado' }] as const} valor={modo} onCambio={setModo} etiqueta="Cómo contarlo" />
            </div>
          </div>
          {v.dias ? <Grafico filas={dias} metrica={metrica} /> : <div className="cv-chart">{sinDatos(v.dias)}</div>}
          <p className="cv-hero__foot">{v.llamadas != null ? `${plural(v.llamadas, 'llamada grabada', 'llamadas grabadas')} ${enElPeriodo(periodo)}` : ''}</p>
        </section>

        {/* «Needs you» → lo que sigue */}
        <section className="cv-card cv-ov__needs">
          <div className="cv-card__h"><h2 className="cv-card__t">Lo que sigue</h2>{v.terminan && <span className="cv-card__aside">de {plural(v.terminan.total, 'llamada', 'llamadas')}</span>}</div>
          {v.pendientes.length ? (
            <div className="cv-needs">
              {v.pendientes.map((x) => (
                <div key={x.clave} className="cv-needs__item" {...accionDe(abrir(p.terminan, x.clave))}>
                  <span className={`cv-needs__ic cv-needs__ic--${x.tono}`}><Icono id={ICONO_PEND[x.icono]} /></span>
                  <span><b>{x.titulo}</b><small>{x.texto}</small></span>
                  <span className="cv-needs__go"><Icono id="chev" /></span>
                </div>
              ))}
            </div>
          ) : sinDatos(v.terminan)}
        </section>
      </div>

      {/* Los cuatro números */}
      <div className="cv-r2">
        {v.numeros.map((n) => (
          <article key={n.id} className={`cv-kpi cv-kpi--${n.tono}`}>
            <span className="cv-kpi__l">{n.nombre}</span>
            <b className="cv-kpi__v">{n.texto ?? <span className="cv-sin">—</span>}</b>
            <span className="cv-kpi__s">{n.sub ?? (v.cargando ? '' : 'Sin dato en el período')}{n.linea && <Linea vs={n.linea} />}</span>
          </article>
        ))}
      </div>

      <div className="cv-r3">
        {/* «Live payments» → a quién llamaste */}
        <section className="cv-card cv-ov__feed">
          <div className="cv-card__h"><span className="cv-dot" /><h2 className="cv-card__t">A quién llamaste</h2>{v.llamados && <span className="cv-card__aside">{plural(v.llamados.total, 'lead', 'leads')}</span>}</div>
          {v.llamados && v.llamados.filas.length ? (
            <ul className="cv-feed">
              {v.llamados.filas.map((l) => (
                <li key={l.clave} {...accionDe(abrir(p.leads, l.clave))}>
                  <span className={`cv-chip cv-chip--${CHIP[l.resultado ?? ''] ?? 'amex'}`}>{l.iniciales}</span>
                  <span className="cv-feed__who"><b>{l.nombre}</b><small>{plural(l.llamadas, 'llamada', 'llamadas')}{l.resultado && l.resultado !== SIN_MARCAR ? ` · ${l.resultado}` : ''}</small></span>
                  <span className="cv-feed__amt">{l.minutos != null ? `${entero(l.minutos)} min` : '—'}{l.resultado === SIN_MARCAR && <span className="cv-pill cv-pill--warn"><i />Sin marcar</span>}</span>
                </li>
              ))}
            </ul>
          ) : v.cargando && v.llamados == null ? null : <Vacio>Todavía no llamaste a nadie en este período.</Vacio>}
          <Ir href="/crm" className="cv-feed__more">Abrir el CRM <Icono id="flecha" /></Ir>
        </section>

        {/* «Top merchants» → quién llamó */}
        <section className="cv-card cv-ov__tm">
          <div className="cv-card__h">
            <h2 className="cv-card__t">Quién llamó</h2>
            <span className="cv-card__h-seg"><Selector opciones={[{ id: 'llamadas', nombre: 'Llamadas' }, { id: 'agendaron', nombre: 'Agendaron' }] as const} valor={porQuien} onCambio={setPorQuien} etiqueta="Ordenar por" /></span>
          </div>
          {quien && quien.length ? (
            <ul className="cv-bars">
              {quien.map((q) => (
                <li key={q.clave} {...accionDe(abrir(p.quien, q.clave))}>
                  <div className="cv-bars__top"><span>{q.nombre}</span><b>{entero(q.valor)}</b></div>
                  <div className="cv-bars__track"><div className="cv-bars__fill" style={{ width: `${q.ancho * 100}%` }} /></div>
                </li>
              ))}
            </ul>
          ) : sinDatos(v.quien)}
        </section>

        {/* «Merchant money» → cómo terminan */}
        <section className="cv-card cv-ov__money">
          <div className="cv-card__h"><h2 className="cv-card__t">Cómo terminan</h2><Ir href="/crm" className="cv-link cv-card__link">En el CRM</Ir></div>
          {v.terminan && v.terminan.filas.length ? (
            <>
              <p className="cv-money__big">{entero(v.terminan.total)}</p>
              <p className="cv-money__sub">llamadas, por cómo terminaron</p>
              <div className="cv-stack">{v.terminan.filas.map((t) => <span key={t.clave} style={{ flex: t.valor, background: t.color }} title={`${t.nombre}: ${entero(t.valor)}`} />)}</div>
              <ul className="cv-legend">
                {v.terminan.filas.map((t) => <li key={t.clave} {...accionDe(abrir(p.terminan, t.clave))}><i style={{ background: t.color }} />{t.nombre}<b>{entero(t.valor)} · {pct((t.valor / Math.max(1, v.terminan!.total)) * 100)}</b></li>)}
              </ul>
              {sinMarcar > 0 ? (
                <div className="cv-batch" {...accionDe(abrir(p.terminan, SIN_MARCAR))}>
                  <Icono id="marcar" /><span><b>{plural(sinMarcar, 'llamada sin marcar', 'llamadas sin marcar')}</b><small>Cuentan en «Sin marcar» hasta que marques cómo terminó</small></span><Icono id="chev" />
                </div>
              ) : (
                <div className="cv-batch cv-batch--ok"><Icono id="marcar" /><span><b>Todas tienen cómo terminaron</b><small>Se marca al cortar la llamada</small></span></div>
              )}
            </>
          ) : sinDatos(v.terminan)}
        </section>
      </div>
      </>
      )}
      </div>
      {grabando && typeof document !== 'undefined' && createPortal(
        <Modal titulo="Grabar llamada" anidada onCerrar={() => { setGrabando(false); onCambio?.(); }} ancho={520}>
          <GrabarEnFrio />
        </Modal>,
        document.body,
      )}
    </div>
    </Compartido.Provider>
  );
}
