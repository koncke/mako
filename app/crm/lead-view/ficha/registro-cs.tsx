'use client';

// =============================================================================
// ficha/registro-cs — los COMPONENTES de los bloques propios de Customer Success
// =============================================================================
// Vacío a propósito (ver ./reglas-cs.ts): la ficha de CS todavía monta sus tarjetas a mano. Cuando su
// frente la pase a la plantilla fija, `senal-de-atencion` y `reloj-del-programa` se registran acá.
// =============================================================================

import { REGLAS_CS } from './reglas-cs';
import type { EntradaRegistro } from './tipos';

export const REGISTRO_CS: { [K in keyof typeof REGLAS_CS]: EntradaRegistro } = {};
