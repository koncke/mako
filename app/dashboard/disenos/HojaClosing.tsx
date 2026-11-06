'use client';

// =============================================================================
// HojaClosing — la hoja Closing con su DISEÑO PROPIO: la copia de Halden, con los datos reales de MaKo
// =============================================================================
// Martín, 4/11/2026, al rechazar las 20 hojas iguales: «que sea primero la copia, es decir, que se vea exactamente igual
// que la copia, y después la adaptación con Maco… copiarlo todo, desde las animaciones de entrada, las animaciones de
// hover, las animaciones de clic». La copia y la adaptación (maquetas) están en docs/diseno/mockups-dashboard/closing/;
// ésta es la adaptación con los datos de verdad:
//   · los números salen de los componentes de la hoja (los de la grilla), por las piezas de `hoja.diseno`
//     (lib/closing-diseno.ts arma lo que dibuja cada bloque, con test);
//   · la agenda (las barras rayadas y «Próxima llamada») sale de las llamadas de venta del CRM y la trae la página
//     (lib/closing-diseno-server.ts). Sin ella, esos bloques dicen que no hay: no inventan;
//   · lo que ve MaKo es la caja de IA de siempre (`cl-factores-ia`), leída con su GET (el closer la lee por ese id).
//
// El movimiento es el de Halden, medido en su INFORME (docs/diseno/mockups-dashboard/demos/halden/INFORME.txt) y
// escrito con Element.animate: las tarjetas escalonadas, las cifras que cuentan, la meta y el embudo que crecen, las
// barras y su etiqueta, la leyenda, las filas y lo de MaKo. Lo que el INFORME no trae no se inventó (el relevo lo nombra).
//
// ⚠️ La hoja de estilos (./closing-css.ts) es SÓLO de esta hoja: otra hoja con diseño copia SU demo.
// ⚠️ Mirando se dibuja esto; editando, la grilla con los mismos componentes (app/dashboard/EditorInforme.tsx).
// =============================================================================

import { createContext, useContext, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import Link from '@/app/_ui/Link';
import type { Grafico, Hoja } from '@/lib/graficos-catalogo';
import { conNombres } from '@/lib/graficos-analisis';
import type { VistaCaja } from '@/lib/graficos-ia-elemento';
import { cuandoEs, relojDe, rotuloDelDia, vistaClosing, type AgendaClosing, type ContactoClosing, type DatosPieza, type FilaLlamada } from '@/lib/closing-diseno';
import { duracionLegible } from '@/lib/primer-contacto';
import { ReportarASoporte } from '@/app/_ui/ReportarASoporte';
import { leerCaja } from '../ElementoIA';
import { CSS_CLOSING } from './closing-css';

/** Quién mira, para el saludo de Halden («Good morning, Amara»). La arma la página (app/dashboard/page.tsx). */
export type QuienMira = { saludo: string; nombre: string; fecha: string };
/** `contacto` (5/11/2026): la tarjeta «Primer contacto». Sin él (el closer, el setter, un link compartido, la miniatura), no se dibuja. */
export type ExtrasClosing = { agenda: AgendaClosing | null; quien: QuienMira | null; contacto?: ContactoClosing | null };

// Las curvas de GSAP de Halden, traducidas (las mismas de docs/diseno/mockups-dashboard/movimiento.css).
const P4O = 'cubic-bezier(.165,.84,.44,1)';
const P3O = 'cubic-bezier(.215,.61,.355,1)';
const P3IO = 'cubic-bezier(.645,.045,.355,1)';
const B2 = 'cubic-bezier(.34,1.56,.64,1)';

const entero = (n: number) => Math.round(n).toLocaleString('es-MX');
const decimal = (n: number) => n.toLocaleString('es-MX', { minimumFractionDigits: 1, maximumFractionDigits: 1 });
const ordinal = (r: string | null) => (r === 'R2' ? '2.ª llamada' : r === 'R1' ? '1.ª llamada' : r ?? 'Llamada');
const iniciales = (s: string) => [...s.trim().split(/\s+/).slice(0, 2).map((p) => [...p][0] ?? '')].join('').toUpperCase() || '·';
const TONOS_TILE = ['hc-t-cyan', 'hc-t-rose', 'hc-t-violet', 'hc-t-amber', 'hc-t-blue'];
const AVATARES = ['#f3cdb8', '#f6e5b9', '#cfe0f6', '#d6efd6', '#f1dcf2'];
const COLOR_SEGMENTO = { r1: 'var(--st-2)', r2: 'var(--st-4)', sin: 'var(--st-1)', perdida: 'var(--rosa-st)' } as const;

/**
 * QUIETA: la hoja dibujada como miniatura de «Nueva hoja» (./MiniaturaHoja.tsx, 4/11/2026): la misma hoja, sin la entrada, sin
 * cifras que cuentan y sin el reloj que rueda (en una galería eso sería movimiento y trabajo por cada tarjeta).
 */
const Quieta = createContext(false);

/** Una cifra que cuenta («lo» de Halden: 1.3 s power3.out; al cambiar, desde la de antes). */
function Cuenta({ valor, formato, demora = 0 }: { valor: number | null; formato: (n: number) => string; demora?: number }) {
  const ref = useRef<HTMLSpanElement>(null);
  const antes = useRef<number | null>(null);
  const quieta = useContext(Quieta);
  useEffect(() => {
    const el = ref.current;
    if (!el || valor == null) return;
    const desde = antes.current ?? 0;
    antes.current = valor;
    if (quieta || matchMedia('(prefers-reduced-motion: reduce)').matches || desde === valor) { el.textContent = formato(valor); return; }
    const t0 = performance.now() + demora * 1000;
    let id = 0;
    const paso = (ahora: number) => {
      const t = Math.min(1, Math.max(0, (ahora - t0) / 1300));
      el.textContent = formato(desde + (valor - desde) * (1 - Math.pow(1 - t, 3)));
      if (t < 1) id = requestAnimationFrame(paso);
    };
    el.textContent = formato(desde);
    id = requestAnimationFrame(paso);
    return () => cancelAnimationFrame(id);
  }, [valor, formato, demora, quieta]);
  return <span ref={ref}>{valor == null ? '—' : formato(valor)}</span>;
}

/** El reloj de dígitos que ruedan (sc de Halden: yPercent −10·n, .55 s power3.out): arranca en cero y rueda al segundo. */
function Reloj({ minutos }: { minutos: number | null }) {
  const cols = useRef<Array<HTMLSpanElement | null>>([]);
  const [hh, mm, ss] = relojDe(minutos);
  const digitos = `${String(hh).padStart(2, '0')}${String(mm).padStart(2, '0')}${String(ss).padStart(2, '0')}`.split('').map(Number);
  const quieta = useContext(Quieta);
  useEffect(() => {
    const quieto = quieta || matchMedia('(prefers-reduced-motion: reduce)').matches;
    const pon = (anim: boolean) => cols.current.forEach((c, i) => {
      if (!c) return;
      const y = `translateY(${-10 * digitos[i]}%)`;
      if (anim && !quieto) c.animate([{ transform: c.style.transform || 'translateY(0%)' }, { transform: y }], { duration: 550, easing: P3O });
      c.style.transform = y;
    });
    if (quieto) { pon(false); return; }
    const t = setTimeout(() => pon(true), 1000);
    return () => clearTimeout(t);
  }, [digitos.join('')]); // eslint-disable-line react-hooks/exhaustive-deps
  const col = (i: number) => (
    <span className="hc-dg"><span className="hc-dg__col" ref={(el) => { cols.current[i] = el; }}>{[0, 1, 2, 3, 4, 5, 6, 7, 8, 9].map((n) => <span key={n}>{n}</span>)}</span></span>
  );
  return (
    <div className="hc-dialer__clock" aria-label={minutos == null ? 'Sin duración' : `Duración promedio ${mm} minutos ${ss} segundos`}>
      {col(0)}{col(1)}<span className="hc-colon">:</span>{col(2)}{col(3)}<span className="hc-colon">:</span>{col(4)}{col(5)}
    </div>
  );
}

function Icono({ d, className = 'hc-ic' }: { d: string; className?: string }) {
  return <svg className={className} viewBox="0 0 24 24" aria-hidden><path d={d} /></svg>;
}
const I = {
  flecha: 'M8 16L16 8M9.5 8H16v6.5',
  calendario: 'M3.5 5h17v15.5h-17zM3.5 10h17M8 3v4M16 3v4',
  grilla: 'M3.5 3.5h7v7h-7zM13.5 3.5h7v7h-7zM3.5 13.5h7v7h-7zM13.5 13.5h7v7h-7z',
  video: 'M3 6.5h12.5v11H3zM15.5 10.5L21 7.5v9l-5.5-3',
  chispa: 'M12 3.5l1.9 5.1L19 10.5l-5.1 1.9L12 17.5l-1.9-5.1L5 10.5l5.1-1.9zM19 3v3M20.5 4.5h-3',
  reloj: 'M12 3.5a8.5 8.5 0 1 0 0 17a8.5 8.5 0 1 0 0-17M12 7.5V12l3 2',
  sube: 'M6 15l6-6 6 6',
};

/**
 * EL PRIMER CONTACTO (5/11/2026, lo que Martín le prometió a Código Inmobiliario; Halden no lo tiene): cuánto tarda una persona en
 * escribirle o llamar a un lead nuevo, SIN lo automático (lib/primer-contacto.ts). La mediana y no un promedio (uno de diez días lo
 * arrastra todo); «Sin contactar» no cuenta a los que entraron hace menos de una hora: todavía están a tiempo.
 */
function CuerpoContacto({ c, compartido }: { c: Extract<ContactoClosing, { resumen: unknown }>; compartido?: boolean }) {
  const r = c.resumen;
  const pct = r.baseLaPrimeraHora ? Math.round((r.enLaPrimeraHora / r.baseLaPrimeraHora) * 100) : null;
  const sinContactar = Math.max(0, r.sinContactar - r.aTiempo);
  return (
    <div className="hc-contacto">
      <div>
        <div className="hc-big">
          <span className="hc-big__n">{duracionLegible(r.medianaMinutos) ?? '—'}</span>
          <span className="hc-big__s">{r.contactados ? <>mediana de <b>{entero(r.contactados)}</b> {r.contactados === 1 ? 'lead contactado' : 'leads contactados'}</> : 'Todavía nadie los contactó'}</span>
        </div>
        <dl className="hc-contacto__stats">
          <div><dt>En la primera hora</dt><dd>{pct == null ? '—' : `${pct}%`}</dd></div>
          <div><dt>Sin contactar</dt><dd>{entero(sinContactar)}</dd></div>
          <div><dt>Los más lentos</dt><dd>{duracionLegible(r.p90Minutos) ?? '—'}</dd></div>
        </dl>
      </div>
      {c.esperaron.length > 0 && (
        <ul className="hc-deals">
          {c.esperaron.map((e, i) => {
            const fila = (
              <>
                <span className={`hc-tile ${e.estado === 'sin_contactar' ? 'hc-t-rose' : TONOS_TILE[i % TONOS_TILE.length]}`}>{[...e.nombre.trim()][0]?.toUpperCase() ?? '·'}</span>
                <div className="hc-ditem__b">
                  <p className="hc-ditem__n">{e.nombre}</p>
                  <p className="hc-ditem__m">{e.estado === 'sin_contactar' ? 'Nadie lo contactó todavía' : 'Lo contactaron'}</p>
                </div>
                <p className="hc-ditem__v">{duracionLegible(e.minutos)}<small>{e.estado === 'sin_contactar' ? 'esperando' : 'después'}</small></p>
              </>
            );
            return (
              <li key={e.id} className={`hc-ditem${compartido ? '' : ' hc-ditem--clic'}`}>
                {compartido ? fila : <Link href={`/crm?lead=${e.id}`} className="hc-contacto__fila">{fila}</Link>}
              </li>
            );
          })}
        </ul>
      )}
      {r.noSeSabe > 0 && <p className="hc-contacto__nota">{entero(r.noSeSabe)} sin saber quién les escribió primero: son de antes de que MaKo separara lo automático.</p>}
    </div>
  );
}

/** Lo que ve MaKo: la caja de IA de la hoja, leída con su GET de siempre (nunca genera al abrir). */
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

export function HojaClosing({ hoja, datos, extras, hoy, periodo, onGrilla, onLlamada, compartido, quieta = false }: {
  hoja: Hoja;
  datos: Record<string, DatosPieza>;
  extras: ExtrasClosing | null;
  hoy: string;
  /** El nombre del período elegido («Últimos 30 días»): el de la barra de controles de la hoja. */
  periodo: string;
  /** Ver la hoja en su grilla (todas las piezas: los factores, la tabla de llamadas…). */
  onGrilla?: () => void;
  /** Abrir una llamada: el pop-up de siempre de la tabla. */
  onLlamada?: (g: Grafico, clave: string) => void;
  /** En un link compartido no se lee la caja de IA (pide sesión). */
  compartido?: boolean;
  /** La miniatura de «Nueva hoja»: sin entrada, sin cifras que cuentan y sin leer la caja de IA. */
  quieta?: boolean;
}) {
  const v = useMemo(() => vistaClosing(hoja, datos, extras?.agenda ?? null, hoy), [hoja, datos, extras, hoy]);
  const raiz = useRef<HTMLDivElement>(null);
  // Las tarjetas arrancan ocultas hasta que corre la entrada (si no, se verían un cuadro antes de animarse).
  const [entro, setEntro] = useState(false);
  const caja = useCaja(hoja.id, compartido || quieta ? undefined : hoja.diseno?.piezas.ia);
  const tablaUltimas = hoja.componentes.find((c): c is Grafico => c.id === hoja.diseno?.piezas.ultimas && c.clase === 'grafico');
  const quien = extras?.quien ?? null;
  const contacto = extras?.contacto ?? null;
  const tz = extras?.agenda?.tz ?? 'UTC';
  const [ahora, setAhora] = useState<number | null>(null);
  useEffect(() => { setAhora(Date.now()); const t = setInterval(() => setAhora(Date.now()), 60_000); return () => clearInterval(t); }, []);

  // ── La entrada de Halden (vc): una vez por hoja, al montarse ──────────────────────────────────────────────
  useLayoutEffect(() => {
    const el = raiz.current;
    setEntro(true);
    if (!el || quieta || matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const anim = (n: Element, desde: Keyframe, dur: number, ease: string, delay: number) =>
      (n as HTMLElement).animate([desde, {}], { duration: dur * 1000, easing: ease, delay: delay * 1000, fill: 'backwards' });
    const todos = (s: string) => [...el.querySelectorAll(s)];
    // 0 · el título, letra por letra (io: yPercent 115→0 · .85 s power4.out · .024)
    todos('.hc-titulo .hc-l').forEach((n, i) => anim(n, { transform: 'translateY(115%)' }, 0.85, P4O, i * 0.024));
    // .10 · las tarjetas (oo: opacity, y 36, scale .985 · .85 s power3.out · .06)
    todos('[data-card]').forEach((n, i) => anim(n, { opacity: 0, transform: 'translateY(36px) scale(.985)' }, 0.85, P3O, 0.1 + i * 0.06));
    // .50 · la meta (Ts con t: demora .15 · 1.4 s power3.out)
    todos('.hc-goal__fill').forEach((n) => anim(n, { transform: 'scaleX(0)' }, 1.4, P3O, 0.5));
    // .45 · la barra del embudo (1.1 s power3.inOut)
    todos('.hc-stages').forEach((n) => anim(n, { transform: 'scaleX(0)' }, 1.1, P3IO, 0.45));
    // .50 · las barras (Vs: yPercent 101→0 · 1 s power4.out · .07) y su etiqueta a .55 de Vs (back.out(2))
    todos('.hc-bar__fill').forEach((n, i) => anim(n, { transform: 'translateY(101%)' }, 1, P4O, 0.5 + i * 0.07));
    todos('.hc-tip').forEach((n) => anim(n, { opacity: 0, scale: '.8' }, 0.4, B2, 1.05));
    // .60 · la leyenda (so: y 8 · .05), las filas (x 14 · .045) · .75 · lo de MaKo (y 10 · .07)
    todos('[data-leg]').forEach((n, i) => anim(n, { opacity: 0, transform: 'translateY(8px)' }, 0.55, P3O, 0.6 + i * 0.05));
    todos('.hc-ditem').forEach((n, i) => anim(n, { opacity: 0, transform: 'translateX(14px)' }, 0.55, P3O, 0.6 + i * 0.045));
    todos('.hc-aitem').forEach((n, i) => anim(n, { opacity: 0, transform: 'translateY(10px)' }, 0.55, P3O, 0.75 + i * 0.07));
  }, [hoja.id]);

  // ── La etiqueta de las barras: sigue a la que se señala (Bs: .45 s power3.out) ─────────────────────────────
  const barras = useRef<HTMLDivElement>(null);
  const tip = useRef<HTMLSpanElement>(null);
  const semana = v.semana;
  const iTip = semana ? Math.max(0, semana.dias.reduce((m, d, i, a) => ((d.valor ?? -1) > (a[m].valor ?? -1) ? i : m), 0)) : 0;
  const [tipI, setTipI] = useState(iTip);
  const ubicar = (i: number, anim: boolean) => {
    const caja = barras.current, t = tip.current;
    const fill = caja?.querySelectorAll<HTMLElement>('.hc-bar__fill')[i];
    if (!caja || !t || !fill) return;
    // offsetLeft/offsetTop no ven los transform: la etiqueta va sobre la barra YA crecida aunque esté entrando.
    const x = caja.offsetLeft + fill.offsetLeft + fill.offsetWidth / 2 - t.offsetWidth / 2;
    const y = caja.offsetTop + fill.offsetTop - t.offsetHeight - 10;
    const de = t.style.transform;
    t.style.transform = `translate(${x}px,${y}px)`;
    if (anim && de && !matchMedia('(prefers-reduced-motion: reduce)').matches) t.animate([{ transform: de }, { transform: t.style.transform }], { duration: 450, easing: P3O });
  };
  useLayoutEffect(() => { ubicar(tipI, false); }); // cada render: el ancho del lienzo y los datos cambian
  const dTip = semana?.dias[tipI];
  const textoTip = dTip ? (dTip.tipo === 'agenda' ? `${dTip.valor ?? 0} agendadas` : `${dTip.valor ?? 0} ${dTip.valor === 1 ? 'llamada' : 'llamadas'}`) : '';
  const maxBarra = semana ? Math.max(1, ...semana.dias.map((d) => d.valor ?? 0)) : 1;

  const titulo = quien?.nombre ? `${quien.saludo}, ${quien.nombre}` : hoja.nombre;
  const proxima = v.proxima;
  const cuando = proxima && ahora != null ? cuandoEs(proxima, ahora, hoy, tz) : null;
  const horaProxima = proxima && !proxima.diaCompleto
    ? new Intl.DateTimeFormat('es-MX', { timeZone: tz, hour: '2-digit', minute: '2-digit', hour12: false }).format(new Date(proxima.inicio))
    : null;
  const tasa = v.tasa.valor;
  const deCierre = v.cierres.de;
  const sinCerrar = deCierre != null && v.cierres.ganadas != null ? Math.max(0, deCierre - v.cierres.ganadas) : null;
  const puntos = caja.vista?.ultimo?.salida.puntos ?? [];
  const nombres = caja.vista?.ultimo?.nombres ?? {};
  const resumen = caja.vista?.ultimo ? conNombres(caja.vista.ultimo.salida.resumen, nombres) : '';
  const clicFila = (f: FilaLlamada) => (tablaUltimas && onLlamada ? () => onLlamada(tablaUltimas, f.clave) : undefined);

  return (
    <Quieta.Provider value={quieta}>
    <div className="hc" ref={raiz} data-antes={entro || quieta ? undefined : ''}>
      <style href="dash-hoja-closing" precedence="medium">{CSS_CLOSING}</style>
      {/* La letra de Halden (Manrope), sólo para esta hoja. */}
      <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Manrope:wght@500;600;700;800&display=swap" precedence="default" />
      <div className="hc-vista">
        <div className="hc-cab">
          <div>
            <p className="hc-eyebrow">{[periodo, quien?.fecha].filter(Boolean).join(' · ')}</p>
            <h1 className="hc-titulo" aria-label={titulo}>{[...titulo].map((c, i) => <span key={i} className="hc-l" aria-hidden>{c}</span>)}</h1>
            <p className="hc-bajada">{hoja.subtitulo || 'Así van tus llamadas de venta.'}</p>
          </div>
          <div className="hc-cab__btns">
            {!compartido && <Link className="hc-btn hc-btn--ghost" href="/calendario"><Icono d={I.calendario} />Ver la agenda</Link>}
            {onGrilla && <button type="button" className="hc-btn hc-btn--primary" onClick={onGrilla}><Icono d={I.grilla} /><span>Ver todo<span className="hc-solo-compu"> en la grilla</span></span></button>}
          </div>
        </div>

        <section className="hc-grid">
          {/* LA TASA DE CIERRE (era «Revenue won»): el ancla, con su diferencia; a la derecha, analizadas, score y ganadas. */}
          <article className="hc-card hc-hero hc-c7 hc-o-1" data-card>
            <div className="hc-hero__main">
              <div className="hc-hero__h">
                <div>
                  <p className="hc-hero__t">Tasa de cierre</p>
                  <p className="hc-hero__num"><Cuenta valor={tasa} formato={(n) => `${Math.round(n)}%`} demora={0.35} /></p>
                  <p className="hc-hero__delta">
                    {v.tasa.delta != null
                      ? <><span className="hc-pill-up" style={v.tasa.delta < 0 ? { background: '#fdeceb', color: '#9c2f2f' } : undefined}>{Math.abs(v.tasa.delta)} pts <Icono d={I.sube} className="hc-ic hc-ic--chica" /></span>{v.tasa.delta < 0 ? 'menos que el período anterior' : 'sobre el período anterior'}</>
                      : <span>Ganadas sobre las llamadas de cierre</span>}
                  </p>
                </div>
                {!compartido && <Link className="hc-arrow" href="/crm" aria-label="Abrir el CRM"><Icono d={I.flecha} /></Link>}
              </div>
              <div className="hc-hero__goal">
                <div className="hc-goal"><div className="hc-goal__fill" style={{ width: `${Math.max(0, Math.min(100, tasa ?? 0))}%` }} /></div>
                <div className="hc-goal__row">
                  <span>{deCierre != null && v.cierres.ganadas != null ? <><b>{entero(v.cierres.ganadas)}</b> de {entero(deCierre)} llamadas<span className="hc-solo-compu"> de cierre</span> terminaron en venta</> : 'Sin llamadas de cierre en el período'}</span>
                  {sinCerrar != null && <span>{entero(sinCerrar)} sin cerrar</span>}
                </div>
              </div>
            </div>
            <dl className="hc-hero__stats">
              <div className="hc-stat"><dt>Analizadas</dt><dd><Cuenta valor={v.stats.analizadas} formato={entero} demora={0.35} /></dd></div>
              <div className="hc-stat"><dt>Score</dt><dd><Cuenta valor={v.stats.puntaje} formato={decimal} demora={0.35} /></dd></div>
              <div className="hc-stat"><dt>Ganadas</dt><dd><Cuenta valor={v.stats.ganadas} formato={entero} demora={0.35} /></dd></div>
            </dl>
          </article>

          {/* CÓMO TERMINARON (era «Open pipeline»): las llamadas partidas por desenlace. */}
          <article className="hc-card hc-c5 hc-o-2" data-card>
            <div className="hc-card__h"><h2 className="hc-card__t">Cómo terminaron</h2>{!compartido && <Link className="hc-link" href="/crm">Ver en el CRM</Link>}</div>
            {v.desenlace?.llamadas ? (
              <>
                <div className="hc-big">
                  <span className="hc-big__n"><Cuenta valor={v.desenlace.llamadas} formato={entero} demora={0.35} /></span>
                  <span className="hc-big__s">llamadas · <b>{entero(v.desenlace.ganadas ?? 0)}</b> ganadas · <b>{entero(v.desenlace.perdidas ?? 0)}</b> perdidas</span>
                </div>
                <div className="hc-stages" aria-hidden>
                  {v.desenlace.segmentos.map((s) => <i key={s.id} style={{ flex: s.n, background: COLOR_SEGMENTO[s.id] }} />)}
                </div>
                <div className="hc-legend">
                  {v.desenlace.segmentos.map((s) => (
                    <div key={s.id} className="hc-leg" data-leg><i style={{ background: COLOR_SEGMENTO[s.id] }} /><span>{s.nombre}</span><b>{entero(s.n)}</b><small>{s.pct}% de las llamadas</small></div>
                  ))}
                </div>
              </>
            ) : <p className="hc-vacio">Todavía no hay llamadas analizadas en este período.</p>}
          </article>

          {/* LAS LLAMADAS DE LA SEMANA (era «Revenue this week»): hechas hasta hoy y, rayadas, las agendadas. */}
          <article className="hc-card hc-rev hc-c5 hc-o-4" data-card>
            <div className="hc-card__h">
              <div>
                <h2 className="hc-card__t">Llamadas de esta semana</h2>
                <p className="hc-card__s">{semana ? `${entero(semana.hechas)} analizadas hasta hoy${extras?.agenda ? ` · ${entero(semana.agendadas)} agendadas` : ''}` : 'Sin datos de la semana'}</p>
              </div>
              <div className="hc-legend-mini"><span><i className="hc-sw" />Analizadas</span>{extras?.agenda && <span><i className="hc-sw hc-sw--hatch" />Agendadas</span>}</div>
            </div>
            {semana ? (
              <div className="hc-bars" ref={barras}>
                {semana.dias.map((d, i) => (
                  <div key={d.dia} className={`hc-bar${d.tipo === 'hoy' ? ' hc-bar--hoy' : d.tipo === 'agenda' ? ' hc-bar--plan' : ''}`}
                    onPointerEnter={() => { setTipI(i); ubicar(i, true); }}>
                    <div className="hc-bar__track"><div className="hc-bar__fill" style={{ height: `${Math.max(d.valor ? 6 : 0, Math.round(((d.valor ?? 0) / maxBarra) * 86))}%` }} /></div>
                    <span className="hc-bar__l">{d.etiqueta}</span>
                  </div>
                ))}
              </div>
            ) : <p className="hc-vacio">Sin datos de la semana.</p>}
            {semana && <span className="hc-tip" ref={tip} aria-hidden>{textoTip}</span>}
          </article>

          {/* LAS ÚLTIMAS LLAMADAS (era «Hot deals»): de la más nueva a la más vieja; un clic abre su ficha. */}
          <article className="hc-card hc-c4 hc-o-5" data-card>
            <div className="hc-card__h"><h2 className="hc-card__t">Últimas llamadas</h2>{onGrilla && <button type="button" className="hc-link" onClick={onGrilla}>Ver todas</button>}</div>
            {v.ultimas.length ? (
              <ul className="hc-deals">
                {v.ultimas.map((f, i) => {
                  const clic = clicFila(f);
                  return (
                    <li key={`${f.ref ?? f.nombre}-${i}`} className={`hc-ditem${i >= 4 ? ' hc-solo-tel' : ''}${clic ? ' hc-ditem--clic' : ''}`} onClick={clic}
                      role={clic ? 'button' : undefined} tabIndex={clic ? 0 : undefined} onKeyDown={clic ? (e) => { if (e.key === 'Enter') clic(); } : undefined}>
                      <span className={`hc-tile ${TONOS_TILE[i % TONOS_TILE.length]}`}>{[...f.nombre.trim()][0]?.toUpperCase() ?? '·'}</span>
                      <div className="hc-ditem__b">
                        <p className="hc-ditem__n">{f.nombre}</p>
                        <p className="hc-ditem__m"><i style={{ background: f.reunion === 'R2' ? 'var(--st-4)' : 'var(--st-2)' }} />{[ordinal(f.reunion), f.closer].filter(Boolean).join(' · ')}</p>
                      </div>
                      <p className="hc-ditem__v">{f.puntaje == null ? '—' : decimal(f.puntaje)}<small>{f.duracion == null ? '' : `${entero(f.duracion)} min`}</small></p>
                    </li>
                  );
                })}
              </ul>
            ) : <p className="hc-vacio">No hubo llamadas en los últimos 14 días.</p>}
          </article>

          {/* LA PRÓXIMA LLAMADA (era «Next up»): la que sigue en la agenda del CRM. */}
          <article className="hc-card hc-nextup hc-c3 hc-o-3" data-card>
            <div className="hc-card__h"><h2 className="hc-card__t">Próxima llamada</h2>{cuando && <span className="hc-chip hc-chip--soft">{cuando}</span>}</div>
            {proxima ? (
              <>
                <p className="hc-nextup__t">{ordinal(proxima.cual)} con {proxima.nombre}</p>
                <p className="hc-nextup__s">{[rotuloDelDia(proxima.inicio, hoy, tz), horaProxima ?? 'Sin hora cargada', proxima.closer].filter(Boolean).join(' · ')}</p>
              </>
            ) : <p className="hc-vacio">{extras?.agenda ? 'No hay llamadas agendadas.' : 'La agenda se ve desde el Calendario.'}</p>}
            {!compartido && <Link className="hc-join" href="/calendario"><Icono d={I.video} />Ver en el calendario</Link>}
          </article>

          {/* CADA CLOSER (era «Quota this quarter»): su tasa de cierre, de la más alta a la más baja. */}
          <article className="hc-card hc-c5 hc-o-7" data-card>
            <div className="hc-card__h"><h2 className="hc-card__t">Tasa de cierre por closer</h2>{onGrilla && <button type="button" className="hc-link" onClick={onGrilla}>Ver el equipo</button>}</div>
            {v.closers.length ? (
              <ul className="hc-quota">
                {v.closers.map((c, i) => {
                  const tu = !!quien?.nombre && c.nombre.trim().split(/\s+/)[0]?.toLowerCase() === quien.nombre.toLowerCase();
                  return (
                    <li key={c.nombre} className="hc-lrow">
                      <span className="hc-ava" style={{ background: AVATARES[i % AVATARES.length] }}>{iniciales(c.nombre)}</span>
                      <span className="hc-lrow__n">{c.nombre}{tu && <span className="hc-you">Tú</span>}</span>
                      <span className="hc-lrow__v">{c.tasa == null ? '—' : `${Math.round(c.tasa)}%`} <span>{c.ganadas != null && c.llamadas != null ? `· ${entero(c.ganadas)} de ${entero(c.llamadas)}` : ''}</span></span>
                      <span className="hc-meter"><i className="hc-meter__fill" style={{ display: 'block', width: `${Math.max(0, Math.min(100, c.tasa ?? 0))}%` }} /></span>
                    </li>
                  );
                })}
              </ul>
            ) : <p className="hc-vacio">Todavía no hay closers con llamadas en este período.</p>}
          </article>

          {/* LO QUE VE MaKo (era «Assist»): las conclusiones de la caja de IA de la hoja. */}
          <article className="hc-card hc-c4 hc-o-6" data-card>
            <div className="hc-card__h">
              <div className="hc-assist__h"><span className="hc-assist__ic"><Icono d={I.chispa} /></span><h2 className="hc-card__t">Qué decide tus cierres</h2></div>
              {puntos.length > 0 && <span className="hc-chip hc-chip--amber">{puntos.length} {puntos.length === 1 ? 'patrón' : 'patrones'}</span>}
            </div>
            {resumen && <p className="hc-card__s" style={{ fontSize: 13, marginTop: 10 }}>{resumen.split(/(?<=[.!?])\s/)[0]}</p>}
            {puntos.length ? (
              <ul className="hc-aitems">
                {puntos.slice(0, 3).map((p, i) => (
                  <li key={i} className={`hc-aitem${i >= 2 ? ' hc-solo-tel' : ''}`}>
                    <span className={`hc-tile ${p.tono === 'bueno' ? 'hc-t-cyan' : p.tono === 'malo' ? 'hc-t-rose' : 'hc-t-sky'}`}>{i + 1}</span>
                    <div className="hc-aitem__b"><p className="hc-aitem__n">{conNombres(p.titulo, nombres)}</p><p className="hc-aitem__m">{conNombres(p.texto, nombres)}</p></div>
                  </li>
                ))}
              </ul>
            ) : <p className="hc-vacio">{caja.cargando ? 'Leyendo lo que escribió MaKo…' : 'MaKo todavía no escribió sus conclusiones de esta hoja.'}</p>}
            {onGrilla && <button type="button" className="hc-btn-line" onClick={onGrilla}>Ver los factores <Icono d={I.flecha} /></button>}
          </article>

          {/* LA DURACIÓN (era «Call session»): el promedio con el reloj que rueda, y cuánto se habló en total. */}
          <article className="hc-card hc-c3 hc-o-8" data-card>
            <div className="hc-card__h"><h2 className="hc-card__t">Duración promedio</h2>{v.duracion.llamadas != null && <span className="hc-chip hc-chip--grey">{entero(v.duracion.llamadas)} llamadas</span>}</div>
            <Reloj minutos={v.duracion.minutos} />
            <div className="hc-durs">
              <span className="hc-dur hc-dur--gana"><Icono d={I.reloj} />En total <b>{v.duracion.minutos != null && v.duracion.llamadas != null ? `${entero((v.duracion.minutos * v.duracion.llamadas) / 60)} h` : '—'}</b></span>
            </div>
          </article>

          {/* EL PRIMER CONTACTO (5/11/2026): lo de antes de la llamada. Sólo con el dato (`extras.contacto`): el closer, el setter,
              un link compartido y la miniatura no lo reciben, y la tarjeta no se dibuja. */}
          {contacto && (
            <article className="hc-card hc-c12 hc-o-9" data-card data-primer-contacto>
              <div className="hc-card__h">
                <div>
                  <h2 className="hc-card__t">Primer contacto</h2>
                  <p className="hc-card__s">{'fallo' in contacto ? 'Cuánto tarda alguien en escribirle a un lead nuevo' : `Leads de los últimos ${contacto.dias} días, sin contar los mensajes automáticos`}</p>
                </div>
                {!compartido && <Link className="hc-link" href="/crm">Ver en el CRM</Link>}
              </div>
              {'fallo' in contacto
                ? <p className="hc-vacio" role="alert">No pude leer los mensajes de tus leads.<ReportarASoporte /></p>
                : contacto.resumen.leads === 0
                  ? <p className="hc-vacio">No entraron leads nuevos en los últimos {contacto.dias} días.</p>
                  : <CuerpoContacto c={contacto} compartido={compartido} />}
            </article>
          )}
        </section>
      </div>
    </div>
    </Quieta.Provider>
  );
}
