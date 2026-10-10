// Ruta vieja: la tab fue «Chat Bot» (/chat-bot), después «Chatbot» (/chatbot) y desde el
// 09/10/2026 «Automations» (/automations). Va directo, sin pasar por /chatbot, y con la
// query entera (lib/ruta-automations.ts).
import { redirect } from 'next/navigation';
import { rutaConWs } from '@/lib/workspace';
import { RUTA_AUTOMATIONS, destinoConQuery } from '@/lib/ruta-automations';

export default async function RedirectPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  redirect(await rutaConWs(destinoConQuery(RUTA_AUTOMATIONS, await searchParams)));
}
