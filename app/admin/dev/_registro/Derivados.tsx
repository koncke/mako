'use client';

// =============================================================================
// Los dos paneles que NO se escriben a mano
// =============================================================================
// Con seis áreas, un Roadmap y un Change History escritos a mano eran realistas.
// Con 121 serían 121 listas quedándose viejas en paralelo, y `areas.ts` ya tiene
// la sentencia sobre eso: «uno inventado de antemano es peor que ninguno: se lee
// como verdad y no lo es».
//
// Así que se derivan de donde el dato YA vive:
//   · el Roadmap, de las tareas abiertas del plan (el área declara sus proyectos);
//   · el Change History, de `git log` sobre las rutas de `vive`.
//
// Donde hay bitácora escrita a mano manda ella y esto va abajo: la bitácora tiene
// el pedido TEXTUAL del dueño y el porqué de cada decisión, que ningún mensaje de
// commit contiene.

import { EmptyState } from '@/app/_ui';
import type { CommitArea } from '../_historial.generado';
import type { TareaRoadmap } from '../roadmap';

const caja: React.CSSProperties = {
  background: 'var(--surface)', border: '1px solid var(--border)',
  borderRadius: 12, overflow: 'hidden', marginTop: 20,
};
const cabecera: React.CSSProperties = {
  display: 'flex', alignItems: 'baseline', gap: 10,
  padding: '15px 20px 12px', borderBottom: '1px solid var(--border)',
};
const titulo: React.CSSProperties = { margin: 0, fontSize: 15, fontWeight: 640, letterSpacing: '-0.01em' };
const contador: React.CSSProperties = { marginLeft: 'auto', fontSize: 12.5, color: 'var(--faint)', fontVariantNumeric: 'tabular-nums' };

/** El color de la prioridad, con el mismo corte que el tablero. */
const tono = (score: number) =>
  score >= 75 ? 'var(--bad)' : score >= 50 ? 'var(--warn-fill)' : score >= 25 ? 'var(--good)' : 'var(--faint)';

export function RoadmapDelPlan({ tareas, proyectos }: { tareas: TareaRoadmap[]; proyectos: string[] }) {
  if (!proyectos.length) {
    return (
      <div style={caja}>
        <div style={cabecera}><h3 style={titulo}>Roadmap</h3></div>
        <EmptyState
          titulo="Esta área todavía no tiene proyecto en el plan"
          detalle="El Roadmap sale de las tareas abiertas del tablero. Para que aparezca acá, el área tiene que declarar sus proyectos en areas.ts."
        />
      </div>
    );
  }
  return (
    <div style={caja}>
      <div style={cabecera}>
        <h3 style={titulo}>Roadmap</h3>
        <span style={{ fontSize: 12.5, color: 'var(--dim)' }}>del plan · {proyectos.join(' · ')}</span>
        <span style={contador}>{tareas.length}</span>
      </div>
      {tareas.length === 0 ? (
        <EmptyState titulo="Nada abierto" detalle="No quedan tareas pendientes de esta área en el tablero." />
      ) : (
        <ul style={{ listStyle: 'none', margin: 0, padding: 0 }}>
          {tareas.map((t) => (
            <li
              key={`${t.num}-${t.proyecto}`}
              style={{ display: 'grid', gridTemplateColumns: '3px 52px 1fr auto', gap: 12, alignItems: 'baseline', padding: '9px 20px 9px 0', borderTop: '1px solid var(--border)' }}
            >
              <span style={{ alignSelf: 'stretch', background: tono(t.score), borderRadius: '0 2px 2px 0' }} aria-hidden />
              <span style={{ fontFamily: 'var(--mono, ui-monospace, monospace)', fontSize: 12, color: 'var(--faint)' }}>#{t.num}</span>
              <span>{t.titulo}</span>
              <span style={{ fontSize: 12, color: 'var(--dim)', fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }}>
                {t.progreso > 0 && <span style={{ color: 'var(--good)' }}>{t.progreso}% · </span>}
                {t.deadline ? `${t.deadline.slice(5, 10)} · ` : ''}{t.score}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export function HistorialDeGit({ commits, conBitacora }: { commits: CommitArea[]; conBitacora: boolean }) {
  if (!commits.length) {
    return (
      <div style={caja}>
        <div style={cabecera}><h3 style={titulo}>Change History</h3></div>
        <EmptyState
          titulo="Todavía no hay commits sobre esta área"
          detalle="Sale de git, corriendo sobre las rutas que el área declara en `vive`. Si el área no tiene código todavía, es lo esperable."
        />
      </div>
    );
  }
  return (
    <div style={caja}>
      <div style={cabecera}>
        <h3 style={titulo}>{conBitacora ? 'Commits sobre esta área' : 'Change History'}</h3>
        <span style={{ fontSize: 12.5, color: 'var(--dim)' }}>de git, sobre los archivos del área</span>
        <span style={contador}>{commits.length}</span>
      </div>
      <ul style={{ listStyle: 'none', margin: 0, padding: 0 }}>
        {commits.map((c) => (
          <li key={c.sha} style={{ padding: '11px 20px', borderTop: '1px solid var(--border)' }}>
            <div style={{ display: 'flex', gap: 10, alignItems: 'baseline', flexWrap: 'wrap' }}>
              <code style={{ fontSize: 11.5, color: 'var(--faint)' }}>{c.sha}</code>
              <span style={{ fontWeight: 540 }}>{c.titulo}</span>
              <span style={{ marginLeft: 'auto', fontSize: 11.5, color: 'var(--faint)', fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }}>
                {/* Sin trailer no se sabe qué cuenta lo hizo, y no se inventa. */}
                {c.cuenta ? `${c.cuenta} · ` : ''}{c.fecha}
              </span>
            </div>
            {c.porque && <p style={{ margin: '4px 0 0', fontSize: 12.5, color: 'var(--dim)', maxWidth: '80ch' }}>{c.porque}</p>}
          </li>
        ))}
      </ul>
    </div>
  );
}

export function Trampa({ nota }: { nota: string }) {
  return (
    <div style={{ ...caja, borderColor: 'var(--warn-fill)', background: 'var(--warn-bg)' }}>
      <div style={{ padding: '13px 20px' }}>
        <strong style={{ fontSize: 12.5, letterSpacing: '0.04em', textTransform: 'uppercase', color: 'var(--warn)' }}>
          Antes de tocarla
        </strong>
        <p style={{ margin: '5px 0 0', fontSize: 13.5, maxWidth: '82ch' }}>{nota}</p>
      </div>
    </div>
  );
}
