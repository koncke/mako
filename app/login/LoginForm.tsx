'use client';

// =============================================================================
// LoginForm — el camino a la cuenta: Google primero, el correo detrás
// =============================================================================
// Vive aparte de page.tsx porque usa useSearchParams (lee ?next= y ?error=). Nació
// con un boundary de Suspense porque /login se prerenderizaba; hoy es dinámica
// (`force-dynamic` en page.tsx, y el layout lee la sesión en cada request), así que
// el boundary ya no lo exige el build.
//
// Acá había además un login con contraseña compartida. Se fue, y no por prolijo:
// abría una sesión de admin sin pasar por la tabla usuarios, y la cookie que
// dejaba tenía como valor el mismo secreto que firmaba las sesiones — o sea que
// quien la tuviera podía fabricarse un token de admin a mano. Quién entra ahora
// lo decide la tabla usuarios, y nada más.
//
// ⚠️ LA JERARQUÍA (14/11/2026). Google era un `<a>` BLANCO con borde y el botón
// NEGRO era el de la contraseña: la pantalla gritaba el camino de excepción y
// susurraba el de siempre. Hoy Google es `mk-btn--primary` y el correo
// `mk-btn--secondary`. Sigue siendo un `<a>` y no un fetch a propósito: el OAuth
// es una navegación de verdad (GET), y un `<a>` se puede abrir en otra pestaña.
//
// ⚠️ NADA DE `style={{}}` CON HEXES: todo sale de los tokens (app/globals.css) y
// de los primitives de app/_ui. En esta pantalla había 23 colores escritos a
// mano, así que el claro/oscuro no la tocaba y el foco del teclado no se veía.
// =============================================================================

import { TEXTO_PEDIDO_REGISTRADO } from '@/lib/pedidos-ingreso-reglas';
import { useId, useState, type FormEvent } from 'react';
import { useSearchParams } from 'next/navigation';
import { Button } from '@/app/_ui/Button';
import { Input } from '@/app/_ui/Field';
import { Alert } from '@/app/_ui/Estados';

/** El logo de Google, tal cual lo pide su guía de marca (los cuatro colores son suyos, no de la app). */
function IcoGoogle() {
  return (
    <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden><path fill="#EA4335" d="M24 9.5c3.5 0 6.6 1.2 9.1 3.6l6.8-6.8C35.9 2.4 30.3 0 24 0 14.6 0 6.5 5.4 2.6 13.2l7.9 6.1C12.4 13.2 17.7 9.5 24 9.5z"/><path fill="#4285F4" d="M46.5 24.5c0-1.6-.1-3.1-.4-4.5H24v9h12.7c-.5 3-2.2 5.5-4.7 7.2l7.3 5.7C43.8 38 46.5 31.8 46.5 24.5z"/><path fill="#FBBC05" d="M10.5 28.7c-.5-1.4-.7-2.9-.7-4.7s.3-3.3.7-4.7l-7.9-6.1C1 16.5 0 20.1 0 24s1 7.5 2.6 10.8l7.9-6.1z"/><path fill="#34A853" d="M24 48c6.3 0 11.6-2.1 15.5-5.6l-7.3-5.7c-2 1.4-4.7 2.3-8.2 2.3-6.3 0-11.6-3.7-13.5-9.3l-7.9 6.1C6.5 42.6 14.6 48 24 48z"/></svg>
  );
}

/**
 * Entrar con correo y contraseña (15/10/2026): el camino ALTERNATIVO a Google, para el día que Google
 * no esté. Plegado detrás de un botón secundario para no competir con el de Google, que es el de siempre.
 * Después de la contraseña viene el MISMO segundo paso que después de Google (/login/2fa).
 *
 * `abiertoDeEntrada` es `sinGoogle` (la app de iPhone): cuando llega en `true` no hay Google en la
 * pantalla, así que este deja de ser el camino alternativo y SU botón pasa a ser el primario. Es el
 * único dato que hace falta para no tener dos `primary` compitiendo (app/_ui/LEEME.md).
 */
function ConCorreo({ next, abiertoDeEntrada = false }: { next: string; abiertoDeEntrada?: boolean }) {
  const [abierto, setAbierto] = useState(abiertoDeEntrada);
  const [email, setEmail] = useState('');
  const [contrasena, setContrasena] = useState('');
  const [ocupado, setOcupado] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // «Olvidé mi contraseña» (15/10/2026): el link llega por mail. La respuesta es SIEMPRE la misma.
  const [olvido, setOlvido] = useState(false);
  const [aviso, setAviso] = useState<string | null>(null);
  const soloCamino = abiertoDeEntrada;
  // Los campos se arman con <Field>+<Input> y no con <TextField>: `required` en TextField sólo
  // dibuja el asterisco (no llega al <input>), y acá los dos campos son obligatorios, así que un
  // asterisco en cada rótulo no informa nada y el `required` de verdad sí hace falta.
  const idCorreo = useId();
  const idClave = useId();
  if (!abierto) {
    return (
      <>
        <div className="lg-o">o</div>
        <Button variant="secondary" size="lg" full onClick={() => setAbierto(true)}>
          Entrar con tu correo
        </Button>
      </>
    );
  }
  if (olvido) {
    const mandar = async (e: FormEvent) => {
      e.preventDefault();
      setOcupado(true); setError(null);
      try {
        const r = await fetch('/api/auth/restablecer', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ accion: 'pedir', email }) });
        const j = (await r.json().catch(() => ({ ok: false }))) as { ok: boolean; mensaje?: string; error?: string };
        if (j.ok) setAviso(j.mensaje ?? 'Si es tu cuenta, te llega un mail en unos minutos.');
        else setError(j.error ?? 'No se pudo.');
      } catch {
        setError('No se pudo conectar.');
      } finally {
        setOcupado(false);
      }
    };
    return (
      <form onSubmit={mandar} className="lg-pila">
        <p className="lg-nota"><strong>Restablecer tu contraseña.</strong> Te mandamos un link al correo de tu cuenta.</p>
        {aviso ? <p role="status" className="lg-nota">{aviso}</p> : (
          <>
            {error && <Alert tono="bad">{error}</Alert>}
            <div className="lg-campo">
              <label className="mk-label" htmlFor={idCorreo}>Tu correo</label>
              <Input id={idCorreo} type="email" autoComplete="username" placeholder="nombre@empresa.com" value={email} onChange={(e) => setEmail(e.target.value)} required />
            </div>
            <Button type="submit" variant="primary" size="lg" full loading={ocupado} disabled={!email}>
              {ocupado ? 'Mandando…' : 'Mandarme el link'}
            </Button>
          </>
        )}
        <button type="button" className="lg-link" onClick={() => { setOlvido(false); setAviso(null); setError(null); }}>
          Volver
        </button>
      </form>
    );
  }
  const entrar = async (e: FormEvent) => {
    e.preventDefault();
    setOcupado(true); setError(null);
    try {
      const r = await fetch('/api/auth/contrasena', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ email, contrasena, next }) });
      const j = (await r.json().catch(() => ({ ok: false, error: 'No se pudo conectar.' }))) as { ok: boolean; error?: string; ir?: string };
      if (!j.ok) { setError(j.error ?? 'No se pudo entrar.'); return; }
      window.location.href = j.ir || next;
    } catch {
      setError('No se pudo conectar.');
    } finally {
      setOcupado(false);
    }
  };
  return (
    <>
      {!soloCamino && <div className="lg-o">o</div>}
      <form onSubmit={entrar} className="lg-pila">
        {error && <Alert tono="bad">{error}</Alert>}
        <div className="lg-campo">
          <label className="mk-label" htmlFor={idCorreo}>Tu correo</label>
          <Input id={idCorreo} type="email" autoComplete="username" placeholder="nombre@empresa.com" value={email} onChange={(e) => setEmail(e.target.value)} required />
        </div>
        <div className="lg-campo">
          {/* «¿Olvidaste tu contraseña?» va PEGADO a la contraseña, no al pie: abajo quedaba
              apilado con «Soy alumno…» y con la nota de la invitación, tres renglones grises
              iguales que no se sabía de qué colgaba cada uno. */}
          <div className="lg-campo__cab">
            <label className="mk-label" htmlFor={idClave}>Tu contraseña</label>
            <button type="button" className="lg-link lg-link--chico" onClick={() => { setOlvido(true); setError(null); }}>
              ¿Olvidaste tu contraseña?
            </button>
          </div>
          <Input id={idClave} type="password" autoComplete="current-password" value={contrasena} onChange={(e) => setContrasena(e.target.value)} required />
        </div>
        <Button type="submit" variant={soloCamino ? 'primary' : 'secondary'} size="lg" full loading={ocupado} disabled={!email || !contrasena}>
          {ocupado ? 'Entrando…' : 'Entrar'}
        </Button>
      </form>
    </>
  );
}

const ERRORES: Record<string, string> = {
  'no-autorizado': 'Esa cuenta de Google no está autorizada para entrar.',
  'pedido-registrado': TEXTO_PEDIDO_REGISTRADO,
  'mfa-sin-base': 'No se pudo comprobar tu segundo paso. Vuelve a intentar en unos minutos.',
  'mfa-vencido': 'Pasó demasiado tiempo. Vuelve a entrar con Google.',
  oauth: 'No se pudo verificar el inicio de sesión. Prueba de nuevo.',
  token: 'No se pudo completar el login con Google.',
  exchange: 'No se pudo completar el login con Google.',
  config: 'El login con Google no está configurado.',
};

/**
 * Destino post-login: SOLO rutas internas. '/inicio' sí, '//evil.com' no
 * (protocol-relative → open redirect). Se rechazan los caracteres de control
 * (tab/LF/CR) porque el navegador los strippea y '/\t//evil.com' se escaparía a
 * un host externo. Mismo criterio que destinoSeguro() en lib/auth-session.ts.
 *
 * Sin ?next= se cae a /inicio, el repartidor por rol. NO a '/': la raíz es la
 * landing de venta, y terminar ahí después de loguearse es quedarse afuera.
 */
function destinoInterno(raw: string): string {
  const n = raw.replace(/\\/g, '/');
  const ok = !/[\x00-\x1f\x7f]/.test(raw) && n.startsWith('/') && !n.startsWith('//');
  return ok ? n : '/inicio';
}

/** `sinGoogle`: la app de iPhone (lib/tienda.ts). Google prohíbe su OAuth en un WebView: el correo queda abierto y solo. */
export function LoginForm({ sinGoogle = false }: { sinGoogle?: boolean }) {
  // Derivado de la URL, sin estado ni efecto: no hay nada que sincronizar.
  const sp = useSearchParams();
  const next = destinoInterno(sp.get('next') ?? '');
  const err = sp.get('error');
  const oauthError = err ? (ERRORES[err] ?? 'No se pudo entrar.') : null;

  return (
    <>
      {/* «Quedó registrado» no es un error (30/10/2026): en rojo, desde su lado seguiría siendo una
          pared. Va con el tono `info`, que es el de «esto es información y vos actuás» — y con el
          tono `bad` el <Alert> además suma el role="alert" y «Reportar a Soporte», que es justo lo
          que NO corresponde cuando el pedido salió bien. */}
      {oauthError && (
        <Alert tono={err === 'pedido-registrado' ? 'info' : 'bad'}>{oauthError}</Alert>
      )}

      {!sinGoogle && <a
        href={`/api/auth/google?next=${encodeURIComponent(next)}`}
        className="mk-btn mk-btn--primary mk-btn--lg mk-btn--full"
      >
        <IcoGoogle />
        Continuar con Google
      </a>}
      <ConCorreo next={next} abiertoDeEntrada={sinGoogle} />
    </>
  );
}
