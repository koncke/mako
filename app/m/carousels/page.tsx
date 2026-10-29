// /m/carousels — RETIRADA el 29/10/2026 con /carousels (ver app/carousels/page.tsx): un carrusel es una plantilla de Image.
import { redirect } from 'next/navigation';
import { rutaConWs } from '@/lib/workspace';

export default async function RedirectPage() {
  redirect(await rutaConWs('/m/image-editor'));
}
