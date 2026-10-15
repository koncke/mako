'use client';

// =============================================================================
// Restablecer — la pantalla del link de «Olvidé mi contraseña» (15/10/2026)
// =============================================================================
// El token viene en el FRAGMENTO del link (`#t=…`): se lee acá, se borra de la barra de direcciones y
// viaja por POST. Nunca toca un servidor como parte de una URL. Si la cuenta tiene segundo factor, se
// pide también (la app o un código de recuperación): con el link solo, quien roba el correo cambia la
// contraseña con un clic. Al terminar NO entra solo: vuelve al login, que pide la contraseña nueva y el
// segundo paso como siempre.

import { useEffect, useRef, useState, type CSSProperties, type FormEvent } from 'react';
import { CampoCodigo } from '../2fa/CampoCodigo';

type Abierto = { cuenta: string; pideFactor: boolean; metodos: { totp: boolean; recuperacion: boolean } };

const btn: CSSProperties = { display: 'flex', alignItems: 'center', justifyContent: 'center', width: '100%', padding: '12px', borderRadius: '11px', border: 'none', background: '#2F6FED', color: '#fff', fontSize: '15px', fontWeight: 600, cursor: 'pointer', boxSizing: 'border-box' };
const link: CSSProperties = { background: 'none', border: 'none', padding: 0, color: '#2F6FED', fontSize: '13px', cursor: 'pointer' };
const campo: CSSProperties = { width: '100%', padding: '12px', borderRadius: '11px', border: '1px solid rgba(0,0,0,.18)', background: '#fff', color: '#14161B', fontSize: '15px', boxSizing: 'border-box', outline: 'none', marginBottom: '8px' };
const campoCodigo: CSSProperties = { ...campo, fontSize: '18px', letterSpacing: '4px', textAlign: 'center' };
const titulo: CSSProperties = { fontWeight: 700, fontSize: '17px', color: '#14161B', marginBottom: '4px' };
const sub: CSSProperties = { fontSize: '13px', color: '#5B6472', marginBottom: '14px' };
const errorBox: CSSProperties = { marginBottom: '12px', fontSize: '13px', color: '#b91c1c', background: '#fdecec', border: '1px solid #f5c2c2', borderRadius: '10px', padding: '10px 12px' };

async function pedir(body: Record<string, unknown>): Promise<{ ok: boolean; error?: string; [k: string]: unknown }> {
  const r = await fetch('/api/auth/restablecer', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });
  return (await r.json().catch(() => ({ ok: false, error: 'No se pudo conectar.' }))) as { ok: boolean; error?: string };
}

export function Restablecer() {
  // En una ref y no en el estado: no se dibuja, y así el efecto no cambia el estado de forma síncrona.
  const token = useRef<string | null>(null);
  const [estado, setEstado] = useState<Abierto | null>(null);
  const [muerto, setMuerto] = useState<string | null>(null);
  const [listo, setListo] = useState(false);
  const [nueva, setNueva] = useState('');
  const [ver, setVer] = useState(false);
  const [codigo, setCodigo] = useState('');
  const [metodo, setMetodo] = useState<'totp' | 'recuperacion'>('totp');
  const [ocupado, setOcupado] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const t = new URLSearchParams(window.location.hash.slice(1)).get('t');
    // El token sale de la barra de direcciones apenas se lee: no queda en el historial ni en una captura.
    if (window.location.hash) window.history.replaceState(null, '', window.location.pathname);
    token.current = t;
    const abierto = t ? pedir({ accion: 'abrir', token: t }) : Promise.resolve({ ok: false, error: 'Este link no sirve. Pide otro desde el login.' });
    void abierto.then((j) => {
      if (!j.ok) { setMuerto(j.error ?? 'Este link no sirve.'); return; }
      const a = j as unknown as Abierto;
      setEstado(a);
      if (!a.metodos.totp && a.metodos.recuperacion) setMetodo('recuperacion');
    });
  }, []);

  const guardar = (e?: FormEvent) => {
    e?.preventDefault();
    if (!token.current || ocupado) return;
    setOcupado(true); setError(null);
    void pedir({ accion: 'cambiar', token: token.current, contrasena: nueva, metodo, codigo })
      .then((j) => {
        if (j.ok) { setListo(true); return; }
        // Un link que murió en el medio (otra pestaña, los intentos) no se reintenta: se pide otro.
        if ((j.error ?? '').startsWith('El link')) { setMuerto(j.error ?? null); return; }
        setError(j.error ?? 'No se pudo.');
      })
      .finally(() => setOcupado(false));
  };

  if (listo) {
    return (
      <div>
        <div style={titulo}>Listo, cambiaste tu contraseña</div>
        <div style={sub}>Entra con tu correo y la contraseña nueva.</div>
        <a href="/login" style={{ ...btn, textDecoration: 'none' }}>Ir a entrar</a>
      </div>
    );
  }
  if (muerto) {
    return (
      <div>
        <div style={titulo}>El link no sirve</div>
        <div style={sub}>{muerto}</div>
        <a href="/login" style={{ ...btn, textDecoration: 'none' }}>Volver al login</a>
      </div>
    );
  }
  if (!estado) return <div style={sub}>Cargando…</div>;

  const largo = metodo === 'recuperacion' ? 11 : 6;
  return (
    <form onSubmit={guardar}>
      <div style={titulo}>Crea tu contraseña nueva</div>
      <div style={sub}>{estado.cuenta} · 12 caracteres o más.</div>
      {error && <div style={errorBox}>{error}</div>}
      {/* El correo, oculto: el gestor de contraseñas la guarda con la cuenta correcta. */}
      <input type="email" autoComplete="username" value={estado.cuenta} readOnly hidden />
      <input type={ver ? 'text' : 'password'} autoComplete="new-password" value={nueva} onChange={(e) => setNueva(e.target.value)} style={campo} autoFocus aria-label="Contraseña nueva" placeholder="Contraseña nueva" />
      <div style={{ marginBottom: '12px' }}>
        <button type="button" style={link} onClick={() => setVer((v) => !v)}>{ver ? 'Ocultar' : 'Mostrar'}</button>
      </div>
      {estado.pideFactor && (
        <>
          <div style={{ ...sub, marginBottom: '6px' }}>{metodo === 'recuperacion' ? 'Un código de recuperación' : 'El código de tu app de autenticación'}</div>
          <CampoCodigo valor={codigo} onCambio={setCodigo} ocupado={ocupado} error={error} estilo={campoCodigo} largo={largo}
            onCompleto={() => { if (nueva) guardar(); }} />
          {estado.metodos.totp && estado.metodos.recuperacion && (
            <div style={{ marginBottom: '12px' }}>
              <button type="button" style={link} onClick={() => { setMetodo((m) => (m === 'totp' ? 'recuperacion' : 'totp')); setCodigo(''); }}>
                {metodo === 'totp' ? 'Usar un código de recuperación' : 'Usar la app de autenticación'}
              </button>
            </div>
          )}
        </>
      )}
      <button type="submit" style={btn} disabled={ocupado || !nueva || (estado.pideFactor && codigo.length < largo)}>Guardar contraseña</button>
    </form>
  );
}
