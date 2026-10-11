// =============================================================================
// /graficos — ahora es la hoja «inicial» del Dashboard
// =============================================================================
// «Mis gráficos» vivió acá un día (10-11/10/2026) como tercera sub-tab de Graphics; desde que el
// Dashboard entero es el editor, esta ruta trae a él.
//
// SE REDIRIGE, NO SE BORRA (AGENTS.md, «Retirar una RUTA…»): la siguen links viejos de avisos,
// marcadores y otras pantallas. Va con `rutaConWs`, o el super admin mirando a un cliente
// terminaría en su propio Dashboard.

import { redirect } from 'next/navigation';
import { rutaConWs } from '@/lib/workspace';

export default async function Page() {
  redirect(await rutaConWs('/dashboard'));
}
