'use client';

// La lista numerada de un instructivo, con su botón «Agregar a Chrome» en el paso 1.

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

/**
 * Un paso. Con figura cuando la instrucción nombra algo que hay que RECONOCER.
 *
 * ⚠️ La figura viaja PEGADA a su texto y no por índice. Insertar un paso en el
 * medio —que es exactamente lo que pasó al agregar el de anclar— correría todos
 * los índices y la figura terminaría ilustrando otra cosa, sin que nada falle.
 */
type Paso = string | { texto: string; figura: React.ReactNode };

export function Pasos({ pasos, href, conBoton = true }: {
  pasos: Paso[];
  /** A dónde va el botón: la ficha de la tienda. */
  href: string;
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
      {pasos.map((p, i) => {
        const texto = typeof p === 'string' ? p : p.texto;
        const figura = typeof p === 'string' ? null : p.figura;
        return (
        // `display: list-item` repuesto: es lo que la grilla le sacó.
        <li key={i} style={{ display: 'list-item' }}>
          <div>{conNegritas(texto)}</div>
          {/* Debajo del texto y no en lugar de él: la figura dice DÓNDE está el
              control, y el texto qué hacer con él. Sin el dibujo hay que adivinar
              cuál de los íconos del rincón es; sin el texto, qué se hace después. */}
          {figura && <div style={{ marginTop: 10, marginBottom: 2 }}>{figura}</div>}
          {/* El botón vive DENTRO del paso que lo pide, no al final de la lista.
              Un botón al pie obliga a leer los seis pasos antes de poder empezar
              el primero. */}
          {i === 0 && conBoton && (
            <div style={{ marginTop: 9 }}>
              {/* `ButtonLink` y no `Button`: el clic derecho, «abrir en otra
                  pestaña» y el historial tienen que funcionar como en cualquier
                  link. En otra pestaña para que estos pasos sigan acá al volver. */}
              <ButtonLink
                variant="primary"
                href={href}
                newTab
                icon={<Icon name="plus" size={16} />}
              >
                Agregar a Chrome
              </ButtonLink>
            </div>
          )}
        </li>
        );
      })}
    </ol>
  );
}
