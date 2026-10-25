// =============================================================================
// /reembolsos — la política de reembolsos y cancelaciones
// =============================================================================
// ⚠️ BORRADOR (11/10/2026) PARA QUE MARTÍN LO REVISE. Se escribió junto con la pasarela de pagos
// (Stripe y Mercado Pago): las dos piden esta página para aprobar la cuenta ANTES del primer cobro,
// y /terminos (sección 8) remite acá. Está escrita de MÍNIMA a propósito: no promete nada que el
// producto no haga hoy. Lo que estaba sin decidir (15/10/2026):
//   · el plazo de respuesta: DECIDIDO, 5 días hábiles, lo común en SaaS (lo decidió Estrategia);
//   · la garantía del programa grupal: DECIDIDA el 25/10/2026 por el Cerebro (Martín: «no hagas preguntas»), sobre los
//     ENTREGABLES de la semana 1, no sobre el resultado (docs/como-venden-otros.md §6c). La frase es la de la tarjeta
//     (`PROGRAMA_ACELERADOR.garantia`, lib/planes-mako.ts): una sola, para que /planes y esta página no se contradigan;
//   · la garantía de los planes: DECIDIDA el 25/10/2026 por el Cerebro, 14 días en el mensual y 30 en el anual, en lugar de
//     una prueba gratis (docs/como-venden-otros.md §6c). Antes decía «el mes ya pagado no se reembolsa». Los días salen de
//     `GARANTIA_DIAS` (lib/planes-mako.ts), los mismos que dicen las tarjetas de /planes;
//   · darse de baja sin escribir: DECIDIDO (Estrategia, 15/10) y HECHO el mismo día: el botón «Darme de baja» de
//     «Configuración del negocio → Tu plan» (app/configuraciones/plan), propio de MaKo para cubrir Stripe y Mercado Pago.
//
// Mismo molde que /terminos y /privacidad: el revisor de la pasarela la abre SIN cuenta y a veces
// sin JavaScript (va en PUBLICOS de lib/rutas-publicas.ts, y tests/layout-sin-suspense.test.ts la lee
// así), y la razón social va en el HTML del servidor (tests/razon-social-sitio.test.ts).

import { EMAIL_MAKO } from '@/lib/app-url';
import { GARANTIA_DIAS, PROGRAMA_ACELERADOR, HORAS_SEMANA_1 } from '@/lib/planes-mako';
import { RAZON_SOCIAL_MAKO } from '@/lib/titular-mako';
import { H, Ojo, LegalShell } from '@/app/_legal/LegalShell';

export const dynamic = 'force-dynamic';

export const metadata = {
  title: 'Reembolsos y cancelaciones · MaKo',
  description: 'Cómo cancelar un plan de MaKo, cuándo devolvemos un pago y cómo pedirlo.',
};

const ACTUALIZADO = '25 de octubre de 2026';

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
      <H id="mensuales">1. Planes de MaKo (Esencial y Pro)</H>
      <ul>
        <li>
          <strong>Garantía de {GARANTIA_DIAS.mensual} días en el plan mensual y de {GARANTIA_DIAS.anual} en el anual.</strong>{' '}
          Si en esos días, contados desde tu primer pago, MaKo no te sirve, te devolvemos ese pago entero. La pides
          escribiéndonos a {mail}. Vale para el primer pago de cada negocio, una vez.
        </li>
        <li>
          El plan mensual se paga <strong>por adelantado</strong> y se renueva solo cada mes, con el mismo medio de pago,
          hasta que lo canceles. El anual se paga una vez por los 12 meses.
        </li>
        <li>
          <strong>Puedes darte de baja cuando quieras</strong>, tú mismo con el botón «Darme de baja» de{' '}
          <strong>Configuración del negocio → Tu plan</strong>. Al darte de baja, no se te cobra el período siguiente, y te
          llega un código de baja por email.
        </li>
        <li>
          Pasada la garantía, <strong>lo ya pagado no se reembolsa</strong>, ni entero ni en parte, salvo en los casos de la
          sección 3. Si te das de baja, sigues usando MaKo hasta que termina lo que pagaste.
        </li>
      </ul>

      <H id="grupal">2. {PROGRAMA_ACELERADOR.nombre}, el programa con acompañamiento</H>
      <p>
        <strong>Garantía de entrega:</strong> {PROGRAMA_ACELERADOR.garantia}
      </p>
      <ul>
        <li>
          <strong>«Armado» quiere decir:</strong> tu página de venta publicada, tu CRM con tu embudo, tus mensajes de
          apertura y de seguimiento cargados, y tu IA conectada. Para eso ponemos hasta {HORAS_SEMANA_1} horas de nuestro
          equipo en la primera semana.
        </li>
        <li>
          La semana empieza a correr cuando nos das lo que te pedimos al arrancar: tus accesos (tu WhatsApp y tu IA) y los
          datos de tu oferta.
        </li>
        <li>
          La pides escribiéndonos a {mail}. Te devolvemos la primera cuota entera y no se te cobran las siguientes.
        </li>
        <li>
          Es una garantía sobre lo que armamos, no sobre lo que vendas: lo que vendas depende también de tu oferta y de
          lo que inviertas en anuncios.
        </li>
      </ul>
      <p>
        Pasada la primera semana con tu embudo armado, las cuotas ya pagadas no se reembolsan, salvo en los casos de la
        sección 3.
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

      <H id="como">4. Cómo cancelar, y cómo pedir un reembolso</H>
      <p>
        Para <strong>darte de baja</strong> no hace falta escribir: el botón «Darme de baja» de{' '}
        <strong>Configuración del negocio → Tu plan</strong>. Si prefieres que lo hagamos nosotros, o para pedir{' '}
        <strong>un reembolso</strong>, escríbenos a {mail}, mejor desde el email con el que pagaste, con:
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
          Una cancelación cuenta desde el día en que la haces (o en que nos escribes): si después de
          esa fecha se te cobra, es un error de cobro y te lo devolvemos.
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
