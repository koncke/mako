// =============================================================================
// /chatbot → /automations  (la tab se renombró el 09/10/2026)
// =============================================================================
// Pedido de Martín (sexta tanda, General 1), textual: «Cambia el nombre de la tab "Chatbot" por
// "Automations", el nombre en la sidebar, la ruta, todo.» La pantalla vive en app/automations.
//
// ⚠️ SE REDIRIGE, NO SE BORRA: /chatbot está escrito en lugares que nadie puede editar — avisos
// de WhatsApp ya mandados (`/chatbot?sec=<id>`, `/chatbot?aviso=<id>`), marcadores, tareas del
// plan, y el regreso del OAuth de Zernio de una conexión que arrancó antes del cambio
// (`?conectado=1&ws=N`). Un 404 ahí es peor que la pantalla vieja (AGENTS.md, «Retirar una RUTA»).
//
// ⚠️ CON LA QUERY ENTERA: el `?sec=`/`?aviso=`/`?stab=` es lo que abre la automatización que el
// link nombra; sin él la tab abre en la primera y no dice nada. Y con `rutaConWs`: un `redirect()`
// pelado pierde la pestaña del cliente que el super admin está mirando — si el link ya trae su
// `?ws=`, `conWs` lo respeta tal cual.
//
// Sin guard de rol a propósito: un redirect no muestra nada, y /automations hace su propio
// `requireRolWs(['setter'], { nav: 'setting' })`.

import { redirect } from 'next/navigation';
import { rutaConWs } from '@/lib/workspace';
import { RUTA_AUTOMATIONS, destinoConQuery } from '@/lib/ruta-automations';

export default async function ChatbotRenombrada({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  redirect(await rutaConWs(destinoConQuery(RUTA_AUTOMATIONS, await searchParams)));
}
