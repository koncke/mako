// =============================================================================
// recorrido-ficha — la GUÍA DE EDICIÓN de la ficha del lead (el «⋯», como la del Dashboard)
// =============================================================================
// Martín, 16/10/2026 (punto 10): el «⋯» como el del Dashboard, con «el tutorial de cómo editar». Es el mismo recorrido
// de la casa (app/_ui/Recorrido.tsx): se abre solo la primera vez que alguien entra a «Editar», y se vuelve a ver desde
// «Guía de edición» en el «⋯». Cada paso señala `[data-recorrido="<objetivo>"]`; uno que no está en la pantalla se
// saltea (la regla de la casa).
// Textos cortos (AGENTS.md, el texto que se dibuja es corto) y con tuteo.
// =============================================================================

import type { PasoRecorrido } from '@/lib/recorridos';

export const RECORRIDO_FICHA_EDICION = 'crm-ficha-edicion';

export const PASOS_FICHA_EDICION: PasoRecorrido[] = [
  { objetivo: 'fb-hojas', titulo: 'Tus hojas', texto: 'Cambia de hoja o crea una nueva desde aquí.' },
  { objetivo: 'fb-agregar', titulo: 'Agregar bloque', texto: 'Suma lo que quieras ver en esta hoja.' },
  { objetivo: 'fb-templates', titulo: 'Templates', texto: 'Arma la hoja de una vez, o toda la ficha.' },
  { objetivo: 'fb-bloque', titulo: 'Cada bloque', texto: 'Con un clic eliges su ancho, su diseño y si es obligatorio. Arrástralo para moverlo.' },
  { objetivo: 'fb-estilo', titulo: 'Estilo de la hoja', texto: 'Vista épica, tamaño de las tarjetas y colores.' },
  { objetivo: 'fb-mako', titulo: 'MaKo', texto: 'Pídele en palabras lo que quieras cambiar.' },
  { objetivo: 'fb-editar', titulo: 'Ver', texto: 'Sal de la edición. Los cambios se guardan solos.' },
];
