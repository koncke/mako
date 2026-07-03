'use client';

// =============================================================================
// QuickActions — acciones rápidas de contacto de la ficha del lead
// =============================================================================
// Copiar teléfono / WhatsApp (abre la tab /whatsapp en el chat del lead vía
// ?lead=<id>) / Email (mailto) / Copiar email. Compartido por modal y ruta.

import Link from 'next/link';
import { useState, type CSSProperties } from 'react';

const SANS = "'Geist', sans-serif";

export function QuickActions({ leadId, email, telefono }: { leadId: number; email: string | null; telefono: string | null }) {
  const [copied, setCopied] = useState('');
  const hasPhone = !!telefono && telefono !== '—';
  const hasEmail = !!email;

  const qa = (enabled: boolean): CSSProperties => ({ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '7px 13px', borderRadius: 9, border: '1px solid var(--border-strong)', background: 'var(--surface)', color: enabled ? 'var(--ink)' : 'var(--faint)', fontSize: 13, fontWeight: 600, textDecoration: 'none', cursor: enabled ? 'pointer' : 'not-allowed', fontFamily: SANS, opacity: enabled ? 1 : 0.55 });
  const copy = (text: string, key: string) => {
    navigator.clipboard?.writeText(text).then(() => { setCopied(key); setTimeout(() => setCopied(''), 1200); }).catch(() => {});
  };

  return (
    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
      {hasPhone
        ? <button onClick={() => copy(telefono!, 'tel')} style={{ ...qa(true), border: '1px solid var(--border-strong)' }}>{copied === 'tel' ? '✓ Copiado' : 'Copiar teléfono'}</button>
        : <span style={qa(false)}>Copiar teléfono</span>}
      {hasPhone
        ? <Link href={`/whatsapp?lead=${leadId}`} style={qa(true)}>WhatsApp</Link>
        : <span style={qa(false)}>WhatsApp</span>}
      {hasEmail ? <a href={`mailto:${email}`} style={qa(true)}>Email</a> : <span style={qa(false)}>Email</span>}
      {hasEmail && <button onClick={() => copy(email!, 'email')} style={qa(true)}>{copied === 'email' ? '✓ Copiado' : 'Copiar email'}</button>}
    </div>
  );
}
