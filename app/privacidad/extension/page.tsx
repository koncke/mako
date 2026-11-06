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
import { H, LegalShell } from '@/app/_legal/LegalShell';

export const dynamic = 'force-dynamic';

export const metadata = {
  title: 'Privacidad · MaKo',
  description: 'Qué datos usa la extensión de MaKo, y cuáles no.',
};

const ACTUALIZADO = '6 de noviembre de 2026';

export default function Page() {
  return (
    <LegalShell
      titulo="Política de privacidad — Extensión de MaKo"
      actualizado={ACTUALIZADO}
      intro={<>
        Esta extensión permite que quien usa MaKo genere sus anuncios en video con{' '}
        <strong>su propia cuenta de Google Flow</strong>, desde su propio navegador, que
        complete los datos de sus contactos con lo que ya ve en <strong>su propio WhatsApp
        Web</strong>, que guarde en Competitors Spy la página o los anuncios de un competidor que
        está mirando, y que guarde como lead de su CRM el perfil de Instagram o de LinkedIn que tiene
        abierto. Esta política describe exactamente qué datos toca y qué hace con ellos.
      </>}
    >

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

      {/* ⚠️ DESDE LA 0.70.0 (24/10/2026) LEE TAMBIÉN WHATSAPP WEB, y esto es su contrato: lo que dice tiene que coincidir con
          extension/wa-fichas.js (qué stores lee, que no toca la interfaz ni la red, que sólo devuelve los teléfonos pedidos) y
          con `completarFichasDelGrupo` (app/crm/grupo-wa-server.ts: qué se escribe). Si uno cambia, esta página también. */}
      <H>En WhatsApp Web</H>
      <p>
        Sólo cuando tú lo pides desde MaKo («Extraer» en un grupo de WhatsApp, o «Completar ›
        Desde mi WhatsApp» en tus contactos), la extensión lee lo que <strong>tu WhatsApp Web
        ya guardó en tu navegador</strong> sobre los teléfonos que MaKo le pasa, que son los de
        contactos de tu CRM: el nombre con el que los tienes agendados, el nombre que cada uno
        se puso en WhatsApp, si es una cuenta de empresa y el nombre de la empresa, y en qué
        grupos tuyos está. Si esos contactos vinieron de un grupo, MaKo le pasa también el
        nombre de ese grupo y el identificador con que WhatsApp los conoce en él, para
        encontrarlos en tu WhatsApp Web; de ese grupo sólo vuelve si está y cuántos son.
      </p>
      <p>
        Si WhatsApp Web no está abierto, la extensión lo <strong>abre en otra pestaña</strong> de
        tu navegador y espera a que cargue tus chats. Si ya está abierto, usa esa pestaña: nunca
        abre una segunda.
      </p>
      <p>
        Desde el 26 de octubre de 2026, mientras corre lo que pediste, la extensión trae esa
        pestaña al frente y <strong>abre el grupo, a la vista</strong>, como lo harías tú: lo
        busca por su nombre, abre su información y recorre la lista de miembros, leyendo el
        nombre y el teléfono que WhatsApp muestra de cada uno. <strong>Abrir el grupo marca
        como leídos los mensajes de ese grupo</strong> (no los de cada persona). No escribe en
        ningún chat. Al terminar cierra esa información y borra la búsqueda.
      </p>
      {/* ⚠️ DESDE LA 0.73 (26/10/2026) ABRE TAMBIÉN LA INFORMACIÓN DE CONTACTO DE CADA MIEMBRO (extension/wa-recorrer.js,
          `leerPerfiles`; lo que se lee, `perfilDeInfo` en wa-fichas-reglas.js; lo que se escribe, `completarFichas`). Faltaba acá
          (27/10/2026, al preparar la ficha de la Chrome Web Store, que compara la ficha contra esta página). */}
      <p>
        Desde el 26 de octubre de 2026, en esa misma corrida la extensión abre también la{' '}
        <strong>información de contacto de cada miembro</strong>, de a uno y con pausas, como lo
        harías tú, y lee lo que WhatsApp muestra ahí a cualquiera que la abra: su sitio web, su
        correo, su Instagram y sus otras redes, y la dirección, la categoría y la descripción si es
        una cuenta de empresa. Eso viaja a tu cuenta de MaKo sólo para esos contactos, y{' '}
        <strong>sólo llena lo que está vacío</strong>: nunca pisa un dato que ya cargaste.
      </p>
      <p>
        La extensión guarda en tu navegador un <strong>registro de tus últimas 30 extracciones</strong>{' '}
        (el nombre del grupo, cuándo fue, cuánto tardó cada paso y cuántos nombres trajo) para
        mostrártelo en su desplegable. Ese registro no sale de tu navegador.
      </p>
      <p>
        <strong>A tu cuenta de MaKo viaja sólo eso, y sólo de esos teléfonos.</strong> El
        resto de tus contactos, tus chats y tus mensajes no salen de tu navegador. MaKo lo
        usa para completar los datos vacíos de esos contactos en tu CRM, y queda en tu espacio
        de trabajo.
      </p>
      <p>
        Fuera de eso, en WhatsApp Web la extensión <strong>sólo lee</strong>: no abre otros chats,
        no envía mensajes y no se comunica con los servidores de WhatsApp.
      </p>

      {/* ⚠️ DESDE LA 0.75.0 (3/11/2026) «GUARDAR EN SPY», y esto es su contrato: lo que dice tiene que coincidir con
          extension/spy-leer.js (qué lee), extension/popup.js (cuándo lee) y lib/spy-captura.ts (qué se guarda). Si uno cambia,
          esta página también. */}
      <H>Al guardar en Competitors Spy</H>
      <p>
        Sólo cuando abres el desplegable de la extensión sobre un sitio o sobre la Biblioteca de
        Anuncios de Meta (<code>facebook.com/ads/library</code>) y tocas «Guardar en la ficha de…»
        o «Agregar como competidor», la extensión lee <strong>esa pestaña, una vez</strong>. Abrir
        el desplegable no lee nada: para decirte de quién es la página trae tu lista de
        competidores y compara en tu navegador, y la dirección de la pestaña no sale de ahí hasta
        que tocas el botón.
      </p>
      <p>
        <strong>De un sitio</strong> viaja a tu cuenta de MaKo su dirección, su título y las
        direcciones de lo que la página cargó y enlaza, sin lo que traen en la consulta salvo el
        identificador de la cuenta de cada proveedor. Nada de su texto. Con eso MaKo dice qué
        píxeles, qué checkout y qué video usa ese sitio.
      </p>
      <p>
        <strong>De la Biblioteca de Anuncios</strong> viaja lo que la página ya dibujó: de cada
        anuncio su texto, sus fechas, el anunciante, a dónde manda y su imagen, y lo que buscaste
        en esa pestaña, para saber de quién son. MaKo guarda los de ese competidor en tu espacio de
        trabajo. No se comparten con otros negocios.
      </p>
      <p>
        Lee sólo lo que ya está en pantalla: no se mueve por la página, no toca nada y no baja
        videos. <strong>No envía valores de formularios, cookies ni lo que el sitio guarda en tu
        navegador.</strong> Y no corre en WhatsApp Web, ni en Google Flow, ni en MaKo.
      </p>

      {/* ⚠️ DESDE LA 0.76.0 (4/11/2026) «CAPTURAR» EN «SUS PÁGINAS». Tiene que coincidir con extension/spy-pagina.js (qué lee),
          extension/popup.js y extension/background.js (cuándo) y lib/spy-pagina-capturada.ts (qué se guarda). */}
      <H>Al capturar una página de un competidor</H>
      <p>
        Cuando MaKo no puede mostrar una página de un competidor y tocas «Capturar» en Competitors
        Spy, la extensión <strong>abre esa página en una pestaña, a la vista</strong>. Abrirla no lee
        nada. Si la página pide comprobar que eres una persona, lo haces tú: la extensión no hace
        clic ni resuelve nada por ti.
      </p>
      <p>
        <strong>Recién cuando tocas el ícono de MaKo en esa pestaña</strong>, la extensión la lee una
        vez: una foto de lo que se ve, su título, su texto y las direcciones de las páginas que
        enlaza (sin lo que traen en la consulta). Viaja a tu cuenta de MaKo, queda en tu espacio de
        trabajo y la pestaña se cierra. No envía valores de formularios, cookies ni lo que el sitio
        guarda en tu navegador, y no lee ninguna otra pestaña.
      </p>

      {/* ⚠️ DESDE LA 0.77.0 (6/11/2026) «GUARDAR EN MAKO» SOBRE UN PERFIL. Tiene que coincidir con extension/perfil-leer.js (qué lee),
          extension/perfil-reglas.js y extension/popup.js (cuándo) y lib/perfil-captura-db.ts (qué se guarda). */}
      <H>Al guardar un perfil en tu CRM</H>
      <p>
        Si tienes abierto el perfil de una persona en <strong>Instagram</strong> o en{' '}
        <strong>LinkedIn</strong> y tocas el ícono de MaKo, el desplegable ofrece «Guardar en MaKo».
        Saber que es un perfil sale de la dirección de la pestaña, que no sale de tu navegador.
      </p>
      <p>
        <strong>Recién cuando tocas «Guardar en MaKo»</strong>, la extensión lee ese perfil una vez:
        la dirección de la pestaña (sin lo que trae en la consulta), su título, las etiquetas con que
        la página se describe a sí misma (título, descripción e imagen) y los encabezados del perfil.
        Con eso MaKo te muestra el nombre que entendió y si esa persona ya está en tu CRM. Nada se
        guarda todavía.
      </p>
      <p>
        <strong>Se guarda cuando tocas «Guardar en mi CRM»</strong>, con el nombre que ves y puedes
        corregir: un lead en tu espacio de trabajo, con su usuario de Instagram o el link de su
        perfil de LinkedIn, y en Instagram su foto de perfil. No lee sus publicaciones, sus mensajes
        ni a quién sigue, no se mueve por la página, no toca nada y no le escribe a nadie. No envía
        valores de formularios, cookies ni lo que el sitio guarda en tu navegador.
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
        <li>
          No lee tu correo, tus archivos ni tu historial de navegación. De tu WhatsApp Web sólo
          lee lo de los teléfonos que MaKo le pide y la lista de miembros del grupo que pediste,
          cuando tú lo pides (ver arriba).
        </li>
        {/* ⚠️ ESTA LISTA SALE DE `host_permissions` DEL manifest.json, y ya se quedó
            vieja una vez: Google mudó Flow de labs.google a flow.google.com y acá
            seguían figurando dos dominios de tres. Una lista de «solo estos sitios»
            a la que le falta uno es una afirmación falsa, no una desactualización. */}
        <li>
          Por su cuenta no accede a ningún sitio fuera de <code>labs.google</code>,{' '}
          <code>flow.google.com</code>, <code>aisandbox-pa.googleapis.com</code>,{' '}
          <code>web.whatsapp.com</code> y <code>hola-mako.com</code>. Otro sitio lo lee sólo si tú
          tocas «Guardar en la ficha de…» o «Agregar como competidor» en su pestaña (ver arriba).
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
          sesión, los mismos pedidos que harías tú a mano; en WhatsApp Web, mientras extrae un
          grupo, muestra arriba un aviso de MaKo que dice qué está haciendo (ver arriba); en
          cualquier otro sitio no agrega nada, y sólo lee la pestaña en la que tú lo pides.
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
          pestaña; sin este permiso no hay forma de hacerlo. Con el permiso de abajo, también
          leer la pestaña en la que tocaste «Guardar en la ficha de…», «Agregar como competidor» o
          «Guardar en MaKo».
        </li>
        <li>
          <strong>activeTab</strong> — acceder a la pestaña que estás mirando sólo cuando tocas
          el ícono de la extensión. No da acceso a ningún otro sitio ni a otras pestañas, y se
          termina al salir de esa página.
        </li>
        <li>
          <strong>labs.google</strong>, <strong>flow.google.com</strong> y{' '}
          <strong>aisandbox-pa.googleapis.com</strong> — enviar los pedidos de generación a
          Google Flow.
        </li>
        <li>
          <strong>web.whatsapp.com</strong> — leer, cuando lo pides desde MaKo, lo que tu
          WhatsApp Web ya guardó sobre los teléfonos de tus contactos del CRM, y recorrer la
          lista de miembros del grupo que pediste.
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
      <p style={{ marginTop: 28, fontSize: 14, color: '#666' }}>
        Esta página cubre solo la extensión de navegador. La política de la plataforma está en{' '}
        <a href="/privacidad">/privacidad</a>, y los términos del servicio en{' '}
        <a href="/terminos">/terminos</a>.
      </p>
    </LegalShell>
  );
}
