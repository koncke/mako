// Ruta vieja: la tab quedó como «Chatbot» (una palabra) y su URL también.
import { redirect } from 'next/navigation';

export default function RedirectPage() {
  redirect('/chatbot');
}
