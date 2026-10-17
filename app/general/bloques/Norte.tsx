'use client';

// =============================================================================
// Norte — ¿voy bien? Los OKRs, los KPIs y el semáforo (la Meta objetivo y la Acción del día viven en ./Meta.tsx)
// =============================================================================
// Los KPIs (../KpisCard.tsx) y el semáforo son el diseño que Martín fijó el 08/09/2026 y se
// dibujan igual; lo nuevo del 14/10/2026 son sus opciones y los OKRs, que dejan de ser una lista de texto: cada OKR es
// un anillo con su avance y la marca de dónde debería ir a esta altura (o una barra, si se elige así), y se crea y se
// edita AHÍ MISMO (Martín: «Hay bloques que en la configuración se deben definir allí mismo ciertas cosas... Como el
// objetivo del trimestre, que me gustaría que se llamen (OKRs)»).
// =============================================================================

import type { CSSProperties } from 'react';
import { fmtUSD, fmtNum } from '@/lib/format';
import { opcionDe, numeroDe, type OpcionesElegidas } from '@/lib/general-piezas';
import { DesgloseTrigger } from '../../_components/Desglose';
import { LinkIntegracion } from '../../_components/ConectarIntegracion';
import { KpisCard } from '../KpisCard';
import { EditarObjetivo } from '../EditarObjetivo';
import type { DatosGeneral, OkrVista, AlertaVista } from '../datos-tipos';
import { Cabeza, DeQueFunnels, Fallo, Placeholder } from './comun';
import { OKRS_MUESTRA, ALERTAS_MUESTRA } from './muestras';

type D<K extends keyof DatosGeneral> = DatosGeneral[K];

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
      <circle cx={cx} cy={cx} r={r} fill="none" stroke="var(--gb-losa-2)" strokeWidth={9} />
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
  // `auto-fit` y no `auto-fill`: los OKRs que hay LLENAN la fila (con `auto-fill`, tres OKRs en una hoja entera dejaban
  // un tercio vacío a la derecha).
  grilla: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 'clamp(10px, 1.4cqi, 16px)' },
  // Una LOSA (./comun.tsx), no una tarjeta dentro de la tarjeta.
  okr: { display: 'flex', alignItems: 'center', gap: 'clamp(14px, 1.6cqi, 22px)', padding: 'clamp(14px, 1.6cqi, 20px)', borderRadius: 16, cursor: 'pointer', minWidth: 0, textAlign: 'left', width: '100%', height: '100%', boxSizing: 'border-box' },
  okrTit: { fontSize: 'clamp(16px, calc(1.2cqi + 10px), 22px)', fontWeight: 700, color: 'var(--ink)', lineHeight: 1.2, letterSpacing: '-0.015em', overflow: 'hidden', display: '-webkit-box', WebkitBoxOrient: 'vertical', WebkitLineClamp: 2 },
  okrMeta: { fontSize: 'clamp(14px, calc(0.6cqi + 11px), 17px)', color: 'var(--dim)' },
};

function TarjetaOkr({ o, anio, quarter }: { o: OkrVista; anio: number; quarter: number }) {
  const cuerpo = (
    <div style={S.okr} className="gb-losa" role="button" title="Editar este OKR">
      <Anillo pct={o.pct} fraccion={o.fraccion} color={colorOkr(o)} tam={108} />
      {/* Sin los chips del trimestre y de «Principal» (el trimestre ya está en el título del bloque): el estado, que es la
          respuesta, y nada más. */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6, minWidth: 0 }}>
        <span style={S.okrTit}>{o.titulo}</span>
        <span style={S.okrMeta} className="gb-num">{fmtOkr(o.actual, o.unidad)} de {fmtOkr(o.metaValor, o.unidad)}{o.quarter == null ? ` · año ${anio}` : ''}</span>
        <span style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}><Estado o={o} /><DeQueFunnels ids={o.funnelIds} /></span>
      </div>
    </div>
  );
  return <EditarObjetivo objetivo={o} anio={anio} quarter={quarter} disparador={cuerpo} />;
}

function FilaOkr({ o, anio, quarter }: { o: OkrVista; anio: number; quarter: number }) {
  const cuerpo = (
    <div className="gb-fila" style={{ flexDirection: 'column', alignItems: 'stretch', gap: 7, cursor: 'pointer' }} title="Editar este OKR">
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, minWidth: 0 }}>
        <span style={{ ...S.okrTit, WebkitLineClamp: 1, flex: 1 }}>{o.titulo}</span>
        <span className="gb-num" style={{ fontSize: 14, fontWeight: 700, color: colorOkr(o) }}>{o.pct == null ? '—' : `${o.pct}%`}</span>
      </div>
      <div aria-hidden style={{ position: 'relative', height: 8, borderRadius: 999, background: 'var(--gb-losa-2)', overflow: 'hidden' }}>
        <div style={{ width: `${o.pct ?? 0}%`, height: '100%', borderRadius: 999, background: colorOkr(o) }} />
        <div style={{ position: 'absolute', top: 0, bottom: 0, left: `${Math.round(o.fraccion * 100)}%`, width: 2, background: 'var(--ink)', opacity: 0.4 }} />
      </div>
      <span style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
        <span style={S.okrMeta} className="gb-num">{fmtOkr(o.actual, o.unidad)} de {fmtOkr(o.metaValor, o.unidad)}</span>
        <Estado o={o} />
        <DeQueFunnels ids={o.funnelIds} />
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
      {/* «＋ Nuevo OKR» va en la cabecera, como el link de cualquier bloque: abajo ocupaba un renglón entero. */}
      <Cabeza titulo="OKRs" extra={`Q${quarter} ${anio}`}
        accion={lista.length ? <EditarObjetivo objetivo={null} anio={anio} quarter={quarter} disparador={<span className="gb-cab-link">＋ Nuevo OKR</span>} /> : undefined} />
      {lista.length ? (
        <div className="gb-centro"><ListaOkrs lista={lista} anio={anio} quarter={quarter} estilo={estilo} /></div>
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
  return <div className="gb"><KpisCard kpis={kpis} candidatos={d.d.candidatos} objetivos={d.d.objetivos} objetivoPrincipalId={d.d.objetivoPrincipalId} /></div>;
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
  // El titular, de un vistazo (14/10/2026, Martín: «el bloque del semáforo tiene un espacio en blanco grande e
  // innecesario... textos enormes, cosas grandes»): cuántas cosas hay para atender, en grande y del color del semáforo.
  // Las lámparas van en fila al lado (antes una columna del alto de la tarjeta, que es el hueco que se veía).
  const atender = alertas.filter((a) => a.nivel !== 'verde').length;
  const titular = atender
    ? `${atender} ${atender === 1 ? 'cosa' : 'cosas'} para atender`
    : objetivoAtrasado ? 'Atrasado con la meta' : 'Todo en orden';
  const color = lampara === 'rojo' ? 'var(--bad)' : lampara === 'ambar' ? 'var(--warn)' : 'var(--good)';
  return (
    <div style={{ display: 'flex', flexDirection: 'column', minWidth: 0, flex: 1, minHeight: 0 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: vistas.length ? 10 : 0, minWidth: 0, flex: 'none' }}>
        {conLamparas && (
          <span aria-hidden style={{ flex: 'none', display: 'inline-flex', gap: 7, padding: '7px 9px', borderRadius: 999, background: 'var(--sidebar)' }}>
            <Lampara color="var(--bad)" encendida={lampara === 'rojo'} />
            <Lampara color="var(--warn-fill)" encendida={lampara === 'ambar'} />
            <Lampara color="var(--good)" encendida={lampara === 'verde'} />
          </span>
        )}
        <span className="gb-frase" style={{ color: atender || objetivoAtrasado ? color : 'var(--ink)' }}>{titular}</span>
      </div>
      {/* Sólo las alertas que ENTRAN enteras (`gb-cabe`, ./comun.tsx): una cortada a la mitad se lee como un bloque roto. */}
      <div className="gb-cabe">
      {vistas.map((a, i) => {
        const c = a.nivel === 'rojo' ? 'var(--bad)' : a.nivel === 'ambar' ? 'var(--warn-fill)' : 'var(--good)';
        const inner = (
          <>
            <span aria-hidden style={{ flex: 'none', width: 10, height: 10, borderRadius: '50%', background: c }} />
            <span className="gb-t" style={{ flex: 1, minWidth: 0, fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{a.titulo}</span>
            <span className="gb-d" style={{ flex: 'none', color: 'var(--faint)' }}>{a.desglose ? 'ver →' : `${a.hrefLabel} →`}</span>
          </>
        );
        const fila: CSSProperties = { display: 'flex', alignItems: 'center', gap: 12, width: '100%', padding: 'clamp(10px, 2cqi, 16px) 0', textDecoration: 'none', borderTop: '1px solid var(--border)' };
        return a.desglose
          ? <DesgloseTrigger key={i} data={a.desglose} style={fila}>{inner}</DesgloseTrigger>
          // Una alerta que nombra una integración (un arranque pendiente) abre su modal acá: nunca se sale de la tab.
          : <LinkIntegracion key={i} href={a.href} style={fila}>{inner}</LinkIntegracion>;
      })}
      </div>
      {resto > 0 && <p style={{ margin: '8px 0 0', fontSize: 13, color: 'var(--faint)' }}>{resto === 1 ? 'Y una más.' : `Y ${resto} más.`}</p>}
    </div>
  );
}

function Lampara({ color, encendida }: { color: string; encendida: boolean }) {
  return (
    <span aria-hidden style={{
      width: 16, height: 16, borderRadius: '50%', background: color,
      ...(encendida ? { boxShadow: `0 0 10px 2px color-mix(in srgb, ${color} 60%, transparent)` } : { opacity: 0.2 }),
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
