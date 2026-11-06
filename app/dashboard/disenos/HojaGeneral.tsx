'use client';

// =============================================================================
// HojaGeneral — la hoja General con su DISEÑO PROPIO: la copia de Orvel, con lo que MaKo sabe del negocio
// =============================================================================
// Martín, 4/11/2026: «que sea primero la copia, es decir, que se vea exactamente igual que la copia, y después la adaptación
// con Maco» y «Después seguí con la segunda hoja, de a una». La copia y la adaptación (maquetas) están en
// docs/diseno/mockups-dashboard/general-orvel/; ésta es la adaptación con los datos de verdad, que llegan ya armados
// (`VistaGeneral`, lib/general-diseno.ts, con test) desde ./GeneralVivo.tsx o, para la miniatura de «Nueva hoja», de ejemplo.
//
// Lo que Orvel tiene y MaKo no hace NO está (lo dice lib/general-diseno.ts): el sobre para recordarle a un cliente que pague
// (un mensaje a un tercero sale por sus puertas), «Move money» y la barra de «lo mismo el mes pasado» de cada etapa.
//
// El movimiento: el INFORME de Orvel trae la entrada del ARMAZÓN (la barra lateral y la de arriba, que en MaKo pone la app) y
// los hover del CSS; la entrada de la página «Overview» vive en un chunk que el INFORME no muestra. No se inventa: las
// tarjetas quedan quietas y los hover son los del CSS (./general-css.ts). El 6M · 12M cambia los meses del gráfico.
//
// ⚠️ La hoja de estilos (./general-css.ts) es SÓLO de esta hoja.
// ⚠️ Mirando se dibuja esto; editando, la grilla con los bloques de siempre (app/dashboard/EditorInforme.tsx).
// =============================================================================

import { createContext, useContext, useId, useLayoutEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import Link from '@/app/_ui/Link';
import { plata, plataCorta } from '@/lib/cobranza-diseno';
import { escalaGeneral, type MesGeneral, type Necesita, type VistaGeneral } from '@/lib/general-diseno';
import { CSS_GENERAL } from './general-css';
import { Parte } from './parte';

const Compartido = createContext(false);

const P = {
  wallet: 'M4 6h16v13H4zM4 9h16M15 14h2',
  bars: 'M5 19v-6M10 19V9M15 19v-9M20 19v-4',
  bell: 'M6.5 10a5.5 5.5 0 0 1 11 0c0 5 2 6.5 2 6.5h-15s2-1.5 2-6.5M10 19.5a2.2 2.2 0 0 0 4 0',
  contact: 'M5 4h14v16H5zM12 7.5a2.5 2.5 0 1 0 0 5a2.5 2.5 0 1 0 0-5M8.5 16c.8-1.8 2-2.5 3.5-2.5s2.7.7 3.5 2.5',
  cal: 'M4 5.5h16v14H4zM4 10h16M8 3.5v4M16 3.5v4',
  warn: 'M12 4l9 16H3zM12 10v4M12 17h.01',
  doc: 'M7 4h7l4 4v12H7zM10 12h5M10 15h5M10 9h2',
  layers: 'M12 4l8 4-8 4-8-4zM4 12l8 4 8-4M4 16l8 4 8-4',
  phone: 'M6.5 4h3l1.5 4-2 1.2a10 10 0 0 0 4.8 4.8L15 12l4 1.5v3A2 2 0 0 1 17 18.5C10.6 18.2 5.8 13.4 5.5 7A2 2 0 0 1 6.5 4z',
  check: 'M5 12.5l4 4 10-10',
  chev: 'M10 6l6 6-6 6',
  up: 'M7 17L17 7M9 7h8v8',
  down: 'M7 7l10 10M17 9v8H9',
  flag: 'M6 20V4M6 4h11l-2 4 2 4H6',
  grid: 'M4 5h16v14H4zM4 10h16M9.5 10v9M14.5 10v9',
} as const;
function Icono({ id, className = 'gv-i', style }: { id: keyof typeof P; className?: string; style?: CSSProperties }) {
  return <svg className={className} style={style} viewBox="0 0 24 24" aria-hidden><path d={P[id]} /></svg>;
}

/** Un link de la app, o un texto si la hoja está compartida (un link compartido no tiene sesión) o no hay a dónde ir. */
function Ir({ href, className, style, children, label }: { href: string | null; className?: string; style?: CSSProperties; children: ReactNode; label?: string }) {
  const compartido = useContext(Compartido);
  if (!href || compartido) return <span className={className} style={style}>{children}</span>;
  return <Link href={href} className={className} style={style} aria-label={label}>{children}</Link>;
}

const iniciales = (s: string) => [...s.trim().split(/\s+/).slice(0, 2).map((p) => [...p][0] ?? '')].join('').toUpperCase() || '·';
const mayuscula = (s: string) => (s ? s[0].toLocaleUpperCase('es') + s.slice(1) : s);
const baja = (c: string | null) => !!c && c.startsWith('−');
/** La plata corta de Orvel, con la «k» minúscula: «US$20k», «US$31.5k». */
const corta = (n: number) => plataCorta(n).replace(/K$/, 'k');
const ICONO_NECESITA: Record<Necesita['id'], keyof typeof P> = { cuotas: 'wallet', leads: 'contact', tareas: 'cal', alertas: 'warn' };
const COLOR_RENGLON = { cobrado: 'var(--in)', inversion: 'var(--clay)', agendas: 'var(--sky)', cierres: 'var(--violet)' } as const;
/** Los tramos de «Te deben», con los colores de Orvel («Not due» cielo, lo atrasado en azafrán y rojo). */
const COLOR_TRAMO: Record<string, string> = { 'Al día': 'var(--sky)', '1-30 días': 'var(--saffron)', '31-60 días': 'var(--clay)', '60+ días': 'var(--bad)' };
const URGENCIA = { vencida: 'var(--rose)', pronto: 'var(--saffron)', nada: 'var(--sky)' } as const;
const ETAPAS = ['var(--sky)', 'var(--saffron)', 'var(--violet)', 'var(--clay)', 'var(--in)', 'var(--teal)'];
const SALUD = { rojo: { c: 'var(--rose)', i: 'warn' }, ambar: { c: 'var(--saffron)', i: 'warn' }, verde: { c: 'var(--in)', i: 'check' } } as const;

// ── «Lo que entró y lo que invertiste»: las dos curvas de Orvel (lo cobrado con su relleno; la inversión, sólo la línea) ──
const curva = (pts: Array<[number, number]>) => {
  let d = `M${pts[0][0]},${pts[0][1]}`;
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[i - 1] ?? pts[i], p1 = pts[i], p2 = pts[i + 1], p3 = pts[i + 2] ?? p2;
    const c1 = [p1[0] + (p2[0] - p0[0]) / 6, p1[1] + (p2[1] - p0[1]) / 6], c2 = [p2[0] - (p3[0] - p1[0]) / 6, p2[1] - (p3[1] - p1[1]) / 6];
    d += ` C${c1[0].toFixed(1)},${c1[1].toFixed(1)} ${c2[0].toFixed(1)},${c2[1].toFixed(1)} ${p2[0]},${p2[1]}`;
  }
  return d;
};

function Grafico({ meses }: { meses: MesGeneral[] }) {
  const caja = useRef<HTMLDivElement>(null);
  const [tam, setTam] = useState<{ w: number; h: number } | null>(null);
  const grad = `gv-in-${useId().replace(/[^a-zA-Z0-9]/g, '')}`;
  useLayoutEffect(() => {
    const el = caja.current;
    if (!el) return;
    const medir = () => setTam({ w: el.clientWidth, h: el.clientHeight });
    medir();
    const ro = new ResizeObserver(medir);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  const { tope, paso } = escalaGeneral(meses);
  let dibujo: ReactNode = null;
  if (tam && tam.w > 0 && meses.length > 1) {
    // Medido en la captura de Orvel: el primer punto cae 35 px adentro (44 en el teléfono), el último 27 px antes del borde
    // (12); el tope a 10 px del techo y el cero a 27 px del piso (las etiquetas del eje, 6 px arriba del piso).
    // Con plata de verdad la etiqueta del eje puede ser más ancha que la de Orvel: el primer punto cae, como mínimo, a su derecha.
    const ancho = Math.max(...[tope, paso, 0].map((v) => corta(v).length)) * 7.4 + 8;
    const { w: W, h: H } = tam, angosto = W < 520, izq = Math.max(angosto ? 44 : 35, ancho), der = angosto ? 12 : 27, arriba = 10, abajo = 27;
    const y = (v: number) => arriba + (H - arriba - abajo) * (1 - v / tope);
    const x = (i: number) => izq + (W - izq - der) * (i / (meses.length - 1));
    // Una etiqueta cada dos meses en la computadora y cada tres en el teléfono (las de Orvel); con seis meses, todas.
    const cada = meses.length <= 7 ? 1 : angosto ? 3 : 2;
    const pin = meses.map((m, i) => [+x(i).toFixed(1), +y(m.cobrado).toFixed(1)] as [number, number]);
    const pout = meses.map((m, i) => [+x(i).toFixed(1), +y(m.gasto).toFixed(1)] as [number, number]);
    const lin = curva(pin);
    dibujo = (
      <>
        <defs>
          <linearGradient id={grad} x1={0} x2={0} y1={0} y2={1}>
            <stop offset={0} style={{ stopColor: 'var(--in)' }} stopOpacity={0.22} /><stop offset={1} style={{ stopColor: 'var(--in)' }} stopOpacity={0.02} />
          </linearGradient>
        </defs>
        {[tope, paso, 0].map((v, i) => {
          const yy = arriba + (H - arriba - abajo) * (i / 2);
          return (
            <g key={i}>
              <line className="gv-gl" x1={izq - 2} x2={W} y1={yy} y2={yy} />
              <text x={0} y={yy + 4.5}>{corta(v)}</text>
            </g>
          );
        })}
        {meses.map((m, i) => (i % cada ? null : (
          <text key={m.clave} x={x(i)} y={H - 6} textAnchor={i === 0 ? 'start' : i === meses.length - 1 ? 'end' : 'middle'}>{m.corto}</text>
        )))}
        <path d={`${lin} L${pin[pin.length - 1][0]},${y(0)} L${pin[0][0]},${y(0)} Z`} fill={`url(#${grad})`} />
        <path d={curva(pout)} fill="none" style={{ stroke: 'var(--slate)' }} strokeWidth={2} strokeLinecap="round" />
        <path d={lin} fill="none" style={{ stroke: 'var(--in)' }} strokeWidth={2.2} strokeLinecap="round" />
      </>
    );
  }
  return (
    <div className="gv-chart" ref={caja} role="img" aria-label="Lo cobrado y la inversión en anuncios, mes a mes">
      <svg aria-hidden>{dibujo}</svg>
    </div>
  );
}

/** «↑ 32% contra el mismo período de octubre». */
const contra = (c: string | null, etiqueta: string) => (c ? `${baja(c) ? '↓' : '↑'} ${c.replace(/^[+−]/, '')} contra el ${etiqueta}` : `Sin el ${etiqueta} para comparar`);

export function HojaGeneral({ vista, titulo, fecha, onGrilla, compartido = false, quieta = false }: {
  vista: VistaGeneral;
  /** «Buenos días, Ana» (las variables de General); sin nombre, el de la hoja. */
  titulo: string;
  /** «miércoles 4 de noviembre» (la variable de General): null = no llegó. */
  fecha: string | null;
  onGrilla?: () => void;
  compartido?: boolean;
  /** La miniatura de «Nueva hoja». */
  quieta?: boolean;
}) {
  const [doce, setDoce] = useState(true);
  const { frase, mes, meta, flujo, meses, necesita, vence, deben, funnel, llamadas, salud } = vista;
  const mesesVistos = meses ? (doce ? meses : meses.slice(-6)) : null;
  const sinMeses = !mesesVistos || mesesVistos.every((m) => !m.cobrado && !m.gasto);
  const maxEtapa = funnel ? Math.max(1, ...funnel.etapas.map((e) => e.n)) : 1;
  const tramos = deben?.tramos?.filter((t) => t.monto > 0) ?? [];
  const quedo = flujo ? flujo.cobrado - flujo.inversion : null;

  return (
    <Compartido.Provider value={compartido}>
    <div className="gv" data-quieta={quieta ? '' : undefined}>
      <style href="dash-hoja-general" precedence="medium">{CSS_GENERAL}</style>
      {/* La letra de Orvel (Manrope, y Geist Mono para las cifras chicas), sólo para esta hoja. */}
      <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Manrope:wght@400..800&family=Geist+Mono:wght@400..600&display=swap" precedence="default" />
      <div className="gv-page">
        {/* LA CABECERA: la fecha, el saludo y la frase del mes, con dos botones. */}
        <Parte id="cabecera">
        <div className="gv-head">
          <div>
            {fecha && <p className="gv-head__date">{mayuscula(fecha)}</p>}
            <h1 className="gv-head__title">{titulo}</h1>
            <p className="gv-head__sum">
              {frase.map((t, i) => (t.tipo === 'cifra' ? <span key={i} className="gv-in">{t.s}</span> : t.tipo === 'link' ? <Ir key={i} href={t.href}>{t.s}</Ir> : <span key={i}>{t.s}</span>))}
            </p>
          </div>
          <div className="gv-head__acts">
            {onGrilla && <button type="button" className="gv-ibtn" onClick={onGrilla} aria-label="Ver todo en la grilla" title="Ver todo en la grilla"><Icono id="grid" /></button>}
            <Ir href="/plan" className="gv-btn gv-btn--ghost"><Icono id="cal" />Abrir el Plan</Ir>
            <Ir href="/crm" className="gv-btn gv-btn--primary"><Icono id="contact" />Abrir el CRM</Ir>
          </div>
        </div>
        </Parte>

        <div className="gv-grid gv-row1">
          {/* ESTE MES (el «Cash» de Orvel): lo cobrado contra el mismo período del mes pasado, la barra contra la proyección,
              los cuatro números del mes y la meta del trimestre. */}
          <Parte id="mes">
          <section className="gv-card gv-cash" data-card="">
            <div className="gv-card__h"><span className="gv-card__ic"><Icono id="wallet" /></span><h2 className="gv-card__t">Este mes</h2><Ir href="/crm" className="gv-link">Ver los cobros<Icono id="chev" /></Ir></div>
            {mes == null ? <p className="gv-vacio">No pude comparar el mes.</p> : (
              <>
                <p className="gv-cash__v">{plata(mes.cobrado)}</p>
                <p className="gv-cash__d">
                  <span className={`gv-delta${mes.delta < 0 ? ' gv-delta--baja' : ''}`}><Icono id={mes.delta < 0 ? 'down' : 'up'} />{plata(mes.delta).replace(/^(?!−)/, '+')}</span>
                  contra el {mes.etiquetaAnterior}
                </p>
                <div className="gv-split" title={mes.proyeccion ? `Proyección al cierre: ${plata(mes.proyeccion)}` : undefined}>
                  <i style={{ ['--c' as string]: 'var(--in)', flex: Math.max(mes.cobrado, 0.0001) }} />
                  {mes.proyeccion != null && mes.proyeccion > mes.cobrado && <i style={{ ['--c' as string]: 'var(--line-2)', flex: mes.proyeccion - mes.cobrado }} />}
                </div>
                <ul className="gv-acc">
                  {mes.renglones.map((r) => (
                    <li key={r.id}>
                      <i style={{ ['--c' as string]: COLOR_RENGLON[r.id] }} />
                      <span style={{ justifySelf: 'start', minWidth: 0 }}><b>{r.nombre}</b><small>{r.detalle}</small></span>
                      <em>{r.valor}</em>
                      <span>{r.cambio ?? '—'}</span>
                    </li>
                  ))}
                </ul>
              </>
            )}
            {meta && (
              <div className="gv-cover2">
                <div className="gv-cover2__r"><Icono id="flag" />La meta del trimestre<b>{meta.pct == null ? '—' : `${meta.pct}%`}</b></div>
                <div className="gv-meter"><i style={{ width: `${Math.max(0, Math.min(100, meta.pct ?? 0))}%` }} /></div>
                <p>
                  {meta.titulo}. A esta altura tendrías que ir por el {meta.esperado}%
                  {meta.atrasado == null ? '' : meta.atrasado ? ': vas atrasado' : ': vas a tiempo'}
                  {meta.diasRestantes > 0 ? `, y ${meta.diasRestantes === 1 ? 'falta 1 día' : `faltan ${meta.diasRestantes} días`}.` : '.'}
                </p>
              </div>
            )}
          </section>
          </Parte>

          {/* LO QUE ENTRÓ Y LO QUE INVERTISTE («Money in and out»): las dos líneas mes a mes (6M · 12M: MaKo guarda el mes). */}
          <Parte id="flujo">
          <section className="gv-card gv-flow" data-card="">
            <div className="gv-card__h">
              <span className="gv-card__ic"><Icono id="bars" /></span><h2 className="gv-card__t">Lo que entró y lo que invertiste</h2>
              <div className="gv-seg">
                <button type="button" aria-pressed={!doce} onClick={() => setDoce(false)}>6M</button>
                <button type="button" aria-pressed={doce} onClick={() => setDoce(true)}>12M</button>
              </div>
            </div>
            {flujo == null ? <p className="gv-vacio">No pude leer lo cobrado ni la inversión de este mes.</p> : (
              <div className="gv-flow__k">
                <div><p><i style={{ ['--c' as string]: 'var(--in)' }} />Cobrado este mes</p><b className="gv-in">{plata(flujo.cobrado)}</b><small>{contra(flujo.cambioCobrado, flujo.etiquetaAnterior)}</small></div>
                <div><p><i style={{ ['--c' as string]: 'var(--out)' }} />Inversión este mes</p><b>{plata(flujo.inversion)}</b><small>{contra(flujo.cambioInversion, flujo.etiquetaAnterior)}</small></div>
                <div><p>Te quedó</p><b className={quedo != null && quedo >= 0 ? 'gv-in' : undefined}>{quedo == null ? '—' : plata(quedo).replace(/^(?!−)/, '+')}</b><small>Lo cobrado menos los anuncios</small></div>
              </div>
            )}
            {meses == null ? <p className="gv-vacio">No pude leer los meses.</p>
              : sinMeses ? <p className="gv-vacio">Todavía no hay cobros ni inversión para dibujar.</p>
              : <Grafico meses={mesesVistos!} />}
          </section>
          </Parte>
        </div>

        <div className="gv-grid gv-row3">
          {/* TE NECESITA («Needs you»): las cuotas vencidas, los leads por marcar, las tareas vencidas y las alertas en rojo. */}
          <Parte id="necesita">
          <section className="gv-card gv-needs" data-card="">
            <div className="gv-card__h"><span className="gv-card__ic"><Icono id="bell" /></span><h2 className="gv-card__t">Te necesita</h2></div>
            {necesita == null ? <p className="gv-vacio">No pude leer lo que te está esperando.</p>
              : !necesita.length ? <p className="gv-vacio">Nada te está esperando ahora.</p>
              : (
                <div className="gv-needs__l">
                  {necesita.map((n) => (
                    <Ir key={n.id} href={n.href}>
                      <span className="gv-tile"><Icono id={ICONO_NECESITA[n.id]} /></span>
                      <span style={{ minWidth: 0 }}><b>{n.titulo}</b><small>{n.detalle}</small></span>
                      <span className="gv-count">{n.n}</span>
                      <Icono id="chev" className="gv-i gv-chev" />
                    </Ir>
                  ))}
                </div>
              )}
          </section>
          </Parte>

          {/* LO QUE VENCE («Next 3 weeks»): las tareas y los proyectos del Plan, por fecha. */}
          <Parte id="vence">
          <section className="gv-card gv-up" data-card="">
            <div className="gv-card__h"><span className="gv-card__ic"><Icono id="cal" /></span><h2 className="gv-card__t">Lo que vence</h2><Ir href="/plan" className="gv-link">El Plan<Icono id="chev" /></Ir></div>
            {vence == null ? <p className="gv-vacio">No pude leer tu Plan.</p>
              : !vence.total ? <p className="gv-vacio">No tienes nada que venza en las próximas 3 semanas.</p>
              : (
                <>
                  <p className="gv-up__sum">
                    <b>{vence.total}</b> {vence.total === 1 ? 'cosa vence' : 'cosas vencen'} en las próximas 3 semanas
                    {vence.vencidas ? ` · ${vence.vencidas === 1 ? '1 ya está vencida' : `${vence.vencidas} ya están vencidas`}` : ''}
                  </p>
                  <ul className="gv-up__l">
                    {vence.lista.map((v) => (
                      <li key={v.id}>
                        <span className="gv-date"><b>{v.dia}</b><small>{v.mes}</small></span>
                        <span style={{ minWidth: 0 }}><strong><Ir href={v.href}>{v.titulo}</Ir></strong><span>{v.detalle}</span></span>
                        <span className="gv-amt">{v.que}<small className={v.vencida ? 'gv-warn' : undefined}>{v.cuando}</small></span>
                      </li>
                    ))}
                  </ul>
                  {vence.total > vence.lista.length && <Ir href="/plan" className="gv-more">{vence.total - vence.lista.length} más<Icono id="chev" /></Ir>}
                </>
              )}
          </section>
          </Parte>

          {/* TE DEBEN («Owed to you»): lo que falta cobrar por tramo de atraso, y las tres cuotas más urgentes. */}
          <Parte id="deben">
          <section className="gv-card gv-owed" data-card="">
            <div className="gv-card__h"><span className="gv-card__ic"><Icono id="doc" /></span><h2 className="gv-card__t">Te deben</h2><Ir href="/crm" className="gv-link">Las cuotas<Icono id="chev" /></Ir></div>
            {deben == null ? <p className="gv-vacio">No pude leer lo que te deben.</p> : (
              <>
                {deben.total != null && <p className="gv-owed__v">{plata(deben.total)}</p>}
                {tramos.length > 0 && (
                  <>
                    <div className="gv-bars">{tramos.map((t) => <i key={t.nombre} style={{ ['--c' as string]: COLOR_TRAMO[t.nombre], flex: t.monto }} />)}</div>
                    <div className="gv-leg">{tramos.map((t) => <span key={t.nombre}><i style={{ ['--c' as string]: COLOR_TRAMO[t.nombre] }} />{t.nombre} {corta(t.monto)}</span>)}</div>
                  </>
                )}
                {deben.cuotas == null ? <p className="gv-vacio">No pude leer las cuotas.</p>
                  : !deben.cuotas.length ? <p className="gv-vacio">Nadie te debe una cuota ahora.</p>
                  : (
                    <ul className="gv-rows">
                      {deben.cuotas.map((c) => {
                        const [monto, ...resto] = c.linea.split(' · ');
                        return (
                          <li key={`${c.leadId}:${c.pagoId ?? 'mensual'}`}>
                            <Ir href={`/crm/${c.leadId}?tab=pagos`} className="gv-fila">
                              <span className="gv-av" style={{ ['--c' as string]: URGENCIA[c.urgencia ?? 'nada'] }}>{iniciales(c.nombre)}</span>
                              <span style={{ minWidth: 0 }}><strong>{c.nombre}</strong>
                                <span className="gv-s">{monto}{resto.length > 0 && <> · <span className={c.urgencia === 'vencida' ? 'gv-late' : undefined} style={{ display: 'inline' }}>{resto.join(' · ')}</span></>}</span>
                              </span>
                              <em />
                              <Icono id="chev" className="gv-i gv-chev" />
                            </Ir>
                          </li>
                        );
                      })}
                    </ul>
                  )}
              </>
            )}
          </section>
          </Parte>
        </div>

        <div className="gv-grid gv-row3">
          {/* TU FUNNEL HOY («Where it went»): cada etapa del funnel principal con su barra. */}
          <Parte id="funnel">
          <section className="gv-card gv-spend" data-card="">
            <div className="gv-card__h"><span className="gv-card__ic"><Icono id="layers" /></span><h2 className="gv-card__t">Tu funnel hoy</h2>{funnel && <span className="gv-card__s" title={funnel.nombre}>{funnel.nombre}</span>}</div>
            {funnel == null ? <p className="gv-vacio">No pude contar tu funnel.</p>
              : !funnel.total ? <p className="gv-vacio">Todavía no hay leads en tu funnel.</p>
              : (
                <>
                  <ul className="gv-spend__l">
                    {funnel.etapas.map((e, i) => {
                      const c = e.nombre === 'Otras' || e.nombre === 'Sin etapa' ? 'var(--slate)' : ETAPAS[i % ETAPAS.length];
                      return (
                        <li key={e.nombre}>
                          <span className="gv-chip" style={{ ['--c' as string]: c }} title={e.nombre}>{e.nombre}</span>
                          <span className="gv-sb"><i style={{ ['--c' as string]: c, width: `${Math.round((e.n / maxEtapa) * 100)}%` }} /></span>
                          <b>{e.n}</b>
                        </li>
                      );
                    })}
                  </ul>
                  <div className="gv-spend__k"><Ir href={funnel.principal ? '/crm' : `/crm?funnel=${funnel.id}`}>{funnel.total === 1 ? '1 lead en el funnel' : `${funnel.total} leads en el funnel`}</Ir></div>
                </>
              )}
          </section>
          </Parte>

          {/* PRÓXIMAS LLAMADAS («Latest payments»): lo que viene en el Calendario del CRM. */}
          <Parte id="llamadas">
          <section className="gv-card gv-recent" data-card="">
            <div className="gv-card__h"><span className="gv-card__ic"><Icono id="phone" /></span><h2 className="gv-card__t">Próximas llamadas</h2><Ir href="/calendario" className="gv-link">Calendario<Icono id="chev" /></Ir></div>
            {llamadas == null ? <p className="gv-vacio">No pude leer tu calendario.</p>
              : !llamadas.length ? <p className="gv-vacio">No tienes llamadas por delante.</p>
              : (
                <ul className="gv-pay">
                  {llamadas.map((l) => (
                    <li key={l.id}>
                      <Ir href={l.href} className="gv-fila">
                        <span className="gv-av" style={{ ['--c' as string]: 'var(--in)' }}>{iniciales(l.nombre)}</span>
                        <span style={{ minWidth: 0 }}><strong>{l.nombre}</strong><span>{l.detalle}</span></span>
                        <em>{l.cuando}</em>
                      </Ir>
                    </li>
                  ))}
                </ul>
              )}
          </section>
          </Parte>

          {/* SALUD DEL NEGOCIO («Who did what»): las alertas del semáforo. */}
          <Parte id="salud">
          <section className="gv-card gv-act" data-card="">
            <div className="gv-card__h"><span className="gv-card__ic"><Icono id="check" /></span><h2 className="gv-card__t">Salud del negocio</h2></div>
            {salud == null ? <p className="gv-vacio">No pude leer el semáforo.</p>
              : !salud.length ? <p className="gv-vacio">Todo en orden: no hay alertas.</p>
              : (
                <ul className="gv-act__l">
                  {salud.map((a, i) => (
                    <li key={i}>
                      <span className="gv-av" style={{ ['--c' as string]: SALUD[a.nivel].c, borderRadius: '50%' }}><Icono id={SALUD[a.nivel].i} style={{ width: 14, height: 14 }} /></span>
                      <Ir href={a.href} className="gv-act__x"><p><b>{a.titulo}</b></p><small>{a.link}</small></Ir>
                    </li>
                  ))}
                </ul>
              )}
          </section>
          </Parte>
        </div>
      </div>
    </div>
    </Compartido.Provider>
  );
}
