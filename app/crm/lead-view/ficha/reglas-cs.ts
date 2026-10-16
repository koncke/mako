// =============================================================================
// ficha/reglas-cs — las reglas PURAS de los bloques propios de Customer Success
// =============================================================================
// `senal-de-atencion` y `reloj-del-programa` (§3, Customer Success). La ficha de CS todavía monta sus
// tarjetas a mano (app/customer-success/FichaPestanas.tsx): este registro queda vacío hasta que el frente
// de CS la pase a la plantilla fija (`PLANTILLA_CS`, lib/ficha/plantillas.ts).
// =============================================================================

import type { ReglasDeTab } from './tipos';

export const REGLAS_CS = {} satisfies ReglasDeTab;
