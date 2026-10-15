// =============================================================================
// mako-ficha-lead — lo que MaKo lee de la ficha de un lead (`ficha_lead`, `buscar_leads`)
// =============================================================================
// Tanda B del CRM (14/10/2026, docs/diseno-ficha-bloques.md §5): «Lo que muestran los bloques, en la
// lectura de la ficha que usa MaKo». `ficha_lead` (lib/mako-tools.ts) devolvía 20 campos fijos y no
// traía la web, las redes, el ingreso estimado, lo que contestó en la landing, la oferta ni el tipo de
// venta, que la ficha del equipo sí muestra. Es el mismo modo de falla del 08/10 con el formulario de
// Meta (`formularioParaModelo`, lib/meta-leads-campos.ts): una lista cerrada de campos hace que el
// modelo AFIRME «no hay» sobre un dato guardado.
//
// Y la etapa salía de `pipeline_stage` CRUDO: null en todo lead sin override (la mayoría: la etapa se
// deriva de las fechas), y una etapa fantasma en los cientos con un override a una etapa que su funnel
// ya no tiene. Ahora es `etapaVigenteDe` contra las etapas de su funnel, la MISMA que dibuja la ficha.
//
// Sin `server-only`, para que tenga test (tests/mako-ficha-lead.test.ts). Lo que lee la base
// (las etapas, la oferta) lo pasa lib/mako-tools.ts.
//
// ⚠️ SÓLO VA LO QUE TIENE VALOR. Cada campo vacío son caracteres de un presupuesto chico: MaKo Analyst
// corta `ficha_lead` en 5.000 (lib/mako-analyst-lead-reglas.ts) y lo cortado se pierde desde el final,
// que es donde van los dos formularios. Que un campo no esté es «no está cargado»; la descripción de la
// herramienta lo dice una vez.
// =============================================================================

import { etapaVigenteDe } from './funnel-etapas';
import { DEFAULT_STAGES, type StageDerivable } from './pipeline';
import { respuestasGuardadas } from './optin-respuestas';
import { entradaSocialGuardada, COMO_ENTRO } from './canal-social';

/** Una etapa del funnel del lead, lo que hace falta para rotularla. */
export type EtapaParaModelo = { key: string; label?: string | null; kind?: string };

/**
 * La etapa EFECTIVA y su nombre. Sin etapas (la lectura falló o vino vacía), las de por defecto: es lo
 * que hace la ficha (`stagesRaw.length ? stagesRaw : DEFAULT_STAGES`, app/crm/[id]/page.tsx), así las
 * dos dicen lo mismo también cuando la lectura se cae.
 */
export function etapaParaModelo(l: StageDerivable, etapas?: readonly EtapaParaModelo[] | null): { etapa: string; etapa_nombre: string | null } {
  const lista: readonly EtapaParaModelo[] = etapas?.length ? etapas : DEFAULT_STAGES;
  const etapa = etapaVigenteDe(l, lista.map((s) => ({ key: s.key, kind: s.kind })));
  const label = lista.find((s) => s.key === etapa)?.label;
  return { etapa, etapa_nombre: typeof label === 'string' && label.trim() ? label.trim() : null };
}

/** La oferta del lead, como la lee MaKo. `nombre: null` = tiene una y no se pudo leer. */
export type OfertaParaModelo = { id: number; nombre: string | null; ticket_usd?: number | null; modelo?: string | null };

/** Lo de la ficha que lee esto. Todo opcional: una base vieja (o `select` acotado) puede no traerlo. */
export type LeadParaModelo = {
  estado_lead?: string | null;
  web?: string | null;
  instagram?: string | null;
  youtube?: string | null;
  linkedin?: string | null;
  direccion?: string | null;
  sexo?: string | null;
  ingreso_estimado?: number | string | null;
  venta_tipo?: string | null;
  suscripcion_monto_usd?: number | string | null;
  suscripcion_meses?: number | string | null;
  email_opt_out?: boolean | null;
  pagina_registro?: string | null;
  entrada_social?: unknown;
};

const txt = (v: unknown, tope = 300): string | null => (typeof v === 'string' && v.trim() ? v.trim().slice(0, tope) : null);
const num = (v: unknown): number | null => {
  const n = typeof v === 'number' ? v : typeof v === 'string' && v.trim() ? Number(v) : NaN;
  return Number.isFinite(n) ? n : null;
};

/**
 * LO QUE LA FICHA MUESTRA Y LA LECTURA DE MaKo NO TRAÍA, sólo lo que tiene valor. Va adentro de
 * `lead`, al lado del resumen de siempre.
 *
 *   · Las redes y la web, como están guardadas (Instagram sin la @).
 *   · `ingreso_estimado_usd`: lo que alguien CREE que vale mientras está abierto. NO es una venta, y
 *     en un ganado no va (la ficha lo oculta: lo real es el monto de cierre).
 *   · El tipo de venta; en una suscripción, el mensual y el plazo (sin plazo = mes a mes).
 *   · La oferta asignada, la página donde se registró y cómo entró por Instagram o Messenger.
 *   · `email_dado_de_baja` sólo si es cierto: no se le manda email.
 */
export function datosDeLaFicha(l: LeadParaModelo, oferta: OfertaParaModelo | null = null): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const k of ['web', 'instagram', 'youtube', 'linkedin', 'direccion', 'sexo'] as const) {
    const v = txt(l[k]);
    if (v) out[k] = v;
  }
  const estimado = num(l.ingreso_estimado);
  if (estimado != null && estimado > 0 && l.estado_lead !== 'ganado') out.ingreso_estimado_usd = estimado;
  const tipo = txt(l.venta_tipo, 30);
  if (tipo) out.venta_tipo = tipo;
  if (tipo === 'suscripcion') {
    const mensual = num(l.suscripcion_monto_usd);
    if (mensual != null) out.suscripcion_mensual_usd = mensual;
    const meses = num(l.suscripcion_meses);
    out.suscripcion_meses = meses != null && meses > 0 ? meses : 'mes a mes';
  }
  if (oferta) out.oferta = { id: oferta.id, nombre: oferta.nombre, ...(oferta.ticket_usd != null ? { ticket_usd: oferta.ticket_usd } : {}), ...(oferta.modelo ? { modelo: oferta.modelo } : {}) };
  const pagina = txt(l.pagina_registro, 500);
  if (pagina) out.pagina_registro = pagina;
  const entrada = entradaSocialGuardada(l.entrada_social);
  if (entrada) {
    out.entrada_social = {
      canal: entrada.canal,
      como: COMO_ENTRO[entrada.como],
      ...(entrada.at ? { cuando: entrada.at } : {}),
      ...(entrada.texto ? { comento: entrada.texto } : {}),
      ...(entrada.post_id ? { publicacion_id: entrada.post_id } : {}),
      ...(entrada.ref ? { ref: entrada.ref } : {}),
      ...(entrada.anuncio_id ? { anuncio_id: entrada.anuncio_id } : {}),
    };
  }
  if (l.email_opt_out === true) out.email_dado_de_baja = true;
  return out;
}

/** Los topes de lo que contestó en la landing, como los de `formularioParaModelo`. */
export const TOPE_LANDING_MODELO = { preguntas: 12, pregunta: 60, respuesta: 300 } as const;

/**
 * Lo que contestó en el formulario de la landing (`leads.optin_respuestas`, mig 0274), al lado de
 * `formulario_meta`. `null` = no hay nada guardado: no entró por una landing con preguntas, o entró
 * antes del 14/10/2026, cuando no se guardaba. NO es «no contestó».
 */
export function landingParaModelo(v: unknown): { formulario_landing: Array<{ pregunta: string; respuesta: string }> | null; formulario_landing_omitidas?: number } {
  const todas = respuestasGuardadas(v);
  if (!todas.length) return { formulario_landing: null };
  const T = TOPE_LANDING_MODELO;
  const filas = todas.slice(0, T.preguntas).map((r) => ({ pregunta: r.pregunta.slice(0, T.pregunta), respuesta: r.respuesta.slice(0, T.respuesta) }));
  return { formulario_landing: filas, ...(todas.length > filas.length ? { formulario_landing_omitidas: todas.length - filas.length } : {}) };
}
