// =============================================================================
// /setting → /automations
// =============================================================================
// La tab se llamó Setting, después Chat Agent, después Chatbot y desde el 09/10/2026
// Automations. Este redirect queda para que no se rompan los links viejos: marcadores,
// avisos ya mandados por WhatsApp y cualquier lugar donde todavía viva la ruta anterior.
// Va DIRECTO a /automations (sin pasar por /chatbot: un salto de más es un redirect más
// que puede perder algo) y con la query entera (lib/ruta-automations.ts).

import { redirect } from 'next/navigation';
import { rutaConWs } from '@/lib/workspace';
import { RUTA_AUTOMATIONS, destinoConQuery } from '@/lib/ruta-automations';

export default async function Page({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  redirect(await rutaConWs(destinoConQuery(RUTA_AUTOMATIONS, await searchParams)));
}
