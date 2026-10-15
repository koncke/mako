// =============================================================================
// La letra de la interfaz del Image Editor
// =============================================================================
// Noto Sans (relevamiento-canva-armazon.md §1.4): Canva Sans es de Canva y no se copia, y Noto Sans es el
// respaldo de su propia pila, así que las medidas ya están pensadas para ella. tokens.css la nombra en
// `--cv-font-sans` ('Noto Sans' después de `--cv-font-ui`, que ya no se define).
//
// ⚠️ ENTRA COMO HOJA DE GOOGLE, NO POR `next/font` (15/10/2026). Con `next/font/google` el build de Vercel baja
// la fuente de Google AL COMPILAR, y el 15/10 dejó de compilar el MISMO código que había desplegado verde horas
// antes («next/font/google queries have exactly one entry» · «Can't resolve
// '@vercel/turbopack-next/internal/font/google/font'», con la traza en presentador/PresentadorCliente.tsx): un
// build que depende de una red ajena falla cualquier día, y frenó los deploys de todos los chats. Es como entran
// las demás fuentes del repo (app/layout.tsx). React 19 sube el `<link>` con `precedence` al <head> y lo
// deduplica, así que montarlo en el editor y en la ventana del presentador no lo pide dos veces.

export const HOJA_NOTO_SANS = 'https://fonts.googleapis.com/css2?family=Noto+Sans:wght@400;500;600;700&display=swap';

/** La hoja de Noto Sans para la raíz `.cv` (el editor y la ventana del presentador). */
export function FuenteUi() {
  return <link rel="stylesheet" href={HOJA_NOTO_SANS} precedence="default" />;
}
