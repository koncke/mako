'use client';

// =============================================================================
// DestinatariosModal — a quiénes les llegan las notificaciones del negocio
// =============================================================================
// Reemplaza a la card "Tu WhatsApp", que ocupaba media pantalla para un solo
// input y además solo aceptaba un número. Un negocio reparte: el dueño quiere el
// reporte, la asistente los avisos de reuniones, el contador la cobranza.
//
// El PRIMER número es el principal: es con el que se crea el grupo de WhatsApp de
// MaKo. Los demás se suman como participantes de ese mismo grupo.

import { useEffect, useState, type CSSProperties } from 'react';
import { Icon } from '../_components/icons';
import { telefonoValido, emailValido, type Destinatarios } from '@/lib/notif-catalogo';

const SANS = "'Geist', sans-serif";
const MONO = "'Geist Mono', monospace";

export type { Destinatarios };

const inputStyle: CSSProperties = {
  flex: 1, minWidth: 0, padding: '9px 12px', borderRadius: 10,
  border: '1px solid var(--border-strong)', background: 'var(--surface)',
  color: 'var(--ink)', fontSize: 14, fontFamily: SANS,
};
const btnDark: CSSProperties = {
  padding: '10px 18px', borderRadius: 10, border: 'none', background: '#171511',
  color: '#F3F0E7', fontFamily: SANS, fontSize: 13.5, fontWeight: 600, cursor: 'pointer',
};
const btnGhost: CSSProperties = {
  padding: '9px 14px', borderRadius: 10, border: '1px solid var(--border-strong)',
  background: 'var(--surface)', color: 'var(--dim)', fontFamily: SANS,
  fontSize: 13.5, fontWeight: 600, cursor: 'pointer',
};
const labelStyle: CSSProperties = {
  fontFamily: MONO, fontSize: 10.5, letterSpacing: '.09em', textTransform: 'uppercase',
  color: 'var(--dim)', marginBottom: 8, display: 'block',
};

function Lista({ titulo, sub, items, onChange, placeholder, icono, tipo }: {
  titulo: string; sub: string; items: string[]; onChange: (v: string[]) => void;
  placeholder: string; icono: string; tipo: 'tel' | 'email';
}) {
  const [nuevo, setNuevo] = useState('');
  // La MISMA regla con la que el server normaliza: si acá se aceptara algo que
  // allá se descarta, el usuario lo vería agregado y desaparecería al recargar.
  const valido = tipo === 'tel' ? telefonoValido(nuevo) : emailValido(nuevo);

  const agregar = () => {
    if (!valido) return;
    onChange([...items, nuevo.trim()]);
    setNuevo('');
  };

  return (
    <div>
      <span style={labelStyle}>{titulo}</span>
      <div style={{ fontSize: 12.5, color: 'var(--dim)', marginTop: -4, marginBottom: 10, lineHeight: 1.45 }}>{sub}</div>

      {items.length === 0 && (
        <div style={{ fontSize: 13, color: 'var(--faint)', fontStyle: 'italic', marginBottom: 10 }}>
          Todavía no hay ninguno. Sin esto, MaKo no puede avisar por este canal.
        </div>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 7, marginBottom: 10 }}>
        {items.map((v, i) => (
          <div key={`${v}-${i}`} style={{
            display: 'flex', alignItems: 'center', gap: 10, padding: '9px 11px',
            borderRadius: 10, background: 'var(--surface-2)', border: '1px solid var(--border)',
          }}>
            <span style={{ display: 'flex', color: 'var(--dim)', flex: 'none' }}><Icon name={icono} size={16} /></span>
            <span style={{ flex: 1, minWidth: 0, fontSize: 13.5, color: 'var(--ink)', overflow: 'hidden', textOverflow: 'ellipsis' }}>{v}</span>
            {i === 0 && (
              <span style={{
                flex: 'none', fontSize: 10.5, fontFamily: MONO, letterSpacing: '.06em', textTransform: 'uppercase',
                color: 'var(--dim)', background: 'var(--surface)', border: '1px solid var(--border-strong)',
                borderRadius: 999, padding: '2px 8px',
              }}>
                Principal
              </span>
            )}
            <button
              type="button" onClick={() => onChange(items.filter((_, j) => j !== i))}
              aria-label={`Quitar ${v}`} title="Quitar"
              style={{ flex: 'none', border: 0, background: 'transparent', color: 'var(--faint)', cursor: 'pointer', display: 'flex', padding: 3 }}
            >
              <Icon name="x" size={15} />
            </button>
          </div>
        ))}
      </div>

      <div style={{ display: 'flex', gap: 8 }}>
        <input
          value={nuevo}
          onChange={(e) => setNuevo(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); agregar(); } }}
          placeholder={placeholder}
          inputMode={tipo === 'tel' ? 'tel' : 'email'}
          style={inputStyle}
        />
        <button type="button" onClick={agregar} disabled={!valido} style={{ ...btnGhost, opacity: valido ? 1 : 0.45, cursor: valido ? 'pointer' : 'not-allowed' }}>
          Agregar
        </button>
      </div>
    </div>
  );
}

export function DestinatariosModal({ inicial, onCerrar, onGuardado }: {
  inicial: Destinatarios;
  onCerrar: () => void;
  onGuardado: (d: Destinatarios) => void;
}) {
  const [tel, setTel] = useState<string[]>(inicial.telefonos);
  const [mail, setMail] = useState<string[]>(inicial.emails);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const esc = (e: KeyboardEvent) => { if (e.key === 'Escape') onCerrar(); };
    window.addEventListener('keydown', esc);
    return () => window.removeEventListener('keydown', esc);
  }, [onCerrar]);

  const dirty = JSON.stringify([tel, mail]) !== JSON.stringify([inicial.telefonos, inicial.emails]);

  const guardar = async () => {
    setBusy(true); setError(null);
    try {
      const j = await (await fetch('/api/perfil/destinatarios', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ telefonos: tel, emails: mail }),
      })).json();
      if (!j.ok) { setError(j.error || 'No se pudo guardar'); return; }
      onGuardado(j.destinatarios as Destinatarios);
      onCerrar();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo guardar');
    } finally { setBusy(false); }
  };

  return (
    <div
      role="dialog" aria-modal="true" aria-label="Destinatarios de las notificaciones"
      onClick={(e) => { if (e.target === e.currentTarget) onCerrar(); }}
      style={{
        position: 'fixed', inset: 0, zIndex: 3000, background: 'rgba(18,21,27,.45)',
        display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20,
      }}
    >
      <div style={{
        background: 'var(--surface)', borderRadius: 18, border: '1px solid var(--border)',
        width: 'min(560px, 100%)', maxHeight: '86vh', overflowY: 'auto',
        padding: '26px 28px', boxShadow: '0 24px 60px rgba(18,21,27,.28)',
      }}>
        <div style={{ fontWeight: 600, fontSize: 19, color: 'var(--ink)', letterSpacing: '-0.015em' }}>
          ¿A quién le avisa MaKo?
        </div>
        <div style={{ fontSize: 13, color: 'var(--dim)', marginTop: 5, marginBottom: 22, lineHeight: 1.5 }}>
          Podés sumar a quien haga falta. Todos reciben lo que esté activado en cada canal.
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 26 }}>
          <Lista
            titulo="WhatsApp" icono="whatsapp" tipo="tel"
            sub="El primero es con el que se arma el grupo de MaKo; el resto se suma a ese mismo grupo."
            items={tel} onChange={setTel} placeholder="+54 9 3764 67-3479"
          />
          <Lista
            titulo="Email" icono="email" tipo="email"
            sub="Cada uno recibe su propia copia, no van en copia entre ellos."
            items={mail} onChange={setMail} placeholder="nombre@empresa.com"
          />
        </div>

        {tel.length < inicial.telefonos.length && (
          <div style={{ marginTop: 18, fontSize: 12.5, color: 'var(--dim)', lineHeight: 1.5, background: 'var(--surface-2)', border: '1px solid var(--border)', borderRadius: 10, padding: '10px 12px' }}>
            Quien saques deja de recibir los reportes, pero sigue en el grupo de WhatsApp:
            echarlo de un grupo es visible para todos los demás y no es algo que se deba hacer
            solo. Si hace falta, sacalo desde WhatsApp.
          </div>
        )}

        {error && <div style={{ marginTop: 16, fontSize: 13, color: 'var(--bad)', fontWeight: 600 }}>{error}</div>}

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 24 }}>
          <button type="button" onClick={onCerrar} style={btnGhost}>Cancelar</button>
          <button
            type="button" onClick={guardar} disabled={busy || !dirty}
            style={{ ...btnDark, opacity: busy || !dirty ? 0.5 : 1 }}
          >
            {busy ? 'Guardando…' : 'Guardar'}
          </button>
        </div>
      </div>
    </div>
  );
}
