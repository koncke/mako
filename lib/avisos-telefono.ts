// =============================================================================
// avisos-telefono — ¿esta persona recibe los avisos en un teléfono? (medido, nunca recordado)
// =============================================================================
// El paso obligatorio del onboarding y el recordatorio de /general preguntan lo mismo: si hay una fila en `push_suscripciones` de un TELÉFONO de quien está frente al
// teclado. Una computadora no cuenta: los avisos son para cuando no está mirando la pantalla.
//
// ⚠️ NO TRABA A NADIE POR UN ERROR NUESTRO. Sin claves VAPID (el push apagado), sin poder leer la tabla, o mirando a otro (el super admin o una agencia adentro de un cliente: el
// permiso del teléfono es de cada persona), el paso no aplica. Un onboarding trabado cuesta un cliente; un aviso sin activar se recuerda después.
// =============================================================================

import 'server-only';
import { estaImpersonando } from './workspace';
import { usuarioPropio } from './perfil';
import { clavePublicaPush } from './push';
import { getSupabaseServer } from './supabase';
import { esTelefonoDeAvisos } from './avisos-telefono-reglas';

export type AvisosDelTelefono = { aplica: boolean; listos: boolean };

const NO_APLICA: AvisosDelTelefono = { aplica: false, listos: false };

export async function avisosDeQuienEntra(): Promise<AvisosDelTelefono> {
  try {
    if (await estaImpersonando()) return NO_APLICA;
    const u = await usuarioPropio();
    if (!u || !(await clavePublicaPush())) return NO_APLICA;
    const { data, error } = await getSupabaseServer().from('push_suscripciones').select('plataforma').eq('usuario_id', u.id);
    if (error) { console.error(`[avisos-telefono] no pude leer las suscripciones: ${error.message}`); return NO_APLICA; }
    return { aplica: true, listos: ((data ?? []) as Array<{ plataforma: string | null }>).some((f) => esTelefonoDeAvisos(f.plataforma)) };
  } catch (e) {
    console.error(`[avisos-telefono] ${e instanceof Error ? e.message : String(e)}`);
    return NO_APLICA;
  }
}
