'use client';

// =============================================================================
// GoogleCalendarPanel — conectar/desconectar Google Calendar (3ra fuente auto)
// =============================================================================
// Al conectar, el buscador automático de reuniones cruza Calendly + Fathom +
// Google Calendar. La conexión es del workspace principal (dueño).

import { useEffect, useState, type CSSProperties } from 'react';
import { useSearchParams } from 'next/navigation';
import { getGoogleCalendarStatusAction, disconnectGoogleCalendarAction } from './gcal-actions';

const SANS = "'Geist', sans-serif";
const card: CSSProperties = { background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 16, padding: 20 };
const primaryBtn: CSSProperties = { padding: '9px 16px', borderRadius: 10, border: 'none', background: 'var(--primary)', color: '#fff', fontSize: 13.5, fontWeight: 700, cursor: 'pointer', fontFamily: SANS, textDecoration: 'none', display: 'inline-block' };
const ghostBtn: CSSProperties = { padding: '9px 14px', borderRadius: 10, border: '1px solid var(--border-strong)', background: 'var(--surface)', color: 'var(--dim)', fontSize: 13.5, fontWeight: 600, cursor: 'pointer', fontFamily: SANS };

const MSG: Record<string, { kind: 'ok' | 'err'; txt: string }> = {
  ok: { kind: 'ok', txt: 'Google Calendar conectado. Ya se usa como fuente en la búsqueda automática de reuniones.' },
  csrf: { kind: 'err', txt: 'La conexión falló por seguridad (CSRF). Reintentá.' },
  'sin-refresh': { kind: 'err', txt: 'Google no devolvió el token. Reintentá (te va a pedir el consentimiento de nuevo).' },
  config: { kind: 'err', txt: 'Faltan credenciales de Google (GOOGLE_CLIENT_ID/SECRET).' },
  exchange: { kind: 'err', txt: 'No se pudo completar la conexión. Reintentá.' },
  'no-permitido': { kind: 'err', txt: 'Solo el workspace principal puede conectar Google Calendar.' },
};

const mono: CSSProperties = { fontFamily: "'Geist Mono', monospace", fontSize: 12, wordBreak: 'break-all', background: 'var(--surface-2)', border: '1px solid var(--border)', borderRadius: 8, padding: '7px 10px', color: 'var(--ink)', display: 'block', marginTop: 6 };

export function GoogleCalendarPanel() {
  const sp = useSearchParams();
  const gcal = sp.get('gcal');
  const [estado, setEstado] = useState<{ conectado: boolean; puede: boolean; redirectUri: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [copiado, setCopiado] = useState(false);

  const cargar = () => { getGoogleCalendarStatusAction().then(setEstado).catch(() => setEstado({ conectado: false, puede: false, redirectUri: '' })); };
  useEffect(() => { cargar(); }, []);

  const desconectar = async () => { setBusy(true); try { await disconnectGoogleCalendarAction(); cargar(); } finally { setBusy(false); } };

  if (estado && !estado.puede) return null; // solo el dueño ve el panel

  return (
    <section style={{ marginTop: 34 }}>
      <h2 style={{ fontSize: 19, fontWeight: 600, color: 'var(--ink)', margin: '0 0 12px' }}>Google Calendar</h2>
      <div style={card}>
        {gcal && MSG[gcal] && (
          <div style={{ borderRadius: 11, padding: '11px 16px', fontSize: 13.5, fontWeight: 600, marginBottom: 14, background: MSG[gcal].kind === 'ok' ? 'var(--good-bg)' : 'var(--bad-bg)', color: MSG[gcal].kind === 'ok' ? 'var(--good)' : 'var(--bad)' }}>{MSG[gcal].txt}</div>
        )}
        <p style={{ fontSize: 13.5, color: 'var(--dim)', margin: '0 0 14px', lineHeight: 1.55 }}>
          Conectá tu Google Calendar para que la búsqueda automática de reuniones (en el wizard) cruce también tus eventos, además de Calendly y Fathom.
        </p>
        {estado === null ? (
          <div style={{ fontSize: 13, color: 'var(--faint)' }}>Cargando…</div>
        ) : estado.conectado ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 7, fontSize: 13.5, fontWeight: 600, color: 'var(--good)' }}>
              <span style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--good)' }} /> Conectado
            </span>
            <button type="button" style={ghostBtn} disabled={busy} onClick={() => void desconectar()}>{busy ? 'Desconectando…' : 'Desconectar'}</button>
          </div>
        ) : (
          <a href="/api/integraciones/google-calendar" style={primaryBtn}>Conectar Google Calendar</a>
        )}

        {/* Ayuda para el "Error 400: redirect_uri_mismatch": ese error lo muestra
            Google (antes de volver a la app) cuando la URI de abajo no está
            registrada en el cliente OAuth. Se muestra siempre que no esté conectado. */}
        {estado && !estado.conectado && estado.redirectUri && (
          <div style={{ marginTop: 16, paddingTop: 14, borderTop: '1px solid var(--border)' }}>
            <div style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--ink)', marginBottom: 4 }}>¿Ves «Error 400: redirect_uri_mismatch»?</div>
            <p style={{ fontSize: 12.5, color: 'var(--dim)', lineHeight: 1.5, margin: 0 }}>
              En Google Cloud Console → APIs y servicios → Credenciales → tu cliente OAuth, agregá esta URI EXACTA en «URIs de redireccionamiento autorizadas»:
            </p>
            <code style={mono}>{estado.redirectUri}</code>
            <button
              type="button"
              style={{ ...ghostBtn, marginTop: 8, padding: '6px 12px', fontSize: 12.5 }}
              onClick={() => { void navigator.clipboard?.writeText(estado.redirectUri); setCopiado(true); setTimeout(() => setCopiado(false), 1600); }}
            >{copiado ? 'Copiado ✓' : 'Copiar URI'}</button>
          </div>
        )}
      </div>
    </section>
  );
}
