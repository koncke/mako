// =============================================================================
// Todos los registros del Video Editor, en un solo import
// =============================================================================
// Cada funcionalidad se registra en las ranuras (./ranuras.ts) y en el
// registro de parámetros (../_opencut/params/extra) desde SU archivo. Este
// módulo los importa a todos para que estén registrados antes del primer
// dibujo: lo importa la raíz del editor (../_opencut/editor-page.tsx).
//
// Una línea por funcionalidad. Al agregar una, sumá su import acá; un registro
// que nadie importa no existe (AGENTS.md → «Escribir la salida no es
// ofrecerla: después de escribirla, preguntá QUIÉN LA LLAMA»).

import '../_opencut/timeline/components/herramientas-ce';
import '../_opencut/components/editor/panels/properties/registry';
import '../_opencut/components/editor/panels/assets/registro';
import '../_opencut/commands/timeline/element/operaciones-clip';
import '../_opencut/effects/registro-ce';
import '../_opencut/subtitles/registro';
import '../_opencut/animaciones/registro';
import '../_opencut/text/registro';
import '../_opencut/fondo/registro';
import '../_opencut/transiciones/registro';
import '../_opencut/audio/registro';

export {};
