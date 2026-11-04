'use client';

// =============================================================================
// HojaAutomatizaciones — la hoja Automatizaciones con su DISEÑO PROPIO: la copia de Noria, con los datos reales de MaKo
// =============================================================================
// Martín, 4/11/2026: «que sea primero la copia, es decir, que se vea exactamente igual que la copia, y después la adaptación con
// Maco... copiarlo todo, desde las animaciones de entrada, las animaciones de hover, las animaciones de clic». La copia y la
// adaptación (maquetas) están en docs/diseno/mockups-dashboard/automatizaciones-noria/; ésta es la adaptación con los datos de
// verdad (lib/automatizaciones-diseno.ts arma lo que dibuja cada bloque, con test). La pregunta: «¿qué corrió y qué falló?».
//
// El movimiento sale del INFORME de Noria (docs/diseno/mockups-dashboard/demos/noria/INFORME.txt, la línea de tiempo del armazón):
// la página entra a los .12 s y la barra de arriba baja 12 px cada .05 s (acá: las migas, el saludo, la frase y los botones); las
// tarjetas suben 18 px cada .06 s. Lo que el INFORME no dice (el código de la página Overview no está) y se supone, anotado en el
// relevo: las columnas crecen desde abajo (.7 s, cada .024 s), la línea dorada se destapa de izquierda a derecha (1,1 s), los
// números cuentan desde 0 (1,1 s), los pasos entran desde la izquierda, las casillas aparecen de a una (.42 s, con rebote) y las
// líneas de la tabla se destapan (.9 s). El hover es el del INFORME: la fila de la tabla se pinta, una sugerencia se tiñe, la
// pastilla del período se desliza (.35 s).
//
// ⚠️ Mirando se dibuja esto; editando, la grilla con los mismos componentes (app/dashboard/EditorInforme.tsx).
// ⚠️ Lo que Noria tiene y MaKo no mide no está (lib/automatizaciones-diseno.ts): las horas ahorradas, la corrida en vivo con sus
//    milisegundos, el pulso por hora, quién cambió qué, el «Live» de cada flujo y el reintento. La barra lateral la pone la app.
// =============================================================================

import { createContext, useContext, useEffect, useLayoutEffect, useMemo, useRef, useState, type KeyboardEvent, type ReactNode } from 'react';
import Link from '@/app/_ui/Link';
import type { Grafico, Hoja } from '@/lib/graficos-catalogo';
import { conDecimal, horasTexto, type Cambio, type Nivel, type VistaAutomatizaciones } from '@/lib/automatizaciones-diseno';
import { entero } from '@/lib/marketing-diseno';
import { CSS_AUTOMATIZACIONES } from './automatizaciones-css';

const Compartido = createContext(false);

const P = {
  grid: 'M4.5 4.5h6v6h-6zM13.5 4.5h6v6h-6zM4.5 13.5h6v6h-6zM13.5 13.5h6v6h-6z',
  plus: 'M12 5v14M5 12h14',
  chev: 'M9 6l6 6-6 6',
  expand: 'M8 16L16 8M9.5 8H16v6.5',
  check: 'M5 12.5l4.5 4.5L19 7.5',
  alert: 'M12 4l9 15.5H3zM12 10v4.5M12 17.2v.1',
  arrow: 'M5 12h14M13 6l6 6-6 6',
  send: 'M20.5 3.5L10.2 13.8M20.5 3.5l-6.5 17-3.8-6.7-6.7-3.8z',
  spark: 'M10 4l1.6 4.4L16 10l-4.4 1.6L10 16l-1.6-4.4L4 10l4.4-1.6zM17.5 14.5l.8 2.2 2.2.8-2.2.8-.8 2.2-.8-2.2-2.2-.8 2.2-.8z',
  entrar: 'M4 12h11M11 7l5 5-5 5M19 4.5v15',
  mensaje: 'M5 5.5h14a1.5 1.5 0 0 1 1.5 1.5v8.5A1.5 1.5 0 0 1 19 17h-8l-4.5 3.5V17H5a1.5 1.5 0 0 1-1.5-1.5V7A1.5 1.5 0 0 1 5 5.5z',
  responde: 'M9 8L4.5 12.5 9 17M5 12.5h9a5 5 0 0 1 5 5v1',
  flujo: 'M6 3.7a2.3 2.3 0 1 0 0 4.6 2.3 2.3 0 1 0 0-4.6M18 15.7a2.3 2.3 0 1 0 0 4.6 2.3 2.3 0 1 0 0-4.6M8.3 6H14a3 3 0 0 1 3 3a3 3 0 0 1-3 3h-4a3 3 0 0 0-3 3a3 3 0 0 0 3 3h5.7',
} as const;
function Icono({ id }: { id: keyof typeof P }) {
  return <svg className="nor-i" viewBox="0 0 24 24" aria-hidden><path d={P[id]} /></svg>;
}
function Flecha({ baja }: { baja?: boolean }) {
  return <svg className="nor-i" viewBox="0 0 12 12" aria-hidden><path d={baja ? 'M3 4.5L6 7.5 9 4.5' : 'M3 9l6-6M4 3h5v5'} /></svg>;
}

const P3 = 'cubic-bezier(.215, .61, .355, 1)', BACK = 'cubic-bezier(.34, 1.56, .64, 1)', INOUT = 'cubic-bezier(.65, 0, .35, 1)';
const sinMovimiento = () => typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
const eP3 = (t: number) => 1 - Math.pow(1 - t, 3);
const anim = (n: Element | null | undefined, kf: Keyframe[], o: KeyframeAnimationOptions) => { if (n && 'animate' in n) (n as HTMLElement).animate(kf, { fill: 'backwards', ...o }); };

/** Cuenta el número de un texto desde cero («1,240», «96.4%», «16.3»), con su prefijo, sus decimales y su sufijo. */
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
  if (useContext(Compartido)) return <span className={`${className ?? ''} nor-quieta`} aria-label={etiqueta}>{children}</span>;
  return <Link href={href} className={className} aria-label={etiqueta}>{children}</Link>;
}
function Chip({ c }: { c: Cambio }) {
  if (!c.cambio) return null;
  const baja = c.sube === false;
  return <span className={`nor-chip ${baja ? 'nor-chip--down' : 'nor-chip--up'}`}><Flecha baja={baja} />{c.cambio}</span>;
}
function Vacio({ titulo, texto }: { titulo: string; texto?: string }) {
  return <div className="nor-vacio"><b>{titulo}</b>{texto}</div>;
}
function Seg({ opciones, valor, onCambio }: { opciones: readonly string[]; valor: string; onCambio: (v: string) => void }) {
  const caja = useRef<HTMLDivElement>(null), marca = useRef<HTMLSpanElement>(null);
  // La pastilla se desliza (.35 s con la curva de Noria): la única transición de transform de su INFORME.
  useLayoutEffect(() => {
    const b = caja.current?.querySelector<HTMLElement>('.nor-is-on'), m = marca.current;
    if (b && m) { m.style.width = `${b.offsetWidth}px`; m.style.transform = `translateX(${b.offsetLeft}px)`; }
  }, [valor, opciones.length]);
  return (
    <div className="nor-seg" role="group" ref={caja} style={{ position: 'relative' }}>
      <span ref={marca} aria-hidden style={{ position: 'absolute', top: 4, left: 0, height: 29, borderRadius: 10, background: 'var(--raised)', boxShadow: '0 1px 2px #14221e14, 0 4px 10px -4px #14221e2e', transition: 'transform .35s var(--ease), width .35s var(--ease)', pointerEvents: 'none' }} />
      {opciones.map((o) => (
        <button key={o} type="button" className={`nor-seg__btn${o === valor ? ' nor-is-on' : ''}`} style={{ position: 'relative', zIndex: 1, background: 'transparent', boxShadow: 'none' }} aria-pressed={o === valor} onClick={() => onCambio(o)}>{o}</button>
      ))}
    </div>
  );
}

const curva = (pts: Array<readonly [number, number]>) => {
  let d = `M${pts[0][0].toFixed(2)},${pts[0][1].toFixed(2)}`;
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[i - 1] ?? pts[i], p1 = pts[i], p2 = pts[i + 1], p3 = pts[i + 2] ?? p2;
    d += ` C${(p1[0] + (p2[0] - p0[0]) / 6).toFixed(2)},${(p1[1] + (p2[1] - p0[1]) / 6).toFixed(2)} ${(p2[0] - (p3[0] - p1[0]) / 6).toFixed(2)},${(p2[1] - (p3[1] - p1[1]) / 6).toFixed(2)} ${p2[0].toFixed(2)},${p2[1].toFixed(2)}`;
  }
  return d;
};
/** Los tramos de la línea dorada: se corta donde no hay con qué comparar (las primeras columnas del período). */
function tramos(valores: Array<number | null>, n: number, tope: number): string {
  const ds: string[] = [];
  let actual: Array<readonly [number, number]> = [];
  const cierra = () => { if (actual.length > 1) ds.push(curva(actual)); actual = []; };
  valores.forEach((v, i) => { if (v == null) cierra(); else actual.push([((i + 0.5) / n) * 1000, 100 - (v / tope) * 100]); });
  cierra();
  return ds.join(' ');
}
function Spark({ valores }: { valores: number[] }) {
  if (valores.length < 2) return null;
  const W = 110, H = 26, max = Math.max(1, ...valores);
  const pts = valores.map((v, i) => [(i / (valores.length - 1)) * W, H - 1 - (v / max) * (H - 3)] as const);
  const d = curva(pts);
  return <svg className="nor-spark" viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" aria-hidden><path className="nor-a" d={`${d} L${W},${H} L0,${H} Z`} /><path className="nor-l" d={d} /></svg>;
}

const COLORES_AP = ['oi', 'bw', 'dv', 'pw'] as const;
const COLORES_AV = ['mint', 'sand', 'rose', 'sky', 'peach'] as const;
const PASO_ICONO = { entraron: 'entrar', escritos: 'mensaje', respondieron: 'responde', siguen: 'flujo' } as const;
const PASO_AP = { entraron: 'bw', escritos: 'oi', respondieron: 'dv', siguen: 'pw' } as const;
const NIVELES: ReadonlyArray<[Nivel, string]> = [[1, '99.5%+'], [2, '98%+'], [3, '95%+'], [4, 'Menos'], [0, 'Sin envíos']];
const diaCorto = (dia: string) => new Date(`${dia}T12:00:00Z`).toLocaleDateString('es-MX', { day: 'numeric', month: 'short', timeZone: 'UTC' });
const fechaLarga = (hoy: string) => new Date(`${hoy}T12:00:00Z`).toLocaleDateString('es-MX', { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'UTC' });

export function HojaAutomatizaciones({ hoja, vista, titulo, periodo, hoy, onGrilla, onFila, compartido = false, quieta = false }: {
  hoja: Hoja;
  vista: VistaAutomatizaciones;
  /** «Buenos días, Ana» (quién mira); sin nombre, el de la hoja. */
  titulo: string;
  /** El nombre del período elegido («Últimos 30 días»): el de la barra de controles de la hoja. */
  periodo: string;
  hoy: string;
  onGrilla?: () => void;
  /** Abrir una fila de una pieza: su detalle de siempre, como al tocarla en la grilla. */
  onFila?: (g: Grafico, clave: string) => void;
  compartido?: boolean;
  /** La miniatura de «Nueva hoja». */
  quieta?: boolean;
}) {
  const { frase, numeros, pulso, recorrido, fallos, confiabilidad, flujos, horas, problemas } = vista;
  const p = hoja.diseno?.piezas ?? {};
  const pieza = (id: string | undefined) => hoja.componentes.find((c): c is Grafico => c.id === id && c.clase === 'grafico');
  const abrir = (id: string | undefined, clave: string) => { const g = pieza(id); return g && onFila && !quieta ? () => onFila(g, clave) : undefined; };
  const fila = (fn: (() => void) | undefined) => (fn ? { role: 'button', tabIndex: 0, onClick: fn, onKeyDown: (e: KeyboardEvent) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); fn(); } } } : {});
  const raiz = useRef<HTMLDivElement>(null);
  const [rango, setRango] = useState<'7 días' | '30 días'>('30 días');
  const [marcada, setMarcada] = useState<number | null>(null);

  const todas = pulso?.columnas ?? [];
  const conRango = pulso?.paso === 'dia' && todas.length > 7;
  const cols = useMemo(() => (conRango ? todas.slice(rango === '7 días' ? -7 : -30) : todas), [todas, conRango, rango]);
  const tope = pulso?.tope ?? 1;
  const ahoraIdx = cols.findIndex((c) => c.ahora);
  const paso = Math.max(1, Math.ceil(cols.length / 8));
  const eje = cols.map((c, i) => ({ c, i })).filter(({ i }) => (cols.length - 1 - i) % paso === 0);

  // ── La entrada de Noria: la cabecera y las tarjetas, una vez, al montarse ─────────────────────────────────────────────
  useLayoutEffect(() => {
    const el = raiz.current;
    if (!el || quieta || sinMovimiento()) return;
    el.querySelectorAll('.nor-ov__head > div > *, .nor-ov__acts > *').forEach((n, i) => anim(n, [{ opacity: 0, transform: 'translateY(14px)' }, { opacity: 1, transform: 'none' }], { duration: 700, delay: 120 + i * 50, easing: P3 }));
    el.querySelectorAll('.nor-ov > .nor-card').forEach((n, i) => anim(n, [{ opacity: 0, transform: 'translateY(18px)' }, { opacity: 1, transform: 'none' }], { duration: 800, delay: 180 + i * 60, easing: P3 }));
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Lo que corre la PRIMERA vez que llegan los datos de cada tarjeta (los datos llegan después de montar) ───────────────────
  const firma = [numeros.mensajes.valor, todas.length, recorrido.pasos[0].n, fallos.filas.length, confiabilidad.length, flujos.length, horas.length].join('|');
  useEffect(() => {
    const el = raiz.current;
    if (!el || quieta || sinMovimiento()) return;
    const tarjetas = [...el.querySelectorAll<HTMLElement>('.nor-ov > .nor-card')];
    const arranque = (n: Element) => Math.max(0, tarjetas.indexOf(n.closest('.nor-card') as HTMLElement)) * 60 + 320;
    const una = (sel: string, fn: (n: HTMLElement, i: number) => void) => el.querySelectorAll<HTMLElement>(sel).forEach((n, i) => { if (n.dataset.animado != null) return; n.dataset.animado = ''; fn(n, i); });
    una('[data-cuenta]', (n, i) => { if (/\d/.test(n.textContent ?? '')) contar(n, arranque(n) + i * 60, 1100); });
    una('.nor-pcol__ok, .nor-pcol__ko', (n) => { const i = [...el.querySelectorAll('.nor-pcol')].indexOf(n.closest('.nor-pcol') as Element); anim(n, [{ opacity: 0, transform: 'scaleY(0)' }, { opacity: 1, transform: 'none' }], { duration: 700, delay: arranque(n) + Math.max(0, i) * 24, easing: P3 }); });
    una('.nor-pulse__line', (n) => anim(n, [{ clipPath: 'inset(0 100% 0 0)' }, { clipPath: 'inset(0 0 0 0)' }], { duration: 1100, delay: arranque(n) + 160, easing: INOUT }));
    una('.nor-pulse__now', (n) => anim(n, [{ opacity: 0, transform: 'translateY(-6px)' }, { opacity: 1, transform: 'none' }], { duration: 500, delay: arranque(n) + 600, easing: P3 }));
    una('.nor-step', (n, i) => anim(n, [{ opacity: 0, transform: 'translateX(-8px)' }, { opacity: 1, transform: 'none' }], { duration: 500, delay: arranque(n) + 100 + i * 70, easing: P3 }));
    una('.nor-jf li', (n, i) => anim(n, [{ opacity: 0, transform: 'translateY(6px)' }, { opacity: 1, transform: 'none' }], { duration: 450, delay: arranque(n) + 280 + i * 40, easing: P3 }));
    una('.nor-look__row', (n, i) => anim(n, [{ opacity: 0, transform: 'translateY(10px)' }, { opacity: 1, transform: 'none' }], { duration: 600, delay: arranque(n) + 100 + i * 60, easing: P3 }));
    una('.nor-rel__d', (r, j) => r.querySelectorAll('i').forEach((c, i) => anim(c, [{ opacity: 0, transform: 'scale(.4)' }, { opacity: 1, transform: 'none' }], { duration: 420, delay: arranque(r) + 100 + j * 40 + i * 18, easing: BACK })));
    una('.nor-spark', (n, i) => anim(n, [{ clipPath: 'inset(0 100% 0 0)' }, { clipPath: 'inset(0 0 0 0)' }], { duration: 900, delay: arranque(n) + 200 + i * 60, easing: INOUT }));
    una('.nor-feed__item', (n, i) => anim(n, [{ opacity: 0, transform: 'translateY(8px)' }, { opacity: 1, transform: 'none' }], { duration: 500, delay: arranque(n) + 100 + i * 45, easing: P3 }));
    una('.nor-ask__sug', (n, i) => anim(n, [{ opacity: 0, transform: 'translateY(8px)' }, { opacity: 1, transform: 'none' }], { duration: 500, delay: arranque(n) + 160 + i * 50, easing: P3 }));
  }, [firma, quieta]);

  const n = numeros, pasoLinea = pulso?.paso === 'dia' ? 'el mismo día, una semana antes' : pulso?.paso === 'semana' ? 'la semana anterior' : 'el mes anterior';
  const marcadaCol = marcada != null ? cols[marcada] : null;
  const primerFallo = fallos.filas[0];

  return (
    <Compartido.Provider value={compartido}>
    <div className="nor" ref={raiz} data-quieta={quieta ? '' : undefined}>
      <style href="dash-hoja-automatizaciones" precedence="medium">{CSS_AUTOMATIZACIONES}</style>
      <div className="nor-pagina">
        {/* LA CABECERA: las migas (la fecha y el período), el saludo, la frase (en lugar de «110 runs since midnight…») y, en lugar
            de «Ask Copilot» y «New flow», la grilla y las automatizaciones. */}
        <div className="nor-ov__head">
          <div>
            <div className="nor-crumbs"><span>{fechaLarga(hoy)}</span><Icono id="chev" /><span>{periodo}</span></div>
            <h1 className="nor-ov__h1">{titulo}</h1>
            {frase.length > 0 && <p className="nor-ov__lede">{frase.map((t, i) => (t.tipo === 'fuerte' ? <b key={i}>{t.s}</b> : <span key={i}>{t.s}</span>))}</p>}
          </div>
          <div className="nor-ov__acts">
            {onGrilla && <button type="button" className="nor-btn nor-btn--ghost" onClick={onGrilla}><Icono id="grid" />Ver la grilla</button>}
            {!compartido && <Ir href="/automations" className="nor-btn nor-btn--primary"><Icono id="plus" />Nueva automatización</Ir>}
          </div>
        </div>

        <main className="nor-ov">
          {/* EL PULSO («Run pulse»): los cuatro números y, por día, lo que salió y lo que falló, con la línea de una semana antes. */}
          <section className="nor-card nor-ov__pulse">
            <div className="nor-card__head">
              <div><h2 className="nor-card__t">El pulso</h2><p className="nor-card__s">Lo que salió cada día. La línea dorada es lo que se intentó {pasoLinea}.</p></div>
              <div className="nor-card__tools">
                {conRango && <Seg opciones={['7 días', '30 días']} valor={rango} onCambio={(v) => { setRango(v as '7 días' | '30 días'); setMarcada(null); }} />}
                {!compartido && <Ir href="/automations" className="nor-ibtn nor-ibtn--sm nor-card__expand" etiqueta="Abrir Automations"><Icono id="expand" /></Ir>}
              </div>
            </div>
            {problemas.numeros ? <Vacio titulo={problemas.numeros} /> : (
              <div className="nor-kpis">
                <div className="nor-kpi">
                  <span className="nor-kpi__k">Mensajes</span>
                  <span className="nor-kpi__v nor-num" data-cuenta="">{n.mensajes.valor == null ? '—' : entero(n.mensajes.valor)}</span>
                  <Chip c={n.mensajes.cambio} />
                  <span className="nor-kpi__n">{n.mensajes.cambio.cambio ? 'contra el período anterior' : 'salieron en el período'}</span>
                </div>
                <div className="nor-kpi">
                  <span className="nor-kpi__k">Salieron bien</span>
                  <span className="nor-kpi__v nor-num" data-cuenta="">{n.exito.valor == null ? '—' : `${conDecimal(n.exito.valor)}%`}</span>
                  <Chip c={n.exito.cambio} />
                  <span className="nor-kpi__n">{n.exito.fallaron ? `${entero(n.exito.fallaron)} no ${n.exito.fallaron === 1 ? 'salió' : 'salieron'}` : n.exito.fallaron === 0 ? 'ninguno falló' : 'de lo que se intentó'}</span>
                </div>
                <div className="nor-kpi">
                  <span className="nor-kpi__k">Te respondieron</span>
                  <span className="nor-kpi__v nor-num" data-cuenta="">{n.respuesta.valor == null ? '—' : `${conDecimal(n.respuesta.valor)}%`}</span>
                  <Chip c={n.respuesta.cambio} />
                  <span className="nor-kpi__n">de los mensajes que salieron</span>
                </div>
                <div className="nor-kpi nor-kpi--saved">
                  <span className="nor-kpi__k">Personas que entraron</span>
                  <span className="nor-kpi__v nor-num" data-cuenta="">{n.entraron.valor == null ? '—' : entero(n.entraron.valor)}</span>
                  <Chip c={n.entraron.cambio} />
                  <span className="nor-kpi__n">{n.entraron.siguen != null ? <><b>{entero(n.entraron.siguen)}</b> siguen en el flujo</> : 'a una automatización'}</span>
                </div>
              </div>
            )}
            {problemas.pulso ? <Vacio titulo={problemas.pulso} /> : !cols.length ? <Vacio titulo="Todavía no salió nada" texto="Cuando tus automatizaciones manden mensajes, aquí verás cada día." /> : (
              <div className="nor-pulse">
                <div className={`nor-pulse__plot${marcada != null ? ' nor-con-marca' : ''}`} onPointerLeave={() => setMarcada(null)}>
                  {[0, 0.5, 1].map((f) => <div key={f} className="nor-pulse__grid" style={{ top: `${100 - f * 100}%` }} />)}
                  {[0, 0.5, 1].map((f) => <span key={`y${f}`} className="nor-pulse__y" style={{ top: `${100 - f * 100}%` }}>{entero(f * tope)}</span>)}
                  <div className="nor-pulse__cols" style={{ gridTemplateColumns: `repeat(${cols.length}, 1fr)` }}>
                    {cols.map((c, i) => {
                      const ok = (c.salieron / tope) * 100, ko = (c.fallaron / tope) * 100, fn = abrir(p.dias, c.clave);
                      return (
                        <button key={c.clave} type="button" className={`nor-pcol${fn ? ' nor-fila' : ''}${i === marcada ? ' nor-is-on' : ''}`} onClick={fn} onPointerEnter={() => setMarcada(i)} onFocus={() => setMarcada(i)}
                          aria-label={`${c.rotulo}: ${entero(c.salieron)} salieron, ${entero(c.fallaron)} fallaron`}>
                          <span className="nor-pcol__rail" />
                          {c.salieron > 0 && <span className="nor-pcol__ok" style={{ height: `${ok.toFixed(2)}%` }} />}
                          {c.fallaron > 0 && <span className="nor-pcol__ko" style={{ height: `max(9px, calc(${ko.toFixed(2)}% - 1px))`, bottom: `calc(${ok.toFixed(2)}% + 3px)` }} />}
                        </button>
                      );
                    })}
                  </div>
                  <svg className="nor-pulse__line" viewBox="0 0 1000 100" preserveAspectRatio="none" aria-hidden><path vectorEffect="non-scaling-stroke" d={tramos(cols.map((c) => c.antes), cols.length, tope)} /></svg>
                  {ahoraIdx >= 0 && <div className="nor-pulse__now" style={{ left: `${((ahoraIdx + 0.5) / cols.length) * 100}%` }}><span>Hoy</span><i /></div>}
                  {eje.map(({ c, i }) => <span key={c.clave} className="nor-pulse__x" style={{ left: `${((i + 0.5) / cols.length) * 100}%` }}>{c.ahora && pulso?.paso === 'dia' ? 'Hoy' : c.rotulo}</span>)}
                  {marcadaCol && (
                    <div className="nor-pulse__tip" style={{ left: `clamp(60px, ${((marcada! + 0.5) / cols.length) * 100}%, calc(100% - 60px))`, bottom: `calc(${(((marcadaCol.salieron + marcadaCol.fallaron) / tope) * 100).toFixed(2)}% + 14px)` }}>
                      {marcadaCol.ahora && pulso?.paso === 'dia' ? 'Hoy' : marcadaCol.rotulo} · {entero(marcadaCol.salieron)} salieron
                      <span>{marcadaCol.fallaron ? `${entero(marcadaCol.fallaron)} fallaron` : 'ninguno falló'}{marcadaCol.antes != null ? ` · antes, ${entero(marcadaCol.antes)}` : ''}</span>
                    </div>
                  )}
                </div>
                <div className="nor-legend"><span><i style={{ background: 'var(--primary)' }} />Salieron</span><span><i style={{ background: 'var(--bad-c)' }} />Fallaron</span><span><i className="nor-l" />{pulso?.linea}</span></div>
              </div>
            )}
          </section>

          {/* EL RECORRIDO («Live now»): de entrar a responder en cuatro pasos, cuánto tardan en responder y cómo terminaron. */}
          <section className="nor-card nor-ov__live">
            <div className="nor-card__head">
              <div><h2 className="nor-card__t">El recorrido</h2><p className="nor-card__s">De entrar a responder, en el período.</p></div>
              {!compartido && <Ir href="/automations" className="nor-btn nor-btn--xs nor-btn--ghost">Automations</Ir>}
            </div>
            {problemas.recorrido ? <Vacio titulo={problemas.recorrido} /> : recorrido.pasos[0].n == null || recorrido.pasos[0].n === 0 ? <Vacio titulo="Todavía no entró nadie" texto="Cuando alguien entre a una automatización, aquí verás su recorrido." /> : (
              <>
                <div className="nor-run">
                  <div><div className="nor-run__t">Todas tus automatizaciones</div><div className="nor-run__id">{recorrido.automatizaciones ? `${entero(recorrido.automatizaciones)} con envíos en el período` : 'En el período'}</div></div>
                  {recorrido.respondio != null && <span className="nor-pill nor-pill--ok">{Math.round(recorrido.respondio)}% respondió</span>}
                </div>
                <ol className="nor-steps">
                  {recorrido.pasos.map((s) => (
                    <li key={s.id} className={`nor-step${s.n ? '' : ' nor-step--todo'}`}>
                      <span className="nor-step__ck"><Icono id="check" /></span>
                      <span className={`nor-ap nor-ap--${PASO_AP[s.id]}`}><Icono id={PASO_ICONO[s.id]} /></span>
                      <span className="nor-step__t"><b>{s.titulo}</b><span>{s.sub}{s.pct != null ? ` · ${Math.round(s.pct)}%` : ''}</span></span>
                      <span className="nor-step__n nor-num">{s.n == null ? '—' : entero(s.n)}</span>
                    </li>
                  ))}
                </ol>
                <div className="nor-fin">{recorrido.horas != null ? <>Responden en&nbsp;<b>{horasTexto(recorrido.horas)}</b>, en promedio</> : 'Todavía nadie respondió'}</div>
                {recorrido.desenlaces.length > 0 && (
                  <>
                    <div className="nor-lbl">Cómo terminaron</div>
                    <ul className="nor-jf">
                      {recorrido.desenlaces.map((d) => {
                        const fn = abrir(p.recorrido, d.clave);
                        return (
                          <li key={d.clave}>
                            <a {...fila(fn)} className={fn ? 'nor-fila' : undefined}>
                              <span className={`nor-pill ${d.respondio ? 'nor-pill--ok' : 'nor-pill--idle'}`}>{entero(d.personas)}</span>
                              <span className="nor-jf__n">{d.nombre}</span>
                              <span className="nor-jf__t nor-num">{d.pct != null ? `${Math.round(d.pct)}%` : ''}</span>
                            </a>
                          </li>
                        );
                      })}
                    </ul>
                  </>
                )}
              </>
            )}
          </section>

          {/* DÓNDE FALLÓ («Needs a look»): las automatizaciones con mensajes que no salieron. */}
          <section className="nor-card nor-ov__look">
            <div><h2 className="nor-card__t">Dónde falló {fallos.total ? <span className="nor-cnt">{entero(fallos.total)}</span> : null}</h2><p className="nor-card__s">Lo que no salió, por automatización.</p></div>
            {problemas.fallos ? <Vacio titulo={problemas.fallos} /> : fallos.total == null ? <Vacio titulo="Todavía no hay envíos" /> : !fallos.filas.length ? (
              <div className="nor-ok" style={{ marginTop: 16 }}><Icono id="check" /><b>Nada falló en este período</b>Todo lo que se intentó, salió.</div>
            ) : (
              <>
                <ul className="nor-look">
                  {fallos.filas.map((f) => {
                    const fn = abrir(p.fallos, f.clave);
                    return (
                      <li key={f.clave} className={`nor-look__row${fn ? ' nor-fila' : ''}`} {...fila(fn)}>
                        <span className="nor-look__ic"><Icono id="alert" /></span>
                        <div>
                          <div className="nor-look__t">{f.nombre}</div>
                          <div className="nor-look__e">{entero(f.fallaron)} {f.fallaron === 1 ? 'no salió' : 'no salieron'}{f.pct != null ? ` · el ${conDecimal(f.pct)}% de sus envíos` : ''}</div>
                          <div className="nor-look__m">{f.envios != null ? `de ${entero(f.envios)} envíos en el período` : 'en el período'}</div>
                          {!compartido && <div className="nor-look__acts"><Ir href="/automations" className="nor-btn nor-btn--xs nor-btn--soft"><Icono id="arrow" />Revisar</Ir></div>}
                        </div>
                      </li>
                    );
                  })}
                </ul>
                {fallos.mas > 0 && <Ir href="/automations" className="nor-more">{fallos.mas} más en Automations<Icono id="arrow" /></Ir>}
              </>
            )}
          </section>

          {/* QUÉ TAN BIEN SALEN («Reliability»): los últimos 14 días de cada automatización, las que más mandan primero. */}
          <section className="nor-card nor-ov__rel">
            <div><h2 className="nor-card__t">Qué tan bien salen</h2><p className="nor-card__s">Los últimos 14 días, las que más mandan primero.</p></div>
            {problemas.confiabilidad ? <Vacio titulo={problemas.confiabilidad} /> : !confiabilidad.length ? <Vacio titulo="Todavía no hay envíos" texto="Aquí verás, día por día, qué parte de cada automatización salió bien." /> : (
              <>
                <div className="nor-rel">
                  {confiabilidad.map((c) => {
                    const fn = abrir(p.tabla, c.clave);
                    return (
                      <a key={c.clave} {...fila(fn)} className={`nor-rel__row${fn ? ' nor-fila' : ''}`}>
                        <span className="nor-rel__n" title={c.nombre}>{c.nombre}</span>
                        <span className="nor-rel__d">{c.dias.map((d) => <i key={d.dia} className={`nor-q${d.nivel}`} title={`${diaCorto(d.dia)}: ${d.envios ? `${entero(d.envios)} ${d.envios === 1 ? 'envío' : 'envíos'}${d.fallaron ? `, ${entero(d.fallaron)} ${d.fallaron === 1 ? 'falló' : 'fallaron'}` : d.fallaron === 0 ? ', ninguno falló' : ''}` : 'sin envíos'}`} />)}</span>
                        <span className="nor-rel__p nor-num">{c.pct != null ? `${conDecimal(c.pct)}%` : '—'}</span>
                      </a>
                    );
                  })}
                </div>
                <div className="nor-rel__leg">{NIVELES.map(([k, t]) => <span key={k}><i className={`nor-q${k}`} />{t}</span>)}</div>
              </>
            )}
          </section>

          {/* PREGÚNTALE A MaKo («Ask Copilot»): la caja abre su chat, y debajo, lo que conviene hacer con lo que muestra la hoja. */}
          <section className="nor-card nor-ov__ask">
            <div className="nor-card__head" style={{ justifyContent: 'flex-start', alignItems: 'center', gap: 12 }}><span className="nor-ask__ic"><Icono id="spark" /></span><h2 className="nor-card__t">Pregúntale a MaKo</h2></div>
            <p className="nor-card__s" style={{ marginTop: 2 }}>Lee tus automatizaciones y lo que mandaron.</p>
            <Ir href="/inicio" className="nor-ask" etiqueta="Abrir el chat con MaKo">
              <span className="nor-ask__ph">Por ejemplo: ¿por qué no salieron los mensajes de ayer?</span>
              <span className="nor-ask__foot"><span className="nor-ask__hint">Abre el chat con MaKo</span><span className="nor-btn nor-btn--sm nor-btn--primary"><Icono id="send" />Preguntar</span></span>
            </Ir>
            {!compartido && (
              <div className="nor-sugs">
                <Ir href="/automations" className="nor-ask__sug"><Icono id="spark" />{primerFallo ? <span>Revisa <b>{primerFallo.nombre}</b>: {entero(primerFallo.fallaron)} {primerFallo.fallaron === 1 ? 'no salió' : 'no salieron'}</span> : <span>Revisa tus automatizaciones</span>}</Ir>
                <Ir href="/chats" className="nor-ask__sug"><Icono id="spark" /><span>Contesta a quien respondió, en tus chats</span></Ir>
                <Ir href="/automations" className="nor-ask__sug"><Icono id="spark" /><span>Crea una automatización nueva</span></Ir>
              </div>
            )}
          </section>

          {/* LAS QUE MÁS MANDAN («Busiest flows»): la tabla por automatización, con sus últimos 14 días. */}
          <section className="nor-card nor-ov__flows">
            <div className="nor-card__head">
              <div><h2 className="nor-card__t">Las que más mandan</h2><p className="nor-card__s">En el período, por envíos.</p></div>
              {!compartido && <Ir href="/automations" className="nor-btn nor-btn--xs nor-btn--ghost">Ver todas</Ir>}
            </div>
            {problemas.flujos ? <Vacio titulo={problemas.flujos} /> : !flujos.length ? <Vacio titulo="Todavía no hay envíos" texto="Cuando una automatización mande algo, aparece aquí." /> : (
              <div className="nor-tbl-wrap">
                <table className="nor-table">
                  <colgroup><col className="nor-w-fl" /><col className="nor-w-st" /><col className="nor-w-sp" /><col className="nor-w-ru" /><col className="nor-w-pc" /><col className="nor-w-ag" /><col className="nor-w-dt" /></colgroup>
                  <thead><tr><th>Automatización</th><th>Estado</th><th>14 días</th><th className="nor-r">Envíos</th><th className="nor-r">Salieron bien</th><th className="nor-r">Respuestas</th><th /></tr></thead>
                  <tbody>
                    {flujos.map((f, i) => {
                      const fn = abrir(p.tabla, f.clave);
                      return (
                        <tr key={f.clave} {...fila(fn)} className={fn ? 'nor-fila' : undefined}>
                          <td className="nor-c-fl"><span className="nor-fl"><span className={`nor-ap nor-ap--lg nor-ap--${COLORES_AP[i % COLORES_AP.length]}`}>{f.iniciales}</span><span><b>{f.nombre}</b><span>{f.tasaRespuesta ? `${conDecimal(f.tasaRespuesta)}% te respondió` : 'sin respuestas'}</span></span></span></td>
                          <td className="nor-c-st">{f.fallaron ? <span className="nor-pill nor-pill--bad">{entero(f.fallaron)} {f.fallaron === 1 ? 'falló' : 'fallaron'}</span> : <span className="nor-pill nor-pill--ok">Sin fallas</span>}</td>
                          <td className="nor-c-sp">{f.dias ? <Spark valores={f.dias} /> : null}</td>
                          <td className="nor-c-runs nor-r nor-tnum nor-num">{f.envios == null ? '—' : entero(f.envios)}</td>
                          <td className={`nor-c-pc nor-r nor-tpct nor-num${f.exito != null && f.exito < 95 ? ' nor-is-bad' : ''}${f.exito == null ? ' nor-sin' : ''}`}>{f.exito == null ? '—' : `${conDecimal(f.exito)}%`}</td>
                          <td className={`nor-c-resp nor-r nor-tnum nor-num${f.respuestas ? '' : ' nor-sin'}`}>{f.respuestas == null ? '—' : entero(f.respuestas)}</td>
                          <td className="nor-c-go">{fn ? <Icono id="arrow" /> : null}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </section>

          {/* EN CUÁNTAS HORAS RESPONDEN («Team activity»): cada automatización con lo que tardan en contestarle. */}
          <section className="nor-card nor-ov__feed">
            <div><h2 className="nor-card__t">En cuántas horas responden</h2><p className="nor-card__s">Desde que entran hasta que contestan.</p></div>
            {problemas.horas ? <Vacio titulo={problemas.horas} /> : !horas.length ? <Vacio titulo="Todavía nadie respondió" texto="Cuando alguien conteste una automatización, aquí verás en cuánto." /> : (
              <ul className="nor-feed">
                {horas.map((h, i) => {
                  const fn = abrir(p.horas, h.clave);
                  return (
                    <li key={h.clave} className={`nor-feed__item${fn ? ' nor-fila' : ''}`} {...fila(fn)}>
                      <span className={`nor-av nor-av--${COLORES_AV[i % COLORES_AV.length]}`}>{h.iniciales}</span>
                      <div><p>{h.nombre}: responden en <b>{horasTexto(h.horas)}</b></p><time>{h.respondieron != null ? `${entero(h.respondieron)} ${h.respondieron === 1 ? 'respondió' : 'respondieron'}` : ''}</time></div>
                    </li>
                  );
                })}
              </ul>
            )}
          </section>
        </main>
      </div>
    </div>
    </Compartido.Provider>
  );
}
