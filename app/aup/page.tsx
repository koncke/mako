// =============================================================================
// /aup — la política de uso aceptable de MaKo (5/11/2026)
// =============================================================================
// La pide Creem (la pasarela, merchant of record) para aprobar la tienda: a quien genera imagen o video con IA le exige,
// además del Moderation API, una política de uso aceptable PÚBLICA (docs/relevo/nube-creem-revision.md, con las fuentes).
// Hasta hoy /aup redirigía a /login, que para un revisor es lo mismo que no tenerla.
//
// ⚠️ BORRADOR PARA QUE LO MIRE UN ABOGADO antes de darlo por definitivo. Está escrito CONTRA LO QUE MaKo HACE hoy (el
// mismo estándar que /privacidad y /terminos): genera imagen y video por el puente a Google Flow (Video Generator, AI
// Avatar), escribe copy con IA, y manda mensajes por WhatsApp, email e Instagram a los contactos del negocio. Lo que un
// abogado tiene que revisar, en el relevo: (1) la cláusula de las caras de terceros y el consentimiento por escrito;
// (2) el aviso a las autoridades por abuso de menores (qué ley y qué organismo, en Argentina y en los países de los
// clientes); (3) la ley de mensajes comerciales de cada país (Argentina: Ley 26.951 «No llame»; México: REPEP de la
// PROFECO), que acá se nombran en general; (4) si hace falta marcar el contenido generado con IA en alguna jurisdicción.
// No se inventa ningún dato de la empresa: el responsable sale de lib/titular-mako.ts, como en las otras legales.
//
// ⚠️ Va en PUBLICOS de lib/rutas-publicas.ts: el revisor la abre sin cuenta, y se lee sin JavaScript
// (tests/layout-sin-suspense.test.ts la renderiza así).

import { EMAIL_MAKO } from '@/lib/app-url';
import { RAZON_SOCIAL_MAKO } from '@/lib/titular-mako';
import { H, Ojo, LegalShell } from '@/app/_legal/LegalShell';

export const dynamic = 'force-dynamic';

export const metadata = {
  title: 'Política de uso aceptable · MaKo',
  description: 'Qué no se puede generar, mandar ni hacer con MaKo, cómo lo cuidamos y cómo denunciar un abuso.',
};

const ACTUALIZADO = '5 de noviembre de 2026';
const RESPONSABLE = `${RAZON_SOCIAL_MAKO} (MaKo)`;

export default function Page() {
  const mail = <a href={`mailto:${EMAIL_MAKO}`}>{EMAIL_MAKO}</a>;
  return (
    <LegalShell
      titulo="Política de uso aceptable — MaKo"
      actualizado={ACTUALIZADO}
      intro={<>
        Qué no se puede generar, mandar ni hacer con MaKo. Vale para toda cuenta y para todo su equipo, y se suma a los{' '}
        <a href="/terminos">términos del servicio</a>. Si ves que alguien usa MaKo así, escríbenos a {mail}.
      </>}
    >
      <H id="alcance">1. Qué cubre</H>
      <p>
        MaKo genera <strong>imágenes y videos</strong> (Video Generator y AI Avatar, con tu cuenta de Google Flow),{' '}
        <strong>textos</strong> (guiones, anuncios, copy, respuestas) y <strong>manda mensajes</strong> a tus contactos por
        WhatsApp, email e Instagram. Esta política cubre todo eso: lo que pides, lo que MaKo produce para ti y lo que sale
        con tu nombre. MaKo es un producto independiente: no está afiliado a Google ni a otros creadores de los modelos que
        usa, y ellos no lo avalan.
      </p>

      <H id="generar">2. Lo que no se puede generar</H>
      <ul>
        <li><strong>Contenido sexual o desnudos</strong>, de cualquier tipo.</li>
        <li>
          <strong>Nada que muestre o sexualice a menores de edad.</strong> Es tolerancia cero: se cierra la cuenta y se
          denuncia ante las autoridades.
        </li>
        <li>
          <strong>La cara, el cuerpo o la voz de otra persona sin su permiso.</strong> Nada de hacer pasar a alguien por
          quien no es, ni de mostrarlo diciendo o haciendo algo que no dijo ni hizo (lo que se conoce como <em>deepfake</em>).
          Esto incluye a famosos, políticos y figuras públicas.
        </li>
        <li><strong>Violencia gráfica</strong>, autolesiones, crueldad con animales o contenido que la celebre.</li>
        <li><strong>Odio o acoso</strong> contra una persona o un grupo por lo que es: origen, religión, género, orientación, discapacidad.</li>
        <li><strong>Engaño</strong>: noticias falsas, documentos falsos (identificaciones, recibos, comprobantes) o imitar a una empresa o a un organismo.</li>
        <li><strong>Lo que no es tuyo</strong>: marcas, personajes u obras de otros que no tienes derecho a usar.</li>
      </ul>

      <H id="avatar">3. AI Avatar y tus fotos</H>
      <p>
        AI Avatar arma escenas y videos <strong>con la persona de la foto que subes</strong>. Por eso:
      </p>
      <ul>
        <li>
          La foto tiene que ser <strong>tuya</strong>, o de alguien que te dio <strong>permiso por escrito</strong> para
          usar su imagen así y que lo puede demostrar si se lo pedimos.
        </li>
        <li>Tiene que ser de una persona <strong>mayor de 18 años</strong>.</li>
        <li>
          No se usa para cambiarle la cara a otra persona, ni para poner a alguien en una escena o con un guion que no
          aprobó.
        </li>
      </ul>
      <p>
        Lo mismo vale para la voz: sólo se clona la tuya, o la de quien te dio permiso por escrito.
      </p>

      <H id="mensajes">4. Lo que no se puede mandar</H>
      <ul>
        <li>
          <strong>Spam.</strong> Escríbele a quien te dio su contacto o te escribió primero. Nada de listas compradas ni de
          mensajes masivos a desconocidos.
        </li>
        <li>
          <strong>Insistir con quien pidió que no le escribas.</strong> Si una persona te pide que pares, se para.
        </li>
        <li>
          <strong>Engaños</strong>: pedir contraseñas o datos de tarjeta, prometer ganancias aseguradas, esquemas
          piramidales o hacerte pasar por otra persona o empresa.
        </li>
        <li>
          <strong>Productos o servicios prohibidos o que no tienes permiso para vender</strong>: drogas, armas, apuestas sin
          licencia, medicamentos que piden receta o contenido para adultos.
        </li>
      </ul>
      <p>
        Cumplir las reglas de tu país sobre mensajes comerciales, y las de WhatsApp, Instagram y Meta, es tuyo: ver la
        sección 4 de los <a href="/terminos#tus-datos">términos</a>.
      </p>

      <H id="plataforma">5. Lo que no se puede hacer con la plataforma</H>
      <ul>
        <li>Entrar a datos de otro negocio, o intentarlo.</li>
        <li>Compartir una cuenta entre varias personas, o revender el acceso a MaKo.</li>
        <li>Saltear los límites de tu plan, o cargar la plataforma a propósito para que deje de andar para otros.</li>
        <li>Usar MaKo para algo ilegal en tu país o en el de las personas a las que les escribes.</li>
      </ul>

      <H id="como-cuidamos">6. Cómo lo cuidamos</H>
      <ul>
        <li>
          <strong>Antes de generar una imagen o un video, el pedido se revisa solo.</strong> El texto que va a usar el
          modelo pasa por el servicio de moderación de Creem, la empresa que procesa nuestros pagos. Si lo rechaza, no se
          genera y no gastas nada: MaKo te lo dice y puedes cambiar el texto.
        </li>
        <li>
          <strong>Revisamos lo que se nos denuncia.</strong> Si algo va contra esta política, podemos sacarlo, frenar un
          envío, suspender la cuenta o cerrarla, según lo grave que sea.
        </li>
        <li>
          Cuando haya algo que puedas corregir, te avisamos antes. Lo que pone en riesgo a otras personas se frena primero.
        </li>
      </ul>
      <Ojo>
        <strong>Lo que generas y mandas es tuyo, y también la responsabilidad.</strong> La revisión automática ayuda, pero
        no reemplaza tu criterio: revisa cada pieza antes de publicarla o de aprobar un envío.
      </Ojo>

      <H id="denunciar">7. Cómo denunciar un abuso</H>
      <p>
        Escríbenos a {mail} con qué viste, dónde y, si puedes, el link o una captura. Si el abuso te afecta a ti (alguien usó
        tu cara o tu voz sin permiso, o te escribe sin que lo pidieras), dilo: lo miramos primero.
      </p>

      <H id="cambios">8. Cambios</H>
      <p>
        Cuando esta política cambie, cambia la fecha de arriba. Si el cambio es de fondo, te avisamos dentro de la aplicación
        antes de que aplique.
      </p>

      <H id="responsable">9. Responsable</H>
      <p>
        Responsable: <strong>{RESPONSABLE}</strong>. Contacto: {mail}.
      </p>
    </LegalShell>
  );
}
