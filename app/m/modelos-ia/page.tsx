// =============================================================================
// /m/modelos-ia — «AI Models» en el teléfono (17/10/2026). En la URL, /modelos-ia. Sólo el super admin.
// =============================================================================
// Qué modelo usa cada tarea de IA de MaKo, y cambiarlo. Referencia: las listas de elección de Ajustes de iOS (Siri ›
// Voz, Teclado › Idiomas). Cada tarea es una fila con su valor actual en gris, y al tocarla se abre la lista de opciones
// con un tilde en la elegida. Es ModelosIA.tsx de la computadora destilado: las mismas tareas agrupadas igual, las
// MISMAS opciones (app/modelos-ia/opciones.ts) y la MISMA ruta (/api/admin/modelos, que re-rutea las llamadas de verdad).
//
// ⚠️ LA PUERTA ES LA DE ESCRITORIO: `getSesionAdmin()`, antes de leer nada. La ruta también la pide.
// =============================================================================

import './modelos-ia.css';
import { redirect } from 'next/navigation';
import { getSesionAdmin } from '@/lib/auth';
import { requireMovil } from '@/lib/movil-guard';
import { HOME_MOVIL } from '@/lib/movil-rutas';
import { rutaConWs } from '@/lib/workspace';
import { getModelosConfig } from '@/lib/model-registry';
import { PantallaM } from '@/app/m/_ui';
import { ModelosIAM } from './ModelosIAM';

export const dynamic = 'force-dynamic';

export default async function ModelosIAMovil() {
  if (!(await getSesionAdmin())) redirect(await rutaConWs(HOME_MOVIL));
  await requireMovil();
  // La MISMA lectura que GET /api/admin/modelos.
  const iniciales = await getModelosConfig().catch(() => null);
  return (
    <PantallaM>
      <ModelosIAM key={Date.now()} iniciales={iniciales} />
    </PantallaM>
  );
}
