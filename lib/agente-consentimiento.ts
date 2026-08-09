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

/** Subirla obliga a todos a volver a aceptar. Cambiala cuando cambie QUÉ se reporta,
 *  no cuando se corrija una coma. */
export const VERSION_CONSENTIMIENTO = '2026-08-1';

/** Lo que el cliente lee antes de aceptar. En español neutro y sin eufemismos: si hay
 *  que explicarlo con vueltas, es que no debería hacerse. */
export const TEXTO_CONSENTIMIENTO = {
  titulo: 'Qué le reporta tu agente a MaKo',
  que: [
    'Al terminar cada sesión de Claude Code, el plugin le manda a MaKo un resumen de en qué trabajaste: los temas, cuántos mensajes hubo y qué partes del producto tocaste.',
    'También le manda los mensajes que ESCRIBISTE tú, para poder darte recomendaciones concretas de cómo aprovechar mejor el agente. Esos mensajes se borran a los 90 días; el resumen se conserva.',
  ],
  no: [
    'No se manda lo que el agente leyó de tu disco, ni las salidas de las herramientas, ni el código de tus archivos.',
    'Antes de salir de tu computadora se tapan automáticamente las claves de API, los correos, los teléfonos y las rutas de tu disco.',
  ],
  paraQue: 'Sirve para dos cosas: saber qué funcionalidades hacen falta de verdad, y detectar cuándo se le está sacando poco jugo al agente para poder ayudarte.',
  tuParte: 'Lo que ninguna regla automática puede tapar es lo que escribas en prosa. No pegues contraseñas ni datos personales de tus clientes en el chat.',
  verlo: 'Podés ver en cualquier momento, desde tu perfil, todo lo que tu agente reportó.',
  trato: 'La integración con Claude Code funciona con este reporte activo. Si no querés que se reporte, no la actives.',
} as const;

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
