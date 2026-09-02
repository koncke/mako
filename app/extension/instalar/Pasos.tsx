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

export function Pasos({ pasos, zip, botonTexto = 'Descargar la extensión', conBoton = true }: {
  pasos: string[];
  /** A dónde va el botón: el zip, o la ficha de la tienda. */
  zip: string;
  /** La versión, sólo para que el llamador no pueda olvidarse de pasarla. */
  version: string;
  botonTexto?: string;
  /**
   * ⚠️ EL SEGUNDO INSTRUCTIVO NO LLEVA BOTÓN. Con `true` en los dos, la página
   * mostraba DOS botones azules idénticos —y el de abajo caía entre el paso 1 y
   * el 2 de una lista que lo pide en el 2, así que el orden visual mentía sobre
   * el orden de los pasos.
   */
  conBoton?: boolean;
}) {
  return (
    <ol style={{
      margin: '14px 0 0', paddingLeft: 26, display: 'grid', gap: 14,
      // ⚠️ EL MARCADOR SE DECLARA ACÁ. Con `display: grid` en el `<ol>` los `<li>`
      // pasan a ser ítems de grilla y PIERDEN su `display: list-item`, o sea que
      // el número desaparece — y una receta de seis pasos sin números se lee como
      // un muro. Medido en pantalla: no salía uno solo.
      listStyleType: 'decimal',
      fontSize: 'var(--fs-card)', lineHeight: 1.6, color: 'var(--ink)',
      // Los números de una receta se leen mejor alineados: es una secuencia, y
      // el que la sigue vuelve a buscar «en cuál iba».
      fontVariantNumeric: 'tabular-nums',
    }}>
      {pasos.map((p, i) => (
        // `display: list-item` repuesto: es lo que la grilla le sacó.
        <li key={i} style={{ display: 'list-item' }}>
          <div>{conNegritas(p)}</div>
          {/* El botón vive DENTRO del paso que lo pide, no al final de la lista.
              Un botón al pie obliga a leer los seis pasos antes de poder empezar
              el primero. */}
          {i === 0 && conBoton && (
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
