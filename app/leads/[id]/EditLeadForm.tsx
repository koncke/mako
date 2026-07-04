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
import { saveLeadEditorAction, deleteLeadAction, type LeadEditorInput } from '../actions';
import { CHIP, stageMeta, deriveStageKey, type Stage, type StageBand } from '@/lib/pipeline';
import { ConfirmDialog } from '@/app/components/ConfirmDialog';
import { LeadTabs } from '../lead-view/LeadTabs';
import { DealDetailsCard } from './DealDetailsCard';
import type { Lead, FathomLink } from '@/lib/leads';
import type { Pago } from '@/lib/pagos';

type TriState = boolean | null;

const MONO = "'Geist Mono', monospace";
const SANS = "'Geist', sans-serif";
const card: CSSProperties = { background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 16, padding: '22px 24px' };

const sectLabel: CSSProperties = { fontFamily: MONO, fontSize: 11, letterSpacing: '.1em', textTransform: 'uppercase', color: 'var(--dim)' };
const btnGhost: CSSProperties = { padding: '10px 16px', borderRadius: 10, border: '1px solid var(--border-strong)', background: 'var(--surface)', color: 'var(--dim)', fontSize: 14, fontWeight: 500, cursor: 'pointer', fontFamily: SANS };
const btnPrimary: CSSProperties = { padding: '11px 22px', borderRadius: 10, border: 'none', background: 'var(--primary)', color: '#fff', fontSize: 14, fontWeight: 700, cursor: 'pointer', fontFamily: SANS };

export function EditLeadForm({ lead, stages, pagos, onDone, onCancel, initialTab }: { lead: Lead; stages: Stage[]; pagos: Pago[]; onDone?: () => void; onCancel?: () => void; initialTab?: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [feedback, setFeedback] = useState<{ kind: 'ok' | 'err'; msg: string } | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [confirmSave, setConfirmSave] = useState<{ cambios: string[]; payload: LeadEditorInput } | null>(null);

  const validKeys = new Set(stages.map((s) => s.key));
  const currentStage = lead.pipeline_stage && validKeys.has(lead.pipeline_stage) ? lead.pipeline_stage : deriveStageKey(lead);

  // La etapa NO se edita acá: se cambia con "Mover a…" (wizard con requisitos).
  const stage = currentStage;
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
  // Mostrar SOLO lo relevante a la etapa: un "Lead (Instant form)" no edita
  // reuniones; los campos de R2 aparecen recién cuando la etapa llegó a R2 (o
  // ya hay datos previos cargados que conviene poder corregir).
  const reachedR1 = ['agenda', 'agendaj2', 'facturando', 'ganado'].includes(stage) || !!fechaJ1 || !!lead.fecha_agenda || lead.asistio_j1 != null;
  const reachedR2 = ['agendaj2', 'facturando', 'ganado'].includes(stage) || !!fechaJ2 || lead.asistio_j2 != null;
  const reachedMeeting = reachedR1 || reachedR2;
  const showComercial = reachedMeeting || isLost;

  const asistioJ1Disabled = !fechaJ1;
  const calificadoDisabled = asistioJ1 !== true;
  const asistioJ2Disabled = !fechaJ2;

  const handleFechaJ1 = (v: string) => { setFechaJ1(v); if (!v) { setAsistioJ1(null); setCalificado(null); } };
  const handleAsistioJ1 = (v: TriState) => { setAsistioJ1(v); if (v !== true) setCalificado(null); };
  const handleFechaJ2 = (v: string) => { setFechaJ2(v); if (!v) setAsistioJ2(null); };
  const setFathomAt = (i: number, field: 'label' | 'url', v: string) =>
    setFathom((arr) => arr.map((f, fi) => (fi === i ? { ...f, [field]: v } : f)));

  const guardar = () => {
    setFeedback(null);
    if (!nombre.trim()) { setFeedback({ kind: 'err', msg: 'El nombre es obligatorio.' }); return; }
    if (isManual && !deadline) { setFeedback({ kind: 'err', msg: 'Para "Nutrición - Manual" tenés que poner una fecha límite.' }); return; }
    // Un lead en Ganado necesita un monto positivo para poder guardarse.
    if (isGanado && !(parseFloat(monto) > 0)) { setFeedback({ kind: 'err', msg: 'Para Ganado, el monto de cierre debe ser un número positivo.' }); return; }

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

    // Diff legible de lo que se está por cambiar → confirmación antes de guardar.
    const fmt = (v: string | number | boolean | null | undefined): string =>
      v === null || v === undefined || v === '' ? '—' : v === true ? 'Sí' : v === false ? 'No' : String(v);
    const cambios: string[] = [];
    const dif = (label: string, antes: string | number | boolean | null | undefined, ahora: string | number | boolean | null | undefined) => {
      if (fmt(antes) !== fmt(ahora)) cambios.push(`${label}: ${fmt(antes)} → ${fmt(ahora)}`);
    };
    dif('Nombre', lead.nombre, payload.nombre);
    dif('Email', lead.email, payload.email);
    dif('Teléfono', lead.telefono, payload.telefono);
    dif('Empresa', lead.empresa, payload.empresa);
    dif('Fecha de agendamiento', lead.fecha_agenda, payload.fecha_agenda);
    dif('Fecha R1', lead.fecha_junta_1, payload.fecha_junta_1);
    dif('Asistió R1', lead.asistio_j1, payload.asistio_j1);
    dif('Calificado', lead.calificado, payload.calificado);
    dif('Fecha R2', lead.fecha_junta_2, payload.fecha_junta_2);
    dif('Asistió R2', lead.asistio_j2, payload.asistio_j2);
    dif('Confirmación de pago', lead.fecha_confirmacion, payload.fecha_confirmacion);
    dif('Motivo', lead.motivo_perdida, payload.motivo_perdida);
    dif('Monto de cierre', lead.monto_cierre_usd, payload.monto_cierre_usd);
    dif('Fecha de cierre', lead.fecha_cierre, payload.fecha_cierre);
    dif('Inicio de servicio', lead.fecha_inicio_servicio, payload.fecha_inicio_servicio);
    dif('Closer', lead.closer, payload.closer);
    dif('Setter', lead.setter, payload.setter);
    dif('Deadline de nutrición', lead.nutricion_manual_deadline, payload.deadline);
    const fathomAntes = (lead.fathom_links ?? []).filter((f) => f.url.trim()).length;
    const fathomAhora = payload.fathom_links.filter((f) => f.url.trim()).length;
    if (fathomAntes !== fathomAhora) cambios.push(`Links de Fathom: ${fathomAntes} → ${fathomAhora}`);

    if (!cambios.length) { setFeedback({ kind: 'ok', msg: 'No hay cambios para guardar.' }); return; }
    setConfirmSave({ cambios, payload });
  };

  const ejecutarGuardado = () => {
    if (!confirmSave) return;
    const { payload } = confirmSave;
    setConfirmSave(null);
    startTransition(async () => {
      try {
        await saveLeadEditorAction(lead.id, payload);
        router.refresh();
        // Al confirmar, volver a la tab donde estaba el usuario.
        if (onDone) onDone();
        else setFeedback({ kind: 'ok', msg: 'Cambios guardados' });
      } catch (err) {
        setFeedback({ kind: 'err', msg: err instanceof Error ? err.message : String(err) });
      }
    });
  };

  const borrar = () => {
    setConfirmDelete(false);
    startTransition(async () => {
      try { await deleteLeadAction(lead.id); }
      catch (err) { setFeedback({ kind: 'err', msg: err instanceof Error ? err.message : String(err) }); }
    });
  };

  // ── Contenido editable por tab (mismas tabs que la vista) ──
  const tabContacto = (
    <section style={card}>
      <div style={{ ...sectLabel, marginBottom: 16 }}>Información principal</div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 14 }}>
        <Field label="Nombre" required><input className="lead-field" value={nombre} onChange={(e) => setNombre(e.target.value)} /></Field>
        <Field label="Empresa"><input className="lead-field" value={empresa} onChange={(e) => setEmpresa(e.target.value)} /></Field>
        <Field label="Email"><input className="lead-field" type="email" value={email} onChange={(e) => setEmail(e.target.value)} /></Field>
        <Field label="Teléfono"><input className="lead-field" type="tel" value={telefono} onChange={(e) => setTelefono(e.target.value)} /></Field>
      </div>
    </section>
  );

  const tabReuniones = (
    <>
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
            {reachedR2 && (
              <>
                <Field label="Fecha de Reunión 2"><input className="lead-field" type="date" value={fechaJ2} onChange={(e) => handleFechaJ2(e.target.value)} /></Field>
                <Field label="¿Asistió a R2?" disabled={asistioJ2Disabled} hint={asistioJ2Disabled ? 'Marcá fecha R2 primero' : undefined}>
                  <TriToggle value={asistioJ2} onChange={setAsistioJ2} disabled={asistioJ2Disabled} />
                </Field>
                <Field label="Fecha de confirmación (opcional)" hint="Cuándo confirmó verbalmente el cierre (entre R2 y primer pago)."><input className="lead-field" type="date" value={fechaConfirmacion} onChange={(e) => setFechaConfirmacion(e.target.value)} /></Field>
              </>
            )}
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
    </>
  );

  const tabCobranzaEdit = (isGanado || stage === 'facturando' || pagos.length > 0) ? (
    <>
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
      {/* Sin botón "Editar deal" acá (evita el doble Editar): las secciones del
          deal se editan desde la tab Deal Details; acá se edita el Cierre (monto)
          y Marcar pagada sigue disponible. */}
      <DealDetailsCard lead={lead} pagos={pagos} editable={false} />
    </>
  ) : (
    <section style={card}>
      <div style={{ ...sectLabel, marginBottom: 10 }}>Deal Details</div>
      <p style={{ fontSize: 14, color: 'var(--faint)' }}>El deal se habilita cuando el lead pasa a Facturando o Ganado (cambiando la etapa arriba).</p>
    </section>
  );

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
      {/* Barra de acción FIJA (solo existe en modo edición) */}
      <div style={{ position: 'sticky', top: 0, zIndex: 20, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', padding: '12px 16px', background: 'var(--surface)', border: '1px solid var(--border-strong)', borderRadius: 14, boxShadow: '0 4px 16px rgba(18,21,27,.07)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
          <span style={{ ...chipStyleFor(sm) }}>{sm?.label ?? stage}</span>
          <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--dim)' }}>Editando</span>
          {feedback && <span style={{ fontSize: 13, fontWeight: 600, color: feedback.kind === 'ok' ? 'var(--good)' : 'var(--bad)' }}>{feedback.msg}</span>}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <button type="button" onClick={() => (onCancel ? onCancel() : router.push('/leads'))} style={btnGhost}>Cancelar</button>
          <button type="button" onClick={guardar} disabled={pending} style={{ ...btnPrimary, opacity: pending ? 0.6 : 1 }}>{pending ? 'Guardando…' : 'Guardar cambios'}</button>
        </div>
      </div>

      {/* Mismas tabs que la vista (mismos nombres), ahora editables. Abre en la
          tab donde estaba el usuario (initialTab). */}
      <LeadTabs
        initial={initialTab}
        tabs={[
          { key: 'resumen', label: 'Overview', content: tabContacto },
          { key: 'reuniones', label: 'Meetings', content: tabReuniones },
          { key: 'cobranza', label: 'Deal Details', content: tabCobranzaEdit },
        ]}
      />

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

      {confirmSave && (
        <ConfirmDialog
          title="Confirmar cambios"
          tone="primary"
          message={
            <div>
              <div style={{ marginBottom: 10 }}>Estás por aplicar estos cambios en <b style={{ color: 'var(--ink)' }}>{lead.nombre}</b>:</div>
              <ul style={{ margin: 0, paddingLeft: 18, display: 'flex', flexDirection: 'column', gap: 5, maxHeight: 260, overflowY: 'auto' }}>
                {confirmSave.cambios.map((c) => <li key={c} style={{ fontSize: 13.5, color: 'var(--ink)' }}>{c}</li>)}
              </ul>
            </div>
          }
          confirmLabel="Confirmar"
          onConfirm={ejecutarGuardado}
          onCancel={() => setConfirmSave(null)}
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

