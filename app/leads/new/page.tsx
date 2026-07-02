// =============================================================================
// /leads/new — form de creación de lead
// =============================================================================
// Mínimo: nombre. Opcional: contacto + fechas iniciales.
// =============================================================================

import Link from 'next/link';
import type { CSSProperties, ReactNode } from 'react';
import { createLeadAction } from '../actions';
import { guardOnboarding } from '@/lib/tab-access';

export const dynamic = 'force-dynamic';

const SANS = "'Geist', sans-serif";
const field: CSSProperties = { width: '100%', padding: '10px 13px', borderRadius: 10, border: '1px solid var(--border-strong)', background: 'var(--surface-2)', color: 'var(--ink)', fontFamily: SANS, fontSize: 15, outline: 'none' };
const card: CSSProperties = { maxWidth: 720, background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 16, padding: 'clamp(20px,4vw,32px)' };

export default async function NewLeadPage() {
  await guardOnboarding();
  return (
    <main style={{ minHeight: '100vh', width: '100%', background: 'var(--bg)', color: 'var(--ink)', fontFamily: SANS, padding: 'clamp(20px,4vw,44px)' }}>
      <div style={{ maxWidth: 920, margin: '0 auto' }}>
        <Link href="/leads" style={{ fontSize: 14, color: 'var(--dim)', textDecoration: 'none' }}>← Volver a Leads</Link>
        <h1 style={{ fontSize: 'clamp(28px,6vw,42px)', fontWeight: 600, letterSpacing: '-0.02em', lineHeight: 1.05, margin: '14px 0 22px' }}>Nuevo lead</h1>

        <form action={createLeadAction} style={{ ...card, display: 'flex', flexDirection: 'column', gap: 16 }}>
          <Field label="Nombre" required>
            <input type="text" name="nombre" required autoFocus style={field} />
          </Field>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 16 }}>
            <Field label="Email"><input type="email" name="email" style={field} /></Field>
            <Field label="Teléfono"><input type="tel" name="telefono" style={field} /></Field>
          </div>

          <Field label="Empresa"><input type="text" name="empresa" style={field} /></Field>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 16 }}>
            <Field label="Fecha de agendamiento"><input type="date" name="fecha_agenda" style={field} /></Field>
            <Field label="Fecha de Reunión 1 (si ya la tenés)"><input type="date" name="fecha_junta_1" style={field} /></Field>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 12, paddingTop: 4 }}>
            <Link href="/leads" style={{ padding: '10px 16px', fontSize: 14, color: 'var(--dim)', textDecoration: 'none' }}>Cancelar</Link>
            <button type="submit" style={{ padding: '11px 24px', borderRadius: 10, border: 'none', background: 'var(--primary)', color: '#fff', fontSize: 14, fontWeight: 700, cursor: 'pointer', fontFamily: SANS }}>Crear lead</button>
          </div>
        </form>
      </div>
    </main>
  );
}

function Field({ label, required, children }: { label: string; required?: boolean; children: ReactNode }) {
  return (
    <label style={{ display: 'block' }}>
      <span style={{ display: 'block', fontSize: 12.5, marginBottom: 6, color: 'var(--dim)' }}>
        {label}{required && <span style={{ color: 'var(--bad)', marginLeft: 3 }}>*</span>}
      </span>
      {children}
    </label>
  );
}
