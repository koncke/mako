// /reels — RETIRADA el 29/10/2026. Martín, textual: «en editor, hay una tab de "Reels" que literalmente es de guiones, no
// tiene sentido alguno que esté en "editor"... En todo caso estará en "Copywriting" pero no como tab, sino como template».
// El guion de un reel es una PLANTILLA del Copywriter (`?nuevo=reel`, app/copywriter). Se redirige y no se borra
// (AGENTS.md, «Retirar una RUTA…»): alguien la pudo guardar. El motor que escribía (lib/ig-writer.ts) sigue, lo usa la API.
import { redirect } from 'next/navigation';
import { rutaConWs } from '@/lib/workspace';

export default async function RedirectPage() {
  redirect(await rutaConWs('/copywriter?nuevo=reel'));
}
