'use server';

// Estado / desconexión de la integración de Google Calendar (solo el dueño).

import { headers } from 'next/headers';
import { esDuenoAdmin } from '@/lib/workspace';
import { permisoCalendarioGoogle, desconectarGoogleCalendar, googleRedirectUri } from '@/lib/google-calendar';

export type GoogleCalendarStatus = {
  conectado: boolean;
  /** false = esta sesión no administra la agenda (no es admin del workspace dueño). */
  puede: boolean;
  /**
   * false con `conectado` en true = el token es de los VIEJOS, de solo lectura:
   * la agenda se lee pero "Reagendar" no puede mover nada. Se arregla volviendo
   * a autorizar; por eso la UI ofrece reconectar en vez de decir "conectada" y listo.
   */
  puedeMover: boolean;
  /** De quién es la agenda conectada (un workspace puede tener varias cuentas). */
  email: string | null;
  redirectUri: string;
};

export async function getGoogleCalendarStatusAction(): Promise<GoogleCalendarStatus> {
  // Redirect URI real (para mostrarlo y que el dueño lo pegue en Google Cloud).
  const h = await headers();
  const host = h.get('x-forwarded-host') ?? h.get('host') ?? '';
  const proto = h.get('x-forwarded-proto') ?? 'https';
  const redirectUri = googleRedirectUri(host ? `${proto}://${host}` : '');
  const puede = await esDuenoAdmin();
  if (!puede) return { conectado: false, puede: false, puedeMover: false, email: null, redirectUri };
  const p = await permisoCalendarioGoogle();
  return { conectado: p.conectado, puede: true, puedeMover: p.puedeMover, email: p.email, redirectUri };
}

export async function disconnectGoogleCalendarAction(): Promise<void> {
  if (!(await esDuenoAdmin())) throw new Error('Solo un admin del workspace principal puede desconectar la agenda.');
  await desconectarGoogleCalendar();
}
