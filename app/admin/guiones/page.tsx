// =============================================================================
// /admin/guiones — redirige al registro de Ads Writer
// =============================================================================
// Las dos bibliotecas globales (Ángulos y Estructuras) se mudaron adentro de
// /admin/dev/ads-writer, donde son dos sub-tabs al lado de «Roadmap». El nombre
// «Guiones» no decía qué era ni coincidía con la feature (/ads-writer), que es
// la regla de la casa: el nombre se entiende solo y coincide con la ruta.
//
// La ruta vieja NO se borra: está escrita en tareas del plan, en documentos del
// repo y en links ya mandados. Redirige, que es lo que se hizo con el resto de
// los renombres del rediseño.

import { redirect } from 'next/navigation';

export const dynamic = 'force-dynamic';

export default function GuionesAdminPage() {
  redirect('/admin/dev/ads-writer');
}
