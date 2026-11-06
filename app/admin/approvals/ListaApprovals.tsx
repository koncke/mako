'use client';

// =============================================================================
// ListaApprovals — las filas de Approvals en la computadora (5/11/2026)
// =============================================================================
// Copiado de la lista de «Deployments» de Vercel: una fila por cosa, el estado como un punto de color con su palabra al lado
// («● Ready», «● Error»), lo secundario en gris debajo del nombre, el tiempo relativo a la derecha y el link al final. Lo que
// pide algo va arriba (el orden lo decide `listaDeAprobaciones`, lib/vigia-aprobaciones.ts: la pantalla no reordena).
// ⚠️ Desde la nube no se pudo abrir vercel.com (el proxy no llega): la estructura sale de conocer la pantalla, no de una
//    captura de hoy. Los colores, la letra y la pastilla son los de la casa (`Status` de app/_ui).
//
// Lo que falta para leer algo solo se carga AHÍ, con el modal de su tarjeta de Integraciones (`BotonIntegracion`): nunca un
// link que saque de la pantalla (AGENTS.md, «para conectar una integración jamás se sale de la tab»).
// ⚠️ NINGÚN BACKTICK EN EL CSS DE ABAJO.
// =============================================================================

import { Status } from '@/app/_ui';
import { BotonIntegracion } from '@/app/_components/ConectarIntegracion';
import { haceTxtCorto } from '@/lib/admin-errores-reglas';
import type { FilaLista, TonoFila } from '@/lib/vigia-aprobaciones';

const TONO: Record<TonoFila, 'bad' | 'warn' | 'info' | 'neutral' | 'good'> = { bad: 'bad', warn: 'warn', info: 'info', neutral: 'neutral', good: 'good' };

export function ListaApprovals({ filas, ahoraMs }: { filas: readonly FilaLista[]; ahoraMs: number }) {
  return (
    <div className="apr">
      <style>{CSS}</style>
      <div className="apr-lista" role="list" aria-label="Aprobaciones">
        {filas.map((f) => (
          <div key={f.id} className="apr-fila" role="listitem">
            <div className="apr-nombre">
              <div className="apr-titulo">
                {f.nombre}
                {f.version && <span className="apr-version">{f.version}</span>}
              </div>
              {f.detalle && <div className="apr-sub">{f.detalle}</div>}
              {f.queHacer && <div className="apr-sub apr-hacer">{f.queHacer}</div>}
              {f.motivo && <div className="apr-sub">No pude leerlo: {f.motivo}</div>}
              {f.falta.map((x) => (
                <div key={x.texto} className="apr-sub">
                  Para leerlo solo falta: {x.texto.charAt(0).toLowerCase() + x.texto.slice(1)}
                  {x.integracion && (
                    <>
                      {' · '}
                      <BotonIntegracion servicio={x.integracion} className="apr-cargar">Cargarla</BotonIntegracion>
                    </>
                  )}
                </div>
              ))}
              {f.nota && <div className="apr-sub apr-nota">{f.nota}</div>}
            </div>
            <div className="apr-estado">
              <Status tono={TONO[f.tono]}>{f.estadoCorto}</Status>
              {f.desde && <span className="apr-tiempo">{desdeTxt(f.desde, ahoraMs)}</span>}
            </div>
            <div className={f.viejo ? 'apr-tiempo apr-viejo' : 'apr-tiempo'}>
              {f.leido ? `Leído ${haceTxtCorto(f.leido, ahoraMs)}${f.viejo ? ' (viejo)' : ''}` : 'Sin leer todavía'}
            </div>
            <a className="apr-abrir" href={f.link} target="_blank" rel="noopener noreferrer" aria-label={`Abrir ${f.nombre}`}>
              Abrir ↗
            </a>
          </div>
        ))}
      </div>
    </div>
  );
}

/** «Desde hace 3 días»: cuánto lleva en este estado. */
function desdeTxt(iso: string, ahoraMs: number): string {
  const h = haceTxtCorto(iso, ahoraMs);
  return h.startsWith('hace') ? `Desde ${h}` : h;
}

const CSS = `
.apr { container-type: inline-size; }
.apr-lista { background: var(--surface); border: 1px solid var(--border); border-radius: 12px; overflow: hidden; }
.apr-fila { display: grid; grid-template-columns: minmax(0, 1fr) minmax(130px, 170px) minmax(110px, 150px) auto; gap: 16px;
  align-items: start; padding: 14px 18px; border-top: 1px solid var(--border); }
.apr-fila:first-child { border-top: none; }
.apr-fila > * { min-width: 0; }
.apr-titulo { font-weight: 600; color: var(--ink); font-size: 14px; line-height: 1.4; overflow-wrap: anywhere; }
.apr-version { margin-left: 8px; font-family: 'Geist Mono', monospace; font-size: 12px; color: var(--dim); font-weight: 400; }
.apr-sub { margin-top: 3px; font-size: 13px; line-height: 1.45; color: var(--dim); overflow-wrap: anywhere; }
.apr-hacer { color: var(--ink); }
.apr-nota { font-size: 12.5px; }
.apr-cargar { color: var(--primary); font-weight: 600; background: none; border: none; padding: 0; cursor: pointer; font: inherit; }
.apr-cargar:hover { text-decoration: underline; }
.apr-estado { display: flex; flex-direction: column; align-items: flex-start; gap: 4px; }
.apr-tiempo { font-size: 12.5px; color: var(--dim); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 100%; }
.apr-viejo { color: var(--warn); }
.apr-abrir { font-size: 13px; font-weight: 600; color: var(--ink); text-decoration: none; padding: 5px 10px; border: 1px solid var(--border-strong);
  border-radius: 8px; white-space: nowrap; }
.apr-abrir:hover { background: var(--surface-2); }
@container (max-width: 720px) {
  .apr-fila { grid-template-columns: minmax(0, 1fr) auto; }
  .apr-estado { grid-column: 1; grid-row: 1; flex-direction: row; align-items: center; gap: 10px; }
  .apr-nombre { grid-column: 1 / -1; grid-row: 2; }
  .apr-fila > .apr-tiempo { grid-column: 1; grid-row: 3; }
  .apr-abrir { grid-column: 2; grid-row: 1; }
}
`;
