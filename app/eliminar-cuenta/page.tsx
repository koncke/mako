// =============================================================================
// /eliminar-cuenta — cómo eliminar tu cuenta de MaKo, sin entrar (3/11/2026)
// =============================================================================
// Play exige un link web que nombre la app o al desarrollador y que se pueda encontrar sin instalar nada
// (support.google.com/googleplay/android-developer/answer/13327111). Va en PUBLICOS: el revisor la abre sin cuenta, y a veces
// sin JavaScript (tests/layout-sin-suspense.test.ts la lee así). Mismo molde que /privacidad y /terminos.

import { EMAIL_MAKO } from '@/lib/app-url';
import { PLAZO_BAJA_DIAS } from '@/lib/baja-cuenta-reglas';
import { H, LegalShell } from '@/app/_legal/LegalShell';

export const dynamic = 'force-dynamic';

export const metadata = {
  title: 'Eliminar tu cuenta · MaKo',
  description: 'Cómo eliminar tu cuenta de la app MaKo y qué datos se borran.',
};

export default function Page() {
  const mail = <a href={`mailto:${EMAIL_MAKO}`}>{EMAIL_MAKO}</a>;
  return (
    <LegalShell
      titulo="Eliminar tu cuenta de MaKo"
      actualizado="3 de noviembre de 2026"
      intro={<>Cómo eliminar tu cuenta de la app <strong>MaKo</strong> y qué se borra.</>}
    >
      <H id="como">Desde la app</H>
      <ol>
        <li>Abre <strong>Tu cuenta</strong> (la foto de arriba, o <strong>More</strong>).</li>
        <li>Toca <strong>Eliminar mi cuenta</strong> y confirma.</li>
      </ol>
      <p>
        En la computadora está en <a href="/perfil">Settings › Información personal</a>, abajo de todo.
      </p>

      <H id="sin-entrar">Si no puedes entrar</H>
      <p>
        Escríbenos a {mail} desde el correo de tu cuenta, con el asunto «Eliminar mi cuenta». Es todo lo que hace falta.
      </p>

      <H id="que-se-borra">Qué se borra</H>
      <ul>
        <li><strong>Si eres la única persona que administra el negocio:</strong> el negocio entero. Contactos, chats, archivos, automatizaciones, integraciones y su equipo.</li>
        <li><strong>Si hay otra persona que lo administra, o eres parte del equipo:</strong> tu usuario y tus datos personales. El negocio sigue.</li>
      </ul>

      <H id="cuando">En cuánto tiempo</H>
      <p>
        En hasta {PLAZO_BAJA_DIAS} días, y te avisamos por correo al terminar. Si se borra el negocio, su plan deja de cobrarse
        apenas lo pides. Hasta esa fecha puedes arrepentirte escribiendo a {mail}.
      </p>

      <H id="que-queda">Qué queda</H>
      <p>
        Los comprobantes de lo que hayas pagado, el tiempo que pida la ley, y una constancia sin tus datos de que se hizo el
        borrado. Nada más. Lo que MaKo le mandó a otros servicios bajo tu propia cuenta (tu WhatsApp, tu Meta, tu Claude) se
        maneja en cada uno de ellos.
      </p>
    </LegalShell>
  );
}
