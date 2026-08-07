// =============================================================================
// Pagina — el <main> de una pantalla. Uno solo para toda la app.
// =============================================================================
// POR QUÉ EXISTE. Cada pantalla nueva venía escribiendo su propio <main>, y de
// ahí salía el problema de siempre: una queda angosta, otra con más aire que la
// de al lado, otra sin `minWidth: 0` y con una tabla que desborda el layout.
// Medido sobre app/: dieciséis pantallas usan `padding: '34px 44px 60px'` y el
// resto usa siete variantes distintas, más algún `maxWidth` suelto que deja la
// pantalla flotando en el medio.
//
// No había ninguna «regla escondida» achicando nada: el ancho lo achicaba quien
// escribía la pantalla, sin querer. Esto lo saca de la mesa.
//
// LA REGLA: una pantalla ocupa TODO el ancho que le deja la barra. Si algo
// adentro necesita ser más angosto —un párrafo largo, un formulario— se limita
// ESE bloque, no la pantalla entera. Un `maxWidth` en el <main> deja la mitad
// derecha vacía en un monitor grande y no hay forma de recuperarla desde adentro.

import type { CSSProperties, ReactNode } from 'react';

export function Pagina({ children, densidad = 'normal', style }: {
  children: ReactNode;
  /**
   * `normal` es lo que usa casi toda la app. `compacta` es para pantallas que
   * mandan su propio scroll adentro (bandejas, tableros) y no quieren el aire
   * de abajo.
   */
  densidad?: 'normal' | 'compacta';
  /** Para lo puntual —`position: relative`, un `display` propio—, nunca ancho. */
  style?: Omit<CSSProperties, 'maxWidth' | 'width'>;
}) {
  return (
    <main style={{
      // flex:1 + minWidth:0 es la pareja que sostiene el layout: el primero la
      // hace ocupar lo que sobra, el segundo le permite ACHICARSE por debajo de
      // su contenido. Sin el minWidth, una tabla ancha empuja el <main> y
      // aparece scroll horizontal en toda la página.
      flex: 1,
      minWidth: 0,
      padding: densidad === 'compacta' ? '24px 28px 20px' : '34px 44px 60px',
      ...style,
    }}>
      {children}
    </main>
  );
}

/**
 * Un bloque de texto largo con medida de lectura. ESTO es lo que lleva un ancho
 * máximo — no la pantalla. Alrededor de 70 caracteres por renglón es donde el
 * ojo deja de perder el renglón siguiente.
 */
export function Lectura({ children, style }: { children: ReactNode; style?: CSSProperties }) {
  return <div style={{ maxWidth: '70ch', ...style }}>{children}</div>;
}
