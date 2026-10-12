// =============================================================================
// /vsl-analyst — ahora es la hoja «VSL Analyst» del Dashboard (tanda v5, 12/10/2026)
// =============================================================================
// Pedido de Martín (punto 22): «Crea una tab también de "VSL Analyst" y "CS Analyst" y de "Chat Analyst"…
// Con esto elimina por completo el desplegable de la sidebar principal de "analysts"». Era un ComingSoon;
// el análisis del video es la plantilla «VSL Analyst» (lib/graficos-plantillas-analysts.ts).
//
// SE REDIRIGE, NO SE BORRA (AGENTS.md, «Retirar una RUTA…»): la siguen links viejos y marcadores. Va con
// `rutaConWs`, o el super admin mirando a un cliente terminaría en su propio Dashboard. Sin guard de rol a
// propósito (molde: app/landing-analyst/page.tsx): un redirect no muestra nada, y /dashboard hace el suyo.
// `?hoja=vsl-analyst` abre la hoja de esa plantilla, o la AGREGA al informe (`hojaDestino`).

import { redirect } from 'next/navigation';
import { rutaConWs } from '@/lib/workspace';

export default async function Page() {
  redirect(await rutaConWs('/dashboard?hoja=vsl-analyst'));
}
