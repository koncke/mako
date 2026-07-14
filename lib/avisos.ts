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
    // Ruteo: al grupo del CLIENTE (su "MaKo <> cliente") por default. El grupo de
    // SuperAdmin es SOLO para avisos de agencia (cross-cliente) marcados alDueno.
    // Así los eventos de un cliente (aunque corran en OWNER_WS) NO caen en el grupo
    // de SuperAdmin — el cliente los recibe en SU grupo (creado en Config>Notif).
    const env = a.alDueno === true ? await enviarAlGrupoSuperAdmin(a.texto) : await enviarAlGrupoMaKo(ws, a.texto);
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
/**
 * Emite un aviso del catálogo. La plantilla es una REFERENCIA (editable): si se
 * pasa `contexto` (datos reales del evento), MaKo GENERA el mensaje con IA usando
 * la referencia + esos datos (libre de adaptarla). Si se pasa `texto`, se usa tal
 * cual. Si no, cae a la referencia literal. Respeta activar/desactivar la plantilla.
 */
export async function emitirDelCatalogo(
  id: string, opts: { texto?: string; contexto?: string; ws?: number; dedupTtlMin?: number; alDueno?: boolean } = {},
): Promise<EmitirAvisoResult> {
  const cat = avisoDelCatalogo(id);
  if (!cat) return { ok: false, feedId: null, wa: false, deduped: false };
  const { plantillaActiva, referenciaPlantilla, generarMensajeAviso } = await import('./plantillas');
  if (!(await plantillaActiva(id))) return { ok: true, feedId: null, wa: false, deduped: true }; // desactivada → no manda
  const texto = opts.texto
    ?? (opts.contexto ? await generarMensajeAviso(id, opts.contexto) : await referenciaPlantilla(id));
  return emitirAviso({
    tipo: cat.id, titulo: cat.titulo, texto,
    categoria: cat.categoria, semaforo: cat.semaforo,
    ws: opts.ws, dedupTtlMin: opts.dedupTtlMin, alDueno: opts.alDueno,
  });
}
