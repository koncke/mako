'use client';

// =============================================================================
// HojaOperacion — la hoja «Operación diaria» con su DISEÑO PROPIO: la copia de Moorly, con lo que MaKo sabe de hoy
// =============================================================================
// Martín, 4/11/2026: «que sea primero la copia, es decir, que se vea exactamente igual que la copia, y después la adaptación
// con Maco» y «Después seguí con la segunda hoja, de a una». La copia y la adaptación (maquetas) están en
// docs/diseno/mockups-dashboard/operacion-moorly/; ésta es la adaptación con los datos de verdad, que llegan ya armados
// (`VistaOperacion`, lib/operacion-diseno.ts, con test) desde ./OperacionVivo.tsx o, para la miniatura de «Nueva hoja», de
// ejemplo.
//
// Lo que Moorly tiene y MaKo no hace NO está (lo dice lib/operacion-diseno.ts): la caja para agregar un pendiente y la plata de
// cada etapa del funnel.
//
// El movimiento: el INFORME de Moorly trae la entrada del ARMAZÓN (la barra de arriba, que en MaKo pone la app) y los hover del
// CSS; la entrada de la página «Desk» vive en un chunk que el INFORME no muestra. No se inventa: las tarjetas quedan quietas.
//
// ⚠️ La hoja de estilos (./operacion-css.ts) es SÓLO de esta hoja.
// ⚠️ Mirando se dibuja esto; editando, la grilla con los bloques de siempre (app/dashboard/EditorInforme.tsx).
// =============================================================================

import { createContext, useContext, useId, useLayoutEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import { entradaDeTarjetas } from './entrada-tarjetas';
import Link from '@/app/_ui/Link';
import { plata, plataCorta } from '@/lib/cobranza-diseno';
import { resumenDeMeses, type MesOp, type NumeroOp, type VistaOperacion } from '@/lib/operacion-diseno';
import { CSS_OPERACION } from './operacion-css';
import { Parte } from './parte';

const Compartido = createContext(false);

const P = {
  phone: 'M6.5 4h3l1.5 4-2 1.2a10 10 0 0 0 4.8 4.8L15 12l4 1.5v3A2 2 0 0 1 17 18.5C10.6 18.2 5.8 13.4 5.5 7A2 2 0 0 1 6.5 4z',
  wallet: 'M4 6h16v13H4zM4 9h16M15 14h2',
  shield: 'M12 3.5l7 3v5c0 4.5-3 7.5-7 9-4-1.5-7-4.5-7-9v-5zM9 12l2 2 4-4',
  cal: 'M4 5.5h16v14H4zM4 10h16M8 3.5v4M16 3.5v4',
  clip: 'M5.5 4.5h13v16h-13zM9 4.5h6v3H9zM9 13l2 2 4-4',
  contact: 'M5 4h14v16H5zM12 7.5a2.5 2.5 0 1 0 0 5a2.5 2.5 0 1 0 0-5M8.5 16c.8-1.8 2-2.5 3.5-2.5s2.7.7 3.5 2.5',
  warn: 'M12 4l9 16H3zM12 10v4M12 17h.01',
  check: 'M5 12.5l4 4 10-10',
  flag: 'M6 20V4M6 4h11l-2 4 2 4H6',
  grid: 'M5 5h5v5H5zM14 5h5v5h-5zM5 14h5v5H5zM14 14h5v5h-5z',
} as const;
function Icono({ id, style }: { id: keyof typeof P; style?: CSSProperties }) {
  return <svg className="mo-i" style={style} viewBox="0 0 24 24" aria-hidden><path d={P[id]} /></svg>;
}

/** Un link de la app, o un texto si la hoja está compartida (un link compartido no tiene sesión) o no hay a dónde ir. */
function Ir({ href, className, style, children, label }: { href: string | null; className?: string; style?: CSSProperties; children: ReactNode; label?: string }) {
  const compartido = useContext(Compartido);
  if (!href || compartido) return <span className={className} style={style}>{children}</span>;
  return <Link href={href} className={className} style={style} aria-label={label}>{children}</Link>;
}

/** «US$20k», «US$31.5k». */
const corta = (n: number) => plataCorta(n).replace(/K$/, 'k').replace(/M$/, 'm');
const curva = (pts: Array<[number, number]>) => {
  let d = `M${pts[0][0]},${pts[0][1]}`;
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[i - 1] ?? pts[i], p1 = pts[i], p2 = pts[i + 1], p3 = pts[i + 2] ?? p2;
    const c1 = [p1[0] + (p2[0] - p0[0]) / 6, p1[1] + (p2[1] - p0[1]) / 6], c2 = [p2[0] - (p3[0] - p1[0]) / 6, p2[1] - (p3[1] - p1[1]) / 6];
    d += ` C${c1[0].toFixed(1)},${c1[1].toFixed(1)} ${c2[0].toFixed(1)},${c2[1].toFixed(1)} ${p2[0]},${p2[1]}`;
  }
  return d;
};
/** El tope del eje: cuatro pasos «redondos» (como el $800k de Moorly en pasos de $200k). */
export function escalaOperacion(max: number): { tope: number; paso: number } {
  if (!(max > 0)) return { tope: 4, paso: 1 };
  const bruto = max / 4;
  const mag = 10 ** Math.floor(Math.log10(bruto));
  const paso = [1, 2, 2.5, 5, 10].map((k) => k * mag).find((k) => k >= bruto) ?? 10 * mag;
  return { tope: 4 * paso, paso };
}

function useTam<T extends HTMLElement>() {
  const ref = useRef<T>(null);
  const [tam, setTam] = useState<{ w: number; h: number } | null>(null);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const medir = () => setTam({ w: el.clientWidth, h: el.clientHeight });
    medir();
    const ro = new ResizeObserver(medir);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  return [ref, tam] as const;
}

/** La línea chica de cada número: el relleno y la línea, de punta a punta de su caja. */
function Linea({ serie }: { serie: number[] }) {
  const W = 90, H = 30, max = Math.max(...serie), min = Math.min(...serie);
  const pts = serie.map((n, i) => [+((W * i) / (serie.length - 1)).toFixed(1), +(H - 2 - (H - 6) * ((n - min) / (max - min || 1))).toFixed(1)] as [number, number]);
  const lin = curva(pts);
  return (
    <svg className="mo-spark" viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" aria-hidden>
      <path className="mo-a" d={`${lin} L${W},${H} L0,${H} Z`} /><path className="mo-l" d={lin} style={{ vectorEffect: 'non-scaling-stroke' }} />
    </svg>
  );
}

const CAMPOS = [{ id: 'cobrado', rotulo: 'Cobrado' }, { id: 'agendas', rotulo: 'Agendas' }, { id: 'cierres', rotulo: 'Cierres' }] as const;
type Campo = (typeof CAMPOS)[number]['id'];

/** «Lo cobrado, mes a mes» (el «Premium on the water» de Moorly): la curva con su relleno, cinco rayas y un mes cada dos. */
function Grafico({ meses, campo }: { meses: MesOp[]; campo: Campo }) {
  const [ref, tam] = useTam<HTMLDivElement>();
  const grad = `mo-g-${useId().replace(/[^a-zA-Z0-9]/g, '')}`;
  const v = meses.map((m) => m[campo]);
  const { tope, paso } = escalaOperacion(Math.max(...v));
  const rotulo = (n: number) => (campo === 'cobrado' ? (n ? corta(n) : 'US$0') : String(Math.round(n)));
  let dibujo: ReactNode = null;
  if (tam && tam.w > 0 && meses.length > 1) {
    // Medido en la captura de Moorly: las etiquetas del eje a la izquierda (50 px; más con «US$»), el tope 6 px abajo del techo
    // y el cero 24 px arriba del piso; un mes cada dos (cada tres en el teléfono), y el último siempre.
    const { w: W, h: H } = tam, angosto = W < 520, izq = campo === 'cobrado' ? 62 : 50, arriba = 6, abajo = 24;
    const y = (n: number) => arriba + (H - arriba - abajo) * (1 - n / tope);
    const x = (i: number) => izq + (W - izq) * (i / (meses.length - 1));
    const cada = angosto ? 3 : 2;
    const pts = v.map((n, i) => [+x(i).toFixed(1), +y(n).toFixed(1)] as [number, number]);
    const lin = curva(pts);
    dibujo = (
      <>
        <defs><linearGradient id={grad} x1={0} x2={0} y1={0} y2={1}><stop offset={0} style={{ stopColor: 'var(--accent)' }} stopOpacity={0.2} /><stop offset={1} style={{ stopColor: 'var(--accent)' }} stopOpacity={0} /></linearGradient></defs>
        {[4, 3, 2, 1, 0].map((k) => {
          const yy = y(paso * k);
          return <g key={k}><line className="mo-gl" x1={izq} x2={W} y1={yy} y2={yy} /><text x={0} y={yy + 4}>{rotulo(paso * k)}</text></g>;
        })}
        {meses.map((m, i) => (i % cada && i !== meses.length - 1 ? null : <text key={m.clave} x={x(i)} y={H - 4} textAnchor="middle">{m.corto}</text>))}
        <path d={`${lin} L${pts[pts.length - 1][0]},${y(0)} L${pts[0][0]},${y(0)} Z`} fill={`url(#${grad})`} />
        <path d={lin} fill="none" style={{ stroke: 'var(--accent)' }} strokeWidth={2.2} strokeLinecap="round" />
      </>
    );
  }
  return <div className="mo-chart" ref={ref} role="img" aria-label="Mes a mes, los últimos 12 meses"><svg aria-hidden>{dibujo}</svg></div>;
}

/** «Las llamadas que vienen» (el «Renewal tide» de Moorly): una barra por día; la más alta, oscura; cuatro rayas y un día cada dos. */
function Marea({ porDia }: { porDia: NonNullable<VistaOperacion['llamadas']>['porDia'] }) {
  const [ref, tam] = useTam<HTMLDivElement>();
  let dibujo: ReactNode = null;
  if (tam && tam.w > 0) {
    // Medido en la captura: cuatro rayas punteadas cada 30 px y la base, 17 px arriba del piso; lo más alto llega a la mitad.
    const { w: W, h: H } = tam, abajo = 17, alto = H - abajo, arriba = alto - 119;
    const max = Math.max(...porDia.map((p) => p.n)), tope = max * 2 || 1, hi = max ? porDia.findIndex((p) => p.n === max) : -1;
    const col = W / porDia.length, ancho = Math.min(16, col * 0.5);
    dibujo = (
      <>
        {[0, 1, 2, 3].map((k) => <line key={k} className="mo-gl" x1={0} x2={W} y1={arriba + 30 * k} y2={arriba + 30 * k} />)}
        <line x1={0} x2={W} y1={alto} y2={alto} style={{ stroke: 'var(--line-2)' }} />
        {porDia.map((p, i) => {
          const h = 119 * (p.n / tope);
          return (
            <g key={p.dia}>
              {h > 0 && <rect x={col * i + (col - ancho) / 2} y={alto - h} width={ancho} height={h} rx={3} style={{ fill: i === hi ? 'var(--accent)' : 'color-mix(in srgb, var(--accent) 50%, transparent)' }}><title>{`${p.rotulo}: ${p.n}`}</title></rect>}
              {i % 2 === 0 && <text x={col * i + col / 2} y={H - 2} textAnchor="middle">{p.rotulo}</text>}
            </g>
          );
        })}
      </>
    );
  }
  return <div className="mo-tide" ref={ref} role="img" aria-label="Las llamadas agendadas por día, las próximas dos semanas"><svg aria-hidden>{dibujo}</svg></div>;
}

const TILE: Record<NumeroOp['id'], { clase: string; icono: keyof typeof P; href: string | null }> = {
  agendas: { clase: 'mo-kpi--sea', icono: 'phone', href: '/calendario' },
  pendiente: { clase: 'mo-kpi--sand', icono: 'wallet', href: '/crm' },
  cierres: { clase: 'mo-kpi--sky', icono: 'shield', href: '/crm' },
  cobrado: { clase: 'mo-kpi--coral', icono: 'cal', href: '/crm' },
};
const TONO = { bad: { t: 'var(--bad-soft)', c: 'var(--bad)', pill: 'mo-pill--bad' }, warn: { t: 'var(--warm-soft)', c: 'var(--warm-text)', pill: 'mo-pill--warn' }, info: { t: 'var(--accent-soft)', c: 'var(--accent-text)', pill: 'mo-pill--info' } } as const;
const ICONO_ESPERA = { cobro: 'wallet', tarea: 'clip', leads: 'contact' } as const;
const MIX = ['var(--c-hull)', 'var(--c-cargo)', 'var(--c-build)', 'var(--c-charter)'];
// Variables de la hoja (claro y oscuro): el ícono del avatar va en la tinta, que de noche es clara.
const SALUD = { rojo: { c: 'var(--salud-rojo)', i: 'warn' }, ambar: { c: 'var(--salud-ambar)', i: 'warn' }, verde: { c: 'var(--salud-verde)', i: 'check' } } as const;
const plural = (n: number, uno: string, varios: string) => `${n} ${n === 1 ? uno : varios}`;
const mayuscula = (s: string) => (s ? s[0].toLocaleUpperCase('es') + s.slice(1) : s);

export function HojaOperacion({ vista, titulo, fecha, hechas, onCompletar, onGrilla, compartido = false, quieta = false, pie }: {
  vista: VistaOperacion;
  /** «Buenos días, Ana» (las variables de General); sin nombre, el de la hoja. */
  titulo: string;
  /** «miércoles 4 de noviembre» (la variable de General): null = no llegó. */
  fecha: string | null;
  /** Las tareas que se tildaron desde la hoja (quedan tachadas). */
  hechas?: ReadonlySet<string>;
  onCompletar?: (id: string) => void;
  onGrilla?: () => void;
  compartido?: boolean;
  /** La miniatura de «Nueva hoja». */
  quieta?: boolean;
  /** Lo que va al pie (el aviso de «Tarea completada»). */
  pie?: ReactNode;
}) {
  // La entrada (Martín, 14/11/2026: «algunos todavía no tienen animación»): las tarjetas suben escalonadas, como en Cobranza
  // y Marketing (./entrada-tarjetas.ts). Antes de cualquier otra cosa, para que no la salte un return temprano.
  const raizEntrada = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => { if (!quieta) entradaDeTarjetas(raizEntrada.current, '.mo-card'); }, []); // eslint-disable-line react-hooks/exhaustive-deps
  const [campo, setCampo] = useState<Campo>('cobrado');
  const { frase, numeros, meses, espera, funnel, llamadas, deben, tildar, salud, meta } = vista;
  const resumen = meses ? resumenDeMeses(meses, campo) : null;
  const fmt = (n: number) => (campo === 'cobrado' ? plata(n) : n.toLocaleString('es-MX', { maximumFractionDigits: 1 }));
  const sinMeses = !meses || meses.every((m) => !m[campo]);
  const maxEtapa = funnel ? Math.max(1, ...funnel.etapas.map((e) => e.n)) : 1;
  const abiertas = tildar ? tildar.filter((t) => !hechas?.has(t.id)).length : 0;

  return (
    <Compartido.Provider value={compartido}>
    <div ref={raizEntrada} className="mo" data-quieta={quieta ? '' : undefined}>
      <style href="dash-hoja-operacion" precedence="medium">{CSS_OPERACION}</style>
      {/* La letra de Moorly (Urbanist), sólo para esta hoja. */}
      <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Urbanist:wght@400..800&display=swap" precedence="default" />
      {/* El mar de Moorly: el cielo, el sol y cuatro olas (muestreadas de la captura). */}
      <svg className="mo-sea" viewBox="0 0 1440 900" preserveAspectRatio="none" aria-hidden>
        <path d="M0 440 C 300 424 620 404 940 410 S 1300 448 1440 454 L1440 900 L0 900Z" fill="var(--w1)" stroke="var(--crest)" strokeWidth={2} />
        <path d="M0 569 C 320 552 640 528 950 532 S 1300 570 1440 575 L1440 900 L0 900Z" fill="var(--w2)" stroke="var(--crest)" strokeWidth={2} />
        <path d="M0 665 C 300 676 640 690 952 683 S 1300 640 1440 635 L1440 900 L0 900Z" fill="var(--w3)" stroke="var(--crest)" strokeWidth={2} />
        <path d="M0 769 C 320 790 660 812 952 811 S 1300 782 1440 777 L1440 900 L0 900Z" fill="var(--w4)" stroke="var(--crest)" strokeWidth={2} />
      </svg>
      <div className="mo-page">
        {/* LA CABECERA: el saludo, la fecha y lo de hoy, con dos botones. */}
        <Parte id="cabecera">
        <div className="mo-hero">
          <div>
            <h1>{titulo}</h1>
            <p>
              {[fecha ? mayuscula(fecha) : null].filter(Boolean).map((f) => <span key="f">{f}{frase.length ? ' · ' : ''}</span>)}
              {frase.map((t, i) => (t.tipo === 'fuerte' ? <b key={i}>{t.s}</b> : <span key={i}>{t.s}</span>))}
            </p>
          </div>
          <div className="mo-hero__acts">
            {onGrilla && <button type="button" className="mo-ibtn" onClick={onGrilla} aria-label="Ver todo en la grilla" title="Ver todo en la grilla"><Icono id="grid" /></button>}
            <Ir href="/plan" className="mo-btn"><Icono id="clip" />Abrir el Plan</Ir>
            <Ir href="/crm" className="mo-btn mo-btn--primary"><Icono id="contact" />Abrir el CRM</Ir>
          </div>
        </div>
        </Parte>

        {/* LOS CUATRO NÚMEROS, con su línea de los días del período. */}
        <Parte id="numeros">
        <div className="mo-grid mo-kpis">
          {numeros.map((n) => {
            const t = TILE[n.id];
            return (
              <Ir key={n.id} href={t.href} className={`mo-kpi ${t.clase}`}>
                <p className="mo-kpi__l"><Icono id={t.icono} />{n.titulo}</p>
                <p className="mo-kpi__v">{n.valor ?? '—'}</p>
                {n.valor == null ? <p className="mo-kpi__f">No pude leerlo</p> : (n.pie || n.cambio) && (
                  <p className="mo-kpi__f">{n.cambio && <span className="mo-up">{n.cambio.startsWith('−') ? '↓' : '↑'} {n.cambio.replace(/^[+−]/, '')}</span>}{n.pie && <span className={n.cambio ? 'mo-vs' : undefined}>{n.pie}</span>}</p>
                )}
                {n.serie && <Linea serie={n.serie} />}
              </Ir>
            );
          })}
        </div>
        </Parte>

        <div className="mo-grid mo-row2">
          {/* MES A MES (el «Premium on the water»): la curva de los 12 meses, con Cobrado · Agendas · Cierres. */}
          <Parte id="mesames">
          <section className="mo-card mo-desk__chart">
            <div className="mo-card__h">
              <div><h2 className="mo-card__t">Mes a mes</h2><p className="mo-card__s">{campo === 'cobrado' ? 'La plata que entró' : campo === 'agendas' ? 'Las llamadas agendadas' : 'Los cierres'} cada mes · últimos 12 meses</p></div>
              <div className="mo-tabs" role="tablist">
                {CAMPOS.map((c) => <button key={c.id} type="button" role="tab" aria-selected={campo === c.id} onClick={() => setCampo(c.id)}>{c.rotulo}</button>)}
              </div>
            </div>
            {meses == null ? <p className="mo-vacio">No pude leer los meses.</p>
              : sinMeses ? <p className="mo-vacio">Todavía no hay nada que dibujar en los últimos 12 meses.</p>
              : <Grafico meses={meses} campo={campo} />}
            {resumen && !sinMeses && (
              <div className="mo-cstats">
                <div><p>Doce meses</p><b>{fmt(resumen.total)}</b></div>
                <div><p>Promedio por mes</p><b>{fmt(Math.round(resumen.promedio * 10) / 10)}</b></div>
                <div><p>El mejor mes</p><b>{resumen.mejor ?? '—'}</b></div>
                <div><p>Este mes, hasta hoy</p><b>{fmt(resumen.actual)}</b></div>
              </div>
            )}
          </section>
          </Parte>

          {/* TE ESTÁ ESPERANDO (el «Waiting on you»): lo vencido primero, después lo que vence pronto. */}
          <Parte id="espera">
          <section className="mo-card mo-desk__wait">
            <div className="mo-card__h"><div><h2 className="mo-card__t">Te está esperando</h2><p className="mo-card__s">{espera ? (espera.total ? plural(espera.total, 'cosa entre cobros, tareas y leads', 'cosas entre cobros, tareas y leads') : 'Nada pendiente') : 'Cobros, tareas y leads'}</p></div></div>
            {espera == null ? <p className="mo-vacio">No pude leer lo que te está esperando.</p>
              : !espera.lista.length ? <p className="mo-vacio">Nada te está esperando ahora.</p>
              : (
                <ul className="mo-wait">
                  {espera.lista.map((e) => (
                    <li key={e.id}>
                      <Ir href={e.href} className="mo-fila">
                        <span className="mo-tile" style={{ ['--t' as string]: TONO[e.tono].t, ['--tc' as string]: TONO[e.tono].c }}><Icono id={ICONO_ESPERA[e.tipo]} /></span>
                        <span style={{ minWidth: 0 }}><b>{e.titulo}</b><small>{e.detalle}</small></span>
                        <span className={`mo-pill ${TONO[e.tono].pill}`}>{e.cuando}</span>
                      </Ir>
                    </li>
                  ))}
                </ul>
              )}
          </section>
          </Parte>
        </div>

        <div className="mo-grid mo-row3">
          {/* TU FUNNEL HOY (el «Pipeline»): cuántos hay en cada etapa del funnel principal. */}
          <Parte id="funnel">
          <section className="mo-card">
            <div className="mo-card__h"><div><h2 className="mo-card__t">Tu funnel hoy</h2><p className="mo-card__s">{funnel ? `${plural(funnel.total, 'lead', 'leads')} · ${funnel.nombre}` : 'El funnel principal'}</p></div><Ir href={funnel && !funnel.principal ? `/crm?funnel=${funnel.id}` : '/crm'} className="mo-linkbtn">El CRM</Ir></div>
            {funnel == null ? <p className="mo-vacio">No pude contar tu funnel.</p>
              : !funnel.total ? <p className="mo-vacio">Todavía no hay leads en tu funnel.</p>
              : (
                <ul className="mo-pipe">
                  {funnel.etapas.map((e, i) => (
                    <li key={e.nombre}>
                      <span className="mo-n">{e.n}</span><span title={e.nombre}>{e.nombre}</span>
                      <span className="mo-bar"><i style={{ width: `${Math.round((e.n / maxEtapa) * 100)}%`, opacity: Math.min(1, 0.5 + (0.5 * i) / Math.max(1, funnel.etapas.length - 1)) }} /></span>
                      <em>{Math.round((e.n / funnel.total) * 100)}%</em>
                    </li>
                  ))}
                </ul>
              )}
          </section>
          </Parte>

          {/* LAS LLAMADAS QUE VIENEN (el «Renewal tide»): cuántas hay cada día de las próximas dos semanas, y las tres que siguen. */}
          <Parte id="llamadas">
          <section className="mo-card">
            <div className="mo-card__h"><div><h2 className="mo-card__t">Las llamadas que vienen</h2><p className="mo-card__s">Agendadas por día · próximas 2 semanas</p></div><Ir href="/calendario" className="mo-linkbtn">Calendario</Ir></div>
            {llamadas == null ? <p className="mo-vacio">No pude leer tu calendario.</p> : (
              <>
                <Marea porDia={llamadas.porDia} />
                {!llamadas.proximas.length ? <p className="mo-vacio">No tienes llamadas por delante.</p> : (
                  <ul className="mo-ren">
                    {llamadas.proximas.map((l) => (
                      <li key={l.id}>
                        <Ir href={l.href} className="mo-fila">
                          <span className="mo-days"><b>{l.dia}</b><small>{l.mes}</small></span>
                          <span style={{ minWidth: 0 }}><b>{l.nombre}</b><small>{l.detalle || 'Llamada'}</small></span>
                          <span className={`mo-pill ${l.hoy ? 'mo-pill--good' : 'mo-pill--blue'}`}><i />{l.cuando}</span>
                        </Ir>
                      </li>
                    ))}
                  </ul>
                )}
              </>
            )}
          </section>
          </Parte>

          {/* TE DEBEN (el «Book by program»): lo que falta cobrar, por días de atraso (las cuentas de la hoja Cobranza). */}
          <Parte id="deben">
          <section className="mo-card mo-mix">
            <div className="mo-card__h"><div><h2 className="mo-card__t">Te deben</h2><p className="mo-card__s">{deben ? `${plural(deben.cuotas, 'cuota', 'cuotas')} · ${plata(deben.total)}` : 'Por días de atraso'}</p></div><Ir href="/crm" className="mo-linkbtn">Las cuotas</Ir></div>
            {deben == null ? <p className="mo-vacio">No pude leer lo que te deben.</p>
              : !deben.tramos.length ? <p className="mo-vacio">Nadie te debe una cuota ahora.</p>
              : (
                <>
                  <div className="mo-mixbar">{deben.tramos.map((t, i) => <i key={t.nombre} style={{ ['--c' as string]: MIX[i % MIX.length], flex: t.monto }} />)}</div>
                  <ul>{deben.tramos.map((t, i) => <li key={t.nombre}><i style={{ ['--c' as string]: MIX[i % MIX.length] }} /><span>{t.nombre}</span><em>{t.pct}%</em><b>{corta(t.monto)}</b></li>)}</ul>
                </>
              )}
          </section>
          </Parte>
        </div>

        <div className="mo-grid mo-row3">
          {/* PARA TILDAR HOY (los «To-dos»): lo que vence hoy y lo vencido; se tilda ahí mismo. */}
          <Parte id="tildar">
          <section className="mo-card mo-todos">
            <div className="mo-card__h"><div><h2 className="mo-card__t">Para tildar hoy</h2><p className="mo-card__s">{tildar ? plural(abiertas, 'abierta', 'abiertas') : 'Tu Plan'}</p></div><Ir href="/plan" className="mo-linkbtn">El Plan</Ir></div>
            {tildar == null ? <p className="mo-vacio">No pude leer tu Plan.</p>
              : !tildar.length ? <p className="mo-vacio">No tienes nada que venza hoy.</p>
              : (
                <ul style={{ marginTop: 12 }}>
                  {tildar.map((t) => {
                    const hecha = !!hechas?.has(t.id);
                    return (
                      <li key={t.id} className={`mo-todo${hecha ? ' mo-is-done' : ''}`}>
                        <button type="button" role="checkbox" aria-checked={hecha} aria-label={`Marcar «${t.titulo}» como hecha`} disabled={hecha || !onCompletar || compartido} onClick={() => onCompletar?.(t.id)}>{hecha && <Icono id="check" />}</button>
                        <span>{t.titulo}</span><small>{t.cuando}</small>
                      </li>
                    );
                  })}
                </ul>
              )}
          </section>
          </Parte>

          {/* SALUD DEL NEGOCIO (la «Activity»): las alertas del semáforo. */}
          <Parte id="salud">
          <section className="mo-card mo-desk__feed">
            <div className="mo-card__h"><div><h2 className="mo-card__t">Salud del negocio</h2><p className="mo-card__s">Lo que dice el semáforo</p></div></div>
            {salud == null ? <p className="mo-vacio">No pude leer el semáforo.</p>
              : !salud.length ? <p className="mo-vacio">Todo en orden: no hay alertas.</p>
              : (
                <ul className="mo-feed">
                  {salud.map((a, i) => (
                    <li key={i}><span className="mo-av" style={{ ['--c' as string]: SALUD[a.nivel].c }}><Icono id={SALUD[a.nivel].i} /></span><Ir href={a.href}><b>{a.titulo}</b><small>{a.link}</small></Ir></li>
                  ))}
                </ul>
              )}
          </section>
          </Parte>

          {/* LA META DEL TRIMESTRE (el «Next agency bill»): cuánto va, lo esperado a hoy y los días que faltan. */}
          <Parte id="meta">
          <section className="mo-card mo-bill">
            <div className="mo-card__h">
              <div><h2 className="mo-card__t">La meta del trimestre</h2><p className="mo-card__s">{meta ? meta.titulo : 'Tu meta'}</p></div>
              {meta?.atrasado != null && <span className={`mo-pill ${meta.atrasado ? 'mo-pill--warn' : 'mo-pill--good'}`} style={{ marginLeft: 'auto' }}><i />{meta.atrasado ? 'Vas atrasado' : 'Vas a tiempo'}</span>}
            </div>
            {meta == null ? <p className="mo-vacio">Todavía no tienes una meta para el trimestre.</p> : (
              <>
                <p className="mo-bill__v">{meta.pct == null ? '—' : `${meta.pct}%`}</p>
                <p className="mo-bill__s">a esta altura tendrías que ir por el {meta.esperado}%{meta.diasRestantes > 0 ? ` · ${meta.diasRestantes === 1 ? 'falta 1 día' : `faltan ${meta.diasRestantes} días`}` : ''}</p>
                <div className="mo-billbar"><i style={{ ['--c' as string]: 'var(--accent)', flex: Math.max(0, Math.min(100, meta.pct ?? 0)) }} /><i style={{ ['--c' as string]: 'var(--card-3)', flex: 100 - Math.max(0, Math.min(100, meta.pct ?? 0)) }} /></div>
                <div className="mo-leg"><span><i style={{ ['--c' as string]: 'var(--accent)' }} />Lo que llevas {meta.pct ?? 0}%</span><span><i style={{ ['--c' as string]: 'var(--card-3)' }} />Lo que falta {100 - Math.max(0, Math.min(100, meta.pct ?? 0))}%</span></div>
              </>
            )}
            <Ir href="/general" className="mo-btn"><Icono id="flag" />Ver la meta</Ir>
          </section>
          </Parte>
        </div>
      </div>
      {pie}
    </div>
    </Compartido.Provider>
  );
}
