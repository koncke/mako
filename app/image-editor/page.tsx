// =============================================================================
// /image-editor — el Image Editor (copia de Canva sobre Doory): la portada de la tab, «¿Qué vas a crear hoy?»
// =============================================================================
// La page sólo aplica el guard (./acceso.ts: la pregunta de toda tab). Todo lo demás corre en el navegador: la pantalla
// de Create (app/_crear/PantallaCrear.tsx, desde ./ImageEditorCliente.tsx) con el chat de MaKo a la izquierda, sus
// diseños detrás de la «←» y, en el centro, las plantillas de «Nuevo diseño» (./plantillas-crear.ts).
// Sin onboarding: la plantilla es el arranque (29/10/2026).

import { getWorkspaceActual } from '@/lib/workspace';
import { Pagina } from '@/app/_ui';
import { ESTILO_PAGINA_CREAR } from '@/app/_crear/reglas';
import { requireEditorImagen } from './acceso';
import { ImageEditorCliente } from './ImageEditorCliente';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default async function ImageEditorPage() {
  await requireEditorImagen();
  const ws = await getWorkspaceActual();
  return (
    <Pagina ancho="completo" densidad="compacta" style={ESTILO_PAGINA_CREAR}>
      <ImageEditorCliente vista="inicio" ws={ws} />
    </Pagina>
  );
}
