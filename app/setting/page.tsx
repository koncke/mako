// =============================================================================
// /setting → /chat-agent
// =============================================================================
// La tab se llama Chatbot desde el rename. Este redirect queda para que no
// se rompan los links viejos: marcadores, avisos ya mandados por WhatsApp y
// cualquier lugar donde todavía viva la ruta anterior.

import { redirect } from 'next/navigation';
import { rutaConWs } from '@/lib/workspace';

export default async function Page() {
  redirect(await rutaConWs('/chatbot'));
}
