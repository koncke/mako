'use client';

// =============================================================================
// HojaCobranza — la hoja Cobranza con su DISEÑO PROPIO: la copia de Coffer, con los datos reales de MaKo
// =============================================================================
// Martín, 4/11/2026, al rechazar las 20 hojas iguales: «que sea primero la copia, es decir, que se vea exactamente igual
// que la copia, y después la adaptación con Maco… copiarlo todo, desde las animaciones de entrada, las animaciones de
// hover, las animaciones de clic». La copia y la adaptación (maquetas) están en docs/diseno/mockups-dashboard/cobranza/;
// ésta es la adaptación con los datos de verdad:
//   · los números salen de los componentes de la hoja (los de la grilla), por las piezas de `hoja.diseno`
//     (lib/cobranza-diseno.ts arma lo que dibuja cada bloque, con test);
//   · una fila (a quién perseguir, lo que entró, quién pagó, el funnel) abre el detalle de siempre de su pieza, con
//     «Marcar cobrada» donde la tabla lo tiene (`onFila`, que el editor resuelve con `alClicDe`).
//
// El movimiento es el de Coffer, medido en su INFORME (docs/diseno/mockups-dashboard/demos/coffer/INFORME.txt) y escrito
// con Element.animate: el título letra por letra, las tarjetas escalonadas, las cifras que cuentan, la barra del atraso
// que crece tramo por tramo y la pastilla del selector de meses. Lo que el INFORME no trae (la entrada de las listas, del
// flujo y del anillo; a qué se le pone el hover que sube) no se inventó: queda quieto (lo nombra el relevo).
//
// ⚠️ La hoja de estilos (./cobranza-css.ts) es SÓLO de esta hoja: otra hoja con diseño copia SU demo.
// ⚠️ Mirando se dibuja esto; editando, la grilla con los mismos componentes (app/dashboard/EditorInforme.tsx).
// ⚠️ Los «Recordar» de Coffer (mandan un aviso al cliente) NO están: un mensaje a un tercero sale por sus puertas, no por
//    un botón de una hoja. En su lugar, «Ver cuota» abre la cuota.
// =============================================================================

import { createContext, useContext, useEffect, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import Link from '@/app/_ui/Link';
import type { Grafico, Hoja } from '@/lib/graficos-catalogo';
import {
  cuotas as textoCuotas, escalaFlujo, nombresDelPeriodo, notaAnterior, notaDemora, plata, plataCorta, rotuloDia, textoDeDias,
  textoDemora, vistaCobranza, type DatosPieza, type MesFlujo,
} from '@/lib/cobranza-diseno';
import type { QuienMira } from './HojaClosing';
import { CSS_COBRANZA } from './cobranza-css';
import { Parte } from './parte';

export type ExtrasCobranza = { quien: QuienMira | null };

// Las curvas de GSAP de Coffer, traducidas (las mismas de docs/diseno/mockups-dashboard/cobranza/cobranza.js).
const P4O = 'cubic-bezier(.165,.84,.44,1)';
const P3O = 'cubic-bezier(.215,.61,.355,1)';
const P3IO = 'cubic-bezier(.645,.045,.355,1)';

const MESES = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
const CATS = ['var(--cat-1)', 'var(--cat-2)', 'var(--cat-3)', 'var(--cat-4)', 'var(--cat-5)'];
const iniciales = (s: string) => [...s.trim().split(/\s+/).slice(0, 2).map((p) => [...p][0] ?? '')].join('').toUpperCase() || '·';
const sinMovimiento = () => matchMedia('(prefers-reduced-motion: reduce)').matches;

/** QUIETA: la hoja dibujada como miniatura de «Nueva hoja» (../MiniaturaHoja.tsx): sin la entrada y sin cifras que cuentan. */
const Quieta = createContext(false);

/** Una cifra que cuenta («po» de Coffer: desde 0, 1.2 s power3.out; al cambiar, desde la de antes). */
function Cuenta({ valor, formato, demora = 0 }: { valor: number | null; formato: (n: number) => string; demora?: number }) {
  const ref = useRef<HTMLSpanElement>(null);
  const antes = useRef<number | null>(null);
  const quieta = useContext(Quieta);
  useEffect(() => {
    const el = ref.current;
    if (!el || valor == null) return;
    const desde = antes.current ?? 0;
    antes.current = valor;
    if (quieta || sinMovimiento() || desde === valor) { el.textContent = formato(valor); return; }
    const t0 = performance.now() + demora * 1000;
    let id = 0;
    const paso = (ahora: number) => {
      const t = Math.min(1, Math.max(0, (ahora - t0) / 1200));
      el.textContent = formato(desde + (valor - desde) * (1 - Math.pow(1 - t, 3)));
      if (t < 1) id = requestAnimationFrame(paso);
    };
    el.textContent = formato(desde);
    id = requestAnimationFrame(paso);
    return () => cancelAnimationFrame(id);
  }, [valor, formato, demora, quieta]);
  return <span ref={ref}>{valor == null ? '—' : formato(valor)}</span>;
}

function Icono({ id }: { id: keyof typeof I }) {
  return <svg className="cbz-i" viewBox="0 0 24 24" aria-hidden><path d={I[id]} /></svg>;
}
const I = {
  users: 'M9 5a3.5 3.5 0 1 0 0 7a3.5 3.5 0 1 0 0-7M2.5 20c.6-3.5 3.3-5.5 6.5-5.5s5.9 2 6.5 5.5M15.5 5.2a3.4 3.4 0 0 1 0 6.4M17.5 14.8c2.1.6 3.6 2.4 4 5.2',
  grid: 'M3.5 3.5h7v7h-7zM13.5 3.5h7v7h-7zM3.5 13.5h7v7h-7zM13.5 13.5h7v7h-7z',
  eye: 'M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12zM12 9.2a2.8 2.8 0 1 0 0 5.6a2.8 2.8 0 1 0 0-5.6',
  cash: 'M3 6.5h18v11H3zM12 9.5a2.5 2.5 0 1 0 0 5a2.5 2.5 0 1 0 0-5M6.5 9.5v5M17.5 9.5v5',
};

/** Una etiqueta del eje del flujo: «$20K», «−$20K», o en pesos enteros si la escala es chica. */
function ejeFlujo(v: number, paso: number): string {
  if (v === 0) return '0';
  const a = Math.abs(v);
  const t = paso >= 1000 ? `$${Math.round(a / 100) / 10}K`.replace('.0K', 'K') : `$${Math.round(a)}`;
  return `${v < 0 ? '−' : ''}${t}`;
}

/** El flujo de Coffer: lo que entró arriba de la línea y lo que sigue sin pagar abajo (el SVG se arma con el ancho medido). */
function Flujo({ meses, etiqueta }: { meses: MesFlujo[]; etiqueta: string }) {
  const caja = useRef<HTMLDivElement>(null);
  const [W, setW] = useState(698);
  useLayoutEffect(() => {
    const el = caja.current;
    if (!el) return;
    const medir = () => { const w = el.clientWidth; if (w > 0) setW(w); };
    medir();
    const ro = new ResizeObserver(medir);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  const { min, max, paso } = escalaFlujo(meses);
  const H = 261, top = 13, bot = 235, x0 = 51.9, x1 = W - 7.9;
  const y = (v: number) => top + ((max - v) / (max - min)) * (bot - top);
  const lineas: number[] = [];
  for (let v = min; v <= max + paso / 2; v += paso) lineas.push(v);
  const slot = (x1 - x0) / Math.max(1, meses.length);
  const bw = Math.max(4, Math.min(25, Math.round(slot - 10)));
  const r = 3;
  const cada = slot < 40 ? 2 : 1;
  const y0 = y(0) + 0.5;
  return (
    <div className="cbz-chart" ref={caja}>
      <svg viewBox={`0 0 ${W} ${H}`} width={W} height={H} role="img" aria-label={etiqueta}>
        {lineas.map((v) => (
          <g key={v}>
            <line className={v === 0 ? 'gl zero' : 'gl'} x1={x0} x2={x1} y1={y(v) + 0.5} y2={y(v) + 0.5} />
            <text x={x0 - 8} y={y(v) + 0.5} textAnchor="end" dominantBaseline="middle">{ejeFlujo(v, paso)}</text>
          </g>
        ))}
        {meses.map((m, i) => {
          const cx = x0 + slot * (i + 0.5);
          const a = Math.round(cx - bw / 2), b = a + bw;
          const yi = y(m.entro), yo = y(-m.sinPagar);
          const mes = MESES[Number(m.clave.slice(5, 7)) - 1] ?? m.etiqueta;
          return (
            <g key={m.clave}>
              {m.entro > 0 && <path className="b-in" d={`M${a},${y0}V${yi + r}Q${a},${yi} ${a + r},${yi}H${b - r}Q${b},${yi} ${b},${yi + r}V${y0}Z`}><title>{`${mes}: entró ${plata(m.entro)}`}</title></path>}
              {m.sinPagar > 0 && <path className="b-out" d={`M${a},${y0 + 1}V${yo - r}Q${a},${yo} ${a + r},${yo}H${b - r}Q${b},${yo} ${b},${yo - r}V${y0 + 1}Z`}><title>{`${mes}: sin pagar ${plata(m.sinPagar)}`}</title></path>}
              {(meses.length - 1 - i) % cada === 0 && <text x={cx} y={251.5} textAnchor="middle" dominantBaseline="middle">{mes}</text>}
            </g>
          );
        })}
      </svg>
    </div>
  );
}

/** El selector 6M / 12M («xo» de Coffer: la pastilla viaja .5 s power3.inOut y se estira en el medio). */
function SelectorMeses({ cuantos, onCambio }: { cuantos: 6 | 12; onCambio: (n: 6 | 12) => void }) {
  const pill = useRef<HTMLSpanElement>(null);
  const btns = useRef<Array<HTMLButtonElement | null>>([]);
  const pos = useRef<{ x: number; s: number } | null>(null);
  const quieta = useContext(Quieta);
  useLayoutEffect(() => {
    const p = pill.current, b = btns.current[cuantos === 6 ? 0 : 1];
    if (!p || !b) return;
    const nx = b.offsetLeft, ns = b.offsetWidth / 100;
    const de = pos.current;
    if (de && !quieta && !sinMovimiento() && (de.x !== nx || de.s !== ns)) {
      const c = (Math.abs(nx - de.x) / 100) * 0.3;
      p.animate([
        { transform: `translateX(${de.x}px) scaleX(${de.s})` },
        { transform: `translateX(${(de.x + nx) / 2}px) scaleX(${Math.max(ns, de.s) + c})` },
        { transform: `translateX(${nx}px) scaleX(${ns})` },
      ], { duration: 500, easing: P3IO });
    }
    p.style.transform = `translateX(${nx}px) scaleX(${ns})`;
    pos.current = { x: nx, s: ns };
  });
  return (
    <div className="cbz-seg" role="group" aria-label="Cuántos meses">
      <span className="cbz-seg__pill" ref={pill} aria-hidden />
      {([6, 12] as const).map((n, i) => (
        <button key={n} type="button" className="cbz-seg__btn" aria-pressed={cuantos === n} ref={(el) => { btns.current[i] = el; }}
          onClick={() => onCambio(n)}>{n}M</button>
      ))}
    </div>
  );
}

/** Lo que se toca para abrir una fila: un botón si hay a dónde ir; si no (la pieza no está), texto quieto. */
function Toque({ className, onClick, children }: { className: string; onClick?: () => void; children: ReactNode }) {
  return onClick
    ? <button type="button" className={className} onClick={onClick}>{children}</button>
    : <div className={className}>{children}</div>;
}

/** Una fila entera que se toca (la de una lista de montos): con teclado también, como las de Closing. */
const tocable = (clic: (() => void) | undefined) => clic
  ? { className: 'cbz-clic', role: 'button', tabIndex: 0, onClick: clic, onKeyDown: (e: { key: string }) => { if (e.key === 'Enter') clic(); } }
  : {};

/** El anillo de Coffer (la geometría de «Mc»: radio 62 en 160, 2,5 de hueco entre arcos, desde arriba). */
function Anillo({ tramos }: { tramos: Array<{ v: number; c: string }> }) {
  const total = tramos.reduce((s, t) => s + t.v, 0) || 1;
  const C = 2 * Math.PI * 62;
  let acum = 0;
  return (
    <svg viewBox="0 0 160 160" aria-hidden>
      <g transform="rotate(-90 80 80)">
        <circle className="d-track" r={62} cx={80} cy={80} />
        {tramos.map((t, i) => {
          const len = Math.max(0, (t.v / total) * C - 2.5);
          const desde = acum;
          acum += (t.v / total) * C;
          return <circle key={i} className="d-arc" r={62} cx={80} cy={80} strokeDasharray={`${len} ${C}`} strokeDashoffset={-desde} style={{ stroke: t.c }} />;
        })}
      </g>
    </svg>
  );
}

export function HojaCobranza({ hoja, datos, extras, hoy, periodo, onGrilla, onFila, compartido, quieta = false }: {
  hoja: Hoja;
  datos: Record<string, DatosPieza>;
  extras: ExtrasCobranza | null;
  hoy: string;
  /** El nombre del período elegido («Este mes completo»): el de la barra de controles de la hoja. */
  periodo: string;
  /** Ver la hoja en su grilla (todas las piezas: la tabla con «Marcar cobrada», quién debe más…). */
  onGrilla?: () => void;
  /** Abrir una fila de una pieza: su detalle de siempre (o su pop-up), como al tocarla en la grilla. */
  onFila?: (g: Grafico, clave: string) => void;
  /** En un link compartido no hay links a otras pantallas (pide sesión). */
  compartido?: boolean;
  /** La miniatura de «Nueva hoja»: sin entrada y sin cifras que cuentan. */
  quieta?: boolean;
}) {
  const v = useMemo(() => vistaCobranza(hoja, datos, hoy), [hoja, datos, hoy]);
  const raiz = useRef<HTMLDivElement>(null);
  const [entro, setEntro] = useState(false);
  const [cuantos, setCuantos] = useState<6 | 12>(12);
  const quien = extras?.quien ?? null;
  const p = hoja.diseno?.piezas ?? {};
  const pieza = (id: string | undefined) => hoja.componentes.find((c): c is Grafico => c.id === id && c.clase === 'grafico');
  const fila = (id: string | undefined, clave: string) => {
    const g = pieza(id);
    return g && onFila ? () => onFila(g, clave) : undefined;
  };
  const nombres = nombresDelPeriodo(periodo);

  // ── La entrada de Coffer: una vez por hoja, al montarse ───────────────────────────────────────────────────
  useLayoutEffect(() => {
    const el = raiz.current;
    setEntro(true);
    if (!el || quieta || sinMovimiento()) return;
    const anim = (n: Element, desde: Keyframe, dur: number, ease: string, delay: number) =>
      (n as HTMLElement).animate([desde, {}], { duration: dur * 1000, easing: ease, delay: delay * 1000, fill: 'backwards' });
    const todos = (s: string) => [...el.querySelectorAll(s)];
    // «co»: cada letra del título, yPercent 115→0 · .85 s power4.out · .022
    todos('.cbz-titulo .cbz-l').forEach((n, i) => anim(n, { transform: 'translateY(115%)' }, 0.85, P4O, i * 0.022));
    // «uo»: las tarjetas, opacity 0, y 34, scale .985 · .85 s power3.out · .06 (desde .1)
    todos('[data-card]').forEach((n, i) => anim(n, { opacity: 0, transform: 'translateY(34px) scale(.985)' }, 0.85, P3O, 0.1 + i * 0.06));
    // «Pc»: cada tramo del atraso, scaleX 0 → su acumulado · .9 s power3.inOut · .04
    todos('.cbz-aging__seg').forEach((n, i) => anim(n, { transform: 'scaleX(0)' }, 0.9, P3IO, 0.1 + i * 0.04));
  }, [hoja.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const titulo = hoja.nombre;
  const deben = v.deben;
  const sub = [periodo, quien?.fecha, deben?.vencidas ? `${deben.vencidas} ${deben.vencidas === 1 ? 'cuota vencida' : 'cuotas vencidas'}` : null].filter(Boolean).join(' · ');
  let acum = 0;
  const hasta = deben ? deben.tramos.map((t) => (acum += t.monto) / (deben.total || 1)) : [];
  const meses = v.meses ? v.meses.slice(-cuantos) : null;
  const maxPago = Math.max(1, ...v.pagaron.map((f) => f.monto));
  const funnel = v.funnel;
  const coloresFunnel = funnel ? funnel.filas.map((f, i) => (f.clave === 'otros' ? 'var(--cat-other)' : CATS[i % CATS.length])) : [];
  const demora = notaDemora(v.demora, periodo);

  const kpis: Array<{ t: string; valor: number | null; formato: (n: number) => string; nota: string | null; mala?: boolean }> = [
    { t: `Cobrado ${nombres.en}`, valor: v.cobrado.valor, formato: plata, nota: notaAnterior(v.cobrado, plata, periodo) },
    { t: `Vence ${nombres.en}`, valor: v.vence.valor, formato: plata, nota: notaAnterior(v.vence, plata, periodo) },
    { t: `Falta cobrar ${nombres.en}`, valor: v.falta.valor, formato: plata, nota: notaAnterior(v.falta, plata, periodo) },
    { t: 'Atraso al pagar', valor: v.demora.valor, formato: textoDemora, nota: demora?.texto ?? null, mala: demora?.peor },
  ];

  return (
    <Quieta.Provider value={quieta}>
    <div className="cbz" ref={raiz} data-antes={entro || quieta ? undefined : ''}>
      <style href="dash-hoja-cobranza" precedence="medium">{CSS_COBRANZA}</style>
      {/* La letra de Coffer (Manrope), sólo para esta hoja. */}
      <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Manrope:wght@200..800&display=swap" precedence="default" />
      <div className="cbz-vista">
        <Parte id="cabecera">
        <div className="cbz-head">
          <div>
            {quien?.nombre && <p className="cbz-hello">{quien.saludo}, {quien.nombre}</p>}
            <h1 className="cbz-titulo" aria-label={titulo}><span className="cbz-w">{[...titulo].map((c, i) => <span key={i} className="cbz-l" aria-hidden>{c}</span>)}</span></h1>
            <p className="cbz-sub">{sub || hoja.subtitulo}</p>
          </div>
          <div className="cbz-acciones">
            {!compartido && <Link className="cbz-btn cbz-btn--ghost" href="/classroom/clients"><Icono id="users" />Ver los clientes</Link>}
            {onGrilla && <button type="button" className="cbz-btn cbz-btn--primary" onClick={onGrilla}><Icono id="grid" />Ver todo en la grilla</button>}
          </div>
        </div>
        </Parte>

        <section className="cbz-fila cbz-fila--top">
          {/* TE DEBEN (era «Owed to you»): todo lo pendiente hoy, lo vencido y la barra por días de atraso. */}
          <Parte id="deben">
          <article className="cbz-card cbz-owed" data-card>
            <div className="cbz-owed__top">
              <div>
                <p className="cbz-lbl">Te deben</p>
                <p className="cbz-owed__big"><Cuenta valor={deben?.total ?? null} formato={plata} demora={0.1} /></p>
                <p className="cbz-owed__sub">
                  {deben ? (deben.cuotas ? `${textoCuotas(deben.cuotas)}${deben.clientes ? ` de ${deben.clientes} ${deben.clientes === 1 ? 'cliente' : 'clientes'}` : ''}` : 'Nada pendiente') : 'Sin cuotas cargadas'}
                </p>
              </div>
              {deben && (
                <div className="cbz-owed__late">
                  <p className="cbz-lbl">Vencido</p>
                  {/* Vencido en CERO no va en rojo (11/11/2026, ws 3): «US$0» rojo alarmaba por nada. */}
                  <p className="cbz-owed__late-n" data-cero={deben.vencido ? undefined : ''}><Cuenta valor={deben.vencido} formato={plata} demora={0.1} /></p>
                  {deben.vencidas > 0 && onGrilla && (
                    <button type="button" className="cbz-btn cbz-btn--rose" onClick={onGrilla}><Icono id="eye" />{deben.vencidas === 1 ? 'Ver la cuota' : `Ver las ${deben.vencidas}`}</button>
                  )}
                </div>
              )}
            </div>
            {deben ? (
              <>
                <div className="cbz-aging" role="img" aria-label="Lo que te deben, por días de atraso">
                  {deben.tramos.map((t, i) => (
                    <span key={t.nombre} className="cbz-aging__seg" style={{ zIndex: 4 - i, background: t.color, transform: `scaleX(${hasta[i] ?? 0})` }} />
                  ))}
                </div>
                <div className="cbz-aging__legend">
                  {deben.tramos.map((t) => (
                    <div key={t.nombre}>
                      <div className="cbz-ag__name"><i className="cbz-sw" style={{ background: t.color }} />{t.nombre}</div>
                      <div className="cbz-ag__val">{plata(t.monto)}</div>
                      <div className="cbz-ag__n">{textoCuotas(t.cuotas)}</div>
                    </div>
                  ))}
                </div>
              </>
            ) : <p className="cbz-vacio">Cuando cargues los planes de pago de tus clientes, aquí ves lo que te deben.</p>}
          </article>
          </Parte>
          <Parte id="kpis">
          <div className="cbz-kpis">
            {kpis.map((k) => (
              <article key={k.t} className="cbz-card cbz-kpi" data-card>
                <p className="cbz-lbl">{k.t}</p>
                <p className="cbz-kpi__val"><Cuenta valor={k.valor} formato={k.formato} demora={0.1} /></p>
                {k.nota && <p className={`cbz-kpi__note${k.mala ? ' cbz-kpi__note--bad' : ''}`}>{k.nota}</p>}
              </article>
            ))}
          </div>
          </Parte>
        </section>

        <section className="cbz-fila cbz-fila--mid">
          {/* LO QUE VENCÍA CADA MES (era «Cash flow»): de lo que vencía, lo que entró arriba y lo que sigue sin pagar abajo. */}
          <Parte id="meses">
          <article className="cbz-card cbz-flow" data-card>
            <div className="cbz-card__h">
              <div>
                <h2 className="cbz-card__t">Lo que vencía cada mes</h2>
                <p className="cbz-flow__sub">Lo que entró, arriba de la línea; lo que sigue sin pagar, abajo.</p>
              </div>
              <SelectorMeses cuantos={cuantos} onCambio={setCuantos} />
            </div>
            <div className="cbz-legend"><span><i className="cbz-sw" style={{ background: 'var(--c-in)' }} />Entró</span><span><i className="cbz-sw" style={{ background: 'var(--c-out)' }} />Sin pagar</span></div>
            {meses && meses.some((m) => m.entro || m.sinPagar)
              ? <Flujo meses={meses} etiqueta="Lo que vencía cada mes" />
              : <p className="cbz-vacio">Todavía no hay cuotas en estos meses.</p>}
          </article>
          </Parte>

          {/* A QUIÉN PERSEGUIR (era «Due soon»): el más atrasado arriba; «Ver cuota» abre su detalle, con «Marcar cobrada». */}
          <Parte id="perseguir">
          <article className="cbz-card" data-card>
            <div className="cbz-card__h"><h2 className="cbz-card__t">A quién perseguir</h2>{onGrilla && <button type="button" className="cbz-link" onClick={onGrilla}>Ver todas</button>}</div>
            {v.perseguir.length ? (
              <ul className="cbz-due-list">
                {v.perseguir.map((f) => {
                  const dias = textoDeDias(f.dias);
                  const clic = fila(p.perseguir, f.clave);
                  return (
                    <li key={f.clave} className="cbz-due">
                      <span className={`cbz-avatar ${dias?.tarde ? 'cbz-av-rose' : 'cbz-av-teal'}`}>{iniciales(f.nombre)}</span>
                      <Toque className="cbz-due__main" onClick={clic}>
                        <b>{f.nombre}</b>
                        <small>{f.cuota}{f.cuota && dias ? ' · ' : ''}{dias && <em className={dias.tarde ? undefined : 'cbz-a-tiempo'}>{dias.texto}</em>}</small>
                      </Toque>
                      <span className="cbz-due__amt">{f.monto == null ? '—' : plata(f.monto, true)}</span>
                      {clic && <button type="button" className="cbz-btn cbz-btn--soft" onClick={clic}><Icono id="eye" />Ver cuota</button>}
                    </li>
                  );
                })}
              </ul>
            ) : <p className="cbz-vacio">Nadie te debe una cuota ahora.</p>}
          </article>
          </Parte>
        </section>

        <section className="cbz-fila cbz-fila--bot">
          {/* LO ÚLTIMO QUE ENTRÓ (era «Latest»): cada cuota cobrada en los últimos 30 días, la más nueva arriba. */}
          <Parte id="ultimos">
          <article className="cbz-card" data-card>
            <h2 className="cbz-card__t">Lo último que entró</h2>
            {v.ultimos.length ? (
              <ul className="cbz-feed">
                {v.ultimos.map((f) => {
                  const clic = fila(p.ultimos, f.clave);
                  return (
                    <li key={f.clave}>
                      <span className="cbz-feed__ic"><Icono id="cash" /></span>
                      <Toque className="cbz-feed__text" onClick={clic}>
                        {f.nombre} pagó {f.cuota ? `la ${f.cuota.toLowerCase()}` : 'una cuota'}<small>{rotuloDia(f.dia, hoy)}</small>
                      </Toque>
                      <span className="cbz-feed__amt">+{plata(f.monto, true)}</span>
                    </li>
                  );
                })}
              </ul>
            ) : <p className="cbz-vacio">No entró ninguna cuota en los últimos 30 días.</p>}
          </article>
          </Parte>

          {/* LOS QUE MÁS PAGARON (era «Top clients»): los últimos 12 meses. */}
          <Parte id="pagaron">
          <article className="cbz-card" data-card>
            <div className="cbz-card__h"><h2 className="cbz-card__t">Los que más pagaron</h2><span className="cbz-meta">Últimos 12 meses</span></div>
            {v.pagaron.length ? (
              <ul className="cbz-hbars">
                {v.pagaron.map((f) => {
                  const clic = fila(p.pagaron, f.clave);
                  return (
                    <li key={f.clave} {...tocable(clic)}>
                      <div className="cbz-hbar__row"><span>{f.nombre}</span><b>{plata(f.monto)}</b></div>
                      <div className="cbz-hbar__track"><div className="cbz-hbar__fill" style={{ width: `${(f.monto / maxPago) * 100}%` }} /></div>
                    </li>
                  );
                })}
              </ul>
            ) : <p className="cbz-vacio">Nadie pagó una cuota en los últimos 12 meses.</p>}
          </article>
          </Parte>

          {/* PENDIENTE POR FUNNEL (era «Spending»): en qué oferta está la plata que falta, con el anillo. */}
          <Parte id="funnel">
          <article className="cbz-card" data-card>
            <div className="cbz-card__h"><h2 className="cbz-card__t">Pendiente por funnel</h2><span className="cbz-meta">{periodo}</span></div>
            {funnel && funnel.filas.length ? (
              <div className="cbz-spend">
                <div className="cbz-donut">
                  <Anillo tramos={funnel.filas.map((f, i) => ({ v: f.monto, c: coloresFunnel[i] }))} />
                  <div className="cbz-donut__centre"><b>{plataCorta(funnel.total)}</b><small>pendiente</small></div>
                </div>
                <ul className="cbz-spend__list">
                  {funnel.filas.map((f, i) => {
                    const clic = f.clave === 'otros' ? undefined : fila(p.funnel, f.clave);
                    return (
                      <li key={f.clave} {...tocable(clic)}>
                        <i className="cbz-sw" style={{ background: coloresFunnel[i] }} /><span>{f.nombre}</span><b>{plata(f.monto)}</b>
                      </li>
                    );
                  })}
                </ul>
              </div>
            ) : <p className="cbz-vacio">No hay nada pendiente en este período.</p>}
          </article>
          </Parte>
        </section>
      </div>
    </div>
    </Quieta.Provider>
  );
}
