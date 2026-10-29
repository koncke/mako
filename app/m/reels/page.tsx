// /m/reels — RETIRADA el 29/10/2026 con /reels (ver app/reels/page.tsx): el guion de un reel es una plantilla del Copywriter.
// Va a la ruta de escritorio, que redirige (y el teléfono la vuelve a traducir a la suya).
import { redirect } from 'next/navigation';
import { rutaConWs } from '@/lib/workspace';

export default async function RedirectPage() {
  redirect(await rutaConWs('/reels'));
}
