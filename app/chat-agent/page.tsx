// Ruta vieja: la tab se llamó «Chat Agent», después «Chat Bot» (/chat-bot), «Chatbot»
// (/chatbot) y desde el 09/10/2026 «Automations» (/automations). El redirect se queda porque
// /chat-agent está escrito en tareas del plan y en mensajes que MaKo ya mandó. Va directo,
// sin pasar por /chatbot, y con la query entera (lib/ruta-automations.ts).
import { redirect } from 'next/navigation';
import { rutaConWs } from '@/lib/workspace';
import { RUTA_AUTOMATIONS, destinoConQuery } from '@/lib/ruta-automations';

export default async function RedirectPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  redirect(await rutaConWs(destinoConQuery(RUTA_AUTOMATIONS, await searchParams)));
}
