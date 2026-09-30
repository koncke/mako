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
import type { Auditoria } from './tipos';

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

/**
 * Las tareas abiertas del tablero para esta área.
 *
 * ⚠️ Se llama «Tareas abiertas» en pantalla y no «Roadmap», aunque la función
 * conserve el nombre: convive con el Roadmap escrito a mano en la MISMA tab, y
 * dos secciones con el mismo `<h3>` no se distinguen — el subtítulo chiquito no
 * alcanza para decir cuál es cuál. Son dos cosas distintas: una es el plan que
 * escribimos, la otra es lo que hoy está abierto en el board.
 */
/**
 * El veredicto de una auditoría, pegado a la tarea que juzga.
 *
 * ⚠️ VA CON SU FECHA A LA VISTA, y no es decoración: un veredicto sin fecha se lee como
 * el estado de HOY, y el día que alguien arregle la tarea la línea miente sin que nada
 * avise. Es una foto, y la pantalla lo dice.
 *
 * ⚠️ Y EL COLOR NO ES EL ÚNICO PORTADOR: el rótulo va escrito al lado, como el resto
 * de los chips de esta pantalla.
 */
const AUD = {
  medias: { t: 'A medias', bg: 'var(--warn-bg)', c: 'var(--warn)' },
  sin: { t: 'Sin empezar', bg: 'var(--surface-2)', c: 'var(--faint)' },
} as const;

function ChipAuditoria({ estado }: { estado: 'medias' | 'sin' }) {
  const c = AUD[estado];
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 5, flex: 'none', padding: '2px 8px', borderRadius: 999,
      fontSize: 11, fontWeight: 600, whiteSpace: 'nowrap', background: c.bg, color: c.c,
      border: `1px solid ${estado === 'sin' ? 'var(--border-strong)' : `color-mix(in srgb, ${c.c} 35%, transparent)`}`,
    }}>
      {estado === 'medias' && <span style={{ width: 5, height: 5, borderRadius: '50%', background: 'currentColor' }} />}
      {c.t}
    </span>
  );
}

export function RoadmapDelPlan({ tareas, proyectos, auditoria }: { tareas: TareaRoadmap[]; proyectos: string[]; auditoria?: Auditoria }) {
  if (!proyectos.length) {
    return (
      <div style={caja}>
        <div style={cabecera}><h3 style={titulo}>Tareas abiertas</h3></div>
        <EmptyState
          titulo="Esta área todavía no tiene proyecto en el plan"
          detalle="El Roadmap sale de las tareas abiertas del tablero. Para que aparezca acá, el área tiene que declarar sus proyectos en areas.ts."
        />
      </div>
    );
  }
  // Sólo cuenta las que están EN PANTALLA: una auditoría puede traer filas de tareas que
  // desde entonces se cerraron, y contarlas diría «25 de 23».
  const aud = auditoria;
  const medidas = aud ? tareas.filter((t) => aud.filas[t.num]).length : 0;
  const nMedias = aud ? tareas.filter((t) => aud.filas[t.num]?.estado === 'medias').length : 0;
  const nSin = medidas - nMedias;
  // ⚠️ EL % Y EL VEREDICTO SALEN DE DOS LUGARES, y cuando se contradicen hay que DECIRLO.
  // El avance lo escribió una persona en la tarjeta; el veredicto salió de ir a leer el
  // código. Dibujar los dos al lado sin nombrar la diferencia deja la fila afirmando «75%»
  // y «sin empezar» a la vez, que se lee como que la pantalla está rota — cuando en
  // realidad es el dato más útil de acá: ese avance no lo respalda nada.
  const infladas = aud ? tareas.filter((t) => aud.filas[t.num]?.estado === 'sin' && t.progreso > 0) : [];
  return (
    <div style={caja}>
      <div style={cabecera}>
        <h3 style={titulo}>Tareas abiertas</h3>
        <span style={{ fontSize: 12.5, color: 'var(--dim)' }}>en el tablero · {proyectos.join(' · ')}</span>
        <span style={contador}>{tareas.length}</span>
      </div>
      {/* ⚠️ LA FECHA VA ARRIBA Y UNA SOLA VEZ, no repetida en cada fila: es la misma para
          todas, y repetirla 25 veces es ruido. Lo que cada fila tiene que decir es SU
          veredicto. */}
      {aud && (
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, flexWrap: 'wrap', padding: '10px 20px', background: 'var(--surface-2)', borderBottom: '1px solid var(--border)', fontSize: 12.5, color: 'var(--dim)' }}>
          <strong style={{ color: 'var(--ink)', fontWeight: 620 }}>{medidas} de {tareas.length} medidas contra el código</strong>
          <span>· {nMedias} a medias · {nSin} sin empezar · ninguna cerrable</span>
          {infladas.length > 0 && (
            <span style={{ color: 'var(--warn)' }}>
              · {infladas.length === 1 ? 'una marca' : `${infladas.length} marcan`} avance que el código no respalda ({infladas.map((t) => `#${t.num}`).join(', ')})
            </span>
          )}
          <span style={{ marginLeft: 'auto', whiteSpace: 'nowrap' }}>
            {aud.fecha}
            {aud.doc && <> · <a href={`/admin/docs?d=${aud.doc}`} style={{ color: 'var(--primary)' }}>ver el detalle</a></>}
          </span>
        </div>
      )}
      {tareas.length === 0 ? (
        <EmptyState titulo="Nada abierto" detalle="No quedan tareas pendientes de esta área en el tablero." />
      ) : (
        <ul style={{ listStyle: 'none', margin: 0, padding: 0 }}>
          {tareas.map((t) => (
            <li
              key={`${t.num}-${t.proyecto}`}
              style={{ display: 'grid', gridTemplateColumns: '3px 52px minmax(0,1fr) auto', gap: 12, alignItems: 'baseline', padding: '10px 20px 10px 0', borderTop: '1px solid var(--border)' }}
            >
              <span style={{ alignSelf: 'stretch', background: tono(t.score), borderRadius: '0 2px 2px 0' }} aria-hidden />
              <span style={{ fontFamily: 'var(--mono, ui-monospace, monospace)', fontSize: 12, color: 'var(--faint)' }}>#{t.num}</span>
              <span style={{ minWidth: 0 }}>
                <span style={{ display: 'flex', alignItems: 'baseline', gap: 8, flexWrap: 'wrap' }}>
                  <span>{t.titulo}</span>
                  {aud?.filas[t.num] && <ChipAuditoria estado={aud.filas[t.num].estado} />}
                </span>
                {aud?.filas[t.num] && (
                  <span style={{ display: 'block', marginTop: 3, fontSize: 12.5, lineHeight: 1.45, color: 'var(--dim)' }}>
                    {aud.filas[t.num].falta}
                  </span>
                )}
              </span>
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
