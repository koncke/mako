// /carousels — RETIRADA el 29/10/2026 (Martín: «para todas las secciones de "create" no quiero otras tabs… prefiero deprecar
// antes que conservar»). Un carrusel es un DISEÑO de varias páginas: «Carrusel de Instagram» es una plantilla de «Nuevo
// diseño» en Image (app/image-editor/plantillas-crear.ts), y su texto se le pide a MaKo en el mismo chat. Se redirige y no se
// borra (AGENTS.md, «Retirar una RUTA…»): la tab la veían los clientes. El motor que escribía (lib/ig-writer.ts) sigue, lo usa
// la API.
import { redirect } from 'next/navigation';
import { rutaConWs } from '@/lib/workspace';

export default async function RedirectPage() {
  redirect(await rutaConWs('/image-editor'));
}
