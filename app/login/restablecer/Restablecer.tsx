'use client';

// =============================================================================
// Restablecer — la pantalla del link de «Olvidé mi contraseña» (15/10/2026)
// =============================================================================
// El token viene en el FRAGMENTO del link (`#t=…`): se lee acá, se borra de la barra de direcciones y
// viaja por POST. Nunca toca un servidor como parte de una URL. Si la cuenta tiene segundo factor, se
// pide también (la app o un código de recuperación): con el link solo, quien roba el correo cambia la
// contraseña con un clic. Al terminar NO entra solo: vuelve al login, que pide la contraseña nueva y el
// segundo paso como siempre.
//
// ⚠️ La presentación es la de las otras dos pantallas de entrada (app/login/_ui/login.css y los
// primitives de app/_ui). Acá había una cuarta copia de los mismos `CSSProperties` con los mismos
// hexes a mano; la lógica —el fragmento, el replaceState, el POST— no se tocó.

import { useEffect, useRef, useState, type FormEvent } from 'react';
import { Button } from '@/app/_ui/Button';
import { Input } from '@/app/_ui/Field';
import { Alert } from '@/app/_ui/Estados';
import { Spinner } from '@/app/_ui/Feedback';
import { EncabezadoLogin } from '../_ui/TarjetaLogin';
import { CampoCodigo } from '../2fa/CampoCodigo';

type Abierto = { cuenta: string; pideFactor: boolean; metodos: { totp: boolean; recuperacion: boolean } };

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
      <>
        <EncabezadoLogin titulo="Listo, cambiaste tu contraseña" sub="Entra con tu correo y la contraseña nueva." />
        <div className="lg-cuerpo">
          <a href="/login" className="mk-btn mk-btn--primary mk-btn--lg mk-btn--full">Ir a entrar</a>
        </div>
      </>
    );
  }
  if (muerto) {
    return (
      <>
        <EncabezadoLogin titulo="El link no sirve" sub={muerto} />
        <div className="lg-cuerpo">
          <a href="/login" className="mk-btn mk-btn--secondary mk-btn--lg mk-btn--full">Volver al login</a>
        </div>
      </>
    );
  }
  if (!estado) return <div className="lg-espera" aria-busy="true"><Spinner size={20} /></div>;

  const largo = metodo === 'recuperacion' ? 11 : 6;
  return (
    <>
      <EncabezadoLogin titulo="Crea tu contraseña nueva" sub={`${estado.cuenta} · 12 caracteres o más.`} />
      <form onSubmit={guardar} className="lg-cuerpo">
        {error && <Alert tono="bad">{error}</Alert>}
        {/* El correo, oculto: el gestor de contraseñas la guarda con la cuenta correcta. */}
        <input type="email" autoComplete="username" value={estado.cuenta} readOnly hidden />
        <Input type={ver ? 'text' : 'password'} autoComplete="new-password" value={nueva} onChange={(e) => setNueva(e.target.value)} autoFocus aria-label="Contraseña nueva" placeholder="Contraseña nueva" />
        <button type="button" className="lg-link" onClick={() => setVer((v) => !v)}>{ver ? 'Ocultar la contraseña' : 'Mostrar la contraseña'}</button>
        {estado.pideFactor && (
          <>
            <p className="lg-nota">{metodo === 'recuperacion' ? 'Un código de recuperación' : 'El código de tu app de autenticación'}</p>
            <CampoCodigo valor={codigo} onCambio={setCodigo} ocupado={ocupado} error={error} largo={largo}
              clase={largo === 6 ? 'mk-input lg-codigo' : 'mk-input lg-codigo lg-codigo--largo'}
              onCompleto={() => { if (nueva) guardar(); }} />
            {estado.metodos.totp && estado.metodos.recuperacion && (
              <button type="button" className="lg-link" onClick={() => { setMetodo((m) => (m === 'totp' ? 'recuperacion' : 'totp')); setCodigo(''); }}>
                {metodo === 'totp' ? 'Usar un código de recuperación' : 'Usar la app de autenticación'}
              </button>
            )}
          </>
        )}
        <Button type="submit" variant="primary" size="lg" full loading={ocupado} disabled={!nueva || (estado.pideFactor && codigo.length < largo)}>
          Guardar contraseña
        </Button>
      </form>
    </>
  );
}
