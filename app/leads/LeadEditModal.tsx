'use client';

// =============================================================================
// LeadEditModal — carga la ficha completa on-demand y la muestra como modal
// =============================================================================
// Wrapper fino: trae getLeadFullAction (Lead completo + etapas + plan + VSL +
// visitas) y monta LeadSheet (preview de solo lectura + Editar → /leads/[id]).
// Se abre desde el CRM, WhatsApp y los desgloses. pendingMove llega cuando el
// Kanban mueve a una etapa que exige completar datos.

import { useEffect, useState, type CSSProperties } from 'react';
import { useRouter } from 'next/navigation';
import { LeadSheet, type PendingMoveInfo } from './LeadSheet';
import { getLeadFullAction, type LeadFullData } from './actions';

const SANS = "'Geist', sans-serif";
const overlay: CSSProperties = { position: 'fixed', inset: 0, zIndex: 80, background: 'rgba(18,21,27,.52)', backdropFilter: 'blur(3px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 };
const box: CSSProperties = { background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 16, padding: '22px 26px', fontFamily: SANS, fontSize: 14, color: 'var(--dim)' };

export function LeadEditModal({
  leadId,
  pendingMove,
  focus,
  onClose,
}: {
  leadId: number;
  /** Sección de foco (compat desgloses) — el preview scrollea a lead-sec-<focus>. */
  focus?: string;
  /** Movimiento del Kanban que exige completar datos antes de mover. */
  pendingMove?: PendingMoveInfo | null;
  onClose: () => void;
}) {
  const router = useRouter();
  const [data, setData] = useState<LeadFullData | null>(null);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    let alive = true;
    getLeadFullAction(leadId)
      .then((d) => { if (!alive) return; if (!d) setNotFound(true); else setData(d); })
      .catch(() => { if (alive) setNotFound(true); });
    return () => { alive = false; };
  }, [leadId]);

  if (notFound) {
    return (
      <div onClick={onClose} style={overlay}>
        <div onClick={(e) => e.stopPropagation()} style={box}>
          No se pudo cargar el lead. <button onClick={onClose} style={{ marginLeft: 10, background: 'none', border: 'none', color: 'var(--accent)', cursor: 'pointer', fontWeight: 600 }}>Cerrar</button>
        </div>
      </div>
    );
  }

  if (!data) {
    return (
      <div onClick={onClose} style={overlay}>
        <div onClick={(e) => e.stopPropagation()} style={box}>Cargando ficha…</div>
      </div>
    );
  }

  // router.refresh al cerrar: sincroniza la vista de atrás (board/desglose) con
  // lo que haya pasado en la ficha (completar movimiento, borrado).
  const close = () => { router.refresh(); onClose(); };

  return <LeadSheet data={data} onClose={close} pendingMove={pendingMove} focus={focus} />;
}
