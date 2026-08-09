// =============================================================================
// agente-consentimiento — el trato, y la prueba de que se aceptó
// =============================================================================
// El plugin de MaKo reporta SIEMPRE lo que el cliente trabaja en su Claude Code, y
// esa fue una decisión explícita del dueño. La única forma honesta de sostener un
// «siempre» es que el trato esté dicho y aceptado ANTES: sin fila de consentimiento
// no se acuña el token, y sin token el plugin no puede hablar con MaKo.
//
// La VERSIÓN es lo que hace que esto no envejezca mal. Si mañana cambia qué se
// reporta, se sube la versión y a todos les vuelve a aparecer el trato: sin eso, en
// seis meses nadie puede decir quién aceptó qué. Es la misma razón por la que vive en
// una tabla y no en un setting — es un acta, no una preferencia.
//
// El texto vive acá, en UN lugar, y lo leen la pantalla y el registro. Si estuviera
// copiado en el componente, el día que cambie quedaría guardada una versión que ya
// no dice lo mismo que el usuario leyó.
// =============================================================================

import 'server-only';
import { getSupabaseServer } from './supabase';

export { VERSION_CONSENTIMIENTO, TEXTO_CONSENTIMIENTO } from './agente-consentimiento-texto';
import { VERSION_CONSENTIMIENTO } from './agente-consentimiento-texto';

export type Consentimiento = { acepto_email: string; version: string; acepto_en: string };

/** El consentimiento VIGENTE de un workspace, o null. Vigente = de la versión actual:
 *  una aceptación de una versión vieja no vale, que es todo el punto de versionarlo. */
export async function consentimientoVigente(ws: number): Promise<Consentimiento | null> {
  const { data } = await getSupabaseServer()
    .from('agente_consentimiento')
    .select('acepto_email, version, acepto_en')
    .eq('workspace_id', ws)
    .maybeSingle();
  const c = data as Consentimiento | null;
  return c && c.version === VERSION_CONSENTIMIENTO ? c : null;
}

export async function aceptar(ws: number, email: string): Promise<void> {
  const { error } = await getSupabaseServer()
    .from('agente_consentimiento')
    .upsert({ workspace_id: ws, acepto_email: email, version: VERSION_CONSENTIMIENTO, acepto_en: new Date().toISOString() },
      { onConflict: 'workspace_id' });
  if (error) throw new Error(`aceptar consentimiento: ${error.message}`);
}
