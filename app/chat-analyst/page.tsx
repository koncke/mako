// =============================================================================
// /chat-analyst — ahora es la hoja «Chat Analyst» del Dashboard (tanda v5, 12/10/2026)
// =============================================================================
// Pedido de Martín (punto 22): «Crea una tab también de "VSL Analyst" y "CS Analyst" y de "Chat Analyst"…
// Con esto elimina por completo el desplegable de la sidebar principal de "analysts"». Desde el 05/10/2026 esta
// ruta montaba el dashboard de las secuencias que salió de /automations (DashboardChatAgent); lo que medía —
// enviados, respuestas, aperturas, la serie diaria y cada automatización— está en la plantilla «Chat Analyst»
// (lib/graficos-plantillas-analysts.ts), con los conjuntos del catálogo, y suma los chats de WhatsApp.
//
// EL SETTER, que era el único rol con esta tab, ve SÓLO esa hoja del Dashboard (`HOJA_DE_ROL`,
// lib/graficos-plantillas.ts), como el closer con Closing.
//
// SE REDIRIGE, NO SE BORRA (AGENTS.md, «Retirar una RUTA…»): la siguen links viejos y marcadores. Va con
// `rutaConWs`, o el super admin mirando a un cliente terminaría en su propio Dashboard. Sin guard de rol a
// propósito (molde: app/landing-analyst/page.tsx): un redirect no muestra nada, y /dashboard hace el suyo.

import { redirect } from 'next/navigation';
import { rutaConWs } from '@/lib/workspace';

export default async function Page() {
  redirect(await rutaConWs('/dashboard?hoja=chat-analyst'));
}
