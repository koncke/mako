'use client';

// =============================================================================
// EditLeadForm — edición de un lead (rediseño claro, consistente con el CRM)
// =============================================================================

import { useState, useTransition, type CSSProperties, type ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { updateLeadAction, deleteLeadAction } from '../actions';
import type { Lead, LeadUpdateInput, EstadoLead } from '@/lib/leads';

type TriState = boolean | null;

const MONO = "'Geist Mono', monospace";
const SANS = "'Geist', sans-serif";
const card: CSSProperties = { background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 16, padding: '22px 24px' };
const sectLabel: CSSProperties = { fontFamily: MONO, fontSize: 11, letterSpacing: '.1em', textTransform: 'uppercase', color: 'var(--dim)' };

export function EditLeadForm({ lead }: { lead: Lead }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [feedback, setFeedback] = useState<{ kind: 'ok' | 'err'; msg: string } | null>(null);

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

  const [estado, setEstado] = useState<EstadoLead>(lead.estado_lead);
  const [motivoPerdida, setMotivoPerdida] = useState(lead.motivo_perdida ?? '');
  const [montoCierre, setMontoCierre] = useState<string>(lead.monto_cierre_usd?.toString() ?? '');
  const [fechaCierre, setFechaCierre] = useState(lead.fecha_cierre ?? '');
  const [fechaConfirmacion, setFechaConfirmacion] = useState(lead.fecha_confirmacion ?? '');
  const [fechaInicioServicio, setFechaInicioServicio] = useState(lead.fecha_inicio_servicio ?? '');

  const asistioJ1Disabled = !fechaJ1;
  const calificadoDisabled = asistioJ1 !== true;
  const asistioJ2Disabled = !fechaJ2;
  const esGanado = estado === 'ganado';
  const esPerdidaODescal = estado === 'perdido' || estado === 'descalificado';

  const handleFechaJ1Change = (v: string) => { setFechaJ1(v); if (!v) { setAsistioJ1(null); setCalificado(null); } };
  const handleAsistioJ1Change = (v: TriState) => { setAsistioJ1(v); if (v !== true) setCalificado(null); };
  const handleEstadoChange = (v: EstadoLead) => {
    setEstado(v);
    if (v !== 'ganado') { setMontoCierre(''); setFechaCierre(''); }
    if (v !== 'perdido' && v !== 'descalificado') setMotivoPerdida('');
  };
  const handleFechaJ2Change = (v: string) => { setFechaJ2(v); if (!v) setAsistioJ2(null); };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setFeedback(null);
    if (!nombre.trim()) { setFeedback({ kind: 'err', msg: 'Nombre es requerido' }); return; }
    if (estado === 'ganado') {
      const monto = parseFloat(montoCierre);
      if (!Number.isFinite(monto) || monto <= 0) { setFeedback({ kind: 'err', msg: 'Si el estado es Ganado, el monto debe ser un número positivo' }); return; }
    }
    const payload: LeadUpdateInput = {
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
      estado_lead: estado,
      motivo_perdida: esPerdidaODescal ? (motivoPerdida.trim() || null) : null,
      monto_cierre_usd: estado === 'ganado' ? parseFloat(montoCierre) : null,
      fecha_cierre: estado === 'ganado' ? fechaCierre || null : null,
      fecha_confirmacion: fechaConfirmacion || null,
      fecha_inicio_servicio: estado === 'ganado' ? fechaInicioServicio || null : null,
    };
    startTransition(async () => {
      try {
        await updateLeadAction(lead.id, payload);
        setFeedback({ kind: 'ok', msg: 'Cambios guardados' });
        router.refresh();
      } catch (err) {
        setFeedback({ kind: 'err', msg: err instanceof Error ? err.message : String(err) });
      }
    });
  };

  const handleDelete = () => {
    if (!confirm(`¿Borrar lead "${lead.nombre}"? Esta acción no se puede deshacer.`)) return;
    startTransition(async () => {
      try { await deleteLeadAction(lead.id); }
      catch (err) { setFeedback({ kind: 'err', msg: err instanceof Error ? err.message : String(err) }); }
    });
  };

  return (
    <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
      {/* CONTACTO */}
      <section style={card}>
        <div style={{ ...sectLabel, marginBottom: 16 }}>Información de contacto</div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 14 }}>
          <Field label="Nombre" required><input className="lead-field" value={nombre} onChange={(e) => setNombre(e.target.value)} required /></Field>
          <Field label="Empresa"><input className="lead-field" value={empresa} onChange={(e) => setEmpresa(e.target.value)} /></Field>
          <Field label="Email"><input className="lead-field" type="email" value={email} onChange={(e) => setEmail(e.target.value)} /></Field>
          <Field label="Teléfono"><input className="lead-field" type="tel" value={telefono} onChange={(e) => setTelefono(e.target.value)} /></Field>
        </div>
      </section>

      <RespuestasCard lead={lead} />

      {/* COMERCIAL */}
      <section style={card}>
        <div style={{ ...sectLabel, marginBottom: 16 }}>Datos comerciales</div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 14 }}>
          <Field label="Fecha de agendamiento"><input className="lead-field" type="date" value={fechaAgenda} onChange={(e) => setFechaAgenda(e.target.value)} /></Field>
          <Field label="Fecha de Reunión 1 (anchor de cohorte)"><input className="lead-field" type="date" value={fechaJ1} onChange={(e) => handleFechaJ1Change(e.target.value)} /></Field>
          <Field label="¿Asistió a R1?" disabled={asistioJ1Disabled} hint={asistioJ1Disabled ? 'Marcá fecha R1 primero' : undefined}>
            <TriToggle value={asistioJ1} onChange={handleAsistioJ1Change} disabled={asistioJ1Disabled} />
          </Field>
          <Field label="¿Era lead calificado?" disabled={calificadoDisabled} hint={calificadoDisabled ? 'Solo si asistió a R1 = Sí' : undefined}>
            <TriToggle value={calificado} onChange={setCalificado} disabled={calificadoDisabled} />
          </Field>
          <Field label="Fecha de Reunión 2 (opcional)"><input className="lead-field" type="date" value={fechaJ2} onChange={(e) => handleFechaJ2Change(e.target.value)} /></Field>
          <Field label="¿Asistió a R2?" disabled={asistioJ2Disabled} hint={asistioJ2Disabled ? 'Marcá fecha R2 primero' : undefined}>
            <TriToggle value={asistioJ2} onChange={setAsistioJ2} disabled={asistioJ2Disabled} />
          </Field>
          <Field label="Fecha de confirmación (opcional)" hint="Cuándo el cliente confirmó verbalmente el cierre (entre R2 y primer pago).">
            <input className="lead-field" type="date" value={fechaConfirmacion} onChange={(e) => setFechaConfirmacion(e.target.value)} />
          </Field>
        </div>
      </section>

      {/* RESOLUCIÓN */}
      <section style={card}>
        <div style={{ ...sectLabel, marginBottom: 10 }}>Resolución</div>
        <p style={{ fontSize: 13.5, color: 'var(--dim)', marginBottom: 16, lineHeight: 1.5 }}>
          Cómo terminó este lead. <b>Perdido</b> = lo trabajamos y no compró. <b>Descalificado</b> = no era buen fit (presupuesto, tamaño, timing). <b>Abierto</b> = sigue en proceso.
        </p>
        <Field label="Estado del lead"><EstadoSelector value={estado} onChange={handleEstadoChange} /></Field>

        {esGanado && (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 14, marginTop: 16 }}>
            <Field label="Monto del cierre (USD)" required>
              <input className="lead-field" type="number" step="0.01" min="0" value={montoCierre} onChange={(e) => setMontoCierre(e.target.value)} required={estado === 'ganado'} />
            </Field>
            <Field label="Fecha de cierre"><input className="lead-field" type="date" value={fechaCierre} onChange={(e) => setFechaCierre(e.target.value)} /></Field>
            <Field label="Fecha inicio de servicio (opcional)"><input className="lead-field" type="date" value={fechaInicioServicio} onChange={(e) => setFechaInicioServicio(e.target.value)} /></Field>
          </div>
        )}

        {esPerdidaODescal && (
          <div style={{ marginTop: 16 }}>
            <Field label="Motivo" hint="Tocá una sugerencia o escribí el tuyo. Sirve para ver patrones de pérdida.">
              <MotivoSugerencias value={motivoPerdida} onChange={setMotivoPerdida} />
            </Field>
          </div>
        )}
      </section>

      {/* FEEDBACK + ACCIONES */}
      {feedback && (
        <div style={{ borderRadius: 11, padding: '11px 16px', fontSize: 14, fontWeight: 600, background: feedback.kind === 'ok' ? 'var(--good-bg)' : 'var(--bad-bg)', color: feedback.kind === 'ok' ? 'var(--good)' : 'var(--bad)' }}>
          {feedback.msg}
        </div>
      )}

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
        <button type="button" onClick={handleDelete} disabled={pending} style={{ padding: '9px 14px', borderRadius: 10, border: '1px solid var(--bad)', background: 'transparent', color: 'var(--bad)', fontSize: 14, fontWeight: 600, cursor: 'pointer', fontFamily: SANS, opacity: pending ? 0.5 : 1 }}>Borrar lead</button>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <button type="button" onClick={() => router.push('/leads')} style={{ padding: '10px 16px', borderRadius: 10, border: '1px solid var(--border-strong)', background: 'var(--surface)', color: 'var(--dim)', fontSize: 14, fontWeight: 500, cursor: 'pointer', fontFamily: SANS }}>Cancelar</button>
          <button type="submit" disabled={pending} style={{ padding: '11px 24px', borderRadius: 10, border: 'none', background: 'var(--accent)', color: '#fff', fontSize: 14, fontWeight: 700, cursor: 'pointer', fontFamily: SANS, opacity: pending ? 0.6 : 1 }}>{pending ? 'Guardando…' : 'Guardar cambios'}</button>
        </div>
      </div>
    </form>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
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
  const options: Array<{ v: TriState; label: string; fg: string; bg: string }> = [
    { v: true, label: 'Sí', fg: 'var(--good)', bg: 'var(--good-bg)' },
    { v: false, label: 'No', fg: 'var(--bad)', bg: 'var(--bad-bg)' },
    { v: null, label: '—', fg: 'var(--dim)', bg: 'var(--surface-2)' },
  ];
  return (
    <div style={{ display: 'inline-flex', borderRadius: 10, border: '1px solid var(--border-strong)', overflow: 'hidden', opacity: disabled ? 0.5 : 1 }}>
      {options.map((opt, i) => {
        const active = value === opt.v;
        return (
          <button key={String(opt.v)} type="button" disabled={disabled} onClick={() => onChange(opt.v)} style={{ padding: '9px 16px', fontSize: 14, fontWeight: 600, fontFamily: SANS, cursor: disabled ? 'not-allowed' : 'pointer', border: 'none', borderRight: i < options.length - 1 ? '1px solid var(--border-strong)' : 'none', background: active ? opt.bg : 'var(--surface)', color: active ? opt.fg : 'var(--dim)' }}>{opt.label}</button>
        );
      })}
    </div>
  );
}

function EstadoSelector({ value, onChange }: { value: EstadoLead; onChange: (v: EstadoLead) => void }) {
  const options: Array<{ v: EstadoLead; label: string; fg: string; bg: string }> = [
    { v: 'abierto', label: 'Abierto', fg: 'var(--dim)', bg: 'var(--surface-2)' },
    { v: 'ganado', label: 'Ganado', fg: 'var(--good)', bg: 'var(--good-bg)' },
    { v: 'perdido', label: 'Perdido', fg: 'var(--bad)', bg: 'var(--bad-bg)' },
    { v: 'descalificado', label: 'Descalificado', fg: 'var(--warn)', bg: 'var(--warn-bg)' },
  ];
  return (
    <div style={{ display: 'inline-flex', flexWrap: 'wrap', borderRadius: 10, border: '1px solid var(--border-strong)', overflow: 'hidden' }}>
      {options.map((opt, i) => {
        const active = value === opt.v;
        return (
          <button key={opt.v} type="button" onClick={() => onChange(opt.v)} style={{ padding: '9px 16px', fontSize: 14, fontWeight: 600, fontFamily: SANS, cursor: 'pointer', border: 'none', borderRight: i < options.length - 1 ? '1px solid var(--border-strong)' : 'none', background: active ? opt.bg : 'var(--surface)', color: active ? opt.fg : 'var(--dim)' }}>{opt.label}</button>
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
            <button key={s} type="button" onClick={() => onChange(s)} style={{ padding: '6px 13px', borderRadius: 999, fontSize: 13, fontWeight: 600, fontFamily: SANS, cursor: 'pointer', background: active ? 'rgba(200,135,12,.10)' : 'var(--surface)', border: '1px solid ' + (active ? 'var(--accent)' : 'var(--border-strong)'), color: active ? '#9A6A09' : 'var(--dim)' }}>{s}</button>
          );
        })}
      </div>
      <input className="lead-field" type="text" value={value} onChange={(e) => onChange(e.target.value)} placeholder="Motivo (texto libre)" />
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
  const hayAlguna = rows.some((r) => r.value && r.value.trim());
  return (
    <section style={card}>
      <div style={{ ...sectLabel, marginBottom: 16 }}>Respuestas del formulario</div>
      {!hayAlguna ? (
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
