// Ruta vieja: «Market Analyst» pasó a llamarse Competitor Spy y se mudó a
// /competitor-spy, para que el nombre de la tab y la URL digan lo mismo.
import { redirect } from 'next/navigation';

export default function RedirectPage() {
  redirect('/competitor-spy');
}
