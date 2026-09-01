// =============================================================================
// Cómo se instala y cómo se actualiza la extensión
// =============================================================================
// ⚠️ NO EXISTÍA NINGUNA INSTRUCCIÓN EN TODO EL PRODUCTO. El aviso de «Falta la
// extensión de MaKo» ofrecía un botón que baja un `.zip` y nada más: el cliente
// se quedaba con un archivo comprimido y ninguna idea de qué hacer con él.
//
// ── Por qué REINSTALAR y no «reemplazar los archivos» ──────────────────────
// La instrucción vieja era «descomprime encima de la misma carpeta desde la que
// instalaste MaKo». Es correcta y tiene un paso que quien la ejecuta NO PUEDE
// VERIFICAR: cuál es «la misma carpeta». Se equivoca en silencio, y el síntoma es
// idéntico al de un botón roto — Chrome sigue leyendo la carpeta vieja y todo se
// ve igual que antes.
//
// Ya falló tres veces, y una de ellas le costó el día al dueño: Chrome tenía
// cargada una copia congelada en otra ruta mientras él reemplazaba los archivos
// de la carpeta del repo (está fijado en `tests/extension-version.test.ts`).
//
// La reinstalación limpia no tiene ese paso: la carpeta que se elige en «Cargar
// descomprimida» ES la que Chrome carga. Todos sus pasos son verificables por
// quien los hace.
//
// Y su costo está medido y es casi nulo, porque el código ya lo cubre:
//   · el token vive en `chrome.storage.local` (por id de extensión) y se pierde →
//     vuelve con UN clic en «Conectar»;
//   · las plantillas se pierden → **el servidor las repone solo** en el primer
//     latido (`app/api/flow/puente/route.ts` manda las faltantes y
//     `background.js` las siembra). Su propio comentario lo dice: «un F5, un
//     perfil nuevo o reinstalar la extensión dejan de costar "genera uno a mano"».
//
// ⚠️ Y POR ESO EL PRIMER PASO ES QUITAR LA VIEJA. Si quedan las dos instaladas, la
// vieja conserva el token y sigue latiendo con SU número de versión: el aviso de
// «tu extensión quedó vieja» se prende y se apaga según cuál latió último.

import type { Metadata } from 'next';
import { Pagina, Lectura, PageHeader, Alert, Section } from '@/app/_ui';
import { EXTENSION_VERSION } from '@/lib/extension-version';
import { EXTENSION_EN_TIENDA, EXTENSION_URL_TIENDA, EXTENSION_URL_ZIP } from '@/lib/extension-tienda';
import { Pasos } from './Pasos';

export const metadata: Metadata = { title: 'Instalar la extensión' };

export default function InstalarExtension() {
  // ⚠️ EL DESTINO SIGUE AL FLAG, igual que el redirect de `/extension` en
  // `next.config.ts`. Mientras la tienda tenga una versión vieja —cada subida pasa
  // por revisión— apuntar siempre ahí sería mandar al cliente a la rota.
  const desdeLaTienda = EXTENSION_EN_TIENDA;

  return (
    <Pagina>
      <PageHeader
        titulo="Instalar la extensión"
        proposito="Es la que produce tus videos, con tu propia cuenta de Google Flow."
      />

      {desdeLaTienda ? (
        <Section titulo="Desde la Chrome Web Store">
          <Lectura>
            <p>
              Se instala con un clic y <strong>Chrome la mantiene al día sola</strong>:
              no hay nada que actualizar a mano.
            </p>
          </Lectura>
          <Pasos
            zip={EXTENSION_URL_TIENDA}
            version={EXTENSION_VERSION}
            pasos={[
              'Abre la ficha de MaKo en la Chrome Web Store y toca **Añadir a Chrome**.',
              'En la barra de Chrome, toca el ícono de MaKo y después **Conectar**.',
              'Cuando el desplegable diga **Todo listo**, terminaste.',
            ]}
            botonTexto="Abrir la Chrome Web Store"
          />
        </Section>
      ) : (
        <>
          {/* ⚠️ EL AVISO VA ARRIBA DE LOS PASOS Y NO ABAJO. Es la única parte que
              no se puede deducir haciendo: quien no sepa que la carpeta tiene que
              quedarse donde está la va a borrar «porque ya la instalé», y la
              extensión deja de existir de un día para el otro sin motivo visible. */}
          <Alert tono="warn">
            <strong>La carpeta que descomprimas no se borra nunca.</strong> Chrome lee de
            ahí cada vez que abre: si la mueves o la eliminas, MaKo deja de funcionar.
            Déjala en un lugar del que te acuerdes.
          </Alert>

          <Section titulo="Instalar por primera vez">
            <Pasos
              zip={EXTENSION_URL_ZIP}
              version={EXTENSION_VERSION}
              pasos={[
                'Toca **Descargar la extensión**. Si MaKo te pide iniciar sesión, hazlo: '
                  + 'la descarga sigue sola.',
                'Descomprime el archivo. Te queda una carpeta llamada **mako-puente**.',
                'Copia **chrome://extensions** y pégalo en la barra de direcciones de Chrome. '
                  + 'Arriba a la derecha, enciende **Modo de desarrollador**.',
                'Toca **Cargar descomprimida** y elige la carpeta **mako-puente**.',
                'En la barra de Chrome, toca el ícono de MaKo y después **Conectar**.',
                'Cuando el desplegable diga **Todo listo**, terminaste.',
              ]}
            />
          </Section>

          <Section
            titulo="Actualizar a una versión nueva"
            nota={`La versión actual es la ${EXTENSION_VERSION}.`}
          >
            {/* ⚠️ ESTE AVISO ES EL QUE MÁS TIEMPO AHORRA. El botón ↻ de
                chrome://extensions se ve como el botón de actualizar y no lo es:
                vuelve a leer la MISMA carpeta, así que si los archivos no
                cambiaron no cambia nada — y desde afuera es idéntico a un botón
                roto. */}
            <Alert tono="warn">
              <strong>El botón ↻ de Chrome no actualiza nada.</strong> Vuelve a leer la
              misma carpeta: no descarga. Para tener la versión nueva hay que quitar la
              vieja y cargar la nueva, que son estos pasos.
            </Alert>
            <Pasos
              zip={EXTENSION_URL_ZIP}
              version={EXTENSION_VERSION}
              pasos={[
                'Copia **chrome://extensions** y pégalo en la barra de direcciones. '
                  + 'En la tarjeta de MaKo, toca **Quitar**. No pierdes nada de tu cuenta: '
                  + 'lo único que hay que rehacer es un clic al final.',
                'Vuelve aquí y toca **Descargar la extensión**.',
                'Descomprime el archivo. Te queda una carpeta llamada **mako-puente**.',
                'En **chrome://extensions**, toca **Cargar descomprimida** y elige esa carpeta.',
                `Toca el ícono de MaKo en la barra de Chrome. Abajo del todo tiene que decir `
                  + `**v${EXTENSION_VERSION}**. Si dice otro número, elegiste otra carpeta: `
                  + `repite el paso anterior con la que acabas de descomprimir.`,
                'Toca **Conectar**. Cuando diga **Todo listo**, terminaste.',
              ]}
            />
          </Section>
        </>
      )}
    </Pagina>
  );
}
