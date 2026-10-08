// =============================================================================
// api-mako/areas/email.run — los cuerpos del área `email`
// =============================================================================
// Un runner por id de email.def.ts. Lecturas: { leer }. Acciones: { preparar, ejecutar }.
// Todo corre adentro de runWithWorkspace(ctx.ws): las libs que ya scopean con
// getTenantDb scopean solas. Nunca se escribe desde leer() ni desde preparar().
//
// ⚠️ LAS DE PANTALLA VAN A LA GENÉRICA /mako/revisar: guarda el INPUT validado y al
// confirmar vuelve a llamar preparar(input) y recién ahí ejecutar(payload). Así que
// preparar() acepta exactamente los `parametros` declarados, y ejecutar() vuelve a
// mirar lo que pudo cambiar entre las dos (el estado del broadcast, el interruptor).
//
// ⚠️ ENVIAR CON EL ENVÍO REAL APAGADO QUEMA EL BROADCAST: enviarBroadcast registra
// todo «simulado», lo marca «enviado» y el guard de re-entrada lo bloquea para
// siempre. Por eso enviar_broadcast se niega en preparar() Y en ejecutar().
//
// ⚠️ UN SEGMENTO DE MÁS DE MAX_DESTINATARIOS (2.000) LEADS NO SE PUEDE ENVIAR.
// enviarBroadcast corta ahí (`truncado`), marca «enviado» y el guard de re-entrada
// impide mandárselo a los demás, así que enviar y programar se niegan cuando
// contarSegmento pasa de ese tope. El número se IMPORTA de la lib, no se copia.
// Hasta el 17/09 el tope de acá era 1.000 porque leadsDeSegmento no paginaba; ya
// pagina (leerTodo), y el guard viejo bloqueaba el envío a los 1.044 «activos» del
// ws1 por un problema que ya no existía. Si la lib cambia su tope, cambia acá solo.
//
// ⚠️ LA LIB NO RECLAMA EL BROADCAST DE FORMA ATÓMICA. actualizarBroadcast y
// eliminarBroadcast filtran solo por id, y enviarBroadcast pasa a «enviando» sin
// condición. Sin escrituras condicionales en la lib, lo que evita pisarse con el
// cron (app/api/cron/email-broadcasts, cada 30 min entre 13 y 23 UTC) es no tocar un
// programado que ya venció con el envío real prendido: el cron solo toma
// programado_at <= ahora, así que uno con fecha futura no puede estar en sus manos
// al momento de escribir.
// =============================================================================

import 'server-only';
import type { Runners, SalidaLectura, Preparado, Ejecutado } from '../tipos';
import {
  getEmailKpis, getEmailSecuencias, crearEmailSecuencia, actualizarMetaEmailSecuencia,
  ETAPAS, TRIGGERS, SEGMENTOS, esSegmentoValido, leadsDeSegmento, contarSegmento, contarTodosSegmentos,
  getBroadcasts, crearBroadcast, actualizarBroadcast, eliminarBroadcast, enviarBroadcast, enviarBroadcastPrueba,
  MAX_DESTINATARIOS, DisparadorEmailError, type EmailSecuencia, type Broadcast,
} from '@/lib/email-marketing';
import { etiquetaPorId } from '@/lib/etiquetas';
import { TRIGGER_ETIQUETA } from '@/lib/etiquetas-reglas';
import { setSecuenciaPasos, type PasoSecuencia } from '@/lib/nutricion';
import { esPasoAccion } from '@/lib/nutricion-paso-accion';
import { getEmailFrom, remitenteEsSandbox, emailConectado, displayNameDe, verifyResendDomain, getResendDomain } from '@/lib/resend';
import { envioEmailHabilitado, setEnvioEmail } from '@/lib/envio-flags';
import {
  estadoEmail, tzGuardada, alcanceEnvioReal, dominioIdDelWorkspace,
  secuenciasArchivadas, leadDelWorkspace, historialEmailLead, bajasEmail,
} from './email.helpers';

// ── utilidades ───────────────────────────────────────────────────────────────

const num = (input: Record<string, unknown>, k: string): number | null => {
  const v = input[k];
  return typeof v === 'number' && Number.isFinite(v) ? v : null;
};
const str = (input: Record<string, unknown>, k: string): string | undefined => {
  const v = input[k];
  return typeof v === 'string' && v.trim() ? v.trim() : undefined;
};
const json = (x: unknown): string => JSON.stringify(x);
const errorLectura = (content: string): SalidaLectura => ({ content, isError: true });
const recorte = (t: string | null | undefined, n: number): string => {
  const s = (t ?? '').replace(/\s+/g, ' ').trim();
  return s.length > n ? `${s.slice(0, n)}… (+${s.length - n} caracteres)` : s;
};
const fmtFecha = (iso: string, tz: string): string => {
  try { return new Date(iso).toLocaleString('es-MX', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', timeZone: tz }); } catch { return iso; }
};
const labelDe = (lista: ReadonlyArray<{ value: string; label: string }>, v: string): string => lista.find((o) => o.value === v)?.label ?? v;

const AVISO_SIMULADO = 'Los envíos «simulado» (con el envío real apagado) cuentan como enviados y nunca registran apertura ni clic: con el envío apagado las tasas dan 0.';

async function secuenciaEmail(id: number): Promise<EmailSecuencia | null> {
  return (await getEmailSecuencias()).find((s) => s.id === id) ?? null;
}
async function broadcastPorId(id: number): Promise<Broadcast | null> {
  return (await getBroadcasts()).find((b) => b.id === id) ?? null;
}
const noSecuencia = (id: number) => `No hay una secuencia de email con id ${id} en este negocio. Solo cuentan las que tienen todos sus pasos por email: pide la lista con listar_secuencias_email.`;
const noBroadcast = (id: number) => `No hay un broadcast con id ${id} en este negocio. Pide la lista con listar_broadcasts.`;
const EDITABLE = new Set(['borrador', 'programado', 'cancelado']);

/** Un segmento que el envío no alcanza entero (ver cabecera). */
const TOPE_ENVIO = MAX_DESTINATARIOS;
const MSG_TOPE_SEGMENTO = (leads: number) => `El segmento tiene ${leads} leads y un broadcast llega como máximo a ${TOPE_ENVIO}: se marcaría «enviado» y a los otros ${leads - TOPE_ENVIO} no les llegaría nunca, sin forma de reenviarlo. No se puede mandar un broadcast a más de ${TOPE_ENVIO} leads desde MaKo; elige un segmento más chico.`;

/** Margen para no tocar un programado que el cron puede estar tomando (ver cabecera). */
const MARGEN_CRON_MS = 2 * 60_000;
async function enManosDelCron(b: Broadcast): Promise<boolean> {
  if (b.estado !== 'programado' || !b.programado_at) return false;
  if (Date.parse(b.programado_at) > Date.now() + MARGEN_CRON_MS) return false;
  // Con el envío real apagado el cron saltea el negocio: el programado vencido queda quieto.
  return envioEmailHabilitado();
}
const msgEnManosDelCron = (id: number) => `El broadcast #${id} está programado para una fecha que ya venció (o vence en menos de 2 minutos) y el envío real está prendido: el envío automático puede estar tomándolo ahora mismo, y tocarlo podría dejarlo enviado a medias. Revisa listar_broadcasts en unos minutos.`;

// El cron de broadcasts (vercel.json) corre en UTC solo a las :00 y :30 entre las
// 13:00 y las 23:30. primerTurnoCron devuelve el primer turno igual o posterior a
// `ms`, que es cuando el broadcast puede salir de verdad (con el envío real prendido).
const CRON_HORA_DESDE_UTC = 13;
const CRON_HORA_HASTA_UTC = 23;
function primerTurnoCron(ms: number): number {
  const paso = 30 * 60_000;
  let t = Math.ceil(ms / paso) * paso; // el epoch está alineado a UTC: esto cae en :00 o :30
  for (let i = 0; i < 48; i++) {
    const h = new Date(t).getUTCHours();
    if (h >= CRON_HORA_DESDE_UTC && h <= CRON_HORA_HASTA_UTC) return t;
    t += paso;
  }
  return t;
}

/** etapa válida: del catálogo, salvo con trigger etapa_actual (clave del funnel del negocio). */
function errorEtapaTrigger(etapa: string | undefined, trigger: string | undefined): Preparado | null {
  if (trigger !== undefined && !TRIGGERS.some((t) => t.value === trigger)) {
    return { error: `El trigger «${trigger}» no existe.`, disponibles: TRIGGERS.map((t) => t.value) };
  }
  if (etapa !== undefined && trigger !== 'etapa_actual' && !ETAPAS.some((e) => e.value === etapa)) {
    return { error: `La etapa «${etapa}» no existe (solo con el trigger etapa_actual se usa una clave del funnel).`, disponibles: ETAPAS.map((e) => e.value) };
  }
  return null;
}

/** Cambiar el trigger, o la etapa con el trigger etapa_actual, cambia QUIÉN inscribe el
 *  motor: en una secuencia activa eso es mandarle emails reales a una cohorte nueva en la
 *  próxima corrida, y un envío masivo no se confirma con un «sí» por chat (diseño §3).
 *  Cambiar la etiqueta de una que se dispara por etiqueta, también. */
function cambiaCohorte(s: EmailSecuencia, etapa: string | undefined, trigger: string | undefined, etiquetaId?: number | null): boolean {
  if (trigger !== undefined && trigger !== s.trigger_tipo) return true;
  if (etiquetaId != null && etiquetaId !== s.etiqueta_id) return true;
  return etapa !== undefined && etapa !== s.etapa && (trigger ?? s.trigger_tipo) === 'etapa_actual';
}

/**
 * ⚠️ «SE LE PUSO UNA ETIQUETA» SIN DECIR CUÁL ES UNA SECUENCIA MUDA (revisión del 08/10/2026,
 * etiquetas-2): se guardaba sólo el trigger, `etiqueta_id` quedaba vacío y la secuencia no se
 * disparaba nunca, sin un error. Con ese trigger la etiqueta es obligatoria y tiene que existir
 * (viva) en este negocio. Lo valida acá para contestarlo ANTES del «sí»; al confirmar lo vuelve a
 * validar la puerta de los disparadores (lib/setting-secuencias.ts, vía lib/email-marketing.ts).
 */
async function errorEtiquetaDelTrigger(trigger: string | undefined, etiquetaId: number | null): Promise<Preparado | null> {
  if (trigger !== TRIGGER_ETIQUETA) {
    return etiquetaId != null ? { error: `etiquetaId va sólo con el trigger ${TRIGGER_ETIQUETA}.` } : null;
  }
  if (etiquetaId == null) return { error: 'Con el trigger etiqueta_puesta hay que decir qué etiqueta lo dispara (listar_etiquetas, área crm).', faltan: ['etiquetaId'] };
  const e = await etiquetaPorId(etiquetaId);
  if (!e) return { error: `No existe la etiqueta #${etiquetaId} en este negocio. Pide la lista con listar_etiquetas (área crm).` };
  if (e.archivada_at) return { error: `La etiqueta «${e.nombre}» está archivada: no dispara nada.` };
  return null;
}
const ERROR_COHORTE_ACTIVA = (id: number) => `La secuencia #${id} está ACTIVA: cambiarle el trigger (o la etapa con el trigger etapa_actual) inscribe a una cohorte nueva y le manda emails reales en la próxima corrida. Primero hay que pausarla con proponer_toggle_nutricion (área chatbot); renombrarla sí se puede sin pausar.`;

const statsDe = (s: { sent: number; abiertos: number; clics: number }) => ({ enviados: s.sent, abiertos: s.abiertos, clics: s.clics });

// ── runners ──────────────────────────────────────────────────────────────────

export const RUNNERS: Runners = {
  kpis_email: {
    leer: async () => {
      const ahora = new Date();
      const desde30 = new Date(ahora.getTime() - 30 * 86400_000);
      const inicioMes = new Date(ahora); inicioMes.setUTCDate(1); inicioMes.setUTCHours(0, 0, 0, 0);
      // Sin advertencia de «se contó sobre los primeros 1000»: desde el 17/09
      // getEmailKpis CUENTA en el server (count exact), que no tiene techo. Dejarla
      // habría sido afirmar un recorte que ya no existe.
      const [kpis, envioOn] = await Promise.all([getEmailKpis(), envioEmailHabilitado()]);
      const advertencias = [AVISO_SIMULADO];
      return json({
        ventana_tasas: { desde: desde30.toISOString(), hasta: ahora.toISOString(), dias: 30 },
        ventana_mes: { desde: inicioMes.toISOString(), hasta: ahora.toISOString(), nota: 'mes calendario en UTC' },
        envio_real_habilitado: envioOn,
        kpis: kpis.map((k) => ({ indicador: k.label, valor: k.value, detalle: k.delta })),
        nota_valores: '«—» significa que no hubo envíos en la ventana (no es 0%). «Suscriptores activos» = leads abiertos o ganados con email y sin baja; el detalle ▲ son los nuevos de 30 días.',
        advertencias,
      });
    },
  },

  listar_secuencias_email: {
    leer: async () => {
      const secs = await getEmailSecuencias();
      const ids = secs.map((s) => s.id);
      // getEmailSecuencias pagina inscriptos y envíos (17/09): ya no hay recorte que avisar.
      const archivadas = await secuenciasArchivadas(ids);
      const advertencias = [AVISO_SIMULADO, 'Las estadísticas se alinean por POSICIÓN del paso: si se reordenaron pasos, el histórico quedó en el paso que ocupaba ese lugar.'];
      if (!secs.length) return json({ total: 0, secuencias: [], nota: 'No hay secuencias de email (con todos sus pasos por email) en este negocio.' });
      return json({
        total: secs.length,
        secuencias: secs.map((s) => ({
          id: s.id, nombre: s.nombre, etapa: s.etapa, trigger: s.trigger_tipo, trigger_label: labelDe(TRIGGERS, s.trigger_tipo),
          ...(s.trigger_tipo === TRIGGER_ETIQUETA ? { etiquetaId: s.etiqueta_id } : {}),
          activa: s.activa, archivada: archivadas.has(s.id), inscriptos: s.inscriptos,
          pasos: s.pasos.map((p, i) => ({
            orden: i + 1, delay_horas: p.delay_horas, ...(p.ancla ? { ancla: p.ancla } : {}),
            asunto: p.asunto ?? '', cuerpo_recorte: recorte(p.cuerpo, 160), ...statsDe(s.statsPorPaso[i] ?? { sent: 0, abiertos: 0, clics: 0 }),
          })),
        })),
        advertencias,
      });
    },
  },

  ficha_secuencia_email: {
    leer: async (input) => {
      const id = num(input, 'id')!;
      const s = await secuenciaEmail(id);
      if (!s) return errorLectura(noSecuencia(id));
      const archivadas = await secuenciasArchivadas([id]);
      const advertencias = [AVISO_SIMULADO];
      return json({
        id: s.id, clave: s.clave, nombre: s.nombre, etapa: s.etapa, trigger: s.trigger_tipo, trigger_label: labelDe(TRIGGERS, s.trigger_tipo),
        ...(s.trigger_tipo === TRIGGER_ETIQUETA ? { etiquetaId: s.etiqueta_id } : {}),
        activa: s.activa, archivada: archivadas.has(id), inscriptos: s.inscriptos,
        pasos: s.pasos.map((p, i) => ({
          orden: i + 1, delay_horas: p.delay_horas, ...(p.ancla ? { ancla: p.ancla } : {}), ...(p.requiere ? { requiere: p.requiere } : {}),
          asunto: p.asunto ?? '', preheader: p.preheader ?? '', cuerpo: p.cuerpo,
          ...statsDe(s.statsPorPaso[i] ?? { sent: 0, abiertos: 0, clics: 0 }),
        })),
        advertencias,
      });
    },
  },

  listar_etapas_email: {
    leer: async () => json({ etapas: ETAPAS.map((e) => ({ value: e.value, label: e.label })), nota: 'Con el trigger etapa_actual, la etapa es la clave de una etapa del funnel del negocio y puede no estar en esta lista.' }),
  },

  listar_triggers_email: {
    leer: async () => json({ triggers: TRIGGERS.map((t) => ({ value: t.value, label: t.label })), nota: '«manual» no inscribe a nadie solo.' }),
  },

  listar_broadcasts: {
    leer: async () => {
      // getBroadcasts pagina los envíos (17/09): las estadísticas son completas.
      const bs = await getBroadcasts();
      const advertencias = [AVISO_SIMULADO];
      if (!bs.length) return json({ total: 0, broadcasts: [], nota: 'Este negocio no tiene broadcasts.' });
      return json({
        total: bs.length,
        broadcasts: bs.map((b) => ({
          id: b.id, asunto: b.asunto, segmento: b.segmento, estado: b.estado,
          programado_at: b.estado === 'programado' ? b.programado_at : null, enviado_at: b.enviado_at, creado_at: b.created_at,
          total_destinatarios: b.estado === 'enviado' ? b.total_destinatarios : null, enviados: b.enviados, abiertos: b.abiertos, clics: b.clics,
          cuerpo_recorte: recorte(b.cuerpo, 160),
        })),
        nota: 'programado_at solo viene en los programados (null en el resto). total_destinatarios es null hasta que se envía: null no es «0 destinatarios»; para el número de hoy usa contar_segmento_email.',
        advertencias,
      });
    },
  },

  ficha_broadcast: {
    leer: async (input) => {
      const id = num(input, 'id')!;
      const b = await broadcastPorId(id);
      if (!b) return errorLectura(noBroadcast(id));
      const advertencias = [AVISO_SIMULADO];
      return json({
        id: b.id, asunto: b.asunto, preheader: b.preheader, cuerpo: b.cuerpo,
        segmento: b.segmento, segmento_label: labelDe(SEGMENTOS, b.segmento), estado: b.estado,
        programado_at: b.estado === 'programado' ? b.programado_at : null, enviado_at: b.enviado_at, creado_at: b.created_at,
        total_destinatarios: b.estado === 'enviado' ? b.total_destinatarios : null, enviados: b.enviados, abiertos: b.abiertos, clics: b.clics,
        nota: 'programado_at es null si no está programado. total_destinatarios es null hasta que se envía (null no es 0).',
        advertencias,
      });
    },
  },

  listar_segmentos_email: {
    leer: async () => {
      const counts = await contarTodosSegmentos();
      return json({
        segmentos: SEGMENTOS.map((s) => ({ value: s.value, label: s.label, descripcion: s.descripcion, leads: counts[s.value] ?? 0, se_puede_enviar: (counts[s.value] ?? 0) <= TOPE_ENVIO })),
        nota: `Conteo de hoy: leads con email no vacío y sin baja. Un broadcast solo se puede mandar a un segmento de hasta ${TOPE_ENVIO} leads (se_puede_enviar = false si pasa): el envío llega a los primeros ${TOPE_ENVIO} y dejaría al resto afuera para siempre. Además saltea a quien recibió un email en las últimas 20 h, así que el envío real puede ser menor.`,
      });
    },
  },

  contar_segmento_email: {
    leer: async (input) => {
      const seg = str(input, 'segmento') ?? '';
      if (!esSegmentoValido(seg)) return errorLectura(`El segmento «${seg}» no existe. Valen: ${SEGMENTOS.map((s) => s.value).join(', ')}.`);
      return json({ segmento: seg, label: labelDe(SEGMENTOS, seg), leads: await contarSegmento(seg) });
    },
  },

  leads_de_segmento_email: {
    leer: async (input) => {
      const seg = str(input, 'segmento') ?? '';
      if (!esSegmentoValido(seg)) return errorLectura(`El segmento «${seg}» no existe. Valen: ${SEGMENTOS.map((s) => s.value).join(', ')}.`);
      const limite = num(input, 'limite') ?? 50;
      const [leads, total] = await Promise.all([leadsDeSegmento(seg), contarSegmento(seg)]);
      const mostrados = leads.slice(0, limite);
      return json({
        segmento: seg, total_leads: total, mostrados: mostrados.length, fuera_del_recorte: Math.max(0, total - mostrados.length),
        leads: mostrados.map((l) => ({ id: l.id, nombre: l.nombre, email: l.email, empresa: l.empresa })),
        nota: 'Sin orden particular. Para el número exacto alcanza con contar_segmento_email.',
      });
    },
  },

  estado_email: {
    leer: async () => {
      const e = await estadoEmail();
      return json({
        ...e,
        nota: e.error_lectura
          ? 'No se pudo leer la configuración del dominio en la base (dominio y estado_dominio quedan null por eso, no porque falten). Reintenta en un momento.'
          : e.error_dominio
          ? 'No se pudo leer el dominio en Resend (estado_dominio queda null por eso, no porque falte el dominio). Con una key de solo envío, Resend no deja consultar dominios.'
          : e.dominio ? 'estado_dominio «verified» es el único que permite fijar un remitente propio.' : 'Este negocio no cargó un dominio de envío: se configura en /email.',
      });
    },
  },

  remitente_email: {
    leer: async () => {
      const [from, sandbox] = await Promise.all([getEmailFrom(), remitenteEsSandbox()]);
      return json({
        remitente: from, nombre_visible: displayNameDe(from), sandbox,
        nota: sandbox ? 'Es el remitente de prueba de Resend: los emails solo le llegan al dueño de la cuenta de Resend, a nadie más.' : 'Remitente propio del negocio.',
      });
    },
  },

  envio_email_habilitado: {
    leer: async () => {
      const on = await envioEmailHabilitado();
      return json({
        envio_real_habilitado: on,
        nota: on ? 'Las secuencias activas y los broadcasts salen de verdad.' : 'Apagado: todo se registra como «simulado» y no sale ningún email. Enviar un broadcast así lo marcaría enviado sin mandarlo.',
      });
    },
  },

  historial_email_lead: {
    leer: async (input) => {
      const leadId = num(input, 'leadId')!;
      const limite = num(input, 'limite') ?? 30;
      const lead = await leadDelWorkspace(leadId);
      if (!lead) return errorLectura(`No hay un lead con id ${leadId} en este negocio.`);
      const h = await historialEmailLead(leadId, limite);
      const fila = (r: { estado: string; created_at: string; abierto_at: string | null; clic_at: string | null; error: string | null }) => ({
        estado: r.estado, fecha: r.created_at, abierto_at: r.abierto_at, clic_at: r.clic_at, ...(r.error ? { error: r.error } : {}),
      });
      return json({
        lead: { id: lead.id, nombre: lead.nombre, tiene_email: !!lead.email, dado_de_baja: lead.email_opt_out },
        secuencias: { total: h.total_secuencias, mostrados: h.secuencias.length, envios: h.secuencias.map((r) => ({ secuencia_id: r.secuencia_id ?? null, paso: r.paso ?? null, ...fila(r) })) },
        broadcasts: { total: h.total_broadcasts, mostrados: h.broadcasts.length, envios: h.broadcasts.map((r) => ({ broadcast_id: r.broadcast_id ?? null, ...fila(r) })) },
        nota: 'Más recientes primero. abierto_at/clic_at null = no hubo apertura o clic registrado; un envío «simulado» nunca los registra.',
      });
    },
  },

  bajas_email: {
    leer: async (input) => {
      const limite = num(input, 'limite') ?? 50;
      const b = await bajasEmail(limite);
      return json({
        total: b.total, mostrados: b.leads.length, fuera_del_recorte: Math.max(0, b.total - b.leads.length),
        leads: b.leads, nota: 'Ordenados por lead: los leads más nuevos primero. No se registra cuándo se dieron de baja ni el motivo, y no existe la operación inversa.',
      });
    },
  },

  // ── acciones por chat ──────────────────────────────────────────────────────

  crear_secuencia_email: {
    preparar: async (input) => {
      const nombre = str(input, 'nombre');
      const etapa = str(input, 'etapa');
      const trigger = str(input, 'trigger');
      const etiquetaId = num(input, 'etiquetaId');
      const mal = errorEtapaTrigger(etapa, trigger);
      if (mal) return mal;
      if (trigger === 'etapa_actual' && !etapa) return { error: 'Con el trigger etapa_actual hay que decir la etapa del funnel.', faltan: ['etapa'] };
      const malEtiqueta = await errorEtiquetaDelTrigger(trigger, etiquetaId);
      if (malEtiqueta) return malEtiqueta;
      return {
        payload: { nombre: nombre ?? '', etapa: etapa ?? '', trigger: trigger ?? '', ...(etiquetaId != null ? { etiquetaId } : {}) },
        resumen: `Crear la secuencia de email «${nombre ?? 'Nueva secuencia de email'}» pausada, con etapa ${etapa ?? 'nutri'} y trigger «${labelDe(TRIGGERS, trigger ?? 'manual')}»${etiquetaId != null ? ` (etiqueta #${etiquetaId})` : ''}. No manda nada hasta escribir los pasos y activarla.`,
      };
    },
    ejecutar: async (payload): Promise<Ejecutado> => {
      try {
        const id = await crearEmailSecuencia(String(payload.nombre ?? ''), String(payload.etapa ?? ''), String(payload.trigger ?? ''), payload.etiquetaId);
        return { ok: true, resumen: `Secuencia de email #${id} creada (pausada).`, datos: { id } };
      } catch (e) {
        if (e instanceof DisparadorEmailError) return { ok: false, resumen: e.message };
        throw e;
      }
    },
  },

  editar_meta_secuencia_email: {
    preparar: async (input) => {
      const id = num(input, 'id')!;
      const s = await secuenciaEmail(id);
      if (!s) return { error: noSecuencia(id) };
      const nombre = str(input, 'nombre');
      const etapa = str(input, 'etapa');
      const trigger = str(input, 'trigger_tipo');
      const etiquetaId = num(input, 'etiquetaId');
      if (nombre === undefined && etapa === undefined && trigger === undefined && etiquetaId == null) return { error: 'No hay nada que cambiar: manda nombre, etapa, trigger_tipo o etiquetaId.', faltan: ['nombre', 'etapa', 'trigger_tipo'] };
      const mal = errorEtapaTrigger(etapa, trigger ?? s.trigger_tipo);
      if (mal) return mal;
      // La etiqueta se mira contra el trigger que QUEDA. Pasar a etiqueta_puesta sin decir cuál
      // (o seguir en ese trigger sin una guardada) es la secuencia muda de antes.
      const queda = trigger ?? s.trigger_tipo;
      const etiquetaQueda = etiquetaId ?? (queda === s.trigger_tipo ? s.etiqueta_id : null);
      const malEtiqueta = (trigger !== undefined || etiquetaId != null) ? await errorEtiquetaDelTrigger(queda, queda === TRIGGER_ETIQUETA ? etiquetaQueda : etiquetaId) : null;
      if (malEtiqueta) return malEtiqueta;
      if (s.activa && cambiaCohorte(s, etapa, trigger, etiquetaId)) return { error: ERROR_COHORTE_ACTIVA(id) };
      const partes: string[] = [];
      if (nombre !== undefined) partes.push(`nombre «${s.nombre}» → «${nombre}»`);
      if (etapa !== undefined) partes.push(`etapa ${s.etapa} → ${etapa}`);
      if (trigger !== undefined) partes.push(`trigger «${labelDe(TRIGGERS, s.trigger_tipo)}» → «${labelDe(TRIGGERS, trigger)}»${s.activa ? '' : ' (la secuencia está pausada: la cohorte nueva se inscribe recién al activarla)'}`);
      if (queda === TRIGGER_ETIQUETA && etiquetaQueda != null && etiquetaQueda !== s.etiqueta_id) partes.push(`la dispara la etiqueta #${etiquetaQueda}`);
      return {
        payload: {
          id, ...(nombre !== undefined ? { nombre } : {}), ...(etapa !== undefined ? { etapa } : {}),
          // El disparador por etiqueta viaja ENTERO (trigger + etiqueta): cambiar sólo la etiqueta
          // también pasa por la puerta que la valida.
          ...(queda === TRIGGER_ETIQUETA && (trigger !== undefined || etiquetaId != null) ? { trigger_tipo: TRIGGER_ETIQUETA, etiquetaId: etiquetaQueda } : trigger !== undefined ? { trigger_tipo: trigger } : {}),
        },
        resumen: `Secuencia #${id}: ${partes.join('; ')}.`,
      };
    },
    ejecutar: async (payload): Promise<Ejecutado> => {
      const id = Number(payload.id);
      const s = await secuenciaEmail(id);
      if (!s) return { ok: false, resumen: noSecuencia(id) };
      const etiquetaId = typeof payload.etiquetaId === 'number' ? payload.etiquetaId : null;
      // Pudo activarse entre el «sí» y ahora: un cambio de cohorte en una activa es un envío masivo.
      if (s.activa && cambiaCohorte(s, typeof payload.etapa === 'string' ? payload.etapa : undefined, typeof payload.trigger_tipo === 'string' ? payload.trigger_tipo : undefined, etiquetaId)) {
        return { ok: false, resumen: ERROR_COHORTE_ACTIVA(id) };
      }
      try {
        await actualizarMetaEmailSecuencia(id, {
          nombre: typeof payload.nombre === 'string' ? payload.nombre : undefined,
          etapa: typeof payload.etapa === 'string' ? payload.etapa : undefined,
          trigger_tipo: typeof payload.trigger_tipo === 'string' ? payload.trigger_tipo : undefined,
          etiqueta_id: etiquetaId ?? undefined,
        });
      } catch (e) {
        if (e instanceof DisparadorEmailError) return { ok: false, resumen: e.message };
        throw e;
      }
      return { ok: true, resumen: `Secuencia de email #${id} actualizada.` };
    },
  },

  cancelar_programacion_broadcast: {
    preparar: async (input) => {
      const id = num(input, 'id')!;
      const b = await broadcastPorId(id);
      if (!b) return { error: noBroadcast(id) };
      if (b.estado !== 'programado') return { error: `El broadcast #${id} está «${b.estado}», no programado: no hay programación que cancelar.` };
      if (await enManosDelCron(b)) return { error: msgEnManosDelCron(id) };
      return { payload: { id }, resumen: `Cancelar la programación del broadcast #${id} «${recorte(b.asunto, 80)}» (vuelve a borrador y no se envía).` };
    },
    ejecutar: async (payload): Promise<Ejecutado> => {
      const id = Number(payload.id);
      const b = await broadcastPorId(id);
      // Entre el «sí» y ahora el envío automático pudo tomarlo: pasar a borrador uno
      // que está «enviando» frenaría la reanudación a medio segmento. Mirar el estado y
      // después escribir no alcanza solo (la lib escribe sin condición): lo que cierra la
      // carrera es enManosDelCron, que no deja tocar un programado vencido.
      if (!b) return { ok: false, resumen: noBroadcast(id) };
      if (b.estado !== 'programado') return { ok: false, resumen: `El broadcast #${id} ya está «${b.estado}»: no se tocó.` };
      if (await enManosDelCron(b)) return { ok: false, resumen: msgEnManosDelCron(id) };
      await actualizarBroadcast(id, { estado: 'borrador', programado_at: null });
      return { ok: true, resumen: `Broadcast #${id} vuelto a borrador: ya no se envía solo.` };
    },
  },

  verificar_dominio_envio: {
    preparar: async () => {
      const id = await dominioIdDelWorkspace();
      if (!id) return { error: 'Este negocio no tiene un dominio de envío cargado: primero hay que agregarlo en /email.' };
      return { payload: {}, resumen: 'Pedirle a Resend que revise los registros DNS del dominio de envío del negocio.' };
    },
    ejecutar: async (): Promise<Ejecutado> => {
      const id = await dominioIdDelWorkspace();
      if (!id) return { ok: false, resumen: 'Este negocio ya no tiene un dominio de envío cargado.' };
      const v = await verifyResendDomain(id);
      if (!v.ok) return { ok: false, resumen: `Resend rechazó la verificación: ${v.error ?? 'sin detalle'}.` };
      const d = await getResendDomain(id);
      if (!d.ok) return { ok: true, resumen: `Verificación pedida a Resend. No se pudo leer el estado nuevo (${d.error}); puede tardar unos minutos.` };
      const pendientes = d.domain.records.filter((r) => r.status && r.status !== 'verified').length;
      return {
        ok: true,
        resumen: `Verificación pedida. Dominio ${d.domain.name}: ${d.domain.status}${pendientes ? `, ${pendientes} registro(s) DNS sin verificar` : ''}. Puede tardar unos minutos en actualizarse.`,
        datos: { dominio: d.domain.name, estado: d.domain.status },
      };
    },
  },

  // ── acciones por pantalla (genérica /mako/revisar) ──────────────────────────

  editar_pasos_secuencia_email: {
    preparar: async (input) => {
      const id = num(input, 'id')!;
      const s = await secuenciaEmail(id);
      if (!s) return { error: noSecuencia(id) };
      const crudos = Array.isArray(input.pasos) ? (input.pasos as Array<Record<string, unknown>>) : [];
      if (!crudos.length) return { error: 'Faltan los pasos.', faltan: ['pasos'] };
      // Esta tool arma los pasos de cero, como emails: una acción de MaKo que tuviera la
      // secuencia se perdería sin aviso. Se edita en el lienzo, que sí las conoce.
      if (s.pasos.some(esPasoAccion)) return { error: `«${s.nombre}» tiene pasos «Acción de MaKo»: reescribirla por aquí los borraría. Edítala en el lienzo de /chatbot.` };
      const pasos: PasoSecuencia[] = crudos.map((p, i) => ({
        orden: i + 1, canal: 'email', delay_horas: Number(p.delay_horas) || 0,
        ...(p.ancla === 'reunion' ? { ancla: 'reunion' as const } : {}),
        ...(typeof p.requiere === 'string' ? { requiere: p.requiere as PasoSecuencia['requiere'] } : {}),
        asunto: typeof p.asunto === 'string' ? p.asunto : '',
        preheader: typeof p.preheader === 'string' ? p.preheader : '',
        cuerpo: typeof p.cuerpo === 'string' ? p.cuerpo : '',
        template_wa: null,
      }));
      const borrados = s.pasos.length - pasos.length;
      const avisos = [
        s.activa ? 'La secuencia está ACTIVA: el copy nuevo sale en el próximo envío.' : 'La secuencia está pausada.',
        ...(borrados > 0 ? [`Se borran ${borrados} paso(s): hoy tiene ${s.pasos.length}.`] : []),
      ];
      return {
        payload: { id, pasos },
        resumen: `Reemplazar los pasos de «${s.nombre}» (#${id}) por ${pasos.length}: ${pasos.map((p) => `${p.orden}) +${p.delay_horas} h «${recorte(p.asunto, 60)}»`).join(' · ')}. ${avisos.join(' ')}`,
      };
    },
    ejecutar: async (payload): Promise<Ejecutado> => {
      const id = Number(payload.id);
      if (!(await secuenciaEmail(id))) return { ok: false, resumen: noSecuencia(id) };
      const pasos = (Array.isArray(payload.pasos) ? payload.pasos as PasoSecuencia[] : []).map((p) => ({ ...p, canal: 'email' as const, template_wa: null }));
      if (!pasos.length) return { ok: false, resumen: 'No llegaron pasos: no se tocó la secuencia.' };
      await setSecuenciaPasos(id, pasos);
      return { ok: true, resumen: `Secuencia de email #${id} con ${pasos.length} paso(s) guardados.` };
    },
  },

  crear_broadcast: {
    preparar: async (input) => {
      const segmento = str(input, 'segmento') ?? 'activos';
      if (!esSegmentoValido(segmento)) return { error: `El segmento «${segmento}» no existe.`, disponibles: SEGMENTOS.map((s) => s.value) };
      const asunto = str(input, 'asunto');
      const cuerpo = str(input, 'cuerpo');
      if (!asunto || !cuerpo) return { error: 'Un broadcast necesita asunto y cuerpo.', faltan: [...(!asunto ? ['asunto'] : []), ...(!cuerpo ? ['cuerpo'] : [])] };
      const leads = await contarSegmento(segmento);
      return {
        payload: { asunto, preheader: str(input, 'preheader') ?? '', cuerpo, segmento },
        resumen: `Crear el borrador de broadcast «${recorte(asunto, 80)}» para el segmento «${labelDe(SEGMENTOS, segmento)}» (${leads} leads hoy). No se envía nada.${leads > TOPE_ENVIO ? ` OJO: con más de ${TOPE_ENVIO} leads hoy no se va a poder enviar ni programar.` : ''}`,
      };
    },
    ejecutar: async (payload): Promise<Ejecutado> => {
      const preheader = String(payload.preheader ?? '');
      const id = await crearBroadcast({ asunto: String(payload.asunto), cuerpo: String(payload.cuerpo), segmento: String(payload.segmento), ...(preheader ? { preheader } : {}) });
      return { ok: true, resumen: `Borrador de broadcast #${id} creado.`, datos: { id } };
    },
  },

  editar_broadcast: {
    preparar: async (input) => {
      const id = num(input, 'id')!;
      const b = await broadcastPorId(id);
      if (!b) return { error: noBroadcast(id) };
      if (!EDITABLE.has(b.estado)) return { error: `El broadcast #${id} está «${b.estado}»: ya no se edita.` };
      if (await enManosDelCron(b)) return { error: msgEnManosDelCron(id) };
      const asunto = str(input, 'asunto');
      const preheader = str(input, 'preheader');
      const cuerpo = str(input, 'cuerpo');
      const segmento = str(input, 'segmento');
      if (segmento !== undefined && !esSegmentoValido(segmento)) return { error: `El segmento «${segmento}» no existe.`, disponibles: SEGMENTOS.map((s) => s.value) };
      if ([asunto, preheader, cuerpo, segmento].every((x) => x === undefined)) return { error: 'No hay nada que cambiar: manda asunto, preheader, cuerpo o segmento.', faltan: ['asunto', 'preheader', 'cuerpo', 'segmento'] };
      const partes: string[] = [];
      if (asunto !== undefined) partes.push(`asunto → «${recorte(asunto, 80)}»`);
      if (preheader !== undefined) partes.push('preheader nuevo');
      if (cuerpo !== undefined) partes.push(`cuerpo nuevo (${cuerpo.length} caracteres)`);
      if (segmento !== undefined) {
        const n = await contarSegmento(segmento);
        if (b.estado === 'programado' && n > TOPE_ENVIO) return { error: `${MSG_TOPE_SEGMENTO(n)} El broadcast #${id} está programado: con este segmento saldría a medias.` };
        partes.push(`segmento ${b.segmento} → ${segmento} (${n} leads hoy${n > TOPE_ENVIO ? `: con más de ${TOPE_ENVIO} no se va a poder enviar` : ''})`);
      }
      return {
        payload: { id, ...(asunto !== undefined ? { asunto } : {}), ...(preheader !== undefined ? { preheader } : {}), ...(cuerpo !== undefined ? { cuerpo } : {}), ...(segmento !== undefined ? { segmento } : {}) },
        resumen: `Broadcast #${id} «${recorte(b.asunto, 60)}»: ${partes.join('; ')}.${b.estado === 'programado' ? ' Está PROGRAMADO: sale con estos cambios.' : ''}`,
      };
    },
    ejecutar: async (payload): Promise<Ejecutado> => {
      const id = Number(payload.id);
      const b = await broadcastPorId(id);
      if (!b) return { ok: false, resumen: noBroadcast(id) };
      if (!EDITABLE.has(b.estado)) return { ok: false, resumen: `El broadcast #${id} ya está «${b.estado}»: no se tocó.` };
      if (await enManosDelCron(b)) return { ok: false, resumen: msgEnManosDelCron(id) };
      const s = (k: string) => (typeof payload[k] === 'string' ? payload[k] as string : undefined);
      await actualizarBroadcast(id, { asunto: s('asunto'), preheader: s('preheader'), cuerpo: s('cuerpo'), segmento: s('segmento') });
      return { ok: true, resumen: `Broadcast #${id} actualizado.` };
    },
  },

  programar_broadcast: {
    preparar: async (input) => {
      const id = num(input, 'id')!;
      const b = await broadcastPorId(id);
      if (!b) return { error: noBroadcast(id) };
      if (!EDITABLE.has(b.estado)) return { error: `El broadcast #${id} está «${b.estado}»: no se puede programar.` };
      if (await enManosDelCron(b)) return { error: msgEnManosDelCron(id) };
      const crudo = str(input, 'programado_at') ?? '';
      // Sin zona horaria, Date.parse usa la del servidor (UTC en producción): un
      // «15:00» de México saldría 6 horas antes. Se exige explícita.
      if (!/(Z|[+-]\d{2}:?\d{2})$/i.test(crudo)) return { error: 'La fecha tiene que llevar zona horaria (ej. 2026-09-20T15:00:00-06:00 o terminada en Z).', faltan: ['programado_at'] };
      const ms = Date.parse(crudo);
      if (!Number.isFinite(ms)) return { error: `«${crudo}» no es una fecha válida en ISO 8601.`, faltan: ['programado_at'] };
      if (ms < Date.now() + 60_000) return { error: 'La fecha tiene que ser futura. Para mandarlo ahora, usa enviar_broadcast.' };
      if (ms > Date.now() + 366 * 86400_000) return { error: 'La fecha está a más de un año: revisa el año.' };
      // La zona se LEE (tzGuardada), no se resuelve: tzDeWorkspace la escribe cuando falta.
      const [leads, envioOn, sandbox, tzLeida] = await Promise.all([contarSegmento(b.segmento), envioEmailHabilitado(), remitenteEsSandbox(), tzGuardada()]);
      const tz = tzLeida ?? 'UTC';
      if (leads === 0) return { error: `El segmento «${labelDe(SEGMENTOS, b.segmento)}» no tiene leads con email: no hay a quién mandarlo.` };
      if (leads > TOPE_ENVIO) return { error: MSG_TOPE_SEGMENTO(leads) };
      const iso = new Date(ms).toISOString();
      const turno = primerTurnoCron(ms);
      const avisos = [
        turno !== ms ? `El envío automático solo corre a las :00 y :30 entre las 13:00 y las 23:30 UTC: no sale a la hora pedida sino en el primer turno, el ${fmtFecha(new Date(turno).toISOString(), tz)}.` : '',
        !envioOn ? 'El envío real está APAGADO: al vencer no sale y queda programado hasta que se prenda.' : '',
        envioOn && sandbox ? 'El remitente es el sandbox de Resend: el envío se va a rechazar hasta configurar un remitente propio.' : '',
        !tzLeida ? 'Este negocio no tiene zona horaria guardada: las horas se muestran en UTC.' : '',
      ].filter(Boolean);
      return {
        payload: { id, programado_at: iso },
        resumen: `Programar el broadcast #${id} «${recorte(b.asunto, 80)}» para el ${fmtFecha(iso, tz)} (${tz}) al segmento «${labelDe(SEGMENTOS, b.segmento)}»: ${leads} leads hoy. ${avisos.join(' ')}`.trim(),
      };
    },
    ejecutar: async (payload): Promise<Ejecutado> => {
      const id = Number(payload.id);
      const b = await broadcastPorId(id);
      if (!b) return { ok: false, resumen: noBroadcast(id) };
      if (!EDITABLE.has(b.estado)) return { ok: false, resumen: `El broadcast #${id} ya está «${b.estado}»: no se programó.` };
      if (await enManosDelCron(b)) return { ok: false, resumen: msgEnManosDelCron(id) };
      const leads = await contarSegmento(b.segmento);
      if (leads > TOPE_ENVIO) return { ok: false, resumen: MSG_TOPE_SEGMENTO(leads) };
      const iso = String(payload.programado_at);
      await actualizarBroadcast(id, { programado_at: iso, estado: 'programado' });
      const turno = new Date(primerTurnoCron(Date.parse(iso))).toISOString();
      return { ok: true, resumen: `Broadcast #${id} programado para ${iso} (UTC); el envío automático lo toma en su primer turno, ${turno} (UTC).`, datos: { programado_at: iso, primer_turno_utc: turno } };
    },
  },

  enviar_broadcast: {
    preparar: async (input) => {
      const id = num(input, 'id')!;
      const b = await broadcastPorId(id);
      if (!b) return { error: noBroadcast(id) };
      if (b.estado === 'enviado') return { error: `El broadcast #${id} ya se envió y no se reenvía.` };
      if (b.estado === 'enviando') return { error: `El broadcast #${id} se está enviando: si se cortó, el envío automático lo retoma solo.` };
      if (b.estado === 'programado') return { error: `El broadcast #${id} está programado: mandarlo ahora puede pisarse con el envío automático y duplicar emails. Primero cancela la programación (cancelar_programacion_broadcast) o espera al envío automático.` };
      const [envioOn, sandbox, leads] = await Promise.all([envioEmailHabilitado(), remitenteEsSandbox(), contarSegmento(b.segmento)]);
      if (!envioOn) return { error: 'El envío real de email está apagado. Enviar así marcaría el broadcast como enviado sin mandar nada, y ya no se podría reenviar. Primero hay que prenderlo (activar_envio_real_email).' };
      if (sandbox) return { error: 'El remitente es el sandbox de Resend, que no entrega a terceros: primero hay que verificar el dominio y fijar un remitente propio en /email.' };
      if (leads === 0) return { error: `El segmento «${labelDe(SEGMENTOS, b.segmento)}» no tiene leads con email.` };
      if (leads > TOPE_ENVIO) return { error: MSG_TOPE_SEGMENTO(leads) };
      return {
        payload: { id },
        resumen: `Enviar AHORA el broadcast #${id} «${recorte(b.asunto, 80)}» al segmento «${labelDe(SEGMENTOS, b.segmento)}»: ${leads} destinatarios, menos quienes recibieron un email en las últimas 20 h. Es irreversible y gasta cuota de Resend.`,
      };
    },
    ejecutar: async (payload): Promise<Ejecutado> => {
      const id = Number(payload.id);
      // Se vuelve a mirar: si el interruptor se apagó entre el «sí» y ahora,
      // enviarBroadcast quemaría el broadcast en simulado.
      if (!(await envioEmailHabilitado())) return { ok: false, resumen: 'El envío real se apagó antes de confirmar: no se envió nada y el broadcast sigue intacto.' };
      if (await remitenteEsSandbox()) return { ok: false, resumen: 'El remitente es el sandbox de Resend: no se envió nada.' };
      // El estado y el segmento pudieron cambiar entre el «sí» y ahora.
      const b = await broadcastPorId(id);
      if (!b) return { ok: false, resumen: noBroadcast(id) };
      if (b.estado !== 'borrador' && b.estado !== 'cancelado') return { ok: false, resumen: `El broadcast #${id} está «${b.estado}»: no se envió nada.` };
      const leads = await contarSegmento(b.segmento);
      if (leads > TOPE_ENVIO) return { ok: false, resumen: MSG_TOPE_SEGMENTO(leads) };
      const r = await enviarBroadcast(id);
      const conteo = `${r.enviados} enviados, ${r.fallos} con fallo, ${r.saltados} salteados por contacto reciente, de ${r.total}`;
      if (!r.ok) return { ok: false, resumen: `No se envió: ${r.error ?? 'sin detalle'}.`, datos: { ...r } };
      if (r.error) return { ok: true, resumen: `Envío parcial (${conteo}): se cortó por tiempo o por el límite de Resend y el envío automático lo retoma solo.`, datos: { ...r } };
      return { ok: true, resumen: `Broadcast #${id} enviado: ${conteo}.${r.truncado ? ' El segmento pasaba del tope y el resto quedó afuera.' : ''}`, datos: { ...r } };
    },
  },

  enviar_prueba_broadcast: {
    preparar: async (input) => {
      const id = num(input, 'id')!;
      const email = str(input, 'emailPrueba') ?? '';
      if (!/^[^\s@<>,;"]+@[^\s@<>,;"]+\.[^\s@<>,;"]{2,}$/.test(email)) return { error: `«${email}» no parece una dirección de email válida.`, faltan: ['emailPrueba'] };
      const b = await broadcastPorId(id);
      if (!b) return { error: noBroadcast(id) };
      const sandbox = await remitenteEsSandbox();
      return {
        payload: { id, emailPrueba: email },
        resumen: `Mandar una prueba del broadcast #${id} «${recorte(b.asunto, 80)}» a ${email}.${sandbox ? ' OJO: el remitente es el sandbox de Resend y la prueba solo llega si esa dirección es la del dueño de la cuenta de Resend.' : ''}`,
      };
    },
    ejecutar: async (payload): Promise<Ejecutado> => {
      const id = Number(payload.id);
      const email = String(payload.emailPrueba ?? '');
      const r = await enviarBroadcastPrueba(id, email);
      return r.ok ? { ok: true, resumen: `Prueba del broadcast #${id} enviada a ${email}.` } : { ok: false, resumen: `No se pudo mandar la prueba: ${r.error ?? 'sin detalle'}.` };
    },
  },

  eliminar_broadcast: {
    preparar: async (input) => {
      const id = num(input, 'id')!;
      const b = await broadcastPorId(id);
      if (!b) return { error: noBroadcast(id) };
      if (!EDITABLE.has(b.estado)) return { error: `El broadcast #${id} está «${b.estado}»: no se borra, porque se perdería el registro de sus envíos.` };
      if (await enManosDelCron(b)) return { error: msgEnManosDelCron(id) };
      return { payload: { id }, resumen: `Borrar el broadcast #${id} «${recorte(b.asunto, 80)}» (${b.estado}). No se puede deshacer.` };
    },
    ejecutar: async (payload): Promise<Ejecutado> => {
      const id = Number(payload.id);
      const b = await broadcastPorId(id);
      if (!b) return { ok: false, resumen: noBroadcast(id) };
      if (!EDITABLE.has(b.estado)) return { ok: false, resumen: `El broadcast #${id} ya está «${b.estado}»: no se borró.` };
      if (await enManosDelCron(b)) return { ok: false, resumen: msgEnManosDelCron(id) };
      await eliminarBroadcast(id);
      return { ok: true, resumen: `Broadcast #${id} borrado.` };
    },
  },

  activar_envio_real_email: {
    preparar: async (input) => {
      const on = input.on === true;
      const [actual, conectado, alcance] = await Promise.all([envioEmailHabilitado(), emailConectado(), alcanceEnvioReal()]);
      if (on && !conectado) return { error: 'El email no está conectado (falta la key o el remitente sigue en sandbox): primero hay que verificar el dominio y fijar el remitente en /email. Revisa estado_email.' };
      const activas = alcance.secuencias_con_email;
      const programados = alcance.broadcasts_programados;
      const ya = actual === on ? ` Ya estaba ${on ? 'prendido' : 'apagado'}.` : '';
      return {
        payload: { on },
        resumen: on
          ? `PRENDER el envío real de email.${ya} Desde la próxima corrida salen de verdad los pasos de email de ${activas} secuencia(s) activa(s) (incluidas las que mezclan WhatsApp y email) y ${programados} broadcast(s) programado(s), también los que ya vencieron. Esos emails no se pueden deshacer y gastan cuota de Resend; apagar después solo frena los siguientes.`
          : `APAGAR el envío real de email.${ya} Todo pasa a registrarse como «simulado». Los reportes por email de MaKo no dependen de este interruptor.`,
      };
    },
    ejecutar: async (payload): Promise<Ejecutado> => {
      const on = payload.on === true;
      if (on && !(await emailConectado())) return { ok: false, resumen: 'El email dejó de estar conectado: no se prendió el envío real.' };
      await setEnvioEmail(on);
      return { ok: true, resumen: on ? 'Envío real de email prendido.' : 'Envío real de email apagado: todo queda simulado.' };
    },
  },
};
