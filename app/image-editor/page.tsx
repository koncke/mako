// =============================================================================
// /image-editor — el Image Editor (copia de Canva sobre Doory): la portada de la tab, «¿Qué vas a crear hoy?»
// =============================================================================
// La page sólo aplica el guard (./acceso.ts: la pregunta de toda tab). Todo lo demás corre en el navegador: la pantalla
// de Create (app/_crear/PantallaCrear.tsx, desde ./ImageEditorCliente.tsx) con el chat de MaKo a la izquierda, sus
// diseños detrás de la «←» y, en el centro, las plantillas de «Nuevo diseño» (./plantillas-crear.ts).
// Sin onboarding: la plantilla es el arranque (29/10/2026).
//
// `?ver=carruseles` (4/11/2026): en el centro, «Carruseles que funcionan» (./carruseles/ExplorarCarruseles.tsx), las
// publicaciones de las cuentas que el negocio sigue en Competitors Spy. Es una VISTA de la misma pantalla, no una pestaña
// (Create no tiene pestañas arriba). Se lee en el server, con los filtros de la URL.

import { getWorkspaceActual } from '@/lib/workspace';
import { Pagina } from '@/app/_ui';
import { ESTILO_PAGINA_CREAR } from '@/app/_crear/reglas';
import { leerExplorador } from '@/lib/carruseles/explorar-servidor';
import { filtrosDeQuery } from '@/lib/carruseles/explorar';
import { requireEditorImagen } from './acceso';
import { ImageEditorCliente } from './ImageEditorCliente';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default async function ImageEditorPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  await requireEditorImagen();
  const ws = await getWorkspaceActual();
  const q = await searchParams;
  const carruseles = (Array.isArray(q.ver) ? q.ver[0] : q.ver) === 'carruseles';
  const explorador = carruseles ? await leerExplorador() : null;
  return (
    <Pagina ancho="completo" densidad="compacta" style={ESTILO_PAGINA_CREAR}>
      <ImageEditorCliente vista={carruseles ? 'carruseles' : 'inicio'} ws={ws}
        explorador={explorador && explorador.ok
          ? { datos: { carruseles: explorador.carruseles, guardados: explorador.guardados.map((g) => g.id), busquedas: explorador.busquedas, paso: explorador.paso, frase: explorador.frase, accion: explorador.accion }, filtros: filtrosDeQuery(q) }
          : explorador ? { error: true } : null} />
    </Pagina>
  );
}
