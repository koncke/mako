'use client';

// =============================================================================
// EntrarAlumno — «Soy alumno: entrar con mi email» (y el botón que termina de entrar)
// =============================================================================
// Pedido de Martín (07/10/2026, item 9): el cliente de un negocio que entra a SU curso, «solo al
// curso, sin la sidebar principal ni nada». No es un usuario de MaKo (D3 de
// docs/diseno-curso-skool.md): entra con la cookie del alumno, por el link de su invitación, con
// Google… o pidiendo acá un link con su email, cuando la cookie venció y no tiene Google.
//
// Dos piezas:
//   · `PedirLinkAlumno`: un renglón plegado debajo del botón de Google; al abrirse, el email y
//     «Mandarme el link». La respuesta es SIEMPRE la misma («Si tu email tiene acceso, te llegó un
//     link»): decir otra cosa sería contar quién es alumno de qué negocio (app/api/alumno/pedir-link.ts).
//   · `BotonEntrarAlumno`: lo que dibuja /login cuando llega con el link del mail. Un FORMULARIO que
//     hace POST: abrir el link no lo gasta (un escáner de correo lo abriría antes que la persona),
//     apretar el botón sí (app/api/alumno/entrar/route.ts).
//
// ⚠️ ESTILOS EN LÍNEA, los de la tarjeta de /login (page.tsx y LoginForm.tsx): esa pantalla es un
// overlay fijo con su propia paleta, y no monta la hoja de la app.
//
// ⚠️ LO LEE UN CLIENTE DE OTRO NEGOCIO: neutro con TÚ, corto, y sin jerga de MaKo.
//
// ⚠️ NO IMPORTA NADA DE lib/alumno-sesion.ts: ese módulo trae `node:crypto` (es el que firma), y
// en un componente de cliente lo arrastraría al navegador. El token ya llega verificado por la
// página (server) como un string.

import { useState, type CSSProperties, type FormEvent } from 'react';

const enlaceSuave: CSSProperties = {
  display: 'block', width: '100%', marginTop: '14px', padding: 0, background: 'none', border: 0,
  textAlign: 'center', fontSize: '13px', color: '#5B6472', cursor: 'pointer', font: 'inherit',
};
const campo: CSSProperties = {
  width: '100%', padding: '11px 12px', borderRadius: '11px', border: '1px solid rgba(0,0,0,.18)',
  background: '#fff', color: '#14161B', fontSize: '15px', boxSizing: 'border-box',
};
const primario: CSSProperties = {
  display: 'flex', alignItems: 'center', justifyContent: 'center', width: '100%', marginTop: '10px', padding: '12px',
  borderRadius: '11px', border: 0, background: '#2F6FED', color: '#fff', fontSize: '15px', fontWeight: 600,
  cursor: 'pointer', boxSizing: 'border-box',
};
const nota: CSSProperties = { marginTop: '12px', fontSize: '13px', color: '#5B6472', textAlign: 'center' };
const mal: CSSProperties = { marginTop: '12px', fontSize: '13px', color: '#b91c1c', textAlign: 'center' };

/** El renglón plegado y, al abrirlo, el pedido del link. `abierto`: arranca abierto (link vencido). */
export function PedirLinkAlumno({ abierto: abiertoInicial = false }: { abierto?: boolean }) {
  const [abierto, setAbierto] = useState(abiertoInicial);
  const [email, setEmail] = useState('');
  const [mandando, setMandando] = useState(false);
  const [listo, setListo] = useState<string | null>(null);
  const [error, setError] = useState('');

  if (!abierto) {
    return <button type="button" style={enlaceSuave} onClick={() => setAbierto(true)}>Soy alumno: entrar con mi email</button>;
  }

  async function pedir(e: FormEvent) {
    e.preventDefault();
    if (mandando || !email.trim()) return;
    setMandando(true);
    setError('');
    try {
      const r = await fetch('/api/alumno/link', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: email.trim() }),
      });
      const j = (await r.json().catch(() => null)) as { ok?: boolean; mensaje?: string; error?: string } | null;
      if (!r.ok || !j?.ok) { setError(j?.error ?? 'No se pudo. Prueba de nuevo.'); return; }
      setListo(j.mensaje ?? 'Si tu email tiene acceso, te llegó un link.');
    } catch {
      setError('No se pudo. Prueba de nuevo.');
    } finally {
      setMandando(false);
    }
  }

  if (listo) return <p style={nota}>{listo}</p>;
  return (
    <form onSubmit={(e) => void pedir(e)} style={{ marginTop: '16px' }}>
      <label htmlFor="alumno-email" style={{ display: 'block', marginBottom: '6px', fontSize: '13px', fontWeight: 600, color: '#14161B' }}>
        Tu email
      </label>
      <input id="alumno-email" type="email" autoComplete="email" required value={email} placeholder="persona@empresa.com"
        onChange={(e) => setEmail(e.target.value)} style={campo} />
      <button type="submit" disabled={mandando} style={{ ...primario, opacity: mandando ? 0.7 : 1 }}>
        {mandando ? 'Mandando…' : 'Mandarme el link'}
      </button>
      {error && <p style={mal}>{error}</p>}
    </form>
  );
}

/**
 * El botón que termina de entrar con el link del mail. Un `<form>` HTML de verdad (POST a la ruta, sin
 * JavaScript de por medio): la ruta contesta un 303 a /mi-curso con la cookie puesta, o a /login con
 * el motivo en una palabra.
 */
export function BotonEntrarAlumno({ token }: { token: string }) {
  return (
    <form method="post" action="/api/alumno/entrar">
      <input type="hidden" name="t" value={token} />
      <button type="submit" style={primario}>Entrar a tu programa</button>
      <p style={nota}>El link sirve una sola vez.</p>
    </form>
  );
}

