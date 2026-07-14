// =============================================================================
// avisos — el choke point ÚNICO "evento → aviso al dueño"
// =============================================================================
// Todo aviso al dueño pasa por acá: escribe el feed in-app (crearNotificacion) y
// lo manda al grupo de WhatsApp (SuperAdmin si es del dueño, "MaKo <> cliente" si
// es de un cliente), con DEDUP temporal para que el cron horario no repita la
// misma alerta cada hora mientras la condición persiste. La DETECCIÓN vive en el
// código que llama (barata/determinística); acá solo se despacha la voz.
//
// FASE 1 del plan de avisos (workflow mako-avisos-discovery): reusa piezas que ya
// existen (crearNotificacion, grupos de mako-grupo) y agrega estado+dedup.

import 'server-only';
import { crearNotificacion, type NotifSeveridad } from './notificaciones';
import { enviarAlGrupoSuperAdmin, enviarAlGrupoMaKo } from './mako-grupo';
import { getSetting, setSetting } from './settings';
import { runWithWorkspace, OWNER_WS } from './workspace';
import type { CategoriaAviso, SemaforoAviso, AvisoCatalogo } from './avisos-catalogo';
import { CATALOGO_AVISOS } from './avisos-catalogo';

const SEV_POR_SEMAFORO: Record<SemaforoAviso, NotifSeveridad> = {
  rojo: 'urgente', amarillo: 'warn', verde: 'ok', na: 'info',
};

export type EmitirAvisoInput = {
  /** slug del catálogo; sirve de `tipo` en el feed y de key de dedup. */
  tipo: string;
  titulo: string;
  /** el mensaje completo, ya en la voz de MaKo, que va al WhatsApp. */
  texto: string;
  categoria?: CategoriaAviso;
  semaforo?: SemaforoAviso;
  link?: string;
  /** no repetir el mismo `tipo` dentro de esta ventana (minutos). */
  dedupTtlMin?: number;
  /** workspace del aviso. Default OWNER_WS (dueño → grupo SuperAdmin). */
  ws?: number;
  /** forzar el canal del dueño (grupo SuperAdmin) aunque ws no sea OWNER_WS. */
  alDueno?: boolean;
};

export type EmitirAvisoResult = { ok: boolean; feedId: number | null; wa: boolean; deduped: boolean };

const keyLast = (tipo: string) => `mako.aviso.last.${tipo}`;

async function avisadoReciente(ws: number, tipo: string, ttlMin: number): Promise<boolean> {
  const raw = await runWithWorkspace(ws, () => getSetting(keyLast(tipo)));
  if (!raw) return false;
  const t = Date.parse(raw);
  if (Number.isNaN(t)) return false;
  return Date.now() - t < ttlMin * 60_000;
}
async function marcarAvisado(ws: number, tipo: string): Promise<void> {
  await runWithWorkspace(ws, () => setSetting(keyLast(tipo), new Date().toISOString()));
}

/**
 * Emite un aviso al dueño: feed in-app + WhatsApp (grupo del dueño o del cliente),
 * con dedup opcional. Best-effort: nunca lanza (un fallo del feed o del envío no
 * debe tumbar el cron/webhook que lo dispara).
 */
export async function emitirAviso(a: EmitirAvisoInput): Promise<EmitirAvisoResult> {
  const ws = a.ws ?? OWNER_WS;
  try {
    if (a.dedupTtlMin && (await avisadoReciente(ws, a.tipo, a.dedupTtlMin))) {
      return { ok: true, feedId: null, wa: false, deduped: true };
    }
    const feedId = await crearNotificacion({
      tipo: a.tipo,
      severidad: SEV_POR_SEMAFORO[a.semaforo ?? 'na'],
      titulo: a.titulo,
      descripcion: a.texto,
      link: a.link ?? '/configuraciones?tab=notif',
      entityType: 'aviso',
      payload: { texto: a.texto, categoria: a.categoria ?? null, semaforo: a.semaforo ?? 'na' },
      origen: `aviso:${a.tipo}`,
    });
    const alDueno = a.alDueno || ws === OWNER_WS;
    const env = alDueno ? await enviarAlGrupoSuperAdmin(a.texto) : await enviarAlGrupoMaKo(ws, a.texto);
    if (a.dedupTtlMin) await marcarAvisado(ws, a.tipo);
    return { ok: true, feedId, wa: env.ok, deduped: false };
  } catch (e) {
    console.error(`[avisos] emitirAviso(${a.tipo}) falló:`, e);
    return { ok: false, feedId: null, wa: false, deduped: false };
  }
}

/** Busca una entrada del catálogo por id. */
export function avisoDelCatalogo(id: string): AvisoCatalogo | undefined {
  return CATALOGO_AVISOS.find((a) => a.id === id);
}

/**
 * Emite un aviso a partir de una entrada del catálogo (usa su `ejemplo` como
 * texto por defecto, o el `texto` provisto cuando hay datos reales).
 */
export const KEY_PLANTILLA = (id: string) => `mako.plantilla.${id}`;

/** Texto EFECTIVO de una plantilla: el override editado (si existe) o el ejemplo
 *  del catálogo. El override lo edita el dueño en la tab Plantillas. */
export async function textoPlantilla(id: string): Promise<string> {
  const cat = avisoDelCatalogo(id);
  const ov = await runWithWorkspace(OWNER_WS, () => getSetting(KEY_PLANTILLA(id)));
  return (ov && ov.trim()) || cat?.ejemplo || '';
}

export async function emitirDelCatalogo(
  id: string, opts: { texto?: string; ws?: number; dedupTtlMin?: number } = {},
): Promise<EmitirAvisoResult> {
  const cat = avisoDelCatalogo(id);
  if (!cat) return { ok: false, feedId: null, wa: false, deduped: false };
  return emitirAviso({
    tipo: cat.id,
    titulo: cat.titulo,
    // Prioridad: texto explícito (con datos reales del disparador) → override
    // editado por el dueño → ejemplo del catálogo.
    texto: opts.texto ?? (await textoPlantilla(id)),
    categoria: cat.categoria,
    semaforo: cat.semaforo,
    ws: opts.ws,
    dedupTtlMin: opts.dedupTtlMin,
  });
}
