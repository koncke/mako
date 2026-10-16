// =============================================================================
// ficha/registro — los bloques CON componente de toda la ficha, juntos
// =============================================================================
// Cada tab trae los suyos en ./registro-<tab>.tsx (componentes) y ./reglas-<tab>.ts (reglas puras): un
// frente por tab, sin pisarse. Un bloque sin entrada acá no se dibuja ni se ofrece en «Agregar bloque».
// Lo fija tests/ficha-armador.test.ts: cada registro tiene las mismas claves que sus reglas, y cada
// bloque va en el archivo de su tab principal.
// =============================================================================

import type { BloqueId } from '@/lib/ficha/catalogo';
import type { EntradaRegistro, RegistroBloques } from './tipos';
import { REGISTRO_RESUMEN } from './registro-resumen';
import { REGISTRO_REUNIONES } from './registro-reuniones';
import { REGISTRO_TRACKING } from './registro-tracking';
import { REGISTRO_PAGOS } from './registro-pagos';
import { REGISTRO_CS } from './registro-cs';

export const REGISTRO: RegistroBloques = { ...REGISTRO_RESUMEN, ...REGISTRO_REUNIONES, ...REGISTRO_TRACKING, ...REGISTRO_PAGOS, ...REGISTRO_CS };

export const entradaDe = (id: BloqueId): EntradaRegistro | undefined => REGISTRO[id];
