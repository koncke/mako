// =============================================================================
// /conocimiento — cursos y metodologías que MaKo tiene bajados a tierra
// =============================================================================
// SOLO AGENCIA. Es la superficie donde se carga y cura la metodología de MaKo,
// no una tab de cliente. Antes usaba requireRolWs([]), que NO restringe a la
// agencia: 'admin' es también el rol del admin-cliente de CADA workspace, así
// que todos pasaban — y la ruta no tiene link en ningún nav, o sea que se
// alcanzaba solo tecleando la URL y nadie la miraba.
//
// El guard correcto es getSesionAdmin() (rol GLOBAL), igual que /contexto,
// /modelos-ia y /admin.
//
// OJO — esto por sí solo NO cierra la fuga: /api/mako/knowledge sigue sin guard
// de rol, así que cualquier logueado puede pedir el catálogo curado y hacer
// seed_curso para copiárselo. Ver la tarea 168 del /plan: el gate de la página
// es cosmético sin el de la API.

import { redirect } from 'next/navigation';
import { ConocimientoView } from './ConocimientoView';
import { getSesionAdmin } from '@/lib/auth';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default async function ConocimientoPage() {
  if (!(await getSesionAdmin())) redirect('/');
  return <ConocimientoView />;
}
