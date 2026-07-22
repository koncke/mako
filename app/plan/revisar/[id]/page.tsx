// =============================================================================
// /plan/revisar/[id] — pantalla de revisión de un BORRADOR de MaKo (mig 0094)
// =============================================================================
// MaKo (WhatsApp) arma el borrador y manda el link acá. El dueño edita las tareas,
// responde las notas/preguntas de MaKo y confirma → se crean (con el Perro). Guard =
// super-admin sin impersonar, igual que /plan/agencia.

import { redirect, notFound } from 'next/navigation';
import { getUsuarioActual } from '@/lib/auth';
import { estaImpersonando } from '@/lib/workspace';
import { getPropuesta } from '@/lib/plan-propuesta';
import { RevisarPropuesta } from './RevisarPropuesta';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default async function RevisarPage({ params }: { params: Promise<{ id: string }> }) {
  const sesion = await getUsuarioActual();
  if (sesion?.rol !== 'admin' || (await estaImpersonando())) redirect('/plan');
  const { id } = await params;
  const prop = await getPropuesta(id);
  if (!prop) notFound();
  return <RevisarPropuesta prop={prop} />;
}
