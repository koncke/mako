// =============================================================================
// /agencia — la página vieja del canal de MaKo: REDIRIGE A CHATS (19/11/2026)
// =============================================================================
// Martín, al tocar «volver a conectar» desde el aviso de la voz caída: «esta página viejísima que ya no debería ni existir…
// tenemos toda la interfaz de chats y ahí yo debería poder administrar todo». El panel de la línea (`CanalMaKoPanel`) ya vive en
// Chats, en un modal: `?canal=1` (el link de los avisos viejos y de los mails ya mandados) abre ese panel, y lo demás cae en Chats.
// Los avisos nuevos ya llevan directo a Chats (lib/chats-links.ts, `RUTA_LINEA_MAKO`).

import { redirect } from 'next/navigation';
import { getSesionAdmin } from '@/lib/auth';
import { rutaConWs } from '@/lib/workspace';
import { RUTA_CHATS, RUTA_LINEA_MAKO } from '@/lib/chats-links';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default async function AgenciaPage({ searchParams }: { searchParams: Promise<{ tab?: string; canal?: string }> }) {
  if (!(await getSesionAdmin())) redirect('/login');
  // Las plantillas se mudaron a /mensajes, y «MaKo Messages» salió el 26/10/2026 (app/_components/nav.ts): los links
  // guardados de `?tab=plantillas` caen en Automations.
  const { tab, canal } = await searchParams;
  if (tab === 'plantillas') redirect(await rutaConWs('/automations'));
  redirect(canal ? RUTA_LINEA_MAKO : RUTA_CHATS);
}
