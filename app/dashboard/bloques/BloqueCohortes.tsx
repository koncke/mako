'use client';

// =============================================================================
// BloqueCohortes — las tablas de cohortes (mensual y semanal) con su madurez
// =============================================================================
// Las de la tab vieja (CohortesTable + CohorteRow de app/comercial/page.tsx, hasta 7527b8c2): las filas
// bajo dos banners —«Maduras · tasa confiable» y «Aún madurando · tasa parcial»—, las que no maduraron
// atenuadas, el estado (🟢 madura / 🟡 madurando / ⚪ reciente) y «ver leads →» por fila, con cada lead
// de esa cohorte (asistió, calificado, cerró).
//
// La madurez es de la COHORTE, no de la fila: la decide la vista (v_cohortes_*, mig 0084) con la última
// reunión 1 de la cohorte contra hoy. Por eso esto lee las vistas y no pasa por el agregador.
//
// ⚠️ La tasa de cierre es cierres ÷ calificadas («—» si la cohorte es reciente, «(parcial)» si está
//    madurando) y el ciclo es reunión 1 → cierre (sólo en la mensual): las definiciones de la vista,
//    que NO son las de la fuente «leads» del catálogo genérico.

import type { DesgloseData, DesgloseItem } from '@/app/_components/Desglose';
import type { EstadoMadurezCohorte, FunnelLeadItem } from '@/lib/queries';
import type { EstiloEfectivo } from '@/lib/graficos-temas';
import { claveCohorte, inicioDe, tasaCierre, type Cohorte, type DatosCohortes, type TipoCohorte } from './datos-comercial';
import { Abrible, MONO, fecha, num, usd } from './piezas';

const ESTADO: Record<EstadoMadurezCohorte, string> = { madura: '🟢 madura', madurando: '🟡 madurando', reciente: '⚪ reciente' };

function fmtMes(inicio: string): string {
  const [y, m, d] = inicio.slice(0, 10).split('-').map(Number);
  return new Intl.DateTimeFormat('es-MX', { month: 'long', year: 'numeric', timeZone: 'UTC' }).format(new Date(Date.UTC(y, m - 1, d)));
}

function itemDeLead(l: FunnelLeadItem): DesgloseItem {
  const asis = l.asistioJ1 === true ? '✓ asistió' : l.asistioJ1 === false ? '✗ no asistió' : '· s/d';
  return {
    nombre: l.nombre,
    valor: l.cerro ? usd(l.monto) : asis,
    detalle: `${l.empresa ? `${l.empresa} · ` : ''}R1 ${fecha(l.fechaJ1)}${l.calificado === true ? ' · calificado' : ''}${l.cerro ? ' · cerró' : ''}`,
    leadId: l.leadId,
    focus: l.cerro ? 'plan-pagos' : 'datos-comerciales',
  };
}

function Tasa({ tasa, estado }: { tasa: number | null; estado: EstadoMadurezCohorte }) {
  if (tasa == null || estado === 'reciente') return <span style={{ color: 'var(--faint)' }}>—</span>;
  const txt = `${Math.round(tasa)}%`;
  if (estado === 'madurando') return <span style={{ color: 'var(--dim)' }}>{txt} <span style={{ fontSize: 12 }}>(parcial)</span></span>;
  return <span style={{ color: 'var(--good)' }}>{txt}</span>;
}

function NoShow({ total, asistencias }: { total: number; asistencias: number }) {
  if (total === 0) return <span style={{ color: 'var(--faint)' }}>—</span>;
  const p = ((total - asistencias) / total) * 100;
  return <span style={{ color: p > 35 ? 'var(--bad)' : 'var(--dim)' }}>{Math.round(p)}%</span>;
}

export function BloqueCohortes({ d, estilo }: { d: DatosCohortes; estilo: EstiloEfectivo }) {
  const tipo: TipoCohorte = d.bloque === 'cohortes_mes' ? 'mes' : 'semana';
  const conCiclo = tipo === 'mes';
  const maduras = d.cohortes.filter((c) => c.estado_madurez === 'madura');
  const inmaduras = d.cohortes.filter((c) => c.estado_madurez !== 'madura');
  const columnas = conCiclo ? 11 : 10;

  if (!d.cohortes.length) return <div className="bq-msg">Sin cohortes en este período</div>;

  const desgloseDe = (c: Cohorte): DesgloseData | null => {
    const inicio = inicioDe(c);
    const leads = d.leads[claveCohorte(inicio, tipo)] ?? [];
    if (!leads.length) return null;
    return {
      label: `Cohorte · ${tipo === 'mes' ? fmtMes(inicio) : fecha(inicio)}`,
      value: `${leads.filter((l) => l.cerro).length}/${leads.length} cerraron`,
      color: 'var(--ink)',
      items: leads.map(itemDeLead),
    };
  };

  const banner = (texto: string, color: string, fondo: string) => (
    <tr>
      <td colSpan={columnas} style={{ padding: '8px 14px', background: fondo, fontFamily: MONO, fontSize: 10.5, letterSpacing: '.1em', textTransform: 'uppercase', color }}>{texto}</td>
    </tr>
  );

  const fila = (c: Cohorte, atenuada: boolean) => {
    const inicio = inicioDe(c);
    const dg = desgloseDe(c);
    const ciclo = c.dias_promedio_ciclo;
    return (
      <tr key={inicio} style={{ opacity: atenuada ? 0.62 : 1 }}>
        <td style={{ fontWeight: 500, color: 'var(--ink)', whiteSpace: 'nowrap' }}>{tipo === 'mes' ? fmtMes(inicio) : fecha(inicio)}</td>
        <td className="bq-der">{num(c.total_j1)}</td>
        <td className="bq-der">{num(c.asistencias)}</td>
        <td className="bq-der"><NoShow total={c.total_j1} asistencias={c.asistencias} /></td>
        <td className="bq-der">{num(c.limpias)}</td>
        <td className="bq-der">{num(c.cierres)}</td>
        <td className="bq-der"><Tasa tasa={tasaCierre(c.cierres, c.limpias)} estado={c.estado_madurez} /></td>
        {conCiclo && <td className="bq-der" style={{ color: ciclo != null ? 'var(--dim)' : 'var(--faint)' }}>{ciclo != null ? Number(ciclo).toFixed(1) : '—'}</td>}
        <td className="bq-der" style={{ color: c.cierres > 0 ? 'var(--good)' : 'var(--faint)' }}>{c.cierres > 0 ? usd(Number(c.ingreso_total_usd), estilo.compacto) : '—'}</td>
        <td style={{ color: 'var(--dim)', whiteSpace: 'nowrap' }}>{ESTADO[c.estado_madurez] ?? c.estado_madurez}</td>
        <td>
          {dg ? (
            <Abrible data={dg} style={{ width: 'auto', display: 'inline-block' }}><span className="bq-link">ver leads →</span></Abrible>
          ) : <span style={{ color: 'var(--faint)', fontSize: 12.5 }}>—</span>}
        </td>
      </tr>
    );
  };

  return (
    <div className="bq-scroll">
      <table className="bq-tabla" style={{ minWidth: conCiclo ? 820 : 700, fontSize: conCiclo ? 14.5 : 14 }}>
        <thead>
          <tr>
            <th>{conCiclo ? 'Mes' : 'Semana de'}</th>
            <th className="bq-der">R1</th>
            <th className="bq-der">Asistió</th>
            <th className="bq-der">No-show</th>
            <th className="bq-der">Calificadas</th>
            <th className="bq-der">Cierres</th>
            <th className="bq-der">{conCiclo ? 'Tasa cierre' : 'Tasa'}</th>
            {conCiclo && <th className="bq-der">Ciclo (d)</th>}
            <th className="bq-der">Ventas</th>
            <th>Estado</th>
            <th>Detalle</th>
          </tr>
        </thead>
        <tbody>
          {maduras.length > 0 && banner('Maduras · tasa confiable', 'var(--good)', 'var(--good-bg)')}
          {maduras.map((c) => fila(c, false))}
          {inmaduras.length > 0 && banner('Aún madurando · tasa parcial', 'var(--warn)', 'var(--surface-2)')}
          {inmaduras.map((c) => fila(c, true))}
        </tbody>
      </table>
    </div>
  );
}
