// =============================================================================
// /m/contexto — «MaKo Context» en el teléfono (17/10/2026). En la URL, /contexto. Sólo el super admin.
// =============================================================================
// Lo que MaKo sabe del negocio y con qué instrucciones piensa. Referencia: los ajustes de un asistente en el celular
// (la página de «Personalización» de la app de ChatGPT, con sus cajas «Memoria» e «Instrucciones»). Una página con una
// caja por cosa, cada fila abre una hoja con el texto para leerlo o cambiarlo. Es ContextoTabs.tsx de la computadora
// destilado: las cuatro pestañas en el mismo orden (Conocimiento · Fases · Prompts · Configuración), por las MISMAS rutas
// (/api/mako/knowledge, /api/mako/fases, /api/mako/prompts). Lo que queda en la computadora es el historial de versiones
// de un prompt y la pestaña Configuración (los prompts de cada pantalla, con sus variables): se abren desde acá.
//
// ⚠️ LA PUERTA ES LA DE ESCRITORIO: `getSesionAdmin()`, antes de leer nada. Cada ruta también la pide.
// =============================================================================

import '../configuraciones/configuraciones.css';
import './contexto.css';
import { redirect } from 'next/navigation';
import { getSesionAdmin } from '@/lib/auth';
import { requireMovil } from '@/lib/movil-guard';
import { HOME_MOVIL } from '@/lib/movil-rutas';
import { rutaConWs } from '@/lib/workspace';
import { PantallaM } from '@/app/m/_ui';
import { ContextoM } from './ContextoM';

export const dynamic = 'force-dynamic';

export default async function ContextoMovil() {
  if (!(await getSesionAdmin())) redirect(await rutaConWs(HOME_MOVIL));
  await requireMovil();
  return (
    <PantallaM>
      <ContextoM leido={Date.now()} />
    </PantallaM>
  );
}
