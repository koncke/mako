// =============================================================================
// /setting → /chat-agent
// =============================================================================
// La tab se llama Chat Agent desde el rename. Este redirect queda para que no
// se rompan los links viejos: marcadores, avisos ya mandados por WhatsApp y
// cualquier lugar donde todavía viva la ruta anterior.

import { redirect } from 'next/navigation';

export default function Page() {
  redirect('/chat-bot');
}
