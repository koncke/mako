'use client';

// =============================================================================
// HojaLanding — la hoja Landing con su DISEÑO PROPIO: la copia de Corbel, con los datos reales de MaKo
// =============================================================================
// Martín, 4/11/2026: «que sea primero la copia, es decir, que se vea exactamente igual que la copia, y después la adaptación con
// Maco... copiarlo todo, desde las animaciones de entrada, las animaciones de hover, las animaciones de clic». La copia y la
// adaptación (maquetas) están en docs/diseno/mockups-dashboard/landing-corbel/; ésta es la adaptación con los datos de verdad
// (lib/landing-diseno.ts arma lo que dibuja cada bloque, con test). La pregunta: «¿hasta dónde bajan y dónde hacen clic?».
//
// El movimiento sale del INFORME de Corbel (docs/diseno/mockups-dashboard/demos/corbel/INFORME.txt, la entrada de la página): la
// barra sube (y 8, .6 s, cada .05 s, desde .15 s), las tarjetas suben (y 26, escala .985, .9 s, expo.out, cada .07 s) y los números
// de arriba después (y 14, .6 s, cada .08 s); los números cuentan desde 0 (1,3 s); las barritas, la línea, el anillo y el medidor
// corren con ellos; las líneas guía del gráfico se dibujan (1,1 s, cada .06 s) y la burbuja del día sale última (back.out(2)); el
// anillo de las visitas corre gajo por gajo (1,1 s, cada .18 s); una tarjeta sube 3 px con el mouse (.45 s). Lo que el INFORME no
// dice y se supone (anotado en el relevo): cómo suben las columnas (como las barritas) y cómo entran las celdas del mapa de calor
// (crecen de .6 a 1, como el «pop» de la casa).
//
// ⚠️ Mirando se dibuja esto; editando, la grilla con los mismos componentes (app/dashboard/EditorInforme.tsx).
// ⚠️ Lo que Corbel tiene y MaKo no hace no está: la marca y las pestañas (las pone la app), el pronóstico, la meta del anillo y el
//    «live now» (en su lugar, las visitas de hoy).
// =============================================================================

import { createContext, useContext, useEffect, useLayoutEffect, useRef, useState, type CSSProperties, type KeyboardEvent, type ReactNode } from 'react';
import Link from '@/app/_ui/Link';
import type { Grafico, Hoja } from '@/lib/graficos-catalogo';
import { escalaColumnas, rotuloEje, type TileLanding, type VistaLanding } from '@/lib/landing-diseno';
import { corto, entero } from '@/lib/marketing-diseno';
import { CSS_LANDING } from './landing-css';

const Compartido = createContext(false);

const P = {
  cal: 'M4 5.5h16v14H4zM4 10h16M8 3.5v4M16 3.5v4',
  reloj: 'M12 3.5a8.5 8.5 0 1 0 0 17a8.5 8.5 0 1 0 0-17M12 7.5V12l3 2',
  grid: 'M4.5 4.5h6v6h-6zM13.5 4.5h6v6h-6zM4.5 13.5h6v6h-6zM13.5 13.5h6v6h-6z',
  out: 'M14 5h5v5M19 5l-8 8M18 14v5H5V6h5',
  up: 'M12 19V5.5M6.5 11L12 5.5l5.5 5.5',
  info: 'M12 3.5a8.5 8.5 0 1 0 0 17a8.5 8.5 0 1 0 0-17M12 11v5.5M12 7.8v.1',
} as const;
function Icono({ id, className, style }: { id: keyof typeof P; className?: string; style?: CSSProperties }) {
  return <svg className={`cb-i${className ? ` ${className}` : ''}`} style={style} viewBox="0 0 24 24" aria-hidden><path d={P[id]} /></svg>;
}

const EXPO = 'cubic-bezier(.16, 1, .3, 1)', P3 = 'cubic-bezier(.215, .61, .355, 1)', P3IO = 'cubic-bezier(.645, .045, .355, 1)';
const BACK2 = 'cubic-bezier(.34, 1.56, .64, 1)', BACK3 = 'cubic-bezier(.34, 1.8, .64, 1)', BACK26 = 'cubic-bezier(.34, 1.7, .64, 1)';
const sinMovimiento = () => typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
const eP3 = (t: number) => 1 - Math.pow(1 - t, 3);
const eP3IO = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
const anim = (n: Element | null | undefined, kf: Keyframe[], o: KeyframeAnimationOptions) => { if (n && 'animate' in n) (n as HTMLElement).animate(kf, { fill: 'backwards', ...o }); };

/** Cuenta el número de un texto desde cero («1,341», «51%», «4.8%»), con su prefijo, sus decimales y su sufijo. */
function contar(n: HTMLElement, demora: number, dur = 1300) {
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

/** De 0 a 1, una vez, la primera vez que `activo` es verdadero (el medidor, el anillo de las visitas). */
function useAvance(activo: boolean, dur: number, demora: number, quieta: boolean): number {
  const [t, setT] = useState(() => (quieta ? 1 : 0));
  const hecho = useRef(quieta);
  useEffect(() => {
    if (!activo || hecho.current) return;
    hecho.current = true;
    if (sinMovimiento()) { setT(1); return; }
    const t0 = performance.now() + demora;
    let id = 0;
    const paso = (ahora: number) => {
      const x = Math.min(1, Math.max(0, (ahora - t0) / dur));
      setT(x);
      if (x < 1) id = requestAnimationFrame(paso);
    };
    id = requestAnimationFrame(paso);
    return () => cancelAnimationFrame(id);
  }, [activo, dur, demora]);
  return t;
}

/** Un link de la app, o el texto quieto si la hoja está compartida (un link compartido no tiene sesión). */
function Ir({ href, className, children }: { href: string; className?: string; children: ReactNode }) {
  if (useContext(Compartido)) return <span className={`${className ?? ''} cb-link--quieta`}>{children}</span>;
  return <Link href={href} className={className}>{children}</Link>;
}

const RUTA = { paginas: '/web-generator', diagnostico: '/web-generator/analizar' } as const;

/** El (i) de Corbel: la definición del número, al pasar el mouse. */
const QUE_ES: Record<string, string> = {
  visitas: 'Cada vez que alguien abre una de tus páginas con el Pixel de MaKo.',
  mitad: 'De las personas que el Pixel midió, cuántas bajaron hasta la mitad de la página.',
  final: 'De las personas que el Pixel midió, cuántas bajaron hasta el final de la página.',
  tocan: 'Las personas distintas que tocaron un botón de tus páginas.',
  puntaje: 'El promedio del diagnóstico que MaKo hizo de tus páginas, de 0 a 100.',
  cuando: 'Las visitas de cada franja horaria y día de la semana, con la hora de tu negocio.',
  origen: 'El sitio del que llegó cada visita (sin origen: la escribieron o vino de una app).',
};
const Info = ({ que }: { que: string }) => <span className="cb-info-w" title={QUE_ES[que]}><Icono id="info" className="cb-info" /></span>;

function LinkTile({ link, onGrilla }: { link: TileLanding['link']; onGrilla?: () => void }) {
  if (link.a === 'grilla') {
    return onGrilla ? <button type="button" className="cb-link" onClick={onGrilla}>{link.texto}</button> : <span className="cb-link cb-link--quieta">{link.texto}</span>;
  }
  return <Ir href={RUTA[link.a]} className="cb-link">{link.texto}</Ir>;
}

function Delta({ cambio, sube }: { cambio: string | null; sube: boolean | null }) {
  if (!cambio) return null;
  // Como Corbel: el porcentaje sin signo (lo dice la flecha) y los puntos con el suyo («↓ −0.2 pt»).
  return <em className={`cb-delta${sube === false ? ' cb-is-down' : ''}`}><Icono id="up" />{cambio.endsWith('pt') ? cambio.replace(/^\+/, '') : cambio.replace(/^[+−]/, '')}</em>;
}

function Visual({ t }: { t: TileLanding }) {
  if (t.id === 'visitas' && t.barras) {
    return <span className="cb-tile__vis cb-minibars" aria-hidden>{t.barras.map((h, i) => <i key={i}><b style={{ height: `${Math.max(6, h * 92)}%` }} /></i>)}</span>;
  }
  if (t.id === 'mitad' && t.linea) {
    const pts = t.linea.slice(-8).map((v, i, a) => (v == null ? null : [4 + (76 / Math.max(1, a.length - 1)) * i, 34 - v * 28] as const)).filter((x): x is readonly [number, number] => !!x);
    if (pts.length < 2) return null;
    const d = pts.map(([x, y], i) => `${i ? 'L' : 'M'}${x.toFixed(1)} ${y.toFixed(1)}`).join(' ');
    const [ux, uy] = pts[pts.length - 1];
    return (
      <svg className="cb-tile__vis cb-spark" viewBox="0 0 80 40" aria-hidden>
        <defs><linearGradient id="cb-area" x1="0" x2="0" y1="0" y2="1"><stop offset="0" stopColor="#14202a" stopOpacity=".18" /><stop offset="1" stopColor="#14202a" stopOpacity="0" /></linearGradient></defs>
        <path className="cb-spark__area" d={`${d} L${ux.toFixed(1)} 40 L${pts[0][0].toFixed(1)} 40 Z`} />
        <path className="cb-spark__line" pathLength={100} d={d} />
        <circle className="cb-spark__dot" cx={ux} cy={uy} r="3.2" />
      </svg>
    );
  }
  if (t.id === 'final' && t.anillo != null) {
    return (
      <span className="cb-tile__vis cb-ring" title={`De los que llegan a la mitad, el ${t.anillo}% llega al final`} aria-hidden>
        <svg viewBox="0 0 40 40"><circle className="cb-ring__track" cx="20" cy="20" r="17.75" /><circle className="cb-ring__fill" cx="20" cy="20" r="17.75" pathLength={100} strokeDasharray={`${t.anillo} 100`} /></svg>
        <span className="cb-ring__pct" data-cuenta="">{t.anillo}%</span>
      </span>
    );
  }
  if (t.id === 'tocan' && t.finas) {
    return <span className="cb-tile__vis cb-thin" aria-hidden>{t.finas.map((h, i) => <i key={i}><b style={{ height: `${Math.max(8, h * 100)}%` }} /></i>)}</span>;
  }
  return null;
}

// ── el medidor ─────────────────────────────────────────────────────────────────────────────────────────────────────
const CX = 150, CY = 146, R = 109;
const pt = (a: number, r: number) => [CX - r * Math.cos((a * Math.PI) / 180), CY - r * Math.sin((a * Math.PI) / 180)] as const;
const TICKS = Array.from({ length: 31 }, (_, i) => {
  const a = i * 6, mayor = a % 30 === 0;
  const [x1, y1] = pt(a, mayor ? 124.5 : 126.5), [x2, y2] = pt(a, mayor ? 137.5 : 135.5);
  return { a, x1, y1, x2, y2 };
});
const ARCO = `M ${CX - R} ${CY} A ${R} ${R} 0 0 1 ${CX + R} ${CY}`;
function Medidor({ valor, t }: { valor: number | null; t: number }) {
  const v = (valor ?? 0) * eP3IO(t);
  const [kx, ky] = pt(v * 1.8, R);
  return (
    <svg viewBox="0 0 300 160" aria-hidden>
      <defs>
        <linearGradient id="cb-gauge" gradientUnits="userSpaceOnUse" x1="41" x2="259" y1="0" y2="0">
          <stop offset="0" stopColor="#8e8e89" /><stop offset=".5" stopColor="#f4f4f4" /><stop offset=".62" stopColor="#f8f8f7" /><stop offset=".75" stopColor="#eaeae8" /><stop offset=".86" stopColor="#e0e0dd" /><stop offset="1" stopColor="#d0d0cc" />
        </linearGradient>
      </defs>
      {TICKS.map((k) => <line key={k.a} className={`cb-gauge__tick${k.a > v * 1.8 + 0.5 || valor == null ? ' cb-is-off' : ''}`} x1={k.x1} y1={k.y1} x2={k.x2} y2={k.y2} />)}
      <path className="cb-gauge__track" d={ARCO} />
      {valor != null && <path className="cb-gauge__fill" d={ARCO} pathLength={100} strokeDasharray={`${v.toFixed(2)} 100`} />}
      {valor != null && <g transform={`translate(${kx.toFixed(2)} ${ky.toFixed(2)})`}><circle className="cb-gauge__knob" r="11" /><circle className="cb-gauge__knob-c" r="4" /></g>}
    </svg>
  );
}

export function HojaLanding({ hoja, vista, titulo, periodo, onGrilla, onFila, compartido = false, quieta = false }: {
  hoja: Hoja;
  vista: VistaLanding;
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
  const { frase, hoy, tiles, puntaje, columnas, cuando, origen, cambioVisitas, fallos } = vista;
  const p = hoja.diseno?.piezas ?? {};
  const pieza = (id: string | undefined) => hoja.componentes.find((c): c is Grafico => c.id === id && c.clase === 'grafico');
  const abrir = (id: string | undefined, clave: string) => { const g = pieza(id); return g && onFila && !quieta ? () => onFila(g, clave) : undefined; };
  const fila = (fn: (() => void) | undefined) => (fn ? { role: 'button', tabIndex: 0, className: 'cb-fila', onClick: fn, onKeyDown: (e: KeyboardEvent) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); fn(); } } } : {});
  const raiz = useRef<HTMLDivElement>(null);
  const [metrica, setMetrica] = useState<'visitas' | 'personas'>('visitas');
  const cols = columnas?.columnas ?? [];
  const ahoraIdx = Math.max(0, cols.findIndex((c) => c.ahora) >= 0 ? cols.findIndex((c) => c.ahora) : cols.length - 1);
  const [marcada, setMarcada] = useState<number | null>(null);
  const idx = Math.min(cols.length - 1, marcada ?? ahoraIdx);
  const valores = cols.map((c) => c[metrica]);
  const conValor = valores.filter((v): v is number => v != null);
  const { tope } = escalaColumnas(Math.max(0, ...conValor));
  const promedio = conValor.length ? conValor.reduce((a, b) => a + b, 0) / conValor.length : null;
  const tGauge = useAvance(puntaje.valor != null, 1700, 450, quieta);
  const tDonut = useAvance(!!origen?.partes.length, 1100 + 2 * 180, 850, quieta);

  // ── La entrada de Corbel: la cabecera, la barra, las tarjetas y los números de arriba, una vez, al montarse ──────────────
  useLayoutEffect(() => {
    const el = raiz.current;
    if (!el || quieta || sinMovimiento()) return;
    anim(el.querySelector('.cb-head'), [{ opacity: 0, transform: 'translateY(22px)' }, { opacity: 1, transform: 'none' }], { duration: 1100, delay: 150, easing: EXPO });
    el.querySelectorAll('.cb-bar > *').forEach((n, i) => anim(n, [{ opacity: 0, transform: 'translateY(8px)' }, { opacity: 1, transform: 'none' }], { duration: 600, delay: 150 + i * 50, easing: P3 }));
    el.querySelectorAll('.cb-board > .cb-card').forEach((n, i) => anim(n, [{ opacity: 0, transform: 'translateY(26px) scale(.985)' }, { opacity: 1, transform: 'none' }], { duration: 900, delay: 200 + i * 70, easing: EXPO }));
    el.querySelectorAll('.cb-board > .cb-tile').forEach((n, i) => anim(n, [{ opacity: 0, transform: 'translateY(14px)' }, { opacity: 1, transform: 'none' }], { duration: 600, delay: 270 + i * 80, easing: P3 }));
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Lo que corre la PRIMERA vez que llegan los datos (los datos llegan después de montar) ──────────────────────────────
  const firma = [tiles.map((t) => t.texto).join(','), cols.length, cuando?.max, origen?.total].join('|');
  useEffect(() => {
    const el = raiz.current;
    if (!el || quieta || sinMovimiento()) return;
    const una = (sel: string, fn: (n: HTMLElement, i: number) => void) => el.querySelectorAll<HTMLElement>(sel).forEach((n, i) => { if (n.dataset.animado != null) return; n.dataset.animado = ''; fn(n, i); });
    una('[data-cuenta]', (n) => { if (/\d/.test(n.textContent ?? '')) contar(n, n.closest('.cb-visits') ? 850 : 450, n.closest('.cb-visits__ley') ? 1100 : n.closest('.cb-ring') ? 1400 : 1300); });
    una('.cb-delta svg', (n, i) => anim(n, [{ transform: n.closest('.cb-is-down') ? 'rotate(0deg)' : 'rotate(180deg)' }, { transform: n.closest('.cb-is-down') ? 'rotate(180deg)' : 'rotate(0deg)' }], { duration: 500, delay: 450 + i * 40, easing: BACK2 }));
    una('.cb-minibars b', (n, i) => anim(n, [{ transform: 'translateY(100%)' }, { transform: 'none' }], { duration: 1000, delay: 450 + i * 80, easing: EXPO }));
    una('.cb-thin b', (n, i) => anim(n, [{ transform: 'translateY(100%)' }, { transform: 'none' }], { duration: 900, delay: 450 + i * 40, easing: EXPO }));
    una('.cb-spark__line', (n) => anim(n, [{ strokeDasharray: '100 100', strokeDashoffset: 100 }, { strokeDasharray: '100 100', strokeDashoffset: 0 }], { duration: 1300, delay: 450, easing: P3IO }));
    una('.cb-spark__area', (n) => anim(n, [{ opacity: 0 }, { opacity: 1 }], { duration: 800, delay: 1050 }));
    una('.cb-spark__dot', (n) => anim(n, [{ transform: 'scale(0)' }, { transform: 'scale(1)' }], { duration: 500, delay: 1600, easing: BACK3 }));
    una('.cb-ring__fill', (n) => anim(n, [{ strokeDasharray: '0 100' }, { strokeDasharray: n.getAttribute('stroke-dasharray') ?? '0 100' }], { duration: 1400, delay: 450, easing: P3IO }));
    una('.cb-col b', (n, i) => anim(n, [{ transform: 'translateY(100%)' }, { transform: 'none' }], { duration: 900, delay: 700 + i * 40, easing: EXPO }));
    una('.cb-chart__gl', (n, i) => anim(n, [{ transform: 'scaleX(0)' }, { transform: 'scaleX(1)' }], { duration: 1100, delay: 550 + i * 60, easing: EXPO }));
    una('.cb-chart__y span', (n, i) => anim(n, [{ opacity: 0, translate: '-6px 0' }, { opacity: 1, translate: '0 0' }], { duration: 600, delay: 600 + i * 50, easing: P3 }));
    una('.cb-chart__x span', (n, i) => anim(n, [{ opacity: 0, transform: 'translateY(6px)' }, { opacity: 1, transform: 'none' }], { duration: 500, delay: 650 + i * 30, easing: P3 }));
    una('.cb-avg', (n) => anim(n, [{ opacity: 0 }, { opacity: 1 }], { duration: 600, delay: 1450 }));
    una('.cb-tip', (n) => anim(n, [{ opacity: 0, transform: 'scale(.9)' }, { opacity: 1, transform: 'none' }], { duration: 500, delay: 2050, easing: BACK2 }));
    una('.cb-heat__c', (n, i) => anim(n, [{ opacity: 0, transform: 'scale(.6)' }, { opacity: 1, transform: 'none' }], { duration: 600, delay: 750 + (i % 7) * 50 + Math.floor(i / 7) * 20, easing: BACK26 }));
  }, [firma, quieta]);

  // ── La tarjeta sube 3 px con el mouse (`[data-lift]`, .45 s) ─────────────────────────────────────────────────────────────
  useEffect(() => {
    const el = raiz.current;
    if (!el || quieta || sinMovimiento() || !matchMedia('(hover: hover)').matches) return;
    const quitar: Array<() => void> = [];
    el.querySelectorAll<HTMLElement>('[data-lift]').forEach((n) => {
      let a: Animation | null = null;
      const entra = () => { a?.cancel(); a = n.animate([{ transform: 'none' }, { transform: 'translateY(-3px)' }], { duration: 450, easing: P3, fill: 'forwards' }); };
      const sale = () => { a?.cancel(); a = n.animate([{ transform: 'translateY(-3px)' }, { transform: 'none' }], { duration: 500, easing: P3 }); };
      n.addEventListener('pointerenter', entra); n.addEventListener('pointerleave', sale);
      quitar.push(() => { n.removeEventListener('pointerenter', entra); n.removeEventListener('pointerleave', sale); });
    });
    return () => quitar.forEach((f) => f());
  }, [quieta]);

  // ── La pastilla del selector de las columnas: corre hasta la elegida (.55 s, expo.out) ───────────────────────────────────
  const seg = useRef<HTMLDivElement>(null), pastilla = useRef<HTMLSpanElement>(null), segAntes = useRef<string | null>(null);
  useLayoutEffect(() => {
    const s = seg.current, pl = pastilla.current;
    if (!s || !pl) return;
    const ubicar = (suave: boolean) => {
      const b = s.querySelector<HTMLElement>('[aria-pressed="true"]');
      if (!b) return;
      if (!suave || sinMovimiento()) pl.style.transition = 'none';
      pl.style.width = `${b.offsetWidth}px`; pl.style.transform = `translateX(${b.offsetLeft}px)`;
      if (!suave) requestAnimationFrame(() => { pl.style.transition = ''; });
    };
    ubicar(segAntes.current != null && segAntes.current !== metrica);
    segAntes.current = metrica;
    const ro = new ResizeObserver(() => ubicar(false));
    ro.observe(s);
    return () => ro.disconnect();
  }, [metrica, columnas]);

  const c = cols[idx];
  const antes = idx > 0 ? cols[idx - 1]?.[metrica] : null;
  const vsAntes = c && c[metrica] != null && antes ? Math.round(((c[metrica]! - antes) / antes) * 1000) / 10 : null;
  const rotuloTip = c ? (c.ahora && columnas?.paso === 'dia' ? 'Hoy' : columnas?.paso === 'semana' ? `Semana del ${c.rotulo}` : c.rotulo) : '';
  const centro = cols.length ? ((idx + 0.5) / cols.length) * 100 : 0;
  const total = origen?.total ?? null;
  const primera = origen?.partes[0];
  const COLORES = ['var(--c1)', 'var(--c2)', 'var(--c3)'];
  let acum = 0;

  return (
    <Compartido.Provider value={compartido}>
    <div className="cb" ref={raiz} data-quieta={quieta ? '' : undefined}>
      <style href="dash-hoja-landing" precedence="medium">{CSS_LANDING}</style>
      <div className="cb-fondo" aria-hidden><i /><i /><i /></div>
      <div className="cb-pagina">
        {/* LA CABECERA: el saludo y, en lugar del «live now», las visitas de hoy (el Pixel no cuenta presencia). */}
        <div className="cb-head">
          <h1>{titulo}</h1>
          {hoy != null && <span className="cb-live"><span className="cb-live__dot" /><span className="cb-live__n" data-cuenta="">{entero(hoy)}</span><span className="cb-live__w">{hoy === 1 ? 'visita hoy' : 'visitas hoy'}</span></span>}
        </div>
        {/* LA BARRA: el período (en lugar del selector de canal), la frase (en lugar de la fecha) y los botones. */}
        <div className="cb-bar">
          <span className="cb-seg cb-seg--uno"><span className="cb-seg__solo"><Icono id="cal" />{periodo}</span></span>
          {frase.length > 0 ? <span className="cb-bar__frase"><Icono id="reloj" /><span>{frase.map((t, i) => (t.tipo === 'fuerte' ? <b key={i}>{t.s}</b> : <span key={i}>{t.s}</span>))}</span></span> : <span />}
          <div className="cb-bar__acc">
            {onGrilla && <button type="button" className="cb-btn" onClick={onGrilla}><Icono id="grid" />Ver la grilla</button>}
            {!compartido && <Ir href="/web-generator" className="cb-btn cb-btn--dark"><Icono id="out" />Abrir tus páginas</Ir>}
          </div>
        </div>

        <div className="cb-board">
          {/* LOS CUATRO NÚMEROS de Corbel, con su cambio contra el período anterior y su dibujo chico. */}
          {tiles.map((t, i) => (
            <article key={t.id} className={`cb-tile cb-tile--${i + 1}`} data-lift="">
              <div className="cb-tile__head">{t.titulo} <Info que={t.id} /></div>
              <div className="cb-tile__body">
                <div>
                  <b className={`cb-tile__val${t.texto ? '' : ' cb-is-nada'}`} data-cuenta="">{t.texto ?? '—'}</b>
                  <div className="cb-tile__dif">{t.cambio ? <><Delta cambio={t.cambio} sube={t.sube} /><span>vs. el anterior</span></> : <span>{t.texto ? 'Sin período anterior' : 'Todavía sin datos'}</span>}</div>
                </div>
                <Visual t={t} />
              </div>
              <div className="cb-tile__foot"><LinkTile link={t.link} onGrilla={onGrilla} /></div>
            </article>
          ))}

          {/* EL MEDIDOR («Sales performance»): el puntaje del diagnóstico, su veredicto y el porqué. */}
          <section className="cb-card cb-card--dark cb-score">
            <div className="cb-card__head"><h2>Puntaje de la página</h2><Info que="puntaje" /></div>
            {fallos.puntaje ? <div className="cb-vacio">{fallos.puntaje}</div> : (
              <>
                <div className="cb-gauge">
                  <Medidor valor={puntaje.valor} t={tGauge} />
                  <div className="cb-gauge__mid">
                    <span className="cb-gauge__num"><b className={puntaje.valor == null ? 'cb-is-nada' : ''}>{puntaje.valor == null ? '—' : Math.round(puntaje.valor * eP3IO(tGauge))}</b></span>
                    <span className="cb-gauge__of">de 100 puntos</span>
                  </div>
                </div>
                <div className="cb-note"><h3>{puntaje.veredicto}</h3>{puntaje.porque && <p>{puntaje.porque}</p>}</div>
                <Ir href={RUTA.diagnostico} className="cb-link">{puntaje.analizada ? 'Ver el diagnóstico' : 'Analizar tu página'}</Ir>
              </>
            )}
          </section>

          {/* LAS COLUMNAS («Revenue»): las visitas o las personas de cada día, la de hoy en negro, el promedio y la burbuja. */}
          <section className="cb-card cb-rev">
            <div className="cb-card__head">
              <h2>{metrica === 'visitas' ? 'Visitas' : 'Personas'}</h2><Info que="visitas" />
              {columnas?.total != null && <span className="cb-card__sub">{entero(columnas.total)} visitas en el período</span>}
              <div className="cb-seg cb-seg--sm" ref={seg} role="group" aria-label="Qué contar">
                <span className="cb-seg__pill" ref={pastilla} aria-hidden />
                <button type="button" aria-pressed={metrica === 'visitas'} onClick={() => setMetrica('visitas')}>Visitas</button>
                <button type="button" aria-pressed={metrica === 'personas'} onClick={() => setMetrica('personas')}>Personas</button>
              </div>
            </div>
            {fallos.columnas ? <div className="cb-vacio">{fallos.columnas}</div> : !cols.length ? <div className="cb-vacio"><b>Todavía no hay visitas</b>Cuando entre alguien a tus páginas, aparece acá día por día.</div> : (
              <div className="cb-chart">
                <div className="cb-chart__y">{[0, 1, 2, 3, 4].map((k) => <span key={k} style={{ top: `${k * 25}%` }}>{rotuloEje(tope * (1 - k / 4))}</span>)}</div>
                <div className="cb-chart__plot" onPointerLeave={() => setMarcada(null)}>
                  {[0, 1, 2, 3, 4].map((k) => <i key={k} className="cb-chart__gl" style={{ top: `${k * 25}%` }} />)}
                  <div className="cb-chart__cols" style={{ gridTemplateColumns: `repeat(${cols.length}, minmax(0, 1fr))` }}>
                    {cols.map((col, i) => {
                      const v = col[metrica];
                      return (
                        <div key={col.clave} className={`cb-col${col.ahora ? ' cb-is-now' : ''}`} style={{ overflow: 'hidden' }} onPointerEnter={() => setMarcada(i)}>
                          <b style={{ height: `${v ? Math.max(2, (v / tope) * 100) : 0}%` }} />
                        </div>
                      );
                    })}
                  </div>
                  {/* El promedio, con su rótulo a la derecha como Corbel; si la burbuja está en las últimas columnas, a la izquierda (la taparía). */}
                  {promedio != null && <div className="cb-avg" style={{ top: `${(1 - promedio / tope) * 100}%` }}><span style={idx >= cols.length - 2 ? { right: 'auto', left: 2 } : undefined}>prom. {corto(Math.round(promedio))}</span></div>}
                  {c && (
                    <div className="cb-tip" aria-hidden style={{ left: `clamp(0px, calc(${centro}% - 82px), calc(100% - 164px))` }}>
                      <div className="cb-tip__t">{rotuloTip}</div>
                      <div className="cb-tip__r"><span>Visitas</span><b>{c.visitas != null ? entero(c.visitas) : '—'}</b></div>
                      <div className="cb-tip__r"><span>Personas</span><b>{c.personas != null ? entero(c.personas) : '—'}</b></div>
                      <div className="cb-tip__r"><span>vs. el anterior</span>{/* La columna de ahora está a medias (el día, la semana o el mes siguen): contra una entera, el cambio mentiría. */}
                        <b className={!c.ahora && vsAntes != null && vsAntes >= 0 ? 'cb-is-up' : ''}>{c.ahora ? 'en curso' : vsAntes == null ? '—' : `${vsAntes > 0 ? '+' : vsAntes < 0 ? '−' : ''}${Math.abs(vsAntes).toFixed(1)}%`}</b></div>
                    </div>
                  )}
                </div>
                <div className="cb-chart__x" style={{ gridTemplateColumns: `repeat(${cols.length}, minmax(0, 1fr))` }}>
                  {cols.map((col, i) => <span key={col.clave} className={i === idx ? 'cb-is-now' : ''}>{col.dia}{col.mes && <i>{col.mes}</i>}</span>)}
                </div>
              </div>
            )}
          </section>

          {/* CUÁNDO ENTRAN («Visits by time»): las visitas por franja horaria y día de la semana, en cinco tonos. */}
          <section className="cb-card cb-heat">
            <div className="cb-card__head"><h2>Cuándo entran</h2><Info que="cuando" />
              {cuando && cuando.max > 0 && <span className="cb-heat__ley" aria-hidden><span>0</span>{[0, 1, 2, 3, 4].map((k) => <i key={k} style={{ background: `var(--heat-${k})` }} />)}<span>{corto(cuando.max)}</span></span>}
            </div>
            {fallos.cuando ? <div className="cb-vacio">{fallos.cuando}</div> : !cuando || cuando.max === 0 ? <div className="cb-vacio"><b>Todavía no hay visitas</b>Acá vas a ver a qué hora y qué día entra la gente.</div> : (
              <div className="cb-heat__g">
                <span className="cb-heat__d" />
                {cuando.dias.map((d) => <span key={d} className="cb-heat__d">{d}</span>)}
                {cuando.franjas.map((fr, i) => [
                  <span key={`r${i}`} className="cb-heat__r"><span className="cb-l">{fr}</span><span className="cb-s">{fr.replace(/ a /, '–').replace(/ h$/, '')}</span></span>,
                  ...cuando.dias.map((d, j) => {
                    const v = cuando.valores[i][j];
                    return <i key={`c${i}-${j}`} className="cb-heat__c" data-n={cuando.tonos[i][j]} title={`${d}, ${fr}: ${v == null ? 'sin datos' : `${entero(v)} ${v === 1 ? 'visita' : 'visitas'}`}`} />;
                  }),
                ])}
              </div>
            )}
          </section>

          {/* DE DÓNDE LLEGAN («Total visits»): las visitas, su cambio y el reparto entre los orígenes, con el anillo del primero. */}
          <section className="cb-card cb-visits">
            <div className="cb-card__head"><h2>De dónde llegan</h2><Info que="origen" /></div>
            {fallos.origen ? <div className="cb-vacio">{fallos.origen}</div> : !origen || !origen.partes.length ? <div className="cb-vacio"><b>Todavía no hay visitas</b>Acá vas a ver de qué sitio llega la gente a tus páginas.</div> : (
              <div className="cb-visits__body">
                <div>
                  <b className="cb-visits__n" data-cuenta="">{total != null ? entero(total) : '—'}</b>
                  <div className="cb-visits__dif">{cambioVisitas.cambio ? <>vs. el anterior <Delta cambio={cambioVisitas.cambio} sube={cambioVisitas.sube} /></> : 'visitas en el período'}</div>
                  <ul className="cb-visits__ley">
                    {origen.partes.map((x, i) => (
                      <li key={x.clave} {...fila(x.otros ? undefined : abrir(p.origen, x.clave))}><i style={{ background: COLORES[i] }} />{x.nombre}<b data-cuenta="">{entero(x.valor)}</b></li>
                    ))}
                  </ul>
                </div>
                <div className="cb-donut">
                  <svg viewBox="0 0 152 152" aria-hidden>
                    {origen.partes.map((x, i) => {
                      const desde = acum; acum += x.pct;
                      const ti = Math.min(1, Math.max(0, (tDonut * (1100 + 2 * 180) - i * 180) / 1100));
                      const e = eP3IO(ti);
                      return <circle key={x.clave} cx="76" cy="76" r="66" pathLength={100} style={{ stroke: COLORES[i] }} strokeDasharray={`${Math.max(0, x.pct * e - 0.9).toFixed(2)} 100`} strokeDashoffset={(-desde * e).toFixed(2)} />;
                    })}
                  </svg>
                  {primera && <div className="cb-donut__mid"><b data-cuenta="">{Math.round(primera.pct)}%</b><span>{primera.nombre}</span></div>}
                </div>
              </div>
            )}
          </section>
        </div>
      </div>
    </div>
    </Compartido.Provider>
  );
}
