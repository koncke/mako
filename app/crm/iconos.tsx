// =============================================================================
// Los íconos que comparten las piezas del CRM
// =============================================================================
// Vive acá y no adentro de un componente porque el lápiz lo dibujan DOS: el
// desplegable de productos (para abrir el pop-up de un embudo) y la fila de la
// etapa de entrada (para abrir por dónde entra la gente). Un SVG copiado en dos
// archivos es un SVG que va a divergir, y la única pregunta es cuándo.

/** El lápiz de «editar esto». 14 px: va adentro de un botón de 28. */
export function LapizIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M12 20h9" />
      <path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z" />
    </svg>
  );
}
