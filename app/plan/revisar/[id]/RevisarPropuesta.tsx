'use client';

// =============================================================================
// RevisarPropuesta — el dueño O el cliente responde el borrador de MaKo, de a 1
// =============================================================================
// SOLO wizard (WizardShell), nada de editor: preguntas de a UNA (ChoiceBody) →
// bajas sugeridas (checkbox, si hay) → confirmar. Al crear, las tareas las prioriza
// y describe el PERRO (nadie toca la prioridad a mano acá) y la revisión final se ve
// en el plan (modal "MaKo cargó tareas"). Las respuestas viajan como CONTEXTO al Perro.

import { useState } from 'react';
import { WizardShell } from '../../../_components/WizardShell';
import { ChoiceBody } from '../../board/guardian-form';
import type { Propuesta } from '@/lib/plan-propuesta';

const SANS = "'Geist', sans-serif";

function Mensaje({ texto, sub, ok }: { texto: string; sub?: string; ok?: boolean }) {
  return (
    <main style={{ minHeight: '100vh', display: 'grid', placeItems: 'center', background: 'var(--bg)', color: 'var(--ink)', fontFamily: SANS, padding: 24 }}>
      <div style={{ textAlign: 'center', padding: '26px 30px', background: ok ? 'var(--good-bg)' : 'var(--surface)', border: `1px solid ${ok ? '#BFE6CD' : 'var(--border)'}`, borderRadius: 16, maxWidth: 420 }}>
        <div style={{ fontSize: 16, fontWeight: 700, color: ok ? 'var(--good)' : 'var(--ink)' }}>{texto}</div>
        {sub ? <div style={{ fontSize: 13, color: 'var(--dim)', marginTop: 6 }}>{sub}</div>
          : <a href="/plan" style={{ display: 'inline-block', marginTop: 14, padding: '9px 18px', borderRadius: 9, background: 'var(--ink)', color: 'var(--surface)', fontSize: 13.5, fontWeight: 600, textDecoration: 'none' }}>Ir al plan</a>}
      </div>
    </main>
  );
}

type Step = { kind: 'q'; i: number } | { kind: 'elim' } | { kind: 'confirm' };

export function RevisarPropuesta({ prop }: { prop: Propuesta }) {
  const [paso, setPaso] = useState(0);
  const [resp, setResp] = useState<Record<number, string>>({});
  const [elimSel, setElimSel] = useState<Set<string>>(new Set(prop.eliminar.map((e) => e.id)));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [done, setDone] = useState<'' | 'aplicada' | 'descartada'>('');
  const irPlan = () => { window.location.href = '/plan'; };
  const nT = prop.tareas.length;

  const steps: Step[] = [
    ...prop.preguntas.map((_, i) => ({ kind: 'q' as const, i })),
    ...(prop.eliminar.length ? [{ kind: 'elim' as const }] : []),
    { kind: 'confirm' as const },
  ];
  const cur = steps[Math.min(paso, steps.length - 1)];
  const esUltimo = paso >= steps.length - 1;

  const enviar = async (action: 'aplicar' | 'descartar') => {
    setBusy(true); setError('');
    try {
      const contexto = prop.preguntas.map((q, i) => (resp[i]?.trim() ? `${q.pregunta} → ${resp[i].trim()}` : null)).filter(Boolean).join('\n');
      const body = action === 'aplicar' ? { action, id: prop.id, eliminarIds: [...elimSel], contexto } : { action, id: prop.id };
      const r = await fetch('/api/plan-propuesta', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }).then((res) => res.json());
      if (!r.ok) { setError(r.error || 'No se pudo.'); setBusy(false); return; }
      setDone(action === 'aplicar' ? 'aplicada' : 'descartada');
      setTimeout(irPlan, 1300);
    } catch (e) { setError(e instanceof Error ? e.message : 'Error de red.'); setBusy(false); }
  };

  if (prop.estado !== 'pendiente') return <Mensaje texto={`Este borrador ya fue ${prop.estado}.`} />;
  if (done) return <Mensaje ok texto={done === 'aplicada' ? `✓ Creé ${nT} tarea${nT === 1 ? '' : 's'}${elimSel.size ? ` y borré ${elimSel.size}` : ''}` : '✓ Borrador descartado'} sub="Te llevo al plan…" />;

  const crearLabel = `Crear ${nT}${elimSel.size ? ` · borrar ${elimSel.size}` : ''}`;
  const pregunta = cur.kind === 'q' ? (prop.preguntas[cur.i]?.pregunta || '…')
    : cur.kind === 'elim' ? '¿Borro estas tareas?'
      : `Listo — creo ${nT} tarea${nT === 1 ? '' : 's'}`;
  const sub = cur.kind === 'q' ? 'Elegí una opción o escribí la tuya.'
    : cur.kind === 'elim' ? 'MaKo las ve obsoletas o duplicadas. Destildá las que quieras conservar.'
      : 'El Perro Guardián las prioriza, las describe y les arma la checklist. La revisión final la ves en el plan.';

  return (
    <WizardShell
      titulo={prop.resumen || `Borrador · ${nT} tarea${nT === 1 ? '' : 's'}`}
      total={steps.length} idx={Math.min(paso, steps.length - 1)}
      pregunta={busy ? 'Creando…' : pregunta} sub={busy ? undefined : sub}
      puedeAvanzar={!busy} enUltimo={esUltimo} confirmLabel={crearLabel} pending={busy}
      atrasLabel={paso === 0 ? 'Cancelar' : 'Atrás'} siguienteLabel="Siguiente →"
      error={error || undefined}
      onClose={irPlan}
      onAtras={() => (paso === 0 ? irPlan() : setPaso(paso - 1))}
      onSiguiente={() => setPaso(paso + 1)}
      onConfirmar={() => enviar('aplicar')}
    >
      {cur.kind === 'q' ? (
        <ChoiceBody opciones={prop.preguntas[cur.i]?.opciones || []} value={resp[cur.i] || ''} onChange={(v) => setResp((r) => ({ ...r, [cur.i]: v }))} />
      ) : cur.kind === 'elim' ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, textAlign: 'left' }}>
          {prop.eliminar.map((e) => (
            <button key={e.id} type="button" onClick={() => setElimSel((s) => { const c = new Set(s); if (c.has(e.id)) c.delete(e.id); else c.add(e.id); return c; })}
              style={{ display: 'flex', gap: 9, alignItems: 'flex-start', textAlign: 'left', background: elimSel.has(e.id) ? 'var(--warn-bg, #fdecea)' : 'var(--surface-2)', border: `1px solid ${elimSel.has(e.id) ? 'var(--warn, #d0504a)' : 'var(--border)'}`, borderRadius: 10, cursor: 'pointer', padding: '10px 12px', width: '100%', fontFamily: SANS }}>
              <span style={{ width: 15, height: 15, borderRadius: 4, border: `1px solid ${elimSel.has(e.id) ? 'var(--warn, #d0504a)' : 'var(--border-strong)'}`, background: elimSel.has(e.id) ? 'var(--warn, #d0504a)' : 'transparent', color: '#fff', fontSize: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', flex: 'none', marginTop: 1 }}>{elimSel.has(e.id) ? '✓' : ''}</span>
              <span style={{ minWidth: 0 }}>
                <span style={{ display: 'block', fontSize: 13, fontWeight: 600, color: 'var(--ink)', textDecoration: elimSel.has(e.id) ? 'line-through' : 'none' }}>{e.titulo || e.id}</span>
                {e.motivo && <span style={{ display: 'block', fontSize: 11.5, color: 'var(--dim)' }}>{e.motivo}</span>}
              </span>
            </button>
          ))}
        </div>
      ) : (
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: 14, color: 'var(--dim)', lineHeight: 1.5 }}>{nT} tarea{nT === 1 ? '' : 's'}{prop.eliminar.length && elimSel.size ? ` · ${elimSel.size} baja${elimSel.size === 1 ? '' : 's'}` : ''}.</div>
          <button onClick={() => enviar('descartar')} disabled={busy} style={{ marginTop: 14, border: 'none', background: 'transparent', color: 'var(--faint)', fontSize: 12.5, cursor: busy ? 'default' : 'pointer', textDecoration: 'underline', fontFamily: SANS }}>o descartar este borrador</button>
        </div>
      )}
    </WizardShell>
  );
}
