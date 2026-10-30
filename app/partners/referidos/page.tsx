// =============================================================================
// /partners/referidos — la ruta vieja del panel de MaKo Partners: lleva a /partners (25/10/2026)
// =============================================================================
// Martín (25/10): «Revisa que la url es "https://hola-mako.com/partners/referidos" cuando solo basta "partners"». Todo vive
// en /partners (la landing, el alta y el panel). Esta ruta queda por los links ya mandados (los emails de bienvenida y de
// lo ganado, de antes del 25/10), y conserva el cliente que se mira (`?ws=`).
// =============================================================================

import { redirect } from 'next/navigation';
import { rutaConWs } from '@/lib/workspace';
import { RUTA_PARTNERS } from '@/lib/partners-reglas';

export const dynamic = 'force-dynamic';

export default async function ReferidosPage(): Promise<never> {
  redirect(await rutaConWs(RUTA_PARTNERS));
}
