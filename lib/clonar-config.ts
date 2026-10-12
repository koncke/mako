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
import { claveNombre, traducirEtiquetasEnSecuencia } from './etiquetas-reglas';
import { pasosParaElDestino } from './clonar-pasos';

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
  // Plantillas de avisos (catálogo, no envíos). La zona horaria NO (undécima tanda): la del dueño no es la
  // del cliente; la del cliente se detecta de la ubicación de SUS usuarios (lib/timezone.ts, fijarZonaDelNegocio).
  'mako.plantillas.store',
] as const;

/** Lo que una tabla ya copiada le deja a las que vienen después (hoy: el mapa de etiquetas). */
type CtxClon = {
  /** id de una etiqueta del dueño → id de la del destino (por nombre). null = no se pudo armar. */
  etiquetas: Map<number, number> | null;
  avisos: string[];
};

/** Tablas de CONFIGURACIÓN que se clonan (no datos operativos). */
type TablaClon = {
  tabla: string;
  cols: string[];
  forzar?: Record<string, unknown>;
  /** Columna que hace de clave natural para no duplicar. Default: 'clave'. */
  clave?: string;
  /** Cómo se compara la clave (default: el texto tal cual). */
  normalizarClave?: (v: string) => string;
  /** Arma la fila a insertar desde la del origen; `null` = no se copia. Default: tal cual. */
  preparar?: (r: Record<string, unknown>, ctx: CtxClon) => Record<string, unknown> | null;
};

/**
 * Los pasos de una secuencia del dueño, listos para OTRO workspace (revisión del 08/10/2026,
 * datos-6). Viajaban tal cual, con ids que en el destino no significan nada o significan otra cosa:
 *   · las ETIQUETAS (condiciones, pasos ⚡ y el disparador) se traducen con el mapa por nombre de
 *     las que se acaban de copiar; lo que no está en el mapa queda vacío (`traducirEtiquetasEnSecuencia`);
 *   · `audio_id` y `media_id` (también adentro de las partes de un mensaje) apuntan a la biblioteca
 *     del DUEÑO, que este clon no copia, y `linea` (el número por mensaje) es una línea del dueño: no
 *     viajan (`pasosParaElDestino`, lib/clonar-pasos.ts, con el porqué de cada uno). La columna
 *     `instance_name` tampoco se copia: el mensaje sale por la línea de la automatización del destino.
 */
function secuenciaParaElDestino(r: Record<string, unknown>, ctx: CtxClon): Record<string, unknown> {
  const mapa = ctx.etiquetas;
  const t = traducirEtiquetasEnSecuencia(r.pasos, r.etiqueta_id, (id) => mapa?.get(id) ?? null);
  if (t.sinTraducir) ctx.avisos.push(`«${String(r.nombre ?? r.clave)}»: ${t.sinTraducir} ${t.sinTraducir === 1 ? 'etiqueta quedó' : 'etiquetas quedaron'} sin elegir (no hay una igual en este cliente).`);
  // Los adjuntos y las líneas del dueño no viajan (`pasosParaElDestino`, lib/clonar-pasos.ts: puro, con test).
  const { pasos, adjuntos: anulados, lineas: sinLinea } = pasosParaElDestino(t.pasos);
  if (anulados) ctx.avisos.push(`«${String(r.nombre ?? r.clave)}»: ${anulados} ${anulados === 1 ? 'audio o archivo quedó' : 'audios o archivos quedaron'} sin adjuntar (son de la biblioteca del dueño).`);
  if (sinLinea) ctx.avisos.push(`«${String(r.nombre ?? r.clave)}»: ${sinLinea} ${sinLinea === 1 ? 'mensaje vuelve' : 'mensajes vuelven'} a la línea de la automatización.`);
  return { ...r, pasos, etiqueta_id: t.etiquetaId };
}

const TABLAS: TablaClon[] = [
  // El funnel del dueño: su FORMA, no sus hechos. Se clona sobre el funnel default
  // que el destino ya tiene (mig 0170), nunca insertando una fila nueva — un segundo
  // `es_default` lo rechaza el índice `funnels_ws_default_uk`, que es el guard de que
  // un ws tiene exactamente uno.
  { tabla: 'funnels', cols: ['data', 'es_default'] },
  // El catálogo comercial es contexto de negocio del mismo tipo que el brief: sin
  // él, el workspace de prueba no puede recorrer el cierre de un deal. Su clave
  // natural es el NOMBRE (no tiene columna 'clave').
  {
    tabla: 'productos',
    cols: ['nombre', 'tipo', 'monto_usd', 'suscripcion_meses', 'promesa', 'incluye', 'garantia', 'descripcion', 'activo', 'orden'],
    clave: 'nombre',
  },
  // El CATÁLOGO de etiquetas del CRM (mig 0224): sus nombres y colores son contexto del negocio
  // igual que los productos — las automatizaciones y las condiciones las nombran. Lo que NO viaja:
  //   · qué lead tiene cuál (`crm_lead_etiquetas`): es un dato operativo, no configuración;
  //   · las ARCHIVADAS: no se ofrecen en ningún lado;
  //   · el vínculo a una etapa de OTRO producto (`funnel_id` es un id del dueño, que en el destino
  //     es otro embudo o ninguno). El de la etapa del producto del NEGOCIO (`funnel_id` NULL) sí:
  //     el embudo default del destino se clona con la misma forma (arriba);
  //   · el mapeo a WhatsApp y a Chatwoot: son las integraciones del dueño, y el destino arranca
  //     sin ninguna (ver la cabecera: las pruebas no pueden etiquetar el celular de él).
  //
  // ⚠️ VA ANTES QUE LAS SECUENCIAS, a propósito (revisión del 08/10/2026, datos-6): de esta copia
  // sale el mapa con el que se traducen las etiquetas que las secuencias nombran. Al revés, las
  // secuencias llegaban con los ids del dueño y en el destino no se cumplía ninguna condición.
  {
    tabla: 'crm_etiquetas',
    cols: ['nombre', 'color', 'emoji', 'orden', 'funnel_id', 'etapa_key', 'archivada_at'],
    clave: 'nombre',
    normalizarClave: claveNombre,
    preparar: (r) => r.archivada_at ? null : {
      nombre: r.nombre, color: r.color, emoji: r.emoji ?? null, orden: r.orden ?? 0,
      funnel_id: null, etapa_key: r.funnel_id == null ? (r.etapa_key ?? null) : null,
    },
  },
  // Las secuencias llegan SIEMPRE pausadas: un workspace de prueba nunca debe
  // empezar a mandar solo, ni siquiera si en el origen estaban activas. Con sus
  // etiquetas traducidas y sin los adjuntos del dueño (`secuenciaParaElDestino`).
  {
    tabla: 'nutricion_secuencias',
    cols: ['clave', 'nombre', 'etapa', 'trigger_tipo', 'etiqueta_id', 'pasos', 'estrategia'],
    forzar: { activa: false },
    preparar: secuenciaParaElDestino,
  },
];

/**
 * El mapa id del dueño → id del destino de las etiquetas VIVAS, por nombre (la misma clave que el
 * índice único de la mig 0224). Se arma DESPUÉS de copiar el catálogo, así incluye las que el
 * destino ya tenía con el mismo nombre. null = no se pudo leer (las secuencias quedan sin
 * etiquetas, y se avisa).
 */
async function mapaDeEtiquetas(sb: ReturnType<typeof getSupabaseServer>, destino: number, avisos: string[]): Promise<Map<number, number> | null> {
  const leer = (ws: number) => sb.from('crm_etiquetas').select('id, nombre').eq('workspace_id', ws).is('archivada_at', null);
  const [o, d] = await Promise.all([leer(OWNER_WS), leer(destino)]);
  if (o.error || d.error) {
    avisos.push(`crm_etiquetas: no pude armar el mapa para traducir las secuencias (${(o.error ?? d.error)!.message}).`);
    return null;
  }
  const delDestino = new Map(((d.data ?? []) as Array<{ id: number; nombre: string }>).map((e) => [claveNombre(e.nombre), Number(e.id)]));
  const out = new Map<number, number>();
  for (const e of (o.data ?? []) as Array<{ id: number; nombre: string }>) {
    const nuevo = delDestino.get(claveNombre(e.nombre));
    if (nuevo != null) out.set(Number(e.id), nuevo);
  }
  return out;
}

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
  const ctx: CtxClon = { etiquetas: null, avisos };
  for (const t of TABLAS) {
    try {
      // Las secuencias se traducen con el mapa de las etiquetas, que se arma recién ahora:
      // después de copiar el catálogo (va antes en TABLAS), con lo que el destino ya tenía.
      if (t.tabla === 'nutricion_secuencias') ctx.etiquetas = await mapaDeEtiquetas(sb, destino, avisos);
      const { data: src, error: eSrc } = await sb.from(t.tabla).select(t.cols.join(', ')).eq('workspace_id', OWNER_WS);
      // «No pude leer» no es «no hay»: se dice, en vez de contar 0 copiadas.
      if (eSrc) { avisos.push(`${t.tabla}: ${eSrc.message}`); tablas[t.tabla] = 0; continue; }
      const origenFilas = (src ?? []) as unknown as Array<Record<string, unknown>>;
      if (!origenFilas.length) { tablas[t.tabla] = 0; continue; }

      if (t.tabla === 'funnels') {
        // ⚠️ Se copia la FORMA del embudo, nunca los HECHOS del dueño. `entradas` y
        // `evento` dicen cómo entra la gente a ESE negocio y dónde queda su taller:
        // clonarlos hace que un workspace nuevo nazca afirmando que sus leads
        // llegan de un formulario de anuncio que no existe, y de ahí sale un audio
        // que se lo dice a un desconocido. Un dato declarado no se hereda.
        // El DEFAULT del dueño, elegido a mano y no por el índice del array: con
        // varios funnels, `[0]` es el orden que devuelva Postgres.
        const suyo = origenFilas.find((f) => f.es_default === true) ?? origenFilas[0];
        const origen = suyo?.data;
        const data = origen && typeof origen === 'object' ? { ...(origen as Record<string, unknown>) } : origen;
        if (data && typeof data === 'object') {
          delete (data as Record<string, unknown>).entradas;
          delete (data as Record<string, unknown>).evento;
        }
        // UPDATE sobre el default que ya existe, no upsert: la fila la creó la
        // migración (o `crearWorkspace`), y su id no es el del workspace — el
        // `id: destino` del molde viejo venía de que `funnel_config` era singleton.
        const { data: tocadas, error } = await sb.from('funnels')
          .update({ data, declarado: true, updated_at: new Date().toISOString() })
          .eq('workspace_id', destino).eq('es_default', true)
          .select('id');
        if (error) { avisos.push(`funnels: ${error.message}`); tablas[t.tabla] = 0; continue; }
        if (!(tocadas ?? []).length) {
          avisos.push('El cliente no tenía funnel: se creó uno con la forma del embudo del dueño.');
          const { error: eIns } = await sb.from('funnels')
            .insert({ workspace_id: destino, nombre: 'Funnel principal', data, declarado: true, es_default: true });
          if (eIns) { avisos.push(`funnels: ${eIns.message}`); tablas[t.tabla] = 0; continue; }
        }
        tablas[t.tabla] = 1;
        continue;
      }

      // Resto: insertar las que falten, comparando por la clave natural de la tabla.
      const clave = t.clave ?? 'clave';
      const norm = t.normalizarClave ?? ((v: string) => v);
      const { data: yaHay } = await sb.from(t.tabla).select(clave).eq('workspace_id', destino);
      const existentes = new Set(((yaHay ?? []) as unknown as Array<Record<string, unknown>>).map((r) => norm(String(r[clave]))));
      const nuevas = origenFilas
        .filter((r) => !existentes.has(norm(String(r[clave]))))
        .map((r) => (t.preparar ? t.preparar(r, ctx) : r))
        .filter((r): r is Record<string, unknown> => r != null)
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

  avisos.push('No se copiaron el teléfono, el email ni los grupos de WhatsApp del dueño: las pruebas tienen que llegarte a TI, no a él.');
  return { settings: filas.length, tablas, avisos };
}
