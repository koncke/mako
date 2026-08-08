// =============================================================================
// /plan/revisar/[id] — pantalla de revisión de un BORRADOR de MaKo (mig 0094)
// =============================================================================
// MaKo (WhatsApp) arma el borrador y manda el link acá. El dueño O EL CLIENTE responde
// las preguntas de a una (wizard) y confirma → se crean las tareas (dueño: plan_tareas +
// Perro; cliente: su board lib/todo). Guard = cualquier sesión; getPropuesta scopea al
// workspace del que mira (así un cliente solo ve SUS borradores).

import { redirect } from 'next/navigation';
import { getUsuarioActual } from '@/lib/auth';
import { getPropuesta, duenoDePropuesta, listPropuestasPendientes } from '@/lib/plan-propuesta';
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

  // ── EL LINK LO TRANSCRIBE UN MODELO, ASÍ QUE PUEDE VENIR MAL ────────────────
  // El id es una cadena aleatoria de 17 caracteres («propmskimbc4s4b4h»): el código lo
  // arma bien (lib/mako-doer-acciones.ts), pero después la instrucción le dice al modelo
  // «mandá una línea corta + este link», y copiar 17 caracteres al azar sin errarle uno
  // es justo lo que un LLM hace mal. Verificado: un link que MaKo mandó apuntaba a un
  // borrador de 1 tarea sobre un Reel cuando lo que había que revisar eran 3 tareas de
  // otra cosa — o sea que ni siquiera falla siempre en «no existe»: a veces cae en un
  // borrador REAL pero equivocado.
  //
  // No se puede arreglar pidiéndole al modelo que copie mejor. Lo que sí se puede es
  // que un id que no existe deje de ser un callejón sin salida: si el que mira tiene UN
  // solo borrador pendiente, es obvio cuál buscaba y se lo damos. Con varios, se los
  // listamos en vez de mandarlo a la nada.
  const pendientes = await listPropuestasPendientes(5).catch(() => []);
  if (pendientes.length === 1) return <RevisarPropuesta prop={pendientes[0]} />;

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
  return <NoEsTuyo existe={!!dueno} deQuien={dueno?.nombre ?? ''} wsDestino={capa === 'superadmin' ? dueno?.workspaceId ?? null : null}
    otros={dueno ? [] : pendientes.map((p) => ({ id: p.id, resumen: p.resumen, nTareas: p.tareas.length }))} />;
}
