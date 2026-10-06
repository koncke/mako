'use client';

// =============================================================================
// AvanceCurso — dónde va cada cliente en el curso de un producto
// =============================================================================
// «Que también se mida cuánto del vídeo se vieron, cuáles tareas completaron» (Martín,
// 06/10/2026), y de Mauricio el 9/9: poder ver quién vio cada clase y quién hizo la tarea.
//
// Una fila por cliente del producto: su etapa, las tareas que envió en CADA etapa (la suya
// resaltada), cuánto vio de los videos de su etapa y cuándo entró por última vez a su portal.
// Todo llega armado del server (page.tsx → `avanceDeCliente`): acá sólo se dibuja.
//
// ⚠️ «SIN MEDIR» NO ES 0%. Drive y Loom se ven pero no avisan cuánto; un 0% ahí se lee como
// «no lo vio» y es mentira. Y «—» es que su etapa no tiene video.

import { EmptyState, Banner, Tooltip } from '@/app/_ui';
import type { FilaAvance } from './reglas';

export type EtapaVista = { key: string; label: string; color: string };

export function AvanceCurso({ etapas, filas, error }: {
  etapas: EtapaVista[];
  filas: FilaAvance[];
  error: string | null;
}) {
  if (error) return <Banner tono="bad">No pude leer el avance. {error}</Banner>;
  if (!filas.length) {
    return <EmptyState titulo="Sin clientes en este producto" detalle="Cuando ganes uno, su avance aparece aquí." />;
  }
  return (
    <div className="mk-scroll-x">
      <table className="av">
        <thead>
          <tr>
            <th className="av-cli">Cliente</th>
            <th>Etapa</th>
            {etapas.map((e) => (
              <th key={e.key} className="av-n" title={e.label}>
                <span className="av-dot" style={{ background: e.color }} aria-hidden />
                {corto(e.label)}
              </th>
            ))}
            <th className="av-n">Visto</th>
            <th>Último ingreso</th>
          </tr>
        </thead>
        <tbody>
          {filas.map((f) => {
            const etapa = etapas.find((e) => e.key === f.etapa);
            return (
              <tr key={f.leadId}>
                <td className="av-cli">
                  <div className="av-nombre">{f.nombre || 'Sin nombre'}</div>
                  {f.empresa && <div className="av-sub">{f.empresa}</div>}
                </td>
                <td>{etapa ? <span className="av-etapa"><span className="av-dot" style={{ background: etapa.color }} aria-hidden />{etapa.label}</span> : '—'}</td>
                {etapas.map((e) => {
                  const c = f.porEtapa[e.key];
                  const suya = e.key === f.etapa;
                  if (!c || c.total === 0) return <td key={e.key} className={`av-n${suya ? ' is-suya' : ''}`}><span className="av-vacio">·</span></td>;
                  const listo = c.enviadas >= c.total;
                  return (
                    <td key={e.key} className={`av-n${suya ? ' is-suya' : ''}${listo ? ' is-listo' : ''}`}>
                      {c.enviadas}/{c.total}
                    </td>
                  );
                })}
                <td className="av-n">
                  {f.pctVisto != null ? `${f.pctVisto}%`
                    : f.videosSinMedir > 0 ? <Tooltip text="Drive o Loom no avisan cuánto se vio."><span className="av-sub">sin medir</span></Tooltip>
                    : <span className="av-vacio">—</span>}
                </td>
                <td><Ingreso f={f} /></td>
              </tr>
            );
          })}
        </tbody>
      </table>
      <style dangerouslySetInnerHTML={{ __html: CSS }} />
    </div>
  );
}

function Ingreso({ f }: { f: FilaAvance }) {
  if (!f.acceso) return <span className="av-vacio">—</span>;
  if (f.acceso.estado === 'cortado') return <span className="av-mal">Acceso cortado</span>;
  if (!f.acceso.ultimoIngresoAt) return <span className="av-sub">{f.acceso.estado === 'sin-link' ? 'Sin link' : 'Nunca'}</span>;
  // ⚠️ La fecha se formatea en el NAVEGADOR (su zona horaria): el server corre en UTC y la
  // misma fila diría otro día según quién la dibujó. Por eso `suppressHydrationWarning`.
  return (
    <span suppressHydrationWarning title={`${f.acceso.ingresos} ${f.acceso.ingresos === 1 ? 'ingreso' : 'ingresos'}`}>
      {new Date(f.acceso.ultimoIngresoAt).toLocaleDateString('es-MX', { day: 'numeric', month: 'short' })}
    </span>
  );
}

/** El rótulo de una columna de etapa: corto, para que nueve entren sin romper la tabla. */
const corto = (s: string) => (s.length > 12 ? `${s.slice(0, 11)}…` : s);

const CSS = `
.av{ width:100%; border-collapse:collapse; font-size:var(--fs-sm); }
.av th{ text-align:left; font-weight:600; color:var(--dim); font-size:var(--fs-meta); padding:8px 10px; border-bottom:1px solid var(--border); white-space:nowrap; }
.av td{ padding:9px 10px; border-bottom:1px solid var(--border); vertical-align:middle; white-space:nowrap; color:var(--ink); }
.av tr:hover td{ background:var(--surface-2); }
.av-cli{ min-width:180px; position:sticky; left:0; background:var(--surface); z-index:1; }
.av tr:hover .av-cli{ background:var(--surface-2); }
.av-nombre{ font-weight:600; }
.av-sub{ font-size:var(--fs-meta); color:var(--dim); }
.av-n{ text-align:center !important; font-variant-numeric:tabular-nums; }
.av-n.is-suya{ background:var(--primary-bg); font-weight:600; }
.av-n.is-listo{ color:var(--good); }
.av-vacio{ color:var(--faint); }
.av-mal{ color:var(--bad); font-size:var(--fs-meta); }
.av-dot{ display:inline-block; width:8px; height:8px; border-radius:999px; margin-right:6px; vertical-align:middle; }
.av-etapa{ display:inline-flex; align-items:center; }
`;
