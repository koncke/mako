'use server';

// Estado / desconexión de la integración de Google Calendar (solo el dueño).

import { headers } from 'next/headers';
import { esDuenoAdmin } from '@/lib/workspace';
import { googleCalendarConectado, desconectarGoogleCalendar, googleRedirectUri } from '@/lib/google-calendar';

export async function getGoogleCalendarStatusAction(): Promise<{ conectado: boolean; puede: boolean; redirectUri: string }> {
  // Redirect URI real (para mostrarlo y que el dueño lo pegue en Google Cloud).
  const h = await headers();
  const host = h.get('x-forwarded-host') ?? h.get('host') ?? '';
  const proto = h.get('x-forwarded-proto') ?? 'https';
  const redirectUri = googleRedirectUri(host ? `${proto}://${host}` : '');
  const puede = await esDuenoAdmin();
  if (!puede) return { conectado: false, puede: false, redirectUri };
  return { conectado: await googleCalendarConectado(), puede: true, redirectUri };
}

export async function disconnectGoogleCalendarAction(): Promise<void> {
  if (!(await esDuenoAdmin())) throw new Error('Solo un admin del workspace principal puede desconectar la agenda.');
  await desconectarGoogleCalendar();
}
