'use client';

// =============================================================================
// LeadEditModal — ficha editable del lead, abrible desde cualquier desglose
// =============================================================================
// Carga el lead on-demand (getCrmLeadAction) y reutiliza el MISMO editor del CRM
// (LeadDetail) con sus server actions. Se monta por encima del modal de desglose
// (zIndex alto) y salta a la sección indicada por `focus`.

import { useEffect, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { LeadDetail } from './LeadDetail';
import { seedEdits, missingFor, sectionForStage } from './edit-logic';
import {
  getCrmLeadAction,
  saveLeadMetaAction,
  setLeadStageAction,
  deleteLeadInlineAction,
} from './actions';
import type { CrmLead, Edits, PendingMove } from './CrmBoard';
import type { Stage } from '@/lib/pipeline';

const SANS = "'Geist', sans-serif";

export function LeadEditModal({
  leadId,
  focus,
  onClose,
}: {
  leadId: number;
  focus?: string;
  onClose: () => void;
}) {
  const router = useRouter();
  const [, startTransition] = useTransition();

  const [lead, setLead] = useState<CrmLead | null>(null);
  const [stages, setStages] = useState<Stage[]>([]);
  const [edits, setEdits] = useState<Edits | null>(null);
  const [localStage, setLocalStage] = useState<string | null>(null);
  const [pendingMove, setPendingMove] = useState<PendingMove | null>(null);
  const [moveError, setMoveError] = useState(false);
  const [saveError, setSaveError] = useState(false);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    let alive = true;
    getCrmLeadAction(leadId)
      .then((d) => {
        if (!alive) return;
        if (!d) { setNotFound(true); return; }
        setLead(d.lead);
        setStages(d.stages);
        setEdits(seedEdits(d.lead, d.lead.stage));
      })
      .catch(() => { if (alive) setNotFound(true); });
    return () => { alive = false; };
  }, [leadId]);

  const effStage = (l: CrmLead): string => localStage ?? l.stage;

  const onPickStage = (key: string) => {
    if (!lead || !edits) return;
    if (key === effStage(lead)) { setPendingMove(null); setMoveError(false); return; }
    // Igual que el tablero: las etapas con sección a completar (motivo, plan,
    // nutrición) o con un obligatorio faltante pasan por la ficha antes de mover.
    if (missingFor(key, edits).length || sectionForStage(key)) {
      setPendingMove({ id: lead.id, from: effStage(lead), to: key });
      setMoveError(false);
    } else {
      setLocalStage(key);
      setPendingMove(null);
      setMoveError(false);
      startTransition(async () => {
        await setLeadStageAction(lead.id, key, {
          monto: key === 'ganado' ? Number(edits.plan.total) || null : null,
          motivo: key === 'perdido' || key === 'descal' ? edits.motivo : null,
        });
        router.refresh();
      });
    }
  };

  const onSave = () => {
    if (!lead || !edits) return;
    if (pendingMove && missingFor(pendingMove.to, edits).length) {
      setMoveError(true);
      return;
    }
    setSaveError(false);
    // Cerrar SOLO si la acción tuvo éxito: si falla, el modal queda abierto con
    // los cambios intactos y muestra el error (antes: onClose síncrono perdía todo).
    startTransition(async () => {
      try {
        await saveLeadMetaAction(lead.id, {
          closer: edits.closer, setter: edits.setter, fathom_links: edits.fathom, motivo_perdida: edits.motivo,
        });
        if (pendingMove) {
          await setLeadStageAction(lead.id, pendingMove.to, {
            monto: pendingMove.to === 'ganado' ? Number(edits.plan.total) || null : null,
            motivo: edits.motivo,
          });
        }
        router.refresh();
        onClose();
      } catch {
        setSaveError(true);
      }
    });
  };

  const onDelete = () => {
    if (!lead) return;
    setSaveError(false);
    // Borrado in-place (sin redirect): no expulsa al usuario de la tab actual.
    startTransition(async () => {
      try {
        await deleteLeadInlineAction(lead.id);
        router.refresh();
        onClose();
      } catch {
        setSaveError(true);
      }
    });
  };

  if (notFound) {
    return (
      <div onClick={onClose} style={{ position: 'fixed', inset: 0, zIndex: 80, background: 'rgba(23,21,17,.52)', backdropFilter: 'blur(3px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
        <div onClick={(e) => e.stopPropagation()} style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 16, padding: '22px 26px', fontFamily: SANS, fontSize: 14, color: 'var(--dim)' }}>
          No se pudo cargar el lead. <button onClick={onClose} style={{ marginLeft: 10, background: 'none', border: 'none', color: 'var(--accent)', cursor: 'pointer', fontWeight: 600 }}>Cerrar</button>
        </div>
      </div>
    );
  }

  if (!lead || !edits) {
    return (
      <div onClick={onClose} style={{ position: 'fixed', inset: 0, zIndex: 80, background: 'rgba(23,21,17,.52)', backdropFilter: 'blur(3px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
        <div onClick={(e) => e.stopPropagation()} style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 16, padding: '22px 26px', fontFamily: SANS, fontSize: 14, color: 'var(--dim)' }}>
          Cargando ficha…
        </div>
      </div>
    );
  }

  return (
    <LeadDetail
      lead={lead}
      stages={stages}
      effStage={effStage(lead)}
      pendingMove={pendingMove}
      moveError={moveError}
      edits={edits}
      missing={pendingMove ? missingFor(pendingMove.to, edits) : []}
      onPatch={(patch) => setEdits((e) => (e ? { ...e, ...patch } : e))}
      onPickStage={onPickStage}
      onClose={onClose}
      onSave={onSave}
      onDelete={onDelete}
      focus={(pendingMove && sectionForStage(pendingMove.to)) || focus}
      zIndex={80}
      saveError={saveError}
    />
  );
}
