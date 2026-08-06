// Ruta vieja: el módulo se renombró a /landing-generator para que el nombre de la tab y la
// URL digan lo mismo. Queda el redirect porque el path viejo está escrito en
// lugares que no se pueden editar de golpe: tareas del plan, mensajes que MaKo
// ya mandó, marcadores del navegador.
import { redirect } from 'next/navigation';

export default function RedirectPage() {
  redirect('/landing-generator');
}
