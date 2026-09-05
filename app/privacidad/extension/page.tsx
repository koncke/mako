// =============================================================================
// /privacidad/extension — la política de privacidad del puente
// =============================================================================
// La Chrome Web Store EXIGE una URL pública de política de privacidad para
// publicar, y la revisión la lee: si lo que dice acá no coincide con lo que el
// código hace, es motivo de rechazo. Por eso está escrita contra el código, no
// contra lo que nos gustaría que hiciera.
//
// Es pública sin login (va en PUBLICOS de lib/rutas-publicas.ts): un revisor de
// Google la abre sin cuenta de MaKo, y una que pide login se lee como que no
// existe.

import { EMAIL_MAKO } from '@/lib/app-url';

export const dynamic = 'force-dynamic';

export const metadata = {
  title: 'Privacidad · MaKo',
  description: 'Qué datos usa la extensión de MaKo, y cuáles no.',
};

const ACTUALIZADO = '26 de agosto de 2026';

function H({ children }: { children: React.ReactNode }) {
  return <h2 style={{ fontSize: 19, fontWeight: 650, margin: '32px 0 10px' }}>{children}</h2>;
}

export default function Page() {
  return (
    <main style={{
      maxWidth: 720, margin: '0 auto', padding: '48px 24px 80px',
      fontFamily: 'system-ui, sans-serif', color: '#1a1a1a', lineHeight: 1.7, fontSize: 15.5,
    }}>
      <h1 style={{ fontSize: 28, fontWeight: 700, margin: '0 0 6px' }}>
        Política de privacidad — Extensión de MaKo
      </h1>
      <p style={{ color: '#666', fontSize: 14, margin: 0 }}>Actualizada el {ACTUALIZADO}</p>

      <p style={{ marginTop: 28 }}>
        Esta extensión permite que quien usa MaKo genere sus anuncios en video con{' '}
        <strong>su propia cuenta de Google Flow</strong>, desde su propio navegador. Esta
        política describe exactamente qué datos toca y qué hace con ellos.
      </p>

      <H>Qué datos usa</H>
      <p>
        <strong>El token de sesión de Google Flow.</strong> Cuando usas Google Flow, tu
        navegador envía una credencial de sesión con cada pedido. La extensión la lee para
        poder repetir esos pedidos en tu nombre y generar los videos que encargaste desde
        MaKo.
      </p>
      <p>
        <strong>Este token se guarda únicamente en el almacenamiento local de tu
        navegador</strong> (<code>chrome.storage.local</code>), en tu computadora. No se
        envía a los servidores de MaKo, ni a los de ningún tercero, ni se transmite fuera de
        tu equipo por ningún medio. Se borra al desinstalar la extensión.
      </p>
      <p>
        <strong>Un código de conexión con tu cuenta de MaKo.</strong> Identifica a qué
        espacio de trabajo pertenece este navegador, para saber qué videos generar. No
        contiene datos personales.
      </p>

      {/* ⚠️ ESTA LISTA ES EL CONTRATO PÚBLICO, Y SE MIDIÓ CONTRA EL CÓDIGO.

          Decía «Solo dos cosas, y ninguna es un dato personal» y era falso desde
          hacía versiones: el latido de `extension/background.js` manda hoy siete
          campos. La política se escribió cuando eran dos y nadie la volvió a mirar
          — que es como una política de privacidad se vuelve mentira sin que nadie
          la toque.

          ⚠️ SI SE AGREGA UN CAMPO AL LATIDO, SE AGREGA ACÁ. La lista sale del
          `body: JSON.stringify({…})` de `background.js`; si las dos dejan de
          coincidir, lo que está mal es esta página, no el código. */}
      <H>Qué se envía a MaKo</H>
      <p>
        Cada 15 segundos la extensión le cuenta al servidor de MaKo cómo va el trabajo
        que tú encargaste. Esto es todo lo que viaja, y nada de esto es un dato
        personal tuyo:
      </p>
      <ul>
        <li>
          <strong>El resultado de cada generación</strong> que tú encargaste: el
          identificador del video producido, o el mensaje de error si algo falló.
        </li>
        <li>
          <strong>El estado de la conexión</strong>: si hay una sesión de Flow abierta,
          para que la aplicación pueda decirte si puede trabajar o no.
        </li>
        <li>
          <strong>La forma de los pedidos que Flow hace</strong> —las URLs, los
          encabezados y la estructura del cuerpo—, para que MaKo pueda armar el
          siguiente pedido igual que lo arma la página. <strong>El encabezado
          <code>Authorization</code> se quita antes de guardarlo</strong>: tu token de
          Google no viaja nunca, y se repone fresco en tu propio navegador en cada
          pedido.
        </li>
        <li>
          <strong>Un recorte de lo que Flow contestó</strong>, para saber de dónde sale
          el enlace de cada video.
        </li>
        <li>
          <strong>El identificador del proyecto de Flow</strong> en el que se está
          trabajando.
        </li>
        <li>
          <strong>La versión de la extensión</strong>. No es analítica: es la respuesta
          a «¿qué código está corriendo en ese navegador?» cuando algo falla, y sin ella
          cada diagnóstico empieza preguntándolo.
        </li>
        <li>
          <strong>Qué verificaciones de seguridad pidió Google</strong> durante el
          trabajo, también para diagnóstico.
        </li>
      </ul>

      <H>Qué NO hace esta extensión</H>
      <ul>
        <li>No envía tu token de Google a ningún servidor, incluido el de MaKo.</li>
        <li>No lee tu correo, tus contactos, tus archivos ni tu historial de navegación.</li>
        {/* ⚠️ ESTA LISTA SALE DE `host_permissions` DEL manifest.json, y ya se quedó
            vieja una vez: Google mudó Flow de labs.google a flow.google.com y acá
            seguían figurando dos dominios de tres. Una lista de «solo estos sitios»
            a la que le falta uno es una afirmación falsa, no una desactualización. */}
        <li>
          No accede a ningún sitio fuera de <code>labs.google</code>,{' '}
          <code>flow.google.com</code>, <code>aisandbox-pa.googleapis.com</code> y{' '}
          <code>hola-mako.com</code>.
        </li>
        <li>No recopila datos de uso, analítica, publicidad ni seguimiento de ningún tipo.</li>
        <li>No vende, comparte ni transfiere información a terceros.</li>
        {/* ⚠️ Decía «No modifica el contenido de las páginas que visitas», y sobre
            labs.google eso no es exacto: la extensión inyecta un script ahí para
            poder mandar los pedidos por vos. No cambia lo que ves, que es lo que la
            frase quería decir — pero decirlo de más en una política es lo mismo que
            decirlo mal. */}
        <li>
          No cambia lo que ves en ninguna página. En Google Flow (<code>labs.google</code> y{' '}
          <code>flow.google.com</code>) agrega un script propio para poder hacer, con tu
          sesión, los mismos pedidos que harías tú a mano; en cualquier otro sitio no hace
          absolutamente nada.
        </li>
      </ul>

      <H>Por qué pide cada permiso</H>
      <ul>
        <li>
          <strong>storage</strong> — guardar el token de sesión y el código de conexión en tu
          equipo, para no pedírtelos en cada uso.
        </li>
        <li>
          <strong>alarms</strong> — despertar la extensión cada pocos segundos y comprobar si
          hay algún video pendiente de generar.
        </li>
        <li>
          <strong>webRequest</strong> — leer la credencial de sesión de los pedidos que tu
          navegador ya envía a Google Flow. Es la única forma de generar en tu nombre: Google
          Flow no ofrece una API pública con credenciales propias.
        </li>
        <li>
          <strong>scripting</strong> — insertar en la página de Google Flow el script que
          hace los pedidos con tu sesión. Es el mismo trabajo que harías tú a mano en esa
          pestaña; sin este permiso no hay forma de hacerlo.
        </li>
        <li>
          <strong>labs.google</strong>, <strong>flow.google.com</strong> y{' '}
          <strong>aisandbox-pa.googleapis.com</strong> — enviar los pedidos de generación a
          Google Flow.
        </li>
        <li>
          <strong>hola-mako.com</strong> — recibir los pedidos de tu cuenta de MaKo y
          devolver el resultado.
        </li>
      </ul>

      <H>Tu cuenta de Google</H>
      <p>
        Los videos se generan con tu suscripción y consumen tus créditos de Google. La
        extensión respeta un ritmo de trabajo equivalente al de una persona usando la
        herramienta —con pausas entre pedidos y un máximo de tareas simultáneas— y no simula
        actividad ni oculta que se trata de un uso automatizado.
      </p>

      <H>Eliminar tus datos</H>
      <p>
        Al desinstalar la extensión se borra todo lo que guardó en tu navegador. Para
        revocar el acceso desde el lado de MaKo, genera un código de conexión nuevo en la
        sección Video Generator: eso invalida el anterior de inmediato.
      </p>

      <H>Contacto</H>
      <p>
        Por cualquier consulta sobre esta política:{' '}
        <a href={`mailto:${EMAIL_MAKO}`}>{EMAIL_MAKO}</a>.
      </p>
    </main>
  );
}
