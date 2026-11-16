'use client';

// =============================================================================
// AccesoMako — «Revisa tu correo»: la página de después de pagar (o de empezar la prueba) cuando la cuenta de MaKo ya está creada
// =============================================================================
// Lo monta la página de retorno (./page.tsx) cuando el pago de un plan de MaKo (o la prueba gratis autorizada) ya creó la cuenta y
// la persona todavía no entró.
//
// EL REDISEÑO (16/11/2026, Martín: «rediseña mucho mejor la parte de la thank you page de tu prueba gratis empezó… ese pequeño
// ticket ahí con un montón de texto no es lo mejor… debería haberle llegado justamente el acceso para validar su cuenta desde el
// correo»). Era una tarjeta chica con el concepto, el monto, cuándo se cobra, cómo darse de baja, a qué email llegó el acceso y cómo
// entrar con Google o sin Google: siete renglones para una sola cosa que hay que hacer. Ahora lo grande es ESO: «Revisa tu correo»,
// con el email, «Abrir mi correo» (la bandeja de su proveedor), «Reenviar el correo» y «Cambiar el email». Lo demás es una línea.
// La maqueta: scratchpad/onboarding-artefacto/capturas/r4-gracias-1440.png.
// LO QUE DICE ES LO QUE PASA: el correo de acceso («Tu acceso a MaKo», lib/invitaciones.ts, `invitarPorEmail`) sale al crearse la
// cuenta (lib/cobros.ts, `altaSiCorresponde`) y trae el link para entrar; la cuenta se confirma al entrar con ese email (con Google,
// o creando la contraseña desde el correo). Si ese correo NO salió, no se dice «revisa tu correo»: se dice que no salió y se ofrece
// reenviarlo (revisión del 23/10/2026: nunca prometer un mail que no llega).
//
// El primer dibujo sale del server y se lee sin JavaScript (el email y el botón); reenviar y cambiar el email sí necesitan JavaScript
// (POST /api/pagar/email). Sólo recibe props: no importa nada del server.

import { Fragment, useState, type FormEvent } from 'react';
import { ReportarASoporte } from '@/app/_ui/ReportarASoporte';
import { CSS_GRACIAS } from './estilo-gracias';

type Bandeja = { href: string; nombre: string } | null;

export function AccesoMako({ token, emailInicial, bandeja, puedeCambiar, contacto, mailSalio = true, negocio, chip, nota, deprueba }: {
  token: string;
  /** Ya enmascarado (`ma***@gmail.com`): el link se reenvía. */
  emailInicial: string;
  /** La bandeja de entrada de su proveedor («Abrir mi correo»); null con un email de empresa: el botón es «Entrar a MaKo». */
  bandeja: Bandeja;
  puedeCambiar: boolean;
  contacto: string;
  /** false = la cuenta está creada pero el correo de acceso no salió: no se promete un correo que no va a llegar. */
  mailSalio?: boolean;
  /** El negocio que cobra (arriba, chico). */
  negocio?: string | null;
  /** Lo que ya pasó, en una línea («Tu prueba gratis de 7 días empezó · hoy no se cobra nada»). */
  chip: string;
  /** La letra chica: cuándo se cobra y cómo darse de baja, en una línea. */
  nota?: string | null;
  /** Un pago de prueba (la prueba de humo del super admin). */
  deprueba?: boolean;
}) {
  const [email, setEmail] = useState(emailInicial);
  const [abrir, setAbrir] = useState<Bandeja>(bandeja);
  const [salio, setSalio] = useState(mailSalio);
  const [abierto, setAbierto] = useState(false);
  const [nuevo, setNuevo] = useState('');
  const [enviando, setEnviando] = useState<'cambio' | 'reenvio' | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);
  const [puede, setPuede] = useState(puedeCambiar);

  async function pedir(cuerpo: Record<string, unknown>) {
    const res = await fetch('/api/pagar/email', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ token, ...cuerpo }) });
    return (await res.json().catch(() => null)) as { ok?: boolean; error?: string; email?: string; mensaje?: string; restantes?: number; enviado?: boolean; abrir?: Bandeja } | null;
  }

  async function reenviar() {
    if (enviando) return;
    setEnviando('reenvio'); setError(null); setAviso(null);
    try {
      const r = await pedir({ reenviar: true });
      if (!r?.ok) { setError(r?.error || `No pudimos reenviarlo. Escríbenos a ${contacto}.`); return; }
      if (r.enviado) setSalio(true);
      setAviso(r.mensaje ?? null);
    } catch {
      setError('No hay conexión. Revisa tu internet y prueba de nuevo.');
    } finally { setEnviando(null); }
  }

  async function cambiar(e: FormEvent) {
    e.preventDefault();
    if (enviando) return;
    setEnviando('cambio'); setError(null);
    try {
      const r = await pedir({ email: nuevo });
      if (!r?.ok) { setError(r?.error || `No pudimos cambiar el email. Escríbenos a ${contacto}.`); return; }
      if (r.email) setEmail(r.email);
      if (r.abrir !== undefined) setAbrir(r.abrir);
      if (typeof r.enviado === 'boolean') setSalio(r.enviado);
      if (typeof r.restantes === 'number') setPuede(r.restantes > 0);
      setAviso(r.mensaje ?? null);
      setAbierto(false);
      setNuevo('');
    } catch {
      setError('No hay conexión. Revisa tu internet y prueba de nuevo.');
    } finally { setEnviando(null); }
  }

  return (
    <div className="gr-root">
      <style dangerouslySetInnerHTML={{ __html: CSS_GRACIAS }} />
      <main className="gr">
        {negocio && <p className="gr-negocio">{negocio}</p>}
        <div className="gr-sobre" aria-hidden="true">
          <svg width="34" height="34" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="5" width="18" height="14" rx="2.5" /><path d="m3.5 7 8.5 6 8.5-6" /></svg>
        </div>
        {/* Partido en sus pedazos («Tu prueba gratis de 7 días empezó» · «hoy no se cobra nada»): en el teléfono corta en el punto, no
            en el medio de una frase, y la tilde queda con la primera. */}
        <p className="gr-chip">{chip.split(' · ').map((parte, i) => (
          <Fragment key={i}>{i > 0 && <span className="gr-chip-sep"> · </span>}<span className="gr-chip-p">{i === 0 && <span aria-hidden="true">✓ </span>}{parte}</span></Fragment>
        ))}</p>
        {deprueba && <p className="gr-prueba">Pago de prueba</p>}
        <h1>{salio ? 'Revisa tu correo' : 'Tu cuenta está lista'}</h1>
        {salio
          ? <p className="gr-txt">Te mandamos el acceso a <b>{email}</b>. Ábrelo y entra a MaKo desde ahí.</p>
          : <p className="gr-txt">No pudimos mandarte el correo de acceso a <b>{email}</b>. Reenvíalo, o entra con Google usando ese email.</p>}
        {salio && abrir
          ? <a className="gr-btn" href={abrir.href} target="_blank" rel="noopener noreferrer">Abrir mi correo</a>
          : salio
            ? <a className="gr-btn" href="/login">Entrar a MaKo</a>
            : <button type="button" className="gr-btn" onClick={() => void reenviar()} disabled={!!enviando}>{enviando === 'reenvio' ? 'Reenviando…' : 'Reenviar el correo'}</button>}
        <div className="gr-links">
          {salio
            ? <button type="button" onClick={() => void reenviar()} disabled={!!enviando}>{enviando === 'reenvio' ? 'Reenviando…' : 'Reenviar el correo'}</button>
            : <a href="/login">Entrar a MaKo</a>}
          {puede && !abierto && <button type="button" onClick={() => { setAbierto(true); setAviso(null); setError(null); }}>Cambiar el email</button>}
        </div>
        {aviso && <p className="gr-ok" role="status">{aviso}</p>}
        {error && !abierto && <p className="gr-error" role="alert">{error}<ReportarASoporte /></p>}

        {abierto && (
          <form className="gr-form" onSubmit={cambiar}>
            <label htmlFor="gr-email-nuevo">El email con el que vas a entrar</label>
            <input id="gr-email-nuevo" type="email" required autoComplete="email" autoFocus value={nuevo} onChange={(e) => setNuevo(e.target.value)} placeholder="tu@email.com" />
            {error && <p className="gr-error" role="alert">{error}<ReportarASoporte /></p>}
            <button type="submit" className="gr-btn" disabled={!!enviando || !nuevo.trim()}>{enviando === 'cambio' ? 'Cambiando…' : 'Cambiar y reenviar'}</button>
            <button type="button" className="gr-cancelar" onClick={() => { setAbierto(false); setError(null); }}>Cancelar</button>
          </form>
        )}
        {nota && <p className="gr-nota">{nota}</p>}
      </main>
    </div>
  );
}
