// =============================================================================
// /plan/revisar/[id] — pantalla de revisión de un BORRADOR de MaKo (mig 0094)
// =============================================================================
// MaKo (WhatsApp) arma el borrador y manda el link acá. El dueño O EL CLIENTE responde
// las preguntas de a una (wizard) y confirma → se crean las tareas (dueño: plan_tareas +
// Perro; cliente: su board lib/todo). Guard = cualquier sesión; getPropuesta scopea al
// workspace del que mira (así un cliente solo ve SUS borradores).

import { redirect } from 'next/navigation';
import { getUsuarioActual } from '@/lib/auth';
import { getPropuesta, duenoDePropuesta } from '@/lib/plan-propuesta';
import { getCapaActual } from '@/lib/workspace';
import { RevisarPropuesta } from './RevisarPropuesta';
import { NoEsTuyo } from './NoEsTuyo';
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
  if (prop) return <RevisarPropuesta prop={prop} />;

  // NO ESTÁ EN TU WORKSPACE. Puede ser que el link no exista o que sea de otra persona,
  // y hasta ahora las dos cosas daban el mismo 404 mudo de Next — que además se lee
  // como "la app se rompió". Se distingue con una consulta que devuelve SOLO de qué
  // cuenta es (nunca el contenido: el aislamiento no se toca).
  //
  // Y el link de salida depende de quién sos: el super-admin puede pasar a ver ese
  // tablero (ya tiene esa potestad por la barra de impersonación); cualquier otro vuelve
  // al suyo. Ofrecerle a un cliente un botón para entrar al plan de otro sería abrir por
  // la UI justo lo que el scope cierra por atrás.
  const dueno = await duenoDePropuesta(id).catch(() => null);
  const capa = await getCapaActual().catch(() => null);
  return <NoEsTuyo existe={!!dueno} deQuien={dueno?.nombre ?? ''} wsDestino={capa === 'superadmin' ? dueno?.workspaceId ?? null : null} />;
}
