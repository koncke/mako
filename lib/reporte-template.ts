// =============================================================================
// Plantilla de WhatsApp "reporte_mako" — abre la ventana de 24h
// =============================================================================
// Estrategia: en vez de mandar cada reporte como plantilla (Meta prohíbe saltos
// de línea en los parámetros y limita el largo), mandamos UNA plantilla-apertura
// a la mañana con un botón "Recibir reporte". Al tocarlo, Mauricio abre la
// ventana de servicio de 24h y a partir de ahí los reportes salían como TEXTO
// LIBRE (multilínea, sin límite práctico) vía Chatwoot.
//
// ⛔ Desde el 09/10/2026 no hay apertura ni texto libre: los dos salían por el WhatsApp
// OFICIAL (Chatwoot), que se borró con toda la integración (ver lib/notify.ts). Lo que queda
// —el estado de la plantilla y mandarla a aprobar— lo leen /api/perfil/plantilla y el área
// `equipo` de la API de MaKo, y se va con las plantillas de Meta en la segunda tanda.
// =============================================================================

import 'server-only';
import { listMetaTemplates, upsertDraft, enviarBorradorAMeta, listDrafts, type TemplateDraft } from './meta-templates';

export const PLANTILLA_REPORTE_NOMBRE = 'reporte_mako';
export const PLANTILLA_REPORTE_IDIOMA = 'es_MX';

export function primerNombre(nombre: string): string {
  return (nombre || 'Mauricio').trim().split(/\s+/)[0] || 'Mauricio';
}

export function plantillaReporteDraft(): TemplateDraft {
  return {
    name: PLANTILLA_REPORTE_NOMBRE,
    language: PLANTILLA_REPORTE_IDIOMA,
    category: 'utility',
    header: '📊 Reporte MaKo',
    body:
      'Hola {{nombre}} 👋 Tu resumen del día ya está listo: semáforo de la cuenta, ads y wins.\n\n' +
      'Toca "Recibir reporte" y te lo paso aquí mismo, junto con los avisos de lo urgente durante el día.',
    footer: 'MaKo · Marketing OS',
    buttons: [{ type: 'QUICK_REPLY', text: 'Recibir reporte' }],
    params: [{ name: 'nombre', example: 'Mauricio' }],
    status: 'borrador',
  };
}

export type EstadoPlantilla = { estado: string; motivo: string | null };

/** Estado real de la plantilla en Meta: approved | pending | rejected | ausente | error. */
export async function estadoPlantillaReporte(): Promise<EstadoPlantilla> {
  try {
    const metas = await listMetaTemplates();
    const m = metas.find((t) => t.name === PLANTILLA_REPORTE_NOMBRE);
    if (!m) return { estado: 'ausente', motivo: null };
    return { estado: m.status, motivo: m.rejectedReason };
  } catch (err) {
    return { estado: 'error', motivo: err instanceof Error ? err.message : String(err) };
  }
}

// Crea el borrador (si no existe) y lo manda a aprobar a Meta. Idempotente: si ya
// está approved/pending no hace nada.
export async function asegurarPlantillaReporte(): Promise<{ ok: boolean; estado: string; error?: string }> {
  const est = await estadoPlantillaReporte();
  if (est.estado === 'approved' || est.estado === 'pending') return { ok: true, estado: est.estado };
  if (est.estado === 'error') return { ok: false, estado: 'error', error: est.motivo ?? 'no se pudo consultar Meta' };

  const existentes = await listDrafts();
  const previo = existentes.find((d) => d.name === PLANTILLA_REPORTE_NOMBRE);
  const draft = await upsertDraft({ ...plantillaReporteDraft(), id: previo?.id });
  if (!draft.id) return { ok: false, estado: est.estado, error: 'no se pudo guardar el borrador' };

  const r = await enviarBorradorAMeta(draft.id);
  if (!r.ok) return { ok: false, estado: est.estado, error: r.error };
  return { ok: true, estado: 'pending' };
}
