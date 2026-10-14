'use client';

// =============================================================================
// Norte — ¿voy bien? El objetivo con la acción del día, los OKRs, los KPIs y el semáforo
// =============================================================================
// El hero (../Cabecera.tsx), los KPIs (../KpisCard.tsx) y el semáforo son el diseño que Martín fijó el 08/09/2026 y se
// dibujan igual; lo nuevo del 14/10/2026 son sus opciones y los OKRs, que dejan de ser una lista de texto: cada OKR es
// un anillo con su avance y la marca de dónde debería ir a esta altura (o una barra, si se elige así), y se crea y se
// edita AHÍ MISMO (Martín: «Hay bloques que en la configuración se deben definir allí mismo ciertas cosas... Como el
// objetivo del trimestre, que me gustaría que se llamen (OKRs)»).
// =============================================================================

import type { CSSProperties } from 'react';
import Link from '@/app/_ui/Link';
import { fmtUSD, fmtNum } from '@/lib/format';
import { opcionDe, numeroDe, type OpcionesElegidas } from '@/lib/general-piezas';
import { DesgloseTrigger } from '../../_components/Desglose';
import { Cabecera } from '../Cabecera';
import { KpisCard } from '../KpisCard';
import { EditarObjetivo } from '../EditarObjetivo';
import type { DatosGeneral, OkrVista, AlertaVista } from '../datos-tipos';
import { Cabeza, Fallo, Placeholder } from './comun';
import { OKRS_MUESTRA, ALERTAS_MUESTRA } from './muestras';

type D<K extends keyof DatosGeneral> = DatosGeneral[K];

// ── El objetivo y la acción del día ─────────────────────────────────────────────────────────────────────────────────

export function BloqueCabecera({ d }: { d: D<'cabecera'> }) {
  if (!d.ok) return <Fallo titulo="Objetivo y acción del día" error={d.error} />;
  return <Cabecera {...d.d} />;
}

// ── Los OKRs ────────────────────────────────────────────────────────────────────────────────────────────────────────

const fmtOkr = (n: number | null, unidad: string) => (n == null ? '—' : unidad === 'usd' ? fmtUSD(n) : fmtNum(n));

/** El anillo de un OKR: el avance, y una marca donde debería ir a esta altura del período. */
function Anillo({ pct, fraccion, color, tam = 92 }: { pct: number | null; fraccion: number; color: string; tam?: number }) {
  const r = tam / 2 - 7;
  const c = 2 * Math.PI * r;
  const v = Math.max(0, Math.min(100, pct ?? 0));
  const ang = Math.max(0, Math.min(1, fraccion)) * 2 * Math.PI - Math.PI / 2;
  const cx = tam / 2;
  return (
    <svg width={tam} height={tam} viewBox={`0 0 ${tam} ${tam}`} aria-hidden style={{ flex: 'none', display: 'block' }}>
      <circle cx={cx} cy={cx} r={r} fill="none" stroke="var(--surface-2)" strokeWidth={9} />
      <circle cx={cx} cy={cx} r={r} fill="none" stroke={color} strokeWidth={9} strokeLinecap="round"
        strokeDasharray={`${(v / 100) * c} ${c}`} transform={`rotate(-90 ${cx} ${cx})`} />
      {/* La marca del tiempo: un trazo corto que cruza el aro donde «debería ir». */}
      <line x1={cx + (r - 8) * Math.cos(ang)} y1={cx + (r - 8) * Math.sin(ang)} x2={cx + (r + 8) * Math.cos(ang)} y2={cx + (r + 8) * Math.sin(ang)}
        stroke="var(--ink)" strokeOpacity={0.45} strokeWidth={2} strokeLinecap="round" />
      <text x={cx} y={cx + 1} textAnchor="middle" dominantBaseline="middle" fontSize={tam * 0.22} fontWeight={700} fill="var(--ink)"
        style={{ fontVariantNumeric: 'tabular-nums' }}>{pct == null ? '—' : `${v}%`}</text>
    </svg>
  );
}

const colorOkr = (o: OkrVista) => (o.pct == null ? 'var(--faint)' : o.atrasado ? 'var(--warn-fill)' : 'var(--good)');

function Estado({ o }: { o: OkrVista }) {
  if (o.pct == null) return <span className="gb-chip">Sin leer</span>;
  return o.atrasado
    ? <span className="gb-chip" style={{ color: 'var(--warn)', background: 'var(--warn-bg, var(--surface-2))', borderColor: 'transparent' }}>Atrasado</span>
    : <span className="gb-chip" style={{ color: 'var(--good)', background: 'var(--good-bg, var(--surface-2))', borderColor: 'transparent' }}>Al día</span>;
}

const S: Record<string, CSSProperties> = {
  grilla: { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 12 },
  okr: { display: 'flex', alignItems: 'center', gap: 14, padding: 14, borderRadius: 14, border: '1px solid var(--border)', background: 'var(--surface)', cursor: 'pointer', minWidth: 0, textAlign: 'left', width: '100%', boxSizing: 'border-box' },
  okrTit: { fontSize: 14.5, fontWeight: 600, color: 'var(--ink)', lineHeight: 1.3, overflow: 'hidden', display: '-webkit-box', WebkitBoxOrient: 'vertical', WebkitLineClamp: 2 },
  okrMeta: { fontSize: 12.5, color: 'var(--dim)' },
};

function TarjetaOkr({ o, anio, quarter }: { o: OkrVista; anio: number; quarter: number }) {
  const cuerpo = (
    <div style={S.okr} title="Editar este OKR">
      <Anillo pct={o.pct} fraccion={o.fraccion} color={colorOkr(o)} />
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6, minWidth: 0 }}>
        <span style={S.okrTit}>{o.titulo}</span>
        <span style={S.okrMeta} className="gb-num">{fmtOkr(o.actual, o.unidad)} de {fmtOkr(o.metaValor, o.unidad)}</span>
        <span style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          <Estado o={o} />
          <span className="gb-chip">{o.quarter == null ? `Año ${anio}` : `Q${o.quarter}`}</span>
          {o.principal && <span className="gb-chip" style={{ color: 'var(--primary)' }}>Principal</span>}
        </span>
      </div>
    </div>
  );
  return <EditarObjetivo objetivo={o} anio={anio} quarter={quarter} disparador={cuerpo} />;
}

function FilaOkr({ o, anio, quarter }: { o: OkrVista; anio: number; quarter: number }) {
  const cuerpo = (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 7, padding: '12px 0', borderTop: '1px solid var(--border)', cursor: 'pointer' }} title="Editar este OKR">
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, minWidth: 0 }}>
        <span style={{ ...S.okrTit, WebkitLineClamp: 1, flex: 1 }}>{o.titulo}</span>
        <span className="gb-num" style={{ fontSize: 14, fontWeight: 700, color: colorOkr(o) }}>{o.pct == null ? '—' : `${o.pct}%`}</span>
      </div>
      <div aria-hidden style={{ position: 'relative', height: 8, borderRadius: 999, background: 'var(--surface-2)', overflow: 'hidden' }}>
        <div style={{ width: `${o.pct ?? 0}%`, height: '100%', borderRadius: 999, background: colorOkr(o) }} />
        <div style={{ position: 'absolute', top: 0, bottom: 0, left: `${Math.round(o.fraccion * 100)}%`, width: 2, background: 'var(--ink)', opacity: 0.4 }} />
      </div>
      <span style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
        <span style={S.okrMeta} className="gb-num">{fmtOkr(o.actual, o.unidad)} de {fmtOkr(o.metaValor, o.unidad)}</span>
        <Estado o={o} />
        {o.quarter == null && <span className="gb-chip">Año {anio}</span>}
      </span>
    </div>
  );
  return <EditarObjetivo objetivo={o} anio={anio} quarter={quarter} disparador={cuerpo} />;
}

export function ListaOkrs({ lista, anio, quarter, estilo }: { lista: OkrVista[]; anio: number; quarter: number; estilo: string }) {
  return estilo === 'barras'
    ? <div>{lista.map((o) => <FilaOkr key={o.id} o={o} anio={anio} quarter={quarter} />)}</div>
    : <div style={S.grilla}>{lista.map((o) => <TarjetaOkr key={o.id} o={o} anio={anio} quarter={quarter} />)}</div>;
}

/** «＋ Nuevo OKR», el disparador del modal (lo usan el bloque, su placeholder y el panel). */
export function NuevoOkr({ anio, quarter, secundario = false }: { anio: number; quarter: number; secundario?: boolean }) {
  return <EditarObjetivo objetivo={null} anio={anio} quarter={quarter} disparador={<span className={`gb-boton${secundario ? ' gb-boton--sec' : ''}`}>＋ Nuevo OKR</span>} />;
}

export function BloqueOkrs({ d, op }: { d: D<'okrs'>; op?: OpcionesElegidas }) {
  if (!d.ok) return <Fallo titulo="OKRs" error={d.error} />;
  const estilo = opcionDe('objetivos', op, 'estilo');
  const cuales = opcionDe('objetivos', op, 'cuales');
  const { anio, quarter } = d.d;
  const lista = d.d.lista.filter((o) => cuales === 'todos' || (cuales === 'anio' ? o.quarter == null : o.quarter != null));
  return (
    <div className="gb">
      <Cabeza titulo="OKRs" extra={`Q${quarter} ${anio}`} />
      {lista.length ? (
        <>
          <ListaOkrs lista={lista} anio={anio} quarter={quarter} estilo={estilo} />
          <div style={{ marginTop: 12 }}><NuevoOkr anio={anio} quarter={quarter} secundario /></div>
        </>
      ) : (
        <Placeholder
          muestra={<ListaOkrs lista={OKRS_MUESTRA} anio={anio} quarter={quarter} estilo={estilo} />}
          texto={cuales === 'anio' ? 'Todavía no hay OKRs del año.' : 'Todavía no hay OKRs.'}
          accion={<NuevoOkr anio={anio} quarter={quarter} />}
        />
      )}
    </div>
  );
}

export function MuestraOkrs({ op }: { op?: OpcionesElegidas }) {
  return (
    <div className="gb">
      <Cabeza titulo="OKRs" extra="Q4" />
      <ListaOkrs lista={OKRS_MUESTRA} anio={2026} quarter={4} estilo={opcionDe('objetivos', op, 'estilo')} />
    </div>
  );
}

// ── Los KPIs ────────────────────────────────────────────────────────────────────────────────────────────────────────

export function BloqueKpis({ d, op }: { d: D<'kpis'>; op?: OpcionesElegidas }) {
  if (!d.ok) return <Fallo titulo="KPIs" error={d.error} />;
  const cadencia = opcionDe('kpis', op, 'cadencia');
  const kpis = cadencia === 'todas' ? d.d.kpis : d.d.kpis.filter((k) => k.cadencia === cadencia);
  // Sin KPIs, KpisCard ya muestra su propuesta (los candidatos que MaKo sugiere, con «agregar»): ése es su placeholder.
  return <KpisCard kpis={kpis} candidatos={d.d.candidatos} objetivos={d.d.objetivos} objetivoPrincipalId={d.d.objetivoPrincipalId} />;
}

// ── El semáforo ─────────────────────────────────────────────────────────────────────────────────────────────────────

/**
 * Las tres lámparas y las alertas (el diseño del 08/09/2026: «estaban bien diseñadas»). ⚠️ Las lámparas miran el
 * estado del NEGOCIO (`lampara`, calculado sobre TODAS las alertas); la lista, lo que queda por leer acá. Con la lista
 * recortada por la opción, la lámpara no cambia: se dice cuántas más hay.
 */
function Semaforo({ alertas, lampara, conLamparas, limite, objetivoAtrasado }: {
  alertas: AlertaVista[]; lampara: string; conLamparas: boolean; limite: number; objetivoAtrasado: boolean;
}) {
  const vistas = alertas.slice(0, limite);
  const resto = alertas.length - vistas.length;
  return (
    <div style={{ display: 'flex', gap: 22, alignItems: 'stretch', flexWrap: 'wrap' }}>
      {conLamparas && (
        // `alignSelf: stretch` y NUNCA `height: 100%`: Safari devuelve cero contra un alto indefinido.
        <div style={{ flex: 'none', width: 80, alignSelf: 'stretch', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 12, background: 'var(--sidebar)', borderRadius: 18, padding: '16px 14px' }}>
          <Lampara color="var(--bad)" encendida={lampara === 'rojo'} />
          <Lampara color="var(--warn-fill)" encendida={lampara === 'ambar'} />
          <Lampara color="var(--good)" encendida={lampara === 'verde'} />
        </div>
      )}
      <div style={{ flex: 1, minWidth: 240 }}>
        {vistas.length === 0 ? (
          <span style={{ fontSize: 15, color: 'var(--dim)' }}>
            {objetivoAtrasado ? 'Ninguna señal en rojo, pero el trimestre va por debajo de lo esperado.' : 'Nada que atender.'}
          </span>
        ) : (
          <div>
            {vistas.map((a, i) => {
              const c = a.nivel === 'rojo' ? 'var(--bad)' : a.nivel === 'ambar' ? 'var(--warn-fill)' : 'var(--good)';
              const inner = (
                <>
                  <span aria-hidden style={{ flex: 'none', width: 10, height: 10, borderRadius: '50%', background: c, boxShadow: `0 0 0 4px color-mix(in srgb, ${c} 18%, transparent)` }} />
                  <span style={{ flex: 1, minWidth: 0, fontSize: 15, color: 'var(--ink)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{a.titulo}</span>
                  <span style={{ flex: 'none', color: 'var(--faint)', fontSize: 13 }}>{a.desglose ? 'ver detalle →' : `${a.hrefLabel} →`}</span>
                </>
              );
              const fila: CSSProperties = { display: 'flex', alignItems: 'center', gap: 12, width: '100%', padding: '12px 0', textDecoration: 'none', borderTop: i === 0 ? 'none' : '1px solid var(--border)' };
              return a.desglose
                ? <DesgloseTrigger key={i} data={a.desglose} style={fila}>{inner}</DesgloseTrigger>
                : <Link key={i} href={a.href} style={fila}>{inner}</Link>;
            })}
            {resto > 0 && <p style={{ margin: '10px 0 0', fontSize: 13, color: 'var(--faint)' }}>{resto === 1 ? 'Y una más.' : `Y ${resto} más.`}</p>}
          </div>
        )}
      </div>
    </div>
  );
}

function Lampara({ color, encendida }: { color: string; encendida: boolean }) {
  return (
    <span aria-hidden style={{
      width: 44, height: 44, borderRadius: '50%', background: color,
      ...(encendida ? { boxShadow: `0 0 24px 4px color-mix(in srgb, ${color} 55%, transparent)` } : { opacity: 0.18 }),
    }} />
  );
}

export function BloqueSemaforo({ d, op }: { d: D<'semaforo'>; op?: OpcionesElegidas }) {
  if (!d.ok) return <Fallo titulo="Semáforo del negocio" error={d.error} />;
  const conLamparas = opcionDe('semaforo', op, 'lamparas') === 'si';
  const limite = numeroDe(opcionDe('semaforo', op, 'limite'));
  const { fuentes } = d.d;
  return (
    <div className="gb">
      <Cabeza titulo="Semáforo del negocio" />
      {/* ⚠️ «No puedo opinar» (#165) va ANTES que cualquier alerta: sin una fuente que haya entregado un dato, las tres
          lámparas apagadas son lo único honesto. Y «no las pude leer» es nuestro: no se manda a conectar. */}
      {fuentes !== 'con-datos' ? (
        fuentes === 'sin-leer'
          ? <span className="gb-fallo">No pude leer tus fuentes de datos: hoy no puedo opinar de tu negocio.</span>
          : <Placeholder
              muestra={<Semaforo alertas={ALERTAS_MUESTRA} lampara="rojo" conLamparas={conLamparas} limite={limite} objetivoAtrasado={false} />}
              texto="Sin fuentes conectadas no puedo opinar de tu negocio."
              accion={{ href: '/integraciones', rotulo: 'Conectar' }}
            />
      ) : (
        <Semaforo alertas={d.d.alertas} lampara={d.d.lampara} conLamparas={conLamparas} limite={limite} objetivoAtrasado={d.d.objetivoAtrasado} />
      )}
    </div>
  );
}

export function MuestraSemaforo({ op }: { op?: OpcionesElegidas }) {
  return (
    <div className="gb">
      <Cabeza titulo="Semáforo del negocio" />
      <Semaforo alertas={ALERTAS_MUESTRA} lampara="rojo" conLamparas={opcionDe('semaforo', op, 'lamparas') === 'si'} limite={5} objetivoAtrasado={false} />
    </div>
  );
}
