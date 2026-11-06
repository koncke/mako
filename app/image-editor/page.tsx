// =============================================================================
// /image-editor — el Image Editor (copia de Canva sobre Doory): la portada de la tab son los EJEMPLOS
// =============================================================================
// Martín, 6/11/2026: «La tab de "Encuentra tu siguiente OUTLIER" tiene que ser la principal, no "¿Qué vas a crear hoy?"». Así:
//   · `/image-editor` → los ejemplos para elegir uno y editarlo: carruseles, anuncios y miniaturas de YouTube
//     (./carruseles/ExplorarCarruseles.tsx), a pantalla completa y SIN la tarjeta del chat de MaKo (Martín: «La barra lateral de
//     MaKo no se muestra salvo mientras se edita»). Los filtros van en la URL y se leen acá.
//   · `?ver=crear` → «Crear desde cero»: la pantalla de Create (app/_crear/PantallaCrear.tsx, desde ./ImageEditorCliente.tsx) con
//     el chat de MaKo a la izquierda, sus diseños detrás de la «←» y las plantillas de «Nuevo diseño» (./plantillas-crear.ts).
//   · `?ver=carruseles` (el link de antes, que viajó en avisos y en la API) → redirige a `/image-editor` con sus filtros.
// La page aplica el guard (./acceso.ts: la pregunta de toda tab). Sin onboarding: los ejemplos y las plantillas son el arranque.

import { redirect } from 'next/navigation';
import { getWorkspaceActual, rutaConWs } from '@/lib/workspace';
import { Pagina } from '@/app/_ui';
import { ESTILO_PAGINA_CREAR } from '@/app/_crear/reglas';
import { leerExplorador } from '@/lib/carruseles/explorar-servidor';
import { filtrosDeQuery } from '@/lib/carruseles/explorar';
import { filtrosThumbnailDeQuery } from '@/lib/thumbnails/explorar';
import { leerThumbnails } from '@/lib/thumbnails/servidor';
import { nombreDelNegocio } from '@/lib/carruseles/marca';
import { kitParaUsar } from '@/lib/marca/kits-server';
import { requireEditorImagen } from './acceso';
import { ImageEditorCliente } from './ImageEditorCliente';
import { querySinVer, vistaDeImage } from './ruta';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default async function ImageEditorPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  await requireEditorImagen();
  const q = await searchParams;
  const vista = vistaDeImage(q);
  // El link viejo de los ejemplos: a la portada, con sus filtros (y el `?ws=` de la pestaña).
  if (vista === 'redirigir') {
    const resto = querySinVer(q);
    redirect(await rutaConWs(resto ? `/image-editor?${resto}` : '/image-editor'));
  }
  const ws = await getWorkspaceActual();
  const ejemplos = vista === 'ejemplos';
  const [explorador, thumbnails, negocio, kit] = await Promise.all([
    ejemplos ? leerExplorador() : null, ejemplos ? leerThumbnails() : null, nombreDelNegocio(ws),
    // La marca del negocio (5/11/2026): las miniaturas de los carruseles la muestran como se va a crear.
    kitParaUsar().catch(() => null),
  ]);
  return (
    <Pagina ancho="completo" densidad="compacta" style={ESTILO_PAGINA_CREAR}>
      <ImageEditorCliente vista={ejemplos ? 'carruseles' : 'inicio'} ws={ws} negocio={negocio} kit={kit}
        explorador={explorador && explorador.ok
          ? {
            datos: {
              carruseles: explorador.carruseles, guardados: explorador.guardados.map((g) => g.id), busquedas: explorador.busquedas,
              paso: explorador.paso, frase: explorador.frase, accion: explorador.accion,
              ejemplos: explorador.ejemplos, avisoBiblioteca: explorador.avisoBiblioteca, anuncios: explorador.anuncios,
              thumbnails: thumbnails && thumbnails.ok ? { ok: true, lista: thumbnails.thumbnails, guardados: thumbnails.guardados, sinTablas: thumbnails.sinTablas } : { ok: false },
            },
            filtros: filtrosDeQuery(q),
            filtrosThumbnails: filtrosThumbnailDeQuery(q),
          }
          : explorador ? { error: true } : null} />
    </Pagina>
  );
}
