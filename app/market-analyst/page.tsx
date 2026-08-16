// Ruta vieja: «Market Analyst» pasó a llamarse Competitor Spy y se mudó a
// /competitor-spy, para que el nombre de la tab y la URL digan lo mismo.
import { redirect } from 'next/navigation';
import { rutaConWs } from '@/lib/workspace';

export default async function RedirectPage() {
  redirect(await rutaConWs('/competitor-spy'));
}
