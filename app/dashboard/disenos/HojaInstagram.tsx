'use client';

// =============================================================================
// HojaInstagram — la hoja «Instagram y redes» con su DISEÑO PROPIO: la copia de Murmura, con los datos reales de MaKo
// =============================================================================
// Martín, 4/11/2026: «que sea primero la copia, es decir, que se vea exactamente igual que la copia, y después la adaptación con
// Maco... copiarlo todo, desde las animaciones de entrada, las animaciones de hover, las animaciones de clic» y «Después seguí con la
// segunda hoja, de a una». La copia y la adaptación (maquetas) están en docs/diseno/mockups-dashboard/instagram-murmura/; ésta es la
// adaptación con los datos de verdad (lib/instagram-diseno.ts arma lo que dibuja cada bloque, con test). La pregunta: «¿qué
// publicación trajo gente de verdad?».
//
// El movimiento sale de las RECETAS medidas en el INFORME de Murmura (docs/diseno/mockups-dashboard/demos/murmura/INFORME.txt): el
// saludo sube por palabra con un giro de 6° (115 % → 0, .85 s, power4.out, 22 ms); los números de arriba y su botón entran desde
// 14 px (.55 s, power3.out, 80 ms, a los .12 s); una tarjeta sube desde 34 px y .985 (.9 s, power3.out, 70 ms); una fila entra desde
// 12 px (.55 s, 45 ms); un día de la semana se levanta desde 40 px girado ±3° y .94 (.8 s, back.out(1.4), 60 ms); los números cuentan
// 1,2 s (power3.out); al pasar, lo que lleva `data-lift` sube 4 px (.45 s; baja en .5 s). ⚠️ El INFORME trae la librería, no la línea
// de tiempo de la página: qué pieza usa cuál receta y a qué demora es un supuesto (las tarjetas desde los .2 s, las filas desde los
// .45 s, los días desde los .5 s y las barras a los .6 s), anotado en el relevo.
//
// ⚠️ Mirando se dibuja esto; editando, la grilla con los mismos componentes (app/dashboard/EditorInforme.tsx).
// ⚠️ Lo que Murmura tiene y MaKo no mide no está (lib/instagram-diseno.ts): los seguidores, la interacción, los guardados, las
//    aprobaciones, la bandeja con su sentimiento y la actividad del equipo. Las fotos de Murmura tampoco: los anuncios van con su
//    miniatura de Meta si la tienen, y lo demás con un color propio.
// =============================================================================

import { createContext, Fragment, useContext, useEffect, useId, useLayoutEffect, useRef, type CSSProperties, type KeyboardEvent, type ReactNode } from 'react';
import Link from '@/app/_ui/Link';
import type { Grafico, Hoja } from '@/lib/graficos-catalogo';
import { corto, enElPeriodo, entero } from '@/lib/marketing-diseno';
import { textoSemana, type AnuncioIg, type RedIg, type VistaInstagram } from '@/lib/instagram-diseno';
import type { FormatoPublicacion } from '@/lib/calendario-modelo';
import { iniciales } from '@/lib/unicode-seguro';
import { CSS_INSTAGRAM } from './instagram-css';
import { Parte } from './parte';

const Compartido = createContext(false);

// Los íconos son trazos propios (los de la copia, maquetas/murmura/copia.html); los de Messenger, WhatsApp y «otra red», también.
const P = {
  people: 'M9 6a3 3 0 1 0 0 6a3 3 0 1 0 0-6M4 18a5 5 0 0 1 10 0M15.5 6.5a3 3 0 0 1 0 5.5M17 18a5 5 0 0 0-2-4',
  cal: 'M7 5.5h10a3 3 0 0 1 3 3v8a3 3 0 0 1-3 3H7a3 3 0 0 1-3-3v-8a3 3 0 0 1 3-3zM4 10h16M8.5 3.5v4M15.5 3.5v4',
  out: 'M8 16L16 8M9.5 8H16v6.5',
  clock: 'M12 4.5a7.5 7.5 0 1 0 0 15a7.5 7.5 0 1 0 0-15M12 8v4.5l3 1.8',
  check: 'M6.5 12.5l3.5 3.5 7.5-8',
  chev: 'M8 10l4 4 4-4',
  link: 'M10 14a3.5 3.5 0 0 0 5 0l3-3a3.5 3.5 0 0 0-5-5l-1 1M14 10a3.5 3.5 0 0 0-5 0l-3 3a3.5 3.5 0 0 0 5 5l1-1',
  image: 'M7 5h10a3 3 0 0 1 3 3v8a3 3 0 0 1-3 3H7a3 3 0 0 1-3-3V8a3 3 0 0 1 3-3zM9.5 8.4a1.6 1.6 0 1 0 0 3.2a1.6 1.6 0 1 0 0-3.2M5 17l4.5-4 3 2.5 3-3L20 16',
  send: 'M19.5 4.5L4.5 11l6 2.5 2.5 6zM10.5 13.5l9-9',
  coin: 'M12 4.5a7.5 7.5 0 1 0 0 15a7.5 7.5 0 1 0 0-15M14.5 9.5c-.5-1-1.5-1.5-2.5-1.5-1.6 0-2.8.9-2.8 2.1 0 2.8 5.6 1.4 5.6 4 0 1.2-1.2 2.1-2.8 2.1-1.1 0-2.1-.6-2.6-1.5M12 6.5v11',
  pen: 'M5 19l1-4L15.5 5.5a2 2 0 0 1 3 3L9 18zM13.5 7.5l3 3',
  grid: 'M4.5 4.5h6v6h-6zM13.5 4.5h6v6h-6zM4.5 13.5h6v6h-6zM13.5 13.5h6v6h-6z',
  instagram: 'M9.2 5h5.6A4.2 4.2 0 0 1 19 9.2v5.6a4.2 4.2 0 0 1-4.2 4.2H9.2A4.2 4.2 0 0 1 5 14.8V9.2A4.2 4.2 0 0 1 9.2 5zM12 8.8a3.2 3.2 0 1 0 0 6.4a3.2 3.2 0 1 0 0-6.4M16.2 7.9v.01',
  facebook: 'M13.5 20v-7h2.5l.4-3h-2.9V8.4c0-.9.3-1.4 1.5-1.4h1.5V4.3c-.3 0-1.2-.1-2.2-.1-2.2 0-3.7 1.3-3.7 3.8V10H8v3h2.6v7',
  messenger: 'M12 4.5c-4.4 0-7.5 3-7.5 7 0 2.2 1 4 2.6 5.3v2.7l2.6-1.4c.7.2 1.5.3 2.3.3 4.4 0 7.5-3 7.5-7s-3.1-6.9-7.5-6.9zM7.5 13.5l3-3.2 2 1.8 4-2.3-3 3.2-2-1.8z',
  whatsapp: 'M5.5 19l1-3.4A7 7 0 1 1 9 18zM9.5 8.5c-.3 1.7 1.8 4.6 4 5.5l1.3-1.1-1.6-1-.8.6c-.8-.4-1.5-1.1-1.9-1.9l.6-.8-1-1.6z',
  red: 'M12 4.5a7.5 7.5 0 1 0 0 15a7.5 7.5 0 1 0 0-15M4.5 12h15M12 4.5c2 2 3 4.5 3 7.5s-1 5.5-3 7.5M12 4.5c-2 2-3 4.5-3 7.5s1 5.5 3 7.5',
} as const;
type IconoId = keyof typeof P;
function Icono({ id }: { id: IconoId }) {
  return <svg className="mur-i" viewBox="0 0 24 24" aria-hidden><path d={P[id]} /></svg>;
}

const P3 = 'cubic-bezier(.215, .61, .355, 1)', P4 = 'cubic-bezier(.165, .84, .44, 1)', BACK14 = 'cubic-bezier(.34, 1.45, .64, 1)';
const sinMovimiento = () => typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
const anim = (n: Element | null | undefined, kf: Keyframe[], o: KeyframeAnimationOptions) => { if (n && 'animate' in n) (n as HTMLElement).animate(kf, { fill: 'backwards', easing: P3, ...o }); };
const eP3 = (t: number) => 1 - Math.pow(1 - t, 3);

/** Cuenta el número de un texto desde cero («21.4k», «2.6%», «US$412»), con sus decimales, su prefijo y su sufijo. */
function contar(n: HTMLElement, demora: number, dur: number) {
  const fin = n.textContent ?? '';
  const m = fin.match(/^(\D*?)(\d[\d,]*)(\.\d+)?(.*)$/);
  if (!m) return;
  const [, pre, cifra, dec = '', suf] = m, valor = Number(cifra.replace(/,/g, '') + dec), d = Math.max(0, dec.length - 1);
  const fmt = (v: number) => `${pre}${v.toLocaleString('en-US', { minimumFractionDigits: d, maximumFractionDigits: d })}${suf}`;
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
function Ir({ href, className, etiqueta, lift, children }: { href: string | null; className?: string; etiqueta?: string; lift?: boolean; children: ReactNode }) {
  if (useContext(Compartido) || !href) return <span className={`${className ?? ''}${href ? ' mur-quieta' : ''}`} aria-label={etiqueta}>{children}</span>;
  return <Link href={href} className={className} aria-label={etiqueta} data-lift={lift ? '' : undefined}>{children}</Link>;
}
function Vacio({ titulo, texto }: { titulo: string; texto?: string }) {
  return <div className="mur-vacio"><b>{titulo}</b>{texto}</div>;
}
const accionDe = (fn: (() => void) | undefined) => (fn ? { role: 'button', tabIndex: 0, onClick: fn, onKeyDown: (e: KeyboardEvent) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); fn(); } } } : {});
const plural = (n: number, uno: string, varios: string) => `${entero(n)} ${n === 1 ? uno : varios}`;
const pct = (v: number) => `${Math.round(v)}%`;

/** El color de cada formato: la miniatura (los colores de la copia) y el turno de la semana. */
const PH: Record<FormatoPublicacion, string> = { reel: 'ember', story: 'rose', post: 'linen', ad: 'cafe', video: 'night', email: 'oak', otro: 'latte' };
const SLOT: Record<FormatoPublicacion, 'coral' | 'sea' | 'butter'> = { reel: 'coral', story: 'butter', post: 'sea', ad: 'coral', video: 'sea', email: 'butter', otro: 'sea' };
const PH_ANUNCIO = ['garage', 'cafe', 'night', 'rose', 'oak'];
const BDG = ['ink', 'coral', 'pine', 'sea', 'butter'] as const;
const AV = ['a', 'b', 'c', 'd', 'e'] as const;
const REDES_ICONO: Record<RedIg['icono'], { i: IconoId; c: string }> = {
  instagram: { i: 'instagram', c: ' mur-net--ig' }, facebook: { i: 'facebook', c: ' mur-net--fb' }, messenger: { i: 'messenger', c: ' mur-net--ms' },
  whatsapp: { i: 'whatsapp', c: ' mur-net--wa' }, red: { i: 'red', c: '' },
};

/** La miniatura de un anuncio: la de Meta si llegó, o un color propio. */
function Miniatura({ anuncio, i, clase }: { anuncio: AnuncioIg; i: number; clase: string }) {
  // eslint-disable-next-line @next/next/no-img-element -- la miniatura de Meta viene de su CDN, con su tamaño
  if (anuncio.imagen) return <img className={`${clase} mur-thumb--img`} src={anuncio.imagen} alt="" loading="lazy" />;
  return <span className={`mur-ph mur-ph--${PH_ANUNCIO[i % PH_ANUNCIO.length]} ${clase}`} />;
}

// ── la curva de los leads ──────────────────────────────────────────────────────────────────────────────────────────────
const ANCHO = 650, ALTO = 190;
/** Una curva suave que pasa por cada punto (Catmull-Rom llevado a Bézier), en el viewBox de la copia (650 × 190). */
export function curvaDe(valores: readonly number[], tope: number): string {
  if (!valores.length) return '';
  const pts = valores.map((v, i) => [valores.length > 1 ? (i / (valores.length - 1)) * ANCHO : ANCHO / 2, ALTO - (Math.max(0, v) / Math.max(1e-9, tope)) * (ALTO - 4)] as const);
  if (pts.length === 1) return `M0 ${pts[0][1].toFixed(1)}H${ANCHO}`;
  let d = `M${pts[0][0].toFixed(1)} ${pts[0][1].toFixed(1)}`;
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[Math.max(0, i - 1)], p1 = pts[i], p2 = pts[i + 1], p3 = pts[Math.min(pts.length - 1, i + 2)];
    const c1 = [p1[0] + (p2[0] - p0[0]) / 6, p1[1] + (p2[1] - p0[1]) / 6], c2 = [p2[0] - (p3[0] - p1[0]) / 6, p2[1] - (p3[1] - p1[1]) / 6];
    d += ` C${c1[0].toFixed(1)} ${Math.min(ALTO, c1[1]).toFixed(1)} ${c2[0].toFixed(1)} ${Math.min(ALTO, c2[1]).toFixed(1)} ${p2[0].toFixed(1)} ${p2[1].toFixed(1)}`;
  }
  return d;
}

export function HojaInstagram({ hoja, vista, titulo, periodo, onGrilla, onFila, compartido = false, quieta = false }: {
  hoja: Hoja;
  vista: VistaInstagram;
  /** El saludo («Buenos días, Ana»), o el nombre de la hoja. */
  titulo: string;
  /** «En los últimos 30 días»: el período de la hoja metido en una frase. */
  periodo: string;
  onGrilla?: () => void;
  /** Abrir una fila de una pieza: su detalle de siempre, como al tocarla en la grilla. */
  onFila?: (g: Grafico, clave: string) => void;
  compartido?: boolean;
  /** La miniatura de «Nueva hoja». */
  quieta?: boolean;
}) {
  const { frase, numeros, proximas, semana, anuncios, leads, redes, quien, origen, problemas } = vista;
  const p = hoja.diseno?.piezas ?? {};
  const pieza = (id: string | undefined) => hoja.componentes.find((c): c is Grafico => c.id === id && c.clase === 'grafico');
  const abrir = (id: string | undefined, clave: string) => { const g = pieza(id); return g && onFila && !quieta ? () => onFila(g, clave) : undefined; };
  const raiz = useRef<HTMLDivElement>(null);
  const grad = `mur-g-${useId().replace(/:/g, '')}`;

  // ── La entrada (una vez, al montarse) ──────────────────────────────────────────────────────────────────────────────
  useLayoutEffect(() => {
    const el = raiz.current;
    if (!el || quieta || sinMovimiento()) return;
    const todos = (s: string) => Array.from(el.querySelectorAll(s));
    todos('.mur-head__title .mur-w__i').forEach((n, i) => anim(n, [{ transform: 'translateY(115%) rotate(6deg)' }, { transform: 'none' }], { duration: 850, delay: i * 22, easing: P4 }));
    todos('.mur-head__frase, .mur-head .mur-stat, .mur-head__actions > *').forEach((n, i) => anim(n, [{ opacity: 0, transform: 'translateY(14px)' }, { opacity: 1, transform: 'none' }], { duration: 550, delay: 120 + i * 80 }));
    todos('.mur-ov .mur-card').forEach((n, i) => anim(n, [{ opacity: 0, transform: 'translateY(34px) scale(.985)' }, { opacity: 1, transform: 'none' }], { duration: 900, delay: 200 + i * 70 }));
    todos('.mur-ov-after__item, .mur-ov-todo, .mur-ov-netlist li, .mur-ov-ib__row, .mur-ov-feed li').forEach((n, i) => anim(n, [{ opacity: 0, transform: 'translateY(12px)' }, { opacity: 1, transform: 'none' }], { duration: 550, delay: 450 + i * 45 }));
    todos('.mur-ov-day').forEach((n, i) => anim(n, [{ opacity: 0, transform: `translateY(40px) rotate(${i % 2 ? 3 : -3}deg) scale(.94)` }, { opacity: 1, transform: 'none' }], { duration: 800, delay: 500 + i * 60, easing: BACK14 }));
    todos('.mur-bar > i').forEach((n, i) => anim(n, [{ transform: 'scaleX(0)' }, { transform: getComputedStyle(n).transform }], { duration: 1000, delay: 600 + i * 60 }));
    todos('.mur-ov-ib__sent .mur-s').forEach((n, i) => anim(n, [{ transform: 'scaleX(0)' }, { transform: 'none' }], { duration: 1000, delay: 600 + i * 60 }));
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Los números cuentan desde cero la PRIMERA vez que llegan los datos ──────────────────────────────────────────────
  const firma = [...numeros.map((x) => x.valor), leads?.total, anuncios?.top?.leads, quien.edades?.map((e) => e.n).join(',')].join('|');
  useEffect(() => {
    const el = raiz.current;
    if (!el || quieta || sinMovimiento()) return;
    el.querySelectorAll<HTMLElement>('[data-cuenta]').forEach((n) => { if (n.dataset.animado != null) return; n.dataset.animado = ''; contar(n, 250, 1200); });
  }, [firma, quieta]);

  const ICONO_NUMERO: Record<VistaInstagram['numeros'][number]['id'], IconoId> = { alcance: 'people', ctr: 'send', gasto: 'coin' };
  const prox = proximas?.proxima ?? null;
  const top = anuncios?.top ?? null;
  const curva = leads && leads.puntos.length ? curvaDe(leads.puntos.map((x) => x.valor), leads.tope) : '';
  const fmtEje = (v: number) => (v >= 1000 ? corto(v) : entero(v));

  return (
    <Compartido.Provider value={compartido}>
    <div className="mur" ref={raiz} data-quieta={quieta ? '' : undefined}>
      <style href="dash-hoja-instagram" precedence="medium">{CSS_INSTAGRAM}</style>
      <main className="mur-dash">
        {/* ARRIBA: el saludo, lo que Instagram te mostró y los tres números (en lugar de la audiencia, la interacción y lo que sale esta
            semana, que en MaKo va en la tarjeta de la semana). */}
        <Parte id="cabecera">
        <section className="mur-head">
          <h1 className="mur-head__title">{titulo.split(/\s+/).map((w, i) => <Fragment key={i}>{i > 0 && ' '}<span className="mur-w"><span className="mur-w__i">{w}</span></span></Fragment>)}</h1>
          {frase.length > 0 ? <p className="mur-head__frase">{frase.map((t, i) => t.tipo === 'fuerte' ? <b key={i}>{t.s}</b> : <Fragment key={i}>{t.s}</Fragment>)}</p>
            : problemas.numeros ? <p className="mur-head__frase">{problemas.numeros}</p> : null}
          {numeros.map((x) => (
            <div key={x.id} className="mur-stat">
              <span className="mur-stat__ico"><Icono id={ICONO_NUMERO[x.id]} /></span>
              <span className="mur-stat__t">
                <span className="mur-stat__n">{x.valor == null ? <b className="mur-sin">—</b> : <b data-cuenta>{x.valor}</b>}</span>
                <span className="mur-stat__l">{x.titulo}{x.pie && <small>{x.pie}</small>}</span>
              </span>
            </div>
          ))}
          <div className="mur-head__actions">
            <Ir href="/calendario" className="mur-btn mur-btn--ink"><Icono id="pen" />Agendar una publicación</Ir>
          </div>
        </section>
        </Parte>

        <div className="mur-ov">
          <div className="mur-ov-r mur-ov-r--a">
            {/* LA PRÓXIMA PUBLICACIÓN («Up next»): la próxima publicación del Calendario, con lo que falta, y las que siguen. */}
            <Parte id="proxima">
            <section className="mur-card mur-ov-next">
              <div className="mur-card__h">
                <h2 className="mur-card__t">Próxima publicación</h2>
                {proximas && proximas.total > 0 && <span className="mur-live"><i className="mur-live__dot" />{plural(proximas.total, 'agendada', 'agendadas')}</span>}
                <Ir href="/calendario" className="mur-ibtn mur-ibtn--ring" etiqueta="Abrir el Calendario"><Icono id="out" /></Ir>
              </div>
              {problemas.calendario ? <Vacio titulo={problemas.calendario} /> : !prox ? <Vacio titulo="No tienes publicaciones agendadas" texto="Agéndalas en tu Calendario y aparecen aquí." /> : (
                <>
                  <article className="mur-ov-hero">
                    <Ir href={prox.href} className="mur-ov-hero__media" etiqueta={prox.titulo}><span className={`mur-ph mur-ph--${PH[prox.formato ?? 'otro']}`} /></Ir>
                    <div className="mur-ov-hero__b">
                      <div className="mur-ov-hero__top">
                        <span className="mur-brandchip"><i className="mur-bdg mur-bdg--coral">{prox.rotuloFormato.slice(0, 2).toUpperCase()}</i>{prox.rotuloFormato}</span>
                        <em className="mur-pill mur-pill--butter">Por publicar</em>
                      </div>
                      <span className="mur-ov-hero__k">sale en</span>
                      <b className="mur-ov-hero__n">{prox.falta}</b>
                      <span className="mur-ov-hero__w"><Icono id="clock" />{prox.cuando}</span>
                      <p className="mur-ov-hero__p">{prox.titulo}</p>
                      <div className="mur-ov-hero__f">
                        <Ir href={prox.href} className="mur-ibtn mur-ibtn--ring mur-ibtn--on-dark" etiqueta="Abrir en el Calendario"><Icono id="out" /></Ir>
                      </div>
                    </div>
                  </article>
                  {proximas!.siguen.length > 0 && (
                    <>
                      <p className="mur-eyebrow">Después</p>
                      <div className="mur-ov-after">
                        {proximas!.siguen.map((x) => (
                          <Ir key={x.id} href={x.href} className="mur-ov-after__item">
                            <span className={`mur-ph mur-ph--${PH[x.formato ?? 'otro']} mur-thumb`} />
                            <span className="mur-ov-after__m"><b>{x.titulo}</b><span>{x.cuando}</span></span>
                            <span className="mur-ov-after__r"><em className="mur-st mur-st--sea">{x.rotuloFormato}</em></span>
                          </Ir>
                        ))}
                      </div>
                    </>
                  )}
                </>
              )}
            </section>
            </Parte>

            {/* LOS OTROS ANUNCIOS QUE TRAJERON CLIENTES («Needs you»): del segundo en adelante (el primero va en la tarjeta grande). */}
            <Parte id="anuncios">
            <section className="mur-card mur-ov-needs">
              <div className="mur-card__h"><h2 className="mur-card__t">Más anuncios que trajeron clientes</h2>{anuncios && anuncios.resto.length > 0 && <i className="mur-count">{entero(anuncios.resto.length)}</i>}</div>
              {problemas.anuncios ? <Vacio titulo={problemas.anuncios} /> : !anuncios || !anuncios.resto.length ? <Vacio titulo={top ? 'Sólo un anuncio trajo leads' : 'Todavía no hay anuncios con leads'} texto={top ? 'Está en la tarjeta de al lado.' : undefined} /> : (
                <>
                  <ul className="mur-ov-todos">
                    {anuncios.resto.map((a, i) => {
                      const ver = abrir(p.anuncios, a.clave);
                      return (
                        <li key={a.clave} className="mur-ov-todo">
                          <Miniatura anuncio={a} i={i + 1} clase="mur-thumb mur-thumb--44" />
                          <div className="mur-ov-todo__m">
                            <b>{a.nombre}</b>
                            <span>{[a.leads != null ? plural(a.leads, 'lead', 'leads') : null, a.agendas != null ? plural(a.agendas, 'agenda', 'agendas') : null, a.cierres != null ? plural(a.cierres, 'cliente', 'clientes') : null].filter(Boolean).join(' · ')}</span>
                            <div className="mur-ov-todo__a">
                              {ver && <button className="mur-btn mur-btn--sm mur-btn--pine" type="button" onClick={ver}><Icono id="people" />Ver sus leads</button>}
                              <Ir href="/ads-manager" className="mur-btn mur-btn--sm mur-btn--ghost">Ads Manager</Ir>
                            </div>
                          </div>
                        </li>
                      );
                    })}
                  </ul>
                  {anuncios.total > anuncios.resto.length + 1 && (
                    <div className="mur-ov-more"><Ir href="/ads-manager" className="mur-btn mur-btn--sm mur-btn--ghost"><Icono id="chev" />Ver los {entero(anuncios.total)} anuncios</Ir></div>
                  )}
                </>
              )}
            </section>
            </Parte>
          </div>

          <div className="mur-ov-r mur-ov-r--b">
            {/* LOS LEADS DE TUS ANUNCIOS («Audience growth»): lo que llegó de tus anuncios de Meta cada día, con las agendas. */}
            <Parte id="leads">
            <section className="mur-card mur-ov-growth">
              <div className="mur-card__h"><h2 className="mur-card__t">Leads de tus anuncios</h2><Ir href="/ads-manager" className="mur-ibtn mur-ibtn--ring" etiqueta="Abrir Ads Manager"><Icono id="out" /></Ir></div>
              {problemas.leads ? <Vacio titulo={problemas.leads} /> : !leads || !leads.total ? <Vacio titulo="Tus anuncios no trajeron leads" texto={`Nada ${enElPeriodo(periodo)}.`} /> : (
                <>
                  <p className="mur-ov-growth__big"><b data-cuenta>{entero(leads.total)}</b><span>{`${leads.total === 1 ? 'lead' : 'leads'} ${enElPeriodo(periodo)}`}{leads.agendas != null ? ` · ${leads.agendas === 1 ? 'una agendó' : `${entero(leads.agendas)} agendaron`}` : ''}</span></p>
                  <div className="mur-ov-growth__leg"><span><i className="mur-lg" />Leads por día{leads.mejor ? ` · el mejor, ${leads.mejor}` : ''}</span></div>
                  <div className="mur-chart">
                    <div className="mur-chart__y">{leads.marcas.map((m, i) => <span key={i}>{fmtEje(m)}</span>)}</div>
                    <svg className="mur-chart__svg" viewBox={`0 0 ${ANCHO} ${ALTO}`} preserveAspectRatio="none" aria-hidden>
                      <defs><linearGradient id={grad} x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#1f68a8" stopOpacity=".16" /><stop offset="1" stopColor="#1f68a8" stopOpacity="0" /></linearGradient></defs>
                      <path className="mur-chart__grid" d={`M0 .5H${ANCHO}M0 95.5H${ANCHO}M0 189.5H${ANCHO}`} />
                      {curva && <path d={`${curva} L${ANCHO} ${ALTO} L0 ${ALTO} Z`} fill={`url(#${grad})`} />}
                      {curva && <path className="mur-chart__line" d={curva} />}
                    </svg>
                    <div className="mur-chart__x mur-chart__x--pc">{leads.x.map((x) => <span key={x.rotulo} style={{ left: `${x.pct.toFixed(2)}%` }}>{x.rotulo}</span>)}</div>
                    <div className="mur-chart__x mur-chart__x--tel">{leads.xTel.map((x) => <span key={x.rotulo} style={{ left: `${x.pct.toFixed(2)}%` }}>{x.rotulo}</span>)}</div>
                  </div>
                </>
              )}
            </section>
            </Parte>

            {/* EL ANUNCIO QUE MÁS CLIENTES TRAJO («Top post this month»): el primero de la pieza, con sus leads, agendas y clientes. */}
            <Parte id="mejor">
            <section className="mur-card mur-ov-top">
              <div className="mur-card__h"><h2 className="mur-card__t">El que más clientes trajo</h2></div>
              {problemas.anuncios ? <Vacio titulo={problemas.anuncios} /> : !top ? <Vacio titulo="Todavía no hay anuncios con leads" texto="Cuando un anuncio traiga gente, aparece aquí." /> : (
                <div className="mur-ov-topcard" data-lift="" {...accionDe(abrir(p.anuncios, top.clave))}>
                  <Miniatura anuncio={top} i={0} clase="mur-thumb mur-thumb--top" />
                  <em className="mur-pill mur-pill--butter mur-ov-topcard__tag">{top.cierres ? `Trajo ${plural(top.cierres, 'cliente', 'clientes')}` : top.agendas ? `Trajo ${plural(top.agendas, 'agenda', 'agendas')}` : 'El que más leads trajo'}</em>
                  <span className="mur-ov-topcard__b">
                    <span className="mur-ov-topcard__brand"><span className="mur-brandchip mur-brandchip--sm"><i className="mur-bdg mur-bdg--ink">AN</i>Anuncio de Meta</span></span>
                    <b className="mur-ov-topcard__t">{top.nombre}</b>
                    <span className="mur-ov-topcard__s">
                      <span><b data-cuenta>{entero(top.leads ?? 0)}</b>leads</span>
                      <span><b data-cuenta>{entero(top.agendas ?? 0)}</b>agendas</span>
                      <span><b data-cuenta>{entero(top.cierres ?? 0)}</b>clientes</span>
                    </span>
                  </span>
                </div>
              )}
            </section>
            </Parte>
          </div>

          {/* ESTA SEMANA («The week ahead»): los siete días desde hoy con lo agendado en el Calendario. */}
          <Parte id="semana">
          <section className="mur-card mur-ov-week">
            <div className="mur-card__h">
              <h2 className="mur-card__t">Esta semana</h2>
              <Ir href="/calendario" className="mur-btn mur-btn--sm mur-btn--ghost"><Icono id="cal" />Calendario</Ir>
            </div>
            {problemas.calendario || !semana ? <Vacio titulo={problemas.calendario ?? 'No pude leer tu Calendario.'} /> : (
              <>
                {!semana.total && <p className="mur-ov-week__nada">{textoSemana(0)}: agenda tus publicaciones en el Calendario.</p>}
                <div className="mur-ov-days">
                  {semana.dias.map((d) => (
                    <Ir key={d.dia} href="/calendario" className={`mur-ov-day${d.hoy ? ' mur-is-today' : ''}`} lift>
                      <span className="mur-ov-day__h"><span>{d.hoy ? 'Hoy' : d.nombre}</span><b>{d.numero}</b></span>
                      {d.turnos.map((t, k) => <span key={t.id} className={`mur-slot mur-slot--${SLOT[t.formato ?? 'otro']}`} title={t.titulo}>{t.hora}<i className={`mur-bdg mur-bdg--${BDG[k % BDG.length]}`}>{t.insignia}</i></span>)}
                      {d.mas > 0 && <span className="mur-slot mur-slot--more">+{d.mas}</span>}
                      <span className="mur-ov-day__f">{d.total ? plural(d.total, 'publicación', 'publicaciones') : 'Nada agendado'}</span>
                    </Ir>
                  ))}
                </div>
              </>
            )}
          </section>
          </Parte>

          <div className="mur-ov-r mur-ov-r--c">
            {/* CADA RED («Network pulse»): lo que te vieron en cada red de Meta, cuántos agendaron y cuántos tocan. */}
            <Parte id="redes">
            <section className="mur-card mur-ov-nets">
              <div className="mur-card__h"><h2 className="mur-card__t">Cada red</h2><Ir href="/ads-manager" className="mur-ibtn mur-ibtn--ring" etiqueta="Abrir Ads Manager"><Icono id="link" /></Ir></div>
              {problemas.redes ? <Vacio titulo={problemas.redes} /> : !redes || !redes.length ? <Vacio titulo="Meta todavía no mostró tus anuncios" /> : (
                <ul className="mur-ov-netlist">
                  {redes.map((r) => (
                    <li key={r.clave} {...accionDe(abrir(p.plataformas, r.clave))}>
                      <i className={`mur-net mur-net--lg${REDES_ICONO[r.icono].c}`}><Icono id={REDES_ICONO[r.icono].i} /></i>
                      <span className="mur-ov-net__m"><span><b>{r.nombre}</b><em>{corto(r.impresiones)}</em></span><i className="mur-bar"><i style={{ '--v': (r.barra / 100).toFixed(3) } as CSSProperties} /></i></span>
                      <span className="mur-ov-net__r"><b className={r.agendas ? '' : 'mur-cero'}>{r.agendas == null ? '—' : plural(r.agendas, 'agenda', 'agendas')}</b><span>{r.ctr == null ? 'Sin clics' : `${r.ctr.toLocaleString('es-MX', { maximumFractionDigits: 1 })}% tocan`}</span></span>
                    </li>
                  ))}
                </ul>
              )}
            </section>
            </Parte>

            {/* QUIÉN TE VE («Inbox pulse»): las tres edades que más te ven, el reparto por género y dónde te ven. */}
            <Parte id="quien-ve">
            <section className="mur-card mur-ov-inbox">
              <div className="mur-card__h"><h2 className="mur-card__t">Quién te ve en Instagram</h2><Ir href="/ads-manager" className="mur-ibtn mur-ibtn--ring" etiqueta="Abrir Ads Manager"><Icono id="people" /></Ir></div>
              {problemas.quien ? <Vacio titulo={problemas.quien} /> : !quien.edades?.length && !quien.genero?.length && !quien.regiones?.length ? <Vacio titulo="Instagram todavía no mostró tus anuncios" /> : (
                <>
                  {quien.edades && quien.edades.length > 0 && (
                    <div className="mur-ov-ib__tiles">{quien.edades.map((e) => <span key={e.clave} {...accionDe(abrir(p.edad, e.clave))}><b data-cuenta>{pct(e.pct)}</b>{e.nombre} años</span>)}</div>
                  )}
                  {quien.genero && quien.genero.length > 0 && (
                    <>
                      <div className="mur-ov-ib__sent">{quien.genero.map((g, i) => <i key={g.clave} className={`mur-s mur-s--g${i}`} style={{ '--f': g.n } as CSSProperties} />)}</div>
                      <p className="mur-ov-ib__leg">{quien.genero.map((g, i) => <span key={g.clave}><i className={`mur-d mur-d--g${i}`} />{g.nombre} {pct(g.pct)}</span>)}</p>
                    </>
                  )}
                  {quien.regiones && quien.regiones.length > 0 && (
                    <ul className="mur-ov-ib__list">
                      {quien.regiones.map((r, i) => (
                        <li key={r.clave}>
                          <div className="mur-ov-ib__row" {...accionDe(abrir(p.region, r.clave))}>
                            <span className={`mur-av mur-av--${AV[i % AV.length]}`}>{iniciales(r.nombre)}</span>
                            <span className="mur-ov-ib__m"><b>{r.nombre}</b><span>{corto(r.n)} vistas en Instagram</span></span>
                            <span className="mur-ov-ib__r"><i className="mur-net mur-net--sm"><Icono id="instagram" /></i><em className="mur-mood mur-mood--neu">{pct(r.pct)}</em></span>
                          </div>
                        </li>
                      ))}
                    </ul>
                  )}
                </>
              )}
            </section>
            </Parte>

            {/* DE DÓNDE LLEGAN TUS LEADS («Team activity»): cada origen con sus leads y su parte. */}
            <Parte id="origen">
            <section className="mur-card mur-ov-team">
              <div className="mur-card__h"><h2 className="mur-card__t">De dónde llegan tus leads</h2><Ir href="/crm" className="mur-ibtn mur-ibtn--ring" etiqueta="Abrir el CRM"><Icono id="out" /></Ir></div>
              {problemas.origen ? <Vacio titulo={problemas.origen} /> : !origen || !origen.lista.length ? <Vacio titulo="Todavía no llegaron leads" texto={`Nada ${enElPeriodo(periodo)}.`} /> : (
                <ul className="mur-ov-feed">
                  {origen.lista.map((o, i) => (
                    <li key={o.clave} {...accionDe(abrir(p.origen, o.clave))}>
                      <span className={`mur-av mur-av--sm mur-av--${AV[i % AV.length]}`}>{iniciales(o.nombre, 1)}</span>
                      <span className="mur-ov-feed__m"><span><b>{o.nombre}</b> {o.n === 1 ? 'trajo un lead' : `trajo ${entero(o.n)} leads`}</span><small><Icono id="people" />{pct(o.pct)} de tus leads</small></span>
                    </li>
                  ))}
                  {origen.mas > 0 && <li className="mur-ov-feed__mas"><Ir href="/crm" className="mur-btn mur-btn--sm mur-btn--ghost"><Icono id="chev" />{plural(origen.mas, 'origen más', 'orígenes más')}</Ir></li>}
                </ul>
              )}
            </section>
            </Parte>
          </div>
        </div>
        {onGrilla && !quieta && <div className="mur-pie" data-acompana=""><button type="button" className="mur-btn mur-btn--sm mur-btn--ghost" onClick={onGrilla}><Icono id="grid" />Ver la grilla</button></div>}
      </main>
    </div>
    </Compartido.Provider>
  );
}
