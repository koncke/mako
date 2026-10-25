// =============================================================================
// /configuraciones/prompts — Settings › Prompts: con qué instrucciones piensa MaKo (sólo el super admin)
// =============================================================================
// Lo que eran «Prompts» y «Configuración» de MaKo Context (/contexto), que se fue el 25/10/2026 (Martín, punto 13). Arriba,
// la persona y los modos (PromptsMaKo.tsx); abajo, los prompts de cada pantalla, con sus variables (Configuraciones.tsx,
// el registro de lib/prompt-registry.ts). Es configuración de la PLATAFORMA, como «Método»: la misma puerta
// (`getSesionAdmin`) y la misma regla para aparecer en el índice (`si: 'metodo'`, lib/ajustes-secciones.ts).

import { redirect } from 'next/navigation';
import { getSesionAdmin } from '@/lib/auth';
import { rutaConWs } from '@/lib/workspace';
import { TITULO_NEGOCIO } from '@/lib/ajustes-secciones';
import { gruposDeAjustes } from '@/lib/ajustes-negocio';
import { AjustesPagina, TituloAjustes } from '../../_ui/Ajustes';
import { Configuraciones } from '../Configuraciones';
import { PromptsMaKo } from './PromptsMaKo';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export const metadata = { title: 'Prompts · Settings' };

export default async function PromptsPage() {
  if (!(await getSesionAdmin())) redirect(await rutaConWs('/inicio'));
  return (
    <AjustesPagina lugar={TITULO_NEGOCIO} grupos={await gruposDeAjustes(undefined, 'prompts')} activa="prompts" amplio>
      <TituloAjustes titulo="Prompts" bajada="Con qué instrucciones piensa MaKo, y las de cada pantalla." />
      <PromptsMaKo />
      <Configuraciones embedded />
    </AjustesPagina>
  );
}
