// =============================================================================
// /classroom/methodology — Classroom › Methodology: lo que MaKo sabe para responder (sólo el super admin)
// =============================================================================
// Martín (25/10/2026, punto 13): «Elimina "https://hola-mako.com/contexto", lo de "Conocimientos" lo puedes llevar a esa tab,
// donde está el curso, y que solo yo como super admin vea esas anotaciones». Era la pestaña «Conocimiento» de MaKo Context
// (/contexto): las MISMAS entradas (`mako_knowledge`, /api/mako/knowledge), con el editor completo que vivía suelto y sin
// link en /conocimiento (por curso y lección, su área y la transcripción de un audio). /contexto y /conocimiento redirigen
// acá (next.config.ts). Lo que era «Prompts» y «Configuración» está en Settings › Prompts (app/configuraciones/prompts).
//
// ⚠️ La sub-tab la ve sólo la plataforma (`seccionesDe`, app/classroom/layout.tsx); esta guarda es la de verdad, la MISMA
//    que tenía /contexto (`getSesionAdmin`). La API (/api/mako/knowledge) se cuida sola.

import { notFound } from 'next/navigation';
import { getSesionAdmin } from '@/lib/auth';
import { estadoDeLosModulos } from '@/lib/knowledge';
import { ConocimientoView } from './ConocimientoView';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export const metadata = { title: 'Methodology · Classroom' };

export default async function MetodologiaPage() {
  if (!(await getSesionAdmin())) notFound();
  // Knowledge arriba de las fichas (31/10/2026): los módulos con cuánto método tiene cada uno. Se mide en el SERVIDOR
  // y viaja como prop (datos planos): la vista es un client component y `lib/knowledge` es `server-only`. Si la cuenta
  // no se puede medir, `estadoDeLosModulos` devuelve los módulos en cero y la pantalla se dibuja igual.
  return <ConocimientoView modulos={await estadoDeLosModulos()} />;
}
