// =============================================================================
// /privacidad — la política de privacidad de MaKo (la plataforma)
// =============================================================================
// Distinta de /privacidad/extension, que cubre SOLO el puente a Google Flow.
// Esta es la que Google exige para verificar la app OAuth que pide los scopes de
// Calendar, la que Meta revisa para aprobar la app «MaKo» (sección #meta), y la
// que un revisor va a leer con el código al lado.
//
// ⚠️ EL ESTÁNDAR ES EL MISMO QUE EL DE LA PÁGINA DE LA EXTENSIÓN, y está escrito
// en su cabecera: se redacta CONTRA EL CÓDIGO. Si lo que dice acá no coincide con
// lo que el código hace, es motivo de rechazo — y, antes que eso, es mentirle a
// alguien que no tiene cómo comprobarlo. Esa página ya tuvo una lista falsa
// durante versiones porque se escribió cuando eran dos campos y nadie la volvió a
// mirar; la lección quedó ahí y vale acá.
//
// Por eso hay cosas incómodas escritas de frente: que no hay borrado automático,
// que desconectar la agenda no revoca el permiso en Google, que dos buckets son
// públicos y que cerrar sesión no invalida la cookie del lado del servidor. Todas
// se midieron. Cuando alguna se arregle, se corrige acá EN EL MISMO COMMIT.
//
// Es pública sin login: `/privacidad` ya está en PUBLICOS de lib/rutas-publicas.ts
// como prefijo (lo puso la página de la extensión), así que esta ruta lo hereda.

import { EMAIL_MAKO } from '@/lib/app-url';
import { H, H3, Ojo, LegalShell } from '@/app/_legal/LegalShell';

export const dynamic = 'force-dynamic';

export const metadata = {
  title: 'Privacidad · MaKo',
  description: 'Qué datos usa MaKo, con quién se comparten y qué puedes hacer con ellos.',
};

const ACTUALIZADO = '8 de octubre de 2026';

// ⚠️ LOS TRES DATOS QUE NO SALEN DEL CÓDIGO. Los tiene que confirmar el dueño y
// hoy son el supuesto más razonable, no un hecho verificado. Una política con el
// responsable equivocado es peor que no tenerla: es el único dato que le dice a
// una persona A QUIÉN reclamarle.
const RESPONSABLE = 'MaKo';
const JURISDICCION = 'la República Argentina';
const EDAD_MINIMA = 18;

export default function Page() {
  return (
    <LegalShell
      titulo="Política de privacidad — MaKo"
      actualizado={ACTUALIZADO}
      intro={<>
        MaKo es una plataforma de marketing y ventas: conecta tus herramientas (tu agenda, tu
        WhatsApp, tus campañas, tus llamadas) y usa inteligencia artificial para ayudarte a
        trabajar tus contactos. Esta política explica qué datos toca, con quién se comparten y
        qué puedes hacer con ellos. Está escrita contra el código, no contra lo que nos
        gustaría que hiciera; por eso incluye lo que <strong>todavía no</strong> hace.
      </>}
    >
      <H id="dos-roles">Hay dos clases de datos, y no se tratan igual</H>
      <p>
        Es la distinción más importante de esta política y conviene tenerla clara desde el
        principio:
      </p>
      <ul>
        <li>
          <strong>Tus datos</strong> — tu cuenta, tu perfil, las llaves de tus integraciones,
          cómo usas el producto. De estos <strong>somos responsables</strong>: decidimos qué se
          guarda y para qué.
        </li>
        <li>
          <strong>Los datos de tus contactos</strong> — los leads de tu CRM, sus conversaciones
          de WhatsApp, las llamadas que grabas, la gente que entra a tu landing. Esos datos son
          <strong> tuyos y los cargas tú</strong>: MaKo los procesa por encargo, siguiendo tus
          instrucciones. Quien tiene que tener una base legal para tratarlos, informarle a esa
          gente y responder si reclama, <strong>eres tú</strong>. Nosotros ponemos la
          herramienta y la cuidamos.
        </li>
      </ul>

      <H id="tus-datos">Qué datos tuyos guardamos</H>
      <H3>Al crear la cuenta</H3>
      <p>
        Se entra <strong>solo con Google</strong>. Ese acceso pide únicamente los permisos de
        identidad (<code>openid email profile</code>) y de ahí se guardan cuatro cosas: tu{' '}
        <strong>correo</strong>, tu <strong>nombre</strong>, la <strong>dirección de tu foto</strong>{' '}
        de perfil de Google y la <strong>fecha de tu último ingreso</strong>. No se guarda tu
        contraseña — MaKo nunca la ve.
      </p>
      <p>
        No cualquiera con una cuenta de Google entra: tu correo tiene que estar dado de alta.
      </p>

      <H3>Tu perfil, si lo completas</H3>
      <p>
        Teléfono, cargo, empresa, sitio web, una descripción breve y tu zona horaria. Los
        escribes tú y puedes editarlos cuando quieras. El teléfono, además, se verifica con un
        código que te enviamos por WhatsApp.
      </p>
      <Ojo>
        <strong>Tu foto de perfil queda en una dirección pública.</strong> Si subes una,
        se guarda en un depósito de archivos configurado como público: quien tenga el enlace
        exacto puede verla sin iniciar sesión. Además, cambiarla no borra la anterior — cada
        versión queda con su propia dirección. Si esto no te sirve, no subas una foto: la de
        Google se usa igual.
      </Ojo>

      <H3>Cómo usas el producto</H3>
      <p>
        Queda registrado lo que haces dentro de la herramienta: quién movió cada contacto de
        etapa y cuándo, quién tocó cada configuración, cuánto consumo de inteligencia
        artificial generó cada acción. En esos registros tu correo queda como autor.{' '}
        <strong>Si trabajas en equipo, quien administre el espacio puede ver ese rastro.</strong>
      </p>
      <p>
        <strong>No hay analítica de terceros dentro de la aplicación</strong>: no usamos Google
        Analytics, ni Meta Pixel, ni grabadores de sesión, ni herramientas de seguimiento
        publicitario. (Sí existe un píxel que <em>tú</em> puedes instalar en <em>tu</em> propia
        página web — eso se explica más abajo, y es otra cosa.) Lo único que sale a un tercero
        en cada visita es tu dirección IP, porque las tipografías se piden a los servidores de
        Google.
      </p>
      <p>
        <strong>La página pública de MaKo (hola-mako.com) sí lleva el píxel de Meta</strong>, para
        medir los anuncios con los que vendemos MaKo: registra que la página se visitó y, si
        agendas una reunión desde ahí, que la agendaste. Con eso Meta sabe a quién mostrarle
        nuestros anuncios. Corre solo en esa página, no dentro de la aplicación.
      </p>

      <H3>Si conectas Claude Code</H3>
      <p>
        Es opcional y tiene su propio consentimiento, que te mostramos antes de activarlo. Si lo
        activas, al terminar cada sesión se reporta un resumen de en qué trabajaste y{' '}
        <strong>los mensajes que escribiste tú</strong> (no lo que el agente leyó de tu disco ni
        tu código). Antes de salir de tu computadora se tapan automáticamente las claves, los
        correos, los teléfonos y las rutas.
      </p>
      <Ojo>
        <strong>Dos cosas que ese consentimiento promete y hoy no ocurren</strong>, y preferimos
        decirlo a que te enteres solo: los mensajes tienen marcada una fecha de borrado a los 90
        días, pero <strong>el proceso que los borra no existe todavía</strong>, así que hoy se
        conservan; y no hay una pantalla donde puedas verlos. Mientras tanto, la forma de cortar
        el reporte es revocar el token del agente desde <em>Integraciones</em>. Estamos
        construyendo las dos cosas.
      </Ojo>

      <H id="google">Google: qué permisos pedimos y qué hacemos con ellos</H>
      <p>MaKo pide permisos de Google en dos momentos distintos y separados a propósito.</p>

      <H3>1. Entrar (siempre)</H3>
      <p>
        <code>openid</code>, <code>email</code> y <code>profile</code>: tu identidad. Sirven para
        saber quién eres y no pedirte otra contraseña.
      </p>

      <H3>2. Conectar tu agenda (opcional, solo si aprietas el botón)</H3>
      <ul>
        <li>
          <code>calendar.readonly</code> — <strong>leer tu calendario</strong>. Se usa para tres
          cosas: saber en qué horarios estás ocupado y poder ofrecerle a un contacto los que
          tienes libres; encontrar automáticamente las reuniones que tuviste con una persona; y
          leer la zona horaria de tu calendario para no equivocarnos de hora.
        </li>
        <li>
          <code>calendar.events</code> — <strong>crear y mover eventos</strong>. Se usa cuando
          reagendas una reunión desde MaKo: el evento se mueve de verdad en tu calendario y a los
          invitados les llega el aviso de Google. Sin este permiso, el botón «Reagendar» no
          podría mover nada.
        </li>
      </ul>
      <p>
        De un evento leemos su horario, su título y sus invitados (nombre y correo). Con eso
        armamos la agenda que ves y, cuando corresponde, el resumen de la reunión y las tareas
        que salen de ella. <strong>No leemos tu correo, tu Drive, tus contactos ni ninguna otra
        cosa de tu cuenta de Google</strong>: no pedimos esos permisos, así que aunque quisiéramos
        no podríamos.
      </p>
      <p>
        El permiso de acceso a tu agenda se guarda <strong>cifrado</strong>, con una clave
        derivada por espacio de trabajo.
      </p>

      <H3>Uso limitado de los datos de Google</H3>
      <p>
        El uso que MaKo hace de la información recibida de las APIs de Google se rige por la{' '}
        <a href="https://developers.google.com/terms/api-services-user-data-policy" target="_blank" rel="noopener noreferrer">
          Política de Datos de Usuario de los Servicios de API de Google
        </a>, incluidos sus requisitos de Uso Limitado. En concreto: los datos de tu calendario se
        usan <strong>únicamente</strong> para darte las funciones descritas arriba,{' '}
        <strong>no se venden</strong>, <strong>no se usan para publicidad</strong> y{' '}
        <strong>no se usan para desarrollar, mejorar ni entrenar modelos de inteligencia
        artificial de uso general</strong>.
      </p>
      <p>
        Y además: <strong>los eventos de tu calendario —sus títulos, horarios e invitados— no
        pasan por ningún modelo de inteligencia artificial</strong>. Cuando le pides a MaKo por
        WhatsApp que agende, mueva o te muestre las reuniones de un contacto, la IA solo lee lo que
        tú escribes para entender el pedido; el sistema busca en tu agenda y te muestra el
        resultado directamente. Lo mismo al repartir las tareas de una reunión: a los invitados de
        tu calendario los cruza el sistema, no una IA.
      </p>
      <Ojo>
        <strong>Desconectar tu agenda en MaKo no revoca el permiso en Google.</strong> Al
        desconectar, MaKo deja de tener el acceso guardado y no puede volver a leer tu
        calendario. Pero el permiso que le diste sigue figurando en tu cuenta de Google hasta que
        lo quites tú desde{' '}
        <a href="https://myaccount.google.com/permissions" target="_blank" rel="noopener noreferrer">
          la página de permisos de tu cuenta
        </a>. Te recomendamos hacer las dos cosas.
      </Ojo>

      <H id="meta">Meta: qué permisos pedimos y qué hacemos con ellos</H>
      <p>
        Conectar Meta es opcional. Se hace con el botón <em>Conectar con Meta</em> (o pegando un
        token, si lo prefieres) y en la pantalla de Meta <strong>tú eliges</strong> qué páginas y
        qué cuentas publicitarias le das a MaKo: no ve ninguna otra.
      </p>
      <ul>
        <li>
          <code>ads_read</code> — <strong>leer tus campañas</strong>: su estado, su presupuesto y
          sus resultados (gasto, impresiones, clics, contactos). Con eso se arman tus tableros, el
          aviso de que una campaña dejó de entregar y el análisis de qué anuncio funciona.
        </li>
        <li>
          <code>ads_management</code> — <strong>crear y editar campañas</strong>: crear una campaña
          con sus conjuntos y anuncios, pausarla o activarla, cambiar su presupuesto o su nombre,
          crear públicos, y eliminar lo que esté pausado. <strong>Solo cuando tú lo pides</strong>{' '}
          desde Ads Manager o confirmas una propuesta de MaKo; nada de esto pasa solo.
        </li>
        <li>
          <code>business_management</code> — <strong>ver qué cuentas y páginas te pertenecen</strong>,
          para mostrarte la lista y que elijas cuál usar.
        </li>
        <li>
          <code>pages_show_list</code> y <code>pages_read_engagement</code> — <strong>listar tus
          páginas</strong> y leer sus datos básicos y sus publicaciones, para que un anuncio salga a
          nombre de tu página o reutilice una publicación tuya.
        </li>
        <li>
          <code>pages_manage_ads</code> — <strong>publicar anuncios con tu página</strong> y crear
          los formularios de contacto de tus anuncios.
        </li>
        <li>
          <code>leads_retrieval</code> — <strong>traer los contactos</strong> que dejan sus datos en
          los formularios de tus anuncios, para que entren a tu CRM.
        </li>
      </ul>
      <p>
        Lo que se guarda: el <strong>acceso que nos da Meta</strong> (cifrado, como el resto de tus
        llaves), los identificadores de tu cuenta, tu página y tu píxel, los{' '}
        <strong>resultados diarios de cada anuncio</strong> y <strong>los contactos</strong> que
        llegan por tus formularios. Cuando un contacto avanza en tu CRM (por ejemplo, lo marcas
        como calificado), MaKo se lo informa a Meta para que tus campañas aprendan a quién buscar;
        el correo y el teléfono viajan <strong>cifrados de forma irreversible</strong>.
      </p>

      <H3>Uso de los datos de Meta</H3>
      <p>
        Los datos que MaKo recibe de Meta se usan <strong>únicamente</strong> para darte las
        funciones descritas arriba, sobre <strong>tus</strong> cuentas.{' '}
        <strong>No se venden</strong>, <strong>no se usan para publicidad de terceros</strong> ni
        para armar perfiles de personas, y <strong>no se usan para entrenar modelos de inteligencia
        artificial de uso general</strong>. Lo que sí ocurre, y es parte de la función: el texto de
        tus anuncios, la transcripción de sus videos y sus resultados pueden ir dentro del pedido
        que se le hace a un modelo de inteligencia artificial para analizarlos o proponerte un
        anuncio nuevo.
      </p>
      <Ojo>
        <strong>Quitar la conexión en MaKo no la revoca en Meta.</strong> Al quitarla en{' '}
        <em>Integraciones</em>, MaKo borra el acceso guardado y no puede volver a leer ni tocar tus
        campañas. Pero la integración sigue figurando en tu negocio de Meta hasta que la quites tú
        desde la configuración del negocio, en <em>Integraciones comerciales</em>. Te recomendamos
        hacer las dos cosas. Para que borremos también lo que ya trajimos de Meta (resultados y
        contactos), escríbenos a <a href={`mailto:${EMAIL_MAKO}`}>{EMAIL_MAKO}</a>.
      </Ojo>

      <H id="contactos">Los datos de tus contactos</H>
      <p>
        Esto es lo que MaKo procesa <strong>por encargo tuyo</strong>. Depende de qué conectes:
      </p>
      <ul>
        <li>
          <strong>Tu CRM</strong>: nombre, teléfono, correo, origen, etapa, notas y todo el
          historial de cambios de cada contacto.
        </li>
        <li>
          <strong>WhatsApp e Instagram</strong>: si conectas un número o una cuenta,{' '}
          <strong>los mensajes se guardan</strong> en nuestra base, incluido el contenido y los
          archivos adjuntos.
        </li>
        <li>
          <strong>Llamadas y reuniones</strong>: la transcripción completa no se copia a nuestra
          base — se lee de tu herramienta de grabación en el momento del análisis. Lo que{' '}
          <strong>sí queda guardado</strong> es el análisis: un resumen de la llamada,{' '}
          <strong>frases textuales</strong> de lo que se dijo, las objeciones detectadas, el
          próximo paso sugerido y el enlace con el que se vuelve a reproducir la grabación. Si en
          tu equipo hay vendedores, ese análisis incluye una calificación de su desempeño con
          nombre y apellido.
        </li>
        <li>
          <strong>Tu página web</strong>, si instalas nuestro píxel: qué visitó cada persona y
          cuánto vio de tus videos. Además, <strong>el píxel captura los formularios</strong> que
          se envían en esa página cuando traen un correo o un teléfono, y esos datos entran a tu
          CRM. Si lo instalas, avísale a tu público en tu propia política de privacidad: es tu
          página y son tus visitantes.
        </li>
      </ul>
      <p>
        Toda esa información puede pasar por modelos de inteligencia artificial para producir lo
        que le pides a MaKo: clasificar un contacto, redactar un mensaje, resumir una llamada,
        proponer un siguiente paso.
      </p>

      <H id="terceros">Con quién se comparten los datos</H>
      <p>
        MaKo no vende datos ni los cede a nadie con fines publicitarios. Sí se apoya en
        proveedores para funcionar, y solo reciben lo que hace falta para su parte:
      </p>
      <ul>
        <li><strong>Vercel</strong> — donde corre la aplicación.</li>
        <li><strong>Supabase</strong> — la base de datos y el almacenamiento de archivos.</li>
        <li>
          <strong>Proveedores de inteligencia artificial</strong> — Anthropic (Claude), Google
          (Gemini), OpenAI, Groq, Mistral y Cerebras. Reciben el texto de cada pedido, que según
          la función puede incluir la ficha de un contacto, una conversación o el análisis de una
          llamada. Los eventos de tu Google Calendar no se les mandan.
        </li>
        <li><strong>Google</strong> — para entrar y, si la conectas, para tu agenda.</li>
        <li><strong>Resend</strong> — el envío de correos.</li>
        <li>
          <strong>Chatwoot, Evolution y Meta</strong> — los canales de WhatsApp e Instagram.
        </li>
        <li><strong>Meta</strong> — tus campañas publicitarias. El correo y el teléfono de un contacto pueden enviarse <strong>cifrados de forma irreversible</strong> para medir conversiones.</li>
        <li><strong>Calendly y Cal.com</strong> — las agendas de reserva.</li>
        <li><strong>Fathom</strong> — la grabación y transcripción de tus llamadas.</li>
        <li><strong>ElevenLabs, Panda Video y Google Flow</strong> — si usas la generación de video: tu voz se clona en ElevenLabs y tu foto se envía a Google Flow.</li>
      </ul>

      <H3>Muchos de estos son <em>tu</em> cuenta, no la nuestra</H3>
      <p>
        MaKo está pensado para que uses <strong>tus propias llaves</strong>: cuando cargas la tuya
        en <em>Integraciones</em>, ese servicio te factura a ti y tus datos viajan a{' '}
        <strong>tu cuenta</strong>, bajo el contrato que tú tienes con ese proveedor. Mientras no
        cargues la tuya, algunas funciones usan la cuenta de MaKo para que puedas probar el
        producto. Cada tarjeta de <em>Integraciones</em> te dice cuál es cuál.
      </p>

      <H id="seguridad">Seguridad</H>
      <ul>
        <li>
          <strong>Las llaves de tus integraciones y el acceso a tu agenda van cifrados</strong>{' '}
          (AES-256-GCM, con una clave derivada por espacio de trabajo, de modo que el cifrado de
          uno no sirve para el de otro). Cuando alguien las guarda o las borra queda registrado,
          nunca su valor.
        </li>
        <li>
          <strong>Los datos de tu negocio no están cifrados uno por uno</strong> en la base — sí
          lo está el disco donde viven, como es estándar en el proveedor. Decir otra cosa sería
          exagerar.
        </li>
        <li>
          <strong>La separación entre clientes la aplica la aplicación</strong>: cada consulta se
          filtra por tu espacio de trabajo antes de salir. Lo decimos así, y no «lo garantiza la
          base de datos», porque el servicio se conecta con permisos que pueden ver todo: quien
          separa es nuestro código.
        </li>
        <li>Todo el tráfico va por HTTPS.</li>
      </ul>
      <Ojo>
        <strong>Cerrar sesión borra la sesión de tu navegador, pero no la anula del lado del
        servidor.</strong> Si alguien hubiera copiado esa cookie, seguiría sirviéndole hasta 30
        días. Si crees que pasó, escríbenos y damos de baja tu acceso.
      </Ojo>

      <H id="retencion">Cuánto tiempo se guardan</H>
      <p>
        Con honestidad: <strong>hoy no hay borrado automático</strong>. Lo que cargas se guarda
        mientras tengas la cuenta abierta, y no existe todavía un proceso que elimine datos por
        antigüedad. Tampoco existe un botón de «borrar mi cuenta» ni de «descargar mis datos» —
        estamos construyéndolos.
      </p>
      <p>
        Mientras tanto, <strong>eso se hace a mano y lo hacemos nosotros</strong>: escríbenos a{' '}
        <a href={`mailto:${EMAIL_MAKO}`}>{EMAIL_MAKO}</a> y borramos o te entregamos tus datos. No
        es un trámite, es un correo.
      </p>
      <p>
        Dos avisos concretos: borrar un contacto del CRM <strong>no</strong> borra hoy todo lo
        asociado a él (sus mensajes de WhatsApp y el historial quedan), y el reporte del agente de
        Claude Code, como ya se dijo, todavía no se purga.
      </p>

      <H id="cookies">Cookies</H>
      <p>
        La aplicación <strong>no usa cookies de publicidad ni de analítica</strong>: todas las que
        pone son necesarias para que funcione. La excepción es la página pública (hola-mako.com),
        donde el píxel de Meta pone sus cookies (<code>_fbp</code>) para medir nuestros anuncios.
      </p>
      <ul>
        <li><code>mako_session</code> — tu sesión, firmada. Dura 30 días.</li>
        <li><code>mako_email</code> — tu correo, para pintar tu nombre sin consultar al servidor.</li>
        <li><code>oauth_state</code> y <code>oauth_next</code> — protegen el ingreso con Google y recuerdan a dónde ibas. Duran 10 minutos.</li>
        <li><code>gcal_state</code> — lo mismo para conectar tu agenda. Dura 10 minutos.</li>
        <li><code>meta_state</code> y <code>meta_volver</code> — lo mismo para conectar Meta, y la pantalla a la que vuelves. Duran 10 minutos; <code>meta_resultado</code> dice cómo terminó y dura 2.</li>
        <li><code>mako_ws</code> — solo si tu cuenta administra varios espacios de trabajo, para saber cuál estás mirando.</li>
      </ul>

      <H id="derechos">Tus derechos</H>
      <p>
        Puedes pedir acceso a tus datos, corregirlos, borrarlos, llevártelos, oponerte a un
        tratamiento o retirar un consentimiento que hayas dado. Se ejercen escribiendo a{' '}
        <a href={`mailto:${EMAIL_MAKO}`}>{EMAIL_MAKO}</a> y respondemos en un plazo razonable.
      </p>
      <p>
        Si lo que quieres ejercer tiene que ver con los datos de una persona que <em>otro</em>{' '}
        cargó en su MaKo, escribe a quien te contactó: nosotros procesamos por encargo suyo y te
        vamos a derivar con él, además de avisarle.
      </p>

      <H id="menores">Menores</H>
      <p>
        MaKo es una herramienta de trabajo y no está dirigida a menores de {EDAD_MINIMA} años. No
        recogemos datos de menores a sabiendas; si detectas que ocurrió, escríbenos y lo
        eliminamos.
      </p>

      <H id="cambios">Cambios</H>
      <p>
        Cuando esta política cambie, cambia la fecha de arriba. Si el cambio es de fondo —datos
        nuevos, un destinatario nuevo, un uso distinto— te avisamos dentro de la aplicación antes
        de que aplique.
      </p>

      <H id="contacto">Quiénes somos y cómo contactarnos</H>
      <p>
        Responsable del tratamiento: <strong>{RESPONSABLE}</strong>. Los servidores están en la
        infraestructura de nuestros proveedores (Vercel y Supabase), lo que puede implicar que tus
        datos se traten fuera de tu país.
      </p>
      <p>
        Para cualquier consulta sobre esta política, o para ejercer cualquiera de tus derechos:{' '}
        <a href={`mailto:${EMAIL_MAKO}`}>{EMAIL_MAKO}</a>. Se aplican las leyes de {JURISDICCION}.
      </p>
      <p style={{ marginTop: 28, fontSize: 14, color: '#666' }}>
        ¿Buscas la política de la extensión de navegador? Está en{' '}
        <a href="/privacidad/extension">/privacidad/extension</a>. Los términos del servicio, en{' '}
        <a href="/terminos">/terminos</a>.
      </p>
    </LegalShell>
  );
}
