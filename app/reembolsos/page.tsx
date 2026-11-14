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
//   · la prueba gratis de los planes: DECIDIDA por Martín el 25/10/2026 (~10:20), 7 días con la tarjeta cargada y el cobro
//     solo el día 8, EN LUGAR de la garantía de 14/30 días que había puesto el Cerebro esa madrugada (se fue entera).
//     Los días salen de `PRUEBA_DIAS` (lib/planes-mako.ts), los mismos que dicen las tarjetas de /planes;
//   · darse de baja sin escribir: DECIDIDO (Estrategia, 15/10) y HECHO el mismo día: el botón «Darme de baja» de
//     «Configuración del negocio → Tu plan» (app/configuraciones/plan), propio de MaKo para cubrir Stripe y Mercado Pago.
//
// Mismo molde que /terminos y /privacidad: el revisor de la pasarela la abre SIN cuenta y a veces
// sin JavaScript (va en PUBLICOS de lib/rutas-publicas.ts, y tests/layout-sin-suspense.test.ts la lee
// así), y la razón social va en el HTML del servidor (tests/razon-social-sitio.test.ts).

import { EMAIL_MAKO } from '@/lib/app-url';
import { DESCUENTO_PRIMER_MES_PCT, NOMBRE_PLAN_CON_PRUEBA, PRUEBA_DIAS, PRUEBA_GRATIS_PRENDIDA, PROGRAMA_ACELERADOR, HORAS_SEMANA_1 } from '@/lib/planes-mako';
import { RAZON_SOCIAL_MAKO } from '@/lib/titular-mako';
import { H, Ojo, LegalShell } from '@/app/_legal/LegalShell';

export const dynamic = 'force-dynamic';

export const metadata = {
  title: 'Reembolsos y cancelaciones · MaKo',
  description: 'Cómo cancelar un plan de MaKo, cuándo devolvemos un pago y cómo pedirlo.',
};

const ACTUALIZADO = '5 de noviembre de 2026';

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
        {!PRUEBA_GRATIS_PRENDIDA && (
          <>
            <li>
              <strong>Se paga al empezar.</strong> Cuando el pago se confirma, entras a MaKo. Si tienes el descuento de{' '}
              {DESCUENTO_PRIMER_MES_PCT}% del primer mes, se aplica sólo a ese primer cobro: desde el segundo se cobra el precio
              completo del plan. Lo ves antes de pagar.
            </li>
            <li>
              Si empezaste con una prueba gratis, sigue con las condiciones con las que la empezaste: si te das de baja antes del
              primer cobro, desde <strong>Configuración del negocio → Tu plan</strong>, no se te cobra nada.
            </li>
          </>
        )}
        {PRUEBA_GRATIS_PRENDIDA && <>
        <li>
          <strong>{PRUEBA_DIAS} días gratis.</strong> Al empezar pones tu tarjeta, como en cualquier suscripción, y no se te
          cobra nada durante {PRUEBA_DIAS} días. Si te das de baja antes del día {PRUEBA_DIAS + 1}, desde{' '}
          <strong>Configuración del negocio → Tu plan</strong>, no se te cobra nada. Si no, el día {PRUEBA_DIAS + 1} se cobra
          solo el primer período, y te avisamos por email dos días antes.
        </li>
        <li>
          Hay <strong>una prueba por negocio</strong>, por tarjeta y por email. Durante la prueba, algunas cosas tienen tope
          (lo que se genera con IA y lo que se descarga en masa); el resto de MaKo anda entero.
        </li>
        </>}
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
          Después del primer cobro, <strong>lo ya pagado no se reembolsa</strong>, ni entero ni en parte, salvo en los casos
          de la sección 3. Si te das de baja, sigues usando MaKo hasta que termina lo que pagaste.
        </li>
      </ul>

      <H id="grupal">2. {PROGRAMA_ACELERADOR.nombre}, el programa con acompañamiento</H>
      <p>
        <strong>Garantía de entrega:</strong> {PROGRAMA_ACELERADOR.garantia}
      </p>
      <ul>
        <li>
          <strong>«Armado» quiere decir:</strong> tu página de venta publicada, tu tablero de clientes, tus mensajes de
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
        Pasada la primera semana con tu sistema de ventas armado, las cuotas ya pagadas no se reembolsan, salvo en los casos de la
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
          Si corresponde la devolución, la hacemos por el <strong>mismo medio con el que pagaste</strong>.
          Cuándo se ve en tu tarjeta o en tu cuenta depende de tu banco o de Mercado Pago.
        </li>
        {/* Hasta el 5/11/2026 acá iba cómo devolvía Creem, el vendedor registrado de lo que se cobraba desde
            Latinoamérica. Creem rechazó la tienda de MaKo ese día y no cobró nada (docs/creem-retiros.md). */}
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
