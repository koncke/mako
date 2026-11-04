'use client';

// =============================================================================
// HojaProductividad — la hoja Productividad con su DISEÑO PROPIO: la copia de Fernly, con los datos reales de MaKo
// =============================================================================
// Martín, 4/11/2026: «que sea primero la copia, es decir, que se vea exactamente igual que la copia, y después la adaptación con
// Maco... copiarlo todo, desde las animaciones de entrada, las animaciones de hover, las animaciones de clic». La copia y la
// adaptación (maquetas) están en docs/diseno/mockups-dashboard/productividad-fernly/; ésta es la adaptación con los datos de verdad
// (lib/productividad-diseno.ts arma lo que dibuja cada bloque, con test). La pregunta: «¿qué avanza y qué se estancó?».
//
// El movimiento sale del INFORME de Fernly (docs/diseno/mockups-dashboard/demos/fernly/INFORME.txt): los títulos suben desde abajo
// (115% → 0, .85 s, power4.out, 24 ms de escalera); las tarjetas entran desde opacidad 0, 36 px más abajo y .985 de escala (.85 s,
// power3.out, 70 ms); las filas de una lista entran desde 12 px (.55 s, power3.out, 50 ms); los números cuentan 1,3 s con
// power3.out; las columnas crecen desde abajo (.85 s, power4.out, 60 ms); los tramos del medio arco se dibujan 1,3 s con
// power3.out; una tarjeta con «lift» sube 4 px al pasar (.45 s, power3.out).
//
// ⚠️ Mirando se dibuja esto; editando, la grilla con los mismos componentes (app/dashboard/EditorInforme.tsx).
// ⚠️ Lo que Fernly tiene y MaKo no mide no está (lib/productividad-diseno.ts): el cronómetro, quién trabaja en qué y la comparación
//    con el mes anterior. La barra lateral y la de arriba las pone la app.
// =============================================================================

import { createContext, useContext, useEffect, useId, useLayoutEffect, useRef, type KeyboardEvent, type ReactNode } from 'react';
import Link from '@/app/_ui/Link';
import type { Grafico, Hoja } from '@/lib/graficos-catalogo';
import { FILAS_LISTA, ROTULO_ESTADO, textoQuieta, type ArcoPr, type VistaProductividad } from '@/lib/productividad-diseno';
import { entero } from '@/lib/marketing-diseno';
import { CSS_PRODUCTIVIDAD } from './productividad-css';

const Compartido = createContext(false);
const PLAN = '/plan';

const P = {
  flecha: 'M7.5 16.5l9-9M9 7.5h7.5V15',
  grid: 'M4 4h6.5v6.5H4zM13.5 4H20v6.5h-6.5zM4 13.5h6.5V20H4zM13.5 13.5H20V20h-6.5z',
  plan: 'M4 4h16v16H4zM8.5 12l2.5 2.5 4.5-5',
  ir: 'M5 12h14M13 6l6 6-6 6',
} as const;
function Icono({ id }: { id: keyof typeof P }) {
  return <svg className="frn-i" viewBox="0 0 24 24" aria-hidden><path d={P[id]} /></svg>;
}

const P3 = 'cubic-bezier(.215, .61, .355, 1)', P4 = 'cubic-bezier(.165, .84, .44, 1)';
const sinMovimiento = () => typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
const eP3 = (t: number) => 1 - Math.pow(1 - t, 3);
const anim = (n: Element | null | undefined, kf: Keyframe[], o: KeyframeAnimationOptions) => { if (n && 'animate' in n) (n as HTMLElement).animate(kf, { fill: 'backwards', ...o }); };

/** Cuenta el número de un texto desde cero («34», «42%»), con su prefijo y su sufijo. */
function contar(n: HTMLElement, demora: number, dur: number) {
  const fin = n.textContent ?? '';
  const m = fin.match(/^(\D*?)(\d[\d,]*)(.*)$/);
  if (!m) return;
  const [, pre, cifra, suf] = m, valor = Number(cifra.replace(/,/g, ''));
  const fmt = (v: number) => `${pre}${Math.round(v).toLocaleString('en-US')}${suf}`;
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
  if (useContext(Compartido)) return <span className={`${className ?? ''} frn-quieta`} aria-label={etiqueta}>{children}</span>;
  return <Link href={href} className={className} aria-label={etiqueta}>{children}</Link>;
}
function Vacio({ titulo, texto }: { titulo: string; texto?: string }) {
  return <div className="frn-vacio"><b>{titulo}</b>{texto}</div>;
}
/** Lo que se abre con un clic o con Enter: el detalle de la fila, como en la grilla. */
const accionDe = (fn: (() => void) | undefined) => (fn ? { role: 'button', tabIndex: 0, onClick: fn, onKeyDown: (e: KeyboardEvent) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); fn(); } } } : {});

// ── El medio arco de «Tus tareas»: las hechas (verde), las en curso (oscuro) y las que no empezaron (rayado) ──────────────
const CX = 125, CY = 125, R = 102, W = 46;
const pto = (f: number) => { const a = Math.PI * (1 + f); return [CX + R * Math.cos(a), CY + R * Math.sin(a)]; };
const arco = (a: number, b: number) => { const p = pto(a), q = pto(b); return `M${p[0].toFixed(2)} ${p[1].toFixed(2)} A${R} ${R} 0 0 1 ${q[0].toFixed(2)} ${q[1].toFixed(2)}`; };
function Medio({ arco: a }: { arco: ArcoPr }) {
  const raya = `frn-raya-${useId().replace(/:/g, '')}`;
  const h = a.hechas / a.total, c = (a.hechas + a.enCurso) / a.total;
  return (
    <svg viewBox="0 0 250 149" aria-hidden>
      <defs><pattern id={raya} width="7" height="7" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><rect width="7" height="7" fill="#fdfdfc" /><rect width="2" height="7" fill="#8d9a92" /></pattern></defs>
      {a.porEmpezar > 0 && <path d={arco(c, 1)} fill="none" stroke={`url(#${raya})`} strokeWidth={W} strokeLinecap="round" />}
      {a.enCurso > 0 && <path className="frn-seg" d={arco(h, c)} fill="none" stroke="#0d3a23" strokeWidth={W} strokeLinecap="round" pathLength={100} />}
      {a.hechas > 0 && <path className="frn-seg" d={arco(0, h)} fill="none" stroke="#1d7347" strokeWidth={W} strokeLinecap="round" pathLength={100} />}
    </svg>
  );
}

/** El ícono de un proyecto: un aro con su avance (en Fernly, el logo de cada proyecto). */
function Aro({ avance }: { avance: number | null }) {
  const v = avance == null ? 0 : Math.max(0, Math.min(100, avance));
  return (
    <svg className="frn-plist__ic" viewBox="0 0 30 30" aria-hidden>
      <circle cx="15" cy="15" r="11" fill="none" stroke="#e3f2e9" strokeWidth="6" />
      {v > 0 && <circle cx="15" cy="15" r="11" fill="none" stroke={v >= 100 ? '#0d3a23' : '#1d7347'} strokeWidth="6" pathLength={100} strokeDasharray={`${v} 100`} transform="rotate(-90 15 15)" />}
    </svg>
  );
}

const TONO_AV = ['frn-av--a', 'frn-av--b', 'frn-av--c', 'frn-av--d'] as const;
const PASTILLA = { quieta: 'frn-pill--wait', 'se-corre': 'frn-pill--run', 'al-dia': 'frn-pill--ok' } as const;

export function HojaProductividad({ hoja, vista, titulo, onGrilla, onFila, compartido = false, quieta = false }: {
  hoja: Hoja;
  vista: VistaProductividad;
  /** «Buenos días, Ana» (quién mira); sin nombre, el de la hoja. */
  titulo: string;
  onGrilla?: () => void;
  /** Abrir una fila de una pieza: su detalle de siempre, como al tocarla en la grilla. */
  onFila?: (g: Grafico, clave: string) => void;
  compartido?: boolean;
  /** La miniatura de «Nueva hoja». */
  quieta?: boolean;
}) {
  const { frase, tarjetas, columnas, quietas, proyectos, arco: medio, prioridades, problemas } = vista;
  const p = hoja.diseno?.piezas ?? {};
  const pieza = (id: string | undefined) => hoja.componentes.find((c): c is Grafico => c.id === id && c.clase === 'grafico');
  const abrir = (id: string | undefined, clave: string) => { const g = pieza(id); return g && onFila && !quieta ? () => onFila(g, clave) : undefined; };
  const raiz = useRef<HTMLDivElement>(null);
  const primera = quietas?.lista[0] ?? null;
  const resto = quietas ? quietas.lista.slice(1, 1 + FILAS_LISTA) : [];
  const masQuietas = quietas ? Math.max(0, quietas.lista.length - 1 - FILAS_LISTA) + quietas.fuera : 0;

  // ── La entrada: los títulos suben desde abajo, las tarjetas aparecen, las filas entran (una vez, al montarse) ─────────
  useLayoutEffect(() => {
    const el = raiz.current;
    if (!el || quieta || sinMovimiento()) return;
    el.querySelectorAll('.frn-head h1, .frn-head p').forEach((n, i) => anim(n, [{ opacity: 0, transform: 'translateY(115%)' }, { opacity: 1, transform: 'none' }], { duration: 850, delay: 80 + i * 24, easing: P4 }));
    el.querySelectorAll('.frn-head__acts .frn-btn').forEach((n, i) => anim(n, [{ opacity: 0, transform: 'translateY(12px)' }, { opacity: 1, transform: 'none' }], { duration: 550, delay: 160 + i * 50, easing: P3 }));
    el.querySelectorAll('.frn-card').forEach((n, i) => anim(n, [{ opacity: 0, transform: 'translateY(36px) scale(.985)' }, { opacity: 1, transform: 'none' }], { duration: 850, delay: 140 + i * 70, easing: P3 }));
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Lo que corre la PRIMERA vez que llegan los datos (los números, las columnas, el medio arco, las filas) ─────────────
  const firma = [tarjetas.map((t) => t.valor).join(','), columnas?.length, quietas?.lista.length, proyectos?.lista.length, medio?.total, prioridades?.tres.map((x) => x.n).join(',')].join('|');
  useEffect(() => {
    const el = raiz.current;
    if (!el || quieta || sinMovimiento()) return;
    const una = (sel: string, fn: (n: HTMLElement, i: number) => void) => el.querySelectorAll<HTMLElement>(sel).forEach((n, i) => { if (n.dataset.animado != null) return; n.dataset.animado = ''; fn(n, i); });
    una('[data-cuenta]', (n, i) => { if (/\d/.test(n.textContent ?? '')) contar(n, 220 + i * 70, 1300); });
    una('.frn-bar__fill', (n, i) => anim(n, [{ opacity: 0, transform: 'scaleY(0)' }, { opacity: 1, transform: 'none' }], { duration: 850, delay: 320 + i * 60, easing: P4 }));
    una('.frn-seg', (n, i) => anim(n, [{ strokeDasharray: '0 100' }, { strokeDasharray: '100 100' }], { duration: 1300, delay: 300 + i * 120, easing: P3 }));
    una('.frn-plist li, .frn-tlist li', (n, i) => anim(n, [{ opacity: 0, transform: 'translateY(12px)' }, { opacity: 1, transform: 'none' }], { duration: 550, delay: 500 + i * 50, easing: P3 }));
  }, [firma, quieta]);

  return (
    <Compartido.Provider value={compartido}>
    <div className="frn" ref={raiz} data-quieta={quieta ? '' : undefined}>
      <style href="dash-hoja-productividad" precedence="medium">{CSS_PRODUCTIVIDAD}</style>
      <main className="frn-board">
        {/* LA CABECERA: el saludo (en lugar de «Dashboard») y la frase del tablero. En lugar de «Add Project» e «Import Data», el
            Plan y la grilla. */}
        <div className="frn-head">
          <div>
            <h1>{titulo}</h1>
            {frase.length > 0 && <p>{frase.map((t, i) => (t.tipo === 'fuerte' ? <b key={i} className="frn-num">{t.s}</b> : <span key={i}>{t.s}</span>))}</p>}
            {problemas.frase && <p>{problemas.frase}</p>}
          </div>
          <div className="frn-head__acts">
            {!compartido && <Ir href={PLAN} className="frn-btn frn-btn--primary" etiqueta="Ver el Plan"><Icono id="plan" />Ver el Plan</Ir>}
            {onGrilla && <button type="button" className="frn-btn frn-btn--ghost" onClick={onGrilla}><Icono id="grid" />Ver la grilla</button>}
          </div>
        </div>

        <div className="frn-grid">
          {/* LAS CUATRO TARJETAS: el avance global, las estancadas, las de Alta sin deadline y cuántas se cerraron a tiempo. */}
          <div className="frn-stats">
            {tarjetas.map((t, i) => (
              <article key={t.id} className={`frn-card frn-stat${i === 0 ? ' frn-stat--hero' : ''}`} data-lift="">
                <h2 className="frn-stat__t">{t.titulo}</h2>
                {!compartido && <Ir href={PLAN} className="frn-arrow" etiqueta={`Ver ${t.titulo.toLowerCase()} en el Plan`}><Icono id="flecha" /></Ir>}
                <p className="frn-stat__n frn-num" key={t.valor ?? '—'} data-cuenta="">{t.valor ?? '—'}</p>
                <p className={`frn-stat__s${t.ok ? ' frn-stat__s--ok' : ''}`}><span>{problemas.tarjetas && t.valor == null ? problemas.tarjetas : t.sub}</span></p>
              </article>
            ))}
          </div>

          <div className="frn-left">
            <div className="frn-row">
              {/* LO QUE VENCE, POR SEMANA («Project Analytics»): esta semana oscura, las que tienen algo verdes y las vacías rayadas. */}
              <section className="frn-card frn-analytics">
                <h2 className="frn-card__t">Lo que vence, por semana</h2>
                {problemas.columnas ? <Vacio titulo={problemas.columnas} /> : !columnas || !columnas.length || columnas.every((c) => !c.n) ? (
                  <Vacio titulo="Nada vence en los próximos 30 días" texto="Las tareas con deadline aparecen aquí, por semana." />
                ) : (
                  <div className="frn-bars" style={{ ['--frn-n' as string]: String(columnas.length) }}>
                    {columnas.map((c) => (
                      <div key={c.clave} className={`frn-bar ${c.tono === 'semana' ? 'frn-bar--dark' : c.tono === 'lleno' ? 'frn-bar--solid' : 'frn-bar--hatch'}`} title={`${c.rotulo}: ${entero(c.n)} ${c.n === 1 ? 'tarea' : 'tareas'}`} {...accionDe(abrir(p.vence, c.clave))}>
                        <div className="frn-bar__fill" style={{ ['--h' as string]: c.alto.toFixed(4) }} />
                        {c.tope && <span className="frn-bar__tip frn-num">{entero(c.n)}</span>}
                        <span className="frn-bar__l">{c.rotulo}</span>
                      </div>
                    ))}
                  </div>
                )}
              </section>

              {/* LO QUE MÁS TIEMPO LLEVA QUIETO («Reminders»): la primera de «Lo que huele mal». */}
              <section className="frn-card frn-rem">
                <h2 className="frn-card__t">Lo más quieto</h2>
                {problemas.quietas ? <Vacio titulo={problemas.quietas} /> : !primera ? (
                  <Vacio titulo="No hay tareas activas" />
                ) : (
                  <>
                    <p className="frn-rem__h" {...accionDe(abrir(p.huele, primera.clave))}>{primera.tarea}</p>
                    <p className="frn-rem__t">{textoQuieta(primera.dias)}{primera.movidas ? ` · su deadline se corrió ${entero(primera.movidas)} ${primera.movidas === 1 ? 'vez' : 'veces'}` : ''}</p>
                    {!compartido && <Ir href={PLAN} className="frn-btn" etiqueta="Abrir en el Plan"><Icono id="ir" />Abrir en el Plan</Ir>}
                  </>
                )}
              </section>
            </div>

            <div className="frn-row frn-row--2">
              {/* LO QUE HUELE MAL («Team Collaboration»): las que siguen, con cuánto llevan quietas y si su deadline se corre. */}
              <section className="frn-card frn-team">
                <div className="frn-card__head">
                  <h2 className="frn-card__t">Lo que huele mal</h2>
                  {!compartido && <Ir href={PLAN} className="frn-chip" etiqueta="Ver todas en el Plan"><Icono id="ir" />{masQuietas > 0 ? `${entero(masQuietas)} más` : 'Ver todas'}</Ir>}
                </div>
                {problemas.quietas ? <Vacio titulo={problemas.quietas} /> : !resto.length ? (
                  <Vacio titulo={primera ? 'Nada más quieto' : 'No hay tareas activas'} texto={primera ? 'La que más tiempo lleva sin tocarse está arriba.' : undefined} />
                ) : (
                  <ul className="frn-tlist">
                    {resto.map((q, i) => (
                      <li key={q.clave} {...accionDe(abrir(p.huele, q.clave))}>
                        <span className={`frn-av ${TONO_AV[i % TONO_AV.length]}`}>{q.iniciales}</span>
                        <div className="frn-tlist__txt"><b>{q.tarea}</b><span>{textoQuieta(q.dias)}{q.movidas ? <> · <em>{entero(q.movidas)} {q.movidas === 1 ? 'cambio' : 'cambios'} de fecha</em></> : null}</span></div>
                        <span className={`frn-pill ${PASTILLA[q.estado]}`}>{ROTULO_ESTADO[q.estado]}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </section>

              {/* TUS TAREAS («Project Progress»): el medio arco de las hechas, las en curso y las que no empezaron. */}
              <section className="frn-card frn-progress">
                <h2 className="frn-card__t">Tus tareas</h2>
                {problemas.frase ? <Vacio titulo={problemas.frase} /> : !medio ? (
                  <Vacio titulo="Todavía no hay tareas" />
                ) : (
                  <>
                    <div className="frn-gauge">
                      <Medio arco={medio} />
                      <div className="frn-gauge__c"><b className="frn-num" key={Math.round(medio.pctHechas)} data-cuenta="">{Math.round(medio.pctHechas)}%</b><span>ya hechas</span></div>
                    </div>
                    <div className="frn-legend"><span><i />Hechas</span><span><i className="frn-dk" />En curso</span><span><i className="frn-ht" />Por empezar</span></div>
                  </>
                )}
              </section>
            </div>
          </div>

          <div className="frn-right">
            {/* PROYECTOS («Project»): los proyectos activos con su avance. */}
            <section className="frn-card frn-projects">
              <div className="frn-card__head">
                <h2 className="frn-card__t">Proyectos</h2>
                {!compartido && <Ir href={PLAN} className="frn-chip" etiqueta="Ver los proyectos en el Plan"><Icono id="ir" />{proyectos && proyectos.mas > 0 ? `${entero(proyectos.mas)} más` : 'Ver'}</Ir>}
              </div>
              {problemas.proyectos ? <Vacio titulo={problemas.proyectos} /> : !proyectos || !proyectos.lista.length ? (
                <Vacio titulo="No hay proyectos activos" />
              ) : (
                <ul className="frn-plist">
                  {proyectos.lista.map((x) => (
                    <li key={x.clave} {...accionDe(abrir(p.proyectos, x.clave))}>
                      <Aro avance={x.avance} />
                      <div><b>{x.nombre}</b><span>{x.avance == null ? 'Sin avance medido' : `${Math.round(x.avance)}% de avance`}</span></div>
                    </li>
                  ))}
                </ul>
              )}
            </section>

            {/* ACTIVAS POR PRIORIDAD («Time Tracker»): cuántas activas hay en Alta, en Media y en Baja. */}
            <section className="frn-card frn-tracker">
              <h2 className="frn-card__t">Activas por prioridad</h2>
              {problemas.prioridades ? <p className="frn-prio__fut">{problemas.prioridades}</p> : !prioridades ? null : (
                <>
                  <div className="frn-prio">
                    {prioridades.tres.map((x) => (
                      <div key={x.nombre} className="frn-prio__g" {...accionDe(abrir(p.piramide, x.nombre))}>
                        <b className="frn-clock frn-num" key={x.n} data-cuenta="">{entero(x.n)}</b>
                        <span><i className={`frn-prio__d frn-prio__d--${x.nombre.toLowerCase()}`} />{x.nombre}</span>
                      </div>
                    ))}
                  </div>
                  {prioridades.futuro > 0 && <p className="frn-prio__fut">y {entero(prioridades.futuro)} a futuro</p>}
                </>
              )}
            </section>
          </div>
        </div>
      </main>
    </div>
    </Compartido.Provider>
  );
}
