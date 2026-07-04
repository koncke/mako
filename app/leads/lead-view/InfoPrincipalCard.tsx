'use client';

// =============================================================================
// InfoPrincipalCard — información principal del lead (contacto accionable)
// =============================================================================
// Teléfono y email: click en el dato (o en el ícono de copiar) lo copia al
// portapapeles; al lado, el ícono de WhatsApp abre la tab /whatsapp en el chat
// del lead y el de Gmail abre un correo a ese lead. Reemplaza a QuickActions.

import Link from 'next/link';
import { useState, type CSSProperties, type ReactNode } from 'react';

const MONO = "'Geist Mono', monospace";
const SANS = "'Geist', sans-serif";
const card: CSSProperties = { background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 16, padding: '22px 24px' };
const sectLabel: CSSProperties = { fontFamily: MONO, fontSize: 11, letterSpacing: '.1em', textTransform: 'uppercase', color: 'var(--dim)' };

function IconCopy() {
  return <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><rect x="9" y="9" width="12" height="12" rx="2.5" /><path d="M5 15V5a2 2 0 0 1 2-2h10" /></svg>;
}
function IconWhatsApp() {
  return <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2a10 10 0 0 0-8.6 15.1L2 22l5-1.3A10 10 0 1 0 12 2Zm5.3 14.1c-.2.6-1.2 1.2-1.7 1.2-.5.1-1 .2-3.3-.7-2.8-1.1-4.6-4-4.7-4.2-.1-.2-1.1-1.5-1.1-2.9s.7-2 1-2.3c.2-.3.5-.3.7-.3h.5c.2 0 .4 0 .6.5s.8 1.9.8 2c.1.1.1.3 0 .5l-.4.6c-.1.2-.3.3-.1.6.2.3.8 1.3 1.7 2.1 1.2 1 2.1 1.4 2.4 1.5.3.1.5.1.6-.1l.8-1c.2-.3.4-.2.6-.1l1.9.9c.3.1.5.2.5.3.1.1.1.7-.1 1.4Z" /></svg>;
}
function IconMail() {
  return <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><rect x="2.5" y="5" width="19" height="14" rx="2.5" /><path d="m3.5 7 8.5 6 8.5-6" /></svg>;
}

function Row({ label, value, copyKey, copied, onCopy, extra }: {
  label: string; value: string | null; copyKey: string; copied: string;
  onCopy: (text: string, key: string) => void; extra?: ReactNode;
}) {
  const has = !!value?.trim();
  const iconBtn: CSSProperties = { display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 30, height: 30, borderRadius: 8, border: '1px solid var(--border-strong)', background: 'var(--surface)', color: 'var(--dim)', cursor: 'pointer', flex: 'none' };
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0, background: 'var(--surface-2)', border: '1px solid var(--border)', borderRadius: 12, padding: '12px 15px' }}>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 11.5, color: 'var(--dim)' }}>{label}</div>
        {has ? (
          <button
            type="button"
            onClick={() => onCopy(value!, copyKey)}
            title="Copiar"
            style={{ display: 'block', maxWidth: '100%', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', background: 'transparent', border: 'none', padding: 0, marginTop: 2, fontSize: 14.5, fontWeight: 600, color: copied === copyKey ? 'var(--good)' : 'var(--ink)', cursor: 'pointer', fontFamily: SANS, textAlign: 'left' }}
          >
            {copied === copyKey ? 'Copiado ✓' : value}
          </button>
        ) : (
          <div style={{ fontSize: 14.5, color: 'var(--faint)', marginTop: 2 }}>—</div>
        )}
      </div>
      {has && (
        <button type="button" onClick={() => onCopy(value!, copyKey)} aria-label={`Copiar ${label.toLowerCase()}`} title="Copiar" style={iconBtn}>
          <IconCopy />
        </button>
      )}
      {has && extra}
    </div>
  );
}

export function InfoPrincipalCard({ leadId, nombre, empresa, email, telefono, direccion, cohorte }: {
  leadId: number; nombre: string; empresa: string | null; email: string | null; telefono: string | null;
  direccion?: string | null;
  /** Cohorte de madurez del lead — solo tiene sentido si hubo R1. */
  cohorte?: { label: string; color: string; texto: string | null } | null;
}) {
  const [copied, setCopied] = useState('');
  const copy = (text: string, key: string) => {
    navigator.clipboard?.writeText(text).then(() => { setCopied(key); setTimeout(() => setCopied(''), 1200); }).catch(() => {});
  };
  const iconLink: CSSProperties = { display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 30, height: 30, borderRadius: 8, border: '1px solid var(--border-strong)', background: 'var(--surface)', color: 'var(--primary)', flex: 'none', textDecoration: 'none' };
  return (
    <section style={card}>
      <div style={{ ...sectLabel, marginBottom: 14 }}>Información principal</div>
      {/* 2×2 fijo (nombre|empresa / teléfono|email) — nunca 3 arriba y 1 abajo. */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: '16px 24px' }}>
        <Row label="Nombre" value={nombre} copyKey="nombre" copied={copied} onCopy={copy} />
        <Row label="Empresa" value={empresa} copyKey="empresa" copied={copied} onCopy={copy} />
        <Row
          label="Teléfono" value={telefono && telefono !== '—' ? telefono : null} copyKey="tel" copied={copied} onCopy={copy}
          extra={<Link href={`/whatsapp?lead=${leadId}`} aria-label="Abrir chat de WhatsApp" title="Abrir chat de WhatsApp" style={iconLink}><IconWhatsApp /></Link>}
        />
        <Row
          label="Email" value={email} copyKey="email" copied={copied} onCopy={copy}
          extra={<a href={`https://mail.google.com/mail/?view=cm&to=${encodeURIComponent(email ?? '')}`} target="_blank" rel="noopener noreferrer" aria-label="Escribir por Gmail" title="Escribir por Gmail" style={iconLink}><IconMail /></a>}
        />
        {/* Dirección + Cohorte en la MISMA fila (Dirección ocupa todo si no hay cohorte). */}
        <div style={{ gridColumn: '1 / -1', display: 'grid', gridTemplateColumns: cohorte ? 'repeat(2, minmax(0, 1fr))' : '1fr', gap: '16px 24px' }}>
          <Row label="Dirección" value={direccion ?? null} copyKey="dir" copied={copied} onCopy={copy} />
          {cohorte && (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, background: 'var(--surface-2)', border: '1px solid var(--border)', borderRadius: 12, padding: '12px 15px' }}>
              <div style={{ fontSize: 11.5, color: 'var(--dim)' }}>Cohorte</div>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 10 }}>
                <span style={{ fontSize: 15, fontWeight: 700, color: cohorte.color }}>{cohorte.label}</span>
                {cohorte.texto && <span style={{ fontSize: 12.5, color: 'var(--dim)' }}>{cohorte.texto}</span>}
              </div>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
