'use client';

// =============================================================================
// HojaFocus — la hoja Focus con su DISEÑO PROPIO: la copia de Pane, con lo que MaKo sabe del día
// =============================================================================
// Martín, 4/11/2026: «que sea primero la copia, es decir, que se vea exactamente igual que la copia, y después la adaptación
// con Maco» y «Carga los de FOCUS que ya teníamos». La copia y la adaptación (maquetas) están en
// docs/diseno/mockups-dashboard/focus-pane/; ésta es la adaptación con los datos de verdad, que llegan ya armados
// (`VistaFocus`, lib/focus-diseno.ts, con test) desde ./FocusVivo.tsx o, para la miniatura de «Nueva hoja», de ejemplo.
//
// Lo que Pane tiene y MaKo no mide NO está (lo dice lib/focus-diseno.ts): el temporizador de foco es «La meta», «Right now»
// es «Te está esperando» y las tareas cerradas por día son lo que vence cada día. El selector «Trimestre · Año» de la
// maqueta no está: la meta es una sola, y un selector que no cambia nada es un control muerto.
//
// El movimiento es el de Pane, medido en su INFORME (docs/diseno/mockups-dashboard/demos/pane/INFORME.txt; recetas en
// focus-pane/pane.js) y escrito con Element.animate: el título letra por letra («zc»), la bajada y los botones («po»), las
// tres cifras y las tarjetas que suben con su recorte («lo»), las filas («po»), las cifras que cuentan («vo»), la pastilla
// del selector (el resorte) y el hover que sube («So»). Cómo crecen los anillos y las barras no está en el INFORME: quedan
// con su valor, sin animar.
//
// ⚠️ La hoja de estilos (./focus-css.ts) es SÓLO de esta hoja.
// ⚠️ Mirando se dibuja esto; editando, la grilla con los bloques de siempre (app/dashboard/EditorInforme.tsx).
// =============================================================================

import { createContext, useContext, useEffect, useLayoutEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import Link from '@/app/_ui/Link';
import { enCuanto, horaEn, lineaProyecto, type VistaFocus } from '@/lib/focus-diseno';
import { CSS_FOCUS } from './focus-css';
import { Parte } from './parte';

// Las curvas de GSAP de Pane, traducidas (las mismas de docs/diseno/mockups-dashboard/focus-pane/pane.js).
const P4O = 'cubic-bezier(.165,.84,.44,1)';
const P3O = 'cubic-bezier(.215,.61,.355,1)';
const EXPO = 'cubic-bezier(.16,1,.3,1)';
const SPRING = 'cubic-bezier(.34,1.45,.55,1)';
const sinMovimiento = () => matchMedia('(prefers-reduced-motion: reduce)').matches;

/** QUIETA: la miniatura de «Nueva hoja»: sin la entrada, sin cifras que cuentan y sin hover. */
const Quieta = createContext(false);

const COLORES_EVENTO = ['var(--pink)', 'var(--indigo)', 'var(--purple)', 'var(--teal)'];
const RING = { tareas: 'var(--ring-tasks)', llamadas: 'var(--ring-focus)', kpis: 'var(--ring-meet)' } as const;
const URGENCIA = { vencida: { fondo: '#f4d7e1', punto: 'var(--danger)' }, pronto: { fondo: '#f6e5b9', punto: 'var(--orange)' }, nada: { fondo: '#d7edf4', punto: 'var(--green)' } };
const iniciales = (s: string) => [...s.trim().split(/\s+/).slice(0, 2).map((p) => [...p][0] ?? '')].join('').toUpperCase() || '·';

/** Una cifra que cuenta («vo» de Pane: desde 0, 1.2 s power3.out; al cambiar, desde la de antes). */
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

const P = {
  video: 'M3.5 7h11v10h-11zM14.5 10.5l6-3v9l-6-3',
  flag: 'M5 21V4M5 4h11l-2 4 2 4H5',
  expand: 'M9 15L18 6M11 6h7v7',
  tick: 'M6 12.5l4 4 8-8.5',
  check: 'M4 12a8 8 0 1 0 16 0a8 8 0 1 0-16 0M8.5 12.2l2.4 2.3 4.6-4.8',
} as const;
function Icono({ id }: { id: keyof typeof P }) {
  return <svg className="fp-i" viewBox="0 0 24 24" aria-hidden><path d={P[id]} /></svg>;
}

/** Un link de la app, o un texto si la hoja está compartida (un link compartido no tiene sesión) o no hay a dónde ir. */
function Ir({ href, className, style, children, label }: { href: string | null; className?: string; style?: CSSProperties; children: ReactNode; label?: string }) {
  const compartido = useContext(Compartido);
  if (!href || compartido) return <span className={className} style={style}>{children}</span>;
  return <Link href={href} className={className} style={style} aria-label={label}>{children}</Link>;
}
const Compartido = createContext(false);

/** «en <b>20 min</b>», «<b>Ahora</b>», la hora (sin reloj todavía) o «Todo el día». */
function cuandoEmpieza(e: { inicio: string; diaCompleto: boolean }, ahora: number | null, tz: string): ReactNode {
  if (e.diaCompleto) return 'Todo el día';
  if (ahora == null) return horaEn(e.inicio, tz);
  const falta = enCuanto(e.inicio, ahora);
  return falta === 'ahora' ? <b>Ahora</b> : <>en <b>{falta.replace(/^en /, '')}</b></>;
}

/** Los anillos de Pane: 14 de trazo, radios 53 · 38,5 · 24 en un lienzo de 120, desde arriba. */
function Anillos({ anillos }: { anillos: VistaFocus['anillos'] }) {
  const radios = [53, 38.5, 24];
  return (
    <svg viewBox="0 0 120 120" aria-hidden>
      <g transform="rotate(-90 60 60)">
        {anillos.map((a, i) => {
          const r = radios[i] ?? 24, C = 2 * Math.PI * r, f = a.de > 0 ? Math.max(0, Math.min(1, a.v / a.de)) : 0;
          return (
            <g key={a.id}>
              <circle className="tr" r={r} cx={60} cy={60} stroke={RING[a.id]} strokeOpacity={0.24} />
              {f > 0 && <circle className="ar" r={r} cx={60} cy={60} stroke={RING[a.id]} strokeDasharray={`${f * C} ${C}`} />}
            </g>
          );
        })}
      </g>
    </svg>
  );
}

/** El selector de Pane: la pastilla viaja .38 s con el resorte y cambia de ancho en .2 s. */
function Selector<T extends string>({ opciones, valor, onCambiar }: { opciones: ReadonlyArray<{ id: T; rotulo: string }>; valor: T; onCambiar: (v: T) => void }) {
  const caja = useRef<HTMLDivElement>(null);
  const pill = useRef<HTMLSpanElement>(null);
  const primera = useRef(true);
  const ubicar = (anima: boolean) => {
    const c = caja.current, p = pill.current;
    const b = c?.querySelector<HTMLButtonElement>('[aria-pressed="true"]');
    if (!c || !p || !b) return;
    const de = p.style.transform, deW = p.style.width;
    p.style.transform = `translateX(${b.offsetLeft}px)`;
    p.style.width = `${b.offsetWidth}px`;
    if (anima && de && !sinMovimiento()) {
      p.animate([{ transform: de }, { transform: p.style.transform }], { duration: 380, easing: SPRING });
      p.animate([{ width: deW }, { width: p.style.width }], { duration: 200, easing: 'cubic-bezier(.22,.8,.24,1)' });
    }
  };
  useLayoutEffect(() => {
    ubicar(!primera.current);
    primera.current = false;
  }, [valor]); // eslint-disable-line react-hooks/exhaustive-deps
  // Como Pane: cuando llega la letra, los botones cambian de ancho y la pastilla se vuelve a ubicar (sin animar).
  useEffect(() => { void document.fonts?.ready.then(() => ubicar(false)); }, []); // eslint-disable-line react-hooks/exhaustive-deps
  return (
    <div className="fp-seg" ref={caja}>
      <span className="fp-seg__pill" ref={pill} />
      {opciones.map((o) => (
        <button key={o.id} type="button" className="fp-seg__btn" aria-pressed={o.id === valor} onClick={() => onCambiar(o.id)}>{o.rotulo}</button>
      ))}
    </div>
  );
}

export function HojaFocus({ vista, titulo, sub, hoy, tz, ahora, metaAccion, hechas, onCompletar, onGrilla, compartido = false, quieta = false, pie }: {
  vista: VistaFocus;
  /** «Buenos días, Ana» (las variables de General); sin nombre, el de la hoja. */
  titulo: string;
  sub: string;
  hoy: string;
  /** La zona del negocio (las horas de «Lo que viene»). */
  tz: string;
  /** El reloj, después de montar (null en el server y en la miniatura: «en 20 min» se dibuja recién con él). */
  ahora: number | null;
  /** El botón de «La meta» (editarla o cargarla): lo pone ./FocusVivo.tsx; la miniatura, un rótulo. */
  metaAccion: ReactNode;
  /** Las tareas que se completaron desde la hoja (quedan tachadas, como en Pane). */
  hechas?: ReadonlySet<string>;
  onCompletar?: (id: string) => void;
  onGrilla?: () => void;
  compartido?: boolean;
  quieta?: boolean;
  /** Lo que va al pie (el toast de «Tarea completada»). */
  pie?: ReactNode;
}) {
  const raiz = useRef<HTMLDivElement>(null);
  const [entro, setEntro] = useState(false);
  const [espera, setEspera] = useState<'cobros' | 'leads'>('cobros');

  // ── La entrada de Pane (pane.js): una vez, al montarse ─────────────────────────────────────────────────────
  useLayoutEffect(() => {
    const el = raiz.current;
    setEntro(true);
    if (!el || quieta || sinMovimiento()) return;
    const todos = (s: string) => [...el.querySelectorAll<HTMLElement>(s)];
    const recorte = (n: HTMLElement, desde: number) => `inset(0 0 ${Math.round(n.offsetHeight * desde)}px 0 round 30px)`;
    const lo = (nodos: HTMLElement[], { y = 26, stagger = 0.07, delay = 0, from = 0.72 } = {}) => nodos.forEach((n, i) => {
      const t = delay + i * stagger;
      n.animate([{ transform: `translateY(${y}px) scale(.97)`, clipPath: recorte(n, from) }, { transform: 'none', clipPath: 'inset(0 0 0 0 round 30px)' }], { duration: 900, easing: EXPO, delay: t * 1000, fill: 'backwards' });
      [...n.children].forEach((k, j) => (k as HTMLElement).animate([{ opacity: 0, transform: 'translateY(8px)' }, { opacity: 1, transform: 'none' }], { duration: 550, easing: P3O, delay: (t + 0.14 + j * 0.035) * 1000, fill: 'backwards' }));
    });
    const po = (nodos: HTMLElement[], { y = 12, stagger = 0.045, delay = 0 } = {}) => nodos.forEach((n, i) =>
      n.animate([{ opacity: 0, transform: `translateY(${y}px)` }, { opacity: 1, transform: 'none' }], { duration: 550, easing: P3O, delay: (delay + i * stagger) * 1000, fill: 'backwards' }));
    // «zc»: cada letra del título, yPercent 115, rotation 6 → 0 · .85 s power4.out · .022
    todos('.fp-title .fp-l').forEach((n, i) => n.animate([{ transform: 'translateY(115%) rotate(6deg)' }, { transform: 'none' }], { duration: 850, easing: P4O, delay: i * 22, fill: 'backwards' }));
    po(todos('.fp-sub, .fp-actions > *'), { y: 12, stagger: 0.06, delay: 0.1 });
    lo(todos('[data-stat]'), { y: 14, stagger: 0.06, delay: 0.1, from: 0.6 });
    lo(todos('[data-card]'), { delay: 0.2 });
    po(todos('.fp-task, .fp-hproject, .fp-person, .fp-ev'), { delay: 0.45 });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ── El hover que sube («So»): lo que lleva [data-card] sube 4 px · .45 s power3.out, y baja en .5 s ───────────
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

  const { resumen, viene, meta, tareas, semana, proyectos } = vista;
  const proxima = viene?.proxima ?? null;
  // La escala deja aire arriba, como Pane (su demo: 4 como lo más alto, sobre un tope de 5).
  const maxSemana = semana ? Math.max(1, Math.ceil(Math.max(...semana.dias.map((d) => d.n)) * 1.25)) : 1;
  const cobros = vista.espera.cobros;
  const leads = vista.espera.leads;

  return (
    <Quieta.Provider value={quieta}>
    <Compartido.Provider value={compartido}>
    <div className="fp" ref={raiz} data-antes={entro || quieta ? undefined : ''}>
      <style href="dash-hoja-focus" precedence="medium">{CSS_FOCUS}</style>
      {/* La letra de la captura de Pane (Inter 4, con su tamaño óptico), sólo para esta hoja. */}
      <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Inter:opsz,wght@14..32,400..900&display=swap" precedence="default" />
      <div className="fp-page">
        <Parte id="cabecera">
        <div className="fp-head">
          <div style={{ minWidth: 0 }}>
            <h1 className="fp-title" aria-label={titulo}><span className="fp-w">{[...titulo].map((c, i) => <span key={i} className="fp-l" aria-hidden>{c}</span>)}</span></h1>
            {sub && <p className="fp-sub">{sub}</p>}
            <div className="fp-stats">
              <div className="fp-stat fp-glass" data-stat>
                <div className="fp-stat__l">Hechas hoy</div>
                <div className="fp-stat__v">{resumen.tareas ? <><Cuenta valor={resumen.tareas.cerradas} /><small> / {resumen.tareas.total}</small></> : '—'}</div>
              </div>
              <div className="fp-stat fp-glass" data-stat>
                <div className="fp-stat__l">Llamadas hoy</div>
                <div className="fp-stat__v">{resumen.llamadas ? <><Cuenta valor={resumen.llamadas.pasaron} /><small> / {resumen.llamadas.total}</small></> : '—'}</div>
              </div>
              <div className="fp-stat fp-glass" data-stat>
                <div className="fp-stat__l">Vencidas</div>
                <div className="fp-stat__v">{resumen.vencidas == null ? '—' : <Cuenta valor={resumen.vencidas} />}</div>
              </div>
            </div>
          </div>
          <div className="fp-actions">
            {onGrilla && <button type="button" className="fp-btn fp-btn--glass" onClick={onGrilla}>Ver todo en la grilla</button>}
            {proxima && !proxima.diaCompleto
              ? <Ir href={proxima.href ?? '/calendario'} className="fp-btn fp-btn--accent"><Icono id="video" />Próxima: {horaEn(proxima.inicio, tz)}</Ir>
              : <Ir href="/plan" className="fp-btn fp-btn--accent">Abrir el Plan</Ir>}
          </div>
        </div>
        </Parte>

        <section className="fp-grid fp-row1">
          {/* HOY: los anillos (en Pane, «Today»): tareas de hoy, llamadas de hoy y los KPIs del día en verde. */}
          <Parte id="hoy">
          <article className="fp-card fp-glass" data-card>
            <div className="fp-card__h"><div><h2 className="fp-card__t">Hoy</h2><p className="fp-card__s">Cierra tus anillos</p></div></div>
            <div className="fp-rings">
              <Anillos anillos={vista.anillos} />
              <div className="fp-rings__l">
                {vista.anillos.map((a) => (
                  <div key={a.id} className="fp-rk" style={{ borderColor: RING[a.id] }}>
                    <div className="fp-rk__l">{a.nombre}</div>
                    <div className="fp-rk__v"><Cuenta valor={a.v} /><small> / {a.de}</small></div>
                  </div>
                ))}
              </div>
            </div>
          </article>
          </Parte>

          {/* LO QUE VIENE (en Pane, «Up next»): lo de hoy en el Calendario, desde ahora. */}
          <Parte id="viene">
          <article className="fp-card fp-glass" data-card>
            <div className="fp-card__h"><h2 className="fp-card__t">Lo que viene</h2><Ir href="/calendario" className="fp-btn fp-btn--ghost fp-btn--sm">Calendario</Ir></div>
            {viene == null ? <p className="fp-vacio">No pude leer tu calendario.</p>
              : !proxima ? <p className="fp-vacio">No tienes nada más en el calendario por hoy.</p>
              : (
                <>
                  <Ir href={proxima.href} className="fp-next">
                    <span className="fp-next__en">{cuandoEmpieza(proxima, ahora, tz)}</span>
                    <span className="fp-next__t">{proxima.titulo}</span>
                    <span className="fp-next__m">{[proxima.diaCompleto ? null : `${horaEn(proxima.inicio, tz)}${proxima.fin ? ` – ${horaEn(proxima.fin, tz)}` : ''}`, proxima.detalle].filter(Boolean).join(' · ')}</span>
                    {proxima.href && !compartido && <span className="fp-next__pie"><span className="fp-btn fp-btn--accent fp-btn--join"><Icono id="video" />{proxima.llamada ? 'Abrir' : 'Ver'}</span></span>}
                  </Ir>
                  <div className="fp-evs">
                    {viene.despues.map((e, i) => (
                      <Ir key={e.id} href={e.href} className="fp-ev" style={{ ['--c' as string]: e.llamada ? 'var(--pink)' : COLORES_EVENTO[(i + 1) % COLORES_EVENTO.length] }}>
                        <b>{e.titulo}</b><span>{e.diaCompleto ? 'Todo el día' : horaEn(e.inicio, tz)}</span>
                      </Ir>
                    ))}
                  </div>
                </>
              )}
          </article>
          </Parte>

          {/* LA META (en Pane, el temporizador «Focus»): cuánto lleva la meta objetivo y cuánto debería llevar a hoy. */}
          <Parte id="meta">
          <article className="fp-card fp-glass" data-card>
            <div className="fp-card__h"><div><h2 className="fp-card__t">La meta</h2><p className="fp-card__s">{!meta || meta.atrasado == null ? 'Tu meta objetivo' : meta.atrasado ? 'Vas atrás del ritmo' : 'Vas a tiempo'}</p></div></div>
            {meta ? (
              <>
                <div className="fp-focus__b">
                  <div className="fp-timer"><b>{meta.pct == null ? '—' : <><Cuenta valor={meta.pct} />%</>}</b><small>de la meta</small></div>
                  <div className="fp-focus__c">
                    <div className="fp-focus__on">La meta del trimestre</div>
                    <div className="fp-select" title={meta.titulo}>{meta.titulo}</div>
                    {metaAccion}
                  </div>
                </div>
                <div className="fp-well">
                  <div className="fp-well__r"><span>Esperado a hoy</span><b>{meta.esperado}% · {meta.diasRestantes === 1 ? 'falta 1 día' : `faltan ${meta.diasRestantes} días`}</b></div>
                  <div className="fp-bar"><i style={{ width: `${Math.min(100, Math.max(0, meta.esperado))}%` }} /></div>
                </div>
              </>
            ) : (
              <div className="fp-focus__b"><div className="fp-focus__c"><p className="fp-vacio" style={{ textAlign: 'left', padding: '0 0 10px' }}>Todavía no tienes una meta para este trimestre.</p>{metaAccion}</div></div>
            )}
          </article>
          </Parte>
        </section>

        <section className="fp-grid fp-row2">
          {/* MIS TAREAS: las de hoy y atrasadas; si no hay, las que más mueven la aguja. */}
          <Parte id="tareas">
          <article className="fp-card fp-glass" data-card>
            <div className="fp-card__h"><div><h2 className="fp-card__t">Mis tareas</h2><p className="fp-card__s">{tareas && !tareas.deHoy ? 'Las que más mueven la aguja' : 'De hoy y atrasadas'}</p></div><Ir href="/plan" className="fp-btn fp-btn--ghost fp-btn--sm">Ver el Plan</Ir></div>
            {tareas == null ? <p className="fp-vacio">No pude leer tu Plan.</p>
              : !tareas.lista.length ? <p className="fp-vacio">No tienes tareas abiertas.</p>
              : (
                <ul className="fp-tasks">
                  {tareas.lista.map((t) => {
                    const hecha = hechas?.has(t.id) ?? false;
                    return (
                      <li key={t.id} className={`fp-task${hecha ? ' fp-task--hecha' : ''}`}>
                        {hecha || !onCompletar || compartido
                          ? <span className={`fp-check${hecha ? ' fp-check--on' : ''}`}>{hecha && <Icono id="tick" />}</span>
                          : <button type="button" className="fp-check" aria-label={`Marcar hecha: ${t.titulo}`} onClick={() => onCompletar(t.id)} />}
                        <Ir href={`/plan?tarea=${encodeURIComponent(t.id)}`} style={{ minWidth: 0 }}>
                          <div className="fp-task__t">{t.titulo}</div>
                          <div className="fp-task__m">{t.proyecto && <span className="fp-chip" style={{ ['--c' as string]: t.proyecto.color }}><i className="fp-dot" />{t.proyecto.nombre}</span>}{t.cuando}</div>
                        </Ir>
                        {t.prio === 'urgente' ? <span className="fp-prio fp-prio--urgente"><Icono id="flag" />Urgente</span> : t.prio === 'alta' ? <span className="fp-prio fp-prio--alta">Alta</span> : <span />}
                      </li>
                    );
                  })}
                </ul>
              )}
          </article>
          </Parte>

          {/* LA SEMANA (en Pane, las tareas cerradas por día): lo que vence cada día en el Plan, y hoy más claro. */}
          <Parte id="semana">
          <article className="fp-card fp-glass" data-card>
            <div className="fp-card__h"><div><h2 className="fp-card__t">La semana</h2><p className="fp-card__s">Lo que vence cada día</p></div><Ir href="/plan" className="fp-ibtn" label="Ver el Plan"><Icono id="expand" /></Ir></div>
            {semana == null ? <p className="fp-vacio">No pude leer tu Plan.</p> : (
              <>
                <div className="fp-big"><b><Cuenta valor={semana.total} /></b><span>{semana.total === 1 ? 'vence esta semana' : 'vencen esta semana'}</span>{semana.vencidas > 0 && <em className="fp-malo">{semana.vencidas === 1 ? '1 vencida' : `${semana.vencidas} vencidas`}</em>}</div>
                <div className="fp-bars">
                  {semana.dias.map((d) => (
                    <div key={d.dia} className={`fp-bar7${d.tipo === 'hoy' ? ' fp-bar7--hoy' : ''}`} title={`${d.etiqueta}: ${d.n}`}>
                      <div className="fp-bar7__t"><div className={`fp-bar7__f${d.n ? '' : ' fp-bar7__f--cero'}`} style={{ height: `${Math.min(100, (d.n / maxSemana) * 100)}%` }} /></div>
                      <div className="fp-bar7__l">{d.etiqueta}</div>
                    </div>
                  ))}
                </div>
              </>
            )}
          </article>
          </Parte>
        </section>

        <section className="fp-grid fp-row3">
          {/* PROYECTOS: los abiertos del Plan, con su avance y sus tareas abiertas. */}
          <Parte id="proyectos">
          <article className="fp-card fp-glass" data-card>
            <div className="fp-card__h"><h2 className="fp-card__t">Proyectos</h2><Ir href="/plan" className="fp-btn fp-btn--ghost fp-btn--sm">Ver todos</Ir></div>
            {proyectos == null ? <p className="fp-vacio">No pude leer tu Plan.</p>
              : !proyectos.length ? <p className="fp-vacio">No tienes proyectos abiertos.</p>
              : (
                <ul className="fp-projs">
                  {proyectos.map((p) => (
                    <li key={p.id}>
                      <Ir href={`/plan?proyecto=${encodeURIComponent(p.id)}`} className="fp-hproject" style={{ ['--c' as string]: p.color }}>
                        <span className="fp-tile" aria-hidden>{p.emoji}</span>
                        <span><b>{p.nombre}</b><small>{lineaProyecto(p, hoy)}</small></span>
                        <span className="fp-hproject__bar"><i style={{ width: `${Math.min(100, Math.max(0, p.pct))}%` }} /></span>
                        <span className="fp-hproject__pct">{p.pct}%</span>
                        <span className="fp-mas">{p.abiertas === 1 ? '1 tarea' : `${p.abiertas} tareas`}</span>
                      </Ir>
                    </li>
                  ))}
                </ul>
              )}
          </article>
          </Parte>

          {/* TE ESTÁ ESPERANDO (en Pane, «Right now»): los cobros por hacer y los leads por marcar. */}
          <Parte id="espera">
          <article className="fp-card fp-glass" data-card>
            <div className="fp-card__h">
              <h2 className="fp-card__t">Te está esperando</h2>
              <Selector opciones={[{ id: 'cobros', rotulo: 'Cobros' }, { id: 'leads', rotulo: 'Leads' }] as const} valor={espera} onCambiar={setEspera} />
            </div>
            {espera === 'cobros' ? (
              cobros == null ? <p className="fp-vacio">No pude leer los cobros.</p>
                : !cobros.length ? <p className="fp-vacio">Nadie te debe una cuota ahora.</p>
                : (
                  <ul className="fp-people">
                    {cobros.slice(0, 6).map((c) => {
                      const u = URGENCIA[c.urgencia ?? 'nada'];
                      return (
                        <li key={`${c.leadId}:${c.pagoId ?? 'mensual'}`}>
                          <Ir href={`/crm/${c.leadId}?tab=pagos`} className="fp-person">
                            <span className="fp-ava" style={{ background: u.fondo }}>{iniciales(c.nombre)}<i style={{ background: u.punto }} /></span>
                            <span><b>{c.nombre}</b><small>{c.linea}</small></span>
                          </Ir>
                        </li>
                      );
                    })}
                  </ul>
                )
            ) : (
              leads == null ? <p className="fp-vacio">No pude leer el CRM.</p>
                : !leads.length ? <p className="fp-vacio">No tienes leads por marcar.</p>
                : (
                  <ul className="fp-people">
                    {leads.map((l) => (
                      <li key={l.tipo}>
                        <Ir href="/crm" className="fp-person">
                          <span className="fp-ava" style={{ background: '#f6e5b9' }}>{l.n}<i style={{ background: 'var(--orange)' }} /></span>
                          <span><b>{l.n === 1 ? '1 lead' : `${l.n} leads`}</b><small>{l.texto}</small></span>
                        </Ir>
                      </li>
                    ))}
                  </ul>
                )
            )}
          </article>
          </Parte>
        </section>
      </div>
      {pie}
    </div>
    </Compartido.Provider>
    </Quieta.Provider>
  );
}
