// =============================================================================
// api-mako/areas/integraciones.def — las operaciones del área `integraciones` (definiciones)
// =============================================================================
// Una entrada por operación: id, qué es, parámetros, por qué canales sale, cómo se
// confirma. SIN server-only y sin importar valores de módulos que lo tengan: esto
// lo importan los tests y el generador de la referencia. Los cuerpos van en
// integraciones.run.ts, cruzados por id. Español neutro (lo lee el cliente).
// =============================================================================

import type { OperacionDef } from '../tipos';

export const DEFS: readonly OperacionDef[] = [];
