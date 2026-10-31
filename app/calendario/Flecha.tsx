// =============================================================================
// Flecha — la flecha de las barras del Calendario (‹ › y la del desplegable)
// =============================================================================
// Vivía en MiniMes.tsx, el mes chico de Google, que se fue el 29/10/2026 con la barra lateral copiada de Google y la vista
// Año (el Calendario a la medida de sus cuatro usos: docs/hallazgos-calendario.md).

export function Flecha({ dir, tam = 20 }: { dir: 'izq' | 'der' | 'abajo' | 'arriba'; tam?: number }) {
  const d = dir === 'izq' ? 'M15 6l-6 6 6 6' : dir === 'der' ? 'M9 6l6 6-6 6' : dir === 'abajo' ? 'M6 9l6 6 6-6' : 'M6 15l6-6 6 6';
  return (
    <svg width={tam} height={tam} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d={d} />
    </svg>
  );
}
