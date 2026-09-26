'use client';

// =============================================================================
// AsignarClienteModal — de quién es este trabajo
// =============================================================================
// Se abre desde el campo CLIENTE del detalle de una tarea o de un proyecto (mig 0172):
// buscás, elegís, listo. Una sola pantalla, sin confirmación y sin pedir un motivo —
// la misma poda que ya se le hizo a `AsignarProyecto.tsx`, y por lo mismo: el change
// history registra QUÉ cambió y QUIÉN lo hizo, que es lo que se audita.
//
// ⚠️ ES DE SELECCIÓN ÚNICA, y no es una limitación: un trabajo es de UN cliente. Si
// hicieran falta dos, eso son dos tareas — y el día que alguien quiera «compartido»,
// lo que quiere casi siempre es trabajo interno (`SIN_CLIENTE`).
//
// ⚠️ SE MONTA COMO HERMANO DEL DETALLE, NO ADENTRO. Es un overlay propio con su
// z-index, igual que `AsignarProyectoModal`, y por eso el detalle se sigue viendo
// debajo en vez de desaparecer. Un `<Modal>` de la casa escrito dentro de los
// `children` de otro es un DESCENDIENTE de un contenedor que la pila apaga con
// `display:none`, así que al abrirse se esconde a sí mismo — se reportó exactamente
// así el 26/09/2026 («cuando le doy a personalizado, se me cierra el detail»).

import { useMemo, useState } from 'react';
import { buscarClientes, etiquetaCliente, SIN_CLIENTE, type ClienteRef } from '@/lib/plan-clientes';

const SANS = "'Geist', sans-serif";
const MONO = "'Geist Mono', monospace";

export function AsignarClienteModal({ que, nombre, clientes, actualId, onElegir, onClose }: {
  /** «la tarea» / «el proyecto»: entra en el texto del vacío, que es el único lugar donde importa. */
  que: string;
  /** El título de la tarjeta que se está asignando. Se dice para que nadie asigne la equivocada. */
  nombre: string;
  clientes: ClienteRef[];
  /** El lead que tiene hoy, o `null`. Se marca en la lista y decide si el botón hace algo. */
  actualId: number | null;
  onElegir: (c: ClienteRef | null) => void;
  onClose: () => void;
}) {
  const [busca, setBusca] = useState('');
  const visibles = useMemo(() => buscarClientes(clientes, busca), [clientes, busca]);

  const elegir = (c: ClienteRef | null) => { onElegir(c); onClose(); };

  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, zIndex: 140, background: 'rgba(18,21,27,.5)', backdropFilter: 'blur(2px)', display: 'flex', alignItems: 'flex-start', justifyContent: 'center', padding: '7vh 20px 20px', fontFamily: SANS }}>
      <div onClick={(e) => e.stopPropagation()} style={{ width: '100%', maxWidth: 480, maxHeight: '78vh', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 18, boxShadow: '0 30px 70px rgba(18,21,27,.35)', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>

        <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, padding: '16px 20px 0', flex: 'none' }}>
          <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--ink)' }}>De quién es</span>
          {/* El nombre de la tarjeta, recortado: con dos detalles abiertos seguidos, elegir
              en el modal equivocado es un error que no avisa. */}
          <span style={{ fontSize: 12.5, color: 'var(--faint)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', minWidth: 0, flex: 1 }}>{nombre}</span>
          <button type="button" onClick={onClose} aria-label="Cerrar" style={{ border: 'none', background: 'transparent', color: 'var(--faint)', fontSize: 20, lineHeight: 1, cursor: 'pointer', padding: '2px 4px', flex: 'none' }}>×</button>
        </div>

        <div style={{ padding: '14px 20px 0', display: 'flex', flexDirection: 'column', gap: 10, minHeight: 0, flex: 1 }}>
          {/* El buscador SÓLO cuando hay de dónde buscar: con tres clientes es un control
              que ocupa lugar y no hace nada. El umbral es la lista completa, no la filtrada,
              o desaparecería justo cuando se usa. */}
          {clientes.length > 6 && (
            <input autoFocus value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Busca el cliente…"
              style={{ width: '100%', padding: '10px 13px', borderRadius: 10, border: '1px solid var(--border-strong)', background: 'var(--surface-2)', color: 'var(--ink)', fontSize: 14, outline: 'none', fontFamily: SANS, flex: 'none' }} />
          )}

          <div style={{ overflowY: 'auto', minHeight: 0, flex: 1, margin: '0 -6px', padding: '0 6px 4px' }}>
            {/* «Interno» es una OPCIÓN, no un botón de borrar: que un trabajo no sea de
                ningún cliente es una respuesta válida, y es la que tiene la mayoría. Va
                primera porque además es como se DESasigna. */}
            <Fila
              titulo={SIN_CLIENTE}
              sub="Trabajo del negocio, no de un cliente"
              elegido={actualId === null}
              onClick={() => elegir(null)}
            />
            {visibles.map((c) => (
              <Fila key={c.leadId}
                titulo={c.nombre}
                sub={c.empresa?.trim() || undefined}
                elegido={actualId === c.leadId}
                onClick={() => elegir(c)}
              />
            ))}
            {clientes.length === 0 && (
              // ⚠️ EL VACÍO DICE DE DÓNDE SALEN, que es la única pregunta que queda. Un
              // workspace que todavía no ganó ninguna venta no tiene clientes, y eso no es
              // un error: es el caso normal del día 1.
              <p style={{ margin: '18px 4px', fontSize: 13, lineHeight: 1.5, color: 'var(--dim)' }}>
                Todavía no tienes clientes. Un lead entra aquí cuando marcas su venta como ganada en el CRM.
              </p>
            )}
            {clientes.length > 0 && visibles.length === 0 && (
              <p style={{ margin: '18px 4px', fontSize: 13, lineHeight: 1.5, color: 'var(--dim)' }}>
                Ningún cliente coincide con «{busca.trim()}».
              </p>
            )}
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '12px 20px 16px', borderTop: '1px solid var(--border)', flex: 'none' }}>
          <span style={{ fontFamily: MONO, fontSize: 10.5, color: 'var(--faint)' }}>
            {`Se guarda en ${que} al elegir`}
          </span>
        </div>
      </div>
    </div>
  );
}

/** Una fila de la lista. Es un `<button>`, así que lleva `font`, `color` y `text-align`
 *  escritos: no los hereda, y sin eso sale centrada (AGENTS.md). */
function Fila({ titulo, sub, elegido, onClick }: {
  titulo: string; sub?: string; elegido: boolean; onClick: () => void;
}) {
  return (
    <button type="button" onClick={onClick}
      style={{ display: 'flex', alignItems: 'center', gap: 10, width: '100%', padding: '9px 10px', borderRadius: 10, border: `1px solid ${elegido ? 'var(--primary)' : 'transparent'}`, background: elegido ? 'var(--primary-bg)' : 'transparent', cursor: 'pointer', textAlign: 'left', font: 'inherit', color: 'inherit', fontFamily: SANS }}>
      {/* El tilde ocupa su lugar SIEMPRE (visibility, no display): sin eso las filas se
          corren una a una cuando cambiás de selección. */}
      <span aria-hidden style={{ flex: 'none', width: 14, color: 'var(--primary)', visibility: elegido ? 'visible' : 'hidden', fontSize: 13 }}>✓</span>
      <span style={{ display: 'flex', flexDirection: 'column', gap: 1, minWidth: 0, flex: 1 }}>
        <span style={{ fontSize: 13.5, fontWeight: elegido ? 650 : 500, color: 'var(--ink)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{titulo}</span>
        {sub && <span style={{ fontSize: 11.5, color: 'var(--faint)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{sub}</span>}
      </span>
    </button>
  );
}

/** El chip que pinta el detalle cuando la tarjeta YA tiene cliente. Vive acá y no en
 *  `BoardShell` para que la tarea y el proyecto no puedan dibujarlo distinto. */
export function ClienteChip({ nombre, onClick }: { nombre: string; onClick?: () => void }) {
  return (
    <button type="button" onClick={onClick} disabled={!onClick} title={onClick ? `Cambiar el cliente (${nombre})` : nombre}
      style={{ display: 'inline-flex', alignItems: 'center', gap: 6, maxWidth: '100%', fontSize: 11.5, fontWeight: 600, color: 'var(--ink)', background: 'var(--surface-2)', border: '1px solid var(--border-strong)', padding: '3px 9px', borderRadius: 6, cursor: onClick ? 'pointer' : 'default', fontFamily: SANS, overflow: 'hidden' }}>
      <span aria-hidden style={{ flex: 'none', fontSize: 10, color: 'var(--faint)' }}>◆</span>
      <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{nombre}</span>
    </button>
  );
}

export { etiquetaCliente };
