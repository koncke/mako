// =============================================================================
// reiniciarOnboarding(ws): el onboarding y el reto de un negocio, de cero, sin tocar lo suyo (20/11/2026)
// =============================================================================
// Qué se reinicia y qué queda lo dice lib/reiniciar-onboarding.ts (puro, con su test). Acá se lee, se planea y, con `aplicar`, se
// escribe. Lo usan el botón «Reiniciar onboarding» de la vista de administrador (/api/admin/reiniciar-onboarding) y
// scripts/reiniciar-onboarding.mts. Sin `aplicar` no escribe nada: dice qué cambiaría.
//
// ⚠️ Sólo `app_settings` (las claves de la lista) y `usuarios.perfil` del dueño. Nada más se lee ni se escribe (lo mira el test).
// ⚠️ Cada escritura es un compare-and-set sobre `updated_at`: si algo cambió entre la lectura y la escritura, no se pisa y se avisa.
//    Por `updated_at` y no por el valor: el arranque y el historial pueden ser largos, y el valor entero no entra en la URL del pedido.
// ⚠️ Nunca en el negocio del dueño (OWNER_WS: no tiene onboarding) ni en el cliente de una agencia: su primer mes se cobra desde que
//    terminó el onboarding (lib/agencia-cobro.ts), y reiniciarlo le correría el cobro.
// =============================================================================
import 'server-only';
import { getSupabaseServer } from './supabase';
import { OWNER_WS } from './auth-session';
import { agenciasAprobadasDe } from './agencia';
import { emailDelDuenoDelWs } from './dueno-del-ws';
import { SETTINGS_QUE_MIRA, LO_QUE_QUEDA, perfilReiniciado, planDeSettings, type CambioSetting } from './reiniciar-onboarding';

export type ResultadoReinicio = {
  aplicado: boolean;
  /** Las claves del negocio que cambian (o cambiarían), con qué les pasa. */
  cambios: Array<{ key: string; nota: string }>;
  /** El perfil del dueño: de quién y qué se le quita. */
  perfil: { email: string; quitados: string[] } | null;
  /** Lo que no se tocó, dicho en palabras para quien lo corre. */
  queda: string[];
  avisos: string[];
};

/** Lo de antes, para un respaldo (el script lo guarda en un archivo; la ruta no lo devuelve). */
export type RespaldoReinicio = { ws: number; settings: Array<{ key: string; value: string; updated_at: string | null }>; perfil: { email: string; perfil: unknown } | null };

const texto = (v: unknown): string => (typeof v === 'string' ? v : JSON.stringify(v ?? null));

export async function reiniciarOnboarding(ws: number, o: { aplicar: boolean }): Promise<{ resultado: ResultadoReinicio; respaldo: RespaldoReinicio }> {
  if (!Number.isSafeInteger(ws) || ws <= 0) throw new Error(`ws inválido: ${ws}`);
  if (ws === OWNER_WS) throw new Error('El negocio del dueño no tiene onboarding.');
  if ((await agenciasAprobadasDe(ws)).length > 0) {
    throw new Error('Es cliente de una agencia: su primer mes corre desde que terminó el onboarding, y reiniciarlo le movería el cobro.');
  }
  const db = getSupabaseServer();
  const avisos: string[] = [];

  // ── Lo del negocio ──
  const { data, error } = await db.from('app_settings').select('key, value, updated_at').eq('workspace_id', ws).in('key', [...SETTINGS_QUE_MIRA]);
  if (error) throw new Error(`No pude leer el estado del onboarding: ${error.message}`);
  const filas = ((data ?? []) as Array<{ key: string; value: unknown; updated_at: string | null }>).map((f) => ({ key: f.key, value: texto(f.value), updated_at: f.updated_at }));
  const cambios: CambioSetting[] = planDeSettings(filas);

  // ── Lo del dueño (lo que se ve por persona: la marca del V2, los tutoriales vistos) ──
  const email = await emailDelDuenoDelWs(ws);
  type FilaDelDueno = { id: number; perfil: unknown; updated_at: string | null };
  let fila: FilaDelDueno | null = null;
  if (!email) avisos.push('No encontré al dueño del negocio: su perfil (los tutoriales vistos) quedó como estaba.');
  else {
    const r = await db.from('usuarios').select('id, perfil, updated_at').eq('email', email).eq('workspace_id', ws).maybeSingle();
    if (r.error) throw new Error(`No pude leer el perfil del dueño: ${r.error.message}`);
    fila = (r.data as FilaDelDueno | null) ?? null; // `typeof fila` acá sería `null`: el typeof de tipos mira el estrechamiento
    if (!fila) avisos.push(`No encontré la fila de ${email} en este negocio: su perfil quedó como estaba.`);
  }
  const ahora = new Date().toISOString();
  const perfil = fila ? perfilReiniciado(fila.perfil, ahora) : null;

  const respaldo: RespaldoReinicio = { ws, settings: filas, perfil: fila ? { email, perfil: fila.perfil } : null };
  const resultado: ResultadoReinicio = {
    aplicado: false,
    cambios: cambios.map((c) => ({ key: c.key, nota: c.nota })),
    perfil: perfil ? { email, quitados: perfil.quitados } : null,
    queda: [
      'Los datos: leads y CRM, cursos, automatizaciones, guiones, funnels, ofertas, conversaciones, archivos, el Plan, el plan y los cobros.',
      `El WhatsApp verificado (${LO_QUE_QUEDA.settings.slice(0, 2).join(', ')}): MaKo la sigue reconociendo, y el paso del WhatsApp vuelve con ese número escrito.`,
      'Lo que el onboarding dejó como dato: el plan del Funnel Coach, la conversación del Offer Coach, el canal, la encuesta, los onboardings de cada pestaña y el clip de regalo.',
    ],
    avisos,
  };
  if (!o.aplicar) return { resultado, respaldo };

  // ── Escribir: cada clave con compare-and-set sobre su `updated_at` ──
  const porKey = new Map(filas.map((f) => [f.key, f]));
  for (const c of cambios) {
    const antes = porKey.get(c.key)?.updated_at ?? null;
    let r: { error: { message: string } | null; data: unknown[] | null };
    if (c.despues == null) {
      let q = db.from('app_settings').delete().eq('workspace_id', ws).eq('key', c.key);
      q = antes == null ? q.is('updated_at', null) : q.eq('updated_at', antes);
      r = await q.select('key');
    } else {
      let q = db.from('app_settings').update({ value: c.despues, updated_at: ahora }).eq('workspace_id', ws).eq('key', c.key);
      q = antes == null ? q.is('updated_at', null) : q.eq('updated_at', antes);
      r = await q.select('key');
    }
    if (r.error) throw new Error(`No pude reiniciar ${c.key}: ${r.error.message}`);
    if (!r.data?.length) avisos.push(`${c.key} cambió mientras se reiniciaba (la persona estaba usando MaKo): quedó como estaba. Vuelve a reiniciar.`);
  }
  if (fila && perfil) {
    let q = db.from('usuarios').update({ perfil: perfil.perfil, updated_at: ahora }).eq('id', fila.id);
    q = fila.updated_at == null ? q.is('updated_at', null) : q.eq('updated_at', fila.updated_at);
    const r = await q.select('id');
    if (r.error) throw new Error(`No pude reiniciar el perfil de ${email}: ${r.error.message}`);
    if (!r.data?.length) avisos.push(`El perfil de ${email} cambió mientras se reiniciaba: sus tutoriales quedaron como estaban. Vuelve a reiniciar.`);
  }
  return { resultado: { ...resultado, aplicado: true, avisos }, respaldo };
}
