// /image-generator — RETIRADA el 29/10/2026 (Martín: «para todas las secciones de "create" no quiero otras tabs… prefiero deprecar antes
// que conservar»). Nunca pasó de «pronto». Redirige a Image por si alguien la guardó en marcadores (AGENTS.md, «Retirar una
// RUTA…»: se redirige, no se borra, si alguien de afuera la puede seguir).
import { redirect } from 'next/navigation';
import { rutaConWs } from '@/lib/workspace';

export default async function RedirectPage() {
  redirect(await rutaConWs('/image-editor'));
}
