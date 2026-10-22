import { redirect } from 'next/navigation';

// «Tu negocio» ya no es una sección de Configuraciones (Martín, 21/10/2026): el nombre del negocio se cambia en el perfil.
export default function Page() {
  redirect('/perfil');
}
