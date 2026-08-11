// =============================================================================
// clonar-config — replicar la CONFIGURACIÓN del dueño en un workspace de prueba
// =============================================================================
// Para probar una tab de punta a punta sin tocar nada de la cuenta real: el
// workspace de prueba arranca con el mismo contexto de negocio (brief, funnel,
// avatares, fase, secuencias) en vez de tener que rehacer el onboarding entero.
//
// LO QUE NUNCA SE COPIA — y por qué, que es lo importante:
//   · Teléfono, email y grupos de WhatsApp del dueño. Si se copiaran, las
//     PRUEBAS del onboarding (el código de verificación, los mensajes de test)
//     le llegarían a él. Es justo lo que se quiere evitar.
//   · Credenciales y tokens (Google, Meta, Resend, landing_token): para eso ya
//     está la action 'simular', que es explícita y por servicio.
//   · Flags de envío real: el workspace de prueba arranca SIEMPRE apagado.
//   · Datos operativos (leads, envíos, mensajes, cachés, snapshots del plan):
//     no son configuración y ensuciarían las métricas del workspace.
//
// Todo lo que sí se copia es contexto de negocio, que es lo que hace que probar
// tenga sentido.

import 'server-only';
import { getSupabaseServer } from './supabase';
import { OWNER_WS } from './auth-session';

/** Settings de contexto que se replican tal cual. */
const KEYS_COPIABLES = [
  // El negocio
  'mako.onboarding.answers', 'mako.archivero.manual', 'mako.archivero.panorama',
  'negocio.fase.diagnostico', 'onboarding.funnel_tipos',
  // La fábrica de creativos / contexto de IA. El entregable importa especialmente:
  // las secuencias de mensajes de setting cuelgan su lead magnet de ahí (estrategia.lead_magnet_id).
  'mako.avatares', 'mako.avatares.contexto', 'mako.razones', 'mako.voz_guia',
  'mako.entregable', 'mako.persona', 'mako.personalidad', 'mako.formatos_recom',
  // Clasificación de guiones (Scripts Analyst)
  'script_avatares', 'script_angles',
  // Prompts customizados desde /configuraciones (si no existen, el default de código aplica)
  'mako.prompts', 'mako.prompt-overrides',
  // El norte por área
  'mako.fase.general', 'mako.fase.comercial', 'mako.fase.marketing', 'mako.fase.crm', 'mako.fase.closing',
  // Objetivos del tablero (la FECHA no: ver abajo)
  'objetivo_cash_usd', 'objetivo_cierres',
  // Plantillas de avisos (catálogo, no envíos) + huso horario
  'mako.plantillas.store', 'mako.timezone',
] as const;

/** Tablas de CONFIGURACIÓN que se clonan (no datos operativos). */
type TablaClon = {
  tabla: string;
  cols: string[];
  forzar?: Record<string, unknown>;
  /** Columna que hace de clave natural para no duplicar. Default: 'clave'. */
  clave?: string;
};
const TABLAS: TablaClon[] = [
  { tabla: 'funnel_config', cols: ['data'] },
  // Las secuencias llegan SIEMPRE pausadas: un workspace de prueba nunca debe
  // empezar a mandar solo, ni siquiera si en el origen estaban activas.
  { tabla: 'nutricion_secuencias', cols: ['clave', 'nombre', 'etapa', 'trigger_tipo', 'pasos', 'estrategia'], forzar: { activa: false } },
  // El catálogo comercial es contexto de negocio del mismo tipo que el brief: sin
  // él, el workspace de prueba no puede recorrer el cierre de un deal. Su clave
  // natural es el NOMBRE (no tiene columna 'clave').
  {
    tabla: 'productos',
    cols: ['nombre', 'tipo', 'monto_usd', 'suscripcion_meses', 'promesa', 'incluye', 'garantia', 'descripcion', 'activo', 'orden'],
    clave: 'nombre',
  },
];

export type ResultadoClon = { settings: number; tablas: Record<string, number>; avisos: string[] };

/**
 * Copia la configuración del dueño al workspace `destino`. Idempotente por
 * naturaleza: los settings se upsertean y las filas de tabla se saltean si el
 * destino ya tiene una con la misma clave natural.
 */
export async function clonarConfigDelDueno(destino: number): Promise<ResultadoClon> {
  if (destino === OWNER_WS) throw new Error('El workspace de destino no puede ser el del dueño.');
  const sb = getSupabaseServer();
  const avisos: string[] = [];

  // ── Settings ──
  const { data: origen } = await sb
    .from('app_settings')
    .select('key, value')
    .eq('workspace_id', OWNER_WS)
    .in('key', KEYS_COPIABLES as unknown as string[]);
  const filas = ((origen ?? []) as Array<{ key: string; value: string }>)
    .filter((r) => (r.value ?? '').trim().length > 0)
    .map((r) => ({ workspace_id: destino, key: r.key, value: r.value }));
  // `objetivo_desde` NO se copia: es la fecha desde la que se cuentan los
  // objetivos. Con la del dueño, el workspace de prueba compararía contra meses
  // de historia que no tiene y todos los tableros arrancarían en rojo. Se
  // siembra HOY, igual que al dar de alta un workspace nuevo.
  filas.push({ workspace_id: destino, key: 'objetivo_desde', value: new Date().toISOString().slice(0, 10) });

  if (filas.length) {
    const { error } = await sb.from('app_settings').upsert(filas, { onConflict: 'workspace_id,key' });
    if (error) throw new Error(`clonar settings: ${error.message}`);
  }

  // ── Tablas de configuración ──
  const tablas: Record<string, number> = {};
  for (const t of TABLAS) {
    try {
      const { data: src } = await sb.from(t.tabla).select(t.cols.join(', ')).eq('workspace_id', OWNER_WS);
      const origenFilas = (src ?? []) as unknown as Array<Record<string, unknown>>;
      if (!origenFilas.length) { tablas[t.tabla] = 0; continue; }

      if (t.tabla === 'funnel_config') {
        // Singleton por workspace: id = workspace_id (mig 0054).
        // ⚠️ Se copia la FORMA del embudo, nunca los HECHOS del dueño. `entradas` y
        // `evento` dicen cómo entra la gente a ESE negocio y dónde queda su taller:
        // clonarlos hace que un workspace nuevo nazca afirmando que sus leads
        // llegan de un formulario de anuncio que no existe, y de ahí sale un audio
        // que se lo dice a un desconocido. Un dato declarado no se hereda.
        const origen = origenFilas[0]?.data;
        const data = origen && typeof origen === 'object' ? { ...(origen as Record<string, unknown>) } : origen;
        if (data && typeof data === 'object') {
          delete (data as Record<string, unknown>).entradas;
          delete (data as Record<string, unknown>).evento;
        }
        const { error } = await sb.from('funnel_config')
          .upsert({ id: destino, workspace_id: destino, data, updated_at: new Date().toISOString() }, { onConflict: 'workspace_id' });
        if (error) { avisos.push(`funnel_config: ${error.message}`); tablas[t.tabla] = 0; continue; }
        tablas[t.tabla] = 1;
        continue;
      }

      // Resto: insertar las que falten, comparando por la clave natural de la tabla.
      const clave = t.clave ?? 'clave';
      const { data: yaHay } = await sb.from(t.tabla).select(clave).eq('workspace_id', destino);
      const existentes = new Set(((yaHay ?? []) as unknown as Array<Record<string, unknown>>).map((r) => String(r[clave])));
      const nuevas = origenFilas
        .filter((r) => !existentes.has(String(r[clave])))
        .map((r) => ({ ...r, ...(t.forzar ?? {}), workspace_id: destino }));
      if (!nuevas.length) { tablas[t.tabla] = 0; continue; }
      const { error } = await sb.from(t.tabla).insert(nuevas);
      if (error) { avisos.push(`${t.tabla}: ${error.message}`); tablas[t.tabla] = 0; continue; }
      tablas[t.tabla] = nuevas.length;
    } catch (e) {
      avisos.push(`${t.tabla}: ${e instanceof Error ? e.message : String(e)}`);
      tablas[t.tabla] = 0;
    }
  }

  avisos.push('No se copiaron el teléfono, el email ni los grupos de WhatsApp del dueño: las pruebas tienen que llegarte a VOS, no a él.');
  return { settings: filas.length, tablas, avisos };
}
