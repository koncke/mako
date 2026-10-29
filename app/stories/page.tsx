// =============================================================================
// /stories — DEPRECADA el 29/10/2026: lleva al Copywriter, a los templates de Story
// =============================================================================
// Martín (29/10/2026): Copywriting es UNA pantalla, el Copywriter («quiero que sea una réplica de Notion… NO quiero otras
// tabs internas… ni nada de ONBOARDING»; «lo que no sirve se depreca»). La metodología de Stories (lib/ig-formatos.ts,
// METODOLOGIA_STORY) ya vive en la estructura «story-dia» y en el template «Stories del día» (lib/copywriter/plantillas.ts),
// y MaKo la usa al escribir una página de tipo Story. Sin onboarding: el template es el arranque.
// StoriesApp.tsx, OnboardingStories.tsx y sus acciones quedan sin entrada (docs/relevo, para borrarlas en otra tanda).
// Redirige con un 307 de verdad (no hay loading.tsx en la ruta), como /youtube-writer.
// =============================================================================

import { redirect } from 'next/navigation';
import { requireRolWs } from '@/lib/tab-access';
import { rutaConWs } from '@/lib/workspace';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default async function StoriesPage() {
  await requireRolWs([], { nav: 'stories' });
  redirect(await rutaConWs('/copywriter?nuevo=story'));
}
