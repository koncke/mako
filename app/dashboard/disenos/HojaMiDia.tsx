'use client';

// =============================================================================
// HojaMiDia — la hoja «Mi día» con su DISEÑO PROPIO: la copia de Lumora, con lo que MaKo sabe del día
// =============================================================================
// Martín, 4/11/2026: «que sea primero la copia, es decir, que se vea exactamente igual que la copia, y después la adaptación
// con Maco» y «Carga los de FOCUS que ya teníamos». Lumora es la segunda referencia de Focus. La copia y la adaptación
// (maquetas) están en docs/diseno/mockups-dashboard/focus-lumora/; ésta es la adaptación con los datos de verdad, que llegan
// ya armados (`VistaMiDia`, lib/mi-dia-diseno.ts, con test) desde ./MiDiaVivo.tsx o, para la miniatura de «Nueva hoja», de
// ejemplo.
//
// Lo que Lumora tiene y MaKo no mide NO está (lo dice lib/mi-dia-diseno.ts): la línea de cada número (va la barrita), el
// selector «Scores · Attendance» (cada OKR tiene una sola vara), el «Customise» de los accesos y el sobre de la lista de
// vigilancia (un mensaje a un tercero sale por sus puertas). El nombre del funnel va sin flecha: un selector que no cambia
// nada es un control muerto.
//
// El movimiento es el de Lumora, medido en su INFORME (la entrada `xt`; recetas en focus-lumora/lumora.js) y escrito con
// Element.animate: el hero sube, el título letra por letra, la cinta crece desde abajo y la marca del ahora baja, las
// tarjetas de la IA giran al entrar, los números suben y sus barritas se llenan, las filas, las pastillas, el riel, las
// cifras que cuentan y el hover que sube.
//
// ⚠️ La hoja de estilos (./mi-dia-css.ts) es SÓLO de esta hoja.
// ⚠️ Mirando se dibuja esto; editando, la grilla con los bloques de siempre (app/dashboard/EditorInforme.tsx).
// =============================================================================

import { createContext, useContext, useEffect, useLayoutEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import Link from '@/app/_ui/Link';
import { horaEn } from '@/lib/focus-diseno';
import { duracion, resumenDelDia, type BloqueCinta, type TonoMiDia, type VistaMiDia } from '@/lib/mi-dia-diseno';
import { CSS_MI_DIA } from './mi-dia-css';
import { Parte } from './parte';

// Las curvas de GSAP de Lumora, traducidas (las mismas de docs/diseno/mockups-dashboard/focus-lumora/lumora.js).
const P4O = 'cubic-bezier(.165,.84,.44,1)';
const P3O = 'cubic-bezier(.215,.61,.355,1)';
const BACK = { 1.4: 'cubic-bezier(.18,.89,.32,1.22)', 1.7: 'cubic-bezier(.175,.885,.32,1.275)', 2: 'cubic-bezier(.17,.88,.3,1.35)', 3: 'cubic-bezier(.15,.9,.3,1.6)' } as const;
const sinMovimiento = () => matchMedia('(prefers-reduced-motion: reduce)').matches;

/** QUIETA: la miniatura de «Nueva hoja»: sin la entrada, sin cifras que cuentan y sin hover. */
const Quieta = createContext(false);
const Compartido = createContext(false);

const DOTS: Record<TonoMiDia, string> = { sky: 'var(--sky)', pine: 'var(--pine)', clay: 'var(--clay)', lemon: 'var(--marigold)' };
const DONA = ['var(--sky)', 'var(--pine)', 'var(--marigold)', 'var(--rose)'];
// De las variables de la hoja (claro y oscuro), no hex: el texto del avatar es la tinta, que en oscuro es clara.
const DEBE = { vencida: 'var(--av-vencida)', pronto: 'var(--av-pronto)', nada: 'var(--av-nada)' };
const iniciales = (s: string) => [...s.trim().split(/\s+/).slice(0, 2).map((p) => [...p][0] ?? '')].join('').toUpperCase() || '·';
const mayuscula = (s: string) => (s ? s[0].toLocaleUpperCase('es') + s.slice(1) : s);

const P = {
  warn: 'M12 4l9 16H3zM12 10v4M12 17h.01',
  clip: 'M5.5 4.5h13v16h-13zM9 4.5h6v3H9zM9 13l2 2 4-4',
  grid: 'M4 5h16v14H4zM4 10h16M9.5 10v9M14.5 10v9',
  wand: 'M5 19L15 9M14 4v2M19 9h-2M18 5l-1.5 1.5M10 5l.8 1.5',
  sparkle: 'M12 4l1.6 4.4L18 10l-4.4 1.6L12 16l-1.6-4.4L6 10l4.4-1.6zM18 15l.7 1.8 1.8.7-1.8.7L18 20l-.7-1.8-1.8-.7 1.8-.7z',
  arrow: 'M5 12h13M13 7l5 5-5 5',
  chat: 'M5 5h14v10H9l-4 4zM9 9h6M9 12h4',
  wallet: 'M4 7.5h15a1 1 0 0 1 1 1v9a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1zM4 7.5l11-3 1 3M16 13h1.5',
  chart: 'M5 19V9M10 19V5M15 19v-7M20 19v-4',
  cap: 'M3 9l9-4 9 4-9 4zM7 11v4c0 1.5 2.5 3 5 3s5-1.5 5-3v-4',
  book: 'M4 6c3-1 5-1 8 1v12c-3-2-5-2-8-1zM20 6c-3-1-5-1-8 1v12c3-2 5-2 8-1z',
  clock: 'M4 12a8 8 0 1 0 16 0a8 8 0 1 0-16 0M12 8v4l3 2',
  cup: 'M5 9h11v5a5 5 0 0 1-10 0zM16 10h2a2 2 0 0 1 0 4h-2M8 4v2M11 4v2',
  pen: 'M15 5l4 4L8 20H4v-4zM13 7l4 4',
  chev: 'M10 6l6 6-6 6',
  tick: 'M6 12.5l4 4 8-8.5',
} as const;
function Icono({ id }: { id: keyof typeof P }) {
  return <svg className="ld-i" viewBox="0 0 24 24" aria-hidden><path d={P[id]} /></svg>;
}

/** Un link de la app, o un texto si la hoja está compartida (un link compartido no tiene sesión) o no hay a dónde ir. */
// Lo que no se nombra (los `data-*`: la tarjeta que sube, el bloque de la cinta) pasa tal cual al elemento.
function Ir({ href, className, style, children, label, ...resto }: { href: string | null; className?: string; style?: CSSProperties; children: ReactNode; label?: string }) {
  const compartido = useContext(Compartido);
  if (!href || compartido) return <span className={className} style={style} {...resto}>{children}</span>;
  return <Link href={href} className={className} style={style} aria-label={label} {...resto}>{children}</Link>;
}

/** Una cifra que cuenta («Kn» de Lumora: desde 0, 1.2 s power3.out, a los .3; al cambiar, desde la de antes). */
function Cuenta({ valor, demora = 0.3 }: { valor: number; demora?: number }) {
  const ref = useRef<HTMLSpanElement>(null);
  const antes = useRef<number | null>(null);
  const quieta = useContext(Quieta);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const desde = antes.current ?? 0;
    antes.current = valor;
    if (quieta || sinMovimiento() || desde === valor) { el.textContent = String(valor); return; }
    const t0 = performance.now() + demora * 1000;
    let id = 0;
    const paso = (ahora: number) => {
      const t = Math.min(1, Math.max(0, (ahora - t0) / 1200));
      el.textContent = String(Math.round(desde + (valor - desde) * (1 - Math.pow(1 - t, 3))));
      if (t < 1) id = requestAnimationFrame(paso);
    };
    el.textContent = String(desde);
    id = requestAnimationFrame(paso);
    return () => cancelAnimationFrame(id);
  }, [valor, demora, quieta]);
  return <span ref={ref}>{valor}</span>;
}

/** La dona de Lumora: 15 de trazo en un lienzo de 130, desde arriba, con 2 px entre tramos. */
function Dona({ tramos }: { tramos: Array<{ n: number; c: string }> }) {
  const r = 57.5, C = 2 * Math.PI * r, total = tramos.reduce((s, t) => s + t.n, 0) || 1;
  let acum = 0;
  return (
    <svg viewBox="0 0 130 130" aria-hidden>
      {tramos.map((t, i) => {
        const largo = Math.max(0, (t.n / total) * C - 2);
        const off = -acum;
        acum += (t.n / total) * C;
        return <circle key={i} r={r} cx={65} cy={65} stroke={t.c} strokeDasharray={`${largo} ${C}`} strokeDashoffset={off} />;
      })}
    </svg>
  );
}

/** Las barras de los OKRs: el avance (pino) y lo esperado a hoy (caléndula), sobre 0-100 %. */
function Barras({ okrs }: { okrs: NonNullable<VistaMiDia['okrs']> }) {
  const [hi, setHi] = useState<string | null>(null);
  return (
    <div className="ld-gbars">
      <div className="ld-gbars__grid">{['100%', '75%', '50%', '25%', '0%'].map((v) => <span key={v} data-v={v} />)}</div>
      <div className="ld-gbars__cols" style={{ gridTemplateColumns: `repeat(${okrs.length}, 1fr)` }} onPointerLeave={() => setHi(null)}>
        {okrs.map((o, i) => (
          <div key={i} className="ld-gbars__g">
            <span className={`ld-gbars__bar${hi === `${i}a` ? ' ld-is-hi' : ''}`} style={{ ['--c' as string]: 'var(--pine)', height: `${o.avance}%` }} title={`Avance: ${o.avance}%`} onPointerEnter={() => setHi(`${i}a`)} />
            <span className={`ld-gbars__bar${hi === `${i}b` ? ' ld-is-hi' : ''}`} style={{ ['--c' as string]: 'var(--marigold)', height: `${o.esperado}%` }} title={`Esperado a hoy: ${o.esperado}%`} onPointerEnter={() => setHi(`${i}b`)} />
            <label title={o.titulo}>{o.titulo}</label>
          </div>
        ))}
      </div>
    </div>
  );
}

type Evento = Extract<BloqueCinta, { tipo: 'evento' }>;
const claseCinta = (e: Evento) => (e.estado === 'paso' ? 'ld-is-ppa' : e.estado === 'ahora' ? 'ld-is-now' : `ld-is-${e.tono}`);
const claseDia = (e: Evento) => (e.estado === 'paso' ? 'ld-sch__row--free' : e.estado === 'ahora' ? 'ld-sch__row--sky'
  : e.tono === 'sky' ? 'ld-sch__row--cielo' : `ld-sch__row--${e.tono}`);
const lineaEvento = (e: Evento) => [e.detalle, e.hasta ? duracion((e.fin - e.inicio) / 60_000) : null].filter(Boolean).join(' · ');

const ACCESOS: ReadonlyArray<{ rotulo: string; href: string; icono: keyof typeof P; tono: string }> = [
  { rotulo: 'CRM', href: '/crm', icono: 'cap', tono: 'var(--pine)' },
  { rotulo: 'Plan', href: '/plan', icono: 'clip', tono: 'var(--sky)' },
  { rotulo: 'Calendario', href: '/calendario', icono: 'grid', tono: 'var(--moss)' },
  { rotulo: 'Classroom', href: '/classroom', icono: 'wallet', tono: 'var(--marigold)' },
  { rotulo: 'Offer', href: '/offer', icono: 'book', tono: 'var(--coral)' },
  { rotulo: 'Marketing CoPilot', href: '/ads-manager/copiloto', icono: 'chart', tono: 'var(--clay)' },
  { rotulo: 'Automations', href: '/automations', icono: 'sparkle', tono: 'var(--pine)' },
];
const KPI: Record<VistaMiDia['numeros'][number]['id'], { tono: string; icono: keyof typeof P; href: string | null }> = {
  llamadas: { tono: 'var(--t-mint)', icono: 'chat', href: '/calendario?vista=dia' },
  tareas: { tono: 'var(--t-sky)', icono: 'clip', href: '/plan' },
  cobros: { tono: 'var(--t-peach)', icono: 'wallet', href: '/crm' },
  kpis: { tono: 'var(--t-lemon)', icono: 'chart', href: null },
};
const REC: Record<string, { icono: keyof typeof P; tono: string }> = {
  proxima: { icono: 'clock', tono: 'var(--sky)' }, vencidas: { icono: 'pen', tono: 'var(--marigold)' }, hueco: { icono: 'cup', tono: 'var(--moss)' },
};
const SEMAFORO = { rojo: { icono: 'warn', tono: 'var(--rose)' }, ambar: { icono: 'clock', tono: 'var(--marigold)' }, verde: { icono: 'chart', tono: 'var(--pine)' } } as const;

export function HojaMiDia({ vista, titulo, fecha, tz, ahora, hechas, onCompletar, onGrilla, compartido = false, quieta = false, pie }: {
  vista: VistaMiDia;
  /** «Buenos días, Ana» (las variables de General); sin nombre, el de la hoja. */
  titulo: string;
  /** «miércoles 4 de noviembre» (la variable de General): null = no llegó. */
  fecha: string | null;
  /** La zona del negocio (las horas de la cinta y la marca del ahora). */
  tz: string;
  /** El reloj, después de montar (null en el server y en la miniatura: la marca del ahora se dibuja recién con él). */
  ahora: number | null;
  /** Las tareas que se completaron desde la hoja (quedan tachadas). */
  hechas?: ReadonlySet<string>;
  onCompletar?: (id: string) => void;
  onGrilla?: () => void;
  compartido?: boolean;
  quieta?: boolean;
  /** Lo que va al pie (el toast de «Tarea completada»). */
  pie?: ReactNode;
}) {
  const raiz = useRef<HTMLDivElement>(null);
  const cinta = useRef<HTMLDivElement>(null);
  const marca = useRef<HTMLDivElement>(null);
  const [entro, setEntro] = useState(false);

  // ── La entrada de Lumora (`xt`, lumora.js): una vez, al montarse ──────────────────────────────────────────
  useLayoutEffect(() => {
    const el = raiz.current;
    setEntro(true);
    if (!el || quieta || sinMovimiento()) return;
    const todos = (s: string) => [...el.querySelectorAll<HTMLElement>(s)];
    const a = (n: HTMLElement, desde: Keyframe, dur: number, ease: string, delay: number) =>
      n.animate([desde, { opacity: 1, transform: 'none' }], { duration: dur * 1000, easing: ease, delay: delay * 1000, fill: 'backwards' });
    const er = (nodos: HTMLElement[], { y = 34, stagger = 0.07, delay = 0 } = {}) => nodos.forEach((n, i) => a(n, { opacity: 0, transform: `translateY(${y}px) scale(.985)` }, 0.9, P3O, delay + i * stagger));
    const zn = (nodos: HTMLElement[], { x = 0, y = 12, stagger = 0.045, delay = 0 } = {}) => nodos.forEach((n, i) => a(n, { opacity: 0, transform: `translate(${x}px, ${y}px)` }, 0.55, P3O, delay + i * stagger));
    const qn = (nodos: HTMLElement[], { stagger = 0.06, delay = 0 } = {}) => nodos.forEach((n, i) => a(n, { opacity: 0, transform: `translateY(40px) rotate(${i % 2 ? 3 : -3}deg) scale(.94)` }, 0.8, BACK[1.4], delay + i * stagger));
    const nr = (nodos: HTMLElement[], { from = 0.6, stagger = 0.05, delay = 0 } = {}) => nodos.forEach((n, i) => a(n, { opacity: 0, transform: `scale(${from})` }, 0.6, BACK[3], delay + i * stagger));

    er(todos('.ld-hero'), { y: 24 });
    // «el título letra por letra»: yPercent 115, rotation 6 → 0 · .85 s power4.out · .022, a los .1
    todos('.ld-hero__title .ld-l').forEach((l, i) => l.animate([{ transform: 'translateY(115%) rotate(6deg)' }, { transform: 'none' }], { duration: 850, easing: P4O, delay: 100 + i * 22, fill: 'backwards' }));
    zn(todos('.ld-hero__date, .ld-hero__sum, .ld-hero__acts > *'), { y: 10, stagger: 0.06, delay: 0.15 });
    todos('.ld-ribbon__it').forEach((n, i) => { n.style.transformOrigin = '50% 100%'; a(n, { opacity: 0, transform: 'scaleY(.2)' }, 0.7, BACK[1.7], 0.25 + i * 0.045); });
    todos('.ld-ribbon__now').forEach((n) => a(n, { opacity: 0, transform: 'translateY(-40%)' }, 0.6, BACK[2], 0.75));
    qn(todos('.ld-ai-card'), { stagger: 0.08, delay: 0.15 });
    er(todos('.ld-kpi'), { stagger: 0.06, delay: 0.3 });
    // La barrita («rt»: scaleX 0 → su valor · 1 s power3.out · .03), a los .4 (donde la entrada de Lumora llama a `Oe(.kpis)`).
    todos('.ld-kpi .ld-meter__fill').forEach((m, i) => { const fin = m.style.transform || 'scaleX(1)'; m.animate([{ transform: 'scaleX(0)' }, { transform: fin }], { duration: 1000, easing: P3O, delay: (0.4 + i * 0.03) * 1000, fill: 'backwards' }); });
    er(todos('.ld-quick, .ld-upc, .ld-hw, .ld-perf, .ld-risk, .ld-notes'), { stagger: 0.06, delay: 0.45 });
    zn(todos('.ld-quick__a'), { y: 12, stagger: 0.035, delay: 0.6 });
    zn(todos('.ld-upc__row, .ld-risk__row, .ld-notes__row'), { y: 10, stagger: 0.03, delay: 0.7 });
    nr(todos('.ld-risk .ld-pill'), { from: 0.5, stagger: 0.08, delay: 0.95 });
    er(todos('.ld-dash__rail > .ld-card'), { stagger: 0.08, y: 26, delay: 0.2 });
    zn(todos('.ld-cal__d'), { y: 6, stagger: 0.008, delay: 0.35 });
    zn(todos('.ld-sch__row, .ld-rem__row'), { x: 10, y: 0, stagger: 0.04, delay: 0.55 });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ── El hover que sube («$n»): lo que lleva [data-card] sube 4 px · .45 s power3.out, y baja en .5 s ───────────
  useEffect(() => {
    const el = raiz.current;
    if (!el || quieta || sinMovimiento() || !matchMedia('(hover: hover)').matches) return;
    const quitar: Array<() => void> = [];
    el.querySelectorAll<HTMLElement>('[data-card]').forEach((c) => {
      const sube = () => c.animate([{ transform: 'none' }, { transform: 'translateY(-4px)' }], { duration: 450, easing: P3O, fill: 'forwards' });
      const baja = () => c.animate([{ transform: 'translateY(-4px)' }, { transform: 'none' }], { duration: 500, easing: P3O, fill: 'forwards' });
      c.addEventListener('pointerenter', sube);
      c.addEventListener('pointerleave', baja);
      quitar.push(() => { c.removeEventListener('pointerenter', sube); c.removeEventListener('pointerleave', baja); });
    });
    return () => quitar.forEach((q) => q());
  }, [quieta]);

  // ── La marca del ahora, sobre el bloque de la cinta que está corriendo (en la proporción que ya pasó) ─────────
  // Antes del primer bloque o después del último no se dibuja. Si la marca queda fuera de la vista, la cinta se corre hasta ella.
  useLayoutEffect(() => {
    const c = cinta.current, m = marca.current;
    if (!c || !m) return;
    const bloques = [...c.querySelectorAll<HTMLElement>('[data-ini]')];
    let left: number | null = null;
    if (ahora != null) {
      for (const b of bloques) {
        const ini = Number(b.dataset.ini), fin = Number(b.dataset.fin);
        if (ahora >= ini && ahora < fin) { left = b.offsetLeft + b.offsetWidth * ((ahora - ini) / Math.max(1, fin - ini)); break; }
        if (ahora < ini) { if (b !== bloques[0]) left = b.offsetLeft - 2; break; }
      }
    }
    m.style.display = left == null ? 'none' : '';
    if (left != null) {
      m.style.left = `${left}px`;
      const caja = c.parentElement;
      if (caja && left > caja.scrollLeft + caja.clientWidth - 40) caja.scrollLeft = Math.max(0, left - caja.clientWidth / 3);
    }
  }, [ahora, vista.cinta]);

  const { resumen, numeros, vence, funnel, okrs, deben, semaforo, mes, dia, recordatorios, aTildar, proxima } = vista;
  const llamadas = resumen.llamadas;
  const fechaLinea = [fecha ? mayuscula(fecha) : null, vista.semana].filter(Boolean).join(' · ');

  return (
    <Quieta.Provider value={quieta}>
    <Compartido.Provider value={compartido}>
    <div className="ld" ref={raiz} data-antes={entro || quieta ? undefined : ''}>
      <style href="dash-hoja-mi-dia" precedence="medium">{CSS_MI_DIA}</style>
      {/* La letra de Lumora (Urbanist), sólo para esta hoja. */}
      <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Urbanist:wght@400..700&display=swap" precedence="default" />
      <div className="ld-dash">
        <div className="ld-dash__main">
          {/* EL HERO: la fecha y la semana, el saludo, el resumen del día y la CINTA (lo de hoy en el Calendario). */}
          <Parte id="cabecera">
          <section className="ld-card ld-hero" data-card="">
            {fechaLinea && <p className="ld-hero__date">{fechaLinea}</p>}
            <h1 className="ld-hero__title" aria-label={titulo}><span className="ld-w">{[...titulo].map((c, i) => <span key={i} className="ld-l" aria-hidden>{c}</span>)}</span></h1>
            <p className="ld-hero__sum">
              {resumenDelDia(resumen).map((t, i) => (t.tipo === 'fuerte' ? <b key={i}>{t.s}</b> : t.tipo === 'link' ? <Ir key={i} href={t.href}>{t.s}</Ir> : <span key={i}>{t.s}</span>))}
              {resumen.vencidas ? <span className="ld-hero__warn"><Icono id="warn" />{resumen.vencidas === 1 ? '1 cuota vencida sin cobrar.' : `${resumen.vencidas} cuotas vencidas sin cobrar.`}</span> : null}
            </p>
            <div className="ld-hero__acts">
              <Ir href="/plan" className="ld-btn ld-btn--primary"><Icono id="clip" />Abrir el Plan</Ir>
              <Ir href="/calendario?vista=dia" className="ld-btn ld-btn--ghost"><Icono id="grid" />Abrir el calendario</Ir>
              {onGrilla && <button type="button" className="ld-btn ld-btn--ghost" onClick={onGrilla}>Ver todo en la grilla</button>}
            </div>
            {vista.cinta == null ? <p className="ld-vacio">No pude leer tu calendario.</p>
              : !vista.cinta.length ? <p className="ld-vacio">No tienes nada en el calendario hoy.</p>
              : (
                <div className="ld-ribbon-caja">
                  <div className="ld-ribbon" ref={cinta}>
                    <div className="ld-ribbon__now" ref={marca} style={{ display: 'none' }}><b>{ahora != null ? horaEn(new Date(ahora).toISOString(), tz) : ''}</b><i /></div>
                    {vista.cinta.map((b) => (
                      b.tipo === 'evento' ? (
                        <Ir key={b.id} href={b.href} className={`ld-ribbon__it ld-ribbon__it--slot ${claseCinta(b)}`} data-ini={String(b.inicio)} data-fin={String(b.fin)}>
                          <b>{b.titulo}</b><span>{lineaEvento(b) || ' '}</span><span>{b.hora}</span>
                        </Ir>
                      ) : b.tipo === 'libre' ? (
                        <span key={b.id} className="ld-ribbon__it ld-ribbon__it--free" data-ini={b.inicio} data-fin={b.fin}><b>Libre</b><span>{b.dura}</span><span>{b.desde}</span></span>
                      ) : (
                        <span key={b.id} className="ld-ribbon__it ld-ribbon__it--break" data-ini={b.inicio} data-fin={b.fin} aria-hidden><Icono id="cup" /></span>
                      )
                    ))}
                  </div>
                </div>
              )}
          </section>
          </Parte>

          {/* LAS DOS TARJETAS DE LA IA: preparar la próxima llamada (su ficha) y preguntarle a MaKo (su chat). */}
          <div className="ld-two ld-two--ai">
            {proxima ? (
              <Parte id="llamada">
              <Ir href={proxima.href ?? '/calendario?vista=dia'} className="ld-card ld-ai-card" data-card="">
                <span className="ld-ai-card__ic"><Icono id="wand" /></span>
                <span><b>Prepara tu próxima llamada</b><small>{proxima.titulo} · {proxima.hora}</small></span>
                <span className="ld-btn ld-btn--xs">{proxima.href ? 'Abrir la ficha' : 'Ver el calendario'}<Icono id="arrow" /></span>
              </Ir>
              </Parte>
            ) : (
              <Parte id="llamada">
              <Ir href="/plan" className="ld-card ld-ai-card" data-card="">
                <span className="ld-ai-card__ic"><Icono id="wand" /></span>
                <span><b>Prepara lo que sigue</b><small>Lo que vence y lo que quedó atrasado, en tu Plan.</small></span>
                <span className="ld-btn ld-btn--xs">Abrir el Plan<Icono id="arrow" /></span>
              </Ir>
              </Parte>
            )}
            <Parte id="pregunta">
            <Ir href="/inicio" className="ld-card ld-ai-card ld-ai-card--b" data-card="">
              <span className="ld-ai-card__ic" style={{ color: 'var(--coral)' }}><Icono id="sparkle" /></span>
              <span><b>Pregúntale a MaKo</b><small>Qué te falta hoy, qué está atrasado y qué va primero.</small></span>
              <span className="ld-btn ld-btn--xs">Abrir el chat<Icono id="arrow" /></span>
            </Ir>
            </Parte>
          </div>

          {/* LOS CUATRO NÚMEROS: con la barrita de Lumora (MaKo no guarda la serie de la línea). */}
          <Parte id="numeros">
          <div className="ld-kpis">
            {numeros.map((n) => {
              const k = KPI[n.id];
              return (
                <Ir key={n.id} href={k.href} className="ld-card ld-kpi" style={{ ['--tone' as string]: k.tono }} data-card="">
                  <span className="ld-kpi__l">{n.titulo}<span className="ld-kpi__ic"><Icono id={k.icono} /></span></span>
                  <span className="ld-kpi__m">
                    <span className="ld-kpi__v">{n.valor == null ? '—' : <Cuenta valor={n.valor} />}</span>
                    <span className="ld-meter"><i className="ld-meter__fill" style={{ transform: `scaleX(${n.meter})` }} /></span>
                  </span>
                  <span className="ld-kpi__f">
                    {n.id === 'llamadas' ? <>{n.pie}{n.destacado && <> <b>{n.destacado}</b></>}</> : <>{n.pie}{n.destacado && <> · <u>{n.destacado}</u></>}</>}
                  </span>
                </Ir>
              );
            })}
          </div>
          </Parte>

          {/* ACCESOS: las tabs de MaKo. */}
          <Parte id="accesos">
          <section className="ld-card ld-quick" data-card="">
            <div className="ld-card__h"><h2 className="ld-card__t">Accesos</h2></div>
            <div className="ld-quick__grid">
              {ACCESOS.map((q) => (
                <Ir key={q.href} href={q.href} className="ld-quick__a"><span className="ld-quick__ic" style={{ ['--tone' as string]: q.tono }}><Icono id={q.icono} /></span>{q.rotulo}</Ir>
              ))}
            </div>
          </section>
          </Parte>

          <div className="ld-two ld-upc-hw">
            {/* LO QUE VENCE: las tareas y los proyectos del Plan, por fecha. */}
            <Parte id="vence">
            <section className="ld-card ld-upc" data-card="">
              <div className="ld-card__h"><h2 className="ld-card__t">Lo que vence</h2><Ir href="/plan" className="ld-card__link">Ver el Plan</Ir></div>
              {vence == null ? <p className="ld-vacio">No pude leer tu Plan.</p>
                : !vence.length ? <p className="ld-vacio">No tienes nada que venza en los próximos 30 días.</p>
                : (
                  <ul className="ld-upc__list">
                    {vence.map((v) => (
                      <li key={v.id}><Ir href={v.href} className="ld-upc__row">
                        <span className="ld-upc__d" style={{ ['--tone' as string]: `var(--${v.tono})` }}><small>{v.mes}</small><b>{v.dia}</b></span>
                        <span style={{ minWidth: 0 }}><strong>{v.titulo}</strong><span>{v.detalle}</span></span>
                      </Ir></li>
                    ))}
                  </ul>
                )}
            </section>
            </Parte>
            {/* TU FUNNEL HOY: la dona por etapa del funnel principal. */}
            <Parte id="funnel">
            <section className="ld-card ld-hw" data-card="">
              <div className="ld-card__h"><h2 className="ld-card__t">Tu funnel hoy</h2>{funnel && <span className="ld-select" title={funnel.nombre}>{funnel.nombre}</span>}</div>
              {funnel == null ? <p className="ld-vacio">No pude contar tu funnel.</p>
                : !funnel.total ? <p className="ld-vacio">Todavía no hay leads en tu funnel.</p>
                : (
                  <div className="ld-hw__b">
                    <div className="ld-donut">
                      <Dona tramos={funnel.etapas.map((e, i) => ({ n: e.n, c: e.nombre === 'Otras' || e.nombre === 'Sin etapa' ? 'var(--slate)' : DONA[i % DONA.length] }))} />
                      <div className="ld-donut__c"><b>{funnel.total}</b><small>{funnel.total === 1 ? 'lead' : 'leads'}</small></div>
                    </div>
                    <ul className="ld-legend">
                      {funnel.etapas.map((e, i) => <li key={e.nombre}><i style={{ ['--c' as string]: e.nombre === 'Otras' || e.nombre === 'Sin etapa' ? 'var(--slate)' : DONA[i % DONA.length] }} />{e.nombre}<b>{e.n}</b></li>)}
                    </ul>
                  </div>
                )}
              <Ir href={funnel && !funnel.principal ? `/crm?funnel=${funnel.id}` : '/crm'} className="ld-card__link ld-hw__more">Abrir el CRM<Icono id="arrow" /></Ir>
            </section>
            </Parte>
          </div>

          {/* CÓMO VAS CON TUS OKRS: el avance contra lo esperado a hoy (las barras de Lumora). */}
          <Parte id="okrs">
          <section className="ld-card ld-perf" data-card="">
            <div className="ld-card__h"><h2 className="ld-card__t">Cómo vas con tus OKRs</h2></div>
            {okrs == null ? <p className="ld-vacio">No pude leer tus OKRs.</p>
              : !okrs.length ? <p className="ld-vacio">Todavía no tienes OKRs con avance este trimestre.</p>
              : (
                <>
                  <Barras okrs={okrs} />
                  <div className="ld-gbars__k"><span><i style={{ ['--c' as string]: 'var(--pine)' }} />Avance</span><span><i style={{ ['--c' as string]: 'var(--marigold)' }} />Lo esperado a hoy</span></div>
                </>
              )}
          </section>
          </Parte>

          <div className="ld-two ld-risk-notes">
            {/* LOS QUE TE DEBEN: las cuotas por cobrar, lo más urgente primero. */}
            <Parte id="deben">
            <section className="ld-card ld-risk" data-card="">
              <div className="ld-card__h">
                <div><h2 className="ld-card__t ld-risk__h" style={{ display: 'flex', alignItems: 'center', gap: 10 }}><Icono id="sparkle" />Los que te deben</h2><p className="ld-card__s">Lo más urgente primero</p></div>
                <Ir href="/crm" className="ld-card__link">Ver el CRM</Ir>
              </div>
              {deben == null ? <p className="ld-vacio">No pude leer los cobros.</p>
                : !deben.length ? <p className="ld-vacio">Nadie te debe una cuota ahora.</p>
                : (
                  <ul className="ld-risk__list">
                    {deben.map((c) => (
                      <li key={`${c.leadId}:${c.pagoId ?? 'mensual'}`} className="ld-risk__row">
                        <Ir href={`/crm/${c.leadId}?tab=pagos`} className="ld-risk__who">
                          <span className="ld-av" style={{ ['--tone' as string]: DEBE[c.urgencia ?? 'nada'] }}>{iniciales(c.nombre)}</span>
                          <span style={{ minWidth: 0 }}><b>{c.nombre}</b><small>{c.linea}</small></span>
                        </Ir>
                        {c.urgencia === 'vencida' ? <span className="ld-pill ld-pill--high"><i />Vencida</span>
                          : c.urgencia === 'pronto' ? <span className="ld-pill ld-pill--med"><i />Vence pronto</span> : null}
                      </li>
                    ))}
                  </ul>
                )}
            </section>
            </Parte>
            {/* EL SEMÁFORO: sus alertas. */}
            <Parte id="semaforo">
            <section className="ld-card ld-notes" data-card="">
              <div className="ld-card__h"><h2 className="ld-card__t">El semáforo</h2></div>
              {semaforo == null ? <p className="ld-vacio">No pude leer el semáforo.</p>
                : !semaforo.length ? <p className="ld-vacio">No hay alertas por ahora.</p>
                : (
                  <ul className="ld-notes__list">
                    {semaforo.map((a, i) => {
                      const s = SEMAFORO[a.nivel];
                      return (
                        <li key={i}><Ir href={a.href} className={`ld-notes__row${a.nivel === 'verde' ? '' : ' ld-is-unread'}`}>
                          <span className="ld-notes__ic" style={{ ['--tone' as string]: s.tono }}><Icono id={s.icono} /></span>
                          <span style={{ minWidth: 0 }}><b>{a.titulo}</b><small>{a.link}</small></span>
                        </Ir></li>
                      );
                    })}
                  </ul>
                )}
            </section>
            </Parte>
          </div>
        </div>

        <aside className="ld-dash__rail">
          {/* EL MES: lo que tiene el Calendario, en puntos. */}
          <Parte id="mes">
          <section className="ld-card ld-cal" data-card="">
            {mes == null ? <p className="ld-vacio">No pude leer tu calendario.</p> : (
              <>
                <div className="ld-cal__h"><b>{mes.titulo}</b></div>
                <div className="ld-cal__grid">
                  {['Lu', 'Ma', 'Mi', 'Ju', 'Vi', 'Sá', 'Do'].map((d) => <span key={d} className="ld-cal__dow">{d}</span>)}
                  {mes.dias.map((d) => (
                    <span key={d.dia} className={['ld-cal__d', d.fuera && 'ld-is-out', d.finde && 'ld-is-we', d.hoy && 'ld-is-today'].filter(Boolean).join(' ')}>
                      {d.n}
                      {d.puntos.length > 0 && <span className="ld-dots">{d.puntos.map((p) => <i key={p} style={{ ['--c' as string]: DOTS[p] }} />)}</span>}
                    </span>
                  ))}
                </div>
              </>
            )}
          </section>
          </Parte>
          {/* TU DÍA: lo de hoy en el Calendario, con lo que está corriendo. */}
          <Parte id="dia">
          <section className="ld-card ld-sch" data-card="">
            <div className="ld-card__h">
              <div><h2 className="ld-card__t">Tu día</h2><p className="ld-card__s">{llamadas == null ? 'Hoy' : `Hoy · ${llamadas === 1 ? '1 llamada' : `${llamadas} llamadas`}`}</p></div>
              <Ir href="/calendario?vista=dia" className="ld-card__link">Calendario</Ir>
            </div>
            {dia == null ? <p className="ld-vacio">No pude leer tu calendario.</p>
              : !dia.length ? <p className="ld-vacio">No tienes nada en el calendario hoy.</p>
              : (
                <div className="ld-sch__list">
                  {dia.map((e) => (
                    <Ir key={e.id} href={e.href} className={`ld-sch__row ${claseDia(e)}`}>
                      <span className="ld-sch__t"><b>{e.hora}</b><small>{e.hasta ?? ''}</small></span>
                      <span className="ld-sch__x"><b>{e.titulo}</b>{e.detalle && <small>{e.detalle}</small>}</span>
                      {e.estado === 'ahora' && <span className="ld-now">Ahora</span>}
                    </Ir>
                  ))}
                </div>
              )}
          </section>
          </Parte>
          {/* RECORDATORIOS: lo próximo, lo vencido, el próximo hueco y las tareas de hoy para tildar. */}
          <Parte id="recordatorios">
          <section className="ld-card ld-rem" data-card="">
            <div className="ld-card__h"><h2 className="ld-card__t">Recordatorios</h2></div>
            {recordatorios == null && aTildar == null ? <p className="ld-vacio">No pude leer tu día.</p>
              : !recordatorios?.length && !aTildar?.length ? <p className="ld-vacio">Nada pendiente por ahora.</p>
              : (
                <div className="ld-rem__list">
                  {recordatorios?.map((r) => {
                    const t = REC[r.id] ?? { icono: 'clock' as const, tono: 'var(--sky)' };
                    return (
                      <Ir key={r.id} href={r.href} className="ld-rem__row">
                        <span className="ld-rem__ic" style={{ ['--tone' as string]: t.tono }}><Icono id={t.icono} /></span>
                        <span className="ld-rem__x"><b>{r.titulo}</b><small>{r.detalle}</small></span>
                        <Icono id="chev" />
                      </Ir>
                    );
                  })}
                  {aTildar?.map((t) => {
                    const hecha = hechas?.has(t.id) ?? false;
                    return (
                      <div key={t.id} className={`ld-rem__row ld-rem__row--todo${hecha ? ' ld-rem__row--hecha' : ''}`}>
                        {hecha || !onCompletar || compartido
                          ? <span className={`ld-check${hecha ? ' ld-check--on' : ''}`}>{hecha && <Icono id="tick" />}</span>
                          : <button type="button" className="ld-check" aria-label={`Marcar hecha: ${t.titulo}`} onClick={() => onCompletar(t.id)} />}
                        <Ir href={`/plan?tarea=${encodeURIComponent(t.id)}`} className="ld-rem__x">
                          <b>{t.titulo}</b><small>{[t.cuando, t.proyecto?.nombre].filter(Boolean).join(' · ')}</small>
                        </Ir>
                        <Icono id="chev" />
                      </div>
                    );
                  })}
                </div>
              )}
          </section>
          </Parte>
        </aside>
      </div>
      {pie}
    </div>
    </Compartido.Provider>
    </Quieta.Provider>
  );
}
