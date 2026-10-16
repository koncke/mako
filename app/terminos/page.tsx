// =============================================================================
// /terminos — los términos del servicio
// =============================================================================
// La otra mitad de lo que Google pide para verificar la app OAuth (junto con
// /privacidad). Mismo estándar: se escribe contra lo que el producto HACE hoy.
//
// Lo que hace distinto a este texto de un términos genérico, y es lo que de
// verdad hay que decir: MaKo no solo guarda datos — ACTÚA. Publica y pausa
// campañas con plata del cliente, manda WhatsApp por un número conectado por QR,
// manda correos, mueve eventos del calendario de otras personas. Un términos que
// no enumere eso está describiendo otro producto.
//
// ⚠️ Va en PUBLICOS de lib/rutas-publicas.ts: el revisor la abre sin cuenta.

import { EMAIL_MAKO } from '@/lib/app-url';
import { RAZON_SOCIAL_MAKO } from '@/lib/titular-mako';
import { H, Ojo, LegalShell } from '@/app/_legal/LegalShell';

export const dynamic = 'force-dynamic';

export const metadata = {
  title: 'Términos del servicio · MaKo',
  description: 'Las condiciones de uso de MaKo: qué hace, qué esperamos de ti y qué no prometemos.',
};

const ACTUALIZADO = '15 de octubre de 2026';

// ⚠️ Los mismos tres datos que en /privacidad, y por el mismo motivo: no salen
// del código. Si cambian, cambian en los dos lugares. El responsable sale de la
// razón social verificada en Meta (lib/titular-mako.ts), igual que allá.
const RESPONSABLE = `${RAZON_SOCIAL_MAKO} (MaKo)`;
const JURISDICCION = 'la República Argentina';
const EDAD_MINIMA = 18;

export default function Page() {
  return (
    <LegalShell
      titulo="Términos del servicio — MaKo"
      actualizado={ACTUALIZADO}
      intro={<>
        Estas son las condiciones de uso de MaKo. Al crear una cuenta y usar el producto, las
        aceptas. Están escritas para que se entiendan de una lectura: si algo te resulta confuso,
        escríbenos a <a href={`mailto:${EMAIL_MAKO}`}>{EMAIL_MAKO}</a> antes de aceptar.
      </>}
    >
      <H id="que-es">1. Qué es MaKo</H>
      <p>
        MaKo es una plataforma que conecta tus herramientas de marketing y ventas —tu agenda, tu
        WhatsApp, tus campañas, tus llamadas, tu web— y usa inteligencia artificial para ayudarte a
        trabajar tus contactos: clasificarlos, redactar mensajes, resumir reuniones, proponer
        siguientes pasos y producir piezas de contenido.
      </p>
      <Ojo>
        <strong>MaKo está en beta.</strong> Hay funciones incompletas, cosas que cambian de una
        semana a otra y errores que todavía no encontramos. Lo decimos aquí y no en la letra chica
        porque afecta la decisión de usarlo para algo importante.
      </Ojo>

      <H id="cuenta">2. Tu cuenta</H>
      <ul>
        <li>Se entra con una cuenta de Google. Eres responsable de lo que se haga desde la tuya.</li>
        <li>
          Tienes que ser mayor de {EDAD_MINIMA} años y usar MaKo para una actividad profesional o
          comercial.
        </li>
        <li>
          Si invitas a tu equipo, cada persona entra con su propia cuenta y tú decides qué puede
          ver. Compartir un mismo acceso entre varias personas rompe el registro de quién hizo qué.
        </li>
        <li>
          Podemos suspender una cuenta que se use para enviar spam, para acosar a alguien, para
          algo ilegal, o de una forma que ponga en riesgo el servicio de los demás.
        </li>
      </ul>

      <H id="actua">3. MaKo actúa en tu nombre — esto es lo importante</H>
      <p>
        MaKo no es solo un lugar donde mirar datos: cuando lo conectas y lo autorizas,{' '}
        <strong>hace cosas hacia afuera, con consecuencias reales</strong>:
      </p>
      <ul>
        <li><strong>Publica, pausa y modifica campañas publicitarias</strong> en tu cuenta de Meta, lo que implica gasto de tu presupuesto.</li>
        <li><strong>Envía mensajes de WhatsApp</strong> desde el número que conectes, y correos desde tu dominio.</li>
        <li><strong>Crea y mueve eventos en tu calendario</strong>, y con eso les llegan avisos a los invitados.</li>
        <li><strong>Genera contenido con inteligencia artificial</strong> —textos, imágenes, video, voz clonada— consumiendo tus créditos en los servicios que conectes.</li>
      </ul>
      <p>
        Sobre eso, dos compromisos nuestros y una responsabilidad tuya:
      </p>
      <ul>
        <li>
          <strong>Lo irreversible se te muestra antes.</strong> El producto está diseñado para que
          lo que no tiene vuelta atrás —mandar a un grupo de gente, publicar, mover una reunión—
          pase por una pantalla donde ves qué va a pasar y lo confirmas.
        </li>
        <li>
          <strong>Nada se enciende solo.</strong> Cada automatización se activa cuando tú la
          activas.
        </li>
        <li>
          <strong>Lo que se envía es tuyo.</strong> Revisa lo que MaKo propone antes de aprobarlo:
          un modelo de inteligencia artificial se puede equivocar, y el mensaje sale con tu nombre.
        </li>
      </ul>

      <H id="tus-datos">4. Los datos que cargas</H>
      <p>
        Los datos de tus contactos son tuyos. Al cargarlos en MaKo nos autorizas a procesarlos para
        darte el servicio, y <strong>nos garantizas que tienes derecho a hacerlo</strong>: que
        conseguiste esos datos legítimamente, que esas personas saben que las vas a contactar y que
        cumples las reglas de tu país sobre mensajes comerciales.
      </p>
      <p>
        Si alguien te reclama por un mensaje que enviaste desde MaKo, ese reclamo es tuyo. El
        detalle de cómo se tratan esos datos está en la{' '}
        <a href="/privacidad">política de privacidad</a>.
      </p>

      <H id="llaves">5. Tus llaves y tus cuentas de terceros</H>
      <p>
        MaKo está pensado para funcionar con <strong>tus propias cuentas</strong> de los servicios
        que conecta. Cuando cargas una llave:
      </p>
      <ul>
        <li>Se guarda cifrada y se usa solo para las funciones que la necesitan.</li>
        <li>Ese proveedor te factura a ti, según su propio contrato contigo.</li>
        <li>Tú cumples los términos de ese proveedor. Si él corta el servicio, MaKo no puede reemplazarlo.</li>
      </ul>
      <p>
        Algunas funciones usan cuentas de MaKo mientras no cargues las tuyas, para que puedas
        probar. Eso puede tener límites de uso y podemos cambiarlo avisando.
      </p>

      <H id="contenido">6. El contenido que genera la inteligencia artificial</H>
      <ul>
        <li>
          <strong>Lo que MaKo genera para ti es tuyo</strong>, en la medida en que la ley lo permita
          y respetando los términos del proveedor del modelo que lo produjo.
        </li>
        <li>
          <strong>No garantizamos que sea exacto ni original.</strong> Un modelo puede afirmar algo
          falso con total seguridad, o producir algo parecido a otra cosa. Revísalo antes de
          publicarlo.
        </li>
        <li>
          <strong>Si clonas tu voz o usas tu imagen</strong>, nos confirmas que son tuyas o que
          tienes permiso de quien aparece. Nunca uses la voz ni la cara de otra persona sin su
          autorización.
        </li>
      </ul>

      <H id="nuestro">7. Lo que es nuestro</H>
      <p>
        El software, el diseño, la marca y la documentación de MaKo son nuestros. Tienes derecho a
        usarlos mientras tengas una cuenta activa, y nada más: no se pueden copiar, revender ni usar
        para construir un producto competidor.
      </p>

      {/* ⚠️ BORRADOR (11/10/2026) para que Martín lo revise: la sección 8 se reescribió el día que
          MaKo empezó a cobrar con Stripe y Mercado Pago. Decía «No hay cobros automáticos dentro del
          producto», que con la pasarela viva es falso (docs/hallazgos-planes-y-cobro.md, «Los términos
          publicados dicen que no cobrás»). Está escrita de mínima: no promete nada que el producto no
          haga hoy. La política de devoluciones vive en /reembolsos (app/reembolsos/page.tsx). */}
      <H id="precio">8. Precio, pagos y cancelación</H>
      <p>
        El precio de cada plan es el que ves al pagar, o el que acordamos contigo por escrito. Los
        pagos se procesan con <strong>Stripe</strong> o con <strong>Mercado Pago</strong>: los datos
        de tu tarjeta los recibe la pasarela, no MaKo.
      </p>
      <ul>
        <li>
          <strong>Los planes mensuales son una suscripción</strong>: se cobran por adelantado y se
          renuevan solos cada mes, con el mismo medio de pago, hasta que los canceles.
        </li>
        <li>
          <strong>Puedes cancelar cuando quieras</strong>, tú mismo desde <strong>Configuración del negocio → Tu
          plan</strong>, o escribiéndonos a <a href={`mailto:${EMAIL_MAKO}`}>{EMAIL_MAKO}</a>. Cancelar corta el
          cobro siguiente: no se te vuelve a cobrar.
        </li>
        <li>
          Lo que ya pagaste se devuelve sólo en los casos de la{' '}
          <a href="/reembolsos">política de reembolsos</a>.
        </li>
        <li>
          Si cambia el precio de tu plan, te avisamos antes del cobro siguiente, y el cambio nunca se
          aplica a lo que ya pagaste.
        </li>
      </ul>
      <p>
        Si usas MaKo para cobrarles a <strong>tus clientes</strong> con tu propia cuenta de Stripe o
        de Mercado Pago, esos cobros son entre tú y ellos: los procesa tu cuenta, según tu contrato
        con ese proveedor, y las devoluciones las decides tú.
      </p>
      <p>
        Distinto es el consumo de <strong>tus propias cuentas</strong> conectadas —la publicidad en
        Meta, los créditos de los modelos de inteligencia artificial, tu proveedor de mensajería—:
        eso te lo factura cada proveedor directamente y no pasa por nosotros.
      </p>

      <H id="disponibilidad">9. Disponibilidad y garantías</H>
      <p>
        Hacemos lo razonable para que MaKo esté disponible, pero{' '}
        <strong>no prometemos que funcione sin interrupciones ni sin errores</strong>. Depende
        además de servicios de terceros —Google, Meta, WhatsApp, los proveedores de inteligencia
        artificial— que pueden fallar, cambiar sus reglas o cortar el acceso sin avisarnos.
      </p>
      <p>
        El servicio se ofrece «tal como está». En la medida en que la ley lo permita, no
        respondemos por lucro cesante, pérdida de oportunidades ni daños indirectos. Nada de esto
        limita responsabilidades que la ley no deja limitar, como el dolo.
      </p>

      <H id="baja">10. Dar de baja</H>
      <p>
        Puedes dejar de usar MaKo cuando quieras. Para cerrar tu cuenta y que borremos tus datos,
        escríbenos a <a href={`mailto:${EMAIL_MAKO}`}>{EMAIL_MAKO}</a>: hoy ese paso lo hacemos
        nosotros a mano, y está explicado en la <a href="/privacidad">política de privacidad</a>.
      </p>
      <p>
        Antes de irte, desconecta tus integraciones y revoca los permisos que le diste a MaKo en
        cada servicio —en Google, desde{' '}
        <a href="https://myaccount.google.com/permissions" target="_blank" rel="noopener noreferrer">
          la página de permisos de tu cuenta
        </a>.
      </p>
      <p>
        Nosotros podemos cerrar una cuenta con aviso previo razonable, o de inmediato si su uso es
        ilegal o pone en riesgo a terceros. En ese caso te damos la oportunidad de llevarte tus
        datos.
      </p>

      <H id="cambios">11. Cambios en estos términos</H>
      <p>
        Cuando cambien, cambia la fecha de arriba. Si el cambio es de fondo, te avisamos dentro de
        la aplicación antes de que aplique. Seguir usando MaKo después de eso significa que los
        aceptas; si no, puedes darte de baja.
      </p>

      <H id="ley">12. Ley aplicable</H>
      <p>
        Estos términos se rigen por las leyes de {JURISDICCION}, y cualquier disputa se resuelve
        ante sus tribunales. Responsable del servicio: <strong>{RESPONSABLE}</strong>. Contacto:{' '}
        <a href={`mailto:${EMAIL_MAKO}`}>{EMAIL_MAKO}</a>.
      </p>
    </LegalShell>
  );
}
