// =============================================================================
// /plan/revisar/[id] — pantalla de revisión de un BORRADOR de MaKo (mig 0094)
// =============================================================================
// MaKo (WhatsApp) arma el borrador y manda el link acá. El dueño O EL CLIENTE responde
// las preguntas de a una (wizard) y confirma → se crean las tareas (dueño: plan_tareas +
// Perro; cliente: su board lib/todo). Guard = cualquier sesión; getPropuesta scopea al
// workspace del que mira (así un cliente solo ve SUS borradores).

import { redirect, notFound } from 'next/navigation';
import { getUsuarioActual } from '@/lib/auth';
import { getPropuesta } from '@/lib/plan-propuesta';
import { RevisarPropuesta } from './RevisarPropuesta';
import { guardOnboarding } from '@/lib/tab-access';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default async function RevisarPage({ params }: { params: Promise<{ id: string }> }) {
  const sesion = await getUsuarioActual();
  if (!sesion) redirect('/inicio');
  // Esta pantalla ESCRIBE (confirma tareas del plan). Llega por un link que MaKo
  // manda por WhatsApp, así que es la vía más fácil de entrar salteando el alta.
  await guardOnboarding();
  const { id } = await params;
  const prop = await getPropuesta(id);
  if (!prop) notFound();
  return <RevisarPropuesta prop={prop} />;
}
