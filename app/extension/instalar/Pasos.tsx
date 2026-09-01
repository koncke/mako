'use client';

// La lista numerada de un instructivo, con su botón de descarga en el paso 1.
//
// ⚠️ LOS NÚMEROS Y EL NOMBRE DEL ARCHIVO NO SE ESCRIBEN A MANO: entran como props
// desde `EXTENSION_VERSION` y `EXTENSION_URL_ZIP`. Un instructivo con la versión
// hardcodeada es el mismo bug de contrato que este repo acaba de pagar en el
// código, escrito en prosa — y peor, porque nadie lo compila.

import { ButtonLink } from '@/app/_ui';
import { Icon } from '@/app/_components/icons';

/** `texto **en negrita** más texto` → nodos. Sin `innerHTML`. */
function conNegritas(t: string) {
  // El índice sale de `entries()` y NO de `indexOf`: `indexOf` devuelve la PRIMERA
  // coincidencia, así que dos tramos con el mismo texto tomarían los dos el índice
  // del primero y la negrita caería en el pedazo equivocado sin que nada falle.
  return t.split('**').map((tramo, i) => (
    i % 2 ? <strong key={i}>{tramo}</strong> : <span key={i}>{tramo}</span>
  ));
}

export function Pasos({ pasos, zip, botonTexto = 'Descargar la extensión' }: {
  pasos: string[];
  /** A dónde va el botón: el zip, o la ficha de la tienda. */
  zip: string;
  /** La versión, sólo para que el llamador no pueda olvidarse de pasarla. */
  version: string;
  botonTexto?: string;
}) {
  return (
    <ol style={{
      margin: '14px 0 0', paddingLeft: 22, display: 'grid', gap: 14,
      fontSize: 'var(--fs-card)', lineHeight: 1.6, color: 'var(--ink)',
      // Los números de una receta se leen mejor alineados: es una secuencia, y
      // el que la sigue vuelve a buscar «en cuál iba».
      fontVariantNumeric: 'tabular-nums',
    }}>
      {pasos.map((p, i) => (
        <li key={i}>
          <div>{conNegritas(p)}</div>
          {/* El botón vive DENTRO del paso que lo pide, no al final de la lista.
              Un botón al pie obliga a leer los seis pasos antes de poder empezar
              el primero. */}
          {i === 0 && (
            <div style={{ marginTop: 9 }}>
              {/* `ButtonLink` y no `Button`: es una descarga, así que el clic
                  derecho, «abrir en otra pestaña» y el historial tienen que
                  funcionar como en cualquier link. Y va por `app/_ui/Link`, que
                  es lo que preserva el `?ws=` de la pestaña. */}
              <ButtonLink
                variant="primary"
                href={zip}
                icon={<Icon name="descargar" size={16} />}
              >
                {botonTexto}
              </ButtonLink>
            </div>
          )}
        </li>
      ))}
    </ol>
  );
}
