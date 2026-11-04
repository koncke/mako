'use client';

// =============================================================================
// HojaCs — la hoja CS Analyst con su DISEÑO PROPIO: la copia de Mender, con los datos reales de MaKo
// =============================================================================
// Martín, 4/11/2026: «que sea primero la copia, es decir, que se vea exactamente igual que la copia, y después la adaptación con
// Maco... copiarlo todo, desde las animaciones de entrada, las animaciones de hover, las animaciones de clic». La copia y la
// adaptación (maquetas) están en docs/diseno/mockups-dashboard/cs-mender/; ésta es la adaptación con los datos de verdad
// (lib/cs-diseno.ts arma lo que dibuja cada bloque, con test). La pregunta: «¿quién necesita atención?».
//
// El movimiento sale del INFORME de Mender (docs/diseno/mockups-dashboard/demos/mender/INFORME.txt): los números cuentan 1,1 s con
// power3.out; los medidores se dibujan desde su valor (1,1 s, power3.out, 30 ms de escalera); el anillo reparte sus tramos en 1,1 s
// con power3.inOut y 60 ms de escalera, y al cambiar de pestaña va del reparto viejo al nuevo; las tarjetas entran desde .92 con
// back.out(1.5) en .45 s (también al filtrar, como su «onEnter»); la pastilla de las pestañas se corre .5 s con expo.out. Lo que el
// INFORME no dice y se supone, anotado en el relevo: la cabecera y los paneles suben al entrar (.6-.7 s, power3.out).
//
// ⚠️ Mirando se dibuja esto; editando, la grilla con los mismos componentes (app/dashboard/EditorInforme.tsx).
// ⚠️ Lo que Mender tiene y MaKo no mide no está (lib/cs-diseno.ts): la primera respuesta, la satisfacción, el SLA, el avance de cada
//    caso y por qué se van. La barra de arriba y el riel los pone la app.
// =============================================================================

import { createContext, useContext, useEffect, useLayoutEffect, useMemo, useRef, useState, type KeyboardEvent, type ReactNode } from 'react';
import Link from '@/app/_ui/Link';
import type { Grafico, Hoja } from '@/lib/graficos-catalogo';
import { FILAS_CARRIL, FILTROS_CS, iconoDe, pasaFiltro, textoContacto, type AnilloCs, type FiltroCs, type TarjetaCs, type VistaCs } from '@/lib/cs-diseno';
import { entero } from '@/lib/marketing-diseno';
import { plata } from '@/lib/cobranza-diseno';
import { RUTA_CLIENTES } from '@/lib/clients-rutas';
import { CSS_CS } from './cs-css';

const Compartido = createContext(false);

const P = {
  grid: 'M4.5 4.5h6v6h-6zM13.5 4.5h6v6h-6zM4.5 13.5h6v6h-6zM13.5 13.5h6v6h-6z',
  gente: 'M9 11a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7zM3 20a6 6 0 0 1 12 0M16 4.6a3.5 3.5 0 0 1 0 6.8M21 20a6 6 0 0 0-3.5-5.5',
  reloj: 'M12 4a8 8 0 1 0 0 16 8 8 0 1 0 0-16M12 8v4.3l2.8 1.7',
  tilde: 'M2.5 12.5l4 4 8-9M10.5 15.5l1 1 8-9',
  flecha: 'M5 12h14M13 6l6 6-6 6',
} as const;
function Icono({ id }: { id: keyof typeof P }) {
  return <svg className="mnd-i" viewBox="0 0 24 24" aria-hidden><path d={P[id]} /></svg>;
}

const P3 = 'cubic-bezier(.215, .61, .355, 1)', BACK = 'cubic-bezier(.34, 1.56, .64, 1)';
const sinMovimiento = () => typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
const eP3 = (t: number) => 1 - Math.pow(1 - t, 3);
const eP3io = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
const anim = (n: Element | null | undefined, kf: Keyframe[], o: KeyframeAnimationOptions) => { if (n && 'animate' in n) (n as HTMLElement).animate(kf, { fill: 'backwards', ...o }); };

/** Cuenta el número de un texto desde cero («19», «64%», «US$1,240»), con su prefijo y su sufijo. */
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
  if (useContext(Compartido)) return <span className={`${className ?? ''} mnd-quieta`} aria-label={etiqueta}>{children}</span>;
  return <Link href={href} className={className} aria-label={etiqueta}>{children}</Link>;
}
function Vacio({ titulo, texto }: { titulo: string; texto?: string }) {
  return <div className="mnd-vacio"><b>{titulo}</b>{texto}</div>;
}

/** Las pestañas de Mender: la pastilla oscura se corre a la elegida (.5 s, expo.out). Las mide, así cada una tiene su ancho. */
function Seg<T extends string>({ opciones, valor, onCambio, chica = false }: { opciones: ReadonlyArray<{ id: T; largo: string; corto?: string }>; valor: T; onCambio: (v: T) => void; chica?: boolean }) {
  const caja = useRef<HTMLDivElement>(null), marca = useRef<HTMLSpanElement>(null);
  useLayoutEffect(() => {
    const b = caja.current?.querySelector<HTMLElement>('[aria-selected="true"]'), m = marca.current;
    if (b && m) { m.style.width = `${b.offsetWidth}px`; m.style.transform = `translateX(${b.offsetLeft - 4}px)`; }
  });
  return (
    <div className={`mnd-seg${chica ? ' mnd-seg--sm' : ''}`} role="tablist" ref={caja}>
      <span ref={marca} className="mnd-seg__pill" aria-hidden style={{ transition: 'transform .5s cubic-bezier(.16, 1, .3, 1), width .5s cubic-bezier(.16, 1, .3, 1)' }} />
      {opciones.map((o) => (
        <button key={o.id} type="button" role="tab" aria-selected={o.id === valor} onClick={() => onCambio(o.id)}>
          {o.corto && o.corto !== o.largo ? <><span className="mnd-largo">{o.largo}</span><span className="mnd-corto">{o.corto}</span></> : o.largo}
        </button>
      ))}
    </div>
  );
}

/** El anillo de Mender: un círculo por tramo, corrido a donde arranca; va del reparto que tenía al nuevo (1,1 s, power3.inOut). */
function Anillo({ anillo, quieta }: { anillo: AnilloCs; quieta: boolean }) {
  const svg = useRef<SVGSVGElement>(null);
  const antes = useRef<Array<{ s: number; l: number }>>([]);
  const firma = anillo.tramos.map((t) => `${t.nombre}:${t.n}`).join('|');
  useEffect(() => {
    const cs = [...(svg.current?.querySelectorAll<SVGCircleElement>('circle') ?? [])];
    let acc = 0;
    const fin = anillo.tramos.map((t) => { const s = acc; acc += t.pct; return { s, l: t.pct }; });
    const GAP = anillo.tramos.length > 1 ? 0.8 : 0;
    const pinta = (k: number) => cs.forEach((c, i) => {
      const a = antes.current[i] ?? { s: fin[i].s, l: 0 }, b = fin[i];
      const s = a.s + (b.s - a.s) * k, l = Math.max(0, a.l + (b.l - a.l) * k - GAP);
      c.setAttribute('stroke-dasharray', `${l.toFixed(3)} 100`);
      c.setAttribute('stroke-dashoffset', (-s - GAP / 2).toFixed(3));
    });
    if (quieta || sinMovimiento()) { pinta(1); antes.current = fin; return; }
    const t0 = performance.now() + 120;
    let vivo = true;
    const paso = (ahora: number) => {
      if (!vivo) return;
      const k = Math.min(1, Math.max(0, (ahora - t0) / 1100));
      pinta(eP3io(k));
      if (k < 1) requestAnimationFrame(paso); else antes.current = fin;
    };
    pinta(0); requestAnimationFrame(paso);
    return () => { vivo = false; };
  }, [firma, quieta]); // eslint-disable-line react-hooks/exhaustive-deps
  return (
    <svg ref={svg} viewBox="0 0 172 172" aria-hidden>
      {anillo.tramos.map((t) => <circle key={t.nombre} cx="86" cy="86" r="75" fill="none" strokeWidth="22" pathLength={100} style={{ stroke: t.tono }} strokeDasharray="0 100" />)}
    </svg>
  );
}

function Tarjeta({ t, abrir }: { t: TarjetaCs; abrir?: () => void }) {
  const contacto = textoContacto(t.contacto);
  const meta = [t.producto, contacto].filter(Boolean).join(' · ');
  const icono = iconoDe(t);
  const accion = abrir ? { role: 'button', tabIndex: 0, onClick: abrir, onKeyDown: (e: KeyboardEvent) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); abrir(); } } } : {};
  return (
    <article className={`mnd-case${t.atencion ? ' mnd-is-late' : ''}`} title={t.atencion ? `${t.nombre} pide atención` : undefined} {...accion}>
      <span className={`mnd-av mnd-av--${t.tono}`} aria-hidden>{t.iniciales}</span>
      <span className="mnd-case__txt">
        <span className="mnd-case__title">{t.nombre}</span>
        <span className="mnd-case__meta"><span className="mnd-case__meta-t">{meta || 'Sin datos de contacto'}</span>{t.deuda != null && t.deuda > 0 && <span className="mnd-late" title={`Debe ${plata(t.deuda)} vencidos`}>Debe</span>}</span>
      </span>
      {icono && <span className="mnd-case__ico" title={icono === 'reloj' ? 'Hace tiempo que no hablan' : 'Al día'}><Icono id={icono} /></span>}
    </article>
  );
}

export function HojaCs({ hoja, vista, titulo, onGrilla, onFila, compartido = false, quieta = false }: {
  hoja: Hoja;
  vista: VistaCs;
  /** «Buenos días, Ana» (quién mira); sin nombre, el de la hoja. */
  titulo: string;
  onGrilla?: () => void;
  /** Abrir una fila de una pieza: su detalle de siempre, como al tocarla en la grilla. */
  onFila?: (g: Grafico, clave: string) => void;
  compartido?: boolean;
  /** La miniatura de «Nueva hoja». */
  quieta?: boolean;
}) {
  const { frase, cartera, motivos, senal, medidores, problemas } = vista;
  const p = hoja.diseno?.piezas ?? {};
  const pieza = (id: string | undefined) => hoja.componentes.find((c): c is Grafico => c.id === id && c.clase === 'grafico');
  const abrir = (id: string | undefined, clave: string) => { const g = pieza(id); return g && onFila && !quieta ? () => onFila(g, clave) : undefined; };
  const raiz = useRef<HTMLDivElement>(null);
  const [filtro, setFiltro] = useState<FiltroCs>('todos');
  const [como, setComo] = useState<'motivo' | 'senal'>('motivo');
  const anillo = como === 'motivo' ? motivos : senal;

  const carriles = useMemo(() => cartera.carriles.map((c) => {
    const visibles = c.tarjetas.filter((t) => pasaFiltro(t, filtro));
    const n = filtro === 'todos' ? c.n ?? visibles.length : visibles.length;
    return { ...c, visibles: visibles.slice(0, FILAS_CARRIL), n, mas: Math.max(0, n - Math.min(FILAS_CARRIL, visibles.length)) };
  }), [cartera, filtro]);

  // ── La entrada: la cabecera y los paneles suben, una vez, al montarse ────────────────────────────────────────────────
  useLayoutEffect(() => {
    const el = raiz.current;
    if (!el || quieta || sinMovimiento()) return;
    el.querySelectorAll('.mnd-head > *').forEach((n, i) => anim(n, [{ opacity: 0, transform: 'translateY(10px)' }, { opacity: 1, transform: 'none' }], { duration: 600, delay: 120 + i * 50, easing: P3 }));
    el.querySelectorAll('.mnd-pagina > .mnd-panel, .mnd-row2 > .mnd-panel').forEach((n, i) => anim(n, [{ opacity: 0, transform: 'translateY(16px)' }, { opacity: 1, transform: 'none' }], { duration: 700, delay: 160 + i * 70, easing: P3 }));
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Lo que corre la PRIMERA vez que llegan los datos (los números, los medidores) ─────────────────────────────────────────
  const firma = [cartera.carriles.length, cartera.carriles.reduce((a, c) => a + c.tarjetas.length, 0), motivos?.total, senal?.total, medidores.map((m) => m.pct).join(',')].join('|');
  useEffect(() => {
    const el = raiz.current;
    if (!el || quieta || sinMovimiento()) return;
    const una = (sel: string, fn: (n: HTMLElement, i: number) => void) => el.querySelectorAll<HTMLElement>(sel).forEach((n, i) => { if (n.dataset.animado != null) return; n.dataset.animado = ''; fn(n, i); });
    una('[data-cuenta]', (n, i) => { if (/\d/.test(n.textContent ?? '')) contar(n, 200 + i * 20, 1100); });
    una('.mnd-ring__val', (c, i) => {
      const f = Number(c.getAttribute('data-fill') ?? 0), t0 = performance.now() + 260 + i * 30;
      const paso = (ahora: number) => { if (!c.isConnected) return; const k = Math.min(1, Math.max(0, (ahora - t0) / 1100)); c.setAttribute('stroke-dashoffset', (f * (1 - eP3(k))).toFixed(3)); if (k < 1) requestAnimationFrame(paso); };
      c.setAttribute('stroke-dashoffset', String(f)); requestAnimationFrame(paso);
    });
    una('.mnd-legend__bar i', (n, i) => anim(n, [{ transform: 'scaleX(0)' }, { transform: n.style.transform || 'none' }], { duration: 1100, delay: 260 + i * 60, easing: 'cubic-bezier(.645, .045, .355, 1)' }));
  }, [firma, quieta]);

  // ── Las tarjetas entran desde .92 con rebote, al montarse y cada vez que cambia la pestaña (el «onEnter» de Mender) ─────────
  const tarjetasFirma = `${filtro}|${firma}`;
  useEffect(() => {
    const el = raiz.current;
    if (!el || quieta || sinMovimiento()) return;
    el.querySelectorAll('.mnd-lane__list > li').forEach((n, i) => anim(n.firstElementChild, [{ opacity: 0, transform: 'scale(.92)' }, { opacity: 1, transform: 'none' }], { duration: 450, delay: 40 + i * 22, easing: BACK }));
  }, [tarjetasFirma, quieta]);

  const nCarriles = Math.max(4, carriles.length);

  return (
    <Compartido.Provider value={compartido}>
    <div className="mnd" ref={raiz} data-quieta={quieta ? '' : undefined}>
      <style href="dash-hoja-cs" precedence="medium">{CSS_CS}</style>
      <div className="mnd-pagina">
        {/* LA CABECERA: el saludo (en lugar de «Cases overview») y la frase de la cartera. */}
        <div className="mnd-head">
          <h1 className="mnd-page-t">{titulo}</h1>
          {frase.length > 0 && <p className="mnd-lede">{frase.map((t, i) => (t.tipo === 'fuerte' ? <b key={i} className="mnd-num">{t.s}</b> : <span key={i}>{t.s}</span>))}</p>}
          {problemas.frase && <p className="mnd-lede">{problemas.frase}</p>}
        </div>

        {/* TU CARTERA POR ETAPA («Case pipeline»): un carril por etapa de la entrega; las pestañas filtran. En lugar de «New case» y
            «Export», los clientes y la grilla. */}
        <div className="mnd-panel mnd-panel--board">
          <div className="mnd-board-head">
            <h2 className="mnd-panel-t">Tu cartera por etapa</h2>
            <Seg opciones={FILTROS_CS} valor={filtro} onCambio={setFiltro} />
            <div className="mnd-board-acts">
              {!compartido && <Ir href={RUTA_CLIENTES} className="mnd-btn mnd-btn--ink mnd-btn--sm mnd-btn--txt" etiqueta="Ver tus clientes"><Icono id="gente" /><span>Ver clientes</span></Ir>}
              {onGrilla && <button type="button" className="mnd-iconbtn mnd-iconbtn--sm" aria-label="Ver la grilla" title="Ver la grilla" onClick={onGrilla}><Icono id="grid" /></button>}
            </div>
          </div>
          {problemas.cartera ? <Vacio titulo={problemas.cartera} /> : !carriles.length ? (
            <Vacio titulo="Todavía no hay clientes en la entrega" texto="Cuando ganes un cliente, aparece en la primera etapa de su servicio." />
          ) : (
            <div className="mnd-lanes" style={{ ['--mnd-carriles' as string]: String(nCarriles) }}>
              {carriles.map((c) => (
                <section key={c.etapa} className="mnd-lane">
                  <header className="mnd-lane__h"><span>{c.etapa}</span><span className="mnd-lane__n mnd-num">{entero(c.n)}</span></header>
                  <ol className="mnd-lane__list">
                    {c.visibles.map((t) => <li key={t.clave}><Tarjeta t={t} abrir={abrir(p.carriles, t.clave)} /></li>)}
                    {c.mas > 0 && <li><Ir href={RUTA_CLIENTES} className="mnd-lane__mas">y {entero(c.mas)} más<Icono id="flecha" /></Ir></li>}
                    {!c.visibles.length && !c.mas && <li><p className="mnd-lane__vacio">{filtro === 'todos' ? 'Nadie en esta etapa' : 'Nadie con este filtro'}</p></li>}
                  </ol>
                </section>
              ))}
            </div>
          )}
          {cartera.fuera > 0 && !problemas.cartera && <p className="mnd-nota">Se ven los primeros 50 clientes. <Ir href={RUTA_CLIENTES}>Ver los {entero(cartera.fuera)} que faltan</Ir></p>}
        </div>

        <div className="mnd-row2">
          {/* POR QUÉ PIDEN ATENCIÓN («Top case drivers»): el anillo de los motivos de la señal, o de la señal de toda la cartera. */}
          <section className="mnd-panel mnd-panel--drivers">
            <div className="mnd-p-head">
              <div>
                <h2 className="mnd-panel-t">{como === 'motivo' ? 'Por qué piden atención' : 'Cómo están'}</h2>
                <p className="mnd-panel-s">{como === 'motivo' ? 'Lo que prendió la señal de cada uno' : 'Toda tu cartera, hoy'}</p>
              </div>
              <Seg chica opciones={[{ id: 'motivo', largo: 'Motivos' }, { id: 'senal', largo: 'Señal' }] as const} valor={como} onCambio={setComo} />
            </div>
            {problemas.anillo ? <Vacio titulo={problemas.anillo} /> : !anillo || !anillo.total ? (
              <Vacio titulo={como === 'motivo' ? 'Nadie pide atención' : 'Todavía no hay clientes'} texto={como === 'motivo' ? 'Tu cartera está al día.' : undefined} />
            ) : (
              <div className="mnd-drivers">
                <div className="mnd-donut">
                  <Anillo anillo={anillo} quieta={quieta} />
                  <div className="mnd-donut__c"><b className="mnd-num" key={`${como}${anillo.total}`} data-cuenta="">{entero(anillo.total)}</b><span>{anillo.total === 1 ? 'cliente' : 'clientes'}</span></div>
                </div>
                <ul className="mnd-legend">
                  {anillo.tramos.map((t) => {
                    const fn = t.clave ? abrir(como === 'motivo' ? p.motivos : p.senal, t.clave) : undefined;
                    const accion = fn ? { role: 'button', tabIndex: 0, onClick: fn, onKeyDown: (e: KeyboardEvent) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); fn(); } } } : {};
                    return (
                      <li key={t.nombre}>
                        <div className="mnd-legend__row" style={{ ['--tone' as string]: t.tono }} {...accion}>
                          <span className="mnd-legend__dot" />
                          <span className="mnd-legend__label">{t.nombre}</span>
                          <span className="mnd-legend__bar"><i style={{ transform: `scaleX(${t.barra.toFixed(4)})` }} /></span>
                          <b className="mnd-num">{Math.round(t.pct)}%</b>
                        </div>
                      </li>
                    );
                  })}
                </ul>
              </div>
            )}
          </section>

          {/* CÓMO ESTÁ TU CARTERA («Case health»): tres medidores en lugar de la primera respuesta, la satisfacción y el SLA. */}
          <section className="mnd-panel mnd-panel--metrics">
            <div className="mnd-p-head"><div><h2 className="mnd-panel-t">Cómo está tu cartera</h2><p className="mnd-panel-s">Hoy, en toda tu cartera</p></div></div>
            {problemas.medidores ? <Vacio titulo={problemas.medidores} /> : (
              <div className="mnd-health">
                {medidores.map((m) => {
                  const fill = m.pct == null ? 0 : Math.max(0, Math.min(1, m.pct / 100)) * 81.3;
                  return (
                    <div key={m.id} className="mnd-gauge" style={{ ['--tone' as string]: m.tono }}>
                      <div className="mnd-ring">
                        <svg viewBox="0 0 118 118" aria-hidden>
                          <circle className="mnd-ring__track" cx="59" cy="59" r="54" fill="none" strokeWidth="10" pathLength={100} strokeDasharray="81.3 100" strokeLinecap="round" />
                          {m.pct != null && m.pct > 0 && <circle className="mnd-ring__val" cx="59" cy="59" r="54" fill="none" strokeWidth="10" pathLength={100} strokeDasharray={`${fill.toFixed(2)} 100`} data-fill={fill.toFixed(2)} strokeLinecap="round" />}
                        </svg>
                        {m.pct == null ? <b className="mnd-sin">Sin datos</b> : <b className="mnd-num" data-cuenta="">{Math.round(m.pct)}%</b>}
                      </div>
                      <p className="mnd-gauge__l">{m.titulo}</p>
                      <p className="mnd-gauge__s">{m.sub}</p>
                    </div>
                  );
                })}
              </div>
            )}
          </section>
        </div>
      </div>
    </div>
    </Compartido.Provider>
  );
}
