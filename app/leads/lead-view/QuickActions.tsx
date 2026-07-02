'use client';

// =============================================================================
// QuickActions — acciones rápidas de contacto (Llamar / Email / WhatsApp / Copiar)
// =============================================================================
// Compartido por el modal y la ruta. WhatsApp abre wa.me (externo) mientras no
// exista el resolver teléfono→contactId del inbox propio (pendiente conocido).

import { useState, type CSSProperties } from 'react';

const SANS = "'Geist', sans-serif";

export function QuickActions({ email, telefono, telefonoNorm }: { email: string | null; telefono: string | null; telefonoNorm: string | null }) {
  const [copied, setCopied] = useState('');
  const hasPhone = !!telefono && telefono !== '—';
  const hasEmail = !!email;
  const hasWa = !!telefonoNorm;

  const qa = (enabled: boolean): CSSProperties => ({ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '7px 13px', borderRadius: 9, border: '1px solid var(--border-strong)', background: 'var(--surface)', color: enabled ? 'var(--ink)' : 'var(--faint)', fontSize: 13, fontWeight: 600, textDecoration: 'none', cursor: enabled ? 'pointer' : 'not-allowed', fontFamily: SANS, opacity: enabled ? 1 : 0.55 });
  const copyBtn: CSSProperties = { flex: 'none', padding: '7px 12px', borderRadius: 9, border: '1px solid var(--border-strong)', background: 'var(--surface)', color: 'var(--dim)', fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: SANS };
  const copy = (text: string, key: string) => {
    navigator.clipboard?.writeText(text).then(() => { setCopied(key); setTimeout(() => setCopied(''), 1200); }).catch(() => {});
  };

  return (
    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
      {hasPhone ? <a href={`tel:${telefono}`} style={qa(true)}>Llamar</a> : <span style={qa(false)}>Llamar</span>}
      {hasEmail ? <a href={`mailto:${email}`} style={qa(true)}>Email</a> : <span style={qa(false)}>Email</span>}
      {hasWa ? <a href={`https://wa.me/${telefonoNorm}`} target="_blank" rel="noopener noreferrer" style={qa(true)}>WhatsApp</a> : <span style={qa(false)}>WhatsApp</span>}
      {hasEmail && <button onClick={() => copy(email!, 'email')} style={copyBtn}>{copied === 'email' ? '✓ Email' : 'Copiar email'}</button>}
      {hasPhone && <button onClick={() => copy(telefono!, 'tel')} style={copyBtn}>{copied === 'tel' ? '✓ Tel' : 'Copiar tel'}</button>}
    </div>
  );
}
