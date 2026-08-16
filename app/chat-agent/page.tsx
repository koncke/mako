// Ruta vieja: la tab pasó a llamarse «Chat Bot» y se mudó a /chat-bot, para que
// el nombre y la URL digan lo mismo. El redirect se queda porque /chat-agent
// está escrito en tareas del plan y en mensajes que MaKo ya mandó.
import { redirect } from 'next/navigation';
import { rutaConWs } from '@/lib/workspace';

export default async function RedirectPage() {
  redirect(await rutaConWs('/chatbot'));
}
