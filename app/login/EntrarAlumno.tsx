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
// ⚠️ ACÁ DECÍA «ESTILOS EN LÍNEA: esa pantalla es un overlay fijo con su propia paleta, y no monta
// la hoja de la app». Lo segundo nunca fue cierto —app/layout.tsx importa globals.css para TODA la
// app, /login incluido— y lo primero era la consecuencia: una paleta propia escrita a mano
// (`#F5F7FA`, `#5B6472`, `#b91c1c`) que no se daba vuelta con el tema y no tenía hover ni foco.
// Hoy usa los tokens y los primitives, igual que el resto. Ver app/login/_ui/login.css.
//
// ⚠️ LO LEE UN CLIENTE DE OTRO NEGOCIO: neutro con TÚ, corto, y sin jerga de MaKo.
//
// ⚠️ NO IMPORTA NADA DE lib/alumno-sesion.ts: ese módulo trae `node:crypto` (es el que firma), y
// en un componente de cliente lo arrastraría al navegador. El token ya llega verificado por la
// página (server) como un string.

import { useId, useState, type FormEvent } from 'react';
import { Button } from '@/app/_ui/Button';
import { Input } from '@/app/_ui/Field';
import { Alert } from '@/app/_ui/Estados';

/** El renglón plegado y, al abrirlo, el pedido del link. `abierto`: arranca abierto (link vencido). */
export function PedirLinkAlumno({ abierto: abiertoInicial = false }: { abierto?: boolean }) {
  const idEmail = useId();
  const [abierto, setAbierto] = useState(abiertoInicial);
  const [email, setEmail] = useState('');
  const [mandando, setMandando] = useState(false);
  const [listo, setListo] = useState<string | null>(null);
  const [error, setError] = useState('');

  if (!abierto) {
    return <button type="button" className="lg-link" onClick={() => setAbierto(true)}>Soy alumno: entrar con mi email</button>;
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

  if (listo) return <p role="status" className="lg-nota lg-centro">{listo}</p>;
  return (
    <form onSubmit={(e) => void pedir(e)} className="lg-pila">
      {error && <Alert tono="bad">{error}</Alert>}
      <div className="lg-campo">
        <label className="mk-label" htmlFor={idEmail}>Tu email</label>
        <Input id={idEmail} type="email" autoComplete="email" required value={email}
          placeholder="persona@empresa.com" onChange={(e) => setEmail(e.target.value)} />
        <span className="mk-hint">Te mandamos un link para entrar a tu programa.</span>
      </div>
      <Button type="submit" variant="secondary" size="lg" full loading={mandando} disabled={!email.trim()}>
        {mandando ? 'Mandando…' : 'Mandarme el link'}
      </Button>
    </form>
  );
}

/**
 * El botón que termina de entrar con el link del mail. Un `<form>` HTML de verdad (POST a la ruta, sin
 * JavaScript de por medio): la ruta contesta un 303 a /mi-curso con la cookie puesta, o a /login con
 * el motivo en una palabra.
 */
export function BotonEntrarAlumno({ token }: { token: string }) {
  // ⚠️ EL `<form>` VA PELADO, sin `className`: tests/curso-invitar.test.ts exige el tag textual
  // `<form method="post" action="/api/alumno/entrar">` — es la garantía de que abrir el link no lo
  // gasta (lo gastaría un escáner de correo) y que sólo lo gasta el POST del botón. El aire va
  // adentro.
  return (
    <form method="post" action="/api/alumno/entrar">
      <input type="hidden" name="t" value={token} />
      <div className="lg-pila">
        <Button type="submit" variant="primary" size="lg" full>Entrar a tu programa</Button>
        <p className="lg-pie">El link sirve una sola vez.</p>
      </div>
    </form>
  );
}
