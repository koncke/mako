'use client';

// =============================================================================
// EditarDeal — lo único del lead que todavía se edita en una pantalla aparte
// =============================================================================
// ⚠️ ESTO ES LO QUE QUEDÓ DE `EditLeadForm.tsx`, que se borró el 05/10/2026.
// Ese archivo era el destino del botón «Editar lead →» y editaba DOS cosas muy
// distintas con un solo «Guardar cambios»: los 15 campos del lead y el Deal
// Details. Los 15 campos se mudaron a la ficha, cada uno donde se lee (ver
// `app/crm/campo-inline.ts`); el deal se quedó acá, y por una razón medible:
// el deal no son campos sueltos, son ~20 campos más el PLAN DE CUOTAS, y su
// guardado es transaccional (`saveDealSectionsAction` y, sólo si las cuotas
// cambiaron, `saveCuotasAction` — que hard-setea `estado_lead='ganado'`). Campo
// por campo, cada tecla cerraría el lead.
//
// Por eso NO hay botón de editar en la ficha: a esta pantalla se llega desde donde
// el deal se LEE —el «Editar deal →» de la tab Pagos y el «Completar con IA» del
// propio DealDetailsCard—, que es la misma idea («editá donde está el dato»)
// llevada al único bloque que no se puede partir en campos.
//
// El guardado sigue siendo por ref (`DealDetailsHandle.save()`): el card dibuja los
// campos y esta barra es el único disparador.

import { useRef, useState, useTransition, type CSSProperties } from 'react';
import { useRouter } from '@/app/_ui/Link';
import { CHIP, stageMeta, deriveStageKey, type Stage } from '@/lib/pipeline';
import { DealDetailsCard, type DealDetailsHandle } from './DealDetailsCard';
import type { Lead } from '@/lib/leads';
import type { Pago } from '@/lib/pagos';

const SANS = "'Geist', sans-serif";
const btnGhost: CSSProperties = { padding: '10px 16px', borderRadius: 10, border: '1px solid var(--border-strong)', background: 'var(--surface)', color: 'var(--dim)', fontSize: 14, fontWeight: 500, cursor: 'pointer', fontFamily: SANS };
const btnPrimary: CSSProperties = { padding: '11px 22px', borderRadius: 10, border: 'none', background: 'var(--primary)', color: '#fff', fontSize: 14, fontWeight: 700, cursor: 'pointer', fontFamily: SANS };

export function EditarDeal({ lead, stages, pagos, onDone, onCancel }: {
  lead: Lead;
  stages: Stage[];
  pagos: Pago[];
  onDone?: () => void;
  onCancel?: () => void;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [feedback, setFeedback] = useState<{ kind: 'ok' | 'err'; msg: string } | null>(null);
  const dealRef = useRef<DealDetailsHandle>(null);

  const validKeys = new Set(stages.map((s) => s.key));
  const stage = lead.pipeline_stage && validKeys.has(lead.pipeline_stage) ? lead.pipeline_stage : deriveStageKey(lead);
  const sm = stageMeta(stages, stage);

  const guardar = () => {
    setFeedback(null);
    startTransition(async () => {
      try {
        await dealRef.current?.save();
        router.refresh();
        if (onDone) onDone(); else setFeedback({ kind: 'ok', msg: 'Cambios guardados' });
      } catch (err) {
        setFeedback({ kind: 'err', msg: err instanceof Error ? err.message : String(err) });
      }
    });
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
      {/* Barra de acción FIJA (solo existe mientras se edita el deal) */}
      <div style={{ position: 'sticky', top: 0, zIndex: 20, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', padding: '12px 16px', background: 'var(--surface)', border: '1px solid var(--border-strong)', borderRadius: 14, boxShadow: '0 4px 16px rgba(18,21,27,.07)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
          <span style={chipStyleFor(sm)}>{sm?.label ?? stage}</span>
          <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--dim)' }}>Editando el deal</span>
          {feedback && <span style={{ fontSize: 13, fontWeight: 600, color: feedback.kind === 'ok' ? 'var(--good)' : 'var(--bad)' }}>{feedback.msg}</span>}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <button type="button" onClick={() => (onCancel ? onCancel() : router.push('/crm'))} style={btnGhost}>Cancelar</button>
          <button type="button" onClick={guardar} disabled={pending} style={{ ...btnPrimary, opacity: pending ? 0.6 : 1 }}>{pending ? 'Guardando…' : 'Guardar cambios'}</button>
        </div>
      </div>

      <DealDetailsCard ref={dealRef} lead={lead} pagos={pagos} editing />
    </div>
  );
}

function chipStyleFor(sm: Stage | undefined): CSSProperties {
  const c = sm ? CHIP[sm.tone] || CHIP.neutral : CHIP.neutral;
  return { display: 'inline-block', fontSize: 13, fontWeight: 600, padding: '5px 12px', borderRadius: 999, background: c.bg, color: c.fg, border: '1px solid ' + c.bd, whiteSpace: 'nowrap' };
}
