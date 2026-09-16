// =============================================================================
// api-mako/areas/email.run — los cuerpos del área `email`
// =============================================================================
// Un runner por id de email.def.ts. Lecturas: { leer }. Acciones: { preparar, ejecutar }
// y opcionalmente { proponer } para las que tienen pantalla propia. Todo corre
// adentro de runWithWorkspace(ctx.ws): las libs que ya scopean con getTenantDb
// scopean solas. Nunca se escribe directo desde preparar().
// =============================================================================

import 'server-only';
import type { Runners } from '../tipos';

export const RUNNERS: Runners = {};
