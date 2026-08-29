'use client';

// =============================================================================
// NewLeadForm — form de alta con validación: nombre + (email O teléfono)
// =============================================================================
// Sin contacto el lead es incontactable, así que se exige al menos un canal.
// El submit va a la server action createLeadAction (que re-valida).

import { useState, type CSSProperties, type ReactNode } from 'react';
import Link from '@/app/_ui/Link';
import { createLeadAction } from '../actions';

const SANS = "'Geist', sans-serif";
const field: CSSProperties = { width: '100%', padding: '10px 13px', borderRadius: 10, border: '1px solid var(--border-strong)', background: 'var(--surface-2)', color: 'var(--ink)', fontFamily: SANS, fontSize: 15, outline: 'none' };
const card: CSSProperties = { maxWidth: 720, background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 16, padding: 'clamp(20px,4vw,32px)' };

export function NewLeadForm() {
  const [err, setErr] = useState<string | null>(null);

  return (
    <form
      action={createLeadAction}
      onSubmit={(e) => {
        const fd = new FormData(e.currentTarget);
        const email = String(fd.get('email') ?? '').trim();
        const telefono = String(fd.get('telefono') ?? '').trim();
        if (!email && !telefono) {
          e.preventDefault();
          setErr('Carga al menos un email o un teléfono: sin eso el lead es incontactable.');
        } else {
          setErr(null);
        }
      }}
      style={{ ...card, display: 'flex', flexDirection: 'column', gap: 16 }}
    >
      <Field label="Nombre" required>
        <input type="text" name="nombre" required autoFocus style={field} />
      </Field>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 16 }}>
        <Field label="Email" hint="Al menos uno: email o teléfono."><input type="email" name="email" style={field} /></Field>
        <Field label="Teléfono"><input type="tel" name="telefono" style={field} /></Field>
      </div>

      <Field label="Empresa"><input type="text" name="empresa" style={field} /></Field>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 16 }}>
        <Field label="Fecha de agendamiento"><input type="date" name="fecha_agenda" style={field} /></Field>
        <Field label="Fecha de Reunión 1 (si ya la tienes)"><input type="date" name="fecha_junta_1" style={field} /></Field>
      </div>

      {err && (
        <div style={{ borderRadius: 11, padding: '11px 16px', fontSize: 14, fontWeight: 600, background: 'var(--bad-bg)', color: 'var(--bad)' }}>{err}</div>
      )}

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 12, paddingTop: 4 }}>
        <Link href="/crm" style={{ padding: '10px 16px', fontSize: 14, color: 'var(--dim)', textDecoration: 'none' }}>Cancelar</Link>
        <button type="submit" style={{ padding: '11px 24px', borderRadius: 10, border: 'none', background: 'var(--primary)', color: '#fff', fontSize: 14, fontWeight: 700, cursor: 'pointer', fontFamily: SANS }}>Crear lead</button>
      </div>
    </form>
  );
}

function Field({ label, required, hint, children }: { label: string; required?: boolean; hint?: string; children: ReactNode }) {
  return (
    <label style={{ display: 'block' }}>
      <span style={{ display: 'block', fontSize: 12.5, marginBottom: 6, color: 'var(--dim)' }}>
        {label}{required && <span style={{ color: 'var(--bad)', marginLeft: 3 }}>*</span>}
      </span>
      {children}
      {hint && <span style={{ display: 'block', fontSize: 12, marginTop: 5, color: 'var(--faint)' }}>{hint}</span>}
    </label>
  );
}
