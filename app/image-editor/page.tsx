// =============================================================================
// /image-editor — el Image Editor (copia de Canva sobre Doory), sin un diseño en la URL
// =============================================================================
// La page sólo aplica el guard (./acceso.ts: la pregunta de toda tab). Todo lo
// demás corre en el navegador: el motor (Doory portado, fabric.js 7, en `_doory/`)
// y la lista de diseños, que pide /api/image-editor/disenos (la base, mig 0278).
//
// Desde el 27/10/2026 (Martín: «que los "proyectos" se vean en la barra del costado, y que no cambie de ruta») ya no hay
// una página de inicio aparte: monta el MISMO estudio que /image-editor/<id> (editor/Estudio.tsx), que abre el último
// diseño editado o, si no hay ninguno, la vista de crear (el inicio de siempre, inicio/Inicio.tsx, en el lugar del
// editor). Por eso lee también las señales del negocio: el panel de plantillas del diseño que se abra las usa.
//
// Onboarding: la tab ES la herramienta, así que su onboarding es su estado vacío
// («Crear un diseño»), sin entrada en el catálogo (la regla del 05/10, como el
// Video Editor).

import { getWorkspaceActual } from '@/lib/workspace';
import { senalesDelNegocio } from '@/lib/plantillas-sugeridas-server';
import { Pagina } from '@/app/_ui';
import { requireEditorImagen } from './acceso';
import { ImageEditorCliente } from './ImageEditorCliente';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default async function ImageEditorPage() {
  await requireEditorImagen();
  const [ws, senales] = await Promise.all([getWorkspaceActual(), senalesDelNegocio().catch(() => null)]);
  return (
    // Menos la barra de arriba (`--barra-agencia`: la de «Estás viendo el dashboard de…» o la alerta de la voz caída): la regla
    // global sólo corrige un alto que EMPIEZA con `height: 100vh`, y éste es un `calc(` (docs/hallazgos-ui.md, 22/10/2026).
    <Pagina ancho="completo" densidad="compacta" style={{ padding: 0, height: 'calc(100vh - var(--alto-secciones, 0px) - var(--barra-agencia, 0px))', display: 'flex', flexDirection: 'column' }}>
      <ImageEditorCliente ws={ws} senales={senales} />
    </Pagina>
  );
}
