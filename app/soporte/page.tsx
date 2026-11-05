// =============================================================================
// /soporte — cómo pedir ayuda con MaKo, sin entrar (3/11/2026)
// =============================================================================
// Apple exige una URL de soporte con una forma real de contactarnos, y la abre sin cuenta (App Store Connect › Support URL).
// Va en PUBLICOS y se lee sin JavaScript, como /privacidad y /terminos. Quien ya entró tiene «Reportar problema» adentro.

import { EMAIL_MAKO } from '@/lib/app-url';
import { H, LegalShell } from '@/app/_legal/LegalShell';

export const dynamic = 'force-dynamic';

export const metadata = {
  title: 'Soporte · MaKo',
  description: 'Cómo pedir ayuda con la app MaKo.',
};

export default function Page() {
  const mail = <a href={`mailto:${EMAIL_MAKO}`}>{EMAIL_MAKO}</a>;
  return (
    <LegalShell
      titulo="Soporte de MaKo"
      actualizado="5 de noviembre de 2026"
      intro={<>¿Algo no anda en la app <strong>MaKo</strong>? Escríbenos a {mail} y te respondemos.</>}
    >
      <H id="dentro">Si ya entraste</H>
      <p>
        En la app, abre <strong>More</strong> y toca <strong>Reportar problema</strong>. Queda en tu Ticketera, y ves ahí la respuesta. En una respuesta
        de MaKo que te parezca mal, toca <strong>Reportar</strong> debajo del mensaje.
      </p>

      <H id="afuera">Si no puedes entrar</H>
      <p>Escríbenos a {mail} desde el correo de tu cuenta, y cuéntanos qué pasa.</p>

      <H id="frecuentes">Lo que más se pregunta</H>
      <ul>
        <li><strong>Olvidé mi contraseña.</strong> En la pantalla de entrada, toca «¿Olvidaste tu contraseña?». El link llega a tu correo.</li>
        <li><strong>No me llegan los avisos.</strong> Abre <strong>Tu cuenta › Notificaciones</strong> y toca «Probar».</li>
        <li><strong>Quiero eliminar mi cuenta.</strong> Los pasos están en <a href="/eliminar-cuenta">Eliminar tu cuenta</a>.</li>
        <li><strong>Qué datos guarda MaKo.</strong> Está todo en la <a href="/privacidad">política de privacidad</a>.</li>
        <li>
          {/* Sin link a /reembolsos: /soporte se abre adentro de la app de iPhone, y /reembolsos es ruta de venta
              (lib/tienda.ts, `RUTAS_DE_VENTA`). Hasta el 5/11/2026 acá decía que la factura de Creem la mandaba Creem. */}
          <strong>Un cobro, una factura o un reembolso.</strong> Escríbenos a {mail} con la fecha y el monto.
        </li>
        <li>
          <strong>No se generó una imagen o un video.</strong> Google Flow, que la genera con tu cuenta, tiene sus propios
          filtros y puede rechazar un pedido: cambia el texto y vuelve a intentarlo. Lo que no se puede pedir está en la{' '}
          <a href="/aup">política de uso aceptable</a>.
        </li>
        <li><strong>Quiero denunciar un abuso.</strong> Escríbenos a {mail}: los pasos están en la <a href="/aup#denunciar">política de uso aceptable</a>.</li>
      </ul>
    </LegalShell>
  );
}
