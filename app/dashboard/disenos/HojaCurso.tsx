'use client';

// =============================================================================
// HojaCurso — la hoja «Curso o comunidad» con su DISEÑO PROPIO: la copia de Vitrea, con los datos reales de MaKo
// =============================================================================
// Martín, 4/11/2026: «que sea primero la copia, es decir, que se vea exactamente igual que la copia, y después la adaptación con
// Maco... copiarlo todo, desde las animaciones de entrada, las animaciones de hover, las animaciones de clic» y «Después seguí con la
// segunda hoja, de a una». La copia y la adaptación (maquetas) están en docs/diseno/mockups-dashboard/curso-vitrea/; ésta es la
// adaptación con los datos de verdad (lib/curso-diseno.ts arma lo que dibuja cada bloque, con test). La pregunta: «¿cuántos siguen
// ahí?».
//
// El movimiento sale del INFORME de Vitrea (docs/diseno/mockups-dashboard/demos/vitrea/INFORME.txt, la línea de tiempo de la página):
// el título sube por palabra desde abajo con un giro de 6° (115 % → 0, .85 s, power4.out, 22 ms de escalera); los números de arriba
// entran desde 14 px (.55 s, power3.out, 80 ms, a los .12 s); cada tarjeta se descubre desde 22 px, .975 de escala y un recorte de
// abajo (.75 s, expo.out, 60 ms, desde los .2 s) y su contenido aparece desde 8 px (.4 s, power3.out, 30 ms); los números cuentan
// desde cero (1,2 s, power3.out, a los .25 s). ⚠️ El recorte de la tarjeta lo arma una función del INFORME que no se ve entera: acá
// sale de abajo hacia arriba desde el 30 % (anotado en el relevo). La entrada de la barra de arriba y la de la izquierda es del
// armazón de Vitrea, que en MaKo pone la app.
//
// ⚠️ Mirando se dibuja esto; editando, la grilla con los mismos componentes (app/dashboard/EditorInforme.tsx).
// ⚠️ Lo que Vitrea tiene y MaKo no mide no está (lib/curso-diseno.ts): la línea punteada del año anterior, las estrellas, el tren de
//    versiones con sus pasos, la actividad del equipo («Recent activity») y la permanencia por cohorte.
// =============================================================================

import { createContext, Fragment, useContext, useEffect, useId, useLayoutEffect, useRef, useState, type CSSProperties, type KeyboardEvent, type ReactNode } from 'react';
import Link from '@/app/_ui/Link';
import { Parte } from './parte';
import type { Grafico, Hoja } from '@/lib/graficos-catalogo';
import { marcasDelEje, type Delta, type SerieCurso, type VistaCurso } from '@/lib/curso-diseno';
import { enElPeriodo, entero } from '@/lib/marketing-diseno';
import { CSS_CURSO } from './curso-css';

const Compartido = createContext(false);

const P = {
  people: 'M9 6a3 3 0 1 0 0 6a3 3 0 1 0 0-6M4 18a5 5 0 0 1 10 0M15.5 6.5a3 3 0 0 1 0 5.5M17 18a5 5 0 0 0-2-4',
  coin: 'M12 4.5a7.5 7.5 0 1 0 0 15a7.5 7.5 0 1 0 0-15M14.5 9.5c-.5-1-1.5-1.5-2.5-1.5-1.6 0-2.8.9-2.8 2.1 0 2.8 5.6 1.4 5.6 4 0 1.2-1.2 2.1-2.8 2.1-1.1 0-2.1-.6-2.6-1.5M12 6.5v11',
  wallet: 'M7 6h10a3 3 0 0 1 3 3v6a3 3 0 0 1-3 3H7a3 3 0 0 1-3-3V9a3 3 0 0 1 3-3zM4 10h16',
  arrow: 'M8 16L16 8M9.5 8H16v6.5',
  plus: 'M12 5v14M5 12h14',
  check: 'M6.5 12.5l3.5 3.5 7.5-8',
  clock: 'M12 4.5a7.5 7.5 0 1 0 0 15a7.5 7.5 0 1 0 0-15M12 8v4.5l3 1.8',
  note: 'M8 5h8a3 3 0 0 1 3 3v8a3 3 0 0 1-3 3H8a3 3 0 0 1-3-3V8a3 3 0 0 1 3-3zM8.5 9.5h7M8.5 12.5h7M8.5 15.5h4',
  leaf: 'M6 18C6 10 11 6 19 5c0 8-4 13-12 13zM6 18l7-7',
  moon: 'M18 14.5A7 7 0 0 1 9.5 6a7 7 0 1 0 8.5 8.5z',
  star: 'M12 4l2.4 5 5.4.6-4 3.7 1.1 5.4L12 16l-4.9 2.7 1.1-5.4-4-3.7 5.4-.6z',
  cal: 'M7 5.5h10a3 3 0 0 1 3 3v8a3 3 0 0 1-3 3H7a3 3 0 0 1-3-3v-8a3 3 0 0 1 3-3zM4 10h16M8.5 3.5v4M15.5 3.5v4',
  grid: 'M4 4h6.5v6.5H4zM13.5 4H20v6.5h-6.5zM4 13.5h6.5V20H4zM13.5 13.5H20V20h-6.5z',
} as const;
function Icono({ id }: { id: keyof typeof P }) {
  return <svg className="vit-i" viewBox="0 0 24 24" aria-hidden><path d={P[id]} /></svg>;
}
/** El ícono de cada tarjeta de área y de cada fila, en el orden de los tonos de Vitrea. */
const ICONOS_AREA: Array<keyof typeof P> = ['note', 'check', 'leaf', 'coin', 'moon', 'star'];
const TONOS_FILA = ['orange', 'blue', 'green', 'teal', 'coral', 'ink'] as const;

const P3 = 'cubic-bezier(.215, .61, .355, 1)', P4 = 'cubic-bezier(.165, .84, .44, 1)', EXPO = 'cubic-bezier(.16, 1, .3, 1)';
const sinMovimiento = () => typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
const anim = (n: Element | null | undefined, kf: Keyframe[], o: KeyframeAnimationOptions) => { if (n && 'animate' in n) (n as HTMLElement).animate(kf, { fill: 'backwards', easing: P3, ...o }); };
const eP3 = (t: number) => 1 - Math.pow(1 - t, 3);

/** Cuenta el número de un texto desde cero («US$14,250», «62%», «148»), con sus decimales, su prefijo y su sufijo. */
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
function Ir({ href, className, etiqueta, children }: { href: string; className?: string; etiqueta?: string; children: ReactNode }) {
  if (useContext(Compartido)) return <span className={`${className ?? ''} vit-quieta`} aria-label={etiqueta}>{children}</span>;
  return <Link href={href} className={className} aria-label={etiqueta}>{children}</Link>;
}
function Vacio({ titulo, texto }: { titulo: string; texto?: string }) {
  return <div className="vit-vacio"><b>{titulo}</b>{texto}</div>;
}
const accionDe = (fn: (() => void) | undefined) => (fn ? { role: 'button', tabIndex: 0, onClick: fn, onKeyDown: (e: KeyboardEvent) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); fn(); } } } : {});
const pct = (p: number | null) => ({ '--p': `${Math.max(0, Math.min(100, p ?? 0)).toFixed(1)}%` }) as CSSProperties;
function Chip({ delta }: { delta: Delta }) {
  if (!delta) return null;
  return <em className={`vit-chip ${delta.bueno ? 'vit-chip--good' : 'vit-chip--bad'}`}>{delta.texto}</em>;
}
/** «Pide atención · hablaron hace 15-30 días»: lo que dice la fila de un cliente. */
function lineaCliente(senal: string | null, contacto: string | null): string {
  const s = senal === 'Atención' ? 'Pide atención' : senal === 'Bien' ? 'Va bien' : null;
  const c = contacto == null ? null : contacto === 'Nunca' ? 'nunca hablaron' : `hablaron hace ${contacto[0].toLowerCase()}${contacto.slice(1)}`;
  const t = [s, c].filter(Boolean).join(' · ');
  return t ? t[0].toUpperCase() + t.slice(1) : 'Sin datos de contacto';
}

/** La curva suave que pasa por los puntos (como la línea de «Proceeds»). */
function curva(pts: Array<[number, number]>) {
  if (pts.length === 1) return `M${pts[0][0]},${pts[0][1]}`;
  let d = `M${pts[0][0].toFixed(1)},${pts[0][1].toFixed(1)}`;
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[i - 1] ?? pts[i], p1 = pts[i], p2 = pts[i + 1], p3 = pts[i + 2] ?? p2;
    const c1 = [p1[0] + (p2[0] - p0[0]) / 6, p1[1] + (p2[1] - p0[1]) / 6], c2 = [p2[0] - (p3[0] - p1[0]) / 6, p2[1] - (p3[1] - p1[1]) / 6];
    d += ` C${c1[0].toFixed(1)},${c1[1].toFixed(1)} ${c2[0].toFixed(1)},${c2[1].toFixed(1)} ${p2[0].toFixed(1)},${p2[1].toFixed(1)}`;
  }
  return d;
}
const W = 780, H = 198;
/** «150», «1.5K»: los rótulos del eje del área. */
const rotuloEje = (v: number) => (v >= 1000 ? `${Number((v / 1000).toFixed(1))}K` : `${Number(v.toFixed(1))}`);

function Area({ serie, grad }: { serie: SerieCurso; grad: string }) {
  const n = serie.puntos.length;
  const pts = serie.puntos.map((q, i): [number, number] => [n > 1 ? (i * W) / (n - 1) : W / 2, H - (q.valor / serie.tope) * H]);
  const d = curva(pts);
  // El eje de abajo: doce rótulos en la computadora y cinco en el teléfono (como la copia), cada juego repartido parejo; los que son
  // de uno solo llevan su clase y el otro los esconde.
  const esc = new Set(marcasDelEje(n, 12)), tel = new Set(marcasDelEje(n, 5));
  const eje = [...new Set([...esc, ...tel])].sort((a, b) => a - b);
  return (
    <div className="vit-plot">
      <div className="vit-plot__y">{serie.marcas.map((m, i) => <span key={i}>{rotuloEje(m)}</span>)}</div>
      <svg className="vit-plot__svg" viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" aria-hidden>
        <defs><linearGradient id={grad} x1="0" y1="0" x2="0" y2="1"><stop offset="0" style={{ stopColor: 'var(--accent-line)' }} stopOpacity=".26" /><stop offset="1" style={{ stopColor: 'var(--accent-line)' }} stopOpacity=".04" /></linearGradient></defs>
        <path className="vit-plot__grid" d={`M0 .5H${W}M0 99.5H${W}M0 197.5H${W}`} />
        {n > 1 && <path d={`${d} L${W} ${H} L0 ${H} Z`} fill={`url(#${grad})`} />}
        <path className="vit-plot__line" d={d} />
      </svg>
      <div className="vit-plot__x">{eje.map((i) => (
        <span key={i} className={`${tel.has(i) ? '' : 'vit-x--fuera'}${esc.has(i) ? '' : ' vit-x--tel'}`.trim() || undefined}
          style={{ left: n > 1 ? `${(i / (n - 1)) * 100}%` : '50%' }}>{serie.puntos[i].rotulo}</span>
      ))}</div>
    </div>
  );
}

export function HojaCurso({ hoja, vista, titulo, periodo, onGrilla, onFila, compartido = false, quieta = false }: {
  hoja: Hoja;
  vista: VistaCurso;
  /** El título de la hoja («Tus alumnos», el de su frase de apertura). */
  titulo: string;
  /** El período de la hoja («Últimos 30 días»). */
  periodo: string;
  onGrilla?: () => void;
  /** Abrir una fila de una pieza: su detalle de siempre, como al tocarla en la grilla. */
  onFila?: (g: Grafico, clave: string) => void;
  compartido?: boolean;
  /** La miniatura de «Nueva hoja». */
  quieta?: boolean;
}) {
  const { numeros, alumnosDia, clasesSemana, avance, estados, atencion, areas, tramos, clientes, publicaciones, hoy, problemas } = vista;
  const p = hoja.diseno?.piezas ?? {};
  const pieza = (id: string | undefined) => hoja.componentes.find((c): c is Grafico => c.id === id && c.clase === 'grafico');
  const abrir = (id: string | undefined, clave: string) => { const g = pieza(id); return g && onFila && !quieta ? () => onFila(g, clave) : undefined; };
  const raiz = useRef<HTMLDivElement>(null);
  const grad = `vit-g-${useId().replace(/:/g, '')}`;
  const [modo, setModo] = useState<'alumnos' | 'clases'>('alumnos');
  const serie = modo === 'alumnos' ? alumnosDia : clasesSemana;
  const enPer = enElPeriodo(periodo);

  // ── La entrada: el título por palabra, los números de arriba y las tarjetas (una vez, al montarse) ───────────────────
  useLayoutEffect(() => {
    const el = raiz.current;
    if (!el || quieta || sinMovimiento()) return;
    el.querySelectorAll('.vit-head__title .vit-w__i').forEach((n, i) => anim(n, [{ transform: 'translateY(115%) rotate(6deg)' }, { transform: 'none' }], { duration: 850, delay: i * 22, easing: P4 }));
    el.querySelectorAll('.vit-head .vit-stat').forEach((n, i) => anim(n, [{ opacity: 0, transform: 'translateY(14px)' }, { opacity: 1, transform: 'none' }], { duration: 550, delay: 120 + i * 80 }));
    el.querySelectorAll('.vit-card').forEach((n, i) => {
      const d = 200 + i * 60;
      anim(n, [{ transform: 'translateY(22px) scale(.975)', clipPath: 'inset(30% 0 0 0 round 26px)' }, { transform: 'none', clipPath: 'inset(-60px -60px -60px -60px round 26px)' }], { duration: 750, delay: d, easing: EXPO });
      Array.from(n.children).forEach((c, k) => anim(c, [{ opacity: 0, transform: 'translateY(8px)' }, { opacity: 1, transform: 'none' }], { duration: 400, delay: d + 50 + k * 30 }));
    });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Los números cuentan desde cero la PRIMERA vez que llegan los datos ──────────────────────────────────────────────
  const firma = [...numeros.map((x) => x.valor), alumnosDia?.total, avance, areas?.areas.map((a) => a.n).join(',')].join('|');
  useEffect(() => {
    const el = raiz.current;
    if (!el || quieta || sinMovimiento()) return;
    el.querySelectorAll<HTMLElement>('[data-cuenta]').forEach((n) => { if (n.dataset.animado != null) return; n.dataset.animado = ''; contar(n, 250, 1200); });
  }, [firma, quieta]);

  const icono = { alumnos: 'people', ventas: 'coin', cobrado: 'wallet' } as const;
  const pasaron = hoy ? hoy.pasaron : 0;

  return (
    <Compartido.Provider value={compartido}>
    <div className="vit" ref={raiz} data-quieta={quieta ? '' : undefined}>
      <style href="dash-hoja-curso" precedence="medium">{CSS_CURSO}</style>
      <div className="vit-fondo" aria-hidden><i className="vit-fondo__a" /><i className="vit-fondo__b" /><i className="vit-fondo__c" /><i className="vit-fondo__bola" /></div>
      <main className="vit-main">
        {/* LA CABECERA: el título por palabra y los tres números de arriba (en lugar de lo cobrado en la tienda, las descargas y la
            nota): los alumnos que vieron clases, las ventas y lo cobrado, cada uno contra el período anterior. */}
        <Parte id="cabecera">
        <div className="vit-head">
          <h1 className="vit-head__title">{titulo.split(/\s+/).map((w, i) => <Fragment key={i}>{i > 0 && ' '}<span className="vit-w"><span className="vit-w__i">{w}</span></span></Fragment>)}</h1>
          {numeros.map((x) => (
            <div key={x.id} className="vit-stat">
              <span className="vit-stat__ico"><Icono id={icono[x.id]} /></span>
              <div>
                <p className="vit-stat__n"><span data-cuenta="" key={x.valor ?? '—'}>{x.valor ?? '—'}</span> <Chip delta={x.delta} /></p>
                <p className="vit-stat__l">{x.texto} {enPer}</p>
              </div>
            </div>
          ))}
          {problemas.numeros && <p className="vit-stat__l">{problemas.numeros}</p>}
          {onGrilla && <div className="vit-head__acts"><button type="button" className="vit-btn vit-btn--ghost" onClick={onGrilla}><Icono id="grid" />Ver la grilla</button></div>}
        </div>
        </Parte>

        <div className="vit-grid">
          {/* LO QUE VIERON («Proceeds»): los alumnos de cada día, o con «Clases», las clases de cada semana. */}
          <Parte id="vieron">
        <section className="vit-card vit-ov-chart">
            <div className="vit-card__h">
              <h2 className="vit-card__t">{modo === 'alumnos' ? 'Alumnos que vieron clases' : 'Clases vistas'}</h2>
              <div className="vit-card__acts">
                <span className="vit-seg">
                  <button type="button" aria-pressed={modo === 'alumnos'} onClick={() => setModo('alumnos')}>Alumnos</button>
                  <button type="button" aria-pressed={modo === 'clases'} onClick={() => setModo('clases')}>Clases</button>
                </span>
                {!compartido && <Ir href="/classroom" className="vit-ibtn vit-ibtn--ring" etiqueta="Abrir Classroom"><Icono id="arrow" /></Ir>}
              </div>
            </div>
            {problemas.grafico ? <Vacio titulo={problemas.grafico} /> : !serie || !serie.puntos.length || !serie.puntos.some((q) => q.valor > 0) ? (
              <Vacio titulo="Nadie vio clases en este período" texto="Cuando tus alumnos vean una clase, aparece aquí." />
            ) : (
              <>
                <p className="vit-big">
                  <b className="vit-num" data-cuenta="" key={`${modo}-${serie.total}`}>{entero(serie.total ?? serie.puntos.reduce((a, q) => a + q.valor, 0))}</b>
                  <span>{modo === 'alumnos' ? 'alumnos' : 'clases'} {enPer}{serie.mejor && <> · {serie.paso === 'semana' ? 'la mejor semana' : serie.paso === 'mes' ? 'el mejor mes' : 'el mejor día'} <strong>{serie.mejor}</strong></>}</span>
                </p>
                <p className="vit-legend"><span><i className="vit-legend__dot" />{modo === 'alumnos' ? 'Alumnos de cada día' : 'Clases de cada semana'}</span></p>
                <Area serie={serie} grad={grad} />
              </>
            )}
          </section>
        </Parte>

          {/* POR ÁREA («Your apps»): una tarjeta de color por área, con sus alumnos y su parte. */}
          <Parte id="areas">
        <section className="vit-card vit-ov-apps">
            <div className="vit-card__h">
              <h2 className="vit-card__t">Por área</h2>
              <div className="vit-card__acts">
                <span className="vit-card__s">{periodo}{areas && areas.mas > 0 ? ` · y ${entero(areas.mas)} más` : ''}</span>
                {!compartido && <Ir href="/classroom" className="vit-ibtn vit-ibtn--ring" etiqueta="Abrir Classroom"><Icono id="arrow" /></Ir>}
              </div>
            </div>
            {problemas.areas ? <Vacio titulo={problemas.areas} /> : !areas || !areas.areas.length ? (
              <Vacio titulo="Todavía no hay alumnos por área" texto="Cuando tus cursos tengan alumnos, aparecen aquí." />
            ) : (
              <div className="vit-tiles">
                {areas.areas.map((a, i) => (
                  <article key={a.clave} className={`vit-ov-tile vit-tone--${a.tono}`} {...accionDe(abrir(p.area, a.clave))}>
                    <div className="vit-tile__h"><span className={`vit-tile__ico vit-ico--${a.tono}`}><Icono id={ICONOS_AREA[i % ICONOS_AREA.length]} /></span></div>
                    <h3 className="vit-tile__n">{a.nombre}</h3>
                    <p className="vit-tile__m">{a.parte == null ? ' ' : `${Math.round(a.parte)}% de tus alumnos`}</p>
                    <p className="vit-tile__v vit-num" data-cuenta="" key={a.n}>{entero(a.n)}</p>
                    <p className="vit-tile__d">{a.n === 1 ? 'alumno' : 'alumnos'}</p>
                  </article>
                ))}
              </div>
            )}
          </section>
        </Parte>

          {/* CUÁNTO AVANZAN («Ratings»): el avance promedio con su barra (en lugar de las estrellas) y cuántos van en cada estado. */}
          <Parte id="avance">
        <section className="vit-card vit-ov-rate">
            <div className="vit-card__h"><h2 className="vit-card__t">Cuánto avanzan</h2></div>
            {problemas.avance ? <Vacio titulo={problemas.avance} /> : !estados || !estados.estados.length ? (
              <Vacio titulo="Todavía no hay alumnos en tus cursos" />
            ) : (
              <>
                <div className="vit-rate__top">
                  <b className="vit-rate__n vit-num" data-cuenta="" key={avance ?? '—'}>{avance == null ? '—' : `${Math.round(avance)}%`}</b>
                  <div>
                    <span className="vit-bar vit-rate__bar"><i className="vit-bar--acc" style={pct(avance)} /></span>
                    <p className="vit-rate__s">{estados.total == null ? 'Avance promedio' : `Avance promedio · ${entero(estados.total)} ${estados.total === 1 ? 'alumno' : 'alumnos'}`}</p>
                  </div>
                </div>
                <ul className="vit-bars">
                  {estados.estados.map((e) => (
                    <li key={e.clave} {...accionDe(abrir(p.estado, e.clave))}>
                      <b>{e.nombre}</b>
                      <span className="vit-bar"><i className={`vit-bar--${e.tono}`} style={pct(e.parte)} /></span>
                      <span className="vit-bar__p">{e.parte == null ? '—' : `${Math.round(e.parte)}%`}</span>
                    </li>
                  ))}
                </ul>
                <p className="vit-rate__f">
                  {atencion == null ? (estados.mas > 0 ? `Y ${entero(estados.mas)} estados más` : ' ')
                    : atencion === 0 ? 'Hoy ningún cliente pide atención'
                    : <>Hoy <b>{entero(atencion)}</b> {atencion === 1 ? 'cliente pide' : 'clientes piden'} atención{!compartido && <> · <Ir href="/clients">Verlos</Ir></>}</>}
                </p>
              </>
            )}
          </section>
        </Parte>

          {/* QUIÉN TE NECESITA («Release train»): hace cuánto no hablan, por tramo (en lugar de las etapas del tren), y los clientes
              que piden atención primero. */}
          <Parte id="necesitan">
        <section className="vit-card vit-ov-train">
            <div className="vit-card__h">
              <h2 className="vit-card__t">Quién te necesita</h2>
              <div className="vit-card__acts">
                <span className="vit-card__s">{atencion == null ? ' ' : atencion === 1 ? '1 pide atención' : `${entero(atencion)} piden atención`}</span>
                {!compartido && <Ir href="/clients" className="vit-ibtn vit-ibtn--ring" etiqueta="Abrir Clients"><Icono id="arrow" /></Ir>}
              </div>
            </div>
            {problemas.quien ? <Vacio titulo={problemas.quien} /> : !clientes?.lista.length && !tramos?.length ? (
              <Vacio titulo="Todavía no tienes clientes" texto="Cuando alguien compre, aparece aquí con su último contacto." />
            ) : (
              <>
                {tramos && tramos.length > 0 && (
                  <div className="vit-stages" style={{ '--n': tramos.length } as CSSProperties}>
                    {tramos.map((t) => {
                      const fn = abrir(p.contacto, t.nombre);
                      return (
                        <button key={t.nombre} type="button" data-destacado={t.destacado ? '' : undefined} onClick={fn} disabled={!fn} title={t.nombre === 'Nunca' ? 'Nunca hablaron' : `Hablaron hace ${t.nombre}`}>
                          <b>{entero(t.n)}</b><span>{t.corto}</span>
                        </button>
                      );
                    })}
                  </div>
                )}
                <ul className="vit-rel">
                  {(clientes?.lista ?? []).map((c, i) => {
                    const fn = abrir(p.quien, c.clave);
                    return (
                      <li key={c.clave}>
                        <span className={`vit-sq vit-ico--${TONOS_FILA[i % TONOS_FILA.length]}`}><Icono id="people" /></span>
                        <div><b>{c.nombre}</b><span>{lineaCliente(c.senal, c.contacto)}</span></div>
                        {fn && <button className="vit-btn vit-btn--ghost" type="button" onClick={fn}>Abrir</button>}
                      </li>
                    );
                  })}
                </ul>
                {clientes && clientes.mas > 0 && <p className="vit-card__s">Y {entero(clientes.mas)} más en tu cartera</p>}
              </>
            )}
          </section>
        </Parte>

          {/* LO QUE VAS A PUBLICAR («Waiting for a reply»): las próximas publicaciones del Calendario. */}
          <Parte id="publicar">
        <section className="vit-card vit-ov-rev">
            <div className="vit-card__h">
              <h2 className="vit-card__t">Lo que vas a publicar</h2>
              <div className="vit-card__acts">
                {publicaciones && <em className="vit-count">{entero(publicaciones.total)}</em>}
                {!compartido && <Ir href="/calendario" className="vit-ibtn vit-ibtn--ring" etiqueta="Abrir el Calendario"><Icono id="arrow" /></Ir>}
              </div>
            </div>
            {problemas.calendario ? <Vacio titulo={problemas.calendario} /> : !publicaciones || !publicaciones.lista.length ? (
              <Vacio titulo="No hay publicaciones agendadas" texto="Planea una en el Calendario y aparece aquí." />
            ) : (
              <>
                <ul className="vit-revs">
                  {publicaciones.lista.map((x, i) => (
                    <li key={x.id} className="vit-ov-review">
                      <div className="vit-rev__h"><span className={`vit-sq vit-sq--sm vit-ico--${TONOS_FILA[i % TONOS_FILA.length]}`}><Icono id="note" /></span><b>{x.titulo}</b></div>
                      {x.detalle && <p className="vit-rev__t">{x.detalle}</p>}
                      <div className="vit-rev__f">
                        <span>{x.cuando}</span>
                        {x.href && !compartido && <Ir href={x.href} className="vit-btn vit-btn--ghost vit-btn--sm"><Icono id="arrow" />Abrir</Ir>}
                      </div>
                    </li>
                  ))}
                </ul>
                {!compartido && <Ir href="/calendario" className="vit-btn vit-btn--ghost vit-btn--sm vit-rev__all">Abrir el Calendario</Ir>}
              </>
            )}
          </section>
        </Parte>

          {/* HOY («Today»): lo de hoy en el Calendario, con lo que ya pasó tildado y tachado. */}
          <Parte id="hoy">
        <section className="vit-card vit-ov-today">
            <div className="vit-card__h">
              <h2 className="vit-card__t">Hoy</h2>
              {!compartido && <Ir href="/calendario?vista=dia" className="vit-btn vit-btn--accent"><Icono id="plus" />Agendar</Ir>}
            </div>
            {problemas.calendario ? <Vacio titulo={problemas.calendario} /> : !hoy || !hoy.total ? (
              <Vacio titulo="Nada agendado para hoy" />
            ) : (
              <>
                <div className="vit-done"><span>{entero(pasaron)} de {entero(hoy.total)} {pasaron === 1 ? 'ya pasó' : 'ya pasaron'}</span><span className="vit-done__bar"><i style={pct((pasaron / hoy.total) * 100)} /></span></div>
                <ul className="vit-agenda">
                  {hoy.lista.map((x) => (
                    <li key={x.id} className={x.paso ? 'vit-is-done' : undefined}>
                      <span className="vit-tick">{x.paso && <Icono id="check" />}</span>
                      <span className="vit-agenda__h">{x.hora}</span>
                      <div><b>{x.titulo}</b>{x.detalle && <span><Icono id="clock" />{x.detalle}</span>}</div>
                    </li>
                  ))}
                </ul>
              </>
            )}
          </section>
        </Parte>
        </div>
      </main>
    </div>
    </Compartido.Provider>
  );
}
