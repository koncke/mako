'use client';

// =============================================================================
// EditLeadForm — editor completo del lead (stage-based, secciones por status)
// =============================================================================
// Recupera la riqueza del pop-up editable: selector de TODAS las etapas del
// funnel por banda, secciones que aparecen según la etapa, deadline de Nutrición
// - Manual, y barra de acción FIJA (sticky) arriba. Guarda en una sola acción
// (saveLeadEditorAction) que sincroniza estado + override de tablero + meta.

import { useState, useTransition, type CSSProperties, type ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { saveLeadEditorAction, deleteLeadAction, deleteLeadInlineAction, type LeadEditorInput } from '../actions';
import { CHIP, BAND_LABEL, stageMeta, deriveStageKey, type Stage, type StageBand } from '@/lib/pipeline';
import { missingForStage } from '@/lib/stage-requirements';
import { ConfirmDialog } from '@/app/components/ConfirmDialog';
import { CobranzaPlanCard } from './CobranzaPlanCard';
import type { Lead, FathomLink } from '@/lib/leads';
import type { Pago } from '@/lib/pagos';

type TriState = boolean | null;

const MONO = "'Geist Mono', monospace";
const SANS = "'Geist', sans-serif";
const card: CSSProperties = { background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 16, padding: '22px 24px' };
const cardAccion: CSSProperties = { background: 'var(--surface)', border: '1px solid var(--border-strong)', borderRadius: 16, padding: '22px 24px', boxShadow: '0 1px 3px rgba(18,21,27,.05)' };
const sectLabel: CSSProperties = { fontFamily: MONO, fontSize: 11, letterSpacing: '.1em', textTransform: 'uppercase', color: 'var(--dim)' };
const btnGhost: CSSProperties = { padding: '10px 16px', borderRadius: 10, border: '1px solid var(--border-strong)', background: 'var(--surface)', color: 'var(--dim)', fontSize: 14, fontWeight: 500, cursor: 'pointer', fontFamily: SANS };
const btnPrimary: CSSProperties = { padding: '11px 22px', borderRadius: 10, border: 'none', background: 'var(--primary)', color: '#fff', fontSize: 14, fontWeight: 700, cursor: 'pointer', fontFamily: SANS };

export function EditLeadForm({ lead, stages, pagos, initialStage, onClose }: { lead: Lead; stages: Stage[]; pagos: Pago[]; initialStage?: string; onClose?: () => void }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [feedback, setFeedback] = useState<{ kind: 'ok' | 'err'; msg: string } | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const validKeys = new Set(stages.map((s) => s.key));
  // Etapa actual del lead vs etapa inicial mostrada (puede venir forzada por un
  // movimiento del Kanban que abre la ficha para completar datos).
  const currentStage = lead.pipeline_stage && validKeys.has(lead.pipeline_stage) ? lead.pipeline_stage : deriveStageKey(lead);
  const initStage = initialStage && validKeys.has(initialStage) ? initialStage : currentStage;

  const [stage, setStage] = useState<string>(initStage);
  const [nombre, setNombre] = useState(lead.nombre);
  const [email, setEmail] = useState(lead.email ?? '');
  const [telefono, setTelefono] = useState(lead.telefono ?? '');
  const [empresa, setEmpresa] = useState(lead.empresa ?? '');

  const [fechaAgenda, setFechaAgenda] = useState(lead.fecha_agenda ?? '');
  const [fechaJ1, setFechaJ1] = useState(lead.fecha_junta_1 ?? '');
  const [fechaJ2, setFechaJ2] = useState(lead.fecha_junta_2 ?? '');
  const [asistioJ1, setAsistioJ1] = useState<TriState>(lead.asistio_j1);
  const [asistioJ2, setAsistioJ2] = useState<TriState>(lead.asistio_j2);
  const [calificado, setCalificado] = useState<TriState>(lead.calificado);

  const [motivo, setMotivo] = useState(lead.motivo_perdida ?? '');
  const [monto, setMonto] = useState<string>(lead.monto_cierre_usd?.toString() ?? '');
  const [fechaCierre, setFechaCierre] = useState(lead.fecha_cierre ?? '');
  const [fechaConfirmacion, setFechaConfirmacion] = useState(lead.fecha_confirmacion ?? '');
  const [fechaInicioServicio, setFechaInicioServicio] = useState(lead.fecha_inicio_servicio ?? '');

  const [closer, setCloser] = useState(lead.closer ?? '');
  const [setter, setSetter] = useState(lead.setter ?? '');
  const [fathom, setFathom] = useState<FathomLink[]>(lead.fathom_links ?? []);
  const [deadline, setDeadline] = useState(lead.nutricion_manual_deadline ?? '');

  const sm = stageMeta(stages, stage);
  const band: StageBand = sm?.band ?? 'pipeline';
  const isGanado = stage === 'ganado';
  const isLost = stage === 'perdido' || stage === 'descal';
  const isNutri = band === 'nutricion';
  const isManual = stage === 'manual';
  const reachedMeeting = ['agenda', 'agendaj2', 'facturando', 'ganado'].includes(stage) || !!fechaJ1 || !!fechaJ2;
  const showComercial = band === 'pipeline' || reachedMeeting || isLost;

  const asistioJ1Disabled = !fechaJ1;
  const calificadoDisabled = asistioJ1 !== true;
  const asistioJ2Disabled = !fechaJ2;

  const handleFechaJ1 = (v: string) => { setFechaJ1(v); if (!v) { setAsistioJ1(null); setCalificado(null); } };
  const handleAsistioJ1 = (v: TriState) => { setAsistioJ1(v); if (v !== true) setCalificado(null); };
  const handleFechaJ2 = (v: string) => { setFechaJ2(v); if (!v) setAsistioJ2(null); };
  const setFathomAt = (i: number, field: 'label' | 'url', v: string) =>
    setFathom((arr) => arr.map((f, fi) => (fi === i ? { ...f, [field]: v } : f)));

  const groups = (['pipeline', 'nutricion', 'salidas'] as StageBand[])
    .map((b) => ({ label: BAND_LABEL[b], keys: stages.filter((s) => (s.band ?? 'pipeline') === b).sort((a, c) => (a.col ?? 0) - (c.col ?? 0)).map((s) => s.key) }))
    .filter((g) => g.keys.length > 0);

  const guardar = () => {
    setFeedback(null);
    if (!nombre.trim()) { setFeedback({ kind: 'err', msg: 'El nombre es obligatorio.' }); return; }
    if (isManual && !deadline) { setFeedback({ kind: 'err', msg: 'Para "Nutrición - Manual" tenés que poner una fecha límite.' }); return; }
    // Requisitos de la etapa: se exigen al MOVER a una etapa nueva (no al editar
    // un lead que ya estaba ahí), unificado con el Kanban vía stage-requirements.
    // Un lead ya en Ganado igual necesita un monto positivo para poder guardarse.
    const reqs = stage !== currentStage
      ? missingForStage(stage, { fechaJ1, fechaJ2, hasFathomUrl: fathom.some((f) => f.url.trim()), monto: parseFloat(monto) || null, motivo, setter })
      : (isGanado && !(parseFloat(monto) > 0) ? ['Monto de cierre'] : []);
    if (reqs.length) { setFeedback({ kind: 'err', msg: `Falta para "${sm?.label ?? stage}": ${reqs.join(', ')}` }); return; }

    const payload: LeadEditorInput = {
      stage,
      deadline: isManual ? (deadline || null) : null,
      nombre: nombre.trim(),
      email: email.trim() || null,
      telefono: telefono.trim() || null,
      empresa: empresa.trim() || null,
      fecha_agenda: fechaAgenda || null,
      fecha_junta_1: fechaJ1 || null,
      fecha_junta_2: fechaJ2 || null,
      asistio_j1: asistioJ1,
      asistio_j2: asistioJ2,
      calificado,
      motivo_perdida: motivo.trim() || null,
      monto_cierre_usd: monto ? parseFloat(monto) : null,
      fecha_cierre: fechaCierre || null,
      fecha_confirmacion: fechaConfirmacion || null,
      fecha_inicio_servicio: fechaInicioServicio || null,
      closer: closer.trim() || null,
      setter: setter.trim() || null,
      fathom_links: fathom.filter((f) => f.url.trim() || f.label.trim()),
    };
    startTransition(async () => {
      try {
        await saveLeadEditorAction(lead.id, payload);
        router.refresh();
        // En el modal, cerrar al guardar (el board de atrás ya se refrescó); en la
        // ruta, quedarse con el aviso de guardado.
        if (onClose) onClose();
        else setFeedback({ kind: 'ok', msg: 'Cambios guardados' });
      } catch (err) {
        setFeedback({ kind: 'err', msg: err instanceof Error ? err.message : String(err) });
      }
    });
  };

  const borrar = () => {
    setConfirmDelete(false);
    startTransition(async () => {
      try {
        // Modal → borrado in-place (no expulsa de la tab); ruta → borra y redirige.
        if (onClose) { await deleteLeadInlineAction(lead.id); router.refresh(); onClose(); }
        else { await deleteLeadAction(lead.id); }
      } catch (err) { setFeedback({ kind: 'err', msg: err instanceof Error ? err.message : String(err) }); }
    });
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
      {/* Barra de acción FIJA */}
      <div style={{ position: 'sticky', top: 0, zIndex: 20, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', padding: '12px 16px', background: 'var(--surface)', border: '1px solid var(--border-strong)', borderRadius: 14, boxShadow: '0 4px 16px rgba(18,21,27,.07)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
          <span style={{ ...chipStyleFor(sm), }}>{sm?.label ?? stage}</span>
          {feedback && <span style={{ fontSize: 13, fontWeight: 600, color: feedback.kind === 'ok' ? 'var(--good)' : 'var(--bad)' }}>{feedback.msg}</span>}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <button type="button" onClick={() => (onClose ? onClose() : router.push('/leads'))} style={btnGhost}>Cancelar</button>
          <button type="button" onClick={guardar} disabled={pending} style={{ ...btnPrimary, opacity: pending ? 0.6 : 1 }}>{pending ? 'Guardando…' : 'Guardar cambios'}</button>
        </div>
      </div>

      {/* ETAPA */}
      <section style={cardAccion}>
        <div style={{ ...sectLabel, marginBottom: 14 }}>Etapa del lead</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {groups.map((g) => (
            <div key={g.label}>
              <div style={{ fontSize: 11.5, color: 'var(--dim)', marginBottom: 8 }}>{g.label}</div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                {g.keys.map((k) => {
                  const st = stageMeta(stages, k);
                  if (!st || st.key !== k) return null;
                  const c = CHIP[st.tone] || CHIP.neutral;
                  const active = stage === k;
                  return (
                    <button key={k} type="button" aria-pressed={active} onClick={() => setStage(k)} style={{ display: 'inline-flex', alignItems: 'center', gap: 7, cursor: 'pointer', fontSize: 13, fontWeight: 600, padding: '8px 12px', borderRadius: 9, fontFamily: SANS, background: active ? c.bg : 'var(--surface)', color: active ? c.fg : 'var(--dim)', border: '1px solid ' + (active ? c.bd : 'var(--border-strong)') }}>
                      <span style={{ width: 8, height: 8, borderRadius: '50%', background: st.dot, flex: 'none' }} />{st.label}
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* CONTACTO */}
      <section style={card}>
        <div style={{ ...sectLabel, marginBottom: 16 }}>Información de contacto</div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 14 }}>
          <Field label="Nombre" required><input className="lead-field" value={nombre} onChange={(e) => setNombre(e.target.value)} /></Field>
          <Field label="Empresa"><input className="lead-field" value={empresa} onChange={(e) => setEmpresa(e.target.value)} /></Field>
          <Field label="Email"><input className="lead-field" type="email" value={email} onChange={(e) => setEmail(e.target.value)} /></Field>
          <Field label="Teléfono"><input className="lead-field" type="tel" value={telefono} onChange={(e) => setTelefono(e.target.value)} /></Field>
        </div>
      </section>

      {/* DATOS COMERCIALES */}
      {showComercial && (
        <section style={card}>
          <div style={{ ...sectLabel, marginBottom: 16 }}>Datos comerciales</div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 14 }}>
            <Field label="Fecha de agendamiento"><input className="lead-field" type="date" value={fechaAgenda} onChange={(e) => setFechaAgenda(e.target.value)} /></Field>
            <Field label="Fecha de Reunión 1 (anchor de cohorte)"><input className="lead-field" type="date" value={fechaJ1} onChange={(e) => handleFechaJ1(e.target.value)} /></Field>
            <Field label="¿Asistió a R1?" disabled={asistioJ1Disabled} hint={asistioJ1Disabled ? 'Marcá fecha R1 primero' : undefined}>
              <TriToggle value={asistioJ1} onChange={handleAsistioJ1} disabled={asistioJ1Disabled} />
            </Field>
            <Field label="¿Era lead calificado?" disabled={calificadoDisabled} hint={calificadoDisabled ? 'Solo si asistió a R1 = Sí' : undefined}>
              <TriToggle value={calificado} onChange={setCalificado} disabled={calificadoDisabled} />
            </Field>
            <Field label="Fecha de Reunión 2 (opcional)"><input className="lead-field" type="date" value={fechaJ2} onChange={(e) => handleFechaJ2(e.target.value)} /></Field>
            <Field label="¿Asistió a R2?" disabled={asistioJ2Disabled} hint={asistioJ2Disabled ? 'Marcá fecha R2 primero' : undefined}>
              <TriToggle value={asistioJ2} onChange={setAsistioJ2} disabled={asistioJ2Disabled} />
            </Field>
            <Field label="Fecha de confirmación (opcional)" hint="Cuándo confirmó verbalmente el cierre (entre R2 y primer pago)."><input className="lead-field" type="date" value={fechaConfirmacion} onChange={(e) => setFechaConfirmacion(e.target.value)} /></Field>
            <Field label="Closer asignado"><input className="lead-field" value={closer} onChange={(e) => setCloser(e.target.value)} placeholder="Nombre del closer…" /></Field>
          </div>
        </section>
      )}

      {/* NUTRICIÓN (+ deadline de manual) */}
      {isNutri && (
        <section style={card}>
          <div style={{ ...sectLabel, marginBottom: 16 }}>Nutrición</div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 14 }}>
            <Field label="Setter asignado"><input className="lead-field" value={setter} onChange={(e) => setSetter(e.target.value)} placeholder="Nombre del setter…" /></Field>
            {isManual && (
              <Field label="Fecha límite (deadline)" required hint="Si vence sin que el lead avance, vuelve a 'datos sin marcar' en rojo.">
                <input className="lead-field" type="date" value={deadline} onChange={(e) => setDeadline(e.target.value)} />
              </Field>
            )}
          </div>
          <p style={{ fontSize: 12.5, color: 'var(--faint)', fontStyle: 'italic', marginTop: 12 }}>El detalle de los toques de nutrición por lead todavía no se registra acá; se controla desde las automatizaciones del funnel.</p>
        </section>
      )}

      {/* MOTIVO (perdido / descalificado) */}
      {isLost && (
        <section style={card}>
          <div style={{ ...sectLabel, marginBottom: 12 }}>Motivo</div>
          <MotivoSugerencias value={motivo} onChange={setMotivo} />
        </section>
      )}

      {/* CIERRE (ganado) */}
      {isGanado && (
        <section style={card}>
          <div style={{ ...sectLabel, marginBottom: 16 }}>Cierre</div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 14 }}>
            <Field label="Monto del cierre (USD)" required><input className="lead-field" type="number" step="0.01" min="0" value={monto} onChange={(e) => setMonto(e.target.value)} /></Field>
            <Field label="Fecha de cierre"><input className="lead-field" type="date" value={fechaCierre} onChange={(e) => setFechaCierre(e.target.value)} /></Field>
            <Field label="Fecha inicio de servicio (opcional)"><input className="lead-field" type="date" value={fechaInicioServicio} onChange={(e) => setFechaInicioServicio(e.target.value)} /></Field>
          </div>
        </section>
      )}

      {/* FATHOM */}
      {(reachedMeeting || fathom.length > 0 || !!closer) && (
        <section style={card}>
          <div style={{ ...sectLabel, marginBottom: 14 }}>Links de Fathom</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {fathom.map((f, i) => (
              <div key={i} style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                <input aria-label="Etiqueta" className="lead-field" value={f.label} onChange={(e) => setFathomAt(i, 'label', e.target.value)} placeholder="Llamada" style={{ flex: 'none', width: 130 }} />
                <input aria-label="URL de Fathom" className="lead-field" value={f.url} onChange={(e) => setFathomAt(i, 'url', e.target.value)} placeholder="https://fathom.video/…" style={{ flex: 1, minWidth: 200 }} />
              </div>
            ))}
            <button type="button" onClick={() => setFathom((arr) => [...arr, { label: '', url: '' }])} style={{ padding: 10, borderRadius: 10, border: '1px dashed var(--border-strong)', background: 'transparent', color: 'var(--dim)', fontSize: 13.5, fontWeight: 500, cursor: 'pointer', fontFamily: SANS }}>+ Agregar otro link</button>
          </div>
        </section>
      )}

      {/* RESPUESTAS DEL FORMULARIO (solo lectura) */}
      <RespuestasCard lead={lead} />

      {/* PLAN DE PAGOS (ganado / facturando) */}
      {(isGanado || stage === 'facturando') && <CobranzaPlanCard lead={lead} pagos={pagos} />}

      {/* BORRAR (discreto, al fondo) */}
      <div style={{ display: 'flex', justifyContent: 'flex-start', paddingTop: 4 }}>
        <button type="button" onClick={() => setConfirmDelete(true)} disabled={pending} style={{ padding: '9px 14px', borderRadius: 10, border: '1px solid var(--bad)', background: 'transparent', color: 'var(--bad)', fontSize: 13.5, fontWeight: 600, cursor: 'pointer', fontFamily: SANS, opacity: pending ? 0.5 : 1 }}>Borrar lead</button>
      </div>

      {confirmDelete && (
        <ConfirmDialog
          title="Borrar lead"
          message={<>Vas a borrar definitivamente a <b style={{ color: 'var(--ink)' }}>{lead.nombre}</b> y todo su historial. <b style={{ color: 'var(--bad)' }}>No se puede deshacer.</b></>}
          confirmLabel="Borrar definitivamente"
          onConfirm={borrar}
          onCancel={() => setConfirmDelete(false)}
          zIndex={130}
        />
      )}
    </div>
  );
}

function chipStyleFor(sm: Stage | undefined): CSSProperties {
  const c = sm ? CHIP[sm.tone] || CHIP.neutral : CHIP.neutral;
  return { display: 'inline-block', fontSize: 13, fontWeight: 600, padding: '5px 12px', borderRadius: 999, background: c.bg, color: c.fg, border: '1px solid ' + c.bd, whiteSpace: 'nowrap' };
}

function Field({ label, required, disabled, hint, children }: { label: string; required?: boolean; disabled?: boolean; hint?: string; children: ReactNode }) {
  return (
    <label style={{ display: 'block' }}>
      <span style={{ display: 'block', fontSize: 12.5, marginBottom: 6, color: disabled ? 'var(--faint)' : 'var(--dim)' }}>
        {label}{required && <span style={{ color: 'var(--bad)', marginLeft: 3 }}>*</span>}
      </span>
      {children}
      {hint && <span style={{ display: 'block', fontSize: 12, marginTop: 5, color: 'var(--faint)' }}>{hint}</span>}
    </label>
  );
}

function TriToggle({ value, onChange, disabled }: { value: TriState; onChange: (v: TriState) => void; disabled?: boolean }) {
  const opts: Array<{ v: TriState; label: string; fg: string; bg: string }> = [
    { v: true, label: 'Sí', fg: 'var(--good)', bg: 'var(--good-bg)' },
    { v: false, label: 'No', fg: 'var(--bad)', bg: 'var(--bad-bg)' },
    { v: null, label: '—', fg: 'var(--dim)', bg: 'var(--surface-2)' },
  ];
  return (
    <div style={{ display: 'inline-flex', borderRadius: 10, border: '1px solid var(--border-strong)', overflow: 'hidden', opacity: disabled ? 0.5 : 1 }}>
      {opts.map((o, i) => {
        const active = value === o.v;
        return (
          <button key={String(o.v)} type="button" disabled={disabled} onClick={() => onChange(o.v)} style={{ padding: '9px 16px', fontSize: 14, fontWeight: 600, fontFamily: SANS, cursor: disabled ? 'not-allowed' : 'pointer', border: 'none', borderRight: i < opts.length - 1 ? '1px solid var(--border-strong)' : 'none', background: active ? o.bg : 'var(--surface)', color: active ? o.fg : 'var(--dim)' }}>{o.label}</button>
        );
      })}
    </div>
  );
}

function MotivoSugerencias({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const sugerencias = ['Precio', 'Timing', 'No calificado', 'Fantasma', 'Otro'];
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 11 }}>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
        {sugerencias.map((s) => {
          const active = value.trim().toLowerCase() === s.toLowerCase();
          return (
            <button key={s} type="button" onClick={() => onChange(s)} style={{ padding: '6px 13px', borderRadius: 999, fontSize: 13, fontWeight: 600, fontFamily: SANS, cursor: 'pointer', background: active ? 'rgba(47,111,237,.10)' : 'var(--surface)', border: '1px solid ' + (active ? 'var(--primary)' : 'var(--border-strong)'), color: active ? 'var(--primary)' : 'var(--dim)' }}>{s}</button>
          );
        })}
      </div>
      <textarea className="lead-field" value={value} onChange={(e) => onChange(e.target.value)} placeholder="¿Por qué se perdió o descalificó? Contá el contexto…" style={{ minHeight: 80, lineHeight: 1.5 }} />
    </div>
  );
}

function RespuestasCard({ lead }: { lead: Lead }) {
  const rows: Array<{ label: string; value: string | null }> = [
    { label: '¿Qué quiere lograr?', value: lead.respuesta_objetivo },
    { label: '¿Puede invertir?', value: lead.respuesta_inversion },
    { label: '¿Cuántos colaboradores?', value: lead.respuesta_colaboradores },
    { label: '¿Factura +$20M MXN?', value: lead.respuesta_facturacion },
    { label: '¿Alguien más decide?', value: lead.respuesta_decisor },
    { label: '¿Cuándo quiere empezar?', value: lead.respuesta_cuando_empezar },
  ];
  const hay = rows.some((r) => r.value && r.value.trim());
  return (
    <section style={card}>
      <div style={{ ...sectLabel, marginBottom: 16 }}>Respuestas del formulario</div>
      {!hay ? (
        <p style={{ fontSize: 14, color: 'var(--faint)' }}>Sin respuestas capturadas. Probablemente un lead orgánico, manual, o agendado antes de que el form tuviera estas preguntas.</p>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 16 }}>
          {rows.map((r) => (
            <div key={r.label}>
              <div style={{ fontSize: 11.5, color: 'var(--dim)', marginBottom: 3 }}>{r.label}</div>
              <div style={{ fontSize: 14.5, color: r.value ? 'var(--ink)' : 'var(--faint)' }}>{r.value && r.value.trim() ? r.value : '—'}</div>
            </div>
          ))}
        </div>
      )}
      <p style={{ fontSize: 12, marginTop: 14, color: 'var(--faint)' }}>Datos automáticos del webhook de Calendly. Solo lectura.</p>
    </section>
  );
}
