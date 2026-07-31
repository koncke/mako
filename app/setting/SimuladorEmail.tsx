'use client';

// =============================================================================
// SimuladorEmail — cliente de correo simulado de la tab /setting
// =============================================================================
// Muestra cada paso de EMAIL de la jugada como lo vería el lead: remitente,
// asunto, preheader y cuerpo. Navegable entre pasos, con el timing anotado.

import { useState, type CSSProperties } from 'react';
import type { JugadaDto } from './SettingApp';

function conVars(s: string): string {
  return s
    .replace(/\{\{\s*nombre\s*\}\}/gi, 'Juan')
    .replace(/\{\{\s*apellido\s*\}\}/gi, 'Pérez')
    .replace(/\{\{\s*empresa\s*\}\}/gi, 'Acme SRL');
}

function fmtTiming(h: number): string {
  if (h <= 1) return 'al entrar a la etapa';
  if (h < 24) return `a las ${h}h`;
  const d = Math.round(h / 24);
  return d === 1 ? 'al día siguiente' : `a los ${d} días`;
}

const chip: CSSProperties = { display: 'inline-flex', alignItems: 'center', padding: '3px 10px', borderRadius: 999, background: 'var(--surface-2)', color: 'var(--dim)', fontSize: '11px', fontWeight: 600 };

export function SimuladorEmail({ jugada, nombreNegocio }: { jugada: JugadaDto | null; nombreNegocio: string }) {
  const [idx, setIdx] = useState(0);
  const emails = (jugada?.pasos ?? []).filter((p) => p.canal === 'email');
  const paso = emails[Math.min(idx, Math.max(0, emails.length - 1))] ?? null;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', width: '100%', maxWidth: 620, minHeight: 480, borderRadius: 18, border: '1px solid var(--border-strong)', background: 'var(--surface)', overflow: 'hidden', boxShadow: '0 8px 32px rgba(0,0,0,0.08)' }}>
      {/* Barra del cliente de correo */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '12px 16px', borderBottom: '1px solid var(--border)', background: 'var(--surface-2)' }}>
        <span style={{ display: 'inline-flex', gap: 5 }}>
          <span style={{ width: 10, height: 10, borderRadius: '50%', background: 'var(--bad)', opacity: 0.6 }} />
          <span style={{ width: 10, height: 10, borderRadius: '50%', background: 'var(--warn-fill)', opacity: 0.6 }} />
          <span style={{ width: 10, height: 10, borderRadius: '50%', background: 'var(--good)', opacity: 0.6 }} />
        </span>
        <span style={{ fontSize: 12.5, color: 'var(--faint)', fontWeight: 600 }}>Bandeja de entrada del lead</span>
        {emails.length > 1 && (
          <span style={{ marginLeft: 'auto', display: 'inline-flex', alignItems: 'center', gap: 8 }}>
            <button onClick={() => setIdx((i) => Math.max(0, i - 1))} disabled={idx === 0} style={{ border: '1px solid var(--border-strong)', background: 'var(--surface)', color: 'var(--dim)', borderRadius: 8, padding: '3px 10px', cursor: 'pointer', opacity: idx === 0 ? 0.4 : 1 }}>←</button>
            <span style={{ fontSize: 12, color: 'var(--dim)', fontVariantNumeric: 'tabular-nums' }}>{Math.min(idx + 1, emails.length)} / {emails.length}</span>
            <button onClick={() => setIdx((i) => Math.min(emails.length - 1, i + 1))} disabled={idx >= emails.length - 1} style={{ border: '1px solid var(--border-strong)', background: 'var(--surface)', color: 'var(--dim)', borderRadius: 8, padding: '3px 10px', cursor: 'pointer', opacity: idx >= emails.length - 1 ? 0.4 : 1 }}>→</button>
          </span>
        )}
      </div>

      {!jugada && (
        <div style={{ margin: 'auto', color: 'var(--faint)', fontSize: 13.5, padding: 30 }}>Elegí una jugada arriba para ver sus emails.</div>
      )}
      {jugada && !paso && (
        <div style={{ margin: 'auto', color: 'var(--faint)', fontSize: 13.5, padding: 30 }}>Esta jugada no tiene pasos de email.</div>
      )}

      {paso && (
        <div style={{ flex: 1, padding: '22px 26px', display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
            <span style={chip}>⏱ llega {fmtTiming(paso.delay_horas)}</span>
            <span style={chip}>mensaje {paso.orden} de la secuencia</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, paddingBottom: 14, borderBottom: '1px solid var(--border)' }}>
            <div style={{ width: 40, height: 40, borderRadius: '50%', background: 'var(--accent-soft)', color: '#171511', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: 16 }}>
              {(nombreNegocio || 'M').slice(0, 1).toUpperCase()}
            </div>
            <div style={{ minWidth: 0 }}>
              <div style={{ fontWeight: 600, fontSize: 14, color: 'var(--ink)' }}>{nombreNegocio || 'Tu negocio'} <span style={{ fontWeight: 400, color: 'var(--faint)', fontSize: 12.5 }}>&lt;hola@tu-dominio.com&gt;</span></div>
              <div style={{ fontSize: 12, color: 'var(--faint)' }}>para Juan Pérez</div>
            </div>
          </div>
          <div>
            <div style={{ fontWeight: 700, fontSize: 17, color: 'var(--ink)', marginBottom: 3 }}>{conVars(paso.asunto ?? '(sin asunto)')}</div>
            {paso.preheader && <div style={{ fontSize: 12.5, color: 'var(--faint)' }}>{conVars(paso.preheader)}</div>}
          </div>
          <div style={{ fontSize: 14, color: 'var(--ink)', lineHeight: 1.7, whiteSpace: 'pre-wrap' }}>{conVars(paso.cuerpo)}</div>
        </div>
      )}
    </div>
  );
}
