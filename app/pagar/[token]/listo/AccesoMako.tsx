'use client';

// =============================================================================
// AccesoMako — «Te mandamos el acceso a …» y, si hace falta, cambiar ese email
// =============================================================================
// Lo monta la página de retorno (./page.tsx) cuando el pago de un plan de MaKo ya creó la cuenta.
// El login es sólo Google: si la persona pagó con un email que no es el de su cuenta de Google, acá
// lo cambia (POST /api/pagar/email, que reenvía el mail de acceso) sin escribirle a nadie.
//
// El primer dibujo sale del server y se lee sin JavaScript (el email y el botón de entrar); el
// formulario sí necesita JavaScript, y se abre recién cuando la persona dice que su cuenta es otra
// (un paso por pantalla). Sólo recibe props: no importa nada del server.

import { useState, type FormEvent } from 'react';

export function AccesoMako({ token, emailInicial, yaEntro, puedeCambiar, contacto }: {
  token: string;
  /** Ya enmascarado (`ma***@gmail.com`): el link se reenvía. */
  emailInicial: string;
  yaEntro: boolean;
  puedeCambiar: boolean;
  contacto: string;
}) {
  const [email, setEmail] = useState(emailInicial);
  const [abierto, setAbierto] = useState(false);
  const [nuevo, setNuevo] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);
  const [puede, setPuede] = useState(puedeCambiar);

  if (yaEntro) {
    return (
      <div className="pagar-acceso">
        <p>Tu cuenta de MaKo ya está activa.</p>
        <a className="pagar-btn" href="/login">Entrar a MaKo</a>
      </div>
    );
  }

  async function cambiar(e: FormEvent) {
    e.preventDefault();
    if (enviando) return;
    setEnviando(true);
    setError(null);
    try {
      const res = await fetch('/api/pagar/email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, email: nuevo }),
      });
      const r = (await res.json().catch(() => null)) as { ok?: boolean; error?: string; email?: string; mensaje?: string; restantes?: number } | null;
      if (!r?.ok) {
        setError(r?.error || `No pudimos cambiar el email. Escríbenos a ${contacto}.`);
        return;
      }
      if (r.email) setEmail(r.email);
      if (typeof r.restantes === 'number') setPuede(r.restantes > 0);
      setAviso(r.mensaje ?? null);
      setAbierto(false);
      setNuevo('');
    } catch {
      setError('No hay conexión. Revisa tu internet y prueba de nuevo.');
    } finally {
      setEnviando(false);
    }
  }

  return (
    <div className="pagar-acceso">
      <p>Te mandamos el acceso a <strong>{email}</strong>.</p>
      <p>Entra con Google usando ese email.</p>
      {aviso && <p className="pagar-ok" role="status">{aviso}</p>}
      <a className="pagar-btn" href="/login">Entrar a MaKo</a>

      {puede && !abierto && (
        <div>
          <button type="button" className="pagar-link" onClick={() => { setAbierto(true); setAviso(null); }}>
            ¿Tu cuenta de Google es otra?
          </button>
        </div>
      )}

      {abierto && (
        <form className="pagar-form" onSubmit={cambiar}>
          <label htmlFor="pagar-email-nuevo">El email de tu cuenta de Google</label>
          <input
            id="pagar-email-nuevo"
            type="email"
            required
            autoComplete="email"
            autoFocus
            value={nuevo}
            onChange={(e) => setNuevo(e.target.value)}
            placeholder="tu@gmail.com"
          />
          {error && <p className="pagar-error" role="alert">{error}</p>}
          <button type="submit" className="pagar-btn" disabled={enviando || !nuevo.trim()}>
            {enviando ? 'Cambiando…' : 'Cambiar email'}
          </button>
          <div style={{ textAlign: 'center' }}>
            <button type="button" className="pagar-link" onClick={() => { setAbierto(false); setError(null); }}>
              Cancelar
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
