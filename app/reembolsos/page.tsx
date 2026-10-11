// =============================================================================
// /reembolsos — la política de reembolsos y cancelaciones
// =============================================================================
// ⚠️ BORRADOR (11/10/2026) PARA QUE MARTÍN LO REVISE. Se escribió junto con la pasarela de pagos
// (Stripe y Mercado Pago): las dos piden esta página para aprobar la cuenta ANTES del primer cobro,
// y /terminos (sección 8) remite acá. Está escrita de MÍNIMA a propósito: no promete nada que el
// producto no haga hoy. Lo que hay que decidir y no está decidido:
//   · el plazo de respuesta (puse 5 días hábiles);
//   · la garantía del programa grupal, que hoy se acuerda en la llamada (el modelo de pricing hablaba
//     de «100% después de la sesión 1», app/admin/dev/pricing/modelo.ts: no está decidido);
//   · si se ofrece cancelar sin escribir (hoy no hay un portal: se cancela pidiéndolo).
//
// Mismo molde que /terminos y /privacidad: el revisor de la pasarela la abre SIN cuenta y a veces
// sin JavaScript (va en PUBLICOS de lib/rutas-publicas.ts, y tests/layout-sin-suspense.test.ts la lee
// así), y la razón social va en el HTML del servidor (tests/razon-social-sitio.test.ts).

import { EMAIL_MAKO } from '@/lib/app-url';
import { RAZON_SOCIAL_MAKO } from '@/lib/titular-mako';
import { H, Ojo, LegalShell } from '@/app/_legal/LegalShell';

export const dynamic = 'force-dynamic';

export const metadata = {
  title: 'Reembolsos y cancelaciones · MaKo',
  description: 'Cómo cancelar un plan de MaKo, cuándo devolvemos un pago y cómo pedirlo.',
};

const ACTUALIZADO = '11 de octubre de 2026';

// El mismo responsable que en /terminos y /privacidad, de la misma constante (lib/titular-mako.ts).
const RESPONSABLE = `${RAZON_SOCIAL_MAKO} (MaKo)`;
const PLAZO_RESPUESTA = '5 días hábiles';

export default function Page() {
  const mail = <a href={`mailto:${EMAIL_MAKO}`}>{EMAIL_MAKO}</a>;
  return (
    <LegalShell
      titulo="Reembolsos y cancelaciones — MaKo"
      actualizado={ACTUALIZADO}
      intro={<>
        Cómo cancelar un plan de MaKo, en qué casos devolvemos un pago y cómo pedirlo. Si algo no te
        queda claro, escríbenos a {mail} antes de pagar.
      </>}
    >
      <H id="mensuales">1. Planes mensuales</H>
      <ul>
        <li>
          Se pagan <strong>por adelantado</strong> y se renuevan solos cada mes, con el mismo medio de
          pago, hasta que los canceles.
        </li>
        <li>
          <strong>Puedes cancelar cuando quieras.</strong> Al cancelar, no se te cobra el mes
          siguiente.
        </li>
        <li>
          <strong>El mes ya pagado no se reembolsa</strong>, ni entero ni en parte, salvo en los casos
          de la sección 3.
        </li>
      </ul>

      <H id="grupal">2. Programa grupal</H>
      <p>
        El programa grupal tiene la <strong>garantía que acordamos contigo en la llamada</strong>, y
        se aplica tal como quedó acordada. Si no la tienes por escrito, escríbenos a {mail} y te la
        confirmamos antes de que pagues.
      </p>
      <p>
        Fuera de esa garantía, valen los mismos casos de la sección 3.
      </p>

      <H id="errores">3. Cuándo devolvemos un pago</H>
      <p>Siempre que el cobro haya sido un error nuestro o de la pasarela:</p>
      <ul>
        <li><strong>Cobro duplicado</strong>: se te cobró dos veces lo mismo.</li>
        <li>
          <strong>Error de cobro</strong>: se te cobró un monto distinto del que aceptaste, o se te
          cobró después de que cancelaste.
        </li>
      </ul>
      <p>
        En esos casos devolvemos lo cobrado de más, completo.
      </p>
      <Ojo>
        Lo que consumes en <strong>tus propias cuentas</strong> conectadas a MaKo —la publicidad en
        Meta, los créditos de los modelos de inteligencia artificial, tu proveedor de mensajería— te
        lo factura cada proveedor directamente. No pasa por nosotros y no lo podemos devolver.
      </Ojo>

      <H id="como">4. Cómo pedir una cancelación o un reembolso</H>
      <p>
        Escríbenos a {mail}, mejor desde el email con el que pagaste, con:
      </p>
      <ul>
        <li>tu nombre y el email de tu cuenta de MaKo;</li>
        <li>la fecha y el monto del cobro;</li>
        <li>qué pides (cancelar, o el reembolso de un cobro) y por qué.</li>
      </ul>
      <p>
        Te pedimos que nos escribas <strong>antes de iniciar un contracargo</strong> con tu banco: casi
        siempre se resuelve más rápido así.
      </p>

      <H id="plazos">5. Plazos</H>
      <ul>
        <li>Te respondemos dentro de los <strong>{PLAZO_RESPUESTA}</strong>.</li>
        <li>
          Si corresponde la devolución, la hacemos por el <strong>mismo medio con el que pagaste</strong>{' '}
          (Stripe o Mercado Pago). Cuándo se ve en tu tarjeta o en tu cuenta depende de tu banco o de
          Mercado Pago.
        </li>
        <li>
          Una cancelación cuenta desde el día en que nos escribes: si después de esa fecha se te
          cobra, es un error de cobro y te lo devolvemos.
        </li>
      </ul>

      <H id="tus-clientes">6. Si cobras a tus clientes con MaKo</H>
      <p>
        Si conectas tu propia cuenta de Stripe o de Mercado Pago para cobrarles a <strong>tus
        clientes</strong>, esos pagos son entre tú y ellos: los procesa tu cuenta y las devoluciones
        las decides tú. Esta política es la de MaKo con quienes le compran a MaKo, no la de tu negocio.
      </p>

      <H id="cambios">7. Cambios en esta política</H>
      <p>
        Cuando cambie, cambia la fecha de arriba. Un cambio nunca se aplica a lo que ya pagaste.
      </p>

      <H id="responsable">8. Responsable</H>
      <p>
        Responsable: <strong>{RESPONSABLE}</strong>. Contacto: {mail}. Las condiciones generales del
        servicio están en los <a href="/terminos">términos</a>.
      </p>
    </LegalShell>
  );
}
