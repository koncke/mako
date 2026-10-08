// =============================================================================
// api-mako/areas/chatbot.run — los cuerpos del área `chatbot`
// =============================================================================
// Un runner por id de chatbot.def.ts. Lecturas: { leer }. Acciones: { preparar,
// ejecutar }; las heredadas de lib/mako-doer-acciones.ts se ENVUELVEN (siete tests
// leen ese archivo por regex: los cuerpos no se mudan). Todo corre adentro de
// runWithWorkspace(ctx.ws): las libs que usan getTenantDb scopean solas.
//
// ⚠️ NADA ESCRIBE EN leer() NI EN preparar(). La pantalla genérica /mako/revisar
// guarda el INPUT y al confirmar vuelve a llamar preparar(input): por eso cada
// preparar acepta exactamente los `parametros` declarados y revalida contra la base.
// =============================================================================

import 'server-only';
import type { Ctx, Runners, SalidaLectura } from '../tipos';
import { crearRunnerAcciones, ejecutarAccion } from '@/lib/mako-doer-acciones';
import { getSecuenciasConStats, setSecuenciaPasos, planificarInscripciones, planificarEnvios, inscribirEnSecuencia, type PasoSecuencia, type InscripcionManual } from '@/lib/nutricion';
import { motivoNoInscribe } from '@/lib/nutricion-inscripcion-manual';
import { logLeadEvent } from '@/lib/leads';
import { tzDeWorkspace, TZ_DEFAULT } from '@/lib/timezone';
import { PREFIJO_FLUJO } from '../canal';
import { proveedorDelPaso } from '@/lib/nutricion-canal';
import { getSettingData, guardarEstrategia, crearSecuenciaDesdeEtapa, probarSecuencia, muestraParaCriterio } from '@/lib/setting-secuencias';
import { parseEstrategia, OBJETIVOS, type Estrategia, type EscenarioSecuencia } from '@/lib/setting-estrategia';
import { huecosDeSecuencias, archivarSecuencias } from '@/lib/secuencias-huecos';
import { handoffsPendientes, resolverHandoff } from '@/lib/chat-agent-handoff';
import { contextoDe } from '@/lib/etapas-contexto';
import { listAudios, audioUrlFirmada, getAudio, borrarAudio } from '@/lib/setting-audios';
import { audiosDe, guionDe, esPublico, KEY_PUBLICO, KEY_LINK_VIDEO } from '@/lib/audios-paso';
import { escenariosDe } from '@/lib/chat-agent-escenarios';
import { getEvidencia, getManual, huecosDeVoz } from '@/lib/chat-agent-voz';
import { getVozGuia, destilarVoz } from '@/lib/nutricion-generator';
import { responderSimulador, evaluarCalificacion, type TurnoSim } from '@/lib/setting-simulador';
import { getEstadoTab, tabOnboardingDef, reabrirOnboardingTab, TAB_ONBOARDINGS } from '@/lib/tab-onboarding-state';
import { getEntregables } from '@/lib/entregable';
import { estadoPlantillasSecuencia, plantillaDesdePaso } from '@/lib/nutricion-plantillas';
import { armarSecuenciasDeAudios } from '@/lib/secuencias-audios';
import { getContactoReportes } from '@/lib/perfil';
import { getSetting, setSetting } from '@/lib/settings';
import { getFunnelDefault } from '@/lib/funnels';
import {
  secuenciaFila, inscripcionesVivas, handoffFila, inscripcionesDeLead, TOPE_INSCRIPCIONES_LEAD,
  estadoCanalWhatsapp, etapasParaSecuencia, leerObjetivosCustom, esObjetivoDelCatalogo, agregarObjetivoCustom, TOPE_OBJETIVOS_CUSTOM,
  leerAudiosPorClave, asignarAudioAClave, quitarAudioDeClaves, insumosAudios, leerEnsayo, crearLeadMagnet,
  responderHuecosVoz, CLAVES_BLOQUE_VOZ, secuenciasArchivadas, TOPE_ARCHIVADAS, desarchivarYPausar, secuenciasChatAgent,
} from './chatbot.helpers';

// ── utilidades ───────────────────────────────────────────────────────────────

const legado = (ctx: Ctx) => crearRunnerAcciones(ctx.ws, ctx.canalKey, ctx.turnStart ?? 0, ctx.mensajeUsuario ?? '');
const texto = async (p: Promise<string | { content: string; isError?: boolean }>) => { const r = await p; return typeof r === 'string' ? r : r.content; };
const json = (x: unknown): string => JSON.stringify(x);
const errorLectura = (msg: string): SalidaLectura => ({ content: msg, isError: true });
const num = (input: Record<string, unknown>, k: string): number => Number(input[k]);
const str = (input: Record<string, unknown>, k: string): string => (typeof input[k] === 'string' ? (input[k] as string).trim() : '');

// Hasta el 17/09 acá había un `avisoTope()` que contaba las filas reales y avisaba
// «los conteos quedan CORTOS» porque getSecuenciasConStats, getSettingData y
// planificarInscripciones/Envios leían sin paginar. Las cuatro paginan ahora, así
// que el aviso pasó a ser falso y se sacó: un aviso que miente enseña a ignorar
// los que no mienten. Si una lectura vuelve a cortar, se arregla la lectura.

const ventana30 = () => {
  const hasta = new Date();
  return { desde: new Date(hasta.getTime() - 30 * 86400 * 1000).toISOString().slice(0, 10), hasta: hasta.toISOString().slice(0, 10), dias: 30 };
};

/** Las situaciones de audio que armarSecuenciasDeAudios (lib/secuencias-audios.ts) convierte en secuencia,
 *  con la clave de la secuencia que arma. Las otras claves del catálogo no las consume. */
const AUDIO_A_SECUENCIA: Record<string, string> = {
  bienvenida: 'chat-agent-bienvenida',
  agenda_con_bienvenida: 'chat-agent-post-agenda-conocido',
  agenda_primer_contacto: 'chat-agent-post-agenda-nuevo',
};

async function secuenciaVigente(id: number) {
  return (await getSecuenciasConStats()).find((s) => s.id === id) ?? null;
}

const noExiste = (id: number) => `No existe la secuencia #${id} vigente en este negocio (puede estar archivada). Pide el id con listar_secuencias_nutricion.`;

const historialDe = (input: Record<string, unknown>): TurnoSim[] =>
  (Array.isArray(input.historial) ? (input.historial as Array<Record<string, unknown>>) : [])
    .filter((t) => (t.de === 'lead' || t.de === 'negocio') && typeof t.texto === 'string' && t.texto.trim())
    .map((t) => ({ de: t.de as TurnoSim['de'], texto: String(t.texto) }))
    .slice(-30);

/** Por qué no se inscribe, en la frase que lee la persona: sale de lib/nutricion-inscripcion-manual.ts
 *  (puro, con test), incluido el id que no es de este negocio. */
const noSeInscribe = (v: Extract<InscripcionManual, { inscribe: false }>, leadId: number, secuenciaId: number): string =>
  motivoNoInscribe(v.porque, { secuenciaId, secuencia: v.secuencia?.nombre, leadId, lead: v.lead?.nombre });

/** ¿Lo pide un paso «⚡ Acción» de un flujo? La clave de scope lo dice (lib/api-mako/canal.ts). */
const desdeUnFlujo = (ctx: Ctx): boolean => ctx.canalKey.startsWith(PREFIJO_FLUJO);

/** Cuándo sale el primer paso, en la zona del negocio. El motor manda de 9 a 21 y con un tope
 *  diario: es «desde», no «a las». Desde un flujo no hay vía rápida (lib/nutricion.ts →
 *  inscribirEnSecuencia): lo que ya toca lo manda la próxima vuelta del cron. */
async function cuandoSale(iso: string, ws: number, porElCron: boolean): Promise<string> {
  if (Date.parse(iso) <= Date.now() + 60_000) {
    return porElCron ? 'el primer mensaje sale en la próxima vuelta del motor (cada hora, en horario de envío)' : 'el primer mensaje sale ya, si es horario de envío';
  }
  const tz = await tzDeWorkspace(ws).catch(() => TZ_DEFAULT);
  let cuando = iso;
  try { cuando = new Date(iso).toLocaleString('es-MX', { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', hour12: false, timeZone: tz }); } catch { /* el ISO tal cual */ }
  return `el primer mensaje sale desde el ${cuando}`;
}

/** El detector de copy sin terminar del motor (RX_RELLENO en lib/nutricion.ts, que no lo exporta):
 *  un paso con un [corchete] que no sea [tu link …] NO sale nunca y se reprograma cada 24 h. */
const RX_RELLENO = /\[(?!tu link)[^\]\n]{2,80}\]/i;

// ── runners ──────────────────────────────────────────────────────────────────

export const RUNNERS: Runners = {
  // ═══ Lecturas ════════════════════════════════════════════════════════════
  listar_secuencias_nutricion: { leer: (input, ctx) => texto(legado(ctx)('listar_secuencias_nutricion', input)) },

  ficha_secuencia_mensajes: {
    leer: async (input) => {
      const id = num(input, 'secuenciaId');
      const { secuencias } = await getSettingData();
      const s = secuencias.find((x) => x.id === id);
      if (!s) return errorLectura(noExiste(id));
      return json({
        id: s.id, clave: s.clave, nombre: s.nombre, etapa: s.etapa, trigger: s.trigger_tipo, activa: s.activa,
        pasos: s.pasos.map((p) => ({
          orden: p.orden, canal: p.canal, delay_horas: p.delay_horas, ancla: p.ancla ?? null, tipo: p.tipo ?? 'texto',
          audio_id: p.audio_id ?? null, requiere: p.requiere ?? null, proveedor: p.canal === 'whatsapp' ? proveedorDelPaso(p) : null,
          asunto: p.asunto, cuerpo: p.cuerpo, variantes: (p.variantes ?? []).length, plantilla_meta: p.template_wa,
          sin_terminar: RX_RELLENO.test(p.cuerpo) || RX_RELLENO.test(p.asunto ?? ''),
        })),
        estrategia: s.estrategia,
        metricas_30d: { ventana: ventana30(), ...s.metricas },
        historico: { inscriptos: s.inscriptos, enviados: s.enviados },
        notas: [
          'Un paso con sin_terminar=true no sale nunca: el motor lo reprograma cada 24 h.',
          'Los [tu link …] salen literales al lead: nada los reemplaza.',
          'activa=true no garantiza envíos: mira estado_canal_whatsapp_chatbot.',
        ],
      });
    },
  },

  metricas_chatbot: {
    leer: async (input) => {
      const filtro = input.secuenciaId != null ? num(input, 'secuenciaId') : null;
      const { secuencias, serie } = await getSettingData();
      const elegidas = filtro != null ? secuencias.filter((s) => s.id === filtro) : secuencias;
      if (filtro != null && !elegidas.length) return errorLectura(noExiste(filtro));
      return json({
        ventana: ventana30(),
        por_secuencia: elegidas.map((s) => ({ id: s.id, nombre: s.nombre, activa: s.activa, ...s.metricas })),
        // La serie diaria es del negocio entero: la lib no la separa por secuencia.
        serie_diaria_negocio: serie,
        notas: [
          'aperturas y clics existen solo para email; WhatsApp no informa aperturas.',
          'respuestas = inscripciones pausadas porque el lead contestó (la fecha es la de la pausa).',
          'Los envíos en borrador y simulados no cuentan como enviados.',
        ],
      });
    },
  },

  huecos_secuencias: {
    leer: async () => {
      const huecos = await huecosDeSecuencias();
      return json({ huecos, nota: huecos.length ? 'Cada etapa de la lista no tiene ninguna secuencia (ni pausada).' : 'Todas las etapas de nutrición del funnel tienen al menos una secuencia (activa o pausada).' });
    },
  },

  listar_handoffs_pendientes: {
    leer: async () => {
      const lista = await handoffsPendientes();
      return json({ total: lista.length, tope: 50, handoffs: lista, nota: lista.length === 50 ? 'Se muestran los 50 más recientes; puede haber más.' : null });
    },
  },

  estado_canal_whatsapp_chatbot: { leer: async () => json(await estadoCanalWhatsapp()) },

  contexto_etapa: {
    leer: async (input) => {
      const etapa = str(input, 'etapa');
      const c = contextoDe(etapa);
      return json({ etapa, contexto: c, nota: c ? null : 'Esta etapa no tiene contexto escrito (es personalizada o no existe): no lo inventes.' });
    },
  },

  etapas_para_secuencia: { leer: async () => json({ etapas: await etapasParaSecuencia() }) },

  listar_objetivos_secuencia: {
    leer: async () => json({ catalogo: OBJETIVOS, propios: await leerObjetivosCustom(), tope_propios: TOPE_OBJETIVOS_CUSTOM }),
  },

  listar_audios: {
    leer: async () => {
      const [audios, porClave, linkVideo, publico] = await Promise.all([
        listAudios(), leerAudiosPorClave(), getSetting(KEY_LINK_VIDEO).catch(() => null), getSetting(KEY_PUBLICO).catch(() => null),
      ]);
      const vivos = new Set(audios.map((a) => a.id));
      const conUrl = await Promise.all(audios.map(async (a) => ({
        id: a.id, titulo: a.titulo, duracion_s: a.duracion_s, transcripcion: a.transcript, creado: a.created_at,
        url_escuchar_12h: await audioUrlFirmada(a.media_path),
      })));
      return json({
        audios: conUrl,
        por_situacion: Object.fromEntries(Object.entries(porClave).filter(([, id]) => vivos.has(id))),
        link_video: (linkVideo ?? '').trim() || null,
        publico: esPublico(publico) ? publico : 'mixto',
        nota: 'transcripcion null = no se pudo transcribir, no que el audio esté vacío.',
      });
    },
  },

  audios_requeridos: {
    leer: async () => {
      const [ins, porClave, audios] = await Promise.all([insumosAudios(), leerAudiosPorClave(), listAudios()]);
      if (!ins.entradas.length) return json({ requeridos: [], nota: 'El negocio no declaró por dónde le llegan los leads en su funnel: sin eso no se piden audios. Hay que declararlo primero en el funnel.' });
      const vivos = new Set(audios.map((a) => a.id));
      return json({
        requeridos: audiosDe(ins.entradas, ins.canal).map((d) => ({
          clave: d.clave, titulo: d.titulo, situacion: d.situacion,
          guion: guionDe(d, { linkVideo: ins.linkVideo, evento: ins.evento }),
          grabado: porClave[d.clave] != null && vivos.has(porClave[d.clave]),
        })),
      });
    },
  },

  guia_voz_negocio: {
    leer: async () => {
      const [guia, evidencia, manual] = await Promise.all([getVozGuia(), getEvidencia(), getManual()]);
      return json({ guia, evidencia, contestado_a_mano: manual, huecos: huecosDeVoz(evidencia, manual), nota: guia ? null : 'Todavía no hay guía de voz: MaKo escribe sin conocer el tono del negocio.' });
    },
  },

  escenarios_ensayo: {
    leer: async () => {
      const ins = await insumosAudios();
      const lista = escenariosDe(!!ins.linkVideo, ins.entradas, ins.canal);
      return json({
        escenarios: lista.map((e) => ({ id: e.id, titulo: e.titulo, objetivo: e.objetivo, audio: e.audio, desenlace: e.desenlace, minRespuestas: e.minRespuestas, obligatorio: e.obligatorio })),
        nota: ins.entradas.length ? null : 'Sin entradas de leads declaradas en el funnel no aplica ningún caso.',
      });
    },
  },

  ensayo_hecho: { leer: async () => json({ hechos: await leerEnsayo() }) },

  simular_respuesta_setter: {
    leer: async (input) => {
      const historial = historialDe(input);
      if (!historial.length || historial[historial.length - 1].de !== 'lead') return errorLectura('El último mensaje del historial tiene que ser del lead: es lo que MaKo contesta.');
      const r = await responderSimulador(num(input, 'secuenciaId'), historial);
      if (!r.ok) return errorLectura(r.error);
      return json({ respuesta: r.respuesta, desenlace: r.desenlace, nota: 'Simulación: no se envió ni se guardó nada. Los [tu link …] salen literales.' });
    },
  },

  evaluar_calificacion_charla: {
    leer: async (input) => {
      const historial = historialDe(input);
      if (!historial.length) return errorLectura('Falta la conversación.');
      const r = await evaluarCalificacion(num(input, 'secuenciaId'), historial);
      return json({ ...r, turnos_evaluados: Math.min(historial.length, 14), nota: 'califica null = sin criterio o sin evidencia; no es un «no».' });
    },
  },

  muestra_para_criterio: {
    leer: async (input) => {
      const limite = input.limite != null ? num(input, 'limite') : 60;
      const filas = await muestraParaCriterio(limite);
      return json({
        combinaciones_distintas: filas.length, limite_por_grupo: limite,
        combinaciones_por_tipo: { calificados: filas.filter((f) => f.calificado === true).length, no_calificados: filas.filter((f) => f.calificado === false).length, cerraron: filas.filter((f) => f.cerro === true).length },
        filas,
        nota: 'Los conteos son de COMBINACIONES distintas de respuestas, no de leads: los leads con las mismas respuestas se juntan en una fila. No trae nombres ni contactos.',
      });
    },
  },

  estado_onboarding_chatbot: {
    leer: async (input) => {
      const tab = str(input, 'tab') || 'setting';
      const [estado, def] = [await getEstadoTab(tab), tabOnboardingDef(tab)];
      if (!def) return errorLectura(`La tab «${tab}» no tiene onboarding.`);
      return json({
        tab, lista: estado.status === 'done',
        pasos: def.pasos.map((p) => ({ key: p.key, label: p.label, opcional: !!p.opcional, hecho: !!estado.steps[p.key]?.done, at: estado.steps[p.key]?.at ?? null })),
      });
    },
  },

  plantillas_meta_de_secuencia: {
    leer: async (input) => {
      const id = num(input, 'secuenciaId');
      if (!(await secuenciaVigente(id))) return errorLectura(noExiste(id));
      const pasos = await estadoPlantillasSecuencia(id);
      return json({ pasos, nota: pasos.length ? 'Estado del catálogo local de plantillas, no consultado a Meta en vivo.' : 'Ningún paso de esta secuencia va por WhatsApp oficial: no lleva plantillas.' });
    },
  },

  plan_nutricion_hoy: {
    leer: async () => {
      const TOPE = 200;
      const [ins, env] = await Promise.all([planificarInscripciones(), planificarEnvios()]);
      // planificarInscripciones/planificarEnvios paginan desde el 17/09: `total` es el
      // real. Los avisos de «se corta en 1000» que había acá se sacaron por falsos.
      return json({
        inscribiria: { total: ins.length, mostrados: Math.min(ins.length, TOPE), filas: ins.slice(0, TOPE) },
        enviaria: { total: env.length, mostrados: Math.min(env.length, TOPE), filas: env.slice(0, TOPE) },
        nota: 'Simulación: no aplica el tope diario configurado, la pausa de 20 h por lead, la ventana de 9 a 21 (hora de México) ni si el envío del canal está habilitado. Lo que sale de verdad puede ser menos.',
        avisos: [] as string[],
      });
    },
  },

  inscripciones_lead: {
    leer: async (input) => {
      const filas = await inscripcionesDeLead(num(input, 'leadId'));
      return json({
        total: filas.length, tope: TOPE_INSCRIPCIONES_LEAD,
        inscripciones: filas.map((f) => ({
          secuencia_id: f.secuencia_id, secuencia: f.secuencia?.nombre ?? null, archivada: !!f.secuencia?.archivada_at,
          estado: f.estado, pasos_avanzados: f.paso_actual, proximo_envio: f.proximo_envio_at, ultimo_envio: f.ultimo_paso_at,
          desenlace: f.desenlace, desenlace_at: f.desenlace_at, inscripto: f.inscripto_at,
        })),
        nota: filas.length
          ? 'pasos_avanzados incluye pasos omitidos y los que quedaron como borrador para el setter: no son todos envíos. Un lead no vuelve a entrar a una secuencia en la que ya estuvo (completada, cancelada o fallida), salvo a la que prepara una reunión cuando vuelve a agendar para otro día (o, si no se sabe qué reunión preparaba, cuando la vez anterior no le llegó nada): ahí la misma inscripción vuelve a correr, con inscripto en la fecha nueva. A mano (inscribir_lead_secuencia) sí vuelve a una que terminó.'
          : 'Este lead no está ni estuvo en ninguna secuencia (o no existe en este negocio).',
      });
    },
  },

  listar_secuencias_archivadas: {
    leer: async () => {
      const filas = await secuenciasArchivadas();
      return json({
        total: filas.length, tope: TOPE_ARCHIVADAS,
        archivadas: filas.map((s) => ({ id: s.id, nombre: s.nombre, clave: s.clave, etapa: s.etapa, archivada_at: s.archivada_at, prendida_al_archivarse: s.activa })),
        nota: filas.length === TOPE_ARCHIVADAS ? `Se muestran las ${TOPE_ARCHIVADAS} archivadas más recientes; puede haber más.` : (filas.length ? 'Desarchivar las devuelve PAUSADAS.' : 'Este negocio no tiene secuencias archivadas.'),
      });
    },
  },

  // ═══ Acciones por chat ═══════════════════════════════════════════════════
  proponer_toggle_nutricion: {
    proponerLegado: (input, ctx) => texto(legado(ctx)('proponer_toggle_nutricion', input)),
    ejecutar: (payload, ctx) => ejecutarAccion(ctx.ws, 'nutricion_toggle', payload),
  },

  crear_secuencia_mensajes: {
    preparar: async (input) => {
      const etapa = str(input, 'etapa');
      const nombre = str(input, 'nombre');
      const etapas = await etapasParaSecuencia();
      const e = etapas.find((x) => x.value === etapa);
      if (!e) return { error: `«${etapa}» no es una etapa de este funnel donde se pueda colgar una secuencia.`, disponibles: etapas };
      return { payload: { etapa, nombre }, resumen: `Crear la secuencia «${nombre}» en la etapa «${e.label}» (nace pausada y sin texto)` };
    },
    ejecutar: async (payload) => {
      const id = await crearSecuenciaDesdeEtapa(String(payload.etapa), String(payload.nombre));
      return { ok: true, resumen: `Secuencia «${String(payload.nombre)}» creada (#${id}), pausada y con dos pasos sin texto.`, datos: { secuenciaId: id } };
    },
  },

  cambiar_espera_paso: {
    preparar: async (input) => {
      const id = num(input, 'secuenciaId'); const orden = num(input, 'orden'); const horas = num(input, 'delayHoras');
      const s = await secuenciaVigente(id);
      if (!s) return { error: noExiste(id) };
      const p = s.pasos.find((x) => x.orden === orden);
      if (!p) return { error: `La secuencia «${s.nombre}» no tiene paso ${orden} (tiene ${s.pasos.length}).` };
      return { payload: { secuenciaId: id, orden, delayHoras: horas }, resumen: `Paso ${orden} de «${s.nombre}»: espera de ${p.delay_horas} h a ${horas} h` };
    },
    ejecutar: async (payload) => {
      const id = Number(payload.secuenciaId); const orden = Number(payload.orden); const horas = Number(payload.delayHoras);
      const s = await secuenciaVigente(id);
      if (!s || !s.pasos.some((p) => p.orden === orden)) return { ok: false, resumen: 'La secuencia o el paso ya no existen.' };
      await setSecuenciaPasos(id, s.pasos.map((p) => (p.orden === orden ? { ...p, delay_horas: horas } : p)));
      return { ok: true, resumen: `Paso ${orden} de «${s.nombre}» ahora espera ${horas} h. Los envíos ya programados no se recalculan.` };
    },
  },

  asignar_audio_paso: {
    preparar: async (input) => {
      const id = num(input, 'secuenciaId'); const orden = num(input, 'orden');
      const audioId = input.audioId != null ? num(input, 'audioId') : null;
      const s = await secuenciaVigente(id);
      if (!s) return { error: noExiste(id) };
      if (!s.pasos.some((p) => p.orden === orden)) return { error: `La secuencia «${s.nombre}» no tiene paso ${orden}.` };
      if (audioId == null) return { payload: { secuenciaId: id, orden }, resumen: `Quitar el audio del paso ${orden} de «${s.nombre}» (vuelve a ser texto)` };
      const a = await getAudio(audioId);
      if (!a) return { error: `No existe el audio #${audioId} en este negocio. Pide el id con listar_audios.` };
      return { payload: { secuenciaId: id, orden, audioId }, resumen: `Paso ${orden} de «${s.nombre}» → nota de voz «${a.titulo}» (va por WhatsApp no oficial; a leads que todavía no son clientes queda como borrador para que alguien lo mande)` };
    },
    ejecutar: async (payload) => {
      const id = Number(payload.secuenciaId); const orden = Number(payload.orden);
      const audioId = payload.audioId != null ? Number(payload.audioId) : null;
      const s = await secuenciaVigente(id);
      if (!s || !s.pasos.some((p) => p.orden === orden)) return { ok: false, resumen: 'La secuencia o el paso ya no existen.' };
      if (audioId != null && !(await getAudio(audioId))) return { ok: false, resumen: `El audio #${audioId} ya no existe.` };
      const pasos: PasoSecuencia[] = s.pasos.map((p) => {
        if (p.orden !== orden) return p;
        return audioId != null
          ? { ...p, tipo: 'audio', audio_id: audioId, canal: 'whatsapp', proveedor: 'no_oficial' }
          : { ...p, tipo: 'texto', audio_id: null };
      });
      await setSecuenciaPasos(id, pasos);
      return { ok: true, resumen: audioId != null ? `El paso ${orden} de «${s.nombre}» ahora es una nota de voz.` : `El paso ${orden} de «${s.nombre}» volvió a ser texto.` };
    },
  },

  desarchivar_secuencia: {
    preparar: async (input) => {
      const id = num(input, 'secuenciaId');
      const s = await secuenciaFila(id);
      if (!s) return { error: `No existe la secuencia #${id} en este negocio.` };
      if (!s.archivada_at) return { error: `La secuencia «${s.nombre}» no está archivada.` };
      const estaba = s.activa ? 'estaba prendida al archivarse: vuelve PAUSADA y hay que activarla aparte' : 'vuelve pausada';
      return { payload: { secuenciaId: id }, resumen: `Desarchivar la secuencia «${s.nombre}» (${estaba}; las inscripciones canceladas no vuelven)` };
    },
    ejecutar: async (payload) => {
      const id = Number(payload.secuenciaId);
      // Desarchiva y pausa en la misma escritura: archivar no toca `activa`, así que desarchivar a
      // secas volvía a inscribir y a mandar a una secuencia que estaba prendida al archivarse.
      const n = await desarchivarYPausar(id);
      return n ? { ok: true, resumen: `Secuencia #${id} desarchivada y pausada.` } : { ok: false, resumen: 'La secuencia no existe o ya no estaba archivada.' };
    },
  },

  asignar_audio_situacion: {
    preparar: async (input) => {
      const clave = str(input, 'clave'); const audioId = num(input, 'audioId');
      const a = await getAudio(audioId);
      if (!a) return { error: `No existe el audio #${audioId} en este negocio. Pide el id con listar_audios.` };
      const consume = clave in AUDIO_A_SECUENCIA ? '' : ' (ojo: ninguna secuencia automática usa esta situación hoy; queda asignado sin salir)';
      return { payload: { clave, audioId }, resumen: `Usar el audio «${a.titulo}» para la situación «${clave}»${consume}` };
    },
    ejecutar: async (payload) => {
      if (!(await getAudio(Number(payload.audioId)))) return { ok: false, resumen: 'Ese audio ya no existe.' };
      const clave = String(payload.clave);
      await asignarAudioAClave(clave, Number(payload.audioId));
      const sigue = clave in AUDIO_A_SECUENCIA
        ? 'Para que salga, rearma las secuencias desde los audios.'
        : 'Ninguna secuencia automática usa esta situación hoy: queda asignado, pero no sale solo.';
      return { ok: true, resumen: `Audio #${Number(payload.audioId)} asignado a «${clave}». ${sigue}` };
    },
  },

  guardar_publico_audios: {
    preparar: async (input) => {
      const publico = str(input, 'publico');
      if (!esPublico(publico)) return { error: 'El público tiene que ser masculino, femenino o mixto.' };
      return { payload: { publico }, resumen: `Guardar que el negocio le habla a un público ${publico}` };
    },
    ejecutar: async (payload) => {
      await setSetting(KEY_PUBLICO, String(payload.publico));
      return { ok: true, resumen: `Público guardado: ${String(payload.publico)}.` };
    },
  },

  agregar_objetivo_custom: {
    preparar: async (input) => {
      const objetivo = str(input, 'objetivo');
      if (esObjetivoDelCatalogo(objetivo)) return { error: `«${objetivo}» ya es un objetivo del catálogo.` };
      const previos = await leerObjetivosCustom();
      if (previos.some((p) => p.toLowerCase() === objetivo.toLowerCase())) return { error: `El objetivo «${objetivo}» ya existe.` };
      const cae = previos.length >= TOPE_OBJETIVOS_CUSTOM ? ` (hay ${TOPE_OBJETIVOS_CUSTOM}: se descarta el más viejo, «${previos[0]}»)` : '';
      return { payload: { objetivo }, resumen: `Agregar el objetivo propio «${objetivo}»${cae}` };
    },
    ejecutar: async (payload) => {
      const r = await agregarObjetivoCustom(String(payload.objetivo));
      return r.agregado ? { ok: true, resumen: `Objetivo «${String(payload.objetivo)}» agregado.` } : { ok: false, resumen: 'Ese objetivo ya existía.' };
    },
  },

  inscribir_lead_secuencia: {
    // La decisión y la escritura son UNA función (inscribirEnSecuencia, lib/nutricion.ts): acá
    // con `soloVer`, que no escribe; al confirmar, sin él, y vuelve a decidir contra la base.
    preparar: async (input, ctx) => {
      const leadId = num(input, 'leadId'); const secuenciaId = num(input, 'secuenciaId');
      const v = await inscribirEnSecuencia(leadId, secuenciaId, { soloVer: true });
      if (!v.inscribe) return { error: noSeInscribe(v, leadId, secuenciaId) };
      const como = v.como === 'reinicio' ? 'ya la había terminado: vuelve a arrancar desde el primer paso y le repite los mensajes' : 'arranca en el primer paso';
      return {
        payload: { leadId: v.lead.id, secuenciaId: v.secuencia.id },
        resumen: `Meter a ${v.lead.nombre} en «${v.secuencia.nombre}» (${como}); ${await cuandoSale(v.proximoEnvioAt, ctx.ws, desdeUnFlujo(ctx))}`,
      };
    },
    ejecutar: async (payload, ctx) => {
      const leadId = Number(payload.leadId); const secuenciaId = Number(payload.secuenciaId);
      try {
        // Desde un flujo, sin la vía rápida: el paso puede estar corriendo adentro del motor.
        const v = await inscribirEnSecuencia(leadId, secuenciaId, { sinEnvioInmediato: desdeUnFlujo(ctx) });
        if (!v.inscribe) return { ok: false, resumen: noSeInscribe(v, leadId, secuenciaId) };
        // El motor no deja historial al inscribir; una inscripción a mano sí, con quién la pidió.
        await logLeadEvent(v.lead.id, 'Secuencia', `${v.como === 'reinicio' ? 'Vuelve a arrancar' : 'Entra'} en «${v.secuencia.nombre}»`, ctx.actor?.trim() || 'MaKo');
        return {
          ok: true,
          resumen: `Listo: ${v.lead.nombre} ${v.como === 'reinicio' ? 'vuelve a arrancar' : 'quedó'} en «${v.secuencia.nombre}»; ${await cuandoSale(v.proximoEnvioAt, ctx.ws, desdeUnFlujo(ctx))}.`,
          datos: { leadId: v.lead.id, secuenciaId: v.secuencia.id, como: v.como, proximoEnvioAt: v.proximoEnvioAt },
        };
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        console.error('[api-mako chatbot] inscribir_lead_secuencia:', msg);
        return { ok: false, resumen: `No se pudo inscribir al lead #${leadId} en la secuencia #${secuenciaId} (${msg}).` };
      }
    },
  },

  // ═══ Acciones por pantalla (genérica /mako/revisar) ══════════════════════
  reabrir_onboarding_chatbot: {
    // Solo la tab del área (setting): los recorridos de whatsapp y email son de OTRAS áreas.
    preparar: async () => {
      const def = tabOnboardingDef('setting');
      if (!def) return { error: 'El chatbot no tiene onboarding definido.' };
      const compartidos = def.pasos.map((p) => {
        const otras = Object.values(TAB_ONBOARDINGS).filter((d) => d.key !== 'setting' && d.pasos.some((q) => q.key === p.key)).map((d) => d.nombre);
        return otras.length ? `${p.label} (también en ${otras.join(', ')})` : null;
      }).filter(Boolean);
      const suelta = compartidos.length ? `; se sueltan del registro compartido: ${compartidos.join('; ')}` : '';
      return { payload: {}, resumen: `Reabrir desde cero el onboarding del chatbot: /chatbot vuelve a abrir en el recorrido y todos sus pasos se vuelven a pedir${suelta}` };
    },
    ejecutar: async () => {
      await reabrirOnboardingTab('setting');
      return { ok: true, resumen: 'Onboarding del chatbot reabierto.' };
    },
  },
  guardar_estrategia_secuencia: {
    preparar: async (input) => {
      const id = num(input, 'secuenciaId');
      const s = await secuenciaVigente(id);
      if (!s) return { error: noExiste(id) };
      const actual = parseEstrategia(s.estrategia);
      const objetivo = str(input, 'objetivo');
      if (!actual && !objetivo) return { error: 'Esta secuencia todavía no tiene estrategia: el objetivo es obligatorio.', faltan: ['objetivo'] };
      const base: Estrategia = actual ?? parseEstrategia({ objetivo })!;
      const cambios: string[] = [];
      const nueva: Estrategia = { ...base, criterio: { ...base.criterio }, desenlace: { ...base.desenlace } };
      if (objetivo) { nueva.objetivo = objetivo; cambios.push('objetivo'); }
      if (str(input, 'gancho')) { nueva.gancho = str(input, 'gancho'); cambios.push('gancho'); }
      // Una por renglón y NO por comas: la pantalla genérica parte un string[] por comas al confirmar,
      // y «¿Cuánto facturas al mes, más o menos?» se guardaba como dos preguntas. El array se acepta
      // igual por las propuestas que quedaron guardadas con la forma anterior.
      const preguntas = Array.isArray(input.preguntas)
        ? (input.preguntas as unknown[]).map((x) => String(x).trim()).filter(Boolean)
        : typeof input.preguntas === 'string' ? input.preguntas.split(/\r?\n/).map((x) => x.trim()).filter(Boolean) : null;
      if (preguntas) {
        if (preguntas.length > 10) return { error: `Son ${preguntas.length} preguntas: el máximo es 10.` };
        nueva.preguntas = preguntas; cambios.push('preguntas');
      }
      const lm = str(input, 'lead_magnet_id');
      if (lm) {
        const entregables = await getEntregables();
        if (!entregables.some((g) => g.id === lm)) return { error: `«${lm}» no es el id de un lead magnet de este negocio.`, disponibles: entregables.map((g) => ({ id: g.id, nombre: g.nombre })) };
        nueva.lead_magnet_id = lm; cambios.push('lead_magnet_id');
      }
      if (typeof input.usa_lead_magnet === 'boolean') {
        if (input.usa_lead_magnet && !nueva.lead_magnet_id) return { error: 'Para usar un lead magnet, pasa también lead_magnet_id.', faltan: ['lead_magnet_id'] };
        nueva.usa_lead_magnet = input.usa_lead_magnet; cambios.push('usa_lead_magnet');
      } else if (lm) {
        nueva.usa_lead_magnet = true;
      }
      const crit = (input.criterio ?? null) as { califica?: string[]; descalifica?: string[] } | null;
      if (crit?.califica) { nueva.criterio.califica = crit.califica; cambios.push('criterio.califica'); }
      if (crit?.descalifica) { nueva.criterio.descalifica = crit.descalifica; cambios.push('criterio.descalifica'); }
      const des = (input.desenlace ?? null) as Record<string, unknown> | null;
      if (des) {
        for (const k of ['logrado', 'logradoEtapa', 'logradoSecuencia', 'falloHoras', 'falloEtapa', 'falloSecuencia'] as const) {
          if (des[k] != null) { (nueva.desenlace as Record<string, unknown>)[k] = des[k]; cambios.push(`desenlace.${k}`); }
        }
        // El desenlace MUEVE leads desde el cron: una etapa o una secuencia inventada no puede entrar.
        // ⚠️ Hoy valida contra el funnel DEL NEGOCIO porque hay uno solo. Con varios,
        // acá va la UNIÓN de las etapas de todos: si no, una etapa válida del segundo
        // funnel rebota contra el primero y el chatbot se queda sin desenlace.
        const etapasFunnel = new Set((await getFunnelDefault()).stages.map((st) => st.key));
        for (const k of ['logradoEtapa', 'falloEtapa'] as const) {
          const v = des[k];
          if (typeof v === 'string' && !etapasFunnel.has(v)) return { error: `«${v}» (desenlace.${k}) no es una etapa de este funnel.`, disponibles: [...etapasFunnel] };
        }
        const claves = new Set((await getSecuenciasConStats()).map((x) => x.clave));
        for (const k of ['logradoSecuencia', 'falloSecuencia'] as const) {
          const v = des[k];
          if (typeof v === 'string' && !claves.has(v)) return { error: `«${v}» (desenlace.${k}) no es la clave de una secuencia vigente.`, disponibles: [...claves] };
        }
      }
      if (str(input, 'modo')) { nueva.modo = str(input, 'modo') as Estrategia['modo']; cambios.push('modo'); }
      if (str(input, 'notas')) { nueva.notas = str(input, 'notas'); cambios.push('notas'); }
      if (!cambios.length) return { error: 'No pasaste ningún campo para cambiar.' };
      const final = parseEstrategia(nueva);
      if (!final) return { error: 'La estrategia resultante no es válida.' };
      return { payload: { secuenciaId: id, estrategia: final }, resumen: `Estrategia de «${s.nombre}»: cambia ${cambios.join(', ')}` };
    },
    ejecutar: async (payload) => {
      const est = parseEstrategia(payload.estrategia);
      if (!est) return { ok: false, resumen: 'La estrategia no es válida.' };
      await guardarEstrategia(Number(payload.secuenciaId), est);
      return { ok: true, resumen: `Estrategia de la secuencia #${Number(payload.secuenciaId)} guardada.` };
    },
  },

  editar_pasos_secuencia_mensajes: {
    preparar: async (input) => {
      const id = num(input, 'secuenciaId');
      const s = await secuenciaVigente(id);
      if (!s) return { error: noExiste(id) };
      const entrada = (Array.isArray(input.pasos) ? input.pasos : []) as Array<Record<string, unknown>>;
      const avisos: string[] = [];
      const cambiosDeTexto: string[] = [];
      let avisosAudio = false;
      const recorte = (t: string) => (t.length > 80 ? `${t.slice(0, 80)}…` : t);
      const pasos: PasoSecuencia[] = [];
      for (let i = 0; i < entrada.length; i++) {
        const previo = s.pasos[i];
        const e = entrada[i];
        if (!previo && (e.canal == null || e.cuerpo == null || e.delay_horas == null)) {
          return { error: `El paso ${i + 1} es nuevo: necesita canal, delay_horas y cuerpo.`, faltan: [`pasos[${i}].canal`, `pasos[${i}].delay_horas`, `pasos[${i}].cuerpo`] };
        }
        const base: PasoSecuencia = previo ?? { orden: i + 1, canal: 'whatsapp', delay_horas: 0, asunto: null, cuerpo: '', template_wa: null };
        // null = «no lo pasaste» (la pantalla genérica manda null por cada campo vacío): se conserva el previo.
        const cambiosPaso = Object.fromEntries(Object.entries(e).filter(([, v]) => v != null));
        const p = { ...base, ...cambiosPaso, orden: i + 1 } as PasoSecuencia & Record<string, unknown>;
        // «ninguno» quita la condición o el ancla: sin esto no había forma de borrarlas.
        if (p.requiere === ('ninguno' as never)) delete p.requiere;
        if (p.ancla === ('ninguno' as never)) delete p.ancla;
        if (p.tipo === 'texto') p.audio_id = null;
        if (p.tipo === 'audio') {
          if (!p.audio_id || !(await getAudio(Number(p.audio_id)))) return { error: `El paso ${i + 1} es de audio y su audio_id no existe en este negocio.` };
        }
        if (RX_RELLENO.test(p.cuerpo) || RX_RELLENO.test(p.asunto ?? '')) avisos.push(`el paso ${i + 1} tiene un [corchete] y no va a salir nunca`);
        const cambiaTexto = !!previo && e.cuerpo != null && e.cuerpo !== previo.cuerpo;
        if (cambiaTexto) cambiosDeTexto.push(`paso ${i + 1}: «${recorte(previo!.cuerpo)}» → «${recorte(String(e.cuerpo))}»`);
        if (cambiaTexto && (previo!.variantes ?? []).length) avisos.push(`el paso ${i + 1} cambia de texto pero conserva ${previo!.variantes!.length} variantes del texto viejo`);
        // El motor manda sendWhatsappTemplate con template.name: Meta entrega el texto APROBADO, no el cuerpo.
        // No se pone template_wa en null: plantillaDesdePaso (lib/nutricion-plantillas.ts) es idempotente por
        // nombre y volvería a vincular la misma plantilla aprobada con el texto viejo.
        if (cambiaTexto && p.canal === 'whatsapp' && p.proveedor !== 'no_oficial' && p.template_wa) avisos.push(`el paso ${i + 1} es de WhatsApp oficial: sigue saliendo la plantilla aprobada «${p.template_wa}» con el texto anterior hasta editarla en Meta`);
        if (p.tipo === 'audio' && p.canal === 'whatsapp') avisosAudio = true;
        pasos.push(p);
      }
      if (!pasos.length) return { error: 'La lista de pasos está vacía.', faltan: ['pasos'] };
      const borrados = s.pasos.length > pasos.length ? ` y borrar ${s.pasos.length - pasos.length}` : '';
      if (avisosAudio) avisos.push('los pasos de audio a leads que todavía no son clientes quedan como borrador para que alguien los mande');
      return {
        payload: { secuenciaId: id, pasos },
        resumen: `Reescribir los pasos de «${s.nombre}»: quedan ${pasos.length}${borrados}`
          + `${cambiosDeTexto.length ? `. Textos que cambian: ${cambiosDeTexto.join(' · ')}` : ''}`
          + `${avisos.length ? `. Ojo: ${avisos.join('; ')}` : ''}`,
      };
    },
    ejecutar: async (payload) => {
      const id = Number(payload.secuenciaId);
      if (!(await secuenciaVigente(id))) return { ok: false, resumen: 'La secuencia ya no existe o se archivó.' };
      await setSecuenciaPasos(id, payload.pasos as PasoSecuencia[]);
      return { ok: true, resumen: `Pasos de la secuencia #${id} guardados.` };
    },
  },

  agregar_escenario_secuencia: {
    preparar: async (input) => {
      const id = num(input, 'secuenciaId');
      const s = await secuenciaVigente(id);
      if (!s) return { error: noExiste(id) };
      const est = parseEstrategia(s.estrategia);
      if (!est) return { error: `La secuencia «${s.nombre}» no tiene estrategia: guárdala primero con guardar_estrategia_secuencia.` };
      // `contestaSolo` sólo con un `true` literal (#787): el default es el borrador de siempre.
      const escenario: EscenarioSecuencia = {
        titulo: str(input, 'titulo'), cuando: str(input, 'cuando'), comoResponder: str(input, 'comoResponder'),
        ...(input.contestaSolo === true ? { contestaSolo: true } : {}),
      };
      const reemplaza = est.escenarios.some((x) => x.titulo === escenario.titulo);
      if (!reemplaza && est.escenarios.length >= 30) return { error: `La secuencia «${s.nombre}» ya tiene 30 casos, el máximo.` };
      return { payload: { secuenciaId: id, escenario }, resumen: `${reemplaza ? 'Reemplazar' : 'Agregar'} el caso «${escenario.titulo}» en «${s.nombre}»${escenario.contestaSolo ? ' (MaKo contesta solo)' : ''}` };
    },
    ejecutar: async (payload) => {
      const id = Number(payload.secuenciaId);
      const s = await secuenciaVigente(id);
      const est = s ? parseEstrategia(s.estrategia) : null;
      if (!s || !est) return { ok: false, resumen: 'La secuencia ya no existe o se quedó sin estrategia.' };
      const e = payload.escenario as EscenarioSecuencia;
      // Mismo merge que resolverHandoff: se suma al final, el orden es el orden en que se enseñó.
      await guardarEstrategia(id, { ...est, escenarios: [...est.escenarios.filter((x) => x.titulo !== e.titulo), e] });
      return { ok: true, resumen: `Caso «${e.titulo}» guardado en «${s.nombre}».` };
    },
  },

  resolver_handoff: {
    preparar: async (input) => {
      const id = num(input, 'handoffId');
      const h = await handoffFila(id);
      if (!h) return { error: `No existe el hand-off #${id} en este negocio.` };
      if (h.resuelto_at) return { error: `El hand-off #${id} ya está resuelto.` };
      // secuenciaFila y no secuenciaVigente: resolverHandoff escribe el caso aunque la secuencia esté archivada.
      const s = h.secuencia_id != null ? await secuenciaFila(h.secuencia_id) : null;
      const est = s ? parseEstrategia(s.estrategia) : null;
      const escenario = { titulo: str(input, 'titulo'), cuando: str(input, 'cuando'), comoResponder: str(input, 'comoResponder') };
      // resolverHandoff agrega al FINAL y escenariosDe recorta a 30 en la próxima lectura: el caso enseñado
      // desaparecería en silencio con el hand-off ya resuelto y la inscripción reactivada.
      if (s && est && est.escenarios.length >= 30 && !est.escenarios.some((x) => x.titulo === escenario.titulo)) {
        return { error: `La secuencia «${s.nombre}» ya tiene 30 casos, el máximo: reemplaza uno con agregar_escenario_secuencia (mismo título) antes de resolver este hand-off.` };
      }
      const guarda = !s ? 'el hand-off no tiene secuencia: el caso NO se guarda, solo se resuelve'
        : est ? `se suma a «${s.nombre}»${s.archivada_at ? ', que está archivada' : ''}`
        : `«${s.nombre}» no tiene estrategia: el caso NO se guarda, solo se resuelve`;
      return { payload: { handoffId: id, escenario }, resumen: `Resolver el hand-off #${id} con el caso «${escenario.titulo}» (${guarda}) y reactivar al lead` };
    },
    ejecutar: async (payload) => {
      await resolverHandoff(Number(payload.handoffId), payload.escenario as EscenarioSecuencia);
      return { ok: true, resumen: `Hand-off #${Number(payload.handoffId)} resuelto.` };
    },
  },

  archivar_secuencia: {
    preparar: async (input) => {
      const id = num(input, 'secuenciaId');
      const s = await secuenciaFila(id);
      if (!s) return { error: `No existe la secuencia #${id} en este negocio.` };
      if (s.archivada_at) return { error: `La secuencia «${s.nombre}» ya está archivada.` };
      const vivas = await inscripcionesVivas(id);
      return { payload: { secuenciaId: id }, resumen: `Archivar «${s.nombre}» y cancelar ${vivas ?? 'sus'} inscripciones vivas (esos leads no pueden volver a entrar)` };
    },
    ejecutar: async (payload) => {
      const id = Number(payload.secuenciaId);
      // archivarSecuencias([]) o sin ids archiva TODAS las del negocio: el id se exige acá.
      if (!Number.isInteger(id) || id < 1) return { ok: false, resumen: 'Falta el id de la secuencia.' };
      const r = await archivarSecuencias([id]);
      return r.archivadas ? { ok: true, resumen: `Secuencia #${id} archivada; ${r.inscripcionesCanceladas} inscripciones canceladas.` } : { ok: false, resumen: 'La secuencia ya estaba archivada o no existe.' };
    },
  },

  probar_secuencia: {
    preparar: async (input) => {
      const id = num(input, 'secuenciaId');
      const s = await secuenciaVigente(id);
      if (!s) return { error: noExiste(id) };
      if (!s.pasos.length) return { error: `La secuencia «${s.nombre}» no tiene pasos para probar.` };
      const c = await getContactoReportes();
      if (!c.telefono && !c.email) return { error: 'El dueño no tiene teléfono ni email en Perfil: cárgalos para recibir la prueba.' };
      const destinos = [c.telefono ? `WhatsApp terminado en ${c.telefono.replace(/\D/g, '').slice(-4)}` : null, c.email ? `email ${c.email}` : null].filter(Boolean).join(' y ');
      return { payload: { secuenciaId: id }, resumen: `Mandar los ${s.pasos.length} pasos de «${s.nombre}» marcados [PRUEBA] a tu ${destinos}` };
    },
    ejecutar: async (payload) => {
      const r = await probarSecuencia(Number(payload.secuenciaId));
      if (!r.ok) return { ok: false, resumen: r.error };
      return { ok: true, resumen: `Prueba enviada: ${r.enviadosWa} por WhatsApp y ${r.enviadosEmail} por email.${r.avisos.length ? ` ${[...new Set(r.avisos)].join(' ')}` : ''}` };
    },
  },

  guardar_link_video: {
    preparar: async (input) => {
      const link = str(input, 'linkVideo');
      if (!/^https?:\/\/\S+$/i.test(link)) return { error: 'El link tiene que ser una URL completa que empiece con http:// o https://, sin espacios.' };
      return { payload: { linkVideo: link }, resumen: `Guardar el link del video de preparación: ${link}` };
    },
    ejecutar: async (payload) => {
      await setSetting(KEY_LINK_VIDEO, String(payload.linkVideo));
      return { ok: true, resumen: 'Link del video guardado. Las secuencias ya armadas lo toman al rearmarlas desde los audios.' };
    },
  },

  crear_lead_magnet: {
    preparar: async (input) => {
      const nombre = str(input, 'nombre'); const enlace = str(input, 'enlace');
      if (!/^https?:\/\/\S+$/i.test(enlace)) return { error: 'El enlace tiene que ser una URL completa que empiece con http:// o https://, sin espacios.' };
      return { payload: { nombre, enlace }, resumen: `Crear el lead magnet «${nombre}» con el enlace ${enlace}` };
    },
    ejecutar: async (payload) => {
      const id = await crearLeadMagnet(String(payload.nombre), String(payload.enlace));
      return { ok: true, resumen: `Lead magnet «${String(payload.nombre)}» creado.`, datos: { leadMagnetId: id } };
    },
  },

  borrar_audio: {
    preparar: async (input) => {
      const audioId = num(input, 'audioId');
      const a = await getAudio(audioId);
      if (!a) return { error: `No existe el audio #${audioId} en este negocio.` };
      const usan = (await getSecuenciasConStats()).filter((s) => s.pasos.some((p) => Number(p.audio_id) === audioId));
      if (usan.length) return { error: `El audio «${a.titulo}» lo usan pasos de: ${usan.map((s) => `«${s.nombre}» (#${s.id})`).join(', ')}. Quítaselo primero con asignar_audio_paso.` };
      return { payload: { audioId }, resumen: `Borrar para siempre la nota de voz «${a.titulo}»` };
    },
    ejecutar: async (payload) => {
      const audioId = Number(payload.audioId);
      if ((await getSecuenciasConStats()).some((s) => s.pasos.some((p) => Number(p.audio_id) === audioId))) return { ok: false, resumen: 'Un paso empezó a usar este audio: no se borró.' };
      await borrarAudio(audioId);
      await quitarAudioDeClaves(audioId);
      return { ok: true, resumen: `Audio #${audioId} borrado.` };
    },
  },

  responder_huecos_voz: {
    preparar: async (input) => {
      const respuestas = Object.fromEntries(CLAVES_BLOQUE_VOZ.map((k) => [k, str(input, k)]).filter(([, v]) => v));
      if (!Object.keys(respuestas).length) return { error: 'Pasa al menos un bloque (tono, preguntas, objeciones, cierre o patron).', faltan: ['tono'] };
      return { payload: { respuestas }, resumen: `Completar la guía de voz con: ${Object.keys(respuestas).join(', ')}` };
    },
    ejecutar: async (payload) => {
      const r = await responderHuecosVoz(payload.respuestas as Record<string, string>);
      return { ok: true, resumen: r.guiaActualizada ? 'Guía de voz actualizada.' : 'Respuestas guardadas; la guía todavía no tiene contenido para componerse.' };
    },
  },

  armar_secuencias_de_audios: {
    preparar: async () => {
      const [porClave, audios, existentes] = await Promise.all([leerAudiosPorClave(), listAudios(), secuenciasChatAgent()]);
      const vivos = new Set(audios.map((a) => a.id));
      // Solo las situaciones que armarSecuenciasDeAudios consume: con otras, confirmar devolvía «faltan audios».
      const cubiertas = Object.entries(porClave).filter(([k, id]) => k in AUDIO_A_SECUENCIA && vivos.has(id)).map(([k]) => k);
      if (!cubiertas.length) return { error: 'No hay audio asignado a bienvenida, agenda_con_bienvenida ni agenda_primer_contacto, que son las únicas situaciones que se convierten en secuencia.' };
      const porClaveSec = new Map(existentes.map((s) => [s.clave, s]));
      const detalle = cubiertas.map((k) => {
        const s = porClaveSec.get(AUDIO_A_SECUENCIA[k]);
        if (!s) return `${k}: secuencia nueva, nace pausada`;
        if (s.archivada_at) return `${k}: «${s.nombre}» está archivada y se DESARCHIVA${s.activa ? ' prendida: vuelve a enviar' : ' (pausada)'}`;
        return `${k}: se reescribe «${s.nombre}»${s.activa ? ', que está ACTIVA: manda los pasos nuevos en el acto' : ' (pausada)'}`;
      });
      const vieja = cubiertas.some((k) => k.startsWith('agenda_')) && porClaveSec.get('chat-agent-post-agenda') && !porClaveSec.get('chat-agent-post-agenda')!.archivada_at
        ? '. Además se archiva y pausa la post-agenda vieja' : '';
      return { payload: {}, resumen: `Armar o rearmar las secuencias del onboarding. ${detalle.join('; ')}${vieja}. Las reescritas pierden sus cambios de texto y variantes.` };
    },
    ejecutar: async () => {
      const link = await getSetting(KEY_LINK_VIDEO).catch(() => null);
      const r = await armarSecuenciasDeAudios((link ?? '').trim() || null);
      if (!r.length) return { ok: false, resumen: 'No se armó ninguna secuencia: faltan audios.' };
      return { ok: true, resumen: `Secuencias armadas: ${r.map((x) => `«${x.nombre}» (${x.creada ? 'nueva, pausada' : 'reescrita'})`).join(', ')}.` };
    },
  },

  destilar_voz: {
    preparar: async () => ({ payload: {}, resumen: 'MaKo reescribe la guía de voz desde las transcripciones de tus anuncios y tu perfil de marca (usa IA; pisa la guía actual)' }),
    ejecutar: async () => {
      const r = await destilarVoz();
      if (!r.ok) return { ok: false, resumen: r.error };
      return { ok: true, resumen: `Guía de voz destilada desde ${r.fuentes} fuentes.`, datos: { costo_usd: r.uso?.costUsd ?? null } };
    },
  },

  enviar_plantilla_meta_paso: {
    preparar: async (input) => {
      const id = num(input, 'secuenciaId'); const orden = num(input, 'orden');
      const s = await secuenciaVigente(id);
      if (!s) return { error: noExiste(id) };
      const p = s.pasos.find((x) => x.orden === orden);
      if (!p) return { error: `La secuencia «${s.nombre}» no tiene paso ${orden}.` };
      if (p.canal !== 'whatsapp' || p.proveedor === 'no_oficial') return { error: 'Solo los pasos de WhatsApp oficial usan plantilla de Meta.' };
      if (!p.cuerpo?.trim() || RX_RELLENO.test(p.cuerpo)) return { error: 'El paso no tiene texto terminado: escríbelo primero.' };
      return { payload: { secuenciaId: id, orden }, resumen: `Convertir el paso ${orden} de «${s.nombre}» en plantilla de Meta y mandarla a aprobar (usa IA y el cupo de plantillas${p.template_wa ? `; si «${p.template_wa}» ya está aprobada o en revisión no se reemplaza` : ''})` };
    },
    ejecutar: async (payload) => {
      const r = await plantillaDesdePaso(Number(payload.secuenciaId), Number(payload.orden));
      if (!r.ok) return { ok: false, resumen: r.error };
      return { ok: true, resumen: `Plantilla «${r.name}»: ${r.status}.${r.nota ? ` ${r.nota}` : ''}`, datos: { costo_usd: r.uso?.costUsd ?? null } };
    },
  },
};
