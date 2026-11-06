// =============================================================================
// RazonObjetivo — por qué el Objetivo Principal es el norte (recorrido visual del 30/10/2026, P2)
// =============================================================================
// La tarjeta del Objetivo Principal (Plan › Prioridades) se estira al alto de las tres tareas de al lado, y entre
// «Objetivo Principal» y la fecha quedaban ~200 px vacíos. Ahí va la razón del Perro, que es lo que explica el número:
// cortada en cinco renglones y entera en el `title`. La dibuja `ProyectoCardTile` con `conRazon` (BoardShell.tsx); vive
// aparte porque BoardShell no se puede importar en un test (arrastra un módulo de servidor).
// =============================================================================

export function RazonObjetivo({ razon }: { razon: string }) {
  return (
    <div title={razon} data-razon-objetivo
      style={{ fontSize: 12.5, color: 'var(--dim)', lineHeight: 1.5, display: '-webkit-box', WebkitBoxOrient: 'vertical', WebkitLineClamp: 5, overflow: 'hidden' }}>
      🐕 {razon}
    </div>
  );
}
