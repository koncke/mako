'use client';

// =============================================================================
// HojaContenido — la hoja Contenido e IA con su DISEÑO PROPIO: la copia de Orrery, con los datos reales de MaKo
// =============================================================================
// Martín, 4/11/2026: «que sea primero la copia, es decir, que se vea exactamente igual que la copia, y después la adaptación con
// Maco... copiarlo todo, desde las animaciones de entrada, las animaciones de hover, las animaciones de clic». La copia y la
// adaptación (maquetas) están en docs/diseno/mockups-dashboard/contenido-orrery/; ésta es la adaptación con los datos de verdad
// (lib/contenido-diseno.ts arma lo que dibuja cada bloque, con test). La pregunta: «¿cuánta IA gastamos y en qué?».
//
// El movimiento sale del INFORME de Orrery (docs/diseno/mockups-dashboard/demos/orrery/INFORME.txt, la línea de tiempo de la
// página): los títulos suben desde abajo (115 % → 0, .8 s, power4.out, 22 ms de escalera); a los .1 s las tarjetas aparecen desde
// opacidad 0, 32 px más abajo y .985 (.8 s, power3.out, 65 ms); a los .25 s los números cuentan desde cero (1,3 s, power3.out; los
// del costo de cada modelo, 1,2 s); a los .45 s las líneas chicas se descubren de izquierda a derecha (1,1 s, power3.inOut); a los
// .55 s las filas de las listas entran desde 10 px (.5 s, power3.out, 40 ms). Lo que el INFORME no dice y se supone, anotado en el
// relevo: la línea del gasto se dibuja a los .4 s (1,1 s, power3.inOut) y las barras del costo de cada modelo crecen con su número.
//
// ⚠️ Mirando se dibuja esto; editando, la grilla con los mismos componentes (app/dashboard/EditorInforme.tsx).
// ⚠️ Lo que Orrery tiene y MaKo no mide no está (lib/contenido-diseno.ts): el estado de cada modelo y su tiempo en línea, la
//    latencia, el tope de gasto y su pronóstico, los pedidos en vivo y el código para empezar. La barra lateral y la de arriba las
//    pone la app.
// =============================================================================

import { createContext, useContext, useEffect, useId, useLayoutEffect, useRef, type KeyboardEvent, type ReactNode } from 'react';
import Link from '@/app/_ui/Link';
import type { Grafico, Hoja } from '@/lib/graficos-catalogo';
import { CELDAS, dolares, parteEnTexto, rotuloEjeDolares, rotulosDe, type Delta, type VistaContenido } from '@/lib/contenido-diseno';
import { enElPeriodo, entero } from '@/lib/marketing-diseno';
import { CSS_CONTENIDO } from './contenido-css';
import { Parte } from './parte';

const Compartido = createContext(false);

const P = {
  grid: 'M4 4h6.5v6.5H4zM13.5 4H20v6.5h-6.5zM4 13.5h6.5V20H4zM13.5 13.5H20V20h-6.5z',
  llave: 'M8 15a3.5 3.5 0 1 0 0 .01M10.5 12.5L19 4M16 7l2.5 2.5M14 9l2 2',
  sube: 'M7 17L17 7M9 7h8v8',
  baja: 'M7 7l10 10M17 9v8H9',
  aviso: 'M12 4l9 16H3zM12 10v4M12 17v.01',
  bien: 'M12 3.5a8.5 8.5 0 1 0 0 17 8.5 8.5 0 1 0 0-17M8.5 12.5l2.3 2.3 4.7-5',
} as const;
function Icono({ id }: { id: keyof typeof P }) {
  return <svg className="orr-i" viewBox="0 0 24 24" aria-hidden><path d={P[id]} /></svg>;
}

const P3 = 'cubic-bezier(.215, .61, .355, 1)', P4 = 'cubic-bezier(.165, .84, .44, 1)', P3IO = 'cubic-bezier(.645, .045, .355, 1)';
const sinMovimiento = () => typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
const anim = (n: Element | null | undefined, kf: Keyframe[], o: KeyframeAnimationOptions) => { if (n && 'animate' in n) (n as HTMLElement).animate(kf, { fill: 'backwards', ...o }); };
const eP3 = (t: number) => 1 - Math.pow(1 - t, 3);

/** Cuenta el número de un texto desde cero («US$52.00», «94%», «134»), con sus decimales, su prefijo y su sufijo. */
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
  if (useContext(Compartido)) return <span className={`${className ?? ''} orr-quieta`} aria-label={etiqueta}>{children}</span>;
  return <Link href={href} className={className} aria-label={etiqueta}>{children}</Link>;
}
function Vacio({ titulo, texto }: { titulo: string; texto?: string }) {
  return <div className="orr-vacio"><b>{titulo}</b>{texto}</div>;
}
const accionDe = (fn: (() => void) | undefined) => (fn ? { role: 'button', tabIndex: 0, onClick: fn, onKeyDown: (e: KeyboardEvent) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); fn(); } } } : {});

/** La línea chica de una tarjeta, con su área (o sin ella), y el punto del último día. */
function Linea({ valores, area = true }: { valores: number[]; area?: boolean }) {
  if (valores.length < 2) return null;
  const max = Math.max(...valores), min = Math.min(...valores), alto = 34, pad = 2;
  const y = (v: number) => (max === min ? alto / 2 : pad + (1 - (v - min) / (max - min)) * (alto - 2 * pad));
  const pts = valores.map((v, i) => [((i * 227) / (valores.length - 1)).toFixed(1), y(v).toFixed(1)]);
  const d = `M${pts.map((p) => p.join(' ')).join(' L')}`;
  return (
    <>
      <svg className="orr-spark" viewBox={`0 0 227 ${alto}`} preserveAspectRatio="none" aria-hidden>
        {area && <path className="orr-spark__a" d={`${d} L227 ${alto} L0 ${alto} Z`} />}
        <path className="orr-spark__l" d={d} />
      </svg>
      <span className="orr-spark__dot" style={{ top: `${(Number(pts[pts.length - 1][1]) / alto) * 100}%` }} />
    </>
  );
}
function Cambio({ delta }: { delta: Delta }) {
  if (!delta) return null;
  const sube = delta.texto.startsWith('+');
  return <span className={`orr-delta orr-mono ${delta.bueno ? 'orr-delta--up' : 'orr-delta--bad'}`}><Icono id={sube ? 'sube' : 'baja'} />{delta.texto}</span>;
}
/** «US$3», «US$1.7», «US$0.033»: los rótulos del eje del gasto (lib/contenido-diseno.ts). */
const rotuloEje = rotuloEjeDolares;

export function HojaContenido({ hoja, vista, titulo, periodo, onGrilla, onFila, compartido = false, quieta = false }: {
  hoja: Hoja;
  vista: VistaContenido;
  /** «Buenos días, Ana» (quién mira); sin nombre, el de la hoja. */
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
  const { frase, tarjetas, gasto, flow, modelos, funciones, quien, problemas } = vista;
  const p = hoja.diseno?.piezas ?? {};
  const pieza = (id: string | undefined) => hoja.componentes.find((c): c is Grafico => c.id === id && c.clase === 'grafico');
  const abrir = (id: string | undefined, clave: string) => { const g = pieza(id); return g && onFila && !quieta ? () => onFila(g, clave) : undefined; };
  const raiz = useRef<HTMLDivElement>(null);
  const grad = `orr-g-${useId().replace(/:/g, '')}`;
  const { costo, prom, exito, pedidos } = tarjetas;

  // ── La entrada: los títulos suben desde abajo y las tarjetas aparecen (una vez, al montarse) ─────────────────────────
  useLayoutEffect(() => {
    const el = raiz.current;
    if (!el || quieta || sinMovimiento()) return;
    el.querySelectorAll('.orr-phead h1, .orr-phead__s').forEach((n, i) => anim(n, [{ transform: 'translateY(115%)' }, { transform: 'none' }], { duration: 800, delay: i * 22, easing: P4 }));
    el.querySelectorAll('.orr-card').forEach((n, i) => anim(n, [{ opacity: 0, transform: 'translateY(32px) scale(.985)' }, { opacity: 1, transform: 'none' }], { duration: 800, delay: 100 + i * 65, easing: P3 }));
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Lo que corre la PRIMERA vez que llegan los datos (los números, las líneas, las filas, las barras) ──────────────────
  const firma = [costo.valor, prom.valor, exito.valor, pedidos.valor, gasto?.total, gasto?.puntos.length, flow?.tipos.length, modelos?.filas.map((f) => f.valor).join(','), funciones?.filas.length, quien?.filas.length].join('|');
  useEffect(() => {
    const el = raiz.current;
    if (!el || quieta || sinMovimiento()) return;
    const una = (sel: string, fn: (n: HTMLElement, i: number) => void) => el.querySelectorAll<HTMLElement>(sel).forEach((n, i) => { if (n.dataset.animado != null) return; n.dataset.animado = ''; fn(n, i); });
    una('.orr-kpi__n[data-cuenta]', (n) => contar(n, 250, 1300));
    una('.orr-sp__h b[data-cuenta]', (n) => contar(n, 250, 1200));
    una('.orr-spark', (n) => anim(n, [{ clipPath: 'inset(-4px 100% -4px -4px)' }, { clipPath: 'inset(-4px -4px -4px -4px)' }], { duration: 1100, delay: 450, easing: P3IO }));
    una('.orr-plot__line', (n) => anim(n, [{ strokeDashoffset: '1' }, { strokeDashoffset: '0' }], { duration: 1100, delay: 400, easing: P3IO }));
    una('.orr-sp__bar i, .orr-budget i', (n) => anim(n, [{ transform: 'scaleX(0)' }, { transform: 'none' }], { duration: 1200, delay: 250, easing: P3 }));
    una('.orr-models > li, .orr-rq > li', (n, i) => anim(n, [{ opacity: 0, transform: 'translateY(10px)' }, { opacity: 1, transform: 'none' }], { duration: 500, delay: 550 + i * 40, easing: P3 }));
  }, [firma, quieta]);

  const marcas = gasto?.marcas ?? [];
  const W = 650, H = 333, n = gasto?.puntos.length ?? 0;
  const px = (i: number) => (n > 1 ? (i * W) / (n - 1) : W / 2);
  const py = (v: number) => (gasto ? H - (v / gasto.tope) * H : H);
  const linea = gasto && n ? `M${gasto.puntos.map((q, i) => `${px(i).toFixed(1)} ${py(q.valor).toFixed(1)}`).join(' L')}` : '';
  const ult = gasto && n ? gasto.puntos[n - 1] : null;
  // El eje de abajo: seis rótulos en la computadora y cuatro en el teléfono (como la copia), cada juego repartido parejo; los que son
  // de uno solo llevan su clase y el otro los esconde.
  const ejeEsc = new Set(gasto?.rotulos.map((r) => r.i) ?? []), ejeTel = new Set(rotulosDe(n, 4));
  const eje = [...new Set([...ejeEsc, ...ejeTel])].sort((a, b) => a - b);

  return (
    <Compartido.Provider value={compartido}>
    <div className="orr" ref={raiz} data-quieta={quieta ? '' : undefined}>
      <style href="dash-hoja-contenido" precedence="medium">{CSS_CONTENIDO}</style>
      <main className="orr-main">
        {/* LA CABECERA: el período (en lugar de «Production · us-east»), el saludo y la frase del uso de la IA. En lugar de «Open
            Playground» y «Create key», la grilla y tus cuentas de IA. */}
        <Parte id="cabecera">
        <div className="orr-phead">
          <div>
            <p className="orr-phead__k">{periodo}</p>
            <h1>{titulo}</h1>
            {frase.length > 0 && <p className="orr-phead__s">{frase.map((t, i) => (t.tipo === 'fuerte' ? <b key={i} className="orr-mono">{t.s}</b> : <span key={i}>{t.s}</span>))}</p>}
            {problemas.frase && <p className="orr-phead__s">{problemas.frase}</p>}
          </div>
          <div className="orr-phead__acts">
            {onGrilla && <button type="button" className="orr-btn orr-btn--ghost" onClick={onGrilla}><Icono id="grid" />Ver la grilla</button>}
            {!compartido && <Ir href="/integraciones?abrir=ia" className="orr-btn orr-btn--acc" etiqueta="Tus cuentas de IA"><Icono id="llave" />Tus cuentas de IA</Ir>}
          </div>
        </div>
        </Parte>

        {/* LAS CUATRO TARJETAS: el costo de la IA, el costo por llamada, qué parte de lo pedido a Flow salió bien y los pedidos. */}
        <div className="orr-kpis">
          <Parte id="costo">
          <article className="orr-card orr-kpi">
            <h3 className="orr-kpi__t">Costo de la IA</h3>
            <p className="orr-kpi__n orr-mono" key={costo.valor ?? '—'} data-cuenta="">{costo.valor ?? '—'}</p>
            <p className="orr-kpi__d"><Cambio delta={costo.delta} /><span>{costo.delta ? 'contra el período anterior' : problemas.tarjetas ?? 'en este período'}</span></p>
            <div className="orr-kpi__s"><Linea valores={costo.linea} /></div>
          </article>
          </Parte>
          <Parte id="llamada">
          <article className="orr-card orr-kpi">
            <h3 className="orr-kpi__t">Costo por llamada</h3>
            <p className="orr-kpi__n orr-mono" key={prom.valor ?? '—'} data-cuenta="">{prom.valor ?? '—'}</p>
            <p className="orr-kpi__d"><Cambio delta={prom.delta} /><span>{prom.delta ? 'contra el período anterior' : 'en promedio'}</span></p>
            <div className="orr-kpi__s"><Linea valores={prom.linea} /></div>
          </article>
          </Parte>
          <Parte id="bien">
          <article className="orr-card orr-kpi">
            <h3 className="orr-kpi__t">Salieron bien</h3>
            <p className="orr-kpi__n orr-mono" key={exito.valor ?? '—'} data-cuenta="">{exito.valor ?? '—'}</p>
            <span className="orr-budget"><i style={{ width: `${(exito.barra * 100).toFixed(1)}%` }} /></span>
            <p className="orr-kpi__f">
              <span>{exito.pedidos ? `${entero(exito.listos ?? 0)} de ${entero(exito.pedidos)} pedidos` : exito.pedidos === 0 ? 'Sin pedidos a Flow' : ' '}</span>
              {exito.fallidos ? <span>{entero(exito.fallidos)} {exito.fallidos === 1 ? 'falló' : 'fallaron'}</span> : null}
            </p>
          </article>
          </Parte>
          <Parte id="pedidos">
          <article className="orr-card orr-kpi">
            <h3 className="orr-kpi__t">Pedidos a Flow</h3>
            <p className="orr-kpi__n orr-mono" key={pedidos.valor ?? '—'} data-cuenta="">{pedidos.valor ?? '—'}</p>
            <p className="orr-kpi__d">
              {pedidos.fallidos ? <span className="orr-delta orr-delta--bad orr-mono"><Icono id="aviso" />{entero(pedidos.fallidos)}</span>
                : pedidos.fallidos === 0 && pedidos.valor ? <span className="orr-delta orr-delta--up orr-mono"><Icono id="bien" />0</span> : null}
            </p>
            <p className="orr-kpi__e">{pedidos.fallidos ? `${pedidos.fallidos === 1 ? 'falló' : 'fallaron'}, de lo que MaKo le pidió` : 'Lo que MaKo le pidió a Flow'}</p>
            <div className="orr-kpi__s orr-kpi__s--line"><Linea valores={pedidos.linea} area={false} /></div>
          </article>
          </Parte>
        </div>

        <div className="orr-row1">
          {/* LO GASTADO POR DÍA («Requests per hour»): el área del costo de cada día del período. */}
          <Parte id="gasto">
          <article className="orr-card orr-chart">
            <div className="orr-card__h">
              <div><h2 className="orr-card__t">Lo gastado por día</h2><p className="orr-card__s">{gasto ? `${dolares(gasto.total)} ${enElPeriodo(periodo)}` : ' '}</p></div>
              <span className="orr-live"><i />{gasto?.paso === 'mes' ? 'Por mes' : gasto?.paso === 'semana' ? 'Por semana' : 'Por día'}</span>
            </div>
            {problemas.gasto ? <Vacio titulo={problemas.gasto} /> : !gasto || !n || !gasto.total ? (
              <Vacio titulo="No hubo gasto de IA en este período" />
            ) : (
              <div className="orr-plot">
                <div className="orr-plot__y">{marcas.map((m, i) => <span key={i}>{rotuloEje(m)}</span>)}</div>
                <svg className="orr-plot__svg" viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" aria-hidden>
                  <defs><linearGradient id={grad} x1="0" y1="0" x2="0" y2="1"><stop offset="0" style={{ stopColor: 'var(--accent)' }} stopOpacity=".14" /><stop offset="1" style={{ stopColor: 'var(--accent)' }} stopOpacity=".02" /></linearGradient></defs>
                  <path className="orr-plot__grid" d={`M0 0.5H${W}M0 111.5H${W}M0 222.5H${W}M0 332.5H${W}`} />
                  <path d={`${linea} L${px(n - 1).toFixed(1)} ${H} L${px(0).toFixed(1)} ${H} Z`} fill={`url(#${grad})`} />
                  <path className="orr-plot__line" d={linea} pathLength={1} strokeDasharray="1" />
                </svg>
                {ult && <span className="orr-plot__dot" style={{ left: `${(px(n - 1) / W) * 100}%`, top: `${(py(ult.valor) / H) * 100}%` }} title={`${ult.rotulo}: ${dolares(ult.valor)}`} />}
                <div className="orr-plot__x">{eje.map((i) => (
                  <i key={i} className={`orr-x${ejeTel.has(i) ? '' : ' orr-x--fuera'}${ejeEsc.has(i) ? '' : ' orr-x--tel'}`} style={i === 0 ? { left: 0 } : i === n - 1 ? { left: 'auto', right: 0 } : { left: `${(i / (n - 1)) * 100}%`, transform: 'translateX(-50%)' }}>{gasto.puntos[i].rotulo}</i>
                ))}</div>
              </div>
            )}
          </article>
          </Parte>

          {/* VIDEOS E IMÁGENES («Model status»): cada tipo de pedido a Flow con la franja de lo que salió bien y lo que falló. */}
          <Parte id="flow">
          <article className="orr-card orr-status">
            <div className="orr-card__h">
              <div><h2 className="orr-card__t">Videos e imágenes</h2><p className="orr-card__s">De cada 30 pedidos, los que fallaron</p></div>
              {!compartido && <Ir href="/video-generator" className="orr-lnk" etiqueta="Ver los videos">Videos</Ir>}
            </div>
            {problemas.flow ? <Vacio titulo={problemas.flow} /> : !flow || !flow.tipos.length ? (
              <Vacio titulo="MaKo no le pidió nada a Flow" texto="Cuando pidas un video o una imagen, aparece aquí." />
            ) : (
              <ul className="orr-models">
                {flow.tipos.map((t, i) => (
                  <li key={t.clave} {...accionDe(abrir(p.flow, t.clave))}>
                    <div className="orr-m__h">
                      <span className="orr-m__n"><i className={`orr-dot orr-dot--${(i % 4) + 1}`} />{t.nombre}</span>
                      <span className={`orr-st ${t.bien ? 'orr-st--ok' : 'orr-st--warn'}`}><Icono id={t.bien ? 'bien' : 'aviso'} />{t.bien ? 'Bien' : 'Con fallas'}</span>
                    </div>
                    <span className="orr-up">{Array.from({ length: CELDAS }, (_, k) => <i key={k} className={t.malas.includes(k) ? 'orr-bad' : undefined} />)}</span>
                    <div className="orr-m__f"><span>{entero(t.listos)} de {entero(t.pedidos)} salieron bien</span><span>{t.tasa == null ? '' : <>tasa <b className="orr-mono">{Math.round(t.tasa)}%</b></>}</span></div>
                  </li>
                ))}
              </ul>
            )}
          </article>
          </Parte>
        </div>

        <div className="orr-row2">
          {/* QUÉ MODELO CUESTA MÁS («Spend by model»): el costo de cada modelo y su parte del total. */}
          <Parte id="modelos">
          <article className="orr-card orr-spend">
            <div className="orr-card__h">
              <div><h2 className="orr-card__t">Qué modelo cuesta más</h2><p className="orr-card__s">Lo gastado en este período</p></div>
              {!compartido && <Ir href="/modelos-ia" className="orr-lnk" etiqueta="Ver los modelos">Modelos</Ir>}
            </div>
            {problemas.modelos ? <Vacio titulo={problemas.modelos} /> : !modelos || !modelos.filas.length ? <Vacio titulo="Todavía no hay gasto de IA" /> : (
              <ul className="orr-sp">
                {modelos.filas.map((f) => (
                  <li key={f.clave} {...accionDe(abrir(p.modelos, f.clave))}>
                    <div className="orr-sp__h"><span className="orr-m__n"><i className={`orr-dot orr-dot--${f.tono}`} />{f.nombre}</span><b className="orr-mono" key={f.valor} data-cuenta="">{dolares(f.valor)}</b></div>
                    <span className="orr-sp__bar"><i className={`orr-bg--${f.tono}`} style={{ width: `${Math.max(0, Math.min(100, f.parte ?? 0)).toFixed(1)}%` }} /></span>
                    <span className="orr-sp__p">{f.parte == null ? ' ' : `${parteEnTexto(f.parte)} del costo`}{modelos.mas > 0 && f === modelos.filas[modelos.filas.length - 1] ? ` · y ${entero(modelos.mas)} más` : ''}</span>
                  </li>
                ))}
              </ul>
            )}
          </article>
          </Parte>

          {/* PARA QUÉ SE USA («Recent requests»): las llamadas de cada función de MaKo, con su parte. */}
          <Parte id="funciones">
          <article className="orr-card orr-recent">
            <div className="orr-card__h"><div><h2 className="orr-card__t">Para qué se usa</h2><p className="orr-card__s">Las llamadas de cada función</p></div></div>
            {problemas.funciones ? <Vacio titulo={problemas.funciones} /> : !funciones || !funciones.filas.length ? <Vacio titulo="No usaste la IA en este período" /> : (
              <ul className="orr-rq">
                {funciones.filas.map((f) => (
                  <li key={f.clave} {...accionDe(abrir(p.funciones, f.clave))}>
                    <span className="orr-mono orr-rq__t">{entero(f.valor)}</span>
                    <span className="orr-code200 orr-mono">{parteEnTexto(f.parte) ?? '—'}</span>
                    <span className="orr-m__n orr-rq__m"><i className={`orr-dot orr-dot--${f.tono}`} /><span className="orr-rq__nom">{f.nombre}</span></span>
                  </li>
                ))}
              </ul>
            )}
          </article>
          </Parte>

          {/* QUIÉN LE ESCRIBE A MaKo («Quickstart»): los mensajes de cada persona, en el recuadro gris. */}
          <Parte id="quien">
          <article className="orr-card orr-quick">
            <div className="orr-card__h"><div><h2 className="orr-card__t">Quién le escribe a MaKo</h2><p className="orr-card__s">Los mensajes de cada persona</p></div></div>
            {problemas.quien ? <Vacio titulo={problemas.quien} /> : !quien || !quien.filas.length ? <Vacio titulo="Nadie le escribió a MaKo en este período" /> : (
              <div className="orr-code">
                <pre className="orr-mono">
                  <span className="orr-c-com orr-c-l"># mensajes a MaKo, {periodo.toLowerCase()}</span>
                  {quien.filas.map((f) => (
                    <span key={f.clave} className="orr-c-fila" {...accionDe(abrir(p.quien, f.clave))}><span className="orr-c-nom">{f.nombre}</span><span className="orr-c-str">{entero(f.valor)}</span></span>
                  ))}
                  {quien.mas > 0 && <span className="orr-c-com orr-c-l"># y {entero(quien.mas)} más</span>}
                </pre>
              </div>
            )}
          </article>
          </Parte>
        </div>
      </main>
    </div>
    </Compartido.Provider>
  );
}
