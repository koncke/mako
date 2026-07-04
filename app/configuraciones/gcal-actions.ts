'use server';

// Estado / desconexión de la integración de Google Calendar (solo el dueño).

import { esWorkspaceDueno } from '@/lib/workspace';
import { googleCalendarConectado, desconectarGoogleCalendar } from '@/lib/google-calendar';

export async function getGoogleCalendarStatusAction(): Promise<{ conectado: boolean; puede: boolean }> {
  const puede = await esWorkspaceDueno();
  if (!puede) return { conectado: false, puede: false };
  return { conectado: await googleCalendarConectado(), puede: true };
}

export async function disconnectGoogleCalendarAction(): Promise<void> {
  if (!(await esWorkspaceDueno())) throw new Error('Solo el workspace principal.');
  await desconectarGoogleCalendar();
}
