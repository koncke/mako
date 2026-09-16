// =============================================================================
// api-mako/areas/instagram.run — los cuerpos del área `instagram`
// =============================================================================
// Un runner por id de instagram.def.ts. Lecturas: { leer }. Acciones: { preparar, ejecutar }
// y opcionalmente { proponer } para las que tienen pantalla propia. Todo corre
// adentro de runWithWorkspace(ctx.ws): las libs que ya scopean con getTenantDb
// scopean solas. Nunca se escribe directo desde preparar().
// =============================================================================

import 'server-only';
import type { Runners } from '../tipos';

export const RUNNERS: Runners = {};
