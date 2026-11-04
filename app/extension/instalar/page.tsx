// =============================================================================
// Cómo se instala y cómo se actualiza la extensión
// =============================================================================
// ⚠️ UN SOLO CAMINO: LA CHROME WEB STORE (Martín, 3/11/2026: «dijimos que ya no se
// descarga nada»). Acá hubo un instructivo con el zip para cuando la tienda fuera
// atrás, y como la tienda va atrás casi siempre, era el que se veía. Se fue: nadie
// tiene por qué ver «Descomprime» ni «Modo de desarrollador». Cuál se ofrece no
// depende de ninguna versión (lib/extension-tienda.ts dice por qué).
//
// ⚠️ QUIEN TIENE UNA COPIA VIEJA, PRIMERO LA QUITA. Tiene otro id que la de la tienda
// y Chrome deja las dos. Si quedan las dos, la vieja conserva el token y sigue latiendo
// con SU número de versión: el aviso de «tu extensión quedó vieja» se prende y se apaga
// según cuál latió último.
//
// Y quitarla no cuesta nada, porque el código ya lo cubre:
//   · el token vive en `chrome.storage.local` (por id de extensión) y se pierde →
//     vuelve con UN clic en «Conectar»;
//   · las plantillas se pierden → **el servidor las repone solo** en el primer
//     latido (`app/api/flow/puente/route.ts` manda las faltantes y
//     `background.js` las siembra). Su propio comentario lo dice: «un F5, un
//     perfil nuevo o reinstalar la extensión dejan de costar "genera uno a mano"».

import type { Metadata } from 'next';
import { Pagina, Lectura, PageHeader, Section } from '@/app/_ui';
import { EXTENSION_URL_TIENDA } from '@/lib/extension-tienda';
import { Pasos } from './Pasos';
import { FiguraAnclar } from './FiguraAnclar';
import { Icon } from '@/app/_components/icons';

export const metadata: Metadata = { title: 'Instalar la extensión' };

export default function InstalarExtension() {
  return (
    <Pagina>
      <PageHeader
        titulo="Instalar la extensión"
        proposito="Produce tus videos con tu cuenta de Google Flow, y completa tus contactos con lo que ya ves en tu WhatsApp Web."
      />

      <Section titulo="Desde la Chrome Web Store">
        <Lectura>
          <p>
            Se instala con un clic y <strong>Chrome la mantiene al día sola</strong>:
            no hay nada que actualizar a mano.
          </p>
        </Lectura>
        <Pasos
          href={EXTENSION_URL_TIENDA}
          pasos={[
            'Toca **Agregar a Chrome** y confírmalo en la página de Chrome que se abre.',
            // ⚠️ EL PASO DE ANCLAR, QUE FALTABA EN LOS TRES INSTRUCTIVOS.
            //
            // Los tres decían «toca el ícono de MaKo en la barra de Chrome», y recién
            // instalada NO HAY tal ícono: Chrome mete toda extensión nueva adentro del
            // menú de la pieza de rompecabezas y sólo aparece en la barra si alguien la
            // ancla. O sea que el instructivo mandaba a tocar algo que no existe todavía.
            //
            // Y falla en silencio, que es lo peor: la persona mira la barra, no ve nada,
            // y concluye que la instalación salió mal — cuando salió bien. Es el mismo
            // defecto que el paso de Flow que ya se agregó acá: un paso verificable de
            // menos convierte un instructivo correcto en uno que no se puede terminar.
            {
              texto: 'Arriba a la derecha, toca el ícono de **pieza de rompecabezas** y, al lado de '
                + 'MaKo, el **alfiler**. El ícono de MaKo queda fijo en la barra.',
              figura: <FiguraAnclar />,
            },
            'Toca el ícono de MaKo y después **Conectar**.',
            // ⚠️ ESTE PASO FALTABA, Y ES EL QUE COSTÓ UNA TARDE.
            //
            // El instructivo saltaba de «Conectar» a «Todo listo», y el popup NO
            // dice «Todo listo» ahí: dice «Abre Google Flow» con su botón. Sin
            // Flow abierto el puente queda en `sin_sesion` para siempre, o sea
            // que el tutorial prometía un final que no ocurre.
            //
            // Reportado el 02/09/2026 sobre una instalación que había salido
            // bien: «ya abrimos Flow y no funcionó». Habían llegado al final del
            // instructivo creyendo que estaba terminado.
            'En el mismo desplegable, toca **Abrir Google Flow** e inicia sesión si te lo pide.',
            'Deja esa pestaña abierta. Si la cierras, MaKo no puede filmar: es tu sesión de '
              + 'Google la que produce los videos.',
            'Cuando el desplegable diga **Todo listo**, terminaste.',
          ]}
        />
      </Section>

      {/* ⚠️ PLEGADA. Casi todo el mundo instala por primera vez, y esto empieza con
          **Quitar**, que asusta antes de haber instalado nada. Sigue a un clic: lo que
          la regla de la casa prohíbe es esconder SIN pista, no plegar. */}
      <details style={{ marginTop: 26 }}>
        <summary style={{
          cursor: 'pointer', listStyle: 'none', padding: '10px 0',
          fontSize: 'var(--fs-sect)', fontWeight: 650, color: 'var(--ink)',
          display: 'flex', alignItems: 'center', gap: 9,
        }}>
          <Icon name="chevron" size={14} />
          MaKo me pide actualizarla
        </summary>

        <Lectura>
          <p>
            La de la Chrome Web Store se actualiza sola. Si MaKo te lo pide, la tuya es de
            antes: se cambia una vez por la de la tienda y no hay que volver a hacerlo.
          </p>
        </Lectura>
        <Pasos
          href={EXTENSION_URL_TIENDA}
          conBoton={false}
          pasos={[
            'Copia **chrome://extensions** y pégalo en la barra de direcciones. '
              + 'En la tarjeta de MaKo, toca **Quitar**. No pierdes nada de tu cuenta: '
              + 'lo único que hay que rehacer es un clic al final.',
            'Vuelve aquí y toca **Agregar a Chrome**.',
            // Al quitarla, el anclado se pierde con ella: vuelve a hacer falta, igual
            // que en una instalación nueva.
            {
              texto: 'Arriba a la derecha, toca el ícono de **pieza de rompecabezas** y, al lado de '
                + 'MaKo, el **alfiler**.',
              figura: <FiguraAnclar />,
            },
            'Toca el ícono de MaKo, después **Conectar** y **Abrir Google Flow**. Deja esa pestaña abierta.',
            'Cuando el desplegable diga **Todo listo**, terminaste.',
          ]}
        />
      </details>
    </Pagina>
  );
}
