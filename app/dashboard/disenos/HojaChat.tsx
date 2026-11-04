'use client';

// =============================================================================
// HojaChat — la hoja Chat Analyst con su DISEÑO PROPIO: la copia de Parley, con los datos reales de MaKo
// =============================================================================
// Martín, 4/11/2026: «que sea primero la copia, es decir, que se vea exactamente igual que la copia, y después la adaptación con
// Maco... copiarlo todo, desde las animaciones de entrada, las animaciones de hover, las animaciones de clic». La copia y la
// adaptación (maquetas) están en docs/diseno/mockups-dashboard/chat-parley/; ésta es la adaptación con los datos de verdad
// (lib/chat-diseno.ts arma lo que dibuja cada bloque, con test). La pregunta: «¿cuánto tardamos en contestar?».
//
// El movimiento sale del INFORME de Parley (docs/diseno/mockups-dashboard/demos/parley/INFORME.txt, la entrada de la página): el
// saludo entra palabra por palabra (y 70 %, .6 s, cada .06 s) y la frase después (y 6, .5 s, desde .15 s); las herramientas bajan
// (y −8, .5 s, cada .06 s, desde .2 s); las tarjetas suben (y 28, escala .985, .8 s, power3.out, cada .08 s) y cada una arranca lo
// suyo a los .25 s de su entrada: los números cuentan desde 0 (1,4 s; los recibidos 1,6 s y los enviados 1,8 s), las columnas
// naranjas suben desde abajo (1,1 s, power4.out, cada .06 s), las casillas se llenan de a una (.35 s, back.out(2.2), cada .018 s)
// y la barra del tiempo de respuesta crece (1,2 s). Al pasar sobre un día, el globo se mueve y rebota (escala .85 → 1, .4 s). Lo
// que el INFORME no dice y se supone (anotado en el relevo): cómo se dibuja el área de los enviados (se destapa de izquierda a
// derecha, 1,2 s), cómo crecen las columnas de los días y el anillo (1 s, power3.out) y que al pasar sobre un día los otros se
// apagan a la mitad.
//
// ⚠️ Mirando se dibuja esto; editando, la grilla con los mismos componentes (app/dashboard/EditorInforme.tsx).
// ⚠️ Lo que Parley tiene y MaKo no hace no está: la barra lateral (la pone la app), el buscador, el «live» (en su lugar, los
//    recibidos de hoy), la proyección del mes, los créditos y su recarga, y el cambio de cada canal contra el mes pasado.
// =============================================================================

import { createContext, useContext, useEffect, useLayoutEffect, useMemo, useRef, useState, type KeyboardEvent, type ReactNode } from 'react';
import Link from '@/app/_ui/Link';
import type { Grafico, Hoja } from '@/lib/graficos-catalogo';
import { CASILLAS, casillasDe, conDecimal, duracion, duracionTexto, META_MINUTOS, porSemana, type Cambio, type VistaChat } from '@/lib/chat-diseno';
import { corto, entero } from '@/lib/marketing-diseno';
import { CSS_CHAT } from './chat-css';

const Compartido = createContext(false);

const P = {
  cal: 'M4 5.5h16v14H4zM4 10h16M8 3.5v4M16 3.5v4',
  grid: 'M4.5 4.5h6v6h-6zM13.5 4.5h6v6h-6zM4.5 13.5h6v6h-6zM13.5 13.5h6v6h-6z',
  chat: 'M5 5.5h14a1.5 1.5 0 0 1 1.5 1.5v8.5A1.5 1.5 0 0 1 19 17h-8l-4.5 3.5V17H5a1.5 1.5 0 0 1-1.5-1.5V7A1.5 1.5 0 0 1 5 5.5z',
  reloj: 'M12 3.5a8.5 8.5 0 1 0 0 17a8.5 8.5 0 1 0 0-17M12 7.5V12l3 2',
  flecha: 'M6 12h12M13 7l5 5-5 5',
} as const;
function Icono({ id }: { id: keyof typeof P }) {
  return <svg className="parl-i" viewBox="0 0 24 24" aria-hidden><path d={P[id]} /></svg>;
}
function Flecha({ baja }: { baja?: boolean }) {
  return <svg viewBox="0 0 12 12" aria-hidden><path d={baja ? 'M1.5 3L5 6.5l2-2L10.5 8M7.5 8h3V5' : 'M1.5 9L5 5.5l2 2L10.5 4M7.5 4h3v3'} /></svg>;
}

const P3 = 'cubic-bezier(.215, .61, .355, 1)', P4 = 'cubic-bezier(.165, .84, .44, 1)', BACK = 'cubic-bezier(.3, 1.9, .55, 1)', BACK2 = 'cubic-bezier(.34, 1.7, .64, 1)';
const sinMovimiento = () => typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
const eP3 = (t: number) => 1 - Math.pow(1 - t, 3);
const anim = (n: Element | null | undefined, kf: Keyframe[], o: KeyframeAnimationOptions) => { if (n && 'animate' in n) (n as HTMLElement).animate(kf, { fill: 'backwards', ...o }); };

/** Cuenta el número de un texto desde cero («4,862», «94.2», «US$1,830»), con su prefijo, sus decimales y su sufijo. */
function contar(n: HTMLElement, demora: number, dur: number) {
  const fin = n.textContent ?? '';
  const m = fin.match(/^(\D*?)(\d[\d,]*(?:\.\d+)?)(.*)$/);
  if (!m) return;
  const [, pre, cifra, suf] = m, dec = cifra.includes('.') ? cifra.split('.')[1].length : 0, valor = Number(cifra.replace(/,/g, ''));
  const fmt = (v: number) => `${pre}${v.toLocaleString('en-US', { minimumFractionDigits: dec, maximumFractionDigits: dec })}${suf}`;
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
function Ir({ href, className, etiqueta, children }: { href: string; className?: string; etiqueta?: string; children: ReactNode }) {
  if (useContext(Compartido)) return <span className={`${className ?? ''} parl-quieta`} aria-label={etiqueta}>{children}</span>;
  return <Link href={href} className={className} aria-label={etiqueta}>{children}</Link>;
}

function Chip({ c, clase = '' }: { c: Cambio; clase?: string }) {
  if (!c.cambio) return null;
  const baja = c.sube === false;
  return <span className={`parl-chip${baja ? ' parl-chip--bad' : ''}${clase}`}><Flecha baja={baja} />{c.cambio.replace(/^[+−-]/, '')}</span>;
}
function Vacio({ titulo, texto }: { titulo: string; texto?: string }) {
  return <div className="parl-vacio"><b>{titulo}</b>{texto}</div>;
}
function Casillas({ llenas, violeta }: { llenas: number; violeta?: boolean }) {
  return <div className={`parl-cells${violeta ? ' parl-cells--violet' : ''}`} aria-hidden>{Array.from({ length: CASILLAS }, (_, i) => <i key={i}><b className={i < llenas ? 'parl-on' : undefined} /></i>)}</div>;
}
function Seg({ opciones, valor, onCambio, oscuro }: { opciones: readonly string[]; valor: string; onCambio: (v: string) => void; oscuro?: boolean }) {
  return (
    <div className={`parl-seg${oscuro ? ' parl-seg--dark' : ''}`} role="group">
      {opciones.map((o) => <button key={o} type="button" className={o === valor ? 'parl-is-on' : undefined} aria-pressed={o === valor} onClick={() => onCambio(o)}>{o}</button>)}
    </div>
  );
}

// ── el área de los enviados ───────────────────────────────────────────────────────────────────────────────────────────
const W = 1000, H = 101;
function curva(pts: Array<readonly [number, number]>): string {
  let d = `M${pts[0][0].toFixed(1)},${pts[0][1].toFixed(1)}`;
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[i - 1] ?? pts[i], p1 = pts[i], p2 = pts[i + 1], p3 = pts[i + 2] ?? p2;
    const c1 = [p1[0] + (p2[0] - p0[0]) / 6, p1[1] + (p2[1] - p0[1]) / 6], c2 = [p2[0] - (p3[0] - p1[0]) / 6, p2[1] - (p3[1] - p1[1]) / 6];
    d += ` C${c1[0].toFixed(1)},${c1[1].toFixed(1)} ${c2[0].toFixed(1)},${c2[1].toFixed(1)} ${p2[0].toFixed(1)},${p2[1].toFixed(1)}`;
  }
  return d;
}
function Area({ valores, ahora }: { valores: number[]; ahora: boolean }) {
  if (valores.length < 2) return <div className="parl-area" />;
  // Como Parley: el último punto, si es el de hoy, va por la mitad del día y se une PUNTEADO, sin relleno.
  const llenos = ahora ? valores.slice(0, -1) : valores;
  const max = Math.max(1, ...llenos) * 1.225;
  const pts = valores.map((v, i) => [(i / (valores.length - 1)) * W, H - (v / max) * H] as const);
  const lin = pts.slice(0, ahora ? -1 : undefined);
  if (lin.length < 2) return <div className="parl-area" />;
  const d = curva(lin);
  const [ax, ay] = lin[lin.length - 1], [bx, by] = pts[pts.length - 1];
  return (
    <div className="parl-area">
      <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" aria-hidden>
        <defs><linearGradient id="parl-area-g" x1="0" x2="0" y1="0" y2="1"><stop offset="0" stopColor="#f2835b" stopOpacity=".32" /><stop offset="1" stopColor="#f2835b" stopOpacity="0" /></linearGradient></defs>
        <path d={`${d} L${ax.toFixed(1)},${H} L0,${H} Z`} fill="url(#parl-area-g)" />
        <path d={d} fill="none" stroke="#f2835b" strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" vectorEffect="non-scaling-stroke" />
        {ahora && <path d={`M${ax.toFixed(1)},${ay.toFixed(1)} L${bx.toFixed(1)},${by.toFixed(1)}`} stroke="#f2835b" strokeWidth="2" strokeDasharray="3 4" strokeLinecap="round" vectorEffect="non-scaling-stroke" />}
      </svg>
      {ahora && <i className="parl-area__dot" style={{ left: `${(bx / W) * 100}%`, top: `${(by / H) * 100}%` }} />}
    </div>
  );
}

// ── el anillo ─────────────────────────────────────────────────────────────────────────────────────────────────────────
const R = 56, C = 2 * Math.PI * R, HUECO = 12, TRAZO = 16;
const COLORES = ['var(--c-tangerine)', 'var(--c-teal)', 'var(--c-violet)'];
const FONDOS = ['var(--c-tangerine-soft)', 'var(--c-violet-soft)', 'var(--c-teal-soft)', 'var(--c-violet-soft)', 'var(--c-tangerine-soft)'];

export function HojaChat({ hoja, vista, titulo, periodo, onGrilla, onFila, compartido = false, quieta = false }: {
  hoja: Hoja;
  vista: VistaChat;
  /** «Buenos días, Ana» (quién mira); sin nombre, el de la hoja. */
  titulo: string;
  /** El nombre del período elegido («Últimos 30 días»): el de la barra de controles de la hoja. */
  periodo: string;
  onGrilla?: () => void;
  /** Abrir una fila de una pieza: su detalle de siempre, como al tocarla en la grilla. */
  onFila?: (g: Grafico, clave: string) => void;
  compartido?: boolean;
  /** La miniatura de «Nueva hoja». */
  quieta?: boolean;
}) {
  const { frase, hero, respondidos, rapidos, respuesta, enviados, tipos, setters, fallos } = vista;
  const p = hoja.diseno?.piezas ?? {};
  const pieza = (id: string | undefined) => hoja.componentes.find((c): c is Grafico => c.id === id && c.clase === 'grafico');
  const abrir = (id: string | undefined, clave: string) => { const g = pieza(id); return g && onFila && !quieta ? () => onFila(g, clave) : undefined; };
  const fila = (fn: (() => void) | undefined) => (fn ? { role: 'button', tabIndex: 0, onClick: fn, onKeyDown: (e: KeyboardEvent) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); fn(); } } } : {});
  const raiz = useRef<HTMLDivElement>(null);
  const [rango, setRango] = useState<'Todo' | '7 días'>('Todo');
  const [agrupar, setAgrupar] = useState<'Días' | 'Semanas'>('Días');
  const [mezcla, setMezcla] = useState<'Recibidos' | 'Enviados'>('Recibidos');
  const [gente, setGente] = useState<'Mensajes' | 'En 15 min'>('Mensajes');
  const [marcada, setMarcada] = useState<number | null>(null);

  const dias = useMemo(() => (vista.dias && agrupar === 'Semanas' ? porSemana(vista.dias, vista.dias.columnas.find((c) => c.ahora)?.clave.slice(0, 10) ?? '') : vista.dias), [vista.dias, agrupar]);
  const cols = dias?.columnas ?? [];
  const ahoraIdx = cols.findIndex((c) => c.ahora) >= 0 ? cols.findIndex((c) => c.ahora) : cols.length - 1;
  const idx = Math.min(cols.length - 1, marcada ?? ahoraIdx);

  // ── La entrada de Parley: el saludo, la frase, las herramientas y las tarjetas, una vez, al montarse ─────────────────────
  useLayoutEffect(() => {
    const el = raiz.current;
    if (!el || quieta || sinMovimiento()) return;
    el.querySelectorAll('.parl-top__title .parl-w').forEach((n, i) => anim(n, [{ opacity: 0, transform: 'translateY(70%)' }, { opacity: 1, transform: 'none' }], { duration: 600, delay: i * 60, easing: P3 }));
    anim(el.querySelector('.parl-top__sub'), [{ opacity: 0, transform: 'translateY(6px)' }, { opacity: 1, transform: 'none' }], { duration: 500, delay: 150, easing: P3 });
    el.querySelectorAll('.parl-top__tools > *').forEach((n, i) => anim(n, [{ opacity: 0, transform: 'translateY(-8px)' }, { opacity: 1, transform: 'none' }], { duration: 500, delay: 200 + i * 60, easing: P3 }));
    el.querySelectorAll('.parl-grid > .parl-card').forEach((n, i) => anim(n, [{ opacity: 0, transform: 'translateY(28px) scale(.985)' }, { opacity: 1, transform: 'none' }], { duration: 800, delay: i * 80, easing: P3 }));
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Lo que corre la PRIMERA vez que llegan los datos de cada tarjeta (los datos llegan después de montar) ───────────────────
  const firma = [hero.total, hero.columnas.length, respondidos.pct, rapidos.n, respuesta.mediana, enviados?.puntos.length, cols.length, tipos?.totales.recibidos, setters.length].join('|');
  useEffect(() => {
    const el = raiz.current;
    if (!el || quieta || sinMovimiento()) return;
    const tarjetas = [...el.querySelectorAll<HTMLElement>('.parl-grid > .parl-card')];
    const arranque = (n: Element) => Math.max(0, tarjetas.indexOf(n.closest('.parl-card') as HTMLElement)) * 80 + 250;
    const una = (sel: string, fn: (n: HTMLElement, i: number) => void) => el.querySelectorAll<HTMLElement>(sel).forEach((n, i) => { if (n.dataset.animado != null) return; n.dataset.animado = ''; fn(n, i); });
    una('[data-cuenta]', (n) => { if (/\d/.test(n.textContent ?? '')) contar(n, arranque(n), Number(n.dataset.cuenta) || 1400); });
    una('.parl-hbar .parl-hbar__bar', (n, i) => anim(n, [{ transform: 'translateY(100%)' }, { transform: 'none' }], { duration: 1100, delay: arranque(n) + i * 60, easing: P4 }));
    una('.parl-cells', (n) => n.querySelectorAll('b.parl-on').forEach((b, i) => anim(b, [{ transform: 'scaleY(0)' }, { transform: 'scaleY(1)' }], { duration: 350, delay: arranque(n) + i * 18, easing: BACK })));
    una('.parl-budget__bar i', (n) => anim(n, [{ transform: 'scaleX(0)' }, { transform: 'scaleX(1)' }], { duration: 1200, delay: arranque(n), easing: P3 }));
    una('.parl-area svg', (n) => anim(n, [{ clipPath: 'inset(0 100% 0 0)' }, { clipPath: 'inset(0 0 0 0)' }], { duration: 1200, delay: arranque(n), easing: P3 }));
    una('.parl-area__dot', (n) => anim(n, [{ opacity: 0 }, { opacity: 1 }], { duration: 300, delay: arranque(n) + 1100 }));
    una('.parl-mcol__stack', (n, i) => anim(n, [{ transform: 'scaleY(0)' }, { transform: 'scaleY(1)' }], { duration: 1000, delay: arranque(n) + i * 40, easing: P3 }));
    una('.parl-mtip', (n) => anim(n, [{ opacity: 0 }, { opacity: 1 }], { duration: 400, delay: arranque(n) + 700, easing: P3 }));
    una('.parl-donut .parl-arco', (n, i) => anim(n, [{ strokeDasharray: `0.1 ${C}` }, { strokeDasharray: n.getAttribute('stroke-dasharray') ?? `0.1 ${C}` }], { duration: 1000, delay: arranque(n) + i * 120, easing: P3 }));
    una('.parl-person', (n, i) => anim(n, [{ opacity: 0, transform: 'translateY(18px)' }, { opacity: 1, transform: 'none' }], { duration: 600, delay: arranque(n) + i * 60, easing: P3 }));
    una('.parl-person__bar i', (n, i) => anim(n, [{ transform: 'scaleX(0)' }, { transform: 'scaleX(1)' }], { duration: 900, delay: arranque(n) + i * 60 + 150, easing: P3 }));
  }, [firma, quieta]);

  // Al cambiar de día con el mouse, el globo rebota (escala .85 → 1, .4 s, back.out(2)).
  const tip = useRef<HTMLDivElement>(null), antes = useRef(idx);
  useEffect(() => {
    if (antes.current !== idx && !quieta && !sinMovimiento()) anim(tip.current, [{ transform: 'scale(.85)' }, { transform: 'none' }], { duration: 400, easing: BACK2 });
    antes.current = idx;
  }, [idx, quieta]);

  const respuestaN = duracion(respuesta.mediana);
  const puntos = enviados ? (rango === '7 días' ? enviados.puntos.slice(-8) : enviados.puntos) : [];
  const ultimo = puntos[puntos.length - 1];
  const completos = enviados ? enviados.puntos.filter((x) => !x.ahora) : [];
  const promedio = completos.length ? completos.reduce((a, x) => a + x.valor, 0) / completos.length : null;
  const hTope = Math.max(1, ...hero.columnas.map((c) => c.valor)) * 1.1;
  const partes = tipos ? (mezcla === 'Recibidos' ? tipos.recibidos : tipos.enviados) : [];
  const totalMezcla = tipos ? (mezcla === 'Recibidos' ? tipos.totales.recibidos : tipos.totales.enviados) : 0;
  const maxSetter = Math.max(1, ...setters.map((s) => s.turnos));
  const c = cols[idx];
  const tope = dias?.tope ?? 1;
  const centro = cols.length ? ((idx + 0.5) / cols.length) * 100 : 0;
  let acum = HUECO / 2;

  return (
    <Compartido.Provider value={compartido}>
    <div className="parl" ref={raiz} data-quieta={quieta ? '' : undefined}>
      <style href="dash-hoja-chat" precedence="medium">{CSS_CHAT}</style>
      <div className="parl-pagina">
        {/* LA CABECERA: el saludo, la frase (en lugar de «Here's how your conversations moved today») y, en lugar del buscador, el
            «Last sync» y el avatar: el período, la grilla y los chats. */}
        <header className="parl-top">
          <div className="parl-top__h">
            <h1 className="parl-top__title">{titulo.split(' ').map((w, i) => <span key={i}>{i ? ' ' : ''}<span className="parl-w">{w}</span></span>)}</h1>
            {frase.length > 0 && <p className="parl-top__sub">{frase.map((t, i) => (t.tipo === 'fuerte' ? <b key={i}>{t.s}</b> : <span key={i}>{t.s}</span>))}</p>}
          </div>
          <div className="parl-top__tools">
            <span className="parl-search parl-periodo"><Icono id="cal" />{periodo}</span>
            {onGrilla && <button type="button" className="parl-sync" onClick={onGrilla}><Icono id="grid" /><span className="parl-sync__t"><b>Ver la grilla</b><small>Todas las piezas</small></span></button>}
            {!compartido && <Ir href="/chats" className="parl-avatar" etiqueta="Abrir tus chats"><Icono id="chat" /></Ir>}
          </div>
        </header>

        <main className="parl-grid">
          {/* LA TARJETA NARANJA («Audience»): los mensajes recibidos, los chats, su cambio y las últimas columnas del período. */}
          <article className="parl-card parl-card--hero parl-g-aud">
            <div className="parl-card__head"><h2 className="parl-card__title">Mensajes recibidos</h2>{hero.hoy != null && <span className="parl-live"><i />{entero(hero.hoy)} hoy</span>}</div>
            {fallos.hero ? <Vacio titulo={fallos.hero} /> : hero.total == null ? <Vacio titulo="Todavía no hay mensajes" texto="Cuando te escriban por WhatsApp, aparecen aquí." /> : (
              <>
                <div className="parl-fig"><span className="parl-fig__n parl-fig__n--hero parl-num" data-cuenta="1600">{entero(hero.total)}</span></div>
                <div className="parl-hero__sub">
                  {hero.chats != null && <span><b className="parl-num" data-cuenta="1400">{entero(hero.chats)}</b>&nbsp; {hero.chats === 1 ? 'chat' : 'chats'}</span>}
                  <Chip c={hero.cambio} clase=" parl-chip--hero" />
                </div>
                {hero.columnas.length > 0 ? (
                  <div className="parl-hbars">
                    {hero.columnas.map((col, i) => (
                      <div key={col.clave} className={`parl-hbar${i === hero.pico ? ' parl-is-peak' : ''}`} title={`${col.rotulo}: ${entero(col.valor)} ${col.valor === 1 ? 'recibido' : 'recibidos'}`}>
                        <i className="parl-hbar__bar" style={{ height: `${(col.valor / hTope) * 100}%` }}><span className="parl-hbar__val">{corto(col.valor)}</span></i>
                      </div>
                    ))}
                    {hero.columnas.map((col) => <span key={`m${col.clave}`} className="parl-hbar__m">{col.corto}</span>)}
                  </div>
                ) : <div className="parl-hbars" />}
              </>
            )}
          </article>

          {/* RESPONDIDOS («Delivery rate»): qué parte de las veces que te escribieron tuvo respuesta, y cuántos esperan hoy. */}
          <article className="parl-card parl-g-del">
            <div className="parl-card__head"><h2 className="parl-card__title">Respondidos</h2>{respondidos.esperando != null && <Ir href="/chats" className="parl-card__meta">{entero(respondidos.esperando)} esperando</Ir>}</div>
            {fallos.respondidos ? <Vacio titulo={fallos.respondidos} /> : respondidos.pct == null ? <Vacio titulo="Todavía no te escribieron" /> : (
              <>
                <div className="parl-fig"><span className="parl-fig__n parl-num" data-cuenta="1400">{conDecimal(respondidos.pct)}</span><span className="parl-fig__u">%</span><Chip c={respondidos.cambio} /></div>
                <Casillas llenas={casillasDe(respondidos.pct)} />
              </>
            )}
          </article>

          {/* EN 15 MINUTOS («Active campaigns»): cuántas veces se respondió en menos de 15 minutos, de cuántas. */}
          <article className="parl-card parl-g-camp">
            <div className="parl-card__head"><h2 className="parl-card__title">En menos de {META_MINUTOS} min</h2>{rapidos.pct != null && <span className="parl-card__meta">el {Math.round(rapidos.pct)}% del total</span>}</div>
            {fallos.rapidos ? <Vacio titulo={fallos.rapidos} /> : rapidos.n == null || rapidos.de == null ? <Vacio titulo="Todavía no te escribieron" /> : (
              <>
                <div className="parl-fig"><span className="parl-fig__n parl-num" data-cuenta="1000">{entero(rapidos.n)}</span><span className="parl-fig__u parl-fig__u--slash">/ {entero(rapidos.de)}</span><Chip c={rapidos.cambio} /></div>
                <Casillas llenas={casillasDe(rapidos.pct)} violeta />
              </>
            )}
          </article>

          {/* EL TIEMPO DE RESPUESTA («Credits»): la mediana, su barra contra los 15 minutos de MaKo y el 10 % más lento. */}
          <article className="parl-card parl-g-cred">
            <div className="parl-card__head">
              <h2 className="parl-card__title"><Icono id="reloj" />Tiempo de respuesta</h2>
              {!compartido && <div className="parl-topup"><Ir href="/chats" className="parl-topup__btn" etiqueta="Abrir tus chats"><Icono id="flecha" /></Ir></div>}
            </div>
            {fallos.respuesta ? <Vacio titulo={fallos.respuesta} /> : !respuestaN ? <Vacio titulo="Todavía no hay respuestas" texto="Cuando respondas un chat, aquí verás cuánto tardas." /> : (
              <>
                <div className="parl-fig"><span className="parl-fig__n parl-num" data-cuenta="1400">{respuestaN.n}</span><span className="parl-fig__u parl-fig__u--soft">{respuestaN.u} de mediana</span></div>
                <div className="parl-budget">
                  <div className={`parl-budget__bar${respuesta.pasa ? ' parl-is-pasa' : ''}`}><i style={{ width: `${Math.max(2, (respuesta.relleno ?? 0) * 100)}%` }} /></div>
                  <div className="parl-budget__foot">
                    <span><b>{duracionTexto(respuesta.mediana)}</b>, meta: {META_MINUTOS} min</span>
                    {respuesta.p90 != null && <span>el 10% más lento: {duracionTexto(respuesta.p90)}</span>}
                  </div>
                </div>
              </>
            )}
          </article>

          {/* LOS ENVIADOS (la tarjeta oscura, «Messages sent»): lo que mandaste día por día, con el de hoy punteado. */}
          <article className="parl-card parl-card--dark parl-g-sent">
            <div className="parl-card__head">
              <h2 className="parl-card__title">Mensajes enviados</h2>
              {enviados && enviados.paso === 'dia' && enviados.puntos.length > 8 && <Seg opciones={['Todo', '7 días']} valor={rango} onCambio={(v) => setRango(v as 'Todo' | '7 días')} oscuro />}
            </div>
            {fallos.enviados ? <Vacio titulo={fallos.enviados} /> : !enviados || enviados.total == null ? <Vacio titulo="Todavía no mandaste mensajes" /> : (
              <>
                <div className="parl-fig"><span className="parl-fig__n parl-fig__n--dark parl-num" data-cuenta="1800">{entero(enviados.total)}</span></div>
                <div className="parl-sent__sub">
                  {enviados.hoy != null && <span><span className="parl-num" data-cuenta="1400">{entero(enviados.hoy)}</span>&nbsp; hoy</span>}
                  {promedio != null && <span className="parl-chip parl-chip--dark parl-chip--n">{corto(Math.round(promedio))} por {enviados.paso === 'dia' ? 'día' : enviados.paso}</span>}
                </div>
                <Area key={rango} valores={puntos.map((x) => x.valor)} ahora={!!ultimo?.ahora} />
                <div className="parl-area__axis">
                  <span>{puntos[0]?.rotulo}</span>
                  <span>{puntos[Math.floor((puntos.length - 1) / 2)]?.rotulo}</span>
                  <span>{ultimo?.ahora && enviados.paso === 'dia' ? 'Hoy' : ultimo?.rotulo}</span>
                </div>
              </>
            )}
          </article>

          {/* POR DÍA («Messages by month»): lo respondido y, rayado, lo que quedó sin respuesta. */}
          <article className="parl-card parl-card--month parl-g-month">
            <div className="parl-month__head">
              <h2 className="parl-card__title">{agrupar === 'Semanas' || dias?.paso === 'semana' ? 'Por semana' : dias?.paso === 'mes' ? 'Por mes' : 'Por día'}</h2>
              {vista.dias?.paso === 'dia' && <Seg opciones={['Días', 'Semanas']} valor={agrupar} onCambio={(v) => { setAgrupar(v as 'Días' | 'Semanas'); setMarcada(null); }} />}
            </div>
            {/* La leyenda va DEBAJO de la cabecera y no al lado del título: en el teléfono no entra junto a «Días · Semanas». */}
            <div className="parl-legend parl-legend--bajo"><span><i className="parl-sw" />Respondidos</span><span><i className="parl-sw parl-sw--hatch" />Sin respuesta</span></div>
            {fallos.dias ? <Vacio titulo={fallos.dias} /> : !cols.length ? <Vacio titulo="Todavía no te escribieron" texto="Aquí verás, cada día, cuántas veces respondiste." /> : (
              <div className={`parl-mchart${marcada != null ? ' parl-is-hovering' : ''}`}>
                <div className="parl-mchart__plot" onPointerLeave={() => setMarcada(null)}>
                  {[4, 3, 2, 1, 0].map((k) => <div key={k} className="parl-mchart__grid" style={{ top: `${(1 - k / 4) * 100}%` }}><span>{corto((tope * k) / 4)}</span></div>)}
                  <div className="parl-mchart__cols" style={{ gridTemplateColumns: `repeat(${cols.length}, minmax(0, 1fr))` }}>
                    {cols.map((col, i) => {
                      const sin = col.turnos - col.respondidos;
                      return (
                        <div key={col.clave} className={`parl-mcol${i === idx ? ' parl-is-on' : ''}`} onPointerEnter={() => setMarcada(i)}>
                          {col.turnos > 0 && (
                            <div className={`parl-mcol__stack${sin ? '' : ' parl-solo'}`} style={{ height: `${(col.turnos / tope) * 100}%` }}>
                              {sin > 0 && <i className="parl-mcol__aw" style={{ height: `${(sin / col.turnos) * 100}%` }} />}
                              <i className="parl-mcol__rep" style={{ flex: 1 }} />
                            </div>
                          )}
                          <span className="parl-mcol__x"><span className="parl-l">{col.corto}</span><span className="parl-c">{col.corto}</span></span>
                        </div>
                      );
                    })}
                  </div>
                  {c && c.turnos > 0 && (
                    <div className="parl-mtip" ref={tip} aria-hidden style={{ left: `clamp(0px, calc(${centro}% - 66px), calc(100% - 133px))`, bottom: `calc(${(c.turnos / tope) * 100}% + 12px)` }}>
                      <b>{c.ahora && dias?.paso === 'dia' ? 'Hoy' : dias?.paso === 'semana' ? `Semana del ${c.rotulo}` : c.rotulo} · {entero(c.turnos)}</b>
                      <div><span><i className="parl-sw" />Respondidos</span><span>{entero(c.respondidos)}</span></div>
                      <div><span><i className="parl-sw parl-sw--hatch" />Sin respuesta</span><span>{entero(c.turnos - c.respondidos)}</span></div>
                    </div>
                  )}
                </div>
              </div>
            )}
          </article>

          {/* POR TIPO («Channel mix»): el reparto entre texto, audio, imagen… de lo recibido o de lo enviado. */}
          <article className="parl-card parl-g-mix">
            <div className="parl-card__head"><h2 className="parl-card__title">Por tipo</h2><Seg opciones={['Recibidos', 'Enviados']} valor={mezcla} onCambio={(v) => setMezcla(v as 'Recibidos' | 'Enviados')} /></div>
            {fallos.tipos ? <Vacio titulo={fallos.tipos} /> : !partes.length ? <Vacio titulo={mezcla === 'Recibidos' ? 'Todavía no te escribieron' : 'Todavía no mandaste mensajes'} /> : (
              <>
                <div className="parl-donut">
                  <div className="parl-donut__w">
                    <svg viewBox="0 0 128 128" aria-hidden key={mezcla}>
                      <circle cx="64" cy="64" r={R} fill="none" stroke="#f7f2eb" strokeWidth={TRAZO} />
                      {partes.map((x, i) => {
                        const largo = (x.pct / 100) * C;
                        // Una sola parte es el anillo entero; si no, cada parte con su hueco y sus puntas redondas, como Parley.
                        const vis = partes.length === 1 ? C : Math.max(0.1, largo - HUECO - TRAZO);
                        const desde = acum; acum += largo;
                        return <circle key={x.clave} className="parl-arco" cx="64" cy="64" r={R} fill="none" stroke={COLORES[i]} strokeWidth={TRAZO} strokeLinecap={partes.length === 1 ? 'butt' : 'round'} strokeDasharray={`${vis} ${C}`} strokeDashoffset={-(desde + (partes.length === 1 ? 0 : TRAZO / 2))} />;
                      })}
                    </svg>
                    <div className="parl-donut__c"><b className="parl-num">{corto(totalMezcla)}</b><small>{totalMezcla === 1 ? 'mensaje' : 'mensajes'}</small></div>
                  </div>
                </div>
                <ul className="parl-mix">
                  {partes.map((x, i) => (
                    <li key={x.clave} {...fila(x.otros ? undefined : abrir(p.tipos, x.clave))} className={!x.otros && abrir(p.tipos, x.clave) ? 'parl-fila' : undefined}>
                      <i className="parl-mix__dot" style={{ background: COLORES[i] }} /><span className="parl-mix__name">{x.nombre}</span>
                      <span className="parl-mix__pct parl-num">{Math.round(x.pct)}%</span><span className="parl-chip parl-chip--n parl-mix__n">{corto(x.valor)}</span>
                    </li>
                  ))}
                </ul>
              </>
            )}
          </article>

          {/* POR SETTER («Top contacts»): cuántas veces le escribieron a cada uno, qué parte del total y cuánto respondió rápido. */}
          <article className="parl-card parl-g-top">
            <div className="parl-card__head"><h2 className="parl-card__title">Por setter</h2><Seg opciones={['Mensajes', 'En 15 min']} valor={gente} onCambio={(v) => setGente(v as 'Mensajes' | 'En 15 min')} /></div>
            {fallos.setters ? <Vacio titulo={fallos.setters} /> : !setters.length ? <Vacio titulo="Todavía no hay mensajes con setter" texto="Cuando un setter tenga chats asignados, aparece aquí." /> : (
              <ul className="parl-people">
                {setters.map((s, i) => {
                  const rapido = gente === 'En 15 min';
                  const ancho = rapido ? (s.rapidos ?? 0) : (s.turnos / maxSetter) * 100;
                  return (
                    <li key={s.clave} className={`parl-person${abrir(p.setters, s.clave) ? ' parl-fila' : ''}`} {...fila(abrir(p.setters, s.clave))}>
                      <span className="parl-person__av" style={{ background: FONDOS[i % FONDOS.length] }}>{s.iniciales}</span>
                      <div className="parl-person__mid">
                        <div className="parl-person__name"><b>{s.nombre}</b><small>{rapido ? `${entero(s.turnos)} ${s.turnos === 1 ? 'mensaje' : 'mensajes'}` : s.rapidos != null ? `${Math.round(s.rapidos)}% en ${META_MINUTOS} min` : ''}</small></div>
                        <div className="parl-person__bar"><i style={{ width: `${Math.max(2, Math.min(100, ancho))}%` }} /></div>
                      </div>
                      <div className="parl-person__n">
                        <b className="parl-num">{rapido ? (s.rapidos != null ? `${Math.round(s.rapidos)}%` : '—') : entero(s.turnos)}</b>
                        <small>{rapido ? `en ${META_MINUTOS} min` : `${Math.round(s.parte)}%`}</small>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </article>
        </main>
      </div>
    </div>
    </Compartido.Provider>
  );
}
