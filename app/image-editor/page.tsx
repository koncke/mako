// =============================================================================
// /image-editor — el Image Editor (copia de Canva sobre Doory): la portada de la tab, «¿Qué vas a crear hoy?»
// =============================================================================
// La page sólo aplica el guard (./acceso.ts: la pregunta de toda tab). Todo lo demás corre en el navegador: la pantalla
// de Create (app/_crear/PantallaCrear.tsx, desde ./ImageEditorCliente.tsx) con el chat de MaKo a la izquierda, sus
// diseños detrás de la «←» y, en el centro, las plantillas de «Nuevo diseño» (./plantillas-crear.ts).
// Sin onboarding: la plantilla es el arranque (29/10/2026).
//
// `?ver=carruseles` (4/11/2026; rehecha el 6/11/2026): los carruseles (y los anuncios) de ejemplo para elegir uno y editarlo
// (./carruseles/ExplorarCarruseles.tsx), a pantalla completa y SIN la tarjeta del chat de MaKo (Martín: «La barra lateral de
// MaKo no se muestra salvo mientras se edita»). Es una VISTA de la misma tab, no una pestaña. Se lee en el server, con los
// filtros de la URL.

import { getWorkspaceActual } from '@/lib/workspace';
import { Pagina } from '@/app/_ui';
import { ESTILO_PAGINA_CREAR } from '@/app/_crear/reglas';
import { leerExplorador } from '@/lib/carruseles/explorar-servidor';
import { filtrosDeQuery } from '@/lib/carruseles/explorar';
import { nombreDelNegocio } from '@/lib/carruseles/marca';
import { kitParaUsar } from '@/lib/marca/kits-server';
import { puedeEditarBiblioteca } from '@/lib/carruseles/biblioteca-servidor';
import { requireEditorImagen } from './acceso';
import { ImageEditorCliente } from './ImageEditorCliente';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default async function ImageEditorPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  await requireEditorImagen();
  const ws = await getWorkspaceActual();
  const q = await searchParams;
  const carruseles = (Array.isArray(q.ver) ? q.ver[0] : q.ver) === 'carruseles';
  const [explorador, negocio, editaBiblioteca, kit] = await Promise.all([
    carruseles ? leerExplorador() : null, nombreDelNegocio(ws), carruseles ? puedeEditarBiblioteca().catch(() => false) : false,
    // La marca del negocio (5/11/2026): las miniaturas de los carruseles la muestran como se va a crear.
    kitParaUsar().catch(() => null),
  ]);
  return (
    <Pagina ancho="completo" densidad="compacta" style={ESTILO_PAGINA_CREAR}>
      <ImageEditorCliente vista={carruseles ? 'carruseles' : 'inicio'} ws={ws} negocio={negocio} kit={kit}
        explorador={explorador && explorador.ok
          ? {
            datos: {
              carruseles: explorador.carruseles, guardados: explorador.guardados.map((g) => g.id), busquedas: explorador.busquedas,
              paso: explorador.paso, frase: explorador.frase, accion: explorador.accion,
              ejemplos: explorador.ejemplos, avisoBiblioteca: explorador.avisoBiblioteca, puedeEditarBiblioteca: editaBiblioteca,
              anuncios: explorador.anuncios,
            },
            filtros: filtrosDeQuery(q),
          }
          : explorador ? { error: true } : null} />
    </Pagina>
  );
}
