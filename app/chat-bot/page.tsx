// Ruta vieja: la tab quedó como «Chatbot» (una palabra) y su URL también.
import { redirect } from 'next/navigation';
import { rutaConWs } from '@/lib/workspace';

export default async function RedirectPage() {
  redirect(await rutaConWs('/chatbot'));
}
