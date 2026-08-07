'use client';

// =============================================================================
// GoogleCalendarPanel — conectar/desconectar Google Calendar (3ra fuente auto)
// =============================================================================
// Al conectar, el buscador automático de reuniones cruza Calendly + Fathom +
// Google Calendar. La conexión es del workspace principal (dueño).
//
// Entrar con Google ya pide el scope de la agenda y la conecta sola. Este panel
// sigue siendo el camino manual para RE-AUTORIZAR sin desloguearse (quien se
// logueó antes de que el login pidiera Calendar no otorgó ese permiso).
//
// ⚠️ REGLA DE ESTADO (la pidió el dueño): «si necesitaba más permisos, debe
// aparecer como DESCONECTADO». Un token que lee pero no puede MOVER eventos no es
// media conexión con una nota al pie: es una conexión que no sirve para lo que se
// prometió. Se pinta como incompleta —ámbar, "Falta permiso", botón «Conectar»—
// nunca en verde. El verde queda para `conectado && puedeMover`, y punto.
//
// OJO: hoy este componente NO está montado en ninguna página — el botón vivo es
// la acción "Conectar Google Calendar" del modal de /integraciones.

import { useEffect, useState, type CSSProperties } from 'react';
import { useSearchParams } from 'next/navigation';
import { getGoogleCalendarStatusAction, disconnectGoogleCalendarAction, type GoogleCalendarStatus } from './gcal-actions';

const SANS = "'Geist', sans-serif";
const card: CSSProperties = { background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 16, padding: 20 };
const primaryBtn: CSSProperties = { padding: '9px 16px', borderRadius: 10, border: 'none', background: 'var(--primary)', color: '#fff', fontSize: 13.5, fontWeight: 700, cursor: 'pointer', fontFamily: SANS, textDecoration: 'none', display: 'inline-block' };
const ghostBtn: CSSProperties = { padding: '9px 14px', borderRadius: 10, border: '1px solid var(--border-strong)', background: 'var(--surface)', color: 'var(--dim)', fontSize: 13.5, fontWeight: 600, cursor: 'pointer', fontFamily: SANS };

/**
 * Cómo salió el paso por Google. El callback SIEMPRE vuelve a `/integraciones?gcal=…`,
 * así que estos mensajes los usa también IntegracionesBoard: sin eso, un re-consent
 * fallido (`sin-refresh`, `csrf`) volvía a una pantalla que no decía absolutamente
 * nada y el usuario quedaba tocando "Conectar" sin entender por qué no pasa nada.
 * Una copia sola, importada por los dos (ver «Una cosa, un lugar» en AGENTS.md).
 */
export const GCAL_MSG: Record<string, { kind: 'ok' | 'err'; txt: string }> = {
  ok: { kind: 'ok', txt: 'Google Calendar conectado. Ya se usa como fuente en la búsqueda automática de reuniones y para mover reuniones al reagendarlas.' },
  csrf: { kind: 'err', txt: 'La conexión falló por seguridad (CSRF). Reintentá.' },
  'sin-refresh': { kind: 'err', txt: 'Google no devolvió el token. Reintentá (te va a pedir el consentimiento de nuevo).' },
  config: { kind: 'err', txt: 'La conexión con Google no está disponible en este momento. Escribinos y lo resolvemos.' },
  exchange: { kind: 'err', txt: 'No se pudo completar la conexión. Reintentá.' },
  'no-permitido': { kind: 'err', txt: 'Solo el workspace principal puede conectar Google Calendar.' },
};

const mono: CSSProperties = { fontFamily: "'Geist Mono', monospace", fontSize: 12, wordBreak: 'break-all', background: 'var(--surface-2)', border: '1px solid var(--border)', borderRadius: 8, padding: '7px 10px', color: 'var(--ink)', display: 'block', marginTop: 6 };

export function GoogleCalendarPanel() {
  const sp = useSearchParams();
  const gcal = sp.get('gcal');
  const [estado, setEstado] = useState<GoogleCalendarStatus | null>(null);
  const [busy, setBusy] = useState(false);
  const [copiado, setCopiado] = useState(false);

  const cargar = () => { getGoogleCalendarStatusAction().then(setEstado).catch(() => setEstado({ conectado: false, puede: false, puedeMover: false, email: null, redirectUri: '' })); };
  useEffect(() => { cargar(); }, []);

  const desconectar = async () => { setBusy(true); try { await disconnectGoogleCalendarAction(); cargar(); } finally { setBusy(false); } };

  if (estado && !estado.puede) return null; // solo el dueño ve el panel

  // «Conectado» = conectado Y con permiso para mover. Un token de solo lectura
  // cuenta como NO conectado (ver la regla de estado arriba): el resto de la UI
  // deriva de estas dos, así que no hay forma de pintar verde algo a medias.
  const completa = !!estado?.conectado && estado.puedeMover;
  const incompleta = !!estado?.conectado && !estado.puedeMover;

  return (
    <section style={{ marginTop: 34 }}>
      <h2 style={{ fontSize: 19, fontWeight: 600, color: 'var(--ink)', margin: '0 0 12px' }}>Google Calendar</h2>
      <div style={card}>
        {gcal && GCAL_MSG[gcal] && (
          <div style={{ borderRadius: 11, padding: '11px 16px', fontSize: 13.5, fontWeight: 600, marginBottom: 14, background: GCAL_MSG[gcal].kind === 'ok' ? 'var(--good-bg)' : 'var(--bad-bg)', color: GCAL_MSG[gcal].kind === 'ok' ? 'var(--good)' : 'var(--bad)' }}>{GCAL_MSG[gcal].txt}</div>
        )}
        <p style={{ fontSize: 13.5, color: 'var(--dim)', margin: '0 0 14px', lineHeight: 1.55 }}>
          Con tu agenda conectada, la búsqueda automática de reuniones (en el wizard) cruza también tus eventos, además de Calendly y Fathom.
          Y al reagendar una reunión desde el CRM, el evento se mueve en tu calendario y el invitado recibe el aviso.
        </p>
        {estado === null ? (
          <div style={{ fontSize: 13, color: 'var(--faint)' }}>Cargando…</div>
        ) : completa ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 7, fontSize: 13.5, fontWeight: 600, color: 'var(--good)' }}>
              <span style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--good)' }} />
              Conectado
            </span>
            {estado.email && <span style={{ fontSize: 12.5, color: 'var(--faint)' }}>{estado.email}</span>}
            <button type="button" style={ghostBtn} disabled={busy} onClick={() => void desconectar()}>{busy ? 'Desconectando…' : 'Desconectar'}</button>
          </div>
        ) : incompleta ? (
          // Hay token, pero es de los VIEJOS (solo lectura). NO se muestra como
          // conectado: se leía la agenda mientras «Reagendar» no movía un solo
          // evento, y el usuario se enteraba por el invitado que llegó a la hora
          // vieja. Mismo tratamiento que un servicio sin configurar + el motivo.
          <div style={{ display: 'flex', flexDirection: 'column', gap: 11 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 7, fontSize: 13.5, fontWeight: 600, color: 'var(--warn)' }}>
                <span style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--warn-fill)' }} />
                No conectado — falta permiso
              </span>
              {estado.email && <span style={{ fontSize: 12.5, color: 'var(--faint)' }}>{estado.email}</span>}
              <button type="button" style={ghostBtn} disabled={busy} onClick={() => void desconectar()}>{busy ? 'Quitando…' : 'Quitar la agenda'}</button>
            </div>
            <div style={{ background: 'var(--warn-bg)', border: '1px solid var(--warn-fill)', borderRadius: 11, padding: '11px 14px' }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--warn)', marginBottom: 4 }}>Faltan permisos para mover reuniones</div>
              <p style={{ fontSize: 12.5, color: 'var(--dim)', lineHeight: 1.5, margin: '0 0 10px' }}>
                Autorizaste tu calendario cuando solo pedíamos leerlo: tus reuniones se detectan, pero «Reagendar» no puede mover el evento
                ni avisarle al invitado. Conectá de nuevo y Google te va a pedir el permiso que falta.
              </p>
              <a href="/api/integraciones/google-calendar" style={primaryBtn}>Conectar Google Calendar</a>
            </div>
          </div>
        ) : (
          <a href="/api/integraciones/google-calendar" style={primaryBtn}>Conectar Google Calendar</a>
        )}

        {/* Ayuda para el "Error 400: redirect_uri_mismatch": ese error lo muestra
            Google (antes de volver a la app) cuando la URI de abajo no está
            registrada en el cliente OAuth. El cliente OAuth es NUESTRO (de la
            agencia): el usuario no configura nada, así que esto no le pide que
            toque Cloud Console — es el dato que necesitamos para arreglarlo. */}
        {/* También con permiso incompleto: ahí el usuario TIENE que volver a pasar
            por Google, así que puede toparse con el mismo error 400. */}
        {estado && !completa && estado.redirectUri && (
          <div style={{ marginTop: 16, paddingTop: 14, borderTop: '1px solid var(--border)' }}>
            <div style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--ink)', marginBottom: 4 }}>¿Ves «Error 400: redirect_uri_mismatch»?</div>
            <p style={{ fontSize: 12.5, color: 'var(--dim)', lineHeight: 1.5, margin: 0 }}>
              Es una configuración nuestra, no tuya: no tenés que crear ninguna credencial. Pasanos esta dirección y lo destrabamos:
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
