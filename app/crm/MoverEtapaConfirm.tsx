'use client';

// =============================================================================
// Mover de etapa sin pedir nada — la pieza compartida (08-T22)
// =============================================================================
// Desde el 17/09 mover un lead se guarda SIEMPRE y lo que falta queda pendiente
// (ver registrarPendientes en app/crm/actions.ts). El tablero lo aplicó primero;
// las fichas (LeadSheet y LeadDetailBody) seguían abriendo el wizard de datos al
// elegir otra etapa. Esta es la pieza que las iguala, en UN lugar:
//
//   · SenalesMetaChips — los dos toques opcionales de Meta. La usa también el
//     tablero dentro de su confirmación: la misma pieza, no una copia.
//   · MoverEtapaConfirm — confirmar → mover → si quedó algo pendiente, decirlo y
//     ofrecer completarlo ahora o dejarlo para después. Nunca en el camino.
//
// Lo que NO pasa por acá, igual que en el tablero: las etapas de reunión (hay una
// fecha que definir: agendarla, o marcar que ya ocurrió) y la nutrición manual
// (su plazo ES la decisión). Para esas la ficha sigue abriendo el wizard, que
// ahora tiene salida desde cualquier paso. Ver `pideWizardAlElegir` (mover-etapa.ts).
// =============================================================================

import { useRef, useState, useTransition, type CSSProperties } from 'react';
import { ConfirmDialog } from '@/app/components/ConfirmDialog';
import { setLeadStageAction } from './actions';
import { senalesAOfrecer, hayAlgoQueOfrecer, type SenalesAOfrecer } from './senales-meta';

const SANS = "'Geist', sans-serif";

type Senales = { asistio: boolean | null; calificado: boolean | null };

// ── Los dos toques de Meta ──────────────────────────────────────────────────────
// Mover ya no exige nada; estas dos se OFRECEN porque son las únicas que le
// llegan a Meta, y postergadas con el resto le llegan una semana tarde o nunca
// (ver senales-meta.ts). Un toque cada una, las dos opcionales. Tocar de nuevo la
// opción elegida la desmarca.
export function SenalesMetaChips({ ofrecer, onChange }: {
  ofrecer: SenalesAOfrecer;
  onChange: (v: Senales) => void;
}) {
  const [asistio, setAsistio] = useState<boolean | null>(null);
  const [calificado, setCalificado] = useState<boolean | null>(null);
  const fijar = (a: boolean | null, c: boolean | null) => { setAsistio(a); setCalificado(c); onChange({ asistio: a, calificado: c }); };
  // «¿Calificado?» solo si asistió: sin asistencia updateLead lo anula, así que
  // preguntarlo sería pedir un dato que se tira.
  const asistioEfectiva = asistio ?? ofrecer.asistioConocida;
  const verCalificado = ofrecer.calificado && asistioEfectiva === true;
  const chip = (activo: boolean): CSSProperties => ({
    padding: '6px 14px', borderRadius: 999, fontFamily: SANS, fontSize: 13, fontWeight: 600, cursor: 'pointer',
    background: activo ? 'var(--ink)' : 'var(--surface)', color: activo ? '#F3F5F8' : 'var(--ink)',
    border: '1px solid ' + (activo ? 'var(--ink)' : 'var(--border-strong)'),
  });
  const fila = (label: string, valor: boolean | null, onSi: () => void, onNo: () => void) => (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap' }}>
      <span style={{ fontSize: 13.5, color: 'var(--ink)', fontWeight: 600 }}>{label}</span>
      <span style={{ display: 'inline-flex', gap: 6 }}>
        <button type="button" aria-pressed={valor === true} onClick={onSi} style={chip(valor === true)}>Sí</button>
        <button type="button" aria-pressed={valor === false} onClick={onNo} style={chip(valor === false)}>No</button>
      </span>
    </div>
  );
  return (
    <div style={{ marginTop: 14, padding: '12px 14px', background: 'var(--surface-2)', border: '1px solid var(--border)', borderRadius: 12, textAlign: 'left', display: 'flex', flexDirection: 'column', gap: 10 }}>
      <div style={{ fontSize: 12, color: 'var(--dim)', lineHeight: 1.45 }}>Opcional · Meta lo usa para aprender qué anuncios te traen clientes calificados.</div>
      {ofrecer.asistio && fila('¿Asistió a la Reunión 1?', asistio,
        () => fijar(asistio === true ? null : true, calificado),
        // Si no asistió, la calificación que se haya tocado ya no aplica.
        () => fijar(asistio === false ? null : false, null))}
      {verCalificado && fila('¿Era un lead calificado?', calificado,
        () => fijar(asistio, calificado === true ? null : true),
        () => fijar(asistio, calificado === false ? null : false))}
    </div>
  );
}

// ── Confirmar → mover → avisar lo pendiente ─────────────────────────────────────
export function MoverEtapaConfirm({ lead, desde, destino, zIndex, onHecho, onCompletar, onCancel }: {
  lead: { id: number; nombre: string; fechaJ1: string | null; asistioJ1: boolean | null; calificado: boolean | null };
  desde: string;
  destino: { key: string; label: string };
  zIndex?: number;
  /** Ya se movió y no hace falta nada más (o la persona eligió «Después»). */
  onHecho: () => void;
  /** La persona quiere completar ya lo pendiente: el padre abre el wizard. */
  onCompletar: () => void;
  onCancel: () => void;
}) {
  const senales = useRef<Senales>({ asistio: null, calificado: null });
  const [pendientes, setPendientes] = useState<string[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const ofrecer = senalesAOfrecer(lead, { hoyISO: new Date().toISOString().slice(0, 10) });

  const mover = () => {
    setError(null);
    startTransition(async () => {
      try {
        const r = await setLeadStageAction(lead.id, destino.key, {
          asistio_j1: senales.current.asistio ?? undefined,
          calificado: senales.current.calificado ?? undefined,
        });
        const faltan = r.ok ? (r.pendientes ?? []).map((p) => p.label) : r.faltan.map((f) => f.label);
        if (faltan.length) setPendientes(faltan); else onHecho();
      } catch (e) {
        setError(e instanceof Error ? e.message : 'No se pudo mover el lead.');
      }
    });
  };

  // Paso 2 — ya está movido. Lo que falta se DICE, no se pide: «Después» es tan
  // válido como completar, y en los dos casos queda marcado en la ficha.
  if (pendientes) {
    return (
      <ConfirmDialog
        title={`${lead.nombre} ya está en ${destino.label}`}
        message={<>Queda pendiente: <b>{pendientes.join(' · ')}</b>. Lo puedes completar ahora o después: queda marcado en la ficha y MaKo te lo pide.</>}
        confirmLabel="Completar ahora"
        cancelLabel="Después"
        tone="primary"
        zIndex={zIndex}
        onConfirm={onCompletar}
        onCancel={onHecho}
      />
    );
  }

  return (
    <ConfirmDialog
      title={`Mover a ${destino.label} a ${lead.nombre}`}
      message={(
        <>
          Pasa de <b>{desde}</b> a <b>{destino.label}</b>. Queda registrado en el historial del lead.
          {hayAlgoQueOfrecer(ofrecer) && (
            <SenalesMetaChips ofrecer={ofrecer} onChange={(v) => { senales.current = v; }} />
          )}
          {error && <div style={{ marginTop: 10, fontSize: 13, color: 'var(--bad)', fontWeight: 600 }}>{error}</div>}
        </>
      )}
      confirmLabel={`Mover a ${destino.label}`}
      tone="primary"
      loading={pending}
      zIndex={zIndex}
      onConfirm={mover}
      onCancel={onCancel}
    />
  );
}
